import { Group, NavRow, SettingsPage, CheckRow } from "@/components/SettingsUI";
import { usePremiumUi } from "@/context/PremiumContext";
import { api } from "@/convex/_generated/api";
import { usePremium } from "@/hooks/usePremium";
import { convexErrorText } from "@/utils/convexError";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Alert } from "react-native";

type Audience = "all" | "contacts" | "close" | "selected" | "except";

/** Налаштування → Конфіденційність → Історії: хто бачить, близькі друзі, приховані, невидимка. */
export default function StoryPrivacyScreen() {
  const router = useRouter();
  const premium = usePremium();
  const { openUpsell } = usePremiumUi();
  const settings = useQuery(api.stories.privacySettings);
  const setDefault = useMutation(api.stories.setDefaultPrivacy);
  const hideUser = useMutation(api.stories.hideUser);
  const startStealth = useMutation(api.stories.startStealth);
  const stopStealth = useMutation(api.stories.stopStealth);

  const pick = (audience: Audience) => {
    setDefault({ audience }).catch((e) => Alert.alert("Помилка", convexErrorText(e)));
  };
  const go = (path: string) => router.push(path as never);
  const count = (n: number | undefined) => (n ? String(n) : "—");
  const stealthActive = !!settings?.stealthActiveUntil && settings.stealthActiveUntil > Date.now();

  return (
    <SettingsPage title="Історії">
      <Group
        title="Хто бачить мої історії"
        footer="Це значення за замовчуванням — для кожної історії його можна змінити під час публікації. Приватність перевіряється на сервері."
      >
        <CheckRow icon="earth" tint="#10B981" label="Усі" selected={settings?.audience === "all"} onPress={() => pick("all")} first />
        <CheckRow icon="people" tint="#3B82F6" label="Контакти" sub="Люди, з якими у вас є особистий чат" selected={settings?.audience === "contacts"} onPress={() => pick("contacts")} />
        <CheckRow icon="star" tint="#22C55E" label="Близькі друзі" trailing={count(settings?.closeFriendIds.length)} selected={settings?.audience === "close"} onPress={() => pick("close")} />
        <CheckRow icon="person-add" tint="#F59E0B" label="Вибрані користувачі" trailing={count(settings?.selectedIds.length)} selected={settings?.audience === "selected"} onPress={() => pick("selected")} />
        <CheckRow icon="person-remove" tint="#EF4444" label="Усі, крім…" trailing={count(settings?.exceptIds.length)} selected={settings?.audience === "except"} onPress={() => pick("except")} />
      </Group>

      <Group title="Списки" footer="Близькі друзі бачать історії для «Близьких друзів» із зеленим кільцем.">
        <NavRow icon="star" tint="#22C55E" label="Близькі друзі" value={count(settings?.closeFriendIds.length)} onPress={() => go("/(app)/prefs/story-users?list=close")} first />
        <NavRow icon="person-add" tint="#F59E0B" label="Вибрані користувачі" value={count(settings?.selectedIds.length)} onPress={() => go("/(app)/prefs/story-users?list=selected")} />
        <NavRow icon="person-remove" tint="#EF4444" label="Усі, крім…" value={count(settings?.exceptIds.length)} onPress={() => go("/(app)/prefs/story-users?list=except")} />
      </Group>

      <Group
        title="Режим невидимки"
        footer={
          premium.isPremium
            ? `Протягом 25 хвилин ваші перегляди чужих історій не записуються (а перегляди за останні 5 хв скасовуються). Залишилось запусків сьогодні: ${settings?.stealthLeftToday ?? 0}.`
            : "Переглядайте чужі історії непомітно. Доступно з Modesto Premium."
        }
      >
        <NavRow
          icon="eye-off"
          tint="#8B5CF6"
          label={stealthActive ? "Невидимка активна" : "Увімкнути на 25 хвилин"}
          value={stealthActive ? "Вимкнути" : premium.isPremium ? "" : "Premium"}
          first
          onPress={() => {
            if (!premium.isPremium) {
              openUpsell("stories", "Режим невидимки доступний лише з Modesto Premium.");
              return;
            }
            const run = stealthActive ? stopStealth({}) : startStealth({});
            run.catch((e) => Alert.alert("Не вдалося", convexErrorText(e)));
          }}
        />
      </Group>

      <Group title="Приховані історії" footer="Історії цих людей не показуються в рядку над списком чатів. Також їх можна приховати довгим натисканням на кільце.">
        {(settings?.hidden ?? []).length === 0 ? (
          <NavRow label="Немає прихованих" first chevron={false} />
        ) : (
          (settings?.hidden ?? []).map((h, i) => (
            <NavRow
              key={h.userId}
              label={h.name}
              value="Показувати"
              first={i === 0}
              onPress={() => hideUser({ userId: h.userId, hidden: false }).catch((e) => Alert.alert("Помилка", convexErrorText(e)))}
            />
          ))
        )}
      </Group>

      <Group title="Архів і підбірки">
        <NavRow icon="archive" tint="#06B6D4" label="Архів історій" onPress={() => go("/(app)/prefs/stories-archive")} first />
      </Group>
    </SettingsPage>
  );
}
