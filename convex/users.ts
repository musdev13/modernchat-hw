import { v } from "convex/values";
import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";

// Допоміжна функція для отримання поточного авторизованого користувача (Clerk)
export async function getAuthUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  let user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  if (!user && "insert" in ctx.db) {
    const userId = await (ctx.db as MutationCtx["db"]).insert("users", {
      name: identity.name ?? identity.nickname ?? "Користувач",
      email: identity.email,
      image: identity.pictureUrl,
      tokenIdentifier: identity.tokenIdentifier,
    });
    user = await ctx.db.get(userId);
  }

  return user;
}

// Запит поточного користувача для клієнта
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getAuthUser(ctx);
  },
});

// Мутація синхронізації: створює або оновлює запис користувача в базі після входу через Clerk
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Виклик store без авторизації!");
    }

    // Шукаємо, чи існує вже цей користувач у таблиці users
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user !== null) {
      // Оновлюємо ім'я або фото, якщо вони змінилися в акаунті Clerk
      const newName = identity.name ?? user.name;
      // Власне завантажене фото не перезаписуємо аватаром з Clerk.
      const newImage = user.avatarStorageId
        ? user.image
        : (identity.pictureUrl ?? user.image);

      if (user.name !== newName || user.image !== newImage) {
        await ctx.db.patch(user._id, {
          name: newName,
          image: newImage,
        });
      }
      return user._id;
    }

    // Створюємо нового користувача
    return await ctx.db.insert("users", {
      name: identity.name ?? identity.nickname ?? "Користувач",
      email: identity.email,
      image: identity.pictureUrl,
      tokenIdentifier: identity.tokenIdentifier,
    });
  },
});

export const searchUsers = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];

    const term = args.query.trim().toLowerCase();
    const users = await ctx.db.query("users").collect();
    return users
      .filter((user) => user._id !== me._id)
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

// Усі користувачі застосунку (крім поточного) як «контакти», найактивніші зверху.
export const listContacts = query({
  args: { query: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];

    const term = (args.query ?? "").trim().toLowerCase().replace(/^@/, "");
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 200), 1), 200);

    const users = await ctx.db.query("users").collect();
    const presence = await ctx.db.query("chatPresence").collect();
    const now = Date.now();
    const online = new Set<string>(
      presence
        .filter((p) => p.lastSeenAt > now - PRESENCE_TTL_MS)
        .map((p) => p.userId as string),
    );

    return users
      .filter((user) => user._id !== me._id)
      .map((user) => ({
        _id: user._id,
        name: user.name ?? user.username ?? user.email ?? "Користувач",
        username: user.username,
        image: user.image,
        inChatNow: online.has(user._id),
        lastActiveAt: user.lastActiveAt,
      }))
      .filter((user) => {
        if (!term) return true;
        return `${user.name} ${user.username ?? ""}`.toLowerCase().includes(term);
      })
      .sort((a, b) => {
        if (a.inChatNow !== b.inChatNow) return a.inChatNow ? -1 : 1;
        const diff = (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name, "uk");
      })
      .slice(0, limit);
  },
});

// Легкий статус користувача (для шапки особистого чату).
export const getUserStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return null;
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const presence = await ctx.db
      .query("chatPresence")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    return {
      inChatNow: !!presence && presence.lastSeenAt > Date.now() - PRESENCE_TTL_MS,
      lastActiveAt: user.lastActiveAt,
    };
  },
});

export const generateAvatarUploadUrl = mutation(async (ctx) => {
  const me = await getAuthUser(ctx);

  if (!me) {
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
    const me = await getAuthUser(ctx);

    if (!me) {
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

    await ctx.db.patch(me._id, patchData);

    return { success: true };
  },
});

const PRESENCE_TTL_MS = 30_000;

export const getUserProfile = query({
  args: {
    userId: v.id("users"),
  },

  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
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

    const isSelf = me?._id === user._id;
    const presence = await ctx.db
      .query("chatPresence")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    const inChatNow =
      !!presence && presence.lastSeenAt > Date.now() - PRESENCE_TTL_MS;

    return {
      _id: user._id,
      name: user.name ?? "Користувач",
      // Пошту показуємо лише власнику профілю.
      email: isSelf ? user.email : undefined,
      image: user.image,
      username: user.username,
      bio: user.bio,
      _creationTime: user._creationTime,
      isSelf,
      inChatNow,
      lastActiveAt: user.lastActiveAt,

      stats: {
        messagesCount: userMessages.length,
        roomsCreatedCount: createdRooms.length,
      },
    };
  },
});

// Кімнати, у яких одночасно є поточний користувач і вказаний.
export const getSharedRooms = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];
    const rooms = await ctx.db.query("chatRooms").order("desc").collect();
    return rooms
      .filter((room) => {
        const members = room.participantIds ?? [room.creatorId];
        return members.includes(me._id) && members.includes(args.userId);
      })
      .map((room) => ({
        _id: room._id,
        title: room.title,
        avatarUrl: room.avatarUrl,
        memberCount: (room.participantIds ?? [room.creatorId]).length,
      }));
  },
});

export const savePushToken = mutation({
  args: {
    pushToken: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) {
      throw new Error("Unauthorized: Потрібна авторизація");
    }

    const trimmed = args.pushToken.trim();
    if (!trimmed || !trimmed.startsWith("ExponentPushToken[")) {
      throw new Error("Некоректний формат ExponentPushToken");
    }

    await ctx.db.patch(me._id, {
      pushToken: trimmed,
    });

    return { success: true };
  },
});

export const removePushToken = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) {
      return { success: false, reason: "Not authenticated" };
    }

    await ctx.db.patch(me._id, {
      pushToken: undefined,
    });

    return { success: true };
  },
});