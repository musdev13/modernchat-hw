import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery, query } from "./_generated/server";

// ── Попередній перегляд посилань (OpenGraph) ──
// Сторінку завантажує сервер (клієнт не ходить на сторонні сайти), результат кешується в таблиці
// linkPreviews за url. Захист: лише http(s) на порти 80/443, жодних localhost/приватних IP,
// ручне проходження редиректів із повторною перевіркою, таймаут і ліміт розміру відповіді.

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const MAX_URL_LENGTH = 2048;
const OK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAILED_TTL_MS = 60 * 60 * 1000;
const USER_AGENT = "Mozilla/5.0 (compatible; ModernChatBot/1.0; link-preview)";

/** Канонічний ключ кешу: без #фрагмента. */
function cacheKey(raw: string): string | null {
  try {
    const u = new URL(raw);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, метадані хмар
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast / reserved
  );
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) return true;
  if (host.endsWith(".home") || host.endsWith(".corp") || host.endsWith(".intranet")) return true;
  // IPv6 у URL записується в дужках.
  if (host.startsWith("[")) {
    const ip = host.slice(1, -1);
    if (ip === "::" || ip === "::1") return true;
    if (/^f[cd]/.test(ip) || /^fe[89ab]/.test(ip)) return true; // ULA, link-local
    const mapped = ip.match(/^::ffff:(.+)$/);
    if (mapped) return true; // IPv4-mapped — не пропускаємо взагалі
    return true; // решту IPv6-літералів теж не перевіряємо — безпечніше відмовити
  }
  if (/^[\d.]+$/.test(host)) {
    // URL нормалізує 2130706433 / 0x7f.1 до a.b.c.d; якщо лишилось інакше — відхиляємо.
    return !/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || isPrivateIPv4(host);
  }
  if (!host.includes(".")) return true; // односкладові імена — внутрішні
  return false;
}

/** Повертає безпечний URL або null. */
function safeUrl(raw: string): URL | null {
  if (raw.length > MAX_URL_LENGTH) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  if (isBlockedHost(u.hostname)) return null;
  return u;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const code = parseInt(n, 16);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function clean(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  const t = decodeEntities(s).replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Збирає <meta property|name=… content=…> у словник (перше значення виграє). */
function parseMeta(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const key = tag.match(/\b(?:property|name)\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const val = tag.match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const k = (key?.[1] ?? key?.[2])?.toLowerCase();
    const c = val?.[1] ?? val?.[2];
    if (k && c !== undefined && !map.has(k)) map.set(k, c);
  }
  return map;
}

type Preview = {
  siteName?: string;
  title?: string;
  description?: string;
  image?: string;
};

function extractPreview(html: string, finalUrl: URL): Preview {
  const head = html.slice(0, MAX_BYTES);
  const meta = parseMeta(head);
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const get = (...keys: string[]) => keys.map((k) => meta.get(k)).find((x) => !!x);

  let image: string | undefined;
  const rawImage = get("og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src");
  if (rawImage) {
    try {
      const imgUrl = new URL(decodeEntities(rawImage).trim(), finalUrl);
      if ((imgUrl.protocol === "https:" || imgUrl.protocol === "http:") && !isBlockedHost(imgUrl.hostname)) {
        image = imgUrl.toString().slice(0, MAX_URL_LENGTH);
      }
    } catch {
      // некоректне посилання на зображення — без картинки
    }
  }

  return {
    siteName: clean(get("og:site_name", "application-name"), 60) ?? finalUrl.hostname.replace(/^www\./, ""),
    title: clean(get("og:title", "twitter:title") ?? titleTag, 140),
    description: clean(get("og:description", "twitter:description", "description"), 300),
    image,
  };
}

/** Читає тіло не більше MAX_BYTES (потоково, якщо доступно). */
async function readLimited(res: Response): Promise<string> {
  const decoder = new TextDecoder("utf-8");
  const reader = res.body?.getReader();
  if (!reader) {
    return (await res.text()).slice(0, MAX_BYTES);
  }
  let received = 0;
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    received += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (received >= MAX_BYTES) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  return out;
}

async function fetchPreview(startUrl: URL): Promise<Preview | null> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,image/*;q=0.5,*/*;q=0.1",
          "Accept-Language": "uk,en;q=0.8",
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        let next: URL | null = null;
        try {
          next = safeUrl(new URL(loc, current).toString());
        } catch {
          next = null;
        }
        if (!next) return null; // редирект у заборонену адресу
        current = next;
        continue;
      }
      if (!res.ok) return null;

      const type = (res.headers.get("content-type") ?? "").toLowerCase();
      if (type.startsWith("image/")) {
        const name = decodeURIComponent(current.pathname.split("/").pop() ?? "") || current.hostname;
        return { siteName: current.hostname.replace(/^www\./, ""), title: clean(name, 140), image: current.toString() };
      }
      if (!type.includes("html") && !type.includes("xml")) return null;
      const len = Number(res.headers.get("content-length") ?? "0");
      if (len > 20 * 1024 * 1024) return null;

      const html = await readLimited(res);
      const preview = extractPreview(html, current);
      if (!preview.title && !preview.description && !preview.image) return null;
      return preview;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** Кешований результат (реактивний): null — ще не завантажували. */
export const getCached = query({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const key = cacheKey(args.url);
    if (!key) return null;
    const row = await ctx.db
      .query("linkPreviews")
      .withIndex("by_url", (q) => q.eq("url", key))
      .first();
    if (!row) return null;
    return {
      status: row.status,
      siteName: row.siteName,
      title: row.title,
      description: row.description,
      image: row.image,
      fetchedAt: row.fetchedAt,
    };
  },
});

export const getRow = internalQuery({
  args: { url: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query("linkPreviews")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .first(),
});

export const save = internalMutation({
  args: {
    url: v.string(),
    status: v.union(v.literal("ok"), v.literal("failed")),
    siteName: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("linkPreviews")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .first();
    const doc = { ...args, fetchedAt: Date.now() };
    if (existing) await ctx.db.replace(existing._id, doc);
    else await ctx.db.insert("linkPreviews", doc);
  },
});

/** Завантажує (або оновлює прострочений) прев'ю. Лише для авторизованих користувачів. */
export const fetchLinkPreview = action({
  args: { url: v.string() },
  handler: async (ctx, args): Promise<"ok" | "failed" | "cached"> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Потрібна авторизація");

    const key = cacheKey(args.url);
    const target = key ? safeUrl(key) : null;
    if (!key || !target) return "failed";

    const row = await ctx.runQuery(internal.linkPreview.getRow, { url: key });
    if (row) {
      const age = Date.now() - row.fetchedAt;
      if (age < (row.status === "ok" ? OK_TTL_MS : FAILED_TTL_MS)) return "cached";
    }

    const preview = await fetchPreview(target);
    if (!preview) {
      await ctx.runMutation(internal.linkPreview.save, { url: key, status: "failed" });
      return "failed";
    }
    await ctx.runMutation(internal.linkPreview.save, { url: key, status: "ok", ...preview });
    return "ok";
  },
});
