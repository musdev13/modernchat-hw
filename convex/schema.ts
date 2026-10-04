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
    // Коли користувач востаннє вийшов із чату (для «остання активність»).
    lastActiveAt: v.optional(v.number()),
    // Приватність: приховати час останнього входу («був(ла) нещодавно»).
    hideLastSeen: v.optional(v.boolean()),
    // День народження (ISO «YYYY-MM-DD») і телефон; телефон показується іншим лише за phoneVisible.
    birthday: v.optional(v.string()),
    phone: v.optional(v.string()),
    phoneVisible: v.optional(v.boolean()),
    // Налаштування push-сповіщень (за замовчуванням усе ввімкнено).
    notifPrefs: v.optional(
      v.object({
        messages: v.boolean(),
        groups: v.boolean(),
        channels: v.boolean(),
        preview: v.boolean(),
        sound: v.boolean(),
      }),
    ),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .index("by_username", ["username"]),

  chatRooms: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    creatorId: v.id("users"),
    participantIds: v.optional(v.array(v.id("users"))),
    adminIds: v.optional(v.array(v.id("users"))),
    // Фото кімнати (файл у storage + готове посилання).
    avatarStorageId: v.optional(v.id("_storage")),
    avatarUrl: v.optional(v.string()),
    // Особистий (1:1) чат: рівно двоє учасників, назва й фото беруться від співрозмовника.
    isDirect: v.optional(v.boolean()),
    // «Збережене»: особистий чат із самим собою (isDirect + рівно один учасник).
    isSaved: v.optional(v.boolean()),
    // Канал: публікують лише творець/адміни, решта — підписники (читають, реагують, голосують).
    isChannel: v.optional(v.boolean()),
    // Публічний канал знаходиться пошуком; приватний — лише за запрошувальним посиланням.
    isPublic: v.optional(v.boolean()),
    // Унікальний «@username» публічного каналу або код запрошення приватного (a-z0-9_).
    slug: v.optional(v.string()),
    // Група для обговорення (коментарів) каналу.
    linkedDiscussionRoomId: v.optional(v.id("chatRooms")),
    // Для групи обговорення: канал, до якого вона привʼязана.
    discussionOfChannelId: v.optional(v.id("chatRooms")),
    // Відсортована пара id користувачів («idA_idB») для пошуку існуючого особистого чату.
    directKey: v.optional(v.string()),
    lastMessage: v.optional(v.string()),
    lastMessageAt: v.optional(v.number()),
    // Закріплені повідомлення (порядок закріплення: останнє — найновіше).
    pinnedMessageIds: v.optional(v.array(v.id("messages"))),
  })
    .index("by_creator", ["creatorId"])
    .index("by_direct_key", ["directKey"])
    .index("by_slug", ["slug"])
    .index("by_channel", ["isChannel"]),

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

    // Довільний файл (документ, архів тощо).
    fileUrl: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    fileMime: v.optional(v.string()),

    // Опитування (дані в таблиці polls).
    pollId: v.optional(v.id("polls")),

    // Розміри фото / відео (для правильних пропорцій бульбашки).
    mediaWidth: v.optional(v.number()),
    mediaHeight: v.optional(v.number()),

    isEdited: v.optional(v.boolean()),
    isSystem: v.optional(v.boolean()),

    replyToId: v.optional(v.id("messages")),
    replyToSender: v.optional(v.string()),
    replyToText: v.optional(v.string()),

    // Пересланe повідомлення: ім'я першого автора.
    forwardedFrom: v.optional(v.string()),
  })
    .index("by_chat_room", ["chatRoomId"])
    .index("by_storage", ["storageId"])
    .index("by_audio_storage", ["audioStorageId"])
    .index("by_video_storage", ["videoStorageId"])
    .index("by_file_storage", ["fileStorageId"]),

  polls: defineTable({
    chatRoomId: v.id("chatRooms"),
    creatorId: v.id("users"),
    question: v.string(),
    options: v.array(v.object({ id: v.string(), text: v.string() })),
    // Анонімне: не видно, хто за що проголосував.
    anonymous: v.boolean(),
    // Можна обрати кілька відповідей.
    multiple: v.boolean(),
    closed: v.optional(v.boolean()),
  }).index("by_room", ["chatRoomId"]),

  // Один рядок на користувача; порожній optionIds = голос скасовано.
  pollVotes: defineTable({
    pollId: v.id("polls"),
    userId: v.id("users"),
    optionIds: v.array(v.string()),
  })
    .index("by_poll", ["pollId"])
    .index("by_poll_and_user", ["pollId", "userId"]),

  // «Видалити для мене»: повідомлення приховане лише для цього користувача.
  messageHides: defineTable({
    userId: v.id("users"),
    messageId: v.id("messages"),
    chatRoomId: v.id("chatRooms"),
  })
    .index("by_user_and_room", ["userId", "chatRoomId"])
    .index("by_user_and_message", ["userId", "messageId"])
    .index("by_message", ["messageId"])
    .index("by_room", ["chatRoomId"]),

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
    // Вимкнено до цього моменту (без значення при muted = назавжди).
    mutedUntil: v.optional(v.number()),
    // Закріплено нагорі списку чатів.
    pinned: v.optional(v.boolean()),
    // Чат приховано для цього користувача (повертається, коли з'являється нове повідомлення).
    hidden: v.optional(v.boolean()),
    hiddenAt: v.optional(v.number()),
    // «Очистити історію» лише для себе: повідомлення, створені до цього моменту, не показуються.
    clearedAt: v.optional(v.number()),
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

  // Загальний онлайн-статус застосунку (окрема таблиця, щоб heartbeat не перезапускав
  // усі запити власника, які читають документ users).
  userPresence: defineTable({
    userId: v.id("users"),
    lastSeenAt: v.number(),
    // Коли користувач явно вийшов із застосунку (фон). Онлайн, лише якщо lastSeenAt > offlineAt.
    offlineAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // 🔔 Кто сейчас находится в каком чате (для отключения push в активном чате)
  chatPresence: defineTable({
    userId: v.id("users"),
    chatRoomId: v.id("chatRooms"),
    lastSeenAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_chat_room", ["chatRoomId"]),

  // Кеш попереднього перегляду посилань (OpenGraph), ключ — url без #фрагмента.
  linkPreviews: defineTable({
    url: v.string(),
    status: v.union(v.literal("ok"), v.literal("failed")),
    siteName: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
    fetchedAt: v.number(),
  }).index("by_url", ["url"]),

  // Історія фото профілю; поточне — те, чий storageId збігається з users.avatarStorageId.
  profilePhotos: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
});
