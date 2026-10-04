import { v } from "convex/values";
import { limitError, limitsFor } from "./limitHelpers";
import { mutation, query } from "./_generated/server";
import { getAuthUser } from "./users";

const NAME_MAX = 24;

export const list = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) return { folders: [], limits: { folders: 0, folderChats: 0 } };
    const rows = await ctx.db
      .query("chatFolders")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    rows.sort((a, b) => a.order - b.order);
    const limits = limitsFor(me);
    return {
      folders: rows.map((r) => ({ _id: r._id, name: r.name, emoji: r.emoji, roomIds: r.roomIds })),
      limits: { folders: limits.folders, folderChats: limits.folderChats },
    };
  },
});

export const save = mutation({
  args: {
    folderId: v.optional(v.id("chatFolders")),
    name: v.string(),
    emoji: v.optional(v.string()),
    roomIds: v.array(v.id("chatRooms")),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const limits = limitsFor(me);
    const name = args.name.trim().slice(0, NAME_MAX);
    if (!name) throw new Error("Вкажіть назву папки");
    const roomIds = Array.from(new Set(args.roomIds));
    if (roomIds.length > limits.folderChats) {
      throw limitError(
        `У папці може бути не більше ${limits.folderChats} чатів${
          limits.folderChats < 200 ? ". З Modesto Premium — до 200" : ""
        }.`,
      );
    }
    // Лише кімнати, де користувач є учасником.
    const valid = [];
    for (const id of roomIds) {
      const room = await ctx.db.get(id);
      if (room && (room.participantIds ?? [room.creatorId]).includes(me._id)) valid.push(id);
    }
    const emoji = args.emoji?.trim() ? args.emoji.trim().slice(0, 8) : undefined;

    if (args.folderId) {
      const row = await ctx.db.get(args.folderId);
      if (!row || row.userId !== me._id) throw new Error("Папку не знайдено");
      await ctx.db.patch(row._id, { name, emoji, roomIds: valid });
      return row._id;
    }
    const rows = await ctx.db
      .query("chatFolders")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    if (rows.length >= limits.folders) {
      throw limitError(
        `Можна створити не більше ${limits.folders} папок${
          limits.folders < 15 ? ". З Modesto Premium — до 15" : ""
        }.`,
      );
    }
    const order = rows.reduce((m, r) => Math.max(m, r.order), 0) + 1;
    return await ctx.db.insert("chatFolders", { userId: me._id, name, emoji, roomIds: valid, order });
  },
});

export const remove = mutation({
  args: { folderId: v.id("chatFolders") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    const row = await ctx.db.get(args.folderId);
    if (!row || row.userId !== me._id) return;
    await ctx.db.delete(row._id);
  },
});
