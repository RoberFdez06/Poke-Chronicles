// IA de movimiento del «Modo automático» (móvil, data/autoMode.ts). Pura (sin Phaser) y probada con node --test.
// Cada fotograma prueba 16 direcciones (y quedarse quieto) simulando unos instantes hacia delante y puntúa:
//  - proyectiles enemigos (posición prevista con su velocidad): lo que más pesa; antes cuanto más cerca en el tiempo,
//  - zonas de peligro (líneas y anillos de los jefes, círculos de golpe): se evitan desde el aviso,
//  - enemigos cuerpo a cuerpo: se mantiene una distancia; los que disparan, una algo menor,
//  - paredes y obstáculos (`walkable`): direcciones que chocan casi descartadas,
//  - objetos y monedas cercanos: atracción suave cuando no hay amenaza cerca,
//  - y un poco de inercia (la dirección anterior) para no temblar.

export interface P {
  x: number;
  y: number;
}

export interface MoveShot extends P {
  vx: number;
  vy: number;
  /** Radio del proyectil (px). */
  r?: number;
}

/** Zona de peligro: círculo, segmento con ancho, o anillo con hueco (como los de bossFrenzy). */
export type Hazard =
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'seg'; x1: number; y1: number; x2: number; y2: number; w: number }
  | { kind: 'ring'; cx: number; cy: number; rMin: number; rMax: number; gapAng?: number; gapW?: number };

export interface MoveFoe extends P {
  /** Cuerpo a cuerpo (persigue, embiste…): se le guarda más distancia. */
  melee: boolean;
}

export interface AutoMoveInput {
  player: P;
  /** Velocidad del jugador (px/s). */
  speed: number;
  shots?: readonly MoveShot[];
  hazards?: readonly Hazard[];
  foes?: readonly MoveFoe[];
  pickups?: readonly P[];
  /** ¿Se puede estar ahí? (sala y obstáculos). Sin él, todo libre. */
  walkable?: (x: number, y: number) => boolean;
  /** Centro de la sala (atracción muy suave para no quedarse en las esquinas). */
  center?: P;
  /** Dirección del fotograma anterior (inercia). */
  prev?: P;
}

export const AUTO_DIRS = 16;
/** Radio del jugador para los choques (px). */
export const PLAYER_R = 18;
/** Distancia que se guarda a los cuerpo a cuerpo y a los que disparan (px). */
export const MELEE_KEEP = 210;
export const RANGED_KEEP = 150;
/** Hasta dónde se va a por un objeto o moneda (px). */
export const PICKUP_RANGE = 360;
/** Instantes simulados (s). */
const HORIZON = [0.08, 0.18, 0.3, 0.45, 0.6];

const segDist = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = dx * dx + dy * dy;
  const t = L > 0 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L)) : 0;
  return Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t));
};

/** Cuánto (px) está (x, y) dentro de la zona contando el margen `pad` (0 si fuera). */
export function hazardDepth(h: Hazard, x: number, y: number, pad = PLAYER_R): number {
  if (h.kind === 'circle') return Math.max(0, h.r + pad - Math.hypot(x - h.x, y - h.y));
  if (h.kind === 'seg') return Math.max(0, h.w / 2 + pad - segDist(h.x1, h.y1, h.x2, h.y2, x, y));
  const d = Math.hypot(x - h.cx, y - h.cy);
  const depth = Math.min(d - (h.rMin - pad), h.rMax + pad - d);
  if (depth <= 0) return 0;
  if (h.gapW !== undefined && h.gapAng !== undefined) {
    let da = Math.atan2(y - h.cy, x - h.cx) - h.gapAng;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) <= h.gapW / 2) return 0;
  }
  return Math.max(depth, 1e-3);
}

/** ¿Está (x, y) dentro de la zona (con margen `pad`)? */
export const inHazard = (h: Hazard, x: number, y: number, pad = PLAYER_R): boolean => hazardDepth(h, x, y, pad) > 0;

/** Puntuación (más baja = mejor) de moverse en `d` (unitaria o cero). */
export function scoreDir(o: AutoMoveInput, d: P): number {
  const { player: p, speed } = o;
  const walk = o.walkable ?? (() => true);
  let s = 0;
  let end = p;
  for (let k = 0; k < HORIZON.length; k++) {
    const t = HORIZON[k];
    const q = { x: p.x + d.x * speed * t, y: p.y + d.y * speed * t };
    // Choca con pared u obstáculo: casi descartada (y el resto se mide donde se queda)
    if (!walk(q.x, q.y)) {
      s += 400 * (HORIZON.length - k);
      break;
    }
    end = q;
    const near = 1 - k / HORIZON.length;
    for (const sh of o.shots ?? []) {
      const sx = sh.x + sh.vx * t;
      const sy = sh.y + sh.vy * t;
      const gap = Math.hypot(q.x - sx, q.y - sy) - (sh.r ?? 8) - PLAYER_R;
      if (gap < 0) s += 1200 * (0.5 + near);
      else if (gap < 40) s += 25 * (1 - gap / 40) * (0.5 + near);
    }
    for (const h of o.hazards ?? []) {
      const dep = hazardDepth(h, q.x, q.y);
      if (dep > 0) s += 600 * (0.4 + near) + dep * 6;
    }
  }
  // Proyectiles que vienen hacia ti: mejor no acabar en su trayectoria (más allá de lo simulado)
  for (const sh of o.shots ?? []) {
    const v = Math.hypot(sh.vx, sh.vy);
    if (v < 1) continue;
    const ux = sh.vx / v;
    const uy = sh.vy / v;
    if ((p.x - sh.x) * ux + (p.y - sh.y) * uy <= 0) continue;
    const ahead = { x: sh.x + ux * v * 1.5, y: sh.y + uy * v * 1.5 };
    const gap = segDist(sh.x, sh.y, ahead.x, ahead.y, end.x, end.y) - (sh.r ?? 8) - PLAYER_R - 10;
    if (gap < 0) s += 300 + -gap * 8;
  }
  for (const f of o.foes ?? []) {
    const keep = f.melee ? MELEE_KEEP : RANGED_KEEP;
    const dist = Math.hypot(end.x - f.x, end.y - f.y);
    if (dist < keep) s += (f.melee ? 140 : 70) * ((keep - dist) / keep) ** 2 * 4;
  }
  // Objetos y monedas: solo los cercanos (y menos atracción si hay enemigos encima)
  let best = Infinity;
  for (const it of o.pickups ?? []) {
    const d0 = Math.hypot(p.x - it.x, p.y - it.y);
    if (d0 > PICKUP_RANGE) continue;
    best = Math.min(best, Math.hypot(end.x - it.x, end.y - it.y) - d0);
  }
  if (best < Infinity) s += best * 0.25;
  if (o.center) s += Math.hypot(end.x - o.center.x, end.y - o.center.y) * 0.01;
  if (o.prev && (o.prev.x !== 0 || o.prev.y !== 0)) s -= (d.x * o.prev.x + d.y * o.prev.y) * 3;
  return s;
}

/** Dirección elegida (unitaria) o {0,0} si lo mejor es quedarse quieto. */
export function autoMoveDir(o: AutoMoveInput, dirs = AUTO_DIRS): P {
  let best: P = { x: 0, y: 0 };
  // Quedarse quieto tiene un pequeño extra a favor si no hay nada que hacer (no baila sin motivo)
  let bestS = scoreDir(o, best) - 2;
  for (let i = 0; i < dirs; i++) {
    const a = (i / dirs) * Math.PI * 2;
    const d = { x: Math.cos(a), y: Math.sin(a) };
    const sc = scoreDir(o, d);
    if (sc < bestS - 1e-9) {
      bestS = sc;
      best = d;
    }
  }
  return best;
}
