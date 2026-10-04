import { memo, useEffect, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from "react-native-svg";

interface StarSpec {
  x: number;
  y: number;
  size: number;
  base: number;
  period: number;
  delay: number;
}

/** Детермінований генератор (mulberry32): однаковий розподіл зірок між запусками. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Star = memo(function Star({ s, tint, animated }: { s: StarSpec; tint: string; animated: boolean }) {
  const v = useSharedValue(0.5);
  useEffect(() => {
    if (!animated) {
      v.value = 0.5;
      return;
    }
    v.value = withDelay(
      s.delay,
      withRepeat(withTiming(1, { duration: s.period, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    return () => cancelAnimation(v);
  }, [v, s.delay, s.period, animated]);
  const style = useAnimatedStyle(() => ({ opacity: s.base * (0.35 + 0.65 * v.value) }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: s.x,
          top: s.y,
          width: s.size,
          height: s.size,
          borderRadius: s.size / 2,
          backgroundColor: tint,
        },
        style,
      ]}
    />
  );
});

interface Props {
  /** Кількість зірок (легка анімація opacity на UI-потоці). */
  stars?: number;
  /** Лімб планети внизу (як на кадрах SpaceX). */
  horizon?: boolean;
  /** Колір світіння лімба / туманності. */
  glow?: string;
  /** Колір зірок. */
  starColor?: string;
  /** Кольори фону: верх → низ. */
  top?: string;
  bottom?: string;
  /** false — без власного неба/градієнта: лише зірки (для фону чату поверх кольору теми). */
  sky?: boolean;
  /** Колір м'якого світіння в куті (туманність/корона); без значення — не малюється. */
  ambient?: string;
  /** false — зірки статичні (налаштування «Анімації» вимкнено). */
  animated?: boolean;
}

function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Статичне м'яке світіння зверху (для преміальних тем у налаштуваннях). */
export const ThemeGlow = memo(function ThemeGlow({ color, height = 260, opacity = 0.2 }: { color: string; height?: number; opacity?: number }) {
  const { width: W } = useWindowDimensions();
  const [r, g, b] = rgbOf(color);
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height }}>
      <Svg width={W} height={height}>
        <Defs>
          <RadialGradient id="themeGlow" cx="0.5" cy="0" rx="0.9" ry="1">
            <Stop offset="0" stopColor={`rgb(${r},${g},${b})`} stopOpacity={opacity} />
            <Stop offset="1" stopColor={`rgb(${r},${g},${b})`} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={W} height={height} fill="url(#themeGlow)" />
      </Svg>
    </View>
  );
});

/**
 * Космічний фон: градієнт, мерехтливі зірки, світіння горизонту. Усе малюється один раз,
 * анімується лише opacity зірок (UI-потік) — без перемальовування JS.
 */
export const SpaceBackdrop = memo(function SpaceBackdrop({
  stars = 46,
  horizon = true,
  glow = "#7CC4FF",
  starColor = "#FFFFFF",
  top = "#02030A",
  bottom = "#0A1428",
  sky = true,
  ambient,
  animated = true,
}: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const list = useMemo<StarSpec[]>(() => {
    const r = rng(20261004);
    return Array.from({ length: stars }, () => ({
      x: r() * W,
      y: r() * H * 0.86,
      size: r() < 0.14 ? 2.6 : r() < 0.5 ? 1.8 : 1.2,
      base: 0.45 + r() * 0.55,
      period: 1600 + r() * 3200,
      delay: r() * 2400,
    }));
  }, [stars, W, H]);

  const R = Math.max(W, 380) * 1.5;
  const [gr, gg, gb] = useMemo(() => rgbOf(glow), [glow]);
  const [ar, ag, ab] = useMemo(() => rgbOf(ambient ?? "#000000"), [ambient]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="bgSky" cx="0.5" cy="1" r="1.1">
            <Stop offset="0" stopColor={bottom} stopOpacity="1" />
            <Stop offset="1" stopColor={top} stopOpacity="1" />
          </RadialGradient>
          <RadialGradient id="bgLimb" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#01030A" stopOpacity="1" />
            <Stop offset="0.93" stopColor="#030816" stopOpacity="1" />
            <Stop offset="0.975" stopColor={`rgb(${gr},${gg},${gb})`} stopOpacity="0.85" />
            <Stop offset="0.99" stopColor={`rgb(${gr},${gg},${gb})`} stopOpacity="0.25" />
            <Stop offset="1" stopColor={`rgb(${gr},${gg},${gb})`} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {sky ? <Rect x="0" y="0" width={W} height={H} fill="url(#bgSky)" /> : null}
        {ambient ? (
          <>
            <Defs>
              <RadialGradient id="bgAmbient" cx="0.85" cy="0.1" rx="0.9" ry="0.6">
                <Stop offset="0" stopColor={`rgb(${ar},${ag},${ab})`} stopOpacity="0.2" />
                <Stop offset="1" stopColor={`rgb(${ar},${ag},${ab})`} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width={W} height={H} fill="url(#bgAmbient)" />
          </>
        ) : null}
        {sky && horizon ? <Ellipse cx={W / 2} cy={H + R - H * 0.13} rx={R} ry={R} fill="url(#bgLimb)" /> : null}
      </Svg>
      {list.map((s, i) => (
        <Star key={i} s={s} tint={starColor} animated={animated} />
      ))}
    </View>
  );
});
