import { COLORS, FONTS } from "@/constants/theme";
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
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
            withTiming(-3, { duration: 300 }),
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

  if (typingUsers.length === 0) return null;

  const text =
    typingUsers.length === 1
      ? `${typingUsers[0]} пише`
      : `${typingUsers.join(", ")} пишуть`;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 6,
        backgroundColor: COLORS.background,
      }}
    >
      <Text style={{ fontSize: 11, marginRight: 6 }}>✏️</Text>
      <Text
        style={{
          fontFamily: FONTS.body,
          fontSize: 11,
          color: COLORS.primary,
          marginRight: 8,
        }}
      >
        {text}
      </Text>
      <View style={{ flexDirection: "row", gap: 3 }}>
        <Animated.View
          style={[
            {
              width: 5,
              height: 5,
              borderRadius: 2.5,
              backgroundColor: COLORS.primary,
            },
            dot1Style,
          ]}
        />
        <Animated.View
          style={[
            {
              width: 5,
              height: 5,
              borderRadius: 2.5,
              backgroundColor: COLORS.secondary,
            },
            dot2Style,
          ]}
        />
        <Animated.View
          style={[
            {
              width: 5,
              height: 5,
              borderRadius: 2.5,
              backgroundColor: COLORS.accent,
            },
            dot3Style,
          ]}
        />
      </View>
    </View>
  );
}