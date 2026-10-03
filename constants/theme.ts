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

/** Telegram-подібна темна палітра (використовується на списку чатів). */
export const TG = {
  bg: "#17212B",
  header: "#17212B",
  divider: "#0E1621",
  search: "#242F3D",
  accent: "#2AABEE",
  text: "#FFFFFF",
  muted: "#708499",
  danger: "#E53935",
} as const;

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
