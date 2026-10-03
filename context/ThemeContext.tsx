import {
  DEFAULT_THEME_ID,
  THEMES,
  type AppTheme,
  type ThemeColors,
  type ThemeId,
} from "@/constants/theme";
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

interface ThemeContextValue {
  theme: AppTheme;
  colors: ThemeColors;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: THEMES[DEFAULT_THEME_ID],
  colors: THEMES[DEFAULT_THEME_ID].colors,
  themeId: DEFAULT_THEME_ID,
  setThemeId: () => {},
});

function isThemeId(value: string | null): value is ThemeId {
  return value !== null && Object.prototype.hasOwnProperty.call(THEMES, value);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);

  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((saved) => {
        if (!cancelled && isThemeId(saved)) setThemeIdState(saved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    SecureStore.setItemAsync(STORAGE_KEY, id).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: THEMES[themeId],
      colors: THEMES[themeId].colors,
      themeId,
      setThemeId,
    }),
    [themeId, setThemeId],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}