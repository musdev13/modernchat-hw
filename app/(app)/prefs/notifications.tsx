import { Group, NavRow, SettingsPage, SwitchRow } from "@/components/SettingsUI";
import { useSettings } from "@/context/SettingsContext";
import { api } from "@/convex/_generated/api";
import { useChatPalette } from "@/hooks/useChatPalette";
import { useMutation, useQuery } from "convex/react";
import * as Notifications from "expo-notifications";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking } from "react-native";

const DEFAULTS = { messages: true, groups: true, channels: true, preview: true, sound: true };

export default function NotificationsSettings() {
  const c = useChatPalette();
  const me = useQuery(api.users.currentUser);
  const setPrefs = useMutation(api.users.setNotifPrefs);
  const { settings, update } = useSettings();
  const prefs = { ...DEFAULTS, ...(me?.notifPrefs ?? {}) };
  const [status, setStatus] = useState<Notifications.PermissionStatus | null>(null);
  const [canAsk, setCanAsk] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const p = await Notifications.getPermissionsAsync();
      setStatus(p.status);
      setCanAsk(p.canAskAgain);
    } catch {
      setStatus(null);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const permission = async () => {
    if (status === "undetermined" && canAsk) {
      await Notifications.requestPermissionsAsync();
      await refresh();
      return;
    }
    try {
      await Linking.openSettings();
    } catch {
      // системні налаштування недоступні
    }
  };

  const set = (patch: Partial<typeof DEFAULTS>) => {
    setPrefs(patch).catch(() => {});
  };

  return (
    <SettingsPage title="Сповіщення та звуки">
      <Group
        footer={
          status === "granted"
            ? "Сповіщення приходять на цей пристрій. Натисніть, щоб відкрити системні налаштування."
            : "Дозвольте сповіщення в системних налаштуваннях, щоб отримувати нові повідомлення."
        }
      >
        <NavRow
          icon="notifications-outline"
          tint="#EF4444"
          label="Push-сповіщення"
          value={status === "granted" ? "Увімкнено" : status === "denied" ? "Вимкнено" : status ? "Не налаштовано" : ""}
          onPress={permission}
        />
      </Group>

      <Group title="Сповіщення від" footer="Вимкнений тип чатів не надсилатиме push на жоден ваш пристрій. Для окремого чату — «Вимкнути звук» у його меню.">
        <SwitchRow icon="person" tint="#3B82F6" label="Особисті чати" value={prefs.messages} onChange={(v) => set({ messages: v })} />
        <SwitchRow icon="people" tint="#10B981" label="Групи" value={prefs.groups} onChange={(v) => set({ groups: v })} />
        <SwitchRow icon="megaphone" tint="#F59E0B" label="Канали" value={prefs.channels} onChange={(v) => set({ channels: v })} />
      </Group>

      <Group title="Вигляд" footer="Без тексту у сповіщенні буде лише «Нове повідомлення».">
        <SwitchRow icon="eye" tint="#8B5CF6" label="Показувати текст" value={prefs.preview} onChange={(v) => set({ preview: v })} />
        <SwitchRow icon="volume-high" tint="#EC4899" label="Звук" value={prefs.sound} onChange={(v) => set({ sound: v })} />
      </Group>

      <Group title="У застосунку" footer="Банер угорі, коли застосунок відкрито.">
        <SwitchRow
          icon="chatbox-ellipses"
          tint={c.accent}
          label="Показувати банери"
          value={settings.notifications.inApp}
          onChange={(v) => update("notifications", { inApp: v })}
        />
      </Group>
    </SettingsPage>
  );
}
