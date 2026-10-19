// Progresión entre pisos: tamaño, dificultad, recompensas y jefes legendarios.
// Lógica pura, sin Phaser ni red, para poder testearla.
// Con extensión .ts para que los tests (node --test) puedan importarlo sin bundler
import { BOSS_TICKETS, ROOM_TICKETS } from '../data/save.ts';

/** Pisos que hay que completar para ganar la partida (modo Normal). Ajustable. */
export const FLOOR_COUNT = 5;

/** Salas del piso: crece 2 por piso (8-12 en el primero) hasta un máximo que cabe en la cuadrícula. */
export const MAX_ROOMS = 24;
export function roomCountFor(floor: number, rng: () => number): number {
  const f = Math.max(1, Math.floor(floor));
  const min = 8 + (f - 1) * 2;
  const n = min + Math.floor(rng() * 5);
  return Math.min(MAX_ROOMS, n);
}

/** Multiplicadores de dificultad de los enemigos según el piso. */
export interface FloorDifficulty {
  hp: number;
  damage: number;
  speed: number;
  /** Enemigos por sala de combate: [mínimo, máximo]. */
  enemies: [number, number];
}

export function difficultyFor(floor: number): FloorDifficulty {
  const k = Math.max(0, Math.floor(floor) - 1);
  const extra = Math.min(3, k);
  return {
    // T32: algo más duros por piso (antes +35 % de vida y +25 % de daño)
    hp: 1 + 0.35 * k,
    damage: 1 + 0.22 * k,
    speed: Math.min(1.6, 1 + 0.08 * k),
    enemies: [3 + extra, 5 + extra],
  };
}

/** Tickets por sala limpiada (igual en todos los pisos). */
export const roomTicketsFor = (_floor: number): number => ROOM_TICKETS;
/** Tickets por vencer al jefe: se multiplican por el número de piso. */
export const bossTicketsFor = (floor: number): number => BOSS_TICKETS * Math.max(1, Math.floor(floor));

/** Lo mínimo de cada especie para elegir jefe (encaja con SpeciesFact de gacha.ts). */
export interface BossCandidate {
  id: number;
  legendary: boolean;
  mythical: boolean;
}

/** Por si no se puede leer la lista de especies: Articuno, Zapdos, Moltres, Mewtwo, Mew, Raikou, Entei, Suicune, Lugia, Ho-Oh, Celebi. */
export const FALLBACK_BOSSES: readonly number[] = [144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251];

export function bossPool(index: readonly BossCandidate[]): number[] {
  const ids = index.filter((s) => s.legendary || s.mythical).map((s) => s.id);
  return ids.length > 0 ? ids : [...FALLBACK_BOSSES];
}

/** Jefe al azar del grupo, evitando repetir los ya vistos en la partida mientras queden otros. */
export function pickBoss(pool: readonly number[], rng: () => number, seen: readonly number[] = []): number {
  const list = pool.length > 0 ? pool : FALLBACK_BOSSES;
  const fresh = list.filter((id) => !seen.includes(id));
  const from = fresh.length > 0 ? fresh : list;
  return from[Math.floor(rng() * from.length)];
}
