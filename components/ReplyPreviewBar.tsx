import { avatarColor } from "@/constants/theme";
import { useChatPalette } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";

export interface ReplyTarget {
  messageId: string;
  senderName: string;
  text: string;
}

interface ReplyPreviewBarProps {
  replyTarget: ReplyTarget;
  onCancel: () => void;
}

export const ReplyPreviewBar: React.FC<ReplyPreviewBarProps> = ({
  replyTarget,
  onCancel,
}) => {
  const c = useChatPalette();

  return (
    <Animated.View
      entering={SlideInDown.duration(200)}
      exiting={SlideOutDown.duration(150)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: c.header,
        borderTopWidth: 1,
        borderTopColor: c.divider,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Ionicons name="arrow-undo" size={22} color={c.accent} />

      <View
        style={{
          flex: 1,
          marginLeft: 12,
          paddingLeft: 8,
          borderLeftWidth: 2,
          borderLeftColor: c.accent,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: avatarColor(replyTarget.senderName),
            fontWeight: "700",
            fontSize: 13,
          }}
        >
          {replyTarget.senderName}
        </Text>
        <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, marginTop: 1 }}>
          {replyTarget.text || "📷 Зображення"}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onCancel}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Скасувати відповідь"
        style={{ padding: 4 }}
      >
        <Ionicons name="close" size={22} color={c.muted} />
      </TouchableOpacity>
    </Animated.View>
  );
};
