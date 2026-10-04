import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { vars } from "nativewind";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { View } from "react-native";

export type ThemeName = "glass" | "violet" | "ocean" | "sunset" | "light";

const THEMES: Record<
  ThemeName,
  {
    label: string;
    description: string;
    background: string;
    secondary: string;
    surface: string;
    surfaceLight: string;
    primary: string;
    primaryDark: string;
    textMuted: string;
    accent: string;
    danger: string;
    white: string;
    statusBar: "light" | "dark";
  }
> = {
  glass: {
    label: "Рідке скло",
    description: "Основна тема · прозорі поверхні та світлові грані",
    background: "#0B111A",
    secondary: "#17212D",
    surface: "#151E2A",
    surfaceLight: "#34465A",
    primary: "#92DFFF",
    primaryDark: "#638FE8",
    textMuted: "#B5C6D8",
    accent: "#C9B7FF",
    danger: "#FF829B",
    white: "#F4F9FF",
    statusBar: "light",
  },
  violet: {
    label: "Фіолетова",
    description: "Фірмова темна палітра",
    background: "#111116",
    secondary: "#24232D",
    surface: "#19181F",
    surfaceLight: "#34323D",
    primary: "#8065DD",
    primaryDark: "#6C50C7",
    textMuted: "#B8B3C4",
    accent: "#C9F27A",
    danger: "#FF738A",
    white: "#F7F3FF",
    statusBar: "light",
  },
  ocean: {
    label: "Океан",
    description: "Прохолодні бірюзові акценти",
    background: "#0C171B",
    secondary: "#192B31",
    surface: "#122126",
    surfaceLight: "#294047",
    primary: "#43C6B7",
    primaryDark: "#279A8E",
    textMuted: "#A9C5C8",
    accent: "#9DEBD2",
    danger: "#FF8293",
    white: "#EFFDFC",
    statusBar: "light",
  },
  sunset: {
    label: "Захід сонця",
    description: "Теплі персикові відтінки",
    background: "#1C1218",
    secondary: "#30202A",
    surface: "#241820",
    surfaceLight: "#48313D",
    primary: "#F07C8E",
    primaryDark: "#D35D77",
    textMuted: "#D1B5BC",
    accent: "#FFC48D",
    danger: "#FF738A",
    white: "#FFF5F4",
    statusBar: "light",
  },
  light: {
    label: "Світла",
    description: "Світлий режим для дня",
    background: "#F5F2FA",
    secondary: "#EAE5F2",
    surface: "#FFFFFF",
    surfaceLight: "#D8D1E2",
    primary: "#7053CE",
    primaryDark: "#5B42AE",
    textMuted: "#6F687B",
    accent: "#668A1F",
    danger: "#CF3F59",
    white: "#211B2A",
    statusBar: "dark",
  },
};

const ThemeContext = createContext<{
  theme: ThemeName;
  themes: typeof THEMES;
  setTheme: (theme: ThemeName) => Promise<void>;
} | null>(null);

function rgbChannels(color: string) {
  const value = color.replace("#", "");
  const hex = value.length === 3
    ? value.split("").map((channel) => channel + channel).join("")
    : value;
  const channels = [0, 2, 4].map((index) =>
    Number.parseInt(hex.slice(index, index + 2), 16),
  );
  return channels.join(" ");
}

export function AppThemeProvider({ children }: PropsWithChildren) {
  const currentUser = useQuery(api.users.currentUser);
  const saveTheme = useMutation(api.users.setThemePreference);
  const theme: ThemeName = currentUser?.themePreference ?? "glass";
  const selectedTheme = THEMES[theme];

  const setTheme = useCallback(
    async (nextTheme: ThemeName) => {
      await saveTheme({ theme: nextTheme });
    },
    [saveTheme],
  );

  const cssVariables = useMemo(
    () =>
      vars({
        "--color-primary": rgbChannels(selectedTheme.primary),
        "--color-primary-dark": rgbChannels(selectedTheme.primaryDark),
        "--color-secondary": rgbChannels(selectedTheme.secondary),
        "--color-background": rgbChannels(selectedTheme.background),
        "--color-surface": rgbChannels(selectedTheme.surface),
        "--color-surface-light": rgbChannels(selectedTheme.surfaceLight),
        "--color-text-muted": rgbChannels(selectedTheme.textMuted),
        "--color-danger": rgbChannels(selectedTheme.danger),
        "--color-accent": rgbChannels(selectedTheme.accent),
        "--color-white": rgbChannels(selectedTheme.white),
      }),
    [selectedTheme],
  );

  const contextValue = useMemo(
    () => ({ theme, themes: THEMES, setTheme }),
    [theme, setTheme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <View
        style={[
          { flex: 1, backgroundColor: selectedTheme.background },
          cssVariables,
        ]}
      >
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return context;
}

export function getThemeColors(theme: ThemeName) {
  return THEMES[theme];
}
