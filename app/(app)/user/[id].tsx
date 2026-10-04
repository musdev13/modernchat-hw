import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";

import { MuteSheet } from "@/components/MuteSheet";
import { InfoRow, Section, StatsRow } from "@/components/ProfileParts";
import { RoomAvatar } from "@/components/RoomAvatar";
import { StretchyProfile } from "@/components/StretchyProfile";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette } from "@/hooks/useChatPalette";
import { useOpenDirectChat } from "@/hooks/useOpenDirectChat";
import { dayLabel, formatLastSeen, membersLabel } from "@/utils/chat";
import { copyText } from "@/utils/clipboard";

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useChatPalette();

  const profile = useQuery(
    api.users.getUserProfile,
    id ? { userId: id as Id<"users"> } : "skip",
  );
  const sharedRooms = useQuery(
    api.users.getSharedRooms,
    id ? { userId: id as Id<"users"> } : "skip",
  );

  // Власний профіль відкриваємо в повному вигляді з редагуванням.
  const isSelf = profile?.isSelf === true;
  useEffect(() => {
    if (isSelf) router.navigate("/(app)/(tabs)/profile" as any);
  }, [isSelf, router]);

  // Особистий чат із цим користувачем (якщо він уже є) — для вимкнення сповіщень.
  const directRoom = useQuery(
    api.rooms.findDirectRoom,
    id && profile && !isSelf ? { otherUserId: id as Id<"users"> } : "skip",
  );
  const setMuted = useMutation(api.roomSettings.setMuted);
  const { open: openChat, busyId } = useOpenDirectChat("navigate");
  const [muteVisible, setMuteVisible] = useState(false);

  if (profile === undefined || isSelf) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.divider }}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, backgroundColor: c.divider }}
      >
        <Text style={{ color: c.text, fontSize: 18, textAlign: "center" }}>
          Користувача не знайдено
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ backgroundColor: c.accent, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12, marginTop: 20 }}
        >
          <Text style={{ color: c.onAccent, fontWeight: "700" }}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = formatLastSeen(profile.lastSeenAt, profile.online, profile.lastSeenHidden);

  const handleCopy = async (text: string) => {
    const result = await copyText(text);
    if (result === "copied") void Haptics.selectionAsync();
  };

  const actions: { key: string; icon: any; label: string; onPress: () => void }[] = [
    {
      key: "write",
      icon: "chatbubble-ellipses-outline",
      label: busyId ? "Відкриваємо…" : "Написати",
      onPress: () => openChat(profile._id),
    },
  ];
  if (directRoom) {
    actions.push({
      key: "mute",
      icon: directRoom.muted ? "notifications-outline" : "notifications-off-outline",
      label: directRoom.muted ? "Увімкнути" : "Без звуку",
      onPress: () => {
        if (!directRoom.muted) {
          setMuteVisible(true);
          return;
        }
        setMuted({ chatRoomId: directRoom.roomId, muted: false }).catch((error: any) =>
          Alert.alert("Помилка", error?.message ?? "Не вдалося змінити сповіщення"),
        );
      },
    });
  }
  if (profile.username) {
    actions.push({
      key: "copy",
      icon: "copy-outline",
      label: "Скопіювати нік",
      onPress: () => handleCopy(`@${profile.username}`),
    });
  }

  return (
    <>
    <StretchyProfile
      name={profile.name}
      imageUrl={profile.image}
      status={status}
      statusAccent={profile.online}
      actions={actions}
      onBack={() => router.back()}
    >
      {profile.username || profile.bio ? (
        <Section title="Інформація">
          {profile.username ? (
            <InfoRow
              first
              icon="at"
              value={`@${profile.username}`}
              label="Ім'я користувача"
              onPress={() => handleCopy(`@${profile.username}`)}
            />
          ) : null}
          {profile.bio ? (
            <InfoRow
              first={!profile.username}
              icon="information-circle-outline"
              value={profile.bio}
              label="Про себе"
            />
          ) : null}
        </Section>
      ) : null}

      <Section title="Активність">
        <StatsRow
          items={[
            { value: profile.stats.messagesCount, label: "Повідомлень" },
            { value: profile.stats.roomsCreatedCount, label: "Кімнат створено" },
          ]}
        />
        <InfoRow
          icon="calendar-outline"
          value={dayLabel(profile._creationTime)}
          label="Дата реєстрації"
        />
      </Section>

      {sharedRooms && sharedRooms.length > 0 ? (
        <Section title={`Спільні кімнати · ${sharedRooms.length}`}>
          {sharedRooms.map((room) => (
            <TouchableOpacity
              key={room._id}
              activeOpacity={0.6}
              onPress={() => router.push(`/chat/${room._id}` as any)}
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 }}
            >
              <RoomAvatar title={room.title} imageUrl={room.avatarUrl} size={44} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
                  {room.title}
                </Text>
                <Text style={{ color: c.muted, fontSize: 13, marginTop: 1 }}>
                  {membersLabel(room.memberCount)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 6 }} />
        </Section>
      ) : null}
    </StretchyProfile>

    <MuteSheet
      visible={muteVisible}
      title={profile.name}
      onClose={() => setMuteVisible(false)}
      onPick={(durationMs) => {
        setMuteVisible(false);
        if (!directRoom) return;
        setMuted({ chatRoomId: directRoom.roomId, muted: true, durationMs }).catch(
          (error: any) =>
            Alert.alert("Помилка", error?.message ?? "Не вдалося змінити сповіщення"),
        );
      }}
    />
    </>
  );
}
