import { PREMIUM_GOLD } from "@/constants/premium";
import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { StyleProp, Text, View, ViewStyle } from "react-native";

/** Золота зірка Premium. */
export const PremiumStar = memo(function PremiumStar({ size = 14 }: { size?: number }) {
  return <Ionicons name="star" size={size} color={PREMIUM_GOLD} />;
});

/**
 * Значки поруч з іменем: ⭐ (premium) і емодзі-статус. Рендерить нічого, якщо користувач не premium
 * (сервер у такому разі й так не віддає емодзі).
 */
export const NameBadges = memo(function NameBadges({
  premium,
  emoji,
  size = 14,
  style,
}: {
  premium?: boolean;
  emoji?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  if (!premium) return null;
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", marginLeft: 5, flexShrink: 0 }, style]}>
      {emoji ? (
        <Text style={{ fontSize: size, lineHeight: Math.round(size * 1.25), marginRight: 3 }}>{emoji}</Text>
      ) : null}
      <PremiumStar size={size} />
    </View>
  );
});
