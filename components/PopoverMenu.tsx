import type { SheetAction } from "@/components/ActionSheet";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
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
  /** З якого боку «виростає» меню (під кнопкою ⋮ — справа). */
  align?: "right" | "left";
  /** Відступ від верху екрана; за замовчуванням — одразу під верхньою панеллю профілю. */
  top?: number;
}

const noop = () => {};
const MENU_WIDTH = 252;
const ITEM_H = 50;
const SPRING = { damping: 20, stiffness: 320, mass: 0.7 } as const;

/**
 * Випливаюче меню у стилі Telegram: картка під кнопкою ⋮, що масштабується з кута кнопки (пружина)
 * із затуханням і так само закривається. Один Modal без власної анімації — уся анімація на UI-потоці;
 * змонтоване лише поки меню видиме (або програє закриття). Дія виконується після закриття,
 * щоб не накладати модальні вікна.
 */
export function PopoverMenu({ visible, onClose, actions, align = "right", top }: Props) {
  const c = useChatPalette();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  const pending = useRef<(() => void) | null>(null);
  const lastActions = useRef(actions);
  if (visible) lastActions.current = actions;

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
  const width = Math.min(MENU_WIDTH, W - 24);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 1.6),
    transform: [{ scale: 0.55 + 0.45 * progress.value }, { translateY: (1 - progress.value) * -8 }],
  }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  if (!mounted) return null;
  const items = visible ? actions : lastActions.current;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Закрити меню">
        <Animated.View
          pointerEvents="none"
          style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.18)" }, dimStyle]}
        />
        <Animated.View
          style={[
            {
              position: "absolute",
              top: topPos,
              [align]: 12,
              width,
              transformOrigin: align === "right" ? "top right" : "top left",
              borderRadius: 18,
              backgroundColor: c.sheet,
              borderWidth: 1,
              borderColor: withAlpha(c.muted, 0.2),
              paddingVertical: 6,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOpacity: 0.28,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 12,
            },
            cardStyle,
          ]}
        >
          {/* Внутрішній Pressable поглинає дотики, щоб тап по полях меню не закривав його як по фону */}
          <Pressable onPress={noop}>
          {items.map((action) => {
            const color = action.destructive ? c.danger : c.text;
            return (
              <Pressable
                key={action.key}
                accessibilityRole="menuitem"
                accessibilityLabel={action.label}
                android_ripple={{ color: withAlpha(c.accent, 0.18) }}
                onPress={() => {
                  pending.current = action.onPress;
                  onClose();
                }}
                style={({ pressed }) => ({
                  height: ITEM_H,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  backgroundColor: pressed ? withAlpha(c.accent, 0.12) : "transparent",
                })}
              >
                <Ionicons name={action.icon} size={22} color={action.destructive ? c.danger : c.muted} />
                <Text numberOfLines={1} style={{ flex: 1, marginLeft: 16, color, fontSize: 16, fontWeight: "500" }}>
                  {action.label}
                </Text>
              </Pressable>
            );
          })}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
