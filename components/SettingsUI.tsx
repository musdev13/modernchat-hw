import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Children,
  ComponentProps,
  ReactElement,
  ReactNode,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
} from "react";
import { ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type IconName = ComponentProps<typeof Ionicons>["name"];

/** Екран підрозділу налаштувань: кругла кнопка «Назад», заголовок, прокручуваний вміст. */
export function SettingsPage({ title, children }: { title: string; children: ReactNode }) {
  const c = useChatPalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: c.divider }}>
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 12,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: c.divider,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Назад"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(c.header, 0.9),
            borderWidth: 1,
            borderColor: withAlpha(c.muted, 0.22),
          }}
        >
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 21, fontWeight: "800", marginLeft: 14, flex: 1 }}>
          {title}
        </Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Згрупована картка з відступами (inset) та необов'язковим заголовком/приміткою. */
export function Group({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const c = useChatPalette();
  const kids = Children.toArray(children).filter(Boolean);
  return (
    <View style={{ marginTop: 18, marginHorizontal: 12 }}>
      {title ? (
        <Text
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
      <View style={{ backgroundColor: c.header, borderRadius: 18, overflow: "hidden" }}>
        {kids.map((k, i) => (isValidElement(k) ? cloneElement(k as ReactElement<any>, { first: i === 0 }) : k))}
      </View>
      {footer ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, paddingHorizontal: 16, paddingTop: 8 }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

/** Кольоровий скруглений квадрат з іконкою (стиль налаштувань Telegram). */
export function IconBadge({ icon, tint, size = 30 }: { icon: IconName; tint: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        backgroundColor: tint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={Math.round(size * 0.6)} color="#FFFFFF" />
    </View>
  );
}

interface RowBase {
  icon?: IconName;
  tint?: string;
  label: string;
  sub?: string;
  first?: boolean;
}

function RowShell({
  icon,
  tint,
  label,
  sub,
  first,
  onPress,
  danger,
  right,
  disabled,
}: RowBase & { onPress?: () => void; danger?: boolean; right?: ReactNode; disabled?: boolean }) {
  const c = useChatPalette();
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.6 : 1}
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={{ flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 14, minHeight: 54, opacity: disabled ? 0.5 : 1 }}
    >
      {icon ? <IconBadge icon={icon} tint={tint ?? c.accent} /> : null}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          marginLeft: icon ? 14 : 0,
          minHeight: 54,
          paddingVertical: 8,
          borderTopWidth: first ? 0 : 1,
          borderTopColor: c.divider,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: danger ? c.danger : c.text, fontSize: 16, fontWeight: danger ? "600" : "400" }}>
            {label}
          </Text>
          {sub ? <Text style={{ color: c.muted, fontSize: 13, marginTop: 2, lineHeight: 17 }}>{sub}</Text> : null}
        </View>
        {right}
      </View>
    </TouchableOpacity>
  );
}

/** Рядок-навігація: значення справа та шеврон. */
export function NavRow(
  props: RowBase & { value?: string; onPress?: () => void; danger?: boolean; chevron?: boolean; disabled?: boolean },
) {
  const c = useChatPalette();
  const { value, chevron = true, ...rest } = props;
  return (
    <RowShell
      {...rest}
      right={
        <>
          {value ? (
            <Text numberOfLines={1} style={{ color: c.muted, fontSize: 15, maxWidth: "46%", marginLeft: 8 }}>
              {value}
            </Text>
          ) : null}
          {props.onPress && chevron && !props.danger ? (
            <Ionicons name="chevron-forward" size={18} color={c.muted} style={{ marginLeft: 6 }} />
          ) : null}
        </>
      }
    />
  );
}

/** Рядок з перемикачем. */
export function SwitchRow(props: RowBase & { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const c = useChatPalette();
  const { value, onChange, ...rest } = props;
  return (
    <RowShell
      {...rest}
      onPress={() => {
        void Haptics.selectionAsync();
        onChange(!value);
      }}
      right={
        <Switch
          value={value}
          disabled={props.disabled}
          onValueChange={(v) => {
            void Haptics.selectionAsync();
            onChange(v);
          }}
          trackColor={{ false: withAlpha(c.muted, 0.35), true: withAlpha(c.accent, 0.65) }}
          thumbColor={value ? c.accent : "#E5E7EB"}
        />
      }
    />
  );
}

/** Рядок вибору (галочка справа у вибраного). */
export function CheckRow(props: RowBase & { selected: boolean; onPress?: () => void; trailing?: string; disabled?: boolean }) {
  const c = useChatPalette();
  const { selected, trailing, ...rest } = props;
  return (
    <RowShell
      {...rest}
      right={
        <>
          {trailing ? (
            <Text style={{ color: c.muted, fontSize: 13, marginRight: 8 }}>{trailing}</Text>
          ) : null}
          {selected ? <Ionicons name="checkmark-circle" size={22} color={c.accent} /> : null}
        </>
      }
    />
  );
}

/**
 * Повзунок із кроками. Тягнеться на UI-потоці; значення віддається у JS лише при зміні кроку
 * (onLive — для прев'ю) і при відпусканні (onCommit — для збереження).
 */
export function StepSlider({
  min,
  max,
  step,
  value,
  onLive,
  onCommit,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onLive?: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const c = useChatPalette();
  const [w, setW] = useState(0);
  const steps = Math.round((max - min) / step);
  const pos = useSharedValue((value - min) / (max - min));
  const lastIdx = useSharedValue(Math.round(((value - min) / (max - min)) * steps));
  const THUMB = 26;

  useEffect(() => {
    pos.value = (value - min) / (max - min);
    lastIdx.value = Math.round(pos.value * steps);
  }, [value, min, max, steps, pos, lastIdx]);

  const toValue = (idx: number) => Math.round((min + idx * step) * 1000) / 1000;
  const emitLive = (idx: number) => onLive?.(toValue(idx));
  const emitCommit = (idx: number) => onCommit(toValue(idx));
  const tick = () => {
    void Haptics.selectionAsync();
  };

  const gesture = Gesture.Pan()
    .minDistance(0)
    .activeOffsetX([-3, 3])
    .failOffsetY([-14, 14])
    .onBegin((e) => {
      if (w <= 0) return;
      const p = Math.min(1, Math.max(0, (e.x - THUMB / 2) / (w - THUMB)));
      pos.value = Math.round(p * steps) / steps;
    })
    .onUpdate((e) => {
      if (w <= 0) return;
      const p = Math.min(1, Math.max(0, (e.x - THUMB / 2) / (w - THUMB)));
      const idx = Math.round(p * steps);
      pos.value = idx / steps;
      if (idx !== lastIdx.value) {
        lastIdx.value = idx;
        runOnJS(emitLive)(idx);
        runOnJS(tick)();
      }
    })
    .onEnd(() => {
      runOnJS(emitCommit)(Math.round(pos.value * steps));
    });

  const fillStyle = useAnimatedStyle(() => ({ width: THUMB / 2 + pos.value * (w - THUMB) }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value * (w - THUMB) }] }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={{ height: 40, justifyContent: "center" }}
        accessibilityRole="adjustable"
      >
        <View style={{ height: 4, borderRadius: 2, backgroundColor: withAlpha(c.muted, 0.3) }} />
        <Animated.View
          style={[{ position: "absolute", left: 0, height: 4, borderRadius: 2, backgroundColor: c.accent }, fillStyle]}
        />
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: "#FFFFFF",
              borderWidth: 2,
              borderColor: c.accent,
              elevation: 3,
            },
            thumbStyle,
          ]}
        />
      </View>
    </GestureDetector>
  );
}
