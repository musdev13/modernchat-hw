/** Код і текст помилки, яку сервер кинув через ConvexError({ code, message }). */
export function convexErrorData(e: unknown): { code?: string; message?: string } | null {
  if (e && typeof e === "object" && "data" in e) {
    const data = (e as { data: unknown }).data;
    if (data && typeof data === "object") return data as { code?: string; message?: string };
    if (typeof data === "string") return { message: data };
  }
  return null;
}

/** Дістає людський текст помилки з відповіді Convex («Uncaught Error: …» або ConvexError). */
export function convexErrorText(e: unknown, fallback = "Щось пішло не так. Спробуйте ще раз."): string {
  const data = convexErrorData(e);
  if (data?.message) return data.message;
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (!raw) return fallback;
  const m = raw.match(/Uncaught Error:\s*(.+?)(?:\n|\s+at\s|$)/);
  const text = (m ? m[1] : raw.replace(/\[CONVEX[^\]]*\]\s*/g, "").replace(/\[Request ID:[^\]]*\]\s*/g, "")).trim();
  return text || fallback;
}

/** Сервер відхилив дію через ліміт безкоштовного тарифу (ConvexError з code === "LIMIT"). */
export function isLimitError(e: unknown): boolean {
  const code = convexErrorData(e)?.code;
  return code === "LIMIT" || code === "PREMIUM";
}
