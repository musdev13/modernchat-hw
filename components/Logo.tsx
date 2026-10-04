import logoData from "@/constants/logo.json";
import { useChatPalette } from "@/hooks/useChatPalette";
import { memo, useEffect, useMemo } from "react";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from "react-native-svg";

/**
 * Оригінальний логотип: монограма «M», розрізана діагональною «щілиною» (дві грані розрізу
 * утворюють V), правий нижній кут зрізаний як хвостик чат-бульбашки. Суцільні прямі лінії,
 * жодних кривих. Слівмарк «MODERN CHAT» намальований тими ж прямими штрихами (не залежить від шрифтів).
 * Геометрія — у constants/logo.json (її ж читає scripts/generate-logo.mjs).
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Pt = [number, number];
interface LetterDef {
  w: number;
  paths: { pts: Pt[]; closed: boolean }[];
}

const WM = logoData.wordmark;
const LETTERS = WM.letters as unknown as Record<string, LetterDef>;

function subLength(pts: Pt[], closed: boolean): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  if (closed && pts.length > 1) {
    len += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  }
  return len;
}

interface PlacedLetter {
  d: string;
  /** Найдовший підшлях (для stroke-dasharray). */
  len: number;
}

/** Розкладка слівмарка: шляхи літер зі зсувом по X і повна ширина в одиницях сітки. */
function layoutWordmark(): { letters: PlacedLetter[]; width: number } {
  const out: PlacedLetter[] = [];
  let x = 0;
  const chars = WM.text.split("");
  chars.forEach((ch, idx) => {
    if (ch === " ") {
      x += WM.space - WM.tracking;
      return;
    }
    const def = LETTERS[ch];
    if (!def) return;
    let d = "";
    let longest = 0;
    for (const sp of def.paths) {
      sp.pts.forEach((p, i) => {
        d += `${i === 0 ? "M" : "L"}${(p[0] + x).toFixed(2)} ${p[1].toFixed(2)} `;
      });
      if (sp.closed) d += "Z ";
      longest = Math.max(longest, subLength(sp.pts, sp.closed));
    }
    out.push({ d: d.trim(), len: Math.ceil(longest) + 1 });
    x += def.w;
    if (idx < chars.length - 1) x += WM.tracking;
  });
  return { letters: out, width: x };
}

const LAYOUT = layoutWordmark();

export type LogoVariant = "mark" | "wordmark";
export type LogoTone = "white" | "text" | "accent";

export interface LogoProps {
  /** mark — квадрат size×size; wordmark — size це ширина, висота обчислюється. */
  size?: number;
  /** Явний колір; без нього береться tone. */
  color?: string;
  /** Колір із теми: білий (за замовчуванням), текст теми або акцент. */
  tone?: LogoTone;
  variant?: LogoVariant;
  /** Тихе м'яке світіння за знаком (колір світіння). Лише для mark. */
  glow?: string;
  /** Анімація появи на UI-потоці: грані знака проявляються по черзі, літери «домальовуються». */
  animated?: boolean;
  /** Затримка старту анімації, мс. */
  delay?: number;
}

function useLogoColor(color: string | undefined, tone: LogoTone): string {
  const c = useChatPalette();
  if (color) return color;
  if (tone === "text") return c.text;
  if (tone === "accent") return c.accent;
  return "#FFFFFF";
}

function rgbOf(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "255,255,255";
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
}

function useProgress(animated: boolean, delay: number, duration: number) {
  const p = useSharedValue(animated ? 0 : 1);
  useEffect(() => {
    if (!animated) {
      p.value = 1;
      return;
    }
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
  }, [animated, delay, duration, p]);
  return p;
}

const MarkPiece = memo(function MarkPiece({
  d,
  fill,
  index,
  count,
  progress,
}: {
  d: string;
  fill: string;
  index: number;
  count: number;
  progress: { value: number };
}) {
  const props = useAnimatedProps(() => {
    // Грані з'являються послідовно: кожна займає свою частину прогресу з перекриттям.
    const span = 1 / count + 0.35;
    const start = (index / count) * (1 - 0.35);
    const t = Math.min(1, Math.max(0, (progress.value - start) / span));
    return { opacity: t };
  });
  return <AnimatedPath d={d} fill={fill} animatedProps={props} />;
});

function Mark({ size, color, glow, animated, delay }: Required<Pick<LogoProps, "size" | "animated" | "delay">> & { color: string; glow?: string }) {
  const progress = useProgress(animated, delay, 1100);
  const pieces = logoData.mark.pieces;
  const vb = logoData.mark.viewBox;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`}>
      {glow ? (
        <>
          <Defs>
            <RadialGradient id="logoGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={`rgb(${rgbOf(glow)})`} stopOpacity="0.38" />
              <Stop offset="1" stopColor={`rgb(${rgbOf(glow)})`} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={vb / 2} cy={vb / 2} r={vb / 2} fill="url(#logoGlow)" />
        </>
      ) : null}
      <G>
        {pieces.map((d, i) =>
          animated ? (
            <MarkPiece key={i} d={d} fill={color} index={i} count={pieces.length} progress={progress} />
          ) : (
            <Path key={i} d={d} fill={color} />
          ),
        )}
      </G>
    </Svg>
  );
}

const WordLetter = memo(function WordLetter({
  letter,
  index,
  total,
  color,
  progress,
}: {
  letter: PlacedLetter;
  index: number;
  total: number;
  color: string;
  progress: { value: number };
}) {
  const len = letter.len;
  const props = useAnimatedProps(() => {
    // Літери домальовуються хвилею зліва направо (кожна ~4 літери «завширшки» у часі).
    const t = Math.min(1, Math.max(0, (progress.value * (total + 4) - index) / 4));
    return { strokeDashoffset: len * (1 - t), opacity: Math.min(1, t * 3) };
  });
  return (
    <AnimatedPath
      d={letter.d}
      stroke={color}
      strokeWidth={WM.stroke}
      strokeLinejoin="miter"
      strokeLinecap="butt"
      fill="none"
      strokeDasharray={[len, len]}
      animatedProps={props}
    />
  );
});

function Wordmark({ size, color, animated, delay }: Required<Pick<LogoProps, "size" | "animated" | "delay">> & { color: string }) {
  const progress = useProgress(animated, delay, 1500);
  const pad = WM.stroke;
  const vbW = LAYOUT.width + pad;
  const vbH = WM.height + pad;
  const height = (size * vbH) / vbW;
  const letters = useMemo(() => LAYOUT.letters, []);
  return (
    <Svg width={size} height={height} viewBox={`${-pad / 2} ${-pad / 2} ${vbW} ${vbH}`}>
      {letters.map((l, i) =>
        animated ? (
          <WordLetter key={i} letter={l} index={i} total={letters.length} color={color} progress={progress} />
        ) : (
          <Path
            key={i}
            d={l.d}
            stroke={color}
            strokeWidth={WM.stroke}
            strokeLinejoin="miter"
            strokeLinecap="butt"
            fill="none"
          />
        ),
      )}
    </Svg>
  );
}

/** Логотип застосунку: знак або слівмарк. Колір — білий за замовчуванням або з теми. */
export function Logo({
  size = 96,
  color,
  tone = "white",
  variant = "mark",
  glow,
  animated = false,
  delay = 0,
}: LogoProps) {
  const fill = useLogoColor(color, tone);
  return variant === "mark" ? (
    <Mark size={size} color={fill} glow={glow} animated={animated} delay={delay} />
  ) : (
    <Wordmark size={size} color={fill} animated={animated} delay={delay} />
  );
}
