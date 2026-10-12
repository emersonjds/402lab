import fs from 'node:fs';
import opentype from 'opentype.js';

// Regenerates the SVG masters in docs/design/brand (fonts: JetBrains Mono 600 and Space Grotesk 700, OFL).
// Run: npm i --no-save opentype.js && node docs/design/brand/tools/gen.mjs
const OUT = process.argv[2] ?? new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const load = (f) => opentype.parse(fs.readFileSync(new URL(f, import.meta.url)).buffer);
const mono = load('./jbm600.ttf');
const grotesk = load('./sg700.ttf');

const LIME = '#B6F23A';
const INK = '#E8EAED';
const DARK = '#14171C';
const BORDER = '#262B33';
const LIME_DEEP = '#4D7C0F';
const r2 = (n) => Math.round(n * 100) / 100;

const FLASK = 'M27 13V27L15.5 47.5A4 4 0 0 0 19 53.5H45A4 4 0 0 0 48.5 47.5L37 27V13';
const LIP = 'M23 12.5H41';
const LIQUID = 'M0 39Q8 36 16 39T32 39T48 39T64 39V64H0Z';
const circle = (cx, cy, r) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
// flask visual bounds in the 64 grid at stroke 3.5
const FB = { x: 13.75, y: 10.75, w: 36.5, h: 44.5 };

let uid = 0;
// bubbles: 'color' fills dark bubbles, 'knockout' punches them through the liquid, null drops them
const flask = ({ stroke = INK, liquid = LIME, bubbles = DARK, top = LIME, sw = 3.5 } = {}) => {
  const id = `flask-inside-${++uid}`;
  const knock = bubbles === 'knockout';
  const liquidPath = knock ? `${LIQUID}${circle(28, 47, 2.4)}${circle(36, 43.5, 1.5)}` : LIQUID;
  return [
    `<defs><clipPath id="${id}"><path d="${FLASK}Z"/></clipPath></defs>`,
    `<g clip-path="url(#${id})">`,
    `<path d="${liquidPath}" fill="${liquid}"${knock ? ' fill-rule="evenodd"' : ''}/>`,
    bubbles && !knock
      ? `<circle cx="28" cy="47" r="2.4" fill="${bubbles}"/><circle cx="36" cy="43.5" r="1.5" fill="${bubbles}"/>`
      : '',
    `</g>`,
    top ? `<circle cx="34" cy="31" r="2.2" fill="${top}"/>` : '',
    `<path d="${FLASK}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`,
    `<path d="${LIP}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`,
  ].join('');
};

// "[402] Lab" in a local box starting at (0,0)
const DIGIT_SIZE = 46;
const LAB_SIZE = 58;
const PAD_X = 12;
const PAD_Y = 10.5;
const BOX_SW = 1.5;
const GAP = 16;
const roundRect = (x, y, w, h, r) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;

const wordmark = ({
  boxStroke = LIME,
  boxOpacity = 0.7,
  digits = LIME,
  lab = INK,
  solidBox = null,
}) => {
  const dProbe = mono.getPath('402', 0, 0, DIGIT_SIZE).getBoundingBox();
  const dw = dProbe.x2 - dProbe.x1;
  const dh = dProbe.y2 - dProbe.y1;
  const boxW = dw + 2 * PAD_X;
  const boxH = dh + 2 * PAD_Y;
  const o = BOX_SW / 2;
  const digitPath = mono
    .getPath('402', o + PAD_X - dProbe.x1, o + PAD_Y - dProbe.y1, DIGIT_SIZE)
    .toPathData(2);
  const lProbe = grotesk.getPath('Lab', 0, 0, LAB_SIZE).getBoundingBox();
  const lx = o * 2 + boxW + GAP;
  const ly = o + boxH / 2 - (lProbe.y2 - lProbe.y1) / 2;
  const labPath = grotesk.getPath('Lab', lx - lProbe.x1, ly - lProbe.y1, LAB_SIZE).toPathData(2);
  const box = solidBox
    ? `<path d="${roundRect(0, 0, boxW + BOX_SW, boxH + BOX_SW, 8 + o)}${digitPath}" fill="${solidBox}" fill-rule="evenodd"/>`
    : `<rect x="${o}" y="${o}" width="${r2(boxW)}" height="${r2(boxH)}" rx="8" fill="none" stroke="${boxStroke}" stroke-opacity="${boxOpacity}" stroke-width="${BOX_SW}"/><path d="${digitPath}" fill="${digits}"/>`;
  return {
    svg: `${box}<path d="${labPath}" fill="${lab}"/>`,
    w: lx + (lProbe.x2 - lProbe.x1),
    h: boxH + BOX_SW,
  };
};

const M = 8; // margin around every lockup
const doc = (w, h, body, label = '402Lab') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(w)} ${r2(h)}" width="${r2(w)}" height="${r2(h)}" role="img" aria-label="${label}">\n${body}\n</svg>\n`;
const placeFlask = (x, y, k, opts) =>
  `<g transform="translate(${r2(x - FB.x * k)} ${r2(y - FB.y * k)}) scale(${r2(k * 1000) / 1000})">${flask(opts)}</g>`;

const stacked = (f, w) => {
  const wm = wordmark(w);
  const k = 1.625;
  const fh = FB.h * k;
  const gap = 15;
  const W = wm.w + 2 * M;
  const H = fh + gap + wm.h + 2 * M;
  return doc(
    W,
    H,
    placeFlask(W / 2 - (FB.w * k) / 2, M, k, f) +
      `<g transform="translate(${M} ${r2(M + fh + gap)})">${wm.svg}</g>`,
  );
};
const horizontal = (f, w) => {
  const wm = wordmark(w);
  const fh = wm.h * 1.3;
  const k = fh / FB.h;
  const gap = 14;
  const W = FB.w * k + gap + wm.w + 2 * M;
  const H = fh + 2 * M;
  return doc(
    W,
    H,
    placeFlask(M, M, k, f) +
      `<g transform="translate(${r2(M + FB.w * k + gap)} ${r2(M + (fh - wm.h) / 2)})">${wm.svg}</g>`,
  );
};
const wordOnly = (w) => {
  const wm = wordmark(w);
  return doc(wm.w + 2 * M, wm.h + 2 * M, `<g transform="translate(${M} ${M})">${wm.svg}</g>`);
};
const markOnly = (f) => doc(FB.w + 4, FB.h + 4, placeFlask(2, 2, 1, f));
const tile = (f, size, k) => {
  const s = size / 64;
  const scale = s * k;
  return doc(
    size,
    size,
    `<rect x="${s}" y="${s}" width="${62 * s}" height="${62 * s}" rx="${14 * s}" fill="${DARK}" stroke="${BORDER}" stroke-width="${2 * s}"/>` +
      placeFlask(size / 2 - (FB.w * scale) / 2, size / 2 - (FB.h * scale) / 2, scale, f),
  );
};

const LIGHT_INK = '#14171C';
const dark = [{}, {}];
const light = [{ stroke: LIGHT_INK }, { boxStroke: LIME_DEEP, digits: LIME_DEEP, lab: LIGHT_INK }];
const one = (c) => [
  { stroke: c, liquid: c, bubbles: 'knockout', top: c },
  { lab: c, solidBox: c },
];
const print = [
  { stroke: '#FFFFFF', bubbles: 'knockout' },
  { boxStroke: LIME, boxOpacity: 1, digits: LIME, lab: '#FFFFFF' },
];

const files = {
  'logo-stacked-dark.svg': stacked(...dark),
  'logo-stacked-light.svg': stacked(...light),
  'logo-horizontal-dark.svg': horizontal(...dark),
  'logo-horizontal-light.svg': horizontal(...light),
  'logo-mark-flask.svg': markOnly({}),
  'logo-mark-simplified.svg': tile({ bubbles: null, sw: 4.5 }, 64, 1),
  'logo-mark-favicon.svg': tile({ bubbles: null, top: null, sw: 5.5 }, 64, 1.12),
  'favicon.svg': tile({ bubbles: null, top: null, sw: 5.5 }, 64, 1.12),
  'logo-mark-1color-white.svg': markOnly(one('#FFFFFF')[0]),
  'logo-mark-1color-black.svg': markOnly(one('#000000')[0]),
  'logo-stacked-1color-white.svg': stacked(...one('#FFFFFF')),
  'logo-stacked-1color-black.svg': stacked(...one('#000000')),
  'logo-print-2color.svg': stacked(...print),
  'logo-app-icon.svg': tile({}, 1024, (1024 * 0.62) / FB.h / 16),
  'wordmark-dark.svg': wordOnly(dark[1]),
  'wordmark-light.svg': wordOnly(light[1]),
};
for (const [name, svg] of Object.entries(files)) fs.writeFileSync(`${OUT}/${name}`, svg);
console.log(Object.keys(files).join('\n'));
