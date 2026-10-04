import { v } from "convex/values";
import { limitError, limitsFor } from "./limitHelpers";
import { mutation, query } from "./_generated/server";
import { getAuthUser } from "./users";

export const favorites = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) return { items: [], max: 0 };
    const rows = await ctx.db
      .query("favoriteGifs")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .order("desc")
      .collect();
    return {
      max: limitsFor(me).favoriteGifs,
      items: rows.map((r) => ({
        id: r.gifId,
        kind: r.kind,
        previewUrl: r.previewUrl,
        url: r.url,
        width: r.width,
        height: r.height,
      })),
    };
  },
});

/** Додає GIF/наліпку в улюблені або прибирає, якщо вже є. Ліміт: 5 / 200 (Premium). */
export const toggleFavorite = mutation({
  args: {
    gifId: v.string(),
    kind: v.union(v.literal("gif"), v.literal("sticker")),
    previewUrl: v.string(),
    url: v.string(),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const existing = await ctx.db
      .query("favoriteGifs")
      .withIndex("by_user_and_gif", (q) => q.eq("userId", me._id).eq("gifId", args.gifId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { added: false };
    }
    const limits = limitsFor(me);
    const all = await ctx.db
      .query("favoriteGifs")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    if (all.length >= limits.favoriteGifs) {
      throw limitError(
        `Улюблених GIF і наліпок може бути не більше ${limits.favoriteGifs}${
          limits.favoriteGifs < 200 ? ". З Modesto Premium — до 200" : ""
        }.`,
      );
    }
    if (!/^https:\/\//.test(args.url) || !/^https:\/\//.test(args.previewUrl)) {
      throw new Error("Некоректне посилання");
    }
    await ctx.db.insert("favoriteGifs", { userId: me._id, ...args });
    return { added: true };
  },
});
