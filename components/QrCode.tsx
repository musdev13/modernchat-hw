import qrcode from "qrcode-generator";
import { memo, useMemo } from "react";
import Svg, { Path, Rect } from "react-native-svg";

/** QR-код на чистому JS (qrcode-generator) + react-native-svg: один Path на всі модулі. */
export const QrCode = memo(function QrCode({
  value,
  size,
  quiet = 2,
}: {
  value: string;
  size: number;
  /** Біла рамка в модулях. */
  quiet?: number;
}) {
  const { path, n } = useMemo(() => {
    const qr = qrcode(0, "M");
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
  }, [value]);

  const total = n + quiet * 2;
  return (
    <Svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${total} ${total}`}>
      <Rect x={-quiet} y={-quiet} width={total} height={total} fill="#FFFFFF" />
      <Path d={path} fill="#000000" />
    </Svg>
  );
});
