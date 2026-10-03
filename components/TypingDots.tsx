import { useChatPalette } from "@/hooks/useChatPalette";
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
  const c = useChatPalette();
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

  const dotStyle = {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.accent,
  } as const;

  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 4, alignItems: "flex-start" }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: c.incoming,
          borderRadius: 16,
          borderBottomLeftRadius: 4,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, marginRight: 8, maxWidth: 220 }}>
          {text}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Animated.View style={[dotStyle, dot1Style]} />
          <Animated.View style={[dotStyle, dot2Style]} />
          <Animated.View style={[dotStyle, dot3Style]} />
        </View>
      </View>
    </View>
  );
}
