import { SwipeableRoomItem } from "@/components/SwipeableRoomItem";
import { BouncyPressable } from "@/components/BouncyPressable";
import { StoryRail } from "@/components/StoryRail";
import { getThemeColors, useAppTheme } from "@/components/AppThemeProvider";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery } from "convex/react";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);

  const rooms = useQuery(api.rooms.listRooms);
  const currentUser = useQuery(api.users.currentUser);
  const deleteRoom = useMutation(api.rooms.deleteRoom);
  const removeParticipant = useMutation(api.rooms.removeParticipant);
  const toggleFavorite = useMutation(api.rooms.toggleFavorite);

  const [refreshing, setRefreshing] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const visibleRooms = rooms?.filter(
    (room) => !showFavorites || room.isFavorite,
  );

  const handleFavoriteToggle = async (roomId: Id<"chatRooms">) => {
    try {
      await toggleFavorite({ roomId });
    } catch (error) {
      console.error("Не вдалося змінити обране:", error);
      Alert.alert("Помилка", "Не вдалося змінити список обраних кімнат.");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);

    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  };

  const handleDeleteRoom = (roomId: Id<"chatRooms">) => {
    const room = rooms?.find((r) => r._id === roomId);

    if (!room) {
      return;
    }

    const isCreator = room.creatorId === currentUser?._id;

    if (!isCreator) {
      Alert.alert(
        "Покинути кімнату?",
        `Ви впевнені, що хочете покинути «${room.title}»?`,
        [
          {
            text: "Скасувати",
            style: "cancel",
          },
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
      "Видалити кімнату?",
      `Ви впевнені, що хочете видалити кімнату «${room.title}» та всі її повідомлення? Цю дію неможливо скасувати.`,
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

  const homeExtras = (
    <View className="px-4 pb-5 pt-2">
      <BouncyPressable
        onPress={() => router.push("/saved")}
        containerStyle={{ marginBottom: 8 }}
        contentStyle={{
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.surfaceLight,
          backgroundColor: colors.surface,
          paddingHorizontal: 13,
          paddingVertical: 10,
        }}
        accessibilityRole="button"
        accessibilityLabel="Відкрити особисте збережене"
      >
        <View
          className="mr-3 h-9 w-9 items-center justify-center rounded-[13px]"
          style={{ backgroundColor: `${colors.primary}25` }}
        >
          <Ionicons name="bookmark" size={18} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-white">
            Особисте «Збережене»
          </Text>
          <Text className="mt-0.5 text-[11px] text-textMuted">
            Нотатки та важливі повідомлення — тільки для тебе
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
      </BouncyPressable>

      {!currentUser?.isPremium && (
        <BouncyPressable
          onPress={() =>
            Alert.alert(
              "ModernChat Premium",
              "Преміум-підписка поки що недоступна. Це демонстраційна картка — покупка та статус акаунта не змінюються.",
            )
          }
          contentStyle={{
            overflow: "hidden",
            borderRadius: 18,
            borderWidth: 1,
            borderColor: `${colors.accent}70`,
          }}
          accessibilityRole="button"
          accessibilityLabel="Дізнатися про Premium"
        >
          <LinearGradient
            colors={[colors.primaryDark, colors.primary, colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="min-h-[88px] flex-row items-center px-5 py-4"
          >
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/15">
              <Ionicons name="sparkles" size={23} color="#FFFFFF" />
            </View>
            <View className="mr-2 flex-1 py-1">
              <Text className="text-[15px] font-extrabold leading-5 text-white">
                Відкрий більше з Premium
              </Text>
              <Text className="mt-1 text-xs leading-4 text-white/80">
                Більше сторисів та особливі можливості
              </Text>
            </View>
            <View className="rounded-full border border-white/20 bg-white/15 px-3 py-2">
              <Text className="text-[10px] font-bold text-white">СКОРО</Text>
            </View>
          </LinearGradient>
        </BouncyPressable>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: "Кімнати",

          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.push("/profile")}
              className="mr-3 h-11 w-11 items-center justify-center overflow-hidden rounded-2xl"
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, colors.accent, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="h-11 w-11 items-center justify-center rounded-2xl"
              >
                {currentUser?.image ? (
                  <Image
                    source={{ uri: currentUser.image }}
                    className="h-[39px] w-[39px] rounded-[13px]"
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="person" size={19} color="#FFFFFF" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          ),

          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/new-room")}
              style={{
                width: 44,
                height: 44,
                borderRadius: 15,
                borderWidth: 1.5,
                borderColor: `${colors.white}80`,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 5,
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Створити кімнату"
            >
              <Ionicons name="add" size={25} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        }}
      />

      <StoryRail />

      {rooms === undefined ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />

          <Text className="text-textMuted text-xs mt-3">
            Завантаження кімнат...
          </Text>
        </View>
      ) : rooms.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6 pb-20">
          <View className="w-[88px] h-[88px] rounded-[30px] bg-secondary border border-surfaceLight items-center justify-center mb-5">
            <Ionicons
              name="chatbubbles-outline"
              size={38}
              color={colors.primary}
            />
          </View>

          <Text className="text-white text-xl font-bold text-center">
            Немає активних кімнат
          </Text>

          <Text className="text-textMuted text-sm text-center mt-2 leading-5">
            Створи простір для своєї компанії{"\n"}і почни першу розмову
          </Text>
          <BouncyPressable
            onPress={() => router.push("/new-room")}
            containerStyle={{ marginTop: 20 }}
            contentStyle={{
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="flex-row items-center px-5 py-3"
            >
              <Ionicons name="add" size={19} color="#FFFFFF" />
              <Text className="ml-1.5 font-bold text-white" style={{ color: "#FFFFFF" }}>
                Створити кімнату
              </Text>
            </LinearGradient>
          </BouncyPressable>
        </View>
      ) : (
        <>
        <View className="mx-5 mb-1 mt-1 flex-row items-center justify-between">
          <Text className="text-base font-bold text-white">Твої чати</Text>
          <Text className="text-xs font-medium text-textMuted">
            {visibleRooms?.length ?? 0}
          </Text>
        </View>
        <View className="mx-4 mb-1 mt-2 flex-row rounded-full bg-secondary p-1">
          {[false, true].map((favoritesOnly) => (
            <BouncyPressable
              key={String(favoritesOnly)}
              onPress={() => setShowFavorites(favoritesOnly)}
              containerStyle={{ flex: 1 }}
              contentStyle={{
                minHeight: 40,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                backgroundColor: showFavorites === favoritesOnly
                  ? colors.primary
                  : "transparent",
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: showFavorites === favoritesOnly }}
            >
              <Ionicons
                name={favoritesOnly ? "star" : "chatbubbles"}
                size={15}
                color={showFavorites === favoritesOnly ? colors.white : colors.textMuted}
              />
              <Text
                className="ml-1.5 text-xs font-bold"
                style={{
                  color: showFavorites === favoritesOnly
                    ? "#FFFFFF"
                    : colors.textMuted,
                }}
              >
                {favoritesOnly ? "Обрані" : "Усі кімнати"}
              </Text>
            </BouncyPressable>
          ))}
        </View>
        {showFavorites && visibleRooms?.length === 0 ? (
          <View className="flex-1 items-center justify-center px-7 pb-16">
            <View className="mb-4 h-[76px] w-[76px] items-center justify-center rounded-[26px] bg-secondary">
              <Ionicons name="star-outline" size={34} color={colors.primary} />
            </View>
            <Text className="text-center text-lg font-bold text-white">
              Тут поки порожньо
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-textMuted">
              Позначай потрібні кімнати зірочкою, щоб швидко знаходити їх тут.
            </Text>
          </View>
        ) : (
        <FlatList
          style={{ flex: 1 }}
          data={visibleRooms}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 24,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListFooterComponent={homeExtras}
          renderItem={({ item }) => (
            <SwipeableRoomItem
              room={item}
              isCreator={item.creatorId === currentUser?._id}
              onPress={() => router.push(`/chat/${item._id}`)}
              onDelete={handleDeleteRoom}
              onToggleFavorite={() => void handleFavoriteToggle(item._id)}
            />
          )}
        />
        )}
        </>
      )}
    </View>
  );
}
