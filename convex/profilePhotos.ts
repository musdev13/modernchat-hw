import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, MutationCtx, query } from "./_generated/server";
import { registerProfilePhoto } from "./photoHelpers";
import { isPremiumNow } from "./premiumHelpers";
import { getAuthUser } from "./users";

const MAX_PHOTOS = 30;

/** Чи це поточний (головний) запис: анімований — за animStorageId, звичайний — за зображенням. */
function isCurrentRow(
  user: Doc<"users">,
  row: { storageId: Id<"_storage">; animStorageId?: Id<"_storage"> },
): boolean {
  if (row.animStorageId) return row.animStorageId === user.avatarAnimStorageId;
  return !user.avatarAnimStorageId && !!user.avatarStorageId && row.storageId === user.avatarStorageId;
}

/** Робить запис поточним. Анімація зберігається на користувачі, але показується лише поки діє преміум. */
async function applyCurrent(
  ctx: MutationCtx,
  user: Doc<"users">,
  row: Doc<"profilePhotos">,
): Promise<boolean> {
  const url = await ctx.storage.getUrl(row.storageId);
  if (!url) return false;
  await ctx.db.patch(user._id, {
    image: url,
    avatarStorageId: row.storageId,
    avatarAnimStorageId: row.animStorageId,
    avatarAnimKind: row.animStorageId ? (row.kind === "gif" ? "gif" : "video") : undefined,
  });
  return true;
}

/** Фото профілю користувача: поточне (головне) першим, далі від нових до старих. */
export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];
    const user = await ctx.db.get(args.userId);
    if (!user) return [];
    const premium = isPremiumNow(user);

    const rows = await ctx.db
      .query("profilePhotos")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(MAX_PHOTOS);

    const items: {
      _id: string;
      url: string;
      createdAt: number;
      isCurrent: boolean;
      kind: "photo" | "video" | "gif";
      /** Анімований файл; лише поки у власника діє преміум (інакше — тільки постер). */
      animUrl?: string;
    }[] = [];
    // Постер поточного анімованого аватара — це те саме зображення, що й звичайне фото: дубль у списку ховаємо.
    const posterOfAnim = new Set(
      rows.filter((r) => r.animStorageId && isCurrentRow(user, r)).map((r) => r.storageId as string),
    );
    for (const row of rows) {
      if (!row.animStorageId && posterOfAnim.has(row.storageId as string)) continue;
      const url = await ctx.storage.getUrl(row.storageId);
      if (!url) continue;
      const animUrl =
        premium && row.animStorageId ? ((await ctx.storage.getUrl(row.animStorageId)) ?? undefined) : undefined;
      items.push({
        _id: row._id,
        url,
        createdAt: row.createdAt,
        isCurrent: isCurrentRow(user, row),
        kind: row.kind ?? "photo",
        animUrl,
      });
    }

    // Ледаче «заповнення»: аватар без записів історії показуємо як єдине фото.
    const hasCurrent = items.some((p) => p.isCurrent);
    if (!hasCurrent && user.image) {
      items.unshift({
        _id: "legacy",
        url: user.image,
        createdAt: user._creationTime,
        isCurrent: true,
        kind: "photo",
      });
    }

    // Поточне фото — першим.
    items.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
    return items;
  },
});

/** Додає нове фото й робить його головним. */
export const add = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized");
    const result = await registerProfilePhoto(ctx, me, args.storageId);
    if (!result) throw new Error("Не вдалося зберегти фото");
    return { photoId: result.photoId };
  },
});

const MAX_ANIM_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_ANIM_GIF_BYTES = 15 * 1024 * 1024;
const MAX_ANIM_VIDEO_MS = 10_500;

/**
 * Анімований аватар (лише Modesto Premium): відео ≤10 с або GIF/анімований WebP.
 * Кадр-постер — окреме зображення (або поточне фото профілю); він і є запасним варіантом без преміуму.
 */
export const addAnimated = mutation({
  args: {
    animStorageId: v.id("_storage"),
    kind: v.union(v.literal("video"), v.literal("gif")),
    posterStorageId: v.optional(v.id("_storage")),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized");
    if (!isPremiumNow(me)) throw new Error("Анімований аватар доступний лише з Modesto Premium");

    const meta = await ctx.storage.getMetadata(args.animStorageId);
    if (!meta) throw new Error("Файл недоступний");
    const type = meta.contentType ?? "";
    if (args.kind === "video") {
      if (!type.startsWith("video/")) throw new Error("Оберіть відеофайл");
      if (meta.size > MAX_ANIM_VIDEO_BYTES) throw new Error("Відео завелике: максимум 25 МБ");
      if (args.durationMs !== undefined && args.durationMs > MAX_ANIM_VIDEO_MS) {
        throw new Error("Відео для аватара має бути не довшим за 10 секунд");
      }
    } else {
      if (type !== "image/gif" && type !== "image/webp") throw new Error("Підтримуються лише GIF та анімований WebP");
      if (meta.size > MAX_ANIM_GIF_BYTES) throw new Error("Файл завеликий: максимум 15 МБ");
    }

    const posterId = args.posterStorageId ?? me.avatarStorageId;
    if (!posterId) {
      throw new Error("Спершу встановіть звичайне фото профілю: воно показується, поки анімація завантажується, і після завершення Premium");
    }
    const posterUrl = await ctx.storage.getUrl(posterId);
    if (!posterUrl) throw new Error("Постер недоступний");
    const posterMeta = await ctx.storage.getMetadata(posterId);
    if (posterMeta?.contentType && !posterMeta.contentType.startsWith("image/")) {
      throw new Error("Постер має бути зображенням");
    }

    const rows = await ctx.db
      .query("profilePhotos")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();

    // Анімований аватар ЗАМІНЮЄ головне фото: запис, з якого взято постер (звичайне поточне фото),
    // і попередній поточний анімований запис прибираємо — у списку лишається один запис (анімований).
    const replaced = rows.filter((r) =>
      r.animStorageId ? isCurrentRow(me, r) : r.storageId === posterId,
    );
    // Інше поточне фото (якщо постер власний) без запису в історії зберігаємо.
    if (me.avatarStorageId && me.avatarStorageId !== posterId && !rows.some((p) => p.storageId === me.avatarStorageId)) {
      await ctx.db.insert("profilePhotos", {
        userId: me._id,
        storageId: me.avatarStorageId,
        createdAt: Date.now() - 1,
      });
    }
    for (const r of replaced) await ctx.db.delete(r._id);

    const photoId = await ctx.db.insert("profilePhotos", {
      userId: me._id,
      storageId: posterId,
      kind: args.kind,
      animStorageId: args.animStorageId,
      durationMs: args.durationMs,
      createdAt: Date.now(),
    });
    await ctx.db.patch(me._id, {
      image: posterUrl,
      avatarStorageId: posterId,
      avatarAnimStorageId: args.animStorageId,
      avatarAnimKind: args.kind,
    });

    // Файли замінених записів, на які більше ніхто не посилається, видаляємо.
    const kept = rows.filter((r) => !replaced.some((x) => x._id === r._id));
    const used = new Set<string>([posterId, args.animStorageId]);
    for (const r of kept) {
      used.add(r.storageId);
      if (r.animStorageId) used.add(r.animStorageId);
    }
    if (me.avatarStorageId === posterId) used.add(posterId);
    for (const r of replaced) {
      for (const id of [r.storageId, r.animStorageId]) {
        if (!id || used.has(id)) continue;
        used.add(id);
        try {
          await ctx.storage.delete(id);
        } catch {
          // файл міг бути вже видалений
        }
      }
    }
    return { photoId };
  },
});

/** «Зробити головним»: обране фото стає поточним аватаром. */
export const setCurrent = mutation({
  args: { photoId: v.id("profilePhotos") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized");
    const photo = await ctx.db.get(args.photoId);
    if (!photo || photo.userId !== me._id) throw new Error("Фото не знайдено");
    if (!(await applyCurrent(ctx, me, photo))) throw new Error("Файл недоступний");
    return { success: true };
  },
});

/** Видаляє фото; якщо воно було головним — головним стає найновіше з решти (або аватара не буде). */
export const remove = mutation({
  args: { photoId: v.id("profilePhotos") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized");
    const photo = await ctx.db.get(args.photoId);
    if (!photo || photo.userId !== me._id) throw new Error("Фото не знайдено");

    const wasCurrent = isCurrentRow(me, photo);
    await ctx.db.delete(photo._id);

    // Файл видаляємо лише якщо на нього більше ніхто не посилається (постер може бути спільним).
    const remaining = await ctx.db
      .query("profilePhotos")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    const stillUsed = (id: Id<"_storage">) =>
      remaining.some((r) => r.storageId === id || r.animStorageId === id);
    for (const id of [photo.storageId, photo.animStorageId]) {
      if (!id || stillUsed(id)) continue;
      try {
        await ctx.storage.delete(id);
      } catch {
        // файл міг бути вже видалений
      }
    }

    if (wasCurrent) {
      const next = [...remaining].sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!next || !(await applyCurrent(ctx, me, next))) {
        await ctx.db.patch(me._id, {
          image: undefined,
          avatarStorageId: undefined,
          avatarAnimStorageId: undefined,
          avatarAnimKind: undefined,
        });
      }
    }
    return { success: true };
  },
});

/**
 * Одноразова міграція (запуск: `npx convex run profilePhotos:dedupeAnimated`): для кожного поточного
 * анімованого запису прибирає окремий звичайний запис із тим самим зображенням (постер) та дублікати
 * анімованих записів з однаковим файлом. Файли не видаляє — постер лишається в анімованому записі.
 */
export const dedupeAnimated = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("profilePhotos").collect();
    const byUser = new Map<string, Doc<"profilePhotos">[]>();
    for (const row of all) {
      const list = byUser.get(row.userId as string) ?? [];
      list.push(row);
      byUser.set(row.userId as string, list);
    }
    let removedStatic = 0;
    let removedAnim = 0;
    for (const [userId, rows] of byUser) {
      const user = await ctx.db.get(userId as Id<"users">);
      if (!user) continue;
      const seenAnim = new Set<string>();
      const animRows = rows
        .filter((r) => r.animStorageId)
        .sort((a, b) => b.createdAt - a.createdAt);
      for (const r of animRows) {
        const key = r.animStorageId as string;
        if (seenAnim.has(key)) {
          await ctx.db.delete(r._id);
          removedAnim++;
        } else {
          seenAnim.add(key);
        }
      }
      const currentAnim = animRows.find((r) => isCurrentRow(user, r));
      if (!currentAnim) continue;
      for (const r of rows) {
        if (r.animStorageId || r.storageId !== currentAnim.storageId) continue;
        await ctx.db.delete(r._id);
        removedStatic++;
      }
    }
    return { removedStatic, removedAnim };
  },
});
