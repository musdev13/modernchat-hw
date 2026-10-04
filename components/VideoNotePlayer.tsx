// components/VideoNotePlayer.tsx
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { useEventListener } from "expo";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import {
  createVideoPlayer,
  useVideoPlayer,
  VideoThumbnail,
  VideoView,
} from "expo-video";
import { useNavigation } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Dimensions,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { MessageReactions, ReactionItem } from "./MessageReactions";

export type { ReactionItem };

interface VideoNotePlayerProps {
  videoUrl: string;
  duration?: number;
  isMine?: boolean;
  /** Реакції, які показуються під кружечком (необов'язково). */
  reactions?: ReactionItem[];
  onToggleReaction?: (emoji: string) => void;
  /** Час повідомлення (напр. 12:34), малий бейдж унизу праворуч (необов'язково). */
  timeLabel?: string;
}

const SPEED_OPTIONS = [1.0, 1.5, 2.0] as const;
const CIRCLE_SIZE = 200;
const STROKE_WIDTH = 3.5;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ───────────────────────────────────────────────────────────────
// Прев'ю (перший кадр). Генеруємо мініатюру через expo-video,
// кешуємо в пам'яті за URL. Одночасно працює лише один легкий
// «завантажувач», а черга пропускає елементи, які вже зникли зі списку.
// ───────────────────────────────────────────────────────────────
const THUMB_TIME_SEC = 0.1;
const THUMB_MAX_SIZE = 480;
const THUMB_TIMEOUT_MS = 10_000;
const THUMB_CACHE_LIMIT = 80;

const thumbCache = new Map<string, VideoThumbnail>();
// Скільки разів уже пробували створити мініатюру (після 3 невдач більше не мучимо плеєр).
const thumbAttempts = new Map<string, number>();
const MAX_THUMB_ATTEMPTS = 3;
const thumbInflight = new Map<string, Promise<VideoThumbnail | null>>();
const thumbWanted = new Map<string, number>();
let thumbQueue: Promise<unknown> = Promise.resolve();

async function generateThumbnail(url: string): Promise<VideoThumbnail | null> {
  let player: ReturnType<typeof createVideoPlayer> | null = null;
  try {
    player = createVideoPlayer(url);
    player.muted = true;
    const p = player;

    // Чекаємо, поки плеєр завантажить метадані (без запуску відтворення).
    await new Promise<void>((resolve, reject) => {
      if (p.status === "readyToPlay") {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        sub.remove();
        reject(new Error("thumbnail timeout"));
      }, THUMB_TIMEOUT_MS);
      const sub = p.addListener("statusChange", ({ status }) => {
        if (status === "readyToPlay") {
          clearTimeout(timer);
          sub.remove();
          resolve();
        } else if (status === "error") {
          clearTimeout(timer);
          sub.remove();
          reject(new Error("thumbnail load error"));
        }
      });
    });

    // Без таймауту зависла генерація блокувала б чергу всіх інших кружечків.
    const [thumb] = await Promise.race([
      p.generateThumbnailsAsync(THUMB_TIME_SEC, {
        maxWidth: THUMB_MAX_SIZE,
        maxHeight: THUMB_MAX_SIZE,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("thumbnail generate timeout")), THUMB_TIMEOUT_MS),
      ),
    ]);
    return thumb ?? null;
  } catch {
    return null;
  } finally {
    try {
      player?.release();
    } catch {}
  }
}

function requestThumbnail(url: string): Promise<VideoThumbnail | null> {
  const cached = thumbCache.get(url);
  if (cached) return Promise.resolve(cached);
  if ((thumbAttempts.get(url) ?? 0) >= MAX_THUMB_ATTEMPTS) return Promise.resolve(null);
  const running = thumbInflight.get(url);
  if (running) return running;

  const job = new Promise<VideoThumbnail | null>((resolve) => {
    thumbQueue = thumbQueue.then(async () => {
      // Користувач уже прокрутив повз цей кружечок — не витрачаємо ресурси.
      if ((thumbWanted.get(url) ?? 0) <= 0) {
        thumbInflight.delete(url);
        resolve(null);
        return;
      }
      const thumb = await generateThumbnail(url);
      if (thumb) {
        thumbCache.set(url, thumb);
        if (thumbCache.size > THUMB_CACHE_LIMIT) {
          const oldest = thumbCache.keys().next().value;
          if (oldest !== undefined) thumbCache.delete(oldest);
        }
      } else {
        thumbAttempts.set(url, (thumbAttempts.get(url) ?? 0) + 1);
      }
      thumbInflight.delete(url);
      resolve(thumb);
    });
  });
  thumbInflight.set(url, job);
  return job;
}

function useVideoNoteThumbnail(url: string): VideoThumbnail | null {
  const [thumb, setThumb] = useState<VideoThumbnail | null>(
    () => thumbCache.get(url) ?? null,
  );

  useEffect(() => {
    const cached = thumbCache.get(url);
    if (cached) {
      setThumb(cached);
      return;
    }
    let alive = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    thumbWanted.set(url, (thumbWanted.get(url) ?? 0) + 1);
    const attempt = () => {
      void requestThumbnail(url).then((result) => {
        if (!alive) return;
        if (result) {
          setThumb(result);
          return;
        }
        // Невдача (мережа, таймаут): повторюємо з наростаючою паузою, але не більше MAX_THUMB_ATTEMPTS.
        const n = thumbAttempts.get(url) ?? 0;
        if (n > 0 && n < MAX_THUMB_ATTEMPTS) retryTimer = setTimeout(attempt, 2000 * n);
      });
    };
    attempt();
    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
      thumbWanted.set(url, Math.max(0, (thumbWanted.get(url) ?? 1) - 1));
    };
  }, [url]);

  return thumb;
}

function formatDuration(sec: number): string {
  const safe = Math.max(0, Math.ceil(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

// Лише один кружечок відтворюється одночасно: при старті наступного
// попередній ставиться на паузу.
let pauseActiveNote: (() => void) | null = null;

function claimPlayback(pause: () => void) {
  if (pauseActiveNote && pauseActiveNote !== pause) {
    try {
      pauseActiveNote();
    } catch {}
  }
  pauseActiveNote = pause;
}

function releasePlayback(pause: () => void) {
  if (pauseActiveNote === pause) pauseActiveNote = null;
}

export const VideoNotePlayer: React.FC<VideoNotePlayerProps> = (props) => {
  const [hasStarted, setHasStarted] = useState(false);

  return (
    <View style={{ alignItems: props.isMine ? "flex-end" : "flex-start" }}>
      {hasStarted ? (
        // Після завершення або коли кружечок пішов за межі екрана плеєр звільняється:
        // знову показується легкий placeholder (із мініатюрою), тап відтворює спочатку.
        <VideoNoteActive
          videoUrl={props.videoUrl}
          duration={props.duration}
          isMine={props.isMine}
          timeLabel={props.timeLabel}
          onRelease={() => setHasStarted(false)}
        />
      ) : (
        // Легкий placeholder, поки користувач не натиснув: відео не вантажиться
        <VideoNotePlaceholder
          videoUrl={props.videoUrl}
          duration={props.duration}
          isMine={props.isMine}
          timeLabel={props.timeLabel}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setHasStarted(true);
          }}
        />
      )}

      {props.reactions && props.reactions.length > 0 && (
        <View
          style={{
            width: CIRCLE_SIZE,
            alignItems: props.isMine ? "flex-end" : "flex-start",
          }}
        >
          {/* Кружечок без бульбашки, тому пігулки у стилі «чужого» повідомлення */}
          <MessageReactions
            reactions={props.reactions}
            isOwn={false}
            onToggleReaction={(emoji) => props.onToggleReaction?.(emoji)}
          />
        </View>
      )}
    </View>
  );
};

const TimeBadge: React.FC<{ label: string }> = ({ label }) => (
  <View
    pointerEvents="none"
    style={{
      position: "absolute",
      right: 14,
      bottom: 14,
      zIndex: 20,
      backgroundColor: "rgba(0,0,0,0.5)",
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 1,
    }}
  >
    <Text style={{ color: "#FFFFFF", fontSize: 11 }}>{label}</Text>
  </View>
);

const DurationBadge: React.FC<{ seconds: number }> = ({ seconds }) => (
  <View
    pointerEvents="none"
    style={{
      position: "absolute",
      left: 14,
      bottom: 14,
      zIndex: 20,
      backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 2,
    }}
  >
    <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>
      {formatDuration(seconds)}
    </Text>
  </View>
);

// ─────────────────────────────────────────────
// Placeholder
// ─────────────────────────────────────────────
const VideoNotePlaceholder: React.FC<{
  videoUrl: string;
  duration?: number;
  isMine?: boolean;
  timeLabel?: string;
  onPress: () => void;
}> = ({ videoUrl, duration = 0, isMine = false, timeLabel, onPress }) => {
  const c = useChatPalette();
  const thumbnail = useVideoNoteThumbnail(videoUrl);
  const bgColor = c.search;
  const borderColor = withAlpha(isMine ? c.accent : c.muted, 0.5);

  return (
    <View style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={{
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
          borderRadius: CIRCLE_SIZE / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bgColor,
          borderWidth: 1,
          borderColor,
          overflow: "hidden",
        }}
      >
        {!thumbnail && (
          <Ionicons
            name="videocam"
            size={72}
            color={withAlpha(isMine ? c.accent : c.muted, 0.28)}
            style={{ position: "absolute" }}
          />
        )}
        {thumbnail && (
          <Image
            source={thumbnail}
            contentFit="cover"
            transition={250}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
        )}
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
        >
          <Ionicons
            name="play"
            size={32}
            color="#FFFFFF"
            style={{ marginLeft: 4 }}
          />
        </View>
      </TouchableOpacity>
      {duration > 0 && <DurationBadge seconds={duration} />}
      {timeLabel ? <TimeBadge label={timeLabel} /> : null}
    </View>
  );
};

// ─────────────────────────────────────────────
// Активний плеєр
// ─────────────────────────────────────────────
interface VideoNoteActiveProps {
  videoUrl: string;
  duration?: number;
  isMine?: boolean;
  timeLabel?: string;
  /** Звільнити плеєр (кінець відео, кружечок поза екраном) і повернутись до placeholder. */
  onRelease: () => void;
}

const VideoNoteActive: React.FC<VideoNoteActiveProps> = ({
  videoUrl,
  duration = 0,
  isMine = false,
  timeLabel,
  onRelease,
}) => {
  const c = useChatPalette();
  const navigation = useNavigation();
  const rootRef = useRef<View>(null);
  const thumbnail = useVideoNoteThumbnail(videoUrl);
  const [firstFrame, setFirstFrame] = useState(false);
  const releasedRef = useRef(false);
  const coverOpacity = useSharedValue(1);
  const coverStyle = useAnimatedStyle(() => ({ opacity: coverOpacity.value }));
  const [isMuted, setIsMuted] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(duration);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.muted = false;
  });

  // Стабільна функція паузи для реєстру «грає лише один»
  const pauseRef = useRef<() => void>(() => {});
  pauseRef.current = () => {
    try {
      player.pause();
    } catch {}
  };
  const pauseSelf = useRef(() => pauseRef.current()).current;

  const startPlayback = () => {
    claimPlayback(pauseSelf);
    player.muted = isMuted;
    try {
      player.play();
    } catch (error) {
      console.error("Play error:", error);
    }
  };

  // Автостарт: кружечок відкривається після натискання, тому одразу граємо
  useEffect(() => {
    startPlayback();
    return () => releasePlayback(pauseSelf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEventListener(player, "playingChange", ({ isPlaying: playing }) => {
    setIsPlaying(playing);
    if (playing) setHasEnded(false);
  });

  useEventListener(player, "playToEnd", () => {
    setHasEnded(true);
    setIsPlaying(false);
    setProgress(1);
    releasePlayback(pauseSelf);
    // Коротка пауза на «повне коло», далі плеєр звільняється.
    setTimeout(() => {
      if (!releasedRef.current) {
        releasedRef.current = true;
        onRelease();
      }
    }, 450);
  });

  // Пауза (і звільнення плеєра), коли екран чату втрачає фокус або застосунок іде у фон.
  useEffect(() => {
    const pauseNow = () => {
      try {
        player.pause();
      } catch {}
    };
    const unsubBlur = navigation.addListener("blur", pauseNow);
    const appSub = AppState.addEventListener("change", (state) => {
      if (state !== "active") pauseNow();
    });
    return () => {
      unsubBlur();
      appSub.remove();
    };
  }, [navigation, player]);

  // Прогрес і готовність опитуємо кожні 100 мс
  useEffect(() => {
    let tick = 0;
    const winH = Dimensions.get("window").height;
    const interval = setInterval(() => {
      if (!player) return;
      tick += 1;
      const current = player.currentTime ?? 0;
      const len =
        player.duration && player.duration > 0 ? player.duration : duration;

      if (len > 0) {
        setTotal((t) => (Math.abs(t - len) > 0.01 ? len : t));
        const next = Math.min(1, current / len);
        setProgress((p) => (Math.abs(p - next) > 0.002 ? next : p));
      }
      if (player.duration && player.duration > 0) {
        setIsReady((ready) => ready || true);
      }

      // Кружечок прокрутили геть за межі екрана: ставимо на паузу й звільняємо плеєр.
      if (tick % 4 === 0 && player.playing) {
        rootRef.current?.measureInWindow((_x, y, _w, h) => {
          if (releasedRef.current || h <= 0) return;
          if (y + h < 0 || y > winH) {
            releasedRef.current = true;
            try {
              player.pause();
            } catch {}
            onRelease();
          }
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [player, duration, onRelease]);

  // Плавно прибираємо прев'ю, коли відео віддало перший кадр.
  useEffect(() => {
    if (firstFrame || (isPlaying && progress > 0)) {
      coverOpacity.value = withTiming(0, { duration: 220 });
    }
  }, [firstFrame, isPlaying, progress, coverOpacity]);

  const handleTap = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (hasEnded) return;

    if (player.playing) {
      player.pause();
      return;
    }

    startPlayback();
  };

  const handleCycleSpeed = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextIndex = (speedIndex + 1) % SPEED_OPTIONS.length;
    setSpeedIndex(nextIndex);
    player.playbackRate = SPEED_OPTIONS[nextIndex];
  };

  const handleToggleMute = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    player.muted = nextMuted;
  };

  const tapGesture = Gesture.Tap()
    .maxDuration(300)
    .onEnd((_event, success) => {
      if (!success) return;
      runOnJS(handleTap)();
    });

  const strokeDashoffset = CIRCUMFERENCE - progress * CIRCUMFERENCE;
  const currentSpeed = SPEED_OPTIONS[speedIndex];
  const showPlayOverlay = isReady && !isPlaying;
  const remaining = total > 0 ? total * (1 - progress) : 0;

  return (
    <View
      ref={rootRef}
      collapsable={false}
      style={{
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
      }}
    >
      <Svg
        width={CIRCLE_SIZE}
        height={CIRCLE_SIZE}
        style={{
          position: "absolute",
          transform: [{ rotate: "-90deg" }],
          zIndex: 10,
        }}
        pointerEvents="none"
      >
        <Circle
          cx={CIRCLE_SIZE / 2}
          cy={CIRCLE_SIZE / 2}
          r={RADIUS}
          stroke={isMine ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)"}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <Circle
          cx={CIRCLE_SIZE / 2}
          cy={CIRCLE_SIZE / 2}
          r={RADIUS}
          stroke={c.accent}
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>

      <GestureDetector gesture={tapGesture}>
        <View
          style={{
            width: CIRCLE_SIZE - 8,
            height: CIRCLE_SIZE - 8,
            borderRadius: (CIRCLE_SIZE - 8) / 2,
            overflow: "hidden",
            backgroundColor: c.search,
          }}
        >
          {/* textureView: коректно обрізається по колу (surfaceView дає чорні кути й чорний кадр у списку
              з removeClippedSubviews); без exo-shutter немає чорного спалаху перед першим кадром. */}
          <VideoView
            player={player}
            style={{ width: "100%", height: "100%", borderRadius: (CIRCLE_SIZE - 8) / 2 }}
            contentFit="cover"
            nativeControls={false}
            surfaceType="textureView"
            useExoShutter={false}
            onFirstFrameRender={() => setFirstFrame(true)}
          />

          {/* Обкладинка: мініатюра, а якщо її немає — непрозорий колір теми зі спінером. Зникає з першим кадром. */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: c.search,
                alignItems: "center",
                justifyContent: "center",
              },
              coverStyle,
            ]}
          >
            {thumbnail ? (
              <Image
                source={thumbnail}
                contentFit="cover"
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
              />
            ) : (
              <Ionicons name="videocam" size={72} color={withAlpha(c.muted, 0.28)} />
            )}
          </Animated.View>

          {!isReady && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0,0,0,0.18)",
              }}
              pointerEvents="none"
            >
              <ActivityIndicator size="large" color={c.accent} />
            </View>
          )}

          {showPlayOverlay && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0,0,0,0.3)",
              }}
              pointerEvents="none"
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="play" size={30} color="#FFFFFF" style={{ marginLeft: 3 }} />
              </View>
            </View>
          )}
        </View>
      </GestureDetector>

      {isReady && isPlaying && (
        <TouchableOpacity
          onPress={handleToggleMute}
          activeOpacity={0.8}
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            zIndex: 20,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: "rgba(0,0,0,0.55)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={isMuted ? "volume-mute" : "volume-high"}
            size={16}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={handleCycleSpeed}
        activeOpacity={0.8}
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          zIndex: 20,
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 10,
          backgroundColor: currentSpeed > 1.0 ? c.accent : "rgba(0,0,0,0.6)",
        }}
      >
        <Text
          style={{
            color: currentSpeed > 1.0 ? c.onAccent : "#FFFFFF",
            fontWeight: "700",
            fontSize: 10,
          }}
        >
          {currentSpeed}x
        </Text>
      </TouchableOpacity>

      {total > 0 && <DurationBadge seconds={remaining} />}
      {timeLabel ? <TimeBadge label={timeLabel} /> : null}
    </View>
  );
};
