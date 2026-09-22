import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";

const EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🔥", "🎉", "👏"];
const EMOJI_SIZE = 36;
const PICKER_HEIGHT = 54;
const HORIZONTAL_PADDING = 8;

export type ReactionPickerPosition = {
  x: number;
  y: number;
  isOwn: boolean;
};

type Props = {
  visible: boolean;
  position: ReactionPickerPosition | null;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
};

export function ReactionPickerModal({
  visible,
  position,
  onClose,
  onSelectEmoji,
}: Props) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const pickerWidth = Math.min(
    EMOJIS.length * EMOJI_SIZE + HORIZONTAL_PADDING * 2,
    screenWidth - 16,
  );

  useEffect(() => {
    if (!visible) return;

    scale.setValue(0);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        damping: 14,
        stiffness: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale, visible]);

  const pickerPosition = useMemo(() => {
    if (!position) return { left: 8, top: screenHeight / 2 };

    const margin = 8;
    const above = position.y - PICKER_HEIGHT - margin;
    const top = above < 60 ? position.y + 48 + margin : above;
    const anchoredLeft = position.isOwn
      ? position.x - pickerWidth
      : position.x;

    return {
      top: Math.max(60, Math.min(top, screenHeight - PICKER_HEIGHT - margin)),
      left: Math.max(8, Math.min(anchoredLeft, screenWidth - pickerWidth - 8)),
    };
  }, [pickerWidth, position, screenHeight, screenWidth]);

  const handleSelect = (emoji: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectEmoji(emoji);
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.35)" }}
        onPress={onClose}
      />
      <Animated.View
        style={{
          position: "absolute",
          top: pickerPosition.top,
          left: pickerPosition.left,
          width: pickerWidth,
          height: PICKER_HEIGHT,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-around",
          paddingHorizontal: HORIZONTAL_PADDING,
          borderRadius: 27,
          backgroundColor: "#1C1C1E",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.1)",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.5,
          shadowRadius: 16,
          elevation: 24,
          opacity,
          transformOrigin: position?.isOwn ? "100% 100%" : "0% 100%",
          transform: [{ scale }],
        }}
      >
        {EMOJIS.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            activeOpacity={0.65}
            onPress={() => handleSelect(emoji)}
            accessibilityRole="button"
            accessibilityLabel={`Додати реакцію ${emoji}`}
            style={{
              width: EMOJI_SIZE,
              height: EMOJI_SIZE,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: EMOJI_SIZE / 2,
            }}
          >
            <Text style={{ fontSize: 22 }}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Modal>
  );
}
