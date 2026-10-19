// Progreso guardado en el navegador. La lógica usa una interfaz mínima de almacenamiento
// para poder testearla sin navegador; si localStorage no está disponible, no guarda y sigue.

import { parseAudio, type AudioSettings } from './sounds.ts';
import { parseShinies } from './shiny.ts';
import { levelsFor, parseUpgrades, upgradeCost, type UpgradeBook, type UpgradeKind } from './upgrades.ts';
import { emptyRecords, parseRecords, withRecord, type GameMode, type Records } from './modes.ts';
import { applyMissionEvent, parseMissions, type Completed, type MissionEvent, type MissionState } from './missions.ts';
import { dayNumber } from './gacha.ts';
import { parseTutorial, type TutorialState } from './tutorial.ts';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  /** Opcional (localStorage lo tiene): para "Borrar progreso". */
  removeItem?(key: string): void;
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
/**
 * Tickets por sala de combate limpiada y por vencer al jefe (× número de piso). Ajustables.
 * T32: antes 15 y 60 (una partida completa daba ~2100 tickets); ahora una partida buena da ~30-60, una tirada
 * del gacha cada 2-3 partidas.
 */
export const ROOM_TICKETS = 1;
export const BOSS_TICKETS = 1;

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

// --- Volumen de música y efectos (ver sounds.ts) ---

export const AUDIO_KEY = 'pokeisaac.audio';

export function loadAudio(storage: StorageLike | null = browserStorage()): AudioSettings {
  try {
    return parseAudio(storage?.getItem(AUDIO_KEY) ?? null);
  } catch {
    return parseAudio(null);
  }
}

export function saveAudio(settings: AudioSettings, storage: StorageLike | null = browserStorage()) {
  try {
    storage?.setItem(AUDIO_KEY, JSON.stringify(parseAudio(JSON.stringify(settings))));
  } catch {
    // sin almacenamiento: no se guarda
  }
}

// --- Mejoras permanentes por Pokémon (ver upgrades.ts) ---

export const UPGRADES_KEY = 'pokeisaac.upgrades';

export function loadUpgrades(storage: StorageLike | null = browserStorage()): UpgradeBook {
  try {
    return parseUpgrades(storage?.getItem(UPGRADES_KEY) ?? null);
  } catch {
    return {};
  }
}

export type BuyUpgradeResult = 'ok' | 'max' | 'poor';

/** Compra un nivel de una mejora de un Pokémon con tickets. */
export function buyUpgrade(id: number, kind: UpgradeKind, storage: StorageLike | null = browserStorage()): BuyUpgradeResult {
  const book = loadUpgrades(storage);
  const lv = levelsFor(book, id);
  const cost = upgradeCost(lv[kind]);
  if (cost === null) return 'max';
  if (!spendTickets(cost, storage)) return 'poor';
  book[id] = { ...lv, [kind]: lv[kind] + 1 };
  try {
    storage?.setItem(UPGRADES_KEY, JSON.stringify(book));
  } catch {
    // sin almacenamiento: no se guarda
  }
  return 'ok';
}

// --- Shinies conseguidos (ver shiny.ts) ---

export const SHINIES_KEY = 'pokeisaac.shinies';

export function loadShinies(storage: StorageLike | null = browserStorage()): number[] {
  try {
    return parseShinies(storage?.getItem(SHINIES_KEY) ?? null);
  } catch {
    return [];
  }
}

/** Guarda un shiny (y desbloquea el Pokémon si no lo tenías). Devuelve si era nuevo. */
export function addShiny(id: number, storage: StorageLike | null = browserStorage()): boolean {
  const list = loadShinies(storage);
  unlockPokemon(id, storage);
  if (list.includes(id)) return false;
  list.push(id);
  try {
    storage?.setItem(SHINIES_KEY, JSON.stringify(list));
  } catch {
    // sin almacenamiento: no se guarda
  }
  return true;
}

// --- Misiones diarias y logros (ver missions.ts) ---

export const MISSIONS_KEY = 'pokeisaac.missions';

export function loadMissions(day = dayNumber(), storage: StorageLike | null = browserStorage()): MissionState {
  try {
    return parseMissions(storage?.getItem(MISSIONS_KEY) ?? null, day);
  } catch {
    return parseMissions(null, day);
  }
}

/**
 * Suma un suceso de la partida a las misiones y logros, guarda y entrega los premios de lo que se complete
 * (tickets y desbloqueos). Devuelve lo completado para avisar en la partida.
 */
export function recordMission(e: MissionEvent, day = dayNumber(), storage: StorageLike | null = browserStorage()): Completed[] {
  const { state, completed } = applyMissionEvent(loadMissions(day, storage), e, day);
  try {
    storage?.setItem(MISSIONS_KEY, JSON.stringify(state));
  } catch {
    // sin almacenamiento: no se guarda
  }
  for (const c of completed) {
    addTickets(c.reward.tickets, storage);
    if (c.reward.pokemon) unlockPokemon(c.reward.pokemon, storage);
  }
  return completed;
}

// --- Tutorial: consejos vistos (ver tutorial.ts) ---

export const TUTORIAL_KEY = 'pokeisaac.tutorial';

export function loadTutorial(storage: StorageLike | null = browserStorage()): TutorialState {
  try {
    return parseTutorial(storage?.getItem(TUTORIAL_KEY) ?? null);
  } catch {
    return parseTutorial(null);
  }
}

export function saveTutorial(state: TutorialState, storage: StorageLike | null = browserStorage()) {
  try {
    storage?.setItem(TUTORIAL_KEY, JSON.stringify(state));
  } catch {
    // sin almacenamiento: los consejos vuelven a salir
  }
}

// --- Borrar progreso (Ajustes) ---

/** Todo lo que se pierde al borrar el progreso: desbloqueos, tickets, récords y partidas. El volumen se queda. */
export const PROGRESS_KEYS: readonly string[] = [
  UNLOCKED_KEY,
  TICKETS_KEY,
  COINS_KEY,
  RECORDS_KEY,
  UPGRADES_KEY,
  SHINIES_KEY,
  MISSIONS_KEY,
  TUTORIAL_KEY,
  'pokeisaac.run.0',
  'pokeisaac.run.1',
  'pokeisaac.run.2',
];

/** Vuelve a empezar de cero: al abrir "Jugar" tocará elegir región e inicial otra vez. */
export function resetProgress(storage: StorageLike | null = browserStorage()) {
  if (!storage) return;
  for (const key of PROGRESS_KEYS) {
    try {
      if (storage.removeItem) storage.removeItem(key);
      else storage.setItem(key, '');
    } catch {
      // sin almacenamiento: nada que borrar
    }
  }
}
