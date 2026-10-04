import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { copyText } from "@/utils/clipboard";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ComponentProps, ReactNode, memo, useCallback, useEffect, useRef, useState } from "react";
import { Image as ExpoImage } from "expo-image";
import { Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { SheetAction } from "@/components/ActionSheet";
import { PopoverMenu } from "@/components/PopoverMenu";
import { RoomAvatar } from "@/components/RoomAvatar";
import { membersLabel } from "@/utils/chat";

/** Єдині радіуси та відступи карток профілю (однаково на всіх темах). */
const CARD_RADIUS = 18;
const CARD_MARGIN = 12;

type IconName = ComponentProps<typeof Ionicons>["name"];

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

/** Меню довгого натискання на рядок інформації: один ActionSheet на екран. */
export function useRowMenu() {
  const [menu, setMenu] = useState<{ title: string; actions: SheetAction[] } | null>(null);
  const open = useCallback((title: string, actions: SheetAction[]) => setMenu({ title, actions }), []);
  const sheet = (
    <PopoverMenu
      visible={!!menu}
      onClose={() => setMenu(null)}
      placement="center"
      title={menu?.title}
      actions={menu?.actions ?? []}
    />
  );
  return { open, sheet };
}

export interface ProfileTabItem {
  key: string;
  label: string;
}

/** Вкладки профілю з ковзною «пігулкою» під активною (як у Telegram). */
export const ProfileTabs = memo(function ProfileTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: ProfileTabItem[];
  active: string;
  onChange: (key: string) => void;
}) {
  const c = useChatPalette();
  const [width, setWidth] = useState(0);
  const pad = 4;
  const itemW = width > 0 ? (width - pad * 2) / tabs.length : 0;
  const idx = Math.max(0, tabs.findIndex((t) => t.key === active));
  const x = useSharedValue(0);
  const ready = useRef(false);

  useEffect(() => {
    const target = idx * itemW;
    if (!ready.current && itemW > 0) {
      x.value = target;
      ready.current = true;
    } else {
      x.value = withSpring(target, { damping: 22, stiffness: 260, mass: 0.7 });
    }
  }, [idx, itemW, x]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        marginTop: 16,
        marginHorizontal: CARD_MARGIN,
        padding: pad,
        flexDirection: "row",
        borderRadius: 22,
        backgroundColor: c.header,
      }}
    >
      {itemW > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: pad,
              top: pad,
              bottom: pad,
              width: itemW,
              borderRadius: 18,
              backgroundColor: withAlpha(c.accent, 0.16),
            },
            pillStyle,
          ]}
        />
      ) : null}
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <TouchableOpacity
            key={t.key}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (!on) {
                void Haptics.selectionAsync();
                onChange(t.key);
              }
            }}
            style={{ flex: 1, height: 38, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: on ? c.accent : c.muted, fontSize: 14.5, fontWeight: on ? "700" : "600" }}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

/** Сітка фото профілю: 3 колонки, кеш expo-image. */
export const PhotoGrid = memo(function PhotoGrid({
  photos,
  onPress,
  emptyText = "Фото ще немає",
}: {
  photos: { id: string; url: string; kind?: "photo" | "video" | "gif"; animUrl?: string }[];
  onPress: (index: number) => void;
  emptyText?: string;
}) {
  const c = useChatPalette();
  const { width } = useWindowDimensions();
  const gap = 3;
  const inner = width - CARD_MARGIN * 2;
  const size = Math.floor((inner - gap * 2) / 3);

  if (photos.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 36 }}>
        <Ionicons name="images-outline" size={44} color={withAlpha(c.muted, 0.7)} />
        <Text style={{ color: c.muted, fontSize: 14.5, marginTop: 10 }}>{emptyText}</Text>
      </View>
    );
  }
  return (
    <View
      style={{
        marginTop: 12,
        marginHorizontal: CARD_MARGIN,
        flexDirection: "row",
        flexWrap: "wrap",
        gap,
        borderRadius: CARD_RADIUS,
        overflow: "hidden",
      }}
    >
      {photos.map((p, i) => (
        <TouchableOpacity key={p.id} activeOpacity={0.8} onPress={() => onPress(i)}>
          <ExpoImage
            source={{ uri: p.url }}
            recyclingKey={p.id}
            cachePolicy="memory-disk"
            contentFit="cover"
            transition={140}
            style={{ width: size, height: size, backgroundColor: withAlpha(c.muted, 0.2) }}
          />
          {p.kind && p.kind !== "photo" && p.animUrl ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 5,
                bottom: 5,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 6,
                height: 20,
                borderRadius: 10,
                backgroundColor: "rgba(0,0,0,0.6)",
              }}
            >
              <Ionicons name="play" size={10} color="#FFFFFF" />
              <Ionicons name="repeat" size={12} color="#FFFFFF" style={{ marginLeft: 3 }} />
              {p.kind === "gif" ? (
                <Text style={{ color: "#FFFFFF", fontSize: 9.5, fontWeight: "800", marginLeft: 3 }}>GIF</Text>
              ) : null}
            </View>
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
  );
});

export interface RoomListItem {
  _id: string;
  title: string;
  avatarUrl?: string | null;
  memberCount: number;
}

/** Список груп/кімнат (вкладка «Групи»). */
export const RoomsList = memo(function RoomsList({
  rooms,
  onPress,
  emptyText = "Спільних груп немає",
}: {
  rooms: RoomListItem[];
  onPress: (id: string) => void;
  emptyText?: string;
}) {
  const c = useChatPalette();
  if (rooms.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 36 }}>
        <Ionicons name="people-outline" size={44} color={withAlpha(c.muted, 0.7)} />
        <Text style={{ color: c.muted, fontSize: 14.5, marginTop: 10 }}>{emptyText}</Text>
      </View>
    );
  }
  return (
    <Section>
      {rooms.map((room, i) => (
        <TouchableOpacity
          key={room._id}
          activeOpacity={0.6}
          onPress={() => onPress(room._id)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 9,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: c.divider,
          }}
        >
          <RoomAvatar title={room.title} imageUrl={room.avatarUrl ?? undefined} size={44} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
              {room.title}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13, marginTop: 1 }}>{membersLabel(room.memberCount)}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </Section>
  );
});
