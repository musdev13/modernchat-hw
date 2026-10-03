export const COLORS = {
  primary: "#3B82F6",
  primaryDark: "#1D4ED8",
  secondary: "#1E293B",
  background: "#0A0F1D",
  surface: "#0F172A",
  surfaceLight: "#334155",
  white: "#FFFFFF",
  textMuted: "#94A3B8",
  danger: "#EF4444",
} as const;

export interface ThemeColors {
  bg: string;
  header: string;
  divider: string;
  search: string;
  accent: string;
  text: string;
  muted: string;
  danger: string;
  /** Колір тексту/іконок на акцентному фоні (кнопки, аватарки). */
  onAccent: string;
}

export type ThemeId = "telegram" | "oled" | "light" | "purple";

export interface AppTheme {
  id: ThemeId;
  name: string;
  isDark: boolean;
  colors: ThemeColors;
}

/** Доступні теми оформлення. */
export const THEMES: Record<ThemeId, AppTheme> = {
  telegram: {
    id: "telegram",
    name: "Telegram (темна)",
    isDark: true,
    colors: {
      bg: "#17212B",
      header: "#17212B",
      divider: "#0E1621",
      search: "#242F3D",
      accent: "#2AABEE",
      text: "#FFFFFF",
      muted: "#708499",
      danger: "#E53935",
      onAccent: "#FFFFFF",
    },
  },
  oled: {
    id: "oled",
    name: "Чорна (OLED)",
    isDark: true,
    colors: {
      bg: "#000000",
      header: "#000000",
      divider: "#1C1C1E",
      search: "#1C1C1E",
      accent: "#3AA0FF",
      text: "#FFFFFF",
      muted: "#7F8691",
      danger: "#FF453A",
      onAccent: "#FFFFFF",
    },
  },
  light: {
    id: "light",
    name: "Світла",
    isDark: false,
    colors: {
      bg: "#FFFFFF",
      header: "#FFFFFF",
      divider: "#E6EAEE",
      search: "#F0F2F5",
      accent: "#2481CC",
      text: "#0F1419",
      muted: "#7D8B99",
      danger: "#E53935",
      onAccent: "#FFFFFF",
    },
  },
  purple: {
    id: "purple",
    name: "Фіолетова",
    isDark: true,
    colors: {
      bg: "#1E1633",
      header: "#1E1633",
      divider: "#140E24",
      search: "#2D2347",
      accent: "#A855F7",
      text: "#FFFFFF",
      muted: "#8E82AD",
      danger: "#F0506E",
      onAccent: "#FFFFFF",
    },
  },
};

export const THEME_ORDER: ThemeId[] = ["telegram", "oled", "light", "purple"];
export const DEFAULT_THEME_ID: ThemeId = "telegram";

/** Telegram-палітра за замовчуванням (для екранів, які ще не перейшли на теми). */
export const TG: ThemeColors = THEMES.telegram.colors;

const AVATAR_COLORS = [
  "#E17076",
  "#FAA774",
  "#A695E7",
  "#7BC862",
  "#6EC9CB",
  "#65AADD",
  "#EE7AAE",
] as const;

/** Стабільний колір аватара за назвою. */
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Ініціали (до двох літер) з назви. */
export function initialsOf(name?: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = Array.from(parts[0])[0] ?? "";
  const second = parts.length > 1 ? (Array.from(parts[1])[0] ?? "") : "";
  return (first + second).toUpperCase();
}
