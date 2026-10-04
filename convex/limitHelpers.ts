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
