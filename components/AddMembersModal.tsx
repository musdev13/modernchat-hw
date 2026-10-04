import { Image } from "expo-image";
import { avatarColor, initialsOf } from "@/constants/theme";
import { useChatPalette } from "@/hooks/useChatPalette";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  roomId: Id<"chatRooms">;
  participantIds: Id<"users">[];
  onClose: () => void;
};

export function AddMembersModal({ visible, roomId, participantIds, onClose }: Props) {
  const c = useChatPalette();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Id<"users">[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const users = useQuery(api.users.searchUsers, { query });
  const addParticipants = useMutation(api.rooms.addParticipants);

  const available = useMemo(
    () => (users ?? []).filter((user) => !participantIds.includes(user._id)),
    [participantIds, users],
  );

  const toggle = (id: Id<"users">) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const close = () => {
    setSelected([]);
    setQuery("");
    onClose();
  };

  const submit = async () => {
    if (!selected.length) return;
    try {
      setSubmitting(true);
      await addParticipants({ roomId, participantIds: selected });
      close();
    } catch (error: any) {
      Alert.alert("Помилка", error?.message ?? "Не вдалося додати учасників");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: c.overlay }}>
        <View
          style={{
            height: "80%",
            backgroundColor: c.sheet,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: 1,
              borderBottomColor: c.divider,
              paddingBottom: 12,
            }}
          >
            <TouchableOpacity onPress={close} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={c.text} />
            </TouchableOpacity>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>
              Додати учасників
            </Text>
            <TouchableOpacity
              onPress={submit}
              disabled={!selected.length || submitting}
              style={{
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: selected.length ? c.accent : "transparent",
                opacity: selected.length ? 1 : 0.4,
              }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={c.onAccent} />
              ) : (
                <Text
                  style={{
                    color: selected.length ? c.onAccent : c.muted,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  Додати ({selected.length})
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View
            style={{
              marginVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 20,
              backgroundColor: c.search,
              paddingHorizontal: 12,
              height: 40,
            }}
          >
            <Ionicons name="search" size={18} color={c.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Пошук користувачів"
              placeholderTextColor={c.muted}
              autoCapitalize="none"
              selectionColor={c.accent}
              style={{ marginLeft: 8, flex: 1, color: c.text, fontSize: 15, paddingVertical: 0 }}
            />
          </View>

          {users === undefined ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={c.accent} />
            </View>
          ) : (
            <FlatList
              data={available}
              keyExtractor={(item) => item._id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={{ marginTop: 40, textAlign: "center", fontSize: 14, color: c.muted }}>
                  Немає доступних користувачів
                </Text>
              }
              renderItem={({ item }) => {
                const checked = selected.includes(item._id);
                return (
                  <TouchableOpacity
                    onPress={() => toggle(item._id)}
                    activeOpacity={0.6}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 4,
                      paddingVertical: 9,
                    }}
                  >
                    {item.image ? (
                      <Image
                        source={{ uri: item.image }}
                        style={{ marginRight: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: c.search }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        recyclingKey={item._id}
                      />
                    ) : (
                      <View
                        style={{
                          marginRight: 12,
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: avatarColor(item.name),
                        }}
                      >
                        <Text style={{ fontWeight: "700", color: "#FFFFFF" }}>
                          {initialsOf(item.name)}
                        </Text>
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
                        {item.name}
                      </Text>
                      {item.username ? (
                        <Text style={{ color: c.muted, fontSize: 13 }}>@{item.username}</Text>
                      ) : null}
                    </View>

                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1.5,
                        borderColor: checked ? c.accent : c.muted,
                        backgroundColor: checked ? c.accent : "transparent",
                      }}
                    >
                      {checked && <Ionicons name="checkmark" size={16} color={c.onAccent} />}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
