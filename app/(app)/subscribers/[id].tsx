import { ActionSheet, SheetAction } from "@/components/ActionSheet";
import { AddMembersModal } from "@/components/AddMembersModal";
import { MemberItem, MemberRow } from "@/components/RoomInfoRows";
import { RoomAvatar } from "@/components/RoomAvatar";
import { SearchField } from "@/components/SearchField";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette } from "@/hooks/useChatPalette";
import { subscribersLabel } from "@/utils/channel";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Підписники каналу (або лише адміністратори, `?admins=1`): пошук, підвищення, вилучення. */
export default function SubscribersScreen() {
  const { id, admins } = useLocalSearchParams<{ id: string; admins?: string }>();
  const roomId = id as Id<"chatRooms">;
  const adminsOnly = admins === "1";
  const router = useRouter();
  const c = useChatPalette();
  const insets = useSafeAreaInsets();

  const room = useQuery(api.rooms.getRoom, { roomId });
  const currentUser = useQuery(api.users.currentUser);
  const onlineIds = useQuery(api.roomMedia.getRoomOnlineUserIds, { chatRoomId: roomId });
  const updateRole = useMutation(api.rooms.updateParticipantRole);
  const removeParticipant = useMutation(api.rooms.removeParticipant);

  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<MemberItem | null>(null);
  const [addVisible, setAddVisible] = useState(false);

  const myId = currentUser?._id;
  const isCreator = !!room && room.creatorId === myId;
  const canManage = room?.canManageMembers ?? false;
  const onlineSet = useMemo(() => new Set<string>(onlineIds ?? []), [onlineIds]);

  const members = useMemo(() => {
    if (!room) return [];
    const rank = { creator: 0, admin: 1, member: 2 } as const;
    const needle = query.trim().toLowerCase();
    return room.participants
      .filter((p) => (!adminsOnly || p.role !== "member") && (!needle || p.name.toLowerCase().includes(needle)))
      .sort((a, b) => rank[a.role] - rank[b.role] || a.name.localeCompare(b.name, "uk"));
  }, [adminsOnly, query, room]);

  const canKick = (member: MemberItem) =>
    member.role !== "creator" &&
    member._id !== myId &&
    (isCreator || (room?.currentUserRole === "admin" && member.role === "member"));

  const handleRole = async (targetUserId: Id<"users">, role: "admin" | "member") => {
    try {
      await updateRole({ roomId, targetUserId, role });
    } catch (error: any) {
      Alert.alert("Помилка", error?.message ?? "Не вдалося змінити роль");
    }
  };

  const handleKick = (member: MemberItem) => {
    Alert.alert("Видалити підписника?", `Видалити ${member.name} з каналу?`, [
      { text: "Скасувати", style: "cancel" },
      {
        text: "Видалити",
        style: "destructive",
        onPress: async () => {
          try {
            await removeParticipant({ roomId, targetUserId: member._id });
          } catch (error: any) {
            Alert.alert("Помилка", error?.message ?? "Не вдалося видалити підписника");
          }
        },
      },
    ]);
  };

  const openMember = (member: MemberItem) => {
    if (member._id === myId) return;
    if (canManage) setSheet(member);
    else router.push(`/user/${member._id}` as any);
  };

  const actions: SheetAction[] = [];
  if (sheet) {
    actions.push({
      key: "profile",
      label: "Переглянути профіль",
      icon: "person-outline",
      onPress: () => router.push(`/user/${sheet._id}` as any),
    });
    if (isCreator && sheet.role !== "creator") {
      actions.push(
        sheet.role === "admin"
          ? {
              key: "demote",
              label: "Зняти права адміністратора",
              icon: "shield-outline",
              onPress: () => void handleRole(sheet._id, "member"),
            }
          : {
              key: "promote",
              label: "Призначити адміністратором",
              icon: "shield-checkmark-outline",
              onPress: () => void handleRole(sheet._id, "admin"),
            },
      );
    }
    if (canKick(sheet)) {
      actions.push({
        key: "kick",
        label: "Видалити з каналу",
        icon: "person-remove-outline",
        destructive: true,
        onPress: () => handleKick(sheet),
      });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ backgroundColor: c.header, paddingTop: insets.top + 8, paddingHorizontal: 8, paddingBottom: 8 }}>
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
          <View style={{ marginLeft: 4, flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: "700" }}>
              {adminsOnly ? "Адміністратори" : "Підписники"}
            </Text>
            {room ? (
              <Text style={{ color: c.muted, fontSize: 13 }}>
                {adminsOnly
                  ? `${room.participants.filter((p) => p.role !== "member").length}`
                  : subscribersLabel(room.participants.length)}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={{ paddingHorizontal: 6, paddingTop: 4 }}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={adminsOnly ? "Пошук адміністраторів" : "Пошук підписників"}
          />
        </View>
      </View>

      {room === undefined ? (
        <View style={{ paddingTop: 48 }}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : room === null ? (
        <Text style={{ color: c.muted, textAlign: "center", padding: 32 }}>Канал не знайдено</Text>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m._id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            canManage && !adminsOnly && !query.trim() ? (
              <TouchableOpacity
                activeOpacity={0.6}
                onPress={() => setAddVisible(true)}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: 56 }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: c.accent,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="person-add" size={20} color={c.onAccent} />
                </View>
                <Text style={{ color: c.accent, fontSize: 16, fontWeight: "600", marginLeft: 14 }}>
                  Додати підписників
                </Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <Text style={{ color: c.muted, textAlign: "center", padding: 32 }}>Нікого не знайдено</Text>
          }
          renderItem={({ item }) => (
            <MemberRow
              member={item}
              isMe={item._id === myId}
              online={onlineSet.has(item._id)}
              onPress={openMember}
              onLongPress={(m) => {
                if (m._id === myId || !canManage) return;
                void Haptics.selectionAsync();
                setSheet(m);
              }}
            />
          )}
        />
      )}

      <ActionSheet
        visible={!!sheet}
        onClose={() => setSheet(null)}
        title={sheet?.name}
        subtitle={
          sheet
            ? sheet.role === "creator"
              ? "Творець каналу"
              : sheet.role === "admin"
                ? "Адміністратор"
                : "Підписник"
            : undefined
        }
        avatar={sheet ? <RoomAvatar title={sheet.name} imageUrl={sheet.image} size={44} /> : undefined}
        actions={actions}
      />

      {room ? (
        <AddMembersModal
          visible={addVisible}
          roomId={roomId}
          participantIds={room.participantIds}
          onClose={() => setAddVisible(false)}
        />
      ) : null}
    </View>
  );
}
