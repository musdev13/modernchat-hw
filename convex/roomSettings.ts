import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { MutationCtx, mutation, query } from "./_generated/server";
import { getAuthUser } from "./users";

const MAX_PINNED_CHATS = 5;

/** Чи вимкнено сповіщення зараз (з урахуванням терміну «вимкнути на…»). */
export function isMutedNow(
  row: { muted?: boolean; mutedUntil?: number } | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!row?.muted) return false;
  return row.mutedUntil === undefined || row.mutedUntil > now;
}

async function requireRoomMember(
  ctx: MutationCtx,
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

// Оновлює (або створює) запис налаштувань кімнати для користувача.
export async function patchRoomSetting(
  ctx: MutationCtx,
  userId: Id<"users">,
  chatRoomId: Id<"chatRooms">,
  patch: {
    muted?: boolean;
    mutedUntil?: number | undefined;
    pinned?: boolean;
    hidden?: boolean;
    hiddenAt?: number;
  },
) {
  const existing = await ctx.db
    .query("roomSettings")
    .withIndex("by_user_and_room", (q) =>
      q.eq("userId", userId).eq("chatRoomId", chatRoomId),
    )
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, patch);
  } else {
    await ctx.db.insert("roomSettings", {
      userId,
      chatRoomId,
      muted: false,
      ...patch,
    });
  }
}

// Налаштування кімнати для поточного користувача.
export const getMyRoomSettings = query({
  args: { chatRoomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return { muted: false, mutedUntil: undefined, pinned: false };
    const row = await ctx.db
      .query("roomSettings")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", me._id).eq("chatRoomId", args.chatRoomId),
      )
      .first();
    const muted = isMutedNow(row);
    return {
      muted,
      mutedUntil: muted ? row?.mutedUntil : undefined,
      pinned: row?.pinned ?? false,
    };
  },
});

// Усі кімнати з вимкненими сповіщеннями.
export const getMutedRoomIds = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];
    const rows = await ctx.db
      .query("roomSettings")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    const now = Date.now();
    return rows.filter((row) => isMutedNow(row, now)).map((row) => row.chatRoomId);
  },
});

export const setMuted = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    muted: v.boolean(),
    // Тривалість у мс; без неї сповіщення вимикаються назавжди.
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    await requireRoomMember(ctx, args.chatRoomId, me._id);
    const mutedUntil =
      args.muted && args.durationMs && args.durationMs > 0
        ? Date.now() + args.durationMs
        : undefined;
    await patchRoomSetting(ctx, me._id, args.chatRoomId, {
      muted: args.muted,
      mutedUntil,
    });
    return { muted: args.muted, mutedUntil };
  },
});

// Закріпити / відкріпити чат у списку (лише для себе).
export const setPinned = mutation({
  args: { chatRoomId: v.id("chatRooms"), pinned: v.boolean() },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    await requireRoomMember(ctx, args.chatRoomId, me._id);

    if (args.pinned) {
      const rows = await ctx.db
        .query("roomSettings")
        .withIndex("by_user", (q) => q.eq("userId", me._id))
        .collect();
      const pinnedCount = rows.filter(
        (row) => row.pinned && row.chatRoomId !== args.chatRoomId,
      ).length;
      if (pinnedCount >= MAX_PINNED_CHATS) {
        throw new Error(`Можна закріпити не більше ${MAX_PINNED_CHATS} чатів`);
      }
    }
    await patchRoomSetting(ctx, me._id, args.chatRoomId, { pinned: args.pinned });
    return { pinned: args.pinned };
  },
});

// Приховати особистий чат зі списку (повернеться, коли з'явиться нове повідомлення).
export const hideRoom = mutation({
  args: { chatRoomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const room = await requireRoomMember(ctx, args.chatRoomId, me._id);
    if (!room.isDirect || room.isSaved) {
      throw new Error("Приховати можна лише особистий чат");
    }
    await patchRoomSetting(ctx, me._id, args.chatRoomId, {
      hidden: true,
      hiddenAt: Date.now(),
      pinned: false,
    });
    return { hidden: true };
  },
});
