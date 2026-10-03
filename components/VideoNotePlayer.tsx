// components/VideoNotePlayer.tsx
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { useEventListener } from "expo";
import * as Haptics from "expo-haptics";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
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
  const [session, setSession] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  return (
    <View style={{ alignItems: props.isMine ? "flex-end" : "flex-start" }}>
      {hasStarted ? (
        // key змінюється при повторі: плеєр створюється заново
        <VideoNoteActive
          key={session}
          videoUrl={props.videoUrl}
          duration={props.duration}
          isMine={props.isMine}
          timeLabel={props.timeLabel}
          onReplay={() => setSession((s) => s + 1)}
        />
      ) : (
        // Легкий placeholder, поки користувач не натиснув: відео не вантажиться
        <VideoNotePlaceholder
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
  duration?: number;
  isMine?: boolean;
  timeLabel?: string;
  onPress: () => void;
}> = ({ duration = 0, isMine = false, timeLabel, onPress }) => {
  const c = useChatPalette();
  const bgColor = withAlpha(isMine ? c.accent : c.muted, 0.22);
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
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.4)",
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
  onReplay: () => void;
}

const VideoNoteActive: React.FC<VideoNoteActiveProps> = ({
  videoUrl,
  duration = 0,
  isMine = false,
  timeLabel,
  onReplay,
}) => {
  const c = useChatPalette();
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
  });

  // Прогрес і готовність опитуємо кожні 100 мс
  useEffect(() => {
    const interval = setInterval(() => {
      if (!player) return;
      const current = player.currentTime ?? 0;
      const len =
        player.duration && player.duration > 0 ? player.duration : duration;

      if (len > 0) {
        setTotal(len);
        setProgress(Math.min(1, current / len));
      }
      if (player.duration && player.duration > 0) {
        setIsReady((ready) => ready || true);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [player, duration]);

  const handleTap = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Після завершення тап = повтор з нуля (remount через key)
    if (hasEnded) {
      onReplay();
      return;
    }

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
            backgroundColor: "rgba(255,255,255,0.08)",
          }}
        >
          <VideoView
            player={player}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            nativeControls={false}
          />

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
                backgroundColor: "rgba(0,0,0,0.25)",
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
                <Ionicons
                  name={hasEnded ? "refresh" : "play"}
                  size={30}
                  color="#FFFFFF"
                  style={{ marginLeft: hasEnded ? 0 : 3 }}
                />
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
