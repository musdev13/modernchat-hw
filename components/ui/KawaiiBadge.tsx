import { FONTS } from "@/constants/theme";
import React from "react";
import { StyleProp, Text, View, ViewStyle } from "react-native";

interface KawaiiBadgeProps {
  label: string;
  variant?: "primary" | "accent" | "danger" | "success" | "gold";
  icon?: string; // эмодзи
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
}

const COLORS_MAP = {
  primary: { bg: "rgba(255,143,180,0.18)", text: "#FFB3CB" },
  accent: { bg: "rgba(126,232,250,0.18)", text: "#7EE8FA" },
  danger: { bg: "rgba(255,92,122,0.18)", text: "#FF5C7A" },
  success: { bg: "rgba(74,222,128,0.18)", text: "#4ADE80" },
  gold: { bg: "rgba(255,209,102,0.18)", text: "#FFD166" },
};

export const KawaiiBadge: React.FC<KawaiiBadgeProps> = ({
  label,
  variant = "primary",
  icon,
  size = "sm",
  style,
}) => {
  const colors = COLORS_MAP[variant];
  const fontSize = size === "sm" ? 10 : 12;
  const padding = size === "sm" ? { px: 8, py: 3 } : { px: 10, py: 5 };

  return (
    <View
      style={[
        {
          backgroundColor: colors.bg,
          borderRadius: 999,
          paddingHorizontal: padding.px,
          paddingVertical: padding.py,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
      {icon && <Text style={{ fontSize: fontSize + 2 }}>{icon}</Text>}
      <Text
        style={{
          color: colors.text,
          fontFamily: FONTS.bodyBold,
          fontSize,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </View>
  );
};