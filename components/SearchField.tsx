import { useChatPalette } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { StyleProp, TextInput, TouchableOpacity, View, ViewStyle } from "react-native";

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Поле пошуку в стилі Telegram (закруглене, у кольорах теми, з кнопкою очищення). */
export function SearchField({ value, onChangeText, placeholder, autoFocus, style }: Props) {
  const c = useChatPalette();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: c.search,
          borderRadius: 12,
          paddingHorizontal: 12,
          height: 40,
        },
        style,
      ]}
    >
      <Ionicons name="search" size={18} color={c.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
        returnKeyType="search"
        style={{ flex: 1, color: c.text, fontSize: 15, marginLeft: 8, paddingVertical: 0 }}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText("")}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Очистити пошук"
        >
          <Ionicons name="close-circle" size={18} color={c.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
}
