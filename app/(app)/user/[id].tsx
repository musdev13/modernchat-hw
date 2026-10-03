import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ImageViewerModal } from "@/components/ImageViewerModal";
import { COLORS } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const currentUser = useQuery(api.users.currentUser);

  const userProfile = useQuery(
    api.users.getUserProfile,
    id
      ? {
          userId: id as Id<"users">,
        }
      : "skip",
  );

  if (currentUser === undefined || userProfile === undefined) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: COLORS.background }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!userProfile) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: COLORS.background }}
      >
        <Text className="text-white text-lg text-center">
          Пользователь не найден
        </Text>

        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary rounded-xl px-6 py-3 mt-5"
        >
          <Text className="text-white font-bold">Назад</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isOwnProfile = currentUser?._id === userProfile._id;

  return (
    <SafeAreaView
      className="flex-1"
      edges={["bottom"]}
      style={{ backgroundColor: COLORS.background }}
    >
      <ScrollView
        style={{ backgroundColor: COLORS.background }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 40,
        }}
      >
        <View className="items-center">
          {userProfile.image ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setFullscreenImage(userProfile.image!)}
            >
              <Image
                source={{
                  uri: userProfile.image,
                }}
                className="w-28 h-28 rounded-full mb-4"
              />
            </TouchableOpacity>
          ) : (
            <View className="w-28 h-28 rounded-full bg-secondary items-center justify-center mb-4">
              <Ionicons name="person" size={52} color={COLORS.textMuted} />
            </View>
          )}

          <Text className="text-white text-2xl font-bold">
            {userProfile.name}
          </Text>

          {userProfile.username && (
            <Text className="text-primary text-base mt-1">
              @{userProfile.username}
            </Text>
          )}

          {userProfile.email && (
            <Text className="text-textMuted text-sm mt-1">
              {userProfile.email}
            </Text>
          )}

          {userProfile.bio && (
            <Text className="text-white/80 text-center mt-4 max-w-[320px]">
              {userProfile.bio}
            </Text>
          )}
        </View>

        <View className="flex-row gap-3 mt-8">
          <View className="flex-1 bg-surface rounded-2xl p-4 items-center">
            <Text className="text-white text-2xl font-bold">
              {userProfile.stats.messagesCount}
            </Text>
            <Text className="text-textMuted text-sm mt-1">Повідомлень</Text>
          </View>

          <View className="flex-1 bg-surface rounded-2xl p-4 items-center">
            <Text className="text-white text-2xl font-bold">
              {userProfile.stats.roomsCreatedCount}
            </Text>
            <Text className="text-textMuted text-sm mt-1">Кімнат створено</Text>
          </View>
        </View>

        <View className="bg-surface rounded-2xl p-4 mt-4">
          <Text className="text-textMuted text-sm">Дата регистрации</Text>
          <Text className="text-white text-base mt-1">
            {new Date(userProfile._creationTime).toLocaleDateString("uk-UA")}
          </Text>
        </View>

        {isOwnProfile && (
          <TouchableOpacity
            onPress={() => router.push("/profile")}
            className="bg-primary rounded-xl py-3.5 items-center mt-6"
          >
            <Text className="text-white font-bold text-base">
              Редактировать профиль
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <ImageViewerModal
        visible={!!fullscreenImage}
        imageUrl={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
      />
    </SafeAreaView>
  );
}