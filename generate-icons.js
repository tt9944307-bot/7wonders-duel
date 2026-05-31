/**
 * generate-icons.js
 * Generates PNG icons for the 7 Wonders Duel PWA
 * Uses only Node.js built-ins (zlib, fs) — no external packages needed
 *
 * Run: node generate-icons.js
 */
'use strict';
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC32 ──────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG builder ────────────────────────────────────────────────────
function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  // Build raw rows: filter byte (0) + RGBA per pixel
  const row = 1 + width * 4;
  const raw = Buffer.alloc(height * row);
  for (let y = 0; y < height; y++) {
    raw[y * row] = 0; // filter: None
    rgba.copy(raw, y * row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]), // signature
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Drawing helpers ────────────────────────────────────────────────
function createCanvas(W, H) {
  const buf = Buffer.alloc(W * H * 4, 0);

  function px(x, y, r, g, b, a = 255) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 4;
    // alpha blend over existing
    const srcA = a / 255, dstA = buf[i+3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA < 0.001) return;
    buf[i]   = Math.round((r * srcA + buf[i]   * dstA * (1-srcA)) / outA);
    buf[i+1] = Math.round((g * srcA + buf[i+1] * dstA * (1-srcA)) / outA);
    buf[i+2] = Math.round((b * srcA + buf[i+2] * dstA * (1-srcA)) / outA);
    buf[i+3] = Math.round(outA * 255);
  }

  function fillRect(x, y, w, h, r, g, b, a = 255) {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        px(x+dx, y+dy, r, g, b, a);
  }

  function fillRounded(x, y, w, h, rad, r, g, b, a = 255) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const cx = dx < rad ? rad : (dx >= w-rad ? w-rad-1 : dx);
        const cy = dy < rad ? rad : (dy >= h-rad ? h-rad-1 : dy);
        const dx2 = dx - cx, dy2 = dy - cy;
        if (dx < rad && dy < rad && Math.sqrt(dx2*dx2+dy2*dy2) > rad) continue;
        if (dx >= w-rad && dy < rad && Math.sqrt(dx2*dx2+dy2*dy2) > rad) continue;
        if (dx < rad && dy >= h-rad && Math.sqrt(dx2*dx2+dy2*dy2) > rad) continue;
        if (dx >= w-rad && dy >= h-rad && Math.sqrt(dx2*dx2+dy2*dy2) > rad) continue;
        px(x+dx, y+dy, r, g, b, a);
      }
    }
  }

  // Thick line (Bresenham + width)
  function line(x0, y0, x1, y1, thick, r, g, b, a=255) {
    const dx = x1-x0, dy = y1-y0, len = Math.sqrt(dx*dx+dy*dy);
    const nx = -dy/len, ny = dx/len; // normal
    const steps = Math.ceil(len * 1.5);
    for (let s = 0; s <= steps; s++) {
      const t = s/steps;
      const bx = x0 + t*dx, by = y0 + t*dy;
      for (let d = -thick/2; d <= thick/2; d++) {
        px(bx + nx*d, by + ny*d, r, g, b, a);
      }
    }
  }

  // Radial glow (blended onto existing pixels)
  function radialGlow(cx, cy, maxR, r, g, b, maxA) {
    const x0 = Math.max(0, Math.floor(cx-maxR));
    const x1 = Math.min(W-1, Math.ceil(cx+maxR));
    const y0 = Math.max(0, Math.floor(cy-maxR));
    const y1 = Math.min(H-1, Math.ceil(cy+maxR));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.sqrt((x-cx)**2+(y-cy)**2);
        if (d >= maxR) continue;
        const t = 1 - d/maxR;
        px(x, y, r, g, b, Math.round(t*t*maxA));
      }
    }
  }

  return { buf, px, fillRect, fillRounded, line, radialGlow,
           toPNG: () => encodePNG(W, H, buf) };
}

// ── Icon drawing ───────────────────────────────────────────────────
function drawIcon(size) {
  const c = createCanvas(size, size);
  const S = size / 512; // scale all coords

  const s  = (v) => Math.round(v * S);
  const { fillRect, fillRounded, line, radialGlow, px } = c;

  // ─ Background (dark stone, fully opaque) ─
  fillRounded(0, 0, size, size, s(88), 14, 10, 6);

  // ─ Warm radial glow from bottom-center ─
  radialGlow(size*0.5, size*0.72, size*0.58, 80, 52, 8, 100);

  // ─ Card dimensions ─
  const CW = s(68), CH = s(96), RX = s(7);

  // Bottom row (3 face-up colored cards)
  const by = s(300);
  const bx = [s(132), s(218), s(304)];
  const colors = [[180, 90, 40], [22, 88, 158], [20, 108, 54]];
  const lights  = [[220,150,90],  [80,148,230],  [55,175,100]];
  colors.forEach(([r,g,b], i) => {
    fillRounded(bx[i], by, CW, CH, RX, r, g, b);
    // Top highlight bar
    fillRounded(bx[i], by, CW, s(18), RX, lights[i][0], lights[i][1], lights[i][2], 200);
    // Two label lines
    fillRect(bx[i]+s(8), by+s(28), s(32), s(6), 255, 255, 255, 90);
    fillRect(bx[i]+s(8), by+s(40), s(22), s(5), 255, 255, 255, 60);
    // Card border
    for (let d = 0; d < 2; d++)
      fillRounded(bx[i]+d, by+d, CW-d*2, CH-d*2, RX, 255, 255, 255, 30);
  });

  // Middle row (2 face-down dark cards)
  const my = s(208);
  const mx = [s(175), s(261)];
  mx.forEach(x => {
    fillRounded(x, my, CW, CH, RX, 13, 22, 40);
    // Hatching lines (horizontal)
    for (let n = 0; n < 5; n++)
      fillRect(x+s(8), my+s(18+n*14), CW-s(16), s(5), 25, 45, 72, 120);
    // Border
    fillRounded(x, my, CW, CH, RX, 30, 55, 90, 120);
  });

  // Top card (apex, face-down)
  const ty = s(116), tx = s(218);
  fillRounded(tx, ty, CW, CH, RX, 10, 16, 32);
  for (let n = 0; n < 5; n++)
    fillRect(tx+s(8), ty+s(18+n*14), CW-s(16), s(5), 22, 38, 65, 110);
  fillRounded(tx, ty, CW, CH, RX, 25, 45, 80, 100);

  // ─ Gold accent line below pyramid ─
  for (let x = 0; x < size; x++) {
    const t = Math.sin(Math.PI * x / size);
    const a = Math.round(t * 180);
    if (a > 5) fillRect(x, s(410), 1, s(2), 224, 180, 40, a);
  }

  // ─ "7" numeral (thick strokes) ─
  // Position: top-center
  const nx = s(196), ny = s(30), nw = s(120), nh = s(78), nT = s(16);
  const gold = [224, 180, 40];

  // Top bar of "7"
  fillRounded(nx, ny, nw, nT, s(4), ...gold);

  // Diagonal stroke: from (nx+nw-nT, ny+nT) down to (nx+nT*2, ny+nh)
  line(nx+nw-nT/2, ny+nT, nx+nT*2, ny+nh, nT, ...gold);

  // Glow behind the "7"
  radialGlow(nx+nw/2, ny+nh/2, s(90), 224, 180, 40, 40);

  // ─ Subtle gold border ─
  for (let d = 2; d <= 4; d++)
    fillRounded(d, d, size-d*2, size-d*2, s(88)-d, 200, 160, 40, 35);

  return c.toPNG();
}

// ── Generate & save ────────────────────────────────────────────────
const outDir = path.join(__dirname, 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

console.log('Generating icons…');

for (const size of [192, 512]) {
  const png = drawIcon(size);
  const out = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`  ✓ icons/icon-${size}.png  (${png.length} bytes)`);
}

console.log('Done!');
