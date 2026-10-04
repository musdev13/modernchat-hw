import { useUser } from "@clerk/clerk-expo";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";

import { EditProfileModal, ProfileField } from "@/components/EditProfileModal";
import { ActionButtons, InfoRow, Section, StatsRow } from "@/components/ProfileParts";
import { MainTabBar, useTabBarSpace } from "@/components/MainTabBar";
import { StretchyProfile } from "@/components/StretchyProfile";
import { api } from "@/convex/_generated/api";
import { useChatPalette } from "@/hooks/useChatPalette";
import { dayLabel } from "@/utils/chat";
import { copyText } from "@/utils/clipboard";
import { pickSquareImage, uploadImageToStorage } from "@/utils/upload";

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
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const updateProfile = useMutation(api.users.updateUserProfile);

  const [editVisible, setEditVisible] = useState(false);
  const [focusField, setFocusField] = useState<ProfileField | undefined>();
  const [uploading, setUploading] = useState(false);

  if (currentUser === undefined || (currentUser && profile === undefined)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.divider }}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
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

  const openEdit = (field?: ProfileField) => {
    setFocusField(field);
    setEditVisible(true);
  };

  const handleSetPhoto = async () => {
    if (uploading) return;
    const picked = await pickSquareImage();
    if (!picked) return;
    try {
      setUploading(true);
      const uploadUrl = await generateUploadUrl();
      const avatarStorageId = await uploadImageToStorage(uploadUrl, picked);
      await updateProfile({
        name: profile.name,
        username: profile.username,
        bio: profile.bio,
        avatarStorageId,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      console.error("Не вдалося встановити фото:", error);
      Alert.alert("Помилка", error?.message ?? "Не вдалося встановити фото.");
    } finally {
      setUploading(false);
    }
  };

  const handleCopy = async (text: string) => {
    const result = await copyText(text);
    if (result === "copied") void Haptics.selectionAsync();
  };

  const phone = clerkUser?.primaryPhoneNumber?.phoneNumber;

  return (
    <>
      <StretchyProfile
        name={profile.name}
        imageUrl={profile.image}
        status="у мережі"
        statusAccent
        busy={uploading}
        rightIcon="create-outline"
        rightLabel="Редагувати профіль"
        onRightPress={() => openEdit()}
        bottomOverlay={<MainTabBar active="profile" />}
        bottomInset={tabSpace}
      >
        <ActionButtons
          items={[
            { key: "photo", icon: "camera-outline", label: "Встановити фото", onPress: handleSetPhoto },
            { key: "edit", icon: "create-outline", label: "Редагувати", onPress: () => openEdit() },
            {
              key: "settings",
              icon: "settings-outline",
              label: "Налаштування",
              onPress: () => router.navigate("/(app)/(tabs)/preferences" as any),
            },
          ]}
        />

        <Section title="Інформація">
          {phone ? (
            <InfoRow
              first
              icon="call-outline"
              value={phone}
              label="Телефон"
              onLongPress={() => handleCopy(phone)}
            />
          ) : null}
          {profile.email ? (
            <InfoRow
              first={!phone}
              icon="mail-outline"
              value={profile.email}
              label="Пошта"
              onLongPress={() => handleCopy(profile.email!)}
            />
          ) : null}
          <InfoRow
            first={!phone && !profile.email}
            icon="at"
            value={profile.username ? `@${profile.username}` : undefined}
            placeholder="Додати ім'я користувача"
            label="Ім'я користувача"
            onPress={profile.username ? () => handleCopy(`@${profile.username}`) : () => openEdit("username")}
            onLongPress={profile.username ? () => openEdit("username") : undefined}
          />
          <InfoRow
            icon="information-circle-outline"
            value={profile.bio}
            placeholder="Розкажіть про себе"
            label="Про себе"
            onPress={() => openEdit("bio")}
          />
        </Section>

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
      </StretchyProfile>

      <EditProfileModal
        visible={editVisible}
        initialName={profile.name}
        initialUsername={profile.username}
        initialBio={profile.bio}
        initialImage={profile.image}
        focusField={focusField}
        onClose={() => setEditVisible(false)}
        onSaved={() => setEditVisible(false)}
      />
    </>
  );
}
