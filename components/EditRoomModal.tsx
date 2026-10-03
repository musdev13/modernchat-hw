import { KawaiiAvatar } from "@/components/ui/KawaiiAvatar";
import { KawaiiGradient } from "@/components/ui/KawaiiGradient";
import { COLORS, FONTS } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { File } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface EditRoomModalProps {
  visible: boolean;
  roomId: Id<"chatRooms">;
  initialTitle: string;
  initialDescription?: string;
  initialAvatarUrl?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditRoomModal({
  visible,
  roomId,
  initialTitle,
  initialDescription,
  initialAvatarUrl,
  onClose,
  onSaved,
}: EditRoomModalProps) {
  const insets = useSafeAreaInsets();
  const updateRoom = useMutation(api.rooms.updateRoom);
  const generateUploadUrl = useMutation(
    api.rooms.generateRoomAvatarUploadUrl,
  );

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [avatarUri, setAvatarUri] = useState<string | undefined>();
  const [avatarMimeType, setAvatarMimeType] = useState<string>("image/jpeg");
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(
    initialAvatarUrl,
  );
  const [clearAvatar, setClearAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(initialTitle);
    setDescription(initialDescription ?? "");
    setAvatarUri(undefined);
    setPreviewUrl(initialAvatarUrl);
    setClearAvatar(false);
  }, [visible, initialTitle, initialDescription, initialAvatarUrl]);

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
    setPreviewUrl(asset.uri);
    setClearAvatar(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClearAvatar = () => {
    setAvatarUri(undefined);
    setPreviewUrl(undefined);
    setClearAvatar(true);
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

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert("Помилка", "Назва не може бути порожньою.");
      return;
    }

    try {
      setSaving(true);

      let avatarStorageId: Id<"_storage"> | undefined;
      if (avatarUri) {
        avatarStorageId = await uploadAvatar(avatarUri, avatarMimeType);
      }

      await updateRoom({
        roomId,
        title: trimmedTitle,
        description: description.trim(),
        ...(avatarStorageId ? { avatarStorageId } : {}),
        ...(clearAvatar ? { clearAvatar: true } : {}),
      });

      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      onSaved();
      onClose();
    } catch (error) {
      console.error("Room save error:", error);
      Alert.alert(
        "Помилка",
        error instanceof Error ? error.message : "Не вдалося зберегти.",
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.75)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />

          <View
            style={{
              backgroundColor: COLORS.background,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderTopWidth: 1,
              borderTopColor: "rgba(255,143,180,0.25)",
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: insets.bottom + 16,
              maxHeight: "92%",
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 14 }}>
              <View
                style={{
                  width: 44,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "rgba(183,148,246,0.3)",
                }}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 20 }}>✨</Text>
                <Text
                  style={{
                    color: COLORS.text,
                    fontFamily: FONTS.headingBold,
                    fontSize: 18,
                  }}
                >
                  Редагувати кімнату
                </Text>
              </View>

              <TouchableOpacity
                onPress={onClose}
                disabled={saving}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: "rgba(183,148,246,0.15)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
            >
              <View style={{ alignItems: "center", marginBottom: 22 }}>
                <TouchableOpacity
                  onPress={pickAvatar}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  <View style={{ position: "relative", paddingTop: 4 }}>
                    <KawaiiAvatar
                      uri={previewUrl}
                      name={title || "R"}
                      size={96}
                      ring="primary"
                    />
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
                </TouchableOpacity>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 10,
                  }}
                >
                  <TouchableOpacity onPress={pickAvatar} disabled={saving}>
                    <Text
                      style={{
                        color: COLORS.primary,
                        fontFamily: FONTS.bodyBold,
                        fontSize: 12,
                      }}
                    >
                      {previewUrl ? "Змінити аватар" : "Додати аватар"}
                    </Text>
                  </TouchableOpacity>

                  {previewUrl && (
                    <TouchableOpacity
                      onPress={handleClearAvatar}
                      disabled={saving}
                    >
                      <Text
                        style={{
                          color: COLORS.danger,
                          fontFamily: FONTS.bodyBold,
                          fontSize: 12,
                        }}
                      >
                        Прибрати
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

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
                Назва
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
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 16, marginRight: 8 }}>🎀</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Назва кімнати"
                  placeholderTextColor={COLORS.textMuted}
                  editable={!saving}
                  maxLength={100}
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
                  fontFamily: FONTS.bodyBold,
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Опис
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
                  marginBottom: 22,
                  minHeight: 110,
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
                  editable={!saving}
                  multiline
                  maxLength={300}
                  textAlignVertical="top"
                  style={{
                    flex: 1,
                    minHeight: 80,
                    color: COLORS.text,
                    fontFamily: FONTS.body,
                    fontSize: 14,
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                <KawaiiGradient
                  variant="primary"
                  glow
                  style={{
                    height: 50,
                    borderRadius: 25,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontFamily: FONTS.bodyBold,
                          fontSize: 15,
                        }}
                      >
                        Зберегти
                      </Text>
                    </>
                  )}
                </KawaiiGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}