import { COLORS } from "@/constants/theme";
import * as Haptics from "expo-haptics";
import React, { useMemo, useRef } from "react";
import { GestureResponderEvent, View } from "react-native";

interface AudioWaveformProps {
  /** Масив нормалізованих амплітуд [0.1 .. 1.0]. Якщо не передано — генерується fallback. */
  waveform?: number[];
  /** Прогрес відтворення 0..1 */
  progress: number;
  /** Загальна тривалість у секундах (потрібна для seek) */
  duration: number;
  /** true — повідомлення власне (білий бабл), false — чуже */
  isMine: boolean;
  /** Виклик при тапі/свайпу — секунда, на яку треба перемотати */
  onSeek?: (targetSeconds: number) => void;
  /** Висота хвилі в px (за замовчуванням 32) */
  height?: number;
}

const DEFAULT_BARS_COUNT = 32;

/**
 * Детермінована fallback-генерація хвилі для старіших аудіо,
 * у яких відсутній масив `waveform` у БД.
 * Форма імітує природні коливання мовлення (синусоїда + модуляція).
 */
function generateFallbackWaveform(count: number): number[] {
  return Array.from({ length: count }, (_, index) => {
    const x = (index / count) * Math.PI * 4;
    const value = 0.2 + 0.35 * Math.sin(x) + 0.35 * Math.abs(Math.cos(x * 1.7));
    return Number(Math.max(0.12, Math.min(1.0, value)).toFixed(2));
  });
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  waveform,
  progress,
  duration,
  isMine,
  onSeek,
  height = 32,
}) => {
  const containerRef = useRef<View>(null);

  const bars = useMemo(() => {
    if (waveform && waveform.length >= 16) {
      return waveform.slice(0, DEFAULT_BARS_COUNT);
    }
    return generateFallbackWaveform(DEFAULT_BARS_COUNT);
  }, [waveform]);

  const handleTouch = (event: GestureResponderEvent) => {
    if (!onSeek || duration <= 0) return;

    containerRef.current?.measure((_x, _y, width, _h, pageX) => {
      if (!width || width <= 0) return;
      const touchX = event.nativeEvent.pageX - pageX;
      const relativeProgress = Math.max(0, Math.min(1, touchX / width));
      const targetSeconds = relativeProgress * duration;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSeek(targetSeconds);
    });
  };

  const activeColor = isMine ? COLORS.white : COLORS.primary;
  const inactiveColor = isMine
    ? "rgba(255, 255, 255, 0.35)"
    : "rgba(148, 163, 184, 0.45)"; // COLORS.textMuted @ 45%

  return (
    <View
      ref={containerRef}
      onStartShouldSetResponder={() => !!onSeek}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
      style={{ height }}
      className="flex-1 flex-row items-center justify-between py-1"
    >
      {bars.map((amplitude, index) => {
        const barRelativePos = index / bars.length;
        const isFilled = progress >= barRelativePos;
        const minHeight = 4;
        const barHeight = Math.max(minHeight, amplitude * height);

        return (
          <View
            key={index}
            style={{
              width: 2.5,
              height: barHeight,
              borderRadius: 2,
              backgroundColor: isFilled ? activeColor : inactiveColor,
            }}
          />
        );
      })}
    </View>
  );
};
