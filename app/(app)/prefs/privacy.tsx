import { CheckRow, Group, NavRow, SettingsPage, SwitchRow } from "@/components/SettingsUI";
import { useSettings } from "@/context/SettingsContext";
import { usePremiumUi } from "@/context/PremiumContext";
import { api } from "@/convex/_generated/api";
import { usePremium } from "@/hooks/usePremium";
import { convexErrorText, isLimitError } from "@/utils/convexError";
import { Alert } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";

export default function PrivacySettings() {
  const router = useRouter();
  const me = useQuery(api.users.currentUser);
  const setHideLastSeen = useMutation(api.users.setHideLastSeen);
  const setPhoneVisible = useMutation(api.users.setPhoneVisible);
  const { settings, update } = useSettings();
  const premium = usePremium();
  const { openUpsell } = usePremiumUi();
  const setPremiumPrivacy = useMutation(api.premiumFeatures.setPremiumPrivacy);
  const applyPremium = (patch: { hideReadReceipts?: boolean; whoCanMessage?: "all" | "contacts"; autoArchiveNonContacts?: boolean }) => {
    const enabling = patch.hideReadReceipts === true || patch.whoCanMessage === "contacts" || patch.autoArchiveNonContacts === true;
    if (enabling && !premium.isPremium) {
      openUpsell("privacy");
      return;
    }
    setPremiumPrivacy(patch).catch((e) => {
      if (isLimitError(e)) openUpsell("privacy", convexErrorText(e));
      else Alert.alert("Помилка", convexErrorText(e));
    });
  };
  const hideReceipts = premium.isPremium && !!me?.hideReadReceipts;
  const contactsOnly = premium.isPremium && me?.whoCanMessage === "contacts";
  const autoArchive = premium.isPremium && !!me?.autoArchiveNonContacts;
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

      <Group
        title="Modesto Premium"
        footer="Приховування часу прочитання діє в обидва боки: ви теж не бачите, коли читають інші. «Лише контакти» — писати вам першими зможуть лише ті, з ким у вас уже є розмова, де ви відповідали."
      >
        <SwitchRow
          first
          icon="checkmark-done"
          tint="#F59E0B"
          label="Приховати час прочитання"
          sub={premium.isPremium ? undefined : "Лише для Premium"}
          value={hideReceipts}
          onChange={(v) => applyPremium({ hideReadReceipts: v })}
        />
        <SwitchRow
          icon="shield-checkmark"
          tint="#3B82F6"
          label="Писати мені можуть лише контакти"
          sub={premium.isPremium ? undefined : "Лише для Premium"}
          value={contactsOnly}
          onChange={(v) => applyPremium({ whoCanMessage: v ? "contacts" : "all" })}
        />
        <SwitchRow
          icon="archive"
          tint="#8B5CF6"
          label="Автоархів чатів від незнайомих"
          sub={premium.isPremium ? "Нові чати від людей, яким ви не писали, потраплять в архів" : "Лише для Premium"}
          value={autoArchive}
          onChange={(v) => applyPremium({ autoArchiveNonContacts: v })}
        />
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
