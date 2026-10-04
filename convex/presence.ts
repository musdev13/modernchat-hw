import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUser, getPresenceRow } from "./users";

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
      await ctx.db.patch(me._id, { lastActiveAt: Date.now() });
    }

    return { success: true };
  },
});

// Загальний heartbeat застосунку (кожні ~40 с, поки він на передньому плані).
export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) return { success: false };

    const now = Date.now();
    const row = await getPresenceRow(ctx, me._id);
    if (!row) {
      await ctx.db.insert("userPresence", { userId: me._id, lastSeenAt: now });
    } else if (now - row.lastSeenAt > 5_000 || (row.offlineAt ?? 0) >= row.lastSeenAt) {
      await ctx.db.patch(row._id, { lastSeenAt: now });
    }
    return { success: true };
  },
});

// Застосунок пішов у фон: фіксуємо «був(ла) о …» і одразу знімаємо онлайн.
export const goOffline = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) return { success: false };

    const now = Date.now();
    const row = await getPresenceRow(ctx, me._id);
    if (!row) {
      await ctx.db.insert("userPresence", {
        userId: me._id,
        lastSeenAt: now,
        offlineAt: now,
      });
    } else {
      await ctx.db.patch(row._id, { lastSeenAt: now, offlineAt: now });
    }
    return { success: true };
  },
});
