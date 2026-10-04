import { avatarColor, initialsOf } from "@/constants/theme";
import { useEffect, useState } from "react";
import { Image, StyleProp, Text, View, ViewStyle } from "react-native";

interface Props {
  title: string;
  imageUrl?: string | null;
  size: number;
  style?: StyleProp<ViewStyle>;
}

/** Аватар кімнати: фото, а якщо його немає (або воно не завантажилось) — кольорова літера. */
export function RoomAvatar({ title, imageUrl, size, style }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (imageUrl && !failed) {
    return (
      <Image
        source={{ uri: imageUrl }}
        resizeMode="cover"
        onError={() => setFailed(true)}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: avatarColor(title),
          },
          style as any,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: avatarColor(title),
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontWeight: "700",
          fontSize: Math.round(size * 0.36),
        }}
      >
        {initialsOf(title)}
      </Text>
    </View>
  );
}
