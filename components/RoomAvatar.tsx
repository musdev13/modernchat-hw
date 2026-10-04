import { avatarColor, initialsOf } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { StyleProp, Text, View, ViewStyle } from "react-native";

interface Props {
  title: string;
  imageUrl?: string | null;
  size: number;
  style?: StyleProp<ViewStyle>;
  /** «Збережене»: акцентне коло із закладкою замість літери. */
  saved?: boolean;
}

/** Аватар кімнати: фото, а якщо його немає (або воно не завантажилось) — кольорова літера. */
export function RoomAvatar({ title, imageUrl, size, style, saved }: Props) {
  const [failed, setFailed] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (saved) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
          },
          style,
        ]}
      >
        <Ionicons name="bookmark" size={Math.round(size * 0.5)} color={colors.onAccent} />
      </View>
    );
  }

  if (imageUrl && !failed) {
    return (
      <Image
        source={{ uri: imageUrl }}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={imageUrl}
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
