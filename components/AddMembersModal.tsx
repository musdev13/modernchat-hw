import { COLORS } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
      <View className="flex-1 justify-end bg-black/70">
        <View className="h-[80%] rounded-t-3xl border-t border-surfaceLight bg-surface p-4">
          <View className="flex-row items-center justify-between border-b border-surfaceLight pb-3">
            <TouchableOpacity onPress={close} className="p-1">
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-white">Додати учасників</Text>
            <TouchableOpacity
              onPress={submit}
              disabled={!selected.length || submitting}
              className={`rounded-full px-3 py-1.5 ${selected.length ? "bg-primary" : "opacity-40"}`}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-xs font-bold text-white">Додати ({selected.length})</Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="my-3 flex-row items-center rounded-xl bg-secondary px-3 py-2">
            <Ionicons name="search" size={18} color={COLORS.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Пошук користувачів"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              className="ml-2 flex-1 text-sm text-white"
            />
          </View>

          {users === undefined ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              data={available}
              keyExtractor={(item) => item._id}
              ListEmptyComponent={
                <Text className="mt-10 text-center text-sm text-textMuted">
                  Немає доступних користувачів
                </Text>
              }
              renderItem={({ item }) => {
                const checked = selected.includes(item._id);
                return (
                  <TouchableOpacity
                    onPress={() => toggle(item._id)}
                    className="flex-row items-center border-b border-surfaceLight/50 px-2 py-3"
                  >
                    {item.image ? (
                      <Image
                        source={{ uri: item.image }}
                        className="mr-3 h-10 w-10 rounded-full bg-surfaceLight"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-surfaceLight">
                        <Text className="font-bold text-primary">
                          {item.name.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View className="flex-1">
                      <Text className="font-semibold text-white">
                        {item.name} {item.profileEmoji}
                      </Text>
                      <Text className="text-xs text-textMuted">
                        {item.username ? `@${item.username}` : ""}
                      </Text>
                    </View>

                    <View
                      className={`h-6 w-6 items-center justify-center rounded-full border ${
                        checked ? "border-primary bg-primary" : "border-textMuted"
                      }`}
                    >
                      {checked && <Ionicons name="checkmark" size={16} color="#fff" />}
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