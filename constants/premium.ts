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
  {
    icon: "film-outline",
    title: "Анімований аватар",
    text: "Коротке відео до 10 с або GIF замість звичайного фото профілю.",
  },
  {
    icon: "happy-outline",
    title: "Емодзі-статус",
    text: "Один емодзі поруч з іменем — у чатах, профілі та списках.",
  },
  {
    icon: "albums-outline",
    title: "Історії без обмежень",
    text: "До 30 активних історій, відео до 60 с, час життя 6–48 год і список переглядів.",
  },
  {
    icon: "color-palette-outline",
    title: "Ексклюзивні теми",
    text: "Falcon, Starship, Mars, Starlink, Eclipse і Aurora та зоряний фон чату.",
  },
  {
    icon: "star",
    title: "Значок Premium",
    text: "Золота зірка біля імені — вас видно серед усіх.",
  },
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

export const PREMIUM_ADMIN_NOTE = "Преміум зараз видається адміністратором";
