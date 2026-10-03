import { COLORS, FONTS } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef } from "react";
import {
    Animated,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const EMOJIS = [
  "❤️",
  "👍",
  "😂",
  "😮",
  "😢",
  "🔥",
  "🎉",
  "👏",
  "🥰",
  "😍",
  "🤔",
  "👀",
  "💯",
  "✨",
  "🌸",
  "🎀",
  "😎",
  "🙏",
  "💀",
  "🤯",
  "😴",
  "🤝",
  "🫶",
  "💔",
];

const EMOJI_SIZE = 40;
const MENU_WIDTH = 280;
const EMOJI_ROW_HEIGHT = 60;
const ACTION_ROW_HEIGHT = 48;

export type MessageMenuPosition = {
  x: number;
  y: number;
  isOwn: boolean;
};

export type MessageMenuAction = "reply" | "edit" | "delete";

type Props = {
  visible: boolean;
  position: MessageMenuPosition | null;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onAction: (action: MessageMenuAction) => void;
};

export function MessageContextMenu({
  visible,
  position,
  canEdit,
  canDelete,
  onClose,
  onSelectEmoji,
  onAction,
}: Props) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const actionsCount = 1 + (canEdit ? 1 : 0) + (canDelete ? 1 : 0);
  const menuHeight =
    EMOJI_ROW_HEIGHT + actionsCount * ACTION_ROW_HEIGHT + 4;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.85);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        damping: 14,
        stiffness: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 130,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale, visible]);

  const menuPosition = useMemo(() => {
    if (!position) {
      return {
        left: (screenWidth - MENU_WIDTH) / 2,
        top: screenHeight / 2 - menuHeight / 2,
      };
    }

    const margin = 12;
    const preferredTop = position.y - menuHeight - margin;
    const fallbackTop = position.y + 56 + margin;

    let top = preferredTop;
    if (top < insets.top + 8) {
      top = fallbackTop;
    }
    if (top + menuHeight > screenHeight - insets.bottom - 8) {
      top = Math.max(
        insets.top + 8,
        screenHeight - insets.bottom - menuHeight - 8,
      );
    }

    const preferredLeft = position.isOwn
      ? position.x - MENU_WIDTH
      : position.x;

    let left = preferredLeft;
    if (left < 8) left = 8;
    if (left + MENU_WIDTH > screenWidth - 8) {
      left = screenWidth - MENU_WIDTH - 8;
    }

    return { top, left };
  }, [position, menuHeight, screenHeight, screenWidth, insets]);

  const handleSelectEmoji = (emoji: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectEmoji(emoji);
    onClose();
  };

  const handleAction = (action: MessageMenuAction) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAction(action);
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
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(10,6,18,0.55)" },
        ]}
        onPress={onClose}
      />

      <Animated.View
        style={{
          position: "absolute",
          top: menuPosition.top,
          left: menuPosition.left,
          width: MENU_WIDTH,
          opacity,
          transform: [{ scale }],
        }}
      >
        <View
          style={{
            backgroundColor: "#241D33",
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: "rgba(255,143,180,0.35)",
            overflow: "hidden",
            shadowColor: "#FF8FB4",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 20,
            elevation: 20,
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 10,
              alignItems: "center",
              gap: 4,
            }}
            style={{ height: EMOJI_ROW_HEIGHT }}
            bounces={false}
          >
            {EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                activeOpacity={0.6}
                onPress={() => handleSelectEmoji(emoji)}
                style={{
                  width: EMOJI_SIZE,
                  height: EMOJI_SIZE,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: EMOJI_SIZE / 2,
                }}
              >
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View
            style={{
              height: 1,
              backgroundColor: "rgba(183,148,246,0.18)",
            }}
          />

          <View>
            <ActionRow
              icon="arrow-undo"
              label="Відповісти"
              onPress={() => handleAction("reply")}
            />
            {canEdit && (
              <ActionRow
                icon="pencil"
                label="Редагувати"
                onPress={() => handleAction("edit")}
              />
            )}
            {canDelete && (
              <ActionRow
                icon="trash-outline"
                label="Видалити"
                onPress={() => handleAction("delete")}
                danger
              />
            )}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const tint = danger ? COLORS.danger : COLORS.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        height: ACTION_ROW_HEIGHT,
        gap: 12,
      }}
    >
      <Ionicons name={icon} size={18} color={tint} />
      <Text
        style={{
          color: danger ? COLORS.danger : COLORS.text,
          fontFamily: FONTS.bodyBold,
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}