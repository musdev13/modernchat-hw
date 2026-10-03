import { AddMembersModal } from "@/components/AddMembersModal";
import { avatarColor, initialsOf } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { membersLabel } from "@/utils/chat";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
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

export default function RoomSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors: c } = useTheme();

  const room = useQuery(api.rooms.getRoom, {
    roomId: id as Id<"chatRooms">,
  });

  const currentUser = useQuery(api.users.currentUser);
  const deleteRoom = useMutation(api.rooms.deleteRoom);
  const updateParticipantRole = useMutation(api.rooms.updateParticipantRole);
  const removeParticipant = useMutation(api.rooms.removeParticipant);
  const [isAddMembersVisible, setIsAddMembersVisible] = useState(false);

  const isLoading = room === undefined || currentUser === undefined;

  const isCreator =
    room !== null &&
    room !== undefined &&
    currentUser !== null &&
    currentUser !== undefined &&
    room.creatorId === currentUser._id;
  const canManageMembers = room?.canManageMembers ?? false;

  const handleRole = async (
    targetUserId: Id<"users">,
    role: "admin" | "member",
  ) => {
    try {
      await updateParticipantRole({
        roomId: id as Id<"chatRooms">,
        targetUserId,
        role,
      });
    } catch (error: any) {
      Alert.alert("Помилка", error?.message ?? "Не вдалося змінити роль");
    }
  };

  const handleRemove = (targetUserId: Id<"users">, name: string) => {
    Alert.alert("Вилучити учасника?", `Вилучити ${name} з кімнати?`, [
      { text: "Скасувати", style: "cancel" },
      {
        text: "Вилучити",
        style: "destructive",
        onPress: async () => {
          try {
            await removeParticipant({
              roomId: id as Id<"chatRooms">,
              targetUserId,
            });
          } catch (error: any) {
            Alert.alert(
              "Помилка",
              error?.message ?? "Не вдалося вилучити учасника",
            );
          }
        },
      },
    ]);
  };

  const handleLeave = () => {
    if (!currentUser) return;
    Alert.alert("Покинути кімнату?", "Ви втратите доступ до цього чату.", [
      { text: "Скасувати", style: "cancel" },
      {
        text: "Покинути",
        style: "destructive",
        onPress: async () => {
          try {
            await removeParticipant({
              roomId: id as Id<"chatRooms">,
              targetUserId: currentUser._id,
            });
            router.dismissAll();
            router.replace("/(app)");
          } catch (error: any) {
            Alert.alert(
              "Помилка",
              error?.message ?? "Не вдалося покинути кімнату",
            );
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      "Видалити кімнату?",
      `Кімната «${room?.title}» та всі її повідомлення будуть видалені назавжди.`,
      [
        {
          text: "Скасувати",
          style: "cancel",
        },
        {
          text: "Видалити",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRoom({
                roomId: id as Id<"chatRooms">,
              });

              router.dismissAll();
              router.replace("/(app)");
            } catch (error) {
              console.error("Error deleting room:", error);

              Alert.alert("Помилка", "Не вдалося видалити кімнату.");
            }
          },
        },
      ],
    );
  };

  const header = (title: string) => (
    <View
      style={{
        height: 56,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 6,
        backgroundColor: c.header,
        borderBottomWidth: 1,
        borderBottomColor: c.divider,
      }}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        activeOpacity={0.7}
        style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        accessibilityRole="button"
        accessibilityLabel="Назад"
      >
        <Ionicons name="arrow-back" size={24} color={c.text} />
      </TouchableOpacity>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: "700", marginLeft: 8 }}>
        {title}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: c.divider, alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator size="large" color={c.accent} />
      </SafeAreaView>
    );
  }

  if (room === null) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.divider }}>
        {header("Налаштування")}

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: c.search,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={40} color={c.muted} />
          </View>

          <Text style={{ color: c.text, fontSize: 20, fontWeight: "700", marginTop: 20, textAlign: "center" }}>
            Кімнату не знайдено
          </Text>

          <Text style={{ color: c.muted, fontSize: 14, marginTop: 8, textAlign: "center" }}>
            Можливо, її вже було видалено.
          </Text>

          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={{ backgroundColor: c.accent, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12, marginTop: 24 }}
          >
            <Text style={{ color: c.onAccent, fontWeight: "700" }}>Назад</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const card = {
    backgroundColor: c.header,
    marginTop: 10,
  } as const;

  const sectionLabel = (text: string) => (
    <Text style={{ color: c.accent, fontSize: 14, fontWeight: "600", marginBottom: 6 }}>
      {text}
    </Text>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.divider }} edges={["top", "bottom"]}>
      {header("Інформація про кімнату")}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Профіль кімнати */}
        <View style={{ alignItems: "center", backgroundColor: c.header, paddingVertical: 24, paddingHorizontal: 20 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: avatarColor(room.title),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 34, fontWeight: "700" }}>
              {initialsOf(room.title)}
            </Text>
          </View>

          <Text style={{ color: c.text, fontSize: 22, fontWeight: "700", textAlign: "center", marginTop: 14 }}>
            {room.title}
          </Text>

          <Text style={{ color: c.muted, fontSize: 14, marginTop: 4 }}>
            {membersLabel(room.participants.length)}
          </Text>
        </View>

        {/* Опис */}
        <View style={[card, { paddingHorizontal: 16, paddingVertical: 14 }]}>
          {sectionLabel("Опис")}
          <Text style={{ color: c.text, fontSize: 16, lineHeight: 22 }}>
            {room.description || "Опис не додано"}
          </Text>
        </View>

        {/* Учасники */}
        <View style={[card, { paddingTop: 14 }]}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              marginBottom: 6,
            }}
          >
            <View>
              <Text style={{ color: c.accent, fontSize: 14, fontWeight: "600" }}>
                Учасники ({room.participants.length})
              </Text>
              <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
                👑 Творець · 🛡️ Адміністратор
              </Text>
            </View>
          </View>

          {canManageMembers && (
            <TouchableOpacity
              onPress={() => setIsAddMembersVisible(true)}
              activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Додати учасників"
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: c.accent,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 14,
                }}
              >
                <Ionicons name="person-add" size={20} color={c.onAccent} />
              </View>
              <Text style={{ color: c.accent, fontSize: 16, fontWeight: "600" }}>
                Додати учасників
              </Text>
            </TouchableOpacity>
          )}

          {room.participants.map((participant) => {
            const canKick =
              participant.role !== "creator" &&
              (isCreator ||
                (room.currentUserRole === "admin" &&
                  participant.role === "member"));

            return (
              <View
                key={participant._id}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 }}
              >
                {participant.image ? (
                  <Image
                    source={{ uri: participant.image }}
                    style={{ width: 44, height: 44, borderRadius: 22, marginRight: 14, backgroundColor: c.search }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      marginRight: 14,
                      backgroundColor: avatarColor(participant.name),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>
                      {initialsOf(participant.name)}
                    </Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
                    {participant.name}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 13 }}>
                    {participant.role === "creator"
                      ? "👑 Творець"
                      : participant.role === "admin"
                        ? "🛡️ Адміністратор"
                        : "Учасник"}
                  </Text>
                </View>

                {isCreator && participant.role !== "creator" && (
                  <TouchableOpacity
                    onPress={() =>
                      handleRole(
                        participant._id as Id<"users">,
                        participant.role === "admin" ? "member" : "admin",
                      )
                    }
                    style={{ padding: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={
                      participant.role === "admin"
                        ? "Зняти права адміністратора"
                        : "Призначити адміністратором"
                    }
                  >
                    <Ionicons
                      name={participant.role === "admin" ? "shield" : "shield-outline"}
                      size={20}
                      color={c.accent}
                    />
                  </TouchableOpacity>
                )}

                {canKick && (
                  <TouchableOpacity
                    onPress={() =>
                      handleRemove(
                        participant._id as Id<"users">,
                        participant.name,
                      )
                    }
                    style={{ padding: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Вилучити учасника"
                  >
                    <Ionicons name="person-remove-outline" size={20} color={c.danger} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
          <View style={{ height: 6 }} />
        </View>

        {isCreator ? (
          <View style={[card, { paddingHorizontal: 16, paddingVertical: 14 }]}>
            <Text style={{ color: c.danger, fontSize: 14, fontWeight: "600", marginBottom: 6 }}>
              Небезпечна зона
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>
              Кімната та всі повідомлення в ній будуть видалені без можливості
              відновлення.
            </Text>

            <TouchableOpacity
              onPress={handleDelete}
              activeOpacity={0.7}
              style={{
                height: 48,
                marginTop: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: c.danger,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="trash-outline" size={20} color={c.danger} />
              <Text style={{ color: c.danger, fontSize: 16, fontWeight: "700", marginLeft: 8 }}>
                Видалити кімнату
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={[card, { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 }]}>
              <Ionicons name="information-circle-outline" size={22} color={c.muted} />
              <Text style={{ color: c.muted, fontSize: 14, marginLeft: 12, flex: 1, lineHeight: 20 }}>
                Лише автор кімнати може змінювати її налаштування та видаляти її.
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleLeave}
              activeOpacity={0.7}
              style={[card, { height: 52, alignItems: "center", justifyContent: "center", flexDirection: "row" }]}
            >
              <Ionicons name="exit-outline" size={20} color={c.danger} />
              <Text style={{ color: c.danger, fontSize: 16, fontWeight: "700", marginLeft: 8 }}>
                Покинути кімнату
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <AddMembersModal
        visible={isAddMembersVisible}
        roomId={id as Id<"chatRooms">}
        participantIds={room.participantIds}
        onClose={() => setIsAddMembersVisible(false)}
      />
    </SafeAreaView>
  );
}