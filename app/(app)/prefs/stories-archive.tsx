import { ActionSheet, SheetAction } from "@/components/ActionSheet";
import { useStories } from "@/context/StoriesContext";
import { usePremiumUi } from "@/context/PremiumContext";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { convexErrorData, convexErrorText } from "@/utils/convexError";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Архів історій: завершені історії (Premium — назавжди, безкоштовно — 7 діб), повторна публікація, підбірки. */
export default function StoriesArchiveScreen() {
  const c = useChatPalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { openStories } = useStories();
  const { openUpsell } = usePremiumUi();
  const archive = useQuery(api.stories.myArchive);
  const me = useQuery(api.users.currentUser);
  const repost = useMutation(api.stories.repost);
  const setHighlight = useMutation(api.stories.setHighlight);
  const removeStory = useMutation(api.stories.remove);
  const [active, setActive] = useState<NonNullable<typeof archive>["items"][number] | null>(null);

  const cell = Math.floor((width - 4) / 3);

  const fail = (title: string, e: unknown) => {
    const code = convexErrorData(e)?.code;
    if (code && ["HIGHLIGHTS_LIMIT", "LIMIT_ACTIVE"].includes(code) && !archive?.premium) openUpsell("stories", convexErrorText(e));
    else Alert.alert(title, convexErrorText(e));
  };

  const actions: SheetAction[] = active
    ? [
        {
          key: "view",
          label: "Переглянути",
          icon: "play-outline",
          onPress: () => me && openStories(me._id as Id<"users">, { storyId: active._id, archive: true }),
        },
        {
          key: "repost",
          label: "Опублікувати повторно",
          icon: "repeat-outline",
          onPress: () =>
            repost({ storyId: active._id })
              .then(() => Alert.alert("Готово", "Історію опубліковано знову."))
              .catch((e) => fail("Не вдалося опублікувати", e)),
        },
        {
          key: "hl",
          label: active.highlight ? "Прибрати з підбірок профілю" : "Додати до підбірок профілю",
          icon: active.highlight ? "bookmark" : "bookmark-outline",
          onPress: () => setHighlight({ storyId: active._id, on: !active.highlight }).catch((e) => fail("Не вдалося зберегти", e)),
        },
        {
          key: "del",
          label: "Видалити назавжди",
          icon: "trash-outline",
          destructive: true,
          onPress: () => removeStory({ storyId: active._id }).catch((e) => Alert.alert("Помилка", convexErrorText(e))),
        },
      ]
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12, paddingBottom: 10, backgroundColor: c.header }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(c.muted, 0.12) }}
          >
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </TouchableOpacity>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: "800", marginLeft: 12, flex: 1 }}>Архів історій</Text>
        </View>
        {archive ? (
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 8, marginHorizontal: 4, lineHeight: 18 }}>
            {archive.premium
              ? "З Modesto Premium завершені історії зберігаються назавжди."
              : `Безкоштовно завершені історії зберігаються ${archive.keepDays} діб. З Modesto Premium — назавжди.`}
            {"\n"}Підбірки профілю: {archive.highlightsUsed} з {archive.premium ? "∞" : archive.maxHighlights}
          </Text>
        ) : null}
      </View>
      {archive === undefined ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.accent} />
      ) : archive === null || archive.items.length === 0 ? (
        <Text style={{ color: c.muted, textAlign: "center", marginTop: 60, fontSize: 15, paddingHorizontal: 30 }}>
          Архів порожній. Завершені історії з’являться тут.
        </Text>
      ) : (
        <FlatList
          data={archive.items}
          numColumns={3}
          keyExtractor={(i) => i._id}
          contentContainerStyle={{ padding: 2, paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.8} onPress={() => setActive(item)} style={{ width: cell, height: cell * 1.5, margin: 1 }}>
              <Image source={{ uri: item.url }} contentFit="cover" style={{ flex: 1, backgroundColor: c.search }} />
              {item.kind === "video" ? (
                <Ionicons name="play-circle" size={22} color="#FFFFFF" style={{ position: "absolute", top: 6, right: 6 }} />
              ) : null}
              {item.highlight ? (
                <Ionicons name="bookmark" size={18} color="#F5C451" style={{ position: "absolute", top: 6, left: 6 }} />
              ) : null}
              <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 5, backgroundColor: "rgba(0,0,0,0.4)", flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="eye-outline" size={13} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 12, marginLeft: 4 }}>{item.viewCount}</Text>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, marginLeft: "auto" }}>
                  {new Date(item.createdAt).toLocaleDateString("uk-UA", { day: "numeric", month: "short" })}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
      <ActionSheet visible={!!active} onClose={() => setActive(null)} title="Історія з архіву" actions={actions.map((a) => ({ ...a, onPress: () => { setActive(null); a.onPress(); } }))} />
    </View>
  );
}
