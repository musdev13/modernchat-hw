import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUser } from "./users";

export const setActiveChat = mutation({
  args: { chatRoomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return { success: false };

    const existing = await ctx.db
      .query("chatPresence")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        chatRoomId: args.chatRoomId,
        lastSeenAt: now,
      });
    } else {
      await ctx.db.insert("chatPresence", {
        userId: me._id,
        chatRoomId: args.chatRoomId,
        lastSeenAt: now,
      });
    }

    return { success: true };
  },
});

export const clearActiveChat = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) return { success: false };

    const existing = await ctx.db
      .query("chatPresence")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});