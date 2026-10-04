import { RoomAvatar } from "@/components/RoomAvatar";
import { SearchField } from "@/components/SearchField";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette } from "@/hooks/useChatPalette";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (roomId: Id<"chatRooms">) => void;
  /** Заголовок (за замовчуванням «Переслати в…»). */
  title?: string;
  /** Додатковий фільтр чатів. */
  filter?: (room: NonNullable<ReturnType<typeof useRoomList>>[number]) => boolean;
}

function useRoomList(enabled: boolean) {
  return useQuery(api.rooms.listRooms, enabled ? {} : "skip");
}

/** Вибір чату, куди переслати повідомлення (включно зі «Збереженим»). */
export function ForwardSheet({ visible, onClose, onPick, title = "Переслати в…", filter }: Props) {
  const c = useChatPalette();
  const insets = useSafeAreaInsets();
  const rooms = useRoomList(visible);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!rooms) return rooms;
    // У канали, де ви лише підписник, пересилати не можна.
    const allowed = rooms.filter((r) => r.canPost !== false && (!filter || filter(r)));
    return q ? allowed.filter((r) => r.title.toLowerCase().includes(q)) : allowed;
  }, [rooms, search, filter]);

  const close = () => {
    setSearch("");
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      <Pressable
        style={{ flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" }}
        onPress={close}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: c.sheet,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "75%",
            minHeight: 280,
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
            {title}
          </Text>
          <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
            <SearchField value={search} onChangeText={setSearch} placeholder="Пошук чатів" />
          </View>
          {filtered === undefined ? (
            <View style={{ padding: 32 }}>
              <ActivityIndicator color={c.accent} />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(room) => room._id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={{ color: c.muted, textAlign: "center", padding: 28 }}>
                  Нічого не знайдено
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={() => {
                    setSearch("");
                    onPick(item._id);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 18,
                    paddingVertical: 8,
                  }}
                >
                  <RoomAvatar
                    title={item.title}
                    imageUrl={item.avatarUrl}
                    size={44}
                    saved={item.isSaved}
                  />
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, color: c.text, fontSize: 16, marginLeft: 14 }}
                  >
                    {item.title}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
