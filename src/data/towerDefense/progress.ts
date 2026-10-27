// Defensa de torres: progreso. Cada mapa tiene LEVELS_PER_MAP niveles que se superan en orden, con 1-3 estrellas
// según la vida de la base. El siguiente mapa se abre al superar al menos la mitad (redondeando hacia arriba) de
// los niveles del anterior, y el infinito de un mapa al superarlos todos. Premios fuera de la partida: tickets y
// caramelos (nunca monedas), con extra la primera vez que consigues cada estrella. Se guarda en su propia clave;
// como todo el guardado, pasa por activeStorage() (invitado: memoria que no se guarda; cuenta: nube).
import { activeStorage, type StorageLike } from '../storage.ts';
import { TD_MAPS } from './maps.ts';
import { LEVELS_PER_MAP } from './waves.ts';

export const TD_KEY = 'pokeisaac.towerdef';
export const TD_VERSION = 2;

export interface MapProgress {
  /** Estrellas de cada nivel (0 = sin superar). */
  stars: number[];
  /** Mejor oleada del modo infinito en este mapa. */
  endless: number;
}

export interface TdProgress {
  maps: Record<string, MapProgress>;
}

export const emptyTdProgress = (): TdProgress => ({ maps: {} });
const emptyMap = (): MapProgress => ({ stars: Array(LEVELS_PER_MAP).fill(0), endless: 0 });

const int = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isInteger(v) ? Math.max(lo, Math.min(hi, v)) : lo);

export function parseTdProgress(raw: string | null): TdProgress {
  const out = emptyTdProgress();
  if (!raw) return out;
  try {
    const d: unknown = JSON.parse(raw);
    const maps = d && typeof d === 'object' ? (d as { maps?: unknown }).maps : null;
    if (!maps || typeof maps !== 'object') return out;
    for (const m of TD_MAPS) {
      const v = (maps as Record<string, unknown>)[m.id];
      if (!v || typeof v !== 'object') continue;
      const o = v as Record<string, unknown>;
      const arr = Array.isArray(o.stars) ? o.stars : [];
      const stars = Array.from({ length: LEVELS_PER_MAP }, (_, i) => int(arr[i], 0, 3));
      // Los niveles se superan en orden: lo que venga detrás de un hueco no cuenta
      const gap = stars.indexOf(0);
      if (gap >= 0) for (let i = gap; i < stars.length; i++) stars[i] = 0;
      out.maps[m.id] = { stars, endless: int(o.endless, 0, 9999) };
    }
  } catch {
    // corrupto: sin progreso
  }
  return out;
}

export const mapProgress = (p: TdProgress, id: string): MapProgress => p.maps[id] ?? emptyMap();

/** Niveles superados de un mapa. */
export const levelsCleared = (p: TdProgress, id: string): number => mapProgress(p, id).stars.filter((s) => s > 0).length;

/** Niveles que hay que superar de un mapa para abrir el siguiente: la mitad, redondeando hacia arriba. */
export const LEVELS_TO_UNLOCK_NEXT = Math.ceil(LEVELS_PER_MAP * 0.5);
export const levelsNeeded = (total: number): number => Math.ceil(total * 0.5);

/** El primer mapa siempre; cada uno al superar al menos la mitad de los niveles del anterior. */
export function isMapUnlocked(p: TdProgress, index: number): boolean {
  if (index <= 0) return true;
  const prev = TD_MAPS[index - 1];
  return !!prev && isMapUnlocked(p, index - 1) && levelsCleared(p, prev.id) >= LEVELS_TO_UNLOCK_NEXT;
}

/** Nivel (1-based) abierto si el mapa lo está y el anterior está superado. */
export function isLevelUnlocked(p: TdProgress, mapIdx: number, level: number): boolean {
  const m = TD_MAPS[mapIdx];
  if (!m || level < 1 || level > LEVELS_PER_MAP || !isMapUnlocked(p, mapIdx)) return false;
  return level === 1 || mapProgress(p, m.id).stars[level - 2] > 0;
}

/** El infinito de un mapa se abre al superar TODOS sus niveles. */
export const isEndlessUnlocked = (p: TdProgress, id: string): boolean => levelsCleared(p, id) >= LEVELS_PER_MAP;

export const mapStars = (p: TdProgress, id: string): number => mapProgress(p, id).stars.reduce((a, b) => a + b, 0);
export const totalStars = (p: TdProgress): number => TD_MAPS.reduce((n, m) => n + mapStars(p, m.id), 0);

/** Estrellas al ganar: 3 sin perder más del 10 % de la base, 2 con más de la mitad, 1 si aguanta. */
export function starsFor(hp: number, maxHp: number, won: boolean): number {
  if (!won || hp <= 0) return 0;
  const r = hp / Math.max(1, maxHp);
  return r >= 0.9 ? 3 : r >= 0.5 ? 2 : 1;
}

export interface TdOutcome {
  mapId: string;
  /** Nivel jugado (1-12) o 0 para el infinito. */
  level: number;
  /** Oleadas superadas. */
  waves: number;
  won: boolean;
  stars: number;
}

export interface TdRewards {
  tickets: number;
  candies: number;
  /** Estrellas conseguidas por primera vez (premio extra). */
  newStars: number;
  /** Nuevo récord del infinito. */
  newRecord: boolean;
  /** Primera vez que se supera este nivel. */
  firstClear: boolean;
}

/** Premio extra por cada estrella nueva. */
export const STAR_TICKETS = 6;
export const STAR_CANDIES = 1;

export function rewardsFor(o: TdOutcome, before: MapProgress, mapTier = 0): TdRewards {
  const w = Math.max(0, Math.floor(o.waves));
  if (o.level <= 0) {
    const newRecord = w > before.endless;
    return { tickets: Math.min(40, Math.floor(w / 2)), candies: Math.floor(w / 10) + (newRecord && w >= 10 ? 2 : 0), newStars: 0, newRecord, firstClear: false };
  }
  const stars = o.won ? Math.max(0, Math.min(3, o.stars)) : 0;
  const prev = before.stars[o.level - 1] ?? 0;
  const newStars = Math.max(0, stars - prev);
  const boss = o.level >= LEVELS_PER_MAP;
  return {
    tickets: Math.floor(w / 3) + (o.won ? 2 + Math.floor(mapTier / 3) : 0) + newStars * STAR_TICKETS + (boss && o.won && prev === 0 ? 20 : 0),
    candies: newStars * STAR_CANDIES + (boss && o.won && prev === 0 ? 5 : 0),
    newStars,
    newRecord: false,
    firstClear: o.won && prev === 0,
  };
}

export function withOutcome(p: TdProgress, o: TdOutcome): TdProgress {
  const cur = mapProgress(p, o.mapId);
  const next: MapProgress = { stars: [...cur.stars], endless: cur.endless };
  if (o.level <= 0) next.endless = Math.max(cur.endless, Math.floor(o.waves));
  else if (o.won && o.level <= LEVELS_PER_MAP) next.stars[o.level - 1] = Math.max(cur.stars[o.level - 1], Math.min(3, Math.max(1, o.stars)));
  return { maps: { ...p.maps, [o.mapId]: next } };
}

export function loadTdProgress(storage: StorageLike | null = activeStorage()): TdProgress {
  try {
    return parseTdProgress(storage?.getItem(TD_KEY) ?? null);
  } catch {
    return emptyTdProgress();
  }
}

/** Guarda el resultado y devuelve los premios (quien llama los suma con addTickets/addCandies). */
export function submitTdOutcome(o: TdOutcome, storage: StorageLike | null = activeStorage()): TdRewards {
  const p = loadTdProgress(storage);
  const tier = TD_MAPS.find((m) => m.id === o.mapId)?.tier ?? 0;
  const rewards = rewardsFor(o, mapProgress(p, o.mapId), tier);
  try {
    storage?.setItem(TD_KEY, JSON.stringify({ v: TD_VERSION, ...withOutcome(p, o) }));
  } catch {
    // sin almacenamiento
  }
  return rewards;
}
