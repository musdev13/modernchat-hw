import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { registerProfilePhoto } from "./photoHelpers";

/** Онлайн, якщо heartbeat був не пізніше ніж ONLINE_WINDOW_MS тому (клієнт шле його кожні ~40 с). */
export const ONLINE_WINDOW_MS = 70_000;

type PresenceRow = { lastSeenAt: number; offlineAt?: number } | null | undefined;

export interface UserPresence {
  online: boolean;
  lastSeenAt?: number;
  /** Користувач приховав час останнього входу (бачить лише він сам). */
  lastSeenHidden: boolean;
}

/**
 * Статус користувача для глядача. Онлайн виводиться з часових міток (ніколи не з «застарілого»
 * булевого прапорця). lastSeenAt враховує і старе поле users.lastActiveAt.
 */
export function presenceOf(
  user: Doc<"users">,
  row: PresenceRow,
  viewerId?: Id<"users">,
  now: number = Date.now(),
): UserPresence {
  if (user.hideLastSeen && user._id !== viewerId) {
    return { online: false, lastSeenAt: undefined, lastSeenHidden: true };
  }
  const online =
    !!row &&
    row.lastSeenAt > now - ONLINE_WINDOW_MS &&
    (row.offlineAt ?? 0) < row.lastSeenAt;
  const stamp = Math.max(row?.lastSeenAt ?? 0, user.lastActiveAt ?? 0);
  return { online, lastSeenAt: stamp || undefined, lastSeenHidden: false };
}

export async function getPresenceRow(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  return await ctx.db
    .query("userPresence")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

export async function getPresenceMap(ctx: QueryCtx | MutationCtx) {
  const rows = await ctx.db.query("userPresence").collect();
  return new Map(rows.map((row) => [row.userId as string, row]));
}

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
    const presenceRows = await getPresenceMap(ctx);
    const now = Date.now();

    return users
      .filter((user) => user._id !== me._id)
      .map((user) => {
        const presence = presenceOf(user, presenceRows.get(user._id), me._id, now);
        return {
          _id: user._id,
          name: user.name ?? user.username ?? user.email ?? "Користувач",
          username: user.username,
          image: user.image,
          online: presence.online,
          lastSeenAt: presence.lastSeenAt,
          lastSeenHidden: presence.lastSeenHidden,
        };
      })
      .filter((user) => {
        if (!term) return true;
        return `${user.name} ${user.username ?? ""}`.toLowerCase().includes(term);
      })
      .sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        const diff = (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name, "uk");
      })
      .slice(0, limit);
  },
});

// Легкий статус користувача (для шапки особистого чату).
/** Пошук користувача за @username (для тапу по згадці в повідомленні). */
export const findByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return null;
    const name = args.username.trim().replace(/^@/, "");
    if (!name) return null;
    for (const candidate of Array.from(new Set([name, name.toLowerCase()]))) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", candidate))
        .first();
      if (user) return { _id: user._id };
    }
    return null;
  },
});

export const getUserStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return null;
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return presenceOf(user, await getPresenceRow(ctx, user._id), me._id);
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
    // undefined — не чіпати, "" — очистити.
    birthday: v.optional(v.string()),
    phone: v.optional(v.string()),
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

    if (args.birthday !== undefined) {
      const b = args.birthday.trim();
      if (b) {
        const d = new Date(`${b}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(b) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== b) {
          throw new Error("Некоректна дата народження");
        }
        if (d.getTime() > Date.now() || d.getUTCFullYear() < 1900) {
          throw new Error("Некоректна дата народження");
        }
        patchData.birthday = b;
      } else {
        patchData.birthday = undefined;
      }
    }
    if (args.phone !== undefined) {
      const ph = args.phone.trim();
      if (ph && !/^\+?[0-9][0-9\s().-]{5,20}$/.test(ph)) {
        throw new Error("Некоректний номер телефону");
      }
      patchData.phone = ph || undefined;
    }

    await ctx.db.patch(me._id, patchData);

    // Нове фото з форми редагування теж потрапляє в історію й стає головним.
    if (args.avatarStorageId) {
      await registerProfilePhoto(ctx, me, args.avatarStorageId);
    }

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

    const isSelf = me?._id === user._id;
    const status = presenceOf(user, await getPresenceRow(ctx, user._id), me?._id);
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
      online: status.online,
      lastSeenAt: status.lastSeenAt,
      lastSeenHidden: status.lastSeenHidden,
      hideLastSeen: isSelf ? !!user.hideLastSeen : undefined,
      birthday: user.birthday,
      // Телефон бачить лише власник; іншим — лише коли власник дозволив (за замовчуванням прихований).
      phone: isSelf || user.phoneVisible ? user.phone : undefined,
      phoneVisible: isSelf ? !!user.phoneVisible : undefined,
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
        if (room.isDirect) return false;
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

// Приватність: показувати чи ховати час останнього входу.
export const setHideLastSeen = mutation({
  args: { hide: v.boolean() },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    await ctx.db.patch(me._id, { hideLastSeen: args.hide });
    return { hide: args.hide };
  },
});

// Налаштування push-сповіщень: типи чатів, показ тексту, звук.
export const setNotifPrefs = mutation({
  args: {
    messages: v.optional(v.boolean()),
    groups: v.optional(v.boolean()),
    channels: v.optional(v.boolean()),
    preview: v.optional(v.boolean()),
    sound: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized");
    const prev = me.notifPrefs ?? { messages: true, groups: true, channels: true, preview: true, sound: true };
    const next = {
      messages: args.messages ?? prev.messages,
      groups: args.groups ?? prev.groups,
      channels: args.channels ?? prev.channels,
      preview: args.preview ?? prev.preview,
      sound: args.sound ?? prev.sound,
    };
    await ctx.db.patch(me._id, { notifPrefs: next });
    return next;
  },
});

// Приватність номера: «Усі» / «Ніхто».
export const setPhoneVisible = mutation({
  args: { visible: v.boolean() },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized");
    await ctx.db.patch(me._id, { phoneVisible: args.visible });
    return { visible: args.visible };
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