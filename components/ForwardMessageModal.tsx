import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface ForwardMessageModalProps {
  visible: boolean;
  messageId: Id<"messages"> | null;
  sourceRoomId: Id<"chatRooms">;
  onClose: () => void;
}

export function ForwardMessageModal({
  visible,
  messageId,
  sourceRoomId,
  onClose,
}: ForwardMessageModalProps) {
  const rooms = useQuery(api.rooms.listRooms);
  const forwardMessage = useMutation(api.messages.forwardMessage);
  const [sendingToRoomId, setSendingToRoomId] =
    useState<Id<"chatRooms"> | null>(null);
  const targets = rooms?.filter((room) => room._id !== sourceRoomId);

  const handleForward = async (targetRoomId: Id<"chatRooms">) => {
    if (!messageId) return;
    setSendingToRoomId(targetRoomId);
    try {
      await forwardMessage({ messageId, targetRoomId });
      onClose();
    } catch (error) {
      console.error("Не вдалося переслати повідомлення:", error);
      Alert.alert(
        "Помилка",
        error instanceof Error
          ? error.message
          : "Не вдалося переслати повідомлення.",
      );
    } finally {
      setSendingToRoomId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/65">
        <View className="max-h-[75%] rounded-t-3xl border-t border-surfaceLight bg-background px-5 pb-8 pt-5">
          <View className="mb-4 flex-row items-center justify-between">
            <View>
              <Text className="text-xl font-bold text-white">
                Переслати повідомлення
              </Text>
              <Text className="mt-1 text-xs text-textMuted">
                Обери кімнату призначення
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={sendingToRoomId !== null}
              className="h-9 w-9 items-center justify-center rounded-full bg-surface"
            >
              <Ionicons name="close" size={21} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {rooms === undefined ? (
            <View className="h-28 items-center justify-center">
              <ActivityIndicator color="#A78BFA" />
            </View>
          ) : targets?.length ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {targets.map((room) => {
                const isSending = sendingToRoomId === room._id;
                return (
                  <TouchableOpacity
                    key={room._id}
                    onPress={() => void handleForward(room._id)}
                    disabled={sendingToRoomId !== null}
                    className="mb-2 flex-row items-center rounded-2xl border border-surfaceLight bg-surface px-3 py-3"
                    accessibilityRole="button"
                    accessibilityLabel={`Переслати в ${room.title}`}
                  >
                    {room.avatarUrl ? (
                      <Image
                        source={{ uri: room.avatarUrl }}
                        className="h-11 w-11 rounded-2xl"
                      />
                    ) : (
                      <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
                        <Ionicons
                          name="chatbubbles-outline"
                          size={20}
                          color="#A78BFA"
                        />
                      </View>
                    )}
                    <Text
                      numberOfLines={1}
                      className="ml-3 flex-1 font-semibold text-white"
                    >
                      {room.title}
                    </Text>
                    {isSending ? (
                      <ActivityIndicator color="#A78BFA" />
                    ) : (
                      <Ionicons
                        name="arrow-redo-outline"
                        size={19}
                        color="#A78BFA"
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View className="items-center justify-center py-9">
              <Ionicons
                name="chatbubbles-outline"
                size={34}
                color="#A78BFA"
              />
              <Text className="mt-3 text-center text-sm text-textMuted">
                Немає інших кімнат, у яких ти можеш переслати це повідомлення.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
