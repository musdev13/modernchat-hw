import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  assertCanPost,
  attachmentLabel,
  hiddenMessageIds,
  releaseMessageFiles,
} from "./messageStorage";
import { deletePollWithVotes, pollView } from "./polls";
import { clearedAtOf, isMutedNow } from "./roomSettings";
import { getAuthUser, premiumFlags } from "./users";

// TTL presence — если heartbeat старше, считаем что юзер ушёл из чата
const PRESENCE_TTL_MS = 30_000;

// Рядок для списку чатів: у групах з іменем відправника, в особистих чатах — без нього.
export function previewLine(
  room: { isDirect?: boolean; isChannel?: boolean } | null | undefined,
  senderName: string,
  text: string,
): string {
  return room?.isDirect || room?.isChannel ? text : `${senderName}: ${text}`;
}

export async function assertRoomMember(
  ctx: any,
  roomId: Id<"chatRooms">,
  userId: Id<"users">,
) {
  const room = await ctx.db.get(roomId);
  if (!room) throw new Error("Кімнату не знайдено");
  if (!(room.participantIds ?? [room.creatorId]).includes(userId)) {
    throw new Error("Access denied: Ви не є учасником цієї кімнати");
  }
  return room;
}

// Возвращает true, если пользователь сейчас находится в этой комнате
async function isUserInRoom(
  ctx: any,
  userId: Id<"users">,
  roomId: Id<"chatRooms">,
): Promise<boolean> {
  const presence = await ctx.db
    .query("chatPresence")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (!presence) return false;
  if (presence.chatRoomId !== roomId) return false;
  return presence.lastSeenAt > Date.now() - PRESENCE_TTL_MS;
}

export async function schedulePushForNewMessage(
  ctx: any,
  params: {
    roomId: Id<"chatRooms">;
    senderId: Id<"users">;
    senderName: string;
    previewText: string;
    roomTitle?: string;
    participantIds: Id<"users">[];
  },
) {
  const {
    roomId,
    senderId,
    senderName,
    previewText,
    roomTitle,
    participantIds,
  } = params;

  const recipientIds = participantIds.filter((id) => id !== senderId);
  if (recipientIds.length === 0) return;

  const recipients = await Promise.all(
    recipientIds.map((id: Id<"users">) => ctx.db.get(id)),
  );

  // ⚠️ Отфильтровываем получателей, которые сейчас сидят в этом же чате
  // Також пропускаємо тих, хто вимкнув сповіщення цієї кімнати.
  // Тип чату для налаштувань сповіщень одержувача.
  const kindDoc = await ctx.db.get(roomId);
  const kind: "messages" | "groups" | "channels" = kindDoc?.isChannel
    ? "channels"
    : kindDoc?.isDirect
      ? "messages"
      : "groups";

  const filtered = await Promise.all(
    recipients.map(async (user: any) => {
      if (!user) return null;
      // Користувач вимкнув сповіщення цього типу чатів.
      if (user.notifPrefs && user.notifPrefs[kind] === false) return null;
      const inThisChat = await isUserInRoom(ctx, user._id, roomId);
      if (inThisChat) return null;
      const setting = await ctx.db
        .query("roomSettings")
        .withIndex("by_user_and_room", (q: any) =>
          q.eq("userId", user._id).eq("chatRoomId", roomId),
        )
        .first();
      return isMutedNow(setting) ? null : user;
    }),
  );

  const roomDoc = await ctx.db.get(roomId);
  const isGroupChat = participantIds.length > 2;
  // Канал: заголовок — назва каналу (автор публікації не показується).
  const notificationTitle = roomDoc?.isChannel
    ? (roomTitle ?? senderName)
    : isGroupChat && roomTitle
      ? `${roomTitle} • ${senderName}`
      : senderName;

  const notifications = filtered
    .filter((user: any) => user && user.pushToken)
    .map((user: any) => ({
      pushToken: user.pushToken as string,
      title: notificationTitle,
      // «Показувати текст» вимкнено — без вмісту повідомлення.
      body: user.notifPrefs?.preview === false ? "Нове повідомлення" : previewText,
      ...(user.notifPrefs?.sound === false ? { sound: false } : {}),
      data: {
        type: "chat",
        chatRoomId: roomId,
        conversationId: roomId,
      },
    }));

  if (notifications.length === 0) return;

  if (notifications.length === 1) {
    await ctx.scheduler.runAfter(
      0,
      internal.pushNotifications.sendPushNotification,
      notifications[0],
    );
  } else {
    await ctx.scheduler.runAfter(
      0,
      internal.pushNotifications.sendPushNotificationsBatch,
      { notifications },
    );
  }
}

export const getPaginatedMessages = query({
  args: {
    chatRoomId: v.id("chatRooms"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized");
    const userId = me._id;

    await assertRoomMember(ctx, args.chatRoomId, userId);

    // «Очистити історію» (для себе): показуємо лише новіші повідомлення.
    const clearedAt = await clearedAtOf(ctx, userId, args.chatRoomId);
    const paginated = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) =>
        clearedAt > 0
          ? q.eq("chatRoomId", args.chatRoomId).gt("_creationTime", clearedAt)
          : q.eq("chatRoomId", args.chatRoomId),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    // «Видалені для мене» повідомлення не показуємо.
    const hidden = await hiddenMessageIds(ctx, userId, args.chatRoomId);

    // Преміум-прапорці авторів (бейдж ⭐ біля імені) — один запит на унікального автора.
    const senderIds = Array.from(new Set(paginated.page.map((m) => m.senderId as string)));
    const senderFlags = new Map<string, { isPremium: boolean; emojiStatus?: string }>();
    await Promise.all(
      senderIds.map(async (id) => {
        const sender = await ctx.db.get(id as Id<"users">);
        senderFlags.set(id, premiumFlags(sender));
      }),
    );

    const page = await Promise.all(
      paginated.page
        .filter((message) => !hidden.has(message._id))
        .map(async (message) => {
        const reactions = await ctx.db
          .query("messageReactions")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .collect();

        const grouped = new Map<
          string,
          { count: number; hasReacted: boolean }
        >();

        for (const reaction of reactions) {
          const current = grouped.get(reaction.emoji) ?? {
            count: 0,
            hasReacted: false,
          };
          current.count += 1;
          current.hasReacted ||= reaction.userId === userId;
          grouped.set(reaction.emoji, current);
        }

        const pollDoc = message.pollId ? await ctx.db.get(message.pollId) : null;
        const poll = pollDoc ? await pollView(ctx, pollDoc, userId) : undefined;

        return {
          ...message,
          senderPremium: senderFlags.get(message.senderId as string)?.isPremium ?? false,
          senderEmojiStatus: senderFlags.get(message.senderId as string)?.emojiStatus,
          poll,
          reactions: Array.from(grouped, ([emoji, reaction]) => ({
            emoji,
            ...reaction,
          })),
        };
      }),
    );

    return { ...paginated, page };
  },
});

// Хто й якою реакцією відреагував на повідомлення (для листа «Реакції»).
export const getReactors = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];
    const message = await ctx.db.get(args.messageId);
    if (!message) return [];
    await assertRoomMember(ctx, message.chatRoomId, me._id);

    const reactions = await ctx.db
      .query("messageReactions")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();
    const result = [];
    for (const reaction of reactions) {
      const user = await ctx.db.get(reaction.userId);
      result.push({
        emoji: reaction.emoji,
        userId: reaction.userId,
        name: user?.name ?? user?.username ?? user?.email ?? "Користувач",
        image: user?.image,
        isMe: reaction.userId === me._id,
      });
    }
    return result;
  },
});

export const toggleReaction = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const userId = me._id;

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found: Повідомлення не знайдено");
    await assertRoomMember(ctx, message.chatRoomId, userId);

    const existing = await ctx.db
      .query("messageReactions")
      .withIndex("by_user_and_message", (q) =>
        q.eq("userId", userId).eq("messageId", args.messageId),
      )
      .first();

    if (!existing) {
      await ctx.db.insert("messageReactions", {
        messageId: args.messageId,
        userId,
        emoji: args.emoji,
      });
      return { action: "added", emoji: args.emoji };
    }

    if (existing.emoji === args.emoji) {
      await ctx.db.delete(existing._id);
      return { action: "removed", emoji: args.emoji };
    }

    await ctx.db.patch(existing._id, { emoji: args.emoji });
    return { action: "updated", emoji: args.emoji };
  },
});

export const listMessages = query({
  args: { chatRoomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized");
    await assertRoomMember(ctx, args.chatRoomId, me._id);

    return await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.chatRoomId))
      .order("asc")
      .collect();
  },
});

const STICKER_MARK = "\u2063\u2063";

// Короткий текст для смужки закріпленого повідомлення.
function previewOf(message: {
  content?: string;
  isVideoNote?: boolean;
  videoUrl?: string;
  audioUrl?: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
}): string {
  const text = message.content?.trim() ?? "";
  if (text.startsWith(STICKER_MARK)) return "Наліпка";
  if (text) return text.length > 140 ? `${text.slice(0, 140)}…` : text;
  return attachmentLabel(message) ?? "Повідомлення";
}

const MAX_PINNED = 50;

// Закріпити / відкріпити повідомлення (будь-який учасник кімнати).
export const togglePin = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found: Повідомлення не знайдено");
    const room = await assertRoomMember(ctx, message.chatRoomId, me._id);
    assertCanPost(room, me._id);
    if (message.isSystem) {
      throw new Error("Системні повідомлення не можна закріпити");
    }

    const pinned: Id<"messages">[] = room.pinnedMessageIds ?? [];
    if (pinned.includes(args.messageId)) {
      await ctx.db.patch(message.chatRoomId, {
        pinnedMessageIds: pinned.filter((id) => id !== args.messageId),
      });
      return { pinned: false };
    }

    await ctx.db.patch(message.chatRoomId, {
      pinnedMessageIds: [...pinned, args.messageId].slice(-MAX_PINNED),
    });
    return { pinned: true };
  },
});

// Закріплені повідомлення кімнати (від найстарішого закріплення до найновішого).
export const getPinnedMessages = query({
  args: { chatRoomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];
    const room = await ctx.db.get(args.chatRoomId);
    if (!room) return [];
    if (!(room.participantIds ?? [room.creatorId]).includes(me._id)) return [];

    const result: {
      _id: Id<"messages">;
      senderName: string;
      preview: string;
    }[] = [];
    const hidden = await hiddenMessageIds(ctx, me._id, args.chatRoomId);
    for (const id of room.pinnedMessageIds ?? []) {
      if (hidden.has(id)) continue;
      const message = await ctx.db.get(id);
      if (!message || message.chatRoomId !== args.chatRoomId) continue;
      result.push({
        _id: message._id,
        senderName: message.senderName,
        preview: previewOf(message),
      });
    }
    return result;
  },
});

const SEARCH_SCAN_LIMIT = 2000;

// Пошук підрядка (без урахування регістру) по повідомленнях кімнати, від нових до старих.
export const searchMessages = query({
  args: {
    chatRoomId: v.id("chatRooms"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];
    await assertRoomMember(ctx, args.chatRoomId, me._id);

    const needle = args.query.trim().toLowerCase();
    if (!needle) return [];
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 30), 1), 50);

    const recent = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.chatRoomId))
      .order("desc")
      .take(SEARCH_SCAN_LIMIT);

    const results: {
      _id: Id<"messages">;
      _creationTime: number;
      senderName: string;
      snippet: string;
    }[] = [];

    const hidden = await hiddenMessageIds(ctx, me._id, args.chatRoomId);
    const clearedAt = await clearedAtOf(ctx, me._id, args.chatRoomId);
    for (const message of recent) {
      if (message._creationTime <= clearedAt) break;
      if (message.isSystem || hidden.has(message._id)) continue;
      const text = message.content ?? "";
      if (text.startsWith(STICKER_MARK)) continue;
      const index = text.toLowerCase().indexOf(needle);
      if (index < 0) continue;

      const start = Math.max(0, index - 30);
      const end = Math.min(text.length, index + needle.length + 90);
      results.push({
        _id: message._id,
        _creationTime: message._creationTime,
        senderName: message.senderName,
        snippet:
          (start > 0 ? "…" : "") +
          text.slice(start, end) +
          (end < text.length ? "…" : ""),
      });
      if (results.length >= limit) break;
    }
    return results;
  },
});

// Метадані повідомлення для переходу з цитати (null, якщо його видалено).
export const getMessageMeta = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized");
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;
    await assertRoomMember(ctx, message.chatRoomId, me._id);
    return { createdAt: message._creationTime };
  },
});

export const sendMessage = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    content: v.string(),
    replyToId: v.optional(v.id("messages")),
    replyToSender: v.optional(v.string()),
    replyToText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized: Потрібна авторизація");
    const userId = user._id;

    const room = await assertRoomMember(ctx, args.chatRoomId, userId);
    assertCanPost(room, userId);

    const trimmedContent = args.content.trim();
    if (!trimmedContent) throw new Error("Message content cannot be empty");

    const messageId = await ctx.db.insert("messages", {
      chatRoomId: args.chatRoomId,
      senderId: userId,
      senderName: user.name ?? user.email ?? "Користувач",
      senderPhoto: user.image,
      content: trimmedContent,
      replyToId: args.replyToId,
      replyToSender: args.replyToSender,
      replyToText: args.replyToText,
    });

    await ctx.db.patch(args.chatRoomId, {
      lastMessage: previewLine(room, user.name ?? "Користувач", trimmedContent),
      lastMessageAt: Date.now(),
    });

    const senderName = user.name ?? user.email ?? "Користувач";
    await schedulePushForNewMessage(ctx, {
      roomId: args.chatRoomId,
      senderId: userId,
      senderName,
      previewText: trimmedContent,
      roomTitle: room.title,
      participantIds: (room.participantIds ?? [room.creatorId]) as Id<"users">[],
    });

    return messageId;
  },
});

// Переслати повідомлення (текст або медіа) в іншу свою кімнату. Файли не копіюються:
// нове повідомлення посилається на той самий storageId, а видалення оригіналу не зачіпає
// файл, поки на нього посилається хоч одне повідомлення (див. releaseMessageFiles).
export const forwardMessage = mutation({
  args: {
    messageId: v.id("messages"),
    targetChatRoomId: v.id("chatRooms"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized: Потрібна авторизація");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Повідомлення не знайдено");
    await assertRoomMember(ctx, message.chatRoomId, user._id);
    const room = await assertRoomMember(ctx, args.targetChatRoomId, user._id);
    assertCanPost(room, user._id);
    if (message.isSystem) throw new Error("Системні повідомлення не пересилаються");
    if (message.pollId) throw new Error("Опитування не можна переслати");

    const text = message.content?.trim();
    const label = attachmentLabel(message);
    if (!text && !label) throw new Error("Це повідомлення не можна переслати");

    const senderName = user.name ?? user.email ?? "Користувач";
    await ctx.db.insert("messages", {
      chatRoomId: args.targetChatRoomId,
      senderId: user._id,
      senderName,
      senderPhoto: user.image,
      content: text || undefined,
      forwardedFrom: message.forwardedFrom ?? message.senderName,
      imageUrl: message.imageUrl,
      storageId: message.storageId,
      audioUrl: message.audioUrl,
      audioStorageId: message.audioStorageId,
      audioDuration: message.audioDuration,
      waveform: message.waveform,
      videoUrl: message.videoUrl,
      videoStorageId: message.videoStorageId,
      videoDuration: message.videoDuration,
      isVideoNote: message.isVideoNote,
      fileUrl: message.fileUrl,
      fileStorageId: message.fileStorageId,
      fileName: message.fileName,
      fileSize: message.fileSize,
      fileMime: message.fileMime,
      mediaWidth: message.mediaWidth,
      mediaHeight: message.mediaHeight,
    });
    const preview = text && !text.startsWith("\u2063\u2063") ? text : (label ?? "Наліпка");
    await ctx.db.patch(args.targetChatRoomId, {
      lastMessage: previewLine(room, senderName, `↪ ${preview}`),
      lastMessageAt: Date.now(),
    });
    await schedulePushForNewMessage(ctx, {
      roomId: args.targetChatRoomId,
      senderId: user._id,
      senderName,
      previewText: `↪ ${preview}`,
      roomTitle: room.title,
      participantIds: (room.participantIds ?? [room.creatorId]) as Id<"users">[],
    });
  },
});

export const editMessage = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const userId = me._id;

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found: Повідомлення не знайдено");
    await assertRoomMember(ctx, message.chatRoomId, userId);

    if (message.senderId !== userId) {
      throw new Error("Forbidden: Ви можете редагувати лише власні повідомлення");
    }

    const trimmedContent = args.content.trim();
    if (!trimmedContent) throw new Error("Повідомлення не може бути порожнім");

    await ctx.db.patch(args.messageId, {
      content: trimmedContent,
      isEdited: true,
    });

    const room = await ctx.db.get(message.chatRoomId);
    if (room && room.lastMessageAt === message._creationTime) {
      await ctx.db.patch(message.chatRoomId, {
        lastMessage: previewLine(room, message.senderName, trimmedContent),
      });
    }
  },
});

export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const userId = me._id;

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found: Повідомлення не знайдено");
    const room = await assertRoomMember(ctx, message.chatRoomId, userId);

    // Видалити для всіх: автор; в особистому чаті — будь-який із двох; у групі — адмін/творець.
    const isAdmin =
      !room.isDirect &&
      (room.creatorId === userId || (room.adminIds ?? []).includes(userId));
    if (message.senderId !== userId && !room.isDirect && !isAdmin) {
      throw new Error("Forbidden: Ви можете видаляти для всіх лише власні повідомлення");
    }

    await releaseMessageFiles(ctx, message);
    if (message.pollId) await deletePollWithVotes(ctx, message.pollId);

    const hides = await ctx.db
      .query("messageHides")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();
    await Promise.all(hides.map((hide) => ctx.db.delete(hide._id)));

    const reactions = await ctx.db
      .query("messageReactions")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();
    await Promise.all(reactions.map((reaction) => ctx.db.delete(reaction._id)));

    await ctx.db.delete(args.messageId);

    const roomOfMessage = await ctx.db.get(message.chatRoomId);
    if (roomOfMessage?.pinnedMessageIds?.includes(args.messageId)) {
      await ctx.db.patch(message.chatRoomId, {
        pinnedMessageIds: roomOfMessage.pinnedMessageIds.filter(
          (id) => id !== args.messageId,
        ),
      });
    }

    const lastRemainingMessage = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", message.chatRoomId))
      .order("desc")
      .first();

    await ctx.db.patch(message.chatRoomId, {
      lastMessage: lastRemainingMessage
        ? previewLine(
            roomOfMessage,
            lastRemainingMessage.senderName,
            lastRemainingMessage.content?.trim() ||
              attachmentLabel(lastRemainingMessage) ||
              "",
          )
        : "Повідомлень немає",
      lastMessageAt: lastRemainingMessage?._creationTime ?? Date.now(),
    });
  },
});

// «Видалити для мене»: ховаємо повідомлення лише для поточного користувача.
export const hideMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const message = await ctx.db.get(args.messageId);
    if (!message) return;
    await assertRoomMember(ctx, message.chatRoomId, me._id);

    const existing = await ctx.db
      .query("messageHides")
      .withIndex("by_user_and_message", (q) =>
        q.eq("userId", me._id).eq("messageId", args.messageId),
      )
      .first();
    if (existing) return;
    await ctx.db.insert("messageHides", {
      userId: me._id,
      messageId: args.messageId,
      chatRoomId: message.chatRoomId,
    });
  },
});

export const generateUploadUrl = mutation(async (ctx) => {
  const me = await getAuthUser(ctx);
  if (!me) throw new Error("Unauthorized: Потрібна авторизація");

  return await ctx.storage.generateUploadUrl();
});

export const sendMediaMessage = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
    replyToId: v.optional(v.id("messages")),
    replyToSender: v.optional(v.string()),
    replyToText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized: Потрібна авторизація");
    const userId = user._id;

    const room = await assertRoomMember(ctx, args.chatRoomId, userId);
    assertCanPost(room, userId);

    const imageUrl = await ctx.storage.getUrl(args.storageId);
    if (!imageUrl) throw new Error("Не вдалося отримати посилання на збережений файл");

    const messageId = await ctx.db.insert("messages", {
      chatRoomId: args.chatRoomId,
      senderId: userId,
      senderName: user.name ?? user.email ?? "Користувач",
      senderPhoto: user.image,
      content: args.caption?.trim() || undefined,
      imageUrl,
      storageId: args.storageId,
      replyToId: args.replyToId,
      replyToSender: args.replyToSender,
      replyToText: args.replyToText,
    });

    await ctx.db.patch(args.chatRoomId, {
      lastMessage: previewLine(room, user.name ?? "Користувач", "📷 Фотографія"),
      lastMessageAt: Date.now(),
    });

    const senderName = user.name ?? user.email ?? "Користувач";
    await schedulePushForNewMessage(ctx, {
      roomId: args.chatRoomId,
      senderId: userId,
      senderName,
      previewText: args.caption?.trim() || "📷 Фотографія",
      roomTitle: room.title,
      participantIds: (room.participantIds ?? [room.creatorId]) as Id<"users">[],
    });

    return messageId;
  },
});

// Нове опитування: 2–10 варіантів, анонімне / публічне, одна або кілька відповідей.
export const createPoll = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    question: v.string(),
    options: v.array(v.string()),
    anonymous: v.boolean(),
    multiple: v.boolean(),
    replyToId: v.optional(v.id("messages")),
    replyToSender: v.optional(v.string()),
    replyToText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized: Потрібна авторизація");
    const room = await assertRoomMember(ctx, args.chatRoomId, user._id);
    assertCanPost(room, user._id);

    const question = args.question.trim();
    if (!question) throw new Error("Введіть запитання");
    if (question.length > 255) throw new Error("Запитання задовге (до 255 символів)");
    const options = args.options.map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) throw new Error("Додайте щонайменше два варіанти відповіді");
    if (options.length > 10) throw new Error("Максимум 10 варіантів відповіді");
    if (options.some((o) => o.length > 100)) {
      throw new Error("Варіант відповіді задовгий (до 100 символів)");
    }

    const pollId = await ctx.db.insert("polls", {
      chatRoomId: args.chatRoomId,
      creatorId: user._id,
      question,
      options: options.map((text, index) => ({ id: String(index + 1), text })),
      anonymous: args.anonymous,
      multiple: args.multiple,
    });

    const senderName = user.name ?? user.email ?? "Користувач";
    await ctx.db.insert("messages", {
      chatRoomId: args.chatRoomId,
      senderId: user._id,
      senderName,
      senderPhoto: user.image,
      pollId,
      replyToId: args.replyToId,
      replyToSender: args.replyToSender,
      replyToText: args.replyToText,
    });

    const label = `📊 ${question}`;
    await ctx.db.patch(args.chatRoomId, {
      lastMessage: previewLine(room, senderName, label),
      lastMessageAt: Date.now(),
    });
    await schedulePushForNewMessage(ctx, {
      roomId: args.chatRoomId,
      senderId: user._id,
      senderName,
      previewText: label,
      roomTitle: room.title,
      participantIds: (room.participantIds ?? [room.creatorId]) as Id<"users">[],
    });
    return pollId;
  },
});

// Фото / відео / файл з підписом. Файл уже завантажений у storage через generateUploadUrl.
export const sendAttachment = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    kind: v.union(v.literal("image"), v.literal("video"), v.literal("file")),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    duration: v.optional(v.number()),
    replyToId: v.optional(v.id("messages")),
    replyToSender: v.optional(v.string()),
    replyToText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized: Потрібна авторизація");
    const userId = user._id;
    const room = await assertRoomMember(ctx, args.chatRoomId, userId);
    assertCanPost(room, userId);

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Не вдалося отримати посилання на збережений файл");

    const senderName = user.name ?? user.email ?? "Користувач";
    const caption = args.caption?.trim() || undefined;
    const sizes = {
      mediaWidth: args.width && args.width > 0 ? Math.round(args.width) : undefined,
      mediaHeight: args.height && args.height > 0 ? Math.round(args.height) : undefined,
    };
    const base = {
      chatRoomId: args.chatRoomId,
      senderId: userId,
      senderName,
      senderPhoto: user.image,
      content: caption,
      replyToId: args.replyToId,
      replyToSender: args.replyToSender,
      replyToText: args.replyToText,
    };

    let label: string;
    if (args.kind === "image") {
      await ctx.db.insert("messages", {
        ...base,
        ...sizes,
        imageUrl: url,
        storageId: args.storageId,
      });
      label = "📷 Фотографія";
    } else if (args.kind === "video") {
      await ctx.db.insert("messages", {
        ...base,
        ...sizes,
        videoUrl: url,
        videoStorageId: args.storageId,
        videoDuration: args.duration,
        isVideoNote: false,
      });
      label = "🎥 Відео";
    } else {
      const fileName = args.fileName?.trim() || "Файл";
      await ctx.db.insert("messages", {
        ...base,
        fileUrl: url,
        fileStorageId: args.storageId,
        fileName,
        fileSize: args.fileSize,
        fileMime: args.mimeType,
      });
      label = `📎 ${fileName}`;
    }

    await ctx.db.patch(args.chatRoomId, {
      lastMessage: previewLine(room, senderName, caption ? `${label} ${caption}` : label),
      lastMessageAt: Date.now(),
    });
    await schedulePushForNewMessage(ctx, {
      roomId: args.chatRoomId,
      senderId: userId,
      senderName,
      previewText: caption ? `${label} ${caption}` : label,
      roomTitle: room.title,
      participantIds: (room.participantIds ?? [room.creatorId]) as Id<"users">[],
    });
  },
});

export const sendVoiceMessage = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    audioStorageId: v.id("_storage"),
    audioDuration: v.number(),
    waveform: v.optional(v.array(v.number())),
    replyToId: v.optional(v.id("messages")),
    replyToSender: v.optional(v.string()),
    replyToText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized: Потрібна авторизація");
    const userId = user._id;

    const room = await assertRoomMember(ctx, args.chatRoomId, userId);
    assertCanPost(room, userId);

    const audioUrl = await ctx.storage.getUrl(args.audioStorageId);
    if (!audioUrl) throw new Error("Не вдалося отримати посилання на аудіофайл");

    const safeWaveform = args.waveform
      ? args.waveform
          .slice(0, 32)
          .map((value) => Math.max(0.1, Math.min(1.0, Number(value) || 0.1)))
      : undefined;

    const messageId = await ctx.db.insert("messages", {
      chatRoomId: args.chatRoomId,
      senderId: userId,
      senderName: user.name ?? user.email ?? "Користувач",
      senderPhoto: user.image,
      content: undefined,
      audioUrl,
      audioStorageId: args.audioStorageId,
      audioDuration: args.audioDuration,
      waveform: safeWaveform,
      replyToId: args.replyToId,
      replyToSender: args.replyToSender,
      replyToText: args.replyToText,
    });

    const durationSeconds = Math.max(1, Math.round(args.audioDuration));
    const previewText = `🎤 Голосове повідомлення (${durationSeconds}с)`;

    await ctx.db.patch(args.chatRoomId, {
      lastMessage: previewLine(room, user.name ?? "Користувач", previewText),
      lastMessageAt: Date.now(),
    });

    const senderName = user.name ?? user.email ?? "Користувач";
    await schedulePushForNewMessage(ctx, {
      roomId: args.chatRoomId,
      senderId: userId,
      senderName,
      previewText,
      roomTitle: room.title,
      participantIds: (room.participantIds ?? [room.creatorId]) as Id<"users">[],
    });

    return messageId;
  },
});

export const sendVideoNote = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    videoStorageId: v.id("_storage"),
    videoDuration: v.number(),
    replyToId: v.optional(v.id("messages")),
    replyToSender: v.optional(v.string()),
    replyToText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized: Потрібна авторизація");
    const userId = user._id;

    const room = await assertRoomMember(ctx, args.chatRoomId, userId);
    assertCanPost(room, userId);

    const videoUrl = await ctx.storage.getUrl(args.videoStorageId);
    if (!videoUrl) throw new Error("Не вдалося отримати посилання на відеофайл");

    const messageId = await ctx.db.insert("messages", {
      chatRoomId: args.chatRoomId,
      senderId: userId,
      senderName: user.name ?? user.email ?? "Користувач",
      senderPhoto: user.image,
      content: undefined,
      videoUrl,
      videoStorageId: args.videoStorageId,
      videoDuration: args.videoDuration,
      isVideoNote: true,
      replyToId: args.replyToId,
      replyToSender: args.replyToSender,
      replyToText: args.replyToText,
    });

    const durationSeconds = Math.max(1, Math.round(args.videoDuration));
    const previewText = `📹 Відеоповідомлення (${durationSeconds}с)`;

    await ctx.db.patch(args.chatRoomId, {
      lastMessage: previewLine(room, user.name ?? "Користувач", previewText),
      lastMessageAt: Date.now(),
    });

    const senderName = user.name ?? user.email ?? "Користувач";
    await schedulePushForNewMessage(ctx, {
      roomId: args.chatRoomId,
      senderId: userId,
      senderName,
      previewText,
      roomTitle: room.title,
      participantIds: (room.participantIds ?? [room.creatorId]) as Id<"users">[],
    });

    return messageId;
  },
});

export const seedTestMessages = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    count: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const userId = user._id;
    assertCanPost(await assertRoomMember(ctx, args.chatRoomId, userId), userId);

    const total = args.count ?? 40;

    const sampleTexts = [
      "Привіт усім! Як просувається оптимізація чату?",
      "Працюємо з Inverted FlatList у React Native 🚀",
      "Convex курсорна пагінація працює неймовірно швидко!",
      "Перевіряємо довантаження старіших повідомлень при скролі вгору...",
      "Плавність 60/120 FPS без блокування інтерфейсу ✨",
      "React.memo рятує від зайвих перерендерів під час набору тексту.",
      "Тестове повідомлення для перевірки списку #",
      "Сучасний мобільний месенджер рівня Telegram готовий!",
    ];

    for (let i = 0; i < total; i++) {
      const textIndex = i % sampleTexts.length;

      await ctx.db.insert("messages", {
        chatRoomId: args.chatRoomId,
        senderId: userId,
        senderName: user.name ?? user.email ?? "Студент",
        senderPhoto: user.image,
        content: `${sampleTexts[textIndex]} (${total - i})`,
      });
    }

    await ctx.db.patch(args.chatRoomId, {
      lastMessage: `${user.name ?? "Студент"}: ${sampleTexts[0]}`,
      lastMessageAt: Date.now(),
    });

    return { success: true, count: total };
  },
});