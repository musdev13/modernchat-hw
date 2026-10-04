import type { SheetAction } from "@/components/ActionSheet";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, StatusBar, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  visible: boolean;
  onClose: () => void;
  actions: SheetAction[];
  /**
   * top-right / top-left — під кнопкою ⋮ у верхній панелі (виростає з її кута);
   * center — по центру екрана (довге натискання: чат у списку, повідомлення, посилання).
   */
  placement?: "top-right" | "top-left" | "center";
  /** Відступ від верху екрана для top-*; за замовчуванням — одразу під верхньою панеллю. */
  top?: number;
  /** Довільний блок над карткою (наприклад, швидкі реакції). */
  header?: ReactNode;
  /** Компактна шапка картки: аватар + заголовок + підзаголовок. */
  title?: string;
  subtitle?: string;
  avatar?: ReactNode;
  /** Короткий підпис над діями (фрагмент повідомлення). */
  caption?: string;
}

const noop = () => {};
const SPRING = { damping: 19, stiffness: 300, mass: 0.7 } as const;
const MARGIN = 12;

/**
 * Випливаюче меню у стилі Telegram: широка картка з великим радіусом, рядок = іконка зліва + текст,
 * напівпрозоре тло теми, легка тінь, пружинне масштабування з кута кнопки ⋮ (або з центру) і
 * затемнення фону. Один Modal без власної анімації — усе рухається на UI-потоці; змонтоване лише
 * поки меню видиме (або програє закриття). Дія виконується після закриття, щоб модальні вікна
 * не накладались.
 */
export function PopoverMenu({
  visible,
  onClose,
  actions,
  placement = "top-right",
  top,
  header,
  title,
  subtitle,
  avatar,
  caption,
}: Props) {
  const c = useChatPalette();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  const pending = useRef<(() => void) | null>(null);
  const lastProps = useRef({ actions, header, title, subtitle, avatar, caption });
  if (visible) lastProps.current = { actions, header, title, subtitle, avatar, caption };

  const finish = useCallback(() => {
    setMounted(false);
    const run = pending.current;
    pending.current = null;
    if (run) run();
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withSpring(1, SPRING);
    } else {
      progress.value = withTiming(0, { duration: 140, easing: Easing.out(Easing.quad) }, (done) => {
        if (done) runOnJS(finish)();
      });
    }
  }, [visible, progress, finish]);

  const statusInset = Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0);
  const topPos = top ?? statusInset + 6 + 44 + 6;
  const center = placement === "center";
  const width = center ? Math.min(320, W - 32) : Math.min(264, W - MARGIN * 2);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 1.6),
    transform: [
      { scale: 0.5 + 0.5 * progress.value },
      { translateY: center ? 0 : (1 - progress.value) * -8 },
    ],
  }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  if (!mounted) return null;
  const shown = visible ? { actions, header, title, subtitle, avatar, caption } : lastProps.current;
  const items = shown.actions;
  const firstDestructive = items.findIndex((a) => a.destructive);

  const card = (
    <Animated.View
      style={[
        {
          width,
          transformOrigin: center ? "center" : placement === "top-right" ? "top right" : "top left",
          alignItems: "stretch",
        },
        center ? null : { position: "absolute", top: topPos, [placement === "top-right" ? "right" : "left"]: MARGIN },
        cardStyle,
      ]}
    >
      {shown.header ? <View style={{ marginBottom: 10 }}>{shown.header}</View> : null}
      <Pressable
        onPress={noop}
        style={{
          borderRadius: 20,
          backgroundColor: withAlpha(c.sheet, 0.96),
          borderWidth: 1,
          borderColor: withAlpha(c.muted, 0.16),
          paddingVertical: 6,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOpacity: 0.3,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 14,
        }}
      >
        {shown.title ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: withAlpha(c.muted, 0.16),
              marginBottom: 4,
            }}
          >
            {shown.avatar ? <View style={{ marginRight: 12 }}>{shown.avatar}</View> : null}
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>
                {shown.title}
              </Text>
              {shown.subtitle ? (
                <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12.5, marginTop: 1 }}>
                  {shown.subtitle}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
        {shown.caption ? (
          <Text
            numberOfLines={1}
            style={{ color: c.muted, fontSize: 12.5, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}
          >
            {shown.caption}
          </Text>
        ) : null}
        {items.map((action, index) => {
          const color = action.destructive ? c.danger : c.text;
          return (
            <View key={action.key}>
              {index > 0 && index === firstDestructive ? (
                <View style={{ height: 1, marginVertical: 4, marginHorizontal: 0, backgroundColor: withAlpha(c.muted, 0.16) }} />
              ) : null}
              <Pressable
                accessibilityRole="menuitem"
                accessibilityLabel={action.label}
                android_ripple={{ color: withAlpha(c.accent, 0.18) }}
                onPress={() => {
                  pending.current = action.onPress;
                  onClose();
                }}
                style={({ pressed }) => ({
                  height: 52,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  backgroundColor: pressed ? withAlpha(c.accent, 0.12) : "transparent",
                })}
              >
                <Ionicons name={action.icon} size={24} color={color} style={{ width: 28 }} />
                <Text numberOfLines={1} style={{ flex: 1, marginLeft: 14, color, fontSize: 16.5 }}>
                  {action.label}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </Pressable>
    </Animated.View>
  );

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.28)" },
            dimStyle,
          ]}
        />
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onClose}
          accessibilityLabel="Закрити меню"
        />
        {center ? (
          <View
            pointerEvents="box-none"
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
          >
            {card}
          </View>
        ) : (
          card
        )}
      </View>
    </Modal>
  );
}
