import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { isMutedNow } from "./roomSettings";
import { premiumFlagOn } from "./limitHelpers";
import { getAuthUser } from "./users";

// Ліміт лічильника непрочитаних на кімнату (у списку чатів показується «99+»).
const UNREAD_CAP = 100;

const participantIdsOf = (room: {
  creatorId: Id<"users">;
  participantIds?: Id<"users">[];
}) => room.participantIds ?? [room.creatorId];

// Позначити кімнату прочитаною (для поточного користувача) до цього моменту.
export const markRead = mutation({
  args: { chatRoomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");

    const room = await ctx.db.get(args.chatRoomId);
    if (!room || !participantIdsOf(room).includes(me._id)) return;

    const existing = await ctx.db
      .query("roomReads")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", me._id).eq("chatRoomId", args.chatRoomId),
      )
      .first();

    if (existing) {
      // Нічого нового після останнього прочитання — не пишемо зайвого.
      const newest = await ctx.db
        .query("messages")
        .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.chatRoomId))
        .order("desc")
        .first();
      if (!newest || existing.lastReadAt >= newest._creationTime) return;
      await ctx.db.patch(existing._id, { lastReadAt: Date.now() });
      return;
    }

    await ctx.db.insert("roomReads", {
      userId: me._id,
      chatRoomId: args.chatRoomId,
      lastReadAt: Date.now(),
    });
  },
});

// Для кімнат, де ще немає запису про прочитання (старі дані), починаємо відлік «з зараз»,
// щоб уся стара історія не стала «непрочитаною».
export const ensureReads = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");

    const rooms = await ctx.db.query("chatRooms").collect();
    const now = Date.now();
    let created = 0;
    for (const room of rooms) {
      if (!participantIdsOf(room).includes(me._id)) continue;
      const existing = await ctx.db
        .query("roomReads")
        .withIndex("by_user_and_room", (q) =>
          q.eq("userId", me._id).eq("chatRoomId", room._id),
        )
        .first();
      if (existing) continue;
      await ctx.db.insert("roomReads", {
        userId: me._id,
        chatRoomId: room._id,
        lastReadAt: now,
      });
      created += 1;
    }
    return { created };
  },
});

// Лічильники непрочитаних для списку чатів (+ загальна кількість для значка на вкладці «Чати»).
export const getUnreadCounts = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) {
      return { counts: {} as Record<string, number>, missing: false, total: 0 };
    }

    const rooms = await ctx.db.query("chatRooms").collect();
    const settings = await ctx.db
      .query("roomSettings")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    const settingOf = new Map(settings.map((s) => [s.chatRoomId as string, s]));

    const counts: Record<string, number> = {};
    let missing = false;
    let total = 0;

    for (const room of rooms) {
      if (!participantIdsOf(room).includes(me._id)) continue;
      const setting = settingOf.get(room._id);
      // Прихований чат без нових повідомлень у лічильниках не бере участі.
      if (setting?.hidden && (room.lastMessageAt ?? 0) <= (setting.hiddenAt ?? 0)) {
        continue;
      }
      const read = await ctx.db
        .query("roomReads")
        .withIndex("by_user_and_room", (q) =>
          q.eq("userId", me._id).eq("chatRoomId", room._id),
        )
        .first();
      if (!read) {
        missing = true;
        continue;
      }

      const newer = await ctx.db
        .query("messages")
        .withIndex("by_chat_room", (q) =>
          q.eq("chatRoomId", room._id).gt("_creationTime", read.lastReadAt),
        )
        .take(UNREAD_CAP + 50);

      const count = newer.filter(
        (m) => m.senderId !== me._id && !m.isSystem,
      ).length;
      if (count > 0) {
        const capped = Math.min(count, UNREAD_CAP);
        counts[room._id] = capped;
        if (!isMutedNow(setting)) total += capped;
      }
    }
    return { counts, missing, total };
  },
});

// Коли інші учасники востаннє читали кімнату (для галочок «прочитано» біля своїх повідомлень).
export const getReadState = query({
  args: { chatRoomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return { othersLastReadAt: 0 };
    const room = await ctx.db.get(args.chatRoomId);
    if (!room || !participantIdsOf(room).includes(me._id)) {
      return { othersLastReadAt: 0 };
    }

    const reads = await ctx.db
      .query("roomReads")
      .withIndex("by_room", (q) => q.eq("chatRoomId", args.chatRoomId))
      .collect();
    const members = participantIdsOf(room);

    // «Приховати час прочитання» (Premium): хто прихував — того читання не видно, і сам не бачить чужих.
    if (premiumFlagOn(me, me.hideReadReceipts)) return { othersLastReadAt: 0 };

    let othersLastReadAt = 0;
    for (const read of reads) {
      if (read.userId === me._id || !members.includes(read.userId)) continue;
      const reader = await ctx.db.get(read.userId);
      if (premiumFlagOn(reader, reader?.hideReadReceipts)) continue;
      othersLastReadAt = Math.max(othersLastReadAt, read.lastReadAt);
    }
    return { othersLastReadAt };
  },
});
