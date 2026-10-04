// Генерує PNG-ресурси застосунку з єдиної геометрії логотипа (constants/logo.json).
//
// Запуск:   node scripts/generate-logo.mjs            — оновити assets/images/*
//           node scripts/generate-logo.mjs --preview /шлях/preview.png   — лише превʼю знака й слівмарка
//
// Потрібен devDependency @resvg/resvg-js (npm i -D @resvg/resvg-js): це лише інструмент збірки ресурсів,
// у застосунок він не потрапляє, нативного коду не додає.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "constants", "logo.json"), "utf8"));

let Resvg;
try {
  ({ Resvg } = await import("@resvg/resvg-js"));
} catch {
  console.error("Не знайдено @resvg/resvg-js. Встановіть: npm i -D @resvg/resvg-js");
  process.exit(1);
}

const WHITE = "#FFFFFF";
const BLACK = "#000000";

const png = (svg, width) =>
  new Resvg(svg, { fitTo: { mode: "width", value: width }, font: { loadSystemFonts: false } }).render().asPng();

/** Знак у квадраті 100×100. */
const markPaths = (fill) => data.mark.pieces.map((d) => `<path d="${d}" fill="${fill}"/>`).join("");

/** Полотно size×size: фон (або прозорий), необовʼязкове світіння, знак займає `scale` від сторони. */
function canvasSvg({ size, bg, fill = WHITE, scale, glow }) {
  const s = size * scale;
  const off = (size - s) / 2;
  const k = s / data.mark.viewBox;
  const rgb = glow ? glow.replace("#", "").match(/../g).map((h) => parseInt(h, 16)).join(",") : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${glow ? `<defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="rgb(${rgb})" stop-opacity="0.30"/><stop offset="1" stop-color="rgb(${rgb})" stop-opacity="0"/></radialGradient></defs>` : ""}
${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ""}
${glow ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.46}" fill="url(#g)"/>` : ""}
<g transform="translate(${off} ${off}) scale(${k})">${markPaths(fill)}</g>
</svg>`;
}

/** Слівмарк: ті самі штрихи, що й у components/Logo.tsx. */
function wordmarkSvg({ width, fill = WHITE, bg }) {
  const WM = data.wordmark;
  let x = 0;
  let d = "";
  const chars = WM.text.split("");
  chars.forEach((ch, idx) => {
    if (ch === " ") {
      x += WM.space - WM.tracking;
      return;
    }
    const def = WM.letters[ch];
    for (const sp of def.paths) {
      sp.pts.forEach((p, i) => {
        d += `${i === 0 ? "M" : "L"}${(p[0] + x).toFixed(2)} ${p[1]} `;
      });
      if (sp.closed) d += "Z ";
    }
    x += def.w;
    if (idx < chars.length - 1) x += WM.tracking;
  });
  const pad = WM.stroke;
  const vbW = x + pad;
  const vbH = WM.height + pad;
  const height = Math.round((width * vbH) / vbW);
  return {
    height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${-pad / 2} ${-pad / 2} ${vbW} ${vbH}">
${bg ? `<rect x="${-pad / 2}" y="${-pad / 2}" width="${vbW}" height="${vbH}" fill="${bg}"/>` : ""}
<path d="${d.trim()}" fill="none" stroke="${fill}" stroke-width="${WM.stroke}" stroke-linejoin="miter" stroke-linecap="butt"/></svg>`,
  };
}

const args = process.argv.slice(2);
const previewIdx = args.indexOf("--preview");

if (previewIdx !== -1) {
  const out = args[previewIdx + 1] ?? "logo-preview.png";
  const W = 1200;
  const H = 900;
  const mark = canvasSvg({ size: 520, bg: null, scale: 0.72, glow: "#B8D0E8" });
  const wm = wordmarkSvg({ width: 900, bg: null });
  const markB64 = Buffer.from(png(mark, 520)).toString("base64");
  const wmB64 = Buffer.from(png(wm.svg, 900)).toString("base64");
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="#000"/>
<image x="${(W - 520) / 2}" y="60" width="520" height="520" href="data:image/png;base64,${markB64}"/>
<image x="${(W - 900) / 2}" y="${620}" width="900" height="${wm.height}" href="data:image/png;base64,${wmB64}"/>
</svg>`;
  fs.writeFileSync(out, png(sheet, W));
  console.log("Превʼю:", out);
  process.exit(0);
}

const img = path.join(root, "assets", "images");
const icons = path.join(img, "icons");
fs.mkdirSync(icons, { recursive: true });

const write = (file, buf) => {
  fs.writeFileSync(file, buf);
  console.log("  ✓", path.relative(root, file));
};

// Кольори збірок: release — білий знак; dev — ціан; preview — бурштин (щоб відрізняти іконки на екрані).
const variants = [
  { dir: img, icon: "icon.png", fg: "android-icon-foreground.png", fill: WHITE, glow: "#B8D0E8" },
  { dir: icons, icon: "icon-dev.png", fg: "android-icon-foreground-dev.png", fill: "#19D3FF", glow: "#19D3FF" },
  { dir: icons, icon: "icon-preview.png", fg: "android-icon-foreground-preview.png", fill: "#FFB020", glow: "#FFB020" },
];

for (const v of variants) {
  // Іконка (iOS/legacy): чорний фон без прозорості.
  write(path.join(v.dir, v.icon), png(canvasSvg({ size: 1024, bg: BLACK, fill: v.fill, scale: 0.56, glow: v.glow }), 1024));
  // Adaptive foreground: знак у безпечній зоні (діагональ ≤ 66% полотна), фон прозорий.
  write(path.join(v.dir, v.fg), png(canvasSvg({ size: 1024, bg: null, fill: v.fill, scale: 0.46 }), 1024));
}

write(path.join(img, "android-icon-background.png"), png(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${BLACK}"/></svg>`, 1024));
write(path.join(img, "android-icon-monochrome.png"), png(canvasSvg({ size: 1024, bg: null, fill: BLACK, scale: 0.46 }), 1024));
write(path.join(img, "splash-icon.png"), png(canvasSvg({ size: 1024, bg: null, fill: WHITE, scale: 0.8 }), 1024));
write(path.join(img, "favicon.png"), png(canvasSvg({ size: 256, bg: BLACK, fill: WHITE, scale: 0.7 }), 48));
// Іконка сповіщення Android: біла на прозорому (система сама фарбує).
write(path.join(img, "notification-icon.png"), png(canvasSvg({ size: 256, bg: null, fill: WHITE, scale: 0.86 }), 96));
console.log("Готово.");
