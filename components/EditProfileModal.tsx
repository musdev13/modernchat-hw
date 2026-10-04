import { RoomAvatar } from "@/components/RoomAvatar";
import { api } from "@/convex/_generated/api";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { PickedImage, pickSquareImage, uploadImageToStorage } from "@/utils/upload";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
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

export type ProfileField = "name" | "username" | "bio";

interface EditProfileModalProps {
  visible: boolean;
  initialName: string;
  initialUsername?: string;
  initialBio?: string;
  initialImage?: string;
  /** Яке поле одразу активувати (для швидких переходів із налаштувань). */
  focusField?: ProfileField;
  onClose: () => void;
  onSaved: () => void;
}

const BIO_MAX = 140;
const USERNAME_RE = /^[A-Za-z0-9_]{3,32}$/;

/** Редагування профілю: фото, ім'я, ім'я користувача та «про себе». */
export function EditProfileModal({
  visible,
  initialName,
  initialUsername,
  initialBio,
  initialImage,
  focusField,
  onClose,
  onSaved,
}: EditProfileModalProps) {
  const c = useChatPalette();
  const insets = useSafeAreaInsets();
  const updateProfile = useMutation(api.users.updateUserProfile);
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);

  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [image, setImage] = useState<string | undefined>(initialImage);
  const [picked, setPicked] = useState<PickedImage | undefined>();
  const [saving, setSaving] = useState(false);

  const nameRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const bioRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setName(initialName);
    setUsername(initialUsername ?? "");
    setBio(initialBio ?? "");
    setImage(initialImage);
    setPicked(undefined);

    if (!focusField) return;
    const timer = setTimeout(() => {
      const ref = focusField === "name" ? nameRef : focusField === "username" ? usernameRef : bioRef;
      ref.current?.focus();
    }, 380);
    return () => clearTimeout(timer);
  }, [visible, initialName, initialUsername, initialBio, initialImage, focusField]);

  const pickImage = async () => {
    const result = await pickSquareImage();
    if (!result) return;
    setImage(result.uri);
    setPicked(result);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Помилка", "Ім'я не може бути порожнім.");
      return;
    }
    const cleanUsername = username.trim().replace(/^@/, "");
    if (cleanUsername && !USERNAME_RE.test(cleanUsername)) {
      Alert.alert(
        "Ім'я користувача",
        "Використовуйте від 3 до 32 символів: латинські літери, цифри та підкреслення.",
      );
      return;
    }

    try {
      setSaving(true);
      let avatarStorageId;
      if (picked) {
        const uploadUrl = await generateUploadUrl();
        avatarStorageId = await uploadImageToStorage(uploadUrl, picked);
      }
      await updateProfile({
        name: trimmedName,
        username: cleanUsername || undefined,
        bio: bio.trim() || undefined,
        ...(avatarStorageId ? { avatarStorageId } : {}),
      });
      onSaved();
      onClose();
    } catch (error) {
      console.error("Profile save error:", error);
      Alert.alert(
        "Помилка",
        error instanceof Error ? error.message : "Не вдалося зберегти профіль.",
      );
    } finally {
      setSaving(false);
    }
  };

  const label = (text: string, extra?: object) => (
    <Text style={[{ color: c.muted, fontSize: 13, marginBottom: 6, marginLeft: 4 }, extra]}>
      {text}
    </Text>
  );

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
              maxHeight: "94%",
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
                Редагування профілю
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
                <TouchableOpacity onPress={pickImage} disabled={saving} activeOpacity={0.8}>
                  <RoomAvatar title={name || initialName} imageUrl={image} size={104} />
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
                <TouchableOpacity onPress={pickImage} disabled={saving} style={{ padding: 8, marginTop: 4 }}>
                  <Text style={{ color: c.accent, fontWeight: "600" }}>Змінити фото</Text>
                </TouchableOpacity>
              </View>

              {label("Ім'я")}
              <TextInput
                ref={nameRef}
                value={name}
                onChangeText={setName}
                placeholder="Ваше ім'я"
                placeholderTextColor={withAlpha(c.muted, 0.8)}
                editable={!saving}
                maxLength={64}
                selectionColor={c.accent}
                style={field}
              />

              {label("Ім'я користувача", { marginTop: 16 })}
              <View style={[field, { flexDirection: "row", alignItems: "center", paddingVertical: 0 }]}>
                <Text style={{ color: c.muted, fontSize: 16 }}>@</Text>
                <TextInput
                  ref={usernameRef}
                  value={username}
                  onChangeText={(t) => setUsername(t.replace(/^@/, ""))}
                  placeholder="username"
                  placeholderTextColor={withAlpha(c.muted, 0.8)}
                  editable={!saving}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={32}
                  selectionColor={c.accent}
                  style={{ flex: 1, color: c.text, fontSize: 16, paddingVertical: 12, marginLeft: 2 }}
                />
              </View>

              {label("Про себе", { marginTop: 16 })}
              <TextInput
                ref={bioRef}
                value={bio}
                onChangeText={setBio}
                placeholder="Розкажіть кілька слів про себе"
                placeholderTextColor={withAlpha(c.muted, 0.8)}
                editable={!saving}
                multiline
                maxLength={BIO_MAX}
                textAlignVertical="top"
                selectionColor={c.accent}
                style={[field, { minHeight: 96 }]}
              />
              <Text style={{ color: c.muted, fontSize: 12, marginTop: 6, textAlign: "right" }}>
                {bio.length}/{BIO_MAX}
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
