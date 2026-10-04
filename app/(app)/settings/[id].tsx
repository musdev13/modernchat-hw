import { ActionSheet, SheetAction } from "@/components/ActionSheet";
import { PopoverMenu } from "@/components/PopoverMenu";
import { AddMembersModal } from "@/components/AddMembersModal";
import { EditRoomModal } from "@/components/EditRoomModal";
import { GlassProvider, GlassSurface, GlassTarget } from "@/components/Glass";
import { ForwardSheet } from "@/components/ForwardSheet";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { MediaViewer, type ViewerItem } from "@/components/MediaViewer";
import { MuteSheet } from "@/components/MuteSheet";
import { RoomAvatar } from "@/components/RoomAvatar";
import {
  ActionRow,
  EmptyTab,
  FileItem,
  FileRow,
  LinkItem,
  LinkRow,
  MEDIA_COLUMNS,
  MEDIA_GAP,
  MediaGridRow,
  MediaItem,
  MemberItem,
  MemberRow,
  MemberSearchRow,
  MonthHeader,
  PollItem,
  PollRow,
  RoomTabBar,
  VoiceItem,
  VoiceRow,
  monthLabel,
  normalizeUrl,
} from "@/components/RoomInfoRows";
import { avatarColor } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { channelLink, subscribersLabel } from "@/utils/channel";
import { dayLabel, membersLabel } from "@/utils/chat";
import { copyText } from "@/utils/clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Share,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = ComponentProps<typeof Ionicons>["name"];
type TabKey = "members" | "media" | "files" | "voice" | "links" | "polls";

type ListRow =
  | { key: string; type: "top" }
  | { key: string; type: "tabs" }
  | { key: string; type: "search" }
  | { key: string; type: "add" }
  | { key: string; type: "member"; member: MemberItem }
  | { key: string; type: "month"; label: string }
  | { key: string; type: "grid"; items: MediaItem[] }
  | { key: string; type: "file"; item: FileItem }
  | { key: string; type: "voice"; item: VoiceItem }
  | { key: string; type: "link"; item: LinkItem }
  | { key: string; type: "poll"; item: PollItem }
  | { key: string; type: "empty"; icon: IconName; text: string };

const BAR_TOP_GAP = 6;
const BAR_BUTTON = 44;
const BAR_SIDE_MARGIN = 12;

export default function RoomInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roomId = id as Id<"chatRooms">;
  const router = useRouter();
  const c = useChatPalette();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const room = useQuery(api.rooms.getRoom, { roomId });
  const currentUser = useQuery(api.users.currentUser);
  const shared = useQuery(api.roomMedia.getRoomSharedContent, { chatRoomId: roomId });
  const onlineIds = useQuery(api.roomMedia.getRoomOnlineUserIds, { chatRoomId: roomId });
  const pins = useQuery(api.messages.getPinnedMessages, { chatRoomId: roomId });
  const settings = useQuery(api.roomSettings.getMyRoomSettings, { chatRoomId: roomId });

  // Особистий чат не має групових налаштувань — показуємо профіль співрозмовника.
  const directUserId = room?.isDirect ? room.otherUserId : undefined;
  useEffect(() => {
    if (directUserId) router.replace(`/user/${directUserId}` as any);
  }, [directUserId, router]);

  const deleteRoom = useMutation(api.rooms.deleteRoom);
  const updateParticipantRole = useMutation(api.rooms.updateParticipantRole);
  const removeParticipant = useMutation(api.rooms.removeParticipant);
  const setMuted = useMutation(api.roomSettings.setMuted);
  const openDiscussionMutation = useMutation(api.channels.openDiscussion);
  const createDiscussionGroup = useMutation(api.channels.createDiscussionGroup);
  const linkDiscussionGroup = useMutation(api.channels.linkDiscussionGroup);
  const unlinkDiscussionGroup = useMutation(api.channels.unlinkDiscussionGroup);

  const [rawTab, setTab] = useState<TabKey>("members");
  const [discussionMenu, setDiscussionMenu] = useState(false);
  const [pickGroup, setPickGroup] = useState(false);
  const [copied, setCopied] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [addVisible, setAddVisible] = useState(false);
  const [muteVisible, setMuteVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [memberSheet, setMemberSheet] = useState<MemberItem | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<{ items: ViewerItem[]; index: number } | null>(null);

  const listRef = useRef<FlatList<ListRow>>(null);

  // ── Прокрутка: паралакс шапки, поява заголовка й «прилипання» вкладок ──
  const topBarBottom = insets.top + BAR_TOP_GAP + BAR_BUTTON;
  const scrollY = useSharedValue(0);
  const pinThreshold = useSharedValue(99999);
  const pinnedOn = useSharedValue(false);
  const [showPinnedTabs, setShowPinnedTabs] = useState(false);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
    const on = event.contentOffset.y >= pinThreshold.value;
    if (on !== pinnedOn.value) {
      pinnedOn.value = on;
      runOnJS(setShowPinnedTabs)(on);
    }
  });

  const avatarAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 120, 200], [1, 0.7, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(scrollY.value, [-160, 0, 200], [1.3, 1, 0.6], Extrapolation.CLAMP),
      },
      {
        translateY: interpolate(scrollY.value, [0, 200], [0, 50], Extrapolation.CLAMP),
      },
    ],
  }));
  const nameAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [60, 160], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(scrollY.value, [0, 160], [0, 24], Extrapolation.CLAMP),
      },
    ],
  }));
  const barTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [140, 200], [0, 1], Extrapolation.CLAMP),
  }));

  // ── Права та стан ──
  const myId = currentUser?._id;
  const isCreator = !!room && !!myId && room.creatorId === myId;
  const isChannel = room?.isChannel === true;
  // У каналі немає вкладки «Учасники» — список підписників відкривається окремим екраном.
  const tab: TabKey = isChannel && rawTab === "members" ? "media" : rawTab;
  const noun = isChannel ? "канал" : "кімнату";
  const canManage = room?.canManageMembers ?? false;
  const muted = settings?.muted ?? false;
  const pinCount = pins?.length ?? 0;
  const onlineSet = useMemo(() => new Set<string>(onlineIds ?? []), [onlineIds]);
  const onlineOthers = useMemo(
    () => (onlineIds ?? []).filter((uid) => uid !== myId).length,
    [onlineIds, myId],
  );

  // ── Навігація назад у чат (з переходом до повідомлення або пошуком) ──
  const goToChat = useCallback(
    (params: { jumpTo?: string; search?: boolean }) => {
      const nonce = String(Date.now());
      router.dismissTo({
        pathname: "/chat/[id]",
        params: {
          id: roomId,
          ...(params.jumpTo ? { jumpTo: params.jumpTo, jumpNonce: nonce } : {}),
          ...(params.search ? { openSearch: nonce } : {}),
        },
      } as any);
    },
    [roomId, router],
  );

  const jumpToMessage = useCallback(
    (messageId: string) => goToChat({ jumpTo: messageId }),
    [goToChat],
  );

  // ── Дії ──
  // Увімкнути — одразу; вимкнути — спершу вибір тривалості (1 год / 8 год / 2 дні / назавжди).
  const applyMute = useCallback(
    async (nextMuted: boolean, durationMs?: number) => {
      try {
        void Haptics.selectionAsync();
        await setMuted({ chatRoomId: roomId, muted: nextMuted, durationMs });
      } catch (error: any) {
        Alert.alert("Помилка", error?.message ?? "Не вдалося змінити сповіщення");
      }
    },
    [roomId, setMuted],
  );
  const handleToggleMute = useCallback(() => {
    if (muted) void applyMute(false);
    else setMuteVisible(true);
  }, [applyMute, muted]);

  const handleLeave = useCallback(() => {
    if (!room || !currentUser) return;
    if (isCreator) {
      Alert.alert(
        "Творець не може вийти",
        `Ви створили ${isChannel ? "цей канал" : "цю кімнату"}, тому не можете ${isChannel ? "його" : "її"} залишити. Якщо ${isChannel ? "він" : "вона"} більше не потрібн${isChannel ? "ий" : "а"}, видаліть ${isChannel ? "його" : "її"}.`,
      );
      return;
    }
    Alert.alert(
      isChannel ? "Відписатись від каналу?" : "Вийти з кімнати?",
      `Ви втратите доступ до «${room.title}».`,
      [
      { text: "Скасувати", style: "cancel" },
      {
        text: isChannel ? "Відписатись" : "Вийти",
        style: "destructive",
        onPress: async () => {
          try {
            await removeParticipant({ roomId, targetUserId: currentUser._id });
            router.dismissAll();
            router.replace("/(app)");
          } catch (error: any) {
            Alert.alert("Помилка", error?.message ?? "Не вдалося вийти з кімнати");
          }
        },
      },
    ]);
  }, [currentUser, isChannel, isCreator, removeParticipant, room, roomId, router]);

  const handleDelete = useCallback(() => {
    if (!room) return;
    Alert.alert(
      isChannel ? "Видалити канал?" : "Видалити кімнату?",
      `${isChannel ? "Канал" : "Кімната"} «${room.title}» та всі ${isChannel ? "його публікації" : "її повідомлення"} будуть видалені назавжди.`,
      [
        { text: "Скасувати", style: "cancel" },
        {
          text: "Видалити",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRoom({ roomId });
              router.dismissAll();
              router.replace("/(app)");
            } catch (error) {
              console.error("Error deleting room:", error);
              Alert.alert("Помилка", "Не вдалося видалити кімнату.");
            }
          },
        },
      ],
    );
  }, [deleteRoom, isChannel, room, roomId, router]);

  const handleRole = useCallback(
    async (targetUserId: Id<"users">, role: "admin" | "member") => {
      try {
        await updateParticipantRole({ roomId, targetUserId, role });
      } catch (error: any) {
        Alert.alert("Помилка", error?.message ?? "Не вдалося змінити роль");
      }
    },
    [roomId, updateParticipantRole],
  );

  const handleKick = useCallback(
    (member: MemberItem) => {
      Alert.alert("Вилучити учасника?", `Вилучити ${member.name} з кімнати?`, [
        { text: "Скасувати", style: "cancel" },
        {
          text: "Вилучити",
          style: "destructive",
          onPress: async () => {
            try {
              await removeParticipant({ roomId, targetUserId: member._id });
            } catch (error: any) {
              Alert.alert("Помилка", error?.message ?? "Не вдалося вилучити учасника");
            }
          },
        },
      ]);
    },
    [removeParticipant, roomId],
  );

  const inviteLink = room?.slug ? channelLink(room.slug) : "";

  const handleCopyLink = useCallback(async () => {
    if (!inviteLink) return;
    const result = await copyText(inviteLink);
    if (result === "copied") {
      void Haptics.selectionAsync();
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }, [inviteLink]);

  const handleShare = useCallback(async () => {
    if (!inviteLink || !room) return;
    try {
      await Share.share({ message: `${room.title}\n${inviteLink}` });
    } catch {
      // користувач закрив меню
    }
  }, [inviteLink, room]);

  const openLinkedChat = useCallback(
    async (open: () => Promise<Id<"chatRooms">>) => {
      try {
        const groupId = await open();
        router.push(`/chat/${groupId}` as any);
      } catch (error: any) {
        Alert.alert("Помилка", error?.message ?? "Не вдалося відкрити обговорення");
      }
    },
    [router],
  );

  const handleDiscussion = useCallback(() => {
    if (!room) return;
    if (room.discussion) {
      void openLinkedChat(() => openDiscussionMutation({ channelId: roomId }));
    } else if (isCreator) {
      setDiscussionMenu(true);
    } else {
      Alert.alert("Обговорення", "Для цього каналу обговорення ще не налаштоване.");
    }
  }, [isCreator, openDiscussionMutation, openLinkedChat, room, roomId]);

  const openLink = useCallback(async (url: string) => {
    try {
      await Linking.openURL(normalizeUrl(url));
    } catch {
      Alert.alert("Помилка", "Не вдалося відкрити посилання");
    }
  }, []);

  // ── Права над конкретним учасником ──
  const canKickMember = useCallback(
    (member: MemberItem) =>
      member.role !== "creator" &&
      member._id !== myId &&
      (isCreator || (room?.currentUserRole === "admin" && member.role === "member")),
    [isCreator, myId, room?.currentUserRole],
  );

  const handleMemberPress = useCallback(
    (member: MemberItem) => {
      if (member._id === myId) {
        router.navigate("/(app)/(tabs)/profile" as any);
        return;
      }
      if (canManage) {
        setMemberSheet(member);
        return;
      }
      router.push(`/user/${member._id}` as any);
    },
    [canManage, myId, router],
  );

  const handleMemberLongPress = useCallback(
    (member: MemberItem) => {
      if (member._id === myId) return;
      void Haptics.selectionAsync();
      setMemberSheet(member);
    },
    [myId],
  );

  // ── Рядки списку ──
  const cell = Math.floor((windowWidth - MEDIA_GAP * (MEDIA_COLUMNS - 1)) / MEDIA_COLUMNS);

  // Довге натискання по плитці медіа відкриває галерею (фото й відео за часом, без наліпок).
  const openGallery = useCallback(
    (messageId: string) => {
      const list: ViewerItem[] = [...(shared?.media ?? [])]
        .filter((m) => m.kind !== "sticker")
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((m) => ({
          id: m._id,
          kind: m.kind === "video" ? ("video" as const) : ("image" as const),
          url: m.url,
          senderName: m.senderName,
          createdAt: m.createdAt,
        }));
      const index = list.findIndex((it) => it.id === messageId);
      if (index >= 0) setGallery({ items: list, index });
    },
    [shared?.media],
  );

  const rows = useMemo<ListRow[]>(() => {
    const result: ListRow[] = [
      { key: "top", type: "top" },
      { key: "tabs", type: "tabs" },
    ];
    if (!room) return result;

    if (tab === "members") {
      result.push({ key: "search", type: "search" });
      if (canManage && !memberQuery.trim()) result.push({ key: "add", type: "add" });
      const rank = { creator: 0, admin: 1, member: 2 } as const;
      const needle = memberQuery.trim().toLowerCase();
      const members = room.participants
        .filter((p) => !needle || p.name.toLowerCase().includes(needle))
        .sort(
          (a, b) =>
            rank[a.role] - rank[b.role] || a.name.localeCompare(b.name, "uk"),
        );
      for (const member of members) {
        result.push({ key: `m-${member._id}`, type: "member", member });
      }
      if (members.length === 0) {
        result.push({
          key: "empty",
          type: "empty",
          icon: "search-outline",
          text: "Нікого не знайдено",
        });
      }
    } else if (tab === "media") {
      const items = shared?.media ?? [];
      if (shared === undefined) {
        result.push({ key: "empty", type: "empty", icon: "images-outline", text: "Завантаження…" });
      } else if (items.length === 0) {
        result.push({
          key: "empty",
          type: "empty",
          icon: "images-outline",
          text: "Фото, відео, GIF та наліпки з цієї кімнати зʼявляться тут",
        });
      } else {
        let currentMonth = "";
        let bucket: MediaItem[] = [];
        const flush = () => {
          for (let i = 0; i < bucket.length; i += MEDIA_COLUMNS) {
            const chunk = bucket.slice(i, i + MEDIA_COLUMNS);
            result.push({ key: `g-${chunk[0]._id}`, type: "grid", items: chunk });
          }
          bucket = [];
        };
        for (const item of items) {
          const label = monthLabel(item.createdAt);
          if (label !== currentMonth) {
            flush();
            currentMonth = label;
            result.push({ key: `mo-${label}`, type: "month", label });
          }
          bucket.push(item);
        }
        flush();
      }
    } else if (tab === "files") {
      const items = shared?.files ?? [];
      if (shared === undefined) {
        result.push({ key: "empty", type: "empty", icon: "document-outline", text: "Завантаження…" });
      } else if (items.length === 0) {
        result.push({
          key: "empty",
          type: "empty",
          icon: "document-outline",
          text: "Файли, надіслані в цю кімнату, зʼявляться тут",
        });
      } else {
        for (const item of items) result.push({ key: `f-${item._id}`, type: "file", item });
      }
    } else if (tab === "voice") {
      const items = shared?.voice ?? [];
      if (shared === undefined) {
        result.push({ key: "empty", type: "empty", icon: "mic-outline", text: "Завантаження…" });
      } else if (items.length === 0) {
        result.push({
          key: "empty",
          type: "empty",
          icon: "mic-outline",
          text: "Голосових повідомлень у цій кімнаті ще немає",
        });
      } else {
        for (const item of items) result.push({ key: `v-${item._id}`, type: "voice", item });
      }
    } else if (tab === "polls") {
      const items = shared?.polls ?? [];
      if (shared === undefined) {
        result.push({ key: "empty", type: "empty", icon: "stats-chart-outline", text: "Завантаження…" });
      } else if (items.length === 0) {
        result.push({
          key: "empty",
          type: "empty",
          icon: "stats-chart-outline",
          text: "Опитування з цього каналу зʼявляться тут",
        });
      } else {
        for (const item of items) result.push({ key: `p-${item._id}`, type: "poll", item });
      }
    } else {
      const items = shared?.links ?? [];
      if (shared === undefined) {
        result.push({ key: "empty", type: "empty", icon: "link-outline", text: "Завантаження…" });
      } else if (items.length === 0) {
        result.push({
          key: "empty",
          type: "empty",
          icon: "link-outline",
          text: "Посилання з повідомлень цієї кімнати зʼявляться тут",
        });
      } else {
        for (const item of items) result.push({ key: `l-${item._id}`, type: "link", item });
      }
    }
    return result;
  }, [canManage, memberQuery, room, shared, tab]);

  const tabs = useMemo(
    () =>
      isChannel
        ? [
            { key: "media", label: "Медіа", count: shared?.media.length },
            { key: "files", label: "Файли", count: shared?.files.length },
            { key: "links", label: "Посилання", count: shared?.links.length },
            { key: "voice", label: "Голосові", count: shared?.voice.length },
            { key: "polls", label: "Опитування", count: shared?.polls?.length },
          ]
        : [
            { key: "members", label: "Учасники", count: room?.participants.length },
            { key: "media", label: "Медіа", count: shared?.media.length },
            { key: "files", label: "Файли", count: shared?.files.length },
            { key: "voice", label: "Голосові", count: shared?.voice.length },
            { key: "links", label: "Посилання", count: shared?.links.length },
          ],
    [isChannel, room?.participants.length, shared],
  );

  const handleTabChange = useCallback(
    (key: string) => {
      setTab(key as TabKey);
      // Якщо вкладки «прилипли», повертаємо список до їхнього початку.
      if (scrollY.value > pinThreshold.value && pinThreshold.value > 0) {
        listRef.current?.scrollToOffset({ offset: pinThreshold.value, animated: false });
      }
    },
    [pinThreshold, scrollY],
  );

  // ── Верхній блок ──
  const actionButton = (
    icon: IconName,
    label: string,
    onPress: () => void,
    opts?: { danger?: boolean },
  ) => (
    <TouchableOpacity
      key={label}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1,
        marginHorizontal: 4,
        paddingVertical: 11,
        borderRadius: 16,
        backgroundColor: c.header,
        alignItems: "center",
      }}
    >
      <Ionicons name={icon} size={24} color={opts?.danger ? c.danger : c.accent} />
      <Text
        numberOfLines={1}
        style={{
          color: opts?.danger ? c.danger : c.accent,
          fontSize: 12,
          fontWeight: "600",
          marginTop: 5,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const channelRow = (icon: IconName, label: string, count?: number, onPress?: () => void) => (
    <TouchableOpacity
      key={label}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        height: 52,
        borderTopWidth: 1,
        borderTopColor: c.divider,
      }}
    >
      <Ionicons name={icon} size={22} color={c.muted} />
      <Text style={{ color: c.text, fontSize: 16, marginLeft: 16, flex: 1 }}>{label}</Text>
      {count !== undefined ? (
        <Text style={{ color: c.muted, fontSize: 15, marginRight: onPress ? 6 : 0 }}>{count}</Text>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={c.muted} /> : null}
    </TouchableOpacity>
  );

  const renderTop = () => {
    if (!room) return null;
    const creator = room.participants.find((p) => p.role === "creator");
    const tint = withAlpha(avatarColor(room.title), c.isDark ? 0.24 : 0.2);
    return (
      <View
        onLayout={(e) => {
          pinThreshold.value = Math.max(0, e.nativeEvent.layout.height - topBarBottom - 8);
        }}
      >
        <View style={{ backgroundColor: tint, paddingBottom: 14 }}>
          <View style={{ alignItems: "center", paddingTop: topBarBottom + 14 }}>
            <Animated.View style={avatarAnimStyle}>
              <TouchableOpacity
                activeOpacity={room.avatarUrl ? 0.85 : 1}
                disabled={!room.avatarUrl}
                onPress={() => room.avatarUrl && setViewerUrl(room.avatarUrl)}
                accessibilityLabel="Фото кімнати"
              >
                <RoomAvatar title={room.title} imageUrl={room.avatarUrl} size={116} />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={[{ alignItems: "center", paddingHorizontal: 24 }, nameAnimStyle]}>
              <Text
                style={{
                  color: c.text,
                  fontSize: 25,
                  fontWeight: "800",
                  textAlign: "center",
                  marginTop: 14,
                }}
              >
                {room.title}
              </Text>
              <Text style={{ color: c.muted, fontSize: 14, marginTop: 4 }}>
                {isChannel
                  ? room.isPublic
                    ? "публічний канал"
                    : "приватний канал"
                  : `${membersLabel(room.participants.length)}${onlineOthers > 0 ? `, ${onlineOthers} у чаті` : ""}`}
              </Text>
            </Animated.View>
          </View>

          <View style={{ flexDirection: "row", paddingHorizontal: 8, marginTop: 18 }}>
            {actionButton(
              muted ? "notifications-off-outline" : "notifications-outline",
              muted ? "Увімкнути" : "Вимкнути",
              handleToggleMute,
            )}
            {isChannel ? (
              <>
                {actionButton("chatbubbles-outline", "Обговорення", handleDiscussion)}
                {room.slug ? actionButton("share-outline", "Поділитися", () => void handleShare()) : null}
              </>
            ) : (
              <>
                {actionButton("search", "Пошук", () => goToChat({ search: true }))}
                {canManage &&
                  actionButton("person-add-outline", "Додати", () => setAddVisible(true))}
              </>
            )}
            {actionButton(
              isCreator ? "trash-outline" : "exit-outline",
              isCreator ? "Видалити" : "Вийти",
              isCreator ? handleDelete : handleLeave,
              { danger: true },
            )}
          </View>
        </View>

        {/* Інформація */}
        <View style={{ backgroundColor: c.header, marginTop: 10 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: c.accent, fontSize: 14, fontWeight: "700" }}>Опис</Text>
              {canManage && (
                <TouchableOpacity
                  onPress={() => setEditVisible(true)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={isChannel ? "Редагувати канал" : "Редагувати кімнату"}
                >
                  <Ionicons name="create-outline" size={20} color={c.accent} />
                </TouchableOpacity>
              )}
            </View>
            {room.description ? (
              <Text style={{ color: c.text, fontSize: 16, lineHeight: 22, marginTop: 6 }}>
                {room.description}
              </Text>
            ) : canManage ? (
              <TouchableOpacity onPress={() => setEditVisible(true)} activeOpacity={0.7}>
                <Text style={{ color: c.muted, fontSize: 16, marginTop: 6 }}>
                  {isChannel ? "Додати опис каналу" : "Додати опис кімнати"}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ color: c.muted, fontSize: 16, marginTop: 6 }}>Опис не додано</Text>
            )}
          </View>

          {isChannel && room.slug && (room.isPublic || canManage) ? (
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => void handleCopyLink()}
              accessibilityRole="button"
              accessibilityLabel="Скопіювати запрошувальне посилання"
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: c.divider,
              }}
            >
              <Text style={{ color: c.accent, fontSize: 14, fontWeight: "700" }}>
                Запрошувальне посилання
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                <Text
                  numberOfLines={1}
                  selectable={false}
                  style={{ flex: 1, color: c.text, fontSize: 16 }}
                >
                  {inviteLink}
                </Text>
                <Ionicons
                  name={copied ? "checkmark-circle" : "copy-outline"}
                  size={20}
                  color={copied ? "#34C759" : c.muted}
                />
              </View>
              <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>
                {copied
                  ? "Посилання скопійовано"
                  : "Торкніться, щоб скопіювати. Усі, хто відкриє його, зможуть підписатись."}
              </Text>
            </TouchableOpacity>
          ) : null}

          {isChannel && room.discussion ? (
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={handleDiscussion}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                height: 56,
                borderTopWidth: 1,
                borderTopColor: c.divider,
              }}
            >
              <Ionicons name="chatbubbles-outline" size={22} color={c.muted} />
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={{ color: c.text, fontSize: 16 }} numberOfLines={1}>
                  {room.discussion.title}
                </Text>
                <Text style={{ color: c.muted, fontSize: 13 }}>Обговорення</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </TouchableOpacity>
          ) : null}

          {pinCount > 0 && (
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => {
                const last = pins?.[pins.length - 1];
                if (last) jumpToMessage(last._id);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                height: 52,
                borderTopWidth: 1,
                borderTopColor: c.divider,
              }}
            >
              <Ionicons name="pin-outline" size={22} color={c.muted} />
              <Text style={{ color: c.text, fontSize: 16, marginLeft: 16, flex: 1 }}>
                Закріплені повідомлення
              </Text>
              <Text style={{ color: c.muted, fontSize: 15, marginRight: 6 }}>{pinCount}</Text>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </TouchableOpacity>
          )}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              minHeight: 52,
              borderTopWidth: 1,
              borderTopColor: c.divider,
            }}
          >
            <Ionicons name="calendar-outline" size={22} color={c.muted} />
            <View style={{ marginLeft: 16, flex: 1, paddingVertical: 8 }}>
              <Text style={{ color: c.text, fontSize: 16 }}>
                Створено {dayLabel(room._creationTime)}
              </Text>
              {creator && (
                <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, marginTop: 1 }}>
                  Творець: {creator.name}
                </Text>
              )}
            </View>
          </View>

          {isChannel ? (
            <>
              {channelRow(
                "people-outline",
                "Підписники",
                room.participants.length,
                canManage ? () => router.push(`/subscribers/${roomId}` as any) : undefined,
              )}
              {channelRow(
                "shield-checkmark-outline",
                "Адміністратори",
                room.participants.filter((p) => p.role !== "member").length,
                () => router.push(`/subscribers/${roomId}?admins=1` as any),
              )}
              {canManage
                ? channelRow("settings-outline", "Налаштування каналу", undefined, () =>
                    router.push(`/channel-settings/${roomId}` as any),
                  )
                : null}
            </>
          ) : null}
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: ListRow }) => {
    switch (item.type) {
      case "top":
        return renderTop();
      case "tabs":
        return (
          <View
            style={{
              backgroundColor: c.header,
              marginTop: 10,
              borderBottomWidth: 1,
              borderBottomColor: c.divider,
            }}
          >
            <RoomTabBar tabs={tabs} active={tab} onChange={handleTabChange} />
          </View>
        );
      case "search":
        return (
          <View style={{ backgroundColor: c.header }}>
            <MemberSearchRow value={memberQuery} onChange={setMemberQuery} />
          </View>
        );
      case "add":
        return (
          <View style={{ backgroundColor: c.header }}>
            <ActionRow
              icon="person-add"
              label="Додати учасників"
              onPress={() => setAddVisible(true)}
            />
          </View>
        );
      case "member":
        return (
          <View style={{ backgroundColor: c.header }}>
            <MemberRow
              member={item.member}
              isMe={item.member._id === myId}
              online={onlineSet.has(item.member._id)}
              onPress={handleMemberPress}
              onLongPress={handleMemberLongPress}
            />
          </View>
        );
      case "month":
        return (
          <View style={{ backgroundColor: c.header }}>
            <MonthHeader label={item.label} />
          </View>
        );
      case "grid":
        return (
          <View style={{ backgroundColor: c.header }}>
            <MediaGridRow
              items={item.items}
              cell={cell}
              onPress={(m) => jumpToMessage(m._id)}
              onLongPress={(m) => openGallery(m._id)}
            />
          </View>
        );
      case "file":
        return (
          <View style={{ backgroundColor: c.header }}>
            <FileRow item={item.item} onPress={(f) => jumpToMessage(f._id)} onOpen={openLink} />
          </View>
        );
      case "voice":
        return (
          <View style={{ backgroundColor: c.header }}>
            <VoiceRow item={item.item} onPress={(v) => jumpToMessage(v._id)} />
          </View>
        );
      case "poll":
        return (
          <View style={{ backgroundColor: c.header }}>
            <PollRow item={item.item} onPress={(p) => jumpToMessage(p._id)} />
          </View>
        );
      case "link":
        return (
          <View style={{ backgroundColor: c.header }}>
            <LinkRow item={item.item} onPress={(l) => jumpToMessage(l._id)} onOpen={openLink} />
          </View>
        );
      case "empty":
        return (
          <View style={{ backgroundColor: c.header }}>
            <EmptyTab icon={item.icon} text={item.text} />
          </View>
        );
    }
  };

  // ── Нижній блок: небезпечна зона ──
  const footer = room ? (
    <View>
      {tab === "media" && shared?.truncated ? (
        <View style={{ backgroundColor: c.header, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ color: c.muted, fontSize: 12, textAlign: "center" }}>
            Показано вміст останніх {shared.scanned} повідомлень
          </Text>
        </View>
      ) : null}
      <View style={{ backgroundColor: c.header, marginTop: 10, paddingHorizontal: 16, paddingVertical: 14 }}>
        <Text style={{ color: c.danger, fontSize: 14, fontWeight: "700", marginBottom: 6 }}>
          Небезпечна зона
        </Text>
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>
          {isChannel
            ? isCreator
              ? "Канал та всі його публікації будуть видалені без можливості відновлення. Творець не може просто залишити канал."
              : "Ви перестанете отримувати публікації цього каналу."
            : isCreator
              ? "Кімната та всі повідомлення в ній будуть видалені без можливості відновлення. Творець не може просто вийти з кімнати."
              : "Ви втратите доступ до цієї кімнати та її історії, доки вас не додадуть знову."}
        </Text>
        <TouchableOpacity
          onPress={isCreator ? handleDelete : handleLeave}
          activeOpacity={0.7}
          style={{
            height: 48,
            marginTop: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.danger,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={isCreator ? "trash-outline" : "exit-outline"} size={20} color={c.danger} />
          <Text style={{ color: c.danger, fontSize: 16, fontWeight: "700", marginLeft: 8 }}>
            {isChannel
              ? isCreator
                ? "Видалити канал"
                : "Відписатись"
              : isCreator
                ? "Видалити кімнату"
                : "Вийти з кімнати"}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: Math.max(insets.bottom, 12) + 12 }} />
    </View>
  ) : null;

  // ── Меню «⋮» ──
  const menuActions: SheetAction[] = [];
  if (room) {
    if (canManage) {
      menuActions.push({
        key: "edit",
        label: isChannel ? "Редагувати канал" : "Редагувати кімнату",
        icon: "create-outline",
        onPress: () => setEditVisible(true),
      });
      menuActions.push({
        key: "add",
        label: isChannel ? "Додати підписників" : "Додати учасників",
        icon: "person-add-outline",
        onPress: () => setAddVisible(true),
      });
    }
    menuActions.push({
      key: "mute",
      label: muted ? "Увімкнути сповіщення" : "Вимкнути сповіщення",
      icon: muted ? "notifications-outline" : "notifications-off-outline",
      onPress: handleToggleMute,
    });
    menuActions.push({
      key: "search",
      label: "Пошук по чату",
      icon: "search-outline",
      onPress: () => goToChat({ search: true }),
    });
    if (isChannel && room.slug) {
      menuActions.push({
        key: "share",
        label: "Поділитися посиланням",
        icon: "share-outline",
        onPress: () => void handleShare(),
      });
    }
    if (isChannel && canManage) {
      menuActions.push({
        key: "channel-settings",
        label: "Налаштування каналу",
        icon: "settings-outline",
        onPress: () => router.push(`/channel-settings/${roomId}` as any),
      });
    }
    menuActions.push(
      isCreator
        ? {
            key: "delete",
            label: isChannel ? "Видалити канал" : "Видалити кімнату",
            icon: "trash-outline",
            destructive: true,
            onPress: handleDelete,
          }
        : {
            key: "leave",
            label: isChannel ? "Відписатись" : "Вийти з кімнати",
            icon: "exit-outline",
            destructive: true,
            onPress: handleLeave,
          },
    );
  }

  // ── Меню учасника ──
  const memberActions: SheetAction[] = [];
  if (memberSheet) {
    memberActions.push({
      key: "profile",
      label: "Переглянути профіль",
      icon: "person-outline",
      onPress: () => router.push(`/user/${memberSheet._id}` as any),
    });
    if (isCreator && memberSheet.role !== "creator") {
      memberActions.push(
        memberSheet.role === "admin"
          ? {
              key: "demote",
              label: "Зняти права адміністратора",
              icon: "shield-outline",
              onPress: () => void handleRole(memberSheet._id, "member"),
            }
          : {
              key: "promote",
              label: "Призначити адміністратором",
              icon: "shield-checkmark-outline",
              onPress: () => void handleRole(memberSheet._id, "admin"),
            },
      );
    }
    if (canKickMember(memberSheet)) {
      memberActions.push({
        key: "kick",
        label: "Вилучити з кімнати",
        icon: "person-remove-outline",
        destructive: true,
        onPress: () => handleKick(memberSheet),
      });
    }
  }

  // ── Стани завантаження / відсутності ──
  const barButton = (icon: IconName, label: string, onPress: () => void) => (
    <GlassSurface
      radius={BAR_BUTTON / 2}
      intensity={75}
      style={{ width: BAR_BUTTON, height: BAR_BUTTON }}
      contentStyle={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{ width: BAR_BUTTON, height: BAR_BUTTON, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name={icon} size={22} color={c.text} />
      </TouchableOpacity>
    </GlassSurface>
  );

  if (room === undefined || currentUser === undefined || room?.isDirect) {
    return (
      <View style={{ flex: 1, backgroundColor: c.divider, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (room === null) {
    return (
      <GlassProvider>
        <View style={{ flex: 1, backgroundColor: c.divider }}>
          <GlassTarget style={{ flex: 1, backgroundColor: c.divider, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: c.search,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={40} color={c.muted} />
            </View>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: "700", marginTop: 20, textAlign: "center" }}>
              Кімнату не знайдено
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, marginTop: 8, textAlign: "center" }}>
              Можливо, її вже було видалено або вас вилучили з неї.
            </Text>
            <TouchableOpacity
              onPress={() => {
                router.dismissAll();
                router.replace("/(app)");
              }}
              activeOpacity={0.8}
              style={{ backgroundColor: c.accent, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12, marginTop: 24 }}
            >
              <Text style={{ color: c.onAccent, fontWeight: "700" }}>До списку чатів</Text>
            </TouchableOpacity>
          </GlassTarget>
        </View>
      </GlassProvider>
    );
  }

  return (
    <GlassProvider>
      <View style={{ flex: 1, backgroundColor: c.divider }}>
        <GlassTarget style={{ flex: 1, backgroundColor: c.divider }}>
          <Animated.FlatList
            ref={listRef as any}
            data={rows}
            keyExtractor={(row) => row.key}
            renderItem={renderItem}
            ListFooterComponent={footer}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            initialNumToRender={12}
            windowSize={9}
            removeClippedSubviews={false}
          />
        </GlassTarget>

        {/* Плаваюча скляна панель: назад, заголовок при прокрутці, меню */}
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30 }}
        >
          <View
            pointerEvents="box-none"
            style={{
              marginTop: insets.top + BAR_TOP_GAP,
              marginHorizontal: BAR_SIDE_MARGIN,
              height: BAR_BUTTON,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            {barButton("arrow-back", "Назад", () => router.back())}

            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  left: BAR_BUTTON + 10,
                  right: BAR_BUTTON + 10,
                  top: 0,
                  height: BAR_BUTTON,
                },
                barTitleStyle,
              ]}
            >
              <GlassSurface
                radius={BAR_BUTTON / 2}
                intensity={75}
                style={{ height: BAR_BUTTON }}
                contentStyle={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 12,
                }}
              >
                <RoomAvatar title={room.title} imageUrl={room.avatarUrl} size={28} />
                <Text
                  numberOfLines={1}
                  style={{ color: c.text, fontSize: 16, fontWeight: "700", marginLeft: 8, flexShrink: 1 }}
                >
                  {room.title}
                </Text>
              </GlassSurface>
            </Animated.View>

            {barButton("ellipsis-vertical", "Меню кімнати", () => setMenuVisible(true))}
          </View>

          {/* «Прилипла» панель вкладок */}
          {showPinnedTabs && (
            <Animated.View
              entering={FadeIn.duration(140)}
              exiting={FadeOut.duration(120)}
              style={{ marginTop: 8, marginHorizontal: BAR_SIDE_MARGIN }}
            >
              <GlassSurface radius={22} intensity={75}>
                <RoomTabBar tabs={tabs} active={tab} onChange={handleTabChange} />
              </GlassSurface>
            </Animated.View>
          )}
        </View>

        <PopoverMenu visible={menuVisible} onClose={() => setMenuVisible(false)} actions={menuActions} />

        <ActionSheet
          visible={!!memberSheet}
          onClose={() => setMemberSheet(null)}
          title={memberSheet?.name}
          subtitle={
            memberSheet
              ? memberSheet.role === "creator"
                ? "Творець кімнати"
                : memberSheet.role === "admin"
                  ? "Адміністратор"
                  : "Учасник"
              : undefined
          }
          avatar={
            memberSheet ? (
              <RoomAvatar title={memberSheet.name} imageUrl={memberSheet.image} size={44} />
            ) : undefined
          }
          actions={memberActions}
        />

        <ActionSheet
          visible={discussionMenu}
          onClose={() => setDiscussionMenu(false)}
          title="Обговорення"
          subtitle="Група для коментарів до публікацій"
          actions={[
            {
              key: "create",
              label: "Створити нову групу",
              icon: "add-circle-outline",
              onPress: () =>
                void openLinkedChat(() => createDiscussionGroup({ channelId: roomId })),
            },
            {
              key: "pick",
              label: "Обрати наявну групу",
              icon: "people-outline",
              onPress: () => setTimeout(() => setPickGroup(true), 300),
            },
          ]}
        />

        <ForwardSheet
          visible={pickGroup}
          title="Обрати групу обговорення"
          filter={(r) =>
            !r.isDirect && !r.isChannel && !r.isSaved && r.creatorId === myId && !r.discussionOfChannelId
          }
          onClose={() => setPickGroup(false)}
          onPick={(groupId) => {
            setPickGroup(false);
            void linkDiscussionGroup({ channelId: roomId, groupId }).catch((error: any) =>
              Alert.alert("Помилка", error?.message ?? "Не вдалося привʼязати групу"),
            );
          }}
        />

        <MuteSheet
          visible={muteVisible}
          title={room?.title}
          onClose={() => setMuteVisible(false)}
          onPick={(durationMs) => {
            setMuteVisible(false);
            void applyMute(true, durationMs);
          }}
        />

        <EditRoomModal
          visible={editVisible}
          roomId={roomId}
          initialTitle={room.title}
          initialDescription={room.description}
          initialAvatarUrl={room.avatarUrl}
          onClose={() => setEditVisible(false)}
        />

        <AddMembersModal
          visible={addVisible}
          roomId={roomId}
          participantIds={room.participantIds}
          onClose={() => setAddVisible(false)}
        />

        <MediaViewer
          visible={!!gallery}
          items={gallery?.items ?? []}
          initialIndex={gallery?.index ?? 0}
          onClose={() => setGallery(null)}
        />

        <ImageViewerModal
          visible={!!viewerUrl}
          imageUrl={viewerUrl}
          onClose={() => setViewerUrl(null)}
        />
      </View>
    </GlassProvider>
  );
}
