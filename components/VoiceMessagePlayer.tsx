import { AudioWaveform } from "@/components/AudioWaveform";
import { COLORS } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

interface VoiceMessagePlayerProps {
  audioUrl: string;
  /** Тривалість з БД (fallback, поки status.duration не завантажиться) */
  duration?: number;
  /** Масив 32 амплітуд [0.1..1.0] */
  waveform?: number[];
  /** true — власне повідомлення (білий текст на синьому баблі) */
  isMine?: boolean;
}

const SPEED_OPTIONS = [1.0, 1.5, 2.0] as const;

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  audioUrl,
  duration = 0,
  waveform,
  isMine = false,
}) => {
  const player = useAudioPlayer({ uri: audioUrl });
  const status = useAudioPlayerStatus(player);

  const [speedIndex, setSpeedIndex] = useState(0);

  const isPlaying = status?.playing ?? false;
  const isBuffering = status?.isBuffering ?? false;
  const currentPosition = status?.currentTime ?? 0;
  const totalDuration =
    status?.duration && status.duration > 0 ? status.duration : duration;
  const progress =
    totalDuration > 0 ? Math.min(1, currentPosition / totalDuration) : 0;
  const currentSpeed = SPEED_OPTIONS[speedIndex];

  const togglePlayPause = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isPlaying) {
      player.pause();
    } else {
      if (progress >= 0.99) {
        player.seekTo(0);
      }
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

  const handleSeek = (targetSeconds: number) => {
    player.seekTo(Math.max(0, targetSeconds));
  };

  const formatSeconds = (sec: number) => {
    const safe = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const displayTime = isPlaying
    ? formatSeconds(currentPosition)
    : formatSeconds(totalDuration);

  return (
    <View className="flex-row items-center my-1 w-64">
      {/* Кнопка Play / Pause */}
      <TouchableOpacity
        onPress={togglePlayPause}
        activeOpacity={0.8}
        className={`w-9 h-9 rounded-full items-center justify-center mr-2.5 ${
          isMine ? "bg-white/20" : "bg-primary/20"
        }`}
      >
        {isBuffering ? (
          <ActivityIndicator
            size="small"
            color={isMine ? COLORS.white : COLORS.primary}
          />
        ) : (
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={18}
            color={isMine ? COLORS.white : COLORS.primary}
            style={{ marginLeft: isPlaying ? 0 : 2 }}
          />
        )}
      </TouchableOpacity>

      {/* Хвиля + час */}
      <View className="flex-1 justify-center">
        <AudioWaveform
          waveform={waveform}
          progress={progress}
          duration={totalDuration}
          isMine={isMine}
          onSeek={handleSeek}
          height={28}
        />

        <View className="flex-row justify-between items-center mt-1">
          <Text
            className={`text-[10px] ${
              isMine ? "text-white/70" : "text-textMuted"
            }`}
          >
            {displayTime}
          </Text>
        </View>
      </View>

      {/* Кнопка швидкості (1x / 1.5x / 2x) */}
      <TouchableOpacity
        onPress={handleCycleSpeed}
        activeOpacity={0.7}
        className={`ml-2 px-2 py-0.5 rounded-full border ${
          currentSpeed > 1.0
            ? "bg-primary border-primary"
            : isMine
              ? "bg-white/10 border-white/20"
              : "bg-surfaceLight border-surfaceLight"
        }`}
      >
        <Text
          className={`text-[10px] font-bold ${
            currentSpeed > 1.0 ? "text-white" : "text-textMuted"
          }`}
        >
          {currentSpeed}x
        </Text>
      </TouchableOpacity>
    </View>
  );
};
