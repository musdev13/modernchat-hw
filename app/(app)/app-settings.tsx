import { EditProfileModal, ProfileField } from "@/components/EditProfileModal";
import { GlassProvider, GlassSurface, GlassTarget } from "@/components/Glass";
import { RoomAvatar } from "@/components/RoomAvatar";
import { THEMES, THEME_ORDER } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { api } from "@/convex/_generated/api";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { useSignOut } from "@/hooks/useSignOut";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useFocusEffect, useRouter } from "expo-router";
import { ComponentProps, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
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

type IconName = ComponentProps<typeof Ionicons>["name"];

const BAR_TOP_GAP = 6;
const BAR_BUTTON = 44;

function SettingsRow({
  icon,
  tint,
  label,
  value,
  onPress,
  danger,
  first,
  chevron = true,
}: {
  icon: IconName;
  tint: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  first?: boolean;
  chevron?: boolean;
}) {
  const c = useChatPalette();
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.6 : 1}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 16,
        paddingRight: 14,
        minHeight: 54,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          backgroundColor: tint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={18} color="#FFFFFF" />
      </View>
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          marginLeft: 14,
          minHeight: 54,
          borderTopWidth: first ? 0 : 1,
          borderTopColor: c.divider,
        }}
      >
        <Text
          style={{
            flex: 1,
            color: danger ? c.danger : c.text,
            fontSize: 16,
            fontWeight: danger ? "600" : "400",
          }}
        >
          {label}
        </Text>
        {value ? (
          <Text numberOfLines={1} style={{ color: c.muted, fontSize: 15, maxWidth: "50%", marginLeft: 8 }}>
            {value}
          </Text>
        ) : null}
        {onPress && chevron && !danger ? (
          <Ionicons name="chevron-forward" size={18} color={c.muted} style={{ marginLeft: 6 }} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function SectionTitle({ text }: { text: string }) {
  const c = useChatPalette();
  return (
    <Text
      style={{
        color: c.accent,
        fontSize: 14,
        fontWeight: "700",
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 6,
      }}
    >
      {text}
    </Text>
  );
}

export default function AppSettingsScreen() {
  const router = useRouter();
  const c = useChatPalette();
  const { themeId, setThemeId } = useTheme();
  const insets = useSafeAreaInsets();
  const signOut = useSignOut();

  const currentUser = useQuery(api.users.currentUser);
  const [editVisible, setEditVisible] = useState(false);
  const [focusField, setFocusField] = useState<ProfileField | undefined>();
  const [notifStatus, setNotifStatus] = useState<Notifications.PermissionStatus | null>(null);
  const [canAsk, setCanAsk] = useState(true);

  const refreshNotifications = useCallback(async () => {
    try {
      const perms = await Notifications.getPermissionsAsync();
      setNotifStatus(perms.status);
      setCanAsk(perms.canAskAgain);
    } catch {
      setNotifStatus(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshNotifications();
    }, [refreshNotifications]),
  );

  // Повертаємось із системних налаштувань — оновлюємо стан дозволу.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshNotifications();
    });
    return () => sub.remove();
  }, [refreshNotifications]);

  const handleNotifications = useCallback(async () => {
    if (notifStatus === "undetermined" && canAsk) {
      await Notifications.requestPermissionsAsync();
      await refreshNotifications();
      return;
    }
    try {
      await Linking.openSettings();
    } catch {
      // нічого: системні налаштування недоступні
    }
  }, [canAsk, notifStatus, refreshNotifications]);

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
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const appName = Constants.expoConfig?.name ?? "Modern Chat";

  if (currentUser === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.divider }}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const notifValue =
    notifStatus === "granted"
      ? "Увімкнено"
      : notifStatus === "denied"
        ? "Вимкнено"
        : notifStatus === "undetermined"
          ? "Не налаштовано"
          : "";

  return (
    <GlassProvider>
      <View style={{ flex: 1, backgroundColor: c.divider }}>
        <GlassTarget style={{ flex: 1, backgroundColor: c.divider }}>
          <Animated.ScrollView
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: barBottom + 8, paddingBottom: insets.bottom + 32 }}
          >
            <Animated.Text
              style={[
                { color: c.text, fontSize: 30, fontWeight: "800", paddingHorizontal: 16, paddingBottom: 12 },
                bigTitleStyle,
              ]}
            >
              Налаштування
            </Animated.Text>

            {/* Профіль */}
            {currentUser && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.back()}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: c.header,
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
                  <Text numberOfLines={1} style={{ color: c.text, fontSize: 18, fontWeight: "700" }}>
                    {currentUser.name ?? "Користувач"}
                  </Text>
                  <Text numberOfLines={1} style={{ color: c.muted, fontSize: 14, marginTop: 2 }}>
                    {currentUser.username ? `@${currentUser.username}` : (currentUser.email ?? "")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.muted} />
              </TouchableOpacity>
            )}

            {/* Акаунт */}
            <View style={{ backgroundColor: c.header, marginTop: 10 }}>
              <SectionTitle text="Акаунт" />
              <SettingsRow
                first
                icon="person-circle-outline"
                tint="#3B82F6"
                label="Редагувати профіль"
                onPress={() => openEdit()}
              />
              <SettingsRow
                icon="at"
                tint="#8B5CF6"
                label="Ім'я користувача"
                value={currentUser?.username ? `@${currentUser.username}` : "Не вказано"}
                onPress={() => openEdit("username")}
              />
              <SettingsRow
                icon="information-circle-outline"
                tint="#F59E0B"
                label="Про себе"
                value={currentUser?.bio ? currentUser.bio : "Не вказано"}
                onPress={() => openEdit("bio")}
              />
            </View>

            {/* Тема оформлення */}
            <View style={{ backgroundColor: c.header, marginTop: 10, paddingBottom: 12 }}>
              <SectionTitle text="Тема оформлення" />
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  paddingHorizontal: 12,
                  paddingTop: 4,
                }}
              >
                {THEME_ORDER.map((id) => {
                  const t = THEMES[id];
                  const selected = id === themeId;
                  return (
                    <TouchableOpacity
                      key={id}
                      onPress={() => setThemeId(id)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Тема: ${t.name}`}
                      accessibilityState={{ selected }}
                      style={{ width: "50%", padding: 4 }}
                    >
                      <View
                        style={{
                          borderRadius: 16,
                          padding: 8,
                          borderWidth: 2,
                          borderColor: selected ? t.colors.accent : withAlpha(c.muted, 0.25),
                          backgroundColor: c.search,
                        }}
                      >
                        {/* Міні-перегляд чату */}
                        <View
                          style={{
                            borderRadius: 10,
                            overflow: "hidden",
                            backgroundColor: t.colors.divider,
                            height: 78,
                          }}
                        >
                          <View style={{ height: 16, backgroundColor: t.colors.header }} />
                          <View style={{ padding: 6 }}>
                            <View
                              style={{
                                alignSelf: "flex-start",
                                width: "62%",
                                height: 14,
                                borderRadius: 7,
                                backgroundColor: t.isDark ? t.colors.search : t.colors.bg,
                              }}
                            />
                            <View
                              style={{
                                alignSelf: "flex-end",
                                width: "52%",
                                height: 14,
                                borderRadius: 7,
                                marginTop: 5,
                                backgroundColor: t.colors.accent,
                              }}
                            />
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                          <Text
                            numberOfLines={1}
                            style={{
                              flex: 1,
                              color: c.text,
                              fontSize: 13,
                              fontWeight: selected ? "700" : "500",
                            }}
                          >
                            {t.name}
                          </Text>
                          {selected && (
                            <Ionicons name="checkmark-circle" size={18} color={t.colors.accent} />
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Сповіщення */}
            <View style={{ backgroundColor: c.header, marginTop: 10 }}>
              <SectionTitle text="Сповіщення" />
              <SettingsRow
                first
                icon="notifications-outline"
                tint="#EF4444"
                label="Push-сповіщення"
                value={notifValue}
                onPress={handleNotifications}
              />
              <Text
                style={{
                  color: c.muted,
                  fontSize: 13,
                  lineHeight: 18,
                  paddingHorizontal: 16,
                  paddingTop: 2,
                  paddingBottom: 12,
                }}
              >
                {notifStatus === "granted"
                  ? "Сповіщення про нові повідомлення приходять на цей пристрій. Вимкнути їх для окремої кімнати можна в інформації про кімнату. Системні налаштування відкриються по натисканню."
                  : "Дозвольте сповіщення в системних налаштуваннях, щоб отримувати нові повідомлення. Вимкнути їх для окремої кімнати можна в інформації про кімнату."}
              </Text>
            </View>

            {/* Про застосунок */}
            <View style={{ backgroundColor: c.header, marginTop: 10 }}>
              <SectionTitle text="Про застосунок" />
              <SettingsRow
                first
                icon="chatbubbles-outline"
                tint="#10B981"
                label={appName}
                value={`Версія ${appVersion}`}
              />
            </View>

            {/* Вихід */}
            <View style={{ backgroundColor: c.header, marginTop: 10 }}>
              <SettingsRow
                first
                icon="log-out-outline"
                tint={c.danger}
                label="Вийти з акаунта"
                danger
                onPress={signOut}
              />
            </View>
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
            <GlassSurface
              radius={BAR_BUTTON / 2}
              intensity={75}
              style={{ width: BAR_BUTTON, height: BAR_BUTTON }}
              contentStyle={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            >
              <TouchableOpacity
                onPress={() => router.back()}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Назад"
                style={{ width: BAR_BUTTON, height: BAR_BUTTON, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="arrow-back" size={22} color={c.text} />
              </TouchableOpacity>
            </GlassSurface>

            <Animated.View pointerEvents="none" style={[{ marginLeft: 10 }, barTitleStyle]}>
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

        <EditProfileModal
          visible={editVisible}
          initialName={currentUser?.name ?? ""}
          initialUsername={currentUser?.username}
          initialBio={currentUser?.bio}
          initialImage={currentUser?.image}
          focusField={focusField}
          onClose={() => setEditVisible(false)}
          onSaved={() => setEditVisible(false)}
        />
      </View>
    </GlassProvider>
  );
}
