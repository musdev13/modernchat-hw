import { Image } from "expo-image";
import { useNavigation } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { memo, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet } from "react-native";

// Реєстр «грає лише один»: останній, хто заявив про себе, — єдиний активний аватар.
let activeOwner: string | null = null;
const listeners = new Set<() => void>();
function claim(id: string) {
  activeOwner = id;
  listeners.forEach((l) => l());
}
function release(id: string) {
  if (activeOwner === id) {
    activeOwner = null;
    listeners.forEach((l) => l());
  }
}
let counter = 0;

/** Стан «екран у фокусі й застосунок активний» — інакше анімацію зупиняємо. */
function useScreenActive(): boolean {
  const navigation = useNavigation();
  const [focused, setFocused] = useState(true);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const a = navigation.addListener("focus", () => setFocused(true));
    const b = navigation.addListener("blur", () => setFocused(false));
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    return () => {
      a();
      b();
      sub.remove();
    };
  }, [navigation]);
  return focused && appActive;
}

function useIsOwner(wanted: boolean): boolean {
  const idRef = useRef(`anim-avatar-${++counter}`);
  const [, force] = useState(0);
  useEffect(() => {
    const id = idRef.current;
    const l = () => force((n) => n + 1);
    listeners.add(l);
    if (wanted) claim(id);
    else release(id);
    return () => {
      listeners.delete(l);
      release(id);
    };
  }, [wanted]);
  return wanted && activeOwner === idRef.current;
}

interface Props {
  url: string;
  kind: "video" | "gif";
  /** Показувати/програвати (наприклад, лише поки видно головне фото). */
  visible: boolean;
}

/**
 * Анімація аватара поверх статичного постера: безкінечний беззвучний цикл. Постер лишається видимим
 * під відео, доки не відрендериться перший кадр. Грає лише один такий аватар одночасно й тільки
 * коли екран у фокусі.
 */
export const AnimatedAvatarVideo = memo(function AnimatedAvatarVideo({ url, kind, visible }: Props) {
  const screenActive = useScreenActive();
  const playing = useIsOwner(visible && screenActive);
  if (kind === "gif") {
    return (
      <Image
        source={{ uri: url }}
        autoplay={playing}
        contentFit="cover"
        cachePolicy="memory-disk"
        style={[StyleSheet.absoluteFill, { opacity: visible ? 1 : 0 }]}
        pointerEvents="none"
      />
    );
  }
  return <VideoLayer url={url} playing={playing} visible={visible} />;
});

function VideoLayer({ url, playing, visible }: { url: string; playing: boolean; visible: boolean }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
    p.volume = 0;
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      if (playing) player.play();
      else player.pause();
    } catch {
      // плеєр міг бути вже звільнений
    }
  }, [playing, player]);

  return (
    <VideoView
      player={player}
      style={[StyleSheet.absoluteFill, { opacity: ready && visible ? 1 : 0 }]}
      contentFit="cover"
      nativeControls={false}
      surfaceType="textureView"
      useExoShutter={false}
      allowsPictureInPicture={false}
      onFirstFrameRender={() => setReady(true)}
      pointerEvents="none"
    />
  );
}
