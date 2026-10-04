import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export type EffectKey = "confetti" | "fire" | "hearts" | "like";

export const EFFECT_META: Record<EffectKey, { label: string; emoji: string }> = {
  confetti: { label: "Конфеті", emoji: "🎉" },
  fire: { label: "Вогонь", emoji: "🔥" },
  hearts: { label: "Серця", emoji: "❤️" },
  like: { label: "Лайк", emoji: "👍" },
};

const GLYPHS: Record<EffectKey, string[]> = {
  confetti: ["🎉", "🎊", "✨", "🟦", "🟥", "🟨", "🟩", "🟪"],
  fire: ["🔥", "🔥", "🔥", "✨"],
  hearts: ["❤️", "💖", "💕", "💗"],
  like: ["👍", "👍", "⭐"],
};

const COUNT = 28;
export const EFFECT_DURATION_MS = 2800;

interface ParticleSpec {
  id: number;
  glyph: string;
  x: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
}

function Particle({
  spec,
  effect,
  width,
  height,
}: {
  spec: ParticleSpec;
  effect: EffectKey;
  width: number;
  height: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(spec.delay, withTiming(1, { duration: spec.duration, easing: Easing.out(Easing.quad) }));
  }, [t, spec.delay, spec.duration]);

  // Конфеті падає зверху, вогонь/серця летять знизу вгору, лайки «вистрибують» знизу.
  const falling = effect === "confetti";
  const style = useAnimatedStyle(() => {
    const p = t.value;
    const y = falling ? -40 + p * (height + 80) : height - p * (height * (effect === "like" ? 0.7 : 1) + 40);
    const opacity = p === 0 ? 0 : p < 0.12 ? p / 0.12 : p > 0.75 ? Math.max(0, (1 - p) / 0.25) : 1;
    const scale = effect === "like" ? 0.5 + Math.sin(p * Math.PI) * 1.1 : 0.7 + p * 0.5;
    return {
      opacity,
      transform: [
        { translateX: spec.x * width + Math.sin(p * 6 + spec.id) * spec.drift },
        { translateY: y },
        { rotate: `${p * spec.spin}deg` },
        { scale },
      ],
    };
  });

  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0 }, style]} pointerEvents="none">
      <Text style={{ fontSize: spec.size }}>{spec.glyph}</Text>
    </Animated.View>
  );
}

/**
 * Повноекранний ефект повідомлення (Premium). Монтується на час анімації; key змінюється для
 * повторного запуску. Анімація йде на UI-потоці (Reanimated), без обробників подій.
 */
export function MessageEffectOverlay({ effect }: { effect: EffectKey | null }) {
  const { width, height } = useWindowDimensions();
  const specs = useMemo<ParticleSpec[]>(() => {
    if (!effect) return [];
    const glyphs = GLYPHS[effect];
    return Array.from({ length: COUNT }, (_, i) => ({
      id: i,
      glyph: glyphs[i % glyphs.length],
      x: Math.random() * 0.9 + 0.02,
      size: 22 + Math.round(Math.random() * 22),
      delay: Math.round(Math.random() * 700),
      duration: 1500 + Math.round(Math.random() * 1000),
      drift: 10 + Math.random() * 26,
      spin: (Math.random() - 0.5) * (effect === "confetti" ? 720 : 90),
    }));
  }, [effect]);

  const flash = useSharedValue(0);
  useEffect(() => {
    if (effect === "fire") {
      flash.value = withSequence(
        withTiming(0.28, { duration: 350 }),
        withDelay(900, withTiming(0, { duration: 900 })),
      );
    }
  }, [effect, flash]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  if (!effect) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 60, overflow: "hidden" }]}>
      {effect === "fire" ? (
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#FF6A00" }, flashStyle]} />
      ) : null}
      {specs.map((s) => (
        <Particle key={s.id} spec={s} effect={effect} width={width} height={height} />
      ))}
    </View>
  );
}
