import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return null;
    }

    return await ctx.db.get(userId);
  },
});

export const searchUsers = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const term = args.query.trim().toLowerCase();
    const users = await ctx.db.query("users").collect();
    return users
      .filter((user) => user._id !== userId)
      .filter((user) => {
        const value = `${user.name ?? ""} ${user.username ?? ""} ${user.email ?? ""}`.toLowerCase();
        return !term || value.includes(term);
      })
      .slice(0, 50)
      .map((user) => ({
        _id: user._id,
        name: user.name ?? user.email ?? "Користувач",
        username: user.username,
        image: user.image,
      }));
  },
});

export const generateAvatarUploadUrl = mutation(async (ctx) => {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    throw new Error("Unauthorized: Потрібна авторизація");
  }

  return await ctx.storage.generateUploadUrl();
});

export const updateUserProfile = mutation({
  args: {
    name: v.string(),
    username: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
  },

  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Unauthorized: Потрібна авторизація");
    }

    const trimmedName = args.name.trim();

    if (!trimmedName) {
      throw new Error("Ім'я користувача не може бути порожнім");
    }

    const patchData: Record<string, any> = {
      name: trimmedName,
      username: args.username?.trim().replace(/^@/, ""),
      bio: args.bio?.trim(),
    };

    if (args.avatarStorageId) {
      const imageUrl = await ctx.storage.getUrl(args.avatarStorageId);

      if (imageUrl) {
        patchData.image = imageUrl;
        patchData.avatarStorageId = args.avatarStorageId;
      }
    }

    await ctx.db.patch(userId, patchData);

    return { success: true };
  },
});

export const getUserProfile = query({
  args: {
    userId: v.id("users"),
  },

  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      return null;
    }

    const userMessages = await ctx.db
      .query("messages")
      .filter((q) => q.eq(q.field("senderId"), args.userId))
      .collect();

    const createdRooms = await ctx.db
      .query("chatRooms")
      .filter((q) => q.eq(q.field("creatorId"), args.userId))
      .collect();

    return {
      _id: user._id,
      name: user.name ?? "Користувач",
      email: user.email,
      image: user.image,
      username: user.username,
      bio: user.bio,
      _creationTime: user._creationTime,

      stats: {
        messagesCount: userMessages.length,
        roomsCreatedCount: createdRooms.length,
      },
    };
  },
});

export const savePushToken = mutation({
  args: {
    pushToken: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: Потрібна авторизація");
    }

    const trimmed = args.pushToken.trim();
    if (!trimmed || !trimmed.startsWith("ExponentPushToken[")) {
      throw new Error("Некоректний формат ExponentPushToken");
    }

    await ctx.db.patch(userId, {
      pushToken: trimmed,
    });

    return { success: true };
  },
});

export const removePushToken = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { success: false, reason: "Not authenticated" };
    }

    await ctx.db.patch(userId, {
      pushToken: undefined,
    });

    return { success: true };
  },
});