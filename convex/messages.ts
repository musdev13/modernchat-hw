import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listMessages = query({
  args: { chatRoomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.chatRoomId))
      .order("asc")
      .collect();
  },
});

export const sendMessage = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Unauthorized: Потрібна авторизація");
    }

    const user = await ctx.db.get(userId);

    if (!user) {
      throw new Error("User not found: Користувача не знайдено");
    }

    const trimmedContent = args.content.trim();

    if (!trimmedContent) {
      throw new Error("Message content cannot be empty");
    }

    const messageId = await ctx.db.insert("messages", {
      chatRoomId: args.chatRoomId,
      senderId: userId,
      senderName: user.name ?? user.email ?? "Гравець",
      senderPhoto: user.image,
      content: trimmedContent,
    });

    await ctx.db.patch(args.chatRoomId, {
      lastMessage: trimmedContent,
      lastMessageAt: Date.now(),
    });

    return messageId;
  },
});

export const editMessage = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Unauthorized: Потрібна авторизація");
    }

    const message = await ctx.db.get(args.messageId);

    if (!message) {
      throw new Error("Message not found: Повідомлення не знайдено");
    }

    if (message.senderId !== userId) {
      throw new Error(
        "Forbidden: Ви можете редагувати лише власні повідомлення",
      );
    }

    const trimmedContent = args.content.trim();

    if (!trimmedContent) {
      throw new Error("Повідомлення не може бути порожнім");
    }

    await ctx.db.patch(args.messageId, {
      content: trimmedContent,
      isEdited: true,
    });

    const room = await ctx.db.get(message.chatRoomId);

    if (room && room.lastMessageAt === message._creationTime) {
      await ctx.db.patch(message.chatRoomId, {
        lastMessage: `${message.senderName}: ${trimmedContent}`,
      });
    }
  },
});

export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Unauthorized: Потрібна авторизація");
    }

    const message = await ctx.db.get(args.messageId);

    if (!message) {
      throw new Error("Message not found: Повідомлення не знайдено");
    }

    if (message.senderId !== userId) {
      throw new Error("Forbidden: Ви можете видаляти лише власні повідомлення");
    }

    if (message.storageId) {
      await ctx.storage.delete(message.storageId);
    }

    await ctx.db.delete(args.messageId);

    const lastRemainingMessage = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", message.chatRoomId))
      .order("desc")
      .first();

    await ctx.db.patch(message.chatRoomId, {
      lastMessage: lastRemainingMessage
        ? `${lastRemainingMessage.senderName}: ${lastRemainingMessage.content}`
        : "Повідомлень немає",
      lastMessageAt: lastRemainingMessage?._creationTime ?? Date.now(),
    });
  },
});

export const generateUploadUrl = mutation(async (ctx) => {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    throw new Error("Unauthorized: Потрібна авторизація");
  }

  return await ctx.storage.generateUploadUrl();
});

export const sendMediaMessage = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Unauthorized: Потрібна авторизація");
    }

    const user = await ctx.db.get(userId);

    if (!user) {
      throw new Error("User not found: Користувача не знайдено");
    }

    const imageUrl = await ctx.storage.getUrl(args.storageId);

    if (!imageUrl) {
      throw new Error("Не вдалося отримати URL завантаженого зображення");
    }

    const trimmedCaption = args.caption?.trim();

    const messageId = await ctx.db.insert("messages", {
      chatRoomId: args.chatRoomId,
      senderId: userId,
      senderName: user.name ?? user.email ?? "Користувач",
      senderPhoto: user.image,
      imageUrl,
      storageId: args.storageId,
      content: trimmedCaption,
    });

    await ctx.db.patch(args.chatRoomId, {
      lastMessage: `${user.name ?? "Користувач"}: 📷 Фото ${
        trimmedCaption ? `(${trimmedCaption})` : ""
      }`,
      lastMessageAt: Date.now(),
    });

    return messageId;
  },
});
