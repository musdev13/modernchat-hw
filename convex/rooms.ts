import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const nameOf = (user: { name?: string; username?: string; email?: string } | null) =>
  user?.username ?? user?.name ?? user?.email ?? "Користувач";

const participantIdsOf = (room: {
  creatorId: Id<"users">;
  participantIds?: Id<"users">[];
}) =>
  room.participantIds ?? [room.creatorId];
const adminIdsOf = (room: {
  creatorId: Id<"users">;
  adminIds?: Id<"users">[];
}) =>
  room.adminIds ?? [room.creatorId];

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
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rooms = await ctx.db.query("chatRooms").order("desc").collect();
    return rooms.filter((room) => participantIdsOf(room).includes(userId));
  },
});

export const getRoom = query({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
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
          role:
            id === room.creatorId
              ? ("creator" as const)
              : adminIds.includes(id)
                ? ("admin" as const)
                : ("member" as const),
        };
      }),
    );
    const isCreator = room.creatorId === userId;
    const isAdmin = isCreator || adminIds.includes(userId);
    return {
      ...room,
      participantIds,
      adminIds,
      participants: participants.filter(
        (participant): participant is NonNullable<typeof participant> => participant !== null,
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
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");
    const title = args.title.trim();
    if (!title) throw new Error("Введіть назву кімнати");

    const participantIds = Array.from(new Set([userId, ...(args.participantIds ?? [])]));
    const now = Date.now();
    const roomId = await ctx.db.insert("chatRooms", {
      title,
      description: args.description?.trim() || undefined,
      creatorId: userId,
      participantIds,
      adminIds: [userId],
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
    return roomId;
  },
});

export const addParticipants = mutation({
  args: { roomId: v.id("chatRooms"), participantIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");
    const room = await requireMember(ctx, args.roomId, userId);
    if (!adminIdsOf(room).includes(userId) && room.creatorId !== userId) {
      throw new Error("Лише адміністратори можуть додавати учасників");
    }
    const existing = participantIdsOf(room);
    const toAdd = Array.from(new Set(args.participantIds)).filter((id) => !existing.includes(id));
    if (!toAdd.length) return { addedCount: 0 };
    const users = await Promise.all(toAdd.map((id) => ctx.db.get(id)));
    if (users.some((user) => user === null)) throw new Error("Не вдалося знайти одного з користувачів");

    const actor = await ctx.db.get(userId);
    const content = `👋 ${nameOf(actor)} додав(ла) до групи: ${users.map(nameOf).join(", ")}`;
    const now = Date.now();
    await ctx.db.patch(args.roomId, {
      participantIds: [...existing, ...toAdd], lastMessage: content, lastMessageAt: now,
    });
    await ctx.db.insert("messages", {
      chatRoomId: args.roomId, senderId: userId, senderName: "Система", content, isSystem: true,
    });
    return { addedCount: toAdd.length };
  },
});

export const updateParticipantRole = mutation({
  args: {
    roomId: v.id("chatRooms"), targetUserId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");
    const room = await requireMember(ctx, args.roomId, userId);
    if (room.creatorId !== userId) throw new Error("Лише творець кімнати може змінювати ролі");
    if (args.targetUserId === room.creatorId) throw new Error("Неможливо змінити роль творця кімнати");
    if (!participantIdsOf(room).includes(args.targetUserId)) throw new Error("Користувач не є учасником кімнати");

    const oldAdmins = adminIdsOf(room);
    const adminIds = args.role === "admin"
      ? Array.from(new Set([...oldAdmins, args.targetUserId]))
      : oldAdmins.filter((id) => id !== args.targetUserId);
    const target = await ctx.db.get(args.targetUserId);
    const content = args.role === "admin"
      ? `🛡️ ${nameOf(target)} тепер адміністратор(ка)`
      : `👤 ${nameOf(target)} більше не адміністратор(ка)`;
    const now = Date.now();
    await ctx.db.patch(args.roomId, { adminIds, lastMessage: content, lastMessageAt: now });
    await ctx.db.insert("messages", {
      chatRoomId: args.roomId, senderId: userId, senderName: "Система", content, isSystem: true,
    });
    return { success: true };
  },
});

export const removeParticipant = mutation({
  args: { roomId: v.id("chatRooms"), targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");
    const room = await requireMember(ctx, args.roomId, userId);
    const participants = participantIdsOf(room);
    if (!participants.includes(args.targetUserId)) throw new Error("Користувач не є учасником кімнати");
    const isSelf = userId === args.targetUserId;
    const isCreator = room.creatorId === userId;
    const admins = adminIdsOf(room);
    const targetIsAdmin = admins.includes(args.targetUserId);
    if (!isSelf) {
      if (!admins.includes(userId) && !isCreator) throw new Error("У вас немає прав для вилучення учасників");
      if (args.targetUserId === room.creatorId) throw new Error("Неможливо вилучити творця кімнати");
      if (!isCreator && targetIsAdmin) throw new Error("Адміністратор не може вилучити іншого адміністратора");
    } else if (isCreator && participants.length > 1) {
      throw new Error("Творець не може покинути кімнату, поки в ній є інші учасники");
    }

    const target = await ctx.db.get(args.targetUserId);
    const actor = await ctx.db.get(userId);
    const content = isSelf
      ? `🚪 ${nameOf(target)} покинув(ла) групу`
      : `🚫 ${nameOf(actor)} вилучив(ла) ${nameOf(target)} з групи`;
    const now = Date.now();
    await ctx.db.patch(args.roomId, {
      participantIds: participants.filter((id) => id !== args.targetUserId),
      adminIds: admins.filter((id) => id !== args.targetUserId),
      lastMessage: content, lastMessageAt: now,
    });
    await ctx.db.insert("messages", {
      chatRoomId: args.roomId, senderId: userId, senderName: "Система", content, isSystem: true,
    });
    return { success: true };
  },
});

export const deleteRoom = mutation({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");
    const room = await requireMember(ctx, args.roomId, userId);
    if (room.creatorId !== userId) throw new Error("Видалити кімнату може лише її творець");

    const messages = await ctx.db.query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.roomId)).collect();
    for (const message of messages) {
      if (message.storageId) await ctx.storage.delete(message.storageId);
      const reactions = await ctx.db.query("messageReactions")
        .withIndex("by_message", (q) => q.eq("messageId", message._id)).collect();
      for (const reaction of reactions) await ctx.db.delete(reaction._id);
      await ctx.db.delete(message._id);
    }
    const typing = await ctx.db.query("typingIndicators")
      .withIndex("by_room", (q) => q.eq("chatRoomId", args.roomId)).collect();
    for (const indicator of typing) await ctx.db.delete(indicator._id);
    await ctx.db.delete(args.roomId);
    return { success: true };
  },
});
