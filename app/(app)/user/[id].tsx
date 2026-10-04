import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";

import { MuteSheet } from "@/components/MuteSheet";
import { PopoverMenu } from "@/components/PopoverMenu";
import {
  InfoRow,
  PhotoGrid,
  ProfileSkeleton,
  ProfileTabs,
  RoomsList,
  Section,
  useCopyToast,
  useRowMenu,
} from "@/components/ProfileParts";
import { StretchyProfile, type ProfilePhoto } from "@/components/StretchyProfile";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette } from "@/hooks/useChatPalette";
import { useOpenDirectChat } from "@/hooks/useOpenDirectChat";
import { formatLastSeen } from "@/utils/chat";
import { formatBirthday, userLink } from "@/utils/profileFormat";

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

  const photoRows = useQuery(
    api.profilePhotos.list,
    id ? { userId: id as Id<"users"> } : "skip",
  );
  const photos = useMemo<ProfilePhoto[]>(
    () => (photoRows ?? []).map((p) => ({ id: p._id, url: p.url, createdAt: p.createdAt })),
    [photoRows],
  );
  const [tab, setTab] = useState("photos");
  const [menuVisible, setMenuVisible] = useState(false);
  const [viewerReq, setViewerReq] = useState<{ index: number; key: number } | null>(null);
  const { open: openRowMenu, sheet: rowMenuSheet } = useRowMenu();

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
  const { copy: handleCopy, toast: copyToast } = useCopyToast();

  if (profile === undefined || isSelf) {
    return <ProfileSkeleton />;
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

  const birthday = formatBirthday(profile.birthday);

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
      isPremium={profile.isPremium}
      emojiStatus={profile.emojiStatus}
      avatarAnimUrl={profile.avatarAnimUrl}
      avatarAnimKind={profile.avatarAnimKind}
      imageUrl={profile.image}
      status={status}
      statusAccent={profile.online}
      actions={actions}
      onBack={() => router.back()}
      photos={photos}
      openViewerRequest={viewerReq}
      rightIcon={profile.username ? "ellipsis-vertical" : undefined}
      rightLabel="Меню"
      onRightPress={profile.username ? () => setMenuVisible(true) : undefined}
    >
      {profile.phone || profile.bio || profile.username || birthday ? (
        <Section>
          {profile.phone ? (
            <InfoRow
              first
              icon="call-outline"
              value={profile.phone}
              label="Мобільний"
              onPress={() => handleCopy(profile.phone!)}
              onLongPress={() =>
                openRowMenu("Мобільний", [
                  { key: "copy", label: "Копіювати", icon: "copy-outline", onPress: () => handleCopy(profile.phone!) },
                ])
              }
            />
          ) : null}
          {profile.bio ? (
            <InfoRow
              first={!profile.phone}
              icon="information-circle-outline"
              value={profile.bio}
              label="Про себе"
              onPress={() => handleCopy(profile.bio!)}
              onLongPress={() =>
                openRowMenu("Про себе", [
                  { key: "copy", label: "Копіювати", icon: "copy-outline", onPress: () => handleCopy(profile.bio!) },
                ])
              }
            />
          ) : null}
          {profile.username ? (
            <InfoRow
              first={!profile.phone && !profile.bio}
              icon="at"
              value={`@${profile.username}`}
              label="Ім'я користувача"
              onPress={() => handleCopy(`@${profile.username}`)}
              onLongPress={() =>
                openRowMenu("Ім'я користувача", [
                  { key: "copy", label: "Копіювати", icon: "copy-outline", onPress: () => handleCopy(`@${profile.username}`) },
                  {
                    key: "link",
                    label: "Скопіювати посилання",
                    icon: "link-outline",
                    onPress: () => handleCopy(userLink(profile.username!), "Посилання скопійовано"),
                  },
                ])
              }
            />
          ) : null}
          {birthday ? (
            <InfoRow
              first={!profile.phone && !profile.bio && !profile.username}
              icon="gift-outline"
              value={birthday}
              label="День народження"
              onPress={() => handleCopy(birthday)}
              onLongPress={() =>
                openRowMenu("День народження", [
                  { key: "copy", label: "Копіювати", icon: "copy-outline", onPress: () => handleCopy(birthday) },
                ])
              }
            />
          ) : null}
        </Section>
      ) : null}

      <ProfileTabs
        tabs={[
          { key: "photos", label: "Фото" },
          { key: "groups", label: "Спільні групи" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "photos" ? (
        <PhotoGrid
          photos={photos}
          emptyText="Фото ще немає"
          onPress={(index) => setViewerReq((r) => ({ index, key: (r?.key ?? 0) + 1 }))}
        />
      ) : (
        <RoomsList
          rooms={sharedRooms ?? []}
          emptyText="Спільних груп немає"
          onPress={(rid) => router.push(`/chat/${rid}` as any)}
        />
      )}
    </StretchyProfile>
    {copyToast}
    {rowMenuSheet}

    <PopoverMenu
      visible={menuVisible}
      onClose={() => setMenuVisible(false)}
      actions={
        profile.username
          ? [
              {
                key: "link",
                label: "Скопіювати посилання",
                icon: "link-outline",
                onPress: () => handleCopy(userLink(profile.username!), "Посилання скопійовано"),
              },
            ]
          : []
      }
    />

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
