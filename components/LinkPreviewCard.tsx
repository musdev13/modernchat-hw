import { noteLinkTouch, showLinkMenu, useOpenLink } from "@/components/MessageText";
import { useSettings } from "@/context/SettingsContext";
import { api } from "@/convex/_generated/api";
import { usePremium } from "@/hooks/usePremium";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { useAction, useQuery } from "convex/react";
import { Image } from "expo-image";
import { memo, useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const CARD_WIDTH = 240;
const OK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAILED_TTL_MS = 60 * 60 * 1000;

// Щоб не просити сервер повторно для того ж посилання в межах сесії.
const requested = new Set<string>();

function Skeleton({ isOwn }: { isOwn: boolean }) {
  const c = useChatPalette();
  const pulse = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const base = isOwn ? c.outgoingText : c.muted;
  const bar = (w: number | `${number}%`, h: number) => (
    <View style={{ width: w, height: h, borderRadius: h / 2, backgroundColor: withAlpha(base, 0.28), marginBottom: 6 }} />
  );
  return (
    <Animated.View style={[{ width: CARD_WIDTH, marginTop: 6, paddingLeft: 10 }, style]}>
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          borderRadius: 2,
          backgroundColor: withAlpha(base, 0.4),
        }}
      />
      {bar("40%", 10)}
      {bar("85%", 12)}
      {bar("65%", 10)}
    </Animated.View>
  );
}

/** Картка попереднього перегляду посилання під текстом повідомлення. */
export const LinkPreviewCard = memo(function LinkPreviewCard({ url, isOwn }: { url: string; isOwn: boolean }) {
  const c = useChatPalette();
  const open = useOpenLink();
  const { settings } = useSettings();
  const { isPremium } = usePremium();
  const large = isPremium && settings.appearance.largeLinkPreview;
  const cardWidth = large ? 280 : CARD_WIDTH;
  const row = useQuery(api.linkPreview.getCached, { url });
  const fetchPreview = useAction(api.linkPreview.fetchLinkPreview);
  const [failed, setFailed] = useState(false);

  // Немає запису або він прострочений — просимо сервер завантажити Open Graph.
  const stale =
    row === null ||
    (row !== undefined && Date.now() - row.fetchedAt > (row.status === "ok" ? OK_TTL_MS : FAILED_TTL_MS));
  useEffect(() => {
    if (!stale || requested.has(url)) return;
    requested.add(url);
    fetchPreview({ url }).catch(() => setFailed(true));
  }, [stale, url, fetchPreview]);

  if (failed || row?.status === "failed") return null;
  if (row === undefined || row === null) return <Skeleton isOwn={isOwn} />;
  if (!row.title && !row.description && !row.image) return null;

  const bar = isOwn ? c.outgoingText : c.accent;
  const titleColor = isOwn ? c.outgoingText : c.text;
  const subColor = isOwn ? c.outgoingMeta : c.muted;
  const target = { kind: "url" as const, text: url, href: url };

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPressIn={() => noteLinkTouch(target)}
      onPress={() => void open(target)}
      onLongPress={() => showLinkMenu(target)}
      accessibilityRole="link"
      style={{ width: cardWidth, marginTop: 6, paddingLeft: 10 }}
    >
      <View
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2, backgroundColor: bar }}
      />
      {row.siteName ? (
        <Text numberOfLines={1} style={{ color: bar, fontSize: 13, fontWeight: "700" }}>
          {row.siteName}
        </Text>
      ) : null}
      {row.title ? (
        <Text numberOfLines={2} style={{ color: titleColor, fontSize: 14, fontWeight: "600", marginTop: 1 }}>
          {row.title}
        </Text>
      ) : null}
      {row.description ? (
        <Text numberOfLines={3} style={{ color: subColor, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
          {row.description}
        </Text>
      ) : null}
      {row.image ? (
        <Image
          source={{ uri: row.image }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={row.image}
          style={{
            width: cardWidth - 10,
            height: large ? 190 : 130,
            borderRadius: 10,
            marginTop: 6,
            backgroundColor: withAlpha(subColor, 0.2),
          }}
        />
      ) : null}
    </TouchableOpacity>
  );
});
