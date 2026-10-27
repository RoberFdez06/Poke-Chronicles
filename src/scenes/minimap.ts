import Phaser from 'phaser';
import type { Floor, Room } from '../level/floorGen';
import { lowFx } from '../ui/theme';

// Minimapa en pixel art: marco con relieve, salas como baldosas con cara clara y lado oscuro, puertas como pasillos
// entre ellas, iconos dibujados por tipo de sala (jefe, tesoro, tienda, Centro Pokémon, desafío, secreta), la sala
// actual con un marco que late (fijo con efectos bajos) y las salas sin explorar tenues.

const CELL_W = 26;
const CELL_H = 18;
const GAP = 6;
const PAD = 8;

const INK = 0x101828;
const FRAME = 0x3a4560;
const FRAME_HI = 0x6a7898;
const PANEL = 0x161f36;

/** Iconos de 7×7 (cada letra es un color de la paleta del icono; '.' vacío). */
const ICONS: Record<string, { rows: string[]; pal: Record<string, number> }> = {
  // Calavera roja: jefe
  boss: {
    rows: ['.kkkkk.', 'kwwwwwk', 'kwkwkwk', 'kwwwwwk', '.kwwwk.', '.kwkwk.', '..kkk..'],
    pal: { k: 0x5a0f12, w: 0xff5a4e },
  },
  // Cofre dorado: sala del tesoro
  item: {
    rows: ['.kkkkk.', 'kyyyyyk', 'kyyyyyk', 'kkkwkkk', 'koowook', 'koooook', 'kkkkkkk'],
    pal: { k: 0x4a3008, y: 0xffd34d, o: 0xd99a1e, w: 0xffffff },
  },
  // Moneda con «$»: tienda
  shop: {
    rows: ['..kkk..', '.kgwgk.', 'kgwggk.', 'kggwgk.', 'kgggwgk', '.kgwgk.', '..kkk..'],
    pal: { k: 0x0d3d1e, g: 0x2ecc71, w: 0xe8fff0 },
  },
  // Cruz rosa: Centro Pokémon
  center: {
    rows: ['..kkk..', '..kwk..', 'kkkwkkk', 'kwwwwwk', 'kkkwkkk', '..kwk..', '..kkk..'],
    pal: { k: 0x7a1e44, w: 0xff8fc0 },
  },
  // Espadas cruzadas: desafío
  challenge: {
    rows: ['w.....w', '.w...w.', '..w.w..', '...w...', '..w.w..', 'hh...hh', 'hh...hh'],
    pal: { w: 0xe8ecf6, h: 0x8a5a2b },
  },
  // Interrogación morada: secreta
  secret: {
    rows: ['.kkkkk.', 'kpppppk', 'kpk.kpk', '...kppk', '..kpk..', '.......', '..kpk..'],
    pal: { k: 0x2a0f3a, p: 0xc07ae8 },
  },
};

function drawIcon(g: Phaser.GameObjects.Graphics, kind: string, cx: number, cy: number, p: number, alpha: number) {
  const ic = ICONS[kind];
  if (!ic) return;
  const x0 = Math.round(cx - (7 * p) / 2);
  const y0 = Math.round(cy - (7 * p) / 2);
  ic.rows.forEach((row, y) => {
    for (let x = 0; x < 7; x++) {
      const c = ic.pal[row[x]];
      if (c !== undefined) g.fillStyle(c, alpha).fillRect(x0 + x * p, y0 + y * p, p, p);
    }
  });
}

/** Rombo con borde (marca extra: minijefe, evento, regla…). */
function drawDiamond(g: Phaser.GameObjects.Graphics, cx: number, cy: number, p: number, color: number, alpha: number) {
  const rows = [1, 3, 5, 7, 5, 3, 1];
  rows.forEach((w, y) => {
    g.fillStyle(INK, alpha).fillRect(cx - ((w + 2) * p) / 2, cy + (y - 3.5) * p - p / 2, (w + 2) * p, p * 2);
  });
  rows.forEach((w, y) => g.fillStyle(color, alpha).fillRect(cx - (w * p) / 2, cy + (y - 3.5) * p, w * p, p));
  g.fillStyle(0xffffff, 0.6 * alpha).fillRect(cx - p / 2, cy - 2.5 * p, p, p);
}

/** Marco que late alrededor de la sala actual (un objeto aparte, así no hay que redibujar el mapa). */
function pulseFor(g: Phaser.GameObjects.Graphics): Phaser.GameObjects.Graphics {
  let pulse = g.getData('pulse') as Phaser.GameObjects.Graphics | undefined;
  if (pulse?.active) return pulse;
  const scene = g.scene;
  pulse = scene.add.graphics().setDepth(g.depth);
  // Mismo sitio que el mapa (capa del HUD y cámaras)
  const list = (g as unknown as { displayList?: { add?: (o: Phaser.GameObjects.GameObject) => void } }).displayList;
  list?.add?.(pulse);
  pulse.cameraFilter = g.cameraFilter;
  pulse.setScrollFactor(g.scrollFactorX, g.scrollFactorY);
  g.setData('pulse', pulse);
  g.once(Phaser.GameObjects.Events.DESTROY, () => pulse?.destroy());
  if (!lowFx()) scene.tweens.add({ targets: pulse, alpha: 0.35, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return pulse;
}

/**
 * Dibuja el minimapa con su esquina superior derecha en (right, top).
 * Muestra las salas visitadas y sus adyacentes; la sala actual va resaltada. Devuelve dónde acaba por abajo.
 */
export function drawMinimap(
  g: Phaser.GameObjects.Graphics,
  floor: Floor,
  currentId: number,
  visited: ReadonlySet<number>,
  right: number,
  top: number,
  /** Salas que no se enseñan aunque estén al lado de una visitada (la secreta, hasta que se abre). */
  hidden: ReadonlySet<number> = new Set(),
  /** Tamaño (1 = el de siempre) y ancho máximo: si no cabe, se encoge lo justo. */
  scale = 1,
  maxW = Infinity,
  /** Marcas extra por sala (id → color), p. ej. el minijefe (supervisor). */
  marks: ReadonlyMap<number, number> = new Map(),
): number {
  g.clear();

  const known = new Set(visited);
  for (const id of visited) {
    for (const n of Object.values(floor.rooms[id].doors)) if (n !== undefined && !hidden.has(n)) known.add(n);
  }

  const rooms = [...known].map((id) => floor.rooms[id]);
  const minX = Math.min(...rooms.map((r) => r.gx));
  const maxX = Math.max(...rooms.map((r) => r.gx));
  const minY = Math.min(...rooms.map((r) => r.gy));
  const maxY = Math.max(...rooms.map((r) => r.gy));

  const natural = (maxX - minX + 1) * (CELL_W + GAP) - GAP + PAD * 2;
  const k = Math.min(scale, maxW / natural);
  // Píxel del arte: todo se alinea a él para que se vea nítido
  const u = Math.max(1, Math.round(2 * k) / 2);
  const snap = (v: number) => Math.round(v / u) * u;
  const CW = snap(CELL_W * k);
  const CH = snap(CELL_H * k);
  const G = snap(GAP * k);
  const P = snap(PAD * k);
  const w = (maxX - minX + 1) * (CW + G) - G + P * 2;
  const h = (maxY - minY + 1) * (CH + G) - G + P * 2;
  const left = snap(right - w);

  // Marco: borde oscuro, filete claro y fondo con cuadrícula tenue
  g.fillStyle(INK, 0.92).fillRect(left + u, top, w - 2 * u, h).fillRect(left, top + u, w, h - 2 * u);
  g.fillStyle(FRAME, 1).fillRect(left + u, top + u, w - 2 * u, u).fillRect(left + u, top + h - 2 * u, w - 2 * u, u);
  g.fillRect(left + u, top + u, u, h - 2 * u).fillRect(left + w - 2 * u, top + u, u, h - 2 * u);
  g.fillStyle(FRAME_HI, 1).fillRect(left + 2 * u, top + u, w - 4 * u, u);
  g.fillStyle(PANEL, 0.9).fillRect(left + 2 * u, top + 2 * u, w - 4 * u, h - 4 * u);
  // Remaches de las esquinas
  g.fillStyle(FRAME_HI, 1);
  for (const [cx, cy] of [[left + 2 * u, top + 2 * u], [left + w - 3 * u, top + 2 * u], [left + 2 * u, top + h - 3 * u], [left + w - 3 * u, top + h - 3 * u]]) g.fillRect(cx, cy, u, u);

  const pos = (r: Room) => ({ x: left + P + (r.gx - minX) * (CW + G), y: top + P + (r.gy - minY) * (CH + G) });

  // Puertas y salas grandes: primero los pasillos (debajo de las salas)
  for (const r of rooms) {
    const { x, y } = pos(r);
    for (const d of ['right', 'down'] as const) {
      const n = r.doors[d];
      if (n === undefined || !known.has(n)) continue;
      const lit = visited.has(r.id) && visited.has(n);
      const merged = r.group !== undefined && floor.rooms[n].group === r.group;
      const color = merged ? (lit ? 0x8c98b6 : 0x2a3350) : lit ? 0xb8c4e6 : 0x3a4560;
      if (d === 'right') {
        if (merged) g.fillStyle(color, 1).fillRect(x + CW - u, y + u, G + 2 * u, CH - 2 * u);
        else {
          const dh = Math.max(2 * u, snap(CH * 0.34));
          g.fillStyle(INK, 1).fillRect(x + CW, y + (CH - dh) / 2 - u, G, dh + 2 * u);
          g.fillStyle(color, 1).fillRect(x + CW, y + (CH - dh) / 2, G, dh);
        }
      } else if (merged) g.fillStyle(color, 1).fillRect(x + u, y + CH - u, CW - 2 * u, G + 2 * u);
      else {
        const dw = Math.max(2 * u, snap(CW * 0.26));
        g.fillStyle(INK, 1).fillRect(x + (CW - dw) / 2 - u, y + CH, dw + 2 * u, G);
        g.fillStyle(color, 1).fillRect(x + (CW - dw) / 2, y + CH, dw, G);
      }
    }
  }

  let cur: { x: number; y: number } | undefined;
  const p = Math.max(1, Math.floor((CH - 2 * u) / 8));
  for (const r of rooms) {
    const { x, y } = pos(r);
    const isCurrent = r.id === currentId;
    const seen = visited.has(r.id);
    if (isCurrent) cur = { x, y };
    if (seen) {
      // Baldosa con relieve: borde, lado oscuro abajo, cara clara y brillo arriba
      const face = isCurrent ? 0xffffff : 0xc8d2ea;
      const side = isCurrent ? 0xb8c4e6 : 0x6a7898;
      g.fillStyle(INK, 1).fillRect(x, y, CW, CH);
      g.fillStyle(side, 1).fillRect(x + u, y + u, CW - 2 * u, CH - 2 * u);
      g.fillStyle(face, 1).fillRect(x + u, y + u, CW - 2 * u, CH - 3 * u);
      g.fillStyle(0xffffff, isCurrent ? 1 : 0.7).fillRect(x + 2 * u, y + u, CW - 4 * u, u);
    } else {
      // Sin explorar: hueco tenue con borde punteado
      g.fillStyle(0x222b45, 1).fillRect(x, y, CW, CH);
      g.fillStyle(0x4a5578, 1);
      for (let i = 0; i < CW; i += 2 * u) g.fillRect(x + i, y, u, u).fillRect(x + i, y + CH - u, u, u);
      for (let i = 0; i < CH; i += 2 * u) g.fillRect(x, y + i, u, u).fillRect(x + CW - u, y + i, u, u);
    }
    const alpha = seen ? 1 : 0.6;
    const cx = x + CW / 2;
    const cy = y + (seen ? (CH - u) / 2 : CH / 2);
    const mark = marks.get(r.id);
    if (ICONS[r.kind]) drawIcon(g, r.kind, cx, cy, p, alpha);
    else if (mark !== undefined) drawDiamond(g, cx, cy, Math.max(1, Math.floor(p * 0.8)), mark, alpha);
    else if (isCurrent) {
      // Tú: punto con la Poké Ball (rojo y blanco)
      g.fillStyle(INK, 1).fillRect(cx - 2 * p, cy - 2 * p, 4 * p, 4 * p);
      g.fillStyle(0xe53935, 1).fillRect(cx - 1.5 * p, cy - 1.5 * p, 3 * p, 1.5 * p);
      g.fillStyle(0xffffff, 1).fillRect(cx - 1.5 * p, cy, 3 * p, 1.5 * p);
    }
  }

  // Sala actual: marco amarillo que late
  const pulse = pulseFor(g);
  pulse.clear();
  if (cur) {
    pulse.fillStyle(0xffd34d, 1);
    const fx = cur.x - 2 * u;
    const fy = cur.y - 2 * u;
    const fw = CW + 4 * u;
    const fh = CH + 4 * u;
    pulse.fillRect(fx, fy, fw, u).fillRect(fx, fy + fh - u, fw, u).fillRect(fx, fy, u, fh).fillRect(fx + fw - u, fy, u, fh);
    // Esquinas gruesas
    for (const [ax, ay] of [[fx, fy], [fx + fw - 2 * u, fy], [fx, fy + fh - 2 * u], [fx + fw - 2 * u, fy + fh - 2 * u]]) pulse.fillRect(ax, ay, 2 * u, 2 * u);
  }
  return top + h;
}
