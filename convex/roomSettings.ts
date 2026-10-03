import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUser } from "./users";

// Чи вимкнені сповіщення цієї кімнати для поточного користувача.
export const getMyRoomSettings = query({
  args: { chatRoomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return { muted: false };
    const row = await ctx.db
      .query("roomSettings")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", me._id).eq("chatRoomId", args.chatRoomId),
      )
      .first();
    return { muted: row?.muted ?? false };
  },
});

// Усі кімнати з вимкненими сповіщеннями (для списку чатів).
export const getMutedRoomIds = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];
    const rows = await ctx.db
      .query("roomSettings")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    return rows.filter((row) => row.muted).map((row) => row.chatRoomId);
  },
});

export const setMuted = mutation({
  args: { chatRoomId: v.id("chatRooms"), muted: v.boolean() },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");

    const room = await ctx.db.get(args.chatRoomId);
    if (!room) throw new Error("Кімнату не знайдено");
    if (!(room.participantIds ?? [room.creatorId]).includes(me._id)) {
      throw new Error("Access denied: Ви не є учасником цієї кімнати");
    }

    const existing = await ctx.db
      .query("roomSettings")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", me._id).eq("chatRoomId", args.chatRoomId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { muted: args.muted });
    } else {
      await ctx.db.insert("roomSettings", {
        userId: me._id,
        chatRoomId: args.chatRoomId,
        muted: args.muted,
      });
    }
    return { muted: args.muted };
  },
});
