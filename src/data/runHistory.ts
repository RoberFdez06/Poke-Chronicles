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
}

/** Cuántas partidas se guardan en el historial. */
export const HISTORY_SIZE = 20;

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

function isRecord(r: unknown): r is RunRecord {
  const o = r as RunRecord;
  return (
    !!o && isNum(o.endedAt) && Number.isInteger(o.starterId) && typeof o.starterName === 'string' && isMode(o.mode) &&
    Number.isInteger(o.floor) && o.floor >= 1 && typeof o.won === 'boolean' && isNum(o.seconds) && isNum(o.kills) &&
    isNum(o.damage) && Array.isArray(o.items) && o.items.every((i) => typeof i === 'string') && isNum(o.tickets) &&
    typeof o.newRecord === 'boolean'
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
}

export const emptyCounters = (): RunCounters => ({ seconds: 0, kills: 0, damage: 0, newRecord: false });

export const isCounters = (c: unknown): c is RunCounters => {
  const o = c as RunCounters;
  return !!o && isNum(o.seconds) && isNum(o.kills) && isNum(o.damage) && typeof o.newRecord === 'boolean';
};
