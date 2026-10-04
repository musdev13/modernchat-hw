import { CHAT_FOLDERS } from "@/components/ChatFolderTabs";
import { CheckRow, Group, NavRow, SettingsPage, SwitchRow } from "@/components/SettingsUI";
import { usePremiumUi } from "@/context/PremiumContext";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useSettings } from "@/context/SettingsContext";

export default function FoldersSettings() {
  const { settings, update } = useSettings();
  const router = useRouter();
  const { openUpsell } = usePremiumUi();
  const data = useQuery(api.folders.list);
  const count = data?.folders.length ?? 0;
  const max = data?.limits.folders ?? 3;
  const hidden = settings.folders.hidden;
  const visible = CHAT_FOLDERS.filter((f) => f.key === "all" || !hidden.includes(f.key));

  return (
    <SettingsPage title="Папки з чатами">
      <Group
        title={`Мої папки · ${count}/${max}`}
        footer={max < 15 ? "Безкоштовно — до 3 власних папок по 100 чатів. З Modesto Premium: до 15 папок по 200 чатів." : "Ви можете створити до 15 папок по 200 чатів."}
      >
        {(data?.folders ?? []).map((f, i) => (
          <NavRow
            key={f._id}
            first={i === 0}
            icon="folder-open"
            tint="#8B5CF6"
            label={`${f.emoji ? `${f.emoji} ` : ""}${f.name}`}
            value={`${f.roomIds.length} чатів`}
            onPress={() => router.push({ pathname: "/prefs/folder-edit", params: { id: f._id } } as never)}
          />
        ))}
        <NavRow
          first={count === 0}
          icon="add-circle"
          tint="#10B981"
          label="Створити папку"
          onPress={() => {
            if (count >= max) openUpsell("limits", `Можна створити не більше ${max} папок${max < 15 ? ". З Modesto Premium — до 15." : "."}`);
            else router.push("/prefs/folder-edit" as never);
          }}
        />
      </Group>

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
