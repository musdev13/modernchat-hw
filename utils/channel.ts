/** Посилання на канал: modesto://c/<slug> (схема застосунку, обробляється expo-router). */
export const channelLink = (slug: string) => `modesto://c/${slug}`;

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

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ye", ж: "zh", з: "z",
  и: "y", і: "i", ї: "yi", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ю: "yu", я: "ya", ы: "y", э: "e", ё: "yo", ь: "", ъ: "", "'": "", "ʼ": "", "’": "",
};

/** Пропозиція посилання з назви каналу: транслітерація → a-z0-9_ (4–32 символи). */
export function suggestSlug(title: string): string {
  let out = "";
  for (const ch of title.trim().toLowerCase()) {
    if (/[a-z0-9]/.test(ch)) out += ch;
    else if (TRANSLIT[ch] !== undefined) out += TRANSLIT[ch];
    else if (/\s|[-_.]/.test(ch) && !out.endsWith("_")) out += "_";
  }
  out = out.replace(/^_+|_+$/g, "").slice(0, 28);
  while (out.length < 4) out += Math.floor(Math.random() * 10);
  return out;
}
