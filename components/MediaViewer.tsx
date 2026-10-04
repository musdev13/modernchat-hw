import { saveMedia, shareMedia } from "@/utils/mediaSave";
import { dayLabel, formatTime } from "@/utils/chat";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage, type ImageProps } from "expo-image";
import { useVideoPlayer, VideoView, type VideoPlayer } from "expo-video";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type MutableRefObject } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ZoomIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

export interface ViewerItem {
  id: string;
  kind: "image" | "video";
  url: string;
  senderName?: string;
  createdAt?: number;
  /** Мініатюра відео: показується, доки не з'явиться перший кадр (без чорного спалаху). */
  poster?: ImageProps["source"];
  /** Відео крутиться по колу (анімований аватар). */
  loop?: boolean;
  fileName?: string;
}

export interface ViewerAction {
  key: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  destructive?: boolean;
  /** Закрити переглядач перед виконанням (щоб діалоги/модалки не накладались на нього). */
  closeFirst?: boolean;
  onPress: (item: ViewerItem, index: number) => void;
}

interface Props {
  visible: boolean;
  items: ViewerItem[];
  initialIndex?: number;
  onClose: () => void;
  /** Фото профілю: стрічка мініатюр знизу й перехід тапом по краях екрана. */
  variant?: "default" | "profile";
  /** Викликається при зміні поточного елемента (профіль синхронізує своє фото в шапці). */
  onIndexChange?: (index: number) => void;
  /** Додаткові пункти меню ⋮ (наприклад, «Зробити головним», «Видалити»). */
  extraActions?: ViewerAction[];
}

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const AUTO_HIDE_MS = 3000;
const SPEEDS = [0.5, 1, 1.5, 2];
const BAR_H = 52;

/** Обмеження зсуву при збільшенні: не виходимо за межі зображення. */
function clampT(v: number, s: number, size: number) {
  "worklet";
  const m = Math.max(0, ((s - 1) * size) / 2);
  return Math.min(m, Math.max(-m, v));
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m % 60).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Стан програвача (JS-потік): програє, час, тривалість, буферизація, кінець. */
function usePlayerState(
  player: VideoPlayer,
  active: boolean,
  progress: SharedValue<number>,
  buffered: SharedValue<number>,
  scrubbing: SharedValue<boolean>,
) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    setError(null);
    setPlaying(player.playing);
    setTime(0);
    setDuration(player.duration || 0);
    setLoading(true);
    setEnded(false);
    setMuted(player.muted);
    setRate(1);
    progress.value = 0;
    buffered.value = 0;
    const subs = [
      player.addListener("playingChange", (e) => {
        setPlaying(e.isPlaying);
        if (e.isPlaying) setEnded(false);
      }),
      player.addListener("timeUpdate", (e) => {
        setTime(e.currentTime);
        const d = player.duration;
        if (d > 0) {
          setDuration(d);
          if (!scrubbing.value) progress.value = Math.min(1, e.currentTime / d);
          const b = player.bufferedPosition;
          buffered.value = b > 0 ? Math.min(1, b / d) : 0;
        }
        setLoading(false);
      }),
      player.addListener("statusChange", (e) => {
        setLoading(e.status === "loading");
        if (e.status === "error") setError(e.error?.message ?? "error");
        else if (e.status === "readyToPlay") setError(null);
        if (player.duration > 0) setDuration(player.duration);
      }),
      player.addListener("sourceLoad", (e) => {
        if (e.duration > 0) setDuration(e.duration);
      }),
      player.addListener("playToEnd", () => {
        setEnded(true);
        setPlaying(false);
        progress.value = 1;
      }),
      player.addListener("mutedChange", (e) => setMuted(e.muted)),
      player.addListener("playbackRateChange", (e) => setRate(e.playbackRate)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [player, active, progress, buffered, scrubbing]);

  return { playing, time, duration, loading, ended, muted, rate, error };
}

/** Перемотка: смужка з ручкою, що тягнеться; тап по смужці — перехід до місця. */
function SeekBar({
  width,
  duration,
  progress,
  buffered,
  scrubbing,
  onSeek,
  onInteract,
}: {
  width: number;
  duration: number;
  progress: SharedValue<number>;
  buffered: SharedValue<number>;
  scrubbing: SharedValue<boolean>;
  onSeek: (fraction: number) => void;
  onInteract: () => void;
}) {
  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      scrubbing.value = true;
      progress.value = Math.min(1, Math.max(0, e.x / width));
      runOnJS(onInteract)();
    })
    .onUpdate((e) => {
      progress.value = Math.min(1, Math.max(0, e.x / width));
    })
    .onFinalize(() => {
      scrubbing.value = false;
      runOnJS(onSeek)(progress.value);
    });

  const fillStyle = useAnimatedStyle(() => ({ width: progress.value * width }));
  const bufferStyle = useAnimatedStyle(() => ({ width: buffered.value * width }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * width - 7 }, { scale: scrubbing.value ? 1.35 : 1 }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width, height: 36, justifyContent: "center" }} accessibilityRole="adjustable">
        <View style={{ height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.28)" }}>
          <Animated.View
            style={[
              { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)" },
              bufferStyle,
            ]}
          />
          <Animated.View
            style={[
              { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 2, backgroundColor: "#FFFFFF" },
              fillStyle,
            ]}
          />
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              top: 11,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: "#FFFFFF",
              opacity: duration > 0 ? 1 : 0.5,
            },
            thumbStyle,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

/** Скрим-градієнт (чорний → прозорий) через react-native-svg. */
function Scrim({ height, from }: { height: number; from: "top" | "bottom" }) {
  const id = from === "top" ? "viewerScrimTop" : "viewerScrimBottom";
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        height,
        [from]: 0,
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity={from === "top" ? 0.7 : 0} />
            <Stop offset="1" stopColor="#000" stopOpacity={from === "top" ? 0 : 0.75} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const THUMB = 46;
const THUMB_GAP = 6;

/** Стрічка мініатюр знизу: активна підсвічується й автоматично центрується. */
function ThumbStrip({
  items,
  index,
  width,
  bottom,
  onSelect,
}: {
  items: ViewerItem[];
  index: number;
  width: number;
  bottom: number;
  onSelect: (i: number) => void;
}) {
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    const x = index * (THUMB + THUMB_GAP) - width / 2 + THUMB / 2 + 12;
    ref.current?.scrollTo({ x: Math.max(0, x), animated: true });
  }, [index, width]);
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom }} pointerEvents="box-none">
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: THUMB_GAP, alignItems: "center" }}
        style={{ height: THUMB + 10 }}
      >
        {items.map((it, i) => (
          <TouchableOpacity key={it.id} activeOpacity={0.8} onPress={() => onSelect(i)}>
            <View>
              <ExpoImage
                source={it.poster ?? { uri: it.url }}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={it.id}
                style={{
                  width: THUMB,
                  height: THUMB,
                  borderRadius: 8,
                  opacity: i === index ? 1 : 0.55,
                  borderWidth: i === index ? 2 : 0,
                  borderColor: "#FFFFFF",
                  backgroundColor: "rgba(255,255,255,0.12)",
                }}
              />
              {it.kind === "video" ? (
                <View
                  pointerEvents="none"
                  style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="play-circle" size={20} color="rgba(255,255,255,0.9)" />
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function Viewer({
  items,
  initialIndex,
  onClose,
  closeRef,
  variant,
  onIndexChange,
  extraActions,
}: {
  items: ViewerItem[];
  initialIndex: number;
  onClose: () => void;
  closeRef: MutableRefObject<(() => void) | null>;
  variant: "default" | "profile";
  onIndexChange?: (index: number) => void;
  extraActions?: ViewerAction[];
}) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0);
  const bottomInset = Math.max(insets.bottom, 8);
  const count = items.length;
  const isProfile = variant === "profile";

  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), count - 1));
  const item = items[index];
  const isVideo = item?.kind === "video";

  // Жести й зум (UI-потік)
  const indexSV = useSharedValue(index);
  const pagerX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const axis = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const appear = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // Програвач (лише для поточного відео)
  const progress = useSharedValue(0);
  const buffered = useSharedValue(0);
  const scrubbing = useSharedValue(false);
  const activeUrl = isVideo ? item.url : null;
  const player = useVideoPlayer(activeUrl, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
    p.keepScreenOnWhilePlaying = true; // екран не гасне під час відтворення
    p.audioMixingMode = "doNotMix"; // забираємо аудіофокус, як у Telegram
    if (activeUrl) p.play();
  });
  const wantLoop = !!item?.loop;
  useEffect(() => {
    try {
      player.loop = wantLoop;
    } catch {
      // плеєр звільнено
    }
  }, [player, wantLoop, activeUrl]);
  const ps = usePlayerState(player, isVideo, progress, buffered, scrubbing);

  // Панелі керування: видимість, автоприховування
  const [chrome, setChrome] = useState(true);
  const [touchTick, setTouchTick] = useState(0);
  const chromeSV = useSharedValue(1);
  const [speedMenu, setSpeedMenu] = useState(false);
  const [menu, setMenu] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [dl, setDl] = useState<{ label: string; pct: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [flash, setFlash] = useState<{ id: number; side: "left" | "right" } | null>(null);
  const flashId = useRef(0);

  useEffect(() => {
    chromeSV.value = withTiming(chrome ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [chrome, chromeSV]);

  useEffect(() => {
    if (!chrome || !isVideo || !ps.playing || speedMenu) return;
    const t = setTimeout(() => setChrome(false), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [chrome, isVideo, ps.playing, touchTick, speedMenu]);

  const poke = useCallback(() => setTouchTick((n) => n + 1), []);
  const toggleChrome = useCallback(() => {
    setSpeedMenu(false);
    setMenu(false);
    setChrome((v) => !v);
    poke();
  }, [poke]);

  const seekBy = useCallback(
    (sec: number) => {
      if (!isVideo) return;
      player.seekBy(sec);
      poke();
    },
    [isVideo, player, poke],
  );
  const doubleTapSeek = useCallback(
    (sec: number) => {
      seekBy(sec);
      void Haptics.selectionAsync();
      flashId.current += 1;
      setFlash({ id: flashId.current, side: sec < 0 ? "left" : "right" });
    },
    [seekBy],
  );
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 650);
    return () => clearTimeout(t);
  }, [flash]);

  const seekToFraction = useCallback(
    (f: number) => {
      const d = player.duration;
      if (d > 0) player.currentTime = f * d;
      poke();
    },
    [player, poke],
  );

  const togglePlay = useCallback(() => {
    if (ps.ended) {
      player.replay();
    } else if (ps.playing) {
      player.pause();
    } else {
      player.play();
    }
    poke();
  }, [player, poke, ps.ended, ps.playing]);

  const setSpeed = useCallback(
    (r: number) => {
      player.playbackRate = r;
      setSpeedMenu(false);
      poke();
    },
    [player, poke],
  );

  // Нова сторінка: скидаємо зум і стан меню
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;
  const commitIndex = useCallback((next: number) => {
    onIndexChangeRef.current?.(next);
    setIndex(next);
    setSpeedMenu(false);
    setMenu(false);
    setFlash(null);
    setFrameReady(false);
  }, []);

  // Вхід: затемнення + легкий масштаб; вихід — зворотна анімація, після якої батько отримує onClose
  const exiting = useRef(false);
  const finished = useRef(false);
  // onClose у ref: батьки передають нестабільну стрілку, а жести/колбеки не мають перебудовуватись посеред свайпу
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const finishClose = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onCloseRef.current();
  }, []);
  const requestClose = useCallback(() => {
    if (exiting.current || finished.current) return;
    exiting.current = true;
    try {
      player.pause();
    } catch {
      // плеєр уже знищено
    }
    appear.value = withTiming(0, { duration: 170, easing: Easing.in(Easing.quad) }, () => {
      runOnJS(finishClose)();
    });
  }, [appear, finishClose, player]);

  // Перехід на сусіднє фото тапом по краю екрана.
  const stepBy = useCallback(
    (dir: number) => {
      const next = indexSV.value + dir;
      if (next < 0 || next >= count) return;
      pagerX.value = withTiming(-dir * W, { duration: 220, easing: Easing.out(Easing.cubic) }, (done) => {
        if (done) {
          indexSV.value = next;
          pagerX.value = 0;
          runOnJS(commitIndex)(next);
        }
      });
    },
    [W, commitIndex, count, indexSV, pagerX],
  );
  // Стрибок на довільне фото з мініатюр (без анімації прокрутки).
  const goTo = useCallback(
    (i: number) => {
      if (i === indexSV.value) return;
      scale.value = 1;
      tx.value = 0;
      ty.value = 0;
      savedScale.value = 1;
      savedTx.value = 0;
      savedTy.value = 0;
      pagerX.value = 0;
      indexSV.value = i;
      commitIndex(i);
    },
    [commitIndex, indexSV, pagerX, savedScale, savedTx, savedTy, scale, tx, ty],
  );

  useEffect(() => {
    appear.value = withTiming(1, { duration: 230, easing: Easing.out(Easing.cubic) });
  }, [appear]);
  useEffect(() => {
    closeRef.current = requestClose;
    return () => {
      closeRef.current = null;
    };
  }, [closeRef, requestClose]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 2200);
    return () => clearTimeout(t);
  }, [note]);

  const runAction = useCallback(
    async (mode: "save" | "share") => {
      setMenu(false);
      if (!item || busyRef.current) return;
      busyRef.current = true;
      setDl({ label: mode === "save" ? "Збереження" : "Підготовка", pct: 0 });
      const onProgress = (f: number) => setDl({ label: mode === "save" ? "Збереження" : "Підготовка", pct: Math.round(f * 100) });
      try {
        if (mode === "save") {
          await saveMedia(item.url, item.kind, onProgress, item.fileName);
          setNote("Збережено в галерею");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          await shareMedia(item.url, item.kind, onProgress, item.fileName);
        }
      } catch (e) {
        setNote(e instanceof Error && e.message ? e.message : "Не вдалося виконати дію");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        busyRef.current = false;
        setDl(null);
      }
    },
    [item],
  );

  const onFirstFrame = useCallback(() => setFrameReady(true), []);

  const runExtra = useCallback(
    (a: ViewerAction) => {
      setMenu(false);
      const target = items[index];
      if (!target) return;
      if (a.closeFirst) {
        requestClose();
        // Після того як переглядач зник — виконуємо дію (діалог не накладається на модалку).
        setTimeout(() => a.onPress(target, index), 260);
      } else {
        a.onPress(target, index);
      }
    },
    [index, items, requestClose],
  );

  const retry = useCallback(() => {
    if (!item || item.kind !== "video") return;
    setFrameReady(false);
    player.replace(item.url);
    player.play();
  }, [item, player]);

  const gesture = useMemo(() => {
    const resetZoom = () => {
      "worklet";
      scale.value = withTiming(1, { duration: 220 });
      tx.value = withTiming(0, { duration: 220 });
      ty.value = withTiming(0, { duration: 220 });
      savedScale.value = 1;
      savedTx.value = 0;
      savedTy.value = 0;
    };

    const pinch = Gesture.Pinch()
      .onUpdate((e) => {
        scale.value = Math.min(MAX_SCALE + 0.5, Math.max(0.7, savedScale.value * e.scale));
        tx.value = clampT(tx.value, scale.value, W);
        ty.value = clampT(ty.value, scale.value, H);
      })
      .onEnd(() => {
        if (scale.value <= 1.02) {
          resetZoom();
        } else {
          const s = Math.min(MAX_SCALE, scale.value);
          scale.value = withTiming(s, { duration: 120 });
          savedScale.value = s;
          savedTx.value = clampT(tx.value, s, W);
          savedTy.value = clampT(ty.value, s, H);
          tx.value = withTiming(savedTx.value, { duration: 120 });
          ty.value = withTiming(savedTy.value, { duration: 120 });
        }
      });

    const pan = Gesture.Pan()
      .minDistance(6)
      .onStart(() => {
        axis.value = 0;
        savedTx.value = tx.value;
        savedTy.value = ty.value;
      })
      .onUpdate((e) => {
        if (scale.value > 1.02) {
          tx.value = clampT(savedTx.value + e.translationX, scale.value, W);
          ty.value = clampT(savedTy.value + e.translationY, scale.value, H);
          return;
        }
        if (axis.value === 0) {
          if (Math.abs(e.translationX) < 8 && Math.abs(e.translationY) < 8) return;
          axis.value = Math.abs(e.translationX) > Math.abs(e.translationY) ? 1 : 2;
        }
        if (axis.value === 1) {
          const atEdge =
            (indexSV.value <= 0 && e.translationX > 0) ||
            (indexSV.value >= count - 1 && e.translationX < 0);
          pagerX.value = atEdge ? e.translationX * 0.3 : e.translationX;
        } else {
          dragY.value = e.translationY;
        }
      })
      .onEnd((e) => {
        if (scale.value > 1.02) {
          savedTx.value = tx.value;
          savedTy.value = ty.value;
          return;
        }
        if (axis.value === 1) {
          const dir =
            pagerX.value < -W * 0.2 || e.velocityX < -700
              ? 1
              : pagerX.value > W * 0.2 || e.velocityX > 700
                ? -1
                : 0;
          const next = indexSV.value + dir;
          if (dir !== 0 && next >= 0 && next < count) {
            pagerX.value = withTiming(
              -dir * W,
              { duration: 220, easing: Easing.out(Easing.cubic) },
              (finished) => {
                if (finished) {
                  indexSV.value = next;
                  pagerX.value = 0;
                  runOnJS(commitIndex)(next);
                }
              },
            );
          } else {
            pagerX.value = withSpring(0, { damping: 20, stiffness: 240 });
          }
        } else if (axis.value === 2) {
          if (Math.abs(dragY.value) > 110 || Math.abs(e.velocityY) > 900) {
            const sign = dragY.value >= 0 ? 1 : -1;
            dragY.value = withTiming(sign * H * 0.5, { duration: 180 }, (finished) => {
              if (finished) runOnJS(finishClose)();
            });
          } else {
            dragY.value = withSpring(0, { damping: 20, stiffness: 240 });
          }
        }
        axis.value = 0;
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(250)
      .onEnd((e, success) => {
        if (!success) return;
        if (isVideo && (e.x < W * 0.3 || e.x > W * 0.7)) {
          runOnJS(doubleTapSeek)(e.x < W * 0.5 ? -10 : 10);
          return;
        }
        if (scale.value > 1.2) {
          resetZoom();
        } else {
          const s = DOUBLE_TAP_SCALE;
          const nx = clampT((W / 2 - e.x) * (s - 1), s, W);
          const ny = clampT((H / 2 - e.y) * (s - 1), s, H);
          scale.value = withTiming(s, { duration: 240, easing: Easing.out(Easing.cubic) });
          tx.value = withTiming(nx, { duration: 240, easing: Easing.out(Easing.cubic) });
          ty.value = withTiming(ny, { duration: 240, easing: Easing.out(Easing.cubic) });
          savedScale.value = s;
          savedTx.value = nx;
          savedTy.value = ny;
        }
      });

    const singleTap = Gesture.Tap()
      .maxDuration(250)
      .onEnd((e, success) => {
        if (!success) return;
        if (isProfile && scale.value <= 1.02 && !isVideo && (e.x < W * 0.22 || e.x > W * 0.78)) {
          runOnJS(stepBy)(e.x < W * 0.5 ? -1 : 1);
          return;
        }
        runOnJS(toggleChrome)();
      });

    return Gesture.Race(
      Gesture.Simultaneous(pinch, pan),
      Gesture.Exclusive(doubleTap, singleTap),
    );
  }, [
    W,
    H,
    count,
    isVideo,
    isProfile,
    stepBy,
    finishClose,
    commitIndex,
    doubleTapSeek,
    toggleChrome,
    axis,
    dragY,
    indexSV,
    pagerX,
    savedScale,
    savedTx,
    savedTy,
    scale,
    tx,
    ty,
  ]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: appear.value * (1 - Math.min(1, Math.abs(dragY.value) / (H * 0.5)) * 0.85),
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.92 + appear.value * 0.08 }],
  }));
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: appear.value * chromeSV.value * (1 - Math.min(1, Math.abs(dragY.value) / 140)),
  }));
  const topBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - chromeSV.value) * -14 }],
  }));
  const bottomBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - chromeSV.value) * 18 }],
  }));

  const visibleIdx = [index - 1, index, index + 1].filter((i) => i >= 0 && i < count);

  if (!item) return null;

  const barWidth = W - 32;

  const subtitle =
    item.createdAt !== undefined ? `${dayLabel(item.createdAt).toLowerCase()}, ${formatTime(item.createdAt)}` : "";
  const chromePointer = chrome ? "box-none" : "none";

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }, backdropStyle]} />

      <GestureDetector gesture={gesture}>
        <Animated.View style={[StyleSheet.absoluteFill, contentStyle]}>
          {visibleIdx.map((i) => (
            <Page
              key={items[i].id}
              item={items[i]}
              pageIndex={i}
              active={i === index}
              player={player}
              frameReady={frameReady}
              onFirstFrame={onFirstFrame}
              W={W}
              H={H}
              indexSV={indexSV}
              pagerX={pagerX}
              dragY={dragY}
              scale={scale}
              tx={tx}
              ty={ty}
            />
          ))}
        </Animated.View>
      </GestureDetector>

      {/* Індикатор перемотки подвійним тапом */}
      {flash ? (
        <Animated.View
          key={flash.id}
          pointerEvents="none"
          entering={ZoomIn.duration(140)}
          exiting={FadeOut.duration(320)}
          style={{
            position: "absolute",
            top: H / 2 - 44,
            [flash.side]: W * 0.1,
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: "rgba(255,255,255,0.18)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={flash.side === "left" ? "play-back" : "play-forward"} size={26} color="#FFF" />
          <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700", marginTop: 2 }}>
            {flash.side === "left" ? "−10 с" : "+10 с"}
          </Text>
        </Animated.View>
      ) : null}

      {isVideo && ps.error ? (
        <View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }]}
        >
          <Ionicons name="alert-circle-outline" size={44} color="rgba(255,255,255,0.85)" />
          <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "600", marginTop: 10, textAlign: "center" }}>
            Не вдалося відтворити відео
          </Text>
          <TouchableOpacity
            onPress={retry}
            accessibilityRole="button"
            style={{
              marginTop: 16,
              height: 42,
              paddingHorizontal: 24,
              borderRadius: 21,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "700" }}>Повторити</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {dl ? (
        <Animated.View
          pointerEvents="none"
          entering={FadeIn.duration(140)}
          exiting={FadeOut.duration(140)}
          style={{ position: "absolute", left: 0, right: 0, top: topInset + BAR_H + 52, alignItems: "center" }}
        >
          <View
            style={{
              minWidth: 190,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 16,
              backgroundColor: "rgba(28,28,30,0.95)",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "600" }}>
                {dl.label}… {dl.pct}%
              </Text>
            </View>
            <View style={{ height: 3, borderRadius: 2, marginTop: 8, backgroundColor: "rgba(255,255,255,0.22)" }}>
              <View style={{ height: 3, borderRadius: 2, backgroundColor: "#FFF", width: `${dl.pct}%` }} />
            </View>
          </View>
        </Animated.View>
      ) : null}

      {note ? (
        <Animated.View
          pointerEvents="none"
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(200)}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: bottomInset + (isVideo ? 120 : 40),
            alignItems: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 16,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(28,28,30,0.95)",
            }}
          >
            <Ionicons name="checkmark-circle" size={18} color="#34C759" />
            <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "600" }}>{note}</Text>
          </View>
        </Animated.View>
      ) : null}

      {isVideo && ps.loading && !ps.error && !ps.ended ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : null}

      {/* Панелі керування (клікабельні лише коли видимі) */}
      <Animated.View pointerEvents={chromePointer} style={[StyleSheet.absoluteFill, chromeStyle]}>
        <Scrim from="top" height={topInset + BAR_H + 70} />
        {isVideo ? <Scrim from="bottom" height={bottomInset + 190} /> : null}

        <Animated.View
          pointerEvents="box-none"
          style={[{ position: "absolute", top: topInset + 4, left: 0, right: 0, height: BAR_H }, topBarStyle]}
        >
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
            <TouchableOpacity
              onPress={requestClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Закрити"
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 4 }}>
              <Text numberOfLines={1} style={{ color: "#FFF", fontSize: 17, fontWeight: "700" }}>
                {item.senderName ?? (isVideo ? "Відео" : "Фото")}
              </Text>
              {subtitle ? (
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => {
                setSpeedMenu(false);
                setMenu((v) => !v);
                poke();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Меню"
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="ellipsis-vertical" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {count > 1 ? (
          <View
            pointerEvents="none"
            style={{ position: "absolute", top: topInset + BAR_H + 10, left: 0, right: 0, alignItems: "center" }}
          >
            <View
              style={{
                paddingHorizontal: 14,
                height: 28,
                borderRadius: 14,
                backgroundColor: "rgba(0,0,0,0.5)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "600" }}>
                {index + 1} із {count}
              </Text>
            </View>
          </View>
        ) : null}

        {isProfile && count > 1 && !isVideo ? (
          <ThumbStrip items={items} index={index} width={W} bottom={bottomInset + 10} onSelect={goTo} />
        ) : null}

        {menu ? (
          <Animated.View
            entering={FadeIn.duration(130)}
            exiting={FadeOut.duration(100)}
            style={{
              position: "absolute",
              top: topInset + BAR_H - 2,
              right: 10,
              borderRadius: 14,
              backgroundColor: "rgba(28,28,30,0.97)",
              paddingVertical: 4,
              minWidth: 190,
            }}
          >
            {[
              { key: "save" as const, icon: "download-outline" as const, label: "Зберегти" },
              { key: "share" as const, icon: "share-outline" as const, label: "Поділитися" },
            ].map((m) => (
              <TouchableOpacity
                key={m.key}
                onPress={() => void runAction(m.key)}
                accessibilityRole="button"
                style={{ height: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 14 }}
              >
                <Ionicons name={m.icon} size={22} color="#FFF" />
                <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "500" }}>{m.label}</Text>
              </TouchableOpacity>
            ))}
            {(extraActions ?? []).map((a) => (
              <TouchableOpacity
                key={a.key}
                onPress={() => runExtra(a)}
                accessibilityRole="button"
                style={{ height: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 14 }}
              >
                <Ionicons name={a.icon} size={22} color={a.destructive ? "#FF6B6B" : "#FFF"} />
                <Text style={{ color: a.destructive ? "#FF6B6B" : "#FFF", fontSize: 16, fontWeight: "500" }}>
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        ) : null}

        {isVideo ? (
          <>
            {/* Центральні кнопки: −5 с, пауза/відтворення/повтор, +15 с */}
            <View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                top: H / 2 - 40,
                left: 0,
                right: 0,
                height: 80,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 28,
              }}
            >
              <TouchableOpacity
                onPress={() => seekBy(-5)}
                accessibilityLabel="Назад на 5 секунд"
                style={styles.sideBtn}
              >
                <Ionicons name="play-back" size={20} color="#FFF" />
                <Text style={styles.sideBtnText}>5</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={togglePlay}
                activeOpacity={0.8}
                accessibilityLabel={ps.playing ? "Пауза" : "Відтворити"}
                style={styles.playBtn}
              >
                <Ionicons
                  name={ps.ended ? "refresh" : ps.playing ? "pause" : "play"}
                  size={38}
                  color="#FFF"
                  style={ps.playing || ps.ended ? undefined : { marginLeft: 4 }}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => seekBy(15)}
                accessibilityLabel="Вперед на 15 секунд"
                style={styles.sideBtn}
              >
                <Ionicons name="play-forward" size={20} color="#FFF" />
                <Text style={styles.sideBtnText}>15</Text>
              </TouchableOpacity>
            </View>

            {/* Нижня панель: смужка, час, звук, швидкість */}
            <Animated.View
              pointerEvents="box-none"
              style={[
                { position: "absolute", left: 16, right: 16, bottom: bottomInset + 6 },
                bottomBarStyle,
              ]}
            >
              <SeekBar
                width={barWidth}
                duration={ps.duration}
                progress={progress}
                buffered={buffered}
                scrubbing={scrubbing}
                onSeek={seekToFraction}
                onInteract={poke}
              />
              <View style={{ flexDirection: "row", alignItems: "center", height: 40 }}>
                <Text style={{ color: "#FFF", fontSize: 13, fontVariant: ["tabular-nums"] }}>
                  {fmt(ps.time)} / {fmt(ps.duration)}
                </Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() => {
                    player.muted = !ps.muted;
                    poke();
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={ps.muted ? "Увімкнути звук" : "Вимкнути звук"}
                  style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name={ps.muted ? "volume-mute" : "volume-high"} size={22} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setSpeedMenu((v) => !v);
                    poke();
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Швидкість відтворення"
                  style={{
                    minWidth: 48,
                    height: 30,
                    borderRadius: 15,
                    marginLeft: 6,
                    paddingHorizontal: 8,
                    backgroundColor: "rgba(255,255,255,0.18)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "700" }}>{ps.rate}x</Text>
                </TouchableOpacity>
              </View>
              {speedMenu ? (
                <Animated.View
                  entering={FadeIn.duration(140)}
                  exiting={FadeOut.duration(120)}
                  style={{
                    position: "absolute",
                    right: 0,
                    bottom: 48,
                    borderRadius: 14,
                    backgroundColor: "rgba(28,28,30,0.96)",
                    paddingVertical: 4,
                    minWidth: 96,
                  }}
                >
                  {SPEEDS.map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setSpeed(r)}
                      style={{ height: 40, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}
                    >
                      <Text
                        style={{
                          flex: 1,
                          color: r === ps.rate ? "#FFF" : "rgba(255,255,255,0.75)",
                          fontSize: 15,
                          fontWeight: r === ps.rate ? "700" : "500",
                        }}
                      >
                        {r}x
                      </Text>
                      {r === ps.rate ? <Ionicons name="checkmark" size={16} color="#FFF" /> : null}
                    </TouchableOpacity>
                  ))}
                </Animated.View>
              ) : null}
            </Animated.View>
          </>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** Одна сторінка галереї: фото або відео, позиція за індексом, зум лише на активній. */
function Page({
  item,
  pageIndex,
  active,
  player,
  frameReady,
  onFirstFrame,
  W,
  H,
  indexSV,
  pagerX,
  dragY,
  scale,
  tx,
  ty,
}: {
  item: ViewerItem;
  pageIndex: number;
  active: boolean;
  player: VideoPlayer;
  frameReady: boolean;
  onFirstFrame: () => void;
  W: number;
  H: number;
  indexSV: SharedValue<number>;
  pagerX: SharedValue<number>;
  dragY: SharedValue<number>;
  scale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const x = (pageIndex - indexSV.value) * W + pagerX.value;
    if (pageIndex !== indexSV.value) return { transform: [{ translateX: x }] };
    const dragScale = 1 - Math.min(Math.abs(dragY.value) / H, 1) * 0.2;
    return {
      transform: [
        { translateX: x + tx.value },
        { translateY: dragY.value + ty.value },
        { scale: scale.value * dragScale },
      ],
    };
  });

  return (
    <Animated.View style={[{ position: "absolute", top: 0, left: 0, width: W, height: H }, style]}>
      {item.kind === "image" ? (
        <ExpoImage
          source={{ uri: item.url }}
          contentFit="contain"
          transition={120}
          cachePolicy="memory-disk"
          recyclingKey={item.id}
          style={{ width: W, height: H }}
        />
      ) : active ? (
        <View pointerEvents="none" style={{ width: W, height: H }}>
          {item.poster ? (
            <ExpoImage
              source={item.poster}
              contentFit="contain"
              style={{ position: "absolute", width: W, height: H, opacity: frameReady ? 0 : 1 }}
            />
          ) : null}
          {/* textureView: поверх нього можна малювати елементи й масштабувати (surfaceView не вміє) */}
          <VideoView
            player={player}
            style={{ width: W, height: H, opacity: frameReady || !item.poster ? 1 : 0 }}
            onFirstFrameRender={onFirstFrame}
            contentFit="contain"
            nativeControls={false}
            surfaceType="textureView"
            fullscreenOptions={{ enable: false }}
            allowsPictureInPicture={false}
          />
        </View>
      ) : (
        <View style={{ width: W, height: H, alignItems: "center", justifyContent: "center" }}>
          {item.poster ? (
            <ExpoImage
              source={item.poster}
              contentFit="contain"
              style={{ position: "absolute", width: W, height: H }}
            />
          ) : null}
          <Ionicons name="play-circle" size={64} color="rgba(255,255,255,0.5)" />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  playBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  sideBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  sideBtnText: { color: "#FFF", fontSize: 10, fontWeight: "800", marginTop: -2 },
});

/**
 * Єдиний повноекранний перегляд фото й відео (як у Telegram): галерея зі свайпом,
 * лічильник «N із M», зум щипком і подвійним тапом, закриття свайпом вниз,
 * для відео — власні елементи керування (перемотка, швидкість, звук).
 */
export function MediaViewer({
  visible,
  items,
  initialIndex = 0,
  onClose,
  variant = "default",
  onIndexChange,
  extraActions,
}: Props) {
  const closeRef = useRef<(() => void) | null>(null);
  const open = visible && items.length > 0;
  // Модалка монтується лише поки переглядач відкритий і повністю знімається після закриття
  // (animationType="none" + власна анімація): так на Android не лишається «привида» вікна,
  // що перекривав наступну модалку (редагування профілю).
  if (!open) return null;
  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={() => (closeRef.current ? closeRef.current() : onClose())}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "transparent" }}>
        <Viewer
          items={items}
          initialIndex={initialIndex}
          onClose={onClose}
          closeRef={closeRef}
          variant={variant}
          onIndexChange={onIndexChange}
          extraActions={extraActions}
        />
      </GestureHandlerRootView>
    </Modal>
  );
}
