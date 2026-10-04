import { PREMIUM_GOLD } from "@/constants/premium";
import { usePremiumUi } from "@/context/PremiumContext";
import { api } from "@/convex/_generated/api";
import { usePremium } from "@/hooks/usePremium";
import { uploadToStorage } from "@/utils/attachments";
import { convexErrorData, convexErrorText } from "@/utils/convexError";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const STORY_CODES = new Set(["LIMIT_ACTIVE", "LIMIT_VIDEO", "LIFESPAN_PREMIUM", "VIEWERS_PREMIUM"]);

interface Picked {
  uri: string;
  kind: "photo" | "video";
  mimeType: string;
  durationMs?: number;
}

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      contentFit="contain"
      nativeControls={false}
      surfaceType="textureView"
      useExoShutter={false}
      allowsPictureInPicture={false}
    />
  );
}

/** Створення історії: вибір джерела → попередній перегляд, підпис, час життя → публікація. */
export function StoryComposer({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const premium = usePremium();
  const { openUpsell } = usePremiumUi();
  const limits = useQuery(api.stories.myLimits);
  const generateUploadUrl = useMutation(api.stories.generateUploadUrl);
  const createStory = useMutation(api.stories.create);

  const [picked, setPicked] = useState<Picked | null>(null);
  const [caption, setCaption] = useState("");
  const [lifespan, setLifespan] = useState(24);
  const [progress, setProgress] = useState<number | null>(null);
  const [kb, setKb] = useState(0);
  const publishing = progress !== null;

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) =>
      setKb(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (publishing) return true;
      if (picked) setPicked(null);
      else onClose();
      return true;
    });
    return () => sub.remove();
  }, [picked, publishing, onClose]);

  const maxVideoSec = limits?.maxVideoSec ?? (premium.isPremium ? 60 : 15);
  const activeFull = !!limits && limits.active >= limits.maxActive;

  const handleServerError = useCallback(
    (e: unknown) => {
      const data = convexErrorData(e);
      const message = convexErrorText(e);
      if (data?.code && STORY_CODES.has(data.code) && !premium.isPremium) {
        openUpsell("stories", message);
      } else {
        Alert.alert("Не вдалося опублікувати", message);
      }
    },
    [openUpsell, premium.isPremium],
  );

  const accept = (asset: ImagePicker.ImagePickerAsset) => {
    const isVideo = asset.type === "video";
    if (isVideo) {
      const sec = (asset.duration ?? 0) / 1000;
      if (sec > maxVideoSec + 0.5) {
        const msg = premium.isPremium
          ? `Відео в історії — не довше ${maxVideoSec} секунд.`
          : `Безкоштовно відео в історії — до ${maxVideoSec} секунд. З Modesto Premium — до 60 секунд.`;
        if (premium.isPremium) Alert.alert("Завелике відео", msg);
        else openUpsell("stories", msg);
        return;
      }
    }
    setPicked({
      uri: asset.uri,
      kind: isVideo ? "video" : "photo",
      mimeType: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
      durationMs: isVideo ? Math.round(asset.duration ?? 0) : undefined,
    });
  };

  const fromCamera = async (mode: "photo" | "video") => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Немає доступу до камери", "Дозвольте доступ до камери в налаштуваннях телефону.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: mode === "photo" ? ["images"] : ["videos"],
      videoMaxDuration: maxVideoSec,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) accept(result.assets[0]);
  };

  const fromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Немає доступу до галереї", "Дозвольте доступ до фото в налаштуваннях телефону.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      videoMaxDuration: maxVideoSec,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) accept(result.assets[0]);
  };

  const publish = async () => {
    if (!picked || publishing) return;
    Keyboard.dismiss();
    setProgress(0);
    try {
      const uploadUrl = await generateUploadUrl();
      const storageId = await uploadToStorage(uploadUrl, { uri: picked.uri, mimeType: picked.mimeType }, setProgress);
      await createStory({
        storageId,
        kind: picked.kind,
        caption: caption.trim() || undefined,
        durationMs: picked.durationMs,
        lifespanHours: lifespan,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (e) {
      handleServerError(e);
      setProgress(null);
    }
  };

  const lifespans = [6, 12, 24, 48];

  // ── Вибір джерела ──
  if (!picked) {
    const options: { icon: keyof typeof Ionicons.glyphMap; label: string; run: () => void }[] = [
      { icon: "camera-outline", label: "Зробити фото", run: () => void fromCamera("photo") },
      { icon: "videocam-outline", label: `Зняти відео (до ${maxVideoSec} с)`, run: () => void fromCamera("video") },
      { icon: "images-outline", label: "З галереї", run: () => void fromGallery() },
    ];
    return (
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 850, elevation: 850 }}>
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(130)}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Закрити" />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.duration(230)}
          exiting={SlideOutDown.duration(180)}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#12151C",
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: insets.bottom + 12,
          }}
        >
          <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" }} />
          <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "700", textAlign: "center", marginTop: 12 }}>
            Нова історія
          </Text>
          {limits ? (
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13.5, textAlign: "center", marginTop: 4 }}>
              Активних історій: {limits.active} з {limits.maxActive}
              {limits.premium ? "" : " · безкоштовний план"}
            </Text>
          ) : null}
          {activeFull ? (
            <View style={{ marginTop: 14 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 15, textAlign: "center", lineHeight: 21 }}>
                {limits?.premium
                  ? `Досягнуто ліміт: ${limits.maxActive} активних історій. Видаліть одну з наявних.`
                  : `Безкоштовно можна мати до ${limits?.maxActive} активних історій. Видаліть одну або оформіть Modesto Premium (до 30).`}
              </Text>
              {!limits?.premium ? (
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    openUpsell("stories", "Безкоштовно — до 3 активних історій. З Modesto Premium — до 30.");
                  }}
                  style={{ marginTop: 14, height: 48, borderRadius: 24, backgroundColor: PREMIUM_GOLD, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ color: "#1A1300", fontSize: 16, fontWeight: "800" }}>Про Modesto Premium</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={{ marginTop: 10 }}>
              {options.map((o) => (
                <TouchableOpacity
                  key={o.label}
                  activeOpacity={0.7}
                  onPress={o.run}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 6 }}
                >
                  <Ionicons name={o.icon} size={24} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 16.5, marginLeft: 16 }}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity onPress={onClose} style={{ height: 46, alignItems: "center", justifyContent: "center", marginTop: 6 }}>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 15.5, fontWeight: "600" }}>Скасувати</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // ── Редагування й публікація ──
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(130)}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 850, elevation: 850, backgroundColor: "#000" }}
    >
      {picked.kind === "photo" ? (
        <Image
          source={{ uri: picked.uri }}
          contentFit="contain"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : (
        <VideoPreview uri={picked.uri} />
      )}

      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top + 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" }}
      >
        <TouchableOpacity
          disabled={publishing}
          onPress={() => setPicked(null)}
          accessibilityRole="button"
          accessibilityLabel="Назад"
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          disabled={publishing}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Закрити"
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: kb,
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: kb > 0 ? 10 : insets.bottom + 12,
          backgroundColor: "rgba(0,0,0,0.55)",
        }}
      >
        <TextInput
          value={caption}
          onChangeText={setCaption}
          editable={!publishing}
          placeholder="Додати підпис…"
          placeholderTextColor="rgba(255,255,255,0.55)"
          maxLength={200}
          multiline
          style={{
            maxHeight: 90,
            minHeight: 44,
            borderRadius: 18,
            paddingHorizontal: 16,
            paddingVertical: 10,
            color: "#FFFFFF",
            fontSize: 15.5,
            backgroundColor: "rgba(255,255,255,0.14)",
          }}
        />

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
          <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.7)" />
          <View style={{ flexDirection: "row", marginLeft: 8, flex: 1 }}>
            {lifespans.map((h) => {
              const locked = !premium.isPremium && h !== 24;
              const selected = lifespan === h;
              return (
                <TouchableOpacity
                  key={h}
                  disabled={publishing}
                  onPress={() => {
                    if (locked) {
                      openUpsell("stories", "Час життя історії 6, 12 чи 48 годин доступний лише з Modesto Premium. Безкоштовно — 24 години.");
                      return;
                    }
                    setLifespan(h);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    height: 32,
                    paddingHorizontal: 11,
                    marginRight: 7,
                    borderRadius: 16,
                    backgroundColor: selected ? "#FFFFFF" : "rgba(255,255,255,0.14)",
                  }}
                >
                  <Text style={{ color: selected ? "#000" : "#FFFFFF", fontSize: 13.5, fontWeight: "700" }}>{h} год</Text>
                  {locked ? <Ionicons name="lock-closed" size={11} color={PREMIUM_GOLD} style={{ marginLeft: 4 }} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={publishing}
          onPress={() => void publish()}
          style={{ marginTop: 14, height: 50, borderRadius: 25, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", flexDirection: "row" }}
        >
          {publishing ? (
            <>
              <ActivityIndicator color="#000" />
              <Text style={{ color: "#000", fontSize: 15.5, fontWeight: "700", marginLeft: 10 }}>
                Завантаження {Math.round((progress ?? 0) * 100)}%
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="paper-plane" size={18} color="#000" />
              <Text style={{ color: "#000", fontSize: 16.5, fontWeight: "800", marginLeft: 8 }}>Опублікувати</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
