// Registro de combate (T63): qué especies has derrotado alguna vez y cuánto llevas de cada tipo. Al cruzar el 25, 50,
// 75 y 100 % de un tipo hay caramelos de premio. Lógica pura, sin Phaser, para poder testearla. El guardado está en
// save.ts (en una cuenta se sube a la nube; un invitado lo pierde al cerrar, como todo lo demás).
import type { SpeciesFact } from './gacha.ts';
import { TYPE_COLORS } from './types.ts';

/** Porcentajes de un tipo que dan premio, y los caramelos de cada uno (el último es completar el tipo entero). */
export const DEX_MILESTONES: readonly number[] = [25, 50, 75, 100];
export const DEX_CANDIES: Readonly<Record<number, number>> = { 25: 2, 50: 3, 75: 5, 100: 15 };

/** Lee la lista guardada: solo números enteros positivos, sin repetir. */
export function parseDefeated(raw: string | null): number[] {
  try {
    const v: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(v)) return [];
    return [...new Set(v.filter((x): x is number => Number.isInteger(x) && x > 0))];
  } catch {
    return [];
  }
}

/** Lo que hace falta saber de la lista de especies: cuántas hay de cada tipo y de qué tipos es cada una. */
export interface DexIndex {
  totals: Record<string, number>;
  types: Map<number, string[]>;
}

/** Cuenta las especies por tipo (una de dos tipos cuenta en los dos). */
export function buildDexIndex(index: readonly Pick<SpeciesFact, 'id' | 'types'>[]): DexIndex {
  const totals: Record<string, number> = {};
  const types = new Map<number, string[]>();
  for (const s of index) {
    if (types.has(s.id)) continue;
    const ts = s.types ?? [];
    types.set(s.id, ts);
    for (const t of ts) totals[t] = (totals[t] ?? 0) + 1;
  }
  return { totals, types };
}

/** Cuántas especies de cada tipo has derrotado. */
export function countByType(defeated: Iterable<number>, dx: DexIndex): Record<string, number> {
  const done: Record<string, number> = {};
  for (const id of defeated) for (const t of dx.types.get(id) ?? []) done[t] = (done[t] ?? 0) + 1;
  return done;
}

export interface TypeProgress {
  type: string;
  total: number;
  done: number;
  /** Porcentaje entero (0-100). */
  percent: number;
}

/** Progreso por tipo, en el orden de los colores de tipo del juego (los que no existen en la lista no salen). */
export function typeProgress(defeated: Iterable<number>, dx: DexIndex): TypeProgress[] {
  const done = countByType(defeated, dx);
  return Object.keys(TYPE_COLORS)
    .filter((t) => (dx.totals[t] ?? 0) > 0)
    .map((type) => {
      const total = dx.totals[type];
      const n = done[type] ?? 0;
      return { type, total, done: n, percent: Math.floor((n * 100) / total) };
    });
}

export interface DexReward {
  type: string;
  /** Hito que se acaba de cruzar (25, 50, 75 o 100). */
  percent: number;
  candies: number;
}

export interface DexGain {
  /** Es la primera vez que derrotas esta especie. */
  isNew: boolean;
  rewards: DexReward[];
}

/**
 * Anota una especie derrotada (añade `id` a `defeated`) y devuelve los premios de los hitos que cruza en cada uno de
 * sus tipos. Una especie ya anotada, o que no está en la lista, no da nada.
 */
export function registerDefeat(dx: DexIndex, defeated: Set<number>, id: number): DexGain {
  const types = dx.types.get(id);
  if (!types || defeated.has(id)) return { isNew: false, rewards: [] };
  const before = countByType(defeated, dx);
  defeated.add(id);
  const rewards: DexReward[] = [];
  for (const type of types) {
    const total = dx.totals[type];
    const was = before[type] ?? 0;
    const now = was + 1;
    for (const m of DEX_MILESTONES) {
      // Se cruza el hito si antes no llegaba y ahora sí (comparado sin decimales: n * 100 >= m * total)
      if (was * 100 < m * total && now * 100 >= m * total) rewards.push({ type, percent: m, candies: DEX_CANDIES[m] });
    }
  }
  return { isNew: true, rewards };
}
