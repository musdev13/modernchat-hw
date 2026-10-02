import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUser } from "./users";

const TYPING_TIMEOUT_MS = 3000;

export const setTyping = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return;

    const room = await ctx.db.get(args.chatRoomId);
    if (!room || !(room.participantIds ?? [room.creatorId]).includes(me._id)) {
      throw new Error("Access denied: Ви не є учасником цієї кімнати");
    }

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", me._id).eq("chatRoomId", args.chatRoomId),
      )
      .first();

    const now = Date.now();
    let indicatorId;

    if (existing) {
      await ctx.db.patch(existing._id, { lastTypedAt: now });
      indicatorId = existing._id;
    } else {
      indicatorId = await ctx.db.insert("typingIndicators", {
        chatRoomId: args.chatRoomId,
        userId: me._id,
        userName: me.name ?? me.email ?? "Співрозмовник",
        lastTypedAt: now,
      });
    }

    // Плануємо очищення: якщо через TYPING_TIMEOUT_MS lastTypedAt не змінився — видаляємо.
    // Кожен новий setTyping планує свою перевірку — старі стають no-op, бо expectedLastTypedAt
    // не збігається з актуальним lastTypedAt.
    await ctx.scheduler.runAfter(
      TYPING_TIMEOUT_MS + 200,
      internal.typing.expireTyping,
      {
        indicatorId,
        expectedLastTypedAt: now,
      },
    );
  },
});

export const clearTyping = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return;

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", me._id).eq("chatRoomId", args.chatRoomId),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Внутренний mutation: удаляет индикатор, только если lastTypedAt не изменился
export const expireTyping = internalMutation({
  args: {
    indicatorId: v.id("typingIndicators"),
    expectedLastTypedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const indicator = await ctx.db.get(args.indicatorId);
    if (!indicator) return;
    if (indicator.lastTypedAt !== args.expectedLastTypedAt) return;
    await ctx.db.delete(args.indicatorId);
  },
});

export const getTypingUsers = query({
  args: {
    chatRoomId: v.id("chatRooms"),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];

    const room = await ctx.db.get(args.chatRoomId);
    if (!room || !(room.participantIds ?? [room.creatorId]).includes(me._id)) {
      return [];
    }

    const threshold = Date.now() - TYPING_TIMEOUT_MS;

    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_room", (q) => q.eq("chatRoomId", args.chatRoomId))
      .filter((q) => q.gt(q.field("lastTypedAt"), threshold))
      .collect();

    return indicators
      .filter((indicator) => indicator.userId !== me._id)
      .map((indicator) => indicator.userName);
  },
});