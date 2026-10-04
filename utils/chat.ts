const MONTHS_GENITIVE = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];

/** Ключ календарного дня (локальний часовий пояс). */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** «Сьогодні» / «Вчора» / «4 жовтня» / «4 жовтня 2025». */
export function dayLabel(ts: number, now: number = Date.now()): string {
  if (dayKey(ts) === dayKey(now)) return "Сьогодні";
  if (dayKey(ts) === dayKey(now - 24 * 60 * 60 * 1000)) return "Вчора";
  const d = new Date(ts);
  const base = `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
  return d.getFullYear() === new Date(now).getFullYear()
    ? base
    : `${base} ${d.getFullYear()}`;
}

/** Час у форматі ГГ:ХХ. */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** «1 учасник», «3 учасники», «5 учасників». */
export function membersLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} учасник`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} учасники`;
  }
  return `${n} учасників`;
}

const ZWJ = 0x200d;
const VS16 = 0xfe0f;

function isModifier(cp: number): boolean {
  return cp === VS16 || cp === ZWJ || (cp >= 0x1f3fb && cp <= 0x1f3ff);
}

function isEmojiCodePoint(cp: number): boolean {
  return (
    (cp >= 0x1f000 && cp <= 0x1faff) ||
    (cp >= 0x2190 && cp <= 0x21ff) ||
    (cp >= 0x2300 && cp <= 0x23ff) ||
    (cp >= 0x2600 && cp <= 0x27bf) ||
    (cp >= 0x2b00 && cp <= 0x2bff) ||
    cp === 0x203c ||
    cp === 0x2049 ||
    cp === 0x2122 ||
    cp === 0x2139 ||
    cp === 0x3030 ||
    cp === 0x303d ||
    cp === 0x3297 ||
    cp === 0x3299
  );
}

/** Кількість емодзі, якщо рядок складається ЛИШЕ з них (інакше 0). */
export function emojiOnlyCount(text: string): number {
  const cps = Array.from(text.trim()).map((ch) => ch.codePointAt(0) ?? 0);
  if (cps.length === 0) return 0;

  let count = 0;
  let afterJoiner = false;
  let prevRegional = false;

  for (const cp of cps) {
    if (cp === 0x20 || cp === 0xa0) {
      afterJoiner = false;
      prevRegional = false;
      continue;
    }
    if (cp === ZWJ) {
      afterJoiner = true;
      continue;
    }
    if (isModifier(cp)) continue;
    if (!isEmojiCodePoint(cp)) return 0;

    const regional = cp >= 0x1f1e6 && cp <= 0x1f1ff;
    if (regional) {
      // Два регіональні символи = один прапор.
      if (prevRegional) {
        prevRegional = false;
        continue;
      }
      prevRegional = true;
      count++;
      afterJoiner = false;
      continue;
    }
    prevRegional = false;
    if (afterJoiner) {
      afterJoiner = false;
      continue;
    }
    count++;
  }
  return count;
}

/** Видаляє останній «символ» (разом з ZWJ/VS16/модифікаторами) перед курсором. */
export function deleteLastGrapheme(prefix: string): string {
  const chars = Array.from(prefix);
  const lastCp = () => chars[chars.length - 1]?.codePointAt(0) ?? -1;

  const popModifiers = () => {
    while (chars.length > 0 && isModifier(lastCp()) && lastCp() !== ZWJ) {
      chars.pop();
    }
  };

  popModifiers();
  if (chars.length > 0) chars.pop();

  // ZWJ-послідовності (👨‍👩‍👧) знімаємо цілком.
  while (chars.length > 0 && lastCp() === ZWJ) {
    chars.pop();
    popModifiers();
    if (chars.length > 0) chars.pop();
  }
  return chars.join("");
}

/**
 * Giphy-наліпки надсилаються як звичайні повідомлення-зображення; щоб відрізнити їх від GIF без змін на бекенді,
 * підпис (caption) починається з невидимого маркера.
 */
export const STICKER_MARK = "\u2063\u2063";
export const STICKER_LABEL = "Наліпка";
export const STICKER_CAPTION = STICKER_MARK + STICKER_LABEL;

export function isStickerContent(content?: string | null): boolean {
  return !!content && content.startsWith(STICKER_MARK);
}


const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Статус користувача як у Telegram: «в мережі», «був(ла) щойно», «був(ла) 5 хв. тому»,
 * «був(ла) сьогодні о 14:05», «був(ла) вчора о 14:05», «був(ла) 03.09.26», «давно не заходив(ла)».
 * hidden — користувач приховав час входу: «був(ла) нещодавно».
 */
export function formatLastSeen(
  lastSeenAt?: number | null,
  online?: boolean,
  hidden?: boolean,
  now: number = Date.now(),
): string {
  if (online) return "в мережі";
  if (hidden) return "був(ла) нещодавно";
  if (!lastSeenAt) return "давно не заходив(ла)";
  const diff = now - lastSeenAt;
  if (diff < 60 * 1000) return "був(ла) щойно";
  if (diff < 60 * 60 * 1000) return `був(ла) ${Math.floor(diff / 60000)} хв. тому`;
  const key = dayKey(lastSeenAt);
  if (key === dayKey(now)) return `був(ла) сьогодні о ${formatTime(lastSeenAt)}`;
  if (key === dayKey(now - 24 * 60 * 60 * 1000)) {
    return `був(ла) вчора о ${formatTime(lastSeenAt)}`;
  }
  if (diff > MONTH_MS) return "давно не заходив(ла)";
  const d = new Date(lastSeenAt);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `був(ла) ${dd}.${mm}.${yy}`;
}
