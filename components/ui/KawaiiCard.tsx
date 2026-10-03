import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";

interface KawaiiCardProps {
  variant?: "flat" | "glass" | "accent";
  style?: StyleProp<ViewStyle>;
  className?: string;
  children?: React.ReactNode;
}

export const KawaiiCard: React.FC<KawaiiCardProps> = ({
  variant = "glass",
  style,
  className,
  children,
}) => {
  const variants = {
    flat: {
      backgroundColor: "#241D33",
      borderColor: "rgba(183,148,246,0.12)",
    },
    glass: {
      backgroundColor: "rgba(36, 29, 51, 0.75)",
      borderColor: "rgba(183,148,246,0.18)",
      shadowColor: "#FF8FB4",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    accent: {
      backgroundColor: "rgba(255, 143, 180, 0.1)",
      borderColor: "rgba(255,143,180,0.35)",
      borderWidth: 1.5,
      shadowColor: "#FF8FB4",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 14,
      elevation: 8,
    },
  };

  return (
    <View
      className={className}
      style={[
        {
          borderRadius: 24,
          borderWidth: 1,
          padding: 16,
        },
        variants[variant],
        style,
      ]}
    >
      {children}
    </View>
  );
};