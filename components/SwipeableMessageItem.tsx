import { BouncyPressable } from "@/components/BouncyPressable";
import { getThemeColors, useAppTheme } from "@/components/AppThemeProvider";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { memo, useRef } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
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
  senderUsername?: string;
  senderEmoji?: string;
  senderPhoto?: string;
  forwardedFrom?: string;
  content?: string;
  imageUrl?: string;
  gifUrl?: string;

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
  isSaved?: boolean;
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
  canDelete?: boolean;
  onDelete?: (message: MessageItemData) => void;
  onToggleSaved?: (message: MessageItemData) => void;
  onForward?: (message: MessageItemData) => void;
}

const SWIPE_THRESHOLD = 50;

const SwipeableMessageItemComponent: React.FC<SwipeableMessageItemProps> = ({
  item,
  isOwn,
  onLongPress,
  onDoubleTap,
  onToggleReaction,
  onReply,
  onImagePress,
  onAuthorPress,
  canDelete = false,
  onDelete,
  onToggleSaved,
  onForward,
}) => {
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
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
    .runOnJS(true)
    // The gesture callback reads the ref on the JS thread to measure the tapped message.
    // eslint-disable-next-line react-hooks/refs
    .onEnd((_event, success) => {
      if (!success) return;
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      measureAndOpenReactionPicker();
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
      <View className="my-2 flex-row items-center justify-center px-6">
        <View className="rounded-full border border-surfaceLight bg-secondary px-3 py-1.5">
          <Text className="text-center text-[11px] font-medium text-textMuted">
            {item.content}
          </Text>
        </View>
        {canDelete && (
          <BouncyPressable
            onPress={() => onDelete?.(item)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Удалить системное сообщение"
            contentStyle={{
              marginLeft: 6,
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.1)",
            }}
          >
            <Ionicons name="trash-outline" size={12} color={colors.textMuted} />
          </BouncyPressable>
        )}
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
    : `max-w-[82%] overflow-hidden rounded-2xl p-3 ${
        isOwn ? "bg-primary rounded-br-xs" : "bg-secondary rounded-bl-xs"
      }`;

  return (
    <Animated.View className="relative justify-center my-1">
      <Animated.View
        style={animatedIconStyle}
        className="absolute left-2 z-0 items-center justify-center w-8 h-8 rounded-full bg-primary/30"
      >
        <Ionicons name="arrow-undo" size={18} color={colors.primary} />
      </Animated.View>

      <GestureDetector gesture={composedGesture}>
        <Animated.View
          style={animatedBubbleStyle}
          className={`flex-row items-end ${isOwn ? "justify-end" : "justify-start"}`}
        >
          {!isOwn && !item.isSystem && (
            <View className="mb-1 mr-2 h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary/15">
              {item.senderPhoto ? (
                <Image
                  source={{ uri: item.senderPhoto }}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <Ionicons name="person" size={16} color={colors.primary} />
              )}
            </View>
          )}
          <View
            ref={containerRef}
            className={`${bubbleClassName} ${!isOwn ? "max-w-[74%]" : ""}`}
            style={
              hasReactions
                ? {
                    borderWidth: 1,
                    borderColor: isOwn ? `${colors.white}99` : colors.primary,
                  }
                : undefined
            }
          >
            {isOwn && (
              <LinearGradient
                pointerEvents="none"
                colors={[colors.primary, colors.primaryDark, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="absolute inset-0"
              />
            )}
            {/* 🔹 Чистый кружок — только видео, без всего остального */}
            {isPureVideoNote ? (
              <View>
                <VideoNotePlayer
                  videoUrl={item.videoUrl!}
                  duration={item.videoDuration}
                  isMine={isOwn}
                />
                <BouncyPressable
                  onPress={() => onForward?.(item)}
                  containerStyle={{ alignSelf: "flex-end", marginTop: 4 }}
                  contentStyle={{
                    width: 28,
                    height: 24,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Переслати повідомлення"
                >
                  <Ionicons
                    name="arrow-redo-outline"
                    size={14}
                    color={colors.primary}
                  />
                </BouncyPressable>
              </View>
            ) : (
              <>
                {!isOwn && (
                  <TouchableOpacity
                    onPress={() => onAuthorPress?.(item.senderId)}
                    activeOpacity={0.7}
                    className="mb-1"
                  >
                    <Text className="text-primary font-bold text-xs">
                      {item.senderUsername
                        ? `@${item.senderUsername}${item.senderEmoji ? ` ${item.senderEmoji}` : ""}`
                        : item.senderName}
                    </Text>
                  </TouchableOpacity>
                )}

                {item.forwardedFrom && (
                  <View className="mb-1 flex-row items-center">
                    <Ionicons
                      name="arrow-redo-outline"
                      size={12}
                      color={colors.accent}
                    />
                    <Text className="ml-1 text-[11px] font-semibold text-accent">
                      Переслано від {item.forwardedFrom}
                    </Text>
                  </View>
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

                {item.gifUrl && (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => onImagePress?.(item.gifUrl!)}
                    accessibilityRole="button"
                    accessibilityLabel="Переглянути GIF"
                  >
                    <ExpoImage
                      source={{ uri: item.gifUrl }}
                      style={{
                        width: 232,
                        height: 156,
                        borderRadius: 12,
                        marginBottom: 6,
                        backgroundColor: colors.surface,
                      }}
                      contentFit="cover"
                      autoplay
                      cachePolicy="memory-disk"
                      transition={80}
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
                  <Text
                    className="text-white text-base leading-5"
                    style={isOwn ? { color: "#FFFFFF" } : undefined}
                  >
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
                    <Text
                      className="text-white/60 text-[10px] italic"
                      style={
                        isOwn
                          ? { color: "rgba(255,255,255,0.6)" }
                          : undefined
                      }
                    >
                      (ред.)
                    </Text>
                  )}

                  <Text
                    className="text-white/60 text-[10px]"
                    style={
                      isOwn
                        ? { color: "rgba(255,255,255,0.6)" }
                        : undefined
                    }
                  >
                    {new Date(item._creationTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <BouncyPressable
                    onPress={() => onToggleSaved?.(item)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={
                      item.isSaved
                        ? "Прибрати зі збережених"
                        : "Зберегти повідомлення"
                    }
                    accessibilityState={{ selected: item.isSaved }}
                    contentStyle={{
                      marginLeft: 2,
                      width: 24,
                      height: 24,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={item.isSaved ? "bookmark" : "bookmark-outline"}
                      size={13}
                      color={item.isSaved ? colors.accent : colors.white}
                    />
                  </BouncyPressable>
                  <BouncyPressable
                    onPress={() => onForward?.(item)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Переслати повідомлення"
                    contentStyle={{
                      marginLeft: 2,
                      width: 24,
                      height: 24,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name="arrow-redo-outline"
                      size={14}
                      color={colors.white}
                    />
                  </BouncyPressable>
                  {canDelete && (
                    <BouncyPressable
                      onPress={() => onDelete?.(item)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Удалить сообщение"
                      contentStyle={{
                        marginLeft: 3,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(255,255,255,0.13)",
                      }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={12}
                        color={colors.white}
                      />
                    </BouncyPressable>
                  )}
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
    prev.item.forwardedFrom === next.item.forwardedFrom &&
    prev.item.senderEmoji === next.item.senderEmoji &&
    prev.item.isEdited === next.item.isEdited &&
    prev.item.imageUrl === next.item.imageUrl &&
    prev.item.audioUrl === next.item.audioUrl &&
    prev.item.videoUrl === next.item.videoUrl &&
    prev.item.waveform === next.item.waveform &&
    prev.item.reactions === next.item.reactions &&
    prev.item.isSaved === next.item.isSaved &&
    prev.isOwn === next.isOwn &&
    prev.canDelete === next.canDelete &&
    prev.onDelete === next.onDelete &&
    prev.onForward === next.onForward,
);