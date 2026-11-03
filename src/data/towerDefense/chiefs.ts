// Defensa de torres: minijefes de oleada (cada 5 oleadas, salvo la del jefe). Un pseudolegendario o ultraente con
// 2 habilidades propias que siempre se avisan antes (la escena marca la zona y el nombre): aturdir torres en una zona
// (castiga amontonarlas), curarse (se corta si le haces bastante daño durante el aviso), invocar esbirros, acelerar
// y escudo por fases. Todo fijo para un mapa, nivel y oleada. Lógica pura, sin Phaser.
import { GUARDIAN_IDS, guardianKindLabel } from '../guardians.ts';

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

// --- Minijefes y jefes ---
// Minijefes (oleadas de 5 en 5): pseudolegendarios y ultraentes, los mismos guardianes que el modo normal
// (guardians.ts). Jefes (la última oleada de cada nivel y, en el infinito, cada 10): legendarios y singulares. Quién
// sale en cada oleada lo decide themes.ts (prefiere los del tipo tema y no repite seguidos).

/** Minijefes posibles: pseudolegendarios y ultraentes. */
export const MINIBOSS_POOL: readonly number[] = GUARDIAN_IDS;

/** Jefes posibles: legendarios y singulares (con sus tipos reales de PokeAPI). */
export const BOSS_TYPES: Readonly<Record<number, readonly string[]>> = {
  144: ['ice', 'flying'], 145: ['electric', 'flying'], 146: ['fire', 'flying'], 150: ['psychic'], 151: ['psychic'], 243: ['electric'],
  244: ['fire'], 245: ['water'], 249: ['psychic', 'flying'], 250: ['fire', 'flying'], 251: ['psychic', 'grass'], 377: ['rock'],
  378: ['ice'], 379: ['steel'], 380: ['dragon', 'psychic'], 381: ['dragon', 'psychic'], 382: ['water'], 383: ['ground'],
  384: ['dragon', 'flying'], 385: ['steel', 'psychic'], 386: ['psychic'], 480: ['psychic'], 483: ['steel', 'dragon'], 484: ['water', 'dragon'],
  485: ['fire', 'steel'], 486: ['normal'], 487: ['ghost', 'dragon'], 488: ['psychic'], 490: ['water'], 491: ['dark'], 492: ['grass'],
  493: ['normal'], 494: ['psychic', 'fire'], 638: ['steel', 'fighting'], 639: ['rock', 'fighting'], 640: ['grass', 'fighting'],
  641: ['flying'], 642: ['electric', 'flying'], 643: ['dragon', 'fire'], 644: ['dragon', 'electric'], 645: ['ground', 'flying'],
  646: ['dragon', 'ice'], 647: ['water', 'fighting'], 648: ['normal', 'psychic'], 649: ['bug', 'steel'], 716: ['fairy'], 717: ['dark', 'flying'],
  718: ['dragon', 'ground'], 719: ['rock', 'fairy'], 720: ['psychic', 'ghost'], 721: ['fire', 'water'], 785: ['electric', 'fairy'],
  786: ['psychic', 'fairy'], 787: ['grass', 'fairy'], 788: ['water', 'fairy'], 791: ['psychic', 'steel'], 792: ['psychic', 'ghost'],
  800: ['psychic'], 802: ['fighting', 'ghost'], 807: ['electric'], 888: ['fairy'], 889: ['fighting'], 890: ['poison', 'dragon'],
  892: ['fighting', 'dark'], 893: ['dark', 'grass'], 894: ['electric'], 895: ['dragon'], 896: ['ice'], 897: ['ghost'],
};
export const BOSS_POOL: readonly number[] = Object.keys(BOSS_TYPES).map(Number);

/** Tipos de los minijefes (pseudolegendarios y ultraentes). */
export const MINIBOSS_TYPES: Readonly<Record<number, readonly string[]>> = {
  149: ['dragon', 'flying'], 248: ['rock', 'dark'], 373: ['dragon', 'flying'], 376: ['steel', 'psychic'], 445: ['dragon', 'ground'],
  635: ['dark', 'dragon'], 706: ['dragon'], 784: ['dragon', 'fighting'], 887: ['dragon', 'ghost'], 998: ['dragon', 'ice'],
  793: ['rock', 'poison'], 794: ['bug', 'fighting'], 795: ['bug', 'fighting'], 796: ['electric'], 797: ['steel', 'flying'],
  798: ['grass', 'steel'], 799: ['dark', 'dragon'], 803: ['poison'], 804: ['poison', 'dragon'], 805: ['rock', 'steel'], 806: ['fire', 'ghost'],
};

/** Nombres (en español coinciden con los originales) de minijefes y jefes, para las presentaciones y la barra. */
export const CHIEF_NAMES: Readonly<Record<number, string>> = {
  // Pseudolegendarios
  149: 'Dragonite', 248: 'Tyranitar', 373: 'Salamence', 376: 'Metagross', 445: 'Garchomp', 635: 'Hydreigon', 706: 'Goodra',
  784: 'Kommo-o', 887: 'Dragapult', 998: 'Baxcalibur',
  // Ultraentes
  793: 'Nihilego', 794: 'Buzzwole', 795: 'Pheromosa', 796: 'Xurkitree', 797: 'Celesteela', 798: 'Kartana', 799: 'Guzzlord',
  803: 'Poipole', 804: 'Naganadel', 805: 'Stakataka', 806: 'Blacephalon',
  // Legendarios y singulares
  144: 'Articuno', 145: 'Zapdos', 146: 'Moltres', 150: 'Mewtwo', 151: 'Mew', 243: 'Raikou', 244: 'Entei', 245: 'Suicune', 249: 'Lugia',
  250: 'Ho-Oh', 251: 'Celebi', 377: 'Regirock', 378: 'Regice', 379: 'Registeel', 380: 'Latias', 381: 'Latios', 382: 'Kyogre',
  383: 'Groudon', 384: 'Rayquaza', 385: 'Jirachi', 386: 'Deoxys', 480: 'Uxie', 483: 'Dialga', 484: 'Palkia', 485: 'Heatran',
  486: 'Regigigas', 487: 'Giratina', 488: 'Cresselia', 490: 'Manaphy', 491: 'Darkrai', 492: 'Shaymin', 493: 'Arceus', 494: 'Victini',
  638: 'Cobalion', 639: 'Terrakion', 640: 'Virizion', 641: 'Tornadus', 642: 'Thundurus', 643: 'Reshiram', 644: 'Zekrom',
  645: 'Landorus', 646: 'Kyurem', 647: 'Keldeo', 648: 'Meloetta', 649: 'Genesect', 716: 'Xerneas', 717: 'Yveltal', 718: 'Zygarde',
  719: 'Diancie', 720: 'Hoopa', 721: 'Volcanion', 785: 'Tapu Koko', 786: 'Tapu Lele', 787: 'Tapu Bulu', 788: 'Tapu Fini',
  791: 'Solgaleo', 792: 'Lunala', 800: 'Necrozma', 802: 'Marshadow', 807: 'Zeraora', 888: 'Zacian', 889: 'Zamazenta', 890: 'Eternatus',
  892: 'Urshifu', 893: 'Zarude', 894: 'Regieleki', 895: 'Regidrago', 896: 'Glastrier', 897: 'Spectrier',
};

/** Tipos de minijefes y jefes (para tdTypesOf). */
export const CHIEF_TYPES: Readonly<Record<number, readonly string[]>> = { ...BOSS_TYPES, ...MINIBOSS_TYPES };

export const isMinibossMon = (id: number): boolean => MINIBOSS_POOL.includes(id);
export const isBossMon = (id: number): boolean => id in BOSS_TYPES;
/** «Ultraente» o «Pseudolegendario» (minijefes) y «Legendario» (jefes). */
export const bigMonLabel = (id: number): string => (isMinibossMon(id) ? guardianKindLabel(id) : 'Legendario');

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
