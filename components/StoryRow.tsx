import { ActionSheet, SheetAction } from "@/components/ActionSheet";
import { RoomAvatar } from "@/components/RoomAvatar";
import { useStories } from "@/context/StoriesContext";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { memo, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

const AVATAR = 56;
const RING = 66;

/** Кільце навколо аватара: кольоровий градієнт для непереглянутих, сіре для переглянутих. */
const StoryRing = memo(function StoryRing({
  viewed,
  gradientId,
  close,
  children,
}: {
  viewed: boolean;
  gradientId: string;
  /** Історії «Близьких друзів» — зелене кільце. */
  close?: boolean;
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
            <Stop offset="0" stopColor={close ? "#34C759" : c.accent} />
            <Stop offset="1" stopColor={close ? "#A3E635" : c.glow} />
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
  const router = useRouter();
  const hideUser = useMutation(api.stories.hideUser);
  const [menuUser, setMenuUser] = useState<{ userId: Id<"users">; name: string } | null>(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const hiddenUsers = feed?.hidden ?? [];

  const menuActions: SheetAction[] = menuUser
    ? [
        { key: "open", label: "Переглянути історії", icon: "play-outline", onPress: () => openStories(menuUser.userId) },
        {
          key: "hide",
          label: "Приховати історії",
          icon: "eye-off-outline",
          onPress: () => {
            void Haptics.selectionAsync();
            hideUser({ userId: menuUser.userId, hidden: true }).catch(() => Alert.alert("Не вдалося приховати"));
          },
        },
      ]
    : [];
  const hiddenActions: SheetAction[] = [
    ...hiddenUsers.map((u) => ({
      key: u.userId as string,
      label: `${u.name} · переглянути`,
      icon: "play-outline" as const,
      onPress: () => openStories(u.userId),
    })),
    {
      key: "manage",
      label: "Керувати у налаштуваннях",
      icon: "settings-outline",
      onPress: () => router.push("/(app)/prefs/story-privacy" as never),
    },
  ];
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
            onLongPress={() => {
              void Haptics.selectionAsync();
              setMenuUser({ userId: u.userId, name: u.name });
            }}
            delayLongPress={320}
            accessibilityRole="button"
            accessibilityLabel={`Історія: ${u.name}`}
            style={{ width: 76, alignItems: "center" }}
          >
            <StoryRing viewed={u.allViewed} close={u.closeOnly} gradientId={`story_${u.userId}`}>
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

        {hiddenUsers.length > 0 ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setHiddenOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Приховані історії"
            style={{ width: 76, alignItems: "center" }}
          >
            <View style={{ width: RING, height: RING, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(c.muted, 0.18) }}>
                <Ionicons name="eye-off-outline" size={24} color={c.muted} />
              </View>
            </View>
            <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12, marginTop: 4, maxWidth: 72 }}>
              Приховані ({hiddenUsers.length})
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <ActionSheet
        visible={!!menuUser}
        onClose={() => setMenuUser(null)}
        title={menuUser?.name}
        actions={menuActions.map((a) => ({ ...a, onPress: () => { setMenuUser(null); a.onPress(); } }))}
      />
      <ActionSheet
        visible={hiddenOpen}
        onClose={() => setHiddenOpen(false)}
        title="Приховані історії"
        actions={hiddenActions.map((a) => ({ ...a, onPress: () => { setHiddenOpen(false); a.onPress(); } }))}
      />
    </View>
  );
});
