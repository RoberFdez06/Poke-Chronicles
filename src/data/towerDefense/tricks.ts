// Defensa de torres: enemigos con trucos. Esquivos (esquivan disparos sueltos si no van frenados), planeadores (vuelan
// en línea recta a la base sin seguir el camino), saboteadores (avisan y aturden la torre más cercana), divisores (al
// caer sueltan dos crías) y adaptables (resisten el tipo que más daño hizo en la oleada anterior). Cada oleada trae un
// truco protagonista para obligar a cambiar de plan. Lógica pura, sin Phaser.
import { hashStr } from './chiefs.ts';
import type { TrickKind } from './species.ts';

/** Probabilidad de que un Esquivo esquive un disparo suelto (sin área, cadena ni ataque especial). */
export const DODGE_CHANCE = 0.4;
/** Saboteador: cada cuánto, alcance, aviso y aturdimiento. */
export const SAB_FIRST = 2.5;
export const SAB_EVERY = 5.5;
export const SAB_RANGE = 2.6;
export const SAB_WARN = 1;
export const SAB_STUN = 2.6;
/** Divisor: crías que suelta al caer. */
export const SPLIT_COUNT = 2;
/** Adaptable: multiplicador del tipo que resiste. */
export const ADAPT_MUL = 0.35;

export const TRICK_INFO: Readonly<Record<TrickKind, { tip: string; color: number }>> = {
  dodger: { tip: 'Esquivos: esquivan disparos sueltos. Área, cadena o frenarlos les quita el truco.', color: 0xf0f0ff },
  soarer: { tip: 'Planeadores: vuelan recto a la base sin seguir el camino. Pon torres aéreas cerca de la base.', color: 0x8fd0ff },
  splitter: { tip: 'Divisores: al caer sueltan dos crías rápidas. Ten algo de daño cerca de la base.', color: 0x7cf07a },
  saboteur: { tip: 'Saboteadores: aturden la torre más cercana tras un aviso. Derríbalos antes o usa Refuerzo.', color: 0xff5a4a },
  adapter: { tip: 'Adaptables: resisten el tipo que más daño hizo en la oleada anterior. Mezcla tipos.', color: 0xb08aff },
};

/** Truco protagonista de una oleada (null en la 1 o si no hay ninguno abierto). Fijo por mapa, nivel y oleada. */
export function waveTheme(mapId: string, level: number, wave: number, open: readonly TrickKind[]): TrickKind | null {
  if (wave < 2 || !open.length) return null;
  return open[hashStr(`${mapId}|${level}|${wave}|truco`) % open.length];
}

/** Tipo que resisten los Adaptables: el que más daño hizo (o null si nadie ha hecho daño). */
export function adaptType(damageByType: Readonly<Record<string, number>>): string | null {
  let best: string | null = null;
  let n = 0;
  for (const [t, v] of Object.entries(damageByType)) {
    if (v > n) {
      n = v;
      best = t;
    }
  }
  return best;
}
