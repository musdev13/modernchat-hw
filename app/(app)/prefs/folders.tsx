import { CHAT_FOLDERS } from "@/components/ChatFolderTabs";
import { CheckRow, Group, SettingsPage, SwitchRow } from "@/components/SettingsUI";
import { useSettings } from "@/context/SettingsContext";

export default function FoldersSettings() {
  const { settings, update } = useSettings();
  const hidden = settings.folders.hidden;
  const visible = CHAT_FOLDERS.filter((f) => f.key === "all" || !hidden.includes(f.key));

  return (
    <SettingsPage title="Папки з чатами">
      <Group title="Вкладки у списку чатів" footer="«Усі» завжди залишається. Приховані вкладки не показуються над списком чатів.">
        {CHAT_FOLDERS.filter((f) => f.key !== "all").map((f) => (
          <SwitchRow
            key={f.key}
            icon="folder"
            tint="#F59E0B"
            label={f.label}
            value={!hidden.includes(f.key)}
            onChange={(on) => {
              const nextHidden = on ? hidden.filter((k) => k !== f.key) : [...hidden, f.key];
              update("folders", {
                hidden: nextHidden,
                initial: !on && settings.folders.initial === f.key ? "all" : settings.folders.initial,
              });
            }}
          />
        ))}
      </Group>

      <Group title="Відкривати з вкладки">
        {visible.map((f) => (
          <CheckRow
            key={f.key}
            icon="albums"
            tint="#3B82F6"
            label={f.label}
            selected={settings.folders.initial === f.key}
            onPress={() => update("folders", { initial: f.key })}
          />
        ))}
      </Group>
    </SettingsPage>
  );
}
