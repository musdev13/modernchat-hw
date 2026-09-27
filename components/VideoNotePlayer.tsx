// components/VideoNotePlayer.tsx
import { COLORS } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface VideoNotePlayerProps {
  videoUrl: string;
  /** Тривалість з БД (fallback, поки player не завантажив метадані) */
  duration?: number;
  /** true — власне повідомлення (візуальні акценти) */
  isMine?: boolean;
}

const SPEED_OPTIONS = [1.0, 1.5, 2.0] as const;
const CIRCLE_SIZE = 200;
const STROKE_WIDTH = 3.5;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const VideoNotePlayer: React.FC<VideoNotePlayerProps> = ({
  videoUrl,
  duration = 0,
  isMine = false,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  // Полінг прогресу — у expo-video немає реактивного status-хука
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

  const toggleAudio = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    player.muted = nextMuted;
  };

  const handleCycleSpeed = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const nextIndex = (speedIndex + 1) % SPEED_OPTIONS.length;
    const nextSpeed = SPEED_OPTIONS[nextIndex];

    setSpeedIndex(nextIndex);
    player.playbackRate = nextSpeed;
  };

  const strokeDashoffset = CIRCUMFERENCE - progress * CIRCUMFERENCE;
  const currentSpeed = SPEED_OPTIONS[speedIndex];

  return (
    <View
      className="relative items-center justify-center my-1"
      style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
    >
      {/* SVG — круговий прогрес навколо відео */}
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
        {/* Трек */}
        <Circle
          cx={CIRCLE_SIZE / 2}
          cy={CIRCLE_SIZE / 2}
          r={RADIUS}
          stroke={isMine ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)"}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />

        {/* Прогрес */}
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

      {/* Кругле відео */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={toggleAudio}
        style={{
          width: CIRCLE_SIZE - 8,
          height: CIRCLE_SIZE - 8,
          borderRadius: (CIRCLE_SIZE - 8) / 2,
          overflow: "hidden",
          backgroundColor: COLORS.background,
        }}
      >
        <VideoView
          player={player}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          nativeControls={false}
        />

        {/* Спінер, поки метадані не завантажились */}
        {!isReady && (
          <View
            className="absolute inset-0 items-center justify-center"
            pointerEvents="none"
          >
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}

        {/* Індикатор Mute */}
        {isMuted && (
          <View
            className="absolute inset-0 items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
            pointerEvents="none"
          >
            <View
              className="p-2.5 rounded-full"
              style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            >
              <Ionicons name="volume-mute" size={24} color={COLORS.white} />
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Бейдж швидкості (1x / 1.5x / 2x) */}
      <TouchableOpacity
        onPress={handleCycleSpeed}
        activeOpacity={0.8}
        className={`absolute z-20 px-2 py-0.5 rounded-full border ${
          currentSpeed > 1.0
            ? "bg-primary border-primary"
            : "bg-black/60 border-white/20"
        }`}
        style={{ top: 4, right: 4 }}
      >
        <Text className="text-[10px] font-bold text-white">
          {currentSpeed}x
        </Text>
      </TouchableOpacity>
    </View>
  );
};
