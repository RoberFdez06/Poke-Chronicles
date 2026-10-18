// Progreso guardado en el navegador. La lógica usa una interfaz mínima de almacenamiento
// para poder testearla sin navegador; si localStorage no está disponible, no guarda y sigue.

import { emptyRecords, parseRecords, withRecord, type GameMode, type Records } from './modes.ts';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const UNLOCKED_KEY = 'pokeisaac.unlocked';

/**
 * Iniciales que tenía todo el mundo antes de poder elegir región (Bulbasaur, Charmander y Squirtle).
 * Quien ya jugaba los conserva; quien empieza de cero elige región e inicial.
 */
export const DEFAULT_STARTERS: readonly number[] = [1, 4, 7];

/** Formato actual de los desbloqueos: `{ v: 2, ids: [...] }`. El antiguo era un array y sumaba DEFAULT_STARTERS. */
export const UNLOCKED_VERSION = 2;

function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // modo privado o datos bloqueados
  }
}

const validIds = (data: unknown[]): number[] => [
  ...new Set(data.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0)),
];

/**
 * Convierte lo guardado en la lista de Pokémon desbloqueados.
 * - Nada guardado: lista vacía (primera partida: hay que elegir región e inicial).
 * - Formato antiguo (array): migra sumando los iniciales de siempre.
 * - Corrupto: los iniciales de siempre, para no dejar a nadie sin Pokémon.
 */
export function parseUnlocked(raw: string | null): number[] {
  if (raw === null) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (Array.isArray(data)) return validIds([...DEFAULT_STARTERS, ...data]);
    if (data && typeof data === 'object' && Array.isArray((data as { ids?: unknown }).ids)) {
      return validIds((data as { ids: unknown[] }).ids);
    }
  } catch {
    // guardado corrupto
  }
  return [...DEFAULT_STARTERS];
}

/** Antes los desbloqueos solo se guardaban al usar el gacha: quien tenga tickets (antes "monedas") o partidas ya jugaba. */
function hasOldProgress(storage: StorageLike): boolean {
  if (storage.getItem(COINS_KEY) !== null || storage.getItem(TICKETS_KEY) !== null) return true;
  for (let i = 0; i < 3; i++) if (storage.getItem(`pokeisaac.run.${i}`) !== null) return true;
  return false;
}

export function loadUnlocked(storage: StorageLike | null = browserStorage()): number[] {
  try {
    if (!storage) return [];
    const raw = storage.getItem(UNLOCKED_KEY);
    if (raw === null && hasOldProgress(storage)) return [...DEFAULT_STARTERS];
    return parseUnlocked(raw);
  } catch {
    return [...DEFAULT_STARTERS];
  }
}

/** Primera partida: aún no tienes ningún Pokémon y toca elegir región e inicial. */
export const needsFirstStarter = (storage: StorageLike | null = browserStorage()): boolean =>
  loadUnlocked(storage).length === 0;

/** Desbloquea un Pokémon y devuelve la lista actualizada. */
export function unlockPokemon(id: number, storage: StorageLike | null = browserStorage()): number[] {
  const list = loadUnlocked(storage);
  if (Number.isInteger(id) && id > 0 && !list.includes(id)) list.push(id);
  try {
    storage?.setItem(UNLOCKED_KEY, JSON.stringify({ v: UNLOCKED_VERSION, ids: list }));
  } catch {
    // sin almacenamiento: no se guarda
  }
  return list;
}

// --- Tickets (se ganan jugando; nunca se compran con dinero real) ---
// Se gastan fuera de la partida (gacha). No confundir con las monedas de la partida (loot.ts), que se
// pierden al acabarla. Antes los tickets se llamaban "monedas" y se guardaban en COINS_KEY.

export const TICKETS_KEY = 'pokeisaac.tickets';
/** Clave antigua del saldo: se migra a TICKETS_KEY la primera vez que se lee. */
export const COINS_KEY = 'pokeisaac.coins';
/** Tickets por sala de combate limpiada y por vencer al jefe. Ajustables. */
export const ROOM_TICKETS = 15;
export const BOSS_TICKETS = 60;

export function parseTickets(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export function loadTickets(storage: StorageLike | null = browserStorage()): number {
  try {
    const raw = storage?.getItem(TICKETS_KEY) ?? null;
    if (raw !== null) return parseTickets(raw);
    // Migración: el saldo de "monedas" de antes pasa a ser de tickets
    const old = parseTickets(storage?.getItem(COINS_KEY) ?? null);
    if (old > 0) saveTickets(old, storage);
    return old;
  } catch {
    return 0;
  }
}

function saveTickets(n: number, storage: StorageLike | null) {
  try {
    storage?.setItem(TICKETS_KEY, String(n));
  } catch {
    // sin almacenamiento: no se guarda
  }
}

/** Suma tickets (ignora cantidades no válidas) y devuelve el total. */
export function addTickets(amount: number, storage: StorageLike | null = browserStorage()): number {
  const total = loadTickets(storage) + (Number.isInteger(amount) && amount > 0 ? amount : 0);
  saveTickets(total, storage);
  return total;
}

/** Gasta tickets si hay suficientes; devuelve true si pudo. */
export function spendTickets(amount: number, storage: StorageLike | null = browserStorage()): boolean {
  const have = loadTickets(storage);
  if (!Number.isInteger(amount) || amount < 0 || have < amount) return false;
  saveTickets(have - amount, storage);
  return true;
}

// --- Récords de cada modo (ver modes.ts) ---

export const RECORDS_KEY = 'pokeisaac.records';

export function loadRecords(storage: StorageLike | null = browserStorage()): Records {
  try {
    return parseRecords(storage?.getItem(RECORDS_KEY) ?? null);
  } catch {
    return emptyRecords();
  }
}

/** Guarda el resultado si mejora el récord del modo; devuelve si lo ha mejorado. */
export function submitRecord(mode: GameMode, value: number, storage: StorageLike | null = browserStorage()): boolean {
  const { records, improved } = withRecord(loadRecords(storage), mode, value);
  if (improved) {
    try {
      storage?.setItem(RECORDS_KEY, JSON.stringify(records));
    } catch {
      // sin almacenamiento: no se guarda
    }
  }
  return improved;
}
