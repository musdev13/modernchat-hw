import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import {
  ARCHIVE_FREE_DAYS,
  isKnownReaction,
  isPremiumReaction,
  LIMITS,
  STEALTH_PAST_MS,
  STEALTH_PER_DAY,
  STEALTH_WINDOW_MS,
} from "./limits";
import { assertRoomMember, previewLine, schedulePushForNewMessage } from "./messages";
import { isPremiumNow, premiumView } from "./premiumHelpers";
import { audienceV, overlayV, privacyV } from "./storyValidators";
import { getAuthUser } from "./users";

/**
 * Ліміти історій (перевіряються лише тут, на сервері): див. LIMITS у limits.ts.
 * free: 3 активні, відео ≤15 с, 24 год, підпис 200, 3 підбірки.
 * premium: 30 активних, відео ≤60 с, 6/12/24/48 год, підпис 2048, перегляди назавжди, невидимка, захист вмісту.
 */
export const STORY_LIMITS = {
  free: { active: LIMITS.free.storyActive, videoSec: LIMITS.free.storyVideoSec, lifespansH: LIMITS.free.storyLifespansH },
  premium: {
    active: LIMITS.premium.storyActive,
    videoSec: LIMITS.premium.storyVideoSec,
    lifespansH: LIMITS.premium.storyLifespansH,
  },
} as const;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const PHOTO_MAX_BYTES = 25 * 1024 * 1024;
const VIDEO_MAX_BYTES = 250 * 1024 * 1024;

type StoryErrorCode =
  | "LIMIT_ACTIVE"
  | "LIMIT_VIDEO"
  | "LIFESPAN_PREMIUM"
  | "VIEWERS_PREMIUM"
  | "PROTECT_PREMIUM"
  | "HIGHLIGHTS_LIMIT"
  | "STEALTH_PREMIUM"
  | "STEALTH_LIMIT"
  | "REACTION_PREMIUM"
  | "BAD_MEDIA";

/** Помилка з кодом: клієнт за кодом відкриває «шторку» Premium; текст — готовий українською. */
function storyError(code: StoryErrorCode, message: string) {
  return new ConvexError({ code, message });
}

const forbidden = (message = "Історію не знайдено") => new ConvexError({ code: "FORBIDDEN", message });

async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const me = await getAuthUser(ctx);
  if (!me) throw new ConvexError({ code: "UNAUTH", message: "Потрібна авторизація" });
  return me;
}

const makeDirectKey = (a: Id<"users">, b: Id<"users">) => [a as string, b as string].sort().join("_");

// ───────────────────────── приватність ─────────────────────────

type Privacy = { audience: "all" | "contacts" | "close" | "selected" | "except"; userIds: Id<"users">[] };

function privacyOf(story: Doc<"stories">): Privacy {
  return story.privacy ?? { audience: "all", userIds: [] };
}

/** Кеш на один запит: документи користувачів та наявність особистого чату. */
function makeCache(ctx: QueryCtx | MutationCtx) {
  const users = new Map<string, Doc<"users"> | null>();
  const contacts = new Map<string, boolean>();
  return {
    async user(id: Id<"users">) {
      const key = id as string;
      if (!users.has(key)) users.set(key, await ctx.db.get(id));
      return users.get(key) ?? null;
    },
    async isContact(a: Id<"users">, b: Id<"users">) {
      const key = makeDirectKey(a, b);
      if (!contacts.has(key)) {
        const room = await ctx.db
          .query("chatRooms")
          .withIndex("by_direct_key", (q) => q.eq("directKey", key))
          .first();
        contacts.set(key, !!room);
      }
      return contacts.get(key) ?? false;
    },
  };
}
type Cache = ReturnType<typeof makeCache>;

/** Чи бачить `viewerId` цю історію (приватність перевіряється на сервері для кожного читання). */
async function canSee(cache: Cache, story: Doc<"stories">, viewerId: Id<"users">): Promise<boolean> {
  if (story.userId === viewerId) return true;
  const owner = await cache.user(story.userId);
  if (!owner) return false;
  const p = privacyOf(story);
  switch (p.audience) {
    case "all":
      return true;
    case "contacts":
      return await cache.isContact(owner._id, viewerId);
    case "close":
      return (owner.closeFriendIds ?? []).includes(viewerId);
    case "selected":
      return p.userIds.includes(viewerId);
    case "except":
      return !p.userIds.includes(viewerId);
  }
}

// ───────────────────────── допоміжне ─────────────────────────

async function activeStoriesOf(ctx: QueryCtx | MutationCtx, userId: Id<"users">, now: number) {
  const rows = await ctx.db
    .query("stories")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return rows.filter((s) => s.expiresAt > now);
}

async function deleteStory(ctx: MutationCtx, story: Doc<"stories">) {
  const views = await ctx.db
    .query("storyViews")
    .withIndex("by_story", (q) => q.eq("storyId", story._id))
    .collect();
  for (const view of views) await ctx.db.delete(view._id);
  const reactions = await ctx.db
    .query("storyReactions")
    .withIndex("by_story", (q) => q.eq("storyId", story._id))
    .collect();
  for (const r of reactions) await ctx.db.delete(r._id);
  await ctx.db.delete(story._id);
  // Файл може ділити репост — видаляємо лише коли на нього ніхто не посилається.
  const others = await ctx.db
    .query("stories")
    .withIndex("by_storage", (q) => q.eq("storageId", story.storageId))
    .take(1);
  if (others.length > 0) return;
  try {
    await ctx.storage.delete(story.storageId);
  } catch {
    // файл міг бути вже видалений
  }
}

async function pushTo(
  ctx: MutationCtx,
  user: Doc<"users"> | null,
  title: string,
  body: string,
  data: Record<string, unknown>,
) {
  if (!user?.pushToken) return;
  if (user.notifPrefs && user.notifPrefs.messages === false) return;
  await ctx.scheduler.runAfter(0, internal.pushNotifications.sendPushNotification, {
    pushToken: user.pushToken,
    title,
    body,
    data,
  });
}

const nameOf = (u: Doc<"users"> | null | undefined) => u?.name ?? u?.username ?? "Користувач";

/** Згадки @username в підписі → id користувачів (до 5). */
async function resolveMentions(ctx: QueryCtx | MutationCtx, caption: string | undefined, selfId: Id<"users">) {
  if (!caption) return [] as Id<"users">[];
  const names = Array.from(new Set((caption.match(/@([A-Za-z0-9_]{3,32})/g) ?? []).map((m) => m.slice(1)))).slice(0, 5);
  const ids: Id<"users">[] = [];
  for (const name of names) {
    let user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", name))
      .first();
    if (!user) {
      user = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", name.toLowerCase()))
        .first();
    }
    if (user && user._id !== selfId && !ids.includes(user._id)) ids.push(user._id);
  }
  return ids;
}

function validateOverlays(overlays: Doc<"stories">["overlays"]) {
  if (!overlays) return undefined;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return overlays.slice(0, 12).map((o) => ({
    type: o.type,
    text: o.text.slice(0, o.type === "emoji" ? 8 : 160),
    x: clamp(o.x),
    y: clamp(o.y),
    color: o.color?.slice(0, 12),
    size: o.size ? Math.min(96, Math.max(10, o.size)) : undefined,
    font: o.font?.slice(0, 16),
    bg: o.bg,
  }));
}

export const generateUploadUrl = mutation(async (ctx) => {
  await requireUser(ctx);
  return await ctx.storage.generateUploadUrl();
});

/** Спільна перевірка лімітів для нової історії (створення / репост). */
async function assertCanPublish(ctx: MutationCtx, me: Doc<"users">, lifespan: number, now: number) {
  const premium = isPremiumNow(me, now);
  const limits = premium ? STORY_LIMITS.premium : STORY_LIMITS.free;
  if (!(limits.lifespansH as readonly number[]).includes(lifespan)) {
    throw storyError(
      "LIFESPAN_PREMIUM",
      premium
        ? "Оберіть час життя історії: 6, 12, 24 або 48 годин"
        : "Час життя історії 6, 12 чи 48 годин доступний лише з Modesto Premium. Безкоштовно — 24 години.",
    );
  }
  const active = await activeStoriesOf(ctx, me._id, now);
  if (active.length >= limits.active) {
    throw storyError(
      "LIMIT_ACTIVE",
      premium
        ? `Досягнуто ліміт: ${limits.active} активних історій. Видаліть одну з наявних або дочекайтесь її завершення.`
        : `Безкоштовно можна мати до ${limits.active} активних історій. Видаліть одну, дочекайтесь завершення або оформіть Modesto Premium (до ${STORY_LIMITS.premium.active}).`,
    );
  }
}

function resolvePrivacy(me: Doc<"users">, given: Privacy | undefined): Privacy {
  if (given) {
    return { audience: given.audience, userIds: given.audience === "selected" || given.audience === "except" ? given.userIds.slice(0, 500) : [] };
  }
  const d = me.storyDefault;
  if (!d) return { audience: "all", userIds: [] };
  return {
    audience: d.audience,
    userIds: d.audience === "selected" ? d.selectedIds : d.audience === "except" ? d.exceptIds : [],
  };
}

/** Створює історію. Усі ліміти й дозволи Premium перевіряються тут. */
export const create = mutation({
  args: {
    storageId: v.id("_storage"),
    kind: v.union(v.literal("photo"), v.literal("video")),
    caption: v.optional(v.string()),
    /** Тривалість відео, мс (дані клієнта; сервер перевіряє тип і розмір файлу). */
    durationMs: v.optional(v.number()),
    lifespanHours: v.optional(v.number()),
    privacy: v.optional(privacyV),
    allowReplies: v.optional(v.boolean()),
    protectContent: v.optional(v.boolean()),
    overlays: v.optional(v.array(overlayV)),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const now = Date.now();
    const premium = isPremiumNow(me, now);
    const limits = premium ? STORY_LIMITS.premium : STORY_LIMITS.free;

    await assertCanPublish(ctx, me, args.lifespanHours ?? 24, now);

    if (args.protectContent && !premium) {
      throw storyError("PROTECT_PREMIUM", "Захист вмісту (заборона пересилання та збереження) доступний лише з Modesto Premium.");
    }

    const meta = await ctx.storage.getMetadata(args.storageId);
    if (!meta) throw storyError("BAD_MEDIA", "Файл не знайдено. Спробуйте ще раз.");
    const type = meta.contentType ?? "";
    if (args.kind === "photo") {
      if (!type.startsWith("image/")) throw storyError("BAD_MEDIA", "Оберіть зображення");
      if (meta.size > PHOTO_MAX_BYTES) throw storyError("BAD_MEDIA", "Фото завелике: максимум 25 МБ");
    } else {
      if (!type.startsWith("video/")) throw storyError("BAD_MEDIA", "Оберіть відеофайл");
      if (meta.size > VIDEO_MAX_BYTES) throw storyError("BAD_MEDIA", "Відео завелике: максимум 250 МБ");
      if (!args.durationMs || args.durationMs <= 0) {
        throw storyError("BAD_MEDIA", "Не вдалося визначити тривалість відео");
      }
      if (args.durationMs > (limits.videoSec + 0.5) * 1000) {
        throw storyError(
          "LIMIT_VIDEO",
          premium
            ? `Відео в історії — не довше ${limits.videoSec} секунд.`
            : `Безкоштовно відео в історії — до ${limits.videoSec} секунд. З Modesto Premium — до ${STORY_LIMITS.premium.videoSec} секунд.`,
        );
      }
    }

    const captionMax = premium ? LIMITS.premium.storyCaption : LIMITS.free.storyCaption;
    if ((args.caption ?? "").trim().length > captionMax) {
      throw storyError(
        "LIMIT_VIDEO",
        premium
          ? `Підпис історії — до ${captionMax} символів.`
          : `Безкоштовно підпис — до ${captionMax} символів. З Modesto Premium — до ${LIMITS.premium.storyCaption}.`,
      );
    }
    const caption = args.caption?.trim().slice(0, captionMax) || undefined;
    const mentionIds = await resolveMentions(ctx, caption, me._id);
    const lifespan = args.lifespanHours ?? 24;

    const storyId = await ctx.db.insert("stories", {
      userId: me._id,
      kind: args.kind,
      storageId: args.storageId,
      caption,
      durationMs: args.kind === "video" ? Math.round(args.durationMs ?? 0) : undefined,
      createdAt: now,
      expiresAt: now + lifespan * HOUR_MS,
      purgeAt: now + lifespan * HOUR_MS + ARCHIVE_FREE_DAYS * DAY_MS,
      privacy: resolvePrivacy(me, args.privacy),
      allowReplies: args.allowReplies ?? true,
      protectContent: args.protectContent ? true : undefined,
      overlays: validateOverlays(args.overlays),
      mentionIds: mentionIds.length ? mentionIds : undefined,
    });

    // Сповіщення згаданим (лише тим, хто бачить цю історію).
    const story = (await ctx.db.get(storyId))!;
    const cache = makeCache(ctx);
    for (const id of mentionIds) {
      if (!(await canSee(cache, story, id))) continue;
      await pushTo(ctx, await cache.user(id), nameOf(me), "згадав(ла) вас в історії", { type: "story", storyId });
    }
    return { storyId };
  },
});

/** Репост: власної історії (з архіву) або чужої, якщо в ній не ввімкнено захист вмісту. */
export const repost = mutation({
  args: { storyId: v.id("stories"), lifespanHours: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const now = Date.now();
    const src = await ctx.db.get(args.storyId);
    if (!src) throw forbidden();
    const mine = src.userId === me._id;
    if (!mine) {
      const cache = makeCache(ctx);
      if (src.expiresAt <= now && !src.highlight) throw forbidden();
      if (!(await canSee(cache, src, me._id))) throw forbidden();
      if (src.protectContent) throw forbidden("Автор заборонив пересилання цієї історії");
    }
    await assertCanPublish(ctx, me, args.lifespanHours ?? 24, now);
    const lifespan = args.lifespanHours ?? 24;
    const storyId = await ctx.db.insert("stories", {
      userId: me._id,
      kind: src.kind,
      storageId: src.storageId,
      caption: src.caption,
      durationMs: src.durationMs,
      createdAt: now,
      expiresAt: now + lifespan * HOUR_MS,
      purgeAt: now + lifespan * HOUR_MS + ARCHIVE_FREE_DAYS * DAY_MS,
      privacy: resolvePrivacy(me, undefined),
      allowReplies: true,
      overlays: src.overlays,
      repostOfUserId: mine ? src.repostOfUserId : src.userId,
    });
    return { storyId };
  },
});

/** Скільки історій уже активні й які ліміти діють зараз (для екрана створення). */
export const myLimits = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) return null;
    const now = Date.now();
    const premium = isPremiumNow(me, now);
    const active = await activeStoriesOf(ctx, me._id, now);
    const limits = premium ? STORY_LIMITS.premium : STORY_LIMITS.free;
    const d = me.storyDefault;
    return {
      premium,
      active: active.length,
      maxActive: limits.active,
      maxVideoSec: limits.videoSec,
      lifespansH: [...limits.lifespansH],
      captionMax: premium ? LIMITS.premium.storyCaption : LIMITS.free.storyCaption,
      defaultAudience: d?.audience ?? "all",
      defaultListCount: d ? (d.audience === "selected" ? d.selectedIds.length : d.audience === "except" ? d.exceptIds.length : 0) : 0,
      closeFriendsCount: (me.closeFriendIds ?? []).length,
    };
  },
});

/** Рядок історій над списком чатів: мої + автори з активними історіями; приховані — окремо. */
export const feed = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) return null;
    const now = Date.now();
    const active = await ctx.db
      .query("stories")
      .withIndex("by_expires", (q) => q.gt("expiresAt", now))
      .collect();

    const cache = makeCache(ctx);
    const visible: Doc<"stories">[] = [];
    for (const story of active) {
      if (await canSee(cache, story, me._id)) visible.push(story);
    }

    const viewedFlags = await Promise.all(
      visible.map(async (story) => {
        if (story.userId === me._id) return true;
        const view = await ctx.db
          .query("storyViews")
          .withIndex("by_story_and_viewer", (q) => q.eq("storyId", story._id).eq("viewerId", me._id))
          .first();
        return !!view;
      }),
    );

    const groups = new Map<string, { count: number; latestAt: number; allViewed: boolean; closeOnly: boolean }>();
    visible.forEach((story, i) => {
      const key = story.userId as string;
      const g = groups.get(key) ?? { count: 0, latestAt: 0, allViewed: true, closeOnly: false };
      g.count += 1;
      g.latestAt = Math.max(g.latestAt, story.createdAt);
      g.allViewed = g.allViewed && viewedFlags[i];
      if (!viewedFlags[i] && privacyOf(story).audience === "close") g.closeOnly = true;
      groups.set(key, g);
    });

    const hiddenSet = new Set((me.storyHidden ?? []).map((x) => x as string));
    const mine = groups.get(me._id as string);
    const others = await Promise.all(
      [...groups.entries()]
        .filter(([id]) => id !== (me._id as string))
        .map(async ([id, g]) => {
          const user = await cache.user(id as Id<"users">);
          if (!user) return null;
          const flags = premiumView(user, now);
          return {
            userId: user._id,
            name: user.name ?? user.username ?? "Користувач",
            username: user.username,
            image: user.image,
            isPremium: flags.isPremium,
            emojiStatus: flags.emojiStatus,
            count: g.count,
            latestAt: g.latestAt,
            allViewed: g.allViewed,
            closeOnly: g.closeOnly,
            hidden: hiddenSet.has(id),
          };
        }),
    );
    // Порядок: непереглянуті першими, далі преміум-автори, далі найновіші.
    const all = others
      .filter((u): u is NonNullable<typeof u> => u !== null)
      .sort(
        (a, b) =>
          Number(a.allViewed) - Number(b.allViewed) ||
          Number(b.isPremium) - Number(a.isPremium) ||
          b.latestAt - a.latestAt,
      );

    return {
      me: { count: mine?.count ?? 0, latestAt: mine?.latestAt ?? 0 },
      users: all.filter((u) => !u.hidden),
      hidden: all.filter((u) => u.hidden),
    };
  },
});

/** Історії користувача для переглядача: активні (від старих до нових) або «підбірки» (highlights). */
export const userStories = query({
  args: { userId: v.id("users"), highlights: v.optional(v.boolean()), archive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return null;
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const now = Date.now();
    const isMine = user._id === me._id;
    const premiumMe = isPremiumNow(me, now);
    const cache = makeCache(ctx);

    const all = await ctx.db
      .query("stories")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const rows = all
      .filter((s) =>
        args.archive && isMine
          ? s.expiresAt <= now
          : args.highlights
            ? !!s.highlight
            : s.expiresAt > now,
      )
      .sort((a, b) => a.createdAt - b.createdAt);

    const stories = await Promise.all(
      rows.map(async (story) => {
        if (!(await canSee(cache, story, me._id))) return null;
        const url = await ctx.storage.getUrl(story.storageId);
        if (!url) return null;
        let viewed = isMine;
        let viewCount: number | undefined;
        if (isMine) {
          const views = await ctx.db
            .query("storyViews")
            .withIndex("by_story", (q) => q.eq("storyId", story._id))
            .collect();
          viewCount = views.length;
        } else {
          const view = await ctx.db
            .query("storyViews")
            .withIndex("by_story_and_viewer", (q) => q.eq("storyId", story._id).eq("viewerId", me._id))
            .first();
          viewed = !!view;
        }
        const reactions = await ctx.db
          .query("storyReactions")
          .withIndex("by_story", (q) => q.eq("storyId", story._id))
          .collect();
        const mentions = await Promise.all(
          (story.mentionIds ?? []).map(async (id) => {
            const u = await cache.user(id);
            return u?.username ? { userId: u._id, username: u.username, name: nameOf(u) } : null;
          }),
        );
        const repostOf = story.repostOfUserId ? await cache.user(story.repostOfUserId) : null;
        return {
          _id: story._id,
          kind: story.kind,
          url,
          caption: story.caption,
          durationMs: story.durationMs,
          createdAt: story.createdAt,
          expiresAt: story.expiresAt,
          viewed,
          viewCount,
          audience: privacyOf(story).audience,
          allowReplies: story.allowReplies !== false,
          protectContent: !!story.protectContent,
          // Зберігати в галерею може лише Premium і лише якщо автор не захистив вміст (власні — завжди).
          canSave: isMine || (premiumMe && !story.protectContent),
          canForward: isMine || !story.protectContent,
          overlays: story.overlays ?? [],
          mentions: mentions.filter((m): m is NonNullable<typeof m> => m !== null),
          myReaction: reactions.find((r) => r.userId === me._id)?.emoji,
          reactionCount: reactions.length,
          highlight: !!story.highlight,
          repostOfName: repostOf ? nameOf(repostOf) : undefined,
          expired: story.expiresAt <= now,
        };
      }),
    );

    const flags = premiumView(user, now);
    return {
      user: {
        _id: user._id,
        name: user.name ?? user.username ?? "Користувач",
        username: user.username,
        image: user.image,
        isPremium: flags.isPremium,
        emojiStatus: flags.emojiStatus,
      },
      isMine,
      stories: stories.filter((s): s is NonNullable<typeof s> => s !== null),
    };
  },
});

/** Для глибокого посилання modesto://s/<id>: власник історії, якщо вона доступна поточному користувачу. */
export const resolve = query({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return null;
    const story = await ctx.db.get(args.storyId);
    if (!story) return null;
    const now = Date.now();
    const isMine = story.userId === me._id;
    if (!isMine && story.expiresAt <= now && !story.highlight) return null;
    if (!(await canSee(makeCache(ctx), story, me._id))) return null;
    return { userId: story.userId, expired: story.expiresAt <= now, highlight: !!story.highlight };
  },
});

/** Позначає історію переглянутою (ідемпотентно). У режимі невидимки перегляд не записується. */
export const markViewed = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const story = await ctx.db.get(args.storyId);
    const now = Date.now();
    if (!story || story.userId === me._id || (story.expiresAt <= now && !story.highlight)) return { success: false };
    if (!(await canSee(makeCache(ctx), story, me._id))) return { success: false };
    if ((me.stealthUntil ?? 0) > now && isPremiumNow(me, now)) return { success: false, stealth: true };
    const existing = await ctx.db
      .query("storyViews")
      .withIndex("by_story_and_viewer", (q) => q.eq("storyId", story._id).eq("viewerId", me._id))
      .first();
    if (!existing) {
      await ctx.db.insert("storyViews", { storyId: story._id, viewerId: me._id, viewedAt: now });
    }
    return { success: true };
  },
});

/** Реакція на історію (повторна та сама — знімає). Преміум-емодзі — лише для Premium. */
export const react = mutation({
  args: { storyId: v.id("stories"), emoji: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const now = Date.now();
    const story = await ctx.db.get(args.storyId);
    if (!story || story.userId === me._id || (story.expiresAt <= now && !story.highlight)) throw forbidden();
    if (!(await canSee(makeCache(ctx), story, me._id))) throw forbidden();
    if (!isKnownReaction(args.emoji)) throw forbidden("Ця реакція недоступна");
    if (isPremiumReaction(args.emoji) && !isPremiumNow(me, now)) {
      throw storyError("REACTION_PREMIUM", "Ця реакція доступна лише з Modesto Premium");
    }
    const existing = await ctx.db
      .query("storyReactions")
      .withIndex("by_story_and_user", (q) => q.eq("storyId", story._id).eq("userId", me._id))
      .first();
    if (existing && existing.emoji === args.emoji) {
      await ctx.db.delete(existing._id);
      return { emoji: null as string | null };
    }
    if (existing) await ctx.db.patch(existing._id, { emoji: args.emoji, createdAt: now });
    else await ctx.db.insert("storyReactions", { storyId: story._id, userId: me._id, emoji: args.emoji, createdAt: now });
    if (!existing) {
      await pushTo(ctx, await ctx.db.get(story.userId), nameOf(me), `відреагував(ла) ${args.emoji} на вашу історію`, {
        type: "story",
        storyId: story._id,
      });
    }
    return { emoji: args.emoji as string | null };
  },
});

/** Відповідь на історію в особистий чат автора: повідомлення з цитатою історії. */
export const reply = mutation({
  args: { storyId: v.id("stories"), chatRoomId: v.id("chatRooms"), text: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const now = Date.now();
    const story = await ctx.db.get(args.storyId);
    if (!story || story.userId === me._id || (story.expiresAt <= now && !story.highlight)) throw forbidden();
    if (!(await canSee(makeCache(ctx), story, me._id))) throw forbidden();
    if (story.allowReplies === false) throw forbidden("Автор вимкнув відповіді на цю історію");
    const text = args.text.trim().slice(0, 1000);
    if (!text) throw forbidden("Введіть текст відповіді");
    const room = await assertRoomMember(ctx, args.chatRoomId, me._id);
    if (!room.isDirect || room.directKey !== makeDirectKey(me._id, story.userId)) throw forbidden("Невірний чат");
    return await postStoryMessage(ctx, me, room, story, text);
  },
});

/** Переслати історію в чат (як картку з посиланням modesto://s/<id>). Не діє для захищених історій. */
export const forwardToChat = mutation({
  args: { storyId: v.id("stories"), chatRoomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const now = Date.now();
    const story = await ctx.db.get(args.storyId);
    if (!story || (story.expiresAt <= now && !story.highlight && story.userId !== me._id)) throw forbidden();
    if (!(await canSee(makeCache(ctx), story, me._id))) throw forbidden();
    if (story.protectContent && story.userId !== me._id) throw forbidden("Автор заборонив пересилання цієї історії");
    const room = await assertRoomMember(ctx, args.chatRoomId, me._id);
    return await postStoryMessage(ctx, me, room, story, `modesto://s/${story._id}`);
  },
});

async function postStoryMessage(
  ctx: MutationCtx,
  me: Doc<"users">,
  room: Doc<"chatRooms">,
  story: Doc<"stories">,
  content: string,
) {
  const quote = story.caption?.slice(0, 80) || (story.kind === "video" ? "Відео" : "Фото");
  const senderName = me.name ?? me.email ?? "Користувач";
  const messageId = await ctx.db.insert("messages", {
    chatRoomId: room._id,
    senderId: me._id,
    senderName,
    senderPhoto: me.image,
    content,
    storyId: story._id,
    storyOwnerId: story.userId,
    storyQuote: quote,
  });
  await ctx.db.patch(room._id, {
    lastMessage: previewLine(room, senderName, content.startsWith("modesto://s/") ? "📷 Історія" : content),
    lastMessageAt: Date.now(),
  });
  await schedulePushForNewMessage(ctx, {
    roomId: room._id,
    senderId: me._id,
    senderName,
    previewText: content.startsWith("modesto://s/") ? "Історія" : `↩️ ${content}`,
    roomTitle: room.title,
    participantIds: (room.participantIds ?? [room.creatorId]) as Id<"users">[],
  });
  return messageId;
}

/**
 * Хто переглянув історію й що відповів. Власник бачить список, поки історія активна; після завершення
 * (архів) — лише з Modesto Premium. Кількість переглядів бачить кожен власник.
 */
export const viewers = query({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const story = await ctx.db.get(args.storyId);
    if (!story || story.userId !== me._id) throw forbidden();
    const now = Date.now();
    if (story.expiresAt <= now && !isPremiumNow(me, now)) {
      throw storyError("VIEWERS_PREMIUM", "Перегляди завершених історій назавжди зберігаються лише з Modesto Premium");
    }
    const views = await ctx.db
      .query("storyViews")
      .withIndex("by_story", (q) => q.eq("storyId", story._id))
      .collect();
    const reactions = await ctx.db
      .query("storyReactions")
      .withIndex("by_story", (q) => q.eq("storyId", story._id))
      .collect();
    const reactionOf = new Map(reactions.map((r) => [r.userId as string, r]));
    const ids = new Set<string>(views.map((x) => x.viewerId as string));
    for (const r of reactions) ids.add(r.userId as string);
    const timeOf = new Map<string, number>();
    for (const x of views) timeOf.set(x.viewerId as string, x.viewedAt);
    for (const r of reactions) if (!timeOf.has(r.userId as string)) timeOf.set(r.userId as string, r.createdAt);

    const sorted = [...ids].sort((a, b) => (timeOf.get(b) ?? 0) - (timeOf.get(a) ?? 0)).slice(0, 300);
    const rows = await Promise.all(
      sorted.map(async (id) => {
        const user = await ctx.db.get(id as Id<"users">);
        if (!user) return null;
        const flags = premiumView(user);
        return {
          userId: user._id,
          name: user.name ?? user.username ?? "Користувач",
          username: user.username,
          image: user.image,
          isPremium: flags.isPremium,
          emojiStatus: flags.emojiStatus,
          viewedAt: timeOf.get(id) ?? 0,
          reaction: reactionOf.get(id)?.emoji,
        };
      }),
    );
    return rows.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

/** Видалити власну історію. */
export const remove = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const story = await ctx.db.get(args.storyId);
    if (!story || story.userId !== me._id) throw forbidden();
    await deleteStory(ctx, story);
    return { success: true };
  },
});

// ───────────────────────── архів і підбірки ─────────────────────────

/** Архів: усі мої завершені історії (безкоштовно — {ARCHIVE_FREE_DAYS} діб після завершення, Premium — назавжди). */
export const myArchive = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) return null;
    const now = Date.now();
    const premium = isPremiumNow(me, now);
    const rows = (
      await ctx.db
        .query("stories")
        .withIndex("by_user", (q) => q.eq("userId", me._id))
        .collect()
    )
      .filter((s) => s.expiresAt <= now)
      .filter((s) => premium || s.highlight || s.expiresAt > now - ARCHIVE_FREE_DAYS * DAY_MS)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 200);
    const items = await Promise.all(
      rows.map(async (s) => {
        const url = await ctx.storage.getUrl(s.storageId);
        if (!url) return null;
        const views = await ctx.db
          .query("storyViews")
          .withIndex("by_story", (q) => q.eq("storyId", s._id))
          .collect();
        return {
          _id: s._id,
          kind: s.kind,
          url,
          caption: s.caption,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          highlight: !!s.highlight,
          viewCount: views.length,
          audience: privacyOf(s).audience,
        };
      }),
    );
    return {
      premium,
      keepDays: premium ? null : ARCHIVE_FREE_DAYS,
      items: items.filter((i): i is NonNullable<typeof i> => i !== null),
      highlightsUsed: (await ctx.db.query("stories").withIndex("by_user", (q) => q.eq("userId", me._id)).collect()).filter((s) => s.highlight).length,
      maxHighlights: premium ? LIMITS.premium.storyHighlights : LIMITS.free.storyHighlights,
    };
  },
});

/** Додати/прибрати історію з «Підбірок» (Збережених історій) профілю. Безкоштовно — до 3. */
export const setHighlight = mutation({
  args: { storyId: v.id("stories"), on: v.boolean() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const story = await ctx.db.get(args.storyId);
    if (!story || story.userId !== me._id) throw forbidden();
    if (args.on && !story.highlight) {
      const premium = isPremiumNow(me);
      const max = premium ? LIMITS.premium.storyHighlights : LIMITS.free.storyHighlights;
      const used = (
        await ctx.db
          .query("stories")
          .withIndex("by_user", (q) => q.eq("userId", me._id))
          .collect()
      ).filter((s) => s.highlight).length;
      if (used >= max) {
        throw storyError(
          "HIGHLIGHTS_LIMIT",
          premium
            ? `Досягнуто ліміт підбірок: ${max}.`
            : `Безкоштовно в підбірки можна зберегти до ${max} історій. З Modesto Premium — без обмежень.`,
        );
      }
    }
    await ctx.db.patch(story._id, { highlight: args.on ? true : undefined });
    return { success: true };
  },
});

/** Кількість підбірок користувача, видимих поточному (для рядка в профілі). */
export const highlightsOf = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];
    const cache = makeCache(ctx);
    const rows = (
      await ctx.db
        .query("stories")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect()
    )
      .filter((s) => s.highlight)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 40);
    const out = [];
    for (const s of rows) {
      if (!(await canSee(cache, s, me._id))) continue;
      const url = await ctx.storage.getUrl(s.storageId);
      if (url) out.push({ _id: s._id, kind: s.kind, url, createdAt: s.createdAt });
    }
    return out;
  },
});

// ───────────────────────── приватність і режим невидимки ─────────────────────────

/** Налаштування приватності історій + списки. */
export const privacySettings = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) return null;
    const d = me.storyDefault ?? { audience: "all" as const, selectedIds: [], exceptIds: [] };
    const now = Date.now();
    const hidden = await Promise.all(
      (me.storyHidden ?? []).map(async (id) => {
        const u = await ctx.db.get(id);
        return u ? { userId: u._id, name: nameOf(u), image: u.image } : null;
      }),
    );
    const premium = isPremiumNow(me, now);
    const day = new Date(now).toISOString().slice(0, 10);
    const usedToday = me.stealthDay === day ? (me.stealthUses ?? 0) : 0;
    return {
      audience: d.audience,
      selectedIds: d.selectedIds,
      exceptIds: d.exceptIds,
      closeFriendIds: me.closeFriendIds ?? [],
      hidden: hidden.filter((h): h is NonNullable<typeof h> => h !== null),
      stealthActiveUntil: premium && (me.stealthUntil ?? 0) > now ? me.stealthUntil : undefined,
      stealthLeftToday: premium ? Math.max(0, STEALTH_PER_DAY - usedToday) : 0,
    };
  },
});

export const setDefaultPrivacy = mutation({
  args: {
    audience: audienceV,
    selectedIds: v.optional(v.array(v.id("users"))),
    exceptIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const prev = me.storyDefault;
    await ctx.db.patch(me._id, {
      storyDefault: {
        audience: args.audience,
        selectedIds: (args.selectedIds ?? prev?.selectedIds ?? []).slice(0, 500),
        exceptIds: (args.exceptIds ?? prev?.exceptIds ?? []).slice(0, 500),
      },
    });
    return { success: true };
  },
});

export const setCloseFriends = mutation({
  args: { ids: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const ids = Array.from(new Set(args.ids.filter((id) => id !== me._id))).slice(0, 500);
    await ctx.db.patch(me._id, { closeFriendIds: ids });
    return { success: true };
  },
});

/** Приховати/показати історії користувача в моєму рядку («Приховані історії»). */
export const hideUser = mutation({
  args: { userId: v.id("users"), hidden: v.boolean() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const set = new Set((me.storyHidden ?? []).map((x) => x as string));
    if (args.hidden) set.add(args.userId as string);
    else set.delete(args.userId as string);
    await ctx.db.patch(me._id, { storyHidden: [...set].slice(0, 500) as Id<"users">[] });
    return { success: true };
  },
});

/** Режим невидимки (Premium): 25 хв перегляди не записуються; скасовуються й перегляди за останні 5 хв. */
export const startStealth = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const now = Date.now();
    if (!isPremiumNow(me, now)) {
      throw storyError("STEALTH_PREMIUM", "Режим невидимки доступний лише з Modesto Premium");
    }
    if ((me.stealthUntil ?? 0) > now) return { until: me.stealthUntil as number };
    const day = new Date(now).toISOString().slice(0, 10);
    const used = me.stealthDay === day ? (me.stealthUses ?? 0) : 0;
    if (used >= STEALTH_PER_DAY) {
      throw storyError("STEALTH_LIMIT", `Режим невидимки можна вмикати до ${STEALTH_PER_DAY} разів на добу`);
    }
    const until = now + STEALTH_WINDOW_MS;
    await ctx.db.patch(me._id, { stealthUntil: until, stealthDay: day, stealthUses: used + 1 });
    const recent = await ctx.db
      .query("storyViews")
      .withIndex("by_viewer", (q) => q.eq("viewerId", me._id).gte("viewedAt", now - STEALTH_PAST_MS))
      .collect();
    for (const view of recent) await ctx.db.delete(view._id);
    return { until };
  },
});

export const stopStealth = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    await ctx.db.patch(me._id, { stealthUntil: undefined });
    return { success: true };
  },
});

// ───────────────────────── крон ─────────────────────────

/**
 * Cron: завершені історії НЕ видаляються одразу — це архів. Прибираємо їх, коли минув purgeAt
 * (завершення + {ARCHIVE_FREE_DAYS} діб), крім історій Premium-авторів і підбірок (їм purgeAt відсувається).
 */
export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("stories")
      .withIndex("by_purge", (q) => q.lte("purgeAt", now))
      .take(100);
    let deleted = 0;
    for (const story of due) {
      const effective = story.purgeAt ?? story.expiresAt + ARCHIVE_FREE_DAYS * DAY_MS;
      if (effective > now) {
        await ctx.db.patch(story._id, { purgeAt: effective });
        continue;
      }
      const owner = await ctx.db.get(story.userId);
      if (story.highlight || (owner && isPremiumNow(owner, now))) {
        await ctx.db.patch(story._id, { purgeAt: now + ARCHIVE_FREE_DAYS * DAY_MS });
        continue;
      }
      await deleteStory(ctx, story);
      deleted++;
    }
    return { deleted };
  },
});
