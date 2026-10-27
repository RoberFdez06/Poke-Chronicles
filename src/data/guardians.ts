// Guardianes: pseudolegendarios y ultraentes. Son los minijefes de cada piso y el «jefe defensor» que custodia la
// Mega Piedra (la piedra ya no está suelta en un santuario: hay que vencerlo). Lógica pura, sin Phaser.
import { ULTRA_BEAST_IDS } from './gacha.ts';

/**
 * Pseudolegendarios (línea de tres con 600 de estadísticas base en la última fase): Dragonite, Tyranitar,
 * Salamence, Metagross, Garchomp, Hydreigon, Goodra, Kommo-o, Dragapult y Baxcalibur.
 */
export const PSEUDO_LEGENDARY_IDS: readonly number[] = [149, 248, 373, 376, 445, 635, 706, 784, 887, 998];

/** Ultraentes (la misma lista fija del gacha: PokeAPI no los marca). */
export const ULTRA_IDS: readonly number[] = [...ULTRA_BEAST_IDS].sort((a, b) => a - b);

/** Todos los guardianes posibles, sin repetir. */
export const GUARDIAN_IDS: readonly number[] = [...new Set([...PSEUDO_LEGENDARY_IDS, ...ULTRA_IDS])];

export const isGuardian = (id: number): boolean => GUARDIAN_IDS.includes(id);
export const isUltraBeast = (id: number): boolean => ULTRA_IDS.includes(id);

/** Qué es, para la intro: «Pseudolegendario» o «Ultraente». */
export const guardianKindLabel = (id: number): string => (isUltraBeast(id) ? 'Ultraente' : 'Pseudolegendario');

/**
 * Elige un guardián con `rng` sin repetir los de `exclude` (si no queda ninguno, se vuelve a la lista completa).
 * `keep` filtra los que se pueden usar (p. ej. solo los que tienen sprite sin conexión); si deja la lista vacía, se
 * ignora. Siempre devuelve un id de GUARDIAN_IDS.
 */
export function pickGuardian(rng: () => number, exclude: Iterable<number> = [], keep: (id: number) => boolean = () => true): number {
  const ex = new Set(exclude);
  const usable = GUARDIAN_IDS.filter(keep);
  const base = usable.length > 0 ? usable : GUARDIAN_IDS;
  const pool = base.filter((id) => !ex.has(id));
  const list = pool.length > 0 ? pool : base;
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

/** El jefe defensor de la Mega Piedra es más duro que un minijefe normal (vida y daño sobre los del minijefe). */
export const MEGA_GUARDIAN = { hpMul: 1.6, damageMul: 1.2, size: 128, tickets: 6 } as const;
