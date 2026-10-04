import { GlassProvider, GlassTarget } from "@/components/Glass";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { RoomAvatar } from "@/components/RoomAvatar";
import { avatarColor, initialsOf } from "@/constants/theme";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, ReactNode, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

type IconName = ComponentProps<typeof Ionicons>["name"];

const BAR_TOP_GAP = 6;
const BAR_BUTTON = 44;
const BAR_SIDE_MARGIN = 12;
const AVATAR = 116;
// Скільки пікселів протягнути вниз, щоб аватар розкрився на повний розмір.
const PULL_DISTANCE = 220;
// Висота розкритого фото (як у Telegram — майже на пів екрана), обмежена шириною.
const FULL_HEIGHT_RATIO = 0.6;
const SPRING = { damping: 22, stiffness: 210, mass: 0.9 } as const;

/** Змішує два кольори #RRGGBB: t = 0 → a, t = 1 → b. */
function mix(a: string, b: string, t: number): string {
  const pa = a.replace("#", "");
  const pb = b.replace("#", "");
  if (pa.length !== 6 || pb.length !== 6) return a;
  const ch = (i: number) => {
    const x = parseInt(pa.slice(i, i + 2), 16);
    const y = parseInt(pb.slice(i, i + 2), 16);
    return Math.round(x + (y - x) * t);
  };
  return `rgb(${ch(0)}, ${ch(2)}, ${ch(4)})`;
}

interface Props {
  name: string;
  imageUrl?: string | null;
  /** Рядок під іменем («у мережі», «остання активність…»). */
  status?: string;
  /** Підсвітити статус акцентним кольором (онлайн). */
  statusAccent?: boolean;
  /** Показати спінер поверх аватара (завантаження фото). */
  busy?: boolean;
  rightIcon?: IconName;
  rightLabel?: string;
  onRightPress?: () => void;
  /** Без onBack кнопку «Назад» не показуємо (екран-вкладка). */
  onBack?: () => void;
  /** Накладка внизу екрана (панель вкладок) — рендериться всередині скляного контексту. */
  bottomOverlay?: ReactNode;
  /** Додатковий відступ знизу під панель вкладок. */
  bottomInset?: number;
  /** Вміст під шапкою (кнопки, картки). */
  children: ReactNode;
}

/**
 * Профіль у стилі Telegram: круглий аватар → потягніть вниз, і він розкривається у повнорозмірне
 * фото з іменем на градієнті; прокрутка вгору стискає шапку, а аватар «летить» у скляну панель.
 */
export function StretchyProfile({
  name,
  imageUrl,
  status,
  statusAccent,
  busy,
  rightIcon,
  rightLabel,
  onRightPress,
  onBack,
  bottomOverlay,
  bottomInset = 0,
  children,
}: Props) {
  const c = useChatPalette();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();

  const barBottom = insets.top + BAR_TOP_GAP + BAR_BUTTON;
  const barCenterY = insets.top + BAR_TOP_GAP + BAR_BUTTON / 2;
  const avatarTop = barBottom + 14;
  const nameTop = avatarTop + AVATAR + 12;
  const baseHeight = nameTop + 64;
  const collapsedHeight = barBottom + 8;
  const collapseDistance = baseHeight - collapsedHeight;
  const fullHeight = Math.round(Math.min(H * FULL_HEIGHT_RATIO, W * 1.3));
  const extra = Math.max(0, fullHeight - baseHeight);

  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [imageUrl]);
  const hasImage = !!imageUrl && !imageFailed;

  const scrollY = useSharedValue(0);
  const expand = useSharedValue(0);
  const startE = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const pulling = useSharedValue(false);

  const openViewer = useCallback(() => {
    if (imageUrl && !imageFailed) setViewerUrl(imageUrl);
  }, [imageFailed, imageUrl]);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
    // Прокрутка вгору згортає розкритий аватар.
    if (event.contentOffset.y > 4 && expand.value > 0 && !pulling.value) {
      expand.value = withTiming(0, { duration: 180 });
    }
  });

  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((e) => {
      const t = e.allTouches[0];
      if (!t) return;
      startX.value = t.x;
      startY.value = t.y;
      startE.value = expand.value;
      pulling.value = false;
    })
    .onTouchesMove((e, manager) => {
      const t = e.allTouches[0];
      if (!t) return;
      const dy = t.y - startY.value;
      const dx = Math.abs(t.x - startX.value);
      if (!pulling.value) {
        const vertical = Math.abs(dy) > dx;
        if (scrollY.value <= 0 && dy > 8 && vertical) {
          // Тягнемо вниз від верху — розкриваємо.
          pulling.value = true;
          manager.activate();
        } else if (startE.value > 0.02 && dy < -8 && vertical) {
          // Розкрите фото можна «закрити» свайпом угору.
          pulling.value = true;
          manager.activate();
        } else if (dy < -8 || dx > 16) {
          manager.fail();
        }
        return;
      }
      expand.value = Math.min(1, Math.max(0, startE.value + dy / PULL_DISTANCE));
    })
    .onTouchesUp((e) => {
      // Короткий тап по аватару відкриває перегляд фото.
      if (pulling.value) return;
      const t = e.changedTouches[0];
      if (!t) return;
      if (Math.abs(t.x - startX.value) > 10 || Math.abs(t.y - startY.value) > 10) return;
      if (scrollY.value > 4) return;
      const e1 = expand.value;
      const size = AVATAR + (W - AVATAR) * e1;
      const boxH = AVATAR + (fullHeight - AVATAR) * e1;
      const top = avatarTop * (1 - e1);
      const left = (W - size) / 2;
      if (t.x >= left && t.x <= left + size && t.y >= top && t.y <= top + boxH) {
        runOnJS(openViewer)();
      }
    })
    .onEnd((e) => {
      // Швидкий порух вирішує напрямок, інакше — за положенням (пів шляху).
      const open =
        e.velocityY > 600 ? true : e.velocityY < -600 ? false : expand.value > 0.45;
      expand.value = withSpring(open ? 1 : 0, { ...SPRING, velocity: e.velocityY / PULL_DISTANCE });
    })
    .onFinalize(() => {
      pulling.value = false;
    });

  const headerStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, scrollY.value / collapseDistance));
    const h = baseHeight + (collapsedHeight - baseHeight) * p;
    return { height: h + (fullHeight - h) * expand.value };
  });

  const gradientStyle = useAnimatedStyle(() => ({ opacity: expand.value }));

  const avatarStyle = useAnimatedStyle(() => {
    const e = expand.value;
    const p = Math.min(1, Math.max(0, scrollY.value / collapseDistance));
    const size = AVATAR + (W - AVATAR) * e;
    return {
      width: size,
      height: AVATAR + (fullHeight - AVATAR) * e,
      borderRadius: (AVATAR / 2) * (1 - e),
      top: avatarTop * (1 - e),
      left: (W - size) / 2,
      opacity: 1 - interpolate(p, [0.75, 1], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: -p * (avatarTop + AVATAR / 2 - barCenterY) },
        { scale: 1 - 0.72 * p },
      ],
    };
  });

  const initialsStyle = useAnimatedStyle(() => {
    const size = AVATAR + (Math.min(W, fullHeight) - AVATAR) * expand.value;
    return { fontSize: size * 0.36 };
  });

  const nameBlockStyle = useAnimatedStyle(() => {
    const e = expand.value;
    const p = Math.min(1, Math.max(0, scrollY.value / collapseDistance));
    return {
      top: nameTop + (fullHeight - 84 - nameTop) * e,
      opacity: 1 - interpolate(p, [0, 0.45], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: -p * 40 }],
    };
  });


  // На світлій/кольоровій обкладинці — кольори теми; у розкритому стані (поверх фото) — білі.
  const nameColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(expand.value, [0, 1], [c.text, "#FFFFFF"]),
  }));
  const statusColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      expand.value,
      [0, 1],
      [statusAccent ? c.accent : c.muted, "rgba(255,255,255,0.88)"],
    ),
  }));

  const scrollViewStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: extra * expand.value }],
  }));

  const barTitleStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, scrollY.value / collapseDistance));
    return { opacity: interpolate(p, [0.7, 1], [0, 1], Extrapolation.CLAMP) };
  });

  // Кнопки й капсула над обкладинкою — суцільні напівпрозорі круглі поверхні (без розмиття):
  // розмиття знімало б градієнт обкладинки під кнопкою й давало квадратну пляму на Android.
  const barSurface = {
    backgroundColor: withAlpha(c.header, 0.9),
    borderWidth: 1,
    borderColor: withAlpha(c.muted, 0.22),
    overflow: "hidden" as const,
  };
  const barButton = (icon: IconName, label: string, onPress: () => void) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        barSurface,
        {
          width: BAR_BUTTON,
          height: BAR_BUTTON,
          borderRadius: BAR_BUTTON / 2,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={c.text} />
    </TouchableOpacity>
  );

  const coverColor = avatarColor(name || "?");

  return (
    <GlassProvider>
      <GestureDetector gesture={pan}>
        <View style={{ flex: 1, backgroundColor: c.divider }}>
          <GlassTarget style={{ flex: 1, backgroundColor: c.divider }}>
            <Animated.ScrollView
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              bounces={false}
              overScrollMode="never"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={scrollViewStyle}
              contentContainerStyle={{
                paddingTop: baseHeight,
                paddingBottom: extra + insets.bottom + 28 + bottomInset,
              }}
            >
              {children}
            </Animated.ScrollView>

            {/* Шапка: тло, аватар, ім'я. Дотики проходять крізь неї до списку. */}
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  overflow: "hidden",
                  backgroundColor: c.divider,
                  // Шапка (обкладинка, аватар, ім'я) — над списком, але під плаваючою панеллю (zIndex 30).
                  zIndex: 1,
                },
                headerStyle,
              ]}
            >
              {/* Обкладинка: рівний колір теми з ледь помітним відтінком кольору аватара */}
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
                  <Defs>
                    <LinearGradient id="profileCover" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={mix(c.header, coverColor, 0.34)} stopOpacity="1" />
                      <Stop offset="1" stopColor={mix(c.header, coverColor, 0.14)} stopOpacity="1" />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="1" height="1" fill="url(#profileCover)" />
                </Svg>
              </View>

              <Animated.View
                style={[
                  {
                    position: "absolute",
                    overflow: "hidden",
                    backgroundColor: avatarColor(name || "?"),
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  avatarStyle,
                ]}
              >
                {hasImage ? (
                  <Image
                    source={{ uri: imageUrl! }}
                    resizeMode="cover"
                    onError={() => setImageFailed(true)}
                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                  />
                ) : (
                  <Animated.Text style={[{ color: "#FFFFFF", fontWeight: "700" }, initialsStyle]}>
                    {initialsOf(name)}
                  </Animated.Text>
                )}
                {busy && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0,0,0,0.45)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ActivityIndicator color="#FFFFFF" size="large" />
                  </View>
                )}
              </Animated.View>

              {/* Градієнт під іменем у розкритому стані */}
              <Animated.View
                style={[
                  { position: "absolute", left: 0, right: 0, top: fullHeight - 170, height: 170 },
                  gradientStyle,
                ]}
              >
                <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
                  <Defs>
                    <LinearGradient id="profileFade" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#000000" stopOpacity="0" />
                      <Stop offset="1" stopColor="#000000" stopOpacity="0.72" />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="1" height="1" fill="url(#profileFade)" />
                </Svg>
              </Animated.View>

              <Animated.View
                style={[
                  { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: 24 },
                  nameBlockStyle,
                ]}
              >
                <Animated.Text
                  numberOfLines={1}
                  style={[{ fontSize: 25, fontWeight: "800", textAlign: "center" }, nameColorStyle]}
                >
                  {name}
                </Animated.Text>
                {status ? (
                  <Animated.Text
                    numberOfLines={1}
                    style={[{ fontSize: 14, marginTop: 4, textAlign: "center" }, statusColorStyle]}
                  >
                    {status}
                  </Animated.Text>
                ) : null}
              </Animated.View>
            </Animated.View>
          </GlassTarget>

          {/* Плаваюча скляна панель */}
          <View
            pointerEvents="box-none"
            style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30 }}
          >
            <View
              pointerEvents="box-none"
              style={{
                marginTop: insets.top + BAR_TOP_GAP,
                marginHorizontal: BAR_SIDE_MARGIN,
                height: BAR_BUTTON,
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              {onBack ? barButton("arrow-back", "Назад", onBack) : <View style={{ width: BAR_BUTTON }} />}

              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: "absolute",
                    left: BAR_BUTTON + 10,
                    right: BAR_BUTTON + 10,
                    top: 0,
                    height: BAR_BUTTON,
                  },
                  barTitleStyle,
                ]}
              >
                <View
                  style={[
                    barSurface,
                    {
                      height: BAR_BUTTON,
                      borderRadius: BAR_BUTTON / 2,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 12,
                    },
                  ]}
                >
                  <RoomAvatar title={name} imageUrl={imageUrl} size={28} />
                  <Text
                    numberOfLines={1}
                    style={{ color: c.text, fontSize: 16, fontWeight: "700", marginLeft: 8, flexShrink: 1 }}
                  >
                    {name}
                  </Text>
                </View>
              </Animated.View>

              {rightIcon && onRightPress ? (
                barButton(rightIcon, rightLabel ?? "Дія", onRightPress)
              ) : (
                <View style={{ width: BAR_BUTTON }} />
              )}
            </View>
          </View>

          {bottomOverlay}

          <ImageViewerModal
            visible={!!viewerUrl}
            imageUrl={viewerUrl}
            onClose={() => setViewerUrl(null)}
          />
        </View>
      </GestureDetector>
    </GlassProvider>
  );
}
