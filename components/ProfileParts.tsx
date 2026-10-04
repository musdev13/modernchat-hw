import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { copyText } from "@/utils/clipboard";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ComponentProps, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/** Єдині радіуси та відступи карток профілю (однаково на всіх темах). */
const CARD_RADIUS = 18;
const CARD_MARGIN = 12;

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Ряд круглих кнопок дій під шапкою профілю. */
export function ActionButtons({
  items,
}: {
  items: { key: string; icon: IconName; label: string; onPress: () => void }[];
}) {
  const c = useChatPalette();
  if (items.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: 8, paddingBottom: 4 }}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          activeOpacity={0.7}
          onPress={item.onPress}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          style={{
            flex: 1,
            marginHorizontal: 4,
            paddingVertical: 12,
            borderRadius: 16,
            backgroundColor: c.header,
            alignItems: "center",
          }}
        >
          <Ionicons name={item.icon} size={24} color={c.accent} />
          <Text
            numberOfLines={1}
            style={{ color: c.accent, fontSize: 12, fontWeight: "600", marginTop: 5 }}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Секція-картка (фон c.header, скруглена) із заголовком над карткою. */
export function Section({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const c = useChatPalette();
  return (
    <View style={{ marginTop: 16, marginHorizontal: CARD_MARGIN }}>
      {title ? (
        <Text
          numberOfLines={1}
          style={{
            color: c.accent,
            fontSize: 13.5,
            fontWeight: "700",
            letterSpacing: 0.2,
            paddingHorizontal: 16,
            paddingBottom: 7,
          }}
        >
          {title}
        </Text>
      ) : null}
      <View style={{ backgroundColor: c.header, borderRadius: CARD_RADIUS, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}

/** Рядок інформації у стилі Telegram: значення зверху, підпис знизу. */
export function InfoRow({
  icon,
  value,
  label,
  placeholder,
  onPress,
  onLongPress,
  first,
}: {
  icon: IconName;
  value?: string;
  label: string;
  /** Показується замість значення, коли його немає (рядок тоді викликає onPress). */
  placeholder?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  first?: boolean;
}) {
  const c = useChatPalette();
  const empty = !value;
  return (
    <TouchableOpacity
      activeOpacity={onPress || onLongPress ? 0.6 : 1}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 60,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.divider,
      }}
    >
      <View style={{ width: 26, alignItems: "center", alignSelf: "flex-start", marginTop: 5 }}>
        <Ionicons name={icon} size={22} color={c.muted} />
      </View>
      <View style={{ flex: 1, marginLeft: 16 }}>
        <Text
          numberOfLines={8}
          style={{
            color: empty ? c.accent : c.text,
            fontSize: 16,
            lineHeight: 22,
          }}
        >
          {empty ? placeholder : value}
        </Text>
        <Text style={{ color: c.muted, fontSize: 13, marginTop: 1 }}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

/** Дві (або більше) картки зі статистикою в рядок. */
export function StatsRow({ items }: { items: { value: number | string; label: string }[] }) {
  const c = useChatPalette();
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: 10, paddingVertical: 12 }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={{
            flex: 1,
            marginHorizontal: 4,
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: "center",
            backgroundColor: withAlpha(c.accent, 0.1),
            borderWidth: 1,
            borderColor: withAlpha(c.accent, 0.12),
          }}
        >
          <Text style={{ color: c.text, fontSize: 24, fontWeight: "700" }}>{item.value}</Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 3 }}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Копіювання по тапу з коротким тостом «Скопійовано» (повертає колбек і готовий вузол тосту). */
export function useCopyToast() {
  const c = useChatPalette();
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async (text: string, label = "Скопійовано") => {
    const result = await copyText(text);
    if (result !== "copied") return;
    void Haptics.selectionAsync();
    setMsg(label);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 1600);
  }, []);

  const toast = msg ? (
    <Animated.View
      key={msg}
      pointerEvents="none"
      entering={FadeInDown.duration(180)}
      exiting={FadeOut.duration(160)}
      style={{ position: "absolute", left: 0, right: 0, bottom: 110, alignItems: "center", zIndex: 50 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          height: 40,
          paddingHorizontal: 16,
          borderRadius: 20,
          backgroundColor: "rgba(28,28,30,0.94)",
        }}
      >
        <Ionicons name="checkmark-circle" size={18} color="#34C759" />
        <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>{msg}</Text>
      </View>
    </Animated.View>
  ) : null;

  return { copy, toast };
}

function SkeletonBlock({ w, h, r = 8, style }: { w: number | `${number}%`; h: number; r?: number; style?: object }) {
  const c = useChatPalette();
  return <View style={[{ width: w, height: h, borderRadius: r, backgroundColor: withAlpha(c.muted, 0.22) }, style]} />;
}

/** Плейсхолдер профілю на час завантаження: пульсуючі блоки замість спінера. */
export function ProfileSkeleton() {
  const c = useChatPalette();
  const { width } = useWindowDimensions();
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 850 }), -1, true);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={{ flex: 1, backgroundColor: c.divider }}>
      <Animated.View style={pulseStyle}>
        <View
          style={{
            height: 290,
            alignItems: "center",
            justifyContent: "flex-end",
            paddingBottom: 28,
            backgroundColor: withAlpha(c.accent, 0.1),
          }}
        >
          <View
            style={{
              width: 104,
              height: 104,
              borderRadius: 52,
              backgroundColor: withAlpha(c.muted, 0.28),
            }}
          />
          <SkeletonBlock w={Math.min(200, width * 0.5)} h={20} r={10} style={{ marginTop: 16 }} />
          <SkeletonBlock w={Math.min(110, width * 0.3)} h={13} r={7} style={{ marginTop: 10 }} />
        </View>
        {[0, 1].map((k) => (
          <View
            key={k}
            style={{ marginTop: 16, marginHorizontal: CARD_MARGIN, borderRadius: CARD_RADIUS, backgroundColor: c.header, padding: 16, gap: 18 }}
          >
            {[0, 1].map((r) => (
              <View key={r} style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                <SkeletonBlock w={24} h={24} r={12} />
                <View style={{ flex: 1, gap: 7 }}>
                  <SkeletonBlock w={r === 0 ? "62%" : "44%"} h={15} />
                  <SkeletonBlock w="28%" h={11} />
                </View>
              </View>
            ))}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}
