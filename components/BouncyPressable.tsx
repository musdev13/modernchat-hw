import React, { PropsWithChildren } from "react";
import {
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type BouncyPressableProps = PropsWithChildren<
  Omit<PressableProps, "style"> & {
    containerStyle?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
  }
>;

export function BouncyPressable({
  children,
  containerStyle,
  contentStyle,
  onPressIn,
  onPressOut,
  ...pressableProps
}: BouncyPressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[containerStyle, animatedStyle]}>
      <Pressable
        {...pressableProps}
        style={contentStyle}
        onPressIn={(event) => {
          scale.set(withTiming(0.97, { duration: 90 }));
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.set(withTiming(1, { duration: 120 }));
          onPressOut?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
