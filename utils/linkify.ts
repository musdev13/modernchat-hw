/** Розбір тексту повідомлення на звичайні фрагменти й посилання (URL, e-mail, телефон, @згадки, modesto://). */

export type LinkKind = "url" | "app" | "email" | "phone" | "mention";

export interface TextToken {
  text: string;
  /** Є лише в посилань. */
  kind?: LinkKind;
  href?: string;
}

const TLDS =
  "com|org|net|io|ua|me|app|dev|co|ru|info|biz|tv|gg|ly|to|xyz|online|site|tech|ai|eu|de|uk|fr|pl|by|kz|cc|fm|sh|us|ca|edu|gov|gl|be|it|es|nl|cz|su|pro|store|shop|blog|cloud|link|live|news|page|space|top|wiki|team|chat|media|studio|ink|vip|gd|im|is|so|ws|ch|se|no|fi|at|jp|cn|in|br";

const TAIL = String.raw`[^\s<>"«»]*`;
const SCHEME = String.raw`(?:https?:\/\/|(?:modesto|modernchat):\/\/)[^\s<>"«»]+`;
const EMAIL = String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}`;
const WWW = String.raw`www\.[^\s<>"«»]+`;
const BARE = String.raw`(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:${TLDS})(?![a-z0-9-])(?::\d{2,5})?(?:[/?#]${TAIL})?`;
const PHONE = String.raw`\+\d[\d\s().-]{6,16}\d`;
const MENTION = String.raw`@[A-Za-z0-9_]{3,32}`;

const SOURCE = [SCHEME, EMAIL, WWW, BARE, PHONE, MENTION].join("|");

/** Розділові знаки наприкінці, які не належать посиланню. */
function trimTrail(raw: string): string {
  let s = raw;
  for (;;) {
    const last = s[s.length - 1];
    if (!last) return s;
    if (".,!?;:'\"»…".includes(last)) {
      s = s.slice(0, -1);
      continue;
    }
    if (last === ")" && (s.match(/\(/g)?.length ?? 0) < (s.match(/\)/g)?.length ?? 0)) {
      s = s.slice(0, -1);
      continue;
    }
    if (last === "]" && (s.match(/\[/g)?.length ?? 0) < (s.match(/\]/g)?.length ?? 0)) {
      s = s.slice(0, -1);
      continue;
    }
    if (last === "}") {
      s = s.slice(0, -1);
      continue;
    }
    return s;
  }
}

function classify(text: string): { kind: LinkKind; href: string } | null {
  if (/^(?:modesto|modernchat):\/\//i.test(text)) return { kind: "app", href: text };
  if (/^https?:\/\//i.test(text)) return { kind: "url", href: text };
  if (text.startsWith("@")) return { kind: "mention", href: text };
  if (text.startsWith("+")) {
    const digits = text.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? { kind: "phone", href: `tel:+${digits}` } : null;
  }
  if (text.includes("@")) return { kind: "email", href: `mailto:${text}` };
  return { kind: "url", href: `https://${text}` };
}

const cache = new Map<string, TextToken[]>();
const CACHE_MAX = 400;

/** Розбиває текст на токени (результат кешується за рядком). */
export function tokenize(text: string): TextToken[] {
  const hit = cache.get(text);
  if (hit) return hit;

  const tokens: TextToken[] = [];
  const push = (t: string, link?: { kind: LinkKind; href: string }) => {
    if (!t) return;
    const last = tokens[tokens.length - 1];
    if (!link && last && !last.kind) {
      last.text += t;
      return;
    }
    tokens.push(link ? { text: t, kind: link.kind, href: link.href } : { text: t });
  };

  const re = new RegExp(SOURCE, "gi");
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let match = m[0];
    const start = m.index;
    // Межа слова: «foo.bar.com» усередині слова/шляху не чіпаємо.
    const prev = start > 0 ? text[start - 1] : "";
    const startsWithScheme = /^(?:https?|modesto|modernchat):\/\//i.test(match);
    const isEmail = !startsWithScheme && /^[A-Za-z0-9._%+-]+@/.test(match);
    if (!startsWithScheme && !isEmail && prev && /[\w@/.:%+-]/.test(prev)) {
      re.lastIndex = start + 1;
      continue;
    }
    const isUrlLike = startsWithScheme || /^www\./i.test(match) || (!isEmail && !match.startsWith("@") && !match.startsWith("+"));
    if (isUrlLike) match = trimTrail(match);
    const link = match ? classify(match) : null;
    if (!link) {
      re.lastIndex = start + 1;
      continue;
    }
    push(text.slice(pos, start));
    push(match, link);
    pos = start + match.length;
    re.lastIndex = pos;
  }
  push(text.slice(pos));

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(text, tokens);
  return tokens;
}

/** Перше веб-посилання тексту (для картки попереднього перегляду) або null. */
export function firstPreviewUrl(text: string | undefined): string | null {
  if (!text || text.length < 4) return null;
  for (const t of tokenize(text)) {
    if (t.kind === "url" && t.href) return t.href;
  }
  return null;
}

/** Slug каналу з modesto://c/<slug>. */
export function channelSlugOf(href: string): string | null {
  const m = href.match(/^(?:modesto|modernchat):\/\/c\/([A-Za-z0-9_]+)/i);
  return m ? m[1].toLowerCase() : null;
}

/** Нік з modesto://u/<username>. */
export function userNameOf(href: string): string | null {
  const m = href.match(/^(?:modesto|modernchat):\/\/u\/([A-Za-z0-9_]+)/i);
  return m ? m[1] : null;
}

/** Id історії з modesto://s/<id>. */
export function storyIdOf(href: string): string | null {
  const m = href.match(/^(?:modesto|modernchat):\/\/s\/([A-Za-z0-9]+)/i);
  return m ? m[1] : null;
}
