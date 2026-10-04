import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";

import { EditProfileModal } from "@/components/EditProfileModal";
import { PopoverMenu } from "@/components/PopoverMenu";
import { QrOverlay } from "@/components/QrOverlay";
import { MainTabBar, useTabBarSpace } from "@/components/MainTabBar";
import type { ViewerAction } from "@/components/MediaViewer";
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
import { useAnimatedAvatar } from "@/hooks/useAnimatedAvatar";
import { StretchyProfile, type ProfilePhoto } from "@/components/StretchyProfile";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette } from "@/hooks/useChatPalette";
import { formatBirthday, userLink } from "@/utils/profileFormat";
import { pickSquareImage, uploadImageToStorage } from "@/utils/upload";

const TABS = [
  { key: "photos", label: "Фото" },
  { key: "groups", label: "Групи" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const c = useChatPalette();
  const tabSpace = useTabBarSpace();
  const { user: clerkUser } = useUser();

  const currentUser = useQuery(api.users.currentUser);
  const profile = useQuery(
    api.users.getUserProfile,
    currentUser?._id ? { userId: currentUser._id } : "skip",
  );
  const photoRows = useQuery(
    api.profilePhotos.list,
    currentUser?._id ? { userId: currentUser._id } : "skip",
  );
  const rooms = useQuery(
    api.users.getSharedRooms,
    currentUser?._id ? { userId: currentUser._id } : "skip",
  );
  const { pick: pickAnimated, busy: animBusy } = useAnimatedAvatar();
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const addPhoto = useMutation(api.profilePhotos.add);
  const setCurrent = useMutation(api.profilePhotos.setCurrent);
  const removePhoto = useMutation(api.profilePhotos.remove);

  const [editVisible, setEditVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState("photos");
  const [viewerReq, setViewerReq] = useState<{ index: number; key: number } | null>(null);
  const { copy: handleCopy, toast: copyToast } = useCopyToast();
  const { open: openRowMenu, sheet: rowMenuSheet } = useRowMenu();

  const photos = useMemo<ProfilePhoto[]>(
    () => (photoRows ?? []).map((p) => ({ id: p._id, url: p.url, createdAt: p.createdAt })),
    [photoRows],
  );

  const handleSetPhoto = useCallback(async (): Promise<void> => {
    if (uploading) return;
    try {
      const picked = await pickSquareImage();
      if (!picked) return;
      setUploading(true);
      const uploadUrl = await generateUploadUrl();
      const storageId = await uploadImageToStorage(uploadUrl, picked);
      await addPhoto({ storageId });
      setTab("photos");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      console.error("Не вдалося встановити фото:", error);
      Alert.alert("Помилка", error?.message ?? "Не вдалося встановити фото.");
    } finally {
      setUploading(false);
    }
  }, [uploading, generateUploadUrl, addPhoto]);

  const viewerActions = useMemo<ViewerAction[]>(
    () => [
      {
        key: "make-main",
        label: "Зробити головним",
        icon: "person-circle-outline",
        closeFirst: true,
        onPress: (item, index) => {
          const row = photoRows?.find((p) => p._id === item.id);
          if (!row || row._id === ("legacy" as string) || row.isCurrent || index === 0) {
            Alert.alert("Головне фото", "Це фото вже головне.");
            return;
          }
          setCurrent({ photoId: item.id as Id<"profilePhotos"> }).catch((e: any) =>
            Alert.alert("Помилка", e?.message ?? "Не вдалося змінити фото."),
          );
        },
      },
      {
        key: "delete",
        label: "Видалити",
        icon: "trash-outline",
        destructive: true,
        closeFirst: true,
        onPress: (item) => {
          if (item.id === "legacy" || item.id === "main") {
            Alert.alert("Видалення", "Додайте нове фото — тоді можна буде видалити поточне.");
            return;
          }
          Alert.alert("Видалити фото?", "Фото буде видалено з вашого профілю.", [
            { text: "Скасувати", style: "cancel" },
            {
              text: "Видалити",
              style: "destructive",
              onPress: () => {
                removePhoto({ photoId: item.id as Id<"profilePhotos"> }).catch((e: any) =>
                  Alert.alert("Помилка", e?.message ?? "Не вдалося видалити фото."),
                );
              },
            },
          ]);
        },
      },
    ],
    [photoRows, setCurrent, removePhoto],
  );

  const actions = useMemo(
    () => [
      { key: "photo", icon: "camera-outline" as const, label: "Встановити фото", onPress: handleSetPhoto },
      { key: "anim", icon: "film-outline" as const, label: "Анімація", onPress: (): void => void pickAnimated() },
      { key: "edit", icon: "create-outline" as const, label: "Змінити", onPress: () => setEditVisible(true) },
      {
        key: "settings",
        icon: "settings-outline" as const,
        label: "Налаштування",
        onPress: () => router.navigate("/(app)/(tabs)/preferences" as any),
      },
    ],
    [handleSetPhoto, pickAnimated, router],
  );

  if (currentUser === undefined || (currentUser && profile === undefined)) {
    return <ProfileSkeleton />;
  }

  if (!currentUser || !profile) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, backgroundColor: c.divider }}
      >
        <Text style={{ color: c.text, fontSize: 18, textAlign: "center" }}>
          Не вдалося завантажити профіль
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

  const phone = profile.phone || clerkUser?.primaryPhoneNumber?.phoneNumber || undefined;
  const birthday = formatBirthday(profile.birthday);
  const username = profile.username ? `@${profile.username}` : undefined;
  const link = profile.username ? userLink(profile.username) : undefined;
  const edit = { key: "edit", label: "Змінити", icon: "create-outline" as const, onPress: () => setEditVisible(true) };

  return (
    <>
      <StretchyProfile
        name={profile.name}
        isPremium={profile.isPremium}
        emojiStatus={profile.emojiStatus}
        avatarAnimUrl={profile.avatarAnimUrl}
        avatarAnimKind={profile.avatarAnimKind}
        imageUrl={profile.image}
        photos={photos}
        viewerActions={viewerActions}
        openViewerRequest={viewerReq}
        status="в мережі"
        statusAccent
        busy={uploading || animBusy}
        actions={actions}
        leftIcon="qr-code-outline"
        leftLabel="QR-код"
        onLeftPress={() => setQrVisible(true)}
        lockGestures={qrVisible}
        rightIcon="ellipsis-vertical"
        rightLabel="Меню"
        onRightPress={() => setMenuVisible(true)}
        floatingAction={
          tab === "photos" ? (
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={uploading}
                onPress={() => void handleSetPhoto()}
                accessibilityRole="button"
                accessibilityLabel="Додати фото"
                style={{
                  position: "absolute",
                  alignSelf: "center",
                  bottom: tabSpace + 6,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  height: 46,
                  paddingHorizontal: 20,
                  borderRadius: 23,
                  backgroundColor: c.accent,
                  opacity: uploading ? 0.7 : 1,
                  shadowColor: "#000",
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 6,
                }}
              >
                <Ionicons name="camera" size={20} color={c.onAccent} />
                <Text style={{ color: c.onAccent, fontSize: 15, fontWeight: "700" }}>
                  {uploading ? "Завантаження…" : "Додати фото"}
                </Text>
              </TouchableOpacity>
            ) : null
        }
        bottomOverlay={
          <>
            <MainTabBar active="profile" />
            <QrOverlay
              visible={qrVisible}
              onClose={() => setQrVisible(false)}
              name={profile.name}
              username={profile.username}
              avatarUrl={profile.image}
            />
          </>
        }
        bottomInset={tabSpace + 56}
      >
        <Section>
          <InfoRow
            first
            icon="call-outline"
            value={phone}
            placeholder="Додати номер телефону"
            label="Мобільний"
            onPress={phone ? () => handleCopy(phone) : () => setEditVisible(true)}
            onLongPress={
              phone
                ? () =>
                    openRowMenu("Мобільний", [
                      { key: "copy", label: "Копіювати", icon: "copy-outline", onPress: () => handleCopy(phone) },
                      edit,
                    ])
                : undefined
            }
          />
          <InfoRow
            icon="information-circle-outline"
            value={profile.bio}
            placeholder="Розкажіть про себе"
            label="Про себе"
            onPress={profile.bio ? () => handleCopy(profile.bio!) : () => setEditVisible(true)}
            onLongPress={
              profile.bio
                ? () =>
                    openRowMenu("Про себе", [
                      { key: "copy", label: "Копіювати", icon: "copy-outline", onPress: () => handleCopy(profile.bio!) },
                      edit,
                    ])
                : undefined
            }
          />
          <InfoRow
            icon="at"
            value={username}
            placeholder="Додати ім'я користувача"
            label="Ім'я користувача"
            onPress={username ? () => handleCopy(username) : () => setEditVisible(true)}
            onLongPress={
              username
                ? () =>
                    openRowMenu("Ім'я користувача", [
                      { key: "copy", label: "Копіювати", icon: "copy-outline", onPress: () => handleCopy(username) },
                      {
                        key: "link",
                        label: "Скопіювати посилання",
                        icon: "link-outline",
                        onPress: () => handleCopy(link!, "Посилання скопійовано"),
                      },
                      edit,
                    ])
                : undefined
            }
          />
          <InfoRow
            icon="gift-outline"
            value={birthday}
            placeholder="Додати день народження"
            label="День народження"
            onPress={birthday ? () => handleCopy(birthday) : () => setEditVisible(true)}
            onLongPress={
              birthday
                ? () =>
                    openRowMenu("День народження", [
                      { key: "copy", label: "Копіювати", icon: "copy-outline", onPress: () => handleCopy(birthday) },
                      edit,
                    ])
                : undefined
            }
          />
        </Section>

        <ProfileTabs tabs={TABS} active={tab} onChange={setTab} />
        {tab === "photos" ? (
          <PhotoGrid
            photos={photos}
            emptyText="Додайте перше фото профілю"
            onPress={(index) => setViewerReq((r) => ({ index, key: (r?.key ?? 0) + 1 }))}
          />
        ) : (
          <RoomsList
            rooms={rooms ?? []}
            emptyText="Ви ще не в жодній групі"
            onPress={(id) => router.push(`/chat/${id}` as any)}
          />
        )}
      </StretchyProfile>
      {copyToast}
      {rowMenuSheet}

      <PopoverMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        actions={[
          ...(link
            ? [
                {
                  key: "link",
                  label: "Скопіювати посилання",
                  icon: "link-outline" as const,
                  onPress: () => handleCopy(link, "Посилання скопійовано"),
                },
              ]
            : []),
          {
            key: "settings",
            label: "Налаштування",
            icon: "settings-outline" as const,
            onPress: () => router.navigate("/(app)/(tabs)/preferences" as any),
          },
        ]}
      />

      <EditProfileModal
        visible={editVisible}
        initialName={profile.name}
        initialUsername={profile.username}
        initialBio={profile.bio}
        initialImage={profile.image}
        initialBirthday={profile.birthday}
        initialPhone={profile.phone}
        onClose={() => setEditVisible(false)}
        onSaved={() => setEditVisible(false)}
      />
    </>
  );
}
