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
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { COLORS } from "@/constants/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function NewRoomScreen() {
  const router = useRouter();
  const createRoom = useMutation(api.rooms.createRoom);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      Alert.alert("Помилка", "Будь ласка, введіть назву кімнати.");
      return;
    }

    setIsLoading(true);

    try {
      const roomId = await createRoom({
        title: trimmedTitle,
        description: trimmedDescription || undefined,
      });

      router.replace(`/chat/${roomId}`);
    } catch (error) {
      console.error("Error creating room:", error);
      Alert.alert("Помилка", "Не вдалося створити кімнату.");
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
                  (необов'язково)
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
