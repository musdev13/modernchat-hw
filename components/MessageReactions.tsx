import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { COLORS } from "@/constants/theme";

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
}: {
  item: ReactionItem;
  onToggle: () => void;
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
          paddingVertical: 4,
          borderRadius: 16,
          borderWidth: 1,
          backgroundColor: item.hasReacted
            ? "rgba(59, 130, 246, 0.24)"
            : "rgba(255, 255, 255, 0.08)",
          borderColor: item.hasReacted
            ? COLORS.primary
            : "rgba(255, 255, 255, 0.15)",
        }}
      >
        <Text style={{ fontSize: 13 }}>{item.emoji}</Text>
        <Text
          style={{
            color: item.hasReacted ? "#BFDBFE" : COLORS.textMuted,
            fontSize: 11,
            fontWeight: "700",
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
          onToggle={() => onToggleReaction(item.emoji)}
        />
      ))}
    </View>
  );
}
