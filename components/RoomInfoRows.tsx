import { avatarColor, initialsOf } from "@/constants/theme";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { formatFileSize } from "@/utils/attachments";
import { dayLabel, formatTime } from "@/utils/chat";
import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, memo, useEffect, useState } from "react";
import {
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

type IconName = ComponentProps<typeof Ionicons>["name"];

// ── Типи даних вкладок ──
export interface MemberItem {
  _id: Id<"users">;
  name: string;
  image?: string;
  role: "creator" | "admin" | "member";
}

export interface MediaItem {
  _id: Id<"messages">;
  createdAt: number;
  senderName: string;
  kind: "image" | "sticker" | "video";
  url: string;
  duration?: number;
}

export interface FileItem {
  _id: Id<"messages">;
  createdAt: number;
  senderName: string;
  url: string;
  name: string;
  size?: number;
  mime?: string;
}

export interface VoiceItem {
  _id: Id<"messages">;
  createdAt: number;
  senderName: string;
  url: string;
  duration: number;
}

export interface LinkItem {
  _id: Id<"messages">;
  createdAt: number;
  senderName: string;
  urls: string[];
  text: string;
}

const MONTHS = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];

export function monthLabel(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function hostOf(url: string): string {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0];
}

export function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// ── Панель вкладок ──
export interface TabDef {
  key: string;
  label: string;
  count?: number;
}

export function RoomTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
}) {
  const c = useChatPalette();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    tabs.findIndex((t) => t.key === active),
  );
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring((width / tabs.length) * index, {
      damping: 20,
      stiffness: 240,
    });
  }, [index, width, tabs.length, x]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: "row", height: 46 }}
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.7}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{
                color: selected ? c.accent : c.muted,
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              {tab.label}
              {tab.count ? (
                <Text style={{ fontWeight: "500", fontSize: 12 }}>{` ${tab.count}`}</Text>
              ) : null}
            </Text>
          </TouchableOpacity>
        );
      })}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            bottom: 0,
            left: 0,
            height: 3,
            width: width / tabs.length,
            alignItems: "center",
          },
          indicatorStyle,
        ]}
      >
        <View
          style={{
            width: "56%",
            height: 3,
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
            backgroundColor: c.accent,
          }}
        />
      </Animated.View>
    </View>
  );
}

// ── Учасники ──
export const MemberSearchRow = memo(function MemberSearchRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (text: string) => void;
}) {
  const c = useChatPalette();
  return (
    <View
      style={{
        marginHorizontal: 14,
        marginTop: 10,
        marginBottom: 4,
        height: 40,
        borderRadius: 20,
        backgroundColor: c.search,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
      }}
    >
      <Ionicons name="search" size={17} color={c.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Пошук учасників"
        placeholderTextColor={c.muted}
        autoCorrect={false}
        selectionColor={c.accent}
        style={{ flex: 1, color: c.text, fontSize: 15, paddingVertical: 0, marginLeft: 8 }}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChange("")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Очистити пошук"
        >
          <Ionicons name="close-circle" size={18} color={c.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
});

export const ActionRow = memo(function ActionRow({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const c = useChatPalette();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: 54 }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: c.accent,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14,
        }}
      >
        <Ionicons name={icon} size={20} color={c.onAccent} />
      </View>
      <Text style={{ color: c.accent, fontSize: 16, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
});

const ROLE_LABEL = {
  creator: "Творець",
  admin: "Адміністратор",
  member: "Учасник",
} as const;

export const MemberRow = memo(function MemberRow({
  member,
  isMe,
  online,
  onPress,
  onLongPress,
}: {
  member: MemberItem;
  isMe: boolean;
  online: boolean;
  onPress: (member: MemberItem) => void;
  onLongPress: (member: MemberItem) => void;
}) {
  const c = useChatPalette();
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!member.image && !imageFailed;

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={() => onPress(member)}
      onLongPress={() => onLongPress(member)}
      delayLongPress={350}
      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 }}
    >
      <View style={{ marginRight: 14 }}>
        {showImage ? (
          <Image
            source={{ uri: member.image }}
            onError={() => setImageFailed(true)}
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: c.search }}
          />
        ) : (
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: avatarColor(member.name),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>
              {initialsOf(member.name)}
            </Text>
          </View>
        )}
        {online && (
          <View
            style={{
              position: "absolute",
              right: -1,
              bottom: -1,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: "#35C759",
              borderWidth: 2.5,
              borderColor: c.header,
            }}
          />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
          {member.name}
          {isMe ? <Text style={{ color: c.muted, fontWeight: "400" }}>  (ви)</Text> : null}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: online ? c.accent : c.muted, fontSize: 13, marginTop: 1 }}
        >
          {online ? "зараз у чаті" : ROLE_LABEL[member.role]}
        </Text>
      </View>

      {member.role !== "member" && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 11,
            backgroundColor: withAlpha(c.accent, member.role === "creator" ? 0.2 : 0.12),
          }}
        >
          <Ionicons
            name={member.role === "creator" ? "ribbon" : "shield-checkmark"}
            size={12}
            color={c.accent}
          />
          <Text style={{ color: c.accent, fontSize: 12, fontWeight: "700", marginLeft: 4 }}>
            {member.role === "creator" ? "Творець" : "Адмін"}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// ── Медіа ──
export const MonthHeader = memo(function MonthHeader({ label }: { label: string }) {
  const c = useChatPalette();
  return (
    <Text
      style={{
        color: c.accent,
        fontSize: 14,
        fontWeight: "700",
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 8,
      }}
    >
      {label}
    </Text>
  );
});

export const MEDIA_COLUMNS = 3;
export const MEDIA_GAP = 2;

export const MediaGridRow = memo(function MediaGridRow({
  items,
  cell,
  onPress,
  onLongPress,
}: {
  items: MediaItem[];
  cell: number;
  onPress: (item: MediaItem) => void;
  onLongPress: (item: MediaItem) => void;
}) {
  const c = useChatPalette();
  return (
    <View style={{ flexDirection: "row", marginBottom: MEDIA_GAP }}>
      {items.map((item, i) => (
        <TouchableOpacity
          key={item._id}
          activeOpacity={0.8}
          onPress={() => onPress(item)}
          onLongPress={() => onLongPress(item)}
          delayLongPress={350}
          accessibilityRole="imagebutton"
          accessibilityLabel={
            item.kind === "video"
              ? "Відеоповідомлення"
              : item.kind === "sticker"
                ? "Наліпка"
                : "Фото"
          }
          style={{
            width: cell,
            height: cell,
            marginRight: i < MEDIA_COLUMNS - 1 ? MEDIA_GAP : 0,
            backgroundColor: item.kind === "video" ? "#0B0F14" : c.search,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {item.kind === "video" ? (
            <>
              <Ionicons name="videocam" size={26} color="rgba(255,255,255,0.35)" />
              <View
                style={{
                  position: "absolute",
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: "rgba(0,0,0,0.55)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />
              </View>
              {item.duration ? (
                <View
                  style={{
                    position: "absolute",
                    left: 4,
                    bottom: 4,
                    paddingHorizontal: 5,
                    paddingVertical: 1,
                    borderRadius: 6,
                    backgroundColor: "rgba(0,0,0,0.6)",
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "600" }}>
                    {formatDuration(item.duration)}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <Image
              source={{ uri: item.url }}
              resizeMode={item.kind === "sticker" ? "contain" : "cover"}
              style={{
                width: item.kind === "sticker" ? cell * 0.8 : cell,
                height: item.kind === "sticker" ? cell * 0.8 : cell,
              }}
            />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
});

// ── Голосові ──
export const VoiceRow = memo(function VoiceRow({
  item,
  onPress,
}: {
  item: VoiceItem;
  onPress: (item: VoiceItem) => void;
}) {
  const c = useChatPalette();
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={() => onPress(item)}
      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 9 }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: withAlpha(c.accent, 0.16),
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14,
        }}
      >
        <Ionicons name="mic" size={21} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
          {item.senderName}
        </Text>
        <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, marginTop: 1 }}>
          {dayLabel(item.createdAt)}, {formatTime(item.createdAt)}
        </Text>
      </View>
      <Text style={{ color: c.muted, fontSize: 14, fontVariant: ["tabular-nums"] }}>
        {formatDuration(item.duration)}
      </Text>
    </TouchableOpacity>
  );
});

// ── Посилання ──
export const FileRow = memo(function FileRow({
  item,
  onPress,
  onOpen,
}: {
  item: FileItem;
  /** Довге натискання — перейти до повідомлення. */
  onPress: (item: FileItem) => void;
  onOpen: (url: string) => void;
}) {
  const c = useChatPalette();
  const ext = (item.name.split(".").pop() ?? "").slice(0, 4).toUpperCase();
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={() => onOpen(item.url)}
      onLongPress={() => onPress(item)}
      delayLongPress={350}
      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 9 }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 12,
          backgroundColor: withAlpha(c.accent, 0.16),
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14,
        }}
      >
        <Ionicons name="document-text" size={21} color={c.accent} />
        {ext ? (
          <Text style={{ color: c.accent, fontSize: 8, fontWeight: "800", marginTop: -1 }}>{ext}</Text>
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
          {item.name}
        </Text>
        <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, marginTop: 1 }}>
          {[formatFileSize(item.size), `${dayLabel(item.createdAt)}, ${formatTime(item.createdAt)}`]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export const LinkRow = memo(function LinkRow({
  item,
  onPress,
  onOpen,
}: {
  item: LinkItem;
  onPress: (item: LinkItem) => void;
  onOpen: (url: string) => void;
}) {
  const c = useChatPalette();
  const first = item.urls[0];
  const onlyUrl = item.text.trim() === first;
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={() => onPress(item)}
      style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10 }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: withAlpha(c.accent, 0.16),
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14,
          marginTop: 2,
        }}
      >
        <Ionicons name="link" size={21} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
          {hostOf(first)}
        </Text>
        {item.urls.map((url) => (
          <TouchableOpacity key={url} onPress={() => onOpen(url)} activeOpacity={0.6}>
            <Text numberOfLines={1} style={{ color: c.accent, fontSize: 14, marginTop: 2 }}>
              {url}
            </Text>
          </TouchableOpacity>
        ))}
        {!onlyUrl && (
          <Text numberOfLines={2} style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>
            {item.text}
          </Text>
        )}
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>
          {item.senderName} · {dayLabel(item.createdAt)}, {formatTime(item.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ── Порожній стан ──
export const EmptyTab = memo(function EmptyTab({
  icon,
  text,
}: {
  icon: IconName;
  text: string;
}) {
  const c = useChatPalette();
  return (
    <View style={{ alignItems: "center", paddingVertical: 44, paddingHorizontal: 32 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: c.search,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={30} color={c.muted} />
      </View>
      <Text style={{ color: c.muted, fontSize: 15, marginTop: 14, textAlign: "center", lineHeight: 21 }}>
        {text}
      </Text>
    </View>
  );
});
