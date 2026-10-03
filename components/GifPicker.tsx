import { useChatPalette } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const GIPHY_BASE = "https://api.giphy.com/v1";
const PAGE_SIZE = 36;

export type GiphyKind = "gif" | "sticker";

export interface GifItem {
  id: string;
  kind: GiphyKind;
  /** Невелике превʼю для сітки. */
  previewUrl: string;
  /** Файл, який завантажується й надсилається в чат. */
  url: string;
  width: number;
  height: number;
}

interface GifPickerProps {
  /** GIF або наліпки (stickers). */
  kind: GiphyKind;
  /** Пошуковий запит; порожній — тренди. */
  query: string;
  /** Додатковий нижній відступ, щоб контент не ховався під перемикачем вкладок. */
  bottomPadding?: number;
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

function mapResult(r: GiphyResult, kind: GiphyKind): GifItem | null {
  const img = r.images;
  if (!img) return null;
  const preview =
    img.fixed_width_small?.url ??
    img.fixed_height_small?.url ??
    img.fixed_width?.url ??
    img.original?.url;
  const full =
    kind === "sticker"
      ? (img.fixed_height?.url ??
        img.downsized?.url ??
        img.fixed_width?.url ??
        img.original?.url)
      : (img.downsized_medium?.url ??
        img.downsized?.url ??
        img.fixed_width?.url ??
        img.original?.url);
  if (!preview || !full) return null;
  const size = img.fixed_width ?? img.original;
  return {
    id: r.id,
    kind,
    previewUrl: preview,
    url: full,
    width: Number(size?.width) || 200,
    height: Number(size?.height) || 200,
  };
}

// Невеликий кеш, щоб перемикання вкладок не перезавантажувало те саме.
const cache = new Map<string, GifItem[]>();

/** Сітка GIF або наліпок з Giphy: тренди та пошук. */
export function GifPicker({
  kind,
  query,
  bottomPadding = 0,
  onSelect,
}: GifPickerProps) {
  const c = useChatPalette();
  // Має бути буквальне звернення, щоб Expo підставив значення на етапі збірки.
  const apiKey = process.env.EXPO_PUBLIC_GIPHY_API_KEY;

  const [debounced, setDebounced] = useState(query.trim());
  const [items, setItems] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const columns = kind === "sticker" ? 4 : 3;
  const rowHeight = kind === "sticker" ? 84 : 100;
  const label = kind === "sticker" ? "наліпки" : "GIF";

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!apiKey) return;
    const cacheKey = `${kind}:${debounced.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    const myId = ++requestId.current;
    if (cached) {
      setItems(cached);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const path = kind === "sticker" ? "stickers" : "gifs";
    const endpoint = debounced ? "search" : "trending";
    const params =
      `api_key=${encodeURIComponent(apiKey)}&limit=${PAGE_SIZE}&rating=g` +
      (debounced ? `&q=${encodeURIComponent(debounced)}&lang=uk` : "");

    fetch(`${GIPHY_BASE}/${path}/${endpoint}?${params}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Giphy ${res.status}`);
        return (await res.json()) as { data?: GiphyResult[] };
      })
      .then((json) => {
        if (myId !== requestId.current) return;
        const mapped = (json.data ?? [])
          .map((r) => mapResult(r, kind))
          .filter((g): g is GifItem => g !== null);
        cache.set(cacheKey, mapped);
        setItems(mapped);
      })
      .catch((e: unknown) => {
        if (myId !== requestId.current) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setError(`Не вдалося завантажити ${label}. Перевірте інтернет і ключ Giphy.`);
        setItems([]);
      })
      .finally(() => {
        if (myId === requestId.current) setLoading(false);
      });

    return () => controller.abort();
  }, [apiKey, debounced, kind, label]);

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
          GIF та наліпки поки недоступні
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

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text
          style={{
            color: c.muted,
            fontSize: 13,
            textAlign: "center",
            paddingHorizontal: 24,
          }}
        >
          {error}
        </Text>
      </View>
    );
  }

  if (loading && items.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: c.muted, fontSize: 13 }}>Нічого не знайдено</Text>
      </View>
    );
  }

  return (
    <FlatList
      key={kind}
      data={items}
      keyExtractor={(g) => g.id}
      numColumns={columns}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: bottomPadding }}
      renderItem={({ item }) => (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onSelect(item)}
          style={{ flex: 1 / columns, padding: 2 }}
          accessibilityRole="button"
          accessibilityLabel={kind === "sticker" ? "Надіслати наліпку" : "Надіслати GIF"}
        >
          <Image
            source={{ uri: item.previewUrl }}
            style={{
              width: "100%",
              height: rowHeight,
              borderRadius: 8,
              backgroundColor: kind === "sticker" ? "transparent" : c.field,
            }}
            contentFit={kind === "sticker" ? "contain" : "cover"}
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
  );
}
