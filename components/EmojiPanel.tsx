import { EMOJI_CATEGORIES, type EmojiCategoryId } from "@/constants/emoji";
import { searchEmojis } from "@/constants/emojiKeywords";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { GlassProvider, GlassSurface, GlassTarget } from "./Glass";
import { useRecentEmojis } from "@/hooks/useRecentEmojis";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  FlatList,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { GifPicker, type GifItem } from "./GifPicker";

type PanelMode = "emoji" | "gif" | "stickers";
type EmojiTab = "recent" | EmojiCategoryId;

interface EmojiPanelProps {
  height: number;
  /** Нижній відступ (safe area): панель сама тримає перемикач над системною панеллю. */
  bottomInset?: number;
  onSelectEmoji: (emoji: string) => void;
  /** Видалити символ перед курсором (кнопка ⌫). Якщо не задано — кнопки немає. */
  onBackspace?: () => void;
  /** Якщо задано — показуються вкладки GIF і «Наліпки». */
  onSelectGif?: (gif: GifItem) => void;
  /** Фокус у полі пошуку панелі (відкривається системна клавіатура). */
  onSearchFocusChange?: (focused: boolean) => void;
}

const COLUMNS = 8;
const SWITCH_HEIGHT = 36;
const SWITCH_MARGIN = 10;

const GIF_CHIPS: { emoji: string; term: string }[] = [
  { emoji: "❤️", term: "love" },
  { emoji: "👍", term: "thumbs up" },
  { emoji: "👎", term: "thumbs down" },
  { emoji: "🎉", term: "party" },
  { emoji: "😂", term: "lol" },
  { emoji: "😮", term: "wow" },
  { emoji: "😢", term: "sad" },
  { emoji: "😡", term: "angry" },
  { emoji: "🔥", term: "fire" },
  { emoji: "🙏", term: "thank you" },
  { emoji: "😎", term: "cool" },
];

const MODES: { id: PanelMode; label: string }[] = [
  { id: "emoji", label: "Емодзі" },
  { id: "gif", label: "GIF" },
  { id: "stickers", label: "Наліпки" },
];

// Запамʼятовуємо останню вкладку між відкриттями панелі.
let lastMode: PanelMode = "emoji";

/** Панель у стилі Telegram: пошук + категорії, сітка та перемикач «Емодзі / GIF / Наліпки». */
export function EmojiPanel({
  height,
  bottomInset = 0,
  onSelectEmoji,
  onBackspace,
  onSelectGif,
  onSearchFocusChange,
}: EmojiPanelProps) {
  const c = useChatPalette();
  const { width } = useWindowDimensions();
  const { recent, addRecent } = useRecentEmojis();

  const [mode, setModeState] = useState<PanelMode>(
    onSelectGif ? lastMode : "emoji",
  );
  const [emojiTab, setEmojiTab] = useState<EmojiTab>("smileys");
  const [pickedInitial, setPickedInitial] = useState(false);
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  // Якщо є недавні — відкриваємо одразу їх (один раз).
  useEffect(() => {
    if (!pickedInitial && recent.length > 0) {
      setEmojiTab("recent");
      setPickedInitial(true);
    }
  }, [pickedInitial, recent.length]);

  const setMode = useCallback((next: PanelMode) => {
    lastMode = next;
    setModeState(next);
    setQuery("");
    setChip(null);
  }, []);

  const focusCbRef = useRef(onSearchFocusChange);
  focusCbRef.current = onSearchFocusChange;

  const handleFocusChange = useCallback((focused: boolean) => {
    setSearchFocused(focused);
    focusCbRef.current?.(focused);
  }, []);

  // Якщо панель закривається, поки пошук у фокусі — скидаємо стан у батька.
  useEffect(
    () => () => {
      focusCbRef.current?.(false);
    },
    [],
  );

  const cell = Math.floor((width - 12) / COLUMNS);
  const searchWidth = Math.max(120, Math.min(170, Math.round(width * 0.36)));
  const floatingBottom = bottomInset + SWITCH_MARGIN;
  const contentBottomPadding = searchFocused
    ? 8
    : floatingBottom + SWITCH_HEIGHT + 10;

  const handleEmoji = useCallback(
    (emoji: string) => {
      void Haptics.selectionAsync();
      addRecent(emoji);
      onSelectEmoji(emoji);
    },
    [addRecent, onSelectEmoji],
  );

  const trimmedQuery = query.trim();
  const emojiData = useMemo(() => {
    if (mode !== "emoji") return [];
    if (trimmedQuery) return searchEmojis(trimmedQuery);
    if (emojiTab === "recent") return recent;
    return EMOJI_CATEGORIES.find((cat) => cat.id === emojiTab)?.emojis ?? [];
  }, [mode, trimmedQuery, emojiTab, recent]);

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

  const categoryButtons: {
    id: EmojiTab;
    icon: ComponentProps<typeof Ionicons>["name"];
    label: string;
  }[] = [
    { id: "recent", icon: "time-outline", label: "Недавні" },
    ...EMOJI_CATEGORIES.map((cat) => ({
      id: cat.id as EmojiTab,
      icon: cat.icon,
      label: cat.label,
    })),
  ];

  const giphyQuery = chip ?? query;
  const giphyKind = mode === "stickers" ? "sticker" : "gif";

  const renderEmptyRecent = () => (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
      <Text style={{ color: c.muted, fontSize: 13, textAlign: "center" }}>
        Тут зʼявляться емодзі, якими ви користуєтесь найчастіше
      </Text>
    </View>
  );

  return (
    <GlassProvider>
    <View
      style={{
        height,
        backgroundColor: c.sheet,
        borderTopWidth: 1,
        borderTopColor: c.divider,
      }}
    >
      {/* Пошук + категорії / чипи */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 8, paddingBottom: 6 }}>
        <View
          style={{
            width: searchWidth,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.field,
            borderRadius: 18,
            marginLeft: 10,
            paddingHorizontal: 10,
            height: 36,
          }}
        >
          <Ionicons name="search" size={16} color={c.muted} />
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (chip) setChip(null);
            }}
            onFocus={() => handleFocusChange(true)}
            onPressIn={() => handleFocusChange(true)}
            onBlur={() => handleFocusChange(false)}
            placeholder="Пошук"
            placeholderTextColor={c.muted}
            style={{ flex: 1, color: c.text, fontSize: 14, marginLeft: 6, padding: 0 }}
            selectionColor={c.accent}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={c.muted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: "center", paddingHorizontal: 6 }}
        >
          {mode === "emoji"
            ? categoryButtons.map((t) => {
                const active = !trimmedQuery && t.id === emojiTab;
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => {
                      setQuery("");
                      setEmojiTab(t.id);
                    }}
                    accessibilityRole="tab"
                    accessibilityLabel={t.label}
                    accessibilityState={{ selected: active }}
                    style={{
                      width: 38,
                      height: 36,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 12,
                      backgroundColor: active ? withAlpha(c.accent, 0.16) : "transparent",
                    }}
                  >
                    <Ionicons name={t.icon} size={21} color={active ? c.accent : c.muted} />
                  </TouchableOpacity>
                );
              })
            : GIF_CHIPS.map((g) => {
                const active = chip === g.term;
                return (
                  <TouchableOpacity
                    key={g.term}
                    onPress={() => {
                      setQuery("");
                      setChip(active ? null : g.term);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Шукати ${g.term}`}
                    accessibilityState={{ selected: active }}
                    style={{
                      width: 38,
                      height: 36,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 12,
                      backgroundColor: active ? withAlpha(c.accent, 0.16) : "transparent",
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{g.emoji}</Text>
                  </TouchableOpacity>
                );
              })}
        </ScrollView>
      </View>

      {/* Контент (його розмиває скляний перемикач) */}
      <GlassTarget style={{ flex: 1, backgroundColor: c.sheet }}>
        {mode === "emoji" ? (
          emojiData.length === 0 ? (
            trimmedQuery ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: c.muted, fontSize: 13 }}>Нічого не знайдено</Text>
              </View>
            ) : (
              renderEmptyRecent()
            )
          ) : (
            <FlatList
              key={`${emojiTab}-${trimmedQuery ? "q" : "c"}`}
              data={emojiData}
              numColumns={COLUMNS}
              keyExtractor={(e, i) => `${emojiTab}-${i}-${e}`}
              renderItem={renderEmoji}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: 6,
                paddingBottom: contentBottomPadding,
              }}
              initialNumToRender={40}
              windowSize={5}
              showsVerticalScrollIndicator={false}
            />
          )
        ) : (
          <GifPicker
            kind={giphyKind}
            query={giphyQuery}
            bottomPadding={contentBottomPadding}
            onSelect={(gif) => onSelectGif?.(gif)}
          />
        )}
      </GlassTarget>

      {/* Плаваючий перемикач і ⌫ — приховуємо, поки відкрита клавіатура пошуку */}
      {!searchFocused && (
        <>
          {onSelectGif && (
            <View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: floatingBottom,
                alignItems: "center",
              }}
            >
              <GlassSurface
                radius={SWITCH_HEIGHT / 2}
                intensity={60}
                style={{ height: SWITCH_HEIGHT }}
                contentStyle={{ flexDirection: "row", height: SWITCH_HEIGHT, padding: 3 }}
              >
                {MODES.map((m) => {
                  const active = m.id === mode;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => setMode(m.id)}
                      accessibilityRole="tab"
                      accessibilityLabel={m.label}
                      accessibilityState={{ selected: active }}
                      style={{
                        paddingHorizontal: 14,
                        borderRadius: (SWITCH_HEIGHT - 6) / 2,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: active ? withAlpha(c.accent, 0.22) : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: active ? c.accent : c.muted,
                        }}
                      >
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </GlassSurface>
            </View>
          )}

          {onBackspace && mode === "emoji" && (
            <View
              pointerEvents="box-none"
              style={{ position: "absolute", right: 12, bottom: floatingBottom }}
            >
              <GlassSurface
                radius={SWITCH_HEIGHT / 2}
                intensity={60}
                style={{ width: SWITCH_HEIGHT, height: SWITCH_HEIGHT }}
                contentStyle={{ flex: 1 }}
              >
                <TouchableOpacity
                  onPress={onBackspace}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Видалити символ"
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="backspace-outline" size={20} color={c.muted} />
                </TouchableOpacity>
              </GlassSurface>
            </View>
          )}
        </>
      )}
    </View>
    </GlassProvider>
  );
}
