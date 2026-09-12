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
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { router } from "expo-router";

import { api } from "@/convex/_generated/api";
import { EditProfileModal } from "@/components/EditProfileModal";
import { COLORS } from "@/constants/theme";

export default function ProfileScreen() {
  const { signOut } = useAuthActions();

  const currentUser = useQuery(api.users.currentUser);

  const profileDetails = useQuery(
    api.users.getUserProfile,
    currentUser?._id ? { userId: currentUser._id } : "skip",
  );

  const [editVisible, setEditVisible] = useState(false);

  if (currentUser === undefined || profileDetails === undefined) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center"
        style={{
          backgroundColor: COLORS.background,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!currentUser || !profileDetails) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center px-6"
        style={{
          backgroundColor: COLORS.background,
        }}
      >
        <Text className="text-white text-lg text-center">
          Не вдалося завантажити профіль
        </Text>
      </SafeAreaView>
    );
  }

  const handleSignOut = () => {
    Alert.alert("Вихід", "Ти впевнений, що хочеш вийти?", [
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
          } catch (error) {
            console.error(error);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView
      className="flex-1"
      style={{
        backgroundColor: COLORS.background,
      }}
    >
      <ScrollView
        className="flex-1"
        style={{
          backgroundColor: COLORS.background,
        }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 40,
        }}
      >
        <View className="flex-row items-center justify-between mb-8">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center"
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>

          <Text className="text-white text-xl font-bold">Профіль</Text>

          <TouchableOpacity
            onPress={() => setEditVisible(true)}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center"
          >
            <Ionicons name="pencil" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View className="items-center">
          {profileDetails.image ? (
            <Image
              source={{
                uri: profileDetails.image,
              }}
              className="w-28 h-28 rounded-full mb-4"
            />
          ) : (
            <View className="w-28 h-28 rounded-full bg-secondary items-center justify-center mb-4">
              <Ionicons name="person" size={52} color={COLORS.textMuted} />
            </View>
          )}

          <Text className="text-white text-2xl font-bold">
            {profileDetails.name}
          </Text>

          {profileDetails.username && (
            <Text className="text-primary text-base mt-1">
              @{profileDetails.username}
            </Text>
          )}

          {profileDetails.email && (
            <Text className="text-textMuted text-sm mt-1">
              {profileDetails.email}
            </Text>
          )}

          {profileDetails.bio && (
            <Text className="text-white/80 text-center mt-4 max-w-[320px]">
              {profileDetails.bio}
            </Text>
          )}
        </View>

        <View className="flex-row gap-3 mt-8">
          <View className="flex-1 bg-surface rounded-2xl p-4 items-center">
            <Text className="text-white text-2xl font-bold">
              {profileDetails.stats.messagesCount}
            </Text>

            <Text className="text-textMuted text-sm mt-1">Повідомлень</Text>
          </View>

          <View className="flex-1 bg-surface rounded-2xl p-4 items-center">
            <Text className="text-white text-2xl font-bold">
              {profileDetails.stats.roomsCreatedCount}
            </Text>

            <Text className="text-textMuted text-sm mt-1">Кімнат створено</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setEditVisible(true)}
          className="bg-primary rounded-xl py-3.5 items-center mt-6"
        >
          <Text className="text-white font-bold text-base">
            Редагувати профіль
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSignOut}
          className="border border-danger rounded-xl py-3.5 items-center mt-3"
        >
          <Text className="text-danger font-bold text-base">
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
