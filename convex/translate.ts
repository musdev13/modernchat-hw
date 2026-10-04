import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalMutation, mutation } from "./_generated/server";
import { limitError, premiumFlagOn, premiumOnlyError } from "./limitHelpers";
import { assertRoomMember } from "./messages";
import { getAuthUser } from "./users";

/** Мови перекладу (код MyMemory / ISO). */
export const TRANSLATE_LANGS = ["uk", "en", "ru", "pl", "de", "fr", "es", "it", "pt", "tr"] as const;
/** Ліміти (на користувача): запитів на добу та довжина тексту. */
export const TRANSLATE_PER_DAY = 100;
export const TRANSLATE_MAX_CHARS = 2000;
const CHUNK = 450;

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Крок 1 (мутація): перевіряє Premium, членство в кімнаті, добовий ліміт і кеш.
 * Повертає або готовий переклад (cached), або текст, який треба перекласти.
 */
export const prepare = mutation({
  args: { messageId: v.id("messages"), lang: v.string() },
  handler: async (ctx, args) => {
    const me = await getAuthUser(ctx);
    if (!me) throw new Error("Unauthorized: Потрібна авторизація");
    if (!premiumFlagOn(me, true)) throw premiumOnlyError("Переклад повідомлень доступний лише з Modesto Premium.");
    if (!(TRANSLATE_LANGS as readonly string[]).includes(args.lang)) throw new Error("Непідтримувана мова");
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Повідомлення не знайдено");
    await assertRoomMember(ctx, message.chatRoomId, me._id);
    const source = (message.content ?? "").trim();
    if (!source) throw new Error("У цьому повідомленні немає тексту для перекладу");
    if (source.length > TRANSLATE_MAX_CHARS) {
      throw new Error(`Текст задовгий для перекладу (до ${TRANSLATE_MAX_CHARS} символів)`);
    }

    const cached = await ctx.db
      .query("translations")
      .withIndex("by_message_lang", (q) => q.eq("messageId", args.messageId).eq("lang", args.lang))
      .first();
    if (cached && cached.source === source) return { cached: cached.text, source };

    const day = today();
    const usage = await ctx.db
      .query("translationUsage")
      .withIndex("by_user_and_day", (q) => q.eq("userId", me._id).eq("day", day))
      .first();
    if ((usage?.count ?? 0) >= TRANSLATE_PER_DAY) {
      throw limitError(`Досягнуто добового ліміту перекладів (${TRANSLATE_PER_DAY}). Спробуйте завтра.`);
    }
    if (usage) await ctx.db.patch(usage._id, { count: usage.count + 1 });
    else await ctx.db.insert("translationUsage", { userId: me._id, day, count: 1 });
    return { cached: null, source };
  },
});

export const saveResult = internalMutation({
  args: { messageId: v.id("messages"), lang: v.string(), source: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    const old = await ctx.db
      .query("translations")
      .withIndex("by_message_lang", (q) => q.eq("messageId", args.messageId).eq("lang", args.lang))
      .first();
    if (old) await ctx.db.patch(old._id, { source: args.source, text: args.text });
    else await ctx.db.insert("translations", args);
  },
});

function chunks(text: string): string[] {
  if (text.length <= CHUNK) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > CHUNK) {
    let cut = Math.max(rest.lastIndexOf(". ", CHUNK), rest.lastIndexOf("\n", CHUNK), rest.lastIndexOf(" ", CHUNK));
    if (cut < CHUNK / 3) cut = CHUNK;
    parts.push(rest.slice(0, cut + 1));
    rest = rest.slice(cut + 1);
  }
  if (rest.trim()) parts.push(rest);
  return parts;
}

/**
 * Переклад повідомлення. Використовує безкоштовний публічний API MyMemory (без ключа, автовизначення
 * мови). Це не гарантований сервіс: у нього є добова квота на IP, тому при збої повертаємо зрозумілу
 * помилку, а успішні переклади кешуємо в таблиці translations.
 */
export const translateMessage = action({
  args: { messageId: v.id("messages"), lang: v.string() },
  handler: async (ctx, args): Promise<{ text: string; cached: boolean }> => {
    const prep: { cached: string | null; source: string } = await ctx.runMutation(api.translate.prepare, args);
    if (prep.cached !== null) return { text: prep.cached, cached: true };

    const out: string[] = [];
    for (const part of chunks(prep.source)) {
      let res: Response;
      try {
        res = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(part)}&langpair=${encodeURIComponent("Autodetect|" + args.lang)}`,
        );
      } catch {
        throw new ConvexError({ code: "TRANSLATE", message: "Сервіс перекладу недоступний. Спробуйте пізніше." });
      }
      if (!res.ok) {
        throw new ConvexError({ code: "TRANSLATE", message: "Сервіс перекладу тимчасово недоступний." });
      }
      const json = (await res.json()) as {
        responseData?: { translatedText?: string };
        quotaFinished?: boolean;
        responseStatus?: number | string;
      };
      if (json.quotaFinished || Number(json.responseStatus) === 429) {
        throw new ConvexError({ code: "TRANSLATE", message: "Безкоштовну квоту сервісу перекладу на сьогодні вичерпано." });
      }
      const text = json.responseData?.translatedText;
      if (!text || Number(json.responseStatus) >= 400) {
        throw new ConvexError({ code: "TRANSLATE", message: "Не вдалося перекласти це повідомлення." });
      }
      out.push(text);
    }
    const text = out.join("").trim();
    await ctx.runMutation(internal.translate.saveResult, {
      messageId: args.messageId,
      lang: args.lang,
      source: prep.source,
      text,
    });
    return { text, cached: false };
  },
});
