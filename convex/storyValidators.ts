import { v } from "convex/values";

/** Хто бачить історію. */
export const audienceV = v.union(
  v.literal("all"),
  v.literal("contacts"),
  v.literal("close"),
  v.literal("selected"),
  v.literal("except"),
);

/** Приватність конкретної історії: userIds — «вибрані» (selected) або «усі крім» (except). */
export const privacyV = v.object({
  audience: audienceV,
  userIds: v.array(v.id("users")),
});

/** Накладка в редакторі: текст або емодзі-стікер; x/y — центр у частках 0..1 від розміру кадру. */
export const overlayV = v.object({
  type: v.union(v.literal("text"), v.literal("emoji")),
  text: v.string(),
  x: v.number(),
  y: v.number(),
  color: v.optional(v.string()),
  size: v.optional(v.number()),
  font: v.optional(v.string()),
  bg: v.optional(v.boolean()),
});

/** Налаштування приватності історій за замовчуванням. */
export const storyDefaultV = v.object({
  audience: audienceV,
  selectedIds: v.array(v.id("users")),
  exceptIds: v.array(v.id("users")),
});
