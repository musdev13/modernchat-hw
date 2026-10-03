import { EditProfileModal } from "@/components/EditProfileModal";
import { KawaiiAvatar } from "@/components/ui/KawaiiAvatar";
import { KawaiiBadge } from "@/components/ui/KawaiiBadge";
import { KawaiiGradient } from "@/components/ui/KawaiiGradient";
import { COLORS, FONTS } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import { setOAuthInProgress } from "@/lib/authFlowState";
import { useAuth, useClerk } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const { signOut } = useClerk();
  const { isSignedIn, isLoaded } = useAuth();

  const currentUser = useQuery(api.users.currentUser);
  const removePushToken = useMutation(api.users.removePushToken);

  const profileDetails = useQuery(
    api.users.getUserProfile,
    currentUser?._id ? { userId: currentUser._id } : "skip",
  );

  const [editVisible, setEditVisible] = useState(false);

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  if (currentUser === undefined || profileDetails === undefined) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLORS.background,
        }}
      >
        <KawaiiGradient
          variant="primary"
          glow
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="small" color="#FFFFFF" />
        </KawaiiGradient>
      </SafeAreaView>
    );
  }

  if (!currentUser || !profileDetails) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
          backgroundColor: COLORS.background,
        }}
      >
        <Text style={{ fontSize: 40, marginBottom: 8 }}>😿</Text>
        <Text
          style={{
            color: COLORS.text,
            fontFamily: FONTS.body,
            fontSize: 15,
            textAlign: "center",
          }}
        >
          Не вдалося завантажити профіль
        </Text>
      </SafeAreaView>
    );
  }

  const handleSignOut = () => {
    Alert.alert("Вихід 🌸", "Ти впевнений, що хочеш вийти?", [
      { text: "Скасувати", style: "cancel" },
      {
        text: "Вийти",
        style: "destructive",
        onPress: async () => {
          try {
            setOAuthInProgress(false);

            try {
              await removePushToken();
            } catch (err) {
              console.error("Failed to remove push token:", err);
            }

            await Notifications.dismissAllNotificationsAsync();
            await Notifications.cancelAllScheduledNotificationsAsync();

            await signOut();
          } catch (error) {
            console.error(error);
          }
        },
      },
    ]);
  };

  const handleEdit = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditVisible(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(183,148,246,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <Text
            style={{
              color: COLORS.text,
              fontFamily: FONTS.headingBold,
              fontSize: 18,
            }}
          >
            Профіль
          </Text>

          <TouchableOpacity
            onPress={handleEdit}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,143,180,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="pencil" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: "center" }}>
          <View style={{ position: "relative" }}>
            <KawaiiAvatar
              uri={profileDetails.image}
              name={profileDetails.name}
              size={110}
              ring="primary"
            />
            <Text
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                fontSize: 24,
              }}
            >
              ✨
            </Text>
          </View>

          <Text
            style={{
              color: COLORS.text,
              fontFamily: FONTS.headingBold,
              fontSize: 24,
              marginTop: 16,
              textAlign: "center",
            }}
          >
            {profileDetails.name}
          </Text>

          {profileDetails.username && (
            <View style={{ marginTop: 6 }}>
              <KawaiiBadge
                label={`@${profileDetails.username}`}
                variant="accent"
                icon="🎀"
                size="md"
              />
            </View>
          )}

          {profileDetails.email && (
            <Text
              style={{
                color: COLORS.textMuted,
                fontFamily: FONTS.body,
                fontSize: 12,
                marginTop: 8,
              }}
            >
              {profileDetails.email}
            </Text>
          )}

          {profileDetails.bio && (
            <Text
              style={{
                color: COLORS.text,
                fontFamily: FONTS.body,
                fontSize: 14,
                textAlign: "center",
                marginTop: 14,
                maxWidth: 320,
                lineHeight: 20,
              }}
            >
              {profileDetails.bio}
            </Text>
          )}
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginTop: 26,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(183,148,246,0.08)",
              borderRadius: 18,
              padding: 16,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(183,148,246,0.2)",
            }}
          >
            <Text style={{ fontSize: 20, marginBottom: 4 }}>💬</Text>
            <Text
              style={{
                color: COLORS.text,
                fontFamily: FONTS.headingBold,
                fontSize: 22,
              }}
            >
              {profileDetails.stats.messagesCount}
            </Text>
            <Text
              style={{
                color: COLORS.textMuted,
                fontFamily: FONTS.body,
                fontSize: 11,
                marginTop: 2,
              }}
            >
              повідомлень
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(255,143,180,0.08)",
              borderRadius: 18,
              padding: 16,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(255,143,180,0.2)",
            }}
          >
            <Text style={{ fontSize: 20, marginBottom: 4 }}>🏠</Text>
            <Text
              style={{
                color: COLORS.text,
                fontFamily: FONTS.headingBold,
                fontSize: 22,
              }}
            >
              {profileDetails.stats.roomsCreatedCount}
            </Text>
            <Text
              style={{
                color: COLORS.textMuted,
                fontFamily: FONTS.body,
                fontSize: 11,
                marginTop: 2,
              }}
            >
              кімнат
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleEdit}
          activeOpacity={0.85}
          style={{ marginTop: 26 }}
        >
          <KawaiiGradient
            variant="primary"
            glow
            style={{
              height: 52,
              borderRadius: 26,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            <Text
              style={{
                color: "#FFFFFF",
                fontFamily: FONTS.bodyBold,
                fontSize: 15,
                letterSpacing: 0.3,
              }}
            >
              Редагувати профіль
            </Text>
          </KawaiiGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSignOut}
          activeOpacity={0.7}
          style={{
            marginTop: 12,
            height: 52,
            borderRadius: 26,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderWidth: 1.5,
            borderColor: "rgba(255,92,122,0.4)",
            backgroundColor: "rgba(255,92,122,0.08)",
          }}
        >
          <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
          <Text
            style={{
              color: COLORS.danger,
              fontFamily: FONTS.bodyBold,
              fontSize: 14,
            }}
          >
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