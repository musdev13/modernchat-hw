import { RoomAvatar } from "@/components/RoomAvatar";
import { api } from "@/convex/_generated/api";
import { useChatPalette } from "@/hooks/useChatPalette";
import { subscribersLabel } from "@/utils/channel";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Перегляд каналу за посиланням `modesto://c/<slug> (and legacy modernchat://c/<slug>)`: «Підписатись» або відкрити чат. */
export default function ChannelPreviewScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const c = useChatPalette();
  const insets = useSafeAreaInsets();
  const channel = useQuery(api.channels.getChannelBySlug, { slug: String(slug ?? "") });
  const joinChannel = useMutation(api.channels.joinChannel);
  const [busy, setBusy] = useState(false);

  // Уже підписані — одразу відкриваємо чат.
  useEffect(() => {
    if (channel?.isMember) router.replace(`/chat/${channel.roomId}` as any);
  }, [channel?.isMember, channel?.roomId, router]);

  const handleJoin = async () => {
    if (!channel) return;
    setBusy(true);
    try {
      const roomId = await joinChannel({ slug: channel.slug });
      router.replace(`/chat/${roomId}` as any);
    } catch (error: any) {
      Alert.alert("Помилка", error?.message ?? "Не вдалося підписатись на канал");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)" as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 8 }}>
        <TouchableOpacity
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Закрити"
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="close" size={26} color={c.text} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
        {channel === undefined ? (
          <ActivityIndicator size="large" color={c.accent} />
        ) : channel === null ? (
          <>
            <Ionicons name="megaphone-outline" size={56} color={c.muted} />
            <Text style={{ color: c.text, fontSize: 20, fontWeight: "700", marginTop: 16, textAlign: "center" }}>
              Канал не знайдено
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, marginTop: 8, textAlign: "center" }}>
              Посилання застаріло, або канал було видалено.
            </Text>
          </>
        ) : (
          <>
            <RoomAvatar title={channel.title} imageUrl={channel.avatarUrl} size={110} />
            <Text style={{ color: c.text, fontSize: 24, fontWeight: "800", marginTop: 18, textAlign: "center" }}>
              {channel.title}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, marginTop: 4 }}>
              {channel.isPublic ? "публічний канал" : "приватний канал"} · {subscribersLabel(channel.subscriberCount)}
            </Text>
            {channel.description ? (
              <Text style={{ color: c.text, fontSize: 15, lineHeight: 21, marginTop: 16, textAlign: "center" }}>
                {channel.description}
              </Text>
            ) : null}
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={busy}
              onPress={() => void handleJoin()}
              style={{
                alignSelf: "stretch",
                height: 50,
                borderRadius: 25,
                marginTop: 28,
                backgroundColor: c.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {busy ? (
                <ActivityIndicator color={c.onAccent} />
              ) : (
                <Text style={{ color: c.onAccent, fontSize: 16, fontWeight: "700" }}>Підписатись</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}
