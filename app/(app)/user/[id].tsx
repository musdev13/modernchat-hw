import { useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { ActionButtons, InfoRow, Section, StatsRow } from "@/components/ProfileParts";
import { RoomAvatar } from "@/components/RoomAvatar";
import { StretchyProfile } from "@/components/StretchyProfile";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette } from "@/hooks/useChatPalette";
import { dayLabel, formatTime, membersLabel } from "@/utils/chat";
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
    if (isSelf) router.replace("/profile" as any);
  }, [isSelf, router]);

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

  const status = profile.inChatNow
    ? "зараз у чаті"
    : profile.lastActiveAt
      ? `остання активність: ${dayLabel(profile.lastActiveAt)}, ${formatTime(profile.lastActiveAt)}`
      : undefined;

  const handleCopy = async (text: string) => {
    const result = await copyText(text);
    if (result === "copied") void Haptics.selectionAsync();
  };

  const actions = profile.username
    ? [
        {
          key: "copy",
          icon: "copy-outline" as const,
          label: "Скопіювати нік",
          onPress: () => handleCopy(`@${profile.username}`),
        },
      ]
    : [];

  return (
    <StretchyProfile
      name={profile.name}
      imageUrl={profile.image}
      status={status}
      statusAccent={profile.inChatNow}
      onBack={() => router.back()}
    >
      <ActionButtons items={actions} />

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
  );
}
