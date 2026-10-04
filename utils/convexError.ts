/** Дістає людський текст помилки з відповіді Convex («Uncaught Error: …»). */
export function convexErrorText(e: unknown, fallback = "Щось пішло не так. Спробуйте ще раз."): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (!raw) return fallback;
  const m = raw.match(/Uncaught Error:\s*(.+?)(?:\n|\s+at\s|$)/);
  const text = (m ? m[1] : raw.replace(/\[CONVEX[^\]]*\]\s*/g, "").replace(/\[Request ID:[^\]]*\]\s*/g, "")).trim();
  return text || fallback;
}
