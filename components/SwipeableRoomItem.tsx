import { NameBadges } from "@/components/PremiumBadge";
import { RoomAvatar } from "@/components/RoomAvatar";
import { useTheme } from "@/context/ThemeContext";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface RoomData {
  _id: Id<"chatRooms">;
  title: string;
  description?: string;
  avatarUrl?: string;
  creatorId: Id<"users">;
  lastMessage?: string;
  lastMessageAt?: number;
  /** Особистий (1:1) чат. */
  isDirect?: boolean;
  /** «Збережене» (чат із собою). */
  isSaved?: boolean;
  /** Канал (публікують лише адміністратори). */
  isChannel?: boolean;
  /** Закріплено нагорі списку. */
  pinned?: boolean;
  /** Співрозмовник має Modesto Premium (лише для особистих чатів). */
  otherPremium?: boolean;
  otherEmojiStatus?: string;
}

interface SwipeableRoomItemProps {
  room: RoomData;
  isCreator: boolean;
  /** Кількість непрочитаних (0 або undefined — все прочитано). */
  unreadCount?: number;
  /** Сповіщення цієї кімнати вимкнені. */
  muted?: boolean;
  /** Співрозмовник у мережі (зелена крапка на аватарі, лише особисті чати). */
  online?: boolean;
  /** «друкує…» — показується замість останнього повідомлення. */
  typingText?: string;
  /** Незавершене повідомлення (чернетка) — показується замість останнього повідомлення. */
  draft?: string;
  onPress: () => void;
  /** Свайп вліво: видалити / покинути (для особистого чату — приховати). */
  onDelete: (roomId: Id<"chatRooms">) => void;
  /** Довге натискання (меню дій). Без нього довге натискання викликає onDelete. */
  onLongPress?: (roomId: Id<"chatRooms">) => void;
}

const ACTION_WIDTH = 88;

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const diffDays = (now.getTime() - ts) / 86400000;
  if (diffDays < 7) {
    return d.toLocaleDateString("uk-UA", { weekday: "short" });
  }
  return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" });
}

export const SwipeableRoomItem: React.FC<SwipeableRoomItemProps> = ({
  room,
  isCreator,
  unreadCount = 0,
  muted = false,
  online = false,
  typingText,
  draft,
  onPress,
  onDelete,
  onLongPress,
}) => {
  const isDirect = !!room.isDirect;
  const draftText = draft?.replace(/\s+/g, " ").trim().slice(0, 120);
  const hasUnread = unreadCount > 0;
  const { colors: c } = useTheme();
  const translateX = useSharedValue(0);

  const resetPosition = () => {
    "worklet";

    translateX.value = withSpring(0, {
      damping: 18,
      stiffness: 180,
    });
  };

  const handleDeletePress = () => {
    resetPosition();
    onDelete(room._id);
  };

  const panGesture = Gesture.Pan()
    .enabled(!room.isSaved)
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      if (event.translationX <= 0) {
        translateX.value = Math.max(event.translationX, -ACTION_WIDTH - 20);
      } else {
        translateX.value = event.translationX * 0.15;
      }
    })
    .onEnd((event) => {
      if (event.translationX < -ACTION_WIDTH / 2) {
        translateX.value = withSpring(-ACTION_WIDTH, {
          damping: 18,
          stiffness: 180,
        });
      } else {
        translateX.value = withSpring(0, {
          damping: 18,
          stiffness: 180,
        });
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const animatedIconStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateX.value) / ACTION_WIDTH, 1);

    return {
      opacity: progress,
      transform: [{ scale: 0.6 + 0.4 * progress }],
    };
  });

  return (
    <View style={{ backgroundColor: c.bg, overflow: "hidden" }}>
      <View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          left: 0,
          backgroundColor: isDirect ? c.muted : c.danger,
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={handleDeletePress}
          activeOpacity={0.8}
          style={{
            width: ACTION_WIDTH,
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Animated.View style={[{ alignItems: "center" }, animatedIconStyle]}>
            <Ionicons
              name={
                isDirect ? "eye-off-outline" : isCreator ? "trash-outline" : "exit-outline"
              }
              size={24}
              color={c.onAccent}
            />
            <Text
              style={{
                color: c.onAccent,
                fontSize: 12,
                fontWeight: "700",
                marginTop: 2,
              }}
            >
              {isDirect ? "Приховати" : isCreator ? "Видалити" : "Покинути"}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[{ backgroundColor: c.bg }, animatedCardStyle]}>
          <TouchableOpacity
            onPress={() => {
              if (translateX.value !== 0) {
                resetPosition();
              } else {
                onPress();
              }
            }}
            onLongPress={() => (onLongPress ?? onDelete)(room._id)}
            delayLongPress={450}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 9,
            }}
          >
            <View style={{ marginRight: 12 }}>
              <RoomAvatar
                title={room.title}
                imageUrl={room.avatarUrl}
                size={54}
                saved={room.isSaved}
              />
              {room.isChannel ? (
                <View
                  style={{
                    position: "absolute",
                    right: -2,
                    bottom: -2,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: "#34C759",
                    borderWidth: 2,
                    borderColor: c.bg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="megaphone" size={10} color="#FFFFFF" />
                </View>
              ) : null}
              {isDirect && online ? (
                <View
                  style={{
                    position: "absolute",
                    right: 0,
                    bottom: 0,
                    width: 15,
                    height: 15,
                    borderRadius: 8,
                    backgroundColor: "#4CD964",
                    borderWidth: 2.5,
                    borderColor: c.bg,
                  }}
                />
              ) : null}
            </View>

            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
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
                  <Text
                    numberOfLines={1}
                    style={{
                      color: c.text,
                      fontSize: 16,
                      fontWeight: hasUnread ? "800" : "600",
                      flexShrink: 1,
                    }}
                  >
                    {room.title}
                  </Text>
                  {isDirect ? <NameBadges premium={room.otherPremium} emoji={room.otherEmojiStatus} size={14} /> : null}
                  {isCreator && !isDirect && (
                    <Ionicons
                      name="ribbon-outline"
                      size={14}
                      color={c.accent}
                      style={{ marginLeft: 6 }}
                    />
                  )}
                  {muted && (
                    <Ionicons
                      name="notifications-off"
                      size={14}
                      color={c.muted}
                      style={{ marginLeft: 6 }}
                    />
                  )}
                </View>

                {room.lastMessageAt ? (
                  <Text
                    style={{
                      color: hasUnread ? c.accent : c.muted,
                      fontSize: 12,
                      fontWeight: hasUnread ? "700" : "400",
                    }}
                  >
                    {formatTime(room.lastMessageAt)}
                  </Text>
                ) : null}
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
                {!typingText && draftText ? (
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, color: c.muted, fontSize: 14 }}
                  >
                    <Text style={{ color: c.danger }}>Чернетка: </Text>
                    {draftText}
                  </Text>
                ) : (
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: typingText ? c.accent : hasUnread ? c.text : c.muted,
                    fontSize: 14,
                    fontWeight: hasUnread ? "600" : "400",
                    fontStyle: room.lastMessage || typingText ? "normal" : "italic",
                  }}
                >
                  {typingText ||
                    room.lastMessage ||
                    (room.isSaved
                      ? "Нотатки та переслані повідомлення"
                      : isDirect
                        ? undefined
                        : room.isChannel
                          ? "Публікацій ще немає"
                          : room.description) ||
                    "Повідомлень ще немає"}
                </Text>
                )}
                {!hasUnread && room.pinned && !room.isSaved && (
                  <Ionicons
                    name="pin"
                    size={16}
                    color={c.muted}
                    style={{ marginLeft: 8, transform: [{ rotate: "45deg" }] }}
                  />
                )}
                {hasUnread && (
                  <View
                    accessibilityLabel={`Непрочитаних: ${unreadCount}`}
                    style={{
                      minWidth: 22,
                      height: 22,
                      borderRadius: 11,
                      paddingHorizontal: 6,
                      marginLeft: 8,
                      backgroundColor: muted ? c.muted : c.accent,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: c.onAccent, fontSize: 12, fontWeight: "700" }}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>

          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: c.divider,
              marginLeft: 80,
            }}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

