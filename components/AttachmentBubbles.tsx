import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { formatFileSize } from "@/utils/attachments";
import { formatDuration } from "@/components/RoomInfoRows";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useVideoPlayer, VideoThumbnail } from "expo-video";
import { useEffect, useState } from "react";
import { Linking, Text, TouchableOpacity, View } from "react-native";

export const MEDIA_BUBBLE_WIDTH = 240;

/** Пропорції з метаданих повідомлення (щоб бульбашка не «стрибала» після завантаження). */
export function ratioFrom(width?: number, height?: number, fallback = 1): number {
  if (width && height && width > 0 && height > 0) {
    return Math.min(1.8, Math.max(0.6, width / height));
  }
  return fallback;
}

// ── Прев'ю відео: перший кадр генеруємо локально й кешуємо ──
const thumbCache = new Map<string, VideoThumbnail>();

function ThumbGenerator({ url, onReady }: { url: string; onReady: (t: VideoThumbnail) => void }) {
  const player = useVideoPlayer(url);
  useEffect(() => {
    let cancelled = false;
    let started = false;
    const generate = async () => {
      if (started) return;
      started = true;
      try {
        const [thumb] = await player.generateThumbnailsAsync(0.1, { maxWidth: 480 });
        if (!cancelled && thumb) {
          thumbCache.set(url, thumb);
          onReady(thumb);
        }
      } catch {
        // без прев'ю — лишається темна плитка з кнопкою відтворення
      }
    };
    const sub = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") void generate();
    });
    if (player.status === "readyToPlay") void generate();
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [player, url, onReady]);
  return null;
}

/** Відео-бульбашка: прев'ю, кнопка відтворення й тривалість. */
export function VideoBubble({
  url,
  width,
  height,
  duration,
  onPress,
}: {
  url: string;
  width?: number;
  height?: number;
  duration?: number;
  onPress: () => void;
}) {
  const [thumb, setThumb] = useState<VideoThumbnail | undefined>(() => thumbCache.get(url));
  const ratio = ratioFrom(width, height, 16 / 9);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Відтворити відео"
      style={{
        width: MEDIA_BUBBLE_WIDTH,
        height: MEDIA_BUBBLE_WIDTH / ratio,
        maxHeight: 360,
        borderRadius: 15,
        overflow: "hidden",
        backgroundColor: "#0B0F14",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {thumb ? (
        <Image source={thumb} style={{ position: "absolute", inset: 0 }} contentFit="cover" />
      ) : (
        <ThumbGenerator url={url} onReady={setThumb} />
      )}
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="play" size={26} color="#FFFFFF" style={{ marginLeft: 3 }} />
      </View>
      {duration ? (
        <View
          style={{
            position: "absolute",
            left: 8,
            top: 8,
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: 9,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600" }}>
            {formatDuration(duration)}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/** Файл-бульбашка: іконка, назва, розмір; дотик відкриває/завантажує файл. */
export function FileBubble({
  url,
  name,
  size,
  isOwn,
}: {
  url: string;
  name?: string;
  size?: number;
  isOwn: boolean;
}) {
  const c = useChatPalette();
  const fg = isOwn ? c.outgoingText : c.incomingText;
  const tint = isOwn ? c.onAccent : c.accent;
  const ext = (name?.split(".").pop() ?? "").slice(0, 4).toUpperCase();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => Linking.openURL(url).catch(() => {})}
      accessibilityRole="button"
      accessibilityLabel={`Файл ${name ?? ""}`}
      style={{ flexDirection: "row", alignItems: "center", minWidth: 200, paddingVertical: 2 }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: withAlpha(tint, 0.2),
          alignItems: "center",
          justifyContent: "center",
          marginRight: 10,
        }}
      >
        <Ionicons name="document-text" size={22} color={tint} />
        {ext ? (
          <Text style={{ color: tint, fontSize: 8, fontWeight: "800", marginTop: -1 }}>{ext}</Text>
        ) : null}
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text numberOfLines={2} style={{ color: fg, fontSize: 15, fontWeight: "600" }}>
          {name ?? "Файл"}
        </Text>
        {size ? (
          <Text style={{ color: fg, opacity: 0.65, fontSize: 12.5, marginTop: 1 }}>
            {formatFileSize(size)}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
