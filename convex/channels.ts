import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, mutation, query } from "./_generated/server";
import { assertCanJoinMore } from "./limitHelpers";
import { patchRoomSetting } from "./roomSettings";
import { getAuthUser } from "./users";

const SLUG_RE = /^[a-z0-9_]{4,32}$/;
const TITLE_MAX = 64;
const DESCRIPTION_MAX = 500;

const normalizeSlug = (raw: string) => raw.trim().replace(/^@/, "").toLowerCase();

const membersOf = (room: Doc<"chatRooms">) => room.participantIds ?? [room.creatorId];

function slugProblem(slug: string): string | null {
  if (slug.length < 4) return "Посилання має містити щонайменше 4 символи";
  if (slug.length > 32) return "Посилання може містити до 32 символів";
  if (!SLUG_RE.test(slug)) return "Допустимі лише a–z, 0–9 та _";
  return null;
}

async function slugTaken(ctx: any, slug: string, exceptRoomId?: Id<"chatRooms">) {
  const found = await ctx.db
    .query("chatRooms")
    .withIndex("by_slug", (q: any) => q.eq("slug", slug))
    .first();
  return !!found && found._id !== exceptRoomId;
}

/** Випадковий код запрошення для приватного каналу (унікальний). */
async function freshInviteCode(ctx: any): Promise<string> {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < 16; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!(await slugTaken(ctx, code))) return code;
  }
  throw new Error("Не вдалося створити посилання, спробуйте ще раз");
}

async function requireChannel(ctx: any, roomId: Id<"chatRooms">, userId: Id<"users">) {
  const room: Doc<"chatRooms"> | null = await ctx.db.get(roomId);
  if (!room || !room.isChannel) throw new Error("Канал не знайдено");
  if (!membersOf(room).includes(userId)) throw new Error("Ви не підписані на цей канал");
  return room;
}

async function ensureRead(ctx: MutationCtx, userId: Id<"users">, roomId: Id<"chatRooms">) {
  const read = await ctx.db
    .query("roomReads")
    .withIndex("by_user_and_room", (q) => q.eq("userId", userId).eq("chatRoomId", roomId))
    .first();
  if (read) await ctx.db.patch(read._id, { lastReadAt: Date.now() });
  else await ctx.db.insert("roomReads", { userId, chatRoomId: roomId, lastReadAt: Date.now() });
}

// Чи вільне посилання (для перевірки під час введення).
export const checkSlug = query({
  args: { slug: v.string(), exceptRoomId: v.optional(v.id("chatRooms")) },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return { ok: false, reason: "Потрібна авторизація" };
    const slug = normalizeSlug(args.slug);
    const problem = slugProblem(slug);
    if (problem) return { ok: false, reason: problem };
    if (await slugTaken(ctx, slug, args.exceptRoomId)) {
      return { ok: false, reason: "Це посилання вже зайняте" };
    }
    return { ok: true, reason: null };
  },
});

export const createChannel = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    isPublic: v.boolean(),
    slug: v.optional(v.string()),
    subscriberIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");

    await assertCanJoinMore(ctx, me);
    const title = args.title.trim();
    if (!title) throw new Error("Введіть назву каналу");
    if (title.length > TITLE_MAX) throw new Error("Назва задовга (максимум 64 символи)");
    const description = args.description?.trim() || undefined;
    if (description && description.length > DESCRIPTION_MAX) {
      throw new Error("Опис задовгий (максимум 500 символів)");
    }

    let slug: string;
    if (args.isPublic) {
      slug = normalizeSlug(args.slug ?? "");
      const problem = slugProblem(slug);
      if (problem) throw new Error(problem);
      if (await slugTaken(ctx, slug)) throw new Error("Це посилання вже зайняте");
    } else {
      slug = await freshInviteCode(ctx);
    }

    let avatarUrl: string | undefined;
    if (args.avatarStorageId) {
      avatarUrl = (await ctx.storage.getUrl(args.avatarStorageId)) ?? undefined;
    }

    const subscribers = Array.from(new Set([me._id, ...(args.subscriberIds ?? [])]));
    const roomId = await ctx.db.insert("chatRooms", {
      title,
      description,
      creatorId: me._id,
      participantIds: subscribers,
      adminIds: [me._id],
      avatarStorageId: avatarUrl ? args.avatarStorageId : undefined,
      avatarUrl,
      isChannel: true,
      isPublic: args.isPublic,
      slug,
      lastMessage: "📣 Канал створено",
      lastMessageAt: Date.now(),
    });
    await ctx.db.insert("messages", {
      chatRoomId: roomId,
      senderId: me._id,
      senderName: "Система",
      content: "📣 Канал створено",
      isSystem: true,
    });
    for (const userId of subscribers) await ensureRead(ctx, userId, roomId);
    return { roomId, slug };
  },
});

// Попередній перегляд каналу за посиланням (для екрана «Підписатись»).
export const getChannelBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return null;
    const room = await ctx.db
      .query("chatRooms")
      .withIndex("by_slug", (q) => q.eq("slug", normalizeSlug(args.slug)))
      .first();
    if (!room || !room.isChannel) return null;
    return {
      roomId: room._id,
      title: room.title,
      description: room.description,
      avatarUrl: room.avatarUrl,
      isPublic: !!room.isPublic,
      slug: room.slug!,
      subscriberCount: membersOf(room).length,
      isMember: membersOf(room).includes(me._id),
    };
  },
});

// Пошук публічних каналів за назвою або посиланням (глобальний пошук).
export const searchPublicChannels = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];
    const needle = args.query.trim().replace(/^@/, "").toLowerCase();
    if (needle.length < 2) return [];

    const channels = await ctx.db
      .query("chatRooms")
      .withIndex("by_channel", (q) => q.eq("isChannel", true))
      .collect();
    return channels
      .filter(
        (room) =>
          room.isPublic &&
          (room.title.toLowerCase().includes(needle) ||
            (room.slug ?? "").includes(needle)),
      )
      .map((room) => ({
        roomId: room._id,
        title: room.title,
        description: room.description,
        avatarUrl: room.avatarUrl,
        slug: room.slug!,
        subscriberCount: membersOf(room).length,
        isMember: membersOf(room).includes(me._id),
      }))
      .sort((a, b) => b.subscriberCount - a.subscriberCount)
      .slice(0, 20);
  },
});

// Підписатися на канал за посиланням / @username (приватні — лише за кодом запрошення).
export const joinChannel = mutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const room = await ctx.db
      .query("chatRooms")
      .withIndex("by_slug", (q) => q.eq("slug", normalizeSlug(args.slug)))
      .first();
    if (!room || !room.isChannel) throw new Error("Канал не знайдено або посилання недійсне");

    if (!membersOf(room).includes(me._id)) {
      await assertCanJoinMore(ctx, me);
      await ctx.db.patch(room._id, { participantIds: [...membersOf(room), me._id] });
    }
    await ensureRead(ctx, me._id, room._id);
    // Якщо канал був прихований у списку — повертаємо.
    await patchRoomSetting(ctx, me._id, room._id, { hidden: false });
    return room._id;
  },
});

// Тип каналу й посилання (лише творець).
export const updateChannelAccess = mutation({
  args: {
    roomId: v.id("chatRooms"),
    isPublic: v.boolean(),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const room = await requireChannel(ctx, args.roomId, me._id);
    if (room.creatorId !== me._id) throw new Error("Тип каналу змінює лише його творець");

    if (args.isPublic) {
      const slug = normalizeSlug(args.slug ?? room.slug ?? "");
      const problem = slugProblem(slug);
      if (problem) throw new Error(problem);
      if (await slugTaken(ctx, slug, room._id)) throw new Error("Це посилання вже зайняте");
      await ctx.db.patch(room._id, { isPublic: true, slug });
      return { slug };
    }
    // Приватний: старе публічне посилання перестає працювати, видаємо новий код.
    const slug = room.isPublic ? await freshInviteCode(ctx) : (room.slug ?? (await freshInviteCode(ctx)));
    await ctx.db.patch(room._id, { isPublic: false, slug });
    return { slug };
  },
});

// Новий код запрошення для приватного каналу (старе посилання перестає працювати).
export const regenerateInviteLink = mutation({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const room = await requireChannel(ctx, args.roomId, me._id);
    if (room.creatorId !== me._id) throw new Error("Посилання оновлює лише творець каналу");
    if (room.isPublic) throw new Error("Публічний канал має постійне посилання");
    const slug = await freshInviteCode(ctx);
    await ctx.db.patch(room._id, { slug });
    return { slug };
  },
});

// ── Обговорення (група для коментарів) ──

async function linkPair(ctx: MutationCtx, channelId: Id<"chatRooms">, groupId: Id<"chatRooms">) {
  await ctx.db.patch(channelId, { linkedDiscussionRoomId: groupId });
  await ctx.db.patch(groupId, { discussionOfChannelId: channelId });
}

async function unlinkPair(ctx: MutationCtx, channel: Doc<"chatRooms">) {
  const groupId = channel.linkedDiscussionRoomId;
  await ctx.db.patch(channel._id, { linkedDiscussionRoomId: undefined });
  if (groupId) {
    const group = await ctx.db.get(groupId);
    if (group?.discussionOfChannelId === channel._id) {
      await ctx.db.patch(groupId, { discussionOfChannelId: undefined });
    }
  }
}

// Створює нову групу обговорення й привʼязує до каналу (творець).
export const createDiscussionGroup = mutation({
  args: { channelId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const channel = await requireChannel(ctx, args.channelId, me._id);
    if (channel.creatorId !== me._id) throw new Error("Обговорення привʼязує лише творець каналу");
    if (channel.linkedDiscussionRoomId) throw new Error("До каналу вже привʼязано обговорення");

    const now = Date.now();
    const groupId = await ctx.db.insert("chatRooms", {
      title: `${channel.title} — обговорення`.slice(0, TITLE_MAX),
      creatorId: me._id,
      participantIds: [me._id],
      adminIds: [me._id],
      avatarStorageId: undefined,
      avatarUrl: channel.avatarUrl,
      lastMessage: "💬 Група обговорення створена",
      lastMessageAt: now,
      discussionOfChannelId: channel._id,
    });
    await ctx.db.insert("messages", {
      chatRoomId: groupId,
      senderId: me._id,
      senderName: "Система",
      content: "💬 Група обговорення створена",
      isSystem: true,
    });
    await ensureRead(ctx, me._id, groupId);
    await ctx.db.patch(channel._id, { linkedDiscussionRoomId: groupId });
    return groupId;
  },
});

// Привʼязує наявну групу (її творець — ви) як обговорення каналу.
export const linkDiscussionGroup = mutation({
  args: { channelId: v.id("chatRooms"), groupId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const channel = await requireChannel(ctx, args.channelId, me._id);
    if (channel.creatorId !== me._id) throw new Error("Обговорення привʼязує лише творець каналу");
    const group = await ctx.db.get(args.groupId);
    if (!group || group.isDirect || group.isChannel) {
      throw new Error("Для обговорення потрібна звичайна група");
    }
    if (group.creatorId !== me._id) throw new Error("Привʼязати можна лише групу, яку створили ви");
    if (group.discussionOfChannelId && group.discussionOfChannelId !== channel._id) {
      throw new Error("Ця група вже привʼязана до іншого каналу");
    }
    if (channel.linkedDiscussionRoomId && channel.linkedDiscussionRoomId !== group._id) {
      await unlinkPair(ctx, channel);
    }
    await linkPair(ctx, channel._id, group._id);
    return group._id;
  },
});

export const unlinkDiscussionGroup = mutation({
  args: { channelId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const channel = await requireChannel(ctx, args.channelId, me._id);
    if (channel.creatorId !== me._id) throw new Error("Обговорення відв'язує лише творець каналу");
    await unlinkPair(ctx, channel);
  },
});

// Підписник відкриває обговорення: приєднуємо його до групи й повертаємо id.
export const openDiscussion = mutation({
  args: { channelId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const channel = await requireChannel(ctx, args.channelId, me._id);
    const groupId = channel.linkedDiscussionRoomId;
    const group = groupId ? await ctx.db.get(groupId) : null;
    if (!groupId || !group) throw new Error("Для цього каналу немає обговорення");
    if (!membersOf(group).includes(me._id)) {
      await assertCanJoinMore(ctx, me);
      await ctx.db.patch(groupId, { participantIds: [...membersOf(group), me._id] });
    }
    await ensureRead(ctx, me._id, groupId);
    await patchRoomSetting(ctx, me._id, groupId, { hidden: false });
    return groupId;
  },
});

// Свої групи, які можна привʼязати як обговорення.
export const listLinkableGroups = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];
    const mine = await ctx.db
      .query("chatRooms")
      .withIndex("by_creator", (q) => q.eq("creatorId", me._id))
      .collect();
    return mine
      .filter((r) => !r.isDirect && !r.isChannel && !r.discussionOfChannelId)
      .map((r) => ({ roomId: r._id, title: r.title, avatarUrl: r.avatarUrl }));
  },
});
