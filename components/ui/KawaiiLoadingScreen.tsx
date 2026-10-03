import { COLORS, FONTS } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";

const ICON_SIZE = 96;
const RING_SIZE = 180;

export function KawaiiLoadingScreen() {
  const iconScale = useSharedValue(1);
  const ringRotation = useSharedValue(0);
  const dot1 = useSharedValue(1);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    iconScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    ringRotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false,
    );

    const dotTiming = (delay: number) =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400 }),
            withTiming(0.3, { duration: 400 }),
          ),
          -1,
          false,
        ),
      );

    dot1.value = dotTiming(0);
    dot2.value = dotTiming(200);
    dot3.value = dotTiming(400);
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotation.value}deg` }],
  }));

  const dot1Style = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: dot3.value }));

  return (
    <View style={styles.container}>
      <View style={styles.centerWrap}>
        <Animated.View style={[styles.ring, ringStyle]}>
          <Text style={[styles.star, styles.starTop]}>✨</Text>
          <Text style={[styles.star, styles.starRight]}>💕</Text>
          <Text style={[styles.star, styles.starBottom]}>🌸</Text>
          <Text style={[styles.star, styles.starLeft]}>✨</Text>
        </Animated.View>

        <Animated.View style={iconStyle}>
          <LinearGradient
            colors={["#FF8FB4", "#B794F6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircle}
          >
            <Ionicons name="chatbubbles" size={44} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>
      </View>

      <Text style={styles.title}>Завантаження...</Text>

      <View style={styles.dotsRow}>
        <Animated.View style={[styles.dot, dot1Style]} />
        <Animated.View style={[styles.dot, styles.dotGap, dot2Style]} />
        <Animated.View style={[styles.dot, styles.dotGap, dot3Style]} />
      </View>

      <Text style={styles.subtitle}>готуємо твій кавайний простір</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  centerWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ring: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  star: {
    position: "absolute",
    fontSize: 22,
  },
  starTop: {
    top: 0,
    left: RING_SIZE / 2 - 11,
  },
  starRight: {
    right: 0,
    top: RING_SIZE / 2 - 11,
  },
  starBottom: {
    bottom: 0,
    left: RING_SIZE / 2 - 11,
  },
  starLeft: {
    left: 0,
    top: RING_SIZE / 2 - 11,
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF8FB4",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  title: {
    marginTop: 32,
    fontFamily: FONTS.headingBold,
    fontSize: 20,
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  dotsRow: {
    flexDirection: "row",
    marginTop: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  dotGap: {
    marginLeft: 6,
  },
  subtitle: {
    marginTop: 20,
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
});