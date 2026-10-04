import { CheckRow, Group, NavRow, SettingsPage, SwitchRow } from "@/components/SettingsUI";
import { useSettings } from "@/context/SettingsContext";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";

export default function PrivacySettings() {
  const router = useRouter();
  const me = useQuery(api.users.currentUser);
  const setHideLastSeen = useMutation(api.users.setHideLastSeen);
  const setPhoneVisible = useMutation(api.users.setPhoneVisible);
  const { settings, update } = useSettings();
  const hideLastSeen = !!me?.hideLastSeen;
  const phoneVisible = !!me?.phoneVisible;

  return (
    <SettingsPage title="Конфіденційність">
      <Group
        title="Час останнього входу"
        footer="Якщо вибрати «Ніхто», інші бачитимуть «був(ла) нещодавно»."
      >
        <CheckRow icon="time" tint="#10B981" label="Усі" selected={!hideLastSeen} onPress={() => setHideLastSeen({ hide: false }).catch(() => {})} />
        <CheckRow icon="eye-off" tint="#6B7280" label="Ніхто" selected={hideLastSeen} onPress={() => setHideLastSeen({ hide: true }).catch(() => {})} />
      </Group>

      <Group title="Номер телефону" footer="За замовчуванням номер приховано від усіх. Перевірка виконується на сервері.">
        <CheckRow icon="call" tint="#3B82F6" label="Усі" selected={phoneVisible} onPress={() => setPhoneVisible({ visible: true }).catch(() => {})} />
        <CheckRow icon="lock-closed" tint="#6B7280" label="Ніхто" selected={!phoneVisible} onPress={() => setPhoneVisible({ visible: false }).catch(() => {})} />
      </Group>

      <Group title="Історії" footer="Хто бачить ваші історії, близькі друзі, приховані історії, режим невидимки та архів.">
        <NavRow icon="albums" tint="#8B5CF6" label="Історії" first onPress={() => router.push("/(app)/prefs/story-privacy" as never)} />
      </Group>

      <Group title="Переписка" footer="Якщо вимкнути, співрозмовники не бачитимуть «друкує…», коли ви пишете.">
        <SwitchRow
          icon="create"
          tint="#F59E0B"
          label="Показувати, що я друкую"
          value={settings.privacy.sendTyping}
          onChange={(v) => update("privacy", { sendTyping: v })}
        />
      </Group>
    </SettingsPage>
  );
}
