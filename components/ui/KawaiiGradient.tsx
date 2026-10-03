import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";

interface KawaiiGradientProps {
  variant?: "primary" | "accent" | "bubble-mine" | "bubble-other" | "surface";
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  className?: string;
  children?: React.ReactNode;
}

const GRADIENTS: Record<string, readonly [string, string, ...string[]]> = {
  primary: ["#FF8FB4", "#B794F6"],
  accent: ["#7EE8FA", "#B794F6"],
  "bubble-mine": ["#FF8FB4", "#E56B9A"],
  "bubble-other": ["#2E2540", "#241D33"],
  surface: ["#2A2238", "#1F1928"],
};

export const KawaiiGradient: React.FC<KawaiiGradientProps> = ({
  variant = "primary",
  glow = false,
  style,
  className,
  children,
}) => {
  const glowColor = variant === "accent" ? "#7EE8FA" : "#FF8FB4";

  return (
    <View
      className={className}
      style={[
        glow && {
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.45,
          shadowRadius: 16,
          elevation: 12,
        },
      ]}
    >
      <LinearGradient
        colors={GRADIENTS[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={style}
      >
        {children}
      </LinearGradient>
    </View>
  );
};