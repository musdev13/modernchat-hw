import { ComponentProps, ReactNode } from "react";
import { Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

type AnimatedViewStyle = ComponentProps<typeof Animated.View>["style"];

interface Props extends Omit<PressableProps, "style" | "children"> {
  children: ReactNode;
  /** Зовнішній стиль (розкладка: flex, відступи). */
  style?: StyleProp<ViewStyle>;
  /** Стиль внутрішнього блоку, який «стискається» (фон, радіус, анімовані стилі). */
  innerStyle?: AnimatedViewStyle;
  /** До якого масштабу стискається при натисканні. */
  scaleTo?: number;
}

const SPRING = { damping: 18, stiffness: 380, mass: 0.6 } as const;

/** Pressable з м'яким «стисканням» (spring-масштаб на UI-потоці) при натисканні. */
export function PressableScale({
  children,
  style,
  innerStyle,
  scaleTo = 0.96,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      {...rest}
      style={style}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, SPRING);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[innerStyle, animated]}>{children}</Animated.View>
    </Pressable>
  );
}
