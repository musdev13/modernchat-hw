import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getAuthUser } from "./users";

// TTL presence — если heartbeat старше, считаем что юзер ушёл из чата
const PRESENCE_TTL_MS = 30_000;

async function assertRoomMember(
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

async function schedulePushForNewMessage(
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
  const filtered = await Promise.all(
    recipients.map(async (user: any) => {
      if (!user) return null;
      const inThisChat = await isUserInRoom(ctx, user._id, roomId);
      return inThisChat ? null : user;
    }),
  );

  const isGroupChat = participantIds.length > 2;
  const notificationTitle =
    isGroupChat && roomTitle ? `${roomTitle} • ${senderName}` : senderName;

  const notifications = filtered
    .filter((user: any) => user && user.pushToken)
    .map((user: any) => ({
      pushToken: user.pushToken as string,
      title: notificationTitle,
      body: previewText,
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

    const paginated = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.chatRoomId))
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      paginated.page.map(async (message) => {
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

        return {
          ...message,
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
      lastMessage: `${user.name ?? "Користувач"}: ${trimmedContent}`,
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
        lastMessage: `${message.senderName}: ${trimmedContent}`,
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
    await assertRoomMember(ctx, message.chatRoomId, userId);

    if (message.senderId !== userId) {
      throw new Error("Forbidden: Ви можете видаляти лише власні повідомлення");
    }

    if (message.storageId) await ctx.storage.delete(message.storageId);
    if (message.audioStorageId) await ctx.storage.delete(message.audioStorageId);
    if (message.videoStorageId) await ctx.storage.delete(message.videoStorageId);

    const reactions = await ctx.db
      .query("messageReactions")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();
    await Promise.all(reactions.map((reaction) => ctx.db.delete(reaction._id)));

    await ctx.db.delete(args.messageId);

    const lastRemainingMessage = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", message.chatRoomId))
      .order("desc")
      .first();

    await ctx.db.patch(message.chatRoomId, {
      lastMessage: lastRemainingMessage
        ? `${lastRemainingMessage.senderName}: ${lastRemainingMessage.content ?? ""}`
        : "Повідомлень немає",
      lastMessageAt: lastRemainingMessage?._creationTime ?? Date.now(),
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
      lastMessage: `${user.name ?? "Користувач"}: 📷 Фотографія`,
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
      lastMessage: `${user.name ?? "Користувач"}: ${previewText}`,
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
      lastMessage: `${user.name ?? "Користувач"}: ${previewText}`,
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