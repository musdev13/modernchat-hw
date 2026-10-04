/**
 * Ліміти та набори Modesto Premium. Єдине джерело правди: сервер перевіряє їх у своїх функціях,
 * клієнт (екран Premium, редактори) читає ці самі значення лише для підказок у UI.
 * Файл не імпортує нічого з Convex — безпечно імпортувати з застосунку.
 */
export const LIMITS = {
  free: {
    pinnedChats: 5,
    folders: 3,
    folderChats: 100,
    joinedChats: 500,
    favoriteGifs: 5,
    bio: 70,
    caption: 1024,
    message: 4096,
    fileMB: 100,
    reactionsPerMessage: 1,
    storyActive: 3,
    storyVideoSec: 15,
    storyCaption: 200,
    storyHighlights: 3,
    storyLifespansH: [24] as readonly number[],
    savedTags: 0,
  },
  premium: {
    pinnedChats: 10,
    folders: 15,
    folderChats: 200,
    joinedChats: 1000,
    favoriteGifs: 200,
    bio: 140,
    caption: 4096,
    message: 8192,
    fileMB: 2048,
    reactionsPerMessage: 3,
    storyActive: 30,
    storyVideoSec: 60,
    storyCaption: 2048,
    storyHighlights: 1000,
    storyLifespansH: [6, 12, 24, 48] as readonly number[],
    savedTags: 12,
  },
} as const;

export type LimitSet = typeof LIMITS.premium | typeof LIMITS.free;

/** Режим невидимки для історій: вікно та кількість запусків на добу. */
export const STEALTH_WINDOW_MS = 25 * 60 * 1000;
export const STEALTH_PER_DAY = 5;
/** При вмиканні невидимки скасовуються перегляди, зроблені за останні N хвилин. */
export const STEALTH_PAST_MS = 5 * 60 * 1000;
/** Безкоштовні користувачі зберігають архів історій стільки діб після завершення. */
export const ARCHIVE_FREE_DAYS = 7;

/** Швидкі реакції (всі). */
export const FREE_REACTIONS = ["❤️", "👍", "🔥", "😂", "😮", "😢", "👏", "🎉"] as const;
/** Додаткові («преміум») реакції. */
export const PREMIUM_REACTIONS = [
  "🤩", "🥰", "🤯", "🙏", "💯", "🫡", "🤝", "💔",
  "🦄", "🌚", "🍾", "🏆", "⚡", "🌈", "🥳", "😎",
] as const;

export function isPremiumReaction(emoji: string): boolean {
  return (PREMIUM_REACTIONS as readonly string[]).includes(emoji);
}
export function isKnownReaction(emoji: string): boolean {
  return isPremiumReaction(emoji) || (FREE_REACTIONS as readonly string[]).includes(emoji);
}

/** Кольори імені / цитат і шаблони фону профілю (Premium). */
export const PROFILE_COLORS = [
  "#E5484D", "#F76B15", "#F5C451", "#30A46C", "#12A594", "#0090FF", "#6E56CF", "#D6409F",
] as const;
export const PROFILE_PATTERNS = ["none", "stars", "dots", "waves", "hearts"] as const;
export type ProfilePattern = (typeof PROFILE_PATTERNS)[number];

/** Ефекти повідомлень (Premium). */
export const MESSAGE_EFFECTS = ["confetti", "fire", "hearts", "like"] as const;
export type MessageEffect = (typeof MESSAGE_EFFECTS)[number];

/** Реакції, доступні без Premium. */
export function isFreeReaction(emoji: string): boolean {
  return (FREE_REACTIONS as readonly string[]).includes(emoji);
}
