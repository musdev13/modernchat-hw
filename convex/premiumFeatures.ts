import { v } from "convex/values";
import { limitError, limitsFor, premiumFlagOn, premiumOnlyError } from "./limitHelpers";
import { PROFILE_COLORS, PROFILE_PATTERNS } from "./limits";
import { assertRoomMember } from "./messages";
import { mutation, query } from "./_generated/server";
import { getAuthUser } from "./users";

const TAG_MAX_LEN = 8;

/**
 * Оформлення профілю (Premium): колір імені (також цитат відповідей), колір обкладинки профілю та
 * візерунок на ній. null — скинути. Задати можна лише з активним Premium.
 */
export const setProfileStyle = mutation({
  args: {
    nameColor: v.optional(v.union(v.string(), v.null())),
    profileColor: v.optional(v.union(v.string(), v.null())),
    profilePattern: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const patch: Record<string, string | undefined> = {};
    const palette = PROFILE_COLORS as readonly string[];
    const setting = (key: "nameColor" | "profileColor", value: string | null | undefined) => {
      if (value === undefined) return;
      if (value === null) {
        patch[key] = undefined;
        return;
      }
      if (!palette.includes(value)) throw new Error("Невідомий колір");
      patch[key] = value;
    };
    setting("nameColor", args.nameColor);
    setting("profileColor", args.profileColor);
    if (args.profilePattern !== undefined) {
      if (args.profilePattern === null || args.profilePattern === "none") patch.profilePattern = undefined;
      else if ((PROFILE_PATTERNS as readonly string[]).includes(args.profilePattern)) patch.profilePattern = args.profilePattern;
      else throw new Error("Невідомий візерунок");
    }
    const setsSomething = Object.values(patch).some((x) => x !== undefined);
    if (setsSomething && !premiumFlagOn(me, true)) {
      throw premiumOnlyError("Кольори й візерунки профілю доступні лише з Modesto Premium.");
    }
    await ctx.db.patch(me._id, patch);
  },
});

/** Приватність і керування чатами (Premium): вмикати можна лише з преміумом, вимикати — завжди. */
export const setPremiumPrivacy = mutation({
  args: {
    hideReadReceipts: v.optional(v.boolean()),
    whoCanMessage: v.optional(v.union(v.literal("all"), v.literal("contacts"))),
    autoArchiveNonContacts: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const enabling =
      args.hideReadReceipts === true || args.whoCanMessage === "contacts" || args.autoArchiveNonContacts === true;
    if (enabling && !premiumFlagOn(me, true)) {
      throw premiumOnlyError("Ця функція приватності доступна лише з Modesto Premium.");
    }
    const patch: Record<string, unknown> = {};
    if (args.hideReadReceipts !== undefined) patch.hideReadReceipts = args.hideReadReceipts;
    if (args.whoCanMessage !== undefined) patch.whoCanMessage = args.whoCanMessage;
    if (args.autoArchiveNonContacts !== undefined) patch.autoArchiveNonContacts = args.autoArchiveNonContacts;
    await ctx.db.patch(me._id, patch);
  },
});

/** Тег повідомлення у «Збереженому» (емодзі). До 12 різних тегів, лише Premium. tag = null — зняти. */
export const setMessageTag = mutation({
  args: { messageId: v.id("messages"), tag: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Повідомлення не знайдено");
    const room = await assertRoomMember(ctx, message.chatRoomId, me._id);
    if (!room.isSaved) throw new Error("Теги доступні лише у «Збереженому»");
    if (args.tag === null) {
      await ctx.db.patch(message._id, { tag: undefined });
      return;
    }
    if (!premiumFlagOn(me, true)) throw premiumOnlyError("Теги збережених повідомлень доступні лише з Modesto Premium.");
    const tag = args.tag.trim();
    if (!tag || tag.length > TAG_MAX_LEN) throw new Error("Тег — це один емодзі");
    const max = limitsFor(me).savedTags;
    const used = await usedTags(ctx, message.chatRoomId);
    if (!used.has(tag) && used.size >= max) {
      throw limitError(`Можна використати до ${max} різних тегів.`);
    }
    await ctx.db.patch(message._id, { tag });
  },
});

async function usedTags(ctx: any, chatRoomId: any): Promise<Set<string>> {
  const rows = await ctx.db
    .query("messages")
    .withIndex("by_chat_room", (q: any) => q.eq("chatRoomId", chatRoomId))
    .collect();
  const set = new Set<string>();
  for (const m of rows) if (m.tag) set.add(m.tag);
  return set;
}

/** Теги, що вже є у «Збереженому» (для панелі фільтра) з кількістю повідомлень. */
export const savedTags = query({
  args: { chatRoomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];
    const room = await ctx.db.get(args.chatRoomId);
    if (!room || !room.isSaved || !(room.participantIds ?? [room.creatorId]).includes(me._id)) return [];
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.chatRoomId))
      .collect();
    const counts = new Map<string, number>();
    for (const m of rows) if (m.tag) counts.set(m.tag, (counts.get(m.tag) ?? 0) + 1);
    return [...counts].map(([tag, count]) => ({ tag, count }));
  },
});

