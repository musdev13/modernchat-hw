import { EMOJI_CATEGORIES, type EmojiCategoryId } from "@/constants/emoji";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { useRecentEmojis } from "@/hooks/useRecentEmojis";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState, type ComponentProps } from "react";
import {
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { GifPicker, type GifItem } from "./GifPicker";

type TabId = "recent" | EmojiCategoryId | "gif";

interface EmojiPanelProps {
  height: number;
  /** Нижній відступ (safe area). */
  bottomInset?: number;
  onSelectEmoji: (emoji: string) => void;
  /** Видалити символ перед курсором (кнопка ⌫). Якщо не задано — кнопки немає. */
  onBackspace?: () => void;
  /** Якщо задано — показується вкладка GIF. */
  onSelectGif?: (gif: GifItem) => void;
}

const COLUMNS = 8;

/** Вбудована панель емодзі з вкладками, недавніми та (за потреби) GIF. */
export function EmojiPanel({
  height,
  bottomInset = 0,
  onSelectEmoji,
  onBackspace,
  onSelectGif,
}: EmojiPanelProps) {
  const c = useChatPalette();
  const { width } = useWindowDimensions();
  const { recent, addRecent } = useRecentEmojis();
  const [tab, setTab] = useState<TabId>("smileys");
  const [pickedInitial, setPickedInitial] = useState(false);

  // Якщо є недавні — відкриваємо одразу їх (один раз).
  useEffect(() => {
    if (!pickedInitial && recent.length > 0) {
      setTab("recent");
      setPickedInitial(true);
    }
  }, [pickedInitial, recent.length]);

  const cell = Math.floor((width - 12) / COLUMNS);

  const handleEmoji = useCallback(
    (emoji: string) => {
      void Haptics.selectionAsync();
      addRecent(emoji);
      onSelectEmoji(emoji);
    },
    [addRecent, onSelectEmoji],
  );

  const tabs: { id: TabId; icon: ComponentProps<typeof Ionicons>["name"]; label: string }[] =
    [
      { id: "recent", icon: "time-outline", label: "Недавні" },
      ...EMOJI_CATEGORIES.map((cat) => ({
        id: cat.id as TabId,
        icon: cat.icon,
        label: cat.label,
      })),
      ...(onSelectGif
        ? [{ id: "gif" as TabId, icon: "film-outline" as const, label: "GIF" }]
        : []),
    ];

  const category = EMOJI_CATEGORIES.find((cat) => cat.id === tab);
  const data = tab === "recent" ? recent : (category?.emojis ?? []);

  const renderEmoji = ({ item }: { item: string }) => (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={() => handleEmoji(item)}
      style={{ width: cell, height: cell, alignItems: "center", justifyContent: "center" }}
      accessibilityRole="button"
      accessibilityLabel={`Емодзі ${item}`}
    >
      <Text style={{ fontSize: Math.min(28, cell - 8) }}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <View
      style={{
        height,
        backgroundColor: c.sheet,
        borderTopWidth: 1,
        borderTopColor: c.divider,
      }}
    >
      <View style={{ flex: 1, paddingTop: 6 }}>
        {tab === "gif" && onSelectGif ? (
          <GifPicker onSelect={onSelectGif} />
        ) : (
          <>
            {tab !== "recent" && recent.length > 0 && (
              <View style={{ paddingHorizontal: 6 }}>
                <Text style={{ color: c.muted, fontSize: 11, fontWeight: "600", marginLeft: 6, marginBottom: 2 }}>
                  НЕДАВНІ
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {recent.slice(0, 16).map((e) => (
                    <TouchableOpacity
                      key={`r-${e}`}
                      activeOpacity={0.6}
                      onPress={() => handleEmoji(e)}
                      style={{ width: cell, height: cell - 6, alignItems: "center", justifyContent: "center" }}
                    >
                      <Text style={{ fontSize: Math.min(26, cell - 10) }}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {tab === "recent" && recent.length === 0 ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
                <Text style={{ color: c.muted, fontSize: 13, textAlign: "center" }}>
                  Тут зʼявляться емодзі, якими ви користуєтесь найчастіше
                </Text>
              </View>
            ) : (
              <FlatList
                key={tab}
                data={data}
                numColumns={COLUMNS}
                keyExtractor={(e, i) => `${tab}-${i}-${e}`}
                renderItem={renderEmoji}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 6 }}
                initialNumToRender={40}
                windowSize={5}
                showsVerticalScrollIndicator={false}
              />
            )}
          </>
        )}
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderTopWidth: 1,
          borderTopColor: c.divider,
          paddingBottom: bottomInset,
          paddingHorizontal: 4,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ alignItems: "center" }}
          style={{ flex: 1 }}
        >
          {tabs.map((t) => {
            const active = t.id === tab;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setTab(t.id)}
                accessibilityRole="tab"
                accessibilityLabel={t.label}
                accessibilityState={{ selected: active }}
                style={{
                  width: 40,
                  height: 42,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: active ? withAlpha(c.accent, 0.16) : "transparent",
                }}
              >
                <Ionicons name={t.icon} size={21} color={active ? c.accent : c.muted} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {onBackspace && tab !== "gif" && (
          <TouchableOpacity
            onPress={onBackspace}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Видалити символ"
            style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="backspace-outline" size={23} color={c.muted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
