import { useStories } from "@/context/StoriesContext";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette } from "@/hooks/useChatPalette";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

/** Глибоке посилання modesto://s/<id>: відкриваємо головний екран і одразу переглядач цієї історії. */
export default function StoryLinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useChatPalette();
  const { openStoryById } = useStories();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !id) return;
    done.current = true;
    router.replace("/(app)/(tabs)" as never);
    setTimeout(() => void openStoryById(id as Id<"stories">), 250);
  }, [id, router, openStoryById]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.divider }}>
      <ActivityIndicator size="large" color={c.accent} />
    </View>
  );
}
