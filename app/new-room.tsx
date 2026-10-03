import { KawaiiAvatar } from "@/components/ui/KawaiiAvatar";
import { KawaiiButton } from "@/components/ui/KawaiiButton";
import { KawaiiGradient } from "@/components/ui/KawaiiGradient";
import { COLORS, FONTS } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { File } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function NewRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const createRoom = useMutation(api.rooms.createRoom);
  const generateUploadUrl = useMutation(
    api.rooms.generateRoomAvatarUploadUrl,
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | undefined>();
  const [avatarMimeType, setAvatarMimeType] = useState<string>("image/jpeg");
  const [isLoading, setIsLoading] = useState(false);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Немає доступу",
        "Дозволь доступ до галереї, щоб вибрати аватар.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setAvatarUri(asset.uri);
    setAvatarMimeType(asset.mimeType ?? "image/jpeg");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const uploadAvatar = async (uri: string, mimeType: string) => {
    const uploadUrl = await generateUploadUrl();
    const file = new File(uri);

    if (!file.exists) throw new Error("Файл не знайдено");

    const base64 = await file.base64();
    if (!base64) throw new Error("Не вдалося прочитати файл");

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": mimeType },
      body: bytes,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const data = await uploadResponse.json();
    if (!data.storageId) throw new Error("Convex не повернув storageId");

    return data.storageId as Id<"_storage">;
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
        avatarStorageId = await uploadAvatar(avatarUri, avatarMimeType);
      }

      const roomId = await createRoom({
        title: trimmedTitle,
        description: trimmedDescription || undefined,
        avatarStorageId,
      });

      router.replace(`/chat/${roomId}` as any);
    } catch (error) {
      console.error("Error creating room:", error);
      Alert.alert("Помилка", "Не вдалося створити кімнату.");
      setIsLoading(false);
    }
  };

  const canCreate = title.trim().length > 0 && !isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: insets.top + 12,
            paddingBottom: 14,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            disabled={isLoading}
            activeOpacity={0.85}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(183,148,246,0.15)",
            }}
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                color: COLORS.text,
                fontFamily: FONTS.headingBold,
                fontSize: 18,
              }}
            >
              Нова кімната
            </Text>
            <Text style={{ fontSize: 10, marginTop: 1 }}>✨ 💕 ✨</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={pickAvatar}
            disabled={isLoading}
            activeOpacity={0.85}
            style={{ alignItems: "center", marginBottom: 22 }}
          >
            <View style={{ position: "relative" }}>
              <KawaiiGradient
                variant="primary"
                glow
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {avatarUri ? (
                  <KawaiiAvatar
                    uri={avatarUri}
                    name={title || "R"}
                    size={100}
                    ring="none"
                  />
                ) : (
                  <Ionicons name="camera" size={34} color="#FFFFFF" />
                )}
              </KawaiiGradient>
              <View
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: COLORS.background,
                  backgroundColor: "#FF8FB4",
                }}
              >
                <Ionicons name="camera" size={15} color="#FFFFFF" />
              </View>
            </View>
            <Text
              style={{
                color: COLORS.primary,
                fontFamily: FONTS.bodyBold,
                fontSize: 12,
                marginTop: 10,
              }}
            >
              {avatarUri ? "Змінити аватар" : "Додати аватар"}
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              color: COLORS.textMuted,
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Назва кімнати
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "rgba(183,148,246,0.08)",
              borderWidth: 1,
              borderColor: "rgba(183,148,246,0.22)",
              borderRadius: 16,
              paddingHorizontal: 14,
              marginBottom: 6,
            }}
          >
            <Text style={{ fontSize: 16, marginRight: 8 }}>🎀</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Наприклад: Аніме-клуб 🌸"
              placeholderTextColor={COLORS.textMuted}
              maxLength={100}
              editable={!isLoading}
              returnKeyType="next"
              style={{
                flex: 1,
                paddingVertical: 14,
                color: COLORS.text,
                fontFamily: FONTS.body,
                fontSize: 14,
              }}
            />
          </View>
          <Text
            style={{
              color: COLORS.textMuted,
              fontFamily: FONTS.body,
              fontSize: 10,
              marginBottom: 20,
              textAlign: "right",
            }}
          >
            {title.length}/100
          </Text>

          <Text
            style={{
              color: COLORS.textMuted,
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Опис (необов'язково)
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              backgroundColor: "rgba(126,232,250,0.06)",
              borderWidth: 1,
              borderColor: "rgba(126,232,250,0.22)",
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 10,
              marginBottom: 6,
              minHeight: 130,
            }}
          >
            <Text style={{ fontSize: 16, marginRight: 8, marginTop: 2 }}>
              💭
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Розкажи, про що ця кімната..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={300}
              editable={!isLoading}
              textAlignVertical="top"
              style={{
                flex: 1,
                minHeight: 100,
                color: COLORS.text,
                fontFamily: FONTS.body,
                fontSize: 14,
              }}
            />
          </View>
          <Text
            style={{
              color: COLORS.textMuted,
              fontFamily: FONTS.body,
              fontSize: 10,
              marginBottom: 20,
              textAlign: "right",
            }}
          >
            {description.length}/300
          </Text>
        </ScrollView>

        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 1,
            borderTopColor: "rgba(255,143,180,0.15)",
          }}
        >
          <KawaiiButton
            title="Створити кімнату"
            icon="add-circle"
            onPress={handleCreate}
            loading={isLoading}
            disabled={!canCreate}
            size="lg"
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}