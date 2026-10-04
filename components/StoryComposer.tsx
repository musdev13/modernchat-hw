import {
  OverlayLabel,
  OVERLAY_COLORS,
  OVERLAY_FONTS,
  overlayPosition,
  STICKER_EMOJIS,
  StoryOverlay,
  fontStyleOf,
  overlaySize,
} from "@/components/StoryOverlay";
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
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const STORY_CODES = new Set([
  "LIMIT_ACTIVE",
  "LIMIT_VIDEO",
  "LIFESPAN_PREMIUM",
  "VIEWERS_PREMIUM",
  "PROTECT_PREMIUM",
]);

type Audience = "all" | "contacts" | "close" | "selected" | "except";
const AUDIENCES: { key: Audience; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "all", label: "Усі", icon: "earth-outline" },
  { key: "contacts", label: "Контакти", icon: "people-outline" },
  { key: "close", label: "Близькі друзі", icon: "star-outline" },
  { key: "selected", label: "Вибрані користувачі", icon: "person-add-outline" },
  { key: "except", label: "Усі, крім…", icon: "person-remove-outline" },
];

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

const clamp01 = (n: number) => Math.min(0.97, Math.max(0.03, n));

/** Накладка, яку можна перетягувати; тап — вибір. Позиція зберігається у частках кадру. */
function DraggableOverlay({
  o,
  w,
  h,
  selected,
  onSelect,
  onMove,
}: {
  o: StoryOverlay;
  w: number;
  h: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  useEffect(() => {
    tx.value = 0;
    ty.value = 0;
  }, [o.x, o.y, tx, ty]);
  const commit = (dx: number, dy: number) => onMove(clamp01(o.x + dx / w), clamp01(o.y + dy / h));
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(commit)(e.translationX, e.translationY);
    });
  const tap = Gesture.Tap().onEnd((_e, ok) => {
    if (ok) runOnJS(onSelect)();
  });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }] }));
  return (
    <View pointerEvents="box-none" style={overlayPosition(o, w, h)}>
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <Animated.View
          style={[
            {
              padding: 6,
              borderRadius: 12,
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: selected ? "rgba(255,255,255,0.85)" : "transparent",
            },
            style,
          ]}
        >
          <OverlayLabel o={o} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** Створення історії: джерело → редактор (текст, стікери) → підпис, приватність, відповіді, захист, час життя. */
export function StoryComposer({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const premium = usePremium();
  const { openUpsell } = usePremiumUi();
  const limits = useQuery(api.stories.myLimits);
  const privacySettings = useQuery(api.stories.privacySettings);
  const generateUploadUrl = useMutation(api.stories.generateUploadUrl);
  const createStory = useMutation(api.stories.create);

  const [picked, setPicked] = useState<Picked | null>(null);
  const [caption, setCaption] = useState("");
  const [lifespan, setLifespan] = useState(24);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [allowReplies, setAllowReplies] = useState(true);
  const [protect, setProtect] = useState(false);
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [editingText, setEditingText] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [progress, setProgress] = useState<number | null>(null);
  const [kb, setKb] = useState(0);
  const publishing = progress !== null;
  const effAudience: Audience = audience ?? (limits?.defaultAudience as Audience | undefined) ?? "all";

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
      if (privacyOpen) setPrivacyOpen(false);
      else if (stickersOpen) setStickersOpen(false);
      else if (editingText) setEditingText(false);
      else if (picked) setPicked(null);
      else onClose();
      return true;
    });
    return () => sub.remove();
  }, [picked, publishing, privacyOpen, stickersOpen, editingText, onClose]);

  const maxVideoSec = limits?.maxVideoSec ?? (premium.isPremium ? 60 : 15);
  const captionMax = limits?.captionMax ?? (premium.isPremium ? 2048 : 200);
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
    setOverlays([]);
    setSelected(null);
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

  const privacyPayload = () => {
    if (effAudience === "selected") return { audience: effAudience, userIds: privacySettings?.selectedIds ?? [] };
    if (effAudience === "except") return { audience: effAudience, userIds: privacySettings?.exceptIds ?? [] };
    return { audience: effAudience, userIds: [] };
  };

  const publish = async () => {
    if (!picked || publishing) return;
    const priv = privacyPayload();
    if (priv.audience === "selected" && priv.userIds.length === 0) {
      Alert.alert("Порожній список", "Додайте користувачів у «Вибрані користувачі» (Налаштування → Конфіденційність → Історії).");
      return;
    }
    if (priv.audience === "close" && (privacySettings?.closeFriendIds.length ?? 0) === 0) {
      Alert.alert("Немає близьких друзів", "Додайте друзів у Налаштування → Конфіденційність → Історії → Близькі друзі.");
      return;
    }
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
        privacy: priv,
        allowReplies,
        protectContent: protect || undefined,
        overlays: overlays.filter((o) => o.text.trim().length > 0),
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (e) {
      handleServerError(e);
      setProgress(null);
    }
  };

  const lifespans = [6, 12, 24, 48];

  const addText = () => {
    setStickersOpen(false);
    if (overlays.length >= 12) return;
    setOverlays((list) => [...list, { type: "text", text: "", x: 0.5, y: 0.4, color: "#FFFFFF", size: 30, font: "sans", bg: false }]);
    setSelected(overlays.length);
    setEditingText(true);
  };
  const addEmoji = (emoji: string) => {
    if (overlays.length >= 12) return;
    setOverlays((list) => [...list, { type: "emoji", text: emoji, x: 0.5, y: 0.5, size: 64 }]);
    setSelected(overlays.length);
    setStickersOpen(false);
  };
  const patchOverlay = (i: number, patch: Partial<StoryOverlay>) =>
    setOverlays((list) => list.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const removeOverlay = (i: number) => {
    setOverlays((list) => list.filter((_o, idx) => idx !== i));
    setSelected(null);
    setEditingText(false);
  };
  const finishText = () => {
    setEditingText(false);
    if (selected !== null && overlays[selected] && overlays[selected].type === "text" && !overlays[selected].text.trim()) {
      removeOverlay(selected);
    }
  };

  const sel = selected !== null ? overlays[selected] : undefined;

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
  const audienceInfo = AUDIENCES.find((a) => a.key === effAudience) ?? AUDIENCES[0];
  const listCount =
    effAudience === "selected"
      ? (privacySettings?.selectedIds.length ?? 0)
      : effAudience === "except"
        ? (privacySettings?.exceptIds.length ?? 0)
        : effAudience === "close"
          ? (privacySettings?.closeFriendIds.length ?? 0)
          : 0;

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

      {/* Накладки: тап по порожньому місцю знімає вибір */}
      <Pressable
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={() => {
          setSelected(null);
          setStickersOpen(false);
          Keyboard.dismiss();
        }}
        onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      />
      {box.w > 0
        ? overlays.map((o, i) => (
            <DraggableOverlay
              key={i}
              o={o}
              w={box.w}
              h={box.h}
              selected={selected === i}
              onSelect={() => {
                setSelected(i);
                if (o.type === "text") setEditingText(true);
              }}
              onMove={(x, y) => patchOverlay(i, { x, y })}
            />
          ))
        : null}

      <View
        pointerEvents="box-none"
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
          onPress={addText}
          accessibilityRole="button"
          accessibilityLabel="Додати текст"
          style={{ width: 42, height: 42, borderRadius: 21, marginRight: 8, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>Aa</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={publishing}
          onPress={() => setStickersOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel="Стікери"
          style={{ width: 42, height: 42, borderRadius: 21, marginRight: 8, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="happy-outline" size={23} color="#FFFFFF" />
        </TouchableOpacity>
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

      {stickersOpen ? (
        <Animated.View
          entering={FadeIn.duration(120)}
          style={{ position: "absolute", left: 12, right: 12, top: insets.top + 60, borderRadius: 18, backgroundColor: "rgba(18,21,28,0.95)", padding: 8, flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}
        >
          {STICKER_EMOJIS.map((e) => (
            <TouchableOpacity key={e} onPress={() => addEmoji(e)} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 28 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      ) : null}

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: kb,
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: kb > 0 ? 10 : insets.bottom + 12,
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      >
        {sel && editingText && sel.type === "text" ? (
          <View>
            <TextInput
              value={sel.text}
              onChangeText={(t) => patchOverlay(selected as number, { text: t })}
              autoFocus
              placeholder="Введіть текст…"
              placeholderTextColor="rgba(255,255,255,0.5)"
              maxLength={160}
              multiline
              style={[
                { maxHeight: 90, minHeight: 44, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, color: sel.color ?? "#FFFFFF", fontSize: 18, backgroundColor: "rgba(255,255,255,0.14)" },
                fontStyleOf(sel.font),
              ]}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              {OVERLAY_COLORS.map((col) => (
                <TouchableOpacity
                  key={col}
                  onPress={() => patchOverlay(selected as number, { color: col })}
                  style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: col, marginRight: 9, borderWidth: sel.color === col ? 3 : 1, borderColor: sel.color === col ? "#FFFFFF" : "rgba(255,255,255,0.4)" }}
                />
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
              {OVERLAY_FONTS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => patchOverlay(selected as number, { font: f.key })}
                  style={{ minWidth: 42, height: 34, borderRadius: 17, marginRight: 8, alignItems: "center", justifyContent: "center", backgroundColor: sel.font === f.key ? "#FFFFFF" : "rgba(255,255,255,0.14)" }}
                >
                  <Text style={[{ color: sel.font === f.key ? "#000" : "#FFFFFF", fontSize: 16 }, fontStyleOf(f.key)]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => patchOverlay(selected as number, { bg: !sel.bg })}
                style={{ width: 42, height: 34, borderRadius: 17, marginRight: 8, alignItems: "center", justifyContent: "center", backgroundColor: sel.bg ? "#FFFFFF" : "rgba(255,255,255,0.14)" }}
              >
                <Ionicons name="square" size={16} color={sel.bg ? "#000" : "#FFFFFF"} />
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => patchOverlay(selected as number, { size: Math.max(14, overlaySize(sel) - 4) })} style={{ padding: 6 }}>
                <Ionicons name="remove-circle-outline" size={26} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => patchOverlay(selected as number, { size: Math.min(72, overlaySize(sel) + 4) })} style={{ padding: 6 }}>
                <Ionicons name="add-circle-outline" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => removeOverlay(selected as number)}
                style={{ flex: 1, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)", marginRight: 8 }}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Видалити</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={finishText}
                style={{ flex: 1, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}
              >
                <Text style={{ color: "#000", fontWeight: "800" }}>Готово</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {sel && sel.type === "emoji" ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <TouchableOpacity onPress={() => patchOverlay(selected as number, { size: Math.max(28, overlaySize(sel) - 8) })} style={{ padding: 6 }}>
                  <Ionicons name="remove-circle-outline" size={28} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => patchOverlay(selected as number, { size: Math.min(120, overlaySize(sel) + 8) })} style={{ padding: 6 }}>
                  <Ionicons name="add-circle-outline" size={28} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeOverlay(selected as number)} style={{ padding: 6, marginLeft: 12 }}>
                  <Ionicons name="trash-outline" size={26} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
            ) : null}
            <TextInput
              value={caption}
              onChangeText={setCaption}
              editable={!publishing}
              placeholder="Додати підпис… (@нік — згадка)"
              placeholderTextColor="rgba(255,255,255,0.55)"
              maxLength={captionMax}
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
            {caption.length > captionMax * 0.8 ? (
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "right", marginTop: 3 }}>
                {caption.length}/{captionMax}
                {!premium.isPremium ? " · Premium: до 2048" : ""}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
              <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.7)" />
              <View style={{ flexDirection: "row", marginLeft: 8, flex: 1 }}>
                {lifespans.map((h) => {
                  const locked = !premium.isPremium && h !== 24;
                  const isSel = lifespan === h;
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
                        backgroundColor: isSel ? "#FFFFFF" : "rgba(255,255,255,0.14)",
                      }}
                    >
                      <Text style={{ color: isSel ? "#000" : "#FFFFFF", fontSize: 13.5, fontWeight: "700" }}>{h} год</Text>
                      {locked ? <Ionicons name="lock-closed" size={11} color={PREMIUM_GOLD} style={{ marginLeft: 4 }} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              disabled={publishing}
              onPress={() => setPrivacyOpen(true)}
              activeOpacity={0.8}
              style={{ flexDirection: "row", alignItems: "center", marginTop: 10, height: 38, borderRadius: 19, paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,0.14)" }}
            >
              <Ionicons name={audienceInfo.icon} size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 14.5, fontWeight: "600", marginLeft: 8, flex: 1 }}>
                Бачать: {audienceInfo.label}
                {listCount > 0 ? ` (${listCount})` : ""}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>

            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
              <Ionicons name="chatbubble-outline" size={17} color="rgba(255,255,255,0.75)" />
              <Text style={{ color: "#FFFFFF", fontSize: 14.5, marginLeft: 8, flex: 1 }}>Дозволити відповіді</Text>
              <Switch value={allowReplies} onValueChange={setAllowReplies} disabled={publishing} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
              <Ionicons name="lock-closed-outline" size={17} color="rgba(255,255,255,0.75)" />
              <Text style={{ color: "#FFFFFF", fontSize: 14.5, marginLeft: 8, flex: 1 }}>Захист вмісту (без пересилання й збереження)</Text>
              {!premium.isPremium ? <Ionicons name="star" size={13} color={PREMIUM_GOLD} style={{ marginRight: 6 }} /> : null}
              <Switch
                value={protect}
                disabled={publishing}
                onValueChange={(v) => {
                  if (!premium.isPremium) {
                    openUpsell("stories", "Захист вмісту (заборона пересилання та збереження) доступний лише з Modesto Premium.");
                    return;
                  }
                  setProtect(v);
                }}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={publishing}
              onPress={() => void publish()}
              style={{ marginTop: 12, height: 50, borderRadius: 25, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", flexDirection: "row" }}
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
          </>
        )}
      </View>

      {privacyOpen ? (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <Animated.View
            entering={FadeIn.duration(140)}
            exiting={FadeOut.duration(120)}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }}
          >
            <Pressable style={{ flex: 1 }} onPress={() => setPrivacyOpen(false)} accessibilityLabel="Закрити" />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.duration(220)}
            exiting={SlideOutDown.duration(170)}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#12151C", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12 }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "700", textAlign: "center", marginBottom: 8 }}>Хто бачить історію</Text>
            {AUDIENCES.map((a) => {
              const count =
                a.key === "selected"
                  ? (privacySettings?.selectedIds.length ?? 0)
                  : a.key === "except"
                    ? (privacySettings?.exceptIds.length ?? 0)
                    : a.key === "close"
                      ? (privacySettings?.closeFriendIds.length ?? 0)
                      : 0;
              const manage = a.key === "close" || a.key === "selected" || a.key === "except";
              return (
                <View key={a.key} style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    onPress={() => {
                      setAudience(a.key);
                      setPrivacyOpen(false);
                    }}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingVertical: 13 }}
                  >
                    <Ionicons name={a.icon} size={22} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 16, marginLeft: 14, flex: 1 }}>
                      {a.label}
                      {manage ? `  (${count})` : ""}
                    </Text>
                    {effAudience === a.key ? <Ionicons name="checkmark-circle" size={22} color="#4CD964" /> : null}
                  </TouchableOpacity>
                  {manage ? (
                    <TouchableOpacity
                      onPress={() => {
                        onClose();
                        router.push(`/prefs/story-users?list=${a.key}` as never);
                      }}
                      hitSlop={8}
                      style={{ paddingHorizontal: 10, paddingVertical: 8 }}
                    >
                      <Text style={{ color: "#8CC8FF", fontSize: 14 }}>Змінити</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </Animated.View>
        </View>
      ) : null}
    </Animated.View>
  );
}
