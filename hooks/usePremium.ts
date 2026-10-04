import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";

export interface PremiumState {
  /** true, поки статус ще завантажується. */
  loading: boolean;
  isPremium: boolean;
  isAdmin: boolean;
  lifetime: boolean;
  /** Коли закінчується преміум (мс); null — назавжди або немає. */
  until: number | null;
}

const MAX_TIMEOUT = 2_000_000_000;

/**
 * Преміум-статус поточного користувача. Сервер перевіряє права самостійно; це лише для UI.
 * Закінчення преміуму на клієнті спрацьовує вчасно завдяки таймеру (запит сам не оновиться).
 */
export function usePremium(): PremiumState {
  const status = useQuery(api.premium.myStatus);
  const [, setTick] = useState(0);
  const until = status?.until ?? null;
  const lifetime = !!status?.lifetime;

  useEffect(() => {
    if (lifetime || until === null) return;
    const left = until - Date.now();
    if (left <= 0) return;
    const t = setTimeout(() => setTick((n) => n + 1), Math.min(left + 250, MAX_TIMEOUT));
    return () => clearTimeout(t);
  }, [until, lifetime]);

  const active = !!status?.isPremium && (lifetime || until === null || until > Date.now());
  return {
    loading: status === undefined,
    isPremium: active,
    isAdmin: !!status?.isAdmin,
    lifetime,
    until,
  };
}

/** «до 12 січня 2027» / «назавжди». */
export function formatPremiumUntil(state: Pick<PremiumState, "lifetime" | "until">): string {
  if (state.lifetime) return "назавжди";
  if (state.until === null) return "";
  return `до ${new Date(state.until).toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;
}
