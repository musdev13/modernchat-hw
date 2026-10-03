import { TG, avatarColor, initialsOf } from "@/constants/theme";
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
  creatorId: Id<"users">;
  lastMessage?: string;
  lastMessageAt?: number;
}

interface SwipeableRoomItemProps {
  room: RoomData;
  isCreator: boolean;
  onPress: () => void;
  onDelete: (roomId: Id<"chatRooms">) => void;
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
  onPress,
  onDelete,
}) => {
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
    <View style={{ backgroundColor: TG.bg, overflow: "hidden" }}>
      <View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          left: 0,
          backgroundColor: TG.danger,
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
              name={isCreator ? "trash-outline" : "exit-outline"}
              size={24}
              color="#FFFFFF"
            />
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 12,
                fontWeight: "700",
                marginTop: 2,
              }}
            >
              {isCreator ? "Видалити" : "Покинути"}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[{ backgroundColor: TG.bg }, animatedCardStyle]}>
          <TouchableOpacity
            onPress={() => {
              if (translateX.value !== 0) {
                resetPosition();
              } else {
                onPress();
              }
            }}
            onLongPress={() => onDelete(room._id)}
            delayLongPress={450}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 9,
            }}
          >
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: avatarColor(room.title),
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700" }}>
                {initialsOf(room.title)}
              </Text>
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
                      color: TG.text,
                      fontSize: 16,
                      fontWeight: "700",
                      flexShrink: 1,
                    }}
                  >
                    {room.title}
                  </Text>
                  {isCreator && (
                    <Ionicons
                      name="ribbon-outline"
                      size={14}
                      color={TG.accent}
                      style={{ marginLeft: 6 }}
                    />
                  )}
                </View>

                {room.lastMessageAt ? (
                  <Text style={{ color: TG.muted, fontSize: 12 }}>
                    {formatTime(room.lastMessageAt)}
                  </Text>
                ) : null}
              </View>

              <Text
                numberOfLines={1}
                style={{
                  color: TG.muted,
                  fontSize: 14,
                  marginTop: 3,
                  fontStyle: room.lastMessage ? "normal" : "italic",
                }}
              >
                {room.lastMessage || room.description || "Повідомлень ще немає"}
              </Text>
            </View>
          </TouchableOpacity>

          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: TG.divider,
              marginLeft: 80,
            }}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

