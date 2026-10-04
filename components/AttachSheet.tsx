import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = ComponentProps<typeof Ionicons>["name"];

interface Props {
  visible: boolean;
  onClose: () => void;
  onGallery: () => void;
  onFile: () => void;
  onCamera: () => void;
  /** Якщо передано — показуємо плитку «Опитування». */
  onPoll?: () => void;
}

/** Лист вибору вкладення в стилі Telegram: Галерея · Файл · Камера (· Опитування). */
export function AttachSheet({ visible, onClose, onGallery, onFile, onCamera, onPoll }: Props) {
  const c = useChatPalette();
  const insets = useSafeAreaInsets();

  // Спершу закриваємо лист, і лише потім відкриваємо системний вибір.
  const run = (action: () => void) => () => {
    onClose();
    setTimeout(action, 220);
  };

  const tile = (icon: IconName, label: string, color: string, action: () => void) => (
    <TouchableOpacity
      key={label}
      activeOpacity={0.7}
      onPress={run(action)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: "25%", alignItems: "center", paddingVertical: 10 }}
    >
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: withAlpha(color, 0.18),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={27} color={color} />
      </View>
      <Text style={{ color: c.text, fontSize: 13, marginTop: 7 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={{ flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: c.sheet,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 10,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 12) + 6,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 38,
              height: 4,
              borderRadius: 2,
              backgroundColor: withAlpha(c.muted, 0.5),
              marginBottom: 8,
            }}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {tile("images", "Галерея", "#4F9BFF", onGallery)}
            {tile("document", "Файл", "#FF8A3D", onFile)}
            {tile("camera", "Камера", "#EF5B8B", onCamera)}
            {onPoll ? tile("stats-chart", "Опитування", "#34C759", onPoll) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
