import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RoomSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const room = useQuery(api.rooms.getRoom, {
    roomId: id as Id<"chatRooms">,
  });

  const currentUser = useQuery(api.users.currentUser);
  const deleteRoom = useMutation(api.rooms.deleteRoom);

  const isLoading = room === undefined || currentUser === undefined;

  const isCreator =
    room !== null &&
    room !== undefined &&
    currentUser !== null &&
    currentUser !== undefined &&
    room.creatorId === currentUser._id;

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
      </ScrollView>
    </SafeAreaView>
  );
}
