// Easter eggs (supervisor, pedidos por Roberto el 20/10). Lógica pura y testeable:
//  - Código Konami en la pantalla de título: la próxima tirada del gacha sale shiny (una vez al día).
//  - Vendedor de Magikarp: a veces el mercader ambulante vende un Magikarp que no hace nada... hasta que evoluciona.
//  - Salas secretas raras: MissingNo. (duplica el objeto) o el camión (¿habrá un Mew debajo?).
//  - Profesor Oak: "¡No es momento de usar eso!" al usar algo que no se puede usar.
import { activeStorage, type StorageLike } from './storage.ts';
import { mulberry32 } from '../level/floorGen.ts';

// --- Código Konami ---

/** ↑ ↑ ↓ ↓ ← → ← → B A (nombres de tecla de Phaser/KeyboardEvent.code). */
export const KONAMI: readonly string[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

/** Avance de la secuencia tras pulsar `key`: el nuevo número de aciertos (10 = completo). */
export function konamiStep(progress: number, key: string): number {
  if (KONAMI[progress] === key) return progress + 1;
  // Si falla, puede que esta tecla empiece la secuencia otra vez (↑ ↑ ↑ …)
  return KONAMI[0] === key ? (progress >= 2 && key === 'up' ? 2 : 1) : 0;
}

export const KONAMI_KEY = 'pokeisaac.konami';

interface KonamiState {
  /** Último día en que se activó. */
  day: number;
  /** Si queda una tirada shiny por usar. */
  armed: boolean;
}

export function parseKonami(raw: string | null): KonamiState {
  try {
    const v = JSON.parse(raw ?? '') as Partial<KonamiState>;
    return { day: Number.isInteger(v.day) ? (v.day as number) : -1, armed: v.armed === true };
  } catch {
    return { day: -1, armed: false };
  }
}

/** Activa el código hoy. Devuelve false si ya se usó hoy. */
export function armKonami(day: number, storage: StorageLike | null = activeStorage()): boolean {
  const s = parseKonami(storage?.getItem(KONAMI_KEY) ?? null);
  if (s.day === day) return false;
  try {
    storage?.setItem(KONAMI_KEY, JSON.stringify({ day, armed: true }));
  } catch {
    // sin almacenamiento
  }
  return true;
}

/** Gasta la tirada shiny si la hay (la usa el gacha). */
export function takeKonamiShiny(storage: StorageLike | null = activeStorage()): boolean {
  const s = parseKonami(storage?.getItem(KONAMI_KEY) ?? null);
  if (!s.armed) return false;
  try {
    storage?.setItem(KONAMI_KEY, JSON.stringify({ day: s.day, armed: false }));
  } catch {
    // sin almacenamiento
  }
  return true;
}

// --- Vendedor de Magikarp ---

export const MAGIKARP_CHANCE = 0.25;
/** "¡Solo 500 ₽!": aquí, 5 monedas. */
export const MAGIKARP_PRICE = 5;
export const MAGIKARP = 'magikarp';
export const GYARADOS = 'gyarados';

/** ¿Este mercader trae a Magikarp? Nunca si ya tienes Magikarp o Gyarados. */
export const sellsMagikarp = (roll: number, owned: readonly string[]): boolean =>
  roll < MAGIKARP_CHANCE && !owned.includes(MAGIKARP) && !owned.includes(GYARADOS);

/** Al bajar de piso, Magikarp evoluciona: devuelve la lista nueva y si ha evolucionado. */
export function evolveMagikarp(passives: readonly string[]): { passives: string[]; evolved: boolean } {
  const k = passives.indexOf(MAGIKARP);
  if (k < 0) return { passives: [...passives], evolved: false };
  const next = [...passives];
  next[k] = GYARADOS;
  return { passives: next, evolved: true };
}

// --- Salas secretas raras ---

export type SecretVariant = 'normal' | 'missingno' | 'truck';
// Raras de verdad (26/10: con un 15 % cada una, 3 de cada 10 salas secretas eran un huevo de pascua y se hacía pesado)
export const MISSINGNO_CHANCE = 0.04;
export const TRUCK_CHANCE = 0.06;
/** Probabilidad de que debajo del camión haya un Mew (deja un objeto). */
export const MEW_CHANCE = 0.12;

/** Variante de la sala secreta (siempre la misma para la misma semilla y sala). */
export function secretVariant(floorSeed: number, roomId: number): SecretVariant {
  const r = mulberry32((floorSeed ^ Math.imul(roomId + 7, 0x85ebca6b)) >>> 0)();
  if (r < MISSINGNO_CHANCE) return 'missingno';
  if (r < MISSINGNO_CHANCE + TRUCK_CHANCE) return 'truck';
  return 'normal';
}

// --- Profesor Oak ---

export const OAK_LINE = 'Profesor Oak: «¡No es momento de usar eso!»';
