import { ImageViewerModal } from "@/components/ImageViewerModal";
import {
  MessageContextMenu,
  MessageMenuAction,
  MessageMenuPosition,
} from "@/components/MessageContextMenu";
import { ReplyPreviewBar, ReplyTarget } from "@/components/ReplyPreviewBar";
import {
  MessageItemData,
  SwipeableMessageItem,
} from "@/components/SwipeableMessageItem";
import { TypingDots } from "@/components/TypingDots";
import { KawaiiAvatar } from "@/components/ui/KawaiiAvatar";
import { KawaiiGradient } from "@/components/ui/KawaiiGradient";
import { VideoNoteRecorderModal } from "@/components/VideoNoteRecorderModal";
import { COLORS, FONTS } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { File } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const WAVEFORM_LIVE_HEIGHT = 26;
const LIVE_MIN_BAR_HEIGHT = 4;
const PRESENCE_HEARTBEAT_MS = 15_000;
const LOCAL_TYPING_TIMEOUT_MS = 3_000;

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const chatRoomId = id as Id<"chatRooms">;
  const insets = useSafeAreaInsets();

  const room = useQuery(api.rooms.getRoom, { roomId: chatRoomId });

  const { results: messages, status, loadMore } = usePaginatedQuery(
    api.messages.getPaginatedMessages,
    { chatRoomId },
    { initialNumItems: 25 },
  );

  const currentUser = useQuery(api.users.currentUser);
  const typingUsers = useQuery(api.typing.getTypingUsers, { chatRoomId });

  const sendMessage = useMutation(api.messages.sendMessage);
  const sendMediaMessage = useMutation(api.messages.sendMediaMessage);
  const sendVoiceMessage = useMutation(api.messages.sendVoiceMessage);
  const sendVideoNote = useMutation(api.messages.sendVideoNote);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const editMessage = useMutation(api.messages.editMessage);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const toggleReaction = useMutation(api.messages.toggleReaction);
  const setTyping = useMutation(api.typing.setTyping);
  const clearTyping = useMutation(api.typing.clearTyping);

  const setActiveChat = useMutation(api.presence.setActiveChat);
  const clearActiveChat = useMutation(api.presence.clearActiveChat);

  const [inputText, setInputText] = useState("");
  const [editingMessageId, setEditingMessageId] =
    useState<Id<"messages"> | null>(null);

  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [menuState, setMenuState] = useState<{
    message: MessageItemData;
    position: MessageMenuPosition;
    canEdit: boolean;
    canDelete: boolean;
  } | null>(null);

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

  const flatListRef = useRef<FlatList>(null);
  const lastTypingCallRef = useRef<number>(0);
  const localTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
  }));

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const ping = () => {
        if (!active) return;
        setActiveChat({ chatRoomId }).catch(() => {});
      };

      ping();
      const interval = setInterval(ping, PRESENCE_HEARTBEAT_MS);

      return () => {
        active = false;
        clearInterval(interval);
        clearActiveChat().catch(() => {});
        clearTyping({ chatRoomId }).catch(() => {});

        if (localTypingTimerRef.current) {
          clearTimeout(localTypingTimerRef.current);
          localTypingTimerRef.current = null;
        }
      };
    }, [chatRoomId, setActiveChat, clearActiveChat, clearTyping]),
  );

  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);

      const now = Date.now();
      if (now - lastTypingCallRef.current > 1500) {
        lastTypingCallRef.current = now;
        setTyping({ chatRoomId }).catch(() => {});
      }

      if (localTypingTimerRef.current) {
        clearTimeout(localTypingTimerRef.current);
      }
      localTypingTimerRef.current = setTimeout(() => {
        clearTyping({ chatRoomId }).catch(() => {});
        localTypingTimerRef.current = null;
      }, LOCAL_TYPING_TIMEOUT_MS);
    },
    [chatRoomId, setTyping, clearTyping],
  );

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
        preview = `🎤 Голосове${dur}`;
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
      } catch (error: any) {
        const message = String(error?.message ?? "");

        if (message.includes("Максимум")) {
          Alert.alert(
            "Забагато реакцій 🌸",
            "Ти вже поставив 10 реакцій на це повідомлення.\nЗніми одну, щоб додати нову ✨",
          );
          return;
        }

        console.error("Не вдалося змінити реакцію:", error);
      }
    },
    [toggleReaction],
  );

  const handleMenuAction = useCallback(
    (action: MessageMenuAction) => {
      if (!menuState) return;
      const message = menuState.message;

      if (action === "reply") {
        handleStartReply(message);
      } else if (action === "edit") {
        setEditingMessageId(message._id);
        setInputText(message.content ?? "");
        setReplyTarget(null);
      } else if (action === "delete") {
        Alert.alert(
          "Видалити повідомлення? 🗑️",
          "Цю дію неможливо скасувати.",
          [
            { text: "Скасувати", style: "cancel" },
            {
              text: "Видалити",
              style: "destructive",
              onPress: async () => {
                try {
                  await deleteMessage({ messageId: message._id });
                } catch (error) {
                  console.error("Delete error:", error);
                  Alert.alert("Помилка", "Не вдалося видалити повідомлення");
                }
              },
            },
          ],
        );
      }
    },
    [menuState, handleStartReply, deleteMessage],
  );

  const uploadFile = useCallback(
    async (uri: string, fallbackMime: string): Promise<Id<"_storage">> => {
      const uploadUrl = await generateUploadUrl();
      const file = new File(uri);

      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || fallbackMime },
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

  const resetTyping = useCallback(() => {
    if (localTypingTimerRef.current) {
      clearTimeout(localTypingTimerRef.current);
      localTypingTimerRef.current = null;
    }
    lastTypingCallRef.current = 0;
    clearTyping({ chatRoomId }).catch(() => {});
  }, [chatRoomId, clearTyping]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if ((!text && !selectedImageUri) || isSubmitting) return;

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
      resetTyping();
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
    resetTyping,
  ]);

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

  const handleMicLongPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setInputMode((prev) => (prev === "audio" ? "video" : "audio"));
  }, []);

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
      resetTyping();
    } catch (error) {
      console.error("Не вдалося надіслати голосове:", error);
      Alert.alert("Помилка", "Не вдалося надіслати голосове повідомлення");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    chatRoomId,
    replyTarget,
    sendVoiceMessage,
    stopRecording,
    uploadFile,
    resetTyping,
  ]);

  const handleCancelVoice = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await cancelRecording();
  }, [cancelRecording]);

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
        resetTyping();
      } catch (error) {
        console.error("Не вдалося надіслати кружечок:", error);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    [chatRoomId, replyTarget, sendVideoNote, uploadFile, resetTyping],
  );

  const renderMessageItem = useCallback(
    ({ item }: { item: MessageItemData }) => {
      const isOwn = item.senderId === currentUser?._id;
      const isAdminOrCreator =
        room?.currentUserRole === "creator" ||
        room?.currentUserRole === "admin";

      return (
        <SwipeableMessageItem
          item={item}
          isOwn={isOwn}
          onLongPress={(position, message) => {
            setMenuState({
              message,
              position,
              canEdit: isOwn,
              canDelete: isOwn || isAdminOrCreator,
            });
          }}
          onDoubleTap={(message) => handleToggleReaction(message._id, "❤️")}
          onToggleReaction={(emoji) => handleToggleReaction(item._id, emoji)}
          onReply={handleStartReply}
          onImagePress={setFullscreenImage}
          onAuthorPress={(authorId) => router.push(`/user/${authorId}` as any)}
        />
      );
    },
    [
      currentUser?._id,
      room?.currentUserRole,
      handleStartReply,
      handleToggleReaction,
      router,
    ],
  );

  const handleLoadMore = useCallback(() => {
    if (status === "CanLoadMore") loadMore(20);
  }, [loadMore, status]);

  const handleScroll = useCallback((event: any) => {
    setShowScrollToBottom(event.nativeEvent.contentOffset.y > 350);
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowScrollToBottom(false);
  }, []);

  const renderListEmpty = useCallback(() => {
    if (status === "LoadingFirstPage") {
      return (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ scaleY: -1 }],
          }}
        >
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      );
    }

    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
          transform: [{ scaleY: -1 }],
        }}
      >
        <Text style={{ fontSize: 40, marginBottom: 8 }}>✨</Text>
        <Text
          style={{
            color: COLORS.textMuted,
            fontFamily: FONTS.body,
            textAlign: "center",
            fontSize: 13,
          }}
        >
          Повідомлень ще немає. Почни першим!
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

  const bottomInset = Math.max(insets.bottom, 12);

  const handleOpenRoomInfo = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/settings/${chatRoomId}` as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(183,148,246,0.15)",
          backgroundColor: COLORS.background,
          paddingHorizontal: 12,
          height: insets.top + 56,
          paddingTop: insets.top,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginRight: 10,
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 20,
            backgroundColor: "rgba(183,148,246,0.15)",
          }}
          accessibilityRole="button"
          accessibilityLabel="Назад"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleOpenRoomInfo}
          activeOpacity={0.75}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          {room?.avatarUrl ? (
            <KawaiiAvatar
              uri={room.avatarUrl}
              name={room.title}
              size={34}
              ring="primary"
            />
          ) : (
            <KawaiiGradient
              variant="primary"
              glow
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="chatbubbles" size={16} color="#FFFFFF" />
            </KawaiiGradient>
          )}

          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: FONTS.headingBold,
                fontSize: 15,
                color: COLORS.text,
              }}
            >
              {room?.title ?? "Чат"}
            </Text>
            <Text style={{ fontSize: 10, marginTop: -1 }}>✨ 💕</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleOpenRoomInfo}
          style={{
            marginLeft: 6,
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 20,
            backgroundColor: "rgba(183,148,246,0.15)",
          }}
          accessibilityRole="button"
          accessibilityLabel="Інформація про кімнату"
        >
          <Ionicons
            name="information-circle-outline"
            size={22}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item._id}
            inverted
            contentContainerStyle={{ padding: 12 }}
            renderItem={renderMessageItem}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListFooterComponent={
              status === "LoadingMore" ? (
                <View style={{ paddingVertical: 12 }}>
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
              style={{ position: "absolute", right: 16, bottom: 16 }}
            >
              <TouchableOpacity onPress={scrollToBottom} activeOpacity={0.85}>
                <KawaiiGradient
                  variant="primary"
                  glow
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="arrow-down" size={20} color="#FFFFFF" />
                </KawaiiGradient>
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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 14,
              paddingVertical: 8,
              backgroundColor: "rgba(255,143,180,0.08)",
              borderTopWidth: 1,
              borderTopColor: "rgba(255,143,180,0.2)",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flex: 1,
                marginRight: 8,
              }}
            >
              <Text style={{ fontSize: 12, marginRight: 6 }}>✏️</Text>
              <Text
                style={{
                  color: COLORS.primary,
                  fontFamily: FONTS.bodyBold,
                  fontSize: 12,
                }}
              >
                Редагування
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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 8,
              backgroundColor: "rgba(183,148,246,0.08)",
              borderTopWidth: 1,
              borderTopColor: "rgba(183,148,246,0.2)",
            }}
          >
            <Image
              source={{ uri: selectedImageUri }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                marginRight: 10,
              }}
            />
            <Text
              style={{
                color: COLORS.text,
                fontFamily: FONTS.body,
                fontSize: 12,
                flex: 1,
              }}
            >
              📷 Фото прикріплено
            </Text>
            <TouchableOpacity onPress={() => setSelectedImageUri(null)}>
              <Ionicons name="close-circle" size={22} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        )}

        {isRecording ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: bottomInset,
              backgroundColor: COLORS.background,
              borderTopWidth: 1,
              borderTopColor: "rgba(255,143,180,0.15)",
            }}
          >
            <TouchableOpacity
              onPress={handleCancelVoice}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,92,122,0.15)",
                marginRight: 10,
              }}
            >
              <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
            </TouchableOpacity>

            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "rgba(183,148,246,0.1)",
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "rgba(183,148,246,0.25)",
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginRight: 10,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: COLORS.danger,
                  marginRight: 8,
                }}
              />

              <Text
                style={{
                  color: COLORS.text,
                  fontFamily: FONTS.bodyBold,
                  fontSize: 12,
                  marginRight: 12,
                  minWidth: 38,
                }}
              >
                {formatRecordingTime(durationMillis)}
              </Text>

              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  height: WAVEFORM_LIVE_HEIGHT,
                }}
              >
                {liveAmplitudes.length === 0
                  ? Array.from({ length: 20 }, (_, i) => (
                      <View
                        key={`empty-${i}`}
                        style={{
                          width: 2.5,
                          height: LIVE_MIN_BAR_HEIGHT,
                          borderRadius: 2,
                          backgroundColor: "rgba(168,155,184,0.45)",
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

            <TouchableOpacity
              onPress={handleSendVoice}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              <KawaiiGradient
                variant="primary"
                glow
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isSubmitting ? 0.5 : 1,
                }}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark" size={22} color="#FFFFFF" />
                )}
              </KawaiiGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: bottomInset,
              backgroundColor: COLORS.background,
              borderTopWidth: 1,
              borderTopColor: "rgba(255,143,180,0.15)",
            }}
          >
            <TouchableOpacity
              onPress={pickImage}
              disabled={isSubmitting}
              style={{
                marginRight: 8,
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(183,148,246,0.12)",
              }}
            >
              <Ionicons name="image-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>

            <TextInput
              style={{
                flex: 1,
                backgroundColor: "rgba(183,148,246,0.08)",
                color: COLORS.text,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 20,
                fontSize: 14,
                fontFamily: FONTS.body,
                borderWidth: 1,
                borderColor: "rgba(183,148,246,0.2)",
                marginRight: 8,
              }}
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
                  disabled={
                    (!inputText.trim() && !selectedImageUri) || isSubmitting
                  }
                  activeOpacity={0.85}
                >
                  <KawaiiGradient
                    variant="primary"
                    glow
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity:
                        (!inputText.trim() && !selectedImageUri) || isSubmitting
                          ? 0.5
                          : 1,
                    }}
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
                  </KawaiiGradient>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <TouchableOpacity
                onPress={handleMicPress}
                onLongPress={handleMicLongPress}
                delayLongPress={300}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                <KawaiiGradient
                  variant={inputMode === "video" ? "primary" : "accent"}
                  glow
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={inputMode === "video" ? "videocam" : "mic"}
                    size={22}
                    color="#FFFFFF"
                  />
                </KawaiiGradient>
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      <ImageViewerModal
        visible={!!fullscreenImage}
        imageUrl={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
      />

      <MessageContextMenu
        visible={!!menuState}
        position={menuState?.position ?? null}
        canEdit={menuState?.canEdit ?? false}
        canDelete={menuState?.canDelete ?? false}
        onClose={() => setMenuState(null)}
        onSelectEmoji={(emoji) => {
          if (menuState) {
            void handleToggleReaction(menuState.message._id, emoji);
          }
        }}
        onAction={handleMenuAction}
      />

      <VideoNoteRecorderModal
        visible={isVideoModalVisible}
        onClose={() => setIsVideoModalVisible(false)}
        onSendVideo={handleSendVideo}
      />
    </View>
  );
}