import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Ряд круглих кнопок дій під шапкою профілю. */
export function ActionButtons({
  items,
}: {
  items: { key: string; icon: IconName; label: string; onPress: () => void }[];
}) {
  const c = useChatPalette();
  if (items.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: 8, paddingBottom: 4 }}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          activeOpacity={0.7}
          onPress={item.onPress}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          style={{
            flex: 1,
            marginHorizontal: 4,
            paddingVertical: 12,
            borderRadius: 16,
            backgroundColor: c.header,
            alignItems: "center",
          }}
        >
          <Ionicons name={item.icon} size={24} color={c.accent} />
          <Text
            numberOfLines={1}
            style={{ color: c.accent, fontSize: 12, fontWeight: "600", marginTop: 5 }}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Блок-секція на всю ширину (фон c.header) з необов'язковим заголовком. */
export function Section({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const c = useChatPalette();
  return (
    <View style={{ backgroundColor: c.header, marginTop: 10 }}>
      {title ? (
        <Text
          style={{
            color: c.accent,
            fontSize: 14,
            fontWeight: "700",
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 4,
          }}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** Рядок інформації у стилі Telegram: значення зверху, підпис знизу. */
export function InfoRow({
  icon,
  value,
  label,
  placeholder,
  onPress,
  onLongPress,
  first,
}: {
  icon: IconName;
  value?: string;
  label: string;
  /** Показується замість значення, коли його немає (рядок тоді викликає onPress). */
  placeholder?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  first?: boolean;
}) {
  const c = useChatPalette();
  const empty = !value;
  return (
    <TouchableOpacity
      activeOpacity={onPress || onLongPress ? 0.6 : 1}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 11,
        minHeight: 58,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.divider,
      }}
    >
      <Ionicons name={icon} size={22} color={c.muted} />
      <View style={{ flex: 1, marginLeft: 18 }}>
        <Text
          style={{
            color: empty ? c.accent : c.text,
            fontSize: 16,
            lineHeight: 22,
          }}
        >
          {empty ? placeholder : value}
        </Text>
        <Text style={{ color: c.muted, fontSize: 13, marginTop: 1 }}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

/** Дві (або більше) картки зі статистикою в рядок. */
export function StatsRow({ items }: { items: { value: number | string; label: string }[] }) {
  const c = useChatPalette();
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 14 }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={{
            flex: 1,
            marginHorizontal: 4,
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: "center",
            backgroundColor: withAlpha(c.accent, 0.1),
          }}
        >
          <Text style={{ color: c.text, fontSize: 24, fontWeight: "700" }}>{item.value}</Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 3 }}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
