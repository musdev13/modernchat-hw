import type { ThemeColors } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useMemo } from "react";

/** Додає прозорість до кольору #RRGGBB → rgba(). */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface ChatPalette extends ThemeColors {
  isDark: boolean;
  /** Фон екрана чату (шпалери). */
  wallpaper: string;
  /** Бульбашка співрозмовника. */
  incoming: string;
  incomingText: string;
  incomingMeta: string;
  /** Власна бульбашка (акцент теми). */
  outgoing: string;
  outgoingText: string;
  outgoingMeta: string;
  /** Поле введення всередині панелі. */
  field: string;
  /** Тло листів/модальних вікон. */
  sheet: string;
  overlay: string;
}

/** Палітра для екрана чату, виведена з активної теми (useTheme). */
export function useChatPalette(): ChatPalette {
  const { colors: c, theme } = useTheme();
  return useMemo<ChatPalette>(
    () => ({
      ...c,
      isDark: theme.isDark,
      wallpaper: c.divider,
      incoming: theme.isDark ? c.search : c.bg,
      incomingText: c.text,
      incomingMeta: c.muted,
      outgoing: c.accent,
      outgoingText: c.onAccent,
      outgoingMeta: withAlpha(c.onAccent, 0.72),
      field: c.search,
      sheet: theme.isDark ? c.header : c.bg,
      overlay: "rgba(0, 0, 0, 0.45)",
    }),
    [c, theme.isDark],
  );
}
