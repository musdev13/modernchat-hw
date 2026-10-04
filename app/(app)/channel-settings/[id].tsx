import { EditRoomModal } from "@/components/EditRoomModal";
import { RoomAvatar } from "@/components/RoomAvatar";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette } from "@/hooks/useChatPalette";
import { channelLink, slugHint } from "@/utils/channel";
import { copyText } from "@/utils/clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Налаштування каналу: назва/опис/фото, тип (публічний/приватний), посилання, видалення. */
export default function ChannelSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roomId = id as Id<"chatRooms">;
  const router = useRouter();
  const c = useChatPalette();
  const insets = useSafeAreaInsets();

  const room = useQuery(api.rooms.getRoom, { roomId });
  const currentUser = useQuery(api.users.currentUser);
  const updateAccess = useMutation(api.channels.updateChannelAccess);
  const regenerate = useMutation(api.channels.regenerateInviteLink);
  const unlinkDiscussion = useMutation(api.channels.unlinkDiscussionGroup);
  const deleteRoom = useMutation(api.rooms.deleteRoom);

  const [editVisible, setEditVisible] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [synced, setSynced] = useState(false);

  // Початкові значення беремо з сервера один раз.
  useEffect(() => {
    if (!room || synced) return;
    setIsPublic(!!room.isPublic);
    setSlug(room.isPublic ? (room.slug ?? "") : "");
    setSynced(true);
  }, [room, synced]);

  const isCreator = !!room && room.creatorId === currentUser?._id;
  const normalized = slug.trim().toLowerCase();
  const localError = isPublic ? slugHint(normalized) : null;
  const slugCheck = useQuery(
    api.channels.checkSlug,
    isPublic && !localError ? { slug: normalized, exceptRoomId: roomId } : "skip",
  );
  const slugError = localError ?? (slugCheck && !slugCheck.ok ? slugCheck.reason : null);

  const changed =
    !!room && (isPublic !== !!room.isPublic || (isPublic && normalized !== (room.slug ?? "")));
  const canSave = isCreator && changed && !saving && (!isPublic || (!slugError && slugCheck?.ok === true));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAccess({ roomId, isPublic, slug: isPublic ? normalized : undefined });
    } catch (error: any) {
      Alert.alert("Помилка", error?.message ?? "Не вдалося зберегти налаштування");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = () => {
    Alert.alert(
      "Оновити посилання?",
      "Попереднє запрошувальне посилання перестане працювати.",
      [
        { text: "Скасувати", style: "cancel" },
        {
          text: "Оновити",
          onPress: async () => {
            try {
              await regenerate({ roomId });
            } catch (error: any) {
              Alert.alert("Помилка", error?.message ?? "Не вдалося оновити посилання");
            }
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    if (!room) return;
    Alert.alert("Видалити канал?", `Канал «${room.title}» та всі його публікації будуть видалені назавжди.`, [
      { text: "Скасувати", style: "cancel" },
      {
        text: "Видалити",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteRoom({ roomId });
            router.dismissAll();
            router.replace("/(app)");
          } catch (error: any) {
            Alert.alert("Помилка", error?.message ?? "Не вдалося видалити канал");
          }
        },
      },
    ]);
  };

  const section = (text: string) => (
    <Text
      style={{
        color: c.accent,
        fontSize: 14,
        fontWeight: "700",
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 6,
      }}
    >
      {text}
    </Text>
  );

  const typeOption = (value: boolean, label: string, hint: string) => {
    const active = isPublic === value;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={!isCreator}
        onPress={() => {
          setIsPublic(value);
          if (value && !slug) setSlug("");
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          opacity: isCreator ? 1 : 0.6,
        }}
      >
        <Ionicons
          name={active ? "radio-button-on" : "radio-button-off"}
          size={24}
          color={active ? c.accent : c.muted}
        />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{label}</Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>{hint}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ backgroundColor: c.header, paddingTop: insets.top + 8, paddingHorizontal: 8, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", height: 48 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="arrow-back" size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: "700", marginLeft: 4 }}>
            Налаштування каналу
          </Text>
        </View>
      </View>

      {!room ? (
        <View style={{ paddingTop: 48 }}>
          {room === undefined ? (
            <ActivityIndicator color={c.accent} />
          ) : (
            <Text style={{ color: c.muted, textAlign: "center" }}>Канал не знайдено</Text>
          )}
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setEditVisible(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: c.header,
              marginTop: 10,
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <RoomAvatar title={room.title} imageUrl={room.avatarUrl} size={56} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text numberOfLines={1} style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>
                {room.title}
              </Text>
              <Text numberOfLines={2} style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>
                {room.description || "Назва, опис і фото каналу"}
              </Text>
            </View>
            <Ionicons name="create-outline" size={22} color={c.accent} />
          </TouchableOpacity>

          {section("Тип каналу")}
          <View style={{ backgroundColor: c.header }}>
            {typeOption(true, "Публічний канал", "Знаходиться в пошуку, приєднатись може будь-хто")}
            {typeOption(false, "Приватний канал", "Приєднатись можна лише за запрошувальним посиланням")}
          </View>

          {section(isPublic ? "Публічне посилання" : "Запрошувальне посилання")}
          <View style={{ backgroundColor: c.header, paddingHorizontal: 16, paddingVertical: 8 }}>
            {isPublic ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: c.muted, fontSize: 16 }}>modesto://c/</Text>
                <TextInput
                  value={slug}
                  editable={isCreator}
                  onChangeText={(text) => setSlug(text.replace(/[^A-Za-z0-9_]/g, "").slice(0, 32))}
                  placeholder="посилання"
                  placeholderTextColor={c.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={32}
                  style={{ flex: 1, color: c.text, fontSize: 16, paddingVertical: 10 }}
                />
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => room.slug && void copyText(channelLink(room.slug))}
                style={{ paddingVertical: 8 }}
              >
                <Text numberOfLines={1} style={{ color: c.text, fontSize: 16 }}>
                  {room.slug && !room.isPublic ? channelLink(room.slug) : "Буде створено після збереження"}
                </Text>
                <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>Торкніться, щоб скопіювати</Text>
              </TouchableOpacity>
            )}
          </View>
          {isPublic ? (
            <Text
              style={{
                color: slugError ? c.danger : slugCheck?.ok ? "#34C759" : c.muted,
                fontSize: 13,
                paddingHorizontal: 16,
                paddingTop: 8,
              }}
            >
              {slugError
                ? slugError
                : slugCheck === undefined
                  ? "Перевіряємо посилання…"
                  : "Посилання вільне"}
              {"\nДопустимі символи: a–z, 0–9 та _. Довжина від 4 до 32 символів."}
            </Text>
          ) : null}

          {isCreator && changed ? (
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={!canSave}
              onPress={() => void handleSave()}
              style={{
                height: 48,
                marginHorizontal: 16,
                marginTop: 16,
                borderRadius: 14,
                backgroundColor: canSave ? c.accent : c.search,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {saving ? (
                <ActivityIndicator color={c.onAccent} />
              ) : (
                <Text style={{ color: canSave ? c.onAccent : c.muted, fontSize: 16, fontWeight: "700" }}>
                  Зберегти
                </Text>
              )}
            </TouchableOpacity>
          ) : null}

          {isCreator && !room.isPublic && !changed ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleRegenerate}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: c.header,
                marginTop: 14,
                paddingHorizontal: 16,
                height: 52,
              }}
            >
              <Ionicons name="refresh-outline" size={22} color={c.accent} />
              <Text style={{ color: c.accent, fontSize: 16, marginLeft: 14 }}>Оновити посилання</Text>
            </TouchableOpacity>
          ) : null}

          {isCreator && room.discussion ? (
            <>
              {section("Обговорення")}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  Alert.alert("Відвʼязати групу?", `Група «${room.discussion!.title}» більше не буде обговоренням каналу.`, [
                    { text: "Скасувати", style: "cancel" },
                    {
                      text: "Відвʼязати",
                      style: "destructive",
                      onPress: () =>
                        void unlinkDiscussion({ channelId: roomId }).catch((error: any) =>
                          Alert.alert("Помилка", error?.message ?? "Не вдалося відвʼязати групу"),
                        ),
                    },
                  ])
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: c.header,
                  paddingHorizontal: 16,
                  height: 52,
                }}
              >
                <Ionicons name="unlink-outline" size={22} color={c.muted} />
                <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, marginLeft: 14, flex: 1 }}>
                  Відвʼязати «{room.discussion.title}»
                </Text>
              </TouchableOpacity>
            </>
          ) : null}

          {isCreator ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleDelete}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: c.header,
                marginTop: 24,
                paddingHorizontal: 16,
                height: 52,
              }}
            >
              <Ionicons name="trash-outline" size={22} color={c.danger} />
              <Text style={{ color: c.danger, fontSize: 16, fontWeight: "600", marginLeft: 14 }}>
                Видалити канал
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ color: c.muted, fontSize: 13, padding: 16 }}>
              Тип, посилання та видалення каналу доступні лише його творцю.
            </Text>
          )}
        </ScrollView>
      )}

      {room ? (
        <EditRoomModal
          visible={editVisible}
          roomId={roomId}
          initialTitle={room.title}
          initialDescription={room.description}
          initialAvatarUrl={room.avatarUrl}
          onClose={() => setEditVisible(false)}
        />
      ) : null}
    </View>
  );
}
