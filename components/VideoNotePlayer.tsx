// components/VideoNotePlayer.tsx
import { COLORS, FONTS } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useEventListener } from "expo";
import * as Haptics from "expo-haptics";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

export interface ReactionItem {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface VideoNotePlayerProps {
  videoUrl: string;
  duration?: number;
  isMine?: boolean;
  reactions?: ReactionItem[];
  onToggleReaction?: (emoji: string) => void;
}

const SPEED_OPTIONS = [1.0, 1.5, 2.0] as const;
const CIRCLE_SIZE = 200;
const STROKE_WIDTH = 3.5;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

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

export const VideoNotePlayer: React.FC<VideoNotePlayerProps> = (props) => {
  const [session, setSession] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  return (
    <View style={{ alignItems: "center" }}>
      <VideoNoteActive
        key={session}
        videoUrl={props.videoUrl}
        duration={props.duration}
        isMine={props.isMine}
        autoPlay={hasStarted}
        onFirstPlay={() => setHasStarted(true)}
        onReplay={() => setSession((s) => s + 1)}
      />

      {props.reactions && props.reactions.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 4,
            marginTop: 6,
            justifyContent: props.isMine ? "flex-end" : "flex-start",
            width: CIRCLE_SIZE,
          }}
        >
          {props.reactions.map((item) => (
            <ReactionPill
              key={item.emoji}
              item={item}
              isOwn={!!props.isMine}
              onToggle={() => props.onToggleReaction?.(item.emoji)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

interface VideoNoteActiveProps extends VideoNotePlayerProps {
  autoPlay: boolean;
  onFirstPlay: () => void;
  onReplay: () => void;
}

const VideoNoteActive: React.FC<VideoNoteActiveProps> = ({
  videoUrl,
  duration = 0,
  isMine = false,
  autoPlay,
  onFirstPlay,
  onReplay,
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

    if (autoPlay) {
      try {
        p.play();
      } catch {}
    }
  });

  useEventListener(player, "playingChange", ({ isPlaying: playing }) => {
    setIsPlaying(playing);
    if (playing) setHasEnded(false);
  });

  useEventListener(player, "playToEnd", () => {
    setHasEnded(true);
    setIsPlaying(false);
    setProgress(1);
  });

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

  const handleTap = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (hasEnded) {
      onReplay();
      return;
    }

    if (player.playing) {
      player.pause();
      return;
    }

    if (!autoPlay) {
      onFirstPlay();
    }
    player.muted = isMuted;
    try {
      player.play();
    } catch (error) {
      console.error("Play error:", error);
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

  const tapGesture = Gesture.Tap()
    .maxDuration(300)
    .onEnd((_event, success) => {
      if (!success) return;
      runOnJS(handleTap)();
    });

  const strokeDashoffset = CIRCUMFERENCE - progress * CIRCUMFERENCE;
  const currentSpeed = SPEED_OPTIONS[speedIndex];
  const showPlayOverlay = isReady && !isPlaying;

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

      <GestureDetector gesture={tapGesture}>
        <View
          style={{
            width: CIRCLE_SIZE - 8,
            height: CIRCLE_SIZE - 8,
            borderRadius: (CIRCLE_SIZE - 8) / 2,
            overflow: "hidden",
            backgroundColor: "#1A1525",
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
              <ActivityIndicator size="large" color={COLORS.primary} />
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
                backgroundColor: "rgba(0,0,0,0.35)",
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
          borderWidth: 1,
          backgroundColor:
            currentSpeed > 1.0 ? COLORS.primary : "rgba(0,0,0,0.6)",
          borderColor:
            currentSpeed > 1.0 ? COLORS.primary : "rgba(255,255,255,0.2)",
        }}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontFamily: FONTS.bodyBold,
            fontSize: 10,
          }}
        >
          {currentSpeed}x
        </Text>
      </TouchableOpacity>
    </View>
  );
};