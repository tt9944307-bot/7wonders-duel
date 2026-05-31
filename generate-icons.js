/**
 * generate-icons.js — 7 Wonders Duel PWA icon generator
 * Design: large bold "7" + 5-colour card strip at bottom
 * Simple, high-contrast, reads well at 40–512px
 * Run: node generate-icons.js
 */
'use strict';
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC32 ───────────────────────────────────────────────────────────
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
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function png(W, H, rgba) {
  const row = 1 + W * 4;
  const raw = Buffer.alloc(H * row);
  for (let y = 0; y < H; y++) {
    raw[y * row] = 0;
    rgba.copy(raw, y * row + 1, y * W * 4, (y + 1) * W * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Canvas ──────────────────────────────────────────────────────────
function canvas(W, H) {
  const buf = Buffer.alloc(W * H * 4, 0);

  function blend(i, r, g, b, a) {
    const sa = a / 255, da = buf[i+3] / 255, oa = sa + da * (1 - sa);
    if (oa < 0.001) return;
    buf[i]   = ((r * sa + buf[i]   * da * (1-sa)) / oa) | 0;
    buf[i+1] = ((g * sa + buf[i+1] * da * (1-sa)) / oa) | 0;
    buf[i+2] = ((b * sa + buf[i+2] * da * (1-sa)) / oa) | 0;
    buf[i+3] = (oa * 255) | 0;
  }

  function px(x, y, r, g, b, a=255) {
    x=x|0; y=y|0;
    if (x<0||x>=W||y<0||y>=H) return;
    blend((y*W+x)*4, r, g, b, a);
  }

  function fillRect(x, y, w, h, r, g, b, a=255) {
    for (let py=Math.max(0,y|0); py<Math.min(H,(y+h)|0); py++)
      for (let px2=Math.max(0,x|0); px2<Math.min(W,(x+w)|0); px2++)
        blend((py*W+px2)*4, r, g, b, a);
  }

  function fillRounded(x, y, w, h, rad, r, g, b, a=255) {
    const rx=Math.min(rad,w/2,h/2);
    for (let py=(y|0); py<(y+h)|0; py++) {
      for (let px2=(x|0); px2<(x+w)|0; px2++) {
        if (py<0||py>=H||px2<0||px2>=W) continue;
        const dx=px2-x, dy=py-y;
        let ok=true;
        if (dx<rx&&dy<rx&&Math.hypot(dx-rx,dy-rx)>rx) ok=false;
        else if (dx>=w-rx&&dy<rx&&Math.hypot(dx-(w-rx),dy-rx)>rx) ok=false;
        else if (dx<rx&&dy>=h-rx&&Math.hypot(dx-rx,dy-(h-rx))>rx) ok=false;
        else if (dx>=w-rx&&dy>=h-rx&&Math.hypot(dx-(w-rx),dy-(h-rx))>rx) ok=false;
        if (ok) blend((py*W+px2)*4, r, g, b, a);
      }
    }
  }

  function radialGlow(cx, cy, maxR, r, g, b, maxA) {
    for (let py=Math.max(0,(cy-maxR)|0); py<Math.min(H,(cy+maxR+1)|0); py++)
      for (let px2=Math.max(0,(cx-maxR)|0); px2<Math.min(W,(cx+maxR+1)|0); px2++) {
        const d=Math.hypot(px2-cx,py-cy); if (d>=maxR) continue;
        const t=1-d/maxR; blend((py*W+px2)*4, r,g,b, Math.round(t*t*maxA));
      }
  }

  // Draw thick "7" using line segments
  function draw7(x, y, w, h, thick, r, g, b) {
    // Top horizontal bar
    fillRounded(x, y, w, thick, thick/2, r, g, b);
    // Diagonal: from (x+w-thick, y+thick) → (x+thick, y+h)
    const x0=x+w-thick, y0=y+thick, x1=x+thick, y1=y+h;
    const dx=x1-x0, dy=y1-y0, len=Math.hypot(dx,dy)||1;
    const nx=-dy/len, ny=dx/len;
    const steps=Math.ceil(len*2);
    for (let s=0;s<=steps;s++) {
      const t=s/steps, bx=x0+t*dx, by=y0+t*dy;
      for (let d=-thick/2;d<=thick/2;d++) px(bx+nx*d, by+ny*d, r,g,b);
    }
  }

  return { buf, px, fillRect, fillRounded, radialGlow, draw7,
           toPNG: ()=>png(W, H, buf) };
}

// ── Icon renderer ────────────────────────────────────────────────────
function drawIcon(SIZE) {
  const c = canvas(SIZE, SIZE);
  const { fillRect, fillRounded, radialGlow, draw7 } = c;
  const s = v => v * SIZE / 512;

  // ── Background gradient (dark warm stone) ──
  // Fill with darkest colour first, then add radial warm centre
  fillRounded(0, 0, SIZE, SIZE, s(80), 10, 8, 6);
  radialGlow(SIZE/2, SIZE*0.50, SIZE*0.65, 70, 42, 8, 180);  // warm amber centre
  radialGlow(SIZE/2, SIZE*0.25, SIZE*0.45, 20, 14, 4, 100);  // slight top glow

  // ── Gold glow behind "7" ──
  radialGlow(SIZE/2, SIZE*0.44, SIZE*0.45, 224, 180, 40, 55);

  // ── Giant "7" ──
  // Positioned: top at ~8%, bottom at ~76%, centred
  const n7x = s(108), n7y = s(38), n7w = s(296), n7h = s(340), n7t = s(52);
  draw7(n7x, n7y, n7w, n7h, n7t, 232, 190, 44);

  // ── Gold separator line (side margin keeps it away from corners) ──
  fillRect(s(24), s(398), SIZE-s(48), s(4), 232, 190, 44, 200);

  // ── 5-card strip ──
  // y=406..480 (74px tall), x=24..488 (464px wide)
  // 5 cards × 88px + 4 gaps × 6px = 464px
  // At y=480, rx=80 safe range: [16, 496] — cards [24,488] safely inside ✓
  const cardY = s(406), cardH = s(74), cardR = s(10);
  const cStart = s(24), cW = s(88), cGap = s(6);
  const cardDefs = [
    [200, 104,  48],  // orange-brown
    [ 30, 106, 184],  // blue
    [ 26, 144,  72],  // green
    [192,  34,  34],  // red
    [120,  40, 192],  // purple
  ];
  cardDefs.forEach(([r, g, b], i) => {
    const x = cStart + i * (cW + cGap);
    fillRounded(x, cardY, cW, cardH, cardR, r, g, b);
    // top highlight
    fillRounded(x, cardY, cW, s(20), cardR, 255, 255, 255, 55);
    // border
    for (let d = 0; d < 2; d++)
      fillRounded(x+d, cardY+d, cW-d*2, cardH-d*2, cardR, 255, 255, 255, 35);
  });

  // ── Outer border ──
  for (let d=2;d<=5;d++)
    fillRounded(d, d, SIZE-d*2, SIZE-d*2, s(80)-d, 220, 168, 40, 28);

  return c.toPNG();
}

// ── Generate ─────────────────────────────────────────────────────────
const outDir = path.join(__dirname, 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
console.log('Generating icons…');
for (const size of [192, 512]) {
  const buf = drawIcon(size);
  const out = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(out, buf);
  console.log(`  ✓ icons/icon-${size}.png  (${buf.length.toLocaleString()} bytes)`);
}
console.log('Done!');
