/** Посилання на канал: modernchat://c/<slug> (схема застосунку, обробляється expo-router). */
export const channelLink = (slug: string) => `modernchat://c/${slug}`;

/** «1 підписник», «2 підписники», «5 підписників». */
export function subscribersLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} підписник`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} підписники`;
  return `${n} підписників`;
}

export const SLUG_PATTERN = /^[a-z0-9_]{4,32}$/;

/** Клієнтська перевірка посилання (серверна — api.channels.checkSlug). */
export function slugHint(raw: string): string | null {
  const slug = raw.trim().toLowerCase();
  if (slug.length === 0) return "Введіть посилання";
  if (slug.length < 4) return "Щонайменше 4 символи";
  if (slug.length > 32) return "Не більше 32 символів";
  if (!SLUG_PATTERN.test(slug)) return "Допустимі лише a–z, 0–9 та _";
  return null;
}
