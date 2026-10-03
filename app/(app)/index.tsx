import { SwipeableRoomItem } from "@/components/SwipeableRoomItem";
import { KawaiiAvatar } from "@/components/ui/KawaiiAvatar";
import { KawaiiGradient } from "@/components/ui/KawaiiGradient";
import { COLORS, FONTS } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const rooms = useQuery(api.rooms.listRooms);
  const currentUser = useQuery(api.users.currentUser);
  const deleteRoom = useMutation(api.rooms.deleteRoom);
  const removeParticipant = useMutation(api.rooms.removeParticipant);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleDeleteRoom = (roomId: Id<"chatRooms">) => {
    const room = rooms?.find((r) => r._id === roomId);
    if (!room) return;

    const isCreator = room.creatorId === currentUser?._id;

    if (!isCreator) {
      Alert.alert(
        "Покинути кімнату? 🥺",
        `Ти впевнений, що хочеш покинути «${room.title}»?`,
        [
          { text: "Скасувати", style: "cancel" },
          {
            text: "Покинути",
            style: "destructive",
            onPress: async () => {
              if (!currentUser) return;
              try {
                await removeParticipant({
                  roomId,
                  targetUserId: currentUser._id,
                });
              } catch (error: any) {
                Alert.alert(
                  "Помилка",
                  error?.message ?? "Не вдалося покинути кімнату",
                );
              }
            },
          },
        ],
      );
      return;
    }

    Alert.alert(
      "Видалити кімнату? 💔",
      `Кімната «${room.title}» та всі повідомлення будуть видалені назавжди.`,
      [
        { text: "Скасувати", style: "cancel" },
        {
          text: "Видалити",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRoom({ roomId });
            } catch (error: any) {
              Alert.alert(
                "Помилка",
                error?.message || "Не вдалося видалити кімнату",
              );
            }
          },
        },
      ],
    );
  };

  const handleOpenProfile = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/profile");
  };

  const handleCreateRoom = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/new-room");
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 18,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity onPress={handleOpenProfile} activeOpacity={0.85}>
          <KawaiiAvatar
            uri={currentUser?.image}
            name={currentUser?.name ?? "?"}
            size={42}
            ring="primary"
          />
        </TouchableOpacity>

        <View style={{ alignItems: "center", flex: 1 }}>
          <Text
            style={{
              fontFamily: FONTS.headingBold,
              fontSize: 18,
              color: COLORS.text,
              letterSpacing: 0.3,
            }}
          >
            Мої чати
          </Text>
          <Text style={{ fontSize: 10, marginTop: 1 }}>✨ 💕 ✨</Text>
        </View>

        <TouchableOpacity onPress={handleCreateRoom} activeOpacity={0.85}>
          <KawaiiGradient
            variant="primary"
            glow
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="add" size={23} color="#FFFFFF" />
          </KawaiiGradient>
        </TouchableOpacity>
      </View>

      {rooms === undefined ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: 14,
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
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 12,
              color: COLORS.textMuted,
              letterSpacing: 0.3,
            }}
          >
            Завантажуємо твої чати...
          </Text>
        </View>
      ) : rooms.length === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 32,
          }}
        >
          <Text style={{ fontSize: 58, marginBottom: 10 }}>🌸</Text>
          <Text
            style={{
              fontFamily: FONTS.headingBold,
              fontSize: 20,
              color: COLORS.text,
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            Поки що ти самотній
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              color: COLORS.textMuted,
              textAlign: "center",
              lineHeight: 19,
              marginBottom: 22,
            }}
          >
            Створи першу кімнату та поклич друзів 💌
          </Text>

          <TouchableOpacity onPress={handleCreateRoom} activeOpacity={0.85}>
            <KawaiiGradient
              variant="primary"
              glow
              style={{
                height: 48,
                borderRadius: 24,
                paddingHorizontal: 26,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 14,
                  color: "#FFFFFF",
                  letterSpacing: 0.3,
                }}
              >
                Створити кімнату
              </Text>
            </KawaiiGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{
            paddingHorizontal: 15,
            paddingBottom: insets.bottom + 22,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          renderItem={({ item }) => (
            <SwipeableRoomItem
              room={item}
              isCreator={item.creatorId === currentUser?._id}
              onPress={() => router.push(`/chat/${item._id}`)}
              onDelete={handleDeleteRoom}
            />
          )}
        />
      )}
    </View>
  );
}