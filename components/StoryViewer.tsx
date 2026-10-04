import { NameBadges } from "@/components/PremiumBadge";
import { RoomAvatar } from "@/components/RoomAvatar";
import { PREMIUM_GOLD } from "@/constants/premium";
import { usePremiumUi } from "@/context/PremiumContext";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { usePremium } from "@/hooks/usePremium";
import { convexErrorText } from "@/utils/convexError";
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

const PHOTO_MS = 5000;
const MAX_VIDEO_MS = 60_000;

/** Відтворення відео-історії: один плеєр на історію, пауза за станом переглядача. */
function StoryVideo({ url, paused, onReady }: { url: string; paused: boolean; onReady: () => void }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.muted = false;
  });
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
  onClose: () => void;
}

/**
 * Повноекранний переглядач історій: сегменти прогресу, тап ліворуч/праворуч, утримання — пауза,
 * свайп вниз — закрити, автоперехід до наступного користувача, відповідь у DM, перегляди для власника.
 */
export function StoryViewer({ startUserId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { openUpsell } = usePremiumUi();
  const premium = usePremium();
  const me = useQuery(api.users.currentUser);
  const feed = useQuery(api.stories.feed);
  const markViewed = useMutation(api.stories.markViewed);
  const removeStory = useMutation(api.stories.remove);
  const getOrCreateDirect = useMutation(api.rooms.getOrCreateDirectRoom);
  const sendMessage = useMutation(api.messages.sendMessage);

  // Черга користувачів фіксується один раз при відкритті (щоб перегляди не переставляли її).
  const [seq, setSeq] = useState<Id<"users">[]>([startUserId]);
  const seqReady = useRef(false);
  useEffect(() => {
    if (seqReady.current || feed === undefined || feed === null || me === undefined || !me) return;
    seqReady.current = true;
    const ids = feed.users.map((u) => u.userId);
    const list: Id<"users">[] =
      startUserId === me._id
        ? [me._id, ...ids]
        : ids.includes(startUserId)
          ? ids.slice(ids.indexOf(startUserId))
          : [startUserId, ...ids];
    setSeq(list);
  }, [feed, me, startUserId]);

  const [userIdx, setUserIdx] = useState(0);
  const userId = seq[Math.min(userIdx, seq.length - 1)];
  const data = useQuery(api.stories.userStories, { userId });
  const [idx, setIdx] = useState<number | null>(null);
  const stories = data?.stories ?? [];
  const count = stories.length;
  const isMine = !!data?.isMine;

  // Початок — з першої непереглянутої історії користувача.
  useEffect(() => {
    if (data && idx === null && count > 0) {
      const firstNew = data.stories.findIndex((s) => !s.viewed);
      setIdx(firstNew >= 0 ? firstNew : 0);
    }
  }, [data, idx, count]);
  const safeIdx = idx === null ? 0 : Math.min(idx, Math.max(0, count - 1));
  const story = idx === null ? undefined : stories[safeIdx];

  // Користувач без активних історій — переходимо далі.
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
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [kb, setKb] = useState(0);
  const paused = hold || replyFocused || viewersOpen;
  const loaded = !!story && loadedId === story._id;

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

  // ── перегляд ──
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
      if (viewersOpen) setViewersOpen(false);
      else onClose();
      return true;
    });
    return () => sub.remove();
  }, [viewersOpen, onClose]);

  // ── жести ──
  const widthSV = useSharedValue(1);
  const translateY = useSharedValue(0);
  const onTapSide = (left: boolean) => {
    if (replyFocused) {
      Keyboard.dismiss();
      return;
    }
    if (left) goPrev();
    else goNextRef.current();
  };
  const holdOn = () => setHold(true);
  const holdOff = () => setHold(false);

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
  const gesture = Gesture.Simultaneous(pan, Gesture.Exclusive(longPress, tap));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: 1 - Math.min(translateY.value, 400) / 4000 }],
    borderRadius: Math.min(translateY.value / 6, 28),
  }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(translateY.value, 300) / 450 }));

  // ── дії ──
  const sendReply = async () => {
    const text = reply.trim();
    if (!text || !story || sending) return;
    setSending(true);
    try {
      const roomId = await getOrCreateDirect({ otherUserId: userId });
      await sendMessage({ chatRoomId: roomId, content: `↩️ Відповідь на історію: ${text}` });
      setReply("");
      Keyboard.dismiss();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setToast("Відповідь надіслано");
      setTimeout(() => setToast(null), 1800);
    } catch (e) {
      Alert.alert("Не вдалося надіслати", convexErrorText(e));
    } finally {
      setSending(false);
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
    if (!premium.isPremium) {
      openUpsell("stories", "Список переглядів доступний лише з Modesto Premium. Кількість переглядів ви бачите безкоштовно.");
      return;
    }
    setViewersOpen(true);
  };

  const user = data?.user;

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
                <StoryVideo key={story._id} url={story.url} paused={paused} onReady={() => setLoadedId(story._id)} />
              )
            ) : null}
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
                <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12.5, marginTop: 1 }}>
                  {timeAgoUk(story.createdAt)}
                  {isMine ? ` · ще ${timeLeftUk(story.expiresAt)}` : ""}
                </Text>
              ) : null}
            </View>
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
            <View pointerEvents="none" style={{ paddingHorizontal: 18, paddingVertical: 12, backgroundColor: "rgba(0,0,0,0.38)" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 16, lineHeight: 22, textAlign: "center" }}>{story.caption}</Text>
            </View>
          ) : null}

          {toast ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={{ alignSelf: "center", marginBottom: 8, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.7)" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 13.5 }}>{toast}</Text>
            </Animated.View>
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
                {!premium.isPremium ? <Ionicons name="lock-closed" size={13} color={PREMIUM_GOLD} style={{ marginLeft: 8 }} /> : null}
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
              <TextInput
                value={reply}
                onChangeText={setReply}
                onFocus={() => setReplyFocused(true)}
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
              ) : null}
            </View>
          )}
        </View>

        {viewersOpen && story ? <ViewersSheet storyId={story._id} onClose={() => setViewersOpen(false)} /> : null}
      </Animated.View>
    </View>
  );
}

/** Список переглядів (лише власник із Premium). */
function ViewersSheet({ storyId, onClose }: { storyId: Id<"stories">; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const viewers = useQuery(api.stories.viewers, { storyId });
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
          maxHeight: "60%",
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
              </View>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
