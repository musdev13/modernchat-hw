import { ImageViewerModal } from "@/components/ImageViewerModal";
import { KawaiiAvatar } from "@/components/ui/KawaiiAvatar";
import { KawaiiBadge } from "@/components/ui/KawaiiBadge";
import { KawaiiGradient } from "@/components/ui/KawaiiGradient";
import { COLORS, FONTS } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  const currentUser = useQuery(api.users.currentUser);
  const rooms = useQuery(api.rooms.listRooms);
  const createRoom = useMutation(api.rooms.createRoom);

  const userProfile = useQuery(
    api.users.getUserProfile,
    id ? { userId: id as Id<"users"> } : "skip",
  );

  if (currentUser === undefined || userProfile === undefined) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLORS.background,
        }}
      >
        <KawaiiGradient
          variant="accent"
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
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View
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
          Користувача не знайдено
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.85}
          style={{ marginTop: 20 }}
        >
          <KawaiiGradient
            variant="primary"
            glow
            style={{
              height: 44,
              borderRadius: 22,
              paddingHorizontal: 24,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontFamily: FONTS.bodyBold,
                fontSize: 14,
              }}
            >
              Назад
            </Text>
          </KawaiiGradient>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwnProfile = currentUser?._id === userProfile._id;

  const handleWriteMessage = async () => {
    if (!currentUser || !userProfile) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const existing = rooms?.find((r) => {
      const parts = r.participantIds ?? [r.creatorId];
      return (
        parts.length === 2 &&
        parts.includes(currentUser._id) &&
        parts.includes(userProfile._id)
      );
    });

    if (existing) {
      router.push(`/chat/${existing._id}` as any);
      return;
    }

    setIsCreatingChat(true);
    try {
      const roomId = await createRoom({
        title: userProfile.name,
        participantIds: [userProfile._id as Id<"users">],
      });
      router.push(`/chat/${roomId}` as any);
    } catch (error) {
      console.error(error);
      Alert.alert("Помилка", "Не вдалося створити чат");
    } finally {
      setIsCreatingChat(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", marginTop: 8 }}>
          <View style={{ position: "relative" }}>
            <KawaiiAvatar
              uri={userProfile.image}
              name={userProfile.name}
              size={110}
              ring="accent"
            />
            <Text
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                fontSize: 24,
              }}
            >
              🌸
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
            {userProfile.name}
          </Text>

          {userProfile.username && (
            <View style={{ marginTop: 6 }}>
              <KawaiiBadge
                label={`@${userProfile.username}`}
                variant="accent"
                icon="🎀"
                size="md"
              />
            </View>
          )}

          {userProfile.email && (
            <Text
              style={{
                color: COLORS.textMuted,
                fontFamily: FONTS.body,
                fontSize: 12,
                marginTop: 8,
              }}
            >
              {userProfile.email}
            </Text>
          )}

          {userProfile.bio && (
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
              {userProfile.bio}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 26 }}>
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
              {userProfile.stats.messagesCount}
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
              {userProfile.stats.roomsCreatedCount}
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

        <View
          style={{
            backgroundColor: "rgba(126,232,250,0.08)",
            borderRadius: 18,
            padding: 16,
            marginTop: 12,
            borderWidth: 1,
            borderColor: "rgba(126,232,250,0.2)",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 20 }}>🗓️</Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: COLORS.textMuted,
                fontFamily: FONTS.body,
                fontSize: 11,
              }}
            >
              Дата реєстрації
            </Text>
            <Text
              style={{
                color: COLORS.text,
                fontFamily: FONTS.bodyBold,
                fontSize: 14,
                marginTop: 2,
              }}
            >
              {new Date(userProfile._creationTime).toLocaleDateString("uk-UA")}
            </Text>
          </View>
        </View>

        {!isOwnProfile && (
          <TouchableOpacity
            onPress={handleWriteMessage}
            disabled={isCreatingChat || rooms === undefined}
            activeOpacity={0.85}
            style={{ marginTop: 20 }}
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
                opacity: isCreatingChat || rooms === undefined ? 0.6 : 1,
              }}
            >
              {isCreatingChat ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="chatbubble" size={18} color="#FFFFFF" />
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontFamily: FONTS.bodyBold,
                      fontSize: 15,
                      letterSpacing: 0.3,
                    }}
                  >
                    Написати
                  </Text>
                </>
              )}
            </KawaiiGradient>
          </TouchableOpacity>
        )}

        {isOwnProfile && (
          <TouchableOpacity
            onPress={() => router.push("/profile")}
            activeOpacity={0.85}
            style={{ marginTop: 20 }}
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
              <Ionicons name="pencil" size={18} color="#FFFFFF" />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontFamily: FONTS.bodyBold,
                  fontSize: 15,
                }}
              >
                Редагувати профіль
              </Text>
            </KawaiiGradient>
          </TouchableOpacity>
        )}
      </ScrollView>

      <ImageViewerModal
        visible={!!fullscreenImage}
        imageUrl={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
      />
    </View>
  );
}