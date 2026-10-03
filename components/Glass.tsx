import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { requireOptionalNativeModule } from "expo";
import React, {
  Component,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";

/**
 * "Glass" surfaces (Telegram-like blur).
 *
 * expo-blur is a NATIVE module: it only works in a dev client / build that was
 * rebuilt after `expo install expo-blur`. In an old build (or Expo Go) the native
 * view does not exist, so we detect that at runtime and fall back to a
 * semi-transparent solid colour instead of crashing.
 */
type BlurModule = typeof import("expo-blur");
let cachedBlur: BlurModule | null | undefined;

function loadBlur(): BlurModule | null {
  if (cachedBlur !== undefined) return cachedBlur;
  try {
    // The JS package can be present while the native part is missing from the build.
    if (!requireOptionalNativeModule("ExpoBlur")) {
      cachedBlur = null;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cachedBlur = require("expo-blur") as BlurModule;
    }
  } catch {
    cachedBlur = null;
  }
  return cachedBlur;
}

/** true, if the native blur is present in the current build. */
export function isBlurAvailable(): boolean {
  return loadBlur() !== null;
}

interface GlassContextValue {
  targetRef: RefObject<View | null>;
  ready: boolean;
}

const GlassContext = createContext<GlassContextValue | null>(null);

/** Holds the ref of the view that glass surfaces blur (see GlassTarget). */
export function GlassProvider({ children }: { children: ReactNode }) {
  const targetRef = useRef<View | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  const value = useMemo(() => ({ targetRef, ready }), [ready]);
  return <GlassContext.Provider value={value}>{children}</GlassContext.Provider>;
}

/**
 * Wrap the scrolling content (the message list) in it: this is what the glass
 * surfaces blur. On Android it is a BlurTargetView, elsewhere a plain View.
 * Needs an opaque background, otherwise there is nothing to blur on Android.
 */
export function GlassTarget({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const ctx = useContext(GlassContext);
  const blur = loadBlur();
  const Target = (blur?.BlurTargetView ?? View) as typeof View;
  return (
    <Target ref={ctx?.targetRef} style={style} collapsable={false}>
      {children}
    </Target>
  );
}

/** If the native blur view fails to render, switch the surface to the solid fallback. */
class BlurBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface GlassSurfaceProps {
  /** Outer container: size, margins, flex, animated styles. */
  style?: ComponentProps<typeof Animated.View>["style"];
  /** Inner (clipped) container for the children layout. */
  contentStyle?: StyleProp<ViewStyle>;
  radius: number;
  /** 1-100. On Android the effective radius is intensity / blurReductionFactor (4). */
  intensity?: number;
  children?: ReactNode;
}

/**
 * Blurred translucent panel: real blur of whatever the GlassTarget shows under it,
 * tinted with the theme colour, with a thin border and a subtle shadow.
 */
export function GlassSurface({
  style,
  contentStyle,
  radius,
  intensity = 70,
  children,
}: GlassSurfaceProps) {
  const c = useChatPalette();
  const ctx = useContext(GlassContext);
  const blur = loadBlur();
  const [failed, setFailed] = useState(false);
  const canBlur = !!blur && !!ctx?.ready && !failed;
  const Blur = blur?.BlurView;

  const shadow: ViewStyle =
    Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: c.isDark ? 0.28 : 0.14,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
        }
      : // Android elevation is drawn through translucent views, so only for the solid fallback.
        { elevation: canBlur ? 0 : 6 };

  return (
    <Animated.View style={[{ borderRadius: radius }, shadow, style as StyleProp<ViewStyle>]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: withAlpha(c.muted, canBlur ? 0.26 : 0.18),
          },
        ]}
      >
        {canBlur && Blur && (
          <BlurBoundary onError={() => setFailed(true)}>
            <Blur
              blurTarget={ctx?.targetRef}
              blurMethod="dimezisBlurView"
              tint={c.isDark ? "dark" : "light"}
              intensity={intensity}
              style={StyleSheet.absoluteFill}
            />
          </BlurBoundary>
        )}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: withAlpha(
                c.header,
                canBlur ? (c.isDark ? 0.5 : 0.55) : 0.96,
              ),
            },
          ]}
        />
      </View>
      <View style={[{ borderRadius: radius, overflow: "hidden" }, contentStyle]}>
        {children}
      </View>
    </Animated.View>
  );
}
