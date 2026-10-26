// Puzzles del gimnasio (supervisor): suelo de baldosas de piedra o de hielo, rocas de pared, bloque de piedra que se
// empuja, placa de presión, salida, ficha del entrenador, interruptores eléctricos que se hunden y puertas del gimnasio
// fantasma que se abren. Píxel gordo; las piezas se dibujan centradas en (0, 0) para poder deslizarlas con un tween.
// Solo dibujo: las reglas están en level/gymPuzzles.ts.
import type Phaser from 'phaser';
import { lightOf, darkOf, mixColor } from './pixelFx';
import { OUT, live, once, stamp, twinkle, bolt, boltIcon } from './menuArt';

const P = 4;
const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

/** Tablero entero (suelo y paredes) en un solo Graphics, con coordenadas absolutas. */
export function drawGymBoard(g: Phaser.GameObjects.Graphics, gx: number, gy: number, cell: number, w: number, h: number, wall: (x: number, y: number) => boolean, ice: boolean) {
  // Marco del tablero
  g.fillStyle(OUT, 1).fillRect(gx - 10, gy - 10, w * cell + 20, h * cell + 20);
  g.fillStyle(ice ? 0x5a7fa8 : 0x6b5a46, 1).fillRect(gx - 6, gy - 6, w * cell + 12, h * cell + 12);
  g.fillStyle(ice ? 0x9cc8ea : 0x9a8466, 1).fillRect(gx - 6, gy - 6, w * cell + 12, 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = gx + x * cell;
    const py = gy + y * cell;
    if (ice) iceTile(g, px, py, cell, hash(x, y));
    else stoneTile(g, px, py, cell, hash(x, y));
    if (wall(x, y)) boulder(g, px + cell / 2, py + cell / 2, cell, hash(x, y), ice);
  }
}

function stoneTile(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, h: number) {
  const base = h % 3 === 0 ? 0x434a66 : 0x3d4460;
  g.fillStyle(0x262b40, 1).fillRect(x, y, s, s);
  g.fillStyle(base, 1).fillRect(x + 2, y + 2, s - 4, s - 4);
  g.fillStyle(lightOf(base), 0.35).fillRect(x + 2, y + 2, s - 4, P).fillRect(x + 2, y + 2, P, s - 4);
  g.fillStyle(darkOf(base), 1).fillRect(x + 2, y + s - 2 - P, s - 4, P).fillRect(x + s - 2 - P, y + 2, P, s - 4);
  // Grieta o motas según la baldosa
  g.fillStyle(darkOf(base), 1);
  if (h % 4 === 1) g.fillRect(x + 16, y + 20, P, P).fillRect(x + 20, y + 24, P, P).fillRect(x + 24, y + 24, P, P).fillRect(x + 28, y + 28, P, P);
  else if (h % 4 === 2) g.fillRect(x + 40, y + 14, P, P).fillRect(x + 18, y + 40, P, P);
  else g.fillRect(x + 36, y + 36, P, P);
}

function iceTile(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, h: number) {
  g.fillStyle(0x7fb6dc, 1).fillRect(x, y, s, s);
  g.fillStyle(h % 2 ? 0xc8ecfa : 0xbfe6f8, 1).fillRect(x + 2, y + 2, s - 4, s - 4);
  g.fillStyle(0xffffff, 0.6).fillRect(x + 2, y + 2, s - 4, P);
  g.fillStyle(0x9ccbe6, 1).fillRect(x + 2, y + s - 2 - P, s - 4, P);
  // Reflejo en diagonal
  g.fillStyle(0xffffff, 0.75);
  const o = 8 + (h % 3) * 8;
  for (let k = 0; k < 4; k++) g.fillRect(x + o + k * P, y + s - 16 - k * P, P, P);
  g.fillStyle(0xffffff, 0.45);
  for (let k = 0; k < 2; k++) g.fillRect(x + o + 12 + k * P, y + s - 16 - k * P, P, P);
}

function boulder(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number, h: number, ice: boolean) {
  const base = ice ? 0x6f7f96 : 0x8a7458;
  const r = s / 2 - 6;
  g.fillStyle(0x000000, 0.3).fillEllipse(cx + 2, cy + r - 2, r * 2, r * 0.7);
  // Silueta escalonada
  const rows = 12;
  for (let i = 0; i < rows; i++) {
    const yy = cy - r + i * ((2 * r) / rows);
    const t = (i + 0.5) / rows;
    const half = Math.round((Math.sqrt(1 - (2 * t - 1) ** 2) * r * (i < 2 ? 0.8 : 1)) / P) * P;
    g.fillStyle(OUT, 1).fillRect(cx - half - 2, yy - 2, half * 2 + 4, (2 * r) / rows + 4);
  }
  for (let i = 0; i < rows; i++) {
    const yy = cy - r + i * ((2 * r) / rows);
    const t = (i + 0.5) / rows;
    const half = Math.round((Math.sqrt(1 - (2 * t - 1) ** 2) * r * (i < 2 ? 0.8 : 1)) / P) * P;
    const col = t < 0.3 ? lightOf(base) : t > 0.72 ? darkOf(base) : base;
    g.fillStyle(col, 1).fillRect(cx - half, yy, half * 2, (2 * r) / rows + 1);
  }
  // Brillo y grietas
  g.fillStyle(0xffffff, 0.5).fillRect(cx - r / 2, cy - r / 2, P * 2, P);
  g.fillStyle(darkOf(darkOf(base)), 1);
  if (h % 2) g.fillRect(cx + 4, cy - 4, P, P).fillRect(cx + 8, cy, P, P).fillRect(cx + 8, cy + 4, P, P);
  else g.fillRect(cx - 8, cy + 4, P, P).fillRect(cx - 4, cy + 8, P, P);
  if (ice) g.fillStyle(0xffffff, 0.9).fillRect(cx - r + 6, cy - r / 2 - 4, r, P);
}

/** Placa de presión (destino del bloque) o salida (hielo), con pulso de luz. Absoluta, viva. */
export function addPad(scene: Phaser.Scene, cx: number, cy: number, s: number, color: number, exit: boolean) {
  const g = scene.add.graphics();
  return live(scene, g, (t) => {
    const k = 0.5 + 0.5 * Math.sin(t / 260);
    const r = s / 2 - 6;
    g.fillStyle(color, 0.12 + 0.18 * k).fillRect(cx - r - 4, cy - r - 4, 2 * r + 8, 2 * r + 8);
    g.fillStyle(OUT, 1).fillRect(cx - r, cy - r, 2 * r, 2 * r);
    g.fillStyle(darkOf(color), 1).fillRect(cx - r + 4, cy - r + 4, 2 * r - 8, 2 * r - 8);
    g.fillStyle(color, 1).fillRect(cx - r + 8, cy - r + 8, 2 * r - 16, 2 * r - 16);
    g.fillStyle(lightOf(color), 1).fillRect(cx - r + 8, cy - r + 8, 2 * r - 16, P);
    if (exit) {
      // Salida: banderín de meta a cuadros sobre su mástil
      g.fillStyle(OUT, 1).fillRect(cx - 12, cy - 14, 4, 28);
      for (let r = 0; r < 3; r++) for (let q = 0; q < 4; q++) g.fillStyle((r + q) % 2 ? OUT : 0xffffff, 1).fillRect(cx - 8 + q * 5, cy - 14 + r * 5 + Math.round(Math.sin(t / 200 + q) * 1), 5, 5);
    } else {
      // Rombo grabado
      g.fillStyle(darkOf(color), 1).fillRect(cx - 2, cy - 10, 4, 20).fillRect(cx - 10, cy - 2, 20, 4);
      g.fillStyle(lightOf(color), 1).fillRect(cx - 2, cy - 2, 4, 4);
    }
    // Esquinas que brillan por turnos
    const c = Math.floor(t / 300) % 4;
    const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]][c];
    g.fillStyle(0xffffff, 0.9).fillRect(cx + cs[0] * (r - 6) - 2, cy + cs[1] * (r - 6) - 2, P, P);
  }, 90);
}

/** Bloque de piedra que se empuja, centrado en (0, 0). Brilla si está sobre la placa. */
export function drawGymBlock(g: Phaser.GameObjects.Graphics, s: number, onTarget: boolean) {
  const r = Math.round((s * 0.38) / P) * P;
  const base = onTarget ? 0xc9a050 : 0xa08a68;
  g.fillStyle(0x000000, 0.35).fillRect(-r + 4, -r + 6, 2 * r, 2 * r);
  g.fillStyle(OUT, 1).fillRect(-r - 2, -r - 2, 2 * r + 4, 2 * r + 4);
  g.fillStyle(darkOf(base), 1).fillRect(-r, -r, 2 * r, 2 * r);
  g.fillStyle(base, 1).fillRect(-r, -r, 2 * r - P, 2 * r - P * 2);
  g.fillStyle(lightOf(base), 1).fillRect(-r, -r, 2 * r - P, P).fillRect(-r, -r, P, 2 * r - P * 2);
  // Juntas de los sillares
  g.fillStyle(darkOf(base), 1).fillRect(-r, -2, 2 * r - P, P).fillRect(-2, -r, P, r - 2).fillRect(r / 2, 2, P, r - 4);
  g.fillStyle(lightOf(base), 0.8).fillRect(-r + 8, -r + 8, P, P).fillRect(6, 10, P, P);
  if (onTarget) {
    g.fillStyle(0xfff1b8, 1).fillRect(-6, -r + 6, 12, P);
  }
}

// Ficha del entrenador vista desde arriba: gorra roja con visera blanca
const TRAINER = [
  '...kkkkkk...',
  '..kRRRRRRk..',
  '.kRRRWWRRRk.',
  '.kRRRRRRRRk.',
  '.kWWWWWWWWk.',
  '.kkSSSSSSkk.',
  'kHkSkSSkSkHk',
  'kHkSSSSSSkHk',
  '.kkBBBBBBkk.',
  '.kBBBBBBBBk.',
  '..kkk..kkk..',
];
const TRAINER_PAL = { k: OUT, R: 0xe04848, W: 0xffffff, S: 0xf6d2b0, H: 0x5a3a2a, B: 0x3b6fd0 };
export function drawGymTrainer(g: Phaser.GameObjects.Graphics, bob = 0) {
  g.fillStyle(0x000000, 0.3).fillEllipse(0, 22, 36, 10);
  stamp(g, -24, -24 + bob, TRAINER, TRAINER_PAL, P);
}

/**
 * Interruptor eléctrico: placa metálica con tuercas y un botón que, encendido, se hunde y suelta chispas.
 * `sink`: anima el hundimiento (si no, aparece ya hundido o arriba).
 */
export function addGymSwitch(scene: Phaser.Scene, cx: number, cy: number, w: number, h: number, o: { lit: boolean; sel: boolean; sink: boolean }) {
  const g = scene.add.graphics();
  const body = (press: number, t: number) => {
    const x = cx - w / 2;
    const y = cy - h / 2;
    if (o.lit) g.fillStyle(0xf5c518, 0.25 + 0.1 * Math.sin(t / 80)).fillRect(x - 8, y - 8, w + 16, h + 16);
    // Placa base
    g.fillStyle(OUT, 1).fillRect(x, y, w, h);
    g.fillStyle(0x5c667e, 1).fillRect(x + 4, y + 4, w - 8, h - 8);
    g.fillStyle(0x8792aa, 1).fillRect(x + 4, y + 4, w - 8, P);
    g.fillStyle(0x3c4458, 1).fillRect(x + 4, y + h - 8, w - 8, P);
    bolt(g, x + 12, y + 12);
    bolt(g, x + w - 12, y + 12);
    bolt(g, x + 12, y + h - 12);
    bolt(g, x + w - 12, y + h - 12);
    // Hueco y botón: sube 14 px de lado sin pulsar; pulsado queda a ras
    const bw = w - 32;
    const bh = 44;
    const by = cy - bh / 2 + 6;
    g.fillStyle(0x1a1f2c, 1).fillRect(cx - bw / 2 - 4, by - 4, bw + 8, bh + 8);
    const lift = Math.round((14 * (1 - press)) / 2) * 2;
    const top = o.lit ? 0xf5c518 : 0xc8424a;
    g.fillStyle(OUT, 1).fillRect(cx - bw / 2, by - lift, bw, bh + lift);
    g.fillStyle(darkOf(top), 1).fillRect(cx - bw / 2 + 2, by - lift + bh - 10, bw - 4, 8 + lift);
    g.fillStyle(top, 1).fillRect(cx - bw / 2 + 2, by - lift + 2, bw - 4, bh - 12);
    g.fillStyle(lightOf(top), 1).fillRect(cx - bw / 2 + 2, by - lift + 2, bw - 4, P);
    boltIcon(g, cx, by - lift + bh / 2 - 6, o.lit ? 0xffffff : 0xffd34d, 3);
    // Cable hacia arriba
    g.fillStyle(OUT, 1).fillRect(cx - 3, y - 18, 6, 18);
    g.fillStyle(o.lit ? 0xffe066 : 0x6a7286, 1).fillRect(cx - 1, y - 18, 2, 18);
    if (o.lit) {
      // Chispas que saltan del botón
      for (let i = 0; i < 4; i++) {
        const ph = ((t / 240 + i / 4) % 1);
        const a = (i / 4) * Math.PI * 2 + t / 500;
        const d = 18 + ph * 26;
        twinkle(g, cx + Math.cos(a) * d * 1.2, by + 10 + Math.sin(a) * d * 0.8, 0xffe066, 1 - ph, 2);
      }
    }
    if (o.sel) {
      g.fillStyle(0xffffff, 1);
      g.fillRect(x - 6, y - 6, w + 12, 4).fillRect(x - 6, y + h + 2, w + 12, 4).fillRect(x - 6, y - 6, 4, h + 12).fillRect(x + w + 2, y - 6, 4, h + 12);
    }
  };
  if (o.lit && o.sink) {
    once(scene, g, 160, (k) => body(k, 0), () => live(scene, g, (t) => body(1, t), 70));
  } else live(scene, g, (t) => body(o.lit ? 1 : 0, t), o.lit ? 70 : 100000);
  return g;
}

/**
 * Puerta del gimnasio fantasma: marco de piedra, puerta de madera violeta con herrajes y un farolillo de fuego fatuo.
 * `open`: ya probada (abierta, con un fantasma burlón dentro); `opening`: se anima la apertura; `real`: se abre con luz.
 */
export function addGymDoor(scene: Phaser.Scene, cx: number, cy: number, w: number, h: number, o: { open: boolean; opening: boolean; real?: boolean; sel: boolean }) {
  const g = scene.add.graphics();
  const x = cx - w / 2;
  const y = cy - h / 2;
  const body = (k: number, t: number) => {
    // Marco de piedra con arco escalonado
    g.fillStyle(OUT, 1).fillRect(x - 8, y + 8, w + 16, h - 4).fillRect(x, y - 4, w, 16);
    g.fillStyle(0x6c6a80, 1).fillRect(x - 4, y + 10, w + 8, h - 10).fillRect(x + 4, y, w - 8, 14);
    g.fillStyle(0x8f8ca6, 1).fillRect(x - 4, y + 10, 4, h - 10).fillRect(x + 4, y, w - 8, P);
    // Hueco (lo que se ve al abrir)
    const ix = x + 6;
    const iy = y + 14;
    const iw = w - 12;
    const ih = h - 18;
    if (o.real) {
      g.fillStyle(0xfff1b8, 1).fillRect(ix, iy, iw, ih);
      g.fillStyle(0xffffff, 0.8).fillRect(ix + iw / 2 - 8, iy, 16, ih);
    } else {
      g.fillStyle(0x0b0a14, 1).fillRect(ix, iy, iw, ih);
      if (k > 0.5) {
        // Fantasma burlón que asoma
        const bob = Math.round(Math.sin(t / 220) * 2) * 2;
        const a = Math.min(1, (k - 0.5) * 2);
        g.fillStyle(0x8e6ac8, a).fillRect(cx - 14, cy - 18 + bob, 28, 32).fillRect(cx - 18, cy - 10 + bob, 36, 20);
        g.fillStyle(0x8e6ac8, a).fillRect(cx - 18, cy + 14 + bob, 8, 6).fillRect(cx - 4, cy + 14 + bob, 8, 6).fillRect(cx + 10, cy + 14 + bob, 8, 6);
        g.fillStyle(0xffffff, a).fillRect(cx - 10, cy - 10 + bob, 8, 8).fillRect(cx + 2, cy - 10 + bob, 8, 8);
        g.fillStyle(0xe04848, a).fillRect(cx - 6, cy - 8 + bob, 4, 4).fillRect(cx + 6, cy - 8 + bob, 4, 4);
        g.fillStyle(0xe04848, a).fillRect(cx - 4, cy + 4 + bob, 8, 4);
      }
    }
    // Hoja de la puerta: gira hacia la izquierda (se estrecha)
    const dw = Math.max(0, Math.round((iw * (1 - k * 0.85)) / 2) * 2);
    if (dw > 0) {
      const wood = o.real ? 0x8e6ac8 : 0x6a4a8a;
      g.fillStyle(OUT, 1).fillRect(ix, iy, dw, ih);
      g.fillStyle(wood, 1).fillRect(ix + 2, iy + 2, Math.max(0, dw - 4), ih - 4);
      g.fillStyle(lightOf(wood), 1).fillRect(ix + 2, iy + 2, Math.max(0, dw - 4), P);
      g.fillStyle(darkOf(wood), 1);
      for (let p = 1; p < 4; p++) g.fillRect(ix + Math.round((dw * p) / 4), iy + 6, 2, ih - 12);
      // Herrajes y pomo
      if (k < 0.5) {
        g.fillStyle(0x2a2238, 1).fillRect(ix + 2, iy + 22, dw - 4, 6).fillRect(ix + 2, iy + ih - 30, dw - 4, 6);
        g.fillStyle(0xffd34d, 1).fillRect(ix + dw - 16, cy, 8, 8);
        g.fillStyle(0xffffff, 1).fillRect(ix + dw - 16, cy, 4, 4);
      }
    }
    // Farolillo de fuego fatuo encima
    const fl = Math.sin(t / 110) * 0.5 + 0.5;
    g.fillStyle(0x9b7ff0, 0.18 + 0.15 * fl).fillCircle(cx, y - 16, 16);
    g.fillStyle(OUT, 1).fillRect(cx - 6, y - 26, 12, 16);
    g.fillStyle(0x9b7ff0, 1).fillRect(cx - 4, y - 22 - Math.round(fl * 2) * 2, 8, 10 + Math.round(fl * 2) * 2);
    g.fillStyle(0xe8dcff, 1).fillRect(cx - 2, y - 18, 4, 6);
    if (o.real && k > 0) for (let i = 0; i < 5; i++) twinkle(g, cx - 30 + i * 15, y + 20 + ((i * 37) % ih) - k * 30, 0xffe066, 1 - k * 0.6, 2);
    if (o.sel && !o.open) {
      g.fillStyle(0xffffff, 1);
      g.fillRect(x - 12, y - 8, w + 24, 4).fillRect(x - 12, y + h + 4, w + 24, 4).fillRect(x - 12, y - 8, 4, h + 16).fillRect(x + w + 8, y - 8, 4, h + 16);
    }
  };
  if (o.opening) once(scene, g, 420, (k) => body(k, scene.time.now), () => live(scene, g, (t) => body(1, t), 90));
  else live(scene, g, (t) => body(o.open ? 1 : 0, t), 90);
  return g;
}

/** Botón de la parte de abajo, en la caja del tema pero compacto. */
export function drawGymButton(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w: number, h: number, hot: boolean) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  g.clear();
  g.fillStyle(OUT, 1).fillRect(x + 4, y, w - 8, h).fillRect(x, y + 4, w, h - 8);
  const fill = hot ? 0xffd34d : 0xf8f8f0;
  g.fillStyle(hot ? 0xc99a1e : 0x8fa6d8, 1).fillRect(x + 4, y + 4, w - 8, h - 8);
  g.fillStyle(fill, 1).fillRect(x + 8, y + 8, w - 16, h - 14);
  g.fillStyle(mixColor(fill, 0x000000, 0.12), 1).fillRect(x + 8, y + h - 10, w - 16, 4);
}
