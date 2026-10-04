import { ContactsList } from "@/components/ContactsList";
import { SearchField } from "@/components/SearchField";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { convexErrorText } from "@/utils/convexError";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ListKind = "close" | "selected" | "except";
const TITLES: Record<ListKind, string> = {
  close: "Близькі друзі",
  selected: "Вибрані користувачі",
  except: "Усі, крім…",
};
const HINTS: Record<ListKind, string> = {
  close: "Лише ці люди бачитимуть історії, опубліковані для «Близьких друзів».",
  selected: "Історії з параметром «Вибрані користувачі» побачать лише ці люди.",
  except: "Ці люди не бачитимуть історій з параметром «Усі, крім…».",
};

/** Редагування списку користувачів для приватності історій (близькі друзі / вибрані / виключення). */
export default function StoryUsersScreen() {
  const { list } = useLocalSearchParams<{ list?: string }>();
  const kind: ListKind = list === "selected" || list === "except" ? list : "close";
  const c = useChatPalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const settings = useQuery(api.stories.privacySettings);
  const setClose = useMutation(api.stories.setCloseFriends);
  const setDefault = useMutation(api.stories.setDefaultPrivacy);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<Id<"users">> | null>(null);
  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!settings || initialized.current) return;
    initialized.current = true;
    const ids = kind === "close" ? settings.closeFriendIds : kind === "selected" ? settings.selectedIds : settings.exceptIds;
    setSelected(new Set(ids));
  }, [settings, kind]);

  const toggle = (id: Id<"users">) =>
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    if (!selected || !settings) return;
    setSaving(true);
    try {
      const ids = [...selected];
      if (kind === "close") await setClose({ ids });
      else if (kind === "selected") await setDefault({ audience: settings.audience, selectedIds: ids });
      else await setDefault({ audience: settings.audience, exceptIds: ids });
      router.back();
    } catch (e) {
      Alert.alert("Не вдалося зберегти", convexErrorText(e));
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: c.header }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(c.muted, 0.12) }}
          >
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </TouchableOpacity>
          <Text numberOfLines={1} style={{ color: c.text, fontSize: 20, fontWeight: "800", marginLeft: 12, flex: 1 }}>
            {TITLES[kind]}
          </Text>
          <TouchableOpacity
            onPress={() => void save()}
            disabled={saving || !selected}
            style={{ paddingHorizontal: 16, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: c.accent, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? <ActivityIndicator color={c.onAccent} /> : <Text style={{ color: c.onAccent, fontWeight: "800" }}>Готово{selected ? ` (${selected.size})` : ""}</Text>}
          </TouchableOpacity>
        </View>
        <Text style={{ color: c.muted, fontSize: 13, marginTop: 8, marginHorizontal: 4 }}>{HINTS[kind]}</Text>
        <SearchField value={search} onChangeText={setSearch} placeholder="Пошук контактів" style={{ marginTop: 10 }} />
      </View>
      {selected ? (
        <ContactsList search={search} selectedIds={selected as Set<string>} onSelect={(contact) => toggle(contact._id)} bottomInset={insets.bottom + 24} />
      ) : (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.accent} />
      )}
    </View>
  );
}
