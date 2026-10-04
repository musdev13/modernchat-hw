import { avatarColor, initialsOf } from "@/constants/theme";
import { useSettings } from "@/context/SettingsContext";
import { useStories } from "@/context/StoriesContext";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { emojiOnlyCount, formatTime, isStickerContent } from "@/utils/chat";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import React, { memo, useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOutLeft,
  FadeOutRight,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { firstPreviewUrl } from "@/utils/linkify";
import { NameBadges } from "./PremiumBadge";
import { FileBubble, ratioFrom, VideoBubble } from "./AttachmentBubbles";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { MessageText, takeRecentLinkTouch, showLinkMenu } from "./MessageText";
import { MessageReactions, ReactionItem } from "./MessageReactions";
import { PollBubble, PollData } from "./PollBubble";
import { VideoNotePlayer } from "./VideoNotePlayer";
import { VoiceMessagePlayer } from "./VoiceMessagePlayer";

export interface MessageItemData {
  _id: Id<"messages">;
  senderId: Id<"users">;
  senderName: string;
  senderPhoto?: string;
  /** Автор має Modesto Premium (⭐ біля імені) та його емодзі-статус. */
  senderPremium?: boolean;
  senderEmojiStatus?: string;
  /** Premium-автор: власний колір імені (також смужки цитати). */
  senderNameColor?: string;
  /** Тег у «Збереженому» (Premium) та ефект повідомлення. */
  tag?: string;
  effect?: string;
  content?: string;
  imageUrl?: string;

  audioUrl?: string;
  audioStorageId?: Id<"_storage">;
  audioDuration?: number;
  waveform?: number[];

  videoUrl?: string;
  videoStorageId?: Id<"_storage">;
  videoDuration?: number;
  isVideoNote?: boolean;

  /** Опитування (дані підвантажує getPaginatedMessages). */
  poll?: PollData;

  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  mediaWidth?: number;
  mediaHeight?: number;

  isEdited?: boolean;
  replyToId?: Id<"messages">;
  replyToSender?: string;
  replyToText?: string;
  _creationTime: number;
  reactions?: ReactionItem[];
  isSystem?: boolean;
  /** Ім'я першого автора, якщо повідомлення переслане. */
  forwardedFrom?: string;
  /** Відповідь на історію / пересланa історія. */
  storyId?: Id<"stories">;
  storyQuote?: string;
}

interface SwipeableMessageItemProps {
  item: MessageItemData;
  isOwn: boolean;
  /** Перше повідомлення серії від одного автора (показуємо імʼя й аватар). */
  isFirstInSeries: boolean;
  /** Останнє повідомлення серії (маленький «хвостик» бульбашки). */
  isLastInSeries: boolean;
  /** Для цього повідомлення відкрите меню дій — підсвічуємо рядок. */
  isSelected?: boolean;
  /** Мітка дати над повідомленням (Сьогодні/Вчора/дата). */
  dateLabel?: string;
  onLongPress: (message: MessageItemData) => void;
  onDoubleTap: (message: MessageItemData) => void;
  onToggleReaction: (emoji: string) => void;
  /** Довге натискання на реакцію — показати, хто відреагував. */
  onShowReactors?: (messageId: Id<"messages">) => void;
  onReply: (message: MessageItemData) => void;
  onImagePress?: (url: string) => void;
  onVideoPress?: (url: string) => void;
  onAuthorPress?: (userId: Id<"users">) => void;
  /** Особистий чат: без аватарок і імен співрозмовника біля повідомлень. */
  isDirect?: boolean;
  /** Канал: пости на всю ширину, без аватарів і імен авторів. */
  isChannel?: boolean;
  /** Можна відповідати свайпом (у каналі — лише адміністраторам). */
  canReply?: boolean;
  /** Повідомлення написав поточний користувач (для керування опитуванням). */
  isMine?: boolean;
  /** Результат перекладу (Premium) — показується під текстом. */
  translation?: string;
  /** Тап по цитаті відповіді: перейти до оригінального повідомлення. */
  onReplyPress?: (messageId: Id<"messages">) => void;
  /** Лише для власних повідомлень: «sent» — одна галочка, «read» — прочитано іншими. */
  readStatus?: "sent" | "read";
  /** Змінюється, коли треба коротко підсвітити це повідомлення (після переходу). */
  flashToken?: number;
}

const SWIPE_THRESHOLD = 50;
const IMAGE_WIDTH = 240;
const AVATAR_SIZE = 34;
const STICKER_SIZE = 140;

/** Фото, які користувач завантажив вручну (при вимкненому автозавантаженні). */
const manuallyLoaded = new Set<string>();

/** Зображення з пропорціями оригіналу (також анімовані GIF). */
function ChatImage({ uri, knownRatio }: { uri: string; knownRatio?: number }) {
  const c = useChatPalette();
  const { settings } = useSettings();
  const auto = settings.data.autoPhoto;
  const [ratio, setRatio] = useState(knownRatio ?? 1);
  // Автозавантаження вимкнено: показуємо заглушку, доки фото не завантажено (або вже є в кеші).
  const [manual, setManual] = useState(() => manuallyLoaded.has(uri));
  useEffect(() => {
    if (auto || manual) return;
    let alive = true;
    Image.getCachePathAsync(uri)
      .then((path) => {
        if (alive && path) setManual(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [auto, manual, uri]);

  if (!auto && !manual) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          manuallyLoaded.add(uri);
          setManual(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Завантажити фото"
        style={{
          width: IMAGE_WIDTH,
          height: IMAGE_WIDTH / ratio,
          maxHeight: 360,
          borderRadius: 15,
          backgroundColor: withAlpha(c.muted, 0.18),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: "rgba(0,0,0,0.45)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-down" size={26} color="#FFFFFF" />
        </View>
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 8 }}>Натисніть, щоб завантажити</Text>
      </TouchableOpacity>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{
        width: IMAGE_WIDTH,
        height: IMAGE_WIDTH / ratio,
        borderRadius: 15,
        maxHeight: 360,
      }}
      contentFit="cover"
      onLoad={(e) => {
        const { width, height } = e.source;
        if (!knownRatio && width > 0 && height > 0) {
          setRatio(Math.min(1.8, Math.max(0.6, width / height)));
        }
      }}
    />
  );
}

/** Наліпка: маленька, без рамки та фону. */
function StickerImage({ uri }: { uri: string }) {
  return (
    <Image
      source={{ uri }}
      style={{
        width: STICKER_SIZE,
        height: STICKER_SIZE,
        backgroundColor: "transparent",
      }}
      contentFit="contain"
    />
  );
}

function Avatar({
  name,
  photo,
  onPress,
}: {
  name: string;
  photo?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Профіль: ${name}`}
    >
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: AVATAR_SIZE / 2,
            backgroundColor: avatarColor(name),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>
            {initialsOf(name)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const SwipeableMessageItemComponent: React.FC<SwipeableMessageItemProps> = ({
  item,
  isOwn,
  isFirstInSeries,
  isLastInSeries,
  isSelected = false,
  dateLabel,
  onLongPress,
  onDoubleTap,
  onToggleReaction,
  onShowReactors,
  onReply,
  onImagePress,
  onVideoPress,
  onAuthorPress,
  isDirect: isDirectProp = false,
  isChannel = false,
  canReply = true,
  isMine,
  onReplyPress,
  flashToken = 0,
  readStatus,
  translation,
}) => {
  const c = useChatPalette();
  const { settings } = useSettings();
  const textScale = settings.appearance.textScale;
  const isDirect = isDirectProp || isChannel;
  const translateX = useSharedValue(0);
  const flashValue = useSharedValue(0);

  useEffect(() => {
    if (!flashToken) return;
    flashValue.value = withSequence(
      withTiming(1, { duration: 220 }),
      withDelay(1100, withTiming(0, { duration: 700 })),
    );
  }, [flashToken, flashValue]);
  // Підсвітка рядка: під час довгого натискання та поки відкрите меню дій.
  const pressed = useSharedValue(0);
  const selected = useSharedValue(0);

  useEffect(() => {
    selected.value = withTiming(isSelected ? 1 : 0, { duration: 180 });
  }, [isSelected, selected]);

  const triggerReply = () => {
    onReply(item);
  };

  const panGesture = Gesture.Pan()
    .enabled(canReply)
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      if (event.translationX > 0) {
        translateX.value = Math.min(event.translationX, 80);
      }
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        runOnJS(triggerReply)();
      }

      translateX.value = withSpring(0, {
        damping: 16,
        stiffness: 200,
      });
    });

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
    void Haptics.impactAsync(style);
  };

  const openActions = () => {
    // Дотик почався на посиланні — показуємо меню посилання замість меню повідомлення.
    const link = takeRecentLinkTouch();
    if (link) {
      showLinkMenu(link);
      return;
    }
    onLongPress(item);
  };

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd((_event, success) => {
      if (!success) return;
      runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
      runOnJS(onDoubleTap)(item);
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(320)
    .onStart(() => {
      pressed.value = withTiming(1, { duration: 140 });
      runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
      runOnJS(openActions)();
    })
    .onFinalize(() => {
      pressed.value = withTiming(0, { duration: 220 });
    });

  const composedGesture = Gesture.Simultaneous(
    panGesture,
    Gesture.Exclusive(doubleTapGesture, longPressGesture),
  );

  const animatedBubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: Math.max(pressed.value, selected.value, flashValue.value),
  }));

  const animatedIconStyle = useAnimatedStyle(() => {
    const progress = Math.min(translateX.value / SWIPE_THRESHOLD, 1);
    return {
      opacity: progress,
      transform: [{ scale: 0.5 + progress * 0.5 }],
    };
  });

  if (item.isSystem) {
    return (
      <View style={{ marginVertical: 8, alignItems: "center", paddingHorizontal: 24 }}>
        <View
          style={{
            borderRadius: 14,
            backgroundColor: withAlpha(c.muted, 0.22),
            paddingHorizontal: 12,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: c.text, opacity: 0.85, fontSize: 12, textAlign: "center" }}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  }

  const hasVideoNote = !!(item.isVideoNote && item.videoUrl);
  const hasVoice = !!item.audioUrl;
  const hasImage = !!item.imageUrl;
  const hasVideo = !!(item.videoUrl && !item.isVideoNote);
  const hasFile = !!item.fileUrl;
  const hasPoll = !!item.poll;
  // Фото або відео: бульбашка без внутрішніх відступів, час поверх картинки.
  const hasVisual = hasImage || hasVideo;
  const hasReactions = !!(item.reactions && item.reactions.length > 0);
  const isSticker =
    hasImage && !hasVideoNote && !hasVoice && isStickerContent(item.content);
  const content = isSticker ? "" : item.content?.trim() ? item.content : "";
  const hasText = content.length > 0;

  // «Чистий» кружок — без бульбашки.
  const isPureVideoNote =
    hasVideoNote && !hasText && !item.replyToSender;

  const emojiCount =
    hasText && !hasVisual && !hasFile && !hasVideoNote && !hasVoice && !item.replyToSender && !hasReactions
      ? emojiOnlyCount(content)
      : 0;
  const isBigEmoji = emojiCount >= 1 && emojiCount <= 3;

  const textColor = isOwn ? c.outgoingText : c.incomingText;
  const metaColor = isOwn ? c.outgoingMeta : c.incomingMeta;
  const time = formatTime(item._creationTime);

  const previewUrl = hasText && !isBigEmoji ? firstPreviewUrl(content) : null;
  const inlineMeta =
    hasText && !hasVisual && !hasVideoNote && !hasVoice && !hasReactions && !previewUrl;
  const overlayMeta =
    hasVisual && !hasText && !hasReactions && !item.replyToSender;

  // Галочки: одна — надіслано, дві — прочитано.
  const ticks = (idleColor: string, readColor: string) =>
    isOwn && readStatus ? (
      <Ionicons
        name={readStatus === "read" ? "checkmark-done" : "checkmark"}
        size={15}
        color={readStatus === "read" ? readColor : idleColor}
        style={{ marginLeft: 3 }}
      />
    ) : null;

  const meta = (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {item.isEdited && (
        <Text style={{ color: metaColor, fontSize: 11, marginRight: 4 }}>ред.</Text>
      )}
      <Text style={{ color: metaColor, fontSize: 11 }}>{time}</Text>
      {ticks(metaColor, c.onAccent)}
    </View>
  );
  const videoTimeLabel =
    isOwn && readStatus ? `${time}  ${readStatus === "read" ? "✓✓" : "✓"}` : time;

  const R = settings.appearance.bubbleRadius;
  const tail = Math.min(5, R);
  const bubbleStyle = {
    backgroundColor: isOwn ? c.outgoing : c.incoming,
    maxWidth: isChannel ? ("94%" as const) : ("80%" as const),
    borderRadius: R,
    borderBottomRightRadius: isOwn && isLastInSeries ? tail : R,
    borderBottomLeftRadius: !isOwn && isLastInSeries ? tail : R,
    paddingHorizontal: hasVisual ? 3 : 10,
    paddingVertical: hasVisual ? 3 : 6,
  };

  const innerPad = hasVisual ? { paddingHorizontal: 7, paddingBottom: 3 } : null;

  return (
    <Animated.View
      entering={settings.appearance.animations ? FadeIn.duration(180) : undefined}
      exiting={isOwn ? FadeOutRight.duration(200) : FadeOutLeft.duration(200)}
      style={{ marginTop: isFirstInSeries ? 7 : 1.5 }}
    >
      {dateLabel ? (
        <View style={{ alignItems: "center", marginTop: 6, marginBottom: 10 }}>
          <View
            style={{
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 4,
              backgroundColor: withAlpha(c.muted, 0.28),
            }}
          >
            <Text style={{ color: c.text, fontSize: 12, fontWeight: "600" }}>
              {dateLabel}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ justifyContent: "center" }}>
        <Animated.View
          pointerEvents="none"
          style={[
            highlightStyle,
            {
              position: "absolute",
              top: -2,
              bottom: -2,
              left: 3,
              right: 3,
              borderRadius: 16,
              backgroundColor: withAlpha(c.accent, 0.24),
            },
          ]}
        />

        <Animated.View
          style={[
            animatedIconStyle,
            {
              position: "absolute",
              left: 10,
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withAlpha(c.muted, 0.3),
            },
          ]}
        >
          <Ionicons name="arrow-undo" size={17} color={c.text} />
        </Animated.View>

        <GestureDetector gesture={composedGesture}>
          <Animated.View
            style={[
              animatedBubbleStyle,
              {
                flexDirection: "row",
                justifyContent: isOwn ? "flex-end" : "flex-start",
                alignItems: "flex-start",
                paddingHorizontal: 8,
              },
            ]}
          >
            {!isOwn && !isDirect && (
              <View style={{ width: AVATAR_SIZE, marginRight: 6 }}>
                {isFirstInSeries ? (
                  <Avatar
                    name={item.senderName}
                    photo={item.senderPhoto}
                    onPress={() => onAuthorPress?.(item.senderId)}
                  />
                ) : null}
              </View>
            )}

            {isPureVideoNote ? (
              <VideoNotePlayer
                videoUrl={item.videoUrl!}
                duration={item.videoDuration}
                isMine={isOwn}
                reactions={item.reactions}
                onToggleReaction={onToggleReaction}
                timeLabel={videoTimeLabel}
              />
            ) : isSticker ? (
              <View style={{ alignItems: isOwn ? "flex-end" : "flex-start" }}>
                {!isOwn && !isDirect && isFirstInSeries && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: item.senderNameColor ?? avatarColor(item.senderName),
                        fontWeight: "700",
                        fontSize: 13,
                        flexShrink: 1,
                      }}
                    >
                      {item.senderName}
                    </Text>
                    <NameBadges premium={item.senderPremium} emoji={item.senderEmojiStatus} size={12} />
                  </View>
                )}

                {item.replyToSender ? (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => item.replyToId && onReplyPress?.(item.replyToId)}
                    style={{
                      maxWidth: 220,
                      marginBottom: 3,
                      paddingLeft: 8,
                      paddingRight: 8,
                      paddingVertical: 3,
                      borderLeftWidth: 2,
                      borderLeftColor: item.senderNameColor ?? c.accent,
                      backgroundColor: isOwn ? c.outgoing : c.incoming,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{ color: item.senderNameColor ?? c.accent, fontWeight: "700", fontSize: 12 }}
                    >
                      {item.replyToSender}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ color: isOwn ? c.outgoingText : c.incomingText, opacity: 0.8, fontSize: 12 }}
                    >
                      {item.replyToText || "Наліпка"}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {/* Час — під наліпкою в куті, щоб не перекривати малюнок. */}
                <View style={{ paddingBottom: 15, paddingHorizontal: 4 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => onImagePress?.(item.imageUrl!)}
                  >
                    <StickerImage uri={item.imageUrl!} />
                  </TouchableOpacity>
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      right: 4,
                      bottom: 0,
                      backgroundColor: "rgba(0,0,0,0.45)",
                      borderRadius: 10,
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={{ color: "#FFFFFF", fontSize: 11 }}>{time}</Text>
                      {ticks("rgba(255,255,255,0.65)", "#FFFFFF")}
                    </View>
                  </View>
                </View>

                {hasReactions && (
                  <View style={{ marginTop: 2 }}>
                    <MessageReactions
                      reactions={item.reactions}
                      isOwn={false}
                      onToggleReaction={onToggleReaction}
                      onLongPressReaction={() => onShowReactors?.(item._id)}
                    />
                  </View>
                )}
              </View>
            ) : isBigEmoji ? (
              <View style={{ alignItems: isOwn ? "flex-end" : "flex-start" }}>
                {!isOwn && !isDirect && isFirstInSeries && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                    <Text style={{ color: item.senderNameColor ?? avatarColor(item.senderName), fontWeight: "700", fontSize: 13, flexShrink: 1 }}>
                      {item.senderName}
                    </Text>
                    <NameBadges premium={item.senderPremium} emoji={item.senderEmojiStatus} size={12} />
                  </View>
                )}
                <Text
                  style={{
                    fontSize: emojiCount === 1 ? 64 : emojiCount === 2 ? 52 : 42,
                    lineHeight: (emojiCount === 1 ? 64 : emojiCount === 2 ? 52 : 42) * 1.25,
                    paddingHorizontal: 4,
                  }}
                >
                  {content}
                </Text>
                <View
                  style={{
                    marginTop: 2,
                    marginHorizontal: 4,
                    backgroundColor: withAlpha(c.muted, 0.25),
                    borderRadius: 10,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ color: c.text, opacity: 0.85, fontSize: 11 }}>{time}</Text>
                    {ticks(c.muted, c.accent)}
                  </View>
                </View>
              </View>
            ) : (
              <View style={bubbleStyle}>
                {!isOwn && !isDirect && isFirstInSeries && (
                  <TouchableOpacity
                    onPress={() => onAuthorPress?.(item.senderId)}
                    activeOpacity={0.7}
                    style={[{ marginBottom: 2 }, innerPad]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text
                        numberOfLines={1}
                        style={{ color: item.senderNameColor ?? avatarColor(item.senderName), fontWeight: "700", fontSize: 13, flexShrink: 1 }}
                      >
                        {item.senderName}
                      </Text>
                      <NameBadges premium={item.senderPremium} emoji={item.senderEmojiStatus} size={12} />
                    </View>
                  </TouchableOpacity>
                )}

                {item.storyId ? (
                  <StoryChip storyId={item.storyId} quote={item.storyQuote} isOwn={isOwn} style={hasVisual ? { marginHorizontal: 4, marginTop: 4 } : undefined} />
                ) : null}

                {item.forwardedFrom ? (
                  <Text
                    numberOfLines={1}
                    style={[
                      {
                        color: isOwn ? c.onAccent : c.accent,
                        fontSize: 13,
                        fontWeight: "600",
                        fontStyle: "italic",
                        marginBottom: 3,
                      },
                      innerPad,
                    ]}
                  >
                    Переслано від {item.forwardedFrom}
                  </Text>
                ) : null}

                {item.replyToSender ? (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => item.replyToId && onReplyPress?.(item.replyToId)}
                    style={[
                      {
                        marginBottom: 4,
                        paddingLeft: 8,
                        paddingRight: 8,
                        paddingVertical: 3,
                        borderLeftWidth: 2,
                        borderLeftColor: isOwn ? c.onAccent : c.accent,
                        backgroundColor: isOwn
                          ? withAlpha(c.onAccent, 0.15)
                          : withAlpha(c.accent, 0.1),
                        borderRadius: 6,
                      },
                      hasVisual ? { marginHorizontal: 4, marginTop: 4 } : null,
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: isOwn ? c.onAccent : c.accent,
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                    >
                      {item.replyToSender}
                    </Text>
                    <Text numberOfLines={2} style={{ color: textColor, opacity: 0.8, fontSize: 13 }}>
                      {item.replyToText || "📷 Фотографія"}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {hasImage && (
                  <View>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => onImagePress?.(item.imageUrl!)}
                    >
                      <ChatImage
                        uri={item.imageUrl!}
                        knownRatio={
                          item.mediaWidth && item.mediaHeight
                            ? ratioFrom(item.mediaWidth, item.mediaHeight)
                            : undefined
                        }
                      />
                    </TouchableOpacity>
                    {overlayMeta && (
                      <View
                        style={{
                          position: "absolute",
                          right: 10,
                          bottom: 10,
                          backgroundColor: "rgba(0,0,0,0.5)",
                          borderRadius: 10,
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Text style={{ color: "#FFFFFF", fontSize: 11 }}>{time}</Text>
                          {ticks("rgba(255,255,255,0.65)", "#FFFFFF")}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {hasVideo && (
                  <View>
                    <VideoBubble
                      url={item.videoUrl!}
                      width={item.mediaWidth}
                      height={item.mediaHeight}
                      duration={item.videoDuration}
                      onPress={() => onVideoPress?.(item.videoUrl!)}
                    />
                    {overlayMeta && (
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          right: 10,
                          bottom: 10,
                          backgroundColor: "rgba(0,0,0,0.5)",
                          borderRadius: 10,
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Text style={{ color: "#FFFFFF", fontSize: 11 }}>{time}</Text>
                          {ticks("rgba(255,255,255,0.65)", "#FFFFFF")}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {hasPoll && <PollBubble poll={item.poll!} isOwn={isOwn} isCreator={isMine ?? isOwn} />}

                {hasFile && (
                  <FileBubble
                    url={item.fileUrl!}
                    name={item.fileName}
                    size={item.fileSize}
                    isOwn={isOwn}
                  />
                )}

                {hasVideoNote && (
                  <VideoNotePlayer
                    videoUrl={item.videoUrl!}
                    duration={item.videoDuration}
                    isMine={isOwn}
                  />
                )}

                {hasVoice && (
                  <VoiceMessagePlayer
                    audioUrl={item.audioUrl!}
                    duration={item.audioDuration}
                    waveform={item.waveform}
                    isMine={isOwn}
                  />
                )}

                {hasText ? (
                  inlineMeta ? (
                    <View>
                      <MessageText
                        text={content}
                        isOwn={isOwn}
                        style={{ color: textColor, fontSize: 16 * textScale, lineHeight: 22 * textScale }}
                      >
                        {/* Місце під час у правому нижньому куті: переноситься разом
                            з останнім словом, а якщо рядок повний — на новий рядок. */}
                        {"\u00A0"}
                        <View
                          style={{
                            width: (item.isEdited ? 66 : 42) + (isOwn ? 16 : 0),
                            height: 1,
                          }}
                        />
                      </MessageText>
                      <View style={{ position: "absolute", right: 0, bottom: 0 }}>
                        {meta}
                      </View>
                    </View>
                  ) : (
                    <MessageText
                      text={content}
                      isOwn={isOwn}
                      style={[
                        { color: textColor, fontSize: 16 * textScale, lineHeight: 22 * textScale },
                        innerPad,
                        hasVisual ? { paddingTop: 5 } : null,
                      ]}
                    />
                  )
                ) : null}

                {translation ? (
                  <View style={[innerPad, { marginTop: 4, marginBottom: 2 }]}>
                    <View
                      style={{
                        borderLeftWidth: 2,
                        borderLeftColor: isOwn ? c.outgoingMeta : c.accent,
                        paddingLeft: 8,
                      }}
                    >
                      <Text style={{ color: isOwn ? c.outgoingMeta : c.accent, fontSize: 11, fontWeight: "700" }}>
                        Переклад
                      </Text>
                      <Text style={{ color: textColor, fontSize: 15 * textScale, lineHeight: 21 * textScale }}>
                        {translation}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {item.tag ? (
                  <View style={[innerPad, { marginTop: 2, flexDirection: "row" }]}>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        height: 22,
                        borderRadius: 11,
                        justifyContent: "center",
                        backgroundColor: withAlpha(isOwn ? c.outgoingText : c.accent, 0.16),
                      }}
                    >
                      <Text style={{ fontSize: 13 }}>{item.tag}</Text>
                    </View>
                  </View>
                ) : null}

                {previewUrl ? (
                  <View style={[innerPad, { marginBottom: 2 }]}>
                    <LinkPreviewCard url={previewUrl} isOwn={isOwn} />
                  </View>
                ) : null}

                {hasReactions && (
                  <View style={innerPad}>
                    <MessageReactions
                      reactions={item.reactions}
                      isOwn={isOwn}
                      onToggleReaction={onToggleReaction}
                      onLongPressReaction={() => onShowReactors?.(item._id)}
                    />
                  </View>
                )}

                {!inlineMeta && !overlayMeta && (
                  <View
                    style={[
                      { alignSelf: "flex-end", marginTop: 2 },
                      hasVisual ? { paddingRight: 7 } : null,
                    ]}
                  >
                    {meta}
                  </View>
                )}
              </View>
            )}
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
};

export const SwipeableMessageItem = memo(
  SwipeableMessageItemComponent,
  (prev, next) =>
    prev.isOwn === next.isOwn &&
    prev.isDirect === next.isDirect &&
    prev.isChannel === next.isChannel &&
    prev.canReply === next.canReply &&
    prev.isMine === next.isMine &&
    prev.isFirstInSeries === next.isFirstInSeries &&
    prev.isLastInSeries === next.isLastInSeries &&
    prev.isSelected === next.isSelected &&
    prev.dateLabel === next.dateLabel &&
    prev.item._id === next.item._id &&
    prev.item.content === next.item.content &&
    prev.item.isEdited === next.item.isEdited &&
    prev.item.imageUrl === next.item.imageUrl &&
    prev.item.audioUrl === next.item.audioUrl &&
    prev.item.videoUrl === next.item.videoUrl &&
    prev.item.fileUrl === next.item.fileUrl &&
    prev.item.senderName === next.item.senderName &&
    prev.item.senderPremium === next.item.senderPremium &&
    prev.item.senderEmojiStatus === next.item.senderEmojiStatus &&
    prev.item.senderNameColor === next.item.senderNameColor &&
    prev.item.tag === next.item.tag &&
    prev.translation === next.translation &&
    prev.item.forwardedFrom === next.item.forwardedFrom &&
    prev.item.storyId === next.item.storyId &&
    prev.item.senderPhoto === next.item.senderPhoto &&
    prev.item.replyToSender === next.item.replyToSender &&
    prev.item.replyToText === next.item.replyToText &&
    prev.item.replyToId === next.item.replyToId &&
    prev.flashToken === next.flashToken &&
    prev.readStatus === next.readStatus &&
    JSON.stringify(prev.item.poll) === JSON.stringify(next.item.poll) &&
    JSON.stringify(prev.item.reactions) === JSON.stringify(next.item.reactions),
);



/** Картка історії в повідомленні (відповідь на історію або пересланa історія); тап відкриває її. */
function StoryChip({
  storyId,
  quote,
  isOwn,
  style,
}: {
  storyId: Id<"stories">;
  quote?: string;
  isOwn: boolean;
  style?: object;
}) {
  const c = useChatPalette();
  const { openStoryById } = useStories();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => void openStoryById(storyId)}
      accessibilityRole="button"
      accessibilityLabel="Відкрити історію"
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 4,
          paddingHorizontal: 8,
          paddingVertical: 6,
          borderRadius: 10,
          borderLeftWidth: 3,
          borderLeftColor: isOwn ? c.onAccent : c.accent,
          backgroundColor: isOwn ? withAlpha(c.onAccent, 0.15) : withAlpha(c.accent, 0.1),
        },
        style,
      ]}
    >
      <Ionicons name="albums-outline" size={18} color={isOwn ? c.onAccent : c.accent} />
      <View style={{ marginLeft: 8, flexShrink: 1 }}>
        <Text style={{ color: isOwn ? c.onAccent : c.accent, fontWeight: "700", fontSize: 12.5 }}>Історія</Text>
        <Text numberOfLines={1} style={{ color: isOwn ? c.onAccent : c.text, opacity: 0.8, fontSize: 12.5 }}>
          {quote || "Відкрити"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
