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

export type ThemeId =
  | "telegram"
  | "oled"
  | "light"
  | "purple"
  | "falcon"
  | "starship"
  | "mars"
  | "starlink"
  | "eclipse"
  | "aurora";

/** Додаткові токени оформлення (скло, світіння, тонкі лінії, зорі). */
export interface ThemeExtras {
  /** Колір світіння (корона, туманність) — використовується в м'яких градієнтах. */
  glow: string;
  /** Колір зірок у фоні чату. */
  star: string;
  /** Тонка «технічна» лінія/обведення карток. */
  line: string;
  /** Преміальна тема: показує світіння й тонкі лінії. */
  premium: boolean;
  /** Короткий опис для вибору теми. */
  tagline: string;
}

export interface AppTheme {
  id: ThemeId;
  name: string;
  isDark: boolean;
  colors: ThemeColors;
  extras: ThemeExtras;
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
    extras: { glow: "#2AABEE", star: "#FFFFFF", line: "#242F3D", premium: false, tagline: "Класична синя" },
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
    extras: { glow: "#3AA0FF", star: "#FFFFFF", line: "#1C1C1E", premium: false, tagline: "Чистий чорний для OLED" },
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
    extras: { glow: "#2481CC", star: "#9BB4C8", line: "#E6EAEE", premium: false, tagline: "Світла та легка" },
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
    extras: { glow: "#A855F7", star: "#E9D5FF", line: "#2D2347", premium: false, tagline: "Фіолетові сутінки" },
  },
  falcon: {
    id: "falcon",
    name: "Falcon",
    isDark: true,
    colors: {
      bg: "#0B0B0C",
      header: "#0B0B0C",
      divider: "#050505",
      search: "#1A1A1D",
      accent: "#FFFFFF",
      text: "#F5F5F5",
      muted: "#8A8A91",
      danger: "#FF4D4D",
      onAccent: "#0B0B0C",
    },
    extras: { glow: "#FFFFFF", star: "#FFFFFF", line: "#2B2B30", premium: true, tagline: "Вуглецевий чорний, білі акценти" },
  },
  starship: {
    id: "starship",
    name: "Starship",
    isDark: true,
    colors: {
      bg: "#1B1F24",
      header: "#1B1F24",
      divider: "#11141A",
      search: "#29303A",
      accent: "#9FB9D3",
      text: "#E8EDF2",
      muted: "#7F8C9A",
      danger: "#FF6B6B",
      onAccent: "#0D1218",
    },
    extras: { glow: "#B8D0E8", star: "#DCE8F4", line: "#3A434F", premium: true, tagline: "Шліфована сталь, срібно-блакитний" },
  },
  mars: {
    id: "mars",
    name: "Mars",
    isDark: true,
    colors: {
      bg: "#2A110C",
      header: "#2A110C",
      divider: "#1A0805",
      search: "#3D1A12",
      accent: "#FF6A3D",
      text: "#FFEDE5",
      muted: "#B5857A",
      danger: "#FF4D5E",
      onAccent: "#FFFFFF",
    },
    extras: { glow: "#FF7A45", star: "#FFD3BC", line: "#5E2B1E", premium: true, tagline: "Іржаво-червоні дюни" },
  },
  starlink: {
    id: "starlink",
    name: "Starlink",
    isDark: true,
    colors: {
      bg: "#05080D",
      header: "#05080D",
      divider: "#020409",
      search: "#101823",
      accent: "#19D3FF",
      text: "#EAF6FF",
      muted: "#6F8599",
      danger: "#FF5C7A",
      onAccent: "#001219",
    },
    extras: { glow: "#19D3FF", star: "#C4F1FF", line: "#17324A", premium: true, tagline: "Майже чорний, електричний ціан" },
  },
  eclipse: {
    id: "eclipse",
    name: "Eclipse",
    isDark: true,
    colors: {
      bg: "#060504",
      header: "#060504",
      divider: "#000000",
      search: "#18130B",
      accent: "#FFB020",
      text: "#FFF4E0",
      muted: "#9C8C70",
      danger: "#FF5A4A",
      onAccent: "#1A1000",
    },
    extras: { glow: "#FFB020", star: "#FFE3AD", line: "#3B2B10", premium: true, tagline: "Чорний диск і бурштинова корона" },
  },
  aurora: {
    id: "aurora",
    name: "Aurora",
    isDark: true,
    colors: {
      bg: "#0A1E22",
      header: "#0A1E22",
      divider: "#061316",
      search: "#12323A",
      accent: "#3EE6B4",
      text: "#E8FFF8",
      muted: "#6FA39A",
      danger: "#FF6B8A",
      onAccent: "#03201A",
    },
    extras: { glow: "#8B5CF6", star: "#CCFFF1", line: "#1F4C50", premium: true, tagline: "Зелено-бірюзове сяйво з фіолетом" },
  },
};

/** Тема доступна лише з Modesto Premium. */
export function isPremiumTheme(id: ThemeId): boolean {
  return THEMES[id].extras.premium;
}

export const THEME_ORDER: ThemeId[] = [
  "falcon",
  "starship",
  "mars",
  "starlink",
  "eclipse",
  "aurora",
  "telegram",
  "oled",
  "light",
  "purple",
];
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
