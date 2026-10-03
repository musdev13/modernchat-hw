import { FONTS } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
    ActivityIndicator,
    Text,
    TouchableOpacity
} from "react-native";
import { KawaiiGradient } from "./KawaiiGradient";

interface KawaiiButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "accent";
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
}

export const KawaiiButton: React.FC<KawaiiButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  size = "md",
}) => {
  const height = size === "sm" ? 44 : size === "lg" ? 60 : 54;
  const fontSize = size === "sm" ? 14 : size === "lg" ? 18 : 16;
  const iconSize = size === "sm" ? 18 : size === "lg" ? 24 : 20;

  const handlePress = () => {
    if (disabled || loading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      disabled={disabled || loading}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <KawaiiGradient
        variant={variant}
        glow={!disabled}
        style={{
          height,
          borderRadius: height / 2,
          paddingHorizontal: 24,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          alignSelf: fullWidth ? "stretch" : "flex-start",
          gap: 8,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            {icon && <Ionicons name={icon} size={iconSize} color="#FFFFFF" />}
            <Text
              style={{
                color: "#FFFFFF",
                fontFamily: FONTS.bodyBold,
                fontSize,
                letterSpacing: 0.3,
              }}
            >
              {title}
            </Text>
          </>
        )}
      </KawaiiGradient>
    </TouchableOpacity>
  );
};