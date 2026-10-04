import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { COLORS } from "@/constants/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function NewRoomScreen() {
  const router = useRouter();
  const createRoom = useMutation(api.rooms.createRoom);
  const generateAvatarUploadUrl = useMutation(api.users.generateAvatarUploadUrl);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUri, setAvatarUri] = useState<string>();
  const [avatarMimeType, setAvatarMimeType] = useState("image/jpeg");
  const [isLoading, setIsLoading] = useState(false);

  const pickAvatar = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Потрібен дозвіл", "Надайте доступ до галереї.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      const asset = result.assets?.[0];
      if (!result.canceled && asset) {
        setAvatarUri(asset.uri);
        setAvatarMimeType(asset.mimeType ?? "image/jpeg");
      }
    } catch (error) {
      console.error("Не вдалося вибрати аватар кімнати:", error);
      Alert.alert("Помилка", "Не вдалося відкрити галерею.");
    }
  };

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      Alert.alert("Помилка", "Будь ласка, введіть назву кімнати.");
      return;
    }

    setIsLoading(true);

    try {
      let avatarStorageId: Id<"_storage"> | undefined;
      if (avatarUri) {
        const uploadUrl = await generateAvatarUploadUrl();
        const file = new File(avatarUri);
        if (!file.exists) throw new Error("Вибране фото не знайдено.");
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || avatarMimeType },
          body: file,
        });
        if (!response.ok) {
          throw new Error(`Не вдалося завантажити фото (${response.status}).`);
        }
        const result = await response.json();
        if (!result.storageId) {
          throw new Error("Сервер не повернув ідентифікатор фото.");
        }
        avatarStorageId = result.storageId as Id<"_storage">;
      }
      const roomId = await createRoom({
        title: trimmedTitle,
        description: trimmedDescription || undefined,
        ...(avatarStorageId ? { avatarStorageId } : {}),
      });

      router.replace(`/chat/${roomId}`);
    } catch (error) {
      console.error("Error creating room:", error);
      Alert.alert(
        "Помилка",
        error instanceof Error ? error.message : "Не вдалося створити кімнату.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const canCreate = title.trim().length > 0 && !isLoading;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-surfaceLight">
          <TouchableOpacity
            onPress={() => router.back()}
            disabled={isLoading}
            className="w-10 h-10 items-center justify-center rounded-full bg-secondary"
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={COLORS.white} />
          </TouchableOpacity>

          <Text className="text-white text-lg font-bold">Нова кімната</Text>

          <View className="w-10" />
        </View>

        {/* Content */}
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-6 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-6">
            <TouchableOpacity
              onPress={pickAvatar}
              disabled={isLoading}
              className="items-center"
              accessibilityRole="button"
              accessibilityLabel="Обрати аватар кімнати"
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  className="h-24 w-24 rounded-[28px]"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-24 w-24 items-center justify-center rounded-[28px] border border-primary/30 bg-primary/15">
                  <Ionicons
                    name="camera-outline"
                    size={34}
                    color={COLORS.primary}
                  />
                </View>
              )}
              <Text className="mt-2 font-semibold text-primary">
                {avatarUri ? "Змінити аватар кімнати" : "Додати аватар кімнати"}
              </Text>
            </TouchableOpacity>

            {/* Title */}
            <View>
              <Text className="text-white text-base font-semibold mb-2">
                Назва кімнати
              </Text>

              <TextInput
                className="bg-secondary border border-surfaceLight rounded-2xl px-4 py-4 text-white text-base"
                placeholder="Наприклад: Обговорення React Native"
                placeholderTextColor={COLORS.textMuted}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
                autoFocus
                editable={!isLoading}
                returnKeyType="next"
              />

              <Text className="text-textMuted text-xs mt-2">
                {title.length}/100
              </Text>
            </View>

            {/* Description */}
            <View>
              <Text className="text-white text-base font-semibold mb-2">
                Опис
                <Text className="text-textMuted font-normal">
                  {" "}
                  (необов&apos;язково)
                </Text>
              </Text>

              <TextInput
                className="bg-secondary border border-surfaceLight rounded-2xl px-4 py-4 text-white text-base min-h-[130px]"
                placeholder="Короткий опис теми спілкування..."
                placeholderTextColor={COLORS.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={300}
                editable={!isLoading}
                textAlignVertical="top"
              />

              <Text className="text-textMuted text-xs mt-2">
                {description.length}/300
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Bottom button */}
        <View className="px-5 pt-3 pb-2 border-t border-surfaceLight bg-surface">
          <TouchableOpacity
            onPress={handleCreate}
            disabled={!canCreate}
            activeOpacity={0.8}
            className={`w-full h-14 rounded-2xl items-center justify-center flex-row ${
              canCreate ? "bg-primary" : "bg-surfaceLight opacity-60"
            }`}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons
                  name="add-circle-outline"
                  size={21}
                  color={COLORS.white}
                />
                <Text className="text-white text-base font-bold ml-2">
                  Створити кімнату
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
