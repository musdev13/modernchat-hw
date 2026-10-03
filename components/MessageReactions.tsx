import { COLORS, FONTS } from "@/constants/theme";
import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";

export interface ReactionItem {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

type Props = {
  reactions?: ReactionItem[];
  isOwn: boolean;
  onToggleReaction: (emoji: string) => void;
};

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

export function MessageReactions({
  reactions,
  isOwn,
  onToggleReaction,
}: Props) {
  if (!reactions?.length) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
        marginTop: 6,
        justifyContent: isOwn ? "flex-end" : "flex-start",
      }}
    >
      {reactions.map((item) => (
        <ReactionPill
          key={item.emoji}
          item={item}
          isOwn={isOwn}
          onToggle={() => onToggleReaction(item.emoji)}
        />
      ))}
    </View>
  );
}