import { KawaiiAvatar } from "@/components/ui/KawaiiAvatar";
import { KawaiiBadge } from "@/components/ui/KawaiiBadge";
import { KawaiiGradient } from "@/components/ui/KawaiiGradient";
import { COLORS, FONTS } from "@/constants/theme";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
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
  avatarUrl?: string;
}

interface SwipeableRoomItemProps {
  room: RoomData;
  isCreator: boolean;
  onPress: () => void;
  onDelete: (roomId: Id<"chatRooms">) => void;
}

const ACTION_WIDTH = 82;

export const SwipeableRoomItem: React.FC<SwipeableRoomItemProps> = ({
  room,
  isCreator,
  onPress,
  onDelete,
}) => {
  const translateX = useSharedValue(0);

  const resetPosition = () => {
    "worklet";
    translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
  };

  const handleDeletePress = () => {
    resetPosition();
    onDelete(room._id);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
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
        translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
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
    <View
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 20,
        marginBottom: 10,
      }}
    >
      <LinearGradient
        colors={["#FF5C7A", "#E11D48"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
          paddingRight: 18,
        }}
      >
        <TouchableOpacity
          onPress={handleDeletePress}
          activeOpacity={0.8}
          style={{
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            paddingHorizontal: 8,
          }}
        >
          <Animated.View style={[animatedIconStyle, { alignItems: "center" }]}>
            <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
            <Text
              style={{
                color: "#FFFFFF",
                fontFamily: FONTS.bodyBold,
                fontSize: 10,
                marginTop: 2,
              }}
            >
              {isCreator ? "Видалити" : "Покинути"}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </LinearGradient>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedCardStyle}>
          <TouchableOpacity
            onPress={() => {
              if (translateX.value !== 0) {
                resetPosition();
              } else {
                onPress();
              }
            }}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["#2A2238", "#241D33"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "rgba(255,143,180,0.15)",
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                shadowColor: "#FF8FB4",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.12,
                shadowRadius: 10,
                elevation: 4,
              }}
            >
              <View style={{ marginRight: 12 }}>
                {room.avatarUrl ? (
                  <KawaiiAvatar
                    uri={room.avatarUrl}
                    name={room.title}
                    size={46}
                    ring="none"
                  />
                ) : (
                  <KawaiiGradient
                    variant="primary"
                    glow
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="chatbubbles" size={20} color="#FFFFFF" />
                  </KawaiiGradient>
                )}
              </View>

              <View style={{ flex: 1, marginRight: 8 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 3,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: FONTS.headingBold,
                      fontSize: 15,
                      color: COLORS.text,
                      flexShrink: 1,
                    }}
                  >
                    {room.title}
                  </Text>

                  {isCreator && (
                    <KawaiiBadge label="автор" icon="👑" variant="gold" />
                  )}
                </View>

                {room.lastMessage ? (
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 12,
                      color: COLORS.textMuted,
                    }}
                  >
                    {room.lastMessage}
                  </Text>
                ) : (
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 12,
                      color: "rgba(168,155,184,0.6)",
                      fontStyle: "italic",
                    }}
                  >
                    {room.description || "Повідомлень ще немає ✨"}
                  </Text>
                )}
              </View>

              <View style={{ alignItems: "flex-end", gap: 5 }}>
                {room.lastMessageAt ? (
                  <Text
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 10,
                      color: COLORS.textMuted,
                    }}
                  >
                    {new Date(room.lastMessageAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                ) : null}

                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: "rgba(255,143,180,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={13}
                    color={COLORS.primary}
                  />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};