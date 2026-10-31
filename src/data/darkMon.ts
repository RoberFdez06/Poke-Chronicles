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

// --- Enemigos, minijefes y jefes oscuros (aparición en las salas) ---

export type DarkDifficulty = 'easy' | 'normal' | 'hard';

/**
 * Probabilidad de aparición por piso: del piso 2 (`min`) sube `perFloor` cada piso hasta `max`. En el piso 1 nunca
 * (salvo admin). La dificultad multiplica la probabilidad y el tope (Fácil menos, Difícil más).
 */
export const DARK_SPAWN: Readonly<Record<'enemy' | 'miniboss' | 'boss', { min: number; perFloor: number; max: number }>> = {
  enemy: { min: 0.04, perFloor: 0.01, max: 0.12 },
  miniboss: { min: 0.2, perFloor: 0.02, max: 0.35 },
  boss: { min: 0.15, perFloor: 0.02, max: 0.3 },
};
export const DARK_DIFF_MUL: Readonly<Record<DarkDifficulty, number>> = { easy: 0.7, normal: 1, hard: 1.25 };

export function darkSpawnChance(who: 'enemy' | 'miniboss' | 'boss', floor: number, diff: DarkDifficulty = 'normal'): number {
  const f = Math.floor(Number.isFinite(floor) ? floor : 1);
  if (f <= 1) return 0;
  const o = DARK_SPAWN[who];
  const m = DARK_DIFF_MUL[diff] ?? 1;
  return Math.min(o.max * m, (o.min + o.perFloor * (f - 2)) * m);
}

/** Máximo de oscuros normales por sala: 1, y 2 desde el piso 6. */
export const darkRoomCap = (floor: number): number => (floor >= 6 ? 2 : 1);

/**
 * ¿Sale oscuro este enemigo? `forced` (admin) gana siempre. Los normales respetan el tope de la sala
 * (`inRoom` = oscuros normales ya en ella); minijefes y jefes no tienen tope (uno por sala).
 */
export function decideDark(o: { who: 'enemy' | 'miniboss' | 'boss'; floor: number; diff?: DarkDifficulty; inRoom?: number; forced?: boolean; rng: () => number }): boolean {
  if (o.forced) return true;
  if (o.who === 'enemy' && (o.inRoom ?? 0) >= darkRoomCap(o.floor)) return false;
  return o.rng() < darkSpawnChance(o.who, o.floor, o.diff);
}

/** Botín extra de un oscuro normal: probabilidad de soltar un objeto (además de las monedas de DARK_REWARD). */
export const DARK_ITEM_CHANCE = 0.2;

/** Enfurecimiento del jefe oscuro: por debajo de `hpFrac` de vida, más rápido y ataques más seguidos (una vez). */
export const DARK_BOSS_RAGE = { hpFrac: 0.5, speed: 1.15, cooldownMul: 0.8 } as const;
export const darkBossEnrages = (hp: number, maxHp: number, already: boolean): boolean => !already && maxHp > 0 && hp > 0 && hp / maxHp <= DARK_BOSS_RAGE.hpFrac;

/** Aviso al aparecer (notificación, no centrada). */
export const darkWarning = (who: 'enemy' | 'miniboss' | 'boss'): string =>
  who === 'enemy' ? '¡Un Pokémon oscuro!\nMás vida, daño y velocidad' : who === 'miniboss' ? '¡Minijefe oscuro!\nMás fuerte y con más premio' : '¡Jefe oscuro!\nSe enfurece a media vida';

/**
 * Posición de los ojos dentro del dibujo, en fracciones (0..1) del cuadro, a partir de la caja de píxeles opacos
 * (`box`, también en fracciones). Mirando de frente quedan a ~22 % de la altura desde arriba, separados según el
 * ancho; de lado se corren hacia donde mira (`face` = 1 derecha, -1 izquierda, 0 de frente). De espaldas, null.
 */
export function eyeSpots(box: { x0: number; y0: number; x1: number; y1: number }, face: -1 | 0 | 1, back: boolean): { y: number; xs: number[] } | null {
  if (back) return null;
  const w = Math.max(0.05, box.x1 - box.x0);
  const h = Math.max(0.05, box.y1 - box.y0);
  const y = box.y0 + h * 0.24;
  const cx = (box.x0 + box.x1) / 2 + face * w * 0.18;
  const gap = Math.min(0.12, w * (face === 0 ? 0.16 : 0.1));
  return { y, xs: [cx - gap, cx + gap] };
}

/**
 * Hacia dónde mira un sprite para los ojos. Hojas PMD (fila 0 abajo, 1 abajo-dcha, 2 dcha, 3 arriba-dcha, 4 arriba,
 * 5 arriba-izq, 6 izq, 7 abajo-izq): de espaldas en 3-5. Sin PMD: `facing` del sprite y si la textura es la de espalda.
 */
export function eyeFacing(o: { pmdRow?: number; facing?: string; backTexture?: boolean; flipX?: boolean }): { face: -1 | 0 | 1; back: boolean } {
  if (o.pmdRow !== undefined) {
    const r = ((Math.round(o.pmdRow) % 8) + 8) % 8;
    return { face: r === 1 || r === 2 ? 1 : r === 6 || r === 7 ? -1 : 0, back: r >= 3 && r <= 5 };
  }
  if (o.backTexture || o.facing === 'up') return { face: 0, back: true };
  return { face: o.facing === 'right' || (o.facing === undefined && o.flipX) ? 1 : o.facing === 'left' ? -1 : 0, back: false };
}
