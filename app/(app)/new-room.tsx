import { avatarColor, initialsOf } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { api } from "@/convex/_generated/api";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NewRoomScreen() {
  const router = useRouter();
  const { colors: c } = useTheme();
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
  const previewName = title.trim();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.divider }}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            height: 56,
            paddingHorizontal: 6,
            backgroundColor: c.header,
            borderBottomWidth: 1,
            borderBottomColor: c.divider,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            disabled={isLoading}
            activeOpacity={0.7}
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            accessibilityRole="button"
            accessibilityLabel="Закрити"
          >
            <Ionicons name="close" size={26} color={c.text} />
          </TouchableOpacity>

          <Text style={{ color: c.text, fontSize: 18, fontWeight: "700", marginLeft: 8 }}>
            Нова кімната
          </Text>
        </View>

        {/* Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: previewName ? avatarColor(previewName) : c.accent,
              }}
            >
              {previewName ? (
                <Text style={{ color: "#FFFFFF", fontSize: 34, fontWeight: "700" }}>
                  {initialsOf(previewName)}
                </Text>
              ) : (
                <Ionicons name="people" size={44} color={c.onAccent} />
              )}
            </View>
            <Text style={{ color: c.muted, fontSize: 13, marginTop: 10 }}>
              Аватар зʼявиться з ініціалів назви
            </Text>
          </View>

          {/* Title */}
          <View
            style={{
              backgroundColor: c.header,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 8,
            }}
          >
            <Text style={{ color: c.accent, fontSize: 13, fontWeight: "600" }}>
              Назва кімнати
            </Text>
            <TextInput
              style={{ color: c.text, fontSize: 17, paddingVertical: 8 }}
              placeholder="Наприклад: Обговорення React Native"
              placeholderTextColor={c.muted}
              selectionColor={c.accent}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              autoFocus
              editable={!isLoading}
              returnKeyType="next"
            />
            <Text style={{ color: c.muted, fontSize: 12, textAlign: "right" }}>
              {title.length}/100
            </Text>
          </View>

          {/* Description */}
          <View
            style={{
              backgroundColor: c.header,
              marginTop: 10,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 8,
            }}
          >
            <Text style={{ color: c.accent, fontSize: 13, fontWeight: "600" }}>
              Опис (необовʼязково)
            </Text>
            <TextInput
              style={{ color: c.text, fontSize: 16, paddingVertical: 8, minHeight: 100 }}
              placeholder="Короткий опис теми спілкування..."
              placeholderTextColor={c.muted}
              selectionColor={c.accent}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={300}
              editable={!isLoading}
              textAlignVertical="top"
            />
            <Text style={{ color: c.muted, fontSize: 12, textAlign: "right" }}>
              {description.length}/300
            </Text>
          </View>
        </ScrollView>

        {/* Bottom button */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: c.header,
            borderTopWidth: 1,
            borderTopColor: c.divider,
          }}
        >
          <TouchableOpacity
            onPress={handleCreate}
            disabled={!canCreate}
            activeOpacity={0.8}
            style={{
              height: 52,
              borderRadius: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: c.accent,
              opacity: canCreate ? 1 : 0.5,
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={c.onAccent} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={22} color={c.onAccent} />
                <Text style={{ color: c.onAccent, fontSize: 16, fontWeight: "700", marginLeft: 8 }}>
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
