import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { COLORS } from "@/constants/theme";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { TypingDots } from "@/components/TypingDots";
import {
  SwipeableMessageItem,
  MessageItemData,
} from "@/components/SwipeableMessageItem";
import { ReplyPreviewBar, ReplyTarget } from "@/components/ReplyPreviewBar";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const router = useRouter();

  const chatRoomId = id as Id<"chatRooms">;

  const room = useQuery(api.rooms.getRoom, {
    roomId: chatRoomId,
  });

  const { results: messages, status, loadMore } = usePaginatedQuery(
    api.messages.getPaginatedMessages,
    {
      chatRoomId,
    },
    {
      initialNumItems: 25,
    },
  );

  const currentUser = useQuery(api.users.currentUser);

  const typingUsers = useQuery(api.typing.getTypingUsers, {
    chatRoomId,
  });

  const sendMessage = useMutation(api.messages.sendMessage);
  const sendMediaMessage = useMutation(api.messages.sendMediaMessage);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const editMessage = useMutation(api.messages.editMessage);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const setTyping = useMutation(api.typing.setTyping);

  const [inputText, setInputText] = useState("");
  const [editingMessageId, setEditingMessageId] =
    useState<Id<"messages"> | null>(null);

  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const sendButtonScale = useSharedValue(1);

  const flatListRef = useRef<FlatList>(null);
  const lastTypingCallRef = useRef<number>(0);

  const sendButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
  }));

  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);

      const now = Date.now();

      if (now - lastTypingCallRef.current > 1500) {
        lastTypingCallRef.current = now;

        setTyping({
          chatRoomId,
        }).catch(() => {});
      }
    },
    [chatRoomId, setTyping],
  );

  const pickImage = useCallback(async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Дозвіл потрібен",
          "Надайте доступ до медіатеки для надсилання фотографій.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setSelectedImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error(error);

      Alert.alert("Помилка", "Не вдалося вибрати зображення");
    }
  }, []);

  const handleStartReply = useCallback((message: MessageItemData) => {
    setReplyTarget({
      messageId: message._id,
      senderName: message.senderName,
      text: message.content || (message.imageUrl ? "📷 Фотографія" : ""),
    });

    setEditingMessageId(null);
  }, []);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();

    if ((!text && !selectedImageUri) || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingMessageId) {
        await editMessage({
          messageId: editingMessageId,
          content: text,
        });

        setEditingMessageId(null);
      } else if (selectedImageUri) {
        const uploadUrl = await generateUploadUrl();

        const file = new File(selectedImageUri);

        const uploadResult = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "image/jpeg",
          },
          body: file,
        });

        if (!uploadResult.ok) {
          const errorText = await uploadResult.text();

          throw new Error(
            `Upload failed: ${uploadResult.status} ${errorText}`,
          );
        }

        const uploadData = await uploadResult.json();
        const storageId = uploadData?.storageId;

        if (!storageId) {
          console.error("Upload response:", uploadData);
          throw new Error("Сервер не повернув storageId");
        }

        await sendMediaMessage({
          chatRoomId,
          storageId: storageId as Id<"_storage">,
          caption: text || undefined,
          replyToId: replyTarget
            ? (replyTarget.messageId as Id<"messages">)
            : undefined,
          replyToSender: replyTarget?.senderName,
          replyToText: replyTarget?.text,
        });

        setSelectedImageUri(null);
        setReplyTarget(null);
      } else {
        await sendMessage({
          chatRoomId,
          content: text,
          replyToId: replyTarget
            ? (replyTarget.messageId as Id<"messages">)
            : undefined,
          replyToSender: replyTarget?.senderName,
          replyToText: replyTarget?.text,
        });

        setReplyTarget(null);
      }

      setInputText("");
    } catch (error) {
      console.error(error);

      Alert.alert("Помилка", "Не вдалося надіслати повідомлення");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    chatRoomId,
    editMessage,
    editingMessageId,
    generateUploadUrl,
    inputText,
    isSubmitting,
    replyTarget,
    selectedImageUri,
    sendMediaMessage,
    sendMessage,
  ]);

  const handleMessageLongPress = useCallback(
    (item: MessageItemData) => {
      const isOwn = item.senderId === currentUser?._id;

      const options: any[] = [
        {
          text: "Відповісти",
          onPress: () => handleStartReply(item),
        },
      ];

      if (isOwn) {
        if (item.content) {
          options.push({
            text: "Редагувати",
            onPress: () => {
              setEditingMessageId(item._id);
              setInputText(item.content || "");
              setReplyTarget(null);
            },
          });
        }

        options.push({
          text: "Видалити",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Видалити повідомлення?",
              "Ви впевнені, що хочете видалити повідомлення?",
              [
                {
                  text: "Скасувати",
                  style: "cancel",
                },
                {
                  text: "Так, видалити",
                  style: "destructive",
                  onPress: () =>
                    deleteMessage({
                      messageId: item._id,
                    }),
                },
              ],
            );
          },
        });
      }

      options.push({
        text: "Скасувати",
        style: "cancel",
      });

      Alert.alert("Дії з повідомленням", undefined, options);
    },
    [currentUser?._id, deleteMessage, handleStartReply],
  );

  const renderMessageItem = useCallback(
    ({ item }: { item: MessageItemData }) => (
      <SwipeableMessageItem
        item={item}
        isOwn={item.senderId === currentUser?._id}
        onLongPress={() => handleMessageLongPress(item)}
        onReply={handleStartReply}
        onImagePress={setFullscreenImage}
        onAuthorPress={(authorId) =>
          router.push(`/user/${authorId}` as any)
        }
      />
    ),
    [currentUser?._id, handleMessageLongPress, handleStartReply, router],
  );

  const handleLoadMore = useCallback(() => {
    if (status === "CanLoadMore") {
      loadMore(20);
    }
  }, [loadMore, status]);

  const handleScroll = useCallback((event: any) => {
    setShowScrollToBottom(event.nativeEvent.contentOffset.y > 350);
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({
      offset: 0,
      animated: true,
    });
    setShowScrollToBottom(false);
  }, []);

  const renderListEmpty = useCallback(() => {
    if (status === "LoadingFirstPage") {
      return (
        <View
          className="flex-1 items-center justify-center"
          style={{ transform: [{ scaleY: -1 }] }}
        >
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      );
    }

    return (
      <View
        className="flex-1 items-center justify-center px-8"
        style={{ transform: [{ scaleY: -1 }] }}
      >
        <Text className="text-white/60 text-center">
          Повідомлень ще немає
        </Text>
      </View>
    );
  }, [status]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: room?.title ?? "Чат",
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push(`/settings/${chatRoomId}`)}
              className="p-1"
            >
              <Ionicons
                name="information-circle-outline"
                size={24}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          ),
        }}
      />

      <View className="flex-1">
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          inverted={true}
          contentContainerStyle={{
            padding: 16,
          }}
          renderItem={renderMessageItem}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListFooterComponent={
            status === "LoadingMore" ? (
              <View className="py-3">
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={renderListEmpty}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={Platform.OS === "android"}
        />

        {showScrollToBottom && (
          <Animated.View
            entering={ZoomIn.springify()}
            exiting={ZoomOut.duration(150)}
            className="absolute right-4 bottom-4"
          >
            <TouchableOpacity
              onPress={scrollToBottom}
              className="w-11 h-11 rounded-full bg-primary items-center justify-center"
            >
              <Ionicons name="arrow-down" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      {typingUsers && typingUsers.length > 0 ? (
        <TypingDots typingUsers={typingUsers} />
      ) : null}

      {replyTarget && (
        <ReplyPreviewBar
          replyTarget={replyTarget}
          onCancel={() => setReplyTarget(null)}
        />
      )}

      {editingMessageId && (
        <View className="flex-row items-center justify-between px-4 py-2 bg-surfaceLight border-t border-surface">
          <View className="flex-row items-center flex-1 mr-2">
            <Ionicons
              name="pencil"
              size={16}
              color={COLORS.primary}
              style={{ marginRight: 6 }}
            />

            <Text className="text-white text-xs font-semibold">
              Редагування повідомлення
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              setEditingMessageId(null);
              setInputText("");
            }}
          >
            <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {selectedImageUri && (
        <View className="flex-row items-center px-4 py-2 bg-surfaceLight border-t border-surface">
          <Image
            source={{
              uri: selectedImageUri,
            }}
            className="w-12 h-12 rounded-lg mr-3"
          />

          <Text className="text-white text-xs flex-1">Фото прикріплено</Text>

          <TouchableOpacity onPress={() => setSelectedImageUri(null)}>
            <Ionicons name="close-circle" size={22} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      )}

      <View className="flex-row items-center p-3 bg-surface border-t border-surfaceLight">
        <TouchableOpacity
          onPress={pickImage}
          disabled={isSubmitting}
          className="mr-2 p-2 rounded-full bg-surfaceLight"
        >
          <Ionicons name="image-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>

        <TextInput
          className="flex-1 bg-background text-white px-4 py-2.5 rounded-full text-base border border-surfaceLight mr-2"
          placeholder={
            editingMessageId
              ? "Змініть текст..."
              : replyTarget
                ? `Відповідь для ${replyTarget.senderName}...`
                : selectedImageUri
                  ? "Додайте підпис до фото..."
                  : "Напишіть повідомлення..."
          }
          placeholderTextColor={COLORS.textMuted}
          value={inputText}
          onChangeText={handleTextChange}
          multiline
        />

        <Animated.View style={sendButtonAnimatedStyle}>
          <TouchableOpacity
            onPress={handleSend}
            onPressIn={() => {
              sendButtonScale.value = withSpring(0.86);
            }}
            onPressOut={() => {
              sendButtonScale.value = withSpring(1);
            }}
            disabled={(!inputText.trim() && !selectedImageUri) || isSubmitting}
            className={`w-11 h-11 rounded-full items-center justify-center bg-primary ${
              (!inputText.trim() && !selectedImageUri) || isSubmitting
                ? "opacity-50"
                : "active:opacity-80"
            }`}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons
                name={editingMessageId ? "checkmark" : "send"}
                size={20}
                color="#FFFFFF"
              />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      <ImageViewerModal
        visible={!!fullscreenImage}
        imageUrl={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
      />
    </KeyboardAvoidingView>
  );
}
