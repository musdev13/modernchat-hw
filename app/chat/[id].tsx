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
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { File } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/constants/theme";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { TypingDots } from "@/components/TypingDots";
import {
  SwipeableMessageItem,
  MessageItemData,
} from "@/components/SwipeableMessageItem";
import { ReplyPreviewBar, ReplyTarget } from "@/components/ReplyPreviewBar";
import {
  ReactionPickerModal,
  ReactionPickerPosition,
} from "@/components/ReactionPickerModal";
import { VideoNoteRecorderModal } from "@/components/VideoNoteRecorderModal";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";

const WAVEFORM_LIVE_HEIGHT = 26;
const LIVE_MIN_BAR_HEIGHT = 4;

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const router = useRouter();

  const chatRoomId = id as Id<"chatRooms">;

  const room = useQuery(api.rooms.getRoom, { roomId: chatRoomId });

  const { results: messages, status, loadMore } = usePaginatedQuery(
    api.messages.getPaginatedMessages,
    { chatRoomId },
    {
      initialNumItems: 25,
    },
  );

  const currentUser = useQuery(api.users.currentUser);

  const typingUsers = useQuery(api.typing.getTypingUsers, { chatRoomId });

  const sendMessage = useMutation(api.messages.sendMessage);
  const sendMediaMessage = useMutation(api.messages.sendMediaMessage);
  const sendVoiceMessage = useMutation(api.messages.sendVoiceMessage);
  const sendVideoNote = useMutation(api.messages.sendVideoNote);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const editMessage = useMutation(api.messages.editMessage);
  const toggleReaction = useMutation(api.messages.toggleReaction);
  const setTyping = useMutation(api.typing.setTyping);

  const [inputText, setInputText] = useState("");
  const [editingMessageId, setEditingMessageId] =
    useState<Id<"messages"> | null>(null);

  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [pickerState, setPickerState] = useState<{
    messageId: Id<"messages">;
    position: ReactionPickerPosition;
  } | null>(null);

  // 🎤/📹 ДЗ 15
  const [inputMode, setInputMode] = useState<"audio" | "video">("audio");
  const [isVideoModalVisible, setIsVideoModalVisible] = useState(false);

  const {
    isRecording,
    durationMillis,
    liveAmplitudes,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecorder();

  const sendButtonScale = useSharedValue(1);
  const insets = useSafeAreaInsets();

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
    let preview = message.content?.trim() ?? "";
    if (!preview) {
      if (message.isVideoNote && message.videoUrl) {
        preview = "📹 Відеоповідомлення";
      } else if (message.audioUrl) {
        const dur = message.audioDuration
          ? ` (${Math.round(message.audioDuration)}с)`
          : "";
        preview = `🎤 Голосове повідомлення${dur}`;
      } else if (message.imageUrl) {
        preview = "📷 Фотографія";
      }
    }

    setReplyTarget({
      messageId: message._id,
      senderName: message.senderName,
      text: preview,
    });

    setEditingMessageId(null);
  }, []);

  const handleToggleReaction = useCallback(
    async (messageId: Id<"messages">, emoji: string) => {
      try {
        await toggleReaction({ messageId, emoji });
      } catch (error) {
        console.error("Не вдалося змінити реакцію:", error);
      }
    },
    [toggleReaction],
  );

  const uploadFile = useCallback(
    async (uri: string, fallbackMime: string): Promise<Id<"_storage">> => {
      const uploadUrl = await generateUploadUrl();
      const file = new File(uri);

      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": file.type || fallbackMime,
        },
        body: file,
      });

      if (!uploadResult.ok) {
        const errorText = await uploadResult.text();
        throw new Error(`Upload failed: ${uploadResult.status} ${errorText}`);
      }

      const uploadData = await uploadResult.json();
      const storageId = uploadData?.storageId;

      if (!storageId) {
        console.error("Upload response:", uploadData);
        throw new Error("Сервер не повернув storageId");
      }

      return storageId as Id<"_storage">;
    },
    [generateUploadUrl],
  );

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
        const storageId = await uploadFile(selectedImageUri, "image/jpeg");

        await sendMediaMessage({
          chatRoomId,
          storageId,
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
    inputText,
    isSubmitting,
    replyTarget,
    selectedImageUri,
    sendMediaMessage,
    sendMessage,
    uploadFile,
  ]);

  // 🎤 ДЗ 15: тап по мікрофону — старт запису
  const handleMicPress = useCallback(async () => {
    if (inputMode === "video") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsVideoModalVisible(true);
      return;
    }

    const started = await startRecording();
    if (!started) {
      Alert.alert(
        "Дозвіл потрібен",
        "Надайте доступ до мікрофона для запису голосових повідомлень.",
      );
    }
  }, [inputMode, startRecording]);

  // 🎤 ДЗ 15: довгий тап — перемикач режиму audio/video
  const handleMicLongPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setInputMode((prev) => (prev === "audio" ? "video" : "audio"));
  }, []);

  // 🎤 ДЗ 15: відправка голосового
  const handleSendVoice = useCallback(async () => {
    try {
      const result = await stopRecording();
      if (!result) return;

      setIsSubmitting(true);

      const storageId = await uploadFile(result.uri, "audio/m4a");

      await sendVoiceMessage({
        chatRoomId,
        audioStorageId: storageId,
        audioDuration: result.durationSeconds,
        waveform: result.waveform,
        replyToId: replyTarget
          ? (replyTarget.messageId as Id<"messages">)
          : undefined,
        replyToSender: replyTarget?.senderName,
        replyToText: replyTarget?.text,
      });

      setReplyTarget(null);
    } catch (error) {
      console.error("Не вдалося надіслати голосове:", error);
      Alert.alert("Помилка", "Не вдалося надіслати голосове повідомлення");
    } finally {
      setIsSubmitting(false);
    }
  }, [chatRoomId, replyTarget, sendVoiceMessage, stopRecording, uploadFile]);

  // 🎤 ДЗ 15: скасування запису
  const handleCancelVoice = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await cancelRecording();
  }, [cancelRecording]);

  // 📹 ДЗ 15: відправка кружечка
  const handleSendVideo = useCallback(
    async (videoUri: string, durationSeconds: number) => {
      try {
        setIsSubmitting(true);

        const storageId = await uploadFile(videoUri, "video/mp4");

        await sendVideoNote({
          chatRoomId,
          videoStorageId: storageId,
          videoDuration: durationSeconds,
          replyToId: replyTarget
            ? (replyTarget.messageId as Id<"messages">)
            : undefined,
          replyToSender: replyTarget?.senderName,
          replyToText: replyTarget?.text,
        });

        setReplyTarget(null);
      } catch (error) {
        console.error("Не вдалося надіслати кружечок:", error);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    [chatRoomId, replyTarget, sendVideoNote, uploadFile],
  );

  const renderMessageItem = useCallback(
    ({ item }: { item: MessageItemData }) => (
      <SwipeableMessageItem
        item={item}
        isOwn={item.senderId === currentUser?._id}
        onLongPress={(position) =>
          setPickerState({ messageId: item._id, position })
        }
        onDoubleTap={(message) => handleToggleReaction(message._id, "❤️")}
        onToggleReaction={(emoji) => handleToggleReaction(item._id, emoji)}
        onReply={handleStartReply}
        onImagePress={setFullscreenImage}
        onAuthorPress={(authorId) => router.push(`/user/${authorId}` as any)}
      />
    ),
    [currentUser?._id, handleStartReply, handleToggleReaction, router],
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

  const formatRecordingTime = (millis: number) => {
    const total = Math.floor(millis / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const hasText = inputText.trim().length > 0;
  const showSendButton = hasText || !!selectedImageUri || !!editingMessageId;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 56 : 0}
    >
      <View
        className="flex-row items-center border-b border-surfaceLight bg-surface px-4"
        style={{ height: insets.top + 56, paddingTop: insets.top }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-secondary"
          accessibilityRole="button"
          accessibilityLabel="Назад"
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>

        <Text numberOfLines={1} className="flex-1 text-lg font-bold text-white">
          {room?.title ?? "Чат"}
        </Text>

        <TouchableOpacity
          onPress={() => router.push(`/settings/${chatRoomId}`)}
          className="ml-3 h-10 w-10 items-center justify-center rounded-full bg-secondary"
          accessibilityRole="button"
          accessibilityLabel="Інформація про кімнату"
        >
          <Ionicons
            name="information-circle-outline"
            size={24}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>

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

      {/* ── Панель введення (перемикається на recorder, коли йде запис) ── */}
      {isRecording ? (
        <View className="flex-row items-center px-3 py-3 bg-surface border-t border-surfaceLight">
          {/* ✕ Cancel */}
          <TouchableOpacity
            onPress={handleCancelVoice}
            className="w-11 h-11 rounded-full items-center justify-center bg-surfaceLight mr-3"
          >
            <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>

          {/* Жива хвиля + таймер */}
          <View className="flex-1 flex-row items-center bg-background rounded-full border border-surfaceLight px-3 py-2 mr-3">
            <View
              className="w-2 h-2 rounded-full bg-red-500 mr-2"
              style={{ opacity: 0.9 }}
            />

            <Text className="text-white text-xs font-bold mr-3 min-w-[38px]">
              {formatRecordingTime(durationMillis)}
            </Text>

            <View
              className="flex-1 flex-row items-center justify-between"
              style={{ height: WAVEFORM_LIVE_HEIGHT }}
            >
              {liveAmplitudes.length === 0
                ? Array.from({ length: 20 }, (_, i) => (
                    <View
                      key={`empty-${i}`}
                      style={{
                        width: 2.5,
                        height: LIVE_MIN_BAR_HEIGHT,
                        borderRadius: 2,
                        backgroundColor: "rgba(148, 163, 184, 0.45)",
                      }}
                    />
                  ))
                : liveAmplitudes.map((amp, idx) => (
                    <View
                      key={idx}
                      style={{
                        width: 2.5,
                        height: Math.max(
                          LIVE_MIN_BAR_HEIGHT,
                          amp * WAVEFORM_LIVE_HEIGHT,
                        ),
                        borderRadius: 2,
                        backgroundColor: COLORS.primary,
                      }}
                    />
                  ))}
            </View>
          </View>

          {/* ✓ Send */}
          <TouchableOpacity
            onPress={handleSendVoice}
            disabled={isSubmitting}
            className={`w-11 h-11 rounded-full items-center justify-center bg-primary ${
              isSubmitting ? "opacity-50" : "active:opacity-80"
            }`}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="checkmark" size={22} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      ) : (
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

          {/* Якщо є текст/фото → Send; інакше → Mic/Camera */}
          {showSendButton ? (
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
          ) : (
            <TouchableOpacity
              onPress={handleMicPress}
              onLongPress={handleMicLongPress}
              delayLongPress={300}
              disabled={isSubmitting}
              className={`w-11 h-11 rounded-full items-center justify-center ${
                inputMode === "video" ? "bg-primary" : "bg-surfaceLight"
              }`}
            >
              <Ionicons
                name={inputMode === "video" ? "videocam" : "mic"}
                size={22}
                color={inputMode === "video" ? COLORS.white : COLORS.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ImageViewerModal
        visible={!!fullscreenImage}
        imageUrl={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
      />

      <ReactionPickerModal
        visible={!!pickerState}
        position={pickerState?.position ?? null}
        onClose={() => setPickerState(null)}
        onSelectEmoji={(emoji) => {
          if (pickerState) {
            void handleToggleReaction(pickerState.messageId, emoji);
          }
        }}
      />

      <VideoNoteRecorderModal
        visible={isVideoModalVisible}
        onClose={() => setIsVideoModalVisible(false)}
        onSendVideo={handleSendVideo}
      />
    </KeyboardAvoidingView>
  );
}
