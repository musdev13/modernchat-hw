import { api } from "@/convex/_generated/api";
import { usePremiumUi } from "@/context/PremiumContext";
import { usePremium } from "@/hooks/usePremium";
import { uploadToStorage } from "@/utils/attachments";
import { convexErrorText } from "@/utils/convexError";
import { useMutation } from "convex/react";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

const MAX_SECONDS = 10;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_GIF_BYTES = 15 * 1024 * 1024;

/**
 * Вибір анімованого аватара (відео ≤10 с або GIF/анімований WebP) з галереї.
 * Без преміуму відкриває шторку Premium. Сервер перевіряє права, тип і розмір самостійно.
 */
export function useAnimatedAvatar() {
  const premium = usePremium();
  const { openUpsell } = usePremiumUi();
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const addAnimated = useMutation(api.profilePhotos.addAnimated);
  const [busy, setBusy] = useState(false);

  const pick = useCallback(async (): Promise<boolean> => {
    if (busy) return false;
    if (!premium.isPremium) {
      openUpsell("avatar");
      return false;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Немає доступу", "Дозвольте доступ до галереї, щоб обрати відео або GIF.");
      return false;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos", "images"],
      allowsMultipleSelection: false,
      videoMaxDuration: MAX_SECONDS,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return false;
    const asset = result.assets[0];
    const isVideo = asset.type === "video";
    const mime = (asset.mimeType ?? (isVideo ? "video/mp4" : "")).toLowerCase();

    if (isVideo) {
      const seconds = (asset.duration ?? 0) / 1000;
      if (seconds > MAX_SECONDS + 0.5) {
        Alert.alert("Завелике відео", `Відео для аватара має бути не довшим за ${MAX_SECONDS} секунд.`);
        return false;
      }
      if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
        Alert.alert("Завелике відео", "Максимальний розмір відео — 25 МБ.");
        return false;
      }
    } else {
      if (mime !== "image/gif" && mime !== "image/webp") {
        Alert.alert("Не підходить", "Оберіть відео, GIF або анімований WebP.");
        return false;
      }
      if (asset.fileSize && asset.fileSize > MAX_GIF_BYTES) {
        Alert.alert("Завеликий файл", "Максимальний розмір GIF — 15 МБ.");
        return false;
      }
    }

    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const animStorageId = await uploadToStorage(uploadUrl, { uri: asset.uri, mimeType: mime }, () => {});
      await addAnimated({
        animStorageId,
        kind: isVideo ? "video" : "gif",
        durationMs: isVideo ? Math.round(asset.duration ?? 0) || undefined : undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (e) {
      Alert.alert("Не вдалося встановити анімований аватар", convexErrorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, premium.isPremium, openUpsell, generateUploadUrl, addAnimated]);

  return { pick, busy };
}
