/**
 * generate-icons.js  —  7 Wonders Duel PWA icon generator
 * Uses only Node.js built-ins (zlib, fs). Run: node generate-icons.js
 *
 * Design: full-width pyramid of cards (lobby SVG compressed into square icon)
 *   Bottom: 5 colored cards (orange-brown, blue, green, red, purple)
 *   Middle: 4 face-down dark cards
 *   Top:    2 face-down darkest cards
 *   "7" numeral above, gold glow bar below, warm background glow
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

function makeChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function encodePNG(W, H, rgba) {
  const row = 1 + W * 4;
  const raw = Buffer.alloc(H * row);
  for (let y = 0; y < H; y++) {
    raw[y * row] = 0;
    rgba.copy(raw, y * row + 1, y * W * 4, (y+1) * W * 4);
  }
  const comp = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8]=8; ihdr[9]=6;
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', comp),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Canvas helpers ────────────────────────────────────────────────
function makeCanvas(W, H) {
  const buf = Buffer.alloc(W * H * 4, 0);

  function blend(i, r, g, b, a) {
    const sa = a / 255, da = buf[i+3] / 255;
    const oa = sa + da * (1 - sa);
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
    const x1=Math.max(0,x|0), y1=Math.max(0,y|0);
    const x2=Math.min(W,x1+(w|0)), y2=Math.min(H,y1+(h|0));
    for (let py=y1; py<y2; py++)
      for (let px2=x1; px2<x2; px2++)
        blend((py*W+px2)*4, r, g, b, a);
  }

  function fillRounded(x, y, w, h, rad, r, g, b, a=255) {
    const x0=x|0, y0=y|0, x1=x0+(w|0), y1=y0+(h|0);
    const rx=Math.min(rad, w/2, h/2);
    for (let py=y0; py<y1; py++) {
      for (let px2=x0; px2<x1; px2++) {
        const dx = px2-x0, dy = py-y0;
        let inside = true;
        if (dx<rx && dy<rx && Math.hypot(dx-rx, dy-rx)>rx) inside=false;
        else if (dx>=w-rx && dy<rx && Math.hypot(dx-(w-rx), dy-rx)>rx) inside=false;
        else if (dx<rx && dy>=h-rx && Math.hypot(dx-rx, dy-(h-rx))>rx) inside=false;
        else if (dx>=w-rx && dy>=h-rx && Math.hypot(dx-(w-rx), dy-(h-rx))>rx) inside=false;
        if (inside) blend((py*W+px2)*4, r, g, b, a);
      }
    }
  }

  function hLine(x, y, w, r, g, b, a=255) {
    fillRect(x, y, w, 1, r, g, b, a);
  }

  function radialGlow(cx, cy, maxR, r, g, b, maxA) {
    const bx=Math.max(0,(cx-maxR)|0), by=Math.max(0,(cy-maxR)|0);
    const ex=Math.min(W,(cx+maxR+1)|0), ey=Math.min(H,(cy+maxR+1)|0);
    for (let py=by; py<ey; py++) {
      for (let px2=bx; px2<ex; px2++) {
        const d = Math.hypot(px2-cx, py-cy);
        if (d >= maxR) continue;
        const t = 1 - d/maxR;
        blend((py*W+px2)*4, r, g, b, Math.round(t*t*maxA));
      }
    }
  }

  function thickLine(x0,y0,x1,y1,thick,r,g,b,a=255) {
    const dx=x1-x0, dy=y1-y0, len=Math.hypot(dx,dy)||1;
    const nx=-dy/len, ny=dx/len;
    const steps=Math.ceil(len*2)+1;
    for (let s=0;s<=steps;s++) {
      const t=s/steps, bx2=x0+t*dx, by2=y0+t*dy;
      for (let d=-thick/2;d<=thick/2;d++)
        px(bx2+nx*d, by2+ny*d, r,g,b,a);
    }
  }

  return { buf, px, fillRect, fillRounded, hLine, radialGlow, thickLine,
           toPNG: ()=>encodePNG(W, H, buf) };
}

// ── Icon drawing ──────────────────────────────────────────────────
function drawIcon(SIZE) {
  const c = makeCanvas(SIZE, SIZE);
  const { px, fillRect, fillRounded, hLine, radialGlow, thickLine } = c;
  const S = SIZE / 512;
  const s = v => v * S;

  // ─ Background ─
  fillRounded(0, 0, SIZE, SIZE, s(90), 14, 10, 6);

  // ─ Warm glow from bottom-center ─
  radialGlow(SIZE*0.5, SIZE*0.78, SIZE*0.68, 90, 48, 8, 130);
  // ─ Cool dark glow from top ─
  radialGlow(SIZE*0.5, SIZE*0.15, SIZE*0.50, 8, 18, 38, 90);

  // ─ Pyramid geometry (source 260×86, scale=1.815, x+20, y_base=178) ─
  // Scaled: cw=80, gap_stride=98, ry=65
  // Bottom row y=269, middle y=223, top y=178
  const cw=s(80), ch=s(65), rx=s(7);
  const yTop=s(178), yMid=s(223), yBot=s(269);

  // ─ TOP ROW — 2 darkest face-down ─
  const topXs = [s(167), s(265)];
  topXs.forEach(x => {
    fillRounded(x, yTop, cw, ch, rx, 8, 14, 28);
    hLine(x+s(8), yTop+s(14), cw-s(16), 18, 46, 80, 200);
    hLine(x+s(8), yTop+s(27), cw-s(16), 18, 46, 80, 160);
    hLine(x+s(8), yTop+s(40), cw-s(16), 18, 46, 80, 130);
    // border
    for(let d=0;d<2;d++) fillRounded(x+d,yTop+d,cw-d*2,ch-d*2,rx,26,45,80,80);
  });

  // ─ MIDDLE ROW — 4 face-down ─
  const midXs = [s(69), s(167), s(265), s(363)];
  midXs.forEach(x => {
    fillRounded(x, yMid, cw, ch, rx, 14, 24, 40);
    hLine(x+s(8), yMid+s(13), cw-s(16), 28, 50, 80, 200);
    hLine(x+s(8), yMid+s(26), cw-s(16), 28, 50, 80, 160);
    hLine(x+s(8), yMid+s(39), cw-s(16), 28, 50, 80, 130);
    for(let d=0;d<2;d++) fillRounded(x+d,yMid+d,cw-d*2,ch-d*2,rx,30,58,95,90);
  });

  // ─ BOTTOM ROW — 5 colored face-up ─
  const botXs = [s(20), s(118), s(216), s(314), s(412)];
  const cardColors = [
    [192, 104, 48,  255,200,140],  // orange-brown + light
    [ 30, 104, 180, 120,190,255],  // blue
    [ 26, 136,  66, 120,240,160],  // green
    [184,  34,  34, 255,130,130],  // red
    [112,  34, 176, 200,130,255],  // purple
  ];
  botXs.forEach((x, i) => {
    const [r,g,b, lr,lg,lb] = cardColors[i];
    fillRounded(x, yBot, cw, ch, rx, r, g, b);
    // top highlight bar
    fillRounded(x, yBot, cw, s(16), rx, lr, lg, lb, 80);
    // label lines
    fillRect(x+s(8), yBot+s(28), s(40), s(7), 255,255,255, 100);
    fillRect(x+s(8), yBot+s(41), s(28), s(6), 255,255,255,  65);
    // border
    for(let d=0;d<2;d++) fillRounded(x+d,yBot+d,cw-d*2,ch-d*2,rx, lr,lg,lb, 70);
  });

  // ─ Gold glow & bar below pyramid ─
  radialGlow(SIZE*0.5, s(354), SIZE*0.44, 224, 180, 40, 55);
  for (let x=0; x<SIZE; x++) {
    const t = Math.sin(Math.PI * x / SIZE);
    if (t > 0.05) fillRect(x, s(352), 1, s(3), 224, 180, 40, Math.round(t*180));
  }

  // ─ "7" numeral using thick strokes ─
  // Top-center: horizontal bar + diagonal
  const nx=s(192), ny=s(28), nw=s(128), nh=s(84), nT=s(18);
  // glow
  radialGlow(nx+nw/2, ny+nh/2, s(100), 224, 180, 40, 48);
  // top bar
  fillRounded(nx, ny, nw, nT, s(5), 236, 192, 48);
  // diagonal: from top-right to bottom-left
  thickLine(nx+nw-nT/2, ny+nT, nx+nT*1.5, ny+nh, nT, 236, 192, 48);

  // ─ "WD" small text approximation (simple dot marker) ─
  // Just a subtle line accent
  const wy = s(416);
  for (let x = 0; x < SIZE; x++) {
    const t = Math.sin(Math.PI * (x - SIZE*0.3) / (SIZE*0.4));
    if (t > 0) fillRect(x, wy, 1, 1, 200, 160, 40, Math.round(t * 55));
  }

  // ─ Border ─
  for (let d=2; d<=5; d++)
    fillRounded(d, d, SIZE-d*2, SIZE-d*2, s(90)-d, 200, 155, 40, 28);

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
  console.log(`  ✓ icons/icon-${size}.png  (${png.length.toLocaleString()} bytes)`);
}
console.log('Done!');
