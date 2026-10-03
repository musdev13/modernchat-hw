import { COLORS } from "@/constants/theme";
import React from "react";
import { Image, Text, View } from "react-native";

interface KawaiiAvatarProps {
  uri?: string;
  name?: string;
  size?: number;
  /** Обводка вокруг аватара */
  ring?: "none" | "primary" | "accent" | "creator";
  /** Онлайн-индикатор (зелёная точка) */
  online?: boolean;
}

const RING_COLORS: Record<string, string> = {
  primary: "#FF8FB4",
  accent: "#7EE8FA",
  creator: "#FFD166",
};

export const KawaiiAvatar: React.FC<KawaiiAvatarProps> = ({
  uri,
  name,
  size = 48,
  ring = "none",
  online = false,
}) => {
  const ringColor = ring !== "none" ? RING_COLORS[ring] : null;
  const borderWidth = ring !== "none" ? 2.5 : 0;
  const initial = (name ?? "?").slice(0, 1).toUpperCase();

  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      {/* Кольцо свечения */}
      {ringColor && (
        <View
          style={{
            position: "absolute",
            top: -borderWidth,
            left: -borderWidth,
            width: size + borderWidth * 2,
            height: size + borderWidth * 2,
            borderRadius: (size + borderWidth * 2) / 2,
            borderWidth,
            borderColor: ringColor,
            shadowColor: ringColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.7,
            shadowRadius: 8,
            elevation: 6,
          }}
        />
      )}

      {/* Сам аватар */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: "#3A2E4D",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={{
              color: COLORS.primary,
              fontWeight: "800",
              fontSize: size * 0.42,
            }}
          >
            {initial}
          </Text>
        )}
      </View>

      {/* Онлайн-индикатор */}
      {online && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: size * 0.14,
            backgroundColor: "#4ADE80",
            borderWidth: 2,
            borderColor: COLORS.background,
          }}
        />
      )}
    </View>
  );
};