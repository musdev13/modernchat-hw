import { Group, NavRow, SettingsPage, SwitchRow } from "@/components/SettingsUI";
import { useSettings } from "@/context/SettingsContext";
import { formatFileSize } from "@/utils/attachments";
import { Directory, Paths } from "expo-file-system";
import { Image as ExpoImage } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

function cacheBytes(): number | null {
  try {
    return new Directory(Paths.cache).size ?? null;
  } catch {
    return null;
  }
}

export default function DataSettings() {
  const { settings, update } = useSettings();
  const [size, setSize] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const measure = useCallback(() => setSize(cacheBytes()), []);
  useEffect(() => {
    measure();
  }, [measure]);

  const clear = () =>
    Alert.alert("Очистити кеш?", "Фото та мініатюри завантажаться знову, коли знадобляться.", [
      { text: "Скасувати", style: "cancel" },
      {
        text: "Очистити",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await ExpoImage.clearMemoryCache();
            await ExpoImage.clearDiskCache();
          } catch {
            // кеш міг бути вже порожній
          } finally {
            setBusy(false);
            measure();
          }
        },
      },
    ]);

  return (
    <SettingsPage title="Дані та пам'ять">
      <Group
        title="Автозавантаження медіа"
        footer="Якщо вимкнено, фото й відео в чаті не завантажуються самі: фото — по натисканню, а для відео не створюється мініатюра, поки його не відкриєте."
      >
        <SwitchRow icon="image" tint="#3B82F6" label="Фото" value={settings.data.autoPhoto} onChange={(v) => update("data", { autoPhoto: v })} />
        <SwitchRow icon="videocam" tint="#8B5CF6" label="Відео" value={settings.data.autoVideo} onChange={(v) => update("data", { autoVideo: v })} />
      </Group>

      <Group title="Пам'ять" footer="Кеш зображень зберігається на пристрої, щоб чат відкривався швидше.">
        <NavRow
          icon="server"
          tint="#10B981"
          label="Кеш застосунку"
          value={size === null ? "—" : formatFileSize(size)}
          chevron={false}
        />
        <NavRow icon="trash" tint="#EF4444" label={busy ? "Очищення…" : "Очистити кеш зображень"} onPress={busy ? undefined : clear} />
      </Group>
    </SettingsPage>
  );
}
