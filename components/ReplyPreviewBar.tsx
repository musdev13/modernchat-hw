import { COLORS, FONTS } from "@/constants/theme";
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
  return (
    <Animated.View
      entering={SlideInDown.duration(250)}
      exiting={SlideOutDown.duration(200)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: "rgba(36,29,51,0.95)",
        borderTopWidth: 1,
        borderTopColor: "rgba(255,143,180,0.2)",
      }}
    >
      <View
        style={{
          width: 3,
          height: "100%",
          minHeight: 34,
          borderRadius: 2,
          backgroundColor: COLORS.primary,
          marginRight: 10,
        }}
      />
      <View style={{ flex: 1, marginRight: 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginBottom: 2,
          }}
        >
          <Ionicons name="arrow-undo" size={12} color={COLORS.primary} />
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              color: COLORS.primary,
            }}
          >
            Відповідь для {replyTarget.senderName}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: FONTS.body,
            fontSize: 12,
            color: COLORS.textMuted,
          }}
        >
          {replyTarget.text || "📷 Зображення"}
        </Text>
      </View>
      <TouchableOpacity onPress={onCancel} style={{ padding: 4 }}>
        <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
};