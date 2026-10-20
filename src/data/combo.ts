// Combo de bajas: cada enemigo vencido seguido suma; si pasa un rato sin vencer a nadie o te hacen daño, se
// rompe. Cuanto más alto, menos tiempo hay para seguir, así que pide ir rápido. Lógica pura, sin Phaser.

export interface ComboState {
  count: number;
  /** El combo más alto de la partida. */
  best: number;
  /** Momento (ms de juego) en que se rompe si no se vence a nadie más. */
  expiresAt: number;
  /** Cuándo empezó la ventana actual (para dibujar la barra). */
  startedAt: number;
}

export const newCombo = (): ComboState => ({ count: 0, best: 0, expiresAt: 0, startedAt: 0 });

/** Tiempo para vencer al siguiente: 3 s al empezar y hasta 1,6 s con combos largos. */
export const comboWindow = (count: number): number => Math.max(1600, 3000 - count * 25);

/** Hitos que dan premio y aviso. */
export const COMBO_MILESTONES = [5, 10, 25, 50, 100] as const;

export interface ComboTier {
  /** Desde cuántas bajas. */
  from: number;
  label: string;
  color: number;
  hex: string;
}

export const COMBO_TIERS: readonly ComboTier[] = [
  { from: 3, label: '¡Combo!', color: 0xffffff, hex: '#ffffff' },
  { from: 10, label: '¡Racha!', color: 0xffd34d, hex: '#ffd34d' },
  { from: 25, label: '¡Imparable!', color: 0xff8c1a, hex: '#ff8c1a' },
  { from: 50, label: '¡Leyenda!', color: 0xff4d6d, hex: '#ff4d6d' },
  { from: 100, label: '¡Maestro Pokémon!', color: 0xb388ff, hex: '#b388ff' },
];

/** Tramo del combo (o null si aún no llega a 3). */
export function comboTier(count: number): ComboTier | null {
  let t: ComboTier | null = null;
  for (const x of COMBO_TIERS) if (count >= x.from) t = x;
  return t;
}

export const comboAlive = (s: ComboState, now: number): boolean => s.count > 0 && now < s.expiresAt;

/** Una baja más. Si el combo se había roto, empieza otro. Devuelve el hito alcanzado, si lo hay. */
export function comboHit(s: ComboState, now: number): number | null {
  if (!comboAlive(s, now)) s.count = 0;
  s.count++;
  s.best = Math.max(s.best, s.count);
  s.startedAt = now;
  s.expiresAt = now + comboWindow(s.count);
  return (COMBO_MILESTONES as readonly number[]).includes(s.count) ? s.count : null;
}

/** Rompe el combo (te han hecho daño o ha pasado el tiempo). Devuelve cuánto era. */
export function comboBreak(s: ComboState): number {
  const was = s.count;
  s.count = 0;
  return was;
}

/** Premio de un hito: PS recuperados y monedas (si hay tienda). */
export function milestoneReward(count: number): { heal: number; coins: number } {
  return { heal: Math.min(25, 3 + Math.floor(count / 5)), coins: count >= 25 ? 5 : count >= 10 ? 2 : 1 };
}
