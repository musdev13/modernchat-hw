import { ActionSheet, SheetAction } from "@/components/ActionSheet";
import { GlassProvider, GlassTarget } from "@/components/Glass";
import { MainTabBar, useTabBarSpace } from "@/components/MainTabBar";
import { MuteSheet } from "@/components/MuteSheet";
import { RoomAvatar } from "@/components/RoomAvatar";
import { SearchField } from "@/components/SearchField";
import { SwipeableRoomItem } from "@/components/SwipeableRoomItem";
import { useTheme } from "@/context/ThemeContext";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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

export default function ChatsTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { colors: c } = useTheme();

  const rooms = useQuery(api.rooms.listRooms);
  const currentUser = useQuery(api.users.currentUser);
  const unread = useQuery(api.reads.getUnreadCounts);
  const typing = useQuery(api.typing.getTypingInMyRooms);
  const listExtra = useMemo(() => ({ unread, typing }), [unread, typing]);
  const getOrCreateSaved = useMutation(api.rooms.getOrCreateSavedRoom);
  const ensureReads = useMutation(api.reads.ensureReads);
  const deleteRoom = useMutation(api.rooms.deleteRoom);
  const removeParticipant = useMutation(api.rooms.removeParticipant);
  const hideRoom = useMutation(api.roomSettings.hideRoom);
  const setPinned = useMutation(api.roomSettings.setPinned);
  const setMuted = useMutation(api.roomSettings.setMuted);

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [menuRoomId, setMenuRoomId] = useState<Id<"chatRooms"> | null>(null);
  const [muteRoomId, setMuteRoomId] = useState<Id<"chatRooms"> | null>(null);

  // «Збережене» створюється при першому відкритті списку й завжди стоїть нагорі.
  const savedRequested = useRef(false);
  const hasSaved = rooms?.some((r) => r.isSaved) ?? true;
  useEffect(() => {
    if (hasSaved || savedRequested.current) return;
    savedRequested.current = true;
    getOrCreateSaved().catch(() => {
      savedRequested.current = false;
    });
  }, [getOrCreateSaved, hasSaved]);

  const typingTextOf = (roomId: string, isDirect: boolean) => {
    const names = typing?.[roomId];
    if (!names || names.length === 0) return undefined;
    if (isDirect) return "друкує…";
    return names.length === 1 ? `${names[0]} друкує…` : "кілька людей друкують…";
  };

  const filteredRooms = useMemo(() => {
    if (!rooms) return rooms;
    const q = search.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => r.title.toLowerCase().includes(q));
  }, [rooms, search]);

  // Для кімнат без запису про прочитання (старі дані) починаємо відлік з поточного моменту.
  const readsMissing = unread?.missing ?? false;
  useEffect(() => {
    if (readsMissing) ensureReads().catch(() => {});
  }, [ensureReads, readsMissing]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const showError = (error: any, fallback: string) =>
    Alert.alert("Помилка", error?.message ?? fallback);

  // Видалити / покинути (група) або приховати (особистий чат).
  const handleDeleteRoom = (roomId: Id<"chatRooms">) => {
    const room = rooms?.find((r) => r._id === roomId);
    if (!room) return;

    if (room.isDirect) {
      Alert.alert(
        "Приховати чат?",
        `Чат із «${room.title}» зникне зі списку. Історія збережеться, а чат повернеться, щойно з'явиться нове повідомлення.`,
        [
          { text: "Скасувати", style: "cancel" },
          {
            text: "Приховати",
            style: "destructive",
            onPress: () =>
              hideRoom({ chatRoomId: roomId }).catch((e) =>
                showError(e, "Не вдалося приховати чат"),
              ),
          },
        ],
      );
      return;
    }

    if (room.creatorId !== currentUser?._id) {
      Alert.alert("Покинути кімнату?", `Ви впевнені, що хочете покинути «${room.title}»?`, [
        { text: "Скасувати", style: "cancel" },
        {
          text: "Покинути",
          style: "destructive",
          onPress: async () => {
            if (!currentUser) return;
            try {
              await removeParticipant({ roomId, targetUserId: currentUser._id });
            } catch (error: any) {
              showError(error, "Не вдалося покинути кімнату");
            }
          },
        },
      ]);
      return;
    }

    Alert.alert(
      "Видалити кімнату?",
      `Ви впевнені, що хочете видалити кімнату «${room.title}» та всі її повідомлення? Цю дію неможливо скасувати.`,
      [
        { text: "Скасувати", style: "cancel" },
        {
          text: "Видалити",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRoom({ roomId });
            } catch (error: any) {
              showError(error, "Не вдалося видалити кімнату");
            }
          },
        },
      ],
    );
  };

  const menuRoom = menuRoomId ? rooms?.find((r) => r._id === menuRoomId) : undefined;
  const menuActions: SheetAction[] = menuRoom
    ? [
        {
          key: "pin",
          label: menuRoom.pinned ? "Відкріпити" : "Закріпити",
          icon: menuRoom.pinned ? "pin-outline" : "pin",
          onPress: () => {
            setPinned({ chatRoomId: menuRoom._id, pinned: !menuRoom.pinned })
              .then(() => Haptics.selectionAsync())
              .catch((e) => showError(e, "Не вдалося змінити закріплення"));
          },
        },
        {
          key: "mute",
          label: menuRoom.muted ? "Увімкнути сповіщення" : "Вимкнути сповіщення",
          icon: menuRoom.muted ? "notifications-outline" : "notifications-off-outline",
          onPress: () => {
            if (menuRoom.muted) {
              setMuted({ chatRoomId: menuRoom._id, muted: false }).catch((e) =>
                showError(e, "Не вдалося змінити сповіщення"),
              );
            } else {
              setMuteRoomId(menuRoom._id);
            }
          },
        },
        menuRoom.isDirect
          ? {
              key: "delete",
              label: "Приховати чат",
              icon: "eye-off-outline",
              destructive: true,
              onPress: () => handleDeleteRoom(menuRoom._id),
            }
          : {
              key: "delete",
              label: menuRoom.creatorId === currentUser?._id ? "Видалити кімнату" : "Покинути кімнату",
              icon: menuRoom.creatorId === currentUser?._id ? "trash-outline" : "exit-outline",
              destructive: true,
              onPress: () => handleDeleteRoom(menuRoom._id),
            },
      ]
    : [];

  const profileName = currentUser?.name ?? currentUser?.username ?? "";
  // Окрім «Збереженого» чатів немає.
  const onlySaved = rooms !== undefined && rooms.every((r) => r.isSaved);
  const isEmpty = rooms !== undefined && rooms.length === 0;

  return (
    <GlassProvider>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {/* Шапка: власний аватар (→ Профіль), заголовок, «нове повідомлення», пошук */}
        <View
          style={{
            backgroundColor: c.header,
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
              onPress={() => router.navigate("/(app)/(tabs)/profile" as any)}
              activeOpacity={0.8}
              accessibilityLabel="Мій профіль"
              style={{ flexDirection: "row", alignItems: "center" }}
            >
              <RoomAvatar
                title={profileName || "me"}
                imageUrl={currentUser?.image}
                size={40}
                style={{ marginRight: 10 }}
              />
              <Text style={{ color: c.text, fontSize: 22, fontWeight: "700" }}>Чати</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/new-message" as any)}
              activeOpacity={0.8}
              accessibilityLabel="Нове повідомлення"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: c.search,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="create-outline" size={22} color={c.accent} />
            </TouchableOpacity>
          </View>

          <SearchField value={search} onChangeText={setSearch} placeholder="Пошук чатів" />
        </View>

        <GlassTarget style={{ flex: 1, backgroundColor: c.bg }}>
          {filteredRooms === undefined ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={c.accent} />
              <Text style={{ color: c.muted, fontSize: 12, marginTop: 12 }}>
                Завантаження чатів...
              </Text>
            </View>
          ) : isEmpty ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: 24,
                paddingBottom: tabSpace,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: c.search,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Ionicons name="chatbubbles-outline" size={34} color={c.muted} />
              </View>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: "700", textAlign: "center" }}>
                Поки немає чатів
              </Text>
              <Text style={{ color: c.muted, fontSize: 14, textAlign: "center", marginTop: 4 }}>
                Напишіть комусь із вкладки «Контакти» або створіть групу кнопкою внизу праворуч
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredRooms}
              extraData={listExtra}
              keyExtractor={(item) => item._id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: tabSpace + 80 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />
              }
              ListFooterComponent={
                onlySaved && !search.trim() ? (
                  <View style={{ alignItems: "center", paddingTop: 40, paddingHorizontal: 32 }}>
                    <Ionicons name="chatbubbles-outline" size={44} color={c.muted} />
                    <Text style={{ color: c.text, fontSize: 17, fontWeight: "700", marginTop: 12 }}>
                      Поки немає чатів
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 14, textAlign: "center", marginTop: 4 }}>
                      Напишіть комусь із вкладки «Контакти» або створіть групу кнопкою внизу праворуч
                    </Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingTop: 48 }}>
                  <Ionicons name="search-outline" size={40} color={c.muted} />
                  <Text style={{ color: c.muted, fontSize: 15, marginTop: 10 }}>
                    Нічого не знайдено
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <SwipeableRoomItem
                  room={item}
                  isCreator={!item.isDirect && item.creatorId === currentUser?._id}
                  unreadCount={unread?.counts[item._id] ?? 0}
                  muted={item.muted}
                  online={item.otherOnline}
                  typingText={typingTextOf(item._id, item.isDirect)}
                  onPress={() => router.push(`/chat/${item._id}`)}
                  onDelete={handleDeleteRoom}
                  onLongPress={(id) => {
                    if (item.isSaved) return;
                    void Haptics.selectionAsync();
                    setMenuRoomId(id);
                  }}
                />
              )}
            />
          )}
        </GlassTarget>

        {/* Плаваюча кнопка: нове повідомлення */}
        <TouchableOpacity
          onPress={() => router.push("/new-message" as any)}
          activeOpacity={0.85}
          accessibilityLabel="Нове повідомлення"
          style={{
            position: "absolute",
            right: 18,
            bottom: tabSpace + 4,
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: c.accent,
            alignItems: "center",
            justifyContent: "center",
            elevation: 6,
            shadowColor: "#000",
            shadowOpacity: 0.35,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            zIndex: 35,
          }}
        >
          <Ionicons name="pencil" size={24} color={c.onAccent} />
        </TouchableOpacity>

        <MainTabBar active="chats" />

        <MuteSheet
          visible={!!muteRoomId}
          title={rooms?.find((r) => r._id === muteRoomId)?.title}
          onClose={() => setMuteRoomId(null)}
          onPick={(durationMs) => {
            const roomId = muteRoomId;
            setMuteRoomId(null);
            if (!roomId) return;
            setMuted({ chatRoomId: roomId, muted: true, durationMs }).catch((e) =>
              showError(e, "Не вдалося вимкнути сповіщення"),
            );
          }}
        />

        <ActionSheet
          visible={!!menuRoom}
          onClose={() => setMenuRoomId(null)}
          title={menuRoom?.title}
          subtitle={menuRoom?.isDirect ? "Особистий чат" : "Група"}
          avatar={
            menuRoom ? (
              <RoomAvatar
                title={menuRoom.title}
                imageUrl={menuRoom.avatarUrl}
                size={44}
                saved={menuRoom.isSaved}
              />
            ) : undefined
          }
          actions={menuActions}
        />
      </View>
    </GlassProvider>
  );
}
