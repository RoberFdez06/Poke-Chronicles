// Flechas guía (jefe y trampilla) y marcas de objetos del minimapa. Lógica pura, sin Phaser, para poder testearla.
//
// - guideModeOn: en qué modos salen (todos los de GameScene; la Defensa de torres tiene su escena y no).
// - knownRooms: las salas que enseña el minimapa (visitadas y sus vecinas, menos las ocultas): la flecha del jefe
//   solo sale si su sala ya se ve en el mapa (no destripa el piso con niebla).
// - roomRoute: primera puerta del camino más corto por salas conocidas (las salas grandes cuentan como una).
// - edgePlacement: dónde va la flecha en el borde de la vista y hacia dónde apunta (o si el objetivo ya se ve).
// - lootMarks: qué marcas de objetos lleva cada sala del minimapa.
import type { Dir } from '../level/floorGen.ts';

export type GuideKind = 'boss' | 'trapdoor';

/** Lo que hace falta de una sala del piso (casa con Room de floorGen.ts). */
export interface GuideRoom {
  id: number;
  gx: number;
  gy: number;
  doors: Partial<Record<Dir, number>>;
  group?: number;
}

/** Modos con jefes y trampillas (Normal, Oleadas, Infinito, Rush, Torre; Diario y código son Normal con semilla). */
export function guideModeOn(mode: string): boolean {
  return mode !== 'towerdef';
}

/** Salas que se ven en el minimapa: las visitadas (y la actual) y sus vecinas, menos las ocultas. */
export function knownRooms(rooms: readonly GuideRoom[], visited: Iterable<number>, current: number, hidden: ReadonlySet<number> = new Set()): Set<number> {
  const ok = (id: number | undefined): id is number => id !== undefined && id >= 0 && id < rooms.length;
  const seen = new Set([...visited].filter(ok));
  if (ok(current)) seen.add(current);
  const known = new Set(seen);
  for (const id of seen) for (const n of Object.values(rooms[id].doors)) if (ok(n) && !hidden.has(n)) known.add(n);
  return known;
}

const groupOf = (rooms: readonly GuideRoom[], id: number): number[] => {
  const g = rooms[id]?.group;
  return g === undefined ? [id] : rooms.filter((r) => r.group === g).map((r) => r.id);
};

export type Route = { kind: 'here' } | { kind: 'door'; room: number; dir: Dir; rooms: number } | { kind: 'none' };

/**
 * Camino más corto (en salas) de `from` a `to`. 'here' si es la misma sala (o la misma sala grande); si no, la
 * primera puerta que hay que cruzar (sala de este lado, dirección) y cuántas salas faltan. Solo pasa por salas de
 * `known` (si se da) y no cruza las puertas `blocked` (ocultas sin abrir).
 */
export function roomRoute(
  rooms: readonly GuideRoom[],
  from: number,
  to: number,
  opts: { known?: ReadonlySet<number>; blocked?: (room: number, d: Dir) => boolean } = {},
): Route {
  if (!rooms[from] || !rooms[to]) return { kind: 'none' };
  const start = new Set(groupOf(rooms, from));
  if (start.has(to)) return { kind: 'here' };
  if (opts.known && !opts.known.has(to)) return { kind: 'none' };
  type Node = { id: number; first?: { room: number; dir: Dir }; steps: number };
  const queue: Node[] = [...start].map((id) => ({ id, steps: 0 }));
  const seen = new Set(start);
  const order: Dir[] = ['up', 'right', 'down', 'left'];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const d of order) {
      const n = rooms[cur.id].doors[d];
      if (n === undefined || seen.has(n) || !rooms[n]) continue;
      if (opts.known && !opts.known.has(n)) continue;
      if (opts.blocked?.(cur.id, d)) continue;
      seen.add(n);
      // Dentro de una sala grande no hay puerta: cuenta como la misma sala
      const merged = rooms[cur.id].group !== undefined && rooms[cur.id].group === rooms[n].group;
      const first = cur.first ?? { room: cur.id, dir: d };
      const steps = cur.steps + (merged ? 0 : 1);
      if (n === to) return { kind: 'door', room: first.room, dir: first.dir, rooms: steps };
      const node = { id: n, first, steps };
      if (merged) queue.unshift(node);
      else queue.push(node);
    }
  }
  return { kind: 'none' };
}

export interface ViewRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EdgeSpot {
  /** El objetivo está dentro de la vista: la flecha se esconde. */
  onScreen: boolean;
  /** Dónde va la flecha (pegada al borde por dentro, a `margin`). */
  x: number;
  y: number;
  /** Hacia dónde apunta (radianes; 0 = derecha). */
  angle: number;
}

/**
 * Flecha en el borde: del centro de la vista hacia el objetivo (coordenadas de pantalla), cortando con el
 * rectángulo metido `margin` hacia dentro. Si el objetivo está dentro de la vista (con `slack` de holgura), onScreen.
 */
export function edgePlacement(view: ViewRect, tx: number, ty: number, margin: number, slack = 0): EdgeSpot {
  const cx = view.x + view.w / 2;
  const cy = view.y + view.h / 2;
  const angle = Math.atan2(ty - cy, tx - cx);
  const inside = tx >= view.x + slack && tx <= view.x + view.w - slack && ty >= view.y + slack && ty <= view.y + view.h - slack;
  const hw = Math.max(0, view.w / 2 - margin);
  const hh = Math.max(0, view.h / 2 - margin);
  const dx = tx - cx;
  const dy = ty - cy;
  const k = Math.min(dx === 0 ? Infinity : hw / Math.abs(dx), dy === 0 ? Infinity : hh / Math.abs(dy));
  const t = Number.isFinite(k) ? k : 0;
  return { onScreen: inside, x: cx + dx * t, y: cy + dy * t, angle };
}

/** Si dos flechas caen casi en el mismo sitio, la segunda se aparta a lo largo del borde. */
export function separate(a: { x: number; y: number }, b: { x: number; y: number }, minDist: number, view: ViewRect, margin: number): { x: number; y: number } {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  if (d >= minDist) return b;
  const onSide = Math.abs(b.x - view.x - margin) < 1 || Math.abs(b.x - (view.x + view.w - margin)) < 1;
  const clampX = (x: number) => Math.min(view.x + view.w - margin, Math.max(view.x + margin, x));
  const clampY = (y: number) => Math.min(view.y + view.h - margin, Math.max(view.y + margin, y));
  if (onSide) {
    const ny = b.y + (b.y >= a.y ? minDist : -minDist);
    const y = clampY(ny) === ny ? ny : clampY(b.y - (b.y >= a.y ? minDist : -minDist));
    return { x: b.x, y };
  }
  const nx = b.x + (b.x >= a.x ? minDist : -minDist);
  const x = clampX(nx) === nx ? nx : clampX(b.x - (b.x >= a.x ? minDist : -minDist));
  return { x, y: b.y };
}

/** Sala de la cuadrícula del piso bajo un punto del mundo (cada sala ocupa cellW × cellH). */
export function roomAtPoint(rooms: readonly GuideRoom[], x: number, y: number, cellW: number, cellH: number): number | undefined {
  const gx = Math.floor(x / cellW);
  const gy = Math.floor(y / cellH);
  return rooms.find((r) => r.gx === gx && r.gy === gy)?.id;
}

// --- Marcas de objetos del minimapa ---

export type LootMark = 'item' | 'small' | 'chest';
/** Objetos sueltos de las salas (como FloorItemSave: sala y tipo de lo que hay). */
export interface FloorThing {
  roomId: number;
  drop: { kind: string };
}

const SMALL = new Set(['coin', 'key', 'bomb', 'berry', 'potion']);

/**
 * Marcas por sala (solo las visitadas: lo que no has visto no se sabe): 'item' (objeto, poder o activo), 'small'
 * (moneda, llave, bomba, baya, poción) y 'chest' (cofre sin abrir). Orden fijo y sin repetir: no satura.
 */
export function lootMarks(things: readonly FloorThing[], chests: Iterable<number>, visited: ReadonlySet<number>): Map<number, LootMark[]> {
  const sets = new Map<number, Set<LootMark>>();
  const add = (id: number, m: LootMark) => {
    if (!visited.has(id)) return;
    let s = sets.get(id);
    if (!s) sets.set(id, (s = new Set()));
    s.add(m);
  };
  for (const t of things) add(t.roomId, SMALL.has(t.drop.kind) ? 'small' : 'item');
  for (const id of chests) add(id, 'chest');
  const order: LootMark[] = ['item', 'chest', 'small'];
  const out = new Map<number, LootMark[]>();
  for (const [id, s] of sets) out.set(id, order.filter((m) => s.has(m)));
  return out;
}

/** Texto de la distancia (en salas) bajo la flecha; nada si el objetivo está en esta sala. */
export function distanceLabel(route: Route): string {
  return route.kind === 'door' && route.rooms > 0 ? `${route.rooms} ${route.rooms === 1 ? 'sala' : 'salas'}` : '';
}
