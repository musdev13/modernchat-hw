import { RoomAvatar } from "@/components/RoomAvatar";
import { api } from "@/convex/_generated/api";
import { useChatPalette } from "@/hooks/useChatPalette";
import { subscribersLabel } from "@/utils/channel";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";

interface Props {
  query: string;
}

/** Секція «Глобальний пошук»: публічні канали за назвою або @посиланням + «Приєднатись». */
export function PublicChannelResults({ query }: Props) {
  const c = useChatPalette();
  const router = useRouter();
  const joinChannel = useMutation(api.channels.joinChannel);
  const [debounced, setDebounced] = useState("");
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().replace(/^@/, "")), 300);
    return () => clearTimeout(t);
  }, [query]);

  const results = useQuery(
    api.channels.searchPublicChannels,
    debounced.length >= 2 ? { query: debounced } : "skip",
  );

  if (debounced.length < 2 || !results || results.length === 0) return null;

  const handleJoin = async (slug: string) => {
    setJoining(slug);
    try {
      const roomId = await joinChannel({ slug });
      router.push(`/chat/${roomId}` as any);
    } catch (error: any) {
      Alert.alert("Помилка", error?.message ?? "Не вдалося приєднатись до каналу");
    } finally {
      setJoining(null);
    }
  };

  return (
    <View style={{ marginTop: 6 }}>
      <Text
        style={{
          color: c.muted,
          fontSize: 13,
          fontWeight: "700",
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
      >
        Глобальний пошук
      </Text>
      {results.map((channel) => (
        <TouchableOpacity
          key={channel.roomId}
          activeOpacity={0.7}
          onPress={() =>
            channel.isMember
              ? router.push(`/chat/${channel.roomId}` as any)
              : router.push(`/c/${channel.slug}` as any)
          }
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
        >
          <View style={{ marginRight: 12 }}>
            <RoomAvatar title={channel.title} imageUrl={channel.avatarUrl} size={50} />
            <View
              style={{
                position: "absolute",
                right: -3,
                bottom: -3,
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: "#34C759",
                borderWidth: 2,
                borderColor: c.bg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="megaphone" size={10} color="#FFFFFF" />
            </View>
          </View>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
              {channel.title}
            </Text>
            <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>
              @{channel.slug} · {subscribersLabel(channel.subscriberCount)}
            </Text>
          </View>
          {channel.isMember ? (
            <Text style={{ color: c.muted, fontSize: 14 }}>Відкрити</Text>
          ) : (
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={joining === channel.slug}
              onPress={() => void handleJoin(channel.slug)}
              style={{
                paddingHorizontal: 14,
                height: 32,
                borderRadius: 16,
                backgroundColor: c.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {joining === channel.slug ? (
                <ActivityIndicator size="small" color={c.onAccent} />
              ) : (
                <Text style={{ color: c.onAccent, fontSize: 13, fontWeight: "700" }}>
                  Приєднатись
                </Text>
              )}
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}
