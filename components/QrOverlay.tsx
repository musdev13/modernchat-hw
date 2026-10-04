import { GlassBackdrop } from "@/components/Glass";
import { QrCode } from "@/components/QrCode";
import { avatarColor, initialsOf } from "@/constants/theme";
import { useChatPalette } from "@/hooks/useChatPalette";
import { copyText } from "@/utils/clipboard";
import { userLink } from "@/utils/profileFormat";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

interface Props {
  visible: boolean;
  onClose: () => void;
  name: string;
  username?: string;
  avatarUrl?: string | null;
}

const SPRING = { damping: 20, stiffness: 240, mass: 0.8 } as const;

/** Змішує два кольори #RRGGBB (звичайна JS-функція — у воркліти не передавати). */
function mixHex(a: string, b: string, t: number): string {
  const pa = a.replace("#", "");
  const pb = b.replace("#", "");
  if (pa.length !== 6 || pb.length !== 6) return a;
  const ch = (i: number) => {
    const x = parseInt(pa.slice(i, i + 2), 16);
    const y = parseInt(pb.slice(i, i + 2), 16);
    return Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}

/**
 * QR-візитка поверх поточного екрана (без окремої сторінки): розмитий фон, картка з градієнтом теми,
 * QR на білій плитці з аватаром у центрі. Закривається дотиком повз картку, свайпом вниз і кнопкою «Назад».
 * Рендериться всередині екрана профілю (в межах GlassProvider), тож розмиває сам профіль.
 */
export function QrOverlay({ visible, onClose, name, username, avatarUrl }: Props) {
  const c = useChatPalette();
  const { width: W } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [copied, setCopied] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      dragY.value = 0;
      progress.value = withSpring(1, SPRING);
    } else {
      progress.value = withTiming(0, { duration: 170, easing: Easing.out(Easing.quad) }, (done) => {
        if (done) runOnJS(unmount)();
      });
    }
  }, [visible, progress, dragY, unmount]);

  // Android «Назад» закриває оверлей (з анімацією), а не екран.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const swipe = Gesture.Pan()
    .activeOffsetY([8, 9999])
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (dragY.value > 90 || e.velocityY > 900) {
        runOnJS(onClose)();
      } else {
        dragY.value = withSpring(0, SPRING);
      }
    });

  const dimStyle = useAnimatedStyle(() => ({
    opacity: progress.value * (1 - Math.min(1, dragY.value / 400)),
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 1.5),
    transform: [
      { translateY: (1 - progress.value) * 36 + dragY.value },
      { scale: 0.88 + 0.12 * progress.value },
    ],
  }));

  if (!mounted) return null;

  const link = username ? userLink(username) : null;
  const cardW = Math.min(W - 48, 340);
  const tile = cardW - 64;
  const qrSize = tile - 24;
  const top = c.accent;
  const bottom = mixHex(c.accent, c.isDark ? "#000000" : "#2B1055", 0.5);

  const copy = async () => {
    if (!link) return;
    if ((await copyText(link)) === "copied") {
      void Haptics.selectionAsync();
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100 }]}
      accessibilityViewIsModal
    >
      <Animated.View style={[StyleSheet.absoluteFill, dimStyle]} pointerEvents="none">
        <GlassBackdrop intensity={60} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.38)" }]} />
      </Animated.View>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Закрити QR-код"
      />

      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.center]}>
        <GestureDetector gesture={swipe}>
          <Animated.View style={[{ width: cardW }, cardStyle]}>
            <View style={[styles.card, { backgroundColor: bottom }]}>
              {/* Градієнт лежить у власному контейнері з однаковим радіусом з усіх боків */}
              <View pointerEvents="none" style={styles.gradientClip}>
                <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
                  <Defs>
                    <LinearGradient id="qrCard" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor={top} stopOpacity="1" />
                      <Stop offset="1" stopColor={bottom} stopOpacity="1" />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="1" height="1" fill="url(#qrCard)" />
                </Svg>
              </View>

              <View style={styles.grabber} />

              {link ? (
                <View style={[styles.tile, { width: tile, height: tile }]}>
                  <QrCode value={link} size={qrSize} quiet={0} level="Q" />
                  <View style={styles.avatarWrap} pointerEvents="none">
                    <View style={[styles.avatarCircle, { backgroundColor: avatarColor(name || "?") }]}>
                      {avatarUrl && !avatarFailed ? (
                        <ExpoImage
                          source={{ uri: avatarUrl }}
                          contentFit="cover"
                          transition={0}
                          cachePolicy="memory-disk"
                          onError={() => setAvatarFailed(true)}
                          style={StyleSheet.absoluteFill}
                        />
                      ) : (
                        <Text style={styles.avatarInitials}>{initialsOf(name)}</Text>
                      )}
                    </View>
                  </View>
                </View>
              ) : (
                <View style={[styles.tile, { width: tile, height: tile }]}>
                  <Ionicons name="qr-code-outline" size={64} color="#9CA3AF" />
                  <Text style={styles.noUser}>Спершу задайте ім'я користувача в профілі</Text>
                </View>
              )}

              <Text numberOfLines={1} style={styles.name}>
                {name}
              </Text>
              {username ? (
                <Text numberOfLines={1} style={styles.username}>
                  @{username}
                </Text>
              ) : null}

              {link ? (
                <View style={styles.buttons}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void Share.share({ message: link }).catch(() => {})}
                    android_ripple={{ color: "rgba(0,0,0,0.12)" }}
                    style={[styles.btn, { backgroundColor: "#FFFFFF" }]}
                  >
                    <View style={styles.btnRow}>
                      <Ionicons name="share-outline" size={20} color={top} />
                      <Text style={[styles.btnText, { color: top }]}>Поділитися</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void copy()}
                    android_ripple={{ color: "rgba(255,255,255,0.2)" }}
                    style={[styles.btn, { backgroundColor: "rgba(255,255,255,0.22)" }]}
                  >
                    <View style={styles.btnRow}>
                      <Ionicons name={copied ? "checkmark" : "copy-outline"} size={20} color="#FFFFFF" />
                      <Text style={[styles.btnText, { color: "#FFFFFF" }]}>
                        {copied ? "Скопійовано" : "Копіювати посилання"}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  card: {
    borderRadius: 28,
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  gradientClip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    overflow: "hidden",
  },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.45)", marginBottom: 16 },
  tile: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrap: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  noUser: { color: "#6B7280", fontSize: 14, textAlign: "center", marginTop: 10, paddingHorizontal: 18 },
  name: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", marginTop: 20, alignSelf: "stretch", textAlign: "center" },
  username: { color: "rgba(255,255,255,0.86)", fontSize: 16, marginTop: 4, alignSelf: "stretch", textAlign: "center" },
  buttons: { alignSelf: "stretch", marginTop: 22, gap: 12 },
  btn: { height: 50, borderRadius: 16, overflow: "hidden" },
  btnRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { fontSize: 15.5, fontWeight: "700" },
});
