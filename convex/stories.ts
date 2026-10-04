import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { isPremiumNow, premiumView } from "./premiumHelpers";
import { getAuthUser } from "./users";

/**
 * Ліміти історій (перевіряються лише тут, на сервері).
 * free: 3 активні, фото або відео ≤15 с, живуть 24 год.
 * premium: 30 активних, відео ≤60 с, життя 6/12/24/48 год, список переглядів.
 */
export const STORY_LIMITS = {
  free: { active: 3, videoSec: 15, lifespansH: [24] },
  premium: { active: 30, videoSec: 60, lifespansH: [6, 12, 24, 48] },
} as const;

const HOUR_MS = 3_600_000;
const PHOTO_MAX_BYTES = 25 * 1024 * 1024;
const VIDEO_MAX_BYTES = 250 * 1024 * 1024;
const CAPTION_MAX = 200;

type StoryErrorCode =
  | "LIMIT_ACTIVE"
  | "LIMIT_VIDEO"
  | "LIFESPAN_PREMIUM"
  | "VIEWERS_PREMIUM"
  | "BAD_MEDIA";

/** Помилка з кодом: клієнт за кодом відкриває «шторку» Premium; текст — готовий українською. */
function storyError(code: StoryErrorCode, message: string) {
  return new ConvexError({ code, message });
}

async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const me = await getAuthUser(ctx);
  if (!me) throw new ConvexError({ code: "UNAUTH", message: "Потрібна авторизація" });
  return me;
}

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
  await ctx.db.delete(story._id);
  try {
    await ctx.storage.delete(story.storageId);
  } catch {
    // файл міг бути вже видалений
  }
}

export const generateUploadUrl = mutation(async (ctx) => {
  await requireUser(ctx);
  return await ctx.storage.generateUploadUrl();
});

/** Створює історію. Усі ліміти й дозволи Premium перевіряються тут. */
export const create = mutation({
  args: {
    storageId: v.id("_storage"),
    kind: v.union(v.literal("photo"), v.literal("video")),
    caption: v.optional(v.string()),
    /** Тривалість відео, мс (дані клієнта; сервер перевіряє тип і розмір файлу). */
    durationMs: v.optional(v.number()),
    lifespanHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const now = Date.now();
    const premium = isPremiumNow(me, now);
    const limits = premium ? STORY_LIMITS.premium : STORY_LIMITS.free;

    const lifespan = args.lifespanHours ?? 24;
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

    const caption = args.caption?.trim().slice(0, CAPTION_MAX) || undefined;
    const storyId = await ctx.db.insert("stories", {
      userId: me._id,
      kind: args.kind,
      storageId: args.storageId,
      caption,
      durationMs: args.kind === "video" ? Math.round(args.durationMs ?? 0) : undefined,
      createdAt: now,
      expiresAt: now + lifespan * HOUR_MS,
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
    return {
      premium,
      active: active.length,
      maxActive: limits.active,
      maxVideoSec: limits.videoSec,
      lifespansH: [...limits.lifespansH],
    };
  },
});

/** Рядок історій над списком чатів: мої + автори з активними історіями (непереглянуті першими). */
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

    const viewedFlags = await Promise.all(
      active.map(async (story) => {
        if (story.userId === me._id) return true;
        const view = await ctx.db
          .query("storyViews")
          .withIndex("by_story_and_viewer", (q) => q.eq("storyId", story._id).eq("viewerId", me._id))
          .first();
        return !!view;
      }),
    );

    const groups = new Map<string, { count: number; latestAt: number; allViewed: boolean }>();
    active.forEach((story, i) => {
      const key = story.userId as string;
      const g = groups.get(key) ?? { count: 0, latestAt: 0, allViewed: true };
      g.count += 1;
      g.latestAt = Math.max(g.latestAt, story.createdAt);
      g.allViewed = g.allViewed && viewedFlags[i];
      groups.set(key, g);
    });

    const mine = groups.get(me._id as string);
    const others = await Promise.all(
      [...groups.entries()]
        .filter(([id]) => id !== (me._id as string))
        .map(async ([id, g]) => {
          const user = await ctx.db.get(id as Id<"users">);
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
          };
        }),
    );
    const users = others
      .filter((u): u is NonNullable<typeof u> => u !== null)
      .sort((a, b) => Number(a.allViewed) - Number(b.allViewed) || b.latestAt - a.latestAt);

    return {
      me: { count: mine?.count ?? 0, latestAt: mine?.latestAt ?? 0 },
      users,
    };
  },
});

/** Активні історії користувача (від старих до нових) для переглядача. */
export const userStories = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return null;
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const now = Date.now();
    const isMine = user._id === me._id;
    const rows = (await activeStoriesOf(ctx, user._id, now)).sort((a, b) => a.createdAt - b.createdAt);

    const stories = await Promise.all(
      rows.map(async (story) => {
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

/** Позначає історію переглянутою (ідемпотентно; власні історії й прострочені ігноруються). */
export const markViewed = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const story = await ctx.db.get(args.storyId);
    if (!story || story.userId === me._id || story.expiresAt <= Date.now()) return { success: false };
    const existing = await ctx.db
      .query("storyViews")
      .withIndex("by_story_and_viewer", (q) => q.eq("storyId", story._id).eq("viewerId", me._id))
      .first();
    if (!existing) {
      await ctx.db.insert("storyViews", { storyId: story._id, viewerId: me._id, viewedAt: Date.now() });
    }
    return { success: true };
  },
});

/** Хто переглянув історію: лише власник і лише з Modesto Premium (кількість бачить кожен власник). */
export const viewers = query({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const story = await ctx.db.get(args.storyId);
    if (!story || story.userId !== me._id) throw new ConvexError({ code: "FORBIDDEN", message: "Історію не знайдено" });
    if (!isPremiumNow(me)) {
      throw storyError("VIEWERS_PREMIUM", "Список переглядів доступний лише з Modesto Premium");
    }
    const views = await ctx.db
      .query("storyViews")
      .withIndex("by_story", (q) => q.eq("storyId", story._id))
      .collect();
    views.sort((a, b) => b.viewedAt - a.viewedAt);
    const rows = await Promise.all(
      views.slice(0, 200).map(async (view) => {
        const user = await ctx.db.get(view.viewerId);
        if (!user) return null;
        const flags = premiumView(user);
        return {
          userId: user._id,
          name: user.name ?? user.username ?? "Користувач",
          username: user.username,
          image: user.image,
          isPremium: flags.isPremium,
          emojiStatus: flags.emojiStatus,
          viewedAt: view.viewedAt,
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
    if (!story || story.userId !== me._id) throw new ConvexError({ code: "FORBIDDEN", message: "Історію не знайдено" });
    await deleteStory(ctx, story);
    return { success: true };
  },
});

/** Cron: видаляє прострочені історії (разом із переглядами й файлами). Пакетами, щоб вкластись у ліміти. */
export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("stories")
      .withIndex("by_expires", (q) => q.lte("expiresAt", Date.now()))
      .take(50);
    for (const story of expired) await deleteStory(ctx, story);
    return { deleted: expired.length };
  },
});
