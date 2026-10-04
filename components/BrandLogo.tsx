import { Image } from "expo-image";
import { View } from "react-native";

const BRAND_LOGO = require("@/assets/brand/logo.png");

export function BrandLogo({ size = 56 }: { size?: number }) {
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-[20px] bg-surface"
      style={{ width: size, height: size }}
    >
      <Image
        source={BRAND_LOGO}
        contentFit="contain"
        cachePolicy="memory-disk"
        style={{ width: size, height: size }}
        accessibilityLabel="Логотип ModernChat"
      />
    </View>
  );
}
