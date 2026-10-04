import { Platform, Text, TextStyle, View } from "react-native";

/** Накладка історії: текст або емодзі-стікер. x/y — центр у частках 0..1 від розміру кадру. */
export interface StoryOverlay {
  type: "text" | "emoji";
  text: string;
  x: number;
  y: number;
  color?: string;
  size?: number;
  font?: string;
  bg?: boolean;
}

export const OVERLAY_COLORS = ["#FFFFFF", "#000000", "#FF3B30", "#FF9500", "#FFD60A", "#34C759", "#0A84FF", "#BF5AF2"];

export const OVERLAY_FONTS: { key: string; label: string }[] = [
  { key: "sans", label: "Aa" },
  { key: "serif", label: "Aa" },
  { key: "mono", label: "Aa" },
  { key: "bold", label: "Aa" },
];

export const STICKER_EMOJIS = [
  "😀", "😂", "😍", "🥰", "😎", "🤩", "😭", "😡", "🤔", "🙌", "👍", "👏", "🔥", "❤️", "💔", "✨",
  "🎉", "🎂", "🎁", "🌟", "⭐", "🌈", "☀️", "🌙", "🌸", "🍕", "☕", "⚽", "🎵", "📍", "💯", "🚀",
];

export function fontStyleOf(font?: string): TextStyle {
  switch (font) {
    case "serif":
      return { fontFamily: Platform.select({ ios: "Georgia", default: "serif" }), fontWeight: "700" };
    case "mono":
      return { fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), fontWeight: "700" };
    case "bold":
      return { fontWeight: "900", fontStyle: "italic" };
    default:
      return { fontWeight: "700" };
  }
}

export const overlaySize = (o: Pick<StoryOverlay, "type" | "size">) => o.size ?? (o.type === "emoji" ? 64 : 30);

/** Стиль підпису накладки (спільний для редактора й переглядача, щоб вони збігались). */
export function OverlayLabel({ o }: { o: StoryOverlay }) {
  const size = overlaySize(o);
  if (o.type === "emoji") {
    return <Text style={{ fontSize: size, lineHeight: size * 1.2, textAlign: "center" }}>{o.text}</Text>;
  }
  const color = o.color ?? "#FFFFFF";
  const dark = color === "#000000";
  return (
    <View
      style={{
        paddingHorizontal: o.bg ? 12 : 4,
        paddingVertical: o.bg ? 4 : 0,
        borderRadius: 10,
        backgroundColor: o.bg ? (dark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.55)") : "transparent",
      }}
    >
      <Text
        style={[
          {
            color,
            fontSize: size,
            lineHeight: size * 1.25,
            textAlign: "center",
            textShadowColor: o.bg ? "transparent" : "rgba(0,0,0,0.45)",
            textShadowRadius: 4,
            textShadowOffset: { width: 0, height: 1 },
          },
          fontStyleOf(o.font),
        ]}
      >
        {o.text}
      </Text>
    </View>
  );
}

export const OVERLAY_BOX = 300;

/** Розташування накладки в кадрі w×h: центр у (x·w, y·h). */
export function overlayPosition(o: StoryOverlay, w: number, h: number) {
  const size = overlaySize(o);
  return {
    position: "absolute" as const,
    left: o.x * w - OVERLAY_BOX / 2,
    top: o.y * h - size * 0.7,
    width: OVERLAY_BOX,
    alignItems: "center" as const,
  };
}

/** Накладки у переглядачі (лише показ). */
export function StoryOverlays({ overlays, w, h }: { overlays: StoryOverlay[]; w: number; h: number }) {
  if (!w || !h) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {overlays.map((o, i) => (
        <View key={i} style={overlayPosition(o, w, h)}>
          <OverlayLabel o={o} />
        </View>
      ))}
    </View>
  );
}
