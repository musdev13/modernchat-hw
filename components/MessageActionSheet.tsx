import { useChatPalette } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QuickReactionBar } from "./ReactionPickerModal";

type IconName = ComponentProps<typeof Ionicons>["name"];

export interface MessageAction {
  key: string;
  label: string;
  icon: IconName;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  /** Короткий фрагмент повідомлення для підпису. */
  preview?: string;
  /** Емодзі, які користувач уже поставив на це повідомлення. */
  myReactions?: string[];
  actions: MessageAction[];
  onClose: () => void;
  onReact: (emoji: string) => void;
  onMoreReactions: () => void;
}

/** Меню довгого натискання: швидкі реакції + список дій. */
export function MessageActionSheet({
  visible,
  preview,
  myReactions,
  actions,
  onClose,
  onReact,
  onMoreReactions,
}: Props) {
  const c = useChatPalette();
  const insets = useSafeAreaInsets();

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
        {/* Внутрішній Pressable не дає закривати меню при дотику до нього. */}
        <Pressable
          onPress={() => {}}
          style={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <QuickReactionBar
            selected={myReactions}
            onSelect={(emoji) => {
              onReact(emoji);
              onClose();
            }}
            onMore={onMoreReactions}
          />

          <View
            style={{
              marginTop: 10,
              backgroundColor: c.sheet,
              borderRadius: 18,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: c.divider,
            }}
          >
            {preview ? (
              <Text
                numberOfLines={1}
                style={{
                  color: c.muted,
                  fontSize: 12,
                  paddingHorizontal: 16,
                  paddingTop: 10,
                  paddingBottom: 4,
                }}
              >
                {preview}
              </Text>
            ) : null}

            {actions.map((action, index) => {
              const color = action.destructive ? c.danger : c.text;
              return (
                <TouchableOpacity
                  key={action.key}
                  activeOpacity={0.6}
                  onPress={() => {
                    onClose();
                    action.onPress();
                  }}
                  accessibilityRole="button"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    height: 50,
                    borderTopWidth: index === 0 && !preview ? 0 : 1,
                    borderTopColor: c.divider,
                  }}
                >
                  <Ionicons
                    name={action.icon}
                    size={21}
                    color={action.destructive ? c.danger : c.accent}
                  />
                  <Text style={{ color, fontSize: 16, marginLeft: 16 }}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
