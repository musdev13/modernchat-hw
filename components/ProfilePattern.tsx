import { Text, View } from "react-native";

const GLYPH: Record<string, string> = {
  stars: "✦",
  dots: "●",
  waves: "∿",
  hearts: "♥",
};

/** Декоративний візерунок обкладинки профілю (Premium): ряди символів з шаховим зсувом. */
export function ProfilePattern({ pattern, color = "#FFFFFF", opacity = 0.18 }: { pattern?: string; color?: string; opacity?: number }) {
  const glyph = pattern ? GLYPH[pattern] : undefined;
  if (!glyph) return null;
  const rows = 9;
  const cols = 8;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
      {Array.from({ length: rows }, (_, r) => (
        <View
          key={r}
          style={{ flexDirection: "row", justifyContent: "space-around", marginTop: r === 0 ? 24 : 26, paddingLeft: r % 2 ? 22 : 0 }}
        >
          {Array.from({ length: cols }, (_, i) => (
            <Text
              key={i}
              style={{ color, opacity: opacity * (0.55 + ((r * 3 + i * 5) % 7) / 10), fontSize: pattern === "dots" ? 8 + ((r + i) % 3) * 3 : 14 + ((r + i) % 3) * 4 }}
            >
              {glyph}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
