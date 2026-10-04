import { useStories } from "@/context/StoriesContext";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { Image } from "expo-image";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

/** «Збережені історії» (підбірки) у профілі: мініатюри, тап відкриває переглядач із цієї історії. */
export function StoryHighlights({ userId, isSelf }: { userId: Id<"users">; isSelf?: boolean }) {
  const c = useChatPalette();
  const { openStories } = useStories();
  const items = useQuery(api.stories.highlightsOf, { userId });
  if (!items || items.length === 0) return null;
  return (
    <View style={{ marginTop: 12, marginHorizontal: 12, borderRadius: 14, backgroundColor: c.header, paddingVertical: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, marginBottom: 8 }}>
        <Ionicons name="bookmark" size={16} color={c.accent} />
        <Text style={{ color: c.text, fontSize: 15, fontWeight: "700", marginLeft: 8 }}>Збережені історії</Text>
        <Text style={{ color: c.muted, fontSize: 13, marginLeft: 8 }}>{items.length}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10 }}>
        {items.map((it) => (
          <TouchableOpacity
            key={it._id}
            activeOpacity={0.8}
            onPress={() => openStories(userId, { highlights: true, storyId: it._id })}
            accessibilityRole="button"
            accessibilityLabel={isSelf ? "Моя збережена історія" : "Збережена історія"}
            style={{ marginHorizontal: 4 }}
          >
            <View style={{ width: 66, height: 66, borderRadius: 33, borderWidth: 2.2, borderColor: c.accent, padding: 2 }}>
              <Image source={{ uri: it.url }} contentFit="cover" style={{ flex: 1, borderRadius: 31, backgroundColor: c.search }} />
            </View>
            {it.kind === "video" ? (
              <Ionicons name="play-circle" size={18} color="#FFFFFF" style={{ position: "absolute", right: 2, bottom: 2 }} />
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
