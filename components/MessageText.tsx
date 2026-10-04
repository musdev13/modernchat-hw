import type { SheetAction } from "@/components/ActionSheet";
import { PopoverMenu } from "@/components/PopoverMenu";
import { api } from "@/convex/_generated/api";
import { useChatPalette } from "@/hooks/useChatPalette";
import { copyText } from "@/utils/clipboard";
import { channelSlugOf, tokenize, userNameOf, type LinkKind } from "@/utils/linkify";
import { useConvex } from "convex/react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { memo, useCallback, useSyncExternalStore, type ReactNode } from "react";
import { Alert, Linking, Share, Text, type StyleProp, type TextStyle } from "react-native";

export interface LinkTarget {
  kind: LinkKind;
  text: string;
  href: string;
}

// ── Спільний стан меню посилання та «останнього дотику до посилання» ──
// Довге натискання на бульбашку відкриває меню повідомлення; якщо дотик почався на посиланні —
// натомість показуємо меню посилання (Відкрити / Копіювати / Поділитися).
let menuTarget: LinkTarget | null = null;
const listeners = new Set<() => void>();
let recent: { target: LinkTarget; at: number } | null = null;

function emit() {
  listeners.forEach((l) => l());
}

export function noteLinkTouch(target: LinkTarget) {
  recent = { target, at: Date.now() };
}

/** Посилання, якого торкнулись щойно (для довгого натискання на бульбашку); споживається один раз. */
export function takeRecentLinkTouch(): LinkTarget | null {
  if (recent && Date.now() - recent.at < 900) {
    const t = recent.target;
    recent = null;
    return t;
  }
  return null;
}

export function showLinkMenu(target: LinkTarget) {
  if (menuTarget?.href === target.href) return;
  menuTarget = target;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  emit();
}

function closeLinkMenu() {
  menuTarget = null;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Відкриття посилання: канал/профіль — всередині застосунку, решта — системою. */
export function useOpenLink() {
  const convex = useConvex();
  return useCallback(
    async (t: LinkTarget) => {
      try {
        if (t.kind === "app") {
          const slug = channelSlugOf(t.href);
          const uname = userNameOf(t.href);
          if (slug) router.push(`/c/${slug}` as never);
          else if (uname) router.push(`/u/${uname}` as never);
          else await Linking.openURL(t.href);
          return;
        }
        if (t.kind === "mention") {
          const user = await convex.query(api.users.findByUsername, { username: t.text });
          if (user) router.push(`/user/${user._id}` as never);
          else Alert.alert("Не знайдено", `Користувача ${t.text} не існує.`);
          return;
        }
        await Linking.openURL(t.href);
      } catch {
        Alert.alert("Не вдалося відкрити", t.text);
      }
    },
    [convex],
  );
}

/** Нижній лист меню посилання; монтується один раз на екрані чату. */
export function LinkMenuHost() {
  const target = useSyncExternalStore(subscribe, () => menuTarget);
  const open = useOpenLink();

  const actions: SheetAction[] = target
    ? [
        {
          key: "open",
          label: target.kind === "mention" ? "Відкрити профіль" : "Відкрити",
          icon: "open-outline",
          onPress: () => void open(target),
        },
        {
          key: "copy",
          label: "Копіювати",
          icon: "copy-outline",
          onPress: () => void copyText(target.kind === "url" || target.kind === "app" ? target.href : target.text),
        },
        {
          key: "share",
          label: "Поділитися",
          icon: "share-outline",
          onPress: () => void Share.share({ message: target.kind === "url" || target.kind === "app" ? target.href : target.text }).catch(() => {}),
        },
      ]
    : [];

  return (
    <PopoverMenu
      visible={!!target}
      onClose={closeLinkMenu}
      placement="center"
      title={target?.text}
      actions={actions}
    />
  );
}

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  isOwn: boolean;
  /** Додається всередині того ж <Text> (місце під час у правому нижньому куті). */
  children?: ReactNode;
}

/** Текст повідомлення з клікабельними посиланнями (як у Telegram). */
export const MessageText = memo(function MessageText({ text, style, isOwn, children }: Props) {
  const c = useChatPalette();
  const open = useOpenLink();
  const tokens = tokenize(text);

  // Своє повідомлення — на акцентному тлі, тож посилання світле й підкреслене.
  const linkStyle: TextStyle = isOwn
    ? { color: c.outgoingText, textDecorationLine: "underline", fontWeight: "600" }
    : { color: c.accent };

  return (
    <Text style={style}>
      {tokens.map((tok, i) => {
        if (!tok.kind || !tok.href) return tok.text;
        const target: LinkTarget = { kind: tok.kind, text: tok.text, href: tok.href };
        return (
          <Text
            key={i}
            style={linkStyle}
            suppressHighlighting={false}
            onPressIn={() => noteLinkTouch(target)}
            onPress={() => void open(target)}
            onLongPress={() => showLinkMenu(target)}
            accessibilityRole="link"
          >
            {tok.text}
          </Text>
        );
      })}
      {children}
    </Text>
  );
});
