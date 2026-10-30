// Defensa de torres: jefes de oleada (cada 5 oleadas, salvo la del jefe legendario). Un Pokémon fuerte del bioma con
// 2 habilidades propias que siempre se avisan antes (la escena marca la zona y el nombre): aturdir torres en una zona
// (castiga amontonarlas), curarse (se corta si le haces bastante daño durante el aviso), invocar esbirros, acelerar
// y escudo por fases. Todo fijo para un mapa, nivel y oleada. Lógica pura, sin Phaser.

export const CHIEF_EVERY = 5;

export const CHIEF_SKILLS = ['aturdir', 'invocar', 'curar', 'acelerar', 'escudo'] as const;
export type ChiefSkill = (typeof CHIEF_SKILLS)[number];

export interface ChiefSkillInfo {
  name: string;
  desc: string;
  /** Segundos de aviso antes de que pase (0: pasiva, salta al cruzar una fase). */
  warn: number;
  color: number;
}

export const CHIEF_SKILL_INFO: Readonly<Record<ChiefSkill, ChiefSkillInfo>> = {
  aturdir: { name: 'Onda paralizante', desc: 'Aturde las torres de una zona', warn: 1.6, color: 0xffd34d },
  invocar: { name: 'Llamada', desc: 'Llama a 3 esbirros', warn: 1.2, color: 0xb08aff },
  curar: { name: 'Recuperación', desc: 'Se cura (córtalo con daño)', warn: 1.8, color: 0x7cf07a },
  acelerar: { name: 'Agilidad', desc: 'Corre el doble un momento', warn: 1.0, color: 0x8fe39a },
  escudo: { name: 'Coraza', desc: 'Escudo al 66 % y al 33 %', warn: 0, color: 0x5ab4ff },
};

/** Radio (casillas) de la Onda paralizante y lo que dura el aturdimiento. */
export const STUN_RADIUS = 1.6;
export const STUN_TIME = 4;
/** Hasta dónde mira el jefe para aturdir torres (casillas). */
export const STUN_REACH = 4.5;
/** Cura de Recuperación (parte de su vida) y daño durante el aviso que la corta (parte de su vida). */
export const CHIEF_HEAL = 0.12;
export const CHIEF_HEAL_BREAK = 0.06;
export const RUSH_TIME = 3;
export const RUSH_MUL = 2;
export const CHIEF_SHIELD = 0.2;
/** Primera habilidad a los X s de salir y luego una cada Y s. */
export const CHIEF_FIRST = 4;
export const CHIEF_GAP = 8;

/** Jefes de oleada de cada bioma (se alternan). Nombres en español para la presentación. */
export const CHIEF_SPECIES: Readonly<Record<string, readonly number[]>> = {
  bosque: [3, 127],
  cueva: [76, 248],
  mar: [130, 134],
  nieve: [460, 87],
  pantano: [454, 110],
  volcan: [59, 6],
  torre: [477, 94],
  ciudad: [466, 82],
  cumbre: [149, 373],
};

export const CHIEF_NAMES: Readonly<Record<number, string>> = {
  3: 'Venusaur', 127: 'Pinsir', 76: 'Golem', 248: 'Tyranitar', 130: 'Gyarados', 134: 'Vaporeon', 460: 'Abomasnow', 87: 'Dewgong',
  454: 'Toxicroak', 110: 'Weezing', 59: 'Arcanine', 6: 'Charizard', 477: 'Dusknoir', 94: 'Gengar', 466: 'Electivire', 82: 'Magneton',
  149: 'Dragonite', 373: 'Salamence',
};

export const CHIEF_TYPES: Readonly<Record<number, readonly string[]>> = {
  3: ['grass', 'poison'], 127: ['bug'], 76: ['rock', 'ground'], 248: ['rock', 'dark'], 130: ['water', 'flying'], 134: ['water'],
  460: ['grass', 'ice'], 87: ['water', 'ice'], 454: ['poison', 'fighting'], 110: ['poison'], 59: ['fire'], 6: ['fire', 'flying'],
  477: ['ghost'], 94: ['ghost', 'poison'], 466: ['electric'], 82: ['electric', 'steel'], 149: ['dragon', 'flying'], 373: ['dragon', 'flying'],
};

/** Hash pequeño y estable de un texto (semilla del mapa). */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const chiefIndex = (wave: number): number => Math.max(0, Math.floor(wave / CHIEF_EVERY) - 1);

export function chiefSpecies(biome: string, wave: number): number {
  const pool = CHIEF_SPECIES[biome] ?? CHIEF_SPECIES.bosque;
  return pool[chiefIndex(wave) % pool.length];
}

/**
 * Las 2 habilidades de un jefe: una que castiga (aturdir torres o invocar) y otra de aguante (curar, acelerar o
 * escudo). Fijas para un mapa, nivel y oleada; el primer jefe de cada partida siempre aturde.
 */
export function chiefSkillsFor(mapId: string, level: number, wave: number): [ChiefSkill, ChiefSkill] {
  const h = hashStr(`${mapId}|${level}|${wave}|jefe`);
  const first: ChiefSkill = chiefIndex(wave) === 0 ? 'aturdir' : (['aturdir', 'invocar'] as const)[h % 2];
  const second = (['curar', 'acelerar', 'escudo'] as const)[(h >>> 3) % 3];
  return [first, second];
}

/** Recompensa extra por vencer a un jefe de oleada: dinero en la partida y tickets al acabar (nunca monedas). */
export const chiefMoney = (wave: number): number => 60 + 8 * wave;
export const CHIEF_TICKETS = 3;
export const CHIEF_TICKETS_MAX = 15;
