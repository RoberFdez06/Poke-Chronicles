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
  // Enemigos con trucos (esquivos, planeadores, saboteadores, divisores y adaptables)
  290: ['bug', 'ground'], 15: ['bug', 'poison'], 46: ['bug', 'grass'], 102: ['grass', 'psychic'], 213: ['bug', 'rock'],
  328: ['ground'], 207: ['ground', 'flying'], 304: ['steel', 'rock'], 524: ['rock'], 185: ['rock'],
  158: ['water'], 226: ['water', 'flying'], 170: ['water', 'electric'], 592: ['water', 'ghost'], 91: ['water', 'ice'],
  238: ['ice', 'psychic'], 582: ['ice'], 87: ['water', 'ice'], 613: ['ice'], 362: ['ice'],
  316: ['poison'], 269: ['bug', 'poison'], 211: ['water', 'poison'], 568: ['poison'], 435: ['poison', 'dark'],
  155: ['fire'], 663: ['fire', 'flying'], 240: ['fire'], 850: ['fire', 'bug'], 323: ['fire', 'ground'],
  354: ['ghost'], 425: ['ghost', 'flying'], 429: ['ghost'], 607: ['ghost', 'fire'], 477: ['ghost'],
  309: ['electric'], 82: ['electric', 'steel'], 479: ['electric', 'ghost'], 137: ['normal'], 436: ['steel', 'psychic'],
  696: ['rock', 'dragon'], 715: ['flying', 'dragon'], 621: ['dragon'], 704: ['dragon'], 330: ['ground', 'dragon'],
};

/** Tipos de los Pokémon de los niveles temáticos (themes.ts) que no estén ya en TD_TYPES (tipos reales de PokeAPI). */
export const THEME_MON_TYPES: Readonly<Record<number, readonly string[]>> = {
  161: ['normal'], 263: ['normal'], 399: ['normal'], 396: ['normal', 'flying'], 20: ['normal'], 217: ['normal'], 128: ['normal'], 289: ['normal'],
  4: ['fire'], 37: ['fire'], 59: ['fire'], 6: ['fire', 'flying'],
  7: ['water'], 54: ['water'], 60: ['water'], 8: ['water'], 61: ['water'], 130: ['water', 'flying'], 134: ['water'],
  25: ['electric'], 179: ['electric'], 180: ['electric'], 466: ['electric'], 135: ['electric'],
  1: ['grass', 'poison'], 152: ['grass'], 191: ['grass'], 357: ['grass', 'flying'], 2: ['grass', 'poison'], 3: ['grass', 'poison'], 465: ['grass'],
  478: ['ice', 'ghost'], 131: ['water', 'ice'], 460: ['grass', 'ice'], 471: ['ice'],
  66: ['fighting'], 56: ['fighting'], 236: ['fighting'], 296: ['fighting'], 701: ['fighting', 'flying'], 67: ['fighting'], 297: ['fighting'],
  68: ['fighting'], 448: ['fighting', 'steel'],
  29: ['poison'], 24: ['poison'], 454: ['poison', 'fighting'], 110: ['poison'],
  104: ['ground'], 111: ['ground', 'rock'], 232: ['ground'], 105: ['ground'], 112: ['ground', 'rock'],
  821: ['flying'], 84: ['normal', 'flying'], 276: ['normal', 'flying'], 17: ['normal', 'flying'], 22: ['normal', 'flying'], 822: ['flying'],
  85: ['normal', 'flying'], 823: ['flying', 'steel'], 18: ['normal', 'flying'], 398: ['normal', 'flying'],
  63: ['psychic'], 79: ['water', 'psychic'], 177: ['psychic', 'flying'], 178: ['psychic', 'flying'], 97: ['psychic'], 80: ['water', 'psychic'],
  65: ['psychic'], 196: ['psychic'],
  13: ['bug', 'poison'], 48: ['bug', 'poison'], 265: ['bug'], 193: ['bug', 'flying'], 127: ['bug'], 168: ['bug', 'poison'], 212: ['bug', 'steel'], 214: ['bug', 'fighting'],
  337: ['rock', 'psychic'], 76: ['rock', 'ground'], 248: ['rock', 'dark'],
  426: ['ghost', 'flying'], 711: ['ghost', 'grass'], 477: ['ghost'],
  261: ['dark'], 509: ['dark'], 430: ['dark', 'flying'], 262: ['dark'], 229: ['dark', 'fire'], 197: ['dark'], 359: ['dark'],
  374: ['steel', 'psychic'], 305: ['steel', 'rock'], 208: ['steel', 'ground'], 306: ['steel', 'rock'], 376: ['steel', 'psychic'],
  35: ['fairy'], 39: ['normal', 'fairy'], 173: ['fairy'], 209: ['fairy'], 176: ['fairy', 'flying'], 682: ['fairy'], 36: ['fairy'], 210: ['fairy'],
  700: ['fairy'], 282: ['psychic', 'fairy'],
};

export const tdTypesOf = (id: number): readonly string[] => TD_TYPES[id] ?? THEME_MON_TYPES[id] ?? CHIEF_TYPES[id] ?? ['normal'];

/** Papeles de los enemigos. */
export const ENEMY_KINDS = [
  'normal', 'fast', 'tank', 'flying', 'healer', 'shielded', 'hastener', 'dodger', 'soarer', 'saboteur', 'splitter', 'adapter', 'brood', 'chief', 'boss',
] as const;
/** Papeles con truco (tricks.ts): obligan a cambiar de plan. */
export const TRICK_KINDS = ['dodger', 'soarer', 'splitter', 'saboteur', 'adapter'] as const;
export type TrickKind = (typeof TRICK_KINDS)[number];
export type EnemyKind = (typeof ENEMY_KINDS)[number];

export const ENEMY_KIND_LABEL: Record<EnemyKind, string> = {
  normal: 'Salvaje',
  fast: 'Rápido',
  tank: 'Robusto',
  flying: 'Volador',
  healer: 'Curandero',
  shielded: 'Escudado',
  hastener: 'Acelerador',
  dodger: 'Esquivo',
  soarer: 'Planeador',
  saboteur: 'Saboteador',
  splitter: 'Divisor',
  adapter: 'Adaptable',
  brood: 'Cría',
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
  dodger: readonly number[];
  soarer: readonly number[];
  saboteur: readonly number[];
  splitter: readonly number[];
  adapter: readonly number[];
  /** Jefe de la oleada 10 y jefe final (oleada 20). */
  bosses: readonly [number, number];
}

/** Salvajes de cada bioma (los mapas del mismo bioma comparten Pokémon). */
export const MAP_FOES: Readonly<Record<string, MapFoes>> = {
  bosque: { normal: [10, 43, 69], fast: [19], tank: [114], flying: [16, 12], healer: [182], shielded: [11], hastener: [123], dodger: [290], soarer: [15], saboteur: [46], splitter: [102], adapter: [213], bosses: [640, 251] },
  cueva: { normal: [74, 27, 50], fast: [51], tank: [95], flying: [41, 42], healer: [299], shielded: [75], hastener: [246], dodger: [328], soarer: [207], saboteur: [304], splitter: [524], adapter: [185], bosses: [377, 383] },
  mar: { normal: [118, 98, 72], fast: [120], tank: [131], flying: [278, 279], healer: [222], shielded: [90], hastener: [183], dodger: [158], soarer: [226], saboteur: [170], splitter: [592], adapter: [91], bosses: [245, 382] },
  nieve: { normal: [220, 361], fast: [215], tank: [473], flying: [225], healer: [124], shielded: [615], hastener: [459], dodger: [238], soarer: [582], saboteur: [87], splitter: [613], adapter: [362], bosses: [378, 144] },
  pantano: { normal: [88, 109, 194], fast: [23], tank: [89], flying: [49, 169], healer: [270], shielded: [339], hastener: [453], dodger: [316], soarer: [269], saboteur: [211], splitter: [568], adapter: [435], bosses: [793, 718] },
  volcan: { normal: [58, 218, 322], fast: [77], tank: [324], flying: [662, 227], healer: [126], shielded: [219], hastener: [228], dodger: [155], soarer: [663], saboteur: [240], splitter: [850], adapter: [323], bosses: [244, 250] },
  torre: { normal: [92, 200, 353], fast: [302], tank: [356], flying: [93, 198], healer: [96], shielded: [355], hastener: [94], dodger: [354], soarer: [425], saboteur: [429], splitter: [607], adapter: [477], bosses: [491, 487] },
  ciudad: { normal: [81, 100, 239], fast: [101], tank: [462], flying: [528, 587], healer: [280], shielded: [599], hastener: [125], dodger: [309], soarer: [82], saboteur: [479], splitter: [137], adapter: [436], bosses: [243, 649] },
  cumbre: { normal: [147, 371, 443], fast: [444], tank: [445], flying: [334, 142], healer: [148], shielded: [372], hastener: [610], dodger: [696], soarer: [715], saboteur: [621], splitter: [704], adapter: [330], bosses: [384, 493] },
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
