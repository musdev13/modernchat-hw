import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listRooms = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("chatRooms").order("desc").collect();
  },
});

export const getRoom = query({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.roomId);
  },
});

export const createRoom = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Unauthorized: Потрібна авторизація");
    }

    const roomId = await ctx.db.insert("chatRooms", {
      title: args.title.trim(),
      description: args.description?.trim(),
      creatorId: userId,
      lastMessageAt: Date.now(),
    });

    return roomId;
  },
});

export const deleteRoom = mutation({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Unauthorized: Потрібна авторизація");
    }

    const room = await ctx.db.get(args.roomId);

    if (!room) {
      throw new Error("Room not found: Кімнату не знайдено");
    }

    if (room.creatorId !== userId) {
      throw new Error("Forbidden: Тільки автор може видалити цю кімнату");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.roomId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    await ctx.db.delete(args.roomId);
  },
});
