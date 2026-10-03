import { GlassSurface } from "@/components/Glass";
import { useChatPalette } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

export const PIN_BAR_HEIGHT = 46;

interface PinnedMessageBarProps {
  /** Кількість закріплених повідомлень. */
  count: number;
  /** Номер показаного закріпленого (1 = найстаріше). */
  position: number;
  senderName: string;
  preview: string;
  onPress: () => void;
  onUnpin: () => void;
}

/** Смужка закріпленого повідомлення під шапкою-капсулою (скляна, як шапка). */
export function PinnedMessageBar({
  count,
  position,
  senderName,
  preview,
  onPress,
  onUnpin,
}: PinnedMessageBarProps) {
  const c = useChatPalette();
  const segments = Math.min(count, 4);

  return (
    <GlassSurface
      radius={18}
      intensity={75}
      style={{ height: PIN_BAR_HEIGHT, marginHorizontal: 12 }}
      contentStyle={{ flex: 1, flexDirection: "row", alignItems: "center" }}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Перейти до закріпленого повідомлення"
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          height: PIN_BAR_HEIGHT,
          paddingLeft: 12,
        }}
      >
        {/* Індикатор: скільки закріплених і яке показано */}
        <View style={{ height: 30, width: 3, justifyContent: "space-between" }}>
          {Array.from({ length: segments }, (_, i) => {
            const active =
              segments === 1 ||
              i === Math.min(segments - 1, Math.max(0, position - 1 - (count - segments)));
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  marginVertical: segments > 1 ? 1 : 0,
                  borderRadius: 2,
                  backgroundColor: active ? c.accent : c.muted,
                  opacity: active ? 1 : 0.4,
                }}
              />
            );
          })}
        </View>

        <Ionicons
          name="pin"
          size={16}
          color={c.accent}
          style={{ marginLeft: 10, transform: [{ rotate: "45deg" }] }}
        />

        <View style={{ flex: 1, marginLeft: 8, justifyContent: "center" }}>
          <Text
            numberOfLines={1}
            style={{ color: c.accent, fontSize: 12, fontWeight: "700" }}
          >
            {count > 1
              ? `Закріплене #${position} · ${senderName}`
              : `Закріплене · ${senderName}`}
          </Text>
          <Text numberOfLines={1} style={{ color: c.text, fontSize: 13, opacity: 0.9 }}>
            {preview}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onUnpin}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Відкріпити повідомлення"
        style={{
          width: 42,
          height: PIN_BAR_HEIGHT,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="close" size={20} color={c.muted} />
      </TouchableOpacity>
    </GlassSurface>
  );
}
