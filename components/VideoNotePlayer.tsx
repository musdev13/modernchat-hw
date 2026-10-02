// components/VideoNotePlayer.tsx
import { COLORS } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useEventListener } from "expo";
import * as Haptics from "expo-haptics";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface VideoNotePlayerProps {
  videoUrl: string;
  duration?: number;
  isMine?: boolean;
}

const SPEED_OPTIONS = [1.0, 1.5, 2.0] as const;
const CIRCLE_SIZE = 200;
const STROKE_WIDTH = 3.5;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatDuration(sec: number): string {
  const safe = Math.max(0, Math.round(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export const VideoNotePlayer: React.FC<VideoNotePlayerProps> = (props) => {
  const [hasStarted, setHasStarted] = useState(false);

  // Показываем placeholder, пока пользователь не тапнет
  if (!hasStarted) {
    return (
      <VideoNotePlaceholder
        duration={props.duration}
        isMine={props.isMine}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setHasStarted(true);
        }}
      />
    );
  }

  return <VideoNoteActive {...props} />;
};

// ─────────────────────────────────────────────────────────
// Placeholder
// ─────────────────────────────────────────────────────────
const VideoNotePlaceholder: React.FC<{
  duration?: number;
  isMine?: boolean;
  onPress: () => void;
}> = ({ duration = 0, isMine = false, onPress }) => {
  const bgColor = isMine
    ? "rgba(255,255,255,0.15)"
    : "rgba(255,255,255,0.08)";
  const borderColor = isMine
    ? "rgba(255,255,255,0.3)"
    : "rgba(255,255,255,0.18)";

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      className="relative items-center justify-center"
      style={{
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        borderRadius: CIRCLE_SIZE / 2,
        backgroundColor: bgColor,
        borderWidth: 1,
        borderColor,
      }}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: 64,
          height: 64,
          backgroundColor: "rgba(0,0,0,0.4)",
        }}
      >
        <Ionicons
          name="play"
          size={32}
          color={COLORS.white}
          style={{ marginLeft: 4 }}
        />
      </View>

      {duration > 0 && (
        <View
          className="absolute bottom-6 px-3 py-1 rounded-full"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
        >
          <Text className="text-white text-xs font-bold">
            {formatDuration(duration)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────
// Активный плеер
// ─────────────────────────────────────────────────────────
const VideoNoteActive: React.FC<VideoNotePlayerProps> = ({
  videoUrl,
  duration = 0,
  isMine = false,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  // Следим за окончанием видео
  useEventListener(player, "playToEnd", () => {
    setHasEnded(true);
    setIsPlaying(false);
    setProgress(1);
  });

  // Следим за изменением состояния воспроизведения
  useEventListener(player, "playingChange", ({ isPlaying: playing }) => {
    setIsPlaying(playing);
    if (playing) setHasEnded(false);
  });

  // Обновление прогресса и первого кадра
  useEffect(() => {
    const interval = setInterval(() => {
      if (!player) return;

      const current = player.currentTime ?? 0;
      const total =
        player.duration && player.duration > 0 ? player.duration : duration;

      if (total > 0) {
        setProgress(Math.min(1, current / total));
        if (!isReady) setIsReady(true);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [player, duration, isReady]);

  const handleTap = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Если видео закончилось — перезагружаем источник
    if (hasEnded) {
      try {
        // replaceAsync полностью сбрасывает состояние плеера
        await player.replaceAsync(videoUrl);
        setHasEnded(false);
        setProgress(0);
        setIsReady(false);
        // play() запустится автоматически из setup-колбэка нового плеера
      } catch (error) {
        console.error("Replay error:", error);
      }
      return;
    }

    // Иначе — обычная пауза/воспроизведение
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handleCycleSpeed = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextIndex = (speedIndex + 1) % SPEED_OPTIONS.length;
    const nextSpeed = SPEED_OPTIONS[nextIndex];
    setSpeedIndex(nextIndex);
    player.playbackRate = nextSpeed;
  };

  const handleToggleMute = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    player.muted = nextMuted;
  };

  const strokeDashoffset = CIRCUMFERENCE - progress * CIRCUMFERENCE;
  const currentSpeed = SPEED_OPTIONS[speedIndex];
  const showPlayOverlay = isReady && !isPlaying;

  return (
    <View
      className="relative items-center justify-center"
      style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
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
          stroke={
            isMine ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)"
          }
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <Circle
          cx={CIRCLE_SIZE / 2}
          cy={CIRCLE_SIZE / 2}
          r={RADIUS}
          stroke={COLORS.primary}
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>

      <TouchableOpacity
        activeOpacity={0.95}
        onPress={handleTap}
        style={{
          width: CIRCLE_SIZE - 8,
          height: CIRCLE_SIZE - 8,
          borderRadius: (CIRCLE_SIZE - 8) / 2,
          overflow: "hidden",
          backgroundColor: "rgba(255,255,255,0.08)",
        }}
      >
        {isReady ? (
          <VideoView
            player={player}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}

        {showPlayOverlay && (
          <View
            className="absolute inset-0 items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
            pointerEvents="none"
          >
            <View
              className="rounded-full items-center justify-center"
              style={{
                width: 64,
                height: 64,
                backgroundColor: "rgba(0,0,0,0.6)",
              }}
            >
              <Ionicons
                name="play"
                size={30}
                color={COLORS.white}
                style={{ marginLeft: 3 }}
              />
            </View>
          </View>
        )}
      </TouchableOpacity>

      {isReady && isPlaying && (
        <TouchableOpacity
          onPress={handleToggleMute}
          activeOpacity={0.8}
          className="absolute z-20 rounded-full items-center justify-center"
          style={{
            top: 6,
            left: 6,
            width: 32,
            height: 32,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        >
          <Ionicons
            name={isMuted ? "volume-mute" : "volume-high"}
            size={16}
            color={COLORS.white}
          />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={handleCycleSpeed}
        activeOpacity={0.8}
        className={`absolute z-20 px-2 py-0.5 rounded-full border ${
          currentSpeed > 1.0
            ? "bg-primary border-primary"
            : "bg-black/60 border-white/20"
        }`}
        style={{ top: 6, right: 6 }}
      >
        <Text className="text-[10px] font-bold text-white">
          {currentSpeed}x
        </Text>
      </TouchableOpacity>
    </View>
  );
};