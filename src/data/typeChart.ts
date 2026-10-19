// Eficacia de tipos como en Pokémon: súper eficaz, no muy eficaz y sin efecto, tanto para los ataques del
// jugador como para los de los enemigos. Lógica pura, sin Phaser, para poder testearla.

/** Tabla de la generación 6+ (18 tipos): atacante → defensor → multiplicador original (0, 0,5, 2). */
const CHART: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

/** Multiplicador original de un tipo atacante contra los tipos del defensor (0, 0,25, 0,5, 1, 2 o 4). */
export function rawEffectiveness(attack: string | undefined, defend: readonly string[]): number {
  if (!attack || !CHART[attack]) return 1;
  let m = 1;
  for (const d of defend) m *= CHART[attack][d] ?? 1;
  return m;
}

export type Effect = 'super' | 'resisted' | 'immune' | 'normal';

export function effectOf(attack: string | undefined, defend: readonly string[]): Effect {
  const m = rawEffectiveness(attack, defend);
  return m === 0 ? 'immune' : m > 1 ? 'super' : m < 1 ? 'resisted' : 'normal';
}

/**
 * Multiplicador de daño en el juego. Más suave que en Pokémon para que siga siendo jugable con muchos disparos:
 * súper eficaz ×1,5 (doble ×2), poco eficaz ×0,7 (doble ×0,5) y sin efecto ×0,35 (nunca cero).
 */
export function damageMul(attack: string | undefined, defend: readonly string[]): number {
  const m = rawEffectiveness(attack, defend);
  if (m === 1) return 1;
  if (m === 0) return 0.35;
  if (m >= 4) return 2;
  if (m > 1) return 1.5;
  if (m <= 0.25) return 0.5;
  return 0.7;
}

/** Texto del aviso al golpear (vacío si es normal). */
export const EFFECT_LABEL: Readonly<Record<Effect, string>> = {
  super: '¡Es súper eficaz!',
  resisted: 'No es muy eficaz…',
  immune: 'Casi no afecta…',
  normal: '',
};

/** Colores del aviso: verde cálido para el golpe fuerte, gris para el flojo. */
export const EFFECT_COLOR: Readonly<Record<Effect, number>> = {
  super: 0xffd34d,
  resisted: 0xb0b8c8,
  immune: 0x8a90a0,
  normal: 0xffffff,
};
