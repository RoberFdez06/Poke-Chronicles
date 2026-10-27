// Qué partida se va a empezar, elegida en la pantalla de modos ANTES del hueco y del Pokémon (Jugar → modo → hueco →
// inicial). Lógica pura, sin Phaser, para poder testearla.
import { MODE_LABEL, type GameMode } from './modes.ts';
import { DIFFICULTY_LABEL, type Difficulty } from './difficulty.ts';

export type RunPlan =
  /** Un modo de los que se juegan en GameScene, con su dificultad (y el piso de salida de la Torre, si se eligió). */
  | { kind: 'mode'; mode: Exclude<GameMode, 'towerdef'>; difficulty: Difficulty; towerStart?: { floor: number; cost: number } }
  /** Desafío diario: Pokémon del día, no se elige inicial. */
  | { kind: 'daily' }
  /** Partida con código: el Pokémon sale del código. */
  | { kind: 'code' }
  /** Solo continuar una partida guardada. */
  | { kind: 'resume' };

export const DEFAULT_PLAN: RunPlan = { kind: 'mode', mode: 'normal', difficulty: 'normal' };

/** Solo los modos normales piden elegir Pokémon inicial. */
export const needsStarter = (p: RunPlan): boolean => p.kind === 'mode';

/** Lo que se enseña arriba en la pantalla de huecos. */
export function planLabel(p: RunPlan): string {
  switch (p.kind) {
    case 'daily':
      return 'Desafío diario';
    case 'code':
      return 'Partida con código';
    case 'resume':
      return 'Continuar partida';
    case 'mode': {
      const base = `${MODE_LABEL[p.mode]} · ${DIFFICULTY_LABEL[p.difficulty]}`;
      return p.towerStart && p.towerStart.floor > 1 ? `${base} · desde el piso ${p.towerStart.floor}` : base;
    }
  }
}

/** Pasos que faltan tras elegir el modo, para la ayuda de la pantalla de modos. */
export function planSteps(p: RunPlan): string[] {
  if (p.kind === 'resume') return ['Hueco'];
  return needsStarter(p) ? ['Hueco', 'Pokémon'] : p.kind === 'code' ? ['Hueco', 'Código'] : ['Hueco'];
}
