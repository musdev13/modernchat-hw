import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { isPremiumNow } from "./premiumHelpers";

/**
 * Реєструє фото профілю й робить його поточним (users.image / avatarStorageId лишаються синхронними,
 * тож решта застосунку, яка читає users.image, працює без змін).
 * Якщо в користувача вже є аватар без запису в profilePhotos — спершу зберігаємо його в історії.
 */
export async function registerProfilePhoto(
  ctx: MutationCtx,
  user: Doc<"users">,
  storageId: Id<"_storage">,
): Promise<{ photoId: Id<"profilePhotos">; url: string } | null> {
  const url = await ctx.storage.getUrl(storageId);
  if (!url) return null;

  // GIF як аватар (анімований) — лише для Modesto Premium; перевіряємо на сервері за типом файлу.
  const meta = await ctx.storage.getMetadata(storageId);
  if (meta?.contentType === "image/gif" && !isPremiumNow(user)) {
    throw new Error("GIF-аватар доступний лише з Modesto Premium");
  }

  if (user.avatarStorageId && user.avatarStorageId !== storageId) {
    const existing = await ctx.db
      .query("profilePhotos")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (!existing.some((p) => p.storageId === user.avatarStorageId)) {
      await ctx.db.insert("profilePhotos", {
        userId: user._id,
        storageId: user.avatarStorageId,
        createdAt: Date.now() - 1,
      });
    }
  }

  const photoId = await ctx.db.insert("profilePhotos", {
    userId: user._id,
    storageId,
    createdAt: Date.now(),
  });
  await ctx.db.patch(user._id, {
    image: url,
    avatarStorageId: storageId,
    avatarAnimStorageId: undefined,
    avatarAnimKind: undefined,
  });
  return { photoId, url };
}
