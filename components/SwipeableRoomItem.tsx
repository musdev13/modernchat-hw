import React, { useState } from "react";
import { Image, View, Text, TouchableOpacity } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { BouncyPressable } from "@/components/BouncyPressable";
import { getThemeColors, useAppTheme } from "@/components/AppThemeProvider";
import Animated, {
  runOnJS,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Id } from "@/convex/_generated/dataModel";

interface RoomData {
  _id: Id<"chatRooms">;
  title: string;
  description?: string;
  avatarUrl?: string;
  creatorId: Id<"users">;
  lastMessage?: string;
  lastMessageAt?: number;
  isFavorite: boolean;
  participants: { _id: Id<"users">; name: string; image?: string }[];
}

interface SwipeableRoomItemProps {
  room: RoomData;
  isCreator: boolean;
  onPress: () => void;
  onDelete: (roomId: Id<"chatRooms">) => void;
  onToggleFavorite: () => void;
}

const ACTION_WIDTH = 80;

export const SwipeableRoomItem: React.FC<SwipeableRoomItemProps> = ({
  room,
  isCreator,
  onPress,
  onDelete,
  onToggleFavorite,
}) => {
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const translateX = useSharedValue(0);
  const [isSwipeOpen, setIsSwipeOpen] = useState(false);

  const resetPosition = () => {
    "worklet";

    translateX.value = withSpring(0, {
      damping: 18,
      stiffness: 180,
    });
  };

  const handleDeletePress = () => {
    setIsSwipeOpen(false);
    resetPosition();
    onDelete(room._id);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      if (event.translationX <= 0) {
        translateX.value = Math.max(
          event.translationX,
          -ACTION_WIDTH - 20
        );
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
        runOnJS(setIsSwipeOpen)(true);
      } else {
        translateX.value = withSpring(0, {
          damping: 18,
          stiffness: 180,
        });
        runOnJS(setIsSwipeOpen)(false);
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const animatedIconStyle = useAnimatedStyle(() => {
    const progress = Math.min(
      Math.abs(translateX.value) / ACTION_WIDTH,
      1
    );

    return {
      opacity: progress,
      transform: [
        {
          scale: 0.6 + 0.4 * progress,
        },
      ],
    };
  });

  return (
    <View className="relative overflow-hidden rounded-2xl mb-3">
      <View className="absolute inset-0 bg-danger rounded-2xl flex-row justify-end items-center pr-5">
        <TouchableOpacity
          onPress={handleDeletePress}
          activeOpacity={0.8}
          className="items-center justify-center h-full px-2"
        >
          <Animated.View
            style={animatedIconStyle}
            className="items-center"
          >
            <Ionicons
              name="trash-outline"
              size={24}
              color="#FFFFFF"
            />

            <Text
              className="text-white text-[11px] font-bold mt-1"
              style={{ color: "#FFFFFF" }}
            >
              {isCreator ? "Видалити" : "Покинути"}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={animatedCardStyle}
        >
          <View className="bg-surface border border-surfaceLight rounded-[24px] p-4 flex-row items-center">
            <TouchableOpacity
              onPress={() => {
                if (isSwipeOpen) {
                  setIsSwipeOpen(false);
                  resetPosition();
                } else {
                  onPress();
                }
              }}
              activeOpacity={0.9}
              className="flex-1 flex-row items-center mr-2"
            >
              {room.avatarUrl ? (
                <Image
                  source={{ uri: room.avatarUrl }}
                  className="mr-3.5 h-12 w-12 rounded-[18px] bg-primary/15"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-12 h-12 rounded-[18px] bg-primary/15 items-center justify-center mr-3.5">
                  <Ionicons name="chatbubbles" size={22} color={colors.primary} />
                </View>
              )}

              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-1.5">
                  <Text
                    className="text-white text-[15px] font-bold flex-shrink"
                    numberOfLines={1}
                  >
                    {room.title}
                  </Text>

                  {isCreator && (
                    <View className="bg-primary/15 px-2 py-0.5 rounded-full">
                      <Text className="text-primary text-[10px] font-semibold">
                        автор
                      </Text>
                    </View>
                  )}
                </View>

                {room.lastMessage ? (
                  <Text
                    className="text-textMuted text-[13px] mt-1.5"
                    numberOfLines={1}
                  >
                    {room.lastMessage}
                  </Text>
                ) : (
                  <Text
                    className="text-textMuted/60 text-xs italic mt-1"
                    numberOfLines={1}
                  >
                    {room.description || "Повідомлень ще немає"}
                  </Text>
                )}
                {room.participants.length > 0 && (
                  <View className="mt-2 flex-row items-center">
                    {room.participants.map((participant, participantIndex) => (
                      <View
                        key={participant._id}
                        className={`h-[19px] w-[19px] items-center justify-center overflow-hidden rounded-full border border-surface ${
                          participantIndex > 0 ? "-ml-1.5" : ""
                        }`}
                      >
                        {participant.image ? (
                          <Image
                            source={{ uri: participant.image }}
                            className="h-full w-full"
                          />
                        ) : (
                          <View className="h-full w-full items-center justify-center bg-primary/20">
                            <Ionicons name="person" size={10} color={colors.primary} />
                          </View>
                        )}
                      </View>
                    ))}
                    <Text className="ml-1.5 text-[10px] text-textMuted">
                      учасники
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <View className="items-center">
              {room.lastMessageAt ? (
                <Text className="text-textMuted text-[10px] mb-1">
                  {new Date(room.lastMessageAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              ) : null}
              <View className="flex-row items-center">
                <BouncyPressable
                  onPress={onToggleFavorite}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={
                    room.isFavorite ? "Прибрати з обраного" : "Додати до обраного"
                  }
                  contentStyle={{
                    width: 34,
                    height: 34,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 17,
                    backgroundColor: room.isFavorite
                      ? `${colors.accent}24`
                      : "transparent",
                  }}
                >
                  <Ionicons
                    name={room.isFavorite ? "star" : "star-outline"}
                    size={18}
                    color={room.isFavorite ? colors.accent : colors.textMuted}
                  />
                </BouncyPressable>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textMuted}
                />
              </View>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};
