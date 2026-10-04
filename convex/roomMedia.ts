import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { getAuthUser } from "./users";

// Скільки останніх повідомлень переглядаємо для вкладок «Медіа / Голосові / Посилання».
const SCAN_LIMIT = 500;
const STICKER_MARK = "\u2063\u2063";
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"'«»]+/gi;

// Прибираємо розділові знаки, які часто «прилипають» до кінця посилання у тексті.
function cleanUrl(raw: string): string {
  return raw.replace(/[).,!?;:\]}]+$/u, "");
}

export type SharedMediaItem = {
  _id: Id<"messages">;
  createdAt: number;
  senderName: string;
  kind: "image" | "sticker" | "video";
  url: string;
  duration?: number;
  width?: number;
  height?: number;
};

export type SharedFileItem = {
  _id: Id<"messages">;
  createdAt: number;
  senderName: string;
  url: string;
  name: string;
  size?: number;
  mime?: string;
};

// Спільний вміст кімнати з останніх SCAN_LIMIT повідомлень:
// фото / наліпки / GIF і відеоповідомлення, голосові повідомлення, посилання з тексту.
export const getRoomSharedContent = query({
  args: { chatRoomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const empty = {
      media: [] as SharedMediaItem[],
      files: [] as SharedFileItem[],
      voice: [] as {
        _id: Id<"messages">;
        createdAt: number;
        senderName: string;
        url: string;
        duration: number;
      }[],
      links: [] as {
        _id: Id<"messages">;
        createdAt: number;
        senderName: string;
        urls: string[];
        text: string;
      }[],
      scanned: 0,
      truncated: false,
    };

    const me = await getAuthUser(ctx);
    if (!me) return empty;
    const room = await ctx.db.get(args.chatRoomId);
    if (!room) return empty;
    if (!(room.participantIds ?? [room.creatorId]).includes(me._id)) return empty;

    const recent = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.chatRoomId))
      .order("desc")
      .take(SCAN_LIMIT);

    const result = { ...empty, scanned: recent.length, truncated: recent.length >= SCAN_LIMIT };

    for (const message of recent) {
      if (message.isSystem) continue;
      const text = message.content ?? "";
      const createdAt = message._creationTime;

      if (message.imageUrl) {
        result.media.push({
          _id: message._id,
          createdAt,
          senderName: message.senderName,
          kind: text.startsWith(STICKER_MARK) ? "sticker" : "image",
          url: message.imageUrl,
          width: message.mediaWidth,
          height: message.mediaHeight,
        });
      } else if (message.videoUrl) {
        result.media.push({
          _id: message._id,
          createdAt,
          senderName: message.senderName,
          kind: "video",
          url: message.videoUrl,
          duration: message.videoDuration,
          width: message.mediaWidth,
          height: message.mediaHeight,
        });
      }

      if (message.fileUrl) {
        result.files.push({
          _id: message._id,
          createdAt,
          senderName: message.senderName,
          url: message.fileUrl,
          name: message.fileName ?? "Файл",
          size: message.fileSize,
          mime: message.fileMime,
        });
      }

      if (message.audioUrl) {
        result.voice.push({
          _id: message._id,
          createdAt,
          senderName: message.senderName,
          url: message.audioUrl,
          duration: message.audioDuration ?? 0,
        });
      }

      if (text && !text.startsWith(STICKER_MARK)) {
        const found = (text.match(URL_REGEX) ?? []).map(cleanUrl).filter(Boolean);
        if (found.length > 0) {
          result.links.push({
            _id: message._id,
            createdAt,
            senderName: message.senderName,
            urls: Array.from(new Set(found)).slice(0, 5),
            text: text.length > 200 ? `${text.slice(0, 200)}…` : text,
          });
        }
      }
    }
    return result;
  },
});

// Хто з учасників зараз відкрив цей чат (за heartbeat у chatPresence).
const PRESENCE_TTL_MS = 30_000;
export const getRoomOnlineUserIds = query({
  args: { chatRoomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) return [] as Id<"users">[];
    const room = await ctx.db.get(args.chatRoomId);
    if (!room) return [] as Id<"users">[];
    const members = room.participantIds ?? [room.creatorId];
    if (!members.includes(me._id)) return [] as Id<"users">[];

    const now = Date.now();
    const online: Id<"users">[] = [];
    for (const userId of members) {
      const presence = await ctx.db
        .query("chatPresence")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      if (
        presence &&
        presence.chatRoomId === args.chatRoomId &&
        presence.lastSeenAt > now - PRESENCE_TTL_MS
      ) {
        online.push(userId);
      }
    }
    return online;
  },
});
