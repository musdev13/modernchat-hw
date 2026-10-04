import { EditProfileModal, ProfileField } from "@/components/EditProfileModal";
import { GlassProvider, GlassSurface, GlassTarget } from "@/components/Glass";
import { MainTabBar, useTabBarSpace } from "@/components/MainTabBar";
import { RoomAvatar } from "@/components/RoomAvatar";
import { ThemeGlow } from "@/components/SpaceBackdrop";
import { SearchField } from "@/components/SearchField";
import { Group, IconName, NavRow } from "@/components/SettingsUI";
import { THEMES } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { api } from "@/convex/_generated/api";
import { NameBadges } from "@/components/PremiumBadge";
import { PREMIUM_GOLD } from "@/constants/premium";
import { useChatPalette } from "@/hooks/useChatPalette";
import { formatPremiumUntil, usePremium } from "@/hooks/usePremium";
import { useSignOut } from "@/hooks/useSignOut";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BAR_TOP_GAP = 6;
const BAR_BUTTON = 44;

interface CatalogItem {
  key: string;
  label: string;
  icon: IconName;
  tint: string;
  keywords: string;
  go: () => void;
}

export default function PreferencesScreen() {
  const router = useRouter();
  const c = useChatPalette();
  const { themeId } = useTheme();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const signOut = useSignOut();
  const premium = usePremium();

  const currentUser = useQuery(api.users.currentUser);
  const [editVisible, setEditVisible] = useState(false);
  const [focusField, setFocusField] = useState<ProfileField | undefined>();
  const [query, setQuery] = useState("");

  const openEdit = (field?: ProfileField) => {
    setFocusField(field);
    setEditVisible(true);
  };

  // Заголовок у панелі з'являється, коли великий заголовок прокручено.
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const barTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [20, 60], [0, 1], Extrapolation.CLAMP),
  }));
  const bigTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 50], [1, 0], Extrapolation.CLAMP),
  }));

  const barBottom = insets.top + BAR_TOP_GAP + BAR_BUTTON;

  if (currentUser === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.divider }}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const go = (path: string) => router.push(path as any);
  const catalog: CatalogItem[] = [
    { key: "edit", label: "Редагувати профіль", icon: "person-circle-outline", tint: "#3B82F6", keywords: "профіль ім'я фото аватар імя", go: () => openEdit() },
    { key: "username", label: "Ім'я користувача", icon: "at", tint: "#8B5CF6", keywords: "username нік логін", go: () => openEdit("username") },
    { key: "bio", label: "Про себе", icon: "information-circle-outline", tint: "#F59E0B", keywords: "біо опис статус", go: () => openEdit("bio") },
    { key: "premium", label: "Modesto Premium", icon: "star", tint: PREMIUM_GOLD, keywords: "преміум premium підписка зірка історії емодзі статус аватар теми", go: () => go("/(app)/prefs/premium") },
    ...(premium.isAdmin
      ? [{ key: "admin", label: "Адмін-панель", icon: "shield-checkmark" as IconName, tint: "#EF4444", keywords: "адмін admin преміум видати відкликати", go: () => go("/(app)/prefs/admin") }]
      : []),
    { key: "notif", label: "Сповіщення та звуки", icon: "notifications", tint: "#EF4444", keywords: "push пуш звук банер текст повідомлення групи канали", go: () => go("/(app)/prefs/notifications") },
    { key: "privacy", label: "Конфіденційність", icon: "lock-closed", tint: "#10B981", keywords: "приватність останній вхід телефон номер друкує набір тексту", go: () => go("/(app)/prefs/privacy") },
    { key: "data", label: "Дані та пам'ять", icon: "server", tint: "#3B82F6", keywords: "кеш автозавантаження фото відео пам'ять очистити", go: () => go("/(app)/prefs/data") },
    { key: "appearance", label: "Оформлення", icon: "color-palette", tint: "#EC4899", keywords: "тема темна розмір тексту шрифт кути бульбашки анімації зорі фон", go: () => go("/(app)/prefs/appearance") },
    { key: "folders", label: "Папки з чатами", icon: "folder", tint: "#F59E0B", keywords: "вкладки групи канали особисті непрочитані", go: () => go("/(app)/prefs/folders") },
    { key: "language", label: "Мова", icon: "language", tint: "#06B6D4", keywords: "українська english мова", go: () => go("/(app)/prefs/language") },
    { key: "about", label: "Про застосунок", icon: "information-circle", tint: "#6B7280", keywords: "версія збірка інформація", go: () => go("/(app)/prefs/about") },
    { key: "logout", label: "Вийти з акаунта", icon: "log-out-outline", tint: c.danger, keywords: "вихід вийти logout", go: signOut },
  ];
  const q = query.trim().toLowerCase();
  const results = q
    ? catalog.filter((i) => i.label.toLowerCase().includes(q) || i.keywords.toLowerCase().includes(q))
    : null;

  return (
    <GlassProvider>
      <View style={{ flex: 1, backgroundColor: c.divider }}>
        <GlassTarget style={{ flex: 1, backgroundColor: c.divider }}>
          {c.premium ? <ThemeGlow color={c.glow} /> : null}
          <Animated.ScrollView
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: barBottom + 8, paddingBottom: tabSpace + 24 }}
          >
            <Animated.Text
              style={[
                { color: c.text, fontSize: 30, fontWeight: "800", paddingHorizontal: 16, paddingBottom: 12 },
                bigTitleStyle,
              ]}
            >
              Налаштування
            </Animated.Text>

            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="Пошук у налаштуваннях"
              style={{ marginHorizontal: 12, marginBottom: 4 }}
            />

            {results ? (
              results.length > 0 ? (
                <Group title="Результати">
                  {results.map((i) => (
                    <NavRow key={i.key} icon={i.icon} tint={i.tint} label={i.label} onPress={i.go} danger={i.key === "logout"} />
                  ))}
                </Group>
              ) : (
                <Text style={{ color: c.muted, fontSize: 15, textAlign: "center", marginTop: 40 }}>
                  Нічого не знайдено
                </Text>
              )
            ) : (
              <>
            {/* Профіль */}
            {currentUser && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.navigate("/(app)/(tabs)/profile" as any)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: c.header,
                  marginHorizontal: 12,
                  marginTop: 10,
                  borderRadius: 18,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <RoomAvatar
                  title={currentUser.name ?? "?"}
                  imageUrl={currentUser.image}
                  size={60}
                />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text numberOfLines={1} style={{ color: c.text, fontSize: 18, fontWeight: "700", flexShrink: 1 }}>
                      {currentUser.name ?? "Користувач"}
                    </Text>
                    <NameBadges premium={premium.isPremium} emoji={currentUser.emojiStatus} size={16} />
                  </View>
                  <Text numberOfLines={1} style={{ color: c.muted, fontSize: 14, marginTop: 2 }}>
                    {currentUser.username ? `@${currentUser.username}` : (currentUser.email ?? "")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.muted} />
              </TouchableOpacity>
            )}

            <Group>
              <NavRow
                icon="star"
                tint={PREMIUM_GOLD}
                label="Modesto Premium"
                value={premium.isPremium ? formatPremiumUntil(premium) : undefined}
                onPress={() => go("/(app)/prefs/premium")}
              />
              {premium.isAdmin ? (
                <NavRow icon="shield-checkmark" tint="#EF4444" label="Адмін-панель" onPress={() => go("/(app)/prefs/admin")} />
              ) : null}
            </Group>

            <Group title="Акаунт">
              <NavRow icon="person-circle-outline" tint="#3B82F6" label="Редагувати профіль" onPress={() => openEdit()} />
              <NavRow
                icon="at"
                tint="#8B5CF6"
                label="Ім'я користувача"
                value={currentUser?.username ? `@${currentUser.username}` : "Не вказано"}
                onPress={() => openEdit("username")}
              />
              <NavRow
                icon="information-circle-outline"
                tint="#F59E0B"
                label="Про себе"
                value={currentUser?.bio ? currentUser.bio : "Не вказано"}
                onPress={() => openEdit("bio")}
              />
            </Group>

            <Group>
              <NavRow icon="notifications" tint="#EF4444" label="Сповіщення та звуки" onPress={() => go("/(app)/prefs/notifications")} />
              <NavRow icon="lock-closed" tint="#10B981" label="Конфіденційність" onPress={() => go("/(app)/prefs/privacy")} />
              <NavRow icon="server" tint="#3B82F6" label="Дані та пам'ять" onPress={() => go("/(app)/prefs/data")} />
              <NavRow
                icon="color-palette"
                tint="#EC4899"
                label="Оформлення"
                value={THEMES[themeId].name}
                onPress={() => go("/(app)/prefs/appearance")}
              />
              <NavRow icon="folder" tint="#F59E0B" label="Папки з чатами" onPress={() => go("/(app)/prefs/folders")} />
              <NavRow icon="language" tint="#06B6D4" label="Мова" value="Українська" onPress={() => go("/(app)/prefs/language")} />
            </Group>

            <Group>
              <NavRow icon="information-circle" tint="#6B7280" label="Про застосунок" onPress={() => go("/(app)/prefs/about")} />
            </Group>

            <Group>
              <NavRow icon="log-out-outline" tint={c.danger} label="Вийти з акаунта" danger onPress={signOut} />
            </Group>
              </>
            )}
          </Animated.ScrollView>
        </GlassTarget>

        {/* Скляна панель */}
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30 }}
        >
          <View
            pointerEvents="box-none"
            style={{
              marginTop: insets.top + BAR_TOP_GAP,
              marginHorizontal: 12,
              height: BAR_BUTTON,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Animated.View pointerEvents="none" style={barTitleStyle}>
              <GlassSurface
                radius={BAR_BUTTON / 2}
                intensity={75}
                style={{ height: BAR_BUTTON }}
                contentStyle={{ flex: 1, justifyContent: "center", paddingHorizontal: 18 }}
              >
                <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>Налаштування</Text>
              </GlassSurface>
            </Animated.View>
          </View>
        </View>

        <MainTabBar active="preferences" />

        <EditProfileModal
          visible={editVisible}
          initialName={currentUser?.name ?? ""}
          initialUsername={currentUser?.username}
          initialBio={currentUser?.bio}
          initialImage={currentUser?.image}
          initialBirthday={currentUser?.birthday}
          initialPhone={currentUser?.phone}
          focusField={focusField}
          onClose={() => setEditVisible(false)}
          onSaved={() => setEditVisible(false)}
        />
      </View>
    </GlassProvider>
  );
}
