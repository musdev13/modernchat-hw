import { AddMembersModal } from "@/components/AddMembersModal";
import { COLORS } from "@/constants/theme";
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

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (room === null) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="h-14 flex-row items-center px-4 border-b border-surfaceLight">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-secondary"
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>

          <Text className="text-white text-lg font-bold ml-3">
            Налаштування
          </Text>
        </View>

        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-full bg-secondary items-center justify-center">
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={40}
              color={COLORS.textMuted}
            />
          </View>

          <Text className="text-white text-xl font-bold mt-5 text-center">
            Кімнату не знайдено
          </Text>

          <Text className="text-textMuted text-sm mt-2 text-center">
            Можливо, її вже було видалено.
          </Text>

          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-primary rounded-2xl px-6 py-3 mt-6"
            activeOpacity={0.8}
          >
            <Text className="text-white font-bold">Назад</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "bottom"]}>
      <View className="h-14 flex-row items-center px-4 border-b border-surfaceLight">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full bg-secondary"
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>

        <Text className="text-white text-lg font-bold ml-3">
          Налаштування кімнати
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-6 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center mb-7">
          <View className="w-20 h-20 rounded-2xl bg-primary/15 border border-primary/30 items-center justify-center">
            <Ionicons
              name="chatbubbles-outline"
              size={38}
              color={COLORS.primary}
            />
          </View>

          <Text className="text-white text-2xl font-bold text-center mt-4">
            {room.title}
          </Text>

          <Text className="text-textMuted text-sm mt-1">
            Інформація про кімнату
          </Text>
        </View>

        <View className="bg-secondary border border-surfaceLight rounded-2xl overflow-hidden">
          <View className="px-5 py-4 border-b border-surfaceLight">
            <View className="flex-row items-center mb-2">
              <Ionicons
                name="text-outline"
                size={17}
                color={COLORS.textMuted}
              />

              <Text className="text-textMuted text-xs font-semibold uppercase ml-2">
                Назва
              </Text>
            </View>

            <Text className="text-white text-base font-semibold">
              {room.title}
            </Text>
          </View>

          <View className="px-5 py-4">
            <View className="flex-row items-center mb-2">
              <Ionicons
                name="document-text-outline"
                size={17}
                color={COLORS.textMuted}
              />

              <Text className="text-textMuted text-xs font-semibold uppercase ml-2">
                Опис
              </Text>
            </View>

            <Text className="text-neutral-300 text-base leading-6">
              {room.description || "Опис не додано"}
            </Text>
          </View>
        </View>

        <View className="mt-8 rounded-2xl border border-surfaceLight bg-secondary p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <Text className="text-base font-bold text-white">
                Учасники ({room.participants.length})
              </Text>
              <Text className="mt-0.5 text-xs text-textMuted">
                👑 Творець · 🛡️ Адміністратор
              </Text>
            </View>
            {canManageMembers && (
              <TouchableOpacity
                onPress={() => setIsAddMembersVisible(true)}
                className="rounded-xl bg-primary px-3 py-2"
              >
                <Text className="text-xs font-bold text-white">+ Додати</Text>
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
                className="flex-row items-center border-t border-surfaceLight/60 py-3"
              >
                {participant.image ? (
                  <Image
                    source={{ uri: participant.image }}
                    className="mr-3 h-10 w-10 rounded-full bg-surfaceLight"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-surfaceLight">
                    <Text className="font-bold text-primary">
                      {participant.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View className="flex-1">
                  <Text className="font-semibold text-white">
                    {participant.name}
                  </Text>
                  <Text className="text-xs text-textMuted">
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
                    className="mr-2 rounded-lg bg-surfaceLight p-2"
                  >
                    <Ionicons
                      name={
                        participant.role === "admin"
                          ? "shield"
                          : "shield-outline"
                      }
                      size={17}
                      color={COLORS.primary}
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
                    className="rounded-lg bg-danger/10 p-2"
                  >
                    <Ionicons
                      name="person-remove-outline"
                      size={17}
                      color={COLORS.danger}
                    />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {isCreator ? (
          <View className="mt-8">
            <Text className="text-textMuted text-xs font-semibold uppercase mb-3 px-1">
              Небезпечна зона
            </Text>

            <View className="bg-secondary border border-danger/20 rounded-2xl p-5">
              <View className="flex-row items-start">
                <View className="w-11 h-11 rounded-xl bg-danger/10 items-center justify-center">
                  <Ionicons
                    name="warning-outline"
                    size={22}
                    color={COLORS.danger}
                  />
                </View>

                <View className="flex-1 ml-3">
                  <Text className="text-white text-base font-bold">
                    Видалення кімнати
                  </Text>

                  <Text className="text-textMuted text-sm leading-5 mt-1">
                    Кімната та всі повідомлення в ній будуть видалені без
                    можливості відновлення.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleDelete}
                className="h-14 mt-5 rounded-xl bg-danger/10 border border-danger/40 flex-row items-center justify-center"
                activeOpacity={0.7}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={COLORS.danger}
                />

                <Text className="text-danger text-base font-bold ml-2">
                  Видалити кімнату
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View className="mt-8 bg-secondary border border-surfaceLight rounded-2xl p-5">
            <View className="flex-row items-center">
              <Ionicons
                name="information-circle-outline"
                size={22}
                color={COLORS.textMuted}
              />

              <Text className="text-textMuted text-sm ml-3 flex-1 leading-5">
                Лише автор кімнати може змінювати її налаштування та видаляти
                її.
              </Text>
            </View>
          </View>
        )}

        {!isCreator && (
          <TouchableOpacity
            onPress={handleLeave}
            className="mt-4 h-13 items-center justify-center rounded-xl border border-danger/40 bg-danger/10"
          >
            <Text className="font-bold text-danger">Покинути кімнату</Text>
          </TouchableOpacity>
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