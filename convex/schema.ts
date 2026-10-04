import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),

    username: v.optional(v.string()),
    profileEmoji: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    pushToken: v.optional(v.string()),
    isPremium: v.optional(v.boolean()),
    themePreference: v.optional(
      v.union(
        v.literal("glass"),
        v.literal("violet"),
        v.literal("ocean"),
        v.literal("sunset"),
        v.literal("light"),
      ),
    ),
    favoriteRoomIds: v.optional(v.array(v.id("chatRooms"))),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  chatRooms: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    avatarUrl: v.optional(v.string()),
    creatorId: v.id("users"),
    participantIds: v.optional(v.array(v.id("users"))),
    adminIds: v.optional(v.array(v.id("users"))),
    lastMessage: v.optional(v.string()),
    lastMessageAt: v.optional(v.number()),
  }).index("by_creator", ["creatorId"]),

  messages: defineTable({
    chatRoomId: v.id("chatRooms"),
    senderId: v.id("users"),
    senderName: v.string(),
    senderPhoto: v.optional(v.string()),
    forwardedFrom: v.optional(v.string()),
    content: v.optional(v.string()),

    imageUrl: v.optional(v.string()),
    gifUrl: v.optional(v.string()),
    gifId: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),

    audioUrl: v.optional(v.string()),
    audioStorageId: v.optional(v.id("_storage")),
    audioDuration: v.optional(v.number()),
    waveform: v.optional(v.array(v.number())),

    videoUrl: v.optional(v.string()),
    videoStorageId: v.optional(v.id("_storage")),
    videoDuration: v.optional(v.number()),
    isVideoNote: v.optional(v.boolean()),

    isEdited: v.optional(v.boolean()),
    isSystem: v.optional(v.boolean()),

    replyToId: v.optional(v.id("messages")),
    replyToSender: v.optional(v.string()),
    replyToText: v.optional(v.string()),
  }).index("by_chat_room", ["chatRoomId"]),

  messageAssetReferences: defineTable({
    messageId: v.id("messages"),
    storageId: v.id("_storage"),
  })
    .index("by_storage", ["storageId"])
    .index("by_message", ["messageId"]),

  messageReactions: defineTable({
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  })
    .index("by_message", ["messageId"])
    .index("by_user_and_message", ["userId", "messageId"]),

  savedMessages: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("note"), v.literal("message")),
    body: v.string(),
    sourceMessageId: v.optional(v.id("messages")),
    sourceRoomTitle: v.optional(v.string()),
    sourceSenderName: v.optional(v.string()),
    savedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_source_message", ["userId", "sourceMessageId"]),

  stories: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    mediaType: v.union(v.literal("image"), v.literal("video")),
    expiresAt: v.number(),
  })
    .index("by_expiration", ["expiresAt"])
    .index("by_user_and_expiration", ["userId", "expiresAt"]),

  typingIndicators: defineTable({
    chatRoomId: v.id("chatRooms"),
    userId: v.id("users"),
    userName: v.string(),
    lastTypedAt: v.number(),
  })
    .index("by_room", ["chatRoomId"])
    .index("by_user_and_room", ["userId", "chatRoomId"]),

  // 🔔 Кто сейчас находится в каком чате (для отключения push в активном чате)
  chatPresence: defineTable({
    userId: v.id("users"),
    chatRoomId: v.id("chatRooms"),
    lastSeenAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_chat_room", ["chatRoomId"]),
});