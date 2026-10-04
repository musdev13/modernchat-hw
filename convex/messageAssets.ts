import { Id } from "./_generated/dataModel";

type MessageAssetIds = {
  storageId?: Id<"_storage">;
  audioStorageId?: Id<"_storage">;
  videoStorageId?: Id<"_storage">;
};

export async function trackMessageAssets(
  ctx: any,
  messageId: Id<"messages">,
  assets: MessageAssetIds,
) {
  const storageIds = new Set(
    [assets.storageId, assets.audioStorageId, assets.videoStorageId].filter(
      (id): id is Id<"_storage"> => id !== undefined,
    ),
  );
  for (const storageId of storageIds) {
    await ctx.db.insert("messageAssetReferences", { messageId, storageId });
  }
}

export async function deleteMessageAssets(
  ctx: any,
  messageId: Id<"messages">,
  assets: MessageAssetIds,
) {
  const storageIds = new Set(
    [assets.storageId, assets.audioStorageId, assets.videoStorageId].filter(
      (id): id is Id<"_storage"> => id !== undefined,
    ),
  );

  for (const storageId of storageIds) {
    const references = await ctx.db
      .query("messageAssetReferences")
      .withIndex("by_storage", (q: any) => q.eq("storageId", storageId))
      .collect();
    const ownReferences = references.filter(
      (reference: { messageId: Id<"messages"> }) =>
        reference.messageId === messageId,
    );
    const hasOtherReferences = references.some(
      (reference: { messageId: Id<"messages"> }) =>
        reference.messageId !== messageId,
    );
    for (const reference of ownReferences) {
      await ctx.db.delete(reference._id);
    }
    if (!hasOtherReferences) {
      await ctx.storage.delete(storageId);
    }
  }

  const messageReferences = await ctx.db
    .query("messageAssetReferences")
    .withIndex("by_message", (q: any) => q.eq("messageId", messageId))
    .collect();
  for (const reference of messageReferences) {
    await ctx.db.delete(reference._id);
  }
}
