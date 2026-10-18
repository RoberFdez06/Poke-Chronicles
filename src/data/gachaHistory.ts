// Historial de las últimas tiradas del gacha (para el escaparate). Lógica pura con almacenamiento inyectable.
import type { StorageLike } from './save.ts';
import { RARITIES, type Rarity } from './gacha.ts';

export const HISTORY_KEY = 'pokeisaac.gachaHistory';
export const HISTORY_MAX = 12;

export interface HistoryEntry {
  id: number;
  rarity: Rarity;
  shiny: boolean;
  /** ms desde 1970 */
  at: number;
}

function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function parseHistory(raw: string | null): HistoryEntry[] {
  try {
    const d: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(d)) return [];
    return d
      .filter(
        (e): e is HistoryEntry =>
          !!e && Number.isInteger(e.id) && e.id > 0 && (RARITIES as readonly string[]).includes(e.rarity) &&
          typeof e.shiny === 'boolean' && Number.isFinite(e.at),
      )
      .slice(0, HISTORY_MAX);
  } catch {
    return [];
  }
}

export function loadHistory(storage: StorageLike | null = browserStorage()): HistoryEntry[] {
  try {
    return parseHistory(storage?.getItem(HISTORY_KEY) ?? null);
  } catch {
    return [];
  }
}

/** Añade tiradas al principio (la más nueva primero) y guarda solo las últimas HISTORY_MAX. */
export function pushHistory(entries: HistoryEntry[], storage: StorageLike | null = browserStorage()): HistoryEntry[] {
  const list = [...[...entries].reverse(), ...loadHistory(storage)].slice(0, HISTORY_MAX);
  try {
    storage?.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    // sin almacenamiento
  }
  return list;
}
