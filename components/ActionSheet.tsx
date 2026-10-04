import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, ReactNode } from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = ComponentProps<typeof Ionicons>["name"];

export interface SheetAction {
  key: string;
  label: string;
  icon: IconName;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Аватар зліва від заголовка. */
  avatar?: ReactNode;
  actions: SheetAction[];
}

/** Нижній лист у кольорах теми: шапка (аватар + назва) і список дій. */
export function ActionSheet({
  visible,
  onClose,
  title,
  subtitle,
  avatar,
  actions,
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
        <Pressable onPress={() => {}}>
          <Animated.View
            entering={SlideInDown.springify().damping(22).stiffness(240)}
            style={{
              backgroundColor: c.sheet,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: Math.max(insets.bottom, 12) + 4,
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: c.divider,
            }}
          >
            <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 4 }}>
              <View
                style={{
                  width: 38,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: withAlpha(c.muted, 0.5),
                }}
              />
            </View>

            {title ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                }}
              >
                {avatar ? <View style={{ marginRight: 12 }}>{avatar}</View> : null}
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{ color: c.text, fontSize: 17, fontWeight: "700" }}
                  >
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text
                      numberOfLines={1}
                      style={{ color: c.muted, fontSize: 13, marginTop: 2 }}
                    >
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
              </View>
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
                    paddingHorizontal: 18,
                    height: 54,
                    borderTopWidth: index === 0 && !title ? 0 : 1,
                    borderTopColor: c.divider,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: withAlpha(
                        action.destructive ? c.danger : c.accent,
                        0.14,
                      ),
                    }}
                  >
                    <Ionicons
                      name={action.icon}
                      size={19}
                      color={action.destructive ? c.danger : c.accent}
                    />
                  </View>
                  <Text style={{ color, fontSize: 16, marginLeft: 14 }}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
