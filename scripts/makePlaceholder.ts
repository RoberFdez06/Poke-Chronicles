// Dibuja public/data/offline/placeholder.png: una Poké Ball de 32×32 para los Pokémon "sustitutos" sin conexión
// (T42). PNG hecho a mano con zlib de node, sin dependencias.
//   node scripts/makePlaceholder.ts   (también lo llama buildOffline.ts)
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';

const S = 32;
type RGBA = [number, number, number, number];
const pixel = (x: number, y: number): RGBA => {
  const dx = x + 0.5 - S / 2;
  const dy = y + 0.5 - S / 2;
  const d = Math.hypot(dx, dy);
  if (d > 13) return [0, 0, 0, 0];
  if (d > 11.5) return [29, 40, 72, 255]; // borde
  if (d < 3) return [248, 248, 240, 255]; // botón
  if (d < 4.6) return [29, 40, 72, 255];
  if (Math.abs(dy) < 1.4) return [29, 40, 72, 255]; // franja
  return dy < 0 ? [229, 57, 53, 255] : [248, 248, 240, 255];
};

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

export async function makePlaceholder(out = 'public/data/offline/placeholder.png') {
  const raw = Buffer.alloc(S * (S * 4 + 1));
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0; // sin filtro
    for (let x = 0; x < S; x++) Buffer.from(pixel(x, y)).copy(raw, y * (S * 4 + 1) + 1 + x * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; // bits
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  await mkdir(out.slice(0, out.lastIndexOf('/')), { recursive: true });
  await writeFile(out, png);
}

if (process.argv[1]?.endsWith('makePlaceholder.ts')) await makePlaceholder();
