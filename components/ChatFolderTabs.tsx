import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export type ChatFolder = "all" | "direct" | "groups" | "unread";

export const CHAT_FOLDERS: { key: ChatFolder; label: string }[] = [
  { key: "all", label: "Усі" },
  { key: "direct", label: "Особисті" },
  { key: "groups", label: "Групи" },
  { key: "unread", label: "Непрочитані" },
];

interface Props {
  active: ChatFolder;
  onChange: (folder: ChatFolder) => void;
  /** Скільки чатів із непрочитаними в кожній папці (0 — лічильник не показуємо). */
  counts: Record<ChatFolder, number>;
}

/** Вкладки-«папки» під пошуком у стилі Telegram: фільтр списку чатів на клієнті. */
export function ChatFolderTabs({ active, onChange, counts }: Props) {
  const c = useChatPalette();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, marginTop: 6 }}
      contentContainerStyle={{ paddingRight: 8 }}
    >
      {CHAT_FOLDERS.map((folder) => {
        const selected = folder.key === active;
        const count = counts[folder.key];
        return (
          <TouchableOpacity
            key={folder.key}
            activeOpacity={0.7}
            onPress={() => onChange(folder.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={{ paddingHorizontal: 12, marginRight: 4 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", height: 38 }}>
              <Text
                style={{
                  color: selected ? c.accent : c.muted,
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                {folder.label}
              </Text>
              {count > 0 ? (
                <View
                  style={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    paddingHorizontal: 6,
                    marginLeft: 6,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: selected ? c.accent : withAlpha(c.muted, 0.35),
                  }}
                >
                  <Text
                    style={{
                      color: selected ? c.onAccent : c.text,
                      fontSize: 11.5,
                      fontWeight: "700",
                    }}
                  >
                    {count > 99 ? "99+" : count}
                  </Text>
                </View>
              ) : null}
            </View>
            <View
              style={{
                height: 3,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
                backgroundColor: selected ? c.accent : "transparent",
              }}
            />
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
