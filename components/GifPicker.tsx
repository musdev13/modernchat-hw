import { useChatPalette } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const GIPHY_API = "https://api.giphy.com/v1/gifs";
const PAGE_SIZE = 24;
const COLUMNS = 3;

export interface GifItem {
  id: string;
  /** Невелике превʼю для сітки. */
  previewUrl: string;
  /** Файл, який завантажується й надсилається в чат. */
  url: string;
  width: number;
  height: number;
}

interface GifPickerProps {
  onSelect: (gif: GifItem) => void;
}

interface GiphyImage {
  url?: string;
  width?: string;
  height?: string;
}

interface GiphyResult {
  id: string;
  images?: Record<string, GiphyImage | undefined>;
}

function mapResult(r: GiphyResult): GifItem | null {
  const img = r.images;
  if (!img) return null;
  const preview =
    img.fixed_width_small?.url ?? img.fixed_width?.url ?? img.original?.url;
  const full =
    img.downsized_medium?.url ??
    img.downsized?.url ??
    img.fixed_width?.url ??
    img.original?.url;
  if (!preview || !full) return null;
  const size = img.fixed_width ?? img.original;
  return {
    id: r.id,
    previewUrl: preview,
    url: full,
    width: Number(size?.width) || 200,
    height: Number(size?.height) || 200,
  };
}

/** Вкладка GIF: тренди та пошук через Giphy API. */
export function GifPicker({ onSelect }: GifPickerProps) {
  const c = useChatPalette();
  // Має бути буквальне звернення, щоб Expo підставив значення на етапі збірки.
  const apiKey = process.env.EXPO_PUBLIC_GIPHY_API_KEY;

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!apiKey) return;
    const myId = ++requestId.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const endpoint = debounced ? "search" : "trending";
    const params =
      `api_key=${encodeURIComponent(apiKey)}&limit=${PAGE_SIZE}&rating=g` +
      (debounced ? `&q=${encodeURIComponent(debounced)}&lang=uk` : "");

    fetch(`${GIPHY_API}/${endpoint}?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Giphy ${res.status}`);
        return (await res.json()) as { data?: GiphyResult[] };
      })
      .then((json) => {
        if (myId !== requestId.current) return;
        const mapped = (json.data ?? [])
          .map(mapResult)
          .filter((g): g is GifItem => g !== null);
        setItems(mapped);
      })
      .catch((e: unknown) => {
        if (myId !== requestId.current) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setError("Не вдалося завантажити GIF. Перевірте інтернет і ключ Giphy.");
        setItems([]);
      })
      .finally(() => {
        if (myId === requestId.current) setLoading(false);
      });

    return () => controller.abort();
  }, [apiKey, debounced]);

  if (!apiKey) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 28,
        }}
      >
        <Ionicons name="images-outline" size={40} color={c.muted} />
        <Text
          style={{
            color: c.text,
            fontSize: 15,
            fontWeight: "600",
            textAlign: "center",
            marginTop: 10,
          }}
        >
          GIF поки недоступні
        </Text>
        <Text
          style={{
            color: c.muted,
            fontSize: 13,
            textAlign: "center",
            marginTop: 6,
            lineHeight: 18,
          }}
        >
          Додайте EXPO_PUBLIC_GIPHY_API_KEY у .env.local
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: c.field,
          borderRadius: 18,
          marginHorizontal: 10,
          marginBottom: 6,
          paddingHorizontal: 10,
          height: 36,
        }}
      >
        <Ionicons name="search" size={16} color={c.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Пошук GIF"
          placeholderTextColor={c.muted}
          style={{ flex: 1, color: c.text, fontSize: 14, marginLeft: 8, padding: 0 }}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={c.muted} />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: c.muted, fontSize: 13, textAlign: "center", paddingHorizontal: 24 }}>
            {error}
          </Text>
        </View>
      ) : loading && items.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: c.muted, fontSize: 13 }}>Нічого не знайдено</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(g) => g.id}
          numColumns={COLUMNS}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onSelect(item)}
              style={{ flex: 1 / COLUMNS, padding: 2 }}
              accessibilityRole="button"
              accessibilityLabel="Надіслати GIF"
            >
              <Image
                source={{ uri: item.previewUrl }}
                style={{
                  width: "100%",
                  height: 96,
                  borderRadius: 8,
                  backgroundColor: c.field,
                }}
                contentFit="cover"
              />
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <Text
              style={{
                color: c.muted,
                fontSize: 10,
                textAlign: "center",
                paddingVertical: 6,
              }}
            >
              Powered by GIPHY
            </Text>
          }
        />
      )}
    </View>
  );
}
