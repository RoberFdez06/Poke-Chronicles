// Partida en curso guardada en 3 huecos, como en Isaac: se guarda sola (al entrar en una sala,
// al limpiarla, al coger un objeto y al salir desde la pausa) y se borra al morir o al ganar.
// Monedas y desbloqueos NO van aquí: son comunes a todos los huecos (ver save.ts).
// Lógica pura, sin Phaser, para poder testearla.
import type { StorageLike } from './save';
import type { MovePower } from './items';

export const RUN_SLOTS = 3;
/** v2: número de piso y jefes ya vistos (los guardados v1 se migran al piso 1). */
export const RUN_VERSION = 2;
export const runKey = (slot: number) => `pokeisaac.run.${slot}`;

/** Objeto en el suelo. Los pasivos se guardan por id (sus efectos están en items.ts). */
export type SavedDrop = { kind: 'passive'; id: string } | { kind: 'move'; move: MovePower };

export interface FloorItemSave {
  roomId: number;
  x: number;
  y: number;
  drop: SavedDrop;
}

export interface RunSave {
  version: number;
  /** Fecha del guardado (ms desde 1970). */
  savedAt: number;
  starterId: number;
  starterName: string;
  /** Piso en el que estás (1 = el primero). */
  floor: number;
  /** Jefes que ya han salido en la partida (para no repetirlos). */
  bossHistory: number[];
  /** El piso se regenera igual a partir de la semilla y el número de salas. */
  floorSeed: number;
  roomCount: number;
  bossId: number;
  /** Sala en la que estabas. Si no estaba limpia, al continuar se reinicia con los enemigos enteros. */
  roomId: number;
  visited: number[];
  cleared: number[];
  hp: number;
  passives: string[];
  slots: (MovePower | null)[];
  nextSlotReplace: number;
  movePool: MovePower[];
  floorItems: FloorItemSave[];
  /** Monedas ganadas en esta partida (ya están sumadas al total). */
  earned: number;
}

const isInt = (n: unknown): n is number => Number.isInteger(n);
const isIntArray = (a: unknown): a is number[] => Array.isArray(a) && a.every(isInt);

function isMove(m: unknown): m is MovePower {
  const o = m as MovePower;
  return !!o && typeof o.name === 'string' && typeof o.type === 'string' && typeof o.power === 'number' &&
    typeof o.shape === 'string' && typeof o.cooldown === 'number';
}

function isDrop(d: unknown): d is SavedDrop {
  const o = d as SavedDrop;
  if (!o) return false;
  if (o.kind === 'passive') return typeof o.id === 'string';
  return o.kind === 'move' && isMove(o.move);
}

/** v1 no tenía pisos: la partida estaba siempre en el primero. */
function migrateV1(d: RunSave): RunSave {
  return { ...d, version: 2, floor: 1, bossHistory: isInt(d.bossId) ? [d.bossId] : [] };
}

/** Lee un guardado; si está corrupto o es de otra versión, devuelve null (hueco vacío). */
export function parseRun(raw: string | null): RunSave | null {
  if (!raw) return null;
  let d: RunSave;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!d || typeof d !== 'object') return null;
  if (d.version === 1) d = migrateV1(d);
  if (d.version !== RUN_VERSION) return null;
  const ok =
    isInt(d.savedAt) && isInt(d.starterId) && typeof d.starterName === 'string' &&
    isInt(d.floor) && d.floor >= 1 && isIntArray(d.bossHistory) &&
    isInt(d.floorSeed) && isInt(d.roomCount) && isInt(d.bossId) && isInt(d.roomId) &&
    isIntArray(d.visited) && isIntArray(d.cleared) && typeof d.hp === 'number' && d.hp > 0 &&
    Array.isArray(d.passives) && d.passives.every((p) => typeof p === 'string') &&
    Array.isArray(d.slots) && d.slots.every((m) => m === null || isMove(m)) &&
    isInt(d.nextSlotReplace) && Array.isArray(d.movePool) && d.movePool.every(isMove) &&
    Array.isArray(d.floorItems) &&
    d.floorItems.every((f) => !!f && isInt(f.roomId) && typeof f.x === 'number' && typeof f.y === 'number' && isDrop(f.drop)) &&
    isInt(d.earned);
  return ok ? d : null;
}

function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const validSlot = (slot: number) => isInt(slot) && slot >= 0 && slot < RUN_SLOTS;

export function loadRun(slot: number, storage: StorageLike | null = browserStorage()): RunSave | null {
  if (!validSlot(slot)) return null;
  try {
    return parseRun(storage?.getItem(runKey(slot)) ?? null);
  } catch {
    return null;
  }
}

/** Los 3 huecos en orden; null = vacío. */
export function loadAllRuns(storage: StorageLike | null = browserStorage()): (RunSave | null)[] {
  return Array.from({ length: RUN_SLOTS }, (_, i) => loadRun(i, storage));
}

export function saveRun(slot: number, run: RunSave, storage: StorageLike | null = browserStorage()): boolean {
  if (!validSlot(slot)) return false;
  try {
    storage?.setItem(runKey(slot), JSON.stringify(run));
    return !!storage;
  } catch {
    return false; // sin espacio o sin almacenamiento
  }
}

/** Borra la partida del hueco (al morir o al completar el piso). Se guarda vacío para no depender de removeItem. */
export function clearRun(slot: number, storage: StorageLike | null = browserStorage()) {
  if (!validSlot(slot)) return;
  try {
    storage?.setItem(runKey(slot), '');
  } catch {
    // nada
  }
}
