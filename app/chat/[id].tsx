import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { useState, useRef, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const roomId = id as Id<"chatRooms">;

  const room = useQuery(api.rooms.getRoom, {
    roomId,
  });

  const messages = useQuery(api.messages.listMessages, {
    chatRoomId: roomId,
  });

  const currentUser = useQuery(api.users.currentUser);

  const sendMessage = useMutation(api.messages.sendMessage);

  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const timeout = setTimeout(() => {
      flatListRef.current?.scrollToEnd({
        animated: true,
      });
    }, 100);

    return () => clearTimeout(timeout);
  }, [messages?.length]);

  const handleSend = async () => {
    const text = inputText.trim();

    if (!text || isSending) return;

    setInputText("");
    setIsSending(true);

    try {
      await sendMessage({
        chatRoomId: roomId,
        content: text,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setInputText(text);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return "";

    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (room === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
      </SafeAreaView>
    );
  }

  if (room === null) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center px-6">
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={COLORS.textMuted}
        />

        <Text className="text-white text-lg font-bold mt-3 text-center">
          Кімнату не знайдено
        </Text>

        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary rounded-2xl px-6 py-3 mt-5"
          activeOpacity={0.8}
        >
          <Text className="text-white font-bold">
            Назад
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-surface"
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View className="h-14 flex-row items-center px-4 border-b border-surfaceLight">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-secondary"
            activeOpacity={0.7}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color={COLORS.white}
            />
          </TouchableOpacity>

          <View className="flex-1 ml-3 mr-2">
            <Text
              className="text-white text-base font-bold"
              numberOfLines={1}
            >
              {room.title}
            </Text>

            {room.description ? (
              <Text
                className="text-textMuted text-xs mt-0.5"
                numberOfLines={1}
              >
                {room.description}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={() => router.push(`/settings/${roomId}`)}
            className="w-10 h-10 items-center justify-center rounded-full bg-secondary"
            activeOpacity={0.7}
          >
            <Ionicons
              name="information-circle-outline"
              size={22}
              color={COLORS.white}
            />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        {messages === undefined ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
            />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item._id}
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 16,
              gap: 12,
              flexGrow: messages.length === 0 ? 1 : undefined,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center px-6">
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={42}
                  color={COLORS.textMuted}
                />

                <Text className="text-textMuted text-sm mt-3 text-center">
                  Повідомлень ще немає.
                  {"\n"}
                  Напишіть першим!
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMe =
                currentUser !== undefined &&
                currentUser !== null &&
                item.senderId === currentUser._id;

              return (
                <View
                  className={`flex-row items-end ${
                    isMe
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  {!isMe && (
                    <View className="w-8 h-8 rounded-full bg-secondary border border-surfaceLight items-center justify-center overflow-hidden mr-2 mb-1">
                      {item.senderPhoto ? (
                        <Image
                          source={{ uri: item.senderPhoto }}
                          className="w-full h-full"
                        />
                      ) : (
                        <Text className="text-textMuted text-xs font-bold">
                          {item.senderName[0]?.toUpperCase() ?? "U"}
                        </Text>
                      )}
                    </View>
                  )}

                  <View
                    className={`max-w-[78%] px-4 py-2.5 rounded-2xl ${
                      isMe
                        ? "bg-primary rounded-br-none"
                        : "bg-secondary border border-surfaceLight rounded-bl-none"
                    }`}
                  >
                    {!isMe && (
                      <Text className="text-primary text-xs font-bold mb-1">
                        {item.senderName}
                      </Text>
                    )}

                    <Text className="text-white text-base leading-5">
                      {item.content}
                    </Text>

                    <Text
                      className={`text-[10px] text-right mt-1 ${
                        isMe
                          ? "text-white/70"
                          : "text-textMuted"
                      }`}
                    >
                      {formatTime(item._creationTime)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Message input */}
        <View
          className="flex-row items-end px-4 pt-3 bg-surface border-t border-surfaceLight"
          style={{
            paddingBottom: Math.max(insets.bottom, 10),
          }}
        >
          <TextInput
            className="flex-1 bg-secondary border border-surfaceLight rounded-2xl px-4 py-2.5 text-white text-base min-h-[44px] max-h-28"
            placeholder="Повідомлення..."
            placeholderTextColor={COLORS.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            editable={!isSending}
            textAlignVertical="center"
          />

          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
            className={`w-11 h-11 rounded-2xl items-center justify-center ml-2 ${
              inputText.trim() && !isSending
                ? "bg-primary"
                : "bg-secondary"
            }`}
            activeOpacity={0.8}
          >
            {isSending ? (
              <ActivityIndicator
                size="small"
                color={COLORS.white}
              />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={
                  inputText.trim()
                    ? COLORS.white
                    : COLORS.textMuted
                }
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
