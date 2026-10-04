import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getAuthUser } from "./users";

export const MAX_POLL_OPTIONS = 10;

async function memberRoom(ctx: any, roomId: Id<"chatRooms">, userId: Id<"users">) {
  const room = await ctx.db.get(roomId);
  if (!room) throw new Error("Кімнату не знайдено");
  if (!(room.participantIds ?? [room.creatorId]).includes(userId)) {
    throw new Error("Access denied: Ви не є учасником цієї кімнати");
  }
  return room;
}

/** Готове до показу опитування: підрахунок голосів + мої голоси. */
export async function pollView(ctx: any, poll: Doc<"polls">, userId: Id<"users">) {
  const votes: Doc<"pollVotes">[] = await ctx.db
    .query("pollVotes")
    .withIndex("by_poll", (q: any) => q.eq("pollId", poll._id))
    .collect();
  const counts = new Map<string, number>();
  let mine: string[] = [];
  let totalVoters = 0;
  for (const vote of votes) {
    if (vote.optionIds.length === 0) continue;
    totalVoters += 1;
    for (const id of vote.optionIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    if (vote.userId === userId) mine = vote.optionIds;
  }
  return {
    _id: poll._id,
    question: poll.question,
    anonymous: poll.anonymous,
    multiple: poll.multiple,
    closed: !!poll.closed,
    creatorId: poll.creatorId,
    totalVoters,
    myVotes: mine,
    options: poll.options.map((option) => ({
      id: option.id,
      text: option.text,
      votes: counts.get(option.id) ?? 0,
    })),
  };
}

/** Видаляє опитування разом з усіма голосами. */
export async function deletePollWithVotes(ctx: any, pollId: Id<"polls">) {
  const votes = await ctx.db
    .query("pollVotes")
    .withIndex("by_poll", (q: any) => q.eq("pollId", pollId))
    .collect();
  for (const vote of votes) await ctx.db.delete(vote._id);
  await ctx.db.delete(pollId);
}

// Проголосувати (порожній список — скасувати свій голос).
export const vote = mutation({
  args: { pollId: v.id("polls"), optionIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const poll = await ctx.db.get(args.pollId);
    if (!poll) throw new Error("Опитування не знайдено");
    await memberRoom(ctx, poll.chatRoomId, me._id);
    if (poll.closed) throw new Error("Опитування завершено");

    const unique = Array.from(new Set(args.optionIds));
    const valid = new Set(poll.options.map((o) => o.id));
    if (unique.some((id) => !valid.has(id))) throw new Error("Невідомий варіант відповіді");
    if (!poll.multiple && unique.length > 1) {
      throw new Error("У цьому опитуванні можна обрати лише один варіант");
    }

    const existing = await ctx.db
      .query("pollVotes")
      .withIndex("by_poll_and_user", (q) => q.eq("pollId", args.pollId).eq("userId", me._id))
      .first();
    if (existing) await ctx.db.patch(existing._id, { optionIds: unique });
    else await ctx.db.insert("pollVotes", { pollId: args.pollId, userId: me._id, optionIds: unique });
  },
});

// Завершити опитування (лише автор).
export const closePoll = mutation({
  args: { pollId: v.id("polls") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const poll = await ctx.db.get(args.pollId);
    if (!poll) throw new Error("Опитування не знайдено");
    await memberRoom(ctx, poll.chatRoomId, me._id);
    if (poll.creatorId !== me._id) throw new Error("Завершити опитування може лише його автор");
    await ctx.db.patch(args.pollId, { closed: true });
  },
});

// Хто за що проголосував (лише для публічних опитувань).
export const getVoters = query({
  args: { pollId: v.id("polls") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return null;
    const poll = await ctx.db.get(args.pollId);
    if (!poll || poll.anonymous) return null;
    await memberRoom(ctx, poll.chatRoomId, me._id);

    const votes = await ctx.db
      .query("pollVotes")
      .withIndex("by_poll", (q) => q.eq("pollId", args.pollId))
      .collect();
    const byOption = new Map<string, { userId: Id<"users">; name: string; image?: string }[]>();
    for (const vote of votes) {
      if (vote.optionIds.length === 0) continue;
      const user = await ctx.db.get(vote.userId);
      const entry = {
        userId: vote.userId,
        name: user?.name ?? user?.username ?? user?.email ?? "Користувач",
        image: user?.image,
      };
      for (const optionId of vote.optionIds) {
        byOption.set(optionId, [...(byOption.get(optionId) ?? []), entry]);
      }
    }
    return poll.options.map((option) => ({
      id: option.id,
      text: option.text,
      voters: byOption.get(option.id) ?? [],
    }));
  },
});
