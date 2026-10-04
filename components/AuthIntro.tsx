import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { ComponentProps, memo, useCallback, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FLAG = "onboarding_done_v1";

/** Читає прапорець «вступ уже показано» (SecureStore — окремої залежності для сховища не додаємо). */
export async function wasIntroSeen(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(FLAG)) === "1";
  } catch {
    return false;
  }
}

type IconName = ComponentProps<typeof Ionicons>["name"];
const SLIDES: { icon: IconName; title: string; text: string }[] = [
  { icon: "paper-plane", title: "Зв'язок без меж", text: "Миттєві повідомлення, голосові, відеокружечки та реакції — швидко й надійно." },
  { icon: "planet", title: "Групи та канали", text: "Створюйте спільноти, ведіть публічні канали та обговорюйте новини в коментарях." },
  { icon: "color-palette", title: "Ваш стиль", text: "Теми у дусі космічних місій і детальні налаштування під себе." },
];

const Dot = memo(function Dot({ i, x, W }: { i: number; x: { value: number }; W: number }) {
  const style = useAnimatedStyle(() => {
    const p = x.value / W;
    return {
      width: interpolate(p, [i - 1, i, i + 1], [8, 26, 8], Extrapolation.CLAMP),
      opacity: interpolate(p, [i - 1, i, i + 1], [0.35, 1, 0.35], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
});

/** Три слайди вступу: свайп, точки, «Далі»/«Почати». Показується один раз після встановлення. */
export function AuthIntro({ onDone }: { onDone: () => void }) {
  const { width: W } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const x = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList>(null);

  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  const finish = useCallback(() => {
    SecureStore.setItemAsync(FLAG, "1").catch(() => {});
    onDone();
  }, [onDone]);

  const last = index === SLIDES.length - 1;

  return (
    <Animated.View entering={FadeIn.duration(500)} style={StyleSheet.absoluteFill}>
      <Pressable
        onPress={finish}
        accessibilityRole="button"
        style={[styles.skip, { top: insets.top + 14 }]}
        hitSlop={10}
      >
        <Text style={styles.skipText}>Пропустити</Text>
      </Pressable>

      <Animated.FlatList
        ref={list as any}
        data={SLIDES}
        keyExtractor={(s) => s.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / W))}
        renderItem={({ item, index: i }) => (
          <View style={{ width: W, alignItems: "center", justifyContent: "center", paddingHorizontal: 36 }}>
            <Animated.View entering={FadeInDown.delay(i === 0 ? 250 : 0).duration(600)} style={styles.iconRing}>
              <Ionicons name={item.icon} size={54} color="#FFFFFF" />
            </Animated.View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.text}>{item.text}</Text>
          </View>
        )}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Dot key={i} i={i} x={x} W={W} />
          ))}
        </View>
        <Pressable
          onPress={() => {
            if (last) finish();
            else list.current?.scrollToIndex({ index: index + 1, animated: true });
            if (!last) setIndex(index + 1);
          }}
          accessibilityRole="button"
          style={styles.cta}
        >
          <Text style={styles.ctaText}>{last ? "Почати" : "Далі"}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  skip: { position: "absolute", right: 22, zIndex: 5 },
  skipText: { color: "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: "600" },
  iconRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: 40,
  },
  title: { color: "#FFFFFF", fontSize: 30, fontWeight: "800", letterSpacing: 0.4, textAlign: "center" },
  text: { color: "rgba(255,255,255,0.72)", fontSize: 16, lineHeight: 24, textAlign: "center", marginTop: 14 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingHorizontal: 28 },
  dots: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 26 },
  dot: { height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
  cta: {
    alignSelf: "stretch",
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: "#05070D", fontSize: 16, fontWeight: "800", letterSpacing: 0.6 },
});
