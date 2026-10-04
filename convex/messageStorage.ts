import { Doc, Id } from "./_generated/dataModel";

/** Id повідомлень кімнати, які користувач приховав «для себе». */
export async function hiddenMessageIds(
  ctx: any,
  userId: Id<"users">,
  chatRoomId: Id<"chatRooms">,
): Promise<Set<Id<"messages">>> {
  const hides = await ctx.db
    .query("messageHides")
    .withIndex("by_user_and_room", (q: any) => q.eq("userId", userId).eq("chatRoomId", chatRoomId))
    .collect();
  return new Set(hides.map((h: Doc<"messageHides">) => h.messageId));
}

// Файл у storage може бути підʼєднаний до кількох повідомлень (пересилання медіа не копіює
// файл, а посилається на той самий storageId). Тому видаляти його можна лише тоді, коли
// на нього більше не посилається жодне інше повідомлення.
const FILE_FIELDS = [
  ["storageId", "by_storage"],
  ["audioStorageId", "by_audio_storage"],
  ["videoStorageId", "by_video_storage"],
  ["fileStorageId", "by_file_storage"],
] as const;

/** Видаляє файли повідомлення зі storage, якщо їх не використовують інші повідомлення. */
export async function releaseMessageFiles(ctx: any, message: Doc<"messages">) {
  for (const [field, index] of FILE_FIELDS) {
    const storageId = message[field] as Id<"_storage"> | undefined;
    if (!storageId) continue;
    const users = await ctx.db
      .query("messages")
      .withIndex(index, (q: any) => q.eq(field, storageId))
      .take(2);
    if (users.some((other: Doc<"messages">) => other._id !== message._id)) continue;
    await ctx.storage.delete(storageId);
  }
}

/** Підпис для списку чатів / закріплених / відповіді за типом вкладення. */
export function attachmentLabel(message: {
  isVideoNote?: boolean;
  videoUrl?: string;
  audioUrl?: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
}): string | null {
  if (message.isVideoNote && message.videoUrl) return "📹 Відеоповідомлення";
  if (message.audioUrl) return "🎤 Голосове повідомлення";
  if (message.videoUrl) return "🎥 Відео";
  if (message.fileUrl) return `📎 ${message.fileName?.trim() || "Файл"}`;
  if (message.imageUrl) return "📷 Фотографія";
  return null;
}
