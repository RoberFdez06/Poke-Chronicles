// Resumen e historial de partidas (T28). Lógica pura: el registro de una partida terminada, la lista de las
// últimas y sus textos. El guardado está en save.ts.
import { isMode, type GameMode } from './modes.ts';

export interface RunRecord {
  /** Cuándo terminó (ms desde 1970). */
  endedAt: number;
  starterId: number;
  /** Nombre (en español) de la forma con la que acabó. */
  starterName: string;
  mode: GameMode;
  /** Piso, ronda o jefe al que llegó (como RunSave.floor). */
  floor: number;
  won: boolean;
  /** Tiempo jugado en segundos (sin contar la pausa). */
  seconds: number;
  kills: number;
  /** Daño total hecho a enemigos y jefes. */
  damage: number;
  /** Objetos pasivos con los que acabó (nombres). */
  items: string[];
  tickets: number;
  newRecord: boolean;
  /** T62 (las partidas antiguas no lo tienen): parrys acertados, objetos cogidos, sala más rápida (s) y tiempo de cada piso (s). */
  parries?: number;
  picked?: number;
  fastestRoom?: number;
  floorSeconds?: number[];
  /** T80 (las partidas antiguas no lo tienen): rutas elegidas, como texto («Cueva · +20 % · Tienda extra»). */
  routes?: string[];
  /** T81 (las partidas antiguas no lo tienen): código de semilla para jugar la misma partida y si se jugó con código. */
  seedCode?: string;
  fromCode?: boolean;
}

/** Cuántas partidas se guardan en el historial. */
export const HISTORY_SIZE = 20;

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
/** Un dato que puede faltar (partidas guardadas antes de T62) pero, si está, tiene que ser válido. */
const optNum = (n: unknown) => n === undefined || isNum(n);
const optNums = (a: unknown) => a === undefined || (Array.isArray(a) && a.every(isNum));

function isRecord(r: unknown): r is RunRecord {
  const o = r as RunRecord;
  return (
    !!o && isNum(o.endedAt) && Number.isInteger(o.starterId) && typeof o.starterName === 'string' && isMode(o.mode) &&
    Number.isInteger(o.floor) && o.floor >= 1 && typeof o.won === 'boolean' && isNum(o.seconds) && isNum(o.kills) &&
    isNum(o.damage) && Array.isArray(o.items) && o.items.every((i) => typeof i === 'string') && isNum(o.tickets) &&
    typeof o.newRecord === 'boolean' && optNum(o.parries) && optNum(o.picked) && optNum(o.fastestRoom) && optNums(o.floorSeconds) &&
    (o.routes === undefined || (Array.isArray(o.routes) && o.routes.every((x) => typeof x === 'string'))) &&
    (o.seedCode === undefined || typeof o.seedCode === 'string') && (o.fromCode === undefined || typeof o.fromCode === 'boolean')
  );
}

/** Lee el historial; descarta lo que no sea válido (no rompe por un registro malo). */
export function parseHistory(raw: string | null): RunRecord[] {
  try {
    const d = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(d)) return [];
    return d.filter(isRecord).slice(0, HISTORY_SIZE);
  } catch {
    return [];
  }
}

/** Añade una partida al principio (la más reciente primero) y se queda con las últimas HISTORY_SIZE. */
export const withRun = (list: readonly RunRecord[], r: RunRecord): RunRecord[] => [r, ...list].slice(0, HISTORY_SIZE);

/** "3:07" o "1:02:05". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Contadores de la partida que pasan de un piso a otro (y se guardan con ella). */
export interface RunCounters {
  seconds: number;
  kills: number;
  damage: number;
  /** Se ha batido el récord del modo en algún momento de la partida. */
  newRecord: boolean;
  /** T62 (opcionales: las partidas guardadas antes no los tienen). */
  parries?: number;
  picked?: number;
  /** La sala de combate que menos tardaste en limpiar (segundos; 0 o sin dato = ninguna). */
  fastestRoom?: number;
  /** Lo que tardaste en cada piso ya terminado (segundos). */
  floorSeconds?: number[];
  /**
   * Segundo de partida en que empezó el piso actual. Va en los contadores (y no en la escena) porque la escena se
   * reinicia en cada piso y al continuar una partida: así el tiempo del piso sobrevive a las dos cosas.
   */
  floorStartedAt?: number;
}

export const emptyCounters = (): RunCounters => ({ seconds: 0, kills: 0, damage: 0, newRecord: false });

export const isCounters = (c: unknown): c is RunCounters => {
  const o = c as RunCounters;
  return !!o && isNum(o.seconds) && isNum(o.kills) && isNum(o.damage) && typeof o.newRecord === 'boolean' &&
    optNum(o.parries) && optNum(o.picked) && optNum(o.fastestRoom) && optNums(o.floorSeconds) && optNum(o.floorStartedAt);
};

/** Una sala limpiada en menos de esto no cuenta como «sala más rápida» (tienda, objeto… se limpian al entrar). */
export const MIN_ROOM_SECONDS = 2;

export function noteParry(c: RunCounters) {
  c.parries = (c.parries ?? 0) + 1;
}

export function notePickup(c: RunCounters) {
  c.picked = (c.picked ?? 0) + 1;
}

/** Anota lo que se tardó en limpiar una sala; se queda con la más rápida. */
export function noteRoomTime(c: RunCounters, seconds: number) {
  if (!Number.isFinite(seconds) || seconds < MIN_ROOM_SECONDS) return;
  c.fastestRoom = c.fastestRoom && c.fastestRoom > 0 ? Math.min(c.fastestRoom, seconds) : seconds;
}

/** Anota lo que se tardó en un piso ya terminado. */
export function noteFloorTime(c: RunCounters, seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return;
  c.floorSeconds = [...(c.floorSeconds ?? []), Math.round(seconds)];
}

/** Empieza a contar el piso actual (si ya se estaba contando, p. ej. al continuar la partida, no lo toca). */
export function openFloor(c: RunCounters) {
  if (c.floorStartedAt === undefined || c.floorStartedAt > c.seconds) c.floorStartedAt = c.seconds;
}

/** Cierra el piso actual (al bajar por la trampilla): apunta lo que se tardó y deja de contarlo. */
export function closeFloor(c: RunCounters) {
  if (c.floorStartedAt === undefined) return;
  noteFloorTime(c, c.seconds - c.floorStartedAt);
  c.floorStartedAt = undefined;
}

/** Tiempo de cada piso para el resumen: los cerrados y, si hay, el que se está jugando (el de la caída o la victoria). */
export const floorTimes = (c: RunCounters): number[] => [
  ...(c.floorSeconds ?? []),
  ...(c.floorStartedAt === undefined ? [] : [Math.round(Math.max(0, c.seconds - c.floorStartedAt))]),
];
