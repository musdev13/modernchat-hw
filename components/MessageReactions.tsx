import { Pressable, Text, View } from "react-native";
import { getThemeColors, useAppTheme } from "@/components/AppThemeProvider";

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
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Реакція ${item.emoji}, ${item.count}`}
      onPress={onToggle}
      style={{
        minHeight: 28,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 14,
        borderWidth: item.hasReacted ? 1.5 : 1,
        backgroundColor: item.hasReacted
          ? `${colors.primary}47`
          : "rgba(255, 255, 255, 0.08)",
        borderColor: item.hasReacted
          ? colors.primary
          : "rgba(255, 255, 255, 0.28)",
      }}
    >
      <Text style={{ fontSize: 14 }}>{item.emoji}</Text>
      <Text
        style={{
          color: item.hasReacted ? colors.white : colors.textMuted,
          fontSize: 11,
          fontWeight: "700",
        }}
      >
        {item.count}
      </Text>
    </Pressable>
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
