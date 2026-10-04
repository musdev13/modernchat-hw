import { useId } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

interface Props {
  /** Біля якого краю контейнера лежить скрим. */
  edge: "top" | "bottom";
  height: number;
  /** Колір фону теми (повністю непрозорий хекс). */
  color: string;
  /** Непрозорість біля самого краю (до 0 на протилежному кінці). */
  opacity?: number;
}

/**
 * М'яке затемнення біля краю екрана: колір фону теми → прозорий. Повідомлення, що прокручуються
 * під скляними елементами (капсула шапки, поле вводу), плавно «розчиняються». Не ловить дотики.
 */
export function EdgeScrim({ edge, height, color, opacity = 0.85 }: Props) {
  const id = `scrim${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  // Біля краю — максимум, далі до нуля; для верхнього краю градієнт іде зверху вниз.
  const startOpacity = edge === "top" ? opacity : 0;
  const endOpacity = edge === "top" ? 0 : opacity;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, height, [edge]: 0 }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={startOpacity} />
            <Stop offset="0.45" stopColor={color} stopOpacity={(startOpacity + endOpacity) * 0.5} />
            <Stop offset="1" stopColor={color} stopOpacity={endOpacity} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
