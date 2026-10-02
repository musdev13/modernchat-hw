import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUser } from "./users";

const TYPING_TIMEOUT_MS = 3000;

export const setTyping = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) return;
    const userId = user._id;

    const room = await ctx.db.get(args.chatRoomId);
    if (!room || !(room.participantIds ?? [room.creatorId]).includes(userId)) {
      throw new Error("Access denied: Ви не є учасником цієї кімнати");
    }

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", userId).eq("chatRoomId", args.chatRoomId),
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, { lastTypedAt: now });
    } else {
      await ctx.db.insert("typingIndicators", {
        chatRoomId: args.chatRoomId,
        userId,
        userName: user.name ?? user.email ?? "Співрозмовник",
        lastTypedAt: now,
      });
    }
  },
});

export const getTypingUsers = query({
  args: {
    chatRoomId: v.id("chatRooms"),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];
    const userId = me._id;

    const room = await ctx.db.get(args.chatRoomId);
    if (!room || !(room.participantIds ?? [room.creatorId]).includes(userId)) {
      return [];
    }
    const threshold = Date.now() - TYPING_TIMEOUT_MS;

    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_room", (q) => q.eq("chatRoomId", args.chatRoomId))
      .filter((q) => q.gt(q.field("lastTypedAt"), threshold))
      .collect();

    return indicators
      .filter((indicator) => indicator.userId !== userId)
      .map((indicator) => indicator.userName);
  },
});