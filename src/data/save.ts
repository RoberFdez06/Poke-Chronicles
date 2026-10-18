// Progreso guardado en el navegador. La lógica usa una interfaz mínima de almacenamiento
// para poder testearla sin navegador; si localStorage no está disponible, no guarda y sigue.

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const UNLOCKED_KEY = 'pokeisaac.unlocked';

/** Iniciales disponibles desde el principio: Bulbasaur, Charmander y Squirtle. */
export const DEFAULT_STARTERS: readonly number[] = [1, 4, 7];

function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // modo privado o datos bloqueados
  }
}

/** Convierte lo guardado en la lista de Pokémon desbloqueados; siempre incluye los iniciales por defecto. */
export function parseUnlocked(raw: string | null): number[] {
  let extra: number[] = [];
  try {
    const data: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(data)) extra = data.filter((n): n is number => Number.isInteger(n) && n > 0);
  } catch {
    // guardado corrupto: se ignora
  }
  return [...new Set([...DEFAULT_STARTERS, ...extra])];
}

export function loadUnlocked(storage: StorageLike | null = browserStorage()): number[] {
  try {
    return parseUnlocked(storage?.getItem(UNLOCKED_KEY) ?? null);
  } catch {
    return parseUnlocked(null);
  }
}

/** Desbloquea un Pokémon y devuelve la lista actualizada. */
export function unlockPokemon(id: number, storage: StorageLike | null = browserStorage()): number[] {
  const list = loadUnlocked(storage);
  if (!list.includes(id)) list.push(id);
  try {
    storage?.setItem(UNLOCKED_KEY, JSON.stringify(list));
  } catch {
    // sin almacenamiento: no se guarda
  }
  return list;
}

// --- Monedas (se ganan jugando; nunca se compran con dinero real) ---

export const COINS_KEY = 'pokeisaac.coins';
/** Monedas por sala de combate limpiada y por vencer al jefe. Ajustables. */
export const ROOM_COINS = 15;
export const BOSS_COINS = 60;

export function parseCoins(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export function loadCoins(storage: StorageLike | null = browserStorage()): number {
  try {
    return parseCoins(storage?.getItem(COINS_KEY) ?? null);
  } catch {
    return 0;
  }
}

function saveCoins(n: number, storage: StorageLike | null) {
  try {
    storage?.setItem(COINS_KEY, String(n));
  } catch {
    // sin almacenamiento: no se guarda
  }
}

/** Suma monedas (ignora cantidades no válidas) y devuelve el total. */
export function addCoins(amount: number, storage: StorageLike | null = browserStorage()): number {
  const total = loadCoins(storage) + (Number.isInteger(amount) && amount > 0 ? amount : 0);
  saveCoins(total, storage);
  return total;
}

/** Gasta monedas si hay suficientes; devuelve true si pudo. */
export function spendCoins(amount: number, storage: StorageLike | null = browserStorage()): boolean {
  const have = loadCoins(storage);
  if (!Number.isInteger(amount) || amount < 0 || have < amount) return false;
  saveCoins(have - amount, storage);
  return true;
}
