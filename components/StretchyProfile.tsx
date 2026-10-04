import { AnimatedAvatarVideo } from "@/components/AnimatedAvatarVideo";
import { NameBadges } from "@/components/PremiumBadge";
import { GlassProvider, GlassTarget } from "@/components/Glass";
import { PressableScale } from "@/components/PressableScale";
import { MediaViewer, type ViewerAction, type ViewerItem } from "@/components/MediaViewer";
import { Image as ExpoImage } from "expo-image";
import { RoomAvatar } from "@/components/RoomAvatar";
import { avatarColor, initialsOf } from "@/constants/theme";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Children, ComponentProps, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  FadeInDown,
  interpolate,
  interpolateColor,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

type IconName = ComponentProps<typeof Ionicons>["name"];

const AnimatedExpoImage = Animated.createAnimatedComponent(ExpoImage);

const BAR_TOP_GAP = 6;
const BAR_BUTTON = 44;
const BAR_SIDE_MARGIN = 12;
const AVATAR = 116;
// Скільки пікселів протягнути вниз, щоб аватар розкрився на повний розмір.
const PULL_DISTANCE = 220;
// Висота розкритого фото (як у Telegram — майже на пів екрана), обмежена шириною.
const FULL_HEIGHT_RATIO = 0.6;
// Висота кнопок дій і відступ між шапкою та рядом кнопок у згорнутому стані.
const ACTION_H = 74;
/** Відступ між статусом під іменем і рядом кнопок дій. */
const PILLS_GAP = 10;
const SPRING = { damping: 22, stiffness: 210, mass: 0.9, overshootClamping: true } as const;

/** Прогрес розкриття завжди в 0..1: пружина/жест не можуть вивести шапку, скрім і список із синхронізації. */
function c01(v: number) {
  "worklet";
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

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

export interface ProfileAction {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}

/** Кнопка дії: у згорнутому стані — картка теми, у розкритому — темна напівпрозора «пілюля» поверх фото. */
function ActionPill({
  item,
  expand,
  index,
}: {
  item: ProfileAction;
  expand: SharedValue<number>;
  index: number;
}) {
  const c = useChatPalette();
  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      c01(expand.value),
      [0, 1],
      [c.header, "rgba(0, 0, 0, 0.4)"],
    ),
  }));
  const accentLayer = useAnimatedStyle(() => ({ opacity: 1 - c01(expand.value) }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: c01(expand.value) }));
  return (
    <Animated.View
      entering={FadeInDown.delay(120 + index * 70).duration(360)}
      style={{ flex: 1, marginHorizontal: 4 }}
    >
      <PressableScale
        onPress={item.onPress}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        innerStyle={[
          {
            height: ACTION_H,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          },
          bgStyle,
        ]}
      >
        <View style={{ width: 24, height: 24 }}>
          <Animated.View style={[{ position: "absolute", top: 0, left: 0 }, accentLayer]}>
            <Ionicons name={item.icon} size={24} color={c.accent} />
          </Animated.View>
          <Animated.View style={[{ position: "absolute", top: 0, left: 0 }, whiteLayer]}>
            <Ionicons name={item.icon} size={24} color="#FFFFFF" />
          </Animated.View>
        </View>
        <View style={{ marginTop: 6, alignSelf: "stretch", paddingHorizontal: 4 }}>
          <Animated.Text
            numberOfLines={1}
            style={[{ fontSize: 12, fontWeight: "600", textAlign: "center", color: c.accent }, accentLayer]}
          >
            {item.label}
          </Animated.Text>
          <Animated.Text
            numberOfLines={1}
            style={[
              {
                position: "absolute",
                left: 4,
                right: 4,
                fontSize: 12,
                fontWeight: "600",
                textAlign: "center",
                color: "#FFFFFF",
              },
              whiteLayer,
            ]}
          >
            {item.label}
          </Animated.Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

/** Кругла кнопка верхньої панелі: тема → темна напівпрозора з білою іконкою при розкритому фото. */
function BarIconButton({
  icon,
  label,
  onPress,
  expand,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  expand: SharedValue<number>;
}) {
  const c = useChatPalette();
  // Кольори рахуємо на JS-потоці: withAlpha — звичайна функція, її не можна викликати у воркліті.
  const idleBg = withAlpha(c.header, 0.9);
  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      c01(expand.value),
      [0, 1],
      [idleBg, "rgba(0, 0, 0, 0.38)"],
    ),
  }));
  const accentLayer = useAnimatedStyle(() => ({ opacity: 1 - c01(expand.value) }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: c01(expand.value) }));
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={label}
      innerStyle={[
        {
          width: BAR_BUTTON,
          height: BAR_BUTTON,
          borderRadius: BAR_BUTTON / 2,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderWidth: 1,
          borderColor: withAlpha(c.muted, 0.22),
        },
        bgStyle,
      ]}
    >
      <View style={{ width: 22, height: 22 }}>
        <Animated.View style={[{ position: "absolute", top: 0, left: 0 }, accentLayer]}>
          <Ionicons name={icon} size={22} color={c.text} />
        </Animated.View>
        <Animated.View style={[{ position: "absolute", top: 0, left: 0 }, whiteLayer]}>
          <Ionicons name={icon} size={22} color="#FFFFFF" />
        </Animated.View>
      </View>
    </PressableScale>
  );
}

export interface ProfilePhoto {
  id: string;
  url: string;
  createdAt?: number;
}

/** Одна сторінка каруселі фото в шапці: позиція за індексом, зсув пальцем, паралакс при прокрутці. */
function HeroPage({
  url,
  i,
  W,
  indexSV,
  pageDrag,
  expand,
  scrollY,
  collapseDistance,
}: {
  url: string;
  i: number;
  W: number;
  indexSV: SharedValue<number>;
  pageDrag: SharedValue<number>;
  expand: SharedValue<number>;
  scrollY: SharedValue<number>;
  collapseDistance: number;
}) {
  const style = useAnimatedStyle(() => {
    const size = AVATAR + (W - AVATAR) * c01(expand.value);
    // Видно лише поточне фото; сусідні з'являються тільки під час гортання повністю розкритої шапки
    // (інакше збільшений на 14% сусід виглядає з-під краю кружечка).
    const current = Math.round(indexSV.value) === i;
    const swiping = c01(expand.value) > 0.98 && Math.abs(pageDrag.value) > 0.5;
    return {
      opacity: current || swiping ? 1 : 0,
      transform: [
        { translateX: (i - indexSV.value) * size + pageDrag.value },
        { scale: 1.14 - 0.14 * c01(expand.value) },
        { translateY: -Math.min(scrollY.value, collapseDistance) * 0.12 },
      ],
    };
  });
  return (
    <AnimatedExpoImage
      source={{ uri: url }}
      contentFit="cover"
      transition={180}
      cachePolicy="memory-disk"
      recyclingKey={url}
      style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, style]}
    />
  );
}

/** Сегменти зверху розкритого фото (як у Telegram): активний яскравий, решта приглушені. */
function Segment({ i, indexSV }: { i: number; indexSV: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: Math.round(indexSV.value) === i ? 1 : 0.38 }));
  return (
    <Animated.View
      style={[{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "#FFFFFF", marginHorizontal: 2 }, style]}
    />
  );
}

interface Props {
  name: string;
  /** Modesto Premium: золота зірка й емодзі-статус поруч з іменем. */
  isPremium?: boolean;
  emojiStatus?: string;
  /** Анімований аватар (лише premium): відео/GIF поверх головного фото, яке лишається постером. */
  avatarAnimUrl?: string;
  avatarAnimKind?: "video" | "gif";
  imageUrl?: string | null;
  /** Усі фото профілю (поточне першим); якщо не задано — використовується imageUrl. */
  photos?: ProfilePhoto[];
  /** Додаткові пункти меню ⋮ у повноекранному перегляді (для власного профілю). */
  viewerActions?: ViewerAction[];
  /** Запит відкрити повноекранний перегляд на фото №index (зі «Сітки фото»); новий key = новий запит. */
  openViewerRequest?: { index: number; key: number } | null;
  /** Вимкнути жести шапки (поки поверх екрана відкритий оверлей). */
  lockGestures?: boolean;
  /** Ліва кнопка шапки, коли немає «Назад» (на вкладці). */
  leftIcon?: IconName;
  leftLabel?: string;
  onLeftPress?: () => void;
  /** Рядок під іменем («у мережі», «остання активність…»). */
  status?: string;
  /** Підсвітити статус акцентним кольором (онлайн). */
  statusAccent?: boolean;
  /** Показати спінер поверх аватара (завантаження фото). */
  busy?: boolean;
  /** Кнопки дій: під шапкою, а при розкритому фото — поверх його низу. */
  actions?: ProfileAction[];
  rightIcon?: IconName;
  rightLabel?: string;
  onRightPress?: () => void;
  /** Без onBack кнопку «Назад» не показуємо (екран-вкладка). */
  onBack?: () => void;
  /** Плаваюча дія (наприклад, «Додати фото»): ховається, поки шапка розкрита, щоб не накривати вміст. */
  floatingAction?: ReactNode;
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
  isPremium,
  emojiStatus,
  avatarAnimUrl,
  avatarAnimKind,
  imageUrl,
  photos,
  viewerActions,
  openViewerRequest,
  lockGestures,
  leftIcon,
  leftLabel,
  onLeftPress,
  status,
  statusAccent,
  busy,
  actions,
  rightIcon,
  rightLabel,
  onRightPress,
  onBack,
  floatingAction,
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
  const hasActions = (actions?.length ?? 0) > 0;
  // Місце під кнопки дій у списку (у згорнутому стані вони лежать саме тут).
  const spacerH = hasActions ? ACTION_H + PILLS_GAP + 4 : 0;
  const pillsTopCollapsed = baseHeight + PILLS_GAP;
  const pillsTopExpanded = fullHeight - 14 - ACTION_H;
  const pillsDelta = pillsTopExpanded - pillsTopCollapsed;
  // Список під розкритим фото починається одразу під ним.
  const shift = Math.max(0, fullHeight + 8 - (baseHeight + spacerH));
  const expandedNameTop = hasActions ? pillsTopExpanded - 14 - 58 : fullHeight - 84;

  // Список фото: історія профілю або єдине поточне.
  const list = useMemo<ProfilePhoto[]>(() => {
    if (photos && photos.length > 0) return photos;
    return imageUrl ? [{ id: "main", url: imageUrl }] : [];
  }, [photos, imageUrl]);
  const count = list.length;
  const [viewerOpen, setViewerOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const indexSV = useSharedValue(0);
  const pageDrag = useSharedValue(0);
  const paging = useSharedValue(false);

  // Нове головне фото (або змінився склад) — починаємо з першого.
  const firstId = list[0]?.id;
  useEffect(() => {
    setPhotoIndex(0);
    indexSV.value = 0;
    pageDrag.value = 0;
  }, [firstId, indexSV, pageDrag]);
  const lastRequestKey = useRef(0);
  useEffect(() => {
    if (!openViewerRequest || openViewerRequest.key === lastRequestKey.current) return;
    lastRequestKey.current = openViewerRequest.key;
    setPhotoIndex(openViewerRequest.index);
    setViewerOpen(true);
  }, [openViewerRequest]);
  const safeIndex = Math.min(photoIndex, Math.max(0, count - 1));
  useEffect(() => {
    indexSV.value = safeIndex;
  }, [safeIndex, indexSV]);

  // Підвантажуємо сусідні фото наперед, щоб гортання не блимало.
  useEffect(() => {
    const urls = [list[safeIndex - 1]?.url, list[safeIndex + 1]?.url, list[0]?.url].filter(
      (u): u is string => !!u,
    );
    if (urls.length) void ExpoImage.prefetch(urls, "memory-disk");
  }, [list, safeIndex]);

  const viewerItems = useMemo<ViewerItem[]>(
    () => list.map((p) => ({ id: p.id, kind: "image", url: p.url, senderName: name, createdAt: p.createdAt })),
    [list, name],
  );
  const hasImage = count > 0;

  const scrollY = useSharedValue(0);
  const expand = useSharedValue(0);
  const startE = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const pulling = useSharedValue(false);
  const crossed = useSharedValue(false);
  const [pillsLive, setPillsLive] = useState(true);
  // Поки шапка розкрита, список не прокручується: вертикальний рух належить жесту (згортання свайпом угору).
  const [scrollLocked, setScrollLocked] = useState(false);
  useAnimatedReaction(
    () => c01(expand.value) > 0.02,
    (locked, prev) => {
      if (locked !== prev) runOnJS(setScrollLocked)(locked);
    },
  );

  const tick = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Кнопки, що вже сховались при прокрутці, не повинні ловити дотики.
  useAnimatedReaction(
    () => scrollY.value > collapseDistance * 0.9,
    (hidden, prev) => {
      if (hidden !== prev) runOnJS(setPillsLive)(!hidden);
    },
    [collapseDistance],
  );

  // Щойно натиснута кнопка (пілюля дії / кнопка шапки): дотик на ній не має відкривати перегляд фото.
  const lastActionAt = useRef(0);
  const viewerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (viewerTimer.current) clearTimeout(viewerTimer.current);
    },
    [],
  );
  const guardAction = useCallback((fn: () => void) => {
    return () => {
      lastActionAt.current = Date.now();
      if (viewerTimer.current) clearTimeout(viewerTimer.current);
      setViewerOpen(false);
      fn();
    };
  }, []);

  const openViewer = useCallback(() => {
    if (count === 0) return;
    const at = Date.now();
    if (viewerTimer.current) clearTimeout(viewerTimer.current);
    // Невелика затримка: якщо в цей самий момент спрацює кнопка, перегляд не відкриваємо.
    viewerTimer.current = setTimeout(() => {
      viewerTimer.current = null;
      if (lastActionAt.current > at - 400) return;
      setViewerOpen(true);
    }, 90);
  }, [count]);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    // Від'ємний зсув (овер-скрол) не використовуємо: шапка, кнопки й скрім рухаються лише від 0.
    scrollY.value = Math.max(0, event.contentOffset.y);
    // Прокрутка вгору згортає розкритий аватар.
    if (event.contentOffset.y > 4 && c01(expand.value) > 0 && !pulling.value) {
      expand.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    }
  });

  const pan = Gesture.Pan()
    .enabled(!lockGestures)
    .manualActivation(true)
    .onTouchesDown((e) => {
      const t = e.allTouches[0];
      if (!t) return;
      startX.value = t.x;
      startY.value = t.y;
      startE.value = c01(expand.value);
      crossed.value = c01(expand.value) > 0.45;
      pulling.value = false;
      paging.value = false;
      pageDrag.value = 0;
    })
    .onTouchesMove((e, manager) => {
      const t = e.allTouches[0];
      if (!t) return;
      const dy = t.y - startY.value;
      const dx = Math.abs(t.x - startX.value);
      if (paging.value) {
        // Гортання фото в розкритій шапці: рух пальця напряму, на краях — з опором.
        const raw = t.x - startX.value;
        const atEdge =
          (indexSV.value <= 0 && raw > 0) || (indexSV.value >= count - 1 && raw < 0);
        pageDrag.value = atEdge ? raw * 0.3 : raw;
        return;
      }
      if (!pulling.value) {
        const vertical = Math.abs(dy) > dx;
        if (
          count > 1 &&
          startE.value > 0.9 &&
          c01(expand.value) > 0.9 &&
          startY.value < fullHeight &&
          dx > 12 &&
          !vertical
        ) {
          paging.value = true;
          pulling.value = true;
          manager.activate();
          return;
        }
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
      // Тактильний «клік», коли перетнули поріг прилипання.
      const past = c01(expand.value) > 0.45;
      if (past !== crossed.value) {
        crossed.value = past;
        runOnJS(tick)();
      }
    })
    .onTouchesUp((e) => {
      // Короткий тап по аватару відкриває перегляд фото.
      if (pulling.value) return;
      const t = e.changedTouches[0];
      if (!t) return;
      if (Math.abs(t.x - startX.value) > 10 || Math.abs(t.y - startY.value) > 10) return;
      if (scrollY.value > 4) return;
      const e1 = c01(expand.value);
      const size = AVATAR + (W - AVATAR) * e1;
      const boxH = AVATAR + (fullHeight - AVATAR) * e1;
      const top = avatarTop * (1 - e1);
      const left = (W - size) / 2;
      // Кнопки в шапці й пілюлі дій лежать поверх розкритого фото — дотики по них не відкривають фото.
      if (t.y < barBottom + 4) return;
      if (hasActions) {
        const pillsTop = pillsTopCollapsed + pillsDelta * e1;
        if (t.y >= pillsTop - 6 && t.y <= pillsTop + ACTION_H + 6) return;
      }
      if (t.x >= left && t.x <= left + size && t.y >= top && t.y <= top + boxH) {
        runOnJS(openViewer)();
      }
    })
    .onEnd((e) => {
      if (paging.value) {
        const drag = pageDrag.value;
        const dir = drag < -W * 0.2 || e.velocityX < -600 ? 1 : drag > W * 0.2 || e.velocityX > 600 ? -1 : 0;
        const next = indexSV.value + dir;
        if (dir !== 0 && next >= 0 && next < count) {
          pageDrag.value = withTiming(-dir * W, { duration: 200, easing: Easing.out(Easing.cubic) }, (done) => {
            if (done) {
              indexSV.value = next;
              pageDrag.value = 0;
              runOnJS(setPhotoIndex)(next);
            }
          });
        } else {
          pageDrag.value = withSpring(0, SPRING);
        }
        return;
      }
      // Швидкий порух вирішує напрямок, інакше — за положенням (пів шляху).
      const moved = c01(expand.value) - startE.value;
      const open =
        e.velocityY > 600
          ? true
          : e.velocityY < -600
            ? false
            : moved > 0.15
              ? true
              : moved < -0.15
                ? false
                : startE.value > 0.5;
      expand.value = withSpring(open ? 1 : 0, { ...SPRING, velocity: e.velocityY / PULL_DISTANCE });
    })
    .onFinalize((_e, success) => {
      // Жест скасовано системою (наприклад, перехопив скрол) — докручуємо шапку до найближчого стану.
      if (!success && pulling.value && !paging.value) {
        expand.value = withSpring(c01(expand.value) > 0.45 ? 1 : 0, SPRING);
      }
      if (!success && paging.value) pageDrag.value = withSpring(0, SPRING);
      pulling.value = false;
      paging.value = false;
    });

  const headerStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, scrollY.value / collapseDistance));
    const h = baseHeight + (collapsedHeight - baseHeight) * p;
    return { height: h + (fullHeight - h) * c01(expand.value) };
  });

  const floatingStyle = useAnimatedStyle(() => ({ opacity: 1 - c01(expand.value) }));

  const gradientStyle = useAnimatedStyle(() => ({ opacity: c01(expand.value) }));

  const avatarStyle = useAnimatedStyle(() => {
    const e = c01(expand.value);
    const p = Math.min(1, Math.max(0, scrollY.value / collapseDistance));
    const size = AVATAR + (W - AVATAR) * e;
    return {
      width: size,
      height: AVATAR + (fullHeight - AVATAR) * e,
      borderTopLeftRadius: (AVATAR / 2) * (1 - e),
      borderTopRightRadius: (AVATAR / 2) * (1 - e),
      borderBottomLeftRadius: (AVATAR / 2) * (1 - e) + 28 * e,
      borderBottomRightRadius: (AVATAR / 2) * (1 - e) + 28 * e,
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
    const size = AVATAR + (Math.min(W, fullHeight) - AVATAR) * c01(expand.value);
    return { fontSize: size * 0.36 };
  });

  // Ім'я під круглим аватаром: зникає, коли фото розкривається, і при прокрутці.
  const nameBlockStyle = useAnimatedStyle(() => {
    const e = c01(expand.value);
    const p = Math.min(1, Math.max(0, scrollY.value / collapseDistance));
    return {
      opacity:
        (1 - interpolate(p, [0, 0.45], [0, 1], Extrapolation.CLAMP)) *
        (1 - interpolate(e, [0, 0.5], [0, 1], Extrapolation.CLAMP)),
      transform: [{ translateY: -p * 40 + e * 16 }],
    };
  });

  // Ім'я знизу-зліва на фото: випливає й трохи збільшується разом з розкриттям.
  const expandedNameStyle = useAnimatedStyle(() => {
    const e = c01(expand.value);
    return {
      opacity: interpolate(e, [0.4, 1], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: (1 - e) * 18 }, { scale: 0.9 + 0.1 * e }],
    };
  });

  // Кнопки дій їдуть із шапкою: вниз на фото при розкритті, вгору й зникають при прокрутці.
  const pillsLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [collapseDistance * 0.45, collapseDistance * 0.9],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [{ translateY: pillsDelta * c01(expand.value) - scrollY.value }],
  }));

  // Обкладинка зсувається вдвічі повільніше за прокрутку (паралакс).
  const coverStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(scrollY.value, collapseDistance) * 0.25 }],
  }));

  const scrollViewStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: shift * c01(expand.value) }],
  }));

  const barTitleStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, scrollY.value / collapseDistance));
    const t = interpolate(p, [0.7, 1], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: t * (1 - c01(expand.value)),
      transform: [{ translateY: (1 - t) * 8 }, { scale: 0.94 + 0.06 * t }],
    };
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
    <BarIconButton icon={icon} label={label} onPress={guardAction(onPress)} expand={expand} />
  );

  const coverColor = avatarColor(name || "?");

  return (
    <GlassProvider>
      <View style={{ flex: 1, backgroundColor: c.divider }}>
      <GestureDetector gesture={pan}>
        <View style={{ flex: 1, backgroundColor: c.divider }}>
          <GlassTarget style={{ flex: 1, backgroundColor: c.divider }}>
            <Animated.ScrollView
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              bounces={false}
              scrollEnabled={!scrollLocked}
              overScrollMode="never"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={scrollViewStyle}
              contentContainerStyle={{
                paddingTop: baseHeight,
                paddingBottom: shift + insets.bottom + 28 + bottomInset,
              }}
            >
              {hasActions ? <View style={{ height: spacerH }} /> : null}
              {Children.toArray(children).map((child, index) => (
                <Animated.View
                  key={index}
                  entering={FadeInDown.delay(180 + Math.min(index, 5) * 80)
                    .duration(420)
                    .easing(Easing.out(Easing.cubic))}
                >
                  {child}
                </Animated.View>
              ))}
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
              <Animated.View
                style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: -80 }, coverStyle]}
              >
                <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
                  <Defs>
                    <LinearGradient id="profileCover" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={mix(c.header, coverColor, 0.34)} stopOpacity="1" />
                      <Stop offset="1" stopColor={mix(c.header, coverColor, 0.14)} stopOpacity="1" />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="1" height="1" fill="url(#profileCover)" />
                </Svg>
              </Animated.View>

              <Animated.View
                style={[
                  {
                    position: "absolute",
                    overflow: "hidden",
                    // Під фото — колір теми (не чорний і не колір аватара); контейнер скруглений і обрізає все, що всередині.
                    backgroundColor: hasImage ? c.header : avatarColor(name || "?"),
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  avatarStyle,
                ]}
              >
                {hasImage ? (
                  <>
                    {[safeIndex - 1, safeIndex, safeIndex + 1]
                      .filter((i) => i >= 0 && i < count)
                      .map((i) => (
                        <HeroPage
                          key={list[i].id}
                          url={list[i].url}
                          i={i}
                          W={W}
                          indexSV={indexSV}
                          pageDrag={pageDrag}
                          expand={expand}
                          scrollY={scrollY}
                          collapseDistance={collapseDistance}
                        />
                      ))}
                  </>
                ) : (
                  <>
                    {/* Запасний градієнт, коли немає фото (колір з імені) */}
                    <Svg
                      width="100%"
                      height="100%"
                      viewBox="0 0 1 1"
                      preserveAspectRatio="none"
                      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                    >
                      <Defs>
                        <LinearGradient id="avatarFallback" x1="0" y1="0" x2="1" y2="1">
                          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.22" />
                          <Stop offset="1" stopColor="#000000" stopOpacity="0.28" />
                        </LinearGradient>
                      </Defs>
                      <Rect x="0" y="0" width="1" height="1" fill="url(#avatarFallback)" />
                    </Svg>
                    <Animated.Text style={[{ color: "#FFFFFF", fontWeight: "700" }, initialsStyle]}>
                      {initialsOf(name)}
                    </Animated.Text>
                  </>
                )}
                {hasImage && avatarAnimUrl && avatarAnimKind ? (
                  <AnimatedAvatarVideo url={avatarAnimUrl} kind={avatarAnimKind} visible={safeIndex === 0} />
                ) : null}
                {/* Скрім під іменем: усередині того ж скругленого контейнера, тож кути фото не чорніють */}
                <Animated.View
                  pointerEvents="none"
                  style={[{ position: "absolute", left: 0, right: 0, bottom: 0, height: 260 }, gradientStyle]}
                >
                  <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
                    <Defs>
                      <LinearGradient id="profileFade" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#000000" stopOpacity="0" />
                        <Stop offset="0.55" stopColor="#000000" stopOpacity="0.32" />
                        <Stop offset="1" stopColor="#000000" stopOpacity="0.78" />
                      </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="1" height="1" fill="url(#profileFade)" />
                  </Svg>
                </Animated.View>
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

              {/* Сегменти-індикатор фото зверху розкритого фото */}
              {count > 1 ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: "absolute",
                      top: insets.top + 1,
                      left: 10,
                      right: 10,
                      flexDirection: "row",
                    },
                    gradientStyle,
                  ]}
                >
                  {list.map((p, i) => (
                    <Segment key={p.id} i={i} indexSV={indexSV} />
                  ))}
                </Animated.View>
              ) : null}

              {/* Ім'я та статус під круглим аватаром (згорнутий стан) */}
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    top: nameTop,
                    left: 0,
                    right: 0,
                    alignItems: "center",
                    paddingHorizontal: 24,
                  },
                  nameBlockStyle,
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", maxWidth: "100%" }}>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 25, fontWeight: "800", textAlign: "center", color: c.text, flexShrink: 1 }}
                  >
                    {name}
                  </Text>
                  <NameBadges premium={isPremium} emoji={emojiStatus} size={20} />
                </View>
                {status ? (
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 14,
                      marginTop: 4,
                      textAlign: "center",
                      color: statusAccent ? c.accent : c.muted,
                    }}
                  >
                    {status}
                  </Text>
                ) : null}
              </Animated.View>

              {/* Ім'я та статус знизу-зліва над градієнтом (розкрите фото) */}
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: "absolute",
                    top: expandedNameTop,
                    left: 20,
                    right: 20,
                    transformOrigin: "left bottom",
                  },
                  expandedNameStyle,
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text numberOfLines={1} style={{ fontSize: 26, fontWeight: "800", color: "#FFFFFF", flexShrink: 1 }}>
                    {name}
                  </Text>
                  <NameBadges premium={isPremium} emoji={emojiStatus} size={20} />
                </View>
                {status ? (
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 14, marginTop: 3, color: "rgba(255, 255, 255, 0.88)" }}
                  >
                    {status}
                  </Text>
                ) : null}
              </Animated.View>
            </Animated.View>

            {/* Кнопки дій: їдуть разом із шапкою; поверх фото — темні напівпрозорі «пілюлі» */}
            {hasActions ? (
              <Animated.View
                pointerEvents={pillsLive ? "box-none" : "none"}
                style={[
                  {
                    position: "absolute",
                    top: pillsTopCollapsed,
                    left: 0,
                    right: 0,
                    zIndex: 2,
                    flexDirection: "row",
                    paddingHorizontal: 8,
                  },
                  pillsLayerStyle,
                ]}
              >
                {actions!.map((item, index) => (
                  <ActionPill
                    key={item.key}
                    item={{ ...item, onPress: guardAction(item.onPress) }}
                    expand={expand}
                    index={index}
                  />
                ))}
              </Animated.View>
            ) : null}
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
              {onBack ? (
                barButton("arrow-back", "Назад", onBack)
              ) : leftIcon && onLeftPress ? (
                barButton(leftIcon, leftLabel ?? "Дія", onLeftPress)
              ) : (
                <View style={{ width: BAR_BUTTON }} />
              )}

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
                  <NameBadges premium={isPremium} emoji={emojiStatus} size={13} />
                </View>
              </Animated.View>

              {rightIcon && onRightPress ? (
                barButton(rightIcon, rightLabel ?? "Дія", onRightPress)
              ) : (
                <View style={{ width: BAR_BUTTON }} />
              )}
            </View>
          </View>

          {floatingAction ? (
            <Animated.View
              pointerEvents={scrollLocked ? "none" : "box-none"}
              style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, floatingStyle]}
            >
              {floatingAction}
            </Animated.View>
          ) : null}

          <MediaViewer
            visible={viewerOpen}
            items={viewerItems}
            initialIndex={safeIndex}
            variant="profile"
            onIndexChange={setPhotoIndex}
            extraActions={viewerActions}
            onClose={() => setViewerOpen(false)}
          />
        </View>
      </GestureDetector>
      {/* Оверлеї (таб-бар, QR) поза зоною жестів профілю: його Pan не перехоплює їхні дотики */}
      {bottomOverlay}
      </View>
    </GlassProvider>
  );
}
