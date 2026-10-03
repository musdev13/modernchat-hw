import { ChatSearchPanel } from "@/components/ChatSearchPanel";
import { EmojiPanel } from "@/components/EmojiPanel";
import { GlassProvider, GlassSurface, GlassTarget } from "@/components/Glass";
import type { GifItem } from "@/components/GifPicker";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import {
  MessageAction,
  MessageActionSheet,
} from "@/components/MessageActionSheet";
import {
  PIN_BAR_HEIGHT,
  PinnedMessageBar,
} from "@/components/PinnedMessageBar";
import { ReactionPickerModal } from "@/components/ReactionPickerModal";
import { ReplyPreviewBar, ReplyTarget } from "@/components/ReplyPreviewBar";
import {
  MessageItemData,
  SwipeableMessageItem,
} from "@/components/SwipeableMessageItem";
import { TypingDots } from "@/components/TypingDots";
import { VideoNoteRecorderModal } from "@/components/VideoNoteRecorderModal";
import { avatarColor, initialsOf } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { copyText } from "@/utils/clipboard";
import {
  dayKey,
  dayLabel,
  deleteLastGrapheme,
  membersLabel,
  STICKER_CAPTION,
  STICKER_LABEL,
  isStickerContent,
} from "@/utils/chat";
import { Ionicons } from "@expo/vector-icons";
import { useConvex, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import * as SystemUI from "expo-system-ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const WAVEFORM_LIVE_HEIGHT = 26;
const LIVE_MIN_BAR_HEIGHT = 4;
const PRESENCE_HEARTBEAT_MS = 15_000;
const LOCAL_TYPING_TIMEOUT_MS = 3_000;
const DEFAULT_PANEL_HEIGHT = 300;
const MIN_PANEL_HEIGHT = 240;
const MAX_PANEL_HEIGHT = 520;
// Висота клавіатури запамʼятовується між відкриттями чату.
let lastKeyboardHeight = 0;
// Floating "Dynamic Island" header
const ISLAND_HEIGHT = 56;
const ISLAND_COMPACT_HEIGHT = 44;
const ISLAND_TOP_GAP = 6;
const ISLAND_SIDE_MARGIN = 12;
const ISLAND_SPRING = { damping: 14, stiffness: 190, mass: 0.8 } as const;
const COMPACT_SCROLL_OFFSET = 60;

interface MessageRow {
  item: MessageItemData;
  isFirstInSeries: boolean;
  isLastInSeries: boolean;
  dateLabel?: string;
}

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const chatRoomId = id as Id<"chatRooms">;
  const c = useChatPalette();

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
  const togglePin = useMutation(api.messages.togglePin);
  const markRead = useMutation(api.reads.markRead);
  const readState = useQuery(api.reads.getReadState, { chatRoomId });
  const othersLastReadAt = readState?.othersLastReadAt ?? 0;
  const pinnedMessages = useQuery(api.messages.getPinnedMessages, {
    chatRoomId,
  });
  const setTyping = useMutation(api.typing.setTyping);
  const clearTyping = useMutation(api.typing.clearTyping);

  const setActiveChat = useMutation(api.presence.setActiveChat);
  const clearActiveChat = useMutation(api.presence.clearActiveChat);

  const [inputText, setInputText] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [editingMessage, setEditingMessage] = useState<MessageItemData | null>(
    null,
  );
  const editingMessageId = editingMessage?._id ?? null;

  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [islandScrolled, setIslandScrolled] = useState(false);
  // 0 = full, 1 = compact (scrolled), 2 = expanded (typing)
  const islandState = useSharedValue(0);
  const [actionMessage, setActionMessage] = useState<MessageItemData | null>(
    null,
  );
  const [pickerMessageId, setPickerMessageId] =
    useState<Id<"messages"> | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  // Висота системної клавіатури (без нижньої системної панелі на Android).
  const [keyboardHeight, setKeyboardHeight] = useState(lastKeyboardHeight);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // Фокус у полі пошуку всередині панелі емодзі/GIF/наліпок.
  const [panelSearching, setPanelSearching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Висота нижнього блоку (поле вводу + панелі відповіді/редагування): повідомлення прокручуються під ним.
  const [composerHeight, setComposerHeight] = useState(64);

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

  // Фон вікна під системною навігацією = фон чату (без чорної смуги).
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.wallpaper).catch(() => {});
  }, [c.wallpaper]);

  const flatListRef = useRef<FlatList<MessageRow>>(null);
  const inputRef = useRef<TextInput>(null);
  const keyboardVisibleRef = useRef(false);
  const panelSearchingRef = useRef(false);
  const panelOpenedAtRef = useRef(0);
  const lastTypingCallRef = useRef<number>(0);
  const localTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
  }));

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1800);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    [],
  );

  // Стежимо за клавіатурою: запамʼятовуємо висоту (панель займає те саме місце)
  // і закриваємо панель емодзі, коли користувач повернувся до системної клавіатури.
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const showSub = Keyboard.addListener(
      ios ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        const h = Math.round(e.endCoordinates.height);
        if (h > 0) {
          lastKeyboardHeight = h;
          setKeyboardHeight(h);
        }
        keyboardVisibleRef.current = true;
        setKeyboardVisible(true);
        // Клавіатура пошуку в самій панелі не має закривати панель.
        // Короткий проміжок після відкриття панелі ігнорує «хвіст» події від клавіатури, що ховається.
        const justOpened = Date.now() - panelOpenedAtRef.current < 350;
        if (!panelSearchingRef.current && !justOpened) setPanelOpen(false);
      },
    );
    const hideSub = Keyboard.addListener(
      ios ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        keyboardVisibleRef.current = false;
        setKeyboardVisible(false);
        panelSearchingRef.current = false;
        setPanelSearching(false);
      },
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handlePanelSearchFocus = useCallback((focused: boolean) => {
    panelSearchingRef.current = focused;
    setPanelSearching(focused);
  }, []);

  // Кнопка «Назад» (Android) спочатку закриває панель емодзі.
  useEffect(() => {
    if (!panelOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setPanelOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [panelOpen]);

  // Presence heartbeat + очистка typing при выходе из чата
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

  // Позначаємо кімнату прочитаною: при відкритті чату, коли надходять нові
  // повідомлення, поки він відкритий, і коли застосунок знову стає активним.
  const focusedRef = useRef(false);
  const newestMessageId = messages[0]?._id;

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      markRead({ chatRoomId }).catch(() => {});
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active" && focusedRef.current) {
          markRead({ chatRoomId }).catch(() => {});
        }
      });
      return () => {
        focusedRef.current = false;
        sub.remove();
      };
    }, [chatRoomId, markRead]),
  );

  useEffect(() => {
    if (!newestMessageId || !focusedRef.current) return;
    if (AppState.currentState !== "active") return;
    markRead({ chatRoomId }).catch(() => {});
  }, [chatRoomId, markRead, newestMessageId]);

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

  // ── Емодзі ────────────────────────────────────────────
  const handleInsertEmoji = useCallback(
    (emoji: string) => {
      const start = Math.min(selection.start, inputText.length);
      const end = Math.min(selection.end, inputText.length);
      const next = inputText.slice(0, start) + emoji + inputText.slice(end);
      const pos = start + emoji.length;
      handleTextChange(next);
      setSelection({ start: pos, end: pos });
    },
    [handleTextChange, inputText, selection.end, selection.start],
  );

  const handleEmojiBackspace = useCallback(() => {
    const start = Math.min(selection.start, inputText.length);
    const end = Math.min(selection.end, inputText.length);
    if (start !== end) {
      const next = inputText.slice(0, start) + inputText.slice(end);
      handleTextChange(next);
      setSelection({ start, end: start });
      return;
    }
    if (start === 0) return;
    const prefix = deleteLastGrapheme(inputText.slice(0, start));
    const next = prefix + inputText.slice(start);
    handleTextChange(next);
    setSelection({ start: prefix.length, end: prefix.length });
  }, [handleTextChange, inputText, selection.end, selection.start]);

  const togglePanel = useCallback(() => {
    if (panelOpen) {
      // Панель лишається, доки не зʼявиться клавіатура (без стрибка поля вводу).
      // Якщо клавіатура вже відкрита (пошук у панелі) — закриваємо одразу.
      if (keyboardVisibleRef.current) setPanelOpen(false);
      inputRef.current?.focus();
    } else {
      panelOpenedAtRef.current = Date.now();
      Keyboard.dismiss();
      setPanelOpen(true);
    }
  }, [panelOpen]);

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
    let preview = isStickerContent(message.content)
      ? STICKER_LABEL
      : (message.content?.trim() ?? "");
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

    setEditingMessage(null);
  }, []);

  const handleStartEdit = useCallback((message: MessageItemData) => {
    const text = message.content ?? "";
    setEditingMessage(message);
    setReplyTarget(null);
    setSelectedImageUri(null);
    setPanelOpen(false);
    setInputText(text);
    setSelection({ start: text.length, end: text.length });
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingMessage(null);
    setInputText("");
    setSelection({ start: 0, end: 0 });
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

  const handleCopy = useCallback(
    async (message: MessageItemData) => {
      if (isStickerContent(message.content)) return;
      const text = message.content?.trim();
      if (!text) return;
      try {
        const result = await copyText(text);
        if (result === "copied") showToast("Скопійовано");
      } catch (error) {
        console.error("Не вдалося скопіювати:", error);
      }
    },
    [showToast],
  );

  const handleDelete = useCallback(
    (message: MessageItemData) => {
      Alert.alert(
        "Видалити повідомлення?",
        "Повідомлення буде видалено для всіх учасників.",
        [
          { text: "Скасувати", style: "cancel" },
          {
            text: "Видалити",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteMessage({ messageId: message._id });
                if (editingMessage?._id === message._id) cancelEdit();
                setReplyTarget((prev) =>
                  prev?.messageId === message._id ? null : prev,
                );
              } catch (error) {
                console.error(error);
                Alert.alert("Помилка", "Не вдалося видалити повідомлення");
              }
            },
          },
        ],
      );
    },
    [cancelEdit, deleteMessage, editingMessage?._id],
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
        setEditingMessage(null);
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
      setSelection({ start: 0, end: 0 });
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

  // GIF: завантажуємо файл з Giphy й надсилаємо тим самим шляхом, що й фото
  // (upload → sendMediaMessage), тож зміни на бекенді не потрібні.
  const handleSendGif = useCallback(
    async (gif: GifItem) => {
      if (isSubmitting) return;
      let downloaded: File | null = null;
      try {
        setIsSubmitting(true);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        downloaded = await File.downloadFileAsync(
          gif.url,
          new File(Paths.cache, `${gif.kind}-${gif.id}.gif`),
          { idempotent: true },
        );
        const storageId = await uploadFile(downloaded.uri, "image/gif");

        await sendMediaMessage({
          chatRoomId,
          storageId,
          caption: gif.kind === "sticker" ? STICKER_CAPTION : undefined,
          replyToId: replyTarget
            ? (replyTarget.messageId as Id<"messages">)
            : undefined,
          replyToSender: replyTarget?.senderName,
          replyToText:
            replyTarget?.text || (gif.kind === "sticker" ? "Наліпка" : "GIF"),
        });

        setReplyTarget(null);
        setPanelOpen(false);
        resetTyping();
      } catch (error) {
        console.error("Не вдалося надіслати GIF/наліпку:", error);
        Alert.alert(
          "Помилка",
          gif.kind === "sticker"
            ? "Не вдалося надіслати наліпку"
            : "Не вдалося надіслати GIF",
        );
      } finally {
        try {
          downloaded?.delete();
        } catch {
          // тимчасовий файл у кеші — можна ігнорувати
        }
        setIsSubmitting(false);
      }
    },
    [chatRoomId, isSubmitting, replyTarget, resetTyping, sendMediaMessage, uploadFile],
  );

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
    setInputMode((prev) => {
      const next = prev === "audio" ? "video" : "audio";
      showToast(
        next === "video"
          ? "Режим: відеокружечок"
          : "Режим: голосове повідомлення",
      );
      return next;
    });
  }, [showToast]);

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

  // ── Список ────────────────────────────────────────────
  // messages[0] — найновіше. «Старіше» повідомлення — наступний елемент масиву.
  const rows = useMemo<MessageRow[]>(() => {
    const list = messages as unknown as MessageItemData[];
    return list.map((m, i) => {
      const older = list[i + 1];
      const newer = list[i - 1];
      const key = dayKey(m._creationTime);

      const sameSeries = (other?: MessageItemData) =>
        !!other &&
        !other.isSystem &&
        !m.isSystem &&
        other.senderId === m.senderId &&
        dayKey(other._creationTime) === key;

      let label: string | undefined;
      if (older) {
        if (dayKey(older._creationTime) !== key) {
          label = dayLabel(m._creationTime);
        }
      } else if (status === "Exhausted") {
        label = dayLabel(m._creationTime);
      }

      return {
        item: m,
        isFirstInSeries: !sameSeries(older),
        isLastInSeries: !sameSeries(newer),
        dateLabel: label,
      };
    });
  }, [messages, status]);

  // ── Перехід до повідомлення (цитата, закріплене, пошук) ──
  const convex = useConvex();
  const rowsRef = useRef<MessageRow[]>([]);
  rowsRef.current = rows;
  const statusRef = useRef(status);
  statusRef.current = status;
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  const pendingJumpRef = useRef<{ id: Id<"messages">; loads: number } | null>(
    null,
  );
  const jumpAttemptsRef = useRef(0);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flash, setFlash] = useState<{
    id: Id<"messages">;
    token: number;
  } | null>(null);

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  const flashMessage = useCallback((id: Id<"messages">) => {
    setFlash({ id, token: Date.now() });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(null), 2600);
  }, []);

  // true, якщо повідомлення вже завантажене й прокрутку запущено.
  const scrollToMessage = useCallback(
    (id: Id<"messages">): boolean => {
      const index = rowsRef.current.findIndex((r) => r.item._id === id);
      if (index < 0) return false;
      jumpAttemptsRef.current = 0;
      flatListRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
      setTimeout(() => flashMessage(id), 380);
      return true;
    },
    [flashMessage],
  );

  // Елементи списку мають різну висоту: якщо FlatList ще не виміряв їх, їдемо за середньою
  // висотою й пробуємо ще раз.
  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      if (jumpAttemptsRef.current >= 6) return;
      jumpAttemptsRef.current += 1;
      flatListRef.current?.scrollToOffset({
        offset: Math.max(0, info.averageItemLength * info.index),
        animated: false,
      });
      setTimeout(() => {
        if (info.index < rowsRef.current.length) {
          flatListRef.current?.scrollToIndex({
            index: info.index,
            animated: true,
            viewPosition: 0.5,
          });
        }
      }, 150);
    },
    [],
  );

  const jumpToMessage = useCallback(
    async (id: Id<"messages">) => {
      Keyboard.dismiss();
      setPanelOpen(false);
      if (scrollToMessage(id)) return;
      try {
        const meta = await convex.query(api.messages.getMessageMeta, {
          messageId: id,
        });
        if (!meta) {
          showToast("Оригінальне повідомлення видалено");
          return;
        }
        if (scrollToMessage(id)) return;
        showToast("Шукаю повідомлення…");
        pendingJumpRef.current = { id, loads: 0 };
        if (statusRef.current === "CanLoadMore") {
          pendingJumpRef.current.loads = 1;
          loadMoreRef.current(100);
        }
      } catch (error) {
        console.error("Не вдалося перейти до повідомлення:", error);
        showToast("Не вдалося знайти повідомлення");
      }
    },
    [convex, scrollToMessage, showToast],
  );

  // Дозавантажуємо старіші повідомлення, доки потрібне не зʼявиться у списку.
  useEffect(() => {
    const pending = pendingJumpRef.current;
    if (!pending) return;
    if (rows.some((r) => r.item._id === pending.id)) {
      pendingJumpRef.current = null;
      scrollToMessage(pending.id);
      return;
    }
    if (status === "CanLoadMore" && pending.loads < 60) {
      pending.loads += 1;
      loadMore(100);
      return;
    }
    if (status === "Exhausted" || pending.loads >= 60) {
      pendingJumpRef.current = null;
      showToast("Повідомлення не знайдено");
    }
  }, [rows, status, loadMore, scrollToMessage, showToast]);

  // ── Пошук по чату ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchText.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const searchResults = useQuery(
    api.messages.searchMessages,
    searchOpen && searchQuery
      ? { chatRoomId, query: searchQuery, limit: 40 }
      : "skip",
  );

  const openSearch = useCallback(() => {
    setPanelOpen(false);
    setSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    setSearchOpen(false);
    setSearchText("");
    setSearchQuery("");
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeSearch();
      return true;
    });
    return () => sub.remove();
  }, [closeSearch, searchOpen]);

  const handleSelectSearchResult = useCallback(
    (messageId: string) => {
      closeSearch();
      void jumpToMessage(messageId as Id<"messages">);
    },
    [closeSearch, jumpToMessage],
  );

  // ── Закріплені повідомлення ──
  const pins = pinnedMessages ?? [];
  const pinCount = pins.length;
  const [pinCursor, setPinCursor] = useState(0);
  useEffect(() => {
    setPinCursor(0);
  }, [pinCount]);
  // Показуємо найновіше закріплення; тап по смужці веде до нього й перемикає на попереднє.
  const shownPinIndex =
    pinCount > 0 ? pinCount - 1 - (pinCursor % pinCount) : -1;
  const shownPin = shownPinIndex >= 0 ? pins[shownPinIndex] : null;
  const pinnedIds = useMemo(() => pins.map((p) => p._id), [pins]);

  const handleTogglePin = useCallback(
    async (messageId: Id<"messages">, wasPinned: boolean) => {
      try {
        await togglePin({ messageId });
        showToast(wasPinned ? "Відкріплено" : "Закріплено");
      } catch (error) {
        console.error("Не вдалося змінити закріплення:", error);
        Alert.alert("Помилка", "Не вдалося змінити закріплення");
      }
    },
    [showToast, togglePin],
  );

  const handlePinBarPress = useCallback(() => {
    if (!shownPin) return;
    void jumpToMessage(shownPin._id);
    if (pinCount > 1) setPinCursor((prev) => prev + 1);
  }, [jumpToMessage, pinCount, shownPin]);

  const handleOpenActions = useCallback((message: MessageItemData) => {
    Keyboard.dismiss();
    setActionMessage(message);
  }, []);

  const renderMessageItem = useCallback(
    ({ item: row }: { item: MessageRow }) => (
      <SwipeableMessageItem
        item={row.item}
        isOwn={row.item.senderId === currentUser?._id}
        isFirstInSeries={row.isFirstInSeries}
        isLastInSeries={row.isLastInSeries}
        isSelected={actionMessage?._id === row.item._id}
        dateLabel={row.dateLabel}
        onLongPress={handleOpenActions}
        onDoubleTap={(message) => handleToggleReaction(message._id, "❤️")}
        onToggleReaction={(emoji) => handleToggleReaction(row.item._id, emoji)}
        onReply={handleStartReply}
        onImagePress={setFullscreenImage}
        onAuthorPress={(authorId) => router.push(`/user/${authorId}` as any)}
        onReplyPress={jumpToMessage}
        flashToken={flash?.id === row.item._id ? flash.token : 0}
        readStatus={
          row.item.senderId === currentUser?._id
            ? row.item._creationTime <= othersLastReadAt
              ? "read"
              : "sent"
            : undefined
        }
      />
    ),
    [
      actionMessage?._id,
      currentUser?._id,
      flash,
      jumpToMessage,
      othersLastReadAt,
      handleOpenActions,
      handleStartReply,
      handleToggleReaction,
      router,
    ],
  );

  const handleLoadMore = useCallback(() => {
    if (status === "CanLoadMore") loadMore(20);
  }, [loadMore, status]);

  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollToBottom(offsetY > 250);
    setIslandScrolled(offsetY > COMPACT_SCROLL_OFFSET);
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowScrollToBottom(false);
  }, []);

  const renderListEmpty = useCallback(() => {
    if (status === "LoadingFirstPage") {
      return (
        <View
          className="flex-1 items-center justify-center"
          style={{ transform: [{ scaleY: -1 }] }}
        >
          <ActivityIndicator size="small" color={c.accent} />
        </View>
      );
    }

    return (
      <View
        className="flex-1 items-center justify-center px-8"
        style={{ transform: [{ scaleY: -1 }] }}
      >
        <View
          style={{
            backgroundColor: withAlpha(c.muted, 0.22),
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 34 }}>👋</Text>
          <Text style={{ color: c.text, fontWeight: "600", marginTop: 6 }}>
            Повідомлень ще немає
          </Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 2, textAlign: "center" }}>
            Напишіть перше або надішліть стікер-емодзі чи GIF
          </Text>
        </View>
      </View>
    );
  }, [c.accent, c.muted, c.text, status]);

  const formatRecordingTime = (millis: number) => {
    const total = Math.floor(millis / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const hasText = inputText.trim().length > 0;
  const showSendButton = hasText || !!selectedImageUri || !!editingMessageId;
  const sendDisabled =
    (!inputText.trim() && !selectedImageUri) || isSubmitting;

  // Нижній відступ — лише safe-area inset (без додаткових), щоб поле вводу
  // сиділо одразу над системною навігацією.
  const bottomInset = Math.max(insets.bottom, 4);
  // Поле вводу притиснуте до клавіатури/панелі — нижній safe area тримає лише
  // сама клавіатура/панель, тож зайвого проміжку між ними немає.
  const composerBottomPadding =
    keyboardVisible || panelOpen ? 6 : bottomInset;

  // Панель = висота останньої клавіатури (+ нижня системна панель на Android,
  // яку клавіатура також перекриває). Під час пошуку панель компактна над клавіатурою.
  const keyboardTotal =
    keyboardHeight > 0
      ? keyboardHeight + (Platform.OS === "android" ? insets.bottom : 0)
      : DEFAULT_PANEL_HEIGHT;
  const fullPanelHeight = Math.min(
    MAX_PANEL_HEIGHT,
    Math.max(MIN_PANEL_HEIGHT, keyboardTotal),
  );
  const panelHeight = panelSearching
    ? Math.max(200, Math.round(fullPanelHeight * 0.62))
    : fullPanelHeight;

  const roomTitle = room?.title ?? "Чат";
  const memberCount = room?.participants?.length ?? 0;
  const typingText =
    typingUsers && typingUsers.length > 0
      ? typingUsers.length === 1
        ? `${typingUsers[0]} друкує…`
        : "кілька людей друкують…"
      : null;

  const actionList = useMemo<MessageAction[]>(() => {
    const m = actionMessage;
    if (!m) return [];
    const own = m.senderId === currentUser?._id;
    const hasContent = !!m.content?.trim() && !isStickerContent(m.content);
    const isPinned = pinnedIds.includes(m._id);
    const list: MessageAction[] = [
      {
        key: "reply",
        label: "Відповісти",
        icon: "arrow-undo-outline",
        onPress: () => handleStartReply(m),
      },
      {
        key: "pin",
        label: isPinned ? "Відкріпити" : "Закріпити",
        icon: isPinned ? "pin" : "pin-outline",
        onPress: () => void handleTogglePin(m._id, isPinned),
      },
    ];
    if (hasContent) {
      list.push({
        key: "copy",
        label: "Копіювати",
        icon: "copy-outline",
        onPress: () => void handleCopy(m),
      });
    }
    if (own && hasContent) {
      list.push({
        key: "edit",
        label: "Редагувати",
        icon: "create-outline",
        onPress: () => handleStartEdit(m),
      });
    }
    if (own) {
      list.push({
        key: "delete",
        label: "Видалити",
        icon: "trash-outline",
        destructive: true,
        onPress: () => handleDelete(m),
      });
    }
    return list;
  }, [
    actionMessage,
    currentUser?._id,
    handleCopy,
    handleDelete,
    handleStartEdit,
    handleStartReply,
    handleTogglePin,
    pinnedIds,
  ]);

  const actionPreview = actionMessage
    ? (isStickerContent(actionMessage.content)
        ? STICKER_LABEL
        : actionMessage.content?.trim()) ||
      (actionMessage.audioUrl
        ? "🎤 Голосове повідомлення"
        : actionMessage.isVideoNote
          ? "📹 Відеоповідомлення"
          : actionMessage.imageUrl
            ? "📷 Фотографія"
            : "")
    : "";

  const iconButtonStyle = {
    width: 40,
    height: 44,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  const isTyping = !!typingText;
  useEffect(() => {
    islandState.value = withSpring(
      isTyping ? 2 : islandScrolled ? 1 : 0,
      ISLAND_SPRING,
    );
  }, [isTyping, islandScrolled, islandState]);

  const islandStyle = useAnimatedStyle(() => ({
    height: interpolate(
      islandState.value,
      [0, 1, 2],
      [ISLAND_HEIGHT, ISLAND_COMPACT_HEIGHT, ISLAND_HEIGHT + 6],
    ),
    transform: [
      {
        scale: interpolate(islandState.value, [0, 1, 2], [1, 0.94, 1.02]),
      },
    ],
  }));

  // Смужка закріпленого їде за висотою капсули (вона стискається під час прокрутки).
  const pinBarStyle = useAnimatedStyle(() => ({
    top:
      insets.top +
      ISLAND_TOP_GAP +
      interpolate(
        islandState.value,
        [0, 1, 2],
        [ISLAND_HEIGHT, ISLAND_COMPACT_HEIGHT, ISLAND_HEIGHT + 6],
      ) +
      6,
  }));

  const islandSubtitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(islandState.value, [0, 1, 2], [1, 0, 1]),
    height: interpolate(islandState.value, [0, 1, 2], [16, 0, 16]),
  }));

  // Верхній відступ списку під «острівом»
  const islandBlock = insets.top + ISLAND_TOP_GAP + ISLAND_HEIGHT + 6;
  const pinBlock = shownPin ? PIN_BAR_HEIGHT + 6 : 0;

  return (
    <GlassProvider>
    <View style={{ flex: 1, backgroundColor: c.wallpaper }}>
      {/* CONTENT + INPUT — внутри KeyboardAvoidingView */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        keyboardVerticalOffset={0}
        // Коли відкрита панель (клавіатури немає), відступ від клавіатури не потрібен —
        // інакше між полем вводу і панеллю лишається порожнє місце.
        enabled={!panelOpen || panelSearching}
      >
        <View className="flex-1">
          <GlassTarget
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: c.wallpaper,
            }}
          >
          <FlatList
            ref={flatListRef}
            data={rows}
            extraData={`${actionMessage?._id ?? ""}|${flash?.token ?? 0}|${othersLastReadAt}`}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            keyExtractor={(row) => row.item._id}
            inverted={true}
            // paddingTop інвертованого списку = низ екрана: повідомлення їдуть під поле вводу
            contentContainerStyle={{ paddingTop: composerHeight + 8, paddingBottom: islandBlock + pinBlock }}
            renderItem={renderMessageItem}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => {
              if (panelOpen) setPanelOpen(false);
            }}
            ListHeaderComponent={
              typingUsers && typingUsers.length > 0 ? (
                <TypingDots typingUsers={typingUsers} />
              ) : null
            }
            ListFooterComponent={
              status === "LoadingMore" ? (
                <View className="py-3">
                  <ActivityIndicator size="small" color={c.accent} />
                </View>
              ) : null
            }
            ListEmptyComponent={renderListEmpty}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={Platform.OS === "android"}
          />
          </GlassTarget>

          {toast && (
            <Animated.View
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(150)}
              pointerEvents="none"
              style={{
                position: "absolute",
                top: islandBlock + pinBlock + 4,
                alignSelf: "center",
                backgroundColor: withAlpha("#000000", 0.7),
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 7,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 13 }}>{toast}</Text>
            </Animated.View>
          )}

          {showScrollToBottom && (
            <Animated.View
              entering={ZoomIn.springify()}
              exiting={ZoomOut.duration(150)}
              style={{ position: "absolute", right: 12, bottom: composerHeight + 12 }}
            >
              <TouchableOpacity
                onPress={scrollToBottom}
                accessibilityRole="button"
                accessibilityLabel="Прокрутити донизу"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: c.header,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: c.divider,
                  elevation: 4,
                  shadowColor: "#000",
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                <Ionicons name="chevron-down" size={22} color={c.accent} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Нижній блок поверх списку: повідомлення прокручуються під скляним полем вводу */}
          <View
            style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
            onLayout={(e) => {
              const h = Math.round(e.nativeEvent.layout.height);
              setComposerHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
            }}
          >
            {replyTarget && (
              <ReplyPreviewBar
                replyTarget={replyTarget}
                onCancel={() => setReplyTarget(null)}
              />
            )}

            {editingMessage && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: c.header,
                  borderTopWidth: 1,
                  borderTopColor: c.divider,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Ionicons name="create-outline" size={22} color={c.accent} />
                <View
                  style={{
                    flex: 1,
                    marginLeft: 12,
                    paddingLeft: 8,
                    borderLeftWidth: 2,
                    borderLeftColor: c.accent,
                  }}
                >
                  <Text style={{ color: c.accent, fontWeight: "700", fontSize: 13 }}>
                    Редагування
                  </Text>
                  <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>
                    {editingMessage.content}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={cancelEdit}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Скасувати редагування"
                >
                  <Ionicons name="close" size={22} color={c.muted} />
                </TouchableOpacity>
              </View>
            )}

            {selectedImageUri && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: c.header,
                  borderTopWidth: 1,
                  borderTopColor: c.divider,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Image
                  source={{ uri: selectedImageUri }}
                  style={{ width: 48, height: 48, borderRadius: 8, marginRight: 12 }}
                />
                <Text style={{ color: c.text, fontSize: 14, flex: 1 }}>
                  Фото прикріплено
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedImageUri(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Прибрати фото"
                >
                  <Ionicons name="close" size={22} color={c.muted} />
                </TouchableOpacity>
              </View>
            )}

            {isRecording ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "transparent",
                  paddingHorizontal: 10,
                  paddingTop: 6,
                  paddingBottom: composerBottomPadding,
                }}
              >
                <TouchableOpacity
                  onPress={handleCancelVoice}
                  style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
                  accessibilityRole="button"
                  accessibilityLabel="Скасувати запис"
                >
                  <Ionicons name="trash-outline" size={24} color={c.danger} />
                </TouchableOpacity>

                <GlassSurface
                  radius={22}
                  intensity={70}
                  style={{ flex: 1, height: 44, marginHorizontal: 6 }}
                  contentStyle={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 14 }}
                >
                  <View
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 5,
                      backgroundColor: c.danger,
                      marginRight: 8,
                    }}
                  />

                  <Text
                    style={{
                      color: c.text,
                      fontSize: 14,
                      fontWeight: "700",
                      marginRight: 12,
                      minWidth: 38,
                    }}
                  >
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
                              backgroundColor: withAlpha(c.muted, 0.5),
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
                              backgroundColor: c.accent,
                            }}
                          />
                        ))}
                  </View>
                </GlassSurface>

                <TouchableOpacity
                  onPress={handleSendVoice}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel="Надіслати голосове"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: c.accent,
                    opacity: isSubmitting ? 0.5 : 1,
                  }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={c.onAccent} />
                  ) : (
                    <Ionicons name="send" size={20} color={c.onAccent} />
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  backgroundColor: "transparent",
                  paddingHorizontal: 10,
                  paddingTop: 6,
                  paddingBottom: composerBottomPadding,
                }}
              >
                <GlassSurface
                  radius={22}
                  intensity={70}
                  style={{ flex: 1, minHeight: 44 }}
                  contentStyle={{ flexDirection: "row", alignItems: "flex-end", minHeight: 44 }}
                >
                  <TouchableOpacity
                    onPress={togglePanel}
                    style={iconButtonStyle}
                    accessibilityRole="button"
                    accessibilityLabel={panelOpen ? "Показати клавіатуру" : "Емодзі, GIF та наліпки"}
                  >
                    <Ionicons
                      name={panelOpen ? "keypad-outline" : "happy-outline"}
                      size={26}
                      color={panelOpen ? c.accent : c.muted}
                    />
                  </TouchableOpacity>

                  <TextInput
                    ref={inputRef}
                    style={{
                      flex: 1,
                      color: c.text,
                      fontSize: 16,
                      maxHeight: 120,
                      paddingVertical: 10,
                      paddingHorizontal: 2,
                    }}
                    placeholder={
                      editingMessageId
                        ? "Змініть текст..."
                        : replyTarget
                          ? `Відповідь для ${replyTarget.senderName}...`
                          : selectedImageUri
                            ? "Додайте підпис до фото..."
                            : "Повідомлення"
                    }
                    placeholderTextColor={c.muted}
                    value={inputText}
                    onChangeText={handleTextChange}
                    selection={selection}
                    onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                    onFocus={() => {
                      // Клавіатура вже відкрита (напр. пошук у панелі) — одразу повертаємось до неї.
                      if (keyboardVisibleRef.current) setPanelOpen(false);
                    }}
                    selectionColor={c.accent}
                    multiline
                  />

                  <TouchableOpacity
                    onPress={pickImage}
                    disabled={isSubmitting}
                    style={iconButtonStyle}
                    accessibilityRole="button"
                    accessibilityLabel="Прикріпити фото"
                  >
                    <Ionicons name="attach" size={26} color={c.muted} />
                  </TouchableOpacity>
                </GlassSurface>

                <View style={{ marginLeft: 8 }}>
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
                        disabled={sendDisabled}
                        accessibilityRole="button"
                        accessibilityLabel={
                          editingMessageId ? "Зберегти зміни" : "Надіслати"
                        }
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: c.accent,
                          opacity: sendDisabled ? 0.5 : 1,
                        }}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator size="small" color={c.onAccent} />
                        ) : (
                          <Ionicons
                            name={editingMessageId ? "checkmark" : "send"}
                            size={20}
                            color={c.onAccent}
                            style={editingMessageId ? undefined : { marginLeft: 2 }}
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
                      accessibilityRole="button"
                      accessibilityLabel={
                        inputMode === "video"
                          ? "Записати відеокружечок"
                          : "Записати голосове"
                      }
                      accessibilityHint="Довге натискання перемикає голосове та відеокружечок"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: c.accent,
                      }}
                    >
                      <Ionicons
                        name={inputMode === "video" ? "videocam" : "mic"}
                        size={22}
                        color={c.onAccent}
                      />
                      {/* Невеликий значок підказує, що режим можна перемкнути довгим натисканням */}
                      <View
                        style={{
                          position: "absolute",
                          right: -2,
                          top: -2,
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          backgroundColor: c.header,
                          borderWidth: 1,
                          borderColor: c.divider,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name="swap-horizontal"
                          size={10}
                          color={c.accent}
                        />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>

        {panelOpen && !isRecording && (
          <EmojiPanel
            height={panelHeight}
            bottomInset={panelSearching ? 0 : insets.bottom}
            onSelectEmoji={handleInsertEmoji}
            onBackspace={handleEmojiBackspace}
            onSelectGif={handleSendGif}
            onSearchFocusChange={handlePanelSearchFocus}
          />
        )}
      </KeyboardAvoidingView>

      {/* HEADER — плаваюча скляна капсула «Dynamic Island» (розмиття), поверх списку */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
        }}
      >
        <GlassSurface
          radius={999}
          intensity={75}
          style={[
            {
              marginTop: insets.top + ISLAND_TOP_GAP,
              marginHorizontal: ISLAND_SIDE_MARGIN,
            },
            islandStyle,
          ]}
          contentStyle={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 4,
          }}
        >
          {searchOpen ? (
            <>
              <TouchableOpacity
                onPress={closeSearch}
                style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
                accessibilityRole="button"
                accessibilityLabel="Закрити пошук"
              >
                <Ionicons name="arrow-back" size={22} color={c.text} />
              </TouchableOpacity>
              <TextInput
                autoFocus
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Пошук по чату"
                placeholderTextColor={c.muted}
                returnKeyType="search"
                autoCorrect={false}
                selectionColor={c.accent}
                style={{
                  flex: 1,
                  color: c.text,
                  fontSize: 16,
                  paddingVertical: 0,
                  height: 44,
                }}
              />
              {searchText.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchText("")}
                  style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
                  accessibilityRole="button"
                  accessibilityLabel="Очистити пошук"
                >
                  <Ionicons name="close-circle" size={20} color={c.muted} />
                </TouchableOpacity>
              )}
            </>
          ) : (
          <>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
            accessibilityRole="button"
            accessibilityLabel="Назад"
          >
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push(`/settings/${chatRoomId}`)}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", height: 48 }}
            accessibilityRole="button"
            accessibilityLabel="Інформація про кімнату"
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: avatarColor(roomTitle),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>
                {initialsOf(roomTitle)}
              </Text>
            </View>

            <View style={{ flex: 1, marginLeft: 10, justifyContent: "center" }}>
              <Text
                numberOfLines={1}
                style={{ color: c.text, fontSize: 16, fontWeight: "700" }}
              >
                {roomTitle}
              </Text>
              <Animated.View style={[{ overflow: "hidden" }, islandSubtitleStyle]}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: typingText ? c.accent : c.muted,
                    fontSize: 12,
                    lineHeight: 16,
                  }}
                >
                  {typingText ?? (room ? membersLabel(memberCount) : " ")}
                </Text>
              </Animated.View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openSearch}
            style={{ width: 38, height: 40, alignItems: "center", justifyContent: "center" }}
            accessibilityRole="button"
            accessibilityLabel="Пошук по чату"
          >
            <Ionicons name="search" size={20} color={c.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push(`/settings/${chatRoomId}`)}
            style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
            accessibilityRole="button"
            accessibilityLabel="Налаштування кімнати"
          >
            <Ionicons name="ellipsis-vertical" size={20} color={c.muted} />
          </TouchableOpacity>
          </>
          )}
        </GlassSurface>

        {searchOpen && (
          <View style={{ marginHorizontal: ISLAND_SIDE_MARGIN, marginTop: 8 }}>
            <ChatSearchPanel
              query={searchQuery}
              results={searchResults}
              maxHeight={Math.round(windowHeight * 0.5)}
              onSelect={handleSelectSearchResult}
            />
          </View>
        )}
      </View>

      {shownPin && !searchOpen && (
        <Animated.View
          pointerEvents="box-none"
          style={[{ position: "absolute", left: 0, right: 0, zIndex: 25 }, pinBarStyle]}
        >
          <PinnedMessageBar
            count={pinCount}
            position={shownPinIndex + 1}
            senderName={shownPin.senderName}
            preview={shownPin.preview}
            onPress={handlePinBarPress}
            onUnpin={() => void handleTogglePin(shownPin._id, true)}
          />
        </Animated.View>
      )}

      <ImageViewerModal
        visible={!!fullscreenImage}
        imageUrl={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
      />

      <MessageActionSheet
        visible={!!actionMessage}
        preview={actionPreview}
        myReactions={actionMessage?.reactions
          ?.filter((r) => r.hasReacted)
          .map((r) => r.emoji)}
        actions={actionList}
        onClose={() => setActionMessage(null)}
        onReact={(emoji) => {
          if (actionMessage) {
            void handleToggleReaction(actionMessage._id, emoji);
          }
        }}
        onMoreReactions={() => {
          const messageId = actionMessage?._id ?? null;
          setActionMessage(null);
          // Дві модалки не можна показувати одночасно — чекаємо закриття меню.
          setTimeout(() => setPickerMessageId(messageId), 320);
        }}
      />

      <ReactionPickerModal
        visible={!!pickerMessageId}
        onClose={() => setPickerMessageId(null)}
        onSelectEmoji={(emoji) => {
          if (pickerMessageId) {
            void handleToggleReaction(pickerMessageId, emoji);
          }
        }}
      />

      <VideoNoteRecorderModal
        visible={isVideoModalVisible}
        onClose={() => setIsVideoModalVisible(false)}
        onSendVideo={handleSendVideo}
      />
    </View>
    </GlassProvider>
  );
}
