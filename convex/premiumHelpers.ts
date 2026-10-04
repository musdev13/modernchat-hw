import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/** Єдиний «суперадмін» за замовчуванням: отримує преміум назавжди й права адміністратора. */
export const BOOTSTRAP_ADMIN_USERNAME = "rinoksegodnya";

export const DAY_MS = 24 * 60 * 60 * 1000;

export type PremiumDuration = "7d" | "30d" | "1y" | "forever";

export const DURATION_MS: Record<Exclude<PremiumDuration, "forever">, number> = {
  "7d": 7 * DAY_MS,
  "30d": 30 * DAY_MS,
  "1y": 365 * DAY_MS,
};

type PremiumFields = Pick<Doc<"users">, "premiumUntil" | "premiumLifetime">;

/** Чи активний преміум просто зараз (виводиться з часу, тож завершення відбувається саме). */
export function isPremiumNow(user: PremiumFields | null | undefined, now: number = Date.now()): boolean {
  if (!user) return false;
  if (user.premiumLifetime) return true;
  return typeof user.premiumUntil === "number" && user.premiumUntil > now;
}

/** Публічні преміум-дані користувача (для бейджа й емодзі-статусу поруч з іменем). */
export function premiumView(
  user: (PremiumFields & { emojiStatus?: string }) | null | undefined,
  now: number = Date.now(),
): { isPremium: boolean; emojiStatus?: string } {
  const isPremium = isPremiumNow(user, now);
  return { isPremium, emojiStatus: isPremium ? user?.emojiStatus || undefined : undefined };
}

/**
 * Ідемпотентно робить користувача з іменем BOOTSTRAP_ADMIN_USERNAME адміністратором із преміумом
 * назавжди. Повертає true, якщо щось змінилося.
 */
export async function applyBootstrapAdmin(ctx: MutationCtx, user: Doc<"users">): Promise<boolean> {
  if ((user.username ?? "").trim().toLowerCase() !== BOOTSTRAP_ADMIN_USERNAME) return false;
  if (user.isAdmin && user.premiumLifetime) return false;
  await ctx.db.patch(user._id, {
    isAdmin: true,
    premiumLifetime: true,
    premiumGrantedBy: user._id,
  });
  await ctx.db.insert("premiumGrants", {
    userId: user._id,
    grantedBy: user._id,
    action: "grant",
    duration: "forever",
    lifetime: true,
    createdAt: Date.now(),
  });
  return true;
}

/**
 * Анімований аватар для малих кіл (список чатів, контакти, учасники): лише поки діє преміум власника.
 * Без преміуму повертає порожній обʼєкт — клієнт покаже статичний постер (users.image).
 */
export async function animAvatarFields(
  ctx: Pick<QueryCtx, "storage">,
  user: Doc<"users"> | null | undefined,
): Promise<{ avatarAnimUrl?: string; avatarAnimKind?: "video" | "gif" }> {
  if (!user || !user.avatarAnimStorageId || !isPremiumNow(user)) return {};
  const url = await ctx.storage.getUrl(user.avatarAnimStorageId);
  if (!url) return {};
  return { avatarAnimUrl: url, avatarAnimKind: user.avatarAnimKind === "gif" ? "gif" : "video" };
}
