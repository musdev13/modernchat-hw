import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { MutationCtx, mutation, query } from "./_generated/server";
import { canPostIn, releaseMessageFiles } from "./messageStorage";
import { deletePollWithVotes } from "./polls";
import { isMutedNow, patchRoomSetting } from "./roomSettings";
import { getAuthUser, getPresenceRow, premiumFlags, presenceOf } from "./users";

const DIRECT_ROOM_TITLE = "Приватний чат";

// Як показувати співрозмовника в особистому чаті (так само, як у «Контактах»).
const displayNameOf = (
  user: { name?: string; username?: string; email?: string } | null,
) => user?.name ?? user?.username ?? user?.email ?? "Користувач";

const makeDirectKey = (a: Id<"users">, b: Id<"users">) =>
  [a as string, b as string].sort().join("_");

function assertGroupRoom(room: { isDirect?: boolean }) {
  if (room.isDirect) {
    throw new Error(
      "Це особистий чат: його можна лише приховати зі списку, групові дії недоступні",
    );
  }
}

const nameOf = (user: { name?: string; username?: string; email?: string } | null) =>
  user?.username ?? user?.name ?? user?.email ?? "Користувач";

const participantIdsOf = (room: {
  creatorId: Id<"users">;
  participantIds?: Id<"users">[];
}) => room.participantIds ?? [room.creatorId];

const adminIdsOf = (room: {
  creatorId: Id<"users">;
  adminIds?: Id<"users">[];
}) => room.adminIds ?? [room.creatorId];

async function requireMember(ctx: any, roomId: any, userId: any) {
  const room = await ctx.db.get(roomId);
  if (!room) throw new Error("Кімнату не знайдено");
  if (!participantIdsOf(room).includes(userId)) {
    throw new Error("Access denied: Ви не є учасником цієї кімнати");
  }
  return room;
}

export const listRooms = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];
    const rooms = await ctx.db.query("chatRooms").collect();
    const settings = await ctx.db
      .query("roomSettings")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    const settingOf = new Map(settings.map((row) => [row.chatRoomId as string, row]));
    const now = Date.now();

    // Рядки кімнат будуємо паралельно: Convex читає незалежні документи одночасно (без N+1 по черзі).
    const built = await Promise.all(
      rooms.map(async (room) => {
      const members = participantIdsOf(room);
      if (!members.includes(me._id)) return null;
      const setting = settingOf.get(room._id);

      const isSaved = !!room.isSaved;
      // Порожні особисті чати (ще без повідомлень) у списку не показуємо; «Збережене» — завжди.
      if (room.isDirect && !isSaved && !room.lastMessageAt) return null;
      // Прихований чат повертається, коли в ньому з'явилося нове повідомлення.
      if (setting?.hidden && (room.lastMessageAt ?? 0) <= (setting.hiddenAt ?? 0)) {
        return null;
      }

      let title = room.title;
      let avatarUrl = room.avatarUrl;
      let otherUserId: Id<"users"> | undefined;
      let otherOnline = false;
      let otherFlags: { isPremium: boolean; emojiStatus?: string } = { isPremium: false };
      if (isSaved) {
        title = "Збережене";
        avatarUrl = undefined;
      } else if (room.isDirect) {
        otherUserId = members.find((id) => id !== me._id);
        const other = otherUserId ? await ctx.db.get(otherUserId) : null;
        title = displayNameOf(other);
        avatarUrl = other?.image;
        otherFlags = premiumFlags(other);
        if (other) {
          otherOnline = presenceOf(other, await getPresenceRow(ctx, other._id), me._id, now).online;
        }
      }

      // Історію очищено для себе й нових повідомлень відтоді немає — підпис у списку порожній.
      const clearedPreview =
        (setting?.clearedAt ?? 0) > 0 && (room.lastMessageAt ?? 0) <= (setting?.clearedAt ?? 0);

      return {
        ...room,
        ...(clearedPreview ? { lastMessage: "" } : {}),
        title,
        avatarUrl,
        isDirect: !!room.isDirect,
        isSaved,
        canPost: canPostIn(room, me._id),
        otherUserId,
        otherOnline,
        otherPremium: otherFlags.isPremium,
        otherEmojiStatus: otherFlags.emojiStatus,
        muted: isMutedNow(setting, now),
        mutedUntil: isMutedNow(setting, now) ? setting?.mutedUntil : undefined,
        // «Збережене» завжди закріплене нагорі.
        pinned: isSaved || !!setting?.pinned,
      };
    }),
    );
    const result = built.filter((r): r is NonNullable<typeof r> => r !== null);


    const stamp = (room: { lastMessageAt?: number; _creationTime: number }) =>
      room.lastMessageAt ?? room._creationTime;
    result.sort((a, b) => {
      if (a.isSaved !== b.isSaved) return a.isSaved ? -1 : 1;
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return stamp(b) - stamp(a);
    });
    return result;
  },
});

export const getRoom = query({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return null;
    const userId = me._id;
    const room = await ctx.db.get(args.roomId);
    if (!room || !participantIdsOf(room).includes(userId)) return null;

    const participantIds = participantIdsOf(room);
    const adminIds = adminIdsOf(room);
    const participants = await Promise.all(
      participantIds.map(async (id) => {
        const user = await ctx.db.get(id);
        if (!user) return null;
        return {
          _id: user._id,
          name: nameOf(user),
          image: user.image,
          ...premiumFlags(user),
          role:
            id === room.creatorId
              ? ("creator" as const)
              : adminIds.includes(id)
                ? ("admin" as const)
                : ("member" as const),
        };
      }),
    );
    const isDirect = !!room.isDirect;
    const otherUserId = isDirect
      ? participantIds.find((id) => id !== userId)
      : undefined;
    const otherUser = otherUserId ? await ctx.db.get(otherUserId) : null;
    const isSaved = !!room.isSaved;
    const otherPresence = otherUser
      ? presenceOf(otherUser, await getPresenceRow(ctx, otherUser._id), userId)
      : undefined;
    const isCreator = !isDirect && room.creatorId === userId;
    const isAdmin = !isDirect && (isCreator || adminIds.includes(userId));
    const isChannel = !!room.isChannel;
    const linkedRoom = room.linkedDiscussionRoomId
      ? await ctx.db.get(room.linkedDiscussionRoomId)
      : null;
    const parentChannel = room.discussionOfChannelId
      ? await ctx.db.get(room.discussionOfChannelId)
      : null;
    return {
      ...room,
      isChannel,
      isPublic: !!room.isPublic,
      // У каналі писати можуть лише адміністратори.
      canPost: !isChannel || isAdmin,
      discussion: linkedRoom ? { _id: linkedRoom._id, title: linkedRoom.title } : null,
      parentChannel: parentChannel
        ? { _id: parentChannel._id, title: parentChannel.title }
        : null,
      ...(isSaved
        ? { title: "Збережене", avatarUrl: undefined }
        : isDirect
          ? { title: displayNameOf(otherUser), avatarUrl: otherUser?.image }
          : {}),
      isDirect,
      isSaved,
      otherUserId,
      otherPremium: premiumFlags(otherUser).isPremium,
      otherEmojiStatus: premiumFlags(otherUser).emojiStatus,
      otherPresence,
      participantIds,
      adminIds,
      participants: participants.filter(
        (p): p is NonNullable<typeof p> => p !== null,
      ),
      currentUserRole: isCreator ? "creator" : isAdmin ? "admin" : "member",
      canManageMembers: isAdmin,
      canDeleteRoom: isCreator,
    };
  },
});

export const createRoom = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    participantIds: v.optional(v.array(v.id("users"))),
    avatarStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const userId = me._id;

    const title = args.title.trim();
    if (!title) throw new Error("Введіть назву кімнати");
    if (title.length > 64) throw new Error("Назва задовга (максимум 64 символи)");

    let avatarUrl: string | undefined;
    if (args.avatarStorageId) {
      avatarUrl = (await ctx.storage.getUrl(args.avatarStorageId)) ?? undefined;
    }

    const participantIds = Array.from(new Set([userId, ...(args.participantIds ?? [])]));
    const now = Date.now();
    const roomId = await ctx.db.insert("chatRooms", {
      title,
      description: args.description?.trim() || undefined,
      creatorId: userId,
      participantIds,
      adminIds: [userId],
      avatarStorageId: avatarUrl ? args.avatarStorageId : undefined,
      avatarUrl,
      lastMessage: "🎉 Груповий чат створено",
      lastMessageAt: now,
    });
    await ctx.db.insert("messages", {
      chatRoomId: roomId,
      senderId: userId,
      senderName: "Система",
      content: "🎉 Груповий чат створено",
      isSystem: true,
    });
    for (const participantId of participantIds) {
      await ctx.db.insert("roomReads", {
        userId: participantId,
        chatRoomId: roomId,
        lastReadAt: Date.now(),
      });
    }
    return roomId;
  },
});

async function getOrCreateSaved(ctx: MutationCtx, userId: Id<"users">) {
  const directKey = makeDirectKey(userId, userId);
  const existing = await ctx.db
    .query("chatRooms")
    .withIndex("by_direct_key", (q) => q.eq("directKey", directKey))
    .first();
  const roomId =
    existing?._id ??
    (await ctx.db.insert("chatRooms", {
      title: "Збережене",
      creatorId: userId,
      participantIds: [userId],
      adminIds: [],
      isDirect: true,
      isSaved: true,
      directKey,
    }));
  const read = await ctx.db
    .query("roomReads")
    .withIndex("by_user_and_room", (q) => q.eq("userId", userId).eq("chatRoomId", roomId))
    .first();
  if (!read) {
    await ctx.db.insert("roomReads", { userId, chatRoomId: roomId, lastReadAt: Date.now() });
  }
  return roomId;
}

// «Збережене» поточного користувача (створюється при першому зверненні).
export const getOrCreateSavedRoom = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    return await getOrCreateSaved(ctx, me._id);
  },
});

// Особистий (1:1) чат із користувачем: повертає існуючий або створює новий.
export const getOrCreateDirectRoom = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    // Чат із самим собою — це «Збережене».
    if (args.otherUserId === me._id) return await getOrCreateSaved(ctx, me._id);
    const other = await ctx.db.get(args.otherUserId);
    if (!other) throw new Error("Користувача не знайдено");

    const directKey = makeDirectKey(me._id, args.otherUserId);
    const existing = await ctx.db
      .query("chatRooms")
      .withIndex("by_direct_key", (q) => q.eq("directKey", directKey))
      .first();

    let roomId: Id<"chatRooms">;
    if (existing) {
      roomId = existing._id;
    } else {
      roomId = await ctx.db.insert("chatRooms", {
        title: DIRECT_ROOM_TITLE,
        creatorId: me._id,
        participantIds: [me._id, args.otherUserId],
        adminIds: [],
        isDirect: true,
        directKey,
      });
    }

    // Гарантуємо запис про прочитання для обох учасників.
    for (const userId of [me._id, args.otherUserId]) {
      const read = await ctx.db
        .query("roomReads")
        .withIndex("by_user_and_room", (q) =>
          q.eq("userId", userId).eq("chatRoomId", roomId),
        )
        .first();
      if (!read) {
        await ctx.db.insert("roomReads", {
          userId,
          chatRoomId: roomId,
          lastReadAt: Date.now(),
        });
      }
    }

    // Якщо чат був прихований — показуємо його знову.
    const mySetting = await ctx.db
      .query("roomSettings")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", me._id).eq("chatRoomId", roomId),
      )
      .first();
    if (mySetting?.hidden) {
      await patchRoomSetting(ctx, me._id, roomId, { hidden: false });
    }
    return roomId;
  },
});

// Існуючий особистий чат (без створення) — для кнопок на профілі.
export const findDirectRoom = query({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me || args.otherUserId === me._id) return null;
    const room = await ctx.db
      .query("chatRooms")
      .withIndex("by_direct_key", (q) =>
        q.eq("directKey", makeDirectKey(me._id, args.otherUserId)),
      )
      .first();
    if (!room) return null;
    const setting = await ctx.db
      .query("roomSettings")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", me._id).eq("chatRoomId", room._id),
      )
      .first();
    return { roomId: room._id, muted: isMutedNow(setting) };
  },
});

export const addParticipants = mutation({
  args: { roomId: v.id("chatRooms"), participantIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const userId = me._id;

    const room = await requireMember(ctx, args.roomId, userId);
    assertGroupRoom(room);
    if (!adminIdsOf(room).includes(userId) && room.creatorId !== userId) {
      throw new Error("Лише адміністратори можуть додавати учасників");
    }
    const existing = participantIdsOf(room);
    const toAdd = Array.from(new Set(args.participantIds)).filter(
      (id) => !existing.includes(id),
    );
    if (!toAdd.length) return { addedCount: 0 };
    const users = await Promise.all(toAdd.map((id) => ctx.db.get(id)));
    if (users.some((user) => user === null))
      throw new Error("Не вдалося знайти одного з користувачів");

    const actor = await ctx.db.get(userId);
    const content = `👋 ${nameOf(actor)} додав(ла) до групи: ${users.map(nameOf).join(", ")}`;
    const now = Date.now();
    // У каналі підписка не створює службових повідомлень у стрічці.
    await ctx.db.patch(
      args.roomId,
      room.isChannel
        ? { participantIds: [...existing, ...toAdd] }
        : { participantIds: [...existing, ...toAdd], lastMessage: content, lastMessageAt: now },
    );
    if (!room.isChannel) {
      await ctx.db.insert("messages", {
        chatRoomId: args.roomId,
        senderId: userId,
        senderName: "Система",
        content,
        isSystem: true,
      });
    }
    for (const addedId of toAdd) {
      await ctx.db.insert("roomReads", {
        userId: addedId,
        chatRoomId: args.roomId,
        lastReadAt: Date.now(),
      });
    }
    return { addedCount: toAdd.length };
  },
});

export const updateParticipantRole = mutation({
  args: {
    roomId: v.id("chatRooms"),
    targetUserId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const userId = me._id;

    const room = await requireMember(ctx, args.roomId, userId);
    assertGroupRoom(room);
    if (room.creatorId !== userId)
      throw new Error("Лише творець кімнати може змінювати ролі");
    if (args.targetUserId === room.creatorId)
      throw new Error("Неможливо змінити роль творця кімнати");
    if (!participantIdsOf(room).includes(args.targetUserId))
      throw new Error("Користувач не є учасником кімнати");

    const oldAdmins = adminIdsOf(room);
    const adminIds =
      args.role === "admin"
        ? Array.from(new Set([...oldAdmins, args.targetUserId]))
        : oldAdmins.filter((id) => id !== args.targetUserId);
    const target = await ctx.db.get(args.targetUserId);
    const content =
      args.role === "admin"
        ? `🛡️ ${nameOf(target)} тепер адміністратор(ка)`
        : `👤 ${nameOf(target)} більше не адміністратор(ка)`;
    const now = Date.now();
    if (room.isChannel) {
      await ctx.db.patch(args.roomId, { adminIds });
      return { success: true };
    }
    await ctx.db.patch(args.roomId, { adminIds, lastMessage: content, lastMessageAt: now });
    await ctx.db.insert("messages", {
      chatRoomId: args.roomId,
      senderId: userId,
      senderName: "Система",
      content,
      isSystem: true,
    });
    return { success: true };
  },
});

export const generateRoomAvatarUploadUrl = mutation(async (ctx) => {
  const me = await getAuthUser(ctx);
  if (!me) throw new Error("Unauthorized: Потрібна авторизація");
  return await ctx.storage.generateUploadUrl();
});

// Зміна назви, опису та фото кімнати (творець або адміністратор).
export const updateRoom = mutation({
  args: {
    roomId: v.id("chatRooms"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    removeAvatar: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const userId = me._id;

    const room = await requireMember(ctx, args.roomId, userId);
    assertGroupRoom(room);
    if (room.creatorId !== userId && !adminIdsOf(room).includes(userId)) {
      throw new Error("Лише адміністратор може змінювати кімнату");
    }

    const patch: Record<string, unknown> = {};
    const notes: string[] = [];
    const actorName = nameOf(me);

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Назва кімнати не може бути порожньою");
      if (title.length > 64) throw new Error("Назва задовга (максимум 64 символи)");
      if (title !== room.title) {
        patch.title = title;
        notes.push(`✏️ ${actorName} змінив(ла) назву кімнати на «${title}»`);
      }
    }

    if (args.description !== undefined) {
      const description = args.description.trim();
      if (description.length > 500) throw new Error("Опис задовгий (максимум 500 символів)");
      if ((description || undefined) !== room.description) {
        patch.description = description || undefined;
      }
    }

    if (args.avatarStorageId) {
      const url = await ctx.storage.getUrl(args.avatarStorageId);
      if (!url) throw new Error("Не вдалося отримати посилання на фото");
      if (room.avatarStorageId && room.avatarStorageId !== args.avatarStorageId) {
        await ctx.storage.delete(room.avatarStorageId);
      }
      patch.avatarStorageId = args.avatarStorageId;
      patch.avatarUrl = url;
      notes.push(`🖼️ ${actorName} змінив(ла) фото кімнати`);
    } else if (args.removeAvatar && room.avatarStorageId) {
      await ctx.storage.delete(room.avatarStorageId);
      patch.avatarStorageId = undefined;
      patch.avatarUrl = undefined;
      notes.push(`🖼️ ${actorName} видалив(ла) фото кімнати`);
    } else if (args.removeAvatar && room.avatarUrl) {
      patch.avatarUrl = undefined;
    }

    if (Object.keys(patch).length === 0) return { changed: false };

    // У каналі зміни назви/фото не пишемо в стрічку.
    if (room.isChannel) notes.length = 0;
    if (notes.length > 0) {
      patch.lastMessage = notes[notes.length - 1];
      patch.lastMessageAt = Date.now();
    }
    await ctx.db.patch(args.roomId, patch);
    for (const content of notes) {
      await ctx.db.insert("messages", {
        chatRoomId: args.roomId,
        senderId: userId,
        senderName: "Система",
        content,
        isSystem: true,
      });
    }
    return { changed: true };
  },
});

export const removeParticipant = mutation({
  args: { roomId: v.id("chatRooms"), targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const userId = me._id;

    const room = await requireMember(ctx, args.roomId, userId);
    assertGroupRoom(room);
    const participants = participantIdsOf(room);
    if (!participants.includes(args.targetUserId))
      throw new Error("Користувач не є учасником кімнати");
    const isSelf = userId === args.targetUserId;
    const isCreator = room.creatorId === userId;
    const admins = adminIdsOf(room);
    const targetIsAdmin = admins.includes(args.targetUserId);
    if (!isSelf) {
      if (!admins.includes(userId) && !isCreator)
        throw new Error("У вас немає прав для вилучення учасників");
      if (args.targetUserId === room.creatorId)
        throw new Error("Неможливо вилучити творця кімнати");
      if (!isCreator && targetIsAdmin)
        throw new Error("Адміністратор не може вилучити іншого адміністратора");
    } else if (isCreator && participants.length > 1) {
      throw new Error("Творець не може покинути кімнату, поки в ній є інші учасники");
    }

    const target = await ctx.db.get(args.targetUserId);
    const actor = await ctx.db.get(userId);
    const content = isSelf
      ? `🚪 ${nameOf(target)} покинув(ла) групу`
      : `🚫 ${nameOf(actor)} вилучив(ла) ${nameOf(target)} з групи`;
    const now = Date.now();
    const remaining = {
      participantIds: participants.filter((id) => id !== args.targetUserId),
      adminIds: admins.filter((id) => id !== args.targetUserId),
    };
    if (room.isChannel) {
      await ctx.db.patch(args.roomId, remaining);
    } else {
      await ctx.db.patch(args.roomId, { ...remaining, lastMessage: content, lastMessageAt: now });
      await ctx.db.insert("messages", {
        chatRoomId: args.roomId,
        senderId: userId,
        senderName: "Система",
        content,
        isSystem: true,
      });
    }
    const removedReads = await ctx.db
      .query("roomReads")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", args.targetUserId).eq("chatRoomId", args.roomId),
      )
      .collect();
    for (const read of removedReads) await ctx.db.delete(read._id);
    const removedSettings = await ctx.db
      .query("roomSettings")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", args.targetUserId).eq("chatRoomId", args.roomId),
      )
      .collect();
    for (const setting of removedSettings) await ctx.db.delete(setting._id);
    return { success: true };
  },
});

export const deleteRoom = mutation({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const userId = me._id;

    const room = await requireMember(ctx, args.roomId, userId);
    assertGroupRoom(room);
    if (room.creatorId !== userId)
      throw new Error("Видалити кімнату може лише її творець");

    // Розриваємо звʼязок канал ↔ група обговорення.
    if (room.linkedDiscussionRoomId) {
      const group = await ctx.db.get(room.linkedDiscussionRoomId);
      if (group) await ctx.db.patch(group._id, { discussionOfChannelId: undefined });
    }
    if (room.discussionOfChannelId) {
      const channel = await ctx.db.get(room.discussionOfChannelId);
      if (channel) await ctx.db.patch(channel._id, { linkedDiscussionRoomId: undefined });
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.roomId))
      .collect();
    for (const message of messages) {
      await releaseMessageFiles(ctx, message);
      if (message.pollId) await deletePollWithVotes(ctx, message.pollId);
      const reactions = await ctx.db
        .query("messageReactions")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .collect();
      for (const reaction of reactions) await ctx.db.delete(reaction._id);
      await ctx.db.delete(message._id);
    }
    const hides = await ctx.db
      .query("messageHides")
      .withIndex("by_room", (q) => q.eq("chatRoomId", args.roomId))
      .collect();
    for (const hide of hides) await ctx.db.delete(hide._id);
    const typing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_room", (q) => q.eq("chatRoomId", args.roomId))
      .collect();
    for (const indicator of typing) await ctx.db.delete(indicator._id);
    const reads = await ctx.db
      .query("roomReads")
      .withIndex("by_room", (q) => q.eq("chatRoomId", args.roomId))
      .collect();
    for (const read of reads) await ctx.db.delete(read._id);
    const roomSettings = await ctx.db
      .query("roomSettings")
      .withIndex("by_room", (q) => q.eq("chatRoomId", args.roomId))
      .collect();
    for (const setting of roomSettings) await ctx.db.delete(setting._id);
    if (room.avatarStorageId) await ctx.storage.delete(room.avatarStorageId);
    await ctx.db.delete(args.roomId);
    return { success: true };
  },
});