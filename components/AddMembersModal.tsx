import { KawaiiAvatar } from "@/components/ui/KawaiiAvatar";
import { KawaiiGradient } from "@/components/ui/KawaiiGradient";
import { COLORS, FONTS } from "@/constants/theme";
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
  Pressable,
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

export function AddMembersModal({
  visible,
  roomId,
  participantIds,
  onClose,
}: Props) {
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
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.75)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={close} />

        <View
          style={{
            height: "82%",
            backgroundColor: COLORS.background,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderTopWidth: 1,
            borderTopColor: "rgba(255,143,180,0.25)",
            paddingHorizontal: 16,
            paddingTop: 12,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <View
              style={{
                width: 44,
                height: 4,
                borderRadius: 2,
                backgroundColor: "rgba(183,148,246,0.3)",
              }}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(183,148,246,0.15)",
            }}
          >
            <TouchableOpacity
              onPress={close}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(183,148,246,0.15)",
              }}
            >
              <Ionicons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 14 }}>💌</Text>
              <Text
                style={{
                  color: COLORS.text,
                  fontFamily: FONTS.headingBold,
                  fontSize: 16,
                }}
              >
                Додати учасників
              </Text>
            </View>

            <TouchableOpacity
              onPress={submit}
              disabled={!selected.length || submitting}
              activeOpacity={0.85}
            >
              <KawaiiGradient
                variant="primary"
                glow
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  opacity: !selected.length || submitting ? 0.5 : 1,
                }}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="add" size={14} color="#FFFFFF" />
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontFamily: FONTS.bodyBold,
                        fontSize: 11,
                      }}
                    >
                      {selected.length}
                    </Text>
                  </>
                )}
              </KawaiiGradient>
            </TouchableOpacity>
          </View>

          <View
            style={{
              marginTop: 14,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "rgba(183,148,246,0.08)",
              borderWidth: 1,
              borderColor: "rgba(183,148,246,0.22)",
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 4,
            }}
          >
            <Ionicons name="search" size={16} color={COLORS.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Пошук користувачів..."
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              style={{
                marginLeft: 8,
                flex: 1,
                paddingVertical: 10,
                color: COLORS.text,
                fontFamily: FONTS.body,
                fontSize: 13,
              }}
            />
          </View>

          {users === undefined ? (
            <View
              style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            >
              <KawaiiGradient
                variant="primary"
                glow
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ActivityIndicator size="small" color="#FFFFFF" />
              </KawaiiGradient>
            </View>
          ) : (
            <FlatList
              data={available}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ paddingTop: 10, paddingBottom: 24 }}
              ListEmptyComponent={
                <View
                  style={{
                    alignItems: "center",
                    marginTop: 40,
                    paddingHorizontal: 24,
                  }}
                >
                  <Text style={{ fontSize: 40, marginBottom: 8 }}>🌸</Text>
                  <Text
                    style={{
                      textAlign: "center",
                      fontFamily: FONTS.body,
                      fontSize: 13,
                      color: COLORS.textMuted,
                    }}
                  >
                    Немає доступних користувачів
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const checked = selected.includes(item._id);
                return (
                  <TouchableOpacity
                    onPress={() => toggle(item._id)}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 10,
                      paddingHorizontal: 4,
                      borderBottomWidth: 1,
                      borderBottomColor: "rgba(183,148,246,0.1)",
                    }}
                  >
                    <KawaiiAvatar
                      uri={item.image}
                      name={item.name}
                      size={42}
                      ring={checked ? "primary" : "none"}
                    />

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={{
                          color: COLORS.text,
                          fontFamily: FONTS.bodyBold,
                          fontSize: 14,
                        }}
                      >
                        {item.name}
                      </Text>
                      {item.username && (
                        <Text
                          style={{
                            color: COLORS.textMuted,
                            fontFamily: FONTS.body,
                            fontSize: 11,
                            marginTop: 1,
                          }}
                        >
                          @{item.username}
                        </Text>
                      )}
                    </View>

                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        borderWidth: 2,
                        alignItems: "center",
                        justifyContent: "center",
                        borderColor: checked
                          ? COLORS.primary
                          : "rgba(183,148,246,0.4)",
                        backgroundColor: checked
                          ? COLORS.primary
                          : "transparent",
                      }}
                    >
                      {checked && (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      )}
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