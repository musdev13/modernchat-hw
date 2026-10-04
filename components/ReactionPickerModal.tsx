import { QUICK_REACTIONS } from "@/constants/emoji";
import { PREMIUM_REACTIONS } from "@/convex/limits";
import { useChatPalette } from "@/hooks/useChatPalette";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmojiPanel } from "./EmojiPanel";

type QuickBarProps = {
  /** Емодзі, яке вже обране користувачем (підсвічується). */
  selected?: string[];
  onSelect: (emoji: string) => void;
  onMore: () => void;
  /** Є Premium: додатковий ряд реакцій доступний; інакше — із замком, тап відкриває пропозицію. */
  premium?: boolean;
  onLocked?: () => void;
};

/** Рядок швидких реакцій + кнопка «ще» (відкриває повну панель емодзі). */
export function QuickReactionBar({ selected = [], onSelect, onMore, premium = false, onLocked }: QuickBarProps) {
  const c = useChatPalette();

  return (
    <View>
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: c.sheet,
        borderRadius: 28,
        paddingHorizontal: 6,
        height: 52,
        borderWidth: 1,
        borderColor: c.divider,
      }}
    >
      {QUICK_REACTIONS.map((emoji) => {
        const active = selected.includes(emoji);
        return (
          <TouchableOpacity
            key={emoji}
            activeOpacity={0.6}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(emoji);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Додати реакцію ${emoji}`}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? c.field : "transparent",
            }}
          >
            <Text style={{ fontSize: 23 }}>{emoji}</Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        onPress={onMore}
        accessibilityRole="button"
        accessibilityLabel="Усі емодзі"
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.field,
        }}
      >
        <Ionicons name="add" size={20} color={c.muted} />
      </TouchableOpacity>
    </View>
    <View
      style={{
        marginTop: 6,
        backgroundColor: c.sheet,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: c.divider,
        height: 46,
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: "center", paddingHorizontal: 8 }}>
        {!premium ? (
          <Ionicons name="lock-closed" size={14} color={c.muted} style={{ marginRight: 4 }} />
        ) : (
          <Ionicons name="star" size={14} color="#F5C451" style={{ marginRight: 4 }} />
        )}
        {PREMIUM_REACTIONS.map((emoji) => {
          const active = selected.includes(emoji);
          return (
            <TouchableOpacity
              key={emoji}
              activeOpacity={0.6}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (premium) onSelect(emoji);
                else onLocked?.();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Premium-реакція ${emoji}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? c.field : "transparent",
                opacity: premium ? 1 : 0.55,
              }}
            >
              <Text style={{ fontSize: 22 }}>{emoji}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
    </View>
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  title?: string;
};

/** Повна панель емодзі як нижній лист — вибір реакції на повідомлення. */
export function ReactionPickerModal({ visible, onClose, onSelectEmoji, title = "Оберіть реакцію" }: Props) {
  const c = useChatPalette();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const panelHeight = Math.min(380, Math.round(height * 0.5));

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={{ flex: 1, backgroundColor: c.overlay }} onPress={onClose} />
      <View style={{ backgroundColor: c.sheet, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: "hidden" }}>
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: c.divider }} />
        </View>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: "700", textAlign: "center", marginBottom: 4 }}>
          {title}
        </Text>
        <EmojiPanel
          height={panelHeight}
          bottomInset={insets.bottom}
          onSelectEmoji={(emoji) => {
            onSelectEmoji(emoji);
            onClose();
          }}
        />
      </View>
    </Modal>
  );
}
