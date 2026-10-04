import { RoomAvatar } from "@/components/RoomAvatar";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  messageId: Id<"messages"> | null;
  onClose: () => void;
}

/** Нижній лист «Реакції»: фільтр за емодзі + хто що поставив. */
export function ReactorsSheet({ messageId, onClose }: Props) {
  const c = useChatPalette();
  const insets = useSafeAreaInsets();
  const reactors = useQuery(api.messages.getReactors, messageId ? { messageId } : "skip");
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => setFilter(null), [messageId]);

  const groups = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reactors ?? []) map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1);
    return Array.from(map, ([emoji, count]) => ({ emoji, count })).sort(
      (a, b) => b.count - a.count,
    );
  }, [reactors]);

  const rows = (reactors ?? []).filter((r) => !filter || r.emoji === filter);

  const chip = (key: string, label: string, value: string | null) => {
    const active = filter === value;
    return (
      <TouchableOpacity
        key={key}
        onPress={() => setFilter(value)}
        activeOpacity={0.7}
        style={{
          paddingHorizontal: 14,
          height: 34,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 8,
          backgroundColor: active ? c.accent : withAlpha(c.muted, 0.2),
        }}
      >
        <Text style={{ color: active ? c.onAccent : c.text, fontSize: 14, fontWeight: "600" }}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      transparent
      visible={!!messageId}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={{ flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: c.sheet,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "65%",
            minHeight: 220,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <Text
            style={{
              color: c.text,
              fontSize: 17,
              fontWeight: "700",
              paddingHorizontal: 18,
              paddingTop: 16,
              paddingBottom: 10,
            }}
          >
            Реакції
          </Text>
          {reactors === undefined ? (
            <View style={{ padding: 32 }}>
              <ActivityIndicator color={c.accent} />
            </View>
          ) : (
            <>
              {groups.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0 }}
                  contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 10 }}
                >
                  {chip("all", `Усі ${reactors.length}`, null)}
                  {groups.map((g) => chip(g.emoji, `${g.emoji} ${g.count}`, g.emoji))}
                </ScrollView>
              ) : null}
              <ScrollView>
                {rows.map((r) => (
                  <View
                    key={`${r.userId}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 18,
                      paddingVertical: 8,
                    }}
                  >
                    <RoomAvatar title={r.name} imageUrl={r.image} size={42} />
                    <Text
                      numberOfLines={1}
                      style={{ flex: 1, color: c.text, fontSize: 16, marginLeft: 14 }}
                    >
                      {r.isMe ? `${r.name} (ви)` : r.name}
                    </Text>
                    <Text style={{ fontSize: 22 }}>{r.emoji}</Text>
                  </View>
                ))}
                {rows.length === 0 ? (
                  <Text style={{ color: c.muted, textAlign: "center", padding: 24 }}>
                    Реакцій немає
                  </Text>
                ) : null}
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
