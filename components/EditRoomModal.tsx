import { RoomAvatar } from "@/components/RoomAvatar";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { File } from "expo-file-system";
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

interface Props {
  visible: boolean;
  roomId: Id<"chatRooms">;
  initialTitle: string;
  initialDescription?: string;
  initialAvatarUrl?: string;
  onClose: () => void;
}

const TITLE_MAX = 64;
const DESCRIPTION_MAX = 500;

/** Редагування кімнати (для творця та адміністраторів): фото, назва, опис. */
export function EditRoomModal({
  visible,
  roomId,
  initialTitle,
  initialDescription,
  initialAvatarUrl,
  onClose,
}: Props) {
  const c = useChatPalette();
  const insets = useSafeAreaInsets();
  const updateRoom = useMutation(api.rooms.updateRoom);
  const generateUploadUrl = useMutation(api.rooms.generateRoomAvatarUploadUrl);

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [avatarUri, setAvatarUri] = useState<string | undefined>(initialAvatarUrl);
  const [pickedUri, setPickedUri] = useState<string | undefined>();
  const [pickedMime, setPickedMime] = useState("image/jpeg");
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(initialTitle);
    setDescription(initialDescription ?? "");
    setAvatarUri(initialAvatarUrl);
    setPickedUri(undefined);
    setPickedMime("image/jpeg");
    setAvatarRemoved(false);
  }, [visible, initialTitle, initialDescription, initialAvatarUrl]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Немає доступу", "Дозвольте доступ до галереї, щоб обрати фото кімнати.");
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
    setPickedUri(asset.uri);
    setPickedMime(asset.mimeType ?? "image/jpeg");
    setAvatarRemoved(false);
  };

  const removeAvatar = () => {
    setAvatarUri(undefined);
    setPickedUri(undefined);
    setAvatarRemoved(true);
  };

  const uploadAvatar = async (uri: string, mimeType: string) => {
    const uploadUrl = await generateUploadUrl();
    const file = new File(uri);
    if (!file.exists) throw new Error("Обране зображення не знайдено.");
    const base64 = await file.base64();
    if (!base64) throw new Error("Не вдалося прочитати зображення.");

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": mimeType },
      body: bytes,
    });
    if (!response.ok) {
      throw new Error(`Не вдалося завантажити фото (${response.status})`);
    }
    const json = await response.json();
    if (!json.storageId) throw new Error("Сервер не повернув ідентифікатор файлу.");
    return json.storageId as Id<"_storage">;
  };

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert("Помилка", "Назва кімнати не може бути порожньою.");
      return;
    }
    try {
      setSaving(true);
      const avatarStorageId = pickedUri
        ? await uploadAvatar(pickedUri, pickedMime)
        : undefined;
      await updateRoom({
        roomId,
        title: trimmed,
        description,
        ...(avatarStorageId ? { avatarStorageId } : {}),
        ...(avatarRemoved && !avatarStorageId ? { removeAvatar: true } : {}),
      });
      onClose();
    } catch (error: any) {
      console.error("Не вдалося зберегти кімнату:", error);
      Alert.alert("Помилка", error?.message ?? "Не вдалося зберегти зміни.");
    } finally {
      setSaving(false);
    }
  };

  const field = {
    backgroundColor: c.field,
    color: c.text,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  } as const;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" }}
          onPress={saving ? undefined : onClose}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: c.sheet,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "92%",
              paddingBottom: Math.max(insets.bottom, 12),
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 12,
                paddingTop: 14,
                paddingBottom: 8,
              }}
            >
              <TouchableOpacity
                onPress={onClose}
                disabled={saving}
                style={{ paddingHorizontal: 8, paddingVertical: 6 }}
              >
                <Text style={{ color: c.accent, fontSize: 16 }}>Скасувати</Text>
              </TouchableOpacity>
              <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>
                Редагування
              </Text>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={{ paddingHorizontal: 8, paddingVertical: 6, minWidth: 80, alignItems: "flex-end" }}
              >
                {saving ? (
                  <ActivityIndicator color={c.accent} />
                ) : (
                  <Text style={{ color: c.accent, fontSize: 16, fontWeight: "700" }}>
                    Зберегти
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ alignItems: "center", marginVertical: 14 }}>
                <TouchableOpacity
                  onPress={pickImage}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <RoomAvatar title={title || initialTitle} imageUrl={avatarUri} size={104} />
                  <View
                    style={{
                      position: "absolute",
                      right: 0,
                      bottom: 0,
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: c.accent,
                      borderWidth: 3,
                      borderColor: c.sheet,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="camera" size={16} color={c.onAccent} />
                  </View>
                </TouchableOpacity>
                <View style={{ flexDirection: "row", marginTop: 10 }}>
                  <TouchableOpacity onPress={pickImage} disabled={saving} style={{ padding: 6 }}>
                    <Text style={{ color: c.accent, fontWeight: "600" }}>
                      {avatarUri ? "Змінити фото" : "Додати фото"}
                    </Text>
                  </TouchableOpacity>
                  {avatarUri ? (
                    <TouchableOpacity onPress={removeAvatar} disabled={saving} style={{ padding: 6, marginLeft: 14 }}>
                      <Text style={{ color: c.danger, fontWeight: "600" }}>Прибрати</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <Text style={{ color: c.muted, fontSize: 13, marginBottom: 6, marginLeft: 4 }}>
                Назва
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Назва кімнати"
                placeholderTextColor={withAlpha(c.muted, 0.8)}
                editable={!saving}
                maxLength={TITLE_MAX}
                selectionColor={c.accent}
                style={field}
              />

              <Text style={{ color: c.muted, fontSize: 13, marginTop: 16, marginBottom: 6, marginLeft: 4 }}>
                Опис
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Про що ця кімната"
                placeholderTextColor={withAlpha(c.muted, 0.8)}
                editable={!saving}
                multiline
                maxLength={DESCRIPTION_MAX}
                textAlignVertical="top"
                selectionColor={c.accent}
                style={[field, { minHeight: 100 }]}
              />
              <Text style={{ color: c.muted, fontSize: 12, marginTop: 6, textAlign: "right" }}>
                {description.length}/{DESCRIPTION_MAX}
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
