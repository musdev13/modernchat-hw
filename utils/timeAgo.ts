/** «щойно», «5 хв тому», «3 год тому», «вчора». */
export function timeAgoUk(ms: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ms);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "щойно";
  if (min < 60) return `${min} хв тому`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} год тому`;
  const d = Math.floor(h / 24);
  return d === 1 ? "вчора" : `${d} дн. тому`;
}

/** Скільки лишилося: «12 год», «45 хв». */
export function timeLeftUk(ms: number, now: number = Date.now()): string {
  const diff = Math.max(0, ms - now);
  const min = Math.ceil(diff / 60_000);
  if (min < 60) return `${min} хв`;
  return `${Math.ceil(min / 60)} год`;
}
