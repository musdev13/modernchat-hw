import { ARCHIVE_FREE_DAYS, LIMITS, STEALTH_PER_DAY } from "@/convex/limits";
import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Золотий акцент Modesto Premium (не залежить від теми). */
export const PREMIUM_GOLD = "#F5C451";
export const PREMIUM_GOLD_SOFT = "#FFE29A";

export type PremiumFeature =
  | "general"
  | "theme"
  | "chatStars"
  | "avatar"
  | "emoji"
  | "stories"
  | "limits"
  | "files"
  | "profile"
  | "reactions"
  | "effects"
  | "translate"
  | "privacy"
  | "tags";

export interface PremiumPerk {
  icon: IconName;
  title: string;
  text: string;
}

export const PREMIUM_PERKS: PremiumPerk[] = [
  { icon: "albums-outline", title: "Історії без обмежень", text: "До 30 активних, відео до 60 с, час життя 6–48 год, довгі підписи." },
  { icon: "eye-off-outline", title: "Режим невидимки", text: "Дивіться історії, не залишаючи слідів у списку переглядів." },
  { icon: "archive-outline", title: "Архів і підбірки", text: "Архів історій без обмеження за часом і необмежені збережені підбірки." },
  { icon: "shield-checkmark-outline", title: "Захист вмісту", text: "Забороніть пересилання, збереження й поширення вашої історії." },
  { icon: "happy-outline", title: "Преміум-реакції", text: "Додаткові реакції та до 3 реакцій на одне повідомлення." },
  { icon: "sparkles-outline", title: "Ефекти повідомлень", text: "Конфеті, вогонь, серця й лайки на весь екран при надсиланні." },
  { icon: "language-outline", title: "Переклад", text: "Кнопка «Перекласти» під повідомленням — одним дотиком." },
  { icon: "color-fill-outline", title: "Кольори профілю", text: "Колір імені й цитат, обкладинка профілю та візерунок на ній." },
  { icon: "film-outline", title: "Анімований аватар", text: "Коротке відео до 10 с або GIF замість фото профілю." },
  { icon: "star", title: "Значок і емодзі-статус", text: "Золота зірка й емодзі-статус біля імені всюди в застосунку." },
  { icon: "color-palette-outline", title: "Ексклюзивні теми", text: "Теми з космосу та зоряний фон чату." },
  { icon: "pin-outline", title: "Підвищені ліміти", text: "10 закріплених чатів, 15 папок по 200 чатів, 200 улюблених GIF." },
  { icon: "cloud-upload-outline", title: "Файли до 2 ГБ", text: "Надсилайте великі файли замість стандартних 100 МБ." },
  { icon: "document-text-outline", title: "Довгі тексти", text: "Підписи до 4096, повідомлення до 8192 символів, опис профілю до 140." },
  { icon: "checkmark-done-outline", title: "Приватність", text: "Приховати час прочитання; писати вам можуть лише контакти." },
  { icon: "file-tray-stacked-outline", title: "Автоархів", text: "Нові чати від незнайомих автоматично потрапляють в архів." },
  { icon: "pricetag-outline", title: "Теги у «Збереженому»", text: "Позначайте збережені повідомлення емодзі й фільтруйте за ними." },
  { icon: "link-outline", title: "Великі перегляди посилань", text: "Ширша картка посилання з великим зображенням." },
];

export interface CompareRow {
  label: string;
  free: string;
  premium: string;
}

const mb = (n: number) => (n >= 1024 ? `${n / 1024} ГБ` : `${n} МБ`);
const hours = (a: readonly number[]) => a.map((h) => `${h}`).join("/") + " год";

/** Таблиця «безкоштовно / Premium»: числа беруться з тих самих LIMITS, що перевіряє сервер. */
export const PREMIUM_COMPARE: CompareRow[] = [
  { label: "Закріплені чати", free: `${LIMITS.free.pinnedChats}`, premium: `${LIMITS.premium.pinnedChats}` },
  { label: "Власні папки", free: `${LIMITS.free.folders}`, premium: `${LIMITS.premium.folders}` },
  { label: "Чатів у папці", free: `${LIMITS.free.folderChats}`, premium: `${LIMITS.premium.folderChats}` },
  { label: "Групи й канали", free: `${LIMITS.free.joinedChats}`, premium: `${LIMITS.premium.joinedChats}` },
  { label: "Улюблені GIF", free: `${LIMITS.free.favoriteGifs}`, premium: `${LIMITS.premium.favoriteGifs}` },
  { label: "Опис профілю", free: `${LIMITS.free.bio}`, premium: `${LIMITS.premium.bio}` },
  { label: "Підпис до медіа", free: `${LIMITS.free.caption}`, premium: `${LIMITS.premium.caption}` },
  { label: "Довжина повідомлення", free: `${LIMITS.free.message}`, premium: `${LIMITS.premium.message}` },
  { label: "Розмір файлу", free: mb(LIMITS.free.fileMB), premium: mb(LIMITS.premium.fileMB) },
  { label: "Реакцій на повідомлення", free: `${LIMITS.free.reactionsPerMessage}`, premium: `${LIMITS.premium.reactionsPerMessage}` },
  { label: "Активні історії", free: `${LIMITS.free.storyActive}`, premium: `${LIMITS.premium.storyActive}` },
  { label: "Відео в історії", free: `${LIMITS.free.storyVideoSec} с`, premium: `${LIMITS.premium.storyVideoSec} с` },
  { label: "Час життя історії", free: hours(LIMITS.free.storyLifespansH), premium: hours(LIMITS.premium.storyLifespansH) },
  { label: "Підпис до історії", free: `${LIMITS.free.storyCaption}`, premium: `${LIMITS.premium.storyCaption}` },
  { label: "Підбірки історій", free: `${LIMITS.free.storyHighlights}`, premium: "без ліміту" },
  { label: "Архів історій", free: `${ARCHIVE_FREE_DAYS} днів`, premium: "назавжди" },
  { label: "Режим невидимки", free: "—", premium: `${STEALTH_PER_DAY}/добу` },
  { label: "Захист вмісту історій", free: "—", premium: "✓" },
  { label: "Преміум-реакції", free: "—", premium: "✓" },
  { label: "Ефекти повідомлень", free: "—", premium: "✓" },
  { label: "Переклад повідомлень", free: "—", premium: "✓" },
  { label: "Кольори профілю", free: "—", premium: "✓" },
  { label: "Приховати прочитання", free: "—", premium: "✓" },
  { label: "Лише контакти пишуть мені", free: "—", premium: "✓" },
  { label: "Автоархів незнайомих", free: "—", premium: "✓" },
  { label: "Теги «Збереженого»", free: "—", premium: `до ${LIMITS.premium.savedTags}` },
  { label: "Анімований аватар", free: "—", premium: "✓" },
  { label: "Теми й зоряний фон", free: "—", premium: "✓" },
];

export const PREMIUM_REASONS: Record<PremiumFeature, string> = {
  general: "Відкрийте всі можливості Modesto.",
  theme: "Ця тема доступна лише з Modesto Premium.",
  chatStars: "Зоряний фон чату доступний лише з Modesto Premium.",
  avatar: "Анімований аватар доступний лише з Modesto Premium.",
  emoji: "Емодзі-статус доступний лише з Modesto Premium.",
  stories: "Розширені можливості історій доступні лише з Modesto Premium.",
  limits: "Підвищені ліміти доступні з Modesto Premium.",
  files: "Файли до 2 ГБ можна надсилати з Modesto Premium.",
  profile: "Кольори профілю доступні лише з Modesto Premium.",
  reactions: "Додаткові реакції та до 3 реакцій на повідомлення — з Modesto Premium.",
  effects: "Ефекти повідомлень доступні лише з Modesto Premium.",
  translate: "Переклад повідомлень доступний лише з Modesto Premium.",
  privacy: "Розширена приватність доступна лише з Modesto Premium.",
  tags: "Теги збережених повідомлень доступні лише з Modesto Premium.",
};

/** Ліміти історій (дзеркало серверних значень у convex/stories.ts (STORY_LIMITS)). */
export const STORY_LIMITS = {
  free: { active: 3, videoSec: 15, lifespansH: [24] as number[] },
  premium: { active: 30, videoSec: 60, lifespansH: [6, 12, 24, 48] as number[] },
};

export const PREMIUM_ADMIN_NOTE = "Преміум зараз видається адміністратором — напишіть йому, щоб отримати";
