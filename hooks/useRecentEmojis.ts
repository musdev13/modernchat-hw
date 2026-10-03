import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "recent_emojis_v1";
const MAX_RECENT = 32;

let cache: string[] | null = null;
const listeners = new Set<(list: string[]) => void>();

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value)) {
      return value
        .filter((v): v is string => typeof v === "string")
        .slice(0, MAX_RECENT);
    }
  } catch {
    // пошкоджені дані — ігноруємо
  }
  return [];
}

/** Останні використані емодзі; зберігаються в expo-secure-store. */
export function useRecentEmojis() {
  const [recent, setRecent] = useState<string[]>(cache ?? []);

  useEffect(() => {
    let cancelled = false;
    listeners.add(setRecent);

    if (cache === null) {
      SecureStore.getItemAsync(STORAGE_KEY)
        .then((raw) => {
          if (cancelled) return;
          cache = parse(raw);
          listeners.forEach((l) => l(cache as string[]));
        })
        .catch(() => {
          cache = cache ?? [];
        });
    } else {
      setRecent(cache);
    }

    return () => {
      cancelled = true;
      listeners.delete(setRecent);
    };
  }, []);

  const addRecent = useCallback((emoji: string) => {
    const next = [emoji, ...(cache ?? []).filter((e) => e !== emoji)].slice(
      0,
      MAX_RECENT,
    );
    cache = next;
    listeners.forEach((l) => l(next));
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  return { recent, addRecent };
}
