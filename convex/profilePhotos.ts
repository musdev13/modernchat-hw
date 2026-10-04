import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { registerProfilePhoto } from "./photoHelpers";
import { getAuthUser } from "./users";

const MAX_PHOTOS = 30;

/** Фото профілю користувача: поточне (головне) першим, далі від нових до старих. */
export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    const rows = await ctx.db
      .query("profilePhotos")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(MAX_PHOTOS);

    const items: { _id: string; url: string; createdAt: number; isCurrent: boolean }[] = [];
    for (const row of rows) {
      const url = await ctx.storage.getUrl(row.storageId);
      if (!url) continue;
      items.push({
        _id: row._id,
        url,
        createdAt: row.createdAt,
        isCurrent: !!user.avatarStorageId && row.storageId === user.avatarStorageId,
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

/** «Зробити головним»: обране фото стає поточним аватаром. */
export const setCurrent = mutation({
  args: { photoId: v.id("profilePhotos") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized");
    const photo = await ctx.db.get(args.photoId);
    if (!photo || photo.userId !== me._id) throw new Error("Фото не знайдено");
    const url = await ctx.storage.getUrl(photo.storageId);
    if (!url) throw new Error("Файл недоступний");
    await ctx.db.patch(me._id, { image: url, avatarStorageId: photo.storageId });
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

    const wasCurrent = me.avatarStorageId === photo.storageId;
    await ctx.db.delete(photo._id);
    try {
      await ctx.storage.delete(photo.storageId);
    } catch {
      // файл міг бути вже видалений
    }

    if (wasCurrent) {
      const next = await ctx.db
        .query("profilePhotos")
        .withIndex("by_user", (q) => q.eq("userId", me._id))
        .order("desc")
        .first();
      const nextUrl = next ? await ctx.storage.getUrl(next.storageId) : null;
      if (next && nextUrl) {
        await ctx.db.patch(me._id, { image: nextUrl, avatarStorageId: next.storageId });
      } else {
        await ctx.db.patch(me._id, { image: undefined, avatarStorageId: undefined });
      }
    }
    return { success: true };
  },
});
