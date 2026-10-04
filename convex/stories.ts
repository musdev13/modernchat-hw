import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUser } from "./users";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const FREE_ACTIVE_STORY_LIMIT = 2;

export const listActiveStories = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) return [];

    const stories = await ctx.db
      .query("stories")
      .withIndex("by_expiration", (q) => q.gt("expiresAt", Date.now()))
      .order("asc")
      .collect();

    const groups = new Map<
      Id<"users">,
      {
        userId: Id<"users">;
        name: string;
        image?: string;
        profileEmoji?: string;
        isCurrentUser: boolean;
        stories: {
          _id: Id<"stories">;
          mediaType: "image" | "video";
          mediaUrl: string;
          expiresAt: number;
        }[];
      }
    >();

    for (const story of stories) {
      const user = await ctx.db.get(story.userId);
      if (!user) continue;
      const mediaUrl = await ctx.storage.getUrl(story.storageId);
      if (!mediaUrl) continue;

      let group = groups.get(story.userId);
      if (!group) {
        group = {
          userId: story.userId,
          name: user.username ?? user.name ?? user.email ?? "Користувач",
          image: user.image,
          profileEmoji: user.profileEmoji,
          isCurrentUser: story.userId === me._id,
          stories: [],
        };
        groups.set(story.userId, group);
      }
      group.stories.push({
        _id: story._id,
        mediaType: story.mediaType,
        mediaUrl,
        expiresAt: story.expiresAt,
      });
    }

    return Array.from(groups.values());
  },
});

export const myStoryStatus = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUser(ctx);
    if (!me) return null;
    const activeStories = await ctx.db
      .query("stories")
      .withIndex("by_user_and_expiration", (q) =>
        q.eq("userId", me._id).gt("expiresAt", Date.now()),
      )
      .collect();

    return {
      activeCount: activeStories.length,
      isPremium: me.isPremium === true,
      freeLimit: FREE_ACTIVE_STORY_LIMIT,
    };
  },
});

export const createStory = mutation({
  args: {
    storageId: v.id("_storage"),
    mediaType: v.union(v.literal("image"), v.literal("video")),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");

    const now = Date.now();
    const activeStories = await ctx.db
      .query("stories")
      .withIndex("by_user_and_expiration", (q) =>
        q.eq("userId", me._id).gt("expiresAt", now),
      )
      .collect();
    if (!me.isPremium && activeStories.length >= FREE_ACTIVE_STORY_LIMIT) {
      throw new Error("STORY_LIMIT_REACHED");
    }

    const expiresAt = now + STORY_TTL_MS;
    const storyId = await ctx.db.insert("stories", {
      userId: me._id,
      storageId: args.storageId,
      mediaType: args.mediaType,
      expiresAt,
    });
    await ctx.scheduler.runAfter(
      STORY_TTL_MS,
      internal.stories.cleanupExpiredStory,
      { storyId },
    );
    return storyId;
  },
});

export const deleteStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");

    const story = await ctx.db.get(args.storyId);
    if (!story) return { success: true };
    if (story.userId !== me._id) {
      throw new Error("Forbidden: Ви можете видалити лише власну сторис");
    }
    await ctx.storage.delete(story.storageId);
    await ctx.db.delete(story._id);
    return { success: true };
  },
});

export const cleanupExpiredStory = internalMutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) return;

    const remainingMs = story.expiresAt - Date.now();
    if (remainingMs > 0) {
      await ctx.scheduler.runAfter(
        remainingMs,
        internal.stories.cleanupExpiredStory,
        args,
      );
      return;
    }

    await ctx.storage.delete(story.storageId);
    await ctx.db.delete(story._id);
  },
});
