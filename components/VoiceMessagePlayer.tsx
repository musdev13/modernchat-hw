import { AudioWaveform } from "@/components/AudioWaveform";
import { COLORS, FONTS } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export interface ReactionItem {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration?: number;
  waveform?: number[];
  isMine?: boolean;
  reactions?: ReactionItem[];
  onToggleReaction?: (emoji: string) => void;
}

const SPEED_OPTIONS = [1.0, 1.5, 2.0] as const;

function ReactionPill({
  item,
  onToggle,
  isOwn,
}: {
  item: ReactionItem;
  onToggle: () => void;
  isOwn: boolean;
}) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        damping: 12,
        stiffness: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  const backgroundColor = isOwn
    ? item.hasReacted
      ? "rgba(255,255,255,0.28)"
      : "rgba(255,255,255,0.12)"
    : item.hasReacted
      ? "rgba(255,143,180,0.22)"
      : "rgba(183,148,246,0.1)";

  const borderColor = isOwn
    ? item.hasReacted
      ? "rgba(255,255,255,0.85)"
      : "rgba(255,255,255,0.28)"
    : item.hasReacted
      ? COLORS.primary
      : "rgba(183,148,246,0.28)";

  const textColor = isOwn
    ? item.hasReacted
      ? "#FFFFFF"
      : "rgba(255,255,255,0.82)"
    : item.hasReacted
      ? COLORS.primary
      : COLORS.textMuted;

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Реакція ${item.emoji}, ${item.count}`}
        onPress={onToggle}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 14,
          borderWidth: 1,
          backgroundColor,
          borderColor,
          shadowColor: item.hasReacted
            ? isOwn
              ? "#FFFFFF"
              : COLORS.primary
            : "transparent",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: isOwn
            ? item.hasReacted
              ? 0.35
              : 0
            : item.hasReacted
              ? 0.5
              : 0,
          shadowRadius: 6,
          elevation: item.hasReacted ? 3 : 0,
        }}
      >
        <Text style={{ fontSize: 12 }}>{item.emoji}</Text>
        <Text
          style={{
            color: textColor,
            fontSize: 10,
            fontFamily: FONTS.bodyBold,
          }}
        >
          {item.count}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  audioUrl,
  duration = 0,
  waveform,
  isMine = false,
  reactions,
  onToggleReaction,
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

  const speedBgColor = isMine
    ? currentSpeed > 1.0
      ? "#FFFFFF"
      : "rgba(0,0,0,0.25)"
    : currentSpeed > 1.0
      ? COLORS.primary
      : COLORS.surfaceLight;

  const speedBorderColor = isMine
    ? currentSpeed > 1.0
      ? "#FFFFFF"
      : "rgba(255,255,255,0.35)"
    : currentSpeed > 1.0
      ? COLORS.primary
      : COLORS.surfaceLight;

  const speedTextColor = isMine
    ? currentSpeed > 1.0
      ? COLORS.primary
      : "#FFFFFF"
    : currentSpeed > 1.0
      ? "#FFFFFF"
      : COLORS.textMuted;

  const hasReactions = !!reactions && reactions.length > 0;

  return (
    <View>
      <View className="flex-row items-center my-1 w-64">
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

        <TouchableOpacity
          onPress={handleCycleSpeed}
          activeOpacity={0.7}
          style={{
            marginLeft: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 10,
            borderWidth: 1,
            backgroundColor: speedBgColor,
            borderColor: speedBorderColor,
          }}
        >
          <Text
            style={{
              color: speedTextColor,
              fontSize: 10,
              fontFamily: FONTS.bodyBold,
            }}
          >
            {currentSpeed}x
          </Text>
        </TouchableOpacity>
      </View>

      {hasReactions && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 4,
            marginTop: 6,
            justifyContent: isMine ? "flex-end" : "flex-start",
          }}
        >
          {reactions!.map((item) => (
            <ReactionPill
              key={item.emoji}
              item={item}
              isOwn={isMine}
              onToggle={() => onToggleReaction?.(item.emoji)}
            />
          ))}
        </View>
      )}
    </View>
  );
};