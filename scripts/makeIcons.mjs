// Genera los iconos de la app (pixel art propio: una Poké Ball genérica sobre #172036) sin dependencias.
// Uso: node scripts/makeIcons.mjs  ->  public/icon-192.png, icon-512.png, apple-touch-icon.png (180)
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const G = 32; // rejilla lógica 32x32
const BG = [0x17, 0x20, 0x36];
const OUT = [0x10, 0x18, 0x28];
const RED = [0xe0, 0x3c, 0x3c];
const RED_HI = [0xff, 0x7a, 0x6a];
const WHITE = [0xf0, 0xf0, 0xe8];
const GREY = [0xb8, 0xc0, 0xd0];

function pixel(x, y) {
  const cx = x + 0.5 - G / 2;
  const cy = y + 0.5 - G / 2;
  const d = Math.hypot(cx, cy);
  if (d > 11.5) return BG;
  if (d > 10.2) return OUT;
  const dc = d; // botón central
  if (dc <= 2.2) return WHITE;
  if (dc <= 3.4) return OUT;
  if (Math.abs(cy) <= 1.2) return OUT; // banda
  if (cy < 0) return cx < -3.5 && cy < -4 && d > 5 && d < 9 && cx + cy < -9.5 ? RED_HI : RED;
  return cx > 3 && cy > 4 && d < 9 ? GREY : WHITE;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(Math.floor((x * G) / size), Math.floor((y * G) / size));
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 bits
  ihdr[9] = 2; // RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), png(size));
  console.log('escrito public/' + name);
}
