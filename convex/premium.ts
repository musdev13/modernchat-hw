import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import {
  applyBootstrapAdmin,
  BOOTSTRAP_ADMIN_USERNAME,
  DURATION_MS,
  isPremiumNow,
} from "./premiumHelpers";
import { getAuthUser } from "./users";

const durationValidator = v.union(
  v.literal("7d"),
  v.literal("30d"),
  v.literal("1y"),
  v.literal("forever"),
);

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const me = await getAuthUser(ctx);
  if (!me) throw new Error("Потрібна авторизація");
  if (!me.isAdmin) throw new Error("Доступ лише для адміністратора");
  return me;
}

async function findUserByUsername(ctx: QueryCtx | MutationCtx, raw: string) {
  const name = raw.trim().replace(/^@/, "");
  if (!name) return null;
  for (const candidate of Array.from(new Set([name, name.toLowerCase()]))) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", candidate))
      .first();
    if (user) return user;
  }
  return null;
}

function statusOf(user: Doc<"users">, now: number) {
  const premium = isPremiumNow(user, now);
  return {
    isPremium: premium,
    lifetime: !!user.premiumLifetime,
    until: user.premiumLifetime ? null : (user.premiumUntil ?? null),
    isAdmin: !!user.isAdmin,
  };
}

/** Преміум-статус поточного користувача (для клієнта; сервер усе одно перевіряє сам). */
export const myStatus = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) return null;
    return statusOf(me, Date.now());
  },
});

/** Адмін: знайти користувача за @username і побачити його преміум-статус. */
export const lookup = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const user = await findUserByUsername(ctx, args.username);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name ?? user.username ?? "Користувач",
      username: user.username,
      image: user.image,
      ...statusOf(user, Date.now()),
    };
  },
});

/** Адмін: останні видачі/відкликання преміуму. */
export const recentGrants = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("premiumGrants").order("desc").take(30);
    return await Promise.all(
      rows.map(async (row) => {
        const target = await ctx.db.get(row.userId);
        const by = await ctx.db.get(row.grantedBy);
        return {
          _id: row._id,
          action: row.action,
          duration: row.duration,
          until: row.until,
          lifetime: !!row.lifetime,
          createdAt: row.createdAt,
          username: target?.username,
          name: target?.name ?? "Користувач",
          byUsername: by?.username,
        };
      }),
    );
  },
});

/** Адмін: видати або продовжити преміум. */
export const grant = mutation({
  args: { username: v.string(), duration: durationValidator },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const target = await findUserByUsername(ctx, args.username);
    if (!target) throw new Error("Користувача з таким @username не знайдено");

    const now = Date.now();
    let patch: Partial<Doc<"users">>;
    let until: number | undefined;
    if (args.duration === "forever") {
      patch = { premiumLifetime: true, premiumUntil: undefined };
    } else if (target.premiumLifetime) {
      throw new Error("У користувача вже є преміум назавжди");
    } else {
      // Якщо преміум ще діє — продовжуємо від його кінця.
      const base = Math.max(now, target.premiumUntil ?? 0);
      until = base + DURATION_MS[args.duration];
      patch = { premiumUntil: until };
    }
    await ctx.db.patch(target._id, { ...patch, premiumGrantedBy: admin._id });
    await ctx.db.insert("premiumGrants", {
      userId: target._id,
      grantedBy: admin._id,
      action: "grant",
      duration: args.duration,
      until,
      lifetime: args.duration === "forever" ? true : undefined,
      createdAt: now,
    });
    return { success: true, until: until ?? null, lifetime: args.duration === "forever" };
  },
});

/** Адмін: відкликати преміум. Адміністраторам преміум відкликати не можна. */
export const revoke = mutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const target = await findUserByUsername(ctx, args.username);
    if (!target) throw new Error("Користувача з таким @username не знайдено");
    if (target.isAdmin) throw new Error("Не можна відкликати преміум в адміністратора");

    await ctx.db.patch(target._id, {
      premiumUntil: undefined,
      premiumLifetime: undefined,
      premiumGrantedBy: undefined,
      emojiStatus: undefined,
    });
    await ctx.db.insert("premiumGrants", {
      userId: target._id,
      grantedBy: admin._id,
      action: "revoke",
      createdAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * Одноразовий запуск проти DEV: `npx convex run premium:bootstrapAdmin`.
 * Ідемпотентний. Якщо рядка користувача ще немає — нічого не робить (застосується при першому вході/встановленні @username).
 */
export const bootstrapAdmin = internalMutation({
  args: { username: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const username = (args.username ?? BOOTSTRAP_ADMIN_USERNAME).trim().replace(/^@/, "");
    if (username.toLowerCase() !== BOOTSTRAP_ADMIN_USERNAME) {
      throw new Error("Дозволено лише для суперадміна за замовчуванням");
    }
    const user = await findUserByUsername(ctx, username);
    if (!user) return { found: false as const, applied: false };
    const applied = await applyBootstrapAdmin(ctx, user);
    return { found: true as const, applied, isAdmin: true, lifetime: true, userId: user._id as Id<"users"> };
  },
});
