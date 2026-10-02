import { COLORS } from "@/constants/theme";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useRef } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInDown,
  FadeOutLeft,
  FadeOutRight,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { MessageReactions, ReactionItem } from "./MessageReactions";
import { ReactionPickerPosition } from "./ReactionPickerModal";
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
  onLongPress: (
    position: ReactionPickerPosition,
    message: MessageItemData,
  ) => void;
  onDoubleTap: (message: MessageItemData) => void;
  onToggleReaction: (emoji: string) => void;
  onReply: (message: MessageItemData) => void;
  onImagePress?: (url: string) => void;
  onAuthorPress?: (userId: Id<"users">) => void;
}

const SWIPE_THRESHOLD = 50;

function getReplyPreviewText(message: MessageItemData): string {
  if (message.content && message.content.trim().length > 0) {
    return message.content;
  }
  if (message.isVideoNote && message.videoUrl) {
    return "📹 Відеоповідомлення";
  }
  if (message.audioUrl) {
    const dur = message.audioDuration
      ? ` (${Math.round(message.audioDuration)}с)`
      : "";
    return `🎤 Голосове повідомлення${dur}`;
  }
  if (message.imageUrl) {
    return "📷 Фотографія";
  }
  return "";
}

const SwipeableMessageItemComponent: React.FC<SwipeableMessageItemProps> = ({
  item,
  isOwn,
  onLongPress,
  onDoubleTap,
  onToggleReaction,
  onReply,
  onImagePress,
  onAuthorPress,
}) => {
  const translateX = useSharedValue(0);
  const containerRef = useRef<View>(null);

  const triggerReply = () => {
    onReply(item);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
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

  const measureAndOpenReactionPicker = () => {
    containerRef.current?.measureInWindow((x, y, width) => {
      onLongPress({ x: isOwn ? x + width : x, y, isOwn }, item);
    });
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
    .minDuration(350)
    .onEnd((_event, success) => {
      if (!success) return;
      runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Heavy);
      runOnJS(measureAndOpenReactionPicker)();
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
      <View className="my-2 items-center justify-center px-6">
        <View className="rounded-full border border-surfaceLight bg-secondary px-3 py-1.5">
          <Text className="text-center text-[11px] font-medium text-textMuted">
            {item.content}
          </Text>
        </View>
      </View>
    );
  }

  const hasVideoNote = !!(item.isVideoNote && item.videoUrl);
  const hasVoice = !!item.audioUrl;
  const hasReactions = !!(item.reactions && item.reactions.length > 0);

  // 🔹 "Чистый" кружок — без bubble: только видео, без текста/reply/reactions/подписи
  const isPureVideoNote =
    hasVideoNote &&
    !item.content?.trim() &&
    !item.replyToSender &&
    !hasReactions;

  // Отступы и фон bubble применяем только если это НЕ чистый кружок
  const bubbleClassName = isPureVideoNote
    ? ""
    : `max-w-[82%] rounded-2xl p-3 ${
        isOwn ? "bg-primary rounded-br-xs" : "bg-secondary rounded-bl-xs"
      }`;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(15)}
      exiting={isOwn ? FadeOutRight.duration(200) : FadeOutLeft.duration(200)}
      className="relative justify-center my-1"
    >
      <Animated.View
        style={animatedIconStyle}
        className="absolute left-2 z-0 items-center justify-center w-8 h-8 rounded-full bg-primary/30"
      >
        <Ionicons name="arrow-undo" size={18} color={COLORS.primary} />
      </Animated.View>

      <GestureDetector gesture={composedGesture}>
        <Animated.View
          style={animatedBubbleStyle}
          className={`flex-row ${isOwn ? "justify-end" : "justify-start"}`}
        >
          <View ref={containerRef} className={bubbleClassName}>
            {/* 🔹 Чистый кружок — только видео, без всего остального */}
            {isPureVideoNote ? (
              <VideoNotePlayer
                videoUrl={item.videoUrl!}
                duration={item.videoDuration}
                isMine={isOwn}
              />
            ) : (
              <>
                {!isOwn && (
                  <TouchableOpacity
                    onPress={() => onAuthorPress?.(item.senderId)}
                    activeOpacity={0.7}
                    className="mb-1"
                  >
                    <Text className="text-primary font-bold text-xs">
                      {item.senderName}
                    </Text>
                  </TouchableOpacity>
                )}

                {item.replyToSender && (
                  <View className="mb-2 p-2 rounded-lg bg-surface/50 border-l-2 border-primary">
                    <Text className="text-primary font-semibold text-[11px]">
                      {item.replyToSender}
                    </Text>

                    <Text
                      className="text-white/70 text-xs mt-0.5"
                      numberOfLines={2}
                    >
                      {item.replyToText || "📷 Фотографія"}
                    </Text>
                  </View>
                )}

                {item.imageUrl && (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => onImagePress?.(item.imageUrl!)}
                  >
                    <Image
                      source={{ uri: item.imageUrl }}
                      className="w-56 h-56 rounded-xl mb-1.5 bg-surface"
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
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

                {item.content ? (
                  <Text className="text-white text-base leading-5">
                    {item.content}
                  </Text>
                ) : null}

                <MessageReactions
                  reactions={item.reactions}
                  isOwn={isOwn}
                  onToggleReaction={onToggleReaction}
                />

                <View className="flex-row items-center justify-end mt-1 gap-1">
                  {item.isEdited && (
                    <Text className="text-white/60 text-[10px] italic">
                      (ред.)
                    </Text>
                  )}

                  <Text className="text-white/60 text-[10px]">
                    {new Date(item._creationTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
};

export const SwipeableMessageItem = memo(
  SwipeableMessageItemComponent,
  (prev, next) =>
    prev.item._id === next.item._id &&
    prev.item.content === next.item.content &&
    prev.item.isEdited === next.item.isEdited &&
    prev.item.imageUrl === next.item.imageUrl &&
    prev.item.audioUrl === next.item.audioUrl &&
    prev.item.videoUrl === next.item.videoUrl &&
    prev.item.waveform === next.item.waveform &&
    prev.item.reactions === next.item.reactions &&
    prev.isOwn === next.isOwn,
);