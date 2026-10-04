import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
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
  /** Довге натискання на пілюлю — показати, хто відреагував. */
  onLongPressReaction?: () => void;
};

function ReactionPill({
  item,
  isOwn,
  onToggle,
  onLongPress,
}: {
  item: ReactionItem;
  isOwn: boolean;
  onToggle: () => void;
  onLongPress?: () => void;
}) {
  const c = useChatPalette();
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

  // У власній бульбашці (колір акценту) пілюлі світлі, у чужій — акцентні.
  const idleBg = isOwn ? withAlpha(c.onAccent, 0.2) : withAlpha(c.accent, 0.14);
  const activeBg = isOwn ? c.onAccent : c.accent;
  const idleText = isOwn ? c.onAccent : c.accent;
  const activeText = isOwn ? c.accent : c.onAccent;

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Реакція ${item.emoji}, ${item.count}`}
        onPress={onToggle}
        onLongPress={onLongPress}
        delayLongPress={300}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 14,
          backgroundColor: item.hasReacted ? activeBg : idleBg,
        }}
      >
        <Text style={{ fontSize: 14 }}>{item.emoji}</Text>
        <Text
          style={{
            color: item.hasReacted ? activeText : idleText,
            fontSize: 12,
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
  onLongPressReaction,
}: Props) {
  if (!reactions?.length) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
        marginTop: 6,
      }}
    >
      {reactions.map((item) => (
        <ReactionPill
          key={item.emoji}
          item={item}
          isOwn={isOwn}
          onToggle={() => onToggleReaction(item.emoji)}
          onLongPress={onLongPressReaction}
        />
      ))}
    </View>
  );
}
