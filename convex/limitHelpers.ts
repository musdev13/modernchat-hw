import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { LIMITS } from "./limits";
import { isPremiumNow } from "./premiumHelpers";

/** Ліміти користувача: преміум-набір або безкоштовний. Єдина точка для серверних перевірок. */
export function limitsFor(user: Pick<Doc<"users">, "premiumUntil" | "premiumLifetime"> | null | undefined) {
  return isPremiumNow(user) ? LIMITS.premium : LIMITS.free;
}

/** Помилка ліміту (клієнт показує шторку Premium, якщо code === "LIMIT"). */
export function limitError(message: string) {
  return new ConvexError({ code: "LIMIT", message });
}

/** Помилка «лише для Premium». */
export function premiumOnlyError(message: string) {
  return new ConvexError({ code: "PREMIUM", message });
}

/** Скільки груп і каналів у користувача (без «Збереженого» й особистих чатів). */
export async function countJoinedChats(ctx: QueryCtx, userId: Id<"users">): Promise<number> {
  const rooms = await ctx.db.query("chatRooms").collect();
  let n = 0;
  for (const room of rooms) {
    if (room.isDirect || room.isSaved) continue;
    if ((room.participantIds ?? [room.creatorId]).includes(userId)) n += 1;
  }
  return n;
}

export async function assertCanJoinMore(ctx: QueryCtx, user: Doc<"users">) {
  const limits = limitsFor(user);
  const n = await countJoinedChats(ctx, user._id);
  if (n >= limits.joinedChats) {
    throw limitError(
      `Можна бути не більше ніж у ${limits.joinedChats} групах і каналах. Вийдіть з якогось${
        limits.joinedChats < LIMITS.premium.joinedChats ? " або оформіть Modesto Premium (до " + LIMITS.premium.joinedChats + ")" : ""
      }.`,
    );
  }
}

/** Чи діє преміум-налаштування приватності (діє лише поки активний преміум). */
export function premiumFlagOn(user: Doc<"users"> | null | undefined, flag: boolean | undefined): boolean {
  return !!flag && isPremiumNow(user);
}

/**
 * «Хто може мені писати» (Premium): якщо одержувач обмежив повідомлення контактами, то писати йому
 * можна лише тим, кому він сам уже писав у цьому чаті. Для груп/каналів/«Збереженого» не діє.
 */
export async function assertRecipientAllows(
  ctx: QueryCtx,
  room: Doc<"chatRooms"> | null,
  senderId: Id<"users">,
  otherUser?: Doc<"users"> | null,
) {
  if (room && (!room.isDirect || room.isSaved)) return;
  let other = otherUser ?? null;
  if (!other && room) {
    const otherId = (room.participantIds ?? [room.creatorId]).find((id) => id !== senderId);
    other = otherId ? await ctx.db.get(otherId) : null;
  }
  if (!other || other._id === senderId) return;
  if (other.whoCanMessage !== "contacts" || !isPremiumNow(other)) return;
  if (room) {
    const recent = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", room._id))
      .order("desc")
      .take(200);
    if (recent.some((m) => m.senderId === other!._id)) return;
  } else {
    // Кімнати ще немає: контакт = той, хто вже писав відправнику в інший (старий) чат — його немає.
  }
  throw new ConvexError({
    code: "PRIVACY",
    message: "Цей користувач дозволяє писати собі лише контактам.",
  });
}
