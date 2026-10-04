import { useScreenActive } from "@/components/AnimatedAvatarVideo";
import { avatarColor } from "@/constants/theme";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { memo, useEffect, useRef, useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

/**
 * Малі анімовані аватари (список чатів, контакти, учасники, шапка чату).
 * Для продуктивності одночасно грає не більше MAX_PLAYING таких кіл — решта показує статичний постер.
 */
const MAX_PLAYING = 4;
let queue: string[] = [];
const subscribers = new Set<() => void>();
let counter = 0;

function notify() {
  subscribers.forEach((l) => l());
}
function enqueue(id: string) {
  if (!queue.includes(id)) {
    queue = [...queue, id];
    notify();
  }
}
function dequeue(id: string) {
  if (queue.includes(id)) {
    queue = queue.filter((x) => x !== id);
    notify();
  }
}

/** Чи дісталося цьому аватару місце серед перших MAX_PLAYING охочих (за порядком появи). */
function useSlot(wanted: boolean): boolean {
  const idRef = useRef(`mini-anim-${++counter}`);
  const [, force] = useState(0);
  useEffect(() => {
    const id = idRef.current;
    const l = () => force((n) => n + 1);
    subscribers.add(l);
    return () => {
      subscribers.delete(l);
      dequeue(id);
    };
  }, []);
  useEffect(() => {
    if (wanted) enqueue(idRef.current);
    else dequeue(idRef.current);
  }, [wanted]);
  return wanted && queue.indexOf(idRef.current) >= 0 && queue.indexOf(idRef.current) < MAX_PLAYING;
}

interface Props {
  /** Статичний постер (users.image) — показується, поки анімація не готова, і коли грати не можна. */
  posterUrl: string;
  animUrl: string;
  kind: "video" | "gif";
  size: number;
  title: string;
  style?: StyleProp<ViewStyle>;
}

export const AnimatedAvatar = memo(function AnimatedAvatar({ posterUrl, animUrl, kind, size, title, style }: Props) {
  const screenActive = useScreenActive();
  const granted = useSlot(screenActive);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
  }, [animUrl]);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: avatarColor(title),
        },
        style,
      ]}
    >
      {/* Постер лише під анімацією й зникає з першим кадром — без накладання двох зображень. */}
      <Image
        source={{ uri: posterUrl }}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={posterUrl}
        style={[StyleSheet.absoluteFill, { opacity: granted && ready ? 0 : 1 }]}
      />
      {granted ? (
        kind === "gif" ? (
          <Image
            source={{ uri: animUrl }}
            autoplay
            contentFit="cover"
            cachePolicy="memory-disk"
            onLoad={() => setReady(true)}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        ) : (
          <MiniVideo url={animUrl} onReady={() => setReady(true)} />
        )
      ) : null}
    </View>
  );
});

function MiniVideo({ url, onReady }: { url: string; onReady: () => void }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
    p.volume = 0;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      surfaceType="textureView"
      useExoShutter={false}
      allowsPictureInPicture={false}
      onFirstFrameRender={onReady}
      pointerEvents="none"
    />
  );
}
