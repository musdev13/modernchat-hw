import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

function Particle({ emoji, index, total }: { emoji: string; index: number; total: number }) {
  const p = useSharedValue(0);
  const spread = useMemo(() => ((index / Math.max(1, total - 1)) - 0.5) * 220 + (Math.random() - 0.5) * 40, [index, total]);
  const rise = useMemo(() => 260 + Math.random() * 180, []);
  const size = useMemo(() => 26 + Math.random() * 22, []);
  useEffect(() => {
    p.value = withDelay(index * 40, withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }));
  }, [p, index]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.15 ? p.value / 0.15 : 1 - Math.max(0, (p.value - 0.55) / 0.45),
    transform: [
      { translateX: spread * p.value },
      { translateY: -rise * p.value },
      { scale: 0.5 + Math.min(p.value * 3, 1) * 0.7 },
    ],
  }));
  return (
    <Animated.Text style={[{ position: "absolute", fontSize: size }, style]}>{emoji}</Animated.Text>
  );
}

/** Анімація «серденька» (будь-якого емодзі): частинки злітають угору. Новий `nonce` — новий спалах. */
export function ReactionBurst({ emoji, nonce }: { emoji: string; nonce: number }) {
  if (!nonce) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: "50%", bottom: 90, width: 1, height: 1 }}>
      {Array.from({ length: 9 }, (_, i) => (
        <Particle key={`${nonce}-${i}`} emoji={emoji} index={i} total={9} />
      ))}
    </View>
  );
}
