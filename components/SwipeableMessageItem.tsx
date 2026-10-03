import { avatarColor, initialsOf } from "@/constants/theme";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { emojiOnlyCount, formatTime } from "@/utils/chat";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import React, { memo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOutLeft,
  FadeOutRight,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { MessageReactions, ReactionItem } from "./MessageReactions";
import { VideoNotePlayer } from "./VideoNotePlayer";
import { VoiceMessagePlayer } from "./VoiceMessagePlayer";

export interface MessageItemData {
  _id: Id<"messages">;
  senderId: Id<"users">;
  senderName: string;
  senderPhoto?: string;
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

  isEdited?: boolean;
  replyToId?: Id<"messages">;
  replyToSender?: string;
  replyToText?: string;
  _creationTime: number;
  reactions?: ReactionItem[];
  isSystem?: boolean;
}

interface SwipeableMessageItemProps {
  item: MessageItemData;
  isOwn: boolean;
  /** Перше повідомлення серії від одного автора (показуємо імʼя й аватар). */
  isFirstInSeries: boolean;
  /** Останнє повідомлення серії (маленький «хвостик» бульбашки). */
  isLastInSeries: boolean;
  /** Мітка дати над повідомленням (Сьогодні/Вчора/дата). */
  dateLabel?: string;
  onLongPress: (message: MessageItemData) => void;
  onDoubleTap: (message: MessageItemData) => void;
  onToggleReaction: (emoji: string) => void;
  onReply: (message: MessageItemData) => void;
  onImagePress?: (url: string) => void;
  onAuthorPress?: (userId: Id<"users">) => void;
}

const SWIPE_THRESHOLD = 50;
const IMAGE_WIDTH = 240;
const AVATAR_SIZE = 34;

/** Зображення з пропорціями оригіналу (також анімовані GIF). */
function ChatImage({ uri }: { uri: string }) {
  const [ratio, setRatio] = useState(1);
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
        if (width > 0 && height > 0) {
          setRatio(Math.min(1.8, Math.max(0.6, width / height)));
        }
      }}
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
  dateLabel,
  onLongPress,
  onDoubleTap,
  onToggleReaction,
  onReply,
  onImagePress,
  onAuthorPress,
}) => {
  const c = useChatPalette();
  const translateX = useSharedValue(0);

  const triggerReply = () => {
    onReply(item);
  };

  const panGesture = Gesture.Pan()
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
      runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
      runOnJS(openActions)();
    });

  const composedGesture = Gesture.Simultaneous(
    panGesture,
    Gesture.Exclusive(doubleTapGesture, longPressGesture),
  );

  const animatedBubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
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
  const hasReactions = !!(item.reactions && item.reactions.length > 0);
  const content = item.content?.trim() ? item.content : "";
  const hasText = content.length > 0;

  // «Чистий» кружок — без бульбашки.
  const isPureVideoNote =
    hasVideoNote && !hasText && !item.replyToSender && !hasReactions;

  const emojiCount =
    hasText && !hasImage && !hasVideoNote && !hasVoice && !item.replyToSender && !hasReactions
      ? emojiOnlyCount(content)
      : 0;
  const isBigEmoji = emojiCount >= 1 && emojiCount <= 3;

  const textColor = isOwn ? c.outgoingText : c.incomingText;
  const metaColor = isOwn ? c.outgoingMeta : c.incomingMeta;
  const time = formatTime(item._creationTime);

  const inlineMeta =
    hasText && !hasImage && !hasVideoNote && !hasVoice && !hasReactions;
  const overlayMeta =
    hasImage && !hasText && !hasReactions && !item.replyToSender;

  const meta = (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {item.isEdited && (
        <Text style={{ color: metaColor, fontSize: 11, marginRight: 4 }}>ред.</Text>
      )}
      <Text style={{ color: metaColor, fontSize: 11 }}>{time}</Text>
    </View>
  );

  const bubbleStyle = {
    backgroundColor: isOwn ? c.outgoing : c.incoming,
    maxWidth: "80%" as const,
    borderRadius: 18,
    borderBottomRightRadius: isOwn && isLastInSeries ? 5 : 18,
    borderBottomLeftRadius: !isOwn && isLastInSeries ? 5 : 18,
    paddingHorizontal: hasImage ? 3 : 10,
    paddingVertical: hasImage ? 3 : 6,
  };

  const innerPad = hasImage ? { paddingHorizontal: 7, paddingBottom: 3 } : null;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
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
            {!isOwn && (
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
              <View>
                <VideoNotePlayer
                  videoUrl={item.videoUrl!}
                  duration={item.videoDuration}
                  isMine={isOwn}
                />
                <View
                  style={{
                    position: "absolute",
                    right: 6,
                    bottom: 4,
                    backgroundColor: "rgba(0,0,0,0.45)",
                    borderRadius: 10,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 11 }}>{time}</Text>
                </View>
              </View>
            ) : isBigEmoji ? (
              <View style={{ alignItems: isOwn ? "flex-end" : "flex-start" }}>
                {!isOwn && isFirstInSeries && (
                  <Text style={{ color: avatarColor(item.senderName), fontWeight: "700", fontSize: 13, marginBottom: 2 }}>
                    {item.senderName}
                  </Text>
                )}
                <Text style={{ fontSize: emojiCount === 1 ? 64 : emojiCount === 2 ? 52 : 42 }}>
                  {content}
                </Text>
                <Text style={{ color: c.muted, fontSize: 11 }}>{time}</Text>
              </View>
            ) : (
              <View style={bubbleStyle}>
                {!isOwn && isFirstInSeries && (
                  <TouchableOpacity
                    onPress={() => onAuthorPress?.(item.senderId)}
                    activeOpacity={0.7}
                    style={[{ marginBottom: 2 }, innerPad]}
                  >
                    <Text
                      numberOfLines={1}
                      style={{ color: avatarColor(item.senderName), fontWeight: "700", fontSize: 13 }}
                    >
                      {item.senderName}
                    </Text>
                  </TouchableOpacity>
                )}

                {item.replyToSender ? (
                  <View
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
                      hasImage ? { marginHorizontal: 4, marginTop: 4 } : null,
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
                  </View>
                ) : null}

                {hasImage && (
                  <View>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => onImagePress?.(item.imageUrl!)}
                    >
                      <ChatImage uri={item.imageUrl!} />
                    </TouchableOpacity>
                    {overlayMeta && (
                      <View
                        style={{
                          position: "absolute",
                          right: 8,
                          bottom: 8,
                          backgroundColor: "rgba(0,0,0,0.5)",
                          borderRadius: 10,
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                        }}
                      >
                        <Text style={{ color: "#FFFFFF", fontSize: 11 }}>{time}</Text>
                      </View>
                    )}
                  </View>
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
                      <Text style={{ color: textColor, fontSize: 16, lineHeight: 22 }}>
                        {content}
                        <Text style={{ color: "transparent", fontSize: 11 }}>
                          {"\u00A0".repeat(item.isEdited ? 18 : 10)}
                        </Text>
                      </Text>
                      <View style={{ position: "absolute", right: 0, bottom: 0 }}>
                        {meta}
                      </View>
                    </View>
                  ) : (
                    <Text
                      style={[
                        { color: textColor, fontSize: 16, lineHeight: 22 },
                        innerPad,
                        hasImage ? { paddingTop: 5 } : null,
                      ]}
                    >
                      {content}
                    </Text>
                  )
                ) : null}

                {hasReactions && (
                  <View style={innerPad}>
                    <MessageReactions
                      reactions={item.reactions}
                      isOwn={isOwn}
                      onToggleReaction={onToggleReaction}
                    />
                  </View>
                )}

                {!inlineMeta && !overlayMeta && (
                  <View
                    style={[
                      { alignSelf: "flex-end", marginTop: 2 },
                      hasImage ? { paddingRight: 7 } : null,
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
    prev.isFirstInSeries === next.isFirstInSeries &&
    prev.isLastInSeries === next.isLastInSeries &&
    prev.dateLabel === next.dateLabel &&
    prev.item._id === next.item._id &&
    prev.item.content === next.item.content &&
    prev.item.isEdited === next.item.isEdited &&
    prev.item.imageUrl === next.item.imageUrl &&
    prev.item.audioUrl === next.item.audioUrl &&
    prev.item.videoUrl === next.item.videoUrl &&
    prev.item.senderName === next.item.senderName &&
    prev.item.senderPhoto === next.item.senderPhoto &&
    prev.item.replyToSender === next.item.replyToSender &&
    prev.item.replyToText === next.item.replyToText &&
    JSON.stringify(prev.item.reactions) === JSON.stringify(next.item.reactions),
);

