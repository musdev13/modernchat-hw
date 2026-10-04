import { api } from "@/convex/_generated/api";
import { useChatPalette } from "@/hooks/useChatPalette";
import { useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

/** Глибоке посилання modernchat://u/<username>: знаходимо користувача й відкриваємо його профіль. */
export default function UserByUsernameScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const c = useChatPalette();
  const user = useQuery(api.users.findByUsername, username ? { username } : "skip");
  const me = useQuery(api.users.currentUser);

  useEffect(() => {
    if (!user || me === undefined) return;
    if (me && me._id === user._id) router.replace("/(app)/(tabs)/profile" as never);
    else router.replace(`/user/${user._id}` as never);
  }, [user, me, router]);

  if (user === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: c.divider }}>
        <Text style={{ color: c.text, fontSize: 18, textAlign: "center" }}>Користувача @{username} не знайдено</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ backgroundColor: c.accent, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12, marginTop: 20 }}
        >
          <Text style={{ color: c.onAccent, fontWeight: "700" }}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.divider }}>
      <ActivityIndicator size="large" color={c.accent} />
    </View>
  );
}
