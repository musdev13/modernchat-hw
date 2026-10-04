import { ContactsList, type Contact } from "@/components/ContactsList";
import { RoomAvatar } from "@/components/RoomAvatar";
import { SearchField } from "@/components/SearchField";
import { useTheme } from "@/context/ThemeContext";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { withAlpha } from "@/hooks/useChatPalette";
import { pickSquareImage, uploadImageToStorage, type PickedImage } from "@/utils/upload";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Нова група у два кроки: вибір учасників (чіпи) → назва, опис, фото. */
export default function NewRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: c } = useTheme();
  const createRoom = useMutation(api.rooms.createRoom);
  const generateUploadUrl = useMutation(api.rooms.generateRoomAvatarUploadUrl);

  const [step, setStep] = useState<"members" | "details">("members");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectedIds = useMemo(() => new Set<string>(selected.map((u) => u._id)), [selected]);

  // Системна кнопка «Назад» на другому кроці повертає до вибору учасників.
  useEffect(() => {
    if (step !== "details") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setStep("members");
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const toggle = (contact: Contact) => {
    setSelected((prev) =>
      prev.some((u) => u._id === contact._id)
        ? prev.filter((u) => u._id !== contact._id)
        : [...prev, contact],
    );
  };

  const handleBack = () => {
    if (step === "details") setStep("members");
    else router.back();
  };

  const handlePickPhoto = async () => {
    const picked = await pickSquareImage();
    if (picked) setPhoto(picked);
  };

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert("Помилка", "Будь ласка, введіть назву групи.");
      return;
    }
    setIsLoading(true);
    try {
      let avatarStorageId: Id<"_storage"> | undefined;
      if (photo) {
        const uploadUrl = await generateUploadUrl();
        avatarStorageId = await uploadImageToStorage(uploadUrl, photo);
      }
      const roomId = await createRoom({
        title: trimmedTitle,
        description: description.trim() || undefined,
        participantIds: selected.map((u) => u._id),
        avatarStorageId,
      });
      router.replace(`/chat/${roomId}`);
    } catch (error: any) {
      console.error("Error creating room:", error);
      Alert.alert("Помилка", error?.message ?? "Не вдалося створити групу.");
    } finally {
      setIsLoading(false);
    }
  };

  const fab = (icon: "arrow-forward" | "checkmark", onPress: () => void, disabled?: boolean) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityLabel={icon === "checkmark" ? "Створити групу" : "Далі"}
      style={{
        position: "absolute",
        right: 18,
        bottom: insets.bottom + 18,
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: disabled ? withAlpha(c.accent, 0.5) : c.accent,
        alignItems: "center",
        justifyContent: "center",
        elevation: 6,
        shadowColor: "#000",
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      {isLoading ? (
        <ActivityIndicator color={c.onAccent} />
      ) : (
        <Ionicons name={icon} size={26} color={c.onAccent} />
      )}
    </TouchableOpacity>
  );

  const header = (
    <View
      style={{
        backgroundColor: c.header,
        paddingTop: insets.top + 8,
        paddingHorizontal: 8,
        paddingBottom: step === "members" ? 8 : 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", height: 48 }}>
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Назад"
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <View style={{ marginLeft: 4 }}>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: "700" }}>Нова група</Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>
            {step === "members"
              ? selected.length > 0
                ? `Обрано: ${selected.length}`
                : "Додайте учасників"
              : "Назва та фото"}
          </Text>
        </View>
      </View>
    </View>
  );

  if (step === "members") {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        {header}

        {selected.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ flexGrow: 0, backgroundColor: c.header }}
            contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, gap: 8 }}
          >
            {selected.map((user) => (
              <TouchableOpacity
                key={user._id}
                activeOpacity={0.7}
                onPress={() => toggle(user)}
                accessibilityLabel={`Прибрати ${user.name}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: c.search,
                  borderRadius: 18,
                  paddingRight: 10,
                  paddingLeft: 3,
                  height: 36,
                }}
              >
                <RoomAvatar title={user.name} imageUrl={user.image} size={30} animUrl={user.avatarAnimUrl} animKind={user.avatarAnimKind} />
                <Text
                  numberOfLines={1}
                  style={{ color: c.text, fontSize: 14, marginHorizontal: 8, maxWidth: 120 }}
                >
                  {user.name}
                </Text>
                <Ionicons name="close" size={16} color={c.muted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={{ backgroundColor: c.header, paddingHorizontal: 14, paddingBottom: 10 }}>
          <SearchField value={search} onChangeText={setSearch} placeholder="Пошук контактів" />
        </View>

        <ContactsList
          search={search}
          selectedIds={selectedIds}
          onSelect={toggle}
          bottomInset={insets.bottom + 100}
        />

        {fab("arrow-forward", () => setStep("details"))}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      {header}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 18,
            backgroundColor: c.header,
          }}
        >
          <TouchableOpacity
            onPress={handlePickPhoto}
            activeOpacity={0.8}
            accessibilityLabel="Обрати фото групи"
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withAlpha(c.accent, 0.18),
            }}
          >
            {photo ? (
              <Image source={{ uri: photo.uri }} style={{ width: 64, height: 64 }} />
            ) : (
              <Ionicons name="camera-outline" size={28} color={c.accent} />
            )}
          </TouchableOpacity>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Назва групи"
            placeholderTextColor={c.muted}
            maxLength={64}
            autoFocus
            returnKeyType="done"
            style={{
              flex: 1,
              marginLeft: 16,
              color: c.text,
              fontSize: 18,
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: c.accent,
            }}
          />
        </View>

        <View style={{ backgroundColor: c.header, marginTop: 10, paddingHorizontal: 16, paddingVertical: 6 }}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Опис (необов'язково)"
            placeholderTextColor={c.muted}
            maxLength={500}
            multiline
            style={{ color: c.text, fontSize: 16, minHeight: 44, paddingVertical: 10 }}
          />
        </View>

        <Text
          style={{
            color: c.accent,
            fontSize: 14,
            fontWeight: "700",
            paddingHorizontal: 16,
            paddingTop: 18,
            paddingBottom: 6,
          }}
        >
          {selected.length > 0 ? `Учасники: ${selected.length + 1}` : "Учасники"}
        </Text>
        <View style={{ backgroundColor: c.header }}>
          {selected.length === 0 ? (
            <Text style={{ color: c.muted, fontSize: 14, padding: 16 }}>
              Учасників поки немає — ви зможете додати їх пізніше в інформації про групу.
            </Text>
          ) : (
            selected.map((user) => (
              <View
                key={user._id}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 }}
              >
                <RoomAvatar title={user.name} imageUrl={user.image} size={42} animUrl={user.avatarAnimUrl} animKind={user.avatarAnimKind} />
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, color: c.text, fontSize: 16, marginLeft: 14 }}
                >
                  {user.name}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {fab("checkmark", handleCreate, !title.trim() || isLoading)}
    </KeyboardAvoidingView>
  );
}
