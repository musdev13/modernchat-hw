import {
  DEFAULT_THEME_ID,
  THEMES,
  type AppTheme,
  type ThemeColors,
  isPremiumTheme,
  type ThemeId,
} from "@/constants/theme";
import { usePremium } from "@/hooks/usePremium";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "app_theme_id";
// Остання відома преміум-ознака: щоб преміум-тема не блимала дефолтною під час запуску.
const PREMIUM_CACHE_KEY = "app_premium_cached";

interface ThemeContextValue {
  theme: AppTheme;
  colors: ThemeColors;
  themeId: ThemeId;
  /** Застосовує тему; повертає false, якщо тема преміум, а Premium немає (вибір ігнорується). */
  setThemeId: (id: ThemeId) => boolean;
  /** Чи доступні зараз преміум-теми. */
  premiumUnlocked: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: THEMES[DEFAULT_THEME_ID],
  colors: THEMES[DEFAULT_THEME_ID].colors,
  themeId: DEFAULT_THEME_ID,
  setThemeId: () => false,
  premiumUnlocked: false,
});

function isThemeId(value: string | null): value is ThemeId {
  return value !== null && Object.prototype.hasOwnProperty.call(THEMES, value);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [savedId, setSavedId] = useState<ThemeId>(DEFAULT_THEME_ID);
  // true/false — відомо; null — ще невідомо (використовуємо кеш, потім відповідь сервера).
  const [premiumAllowed, setPremiumAllowed] = useState<boolean | null>(null);
  const premium = usePremium();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      SecureStore.getItemAsync(STORAGE_KEY),
      SecureStore.getItemAsync(PREMIUM_CACHE_KEY),
    ])
      .then(([saved, cached]) => {
        if (cancelled) return;
        if (isThemeId(saved)) setSavedId(saved);
        setPremiumAllowed((prev) => (prev === null && cached !== null ? cached === "1" : prev));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Відповідь сервера (і завершення терміну преміуму) має пріоритет над кешем.
  useEffect(() => {
    if (!premium.known) return;
    setPremiumAllowed(premium.isPremium);
    SecureStore.setItemAsync(PREMIUM_CACHE_KEY, premium.isPremium ? "1" : "0").catch(() => {});
  }, [premium.known, premium.isPremium]);

  // Преміум закінчився → тема повертається до безкоштовної за замовчуванням (і зберігається).
  useEffect(() => {
    if (premiumAllowed === false && isPremiumTheme(savedId)) {
      setSavedId(DEFAULT_THEME_ID);
      SecureStore.setItemAsync(STORAGE_KEY, DEFAULT_THEME_ID).catch(() => {});
    }
  }, [premiumAllowed, savedId]);

  const premiumUnlocked = premiumAllowed === true;
  // Навіть до спрацювання ефекту вище преміум-тему без прав не застосовуємо.
  const themeId: ThemeId =
    premiumAllowed === false && isPremiumTheme(savedId) ? DEFAULT_THEME_ID : savedId;

  const setThemeId = useCallback(
    (id: ThemeId): boolean => {
      if (!isThemeId(id)) return false;
      if (isPremiumTheme(id) && !premiumUnlocked) return false;
      setSavedId(id);
      SecureStore.setItemAsync(STORAGE_KEY, id).catch(() => {});
      return true;
    },
    [premiumUnlocked],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: THEMES[themeId],
      colors: THEMES[themeId].colors,
      themeId,
      setThemeId,
      premiumUnlocked,
    }),
    [themeId, setThemeId, premiumUnlocked],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}