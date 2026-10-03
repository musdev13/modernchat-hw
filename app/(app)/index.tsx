import { SwipeableRoomItem } from "@/components/SwipeableRoomItem";
import { TG, avatarColor, initialsOf } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TextInput,
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
  const [search, setSearch] = useState("");

  const filteredRooms = useMemo(() => {
    if (!rooms) return rooms;
    const q = search.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => r.title.toLowerCase().includes(q));
  }, [rooms, search]);

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

  const profileName = currentUser?.name ?? currentUser?.username ?? "";

  return (
    <View style={{ flex: 1, backgroundColor: TG.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Шапка: профіль, заголовок, пошук */}
      <View
        style={{
          backgroundColor: TG.header,
          paddingTop: insets.top + 8,
          paddingHorizontal: 14,
          paddingBottom: 10,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <TouchableOpacity
            onPress={() => router.push("/profile")}
            activeOpacity={0.8}
            accessibilityLabel="Мій профіль"
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                overflow: "hidden",
                backgroundColor: avatarColor(profileName || "me"),
                alignItems: "center",
                justifyContent: "center",
                marginRight: 10,
              }}
            >
              {currentUser?.image ? (
                <Image
                  source={{ uri: currentUser.image }}
                  style={{ width: 40, height: 40 }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
                  {initialsOf(profileName)}
                </Text>
              )}
            </View>
            <Text style={{ color: TG.text, fontSize: 22, fontWeight: "700" }}>
              Чати
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/new-room")}
            activeOpacity={0.8}
            accessibilityLabel="Нова група"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: TG.search,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="create-outline" size={22} color={TG.accent} />
          </TouchableOpacity>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: TG.search,
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 40,
          }}
        >
          <Ionicons name="search" size={18} color={TG.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Пошук чатів"
            placeholderTextColor={TG.muted}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={{
              flex: 1,
              color: TG.text,
              fontSize: 15,
              marginLeft: 8,
              paddingVertical: 0,
            }}
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch("")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Очистити пошук"
            >
              <Ionicons name="close-circle" size={18} color={TG.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {filteredRooms === undefined ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={TG.accent} />

          <Text style={{ color: TG.muted, fontSize: 12, marginTop: 12 }}>
            Завантаження кімнат...
          </Text>
        </View>
      ) : rooms && rooms.length === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: TG.search,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="chatbubbles-outline" size={34} color={TG.muted} />
          </View>

          <Text
            style={{
              color: TG.text,
              fontSize: 18,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            Немає активних кімнат
          </Text>

          <Text
            style={{
              color: TG.muted,
              fontSize: 14,
              textAlign: "center",
              marginTop: 4,
            }}
          >
            Створіть першу кімнату за допомогою кнопки внизу праворуч
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 110 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={TG.accent}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 48 }}>
              <Ionicons name="search-outline" size={40} color={TG.muted} />
              <Text style={{ color: TG.muted, fontSize: 15, marginTop: 10 }}>
                Нічого не знайдено
              </Text>
            </View>
          }
          ListFooterComponent={
            filteredRooms.length > 0 ? (
              <Text
                style={{
                  color: TG.muted,
                  fontSize: 12,
                  textAlign: "center",
                  marginTop: 16,
                  paddingHorizontal: 24,
                }}
              >
                Щоб видалити чат або вийти з нього — свайпніть вліво або
                затисніть чат
              </Text>
            ) : null
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

      {/* Плаваюча кнопка: нова група */}
      <TouchableOpacity
        onPress={() => router.push("/new-room")}
        activeOpacity={0.85}
        accessibilityLabel="Створити нову групу"
        style={{
          position: "absolute",
          right: 18,
          bottom: insets.bottom + 18,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: TG.accent,
          alignItems: "center",
          justifyContent: "center",
          elevation: 6,
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        <Ionicons name="pencil" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}
