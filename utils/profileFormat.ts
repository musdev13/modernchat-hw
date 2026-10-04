/** Форматування даних профілю (день народження, вік). */

const MONTHS_SHORT = ["січ.", "лют.", "бер.", "квіт.", "трав.", "черв.", "лип.", "серп.", "вер.", "жовт.", "лист.", "груд."];

export function parseBirthday(iso?: string | null): { y: number; m: number; d: number } | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function ageOf(iso?: string | null, now: Date = new Date()): number | null {
  const b = parseBirthday(iso);
  if (!b) return null;
  let age = now.getFullYear() - b.y;
  const had = now.getMonth() + 1 > b.m || (now.getMonth() + 1 === b.m && now.getDate() >= b.d);
  if (!had) age -= 1;
  return age >= 0 ? age : null;
}

/** 1 рік, 2–4 роки, 5+ років (11–14 — років, 21 — рік). */
export function yearsLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} рік`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} роки`;
  return `${n} років`;
}

export function isBirthdayToday(iso?: string | null, now: Date = new Date()): boolean {
  const b = parseBirthday(iso);
  return !!b && b.m === now.getMonth() + 1 && b.d === now.getDate();
}

/** «16 бер. 2009 (17 років)»; у день народження додається 🎂. */
export function formatBirthday(iso?: string | null): string | undefined {
  const b = parseBirthday(iso);
  if (!b) return undefined;
  const age = ageOf(iso);
  const base = `${b.d} ${MONTHS_SHORT[b.m - 1]} ${b.y}`;
  const tail = age !== null ? ` (${yearsLabel(age)})` : "";
  return `${base}${tail}${isBirthdayToday(iso) ? " 🎂" : ""}`;
}

/** Посилання на профіль за ніком: modesto://u/<username>. */
export const userLink = (username: string) => `modesto://u/${username}`;
