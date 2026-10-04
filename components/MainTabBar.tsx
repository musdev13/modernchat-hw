import { GlassSurface } from "@/components/Glass";
import { RoomAvatar } from "@/components/RoomAvatar";
import { api } from "@/convex/_generated/api";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ComponentProps } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type MainTab = "chats" | "contacts" | "preferences" | "profile";

const BAR_HEIGHT = 64;
const BAR_MARGIN = 14;
const PILL_W = 58;
const PILL_H = 32;

const ROUTES: Record<MainTab, string> = {
  chats: "/(app)/(tabs)",
  contacts: "/(app)/(tabs)/contacts",
  preferences: "/(app)/(tabs)/preferences",
  profile: "/(app)/(tabs)/profile",
};

/** Скільки місця внизу екрана займає панель вкладок (для відступів списків). */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + BAR_MARGIN + Math.max(insets.bottom, 10) + 6;
}

/**
 * Плаваюча скляна панель вкладок: Чати | Контакти | Налаштування | Профіль.
 * Рендериться всередині GlassProvider кожного екрана вкладки (щоб розмивати саме його вміст).
 */
export function MainTabBar({ active }: { active: MainTab }) {
  const c = useChatPalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const unread = useQuery(api.reads.getUnreadCounts);
  const me = useQuery(api.users.currentUser);
  const total = unread?.total ?? 0;

  const go = (tab: MainTab) => {
    if (tab === active) return;
    void Haptics.selectionAsync();
    router.navigate(ROUTES[tab] as any);
  };

  const item = (
    tab: MainTab,
    label: string,
    icon: IconName,
    iconActive: IconName,
  ) => {
    const selected = tab === active;
    const color = selected ? c.accent : c.muted;
    return (
      <TouchableOpacity
        key={tab}
        activeOpacity={0.7}
        onPress={() => go(tab)}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        style={{ flex: 1, height: BAR_HEIGHT, alignItems: "center", justifyContent: "center" }}
      >
        <View
          style={{
            width: PILL_W,
            height: PILL_H,
            borderRadius: PILL_H / 2,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: selected ? withAlpha(c.accent, 0.2) : "transparent",
          }}
        >
          {tab === "profile" ? (
            <View
              style={{
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: selected ? c.accent : "transparent",
                padding: 1,
              }}
            >
              <RoomAvatar title={me?.name ?? "?"} imageUrl={me?.image} size={22} />
            </View>
          ) : (
            <Ionicons name={selected ? iconActive : icon} size={23} color={color} />
          )}
          {tab === "chats" && total > 0 ? (
            <View
              accessibilityLabel={`Непрочитаних: ${total}`}
              style={{
                position: "absolute",
                top: -5,
                right: 0,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                paddingHorizontal: 5,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: c.accent,
                borderWidth: 1.5,
                borderColor: c.header,
              }}
            >
              <Text style={{ color: c.onAccent, fontSize: 10, fontWeight: "800" }}>
                {total > 99 ? "99+" : total}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          style={{
            color,
            fontSize: 11,
            marginTop: 2,
            fontWeight: selected ? "700" : "500",
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: BAR_MARGIN,
        right: BAR_MARGIN,
        bottom: Math.max(insets.bottom, 10) + 6,
        zIndex: 40,
      }}
    >
      <GlassSurface
        radius={BAR_HEIGHT / 2}
        intensity={80}
        style={{ height: BAR_HEIGHT }}
        contentStyle={{ flex: 1, flexDirection: "row", paddingHorizontal: 6 }}
      >
        {item("chats", "Чати", "chatbubble-outline", "chatbubble")}
        {item("contacts", "Контакти", "people-outline", "people")}
        {item("preferences", "Налаштування", "settings-outline", "settings")}
        {item("profile", "Профіль", "person-outline", "person")}
      </GlassSurface>
    </View>
  );
}
