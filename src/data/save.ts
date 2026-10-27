// Progreso guardado. La lógica usa una interfaz mínima de almacenamiento (storage.ts) para poder testearla sin
// navegador; en el juego es memoria (invitado), la nube (cuenta, T45) o el navegador (pruebas).

import { parseAudio, type AudioSettings } from './sounds.ts';
import { parseShinies } from './shiny.ts';
import { levelsFor, parseUpgrades, upgradeCost, type UpgradeBook, type UpgradeKind } from './upgrades.ts';
import { nodeState } from './upgradeTree.ts';
import { activeStorage, type StorageLike } from './storage.ts';
import { emptyRecords, parseRecords, withRecord, type GameMode, type Records } from './modes.ts';
import { applyMissionEvent, offerNpcMission, parseMissions, type Completed, type MissionEvent, type MissionState, type NpcMission } from './missions.ts';
import { dayNumber } from './gacha.ts';
import { addSeed, parseGarden, takeBasket, type GardenBerryId, type GardenState } from './berries.ts';
import { awardMedal, parseMedals, type MedalAward } from './medals.ts';
import { KONAMI_KEY } from './easterEggs.ts';
import { parseDefeated } from './runDex.ts';
import { recordsKeyFor, type Difficulty } from './difficulty.ts';
import { parseFx, type FxSettings } from './fxSettings.ts';
import { emptyDaily, parseDaily, startDaily, withDailyResult, type DailyState } from './daily.ts';
import { parseTutorial, type TutorialState } from './tutorial.ts';
import { parseHistory, withRun, type RunRecord } from './runHistory.ts';
import { parseKeys, type KeyMap } from './keybinds.ts';
import { parseSeedBests, seedBest, withSeedBest } from './seedCode.ts';

export type { StorageLike } from './storage.ts';

export const UNLOCKED_KEY = 'pokeisaac.unlocked';

/**
 * Iniciales que tenía todo el mundo antes de poder elegir región (Bulbasaur, Charmander y Squirtle).
 * Quien ya jugaba los conserva; quien empieza de cero elige región e inicial.
 */
export const DEFAULT_STARTERS: readonly number[] = [1, 4, 7];

/** Formato actual de los desbloqueos: `{ v: 2, ids: [...] }`. El antiguo era un array y sumaba DEFAULT_STARTERS. */
export const UNLOCKED_VERSION = 2;

/** El almacenamiento en uso: memoria (invitado), nube (cuenta) o el navegador (pruebas). Ver storage.ts (T45). */
const browserStorage = (): StorageLike | null => activeStorage();

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
 * T32: antes 15 y 60 (una partida completa daba ~2100 tickets). Con el gacha a 10 por tirada (19/10): llegar al
 * piso 3 da ~33 (3 tiradas), la partida completa ~70 (7) y con el reto final ~136 (ver tests/balance.test.ts).
 */
export const ROOM_TICKETS = 3;
export const BOSS_TICKETS = 2;

// --- Caramelos: la moneda de las mejoras de estadísticas (los tickets quedan solo para el gacha) ---

export const CANDIES_KEY = 'pokeisaac.candies';
/** Caramelos que se ganan por cada ticket de la partida (misma regla: salas, minijefes y jefes, con la dificultad). */
export const CANDY_PER_TICKET = 3;

export function parseCandies(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export function loadCandies(storage: StorageLike | null = browserStorage()): number {
  try {
    return parseCandies(storage?.getItem(CANDIES_KEY) ?? null);
  } catch {
    return 0;
  }
}

function saveCandies(n: number, storage: StorageLike | null) {
  try {
    storage?.setItem(CANDIES_KEY, String(n));
  } catch {
    // sin almacenamiento: no se guarda
  }
}

export function addCandies(amount: number, storage: StorageLike | null = browserStorage()): number {
  const total = loadCandies(storage) + (Number.isInteger(amount) && amount > 0 ? amount : 0);
  saveCandies(total, storage);
  return total;
}

export function spendCandies(amount: number, storage: StorageLike | null = browserStorage()): boolean {
  const have = loadCandies(storage);
  if (!Number.isInteger(amount) || amount < 0 || have < amount) return false;
  saveCandies(have - amount, storage);
  return true;
}

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

// --- Medallas de gimnasio (ver medals.ts) ---

export const DEX_KEY = 'pokeisaac.dexdefeated';
/** T63: ids de las especies que has derrotado alguna vez (registro de combate). */
export function loadDefeated(storage: StorageLike | null = browserStorage()): number[] {
  try {
    return parseDefeated(storage?.getItem(DEX_KEY) ?? null);
  } catch {
    return [];
  }
}

export function saveDefeated(ids: readonly number[], storage: StorageLike | null = browserStorage()) {
  try {
    storage?.setItem(DEX_KEY, JSON.stringify(parseDefeated(JSON.stringify(ids))));
  } catch {
    // sin almacenamiento: no se guarda
  }
}

export const MEDALS_KEY = 'pokeisaac.medals';

export function loadMedals(storage: StorageLike | null = browserStorage()): string[] {
  try {
    return parseMedals(storage?.getItem(MEDALS_KEY) ?? null);
  } catch {
    return [];
  }
}

/** Anota la medalla del bioma si es nueva y suma sus tickets. */
export function earnMedal(biomeId: string, storage: StorageLike | null = browserStorage()): MedalAward {
  const award = awardMedal(loadMedals(storage), biomeId);
  if (award.gained) {
    try {
      storage?.setItem(MEDALS_KEY, JSON.stringify(award.medals));
    } catch {
      // sin almacenamiento: no se guarda
    }
  }
  return award;
}

// --- Récords de cada modo (ver modes.ts) ---

export const RECORDS_KEY = 'pokeisaac.records';

/** Récords de una dificultad (T40): cada una tiene los suyos; los de Normal son los de siempre. */
export function loadRecords(storage: StorageLike | null = browserStorage(), diff: Difficulty = 'normal'): Records {
  try {
    return parseRecords(storage?.getItem(recordsKeyFor(RECORDS_KEY, diff)) ?? null);
  } catch {
    return emptyRecords();
  }
}

/** Guarda el resultado si mejora el récord del modo; devuelve si lo ha mejorado. */
export function submitRecord(mode: GameMode, value: number, storage: StorageLike | null = browserStorage(), diff: Difficulty = 'normal'): boolean {
  const { records, improved } = withRecord(loadRecords(storage, diff), mode, value);
  if (improved) {
    try {
      storage?.setItem(recordsKeyFor(RECORDS_KEY, diff), JSON.stringify(records));
    } catch {
      // sin almacenamiento: no se guarda
    }
  }
  return improved;
}

// --- Desafío diario (ver daily.ts) ---

export const DAILY_KEY = 'pokeisaac.daily';

export function loadDaily(storage: StorageLike | null = browserStorage()): DailyState {
  try {
    return parseDaily(storage?.getItem(DAILY_KEY) ?? null);
  } catch {
    return emptyDaily();
  }
}

function saveDaily(s: DailyState, storage: StorageLike | null) {
  try {
    storage?.setItem(DAILY_KEY, JSON.stringify(s));
  } catch {
    // sin almacenamiento: no se guarda
  }
}

/** Empieza una partida del desafío de `day`; devuelve si cuenta (la primera del día). */
export function beginDaily(day: number, storage: StorageLike | null = browserStorage()): boolean {
  const { state, counts } = startDaily(loadDaily(storage), day);
  if (counts) saveDaily(state, storage);
  return counts;
}

/** Resultado de la partida que contaba ese día (pisos completados); devuelve si es el mejor de siempre. */
export function submitDaily(day: number, floors: number, storage: StorageLike | null = browserStorage()): boolean {
  const { state, newBest } = withDailyResult(loadDaily(storage), day, floors);
  saveDaily(state, storage);
  return newBest;
}

// --- T81: mejor resultado de cada código de semilla (ver seedCode.ts) ---

export const SEED_BESTS_KEY = 'pokeisaac.seedBests';

/** Mejor resultado guardado de un código (0 si nunca se jugó). */
export function loadSeedBest(code: string, storage: StorageLike | null = browserStorage()): number {
  try {
    return seedBest(parseSeedBests(storage?.getItem(SEED_BESTS_KEY) ?? null), code);
  } catch {
    return 0;
  }
}

/** Guarda el resultado de una partida con código si mejora el suyo; devuelve si lo ha mejorado. */
export function submitSeedBest(code: string, value: number, storage: StorageLike | null = browserStorage()): boolean {
  try {
    const { bests, improved } = withSeedBest(parseSeedBests(storage?.getItem(SEED_BESTS_KEY) ?? null), code, value);
    if (improved) storage?.setItem(SEED_BESTS_KEY, JSON.stringify(bests));
    return improved;
  } catch {
    return false;
  }
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

// --- Efectos visuales y FPS (T41, ver fxSettings.ts) ---

export const FX_KEY = 'pokeisaac.fx';

export function loadFx(storage: StorageLike | null = browserStorage()): FxSettings {
  try {
    return parseFx(storage?.getItem(FX_KEY) ?? null);
  } catch {
    return parseFx(null);
  }
}

export function saveFx(settings: FxSettings, storage: StorageLike | null = browserStorage()) {
  try {
    storage?.setItem(FX_KEY, JSON.stringify(parseFx(JSON.stringify(settings))));
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

export type BuyUpgradeResult = 'ok' | 'max' | 'poor' | 'locked';

/** Compra un nivel de una mejora de un Pokémon con caramelos. */
export function buyUpgrade(id: number, kind: UpgradeKind, storage: StorageLike | null = browserStorage()): BuyUpgradeResult {
  const book = loadUpgrades(storage);
  const lv = levelsFor(book, id);
  // T71: un nodo del árbol solo se compra con su padre ya comprado
  if (nodeState(kind, lv) === 'locked') return 'locked';
  const cost = upgradeCost(lv[kind], kind);
  if (cost === null) return 'max';
  if (!spendCandies(cost, storage)) return 'poor';
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
  return recordMissionEvent(e, day, storage).completed;
}

/** Como recordMission, pero también dice qué encargos de NPC han caducado (T87). */
export function recordMissionEvent(
  e: MissionEvent,
  day = dayNumber(),
  storage: StorageLike | null = browserStorage(),
): { completed: Completed[]; expired: NpcMission[] } {
  const { state, completed, expired } = applyMissionEvent(loadMissions(day, storage), e, day);
  try {
    storage?.setItem(MISSIONS_KEY, JSON.stringify(state));
  } catch {
    // sin almacenamiento: no se guarda
  }
  for (const c of completed) {
    addTickets(c.reward.tickets, storage);
    if (c.reward.pokemon) unlockPokemon(c.reward.pokemon, storage);
  }
  return { completed, expired };
}

/**
 * T87: un NPC ofrece un encargo y se acepta (si hay hueco, máximo 3). Devuelve el encargo o null.
 * Los invitados juegan con almacenamiento en memoria (storage.ts): lo pueden hacer, pero no se guarda al cerrar.
 */
export function acceptNpcMission(seed: number, day = dayNumber(), storage: StorageLike | null = browserStorage()): NpcMission | null {
  const r = offerNpcMission(loadMissions(day, storage), seed);
  if (!r) return null;
  try {
    storage?.setItem(MISSIONS_KEY, JSON.stringify(r.state));
  } catch {
    // sin almacenamiento: no se guarda
  }
  return r.mission;
}

// --- Huerto de bayas (T85, ver berries.ts) ---

export const GARDEN_KEY = 'pokeisaac.garden';

export function loadGarden(storage: StorageLike | null = browserStorage()): GardenState {
  try {
    return parseGarden(storage?.getItem(GARDEN_KEY) ?? null);
  } catch {
    return parseGarden(null);
  }
}

export function saveGarden(state: GardenState, storage: StorageLike | null = browserStorage()) {
  try {
    storage?.setItem(GARDEN_KEY, JSON.stringify(state));
  } catch {
    // sin almacenamiento: no se guarda
  }
}

/** Cambia el huerto con `f` y lo guarda. */
export function updateGarden(f: (g: GardenState) => GardenState, storage: StorageLike | null = browserStorage()): GardenState {
  const next = f(loadGarden(storage));
  saveGarden(next, storage);
  return next;
}

/** Semilla conseguida en la partida (cofre o tienda): va directa al huerto. */
export const gainSeed = (berry: GardenBerryId, storage: StorageLike | null = browserStorage()) =>
  updateGarden((g) => addSeed(g, berry), storage);

/** Al empezar partida: saca de la cesta las bayas que te llevas. */
export function takeGardenBerries(storage: StorageLike | null = browserStorage()): GardenBerryId[] {
  const r = takeBasket(loadGarden(storage));
  if (r.berries.length > 0) saveGarden(r.state, storage);
  return r.berries;
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

// --- Historial de partidas (ver runHistory.ts) ---

export const HISTORY_KEY = 'pokeisaac.history';

export function loadRunHistory(storage: StorageLike | null = browserStorage()): RunRecord[] {
  try {
    return parseHistory(storage?.getItem(HISTORY_KEY) ?? null);
  } catch {
    return [];
  }
}

/** Apunta una partida terminada (se quedan las últimas 20). */
export function addRunHistory(r: RunRecord, storage: StorageLike | null = browserStorage()): RunRecord[] {
  const list = withRun(loadRunHistory(storage), r);
  try {
    storage?.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    // sin almacenamiento: no se guarda
  }
  return list;
}

// --- Teclas (ver keybinds.ts). Como el volumen, no se borran con el progreso ---

export const KEYS_KEY = 'pokeisaac.keys';

export function loadKeys(storage: StorageLike | null = browserStorage()): KeyMap {
  try {
    return parseKeys(storage?.getItem(KEYS_KEY) ?? null);
  } catch {
    return parseKeys(null);
  }
}

export function saveKeys(keys: KeyMap, storage: StorageLike | null = browserStorage()) {
  try {
    storage?.setItem(KEYS_KEY, JSON.stringify(keys));
  } catch {
    // sin almacenamiento: se usan las de por defecto
  }
}

// --- Borrar progreso (Ajustes) ---

/** Todo lo que se pierde al borrar el progreso: desbloqueos, tickets, récords y partidas. El volumen se queda. */
export const PROGRESS_KEYS: readonly string[] = [
  DEX_KEY,
  UNLOCKED_KEY,
  TICKETS_KEY,
  CANDIES_KEY,
  COINS_KEY,
  RECORDS_KEY,
  recordsKeyFor(RECORDS_KEY, 'easy'),
  recordsKeyFor(RECORDS_KEY, 'hard'),
  DAILY_KEY,
  SEED_BESTS_KEY,
  UPGRADES_KEY,
  SHINIES_KEY,
  MISSIONS_KEY,
  GARDEN_KEY,
  MEDALS_KEY,
  KONAMI_KEY,
  TUTORIAL_KEY,
  HISTORY_KEY,
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
