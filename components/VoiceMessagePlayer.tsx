import { AudioWaveform } from "@/components/AudioWaveform";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
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
  const c = useChatPalette();
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

  const fg = isMine ? c.onAccent : c.accent;
  const subtle = isMine ? c.outgoingMeta : c.muted;
  const fast = currentSpeed > 1.0;

  return (
    <View className="flex-row items-center my-1 w-64">
      {/* Кнопка Play / Pause */}
      <TouchableOpacity
        onPress={togglePlayPause}
        activeOpacity={0.8}
        className="w-10 h-10 rounded-full items-center justify-center mr-2.5"
        style={{ backgroundColor: isMine ? c.onAccent : c.accent }}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? "Пауза" : "Відтворити"}
      >
        {isBuffering ? (
          <ActivityIndicator size="small" color={isMine ? c.accent : c.onAccent} />
        ) : (
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={20}
            color={isMine ? c.accent : c.onAccent}
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
          <Text style={{ color: subtle, fontSize: 11 }}>{displayTime}</Text>
        </View>
      </View>

      {/* Кнопка швидкості (1x / 1.5x / 2x) */}
      <TouchableOpacity
        onPress={handleCycleSpeed}
        activeOpacity={0.7}
        className="ml-2 px-2 py-0.5 rounded-full"
        style={{ backgroundColor: fast ? fg : withAlpha(fg, 0.18) }}
        accessibilityRole="button"
        accessibilityLabel="Швидкість відтворення"
      >
        <Text
          style={{
            fontSize: 10,
            fontWeight: "700",
            color: fast ? (isMine ? c.accent : c.onAccent) : fg,
          }}
        >
          {currentSpeed}x
        </Text>
      </TouchableOpacity>
    </View>
  );
};
