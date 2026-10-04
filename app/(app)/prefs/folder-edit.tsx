import { CheckRow, Group, NavRow, SettingsPage } from "@/components/SettingsUI";
import { usePremiumUi } from "@/context/PremiumContext";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { convexErrorText, isLimitError } from "@/utils/convexError";
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

/** Створення / редагування власної папки чатів (ліміти папок і чатів у папці — на сервері). */
export default function FolderEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const c = useChatPalette();
  const router = useRouter();
  const { openUpsell } = usePremiumUi();
  const data = useQuery(api.folders.list);
  const rooms = useQuery(api.rooms.listRooms);
  const save = useMutation(api.folders.save);
  const remove = useMutation(api.folders.remove);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  const existing = id ? data?.folders.find((f) => f._id === id) : undefined;
  useEffect(() => {
    if (loaded.current || !data) return;
    loaded.current = true;
    if (existing) {
      setName(existing.name);
      setEmoji(existing.emoji ?? "");
      setPicked(new Set(existing.roomIds));
    }
  }, [data, existing]);

  const maxChats = data?.limits.folderChats ?? 100;

  const toggle = (roomId: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert("Папка", "Вкажіть назву папки.");
      return;
    }
    setSaving(true);
    try {
      await save({
        folderId: existing?._id,
        name,
        emoji: emoji.trim() || undefined,
        roomIds: [...picked] as Id<"chatRooms">[],
      });
      router.back();
    } catch (e) {
      if (isLimitError(e)) openUpsell("limits", convexErrorText(e));
      else Alert.alert("Помилка", convexErrorText(e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert("Видалити папку?", "Чати залишаться у списку.", [
      { text: "Скасувати", style: "cancel" },
      {
        text: "Видалити",
        style: "destructive",
        onPress: () => {
          remove({ folderId: existing._id })
            .then(() => router.back())
            .catch((e) => Alert.alert("Помилка", convexErrorText(e)));
        },
      },
    ]);
  };

  return (
    <SettingsPage title={existing ? "Редагувати папку" : "Нова папка"}>
      <Group title="Назва" footer="До 24 символів. Емодзі необов'язковий.">
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, minHeight: 54 }}>
          <TextInput
            value={emoji}
            onChangeText={(t) => setEmoji(t.slice(0, 4))}
            placeholder="😀"
            placeholderTextColor={c.muted}
            style={{ width: 44, color: c.text, fontSize: 22, textAlign: "center" }}
            accessibilityLabel="Емодзі папки"
          />
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={24}
            placeholder="Назва папки"
            placeholderTextColor={c.muted}
            selectionColor={c.accent}
            style={{ flex: 1, color: c.text, fontSize: 16, marginLeft: 8, paddingVertical: 12 }}
            accessibilityLabel="Назва папки"
          />
        </View>
      </Group>

      <Group
        title={`Чати в папці · ${picked.size}/${maxChats}`}
        footer={maxChats < 200 ? "З Modesto Premium у папці може бути до 200 чатів, а самих папок — до 15." : undefined}
      >
        {(rooms ?? []).map((r, i) => (
          <CheckRow
            key={r._id}
            first={i === 0}
            icon={r.isDirect ? "person" : r.isChannel ? "megaphone" : "people"}
            tint={r.isDirect ? "#3B82F6" : r.isChannel ? "#F59E0B" : "#10B981"}
            label={r.title}
            selected={picked.has(r._id)}
            onPress={() => toggle(r._id)}
          />
        ))}
        {rooms && rooms.length === 0 ? <NavRow label="Чатів поки немає" /> : null}
      </Group>

      <View style={{ marginHorizontal: 12, marginTop: 18 }}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={saving}
          onPress={onSave}
          accessibilityRole="button"
          style={{ height: 50, borderRadius: 14, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", opacity: saving ? 0.6 : 1 }}
        >
          <Text style={{ color: c.onAccent, fontSize: 16, fontWeight: "700" }}>{saving ? "Збереження…" : "Зберегти"}</Text>
        </TouchableOpacity>
        {existing ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onDelete}
            accessibilityRole="button"
            style={{ height: 48, borderRadius: 14, marginTop: 10, backgroundColor: withAlpha(c.danger, 0.12), alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: c.danger, fontSize: 15, fontWeight: "700" }}>Видалити папку</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SettingsPage>
  );
}
