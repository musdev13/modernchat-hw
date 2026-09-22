import React, { memo, useRef } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  FadeInDown,
  FadeOutLeft,
  FadeOutRight,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";
import { Id } from "@/convex/_generated/dataModel";
import { MessageReactions, ReactionItem } from "./MessageReactions";
import { ReactionPickerPosition } from "./ReactionPickerModal";

export interface MessageItemData {
  _id: Id<"messages">;
  senderId: Id<"users">;
  senderName: string;
  senderPhoto?: string;
  content?: string;
  imageUrl?: string;
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
    transform: [
      {
        translateX: translateX.value,
      },
    ],
  }));

  const animatedIconStyle = useAnimatedStyle(() => {
    const progress = Math.min(translateX.value / SWIPE_THRESHOLD, 1);

    return {
      opacity: progress,
      transform: [
        {
          scale: 0.5 + progress * 0.5,
        },
      ],
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
          <View
            ref={containerRef}
            className={`max-w-[82%] rounded-2xl p-3 ${
              isOwn ? "bg-primary rounded-br-xs" : "bg-secondary rounded-bl-xs"
            }`}
          >
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
                  source={{
                    uri: item.imageUrl,
                  }}
                  className="w-56 h-56 rounded-xl mb-1.5 bg-surface"
                  resizeMode="cover"
                />
              </TouchableOpacity>
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
                <Text className="text-white/60 text-[10px] italic">(ред.)</Text>
              )}

              <Text className="text-white/60 text-[10px]">
                {new Date(item._creationTime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
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
    prev.item.reactions === next.item.reactions &&
    prev.isOwn === next.isOwn,
);
