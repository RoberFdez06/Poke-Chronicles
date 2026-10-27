// Pokémon oscuros: variante rara, con aura morada y negra, que es más fuerte en todo (vida, daño, velocidad y
// cadencia). Salen como enemigos normales (más cuanto más hondo), minijefes, jefes y legendarios, y se pueden
// conseguir (captura, cacería y gacha) para jugar con ellos como inicial, igual que los shiny.
// Lógica pura, sin Phaser; lo conseguido se guarda en save.ts (pokeisaac.darks) y el inicial oscuro en RunSave.

/** Mejoras de un enemigo oscuro sobre el normal. La cadencia divide el tiempo entre ataques. */
export const DARK_ENEMY_MUL = { hp: 1.4, damage: 1.3, speed: 1.25, fireRate: 1.3 } as const;
/** Mejoras del jugador con un inicial oscuro (algo menos en velocidad para que se siga controlando bien). */
export const DARK_PLAYER_MUL = { hp: 1.25, damage: 1.25, speed: 1.12, fireRate: 1.25 } as const;

/** Colores del aura y el tinte (morado y negro). */
export const DARK_COLORS = { aura: 0x7a3cc8, deep: 0x1a0b2e, glow: 0xc58cff, tint: 0xa58cc8 } as const;

export type DarkWho = 'enemy' | 'miniboss' | 'boss' | 'legend';

/**
 * Probabilidad de que salga oscuro según quién es y el piso (1 = primero). Los normales empiezan muy raros y suben
 * con el piso hasta un tope; minijefes, jefes y legendarios algo más (son el reto). Ajustables.
 */
export const DARK_ODDS: Readonly<Record<DarkWho, { base: number; perFloor: number; max: number }>> = {
  enemy: { base: 0.004, perFloor: 0.003, max: 0.04 },
  miniboss: { base: 0.04, perFloor: 0.01, max: 0.15 },
  boss: { base: 0.03, perFloor: 0.012, max: 0.18 },
  legend: { base: 0.05, perFloor: 0.012, max: 0.2 },
};

/** En el gacha, una de cada tantas tiradas sale oscuro (más raro que el shiny, 1/64). */
export const DARK_GACHA_ODDS = 1 / 100;

export function darkOdds(who: DarkWho, floor: number): number {
  const o = DARK_ODDS[who];
  const f = Math.max(1, Math.floor(Number.isFinite(floor) ? floor : 1));
  return Math.min(o.max, o.base + o.perFloor * (f - 1));
}

export const rollDark = (rng: () => number, odds: number): boolean => rng() < odds;

/** Premio extra por vencer a uno oscuro: monedas de 5, tickets multiplicados (jefes y minijefes). */
export const DARK_REWARD = { extraCoins: 3, ticketMul: 1.5 } as const;
export const darkTickets = (tickets: number): number => Math.round(Math.max(0, tickets) * DARK_REWARD.ticketMul);

/** «Tyranitar Oscuro». */
export const darkName = (name: string): string => `${name} Oscuro`;

/** Estadísticas de combate de un enemigo oscuro (vida, daño y velocidad redondeadas). */
export function darkEnemyStats<T extends { hp: number; damage: number; speed: number }>(s: T): T {
  return { ...s, hp: Math.round(s.hp * DARK_ENEMY_MUL.hp), damage: Math.round(s.damage * DARK_ENEMY_MUL.damage), speed: s.speed * DARK_ENEMY_MUL.speed };
}

/** Tiempo entre ataques de un enemigo oscuro (más corto). */
export const darkCooldown = (ms: number): number => ms / DARK_ENEMY_MUL.fireRate;

/** Estadísticas del jugador con inicial oscuro (sobre las ya calculadas). */
export function darkPlayerStats<T extends { maxHp: number; damage: number; speed: number; fireDelay: number }>(s: T): T {
  return {
    ...s,
    maxHp: Math.round(s.maxHp * DARK_PLAYER_MUL.hp),
    damage: s.damage * DARK_PLAYER_MUL.damage,
    speed: s.speed * DARK_PLAYER_MUL.speed,
    fireDelay: s.fireDelay / DARK_PLAYER_MUL.fireRate,
  };
}

/** Lista de ids oscuros guardada: enteros positivos, sin repetir (como la de shinies). */
export function parseDarks(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const d: unknown = JSON.parse(raw);
    if (!Array.isArray(d)) return [];
    return [...new Set(d.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0))];
  } catch {
    return [];
  }
}
