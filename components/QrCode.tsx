import qrcode from "qrcode-generator";
import { memo, useMemo } from "react";
import Svg, { Path, Rect } from "react-native-svg";

/** QR-код на чистому JS (qrcode-generator) + react-native-svg: один Path на всі модулі. */
export const QrCode = memo(function QrCode({
  value,
  size,
  quiet = 2,
  level = "M",
}: {
  value: string;
  size: number;
  /** Біла рамка в модулях. */
  quiet?: number;
  /** Рівень виправлення помилок (Q/H — коли щось закриває центр, наприклад аватар). */
  level?: "L" | "M" | "Q" | "H";
}) {
  const { path, n } = useMemo(() => {
    const qr = qrcode(0, level);
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < count; r++) {
      let run = -1;
      for (let c = 0; c <= count; c++) {
        const dark = c < count && qr.isDark(r, c);
        if (dark && run < 0) run = c;
        if (!dark && run >= 0) {
          d += `M${run} ${r}h${c - run}v1h-${c - run}z`;
          run = -1;
        }
      }
    }
    return { path: d, n: count };
  }, [value, level]);

  const total = n + quiet * 2;
  return (
    <Svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${total} ${total}`}>
      <Rect x={-quiet} y={-quiet} width={total} height={total} fill="#FFFFFF" />
      <Path d={path} fill="#000000" />
    </Svg>
  );
});
