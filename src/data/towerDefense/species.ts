// Defensa de torres: Pokémon salvajes de cada mapa (por papel), jefes legendarios, torres «granjeras», nombres de
// los ataques finales y el equipo de prueba. Datos fijos (con sus tipos reales) para que la lógica no dependa de
// la red. Lógica pura, sin Phaser.
import type { BaseStats } from '../pokeStats.ts';
import { CHIEF_TYPES } from './chiefs.ts';

/** Tipos de cada especie que puede salir como enemigo o jefe (orden de PokeAPI). */
export const TD_TYPES: Readonly<Record<number, readonly string[]>> = {
  10: ['bug'], 11: ['bug'], 12: ['bug', 'flying'], 16: ['normal', 'flying'], 19: ['normal'], 43: ['grass', 'poison'],
  69: ['grass', 'poison'], 114: ['grass'], 123: ['bug', 'flying'], 182: ['grass'], 640: ['grass', 'fighting'], 251: ['psychic', 'grass'],
  74: ['rock', 'ground'], 27: ['ground'], 50: ['ground'], 51: ['ground'], 95: ['rock', 'ground'], 41: ['poison', 'flying'],
  42: ['poison', 'flying'], 299: ['rock'], 75: ['rock', 'ground'], 246: ['rock', 'ground'], 377: ['rock'], 383: ['ground'],
  118: ['water'], 98: ['water'], 72: ['water', 'poison'], 120: ['water'], 131: ['water', 'ice'], 278: ['water', 'flying'],
  279: ['water', 'flying'], 222: ['water', 'rock'], 90: ['water'], 183: ['water', 'fairy'], 245: ['water'], 382: ['water'],
  220: ['ice', 'ground'], 361: ['ice'], 215: ['dark', 'ice'], 473: ['ice', 'ground'], 225: ['ice', 'flying'], 124: ['ice', 'psychic'],
  615: ['ice'], 459: ['grass', 'ice'], 378: ['ice'], 144: ['ice', 'flying'],
  88: ['poison'], 109: ['poison'], 194: ['water', 'ground'], 23: ['poison'], 89: ['poison'], 49: ['bug', 'poison'],
  169: ['poison', 'flying'], 270: ['water', 'grass'], 339: ['water', 'ground'], 453: ['poison', 'fighting'], 793: ['rock', 'poison'], 718: ['dragon', 'ground'],
  58: ['fire'], 218: ['fire'], 322: ['fire', 'ground'], 77: ['fire'], 324: ['fire'], 662: ['fire', 'flying'], 227: ['steel', 'flying'],
  126: ['fire'], 219: ['fire', 'rock'], 228: ['dark', 'fire'], 244: ['fire'], 250: ['fire', 'flying'],
  92: ['ghost', 'poison'], 200: ['ghost'], 353: ['ghost'], 302: ['dark', 'ghost'], 356: ['ghost'], 93: ['ghost', 'poison'],
  198: ['dark', 'flying'], 96: ['psychic'], 355: ['ghost'], 94: ['ghost', 'poison'], 487: ['ghost', 'dragon'], 491: ['dark'],
  147: ['dragon'], 371: ['dragon'], 443: ['dragon', 'ground'], 444: ['dragon', 'ground'], 445: ['dragon', 'ground'], 334: ['dragon', 'flying'],
  142: ['rock', 'flying'], 81: ['electric', 'steel'], 100: ['electric'], 239: ['electric'], 101: ['electric'], 462: ['electric', 'steel'],
  528: ['psychic', 'flying'], 587: ['electric', 'flying'], 280: ['psychic', 'fairy'], 599: ['steel'], 125: ['electric'], 243: ['electric'], 649: ['bug', 'steel'], 148: ['dragon'], 372: ['dragon'], 610: ['dragon'], 384: ['dragon', 'flying'], 493: ['normal'],
};

export const tdTypesOf = (id: number): readonly string[] => TD_TYPES[id] ?? CHIEF_TYPES[id] ?? ['normal'];

/** Papeles de los enemigos. */
export const ENEMY_KINDS = ['normal', 'fast', 'tank', 'flying', 'healer', 'shielded', 'hastener', 'chief', 'boss'] as const;
export type EnemyKind = (typeof ENEMY_KINDS)[number];

export const ENEMY_KIND_LABEL: Record<EnemyKind, string> = {
  normal: 'Salvaje',
  fast: 'Rápido',
  tank: 'Robusto',
  flying: 'Volador',
  healer: 'Curandero',
  shielded: 'Escudado',
  hastener: 'Acelerador',
  chief: 'Jefe',
  boss: 'Jefe legendario',
};

export interface MapFoes {
  normal: readonly number[];
  fast: readonly number[];
  tank: readonly number[];
  flying: readonly number[];
  healer: readonly number[];
  shielded: readonly number[];
  hastener: readonly number[];
  /** Jefe de la oleada 10 y jefe final (oleada 20). */
  bosses: readonly [number, number];
}

/** Salvajes de cada bioma (los mapas del mismo bioma comparten Pokémon). */
export const MAP_FOES: Readonly<Record<string, MapFoes>> = {
  bosque: { normal: [10, 43, 69], fast: [19], tank: [114], flying: [16, 12], healer: [182], shielded: [11], hastener: [123], bosses: [640, 251] },
  cueva: { normal: [74, 27, 50], fast: [51], tank: [95], flying: [41, 42], healer: [299], shielded: [75], hastener: [246], bosses: [377, 383] },
  mar: { normal: [118, 98, 72], fast: [120], tank: [131], flying: [278, 279], healer: [222], shielded: [90], hastener: [183], bosses: [245, 382] },
  nieve: { normal: [220, 361], fast: [215], tank: [473], flying: [225], healer: [124], shielded: [615], hastener: [459], bosses: [378, 144] },
  pantano: { normal: [88, 109, 194], fast: [23], tank: [89], flying: [49, 169], healer: [270], shielded: [339], hastener: [453], bosses: [793, 718] },
  volcan: { normal: [58, 218, 322], fast: [77], tank: [324], flying: [662, 227], healer: [126], shielded: [219], hastener: [228], bosses: [244, 250] },
  torre: { normal: [92, 200, 353], fast: [302], tank: [356], flying: [93, 198], healer: [96], shielded: [355], hastener: [94], bosses: [491, 487] },
  ciudad: { normal: [81, 100, 239], fast: [101], tank: [462], flying: [528, 587], healer: [280], shielded: [599], hastener: [125], bosses: [243, 649] },
  cumbre: { normal: [147, 371, 443], fast: [444], tank: [445], flying: [334, 142], healer: [148], shielded: [372], hastener: [610], bosses: [384, 493] },
};

/**
 * Torres «granjeras»: Pokémon de la suerte y el dinero (Meowth y Persian con Día de Pago, Gimmighoul y Gholdengo
 * con sus monedas, Chansey, Happiny y Blissey con sus huevos, Delibird con regalos, la línea de Hoppip que trae
 * semillas con el viento y Audino). Dan dinero al acabar cada oleada y atacan poco.
 */
export const FARM_IDS: ReadonlySet<number> = new Set([52, 53, 863, 999, 1000, 113, 242, 440, 225, 187, 188, 189, 531]);

/** Nombre del ataque nuevo al evolucionar (o del nivel final con aura), por tipo. */
export const FINAL_MOVE: Readonly<Record<string, string>> = {
  normal: 'Hiperrayo', fire: 'Llamarada', water: 'Hidrobomba', electric: 'Trueno', grass: 'Rayo Solar', ice: 'Ventisca',
  fighting: 'A Bocajarro', poison: 'Bomba Lodo', ground: 'Terremoto', flying: 'Pájaro Osado', psychic: 'Psíquico',
  bug: 'Zumbido', rock: 'Avalancha', ghost: 'Bola Sombra', dragon: 'Cometa Draco', dark: 'Pulso Umbrío',
  steel: 'Foco Resplandor', fairy: 'Fuerza Lunar',
};
export const finalMoveOf = (type: string): string => FINAL_MOVE[type] ?? 'Hiperrayo';

/** Datos mínimos de un Pokémon para usarlo como torre. */
export interface TdMon {
  id: number;
  name: string;
  types: readonly string[];
  stats: BaseStats;
  /** Rareza del gacha (influye en el coste y el daño). */
  rarity: 'common' | 'rare' | 'epic' | 'ultra' | 'legendary';
  /** Mejoras de la colección de este Pokémon (UpgradeScene): daño, cadencia y alcance. */
  upgrades?: { damage?: number; rate?: number; range?: number };
}

const st = (hp: number, attack: number, defense: number, spAttack: number, spDefense: number, speed: number): BaseStats => ({
  hp, attack, defense, spAttack, spDefense, speed,
});

/** Equipo de prueba para quien aún no tiene Pokémon (o juega sin cuenta y no tiene bastantes). */
export const TRIAL_TEAM: readonly TdMon[] = [
  { id: 25, name: 'Pikachu', types: ['electric'], stats: st(35, 55, 40, 50, 50, 90), rarity: 'common' },
  { id: 4, name: 'Charmander', types: ['fire'], stats: st(39, 52, 43, 60, 50, 65), rarity: 'common' },
  { id: 7, name: 'Squirtle', types: ['water'], stats: st(44, 48, 65, 50, 64, 43), rarity: 'common' },
  { id: 1, name: 'Bulbasaur', types: ['grass', 'poison'], stats: st(45, 49, 49, 65, 65, 45), rarity: 'common' },
  { id: 52, name: 'Meowth', types: ['normal'], stats: st(40, 45, 35, 40, 40, 90), rarity: 'common' },
  { id: 16, name: 'Pidgey', types: ['normal', 'flying'], stats: st(40, 45, 40, 35, 35, 56), rarity: 'common' },
];
