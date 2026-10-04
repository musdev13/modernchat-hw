import { RoomAvatar } from "@/components/RoomAvatar";
import { useStories } from "@/context/StoriesContext";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { memo } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

const AVATAR = 56;
const RING = 66;

/** Кільце навколо аватара: кольоровий градієнт для непереглянутих, сіре для переглянутих. */
const StoryRing = memo(function StoryRing({
  viewed,
  gradientId,
  children,
}: {
  viewed: boolean;
  gradientId: string;
  children: React.ReactNode;
}) {
  const c = useChatPalette();
  const stroke = 2.6;
  const r = (RING - stroke) / 2;
  return (
    <View style={{ width: RING, height: RING, alignItems: "center", justifyContent: "center" }}>
      <Svg width={RING} height={RING} style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.accent} />
            <Stop offset="1" stopColor={c.glow} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={viewed ? withAlpha(c.muted, 0.45) : `url(#${gradientId})`}
        />
      </Svg>
      {children}
    </View>
  );
});

/** Рядок історій над списком чатів: «Моя історія» з «+» і кільця контактів. */
export const StoryRow = memo(function StoryRow({ myName, myImage }: { myName: string; myImage?: string | null }) {
  const c = useChatPalette();
  const { openStories, openComposer } = useStories();
  const feed = useQuery(api.stories.feed);
  const me = useQuery(api.users.currentUser);
  const mine = feed?.me;
  const hasMine = (mine?.count ?? 0) > 0;

  return (
    <View style={{ backgroundColor: c.header, paddingBottom: 6 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 4 }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => (hasMine && me?._id ? openStories(me._id as Id<"users">) : openComposer())}
          accessibilityRole="button"
          accessibilityLabel="Моя історія"
          style={{ width: 76, alignItems: "center" }}
        >
          <View style={{ width: RING, height: RING }}>
            {hasMine ? (
              <StoryRing viewed={false} gradientId="storyMine">
                <RoomAvatar title={myName || "me"} imageUrl={myImage} size={AVATAR} />
              </StoryRing>
            ) : (
              <View style={{ width: RING, height: RING, alignItems: "center", justifyContent: "center" }}>
                <RoomAvatar title={myName || "me"} imageUrl={myImage} size={AVATAR} />
              </View>
            )}
            <TouchableOpacity
              onPress={openComposer}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Додати історію"
              style={{
                position: "absolute",
                right: -1,
                bottom: -1,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: c.accent,
                borderWidth: 2,
                borderColor: c.header,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="add" size={16} color={c.onAccent} />
            </TouchableOpacity>
          </View>
          <Text numberOfLines={1} style={{ color: c.text, fontSize: 12, marginTop: 4, maxWidth: 72 }}>
            Моя історія
          </Text>
        </TouchableOpacity>

        {(feed?.users ?? []).map((u) => (
          <TouchableOpacity
            key={u.userId}
            activeOpacity={0.8}
            onPress={() => openStories(u.userId)}
            accessibilityRole="button"
            accessibilityLabel={`Історія: ${u.name}`}
            style={{ width: 76, alignItems: "center" }}
          >
            <StoryRing viewed={u.allViewed} gradientId={`story_${u.userId}`}>
              <RoomAvatar title={u.name} imageUrl={u.image} size={AVATAR} />
            </StoryRing>
            <Text
              numberOfLines={1}
              style={{ color: u.allViewed ? c.muted : c.text, fontSize: 12, marginTop: 4, maxWidth: 72 }}
            >
              {u.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
});
