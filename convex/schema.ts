import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),

    username: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    pushToken: v.optional(v.string()),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  chatRooms: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    creatorId: v.id("users"),
    participantIds: v.optional(v.array(v.id("users"))),
    adminIds: v.optional(v.array(v.id("users"))),
    // Фото кімнати (файл у storage + готове посилання).
    avatarStorageId: v.optional(v.id("_storage")),
    avatarUrl: v.optional(v.string()),
    lastMessage: v.optional(v.string()),
    lastMessageAt: v.optional(v.number()),
    // Закріплені повідомлення (порядок закріплення: останнє — найновіше).
    pinnedMessageIds: v.optional(v.array(v.id("messages"))),
  }).index("by_creator", ["creatorId"]),

  messages: defineTable({
    chatRoomId: v.id("chatRooms"),
    senderId: v.id("users"),
    senderName: v.string(),
    senderPhoto: v.optional(v.string()),
    content: v.optional(v.string()),

    imageUrl: v.optional(v.string()),
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

  messageReactions: defineTable({
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  })
    .index("by_message", ["messageId"])
    .index("by_user_and_message", ["userId", "messageId"]),

  // Коли користувач востаннє читав кімнату (непрочитані та галочки «прочитано»).
  roomReads: defineTable({
    userId: v.id("users"),
    chatRoomId: v.id("chatRooms"),
    lastReadAt: v.number(),
  })
    .index("by_user_and_room", ["userId", "chatRoomId"])
    .index("by_room", ["chatRoomId"]),

  // Налаштування кімнати для конкретного користувача (вимкнені сповіщення).
  roomSettings: defineTable({
    userId: v.id("users"),
    chatRoomId: v.id("chatRooms"),
    muted: v.boolean(),
  })
    .index("by_user_and_room", ["userId", "chatRoomId"])
    .index("by_user", ["userId"])
    .index("by_room", ["chatRoomId"]),

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