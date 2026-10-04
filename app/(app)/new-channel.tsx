import { ContactsList, type Contact } from "@/components/ContactsList";
import { RoomAvatar } from "@/components/RoomAvatar";
import { SearchField } from "@/components/SearchField";
import { useTheme } from "@/context/ThemeContext";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { withAlpha } from "@/hooks/useChatPalette";
import { slugHint, suggestSlug } from "@/utils/channel";
import { pickSquareImage, uploadImageToStorage, type PickedImage } from "@/utils/upload";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Step = "details" | "access" | "members";

const STEP_SUBTITLE: Record<Step, string> = {
  details: "Назва, опис і фото",
  access: "Тип каналу",
  members: "Додайте підписників",
};

/** Новий канал у три кроки: назва/опис/фото → публічний чи приватний (посилання) → підписники. */
export default function NewChannelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: c } = useTheme();
  const createChannel = useMutation(api.channels.createChannel);
  const generateUploadUrl = useMutation(api.rooms.generateRoomAvatarUploadUrl);

  const [step, setStep] = useState<Step>("details");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const selectedIds = useMemo(() => new Set<string>(selected.map((u) => u._id)), [selected]);

  const normalizedSlug = slug.trim().toLowerCase();
  const localError = isPublic ? slugHint(normalizedSlug) : null;
  // Перевірка унікальності на сервері, лише коли формат коректний.
  const slugState = useQuery(
    api.channels.checkSlug,
    isPublic && step === "access" && !localError ? { slug: normalizedSlug } : "skip",
  );
  const slugError = localError ?? (slugState && !slugState.ok ? slugState.reason : null);
  const slugChecking = isPublic && !localError && slugState === undefined;
  const slugOk = !isPublic || (!localError && slugState?.ok === true);
  // Чому кнопка «Далі» зараз не працює — показуємо під полем і в сповіщенні.
  const slugMessage: { text: string; tone: "error" | "muted" | "ok" } = slugError
    ? { text: slugError, tone: "error" }
    : slugChecking
      ? { text: "Перевіряємо посилання…", tone: "muted" }
      : { text: "Посилання вільне", tone: "ok" };

  const goBackStep = () => {
    if (step === "members") setStep("access");
    else if (step === "access") setStep("details");
    else router.back();
  };

  // Системна кнопка «Назад» повертає на попередній крок.
  useEffect(() => {
    if (step === "details") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setStep(step === "members" ? "access" : "details");
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

  const handlePickPhoto = async () => {
    const picked = await pickSquareImage();
    if (picked) setPhoto(picked);
  };

  const handleTitleChange = (text: string) => {
    setTitle(text);
  };

  const handleCreate = async () => {
    setIsLoading(true);
    setCreateError(null);
    try {
      let avatarStorageId: Id<"_storage"> | undefined;
      if (photo) {
        const uploadUrl = await generateUploadUrl();
        avatarStorageId = await uploadImageToStorage(uploadUrl, photo);
      }
      const result = await createChannel({
        title: title.trim(),
        description: description.trim() || undefined,
        avatarStorageId,
        isPublic,
        slug: isPublic ? normalizedSlug : undefined,
        subscriberIds: selected.map((u) => u._id),
      });
      router.replace(`/chat/${result.roomId}` as any);
    } catch (error: any) {
      // Convex додає до повідомлення службовий префікс — прибираємо його для користувача.
      const raw = String(error?.message ?? "");
      const clean =
        raw
          .replace(/^\[CONVEX [^\]]*\]\s*/, "")
          .replace(/\[Request ID: [^\]]*\]\s*/, "")
          .replace(/^Uncaught Error:\s*/, "")
          .split("\n")[0]
          .replace(/^[A-Za-z ]+:\s*(?=[А-Яа-яІіЇїЄє])/, "")
          .trim() || "Не вдалося створити канал.";
      setCreateError(clean);
      Alert.alert("Не вдалося створити канал", clean);
    } finally {
      setIsLoading(false);
    }
  };

  const next = () => {
    Keyboard.dismiss();
    if (step === "details") {
      if (!title.trim()) {
        Alert.alert("Помилка", "Будь ласка, введіть назву каналу.");
        return;
      }
      if (!slugTouched) setSlug(suggestSlug(title));
      setStep("access");
    } else if (step === "access") {
      if (!slugOk) {
        Alert.alert(
          "Перевірте посилання",
          slugChecking ? "Зачекайте, поки ми перевіримо посилання." : slugMessage.text,
        );
        return;
      }
      setStep("members");
    } else {
      void handleCreate();
    }
  };

  // Кнопка не блокується повністю, щоб натискання завжди давало відповідь (сповіщення з причиною).
  const nextDisabled = isLoading;
  const nextDimmed = (step === "details" && !title.trim()) || (step === "access" && !slugOk);

  const fab = (
    <TouchableOpacity
      onPress={next}
      disabled={nextDisabled}
      activeOpacity={0.85}
      accessibilityLabel={step === "members" ? "Створити канал" : "Далі"}
      style={{
        position: "absolute",
        right: 18,
        bottom: insets.bottom + 18,
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: nextDisabled || nextDimmed ? withAlpha(c.accent, 0.5) : c.accent,
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
        <Ionicons
          name={step === "members" ? "checkmark" : "arrow-forward"}
          size={26}
          color={c.onAccent}
        />
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
          onPress={goBackStep}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Назад"
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <View style={{ marginLeft: 4 }}>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: "700" }}>Новий канал</Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>
            {step === "members" && selected.length > 0
              ? `Обрано: ${selected.length}`
              : STEP_SUBTITLE[step]}
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
                <RoomAvatar title={user.name} imageUrl={user.image} size={30} />
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
          header={
            <Text style={{ color: c.muted, fontSize: 13, paddingHorizontal: 16, paddingVertical: 10 }}>
              Підписників можна не додавати — вони зможуть приєднатись за посиланням.
              {createError ? `\n\n⚠️ ${createError}` : ""}
            </Text>
          }
        />

        {fab}
      </View>
    );
  }

  if (step === "access") {
    const option = (value: boolean, icon: "megaphone-outline" | "lock-closed-outline", label: string, hint: string) => {
      const active = isPublic === value;
      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setIsPublic(value)}
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}
        >
          <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={24} color={active ? c.accent : c.muted} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{label}</Text>
            <Text style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>{hint}</Text>
          </View>
          <Ionicons name={icon} size={20} color={c.muted} />
        </TouchableOpacity>
      );
    };
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.bg }}
        behavior="padding"
      >
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
          <View style={{ backgroundColor: c.header, marginTop: 10 }}>
            {option(true, "megaphone-outline", "Публічний канал", "Знаходиться в пошуку, приєднатись може будь-хто")}
            {option(false, "lock-closed-outline", "Приватний канал", "Приєднатись можна лише за запрошувальним посиланням")}
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
            {isPublic ? "Посилання" : "Запрошувальне посилання"}
          </Text>
          <View style={{ backgroundColor: c.header, paddingHorizontal: 16, paddingVertical: 8 }}>
            {isPublic ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: c.muted, fontSize: 16 }}>modernchat://c/</Text>
                <TextInput
                  value={slug}
                  onChangeText={(text) => {
                    setSlugTouched(true);
                    setSlug(text.replace(/[^A-Za-z0-9_]/g, "").slice(0, 32));
                  }}
                  placeholder="посилання"
                  placeholderTextColor={c.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={32}
                  style={{ flex: 1, color: c.text, fontSize: 16, paddingVertical: 10 }}
                />
                {slugChecking ? (
                  <ActivityIndicator size="small" color={c.muted} />
                ) : slugMessage.tone === "ok" ? (
                  <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                ) : (
                  <Ionicons name="alert-circle" size={20} color={c.danger} />
                )}
              </View>
            ) : (
              <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20, paddingVertical: 6 }}>
                Посилання-запрошення буде створено автоматично — ви знайдете його в інформації про канал.
              </Text>
            )}
          </View>
          {isPublic ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <Text
                style={{
                  color:
                    slugMessage.tone === "error"
                      ? c.danger
                      : slugMessage.tone === "ok"
                        ? "#34C759"
                        : c.muted,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {slugMessage.text}
              </Text>
              <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>
                Допустимі символи: a–z, 0–9 та _. Довжина від 4 до 32 символів.
              </Text>
            </View>
          ) : null}
        </ScrollView>
        {fab}
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior="padding"
    >
      <Stack.Screen options={{ headerShown: false }} />
      {header}

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
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
            accessibilityLabel="Обрати фото каналу"
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
            onChangeText={handleTitleChange}
            placeholder="Назва каналу"
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
        <Text style={{ color: c.muted, fontSize: 13, paddingHorizontal: 16, paddingTop: 8 }}>
          Ви можете додати опис, щоб люди знали, про що ваш канал.
        </Text>
      </ScrollView>

      {fab}
    </KeyboardAvoidingView>
  );
}
