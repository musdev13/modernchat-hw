import { View, Text } from "react-native";
import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";

type Props = {
  typingUsers: string[];
};

export function TypingDots({ typingUsers }: Props) {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animateDot = (dot: typeof dot1, delay: number) => {
      dot.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-4, { duration: 300 }),
            withTiming(0, { duration: 300 }),
          ),
          -1,
          false,
        ),
      );
    };

    animateDot(dot1, 0);
    animateDot(dot2, 150);
    animateDot(dot3, 300);
  }, [dot1, dot2, dot3]);

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1.value }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2.value }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3.value }],
  }));

  if (typingUsers.length === 0) {
    return null;
  }

  const text =
    typingUsers.length === 1
      ? `${typingUsers[0]} друкує`
      : `${typingUsers.join(", ")} друкують`;

  return (
    <View
      className="flex-row items-center px-4 py-1.5"
      style={{ backgroundColor: "#0A0F1D" }}
    >
      <Text className="text-xs mr-2" style={{ color: "#94A3B8" }}>
        {text}
      </Text>

      <View className="flex-row items-center gap-1">
        <Animated.View
          className="w-1.5 h-1.5 rounded-full bg-primary"
          style={dot1Style}
        />

        <Animated.View
          className="w-1.5 h-1.5 rounded-full bg-primary"
          style={dot2Style}
        />

        <Animated.View
          className="w-1.5 h-1.5 rounded-full bg-primary"
          style={dot3Style}
        />
      </View>
    </View>
  );
}
