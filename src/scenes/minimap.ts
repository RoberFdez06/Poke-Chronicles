import Phaser from 'phaser';
import type { Floor, Room } from '../level/floorGen';
import { doorKey, type Dir } from '../level/floorGen';
import { lowFx } from '../ui/theme';
import { DEFAULT_HUD_THEME, mix, type HudTheme } from '../ui/art/hudTheme';
import { drawMotif } from '../ui/art/hudBackdrop';

// Minimapa en pixel art: marco del bioma (hudTheme.ts) con motivos en las esquinas, niebla de guerra con lo explorado
// aclarado, salas como baldosas con relieve y textura, pasillos con detalle según la puerta (normal, cerrada mientras
// hay pelea, del jefe, oculta abierta con bomba), el camino recorrido, iconos animados (el jefe respira, el tesoro
// brilla, tu Poké Ball bota) y la sala actual con un marco que late. La capa animada es aparte y pequeña: el mapa
// solo se redibuja al cambiar de sala; con lowFx no hay animación.

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


/** Extras del minimapa (todo opcional; sin ellos sale como antes con el tema azul). */
export interface MinimapExtras {
  theme?: HudTheme;
  /** Salas por las que has pasado, en orden (trazo del camino). */
  trail?: readonly number[];
  /** Salas limpias (sus puertas están abiertas). */
  cleared?: ReadonlySet<number>;
  /** Puertas ocultas ya abiertas con bomba ("sala:dirección"). */
  revealed?: ReadonlySet<string>;
  /** Salas con un cofre aún cerrado (se abre con llave). */
  chests?: ReadonlySet<number>;
}

/** Nombre de cada tipo de sala (para la leyenda). */
export const ROOM_LABEL: Record<string, string> = {
  start: 'Inicio',
  combat: 'Sala de combate',
  item: 'Sala del tesoro',
  boss: 'Jefe',
  center: 'Centro Pokémon',
  shop: 'Tienda',
  secret: 'Sala secreta',
  challenge: 'Sala de desafío',
};

interface MapLayout {
  left: number;
  top: number;
  w: number;
  h: number;
  CW: number;
  CH: number;
  G: number;
  P: number;
  minX: number;
  minY: number;
  rooms: Room[];
  visited: ReadonlySet<number>;
}

/** Sala del minimapa bajo un punto de la pantalla (para la leyenda al pasar el ratón), o undefined. */
export function minimapRoomAt(g: Phaser.GameObjects.Graphics, x: number, y: number): { room: Room; seen: boolean } | undefined {
  const L = g.getData('layout') as MapLayout | undefined;
  if (!L) return undefined;
  for (const r of L.rooms) {
    const rx = L.left + L.P + (r.gx - L.minX) * (L.CW + L.G);
    const ry = L.top + L.P + (r.gy - L.minY) * (L.CH + L.G);
    if (x >= rx && x < rx + L.CW && y >= ry && y < ry + L.CH) return { room: r, seen: L.visited.has(r.id) };
  }
  return undefined;
}

/** Caja que ocupa el minimapa (o undefined si aún no se ha dibujado). */
export function minimapBounds(g: Phaser.GameObjects.Graphics): { x: number; y: number; w: number; h: number } | undefined {
  const L = g.getData('layout') as MapLayout | undefined;
  return L && { x: L.left, y: L.top, w: L.w, h: L.h };
}

/** Capa aparte (marco que late, iconos animados) en el mismo sitio que el mapa (capa del HUD y sus cámaras). */
function layerFor(g: Phaser.GameObjects.Graphics, key: string, adopt?: (o: Phaser.GameObjects.GameObject) => void): Phaser.GameObjects.Graphics {
  let layer = g.getData(key) as Phaser.GameObjects.Graphics | undefined;
  if (layer?.active) return layer;
  const scene = g.scene;
  layer = scene.add.graphics().setDepth(g.depth);
  if (adopt) adopt(layer);
  else {
    layer.cameraFilter = g.cameraFilter;
    layer.setScrollFactor(g.scrollFactorX, g.scrollFactorY);
  }
  g.setData(key, layer);
  g.once(Phaser.GameObjects.Events.DESTROY, () => layer?.destroy());
  return layer;
}

function pulseFor(g: Phaser.GameObjects.Graphics, adopt?: (o: Phaser.GameObjects.GameObject) => void): Phaser.GameObjects.Graphics {
  const fresh = !(g.getData('pulse') as Phaser.GameObjects.Graphics | undefined)?.active;
  const pulse = layerFor(g, 'pulse', adopt);
  if (fresh && !lowFx()) g.scene.tweens.add({ targets: pulse, alpha: 0.35, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return pulse;
}

/** Lo que dibuja la capa animada en cada fotograma de la animación (unas pocas salas: barato). */
interface AnimSpot {
  kind: 'boss' | 'item' | 'me';
  cx: number;
  cy: number;
  p: number;
  u: number;
  alpha: number;
}

function drawAnim(fx: Phaser.GameObjects.Graphics, spots: readonly AnimSpot[], t: number) {
  fx.clear();
  for (const s of spots) {
    const { cx, cy, p, u } = s;
    if (s.kind === 'boss') {
      // El jefe respira: halo rojo que crece y mengua y los ojos que se encienden
      const k = (Math.sin(t / 420) + 1) / 2;
      const r = Math.round((4.5 + k) * p);
      fx.fillStyle(0xff3020, 0.12 + 0.18 * k * s.alpha).fillRect(cx - r, cy - r, 2 * r, 2 * r);
      drawIcon(fx, 'boss', cx, cy + (k > 0.5 ? 0 : u / 2), p, s.alpha);
      fx.fillStyle(0xffe08a, (0.4 + 0.6 * k) * s.alpha);
      const x0 = Math.round(cx - 3.5 * p);
      const y0 = Math.round(cy + (k > 0.5 ? 0 : u / 2) - 3.5 * p);
      fx.fillRect(x0 + 2 * p, y0 + 2 * p, p, p).fillRect(x0 + 4 * p, y0 + 2 * p, p, p);
    } else if (s.kind === 'item') {
      // El tesoro brilla: un destello que cruza la tapa y una estrellita que parpadea
      drawIcon(fx, 'item', cx, cy, p, s.alpha);
      const x0 = Math.round(cx - 3.5 * p);
      const y0 = Math.round(cy - 3.5 * p);
      const step = Math.floor(t / 110) % 14;
      if (step < 6) fx.fillStyle(0xffffff, 0.85 * s.alpha).fillRect(x0 + (step + 1) * p, y0 + p, p, 2 * p);
      const tw = Math.floor(t / 300) % 4;
      if (tw !== 3) {
        const sx = x0 + 7 * p;
        const sy = y0 - p;
        const a = (tw === 1 ? 1 : 0.55) * s.alpha;
        fx.fillStyle(0xfff6c0, a).fillRect(sx, sy - p, p, 3 * p).fillRect(sx - p, sy, 3 * p, p);
      }
    } else {
      // Tú: Poké Ball que bota, con su sombra
      const hop = Math.floor(t / 200) % 4 === 1 ? u : 0;
      fx.fillStyle(0x000000, 0.35).fillRect(cx - 1.5 * p, cy + 2 * p, 3 * p, p / 2 + u / 2);
      const y = cy - hop;
      fx.fillStyle(INK, 1).fillRect(cx - 2 * p, y - 2 * p, 4 * p, 4 * p);
      fx.fillStyle(0xe53935, 1).fillRect(cx - 1.5 * p, y - 1.5 * p, 3 * p, 1.5 * p);
      fx.fillStyle(0xffffff, 1).fillRect(cx - 1.5 * p, y, 3 * p, 1.5 * p);
      fx.fillStyle(INK, 1).fillRect(cx - 1.5 * p, y - u / 2, 3 * p, u);
      fx.fillStyle(0xffffff, 1).fillRect(cx - p / 2, y - p / 2, p, p);
    }
  }
}

/** Arranca (una vez) el reloj barato de la animación: redibuja solo la capa animada, unas 8 veces por segundo. */
function animate(g: Phaser.GameObjects.Graphics, fx: Phaser.GameObjects.Graphics, spots: AnimSpot[]) {
  g.setData('spots', spots);
  if (lowFx()) {
    drawAnim(fx, spots, 0);
    return;
  }
  drawAnim(fx, spots, g.scene.time.now);
  if (g.getData('timer')) return;
  const timer = g.scene.time.addEvent({
    delay: 120,
    loop: true,
    callback: () => {
      if (!fx.active) return;
      drawAnim(fx, (g.getData('spots') as AnimSpot[]) ?? [], g.scene.time.now);
    },
  });
  g.setData('timer', timer);
  g.once(Phaser.GameObjects.Events.DESTROY, () => timer.remove());
}

/** Textura de la baldosa: unas motas fijas por sala (siempre las mismas para la misma sala). */
function speckles(g: Phaser.GameObjects.Graphics, id: number, x: number, y: number, w: number, h: number, u: number, color: number) {
  let s = (id * 2654435761) >>> 0;
  g.fillStyle(color, 0.35);
  for (let i = 0; i < 4; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    const px = x + 2 * u + ((s >>> 8) % Math.max(1, Math.floor((w - 4 * u) / u))) * u;
    const py = y + 2 * u + ((s >>> 18) % Math.max(1, Math.floor((h - 5 * u) / u))) * u;
    g.fillRect(px, py, u, u);
  }
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
  /** Mete las capas aparte (marco que late, iconos animados) en la misma capa que el mapa (la del HUD). */
  adopt?: (o: Phaser.GameObjects.GameObject) => void,
  extras: MinimapExtras = {},
): number {
  g.clear();
  const th = extras.theme ?? DEFAULT_HUD_THEME;
  const exists = (id: number | undefined): id is number => id !== undefined && id >= 0 && id < floor.rooms.length;

  // Solo ids de este piso: un `visited` de otro piso no puede pintar salas fantasma
  const seenSet = new Set([...visited].filter(exists));
  if (exists(currentId)) seenSet.add(currentId);
  const known = new Set(seenSet);
  for (const id of seenSet) {
    for (const n of Object.values(floor.rooms[id].doors)) if (exists(n) && !hidden.has(n)) known.add(n);
  }

  const rooms = [...known].map((id) => floor.rooms[id]);
  if (rooms.length === 0) {
    pulseFor(g, adopt).clear();
    layerFor(g, 'fx', adopt).clear();
    return top;
  }
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

  // Marco del bioma: borde oscuro, acento, filete claro y remaches; dentro, la niebla con una trama suave
  g.fillStyle(INK, 0.95).fillRect(left + u, top, w - 2 * u, h).fillRect(left, top + u, w, h - 2 * u);
  g.fillStyle(th.accent, 1).fillRect(left + u, top + u, w - 2 * u, u).fillRect(left + u, top + h - 2 * u, w - 2 * u, u);
  g.fillRect(left + u, top + u, u, h - 2 * u).fillRect(left + w - 2 * u, top + u, u, h - 2 * u);
  g.fillStyle(th.accentHi, 1).fillRect(left + 2 * u, top + u, w - 4 * u, u);
  g.fillStyle(mix(th.accent, 0x000000, 0.45), 1).fillRect(left + 2 * u, top + h - 2 * u, w - 4 * u, u);
  g.fillStyle(th.fog, 0.95).fillRect(left + 2 * u, top + 2 * u, w - 4 * u, h - 4 * u);
  g.fillStyle(th.panel, 0.9);
  for (let yy = top + 2 * u; yy < top + h - 2 * u; yy += 2 * u) {
    for (let xx = left + 2 * u + ((yy / u) % 4 === 0 ? 0 : u); xx < left + w - 2 * u; xx += 2 * u) g.fillRect(xx, yy, u, u);
  }
  // Motivos del bioma en las esquinas de arriba (pequeños, encima del borde)
  const mp = Math.max(1, Math.round(u));
  if (w > 24 * mp) {
    drawMotif(g, th, left - 2 * mp, top - 3 * mp, mp, 1);
    drawMotif(g, th, left + w - 6 * mp, top - 3 * mp, mp, 1, true);
  }
  for (const [cx, cy] of [[left + 2 * u, top + h - 3 * u], [left + w - 3 * u, top + h - 3 * u]]) g.fillStyle(th.accentHi, 1).fillRect(cx, cy, u, u);

  const pos = (r: Room) => ({ x: left + P + (r.gx - minX) * (CW + G), y: top + P + (r.gy - minY) * (CH + G) });
  g.setData('layout', { left, top, w, h, CW, CH, G, P, minX, minY, rooms, visited: seenSet } satisfies MapLayout);

  // Niebla de guerra suave: lo explorado aclara un halo alrededor (y un poco menos lo que solo se ve de lejos)
  for (const r of rooms) {
    const { x, y } = pos(r);
    const seen = seenSet.has(r.id);
    const e = snap(G / 2);
    g.fillStyle(th.bg2, seen ? 0.55 : 0.25).fillRect(x - e, y - e, CW + 2 * e, CH + 2 * e);
    if (seen) g.fillStyle(th.bg2, 0.3).fillRect(x - e - u, y - e + u, CW + 2 * e + 2 * u, CH + 2 * e - 2 * u);
  }

  // Pasillos (debajo de las salas): normal, cerrado mientras hay pelea, del jefe y oculto ya abierto
  const cleared = extras.cleared;
  const hiddenDoors = new Set(floor.hiddenDoors ?? []);
  for (const r of rooms) {
    const { x, y } = pos(r);
    for (const d of ['right', 'down'] as const) {
      const n = r.doors[d];
      if (!exists(n) || !known.has(n)) continue;
      const lit = seenSet.has(r.id) && seenSet.has(n);
      const merged = r.group !== undefined && floor.rooms[n].group === r.group;
      if (merged) {
        const color = lit ? 0x8c98b6 : 0x2a3350;
        if (d === 'right') g.fillStyle(color, 1).fillRect(x + CW - u, y + u, G + 2 * u, CH - 2 * u);
        else g.fillStyle(color, 1).fillRect(x + u, y + CH - u, CW - 2 * u, G + 2 * u);
        continue;
      }
      const isBoss = floor.rooms[n].kind === 'boss' || r.kind === 'boss';
      const isHidden = hiddenDoors.has(doorKey(r.id, d as Dir));
      const closed = cleared !== undefined && (r.id === currentId || n === currentId) && !cleared.has(currentId);
      const base = lit ? 0xb8c4e6 : 0x3a4560;
      const rim = isBoss ? (lit ? 0xff5a4e : 0x7a2a2a) : isHidden ? 0x9a7cff : INK;
      const horiz = d === 'right';
      const dl = horiz ? Math.max(2 * u, snap(CH * 0.34)) : Math.max(2 * u, snap(CW * 0.26));
      // (ox, oy, ancho, alto) del pasillo
      const box = horiz ? [x + CW, y + (CH - dl) / 2, G, dl] : [x + (CW - dl) / 2, y + CH, dl, G];
      const [bx, by, bw, bh] = box;
      g.fillStyle(rim, 1).fillRect(horiz ? bx : bx - u, horiz ? by - u : by, horiz ? bw : bw + 2 * u, horiz ? bh + 2 * u : bh);
      if (isHidden) {
        // Grieta: pasillo roto a trozos
        g.fillStyle(base, 1);
        for (let i = 0; i < (horiz ? bw : bh); i += 2 * u) g.fillRect(horiz ? bx + i : bx, horiz ? by : by + i, horiz ? u : bw, horiz ? bh : u);
      } else {
        g.fillStyle(base, 1).fillRect(bx, by, bw, bh);
        if (lit) g.fillStyle(0xffffff, 0.35).fillRect(bx, by, horiz ? bw : u, horiz ? u : bh);
      }
      if (closed) {
        // Puerta cerrada (pelea en curso): barrotes rojos
        g.fillStyle(0xd83a2e, 1);
        if (horiz) g.fillRect(bx + bw / 2 - u / 2, by - u, u, bh + 2 * u);
        else g.fillRect(bx - u, by + bh / 2 - u / 2, bw + 2 * u, u);
      }
    }
  }

  // Trazo del camino recorrido: puntitos de centro a centro (los últimos más vivos)
  const trail = (extras.trail ?? []).filter((id) => exists(id) && known.has(id));
  for (let i = 1; i < trail.length; i++) {
    const a = pos(floor.rooms[trail[i - 1]]);
    const b = pos(floor.rooms[trail[i]]);
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > (CW + G) * 1.01 + (CH + G) * 0 && a.y !== b.y && a.x !== b.x) continue;
    const fade = 0.25 + 0.55 * (i / trail.length);
    const ax = a.x + CW / 2;
    const ay = a.y + CH / 2;
    const bx2 = b.x + CW / 2;
    const by2 = b.y + CH / 2;
    const steps = Math.max(1, Math.round(Math.hypot(bx2 - ax, by2 - ay) / (3 * u)));
    g.fillStyle(th.accentHi, fade);
    for (let s2 = 1; s2 < steps; s2++) g.fillRect(snap(ax + ((bx2 - ax) * s2) / steps) - u / 2, snap(ay + ((by2 - ay) * s2) / steps) - u / 2, u, u);
  }

  let cur: { x: number; y: number } | undefined;
  const spots: AnimSpot[] = [];
  const p = Math.max(1, Math.floor((CH - 2 * u) / 8));
  for (const r of rooms) {
    const { x, y } = pos(r);
    const isCurrent = r.id === currentId;
    const seen = seenSet.has(r.id);
    if (isCurrent) cur = { x, y };
    if (seen) {
      // Baldosa con relieve: borde, lado oscuro abajo, cara clara con textura, bisel y brillo arriba
      const face = isCurrent ? 0xffffff : mix(0xc8d2ea, th.accentHi, 0.18);
      const side = isCurrent ? 0xb8c4e6 : mix(0x6a7898, th.edge, 0.4);
      g.fillStyle(INK, 1).fillRect(x, y, CW, CH);
      g.fillStyle(side, 1).fillRect(x + u, y + u, CW - 2 * u, CH - 2 * u);
      g.fillStyle(face, 1).fillRect(x + u, y + u, CW - 2 * u, CH - 3 * u);
      g.fillStyle(mix(face, 0x000000, 0.12), 1).fillRect(x + CW - 2 * u, y + 2 * u, u, CH - 5 * u);
      g.fillStyle(0xffffff, isCurrent ? 1 : 0.7).fillRect(x + 2 * u, y + u, CW - 4 * u, u).fillRect(x + u, y + 2 * u, u, CH - 5 * u);
      speckles(g, r.id, x, y, CW, CH, u, side);
      // Sala aún con enemigos (vista pero sin limpiar): esquina roja
      if (cleared && !cleared.has(r.id) && !isCurrent && r.kind !== 'start') g.fillStyle(0xd83a2e, 1).fillRect(x + CW - 3 * u, y + u, 2 * u, 2 * u);
    } else {
      // Sin explorar: silueta en la niebla con borde punteado
      g.fillStyle(mix(th.fog, 0xffffff, 0.08), 1).fillRect(x, y, CW, CH);
      g.fillStyle(mix(th.edge, th.fog, 0.3), 1);
      for (let i = 0; i < CW; i += 2 * u) g.fillRect(x + i, y, u, u).fillRect(x + i, y + CH - u, u, u);
      for (let i = 0; i < CH; i += 2 * u) g.fillRect(x, y + i, u, u).fillRect(x + CW - u, y + i, u, u);
    }
    const alpha = seen ? 1 : 0.6;
    const cx = x + CW / 2;
    const cy = y + (seen ? (CH - u) / 2 : CH / 2);
    const mark = marks.get(r.id);
    if (r.kind === 'boss' || r.kind === 'item') spots.push({ kind: r.kind, cx, cy, p, u, alpha });
    else if (ICONS[r.kind]) drawIcon(g, r.kind, cx, cy, p, alpha);
    else if (mark !== undefined) drawDiamond(g, cx, cy, Math.max(1, Math.floor(p * 0.8)), mark, alpha);
    // Cofre aún cerrado: candado pequeño en la esquina
    if (extras.chests?.has(r.id) && seen) {
      const lx = x + 2 * u;
      const ly = y + CH - 6 * u;
      g.fillStyle(INK, 1).fillRect(lx - u / 2, ly - u / 2, 4 * u, 4 * u);
      g.fillStyle(0xffd34d, 1).fillRect(lx, ly + u, 3 * u, 2 * u);
      g.fillStyle(0xffd34d, 1).fillRect(lx + u / 2, ly, 2 * u, u);
    }
    // Tú, donde no hay icono: la Poké Ball animada (en salas con icono basta el marco que late)
    if (isCurrent && !ICONS[r.kind] && mark === undefined) spots.push({ kind: 'me', cx, cy, p, u, alpha: 1 });
  }

  animate(g, layerFor(g, 'fx', adopt), spots);

  // Sala actual: marco amarillo que late
  const pulse = pulseFor(g, adopt);
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
