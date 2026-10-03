import { AddMembersModal } from "@/components/AddMembersModal";
import { EditRoomModal } from "@/components/EditRoomModal";
import { KawaiiAvatar } from "@/components/ui/KawaiiAvatar";
import { KawaiiBadge } from "@/components/ui/KawaiiBadge";
import { KawaiiGradient } from "@/components/ui/KawaiiGradient";
import { COLORS, FONTS } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
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

export default function RoomSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const room = useQuery(api.rooms.getRoom, { roomId: id as Id<"chatRooms"> });
  const currentUser = useQuery(api.users.currentUser);
  const deleteRoom = useMutation(api.rooms.deleteRoom);
  const updateParticipantRole = useMutation(api.rooms.updateParticipantRole);
  const removeParticipant = useMutation(api.rooms.removeParticipant);
  const [isAddMembersVisible, setIsAddMembersVisible] = useState(false);
  const [isEditRoomVisible, setIsEditRoomVisible] = useState(false);

  const isLoading = room === undefined || currentUser === undefined;

  const isCreator =
    room !== null &&
    room !== undefined &&
    currentUser !== null &&
    currentUser !== undefined &&
    room.creatorId === currentUser._id;
  const canManageMembers = room?.canManageMembers ?? false;
  const canEditRoom = room?.canEditRoom ?? false;

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
    Alert.alert("Вилучити учасника? 🚫", `Вилучити ${name} з кімнати?`, [
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
    Alert.alert("Покинути кімнату? 🥺", "Ви втратите доступ до цього чату.", [
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
      "Видалити кімнату? 💔",
      `Кімната «${room?.title}» та всі її повідомлення будуть видалені назавжди.`,
      [
        { text: "Скасувати", style: "cancel" },
        {
          text: "Видалити",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRoom({ roomId: id as Id<"chatRooms"> });
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

  const handleOpenProfile = (userId: Id<"users">) => {
    router.push(`/user/${userId}` as any);
  };

  if (isLoading) {
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
      </View>
    );
  }

  if (room === null) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <Text style={{ fontSize: 40, marginBottom: 8 }}>😿</Text>
        <Text
          style={{
            color: COLORS.text,
            fontFamily: FONTS.headingBold,
            fontSize: 18,
            textAlign: "center",
          }}
        >
          Кімнату не знайдено
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
        <View style={{ alignItems: "center", marginBottom: 22 }}>
          {room.avatarUrl ? (
            <KawaiiAvatar
              uri={room.avatarUrl}
              name={room.title}
              size={92}
              ring="primary"
            />
          ) : (
            <KawaiiGradient
              variant="primary"
              glow
              style={{
                width: 92,
                height: 92,
                borderRadius: 46,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="chatbubbles" size={40} color="#FFFFFF" />
            </KawaiiGradient>
          )}

          <Text
            style={{
              color: COLORS.text,
              fontFamily: FONTS.headingBold,
              fontSize: 22,
              textAlign: "center",
              marginTop: 12,
            }}
          >
            {room.title}
          </Text>

          <Text style={{ fontSize: 12, marginTop: 2 }}>✨ 💕 ✨</Text>

          {canEditRoom && (
            <TouchableOpacity
              onPress={() => setIsEditRoomVisible(true)}
              activeOpacity={0.85}
              style={{ marginTop: 14 }}
            >
              <KawaiiGradient
                variant="primary"
                glow
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 20,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Ionicons name="pencil" size={14} color="#FFFFFF" />
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontFamily: FONTS.bodyBold,
                    fontSize: 12,
                  }}
                >
                  Редагувати
                </Text>
              </KawaiiGradient>
            </TouchableOpacity>
          )}
        </View>

        <View
          style={{
            backgroundColor: "rgba(183,148,246,0.06)",
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "rgba(183,148,246,0.18)",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(183,148,246,0.12)",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
              }}
            >
              <Text style={{ fontSize: 12 }}>📝</Text>
              <Text
                style={{
                  color: COLORS.textMuted,
                  fontFamily: FONTS.bodyBold,
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                Назва
              </Text>
            </View>
            <Text
              style={{
                color: COLORS.text,
                fontFamily: FONTS.bodyBold,
                fontSize: 15,
              }}
            >
              {room.title}
            </Text>
          </View>

          <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
              }}
            >
              <Text style={{ fontSize: 12 }}>💭</Text>
              <Text
                style={{
                  color: COLORS.textMuted,
                  fontFamily: FONTS.bodyBold,
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                Опис
              </Text>
            </View>
            <Text
              style={{
                color: COLORS.text,
                fontFamily: FONTS.body,
                fontSize: 14,
                lineHeight: 19,
              }}
            >
              {room.description || "Опис не додано ✨"}
            </Text>
          </View>
        </View>

        <View
          style={{
            marginTop: 20,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "rgba(255,143,180,0.18)",
            backgroundColor: "rgba(255,143,180,0.05)",
            padding: 14,
          }}
        >
          <View
            style={{
              marginBottom: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text
                style={{
                  color: COLORS.text,
                  fontFamily: FONTS.headingBold,
                  fontSize: 16,
                }}
              >
                Учасники ({room.participants.length})
              </Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                <KawaiiBadge label="Творець" icon="👑" variant="gold" />
                <KawaiiBadge label="Адмін" icon="🛡️" variant="primary" />
              </View>
            </View>
            {canManageMembers && (
              <TouchableOpacity
                onPress={() => setIsAddMembersVisible(true)}
                activeOpacity={0.85}
              >
                <KawaiiGradient
                  variant="primary"
                  glow
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Ionicons name="person-add" size={13} color="#FFFFFF" />
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontFamily: FONTS.bodyBold,
                      fontSize: 11,
                    }}
                  >
                    Додати
                  </Text>
                </KawaiiGradient>
              </TouchableOpacity>
            )}
          </View>

          {room.participants.map((participant) => {
            const canKick =
              participant.role !== "creator" &&
              (isCreator ||
                (room.currentUserRole === "admin" &&
                  participant.role === "member"));

            return (
              <View
                key={participant._id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(183,148,246,0.1)",
                }}
              >
                <TouchableOpacity
                  onPress={() =>
                    handleOpenProfile(participant._id as Id<"users">)
                  }
                  activeOpacity={0.75}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <KawaiiAvatar
                    uri={participant.image}
                    name={participant.name}
                    size={40}
                    ring={
                      participant.role === "creator"
                        ? "creator"
                        : participant.role === "admin"
                          ? "primary"
                          : "none"
                    }
                  />

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text
                      style={{
                        color: COLORS.text,
                        fontFamily: FONTS.bodyBold,
                        fontSize: 14,
                      }}
                    >
                      {participant.name}
                    </Text>
                    <Text
                      style={{
                        color: COLORS.textMuted,
                        fontFamily: FONTS.body,
                        fontSize: 11,
                        marginTop: 1,
                      }}
                    >
                      {participant.role === "creator"
                        ? "👑 Творець"
                        : participant.role === "admin"
                          ? "🛡️ Адміністратор"
                          : "👤 Учасник"}
                    </Text>
                  </View>
                </TouchableOpacity>

                {isCreator && participant.role !== "creator" && (
                  <TouchableOpacity
                    onPress={() =>
                      handleRole(
                        participant._id as Id<"users">,
                        participant.role === "admin" ? "member" : "admin",
                      )
                    }
                    style={{
                      marginLeft: 6,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(183,148,246,0.15)",
                    }}
                  >
                    <Ionicons
                      name={
                        participant.role === "admin"
                          ? "shield"
                          : "shield-outline"
                      }
                      size={15}
                      color={COLORS.secondary}
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
                    style={{
                      marginLeft: 6,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(255,92,122,0.15)",
                    }}
                  >
                    <Ionicons
                      name="person-remove-outline"
                      size={15}
                      color={COLORS.danger}
                    />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {isCreator ? (
          <View style={{ marginTop: 20 }}>
            <Text
              style={{
                color: COLORS.textMuted,
                fontFamily: FONTS.bodyBold,
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 10,
                paddingHorizontal: 4,
              }}
            >
              ⚠️ Небезпечна зона
            </Text>

            <View
              style={{
                backgroundColor: "rgba(255,92,122,0.06)",
                borderWidth: 1,
                borderColor: "rgba(255,92,122,0.25)",
                borderRadius: 20,
                padding: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    backgroundColor: "rgba(255,92,122,0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="warning-outline"
                    size={20}
                    color={COLORS.danger}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={{
                      color: COLORS.text,
                      fontFamily: FONTS.bodyBold,
                      fontSize: 14,
                    }}
                  >
                    Видалення кімнати
                  </Text>
                  <Text
                    style={{
                      color: COLORS.textMuted,
                      fontFamily: FONTS.body,
                      fontSize: 12,
                      lineHeight: 17,
                      marginTop: 4,
                    }}
                  >
                    Кімната та всі повідомлення будуть видалені назавжди.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleDelete}
                activeOpacity={0.7}
                style={{
                  height: 46,
                  marginTop: 14,
                  borderRadius: 23,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  backgroundColor: "rgba(255,92,122,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(255,92,122,0.4)",
                }}
              >
                <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                <Text
                  style={{
                    color: COLORS.danger,
                    fontFamily: FONTS.bodyBold,
                    fontSize: 13,
                  }}
                >
                  Видалити кімнату
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {!isCreator && (
          <TouchableOpacity
            onPress={handleLeave}
            activeOpacity={0.7}
            style={{
              marginTop: 14,
              height: 46,
              borderRadius: 23,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: "rgba(255,92,122,0.4)",
              backgroundColor: "rgba(255,92,122,0.08)",
              flexDirection: "row",
              gap: 6,
            }}
          >
            <Ionicons name="exit-outline" size={16} color={COLORS.danger} />
            <Text
              style={{
                color: COLORS.danger,
                fontFamily: FONTS.bodyBold,
                fontSize: 13,
              }}
            >
              Покинути кімнату
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <AddMembersModal
        visible={isAddMembersVisible}
        roomId={id as Id<"chatRooms">}
        participantIds={room.participantIds}
        onClose={() => setIsAddMembersVisible(false)}
      />

      <EditRoomModal
        visible={isEditRoomVisible}
        roomId={id as Id<"chatRooms">}
        initialTitle={room.title}
        initialDescription={room.description}
        initialAvatarUrl={room.avatarUrl}
        onClose={() => setIsEditRoomVisible(false)}
        onSaved={() => setIsEditRoomVisible(false)}
      />
    </View>
  );
}