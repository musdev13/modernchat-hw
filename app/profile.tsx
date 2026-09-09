import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const router = useRouter();
  const user = useQuery(api.users.currentUser);
  const { signOut } = useAuthActions();

  const handleSignOut = () => {
    Alert.alert("Вихід з акаунта", "Ви дійсно бажаєте вийти з додатку?", [
      {
        text: "Скасувати",
        style: "cancel",
      },
      {
        text: "Вийти",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
            router.replace("/(auth)/login");
          } catch (error) {
            console.error("Error signing out:", error);
            Alert.alert("Помилка", "Не вдалося вийти з акаунта.");
          }
        },
      },
    ]);
  };

  if (user === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (user === null) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center px-6">
        <Ionicons
          name="person-circle-outline"
          size={64}
          color={COLORS.textMuted}
        />

        <Text className="text-white text-lg font-bold mt-4 text-center">
          Користувача не знайдено
        </Text>

        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary rounded-2xl px-6 py-3 mt-5"
          activeOpacity={0.8}
        >
          <Text className="text-white font-bold">Назад</Text>
        </TouchableOpacity>
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

        <Text className="text-white text-lg font-bold ml-3">Профіль</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-8 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center">
          <View className="w-28 h-28 rounded-full bg-secondary border-2 border-primary/40 items-center justify-center overflow-hidden">
            {user.image ? (
              <Image source={{ uri: user.image }} className="w-full h-full" />
            ) : (
              <Ionicons name="person" size={52} color={COLORS.primary} />
            )}
          </View>

          <Text className="text-white text-2xl font-bold mt-5">
            {user.name ?? "Користувач"}
          </Text>

          {user.email ? (
            <Text className="text-textMuted text-sm mt-1">{user.email}</Text>
          ) : null}
        </View>

        <View className="mt-10 bg-secondary border border-surfaceLight rounded-2xl overflow-hidden">
          <View className="px-4 py-4 border-b border-surfaceLight">
            <Text className="text-textMuted text-xs font-semibold uppercase mb-1">
              Ім'я
            </Text>

            <Text className="text-white text-base">
              {user.name ?? "Користувач"}
            </Text>
          </View>

          <View className="px-4 py-4">
            <Text className="text-textMuted text-xs font-semibold uppercase mb-1">
              Електронна пошта
            </Text>

            <Text className="text-white text-base">
              {user.email ?? "Не вказано"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSignOut}
          className="w-full h-14 mt-6 rounded-2xl flex-row items-center justify-center"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            borderWidth: 1,
            borderColor: "rgba(239, 68, 68, 0.3)",
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={21} color={COLORS.danger} />

          <Text
            className="text-base font-bold ml-2"
            style={{
              color: COLORS.danger,
            }}
          >
            Вийти з акаунту
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
