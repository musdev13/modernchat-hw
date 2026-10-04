import { LIMITS } from "@/convex/limits";
import { usePremium } from "@/hooks/usePremium";

/** Ліміти поточного користувача (лише для підказок у UI — сервер перевіряє їх самостійно). */
export function useLimits() {
  const { isPremium } = usePremium();
  return { isPremium, limits: isPremium ? LIMITS.premium : LIMITS.free };
}
