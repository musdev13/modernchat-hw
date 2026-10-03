import { useClerk } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EditProfileModal } from "@/components/EditProfileModal";
import { THEMES, THEME_ORDER, avatarColor, initialsOf } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { api } from "@/convex/_generated/api";

export default function ProfileScreen() {
  const { signOut } = useClerk();

  const currentUser = useQuery(api.users.currentUser);
  const removePushToken = useMutation(api.users.removePushToken);

  const profileDetails = useQuery(
    api.users.getUserProfile,
    currentUser?._id ? { userId: currentUser._id } : "skip",
  );

  const [editVisible, setEditVisible] = useState(false);
  const { themeId, setThemeId, colors: c } = useTheme();

  if (currentUser === undefined || profileDetails === undefined) {
    return (
      <SafeAreaView
        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.divider }}
      >
        <ActivityIndicator size="large" color={c.accent} />
      </SafeAreaView>
    );
  }

  if (!currentUser || !profileDetails) {
    return (
      <SafeAreaView
        style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, backgroundColor: c.divider }}
      >
        <Text style={{ color: c.text, fontSize: 18, textAlign: "center" }}>
          Не вдалося завантажити профіль
        </Text>
      </SafeAreaView>
    );
  }

  const handleSignOut = () => {
    Alert.alert("Вихід", "Ти впевнений, що хочеш вийти?", [
      { text: "Скасувати", style: "cancel" },
      {
        text: "Вийти",
        style: "destructive",
        onPress: async () => {
          try {
            // 1. Удаляем push-токен из БД ДО выхода
            try {
              await removePushToken();
            } catch (err) {
              console.error("Failed to remove push token:", err);
            }

            // 2. Локально гасим все уведомления на этом устройстве
            await Notifications.dismissAllNotificationsAsync();
            await Notifications.cancelAllScheduledNotificationsAsync();

            // 3. Выходим из Clerk
            await signOut();

            // 4. Редирект
            router.replace("/(auth)/login");
          } catch (error) {
            console.error(error);
          }
        },
      },
    ]);
  };

  const card = {
    backgroundColor: c.header,
    borderRadius: 16,
    padding: 16,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.divider }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: c.divider }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            accessibilityRole="button"
            accessibilityLabel="Назад"
          >
            <Ionicons name="arrow-back" size={24} color={c.text} />
          </TouchableOpacity>

          <Text style={{ color: c.text, fontSize: 18, fontWeight: "700" }}>Профіль</Text>

          <TouchableOpacity
            onPress={() => setEditVisible(true)}
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            accessibilityRole="button"
            accessibilityLabel="Редагувати профіль"
          >
            <Ionicons name="pencil" size={21} color={c.accent} />
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: "center" }}>
          {profileDetails.image ? (
            <Image
              source={{ uri: profileDetails.image }}
              style={{ width: 112, height: 112, borderRadius: 56, marginBottom: 14 }}
            />
          ) : (
            <View
              style={{
                width: 112,
                height: 112,
                borderRadius: 56,
                backgroundColor: avatarColor(profileDetails.name ?? "?"),
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 40, fontWeight: "700" }}>
                {initialsOf(profileDetails.name)}
              </Text>
            </View>
          )}

          <Text style={{ color: c.text, fontSize: 24, fontWeight: "700" }}>
            {profileDetails.name}
          </Text>

          {profileDetails.username && (
            <Text style={{ color: c.accent, fontSize: 16, marginTop: 4 }}>
              @{profileDetails.username}
            </Text>
          )}

          {profileDetails.email && (
            <Text style={{ color: c.muted, fontSize: 14, marginTop: 4 }}>
              {profileDetails.email}
            </Text>
          )}

          {profileDetails.bio && (
            <Text
              style={{ color: c.text, opacity: 0.85, textAlign: "center", marginTop: 14, maxWidth: 320, fontSize: 15 }}
            >
              {profileDetails.bio}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
          <View style={[card, { flex: 1, alignItems: "center" }]}>
            <Text style={{ color: c.text, fontSize: 24, fontWeight: "700" }}>
              {profileDetails.stats.messagesCount}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>Повідомлень</Text>
          </View>

          <View style={[card, { flex: 1, alignItems: "center" }]}>
            <Text style={{ color: c.text, fontSize: 24, fontWeight: "700" }}>
              {profileDetails.stats.roomsCreatedCount}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>Кімнат створено</Text>
          </View>
        </View>

        <View style={[card, { marginTop: 16 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Ionicons name="color-palette" size={20} color={c.accent} />
            <Text style={{ color: c.text, fontSize: 16, fontWeight: "700", marginLeft: 8 }}>
              Тема оформлення
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            {THEME_ORDER.map((id) => {
              const t = THEMES[id];
              const selected = id === themeId;
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => setThemeId(id)}
                  activeOpacity={0.8}
                  accessibilityLabel={`Тема: ${t.name}`}
                  style={{
                    width: "48%",
                    marginBottom: 10,
                    borderRadius: 14,
                    padding: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: c.search,
                    borderWidth: 2,
                    borderColor: selected ? t.colors.accent : "transparent",
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: c.muted,
                      marginRight: 10,
                    }}
                  >
                    <View style={{ flex: 1, backgroundColor: t.colors.bg }} />
                    <View style={{ flex: 1, backgroundColor: t.colors.accent }} />
                  </View>
                  <Text
                    numberOfLines={2}
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
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setEditVisible(true)}
          style={{
            backgroundColor: c.accent,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
            marginTop: 20,
          }}
        >
          <Text style={{ color: c.onAccent, fontWeight: "700", fontSize: 16 }}>
            Редагувати профіль
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSignOut}
          style={{
            borderWidth: 1,
            borderColor: c.danger,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
            marginTop: 10,
          }}
        >
          <Text style={{ color: c.danger, fontWeight: "700", fontSize: 16 }}>
            Вийти з акаунта
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <EditProfileModal
        visible={editVisible}
        initialName={profileDetails.name}
        initialUsername={profileDetails.username}
        initialBio={profileDetails.bio}
        initialImage={profileDetails.image}
        onClose={() => setEditVisible(false)}
        onSaved={() => setEditVisible(false)}
      />
    </SafeAreaView>
  );
}