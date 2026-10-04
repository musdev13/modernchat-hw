import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { COLORS } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface EditProfileModalProps {
  visible: boolean;
  initialName: string;
  initialUsername?: string;
  initialProfileEmoji?: string;
  initialBio?: string;
  initialImage?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditProfileModal({
  visible,
  initialName,
  initialUsername,
  initialProfileEmoji,
  initialBio,
  initialImage,
  onClose,
  onSaved,
}: EditProfileModalProps) {
  const updateProfile = useMutation(api.users.updateUserProfile);
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);

  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername ?? "");
  const [profileEmoji, setProfileEmoji] = useState(initialProfileEmoji ?? "");
  const [bio, setBio] = useState(initialBio ?? "");

  const [image, setImage] = useState<string | undefined>(initialImage);
  const [imageError, setImageError] = useState(false);

  const [selectedImageUri, setSelectedImageUri] = useState<
    string | undefined
  >();

  const [selectedImageMimeType, setSelectedImageMimeType] =
    useState<string>("image/jpeg");

  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Нет доступа",
        "Разреши доступ к галерее, чтобы выбрать аватар.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];

    setImage(asset.uri);
    setImageError(false);
    setSelectedImageUri(asset.uri);
    setSelectedImageMimeType(asset.mimeType ?? "image/jpeg");
  };

  const uploadAvatar = async (
    uri: string,
    mimeType: string,
  ): Promise<Id<"_storage">> => {
    const uploadUrl = await generateUploadUrl();

    const file = new File(uri);

    if (!file.exists) {
      throw new Error("Выбранное изображение не найдено.");
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": file.type || mimeType,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();

      console.error(
        "Convex avatar upload error:",
        uploadResponse.status,
        errorText,
      );

      throw new Error(`Не удалось загрузить аватар (${uploadResponse.status})`);
    }

    const result = await uploadResponse.json();

    if (!result.storageId) {
      throw new Error("Convex не вернул storageId.");
    }

    return result.storageId as Id<"_storage">;
  };

  const handleSave = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert("Ошибка", "Имя пользователя не может быть пустым.");
      return;
    }

    try {
      setSaving(true);

      let avatarStorageId: Id<"_storage"> | undefined;

      if (selectedImageUri) {
        avatarStorageId = await uploadAvatar(
          selectedImageUri,
          selectedImageMimeType,
        );
      }

      await updateProfile({
        name: trimmedName,
        username: username.trim() || undefined,
        profileEmoji,
        bio: bio.trim() || undefined,
        ...(avatarStorageId ? { avatarStorageId } : {}),
      });

      onSaved();
      onClose();
    } catch (error) {
      console.error("Profile save error:", error);

      Alert.alert(
        "Ошибка",
        error instanceof Error
          ? error.message
          : "Не удалось сохранить профиль.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/70 justify-end">
        <View
          className="rounded-t-3xl px-5 pt-5 pb-8"
          style={{
            backgroundColor: COLORS.background,
            borderTopWidth: 1,
            borderTopColor: COLORS.surface,
          }}
        >
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-white text-xl font-bold">
              Редактировать профиль
            </Text>

            <TouchableOpacity
              onPress={onClose}
              disabled={saving}
              className="w-9 h-9 rounded-full bg-surface items-center justify-center"
            >
              <Ionicons name="close" size={22} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={pickImage}
            disabled={saving}
            className="items-center mb-6"
          >
            {image && !imageError ? (
              <Image
                source={{ uri: image }}
                className="w-24 h-24 rounded-full"
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <View className="w-24 h-24 rounded-full bg-secondary items-center justify-center">
                <Ionicons name="person" size={42} color={COLORS.textMuted} />
              </View>
            )}

            <Text className="text-primary font-semibold mt-2">
              Изменить аватар
            </Text>
          </TouchableOpacity>

          <Text className="text-textMuted text-sm mb-2">Емодзі біля імені</Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {["", "✨", "💜", "🔥", "🌙", "🦋", "🌸", "⚡", "💎"].map((emoji) => (
              <TouchableOpacity
                key={emoji || "none"}
                onPress={() => setProfileEmoji(emoji)}
                disabled={saving}
                className={`h-10 min-w-10 items-center justify-center rounded-xl border px-2 ${
                  profileEmoji === emoji
                    ? "border-primary bg-primary/20"
                    : "border-surfaceLight bg-surface"
                }`}
                accessibilityRole="button"
                accessibilityState={{ selected: profileEmoji === emoji }}
                accessibilityLabel={emoji || "Без емодзі"}
              >
                <Text className="text-lg">{emoji || "∅"}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-textMuted text-sm mb-2">Имя</Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Твоё имя"
            placeholderTextColor={COLORS.textMuted}
            editable={!saving}
            className="bg-surface border border-surfaceLight text-white rounded-xl px-4 py-3 mb-4"
          />

          <Text className="text-textMuted text-sm mb-2">Username</Text>

          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="@username"
            placeholderTextColor={COLORS.textMuted}
            editable={!saving}
            autoCapitalize="none"
            className="bg-surface border border-surfaceLight text-white rounded-xl px-4 py-3 mb-4"
          />

          <Text className="text-textMuted text-sm mb-2">Описание</Text>

          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Расскажи что-нибудь о себе"
            placeholderTextColor={COLORS.textMuted}
            editable={!saving}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="bg-surface border border-surfaceLight text-white rounded-xl px-4 py-3 mb-6 min-h-[100px]"
          />

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            className="bg-primary rounded-xl py-3.5 items-center"
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text className="text-white font-bold text-base">Сохранить</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
