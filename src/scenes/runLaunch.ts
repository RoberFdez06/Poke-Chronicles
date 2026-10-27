import Phaser from 'phaser';
import { DEFAULT_PLAN, needsStarter, type RunPlan } from '../data/runPlan';
import { beginDaily, spendCandies } from '../data/save';
import { dailyStarter } from '../data/daily';
import { dayNumber } from '../data/gacha';
import { goTo } from '../ui/theme';

/** Último plan elegido en la pantalla de modos: lo usan Huecos, Inicial y "Otra partida" del resumen. */
let current: RunPlan = DEFAULT_PLAN;

export const currentPlan = (): RunPlan => current;
export const setPlan = (p: RunPlan) => {
  current = p;
};

/** Empieza la partida del plan en el hueco `slot` (y con `starterId` si el plan lo pide). */
export function launchPlan(scene: Phaser.Scene, plan: RunPlan, slot: number, starterId = 4) {
  if (plan.kind === 'code') return goTo(scene, 'SeedCode', { slot, starterId });
  if (plan.kind === 'daily') {
    // Mismo inicial para todos; solo la primera partida del día cuenta
    const day = dayNumber();
    const counts = beginDaily(day);
    return goTo(scene, 'Game', { starterId: dailyStarter(day), slot, mode: 'normal', daily: { day, counts }, difficulty: 'normal' });
  }
  if (plan.kind === 'resume') return false;
  // T72: los caramelos del punto de control de la Torre se pagan al empezar de verdad (no al elegirlo)
  const t = plan.towerStart;
  const towerStart = t && (t.cost <= 0 || spendCandies(t.cost)) ? t.floor : undefined;
  return goTo(scene, 'Game', { starterId, slot, mode: plan.mode, difficulty: plan.difficulty, ...(towerStart ? { towerStart } : {}) });
}

/** Tras elegir Pokémon: el modo elegido antes (o Normal si el plan no usa inicial, p. ej. "Otra partida" tras un diario). */
export function startWithStarter(scene: Phaser.Scene, slot: number, starterId: number) {
  return launchPlan(scene, needsStarter(current) ? current : DEFAULT_PLAN, slot, starterId);
}
