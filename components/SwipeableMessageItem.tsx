import { KawaiiGradient } from "@/components/ui/KawaiiGradient";
import { COLORS, FONTS } from "@/constants/theme";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useRef } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeInDown,
  FadeOutLeft,
  FadeOutRight,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { MessageMenuPosition } from "./MessageContextMenu";
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
  onLongPress: (
    position: MessageMenuPosition,
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
      translateX.value = withSpring(0, { damping: 16, stiffness: 200 });
    });

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
    void Haptics.impactAsync(style);
  };

  const measureAndOpenMenu = () => {
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
      runOnJS(measureAndOpenMenu)();
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
      <View
        style={{
          marginVertical: 6,
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: "rgba(183,148,246,0.25)",
            backgroundColor: "rgba(183,148,246,0.08)",
            paddingHorizontal: 12,
            paddingVertical: 5,
          }}
        >
          <Text
            style={{
              textAlign: "center",
              fontSize: 11,
              fontFamily: FONTS.body,
              color: COLORS.textMuted,
            }}
          >
            {item.content}
          </Text>
        </View>
      </View>
    );
  }

  const hasVideoNote = !!(item.isVideoNote && item.videoUrl);
  const hasVoice = !!item.audioUrl;
  const hasReactions = !!(item.reactions && item.reactions.length > 0);

  const isPureVideoNote =
    hasVideoNote &&
    !item.content?.trim() &&
    !item.replyToSender &&
    !hasReactions;

  return (
    <Animated.View
      entering={FadeInDown.duration(220).easing(Easing.out(Easing.cubic))}
      exiting={isOwn ? FadeOutRight.duration(200) : FadeOutLeft.duration(200)}
      style={{
        position: "relative",
        justifyContent: "center",
        marginVertical: 3,
      }}
    >
      <Animated.View
        style={[
          animatedIconStyle,
          {
            position: "absolute",
            left: 8,
            zIndex: 0,
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: "rgba(255,143,180,0.25)",
          },
        ]}
      >
        <Ionicons name="arrow-undo" size={18} color={COLORS.primary} />
      </Animated.View>

      <GestureDetector gesture={composedGesture}>
        <Animated.View
          style={[
            animatedBubbleStyle,
            {
              flexDirection: "row",
              justifyContent: isOwn ? "flex-end" : "flex-start",
            },
          ]}
        >
          <View ref={containerRef} style={{ maxWidth: "82%" }}>
            {isPureVideoNote ? (
              <VideoNotePlayer
                videoUrl={item.videoUrl!}
                duration={item.videoDuration}
                isMine={isOwn}
              />
            ) : isOwn ? (
              <KawaiiGradient
                variant="bubble-mine"
                style={{
                  borderRadius: 20,
                  borderBottomRightRadius: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                {item.replyToSender && (
                  <View
                    style={{
                      marginBottom: 6,
                      padding: 6,
                      borderRadius: 10,
                      backgroundColor: "rgba(0,0,0,0.15)",
                      borderLeftWidth: 2,
                      borderLeftColor: "#FFFFFF",
                    }}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontFamily: FONTS.bodyBold,
                        fontSize: 10,
                      }}
                    >
                      {item.replyToSender}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{
                        color: "rgba(255,255,255,0.8)",
                        fontFamily: FONTS.body,
                        fontSize: 11,
                        marginTop: 1,
                      }}
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
                      style={{
                        width: 200,
                        height: 200,
                        borderRadius: 14,
                        marginBottom: 4,
                        backgroundColor: COLORS.surface,
                      }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}

                {hasVideoNote && (
                  <VideoNotePlayer
                    videoUrl={item.videoUrl!}
                    duration={item.videoDuration}
                    isMine
                  />
                )}

                {hasVoice && (
                  <VoiceMessagePlayer
                    audioUrl={item.audioUrl!}
                    duration={item.audioDuration}
                    waveform={item.waveform}
                    isMine
                  />
                )}

                {item.content ? (
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontFamily: FONTS.body,
                      fontSize: 14,
                      lineHeight: 19,
                    }}
                  >
                    {item.content}
                  </Text>
                ) : null}

                <MessageReactions
                  reactions={item.reactions}
                  isOwn
                  onToggleReaction={onToggleReaction}
                />

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    marginTop: 3,
                    gap: 3,
                  }}
                >
                  {item.isEdited && (
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.7)",
                        fontFamily: FONTS.body,
                        fontSize: 9,
                        fontStyle: "italic",
                      }}
                    >
                      ред.
                    </Text>
                  )}
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.75)",
                      fontFamily: FONTS.body,
                      fontSize: 9,
                    }}
                  >
                    {new Date(item._creationTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </KawaiiGradient>
            ) : (
              <LinearGradient
                colors={["#2E2540", "#241D33"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 20,
                  borderBottomLeftRadius: 6,
                  borderWidth: 1,
                  borderColor: "rgba(183,148,246,0.18)",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                {!isOwn && (
                  <TouchableOpacity
                    onPress={() => onAuthorPress?.(item.senderId)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{ fontSize: 10 }}>🎀</Text>
                    <Text
                      style={{
                        color: COLORS.accent,
                        fontFamily: FONTS.bodyBold,
                        fontSize: 11,
                      }}
                    >
                      {item.senderName}
                    </Text>
                  </TouchableOpacity>
                )}

                {item.replyToSender && (
                  <View
                    style={{
                      marginBottom: 6,
                      padding: 6,
                      borderRadius: 10,
                      backgroundColor: "rgba(126,232,250,0.08)",
                      borderLeftWidth: 2,
                      borderLeftColor: COLORS.accent,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.accent,
                        fontFamily: FONTS.bodyBold,
                        fontSize: 10,
                      }}
                    >
                      {item.replyToSender}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{
                        color: COLORS.textMuted,
                        fontFamily: FONTS.body,
                        fontSize: 11,
                        marginTop: 1,
                      }}
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
                      style={{
                        width: 200,
                        height: 200,
                        borderRadius: 14,
                        marginBottom: 4,
                        backgroundColor: COLORS.surfaceLight,
                      }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}

                {hasVideoNote && (
                  <VideoNotePlayer
                    videoUrl={item.videoUrl!}
                    duration={item.videoDuration}
                    isMine={false}
                  />
                )}

                {hasVoice && (
                  <VoiceMessagePlayer
                    audioUrl={item.audioUrl!}
                    duration={item.audioDuration}
                    waveform={item.waveform}
                    isMine={false}
                  />
                )}

                {item.content ? (
                  <Text
                    style={{
                      color: COLORS.text,
                      fontFamily: FONTS.body,
                      fontSize: 14,
                      lineHeight: 19,
                    }}
                  >
                    {item.content}
                  </Text>
                ) : null}

                <MessageReactions
                  reactions={item.reactions}
                  isOwn={false}
                  onToggleReaction={onToggleReaction}
                />

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    marginTop: 3,
                    gap: 3,
                  }}
                >
                  {item.isEdited && (
                    <Text
                      style={{
                        color: COLORS.textMuted,
                        fontFamily: FONTS.body,
                        fontSize: 9,
                        fontStyle: "italic",
                      }}
                    >
                      ред.
                    </Text>
                  )}
                  <Text
                    style={{
                      color: COLORS.textMuted,
                      fontFamily: FONTS.body,
                      fontSize: 9,
                    }}
                  >
                    {new Date(item._creationTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </LinearGradient>
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