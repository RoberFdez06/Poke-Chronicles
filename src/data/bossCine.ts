// Intro de cine del jefe (zoom a él al entrar en su sala): cuándo se muestra. Lógica pura, sin Phaser; con extensión
// .ts para los tests (node --test).
//
// Se ve SIEMPRE la primera vez que entras en la sala del jefe de cada piso. Solo se salta al reanudar una partida
// guardada dentro de esa misma arena cuando ya la habías visto (clave guardada igual). La clave lleva la partida
// (semilla de la partida si la hay), el modo, el piso, la semilla del piso y la arena (la primera casilla de la sala
// grande, no la casilla en la que estés: en una arena 2x2 cambiabas de casilla y la clave cambiaba).

export const BOSS_CINE_STORE = 'pokeisaac.bossCine';

export interface BossCineKeyIn {
  mode: string;
  floorNum: number;
  floorSeed: number;
  /** Semilla de la partida (si la hay): dos partidas con el mismo piso no comparten clave. */
  runSeed?: number | string | null;
  /** Ids de las casillas de la arena del jefe (sala grande) o la de la sala sola. */
  arenaIds: readonly number[];
}

export function bossCineKey(o: BossCineKeyIn): string {
  const arena = o.arenaIds.length ? Math.min(...o.arenaIds) : -1;
  return `${o.runSeed ?? '-'}:${o.mode}:${o.floorNum}:${o.floorSeed}:${arena}`;
}

export interface BossCineDecisionIn {
  key: string;
  /** Lo guardado en localStorage (null si no hay o no hay almacenamiento). */
  stored: string | null;
  /** ¿Esta escena viene de reanudar una partida guardada? */
  resumed: boolean;
  /** ¿La partida se guardó dentro de la arena del jefe? (si se guardó en otra sala, aún no habías visto la intro) */
  savedInArena: boolean;
}

/** ¿Mostrar la intro? Sí salvo reanudando dentro de la misma arena con la intro ya vista. */
export function shouldShowBossCine(o: BossCineDecisionIn): boolean {
  return !(o.resumed && o.savedInArena && o.stored === o.key);
}
