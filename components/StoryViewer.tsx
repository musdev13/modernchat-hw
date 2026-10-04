import { ActionSheet, SheetAction } from "@/components/ActionSheet";
import { ForwardSheet } from "@/components/ForwardSheet";
import { useOpenLink } from "@/components/MessageText";
import { NameBadges } from "@/components/PremiumBadge";
import { ReactionBurst } from "@/components/ReactionBurst";
import { RoomAvatar } from "@/components/RoomAvatar";
import { StoryOverlays } from "@/components/StoryOverlay";
import { PREMIUM_GOLD } from "@/constants/premium";
import { usePremiumUi } from "@/context/PremiumContext";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { FREE_REACTIONS, isPremiumReaction, PREMIUM_REACTIONS } from "@/convex/limits";
import { usePremium } from "@/hooks/usePremium";
import { convexErrorData, convexErrorText } from "@/utils/convexError";
import { tokenize } from "@/utils/linkify";
import { saveMedia } from "@/utils/mediaSave";
import { timeAgoUk, timeLeftUk } from "@/utils/timeAgo";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  SharedValue,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const PHOTO_MS = 5000;
const MAX_VIDEO_MS = 60_000;
const AUDIENCE_LABEL: Record<string, string> = {
  all: "Усі",
  contacts: "Контакти",
  close: "Близькі друзі",
  selected: "Вибрані",
  except: "Усі, крім…",
};

/** Відтворення відео-історії: один плеєр на історію, пауза за станом переглядача. */
function StoryVideo({
  url,
  paused,
  muted,
  onReady,
}: {
  url: string;
  paused: boolean;
  muted: boolean;
  onReady: () => void;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.muted = muted;
  });
  useEffect(() => {
    try {
      player.muted = muted;
    } catch {
      // плеєр звільнено
    }
  }, [muted, player]);
  useEffect(() => {
    try {
      if (paused) player.pause();
      else player.play();
    } catch {
      // плеєр звільнено
    }
  }, [paused, player]);
  return (
    <VideoView
      player={player}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      contentFit="contain"
      nativeControls={false}
      surfaceType="textureView"
      useExoShutter={false}
      allowsPictureInPicture={false}
      onFirstFrameRender={onReady}
    />
  );
}

/** Сегменти прогресу: пройдені заповнені, поточний — анімований, майбутні порожні. */
function Segments({ count, index, progress }: { count: number; index: number; progress: SharedValue<number> }) {
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {Array.from({ length: count }, (_, i) => (
        <Segment key={i} state={i < index ? "done" : i === index ? "active" : "todo"} progress={progress} />
      ))}
    </View>
  );
}

function Segment({ state, progress }: { state: "done" | "active" | "todo"; progress: SharedValue<number> }) {
  const fillStyle = useAnimatedStyle(() => ({
    width: state === "done" ? "100%" : state === "active" ? `${progress.value * 100}%` : "0%",
  }));
  return (
    <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.32)", overflow: "hidden" }}>
      <Animated.View style={[{ height: 3, backgroundColor: "#FFFFFF" }, fillStyle]} />
    </View>
  );
}

interface Props {
  startUserId: Id<"users">;
  /** Початкова історія (глибоке посилання / цитата в чаті). */
  focusStoryId?: Id<"stories">;
  /** Показати «підбірки» користувача. */
  highlights?: boolean;
  /** Архів власника. */
  archive?: boolean;
  onClose: () => void;
}

/**
 * Повноекранний переглядач історій: сегменти прогресу, тап ліворуч/праворуч, утримання — пауза,
 * свайп вниз — закрити, свайп вліво/вправо — інший користувач, реакції (довге натискання — більше),
 * відповідь у DM із цитатою, пересилання, посилання, згадки й накладки, перегляди з реакціями для власника.
 */
export function StoryViewer({ startUserId, focusStoryId, highlights, archive, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { openUpsell } = usePremiumUi();
  const premium = usePremium();
  const openLink = useOpenLink();
  const me = useQuery(api.users.currentUser);
  const feed = useQuery(api.stories.feed);
  const markViewed = useMutation(api.stories.markViewed);
  const removeStory = useMutation(api.stories.remove);
  const getOrCreateDirect = useMutation(api.rooms.getOrCreateDirectRoom);
  const replyMutation = useMutation(api.stories.reply);
  const reactMutation = useMutation(api.stories.react);
  const forwardMutation = useMutation(api.stories.forwardToChat);
  const repostMutation = useMutation(api.stories.repost);
  const highlightMutation = useMutation(api.stories.setHighlight);
  const hideUserMutation = useMutation(api.stories.hideUser);
  const stealthMutation = useMutation(api.stories.startStealth);

  // Черга користувачів фіксується один раз при відкритті (щоб перегляди не переставляли її).
  const [seq, setSeq] = useState<Id<"users">[]>([startUserId]);
  const seqReady = useRef(false);
  useEffect(() => {
    if (seqReady.current || feed === undefined || feed === null || me === undefined || !me) return;
    seqReady.current = true;
    if (highlights || archive) return;
    const ids = feed.users.map((u) => u.userId);
    const list: Id<"users">[] =
      startUserId === me._id
        ? [me._id, ...ids]
        : ids.includes(startUserId)
          ? ids.slice(ids.indexOf(startUserId))
          : [startUserId, ...ids];
    setSeq(list);
  }, [feed, me, startUserId, highlights, archive]);

  const [userIdx, setUserIdx] = useState(0);
  const userId = seq[Math.min(userIdx, seq.length - 1)];
  const data = useQuery(api.stories.userStories, {
    userId,
    highlights: highlights && userIdx === 0 ? true : undefined,
    archive: archive && userIdx === 0 ? true : undefined,
  });
  const [idx, setIdx] = useState<number | null>(null);
  const stories = data?.stories ?? [];
  const count = stories.length;
  const isMine = !!data?.isMine;

  // Початок — з історії-цілі або з першої непереглянутої історії користувача.
  useEffect(() => {
    if (data && idx === null && count > 0) {
      const focus = userIdx === 0 && focusStoryId ? data.stories.findIndex((s) => s._id === focusStoryId) : -1;
      const firstNew = data.stories.findIndex((s) => !s.viewed);
      setIdx(focus >= 0 ? focus : firstNew >= 0 ? firstNew : 0);
    }
  }, [data, idx, count, userIdx, focusStoryId]);
  const safeIdx = idx === null ? 0 : Math.min(idx, Math.max(0, count - 1));
  const story = idx === null ? undefined : stories[safeIdx];

  // Користувач без доступних історій — переходимо далі.
  useEffect(() => {
    if (data && count === 0) {
      if (userIdx < seq.length - 1) {
        setUserIdx(userIdx + 1);
        setIdx(null);
      } else {
        onClose();
      }
    }
  }, [data, count, userIdx, seq.length, onClose]);

  const [hold, setHold] = useState(false);
  const [replyFocused, setReplyFocused] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMore, setPanelMore] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [kb, setKb] = useState(0);
  const [burst, setBurst] = useState({ emoji: "❤️", nonce: 0 });
  const [box, setBox] = useState({ w: 0, h: 0 });
  const paused = hold || replyFocused || viewersOpen || menuOpen || forwardOpen || panelOpen;
  const loaded = !!story && loadedId === story._id;

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 1900);
  }, []);

  // ── прогрес ──
  const progress = useSharedValue(0);
  const durationMs = story
    ? story.kind === "video"
      ? Math.min(Math.max(story.durationMs ?? 8000, 1500), MAX_VIDEO_MS)
      : PHOTO_MS
    : PHOTO_MS;

  const goNextRef = useRef<() => void>(() => {});
  const advanceFromTimer = useRef(() => goNextRef.current()).current;

  const nextUser = useCallback(() => {
    if (userIdx < seq.length - 1) {
      setUserIdx(userIdx + 1);
      setIdx(null);
    } else {
      onClose();
    }
  }, [userIdx, seq.length, onClose]);

  const prevUser = useCallback(() => {
    if (userIdx > 0) {
      setUserIdx(userIdx - 1);
      setIdx(null);
    }
  }, [userIdx]);

  goNextRef.current = () => {
    if (idx !== null && safeIdx < count - 1) setIdx(safeIdx + 1);
    else nextUser();
  };

  const goPrev = () => {
    if (safeIdx > 0) setIdx(safeIdx - 1);
    else if (userIdx > 0) {
      setUserIdx(userIdx - 1);
      setIdx(null);
    } else {
      cancelAnimation(progress);
      progress.value = 0;
    }
  };

  const storyId = story?._id;
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    setPanelOpen(false);
    setPanelMore(false);
  }, [storyId, progress]);

  useEffect(() => {
    if (!story || !loaded || paused) {
      cancelAnimation(progress);
      return;
    }
    const remaining = Math.max(120, durationMs * (1 - progress.value));
    progress.value = withTiming(1, { duration: remaining, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(advanceFromTimer)();
    });
    return () => cancelAnimation(progress);
  }, [story, loaded, paused, durationMs, progress, advanceFromTimer]);

  // ── перегляд (у режимі невидимки сервер його не записує) ──
  useEffect(() => {
    if (!story || isMine) return;
    markViewed({ storyId: story._id }).catch(() => {});
  }, [story?._id, isMine]); // eslint-disable-line react-hooks/exhaustive-deps

  // Прогрів наступного фото.
  useEffect(() => {
    const next = stories[safeIdx + 1];
    if (next && next.kind === "photo") void Image.prefetch(next.url);
  }, [stories, safeIdx]);

  // ── клавіатура, «Назад» ──
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) =>
      setKb(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (panelOpen) setPanelOpen(false);
      else if (viewersOpen) setViewersOpen(false);
      else onClose();
      return true;
    });
    return () => sub.remove();
  }, [viewersOpen, panelOpen, onClose]);

  // ── жести ──
  const widthSV = useSharedValue(1);
  const translateY = useSharedValue(0);
  const onTapSide = (left: boolean) => {
    if (replyFocused) {
      Keyboard.dismiss();
      return;
    }
    if (panelOpen) {
      setPanelOpen(false);
      return;
    }
    if (left) goPrev();
    else goNextRef.current();
  };
  const holdOn = () => setHold(true);
  const holdOff = () => setHold(false);
  const swipeUser = (toNext: boolean) => {
    if (toNext) nextUser();
    else prevUser();
  };

  const pan = Gesture.Pan()
    .activeOffsetY(14)
    .failOffsetX([-28, 28])
    .onStart(() => {
      runOnJS(holdOn)();
    })
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 130 || e.velocityY > 900) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    })
    .onFinalize(() => {
      runOnJS(holdOff)();
    });
  const panX = Gesture.Pan()
    .activeOffsetX([-26, 26])
    .failOffsetY([-18, 18])
    .onEnd((e) => {
      if (e.translationX < -70 || e.velocityX < -900) runOnJS(swipeUser)(true);
      else if (e.translationX > 70 || e.velocityX > 900) runOnJS(swipeUser)(false);
    });
  const longPress = Gesture.LongPress()
    .minDuration(200)
    .maxDistance(30)
    .onStart(() => {
      runOnJS(holdOn)();
    })
    .onFinalize(() => {
      runOnJS(holdOff)();
    });
  const tap = Gesture.Tap()
    .maxDuration(240)
    .onEnd((e, success) => {
      if (success) runOnJS(onTapSide)(e.x < widthSV.value / 3);
    });
  const gesture = Gesture.Simultaneous(pan, panX, Gesture.Exclusive(longPress, tap));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: 1 - Math.min(translateY.value, 400) / 4000 }],
    borderRadius: Math.min(translateY.value / 6, 28),
  }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(translateY.value, 300) / 450 }));

  // ── дії ──
  const handleError = (title: string, e: unknown) => {
    const code = convexErrorData(e)?.code;
    if (code && ["REACTION_PREMIUM", "VIEWERS_PREMIUM", "HIGHLIGHTS_LIMIT", "STEALTH_PREMIUM", "LIMIT_ACTIVE"].includes(code) && !premium.isPremium) {
      openUpsell("stories", convexErrorText(e));
    } else {
      Alert.alert(title, convexErrorText(e));
    }
  };

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || !story || sending) return;
    setSending(true);
    try {
      const roomId = await getOrCreateDirect({ otherUserId: userId });
      await replyMutation({ storyId: story._id, chatRoomId: roomId, text });
      setReply("");
      Keyboard.dismiss();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Відповідь надіслано");
    } catch (e) {
      Alert.alert("Не вдалося надіслати", convexErrorText(e));
    } finally {
      setSending(false);
    }
  };

  const sendReaction = async (emoji: string) => {
    if (!story) return;
    setPanelOpen(false);
    if (isPremiumReaction(emoji) && !premium.isPremium) {
      openUpsell("stories", "Ця реакція доступна лише з Modesto Premium.");
      return;
    }
    try {
      const r = await reactMutation({ storyId: story._id, emoji });
      if (r.emoji) {
        setBurst((b) => ({ emoji, nonce: b.nonce + 1 }));
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      handleError("Не вдалося відреагувати", e);
    }
  };

  const confirmDelete = () => {
    if (!story) return;
    setHold(true);
    Alert.alert("Видалити історію?", "Її більше ніхто не побачить.", [
      { text: "Скасувати", style: "cancel", onPress: () => setHold(false) },
      {
        text: "Видалити",
        style: "destructive",
        onPress: () => {
          setHold(false);
          removeStory({ storyId: story._id }).catch((e) => Alert.alert("Помилка", convexErrorText(e)));
        },
      },
    ]);
  };

  const openViewers = () => {
    if (!story) return;
    if (story.expired && !premium.isPremium) {
      openUpsell("stories", "Перегляди завершених історій зберігаються назавжди лише з Modesto Premium.");
      return;
    }
    setViewersOpen(true);
  };

  const shareLink = async () => {
    if (!story) return;
    try {
      await Share.share({ message: `modesto://s/${story._id}` });
    } catch {
      // користувач закрив меню
    }
  };

  const saveToGallery = async () => {
    if (!story) return;
    if (!story.canSave) {
      if (story.protectContent) Alert.alert("Недоступно", "Автор заборонив збереження цієї історії.");
      else openUpsell("stories", "Зберігати чужі історії в галерею можна з Modesto Premium.");
      return;
    }
    try {
      await saveMedia(story.url, story.kind === "video" ? "video" : "image");
      showToast("Збережено в галерею");
    } catch (e) {
      Alert.alert("Не вдалося зберегти", convexErrorText(e));
    }
  };

  const repost = async () => {
    if (!story) return;
    try {
      await repostMutation({ storyId: story._id });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Історію опубліковано повторно");
    } catch (e) {
      handleError("Не вдалося опублікувати", e);
    }
  };

  const toggleHighlight = async () => {
    if (!story) return;
    try {
      await highlightMutation({ storyId: story._id, on: !story.highlight });
      showToast(story.highlight ? "Прибрано з підбірок" : "Додано до підбірок профілю");
    } catch (e) {
      handleError("Не вдалося зберегти", e);
    }
  };

  const hideAuthor = async () => {
    try {
      await hideUserMutation({ userId, hidden: true });
      showToast("Історії автора приховано");
      nextUser();
    } catch (e) {
      Alert.alert("Помилка", convexErrorText(e));
    }
  };

  const enableStealth = async () => {
    if (!premium.isPremium) {
      openUpsell("stories", "Режим невидимки доступний лише з Modesto Premium.");
      return;
    }
    try {
      await stealthMutation({});
      showToast("Невидимка: 25 хв ваші перегляди не записуються");
    } catch (e) {
      handleError("Не вдалося увімкнути", e);
    }
  };

  const forwardTo = async (roomId: Id<"chatRooms">) => {
    setForwardOpen(false);
    if (!story) return;
    try {
      await forwardMutation({ storyId: story._id, chatRoomId: roomId });
      showToast("Історію надіслано");
    } catch (e) {
      Alert.alert("Не вдалося переслати", convexErrorText(e));
    }
  };

  const openMention = (token: { kind?: string; href?: string; text: string }) => {
    const uname = token.text.replace(/^@/, "").toLowerCase();
    const known = story?.mentions.find((m) => m.username.toLowerCase() === uname);
    onClose();
    setTimeout(() => {
      if (token.kind === "mention" && known) router.push(`/user/${known.userId}` as never);
      else if (token.kind) void openLink({ kind: token.kind as never, href: token.href ?? token.text, text: token.text });
    }, 60);
  };

  const menuActions: SheetAction[] = [];
  if (story) {
    if (story.canForward) {
      menuActions.push({ key: "link", label: "Поділитися посиланням", icon: "link-outline", onPress: () => void shareLink() });
      menuActions.push({ key: "fwd", label: "Переслати в чат", icon: "arrow-redo-outline", onPress: () => setForwardOpen(true) });
    }
    if (story.canSave || !story.protectContent) {
      menuActions.push({
        key: "save",
        label: story.canSave ? "Зберегти в галерею" : "Зберегти в галерею (Premium)",
        icon: "download-outline",
        onPress: () => void saveToGallery(),
      });
    }
    if (isMine) {
      menuActions.push({
        key: "hl",
        label: story.highlight ? "Прибрати з підбірок профілю" : "Додати до підбірок профілю",
        icon: story.highlight ? "bookmark" : "bookmark-outline",
        onPress: () => void toggleHighlight(),
      });
      menuActions.push({ key: "repost", label: "Опублікувати повторно", icon: "repeat-outline", onPress: () => void repost() });
      menuActions.push({ key: "del", label: "Видалити історію", icon: "trash-outline", destructive: true, onPress: confirmDelete });
    } else {
      if (story.canForward) {
        menuActions.push({ key: "repost", label: "Репост у мої історії", icon: "repeat-outline", onPress: () => void repost() });
      }
      menuActions.push({
        key: "stealth",
        label: premium.isPremium ? "Режим невидимки (25 хв)" : "Режим невидимки (Premium)",
        icon: "eye-off-outline",
        onPress: () => void enableStealth(),
      });
      menuActions.push({ key: "hide", label: "Приховати історії автора", icon: "close-circle-outline", onPress: () => void hideAuthor() });
    }
  }

  const user = data?.user;
  const captionTokens = story?.caption ? tokenize(story.caption) : [];

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 800, elevation: 800 }}>
      <Animated.View
        entering={FadeIn.duration(140)}
        exiting={FadeOut.duration(120)}
        style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000" }, dimStyle]}
      />
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(120)}
        style={[{ flex: 1, overflow: "hidden", backgroundColor: "#000" }, sheetStyle]}
      >
        {/* Медіа + жести */}
        <GestureDetector gesture={gesture}>
          <View
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            onLayout={(e) => {
              widthSV.value = e.nativeEvent.layout.width;
              setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
            }}
          >
            {story ? (
              story.kind === "photo" ? (
                <Image
                  key={story._id}
                  source={{ uri: story.url }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  onLoad={() => setLoadedId(story._id)}
                  onError={() => setLoadedId(story._id)}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                />
              ) : (
                <StoryVideo key={story._id} url={story.url} paused={paused} muted={muted} onReady={() => setLoadedId(story._id)} />
              )
            ) : null}
            {story && story.overlays.length > 0 ? <StoryOverlays overlays={story.overlays} w={box.w} h={box.h} /> : null}
            {!loaded ? (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </View>
        </GestureDetector>

        {/* Верх: сегменти + автор */}
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top + 8, paddingHorizontal: 10 }}
        >
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 110, backgroundColor: "rgba(0,0,0,0.28)" }} />
          <Segments count={Math.max(count, 1)} index={safeIdx} progress={progress} />
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
            {user ? <RoomAvatar title={user.name} imageUrl={user.image} size={36} /> : <View style={{ width: 36, height: 36 }} />}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 15.5, fontWeight: "700", flexShrink: 1 }}>
                  {isMine ? "Моя історія" : (user?.name ?? "")}
                </Text>
                {user ? <NameBadges premium={user.isPremium} emoji={user.emojiStatus} size={13} /> : null}
              </View>
              {story ? (
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.75)", fontSize: 12.5, marginTop: 1 }}>
                  {story.repostOfName ? `Репост від ${story.repostOfName} · ` : ""}
                  {timeAgoUk(story.createdAt)}
                  {isMine ? (story.expired ? " · завершена" : ` · ще ${timeLeftUk(story.expiresAt)}`) : ""}
                  {isMine && story.audience !== "all" ? ` · ${AUDIENCE_LABEL[story.audience]}` : ""}
                  {story.protectContent ? " · 🔒" : ""}
                </Text>
              ) : null}
            </View>
            {story?.kind === "video" ? (
              <TouchableOpacity
                onPress={() => setMuted((m) => !m)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={muted ? "Увімкнути звук" : "Вимкнути звук"}
                style={{ padding: 6 }}
              >
                <Ionicons name={muted ? "volume-mute" : "volume-high"} size={24} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
            {menuActions.length > 0 ? (
              <TouchableOpacity
                onPress={() => setMenuOpen(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Меню історії"
                style={{ padding: 6 }}
              >
                <Ionicons name="ellipsis-vertical" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Закрити" style={{ padding: 6 }}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Низ: підпис + відповідь / перегляди */}
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", left: 0, right: 0, bottom: kb, paddingBottom: kb > 0 ? 8 : insets.bottom + 10 }}
        >
          {story?.caption ? (
            <View style={{ maxHeight: 170, backgroundColor: "rgba(0,0,0,0.38)" }}>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 12 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 16, lineHeight: 22, textAlign: "center" }}>
                  {captionTokens.map((t, i) =>
                    t.kind ? (
                      <Text
                        key={i}
                        onPress={() => openMention(t)}
                        style={{ color: "#8CC8FF", fontWeight: t.kind === "mention" ? "700" : "400", textDecorationLine: t.kind === "mention" ? "none" : "underline" }}
                      >
                        {t.text}
                      </Text>
                    ) : (
                      t.text
                    ),
                  )}
                </Text>
              </ScrollView>
            </View>
          ) : null}

          {toast ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={{ alignSelf: "center", marginBottom: 8, marginTop: 8, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.7)" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 13.5 }}>{toast}</Text>
            </Animated.View>
          ) : null}

          {panelOpen && !isMine ? (
            <ReactionPanel
              more={panelMore}
              onMore={() => setPanelMore((m) => !m)}
              premium={premium.isPremium}
              onPick={(e) => void sendReaction(e)}
            />
          ) : null}

          {isMine ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8 }}>
              <TouchableOpacity
                onPress={openViewers}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Перегляди"
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.16)" }}
              >
                <Ionicons name="eye-outline" size={20} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600", marginLeft: 7 }}>{story?.viewCount ?? 0}</Text>
                {(story?.reactionCount ?? 0) > 0 ? (
                  <>
                    <Ionicons name="heart" size={17} color="#FF5A6E" style={{ marginLeft: 12 }} />
                    <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600", marginLeft: 5 }}>{story?.reactionCount}</Text>
                  </>
                ) : null}
                {story?.expired && !premium.isPremium ? <Ionicons name="lock-closed" size={13} color={PREMIUM_GOLD} style={{ marginLeft: 8 }} /> : null}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Видалити історію"
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" }}
              >
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8 }}>
              {story && !story.allowReplies ? (
                <View style={{ flex: 1, height: 44, borderRadius: 22, justifyContent: "center", paddingHorizontal: 16, backgroundColor: "rgba(0,0,0,0.35)" }}>
                  <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 14 }}>Автор вимкнув відповіді</Text>
                </View>
              ) : (
                <TextInput
                  value={reply}
                  onChangeText={setReply}
                  onFocus={() => {
                    setReplyFocused(true);
                    setPanelOpen(false);
                  }}
                  onBlur={() => setReplyFocused(false)}
                  placeholder="Відповісти…"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  returnKeyType="send"
                  onSubmitEditing={() => void sendReply()}
                  maxLength={500}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 22,
                    paddingHorizontal: 16,
                    color: "#FFFFFF",
                    fontSize: 15.5,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.4)",
                    backgroundColor: "rgba(0,0,0,0.35)",
                  }}
                />
              )}
              {reply.trim() ? (
                <TouchableOpacity
                  onPress={() => void sendReply()}
                  disabled={sending}
                  accessibilityRole="button"
                  accessibilityLabel="Надіслати"
                  style={{ marginLeft: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}
                >
                  {sending ? <ActivityIndicator color="#000" /> : <Ionicons name="send" size={19} color="#000" />}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => void sendReaction(story?.myReaction ?? "❤️")}
                  onLongPress={() => {
                    void Haptics.selectionAsync();
                    setPanelOpen((o) => !o);
                    setPanelMore(false);
                  }}
                  delayLongPress={250}
                  accessibilityRole="button"
                  accessibilityLabel="Реакція"
                  style={{ marginLeft: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}
                >
                  {story?.myReaction ? (
                    <Text style={{ fontSize: 22 }}>{story.myReaction}</Text>
                  ) : (
                    <Ionicons name="heart-outline" size={24} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <ReactionBurst emoji={burst.emoji} nonce={burst.nonce} />

        {viewersOpen && story ? <ViewersSheet storyId={story._id} onClose={() => setViewersOpen(false)} /> : null}
      </Animated.View>

      <ActionSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Історія" actions={menuActions.map((a) => ({ ...a, onPress: () => { setMenuOpen(false); a.onPress(); } }))} />
      <ForwardSheet visible={forwardOpen} onClose={() => setForwardOpen(false)} onPick={(id) => void forwardTo(id)} title="Надіслати історію в…" />
    </View>
  );
}

/** Панель реакцій: швидкі емодзі + розгорнутий набір (преміум-реакції зі «замком»). */
function ReactionPanel({
  more,
  onMore,
  premium,
  onPick,
}: {
  more: boolean;
  onMore: () => void;
  premium: boolean;
  onPick: (emoji: string) => void;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(120)}
      exiting={FadeOut.duration(100)}
      style={{ marginHorizontal: 12, marginBottom: 8, borderRadius: 22, backgroundColor: "rgba(20,22,28,0.94)", paddingVertical: 8, paddingHorizontal: 8 }}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
        {FREE_REACTIONS.map((e) => (
          <TouchableOpacity key={e} onPress={() => onPick(e)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 27 }}>{e}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={onMore}
          accessibilityLabel="Більше реакцій"
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center", marginLeft: 4 }}
        >
          <Ionicons name={more ? "chevron-down" : "add"} size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      {more ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)" }}>
          {PREMIUM_REACTIONS.map((e) => (
            <TouchableOpacity key={e} onPress={() => onPick(e)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 27, opacity: premium ? 1 : 0.55 }}>{e}</Text>
              {!premium ? <Ionicons name="lock-closed" size={11} color={PREMIUM_GOLD} style={{ position: "absolute", right: 6, bottom: 6 }} /> : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Список переглядів із реакціями (лише власник). */
function ViewersSheet({ storyId, onClose }: { storyId: Id<"stories">; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const viewers = useQuery(api.stories.viewers, { storyId });
  const reacted = (viewers ?? []).filter((v) => v.reaction).length;
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <Animated.View
        entering={FadeIn.duration(140)}
        exiting={FadeOut.duration(120)}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Закрити" />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(220)}
        exiting={SlideOutDown.duration(170)}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "65%",
          backgroundColor: "#12151C",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          paddingBottom: insets.bottom + 8,
        }}
      >
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" }} />
        </View>
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", textAlign: "center", marginBottom: 6 }}>
          Перегляди{viewers ? ` · ${viewers.length}` : ""}
          {reacted > 0 ? `  ·  реакцій: ${reacted}` : ""}
        </Text>
        <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
          {viewers === undefined ? (
            <ActivityIndicator style={{ margin: 24 }} color="#FFFFFF" />
          ) : viewers.length === 0 ? (
            <Text style={{ color: "rgba(255,255,255,0.6)", textAlign: "center", padding: 28, fontSize: 15 }}>
              Поки що ніхто не переглянув
            </Text>
          ) : (
            viewers.map((v) => (
              <View key={v.userId} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 }}>
                <RoomAvatar title={v.name} imageUrl={v.image} size={42} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 15.5, fontWeight: "600", flexShrink: 1 }}>
                      {v.name}
                    </Text>
                    <NameBadges premium={v.isPremium} emoji={v.emojiStatus} size={13} />
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 1 }}>{timeAgoUk(v.viewedAt)}</Text>
                </View>
                {v.reaction ? <Text style={{ fontSize: 24 }}>{v.reaction}</Text> : null}
              </View>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
