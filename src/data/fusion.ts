// Fusión de poderes: dos ranuras se combinan en UN poder nuevo más fuerte (la otra ranura queda libre).
// - Receta por pareja de TIPOS (sin orden): ~60 con nombre propio; el resto de parejas, un nombre compuesto de sus
//   dos tipos; mismo tipo = versión «Superior» (×1,5 y más grande).
// - Cada una de las 171 parejas (153 de tipos distintos + 18 del mismo) tiene un ESTILO ÚNICO: forma del proyectil,
//   estela, impacto, movimiento, partículas, escala y tono. Se ensambla de forma determinista a partir de un catálogo
//   de piezas pixel (ui/art/fusionArt.ts) y no hay dos parejas con la misma firma (ver tests/fusion.test.ts).
// - Daño ≈ 1,6× el del más fuerte (con tope), recarga nunca menor que la del más lento (con tope).
// - Una fusión por piso, irreversible, y lo fusionado no se vuelve a fusionar (un solo nivel).
// Lógica pura (sin Phaser): el motor que la lanza está en scenes/fusionCast.ts.
import { styleForMove, type Motion, type Pattern } from './movePatterns.ts';
import { shapeForPower, type FusionTag, type MovePower } from './items.ts';
import { TYPE_COLORS, typeNameEs } from './types.ts';

/** Los 18 tipos. */
export const FUSION_TYPES = Object.keys(TYPE_COLORS);

// --- Catálogo de piezas del estilo ---

/** Forma del proyectil. */
export const FUSION_SHAPES = [
  'helice', 'cometa', 'cristal', 'espora', 'anillo', 'media-luna', 'estrella',
  'gota', 'runa', 'colmillo', 'flor', 'meteoro', 'rayo-doble', 'remolino',
] as const;
/** Estela que deja. */
export const FUSION_TRAILS = ['chispas', 'cinta', 'puntos', 'trenza', 'humo', 'escamas', 'llamas', 'estrellas', 'quebrada'] as const;
/** Impacto al chocar. */
export const FUSION_IMPACTS = ['anillos', 'estallido', 'cruz', 'petalos', 'grietas', 'chispazo', 'burbujas', 'sello', 'espiral', 'esquirlas', 'destello'] as const;
/** Cómo cambia el vuelo de sus proyectiles. */
export const FUSION_MOTIONS = ['recto', 'ondula', 'gira', 'acelera', 'zigzag'] as const;

export type FusionShape = (typeof FUSION_SHAPES)[number];
export type FusionTrail = (typeof FUSION_TRAILS)[number];
export type FusionImpact = (typeof FUSION_IMPACTS)[number];
export type FusionMotion = (typeof FUSION_MOTIONS)[number];

/** Estilo completo de una fusión. */
export interface FusionStyle {
  shape: FusionShape;
  trail: FusionTrail;
  impact: FusionImpact;
  motion: FusionMotion;
  /** Partículas de la estela (2-8). */
  particles: number;
  /** Escala del dibujo (0,9-1,2). */
  scale: number;
  /** Tono del sonido (semitonos sobre el del tipo, -6..+6). */
  tone: number;
}

/** Una parte del ataque fusionado: un patrón del catálogo, su daño relativo y cuándo sale (ms tras el primero). */
export interface FusionPart {
  pattern: Pattern;
  mul: number;
  delay: number;
}

/** Combinaciones de patrones. La primera parte va con el tipo principal; la segunda, con el otro. */
export const FUSION_COMBOS = {
  'rafaga-onda': { label: 'ráfaga + onda', parts: [
    { pattern: { k: 'shot', n: 1, spread: 0, speed: 680, size: 1.1, burst: 4, gap: 80, anim: 'pulse' }, mul: 0.55, delay: 0 },
    { pattern: { k: 'nova', n: 14, speed: 420, size: 1, rings: 2 }, mul: 0.45, delay: 360 },
  ] },
  'abanico-perforante': { label: 'abanico + perforante', parts: [
    { pattern: { k: 'shot', n: 5, spread: 0.9, speed: 600, size: 1.1 }, mul: 0.6, delay: 0 },
    { pattern: { k: 'shot', n: 1, spread: 0, speed: 720, size: 1.9, pierce: 4, anim: 'pulse', life: 1200 }, mul: 1.1, delay: 160 },
  ] },
  'orbitas-lluvia': { label: 'órbitas + lluvia', parts: [
    { pattern: { k: 'orbit', n: 4, radius: 84, ms: 2600, size: 1.4 }, mul: 0.5, delay: 0 },
    { pattern: { k: 'rain', n: 5, radius: 52, area: 210, delay: 380, spacing: 100 }, mul: 0.9, delay: 200 },
  ] },
  'mina-ola': { label: 'ola + minas', parts: [
    { pattern: { k: 'wall', n: 7, gap: 32, speed: 340, size: 1.4, life: 1300 }, mul: 0.7, delay: 0 },
    { pattern: { k: 'mine', n: 4, radius: 70, life: 7000 }, mul: 1.1, delay: 250 },
  ] },
  'rebote-cadena': { label: 'bumerán + cadena', parts: [
    { pattern: { k: 'shot', n: 3, spread: 0.6, speed: 520, size: 1.3, motion: { m: 'boomerang', outMs: 520 }, anim: 'spin', life: 1400, pierce: 2 }, mul: 0.6, delay: 0 },
    { pattern: { k: 'chain', jumps: 5, range: 300 }, mul: 0.9, delay: 200 },
  ] },
  'rayo-estallido': { label: 'rayo corto + estallido', parts: [
    { pattern: { k: 'beam', ms: 450, width: 40, length: 300 }, mul: 0.35, delay: 0 },
    { pattern: { k: 'nova', n: 16, speed: 460, size: 1.1 }, mul: 0.5, delay: 420 },
  ] },
  'erupcion-bomba': { label: 'columnas + bombas', parts: [
    { pattern: { k: 'eruption', steps: 6, gap: 80, radius: 60, every: 100 }, mul: 0.75, delay: 0 },
    { pattern: { k: 'lob', n: 3, radius: 80, dist: 0, spread: 0.7 }, mul: 0.9, delay: 300 },
  ] },
  'bumeran-espiral': { label: 'bumerán + espiral', parts: [
    { pattern: { k: 'shot', n: 2, spread: 0.5, speed: 560, size: 1.3, motion: { m: 'boomerang', outMs: 560 }, anim: 'spin', life: 1500, pierce: 3 }, mul: 0.7, delay: 0 },
    { pattern: { k: 'nova', n: 10, speed: 360, size: 1, motion: { m: 'spiral', turn: 2.4 } }, mul: 0.45, delay: 250 },
  ] },
  'terremoto-columnas': { label: 'temblor + columnas', parts: [
    { pattern: { k: 'quake', radius: 210, ms: 520 }, mul: 0.9, delay: 0 },
    { pattern: { k: 'eruption', steps: 6, gap: 84, radius: 56, every: 100 }, mul: 0.7, delay: 260 },
  ] },
  'chorro-bomba': { label: 'chorro + bomba', parts: [
    { pattern: { k: 'stream', ms: 700, every: 40, spread: 0.34, speed: 540, size: 1, life: 450 }, mul: 0.22, delay: 0 },
    { pattern: { k: 'shot', n: 1, spread: 0, speed: 400, size: 2.3, anim: 'pulse', explode: 120, life: 950 }, mul: 1.4, delay: 720 },
  ] },
  'embestida-onda': { label: 'embestida + onda', parts: [
    { pattern: { k: 'dash', dist: 260, ms: 260, radius: 64 }, mul: 1.2, delay: 0 },
    { pattern: { k: 'nova', n: 12, speed: 440, size: 1.1 }, mul: 0.5, delay: 280 },
  ] },
  meteoro: { label: 'meteoro + lluvia', parts: [
    { pattern: { k: 'shot', n: 1, spread: 0, speed: 380, size: 2.4, anim: 'spin', explode: 130, life: 950 }, mul: 1.5, delay: 0 },
    { pattern: { k: 'rain', n: 4, radius: 50, area: 220, delay: 400, spacing: 110 }, mul: 0.9, delay: 150 },
  ] },
  'zigzag-cadena': { label: 'zigzag + cadena', parts: [
    { pattern: { k: 'shot', n: 3, spread: 0.5, speed: 700, size: 1, motion: { m: 'zigzag', every: 70, angle: 0.85 }, anim: 'flicker' }, mul: 0.7, delay: 0 },
    { pattern: { k: 'chain', jumps: 5, range: 300 }, mul: 0.9, delay: 180 },
  ] },
  buscadores: { label: 'buscadores + anillo', parts: [
    { pattern: { k: 'shot', n: 3, spread: 0.9, speed: 400, size: 1.3, motion: { m: 'homing', turn: 4.5, delay: 120 }, anim: 'pulse', life: 1700 }, mul: 0.8, delay: 0 },
    { pattern: { k: 'nova', n: 12, speed: 400, size: 1 }, mul: 0.45, delay: 300 },
  ] },
} as const satisfies Record<string, { label: string; parts: readonly FusionPart[] }>;
export type FusionCombo = keyof typeof FUSION_COMBOS;
export const COMBO_IDS = Object.keys(FUSION_COMBOS) as FusionCombo[];

export interface FusionRecipe {
  name: string;
  combo: FusionCombo;
  style: FusionStyle;
  kind: 'named' | 'compound' | 'superior';
}

/** Clave de una pareja sin orden. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}+${b}` : `${b}+${a}`;
}

/** Recetas con nombre propio: nombre, combinación y forma de proyectil que mejor le pega. */
const NAMED: Record<string, { name: string; combo: FusionCombo; shape: FusionShape }> = {};
const add = (a: string, b: string, name: string, combo: FusionCombo, shape: FusionShape) => (NAMED[pairKey(a, b)] = { name, combo, shape });

add('fire', 'water', 'Vapor Ardiente', 'chorro-bomba', 'espora');
add('fire', 'grass', 'Ceniza Florida', 'orbitas-lluvia', 'flor');
add('fire', 'electric', 'Plasma Ígneo', 'rebote-cadena', 'anillo');
add('fire', 'ice', 'Choque Térmico', 'abanico-perforante', 'cristal');
add('fire', 'fighting', 'Puño Volcánico', 'embestida-onda', 'meteoro');
add('fire', 'poison', 'Humo Tóxico', 'mina-ola', 'espora');
add('fire', 'ground', 'Magma Sísmico', 'terremoto-columnas', 'meteoro');
add('fire', 'flying', 'Ave Fénix', 'bumeran-espiral', 'cometa');
add('fire', 'psychic', 'Llama Mental', 'buscadores', 'estrella');
add('fire', 'bug', 'Enjambre Ígneo', 'rafaga-onda', 'espora');
add('fire', 'rock', 'Lluvia de Meteoros', 'meteoro', 'meteoro');
add('fire', 'ghost', 'Fuego Fatuo', 'orbitas-lluvia', 'media-luna');
add('fire', 'dragon', 'Aliento Infernal', 'chorro-bomba', 'cometa');
add('fire', 'dark', 'Brasa Umbría', 'abanico-perforante', 'colmillo');
add('fire', 'steel', 'Forja Candente', 'rayo-estallido', 'cristal');
add('fire', 'fairy', 'Chispa Estelar', 'rafaga-onda', 'estrella');
add('water', 'grass', 'Lluvia Fértil', 'orbitas-lluvia', 'gota');
add('water', 'electric', 'Descarga Marina', 'zigzag-cadena', 'rayo-doble');
add('water', 'ice', 'Marea Glacial', 'mina-ola', 'cristal');
add('water', 'ground', 'Avalancha de Lodo', 'erupcion-bomba', 'gota');
add('water', 'flying', 'Tifón', 'bumeran-espiral', 'remolino');
add('water', 'psychic', 'Espejo de Agua', 'buscadores', 'anillo');
add('water', 'dragon', 'Leviatán', 'rayo-estallido', 'helice');
add('water', 'dark', 'Abismo', 'mina-ola', 'media-luna');
add('water', 'poison', 'Ciénaga Ácida', 'mina-ola', 'gota');
add('water', 'fairy', 'Rocío Lunar', 'rafaga-onda', 'gota');
add('electric', 'ice', 'Tormenta Polar', 'orbitas-lluvia', 'cristal');
add('electric', 'steel', 'Bobina Magnética', 'rebote-cadena', 'anillo');
add('electric', 'flying', 'Rayo Celeste', 'zigzag-cadena', 'rayo-doble');
add('electric', 'psychic', 'Sinapsis', 'zigzag-cadena', 'estrella');
add('electric', 'dragon', 'Trueno Draconiano', 'rayo-estallido', 'rayo-doble');
add('electric', 'bug', 'Enjambre Voltio', 'rafaga-onda', 'rayo-doble');
add('electric', 'grass', 'Raíz Eléctrica', 'erupcion-bomba', 'flor');
add('grass', 'ground', 'Raíz Sísmica', 'terremoto-columnas', 'flor');
add('grass', 'poison', 'Jardín Venenoso', 'mina-ola', 'flor');
add('grass', 'ice', 'Escarcha Floral', 'abanico-perforante', 'flor');
add('grass', 'flying', 'Vendaval de Hojas', 'bumeran-espiral', 'flor');
add('grass', 'fairy', 'Polen Hada', 'orbitas-lluvia', 'flor');
add('grass', 'bug', 'Plaga Verde', 'rafaga-onda', 'espora');
add('ice', 'rock', 'Glaciar', 'meteoro', 'cristal');
add('ice', 'flying', 'Ventisca Alada', 'bumeran-espiral', 'cristal');
add('ice', 'dragon', 'Dragón de Hielo', 'chorro-bomba', 'helice');
add('fighting', 'steel', 'Puño de Acero', 'embestida-onda', 'colmillo');
add('fighting', 'psychic', 'Aura Mental', 'buscadores', 'estrella');
add('fighting', 'rock', 'Golpe Tectónico', 'terremoto-columnas', 'meteoro');
add('fighting', 'dark', 'Golpe Sombrío', 'embestida-onda', 'colmillo');
add('poison', 'ghost', 'Miasma Espectral', 'orbitas-lluvia', 'media-luna');
add('poison', 'bug', 'Aguijón Letal', 'abanico-perforante', 'colmillo');
add('ground', 'rock', 'Corrimiento', 'terremoto-columnas', 'meteoro');
add('ground', 'steel', 'Taladro Férreo', 'abanico-perforante', 'colmillo');
add('flying', 'dragon', 'Ciclón Draco', 'bumeran-espiral', 'helice');
add('psychic', 'ghost', 'Pesadilla', 'buscadores', 'runa');
add('psychic', 'fairy', 'Luz Astral', 'rafaga-onda', 'estrella');
add('psychic', 'dark', 'Paradoja', 'rebote-cadena', 'runa');
add('ghost', 'dark', 'Noche Eterna', 'mina-ola', 'media-luna');
add('dragon', 'fairy', 'Fulgor Draco', 'rafaga-onda', 'helice');
add('dragon', 'dark', 'Furia Abisal', 'embestida-onda', 'colmillo');
add('steel', 'fairy', 'Joya Brillante', 'abanico-perforante', 'cristal');
add('steel', 'rock', 'Muralla Férrea', 'meteoro', 'cristal');
add('bug', 'steel', 'Enjambre Metálico', 'rafaga-onda', 'colmillo');
add('normal', 'fighting', 'Golpe Total', 'embestida-onda', 'estrella');
add('normal', 'flying', 'Vuelo Raudo', 'bumeran-espiral', 'cometa');

/** Nombres con nombre propio (clave de pareja → nombre), para el libro y los tests. */
export const NAMED_RECIPES: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(NAMED).map(([k, v]) => [k, v.name]));

/** Sustantivo de cada tipo (manda el más potente) y adjetivo (pone el otro) para las parejas sin nombre propio. */
const NOUN: Record<string, string> = {
  normal: 'Golpe', fire: 'Llama', water: 'Marea', electric: 'Chispa', grass: 'Liana', ice: 'Escarcha',
  fighting: 'Puño', poison: 'Niebla', ground: 'Duna', flying: 'Ráfaga', psychic: 'Mente', bug: 'Aguijón',
  rock: 'Roca', ghost: 'Espectro', dragon: 'Colmillo Draco', dark: 'Sombra', steel: 'Hoja de Acero', fairy: 'Destello',
};
const ADJ: Record<string, string> = {
  normal: 'Pura', fire: 'Ígnea', water: 'Marina', electric: 'Voltaica', grass: 'Silvestre', ice: 'Glacial',
  fighting: 'Marcial', poison: 'Venenosa', ground: 'Telúrica', flying: 'Alada', psychic: 'Psíquica', bug: 'Insecta',
  rock: 'Pétrea', ghost: 'Fantasmal', dragon: 'Dracónica', dark: 'Umbría', steel: 'Férrea', fairy: 'Feérica',
};

/** Las 171 parejas sin orden (153 de tipos distintos + 18 del mismo), en orden estable. */
export const ALL_PAIR_KEYS: readonly string[] = (() => {
  const out: string[] = [];
  const t = [...FUSION_TYPES].sort();
  for (let i = 0; i < t.length; i++) for (let j = i; j < t.length; j++) out.push(pairKey(t[i], t[j]));
  return out;
})();
const PAIR_INDEX = new Map(ALL_PAIR_KEYS.map((k, i) => [k, i]));

/**
 * Estilo de una pareja. Estela, impacto y movimiento salen del índice de la pareja con módulos primos entre sí
 * (9 × 11 × 5 = 495 > 171), así que dos parejas nunca coinciden en los tres a la vez (teorema chino del resto);
 * la forma la elige la receta con nombre o sale del índice (mód. 14) y el resto se mezcla para que no se parezcan.
 */
export function styleForPair(key: string, shape?: FusionShape): FusionStyle {
  const i = PAIR_INDEX.get(key) ?? 0;
  const h = Math.imul(i + 11, 2654435761) >>> 0;
  return {
    shape: shape ?? FUSION_SHAPES[(i * 5 + 3) % FUSION_SHAPES.length],
    trail: FUSION_TRAILS[i % FUSION_TRAILS.length],
    impact: FUSION_IMPACTS[(i * 4) % FUSION_IMPACTS.length],
    motion: FUSION_MOTIONS[(i * 2) % FUSION_MOTIONS.length],
    particles: 2 + (h % 7),
    scale: 0.9 + ((h >>> 8) % 4) * 0.1,
    tone: ((h >>> 12) % 13) - 6,
  };
}

/** Firma del estilo (para comprobar que no se repite ninguno). */
export const styleSignature = (s: FusionStyle): string => `${s.shape}|${s.trail}|${s.impact}|${s.motion}|${s.particles}|${s.scale.toFixed(2)}|${s.tone}`;

/** Receta de una pareja (sin orden para el estilo; `strong` = tipo del más potente, decide el nombre compuesto). */
export function recipeFor(a: string, b: string, strong: string = a): { key: string; recipe: FusionRecipe } {
  const pk = pairKey(a, b);
  if (a === b) return { key: `sup:${a}`, recipe: recipeByKey(`sup:${a}`) };
  if (NAMED[pk]) return { key: pk, recipe: recipeByKey(pk) };
  const s = strong === b ? b : a;
  const w = s === a ? b : a;
  return { key: `gen:${s}+${w}`, recipe: recipeByKey(`gen:${s}+${w}`) };
}

/** Receta por la clave guardada en el poder («fire+water», «gen:fire+bug» o «sup:fire»). */
export function recipeByKey(key: string): FusionRecipe {
  const i = (k: string) => PAIR_INDEX.get(k) ?? 0;
  if (key.startsWith('sup:')) {
    const t = key.slice(4);
    const pk = pairKey(t, t);
    return { name: `${typeNameEs(t)} Superior`, combo: COMBO_IDS[(i(pk) * 3) % COMBO_IDS.length], style: styleForPair(pk), kind: 'superior' };
  }
  if (key.startsWith('gen:')) {
    const [s, w] = key.slice(4).split('+');
    const pk = pairKey(s ?? 'normal', w ?? 'normal');
    return { name: `${NOUN[s] ?? 'Golpe'} ${ADJ[w] ?? 'Pura'}`, combo: COMBO_IDS[(i(pk) * 3) % COMBO_IDS.length], style: styleForPair(pk), kind: 'compound' };
  }
  const n = NAMED[key];
  if (n) return { name: n.name, combo: n.combo, style: styleForPair(key, n.shape), kind: 'named' };
  return { name: 'Fusión', combo: 'rafaga-onda', style: styleForPair(key), kind: 'compound' };
}

// --- Números ---

export const FUSION_POWER_MUL = 1.6;
export const SUPERIOR_POWER_MUL = 1.5;
/** Tope de potencia de un poder fusionado. */
export const FUSION_POWER_CAP = 240;
/** La recarga sube un 15 % sobre la del más lento, con tope. */
export const FUSION_CD_MUL = 1.15;
export const FUSION_CD_CAP = 10000;
/** Tamaño de los proyectiles de una Superior. */
export const SUPERIOR_SIZE_MUL = 1.35;

/** Potencia: ≈1,6× la del más fuerte (1,5× si son del mismo tipo), nunca menos que el más fuerte, con tope. */
export function fusionPower(pa: number, pb: number, same = false): number {
  const top = Math.max(pa, pb, 1);
  return Math.max(top, Math.min(FUSION_POWER_CAP, Math.round(top * (same ? SUPERIOR_POWER_MUL : FUSION_POWER_MUL))));
}

/** Recarga efectiva de un poder normal (la del movimiento por la de su estilo). */
export function effectiveCooldown(m: MovePower): number {
  return Math.round(m.cooldown * styleForMove(m).cd);
}

/** Recarga: la del más lento ×1,15 (nunca más barata que la mayor), con tope de 10 s. */
export function fusionCooldown(ca: number, cb: number): number {
  const top = Math.max(ca, cb);
  return Math.max(top, Math.min(FUSION_CD_CAP, Math.round(top * FUSION_CD_MUL)));
}

// --- Partes del ataque ---

/** Agranda un patrón (Superior). */
export function enlargePattern(p: Pattern, k: number): Pattern {
  switch (p.k) {
    case 'shot':
    case 'nova':
    case 'orbit':
    case 'wall':
      return { ...p, size: p.size * k };
    case 'stream':
      return { ...p, size: p.size * k, ms: Math.round(p.ms * k) };
    case 'beam':
      return { ...p, width: Math.round(p.width * k) };
    case 'quake':
    case 'vortex':
    case 'rain':
    case 'lob':
    case 'mine':
    case 'dash':
      return { ...p, radius: Math.round(p.radius * k) };
    case 'eruption':
      return { ...p, radius: Math.round(p.radius * k), steps: p.steps + 1 };
    case 'chain':
      return { ...p, jumps: p.jumps + 2 };
  }
}

/** Movimiento propio del estilo (solo a proyectiles que vuelan recto). */
function motionOf(m: FusionMotion): Motion | undefined {
  switch (m) {
    case 'ondula': return { m: 'wave', amp: 18, freq: 3 };
    case 'gira': return { m: 'spiral', turn: 1.2 };
    case 'acelera': return { m: 'accel', to: 1.8, ms: 500 };
    case 'zigzag': return { m: 'zigzag', every: 90, angle: 0.6 };
    default: return undefined;
  }
}

/** Aplica el estilo a un patrón: movimiento propio y escala. */
export function stylePattern(p: Pattern, s: FusionStyle): Pattern {
  if (p.k === 'shot' && !p.motion && !p.burst) {
    const mv = motionOf(s.motion);
    return { ...p, size: p.size * s.scale, ...(mv ? { motion: mv } : {}) };
  }
  if (p.k === 'nova' && !p.motion) {
    const mv = motionOf(s.motion);
    return { ...p, size: p.size * s.scale, ...(mv ? { motion: mv } : {}) };
  }
  if (p.k === 'shot' || p.k === 'orbit' || p.k === 'wall') return { ...p, size: p.size * s.scale };
  return p;
}

/** Partes de un poder fusionado, ya con su estilo; cada una con el tipo que inflige. */
export function fusionParts(m: MovePower): { pattern: Pattern; mul: number; delay: number; type: string }[] {
  const f = m.fusion;
  if (!f) return [];
  const recipe = recipeByKey(f.recipe);
  const parts = FUSION_COMBOS[recipe.combo].parts;
  if (f.recipe.startsWith('sup:')) {
    // Mismo tipo: su estilo de siempre más grande y, detrás, la segunda parte de su combinación
    const base = styleForMove({ id: Math.abs(m.id), name: f.from[0], type: m.type, power: m.power });
    return [
      { pattern: stylePattern(enlargePattern(base.pattern, SUPERIOR_SIZE_MUL), recipe.style), mul: base.mul, delay: 0, type: f.types[0] },
      { pattern: stylePattern(enlargePattern(parts[1].pattern, SUPERIOR_SIZE_MUL), recipe.style), mul: parts[1].mul * 0.8, delay: parts[1].delay, type: f.types[0] },
    ];
  }
  return parts.map((p, i) => ({ pattern: stylePattern(p.pattern, recipe.style), mul: p.mul, delay: p.delay, type: f.types[i] ?? f.types[0] }));
}

/** Texto corto del patrón para la vista previa. */
export function patternLabel(m: MovePower): string {
  const f = m.fusion;
  if (!f) return '';
  const r = recipeByKey(f.recipe);
  const label = FUSION_COMBOS[r.combo].label;
  const how = r.style.motion === 'recto' ? '' : ` (${r.style.motion})`;
  return (f.recipe.startsWith('sup:') ? `su ataque, más grande + ${label.split(' + ')[1]}` : label) + how;
}

/** Estilo del poder fusionado. */
export const fusionStyleOf = (m: MovePower): FusionStyle | null => (m.fusion ? recipeByKey(m.fusion.recipe).style : null);

// --- Reglas ---

/** Id estable (negativo, para no chocar con PokeAPI) del poder fusionado. */
export function fusionId(a: MovePower, b: MovePower): number {
  const x = (Math.imul(Math.abs(a.id) + 1, 40503) ^ Math.imul(Math.abs(b.id) + 7, 69069)) >>> 0;
  return -(1 + (x % 900000000));
}

const cap = (s: string) => s.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** Crea el poder fusionado de `a` y `b` (sin mirar las reglas). */
export function fusePowers(a: MovePower, b: MovePower): MovePower {
  // El más potente manda (tipo principal); a igualdad, el primero elegido
  const [s, w] = b.power > a.power ? [b, a] : [a, b];
  const same = a.type === b.type;
  const { key, recipe } = recipeFor(s.type, w.type, s.type);
  const name = same ? `${cap(s.name)} Superior` : recipe.name;
  const power = fusionPower(a.power, b.power, same);
  const tag: FusionTag = { recipe: key, types: [s.type, w.type], from: [s.name, w.name] };
  return { id: fusionId(a, b), name, type: s.type, power, shape: shapeForPower(power), cooldown: fusionCooldown(effectiveCooldown(a), effectiveCooldown(b)), fusion: tag };
}

export const isFused = (m: MovePower | null | undefined): boolean => !!m?.fusion;

/** Tipos de un poder: los dos si está fusionado (sin repetir). */
export function moveTypes(m: MovePower): string[] {
  return m.fusion ? [...new Set(m.fusion.types)] : [m.type];
}

/** ¿El poder es (o lleva) de este tipo? */
export const moveHasType = (m: MovePower | null | undefined, t: string): boolean => !!m && moveTypes(m).includes(t);

/** Tipos de los poderes de las ranuras (los fusionados cuentan por los dos), para sinergias y efectos por tipo. */
export function powerTypes(slots: readonly (MovePower | null)[]): string[] {
  return slots.flatMap((m) => (m ? moveTypes(m) : []));
}

/** Por qué no se puede fusionar (null = se puede). `usedFloor` = último piso en que se fusionó (0 = nunca). */
export function fusionBlock(slots: readonly (MovePower | null)[], i: number, j: number, floor: number, usedFloor: number, free = false): string | null {
  if (!free && usedFloor === floor) return 'Ya has fusionado en este piso: podrás en el siguiente.';
  if (i === j) return 'Elige dos poderes distintos.';
  const a = slots[i];
  const b = slots[j];
  if (!a || !b) return 'Esa ranura está vacía.';
  if (a.fusion || b.fusion) return 'Un poder fusionado no se puede volver a fusionar.';
  return null;
}

/** Ranuras que pueden entrar en una fusión (llenas y sin fusionar; hacen falta al menos dos). */
export function fusableSlots(slots: readonly (MovePower | null)[]): number[] {
  const ok = slots.map((m, i) => (m && !m.fusion ? i : -1)).filter((i) => i >= 0);
  return ok.length >= 2 ? ok : [];
}

/** Aplica la fusión: el resultado ocupa la ranura `i` y la `j` queda libre. null si no se puede. */
export function applyFusion(slots: readonly (MovePower | null)[], i: number, j: number, floor: number, usedFloor: number, free = false): { slots: (MovePower | null)[]; result: MovePower } | null {
  if (fusionBlock(slots, i, j, floor, usedFloor, free)) return null;
  const result = fusePowers(slots[i] as MovePower, slots[j] as MovePower);
  const out = [...slots];
  out[i] = result;
  out[j] = null;
  return { slots: out, result };
}

/** ¿Es un `FusionTag` válido? (guardado). */
export function isFusionTag(t: unknown): t is FusionTag {
  const o = t as FusionTag;
  return !!o && typeof o === 'object' && typeof o.recipe === 'string' && o.recipe.length > 0 &&
    Array.isArray(o.types) && o.types.length === 2 && o.types.every((x) => typeof x === 'string' && x in TYPE_COLORS) &&
    Array.isArray(o.from) && o.from.length === 2 && o.from.every((x) => typeof x === 'string');
}

// --- Fusión al recoger un 5.º poder (no desde la pausa) ---
// Solo con las 4 ranuras llenas y un poder nuevo en la mano. Sigue saliendo el cambio normal (elegir qué ranura
// reemplazar) y, además, «Fusionar» si entre las ranuras y el nuevo hay al menos dos poderes sin fusionar.
// Candidatos: las 4 ranuras (0-3) y el nuevo (4). Lo ya fusionado no se vuelve a fusionar.
// - Dos de las ranuras: el resultado ocupa la del primero y el nuevo entra en la que queda libre.
// - Una ranura + el nuevo: el resultado sustituye a esa ranura (el nuevo se gasta en la fusión).
// - Reemplazar una ranura con fusión: aviso «¡Vas a perder la fusión si continúas!» y solo recibes el ataque nuevo.

/** Índice del poder nuevo entre los candidatos. */
export const NEW_POWER_INDEX = 4;

export const LOSE_FUSION_WARNING = '¡Vas a perder la fusión si continúas!';

/** ¿Se ofrece fusionar al recoger este poder? (4 ranuras llenas y dos sin fusionar entre ranuras + nuevo). */
export function canFuseOnPickup(slots: readonly (MovePower | null)[], incoming: MovePower | null | undefined): boolean {
  if (!incoming || slots.length < 4 || slots.slice(0, 4).some((m) => !m)) return false;
  return pickupCandidates(slots, incoming).filter((m) => m && !m.fusion).length >= 2;
}

/** Los cinco candidatos (ranuras + el nuevo al final). */
export const pickupCandidates = (slots: readonly (MovePower | null)[], incoming: MovePower): (MovePower | null)[] => [...slots.slice(0, 4), incoming];

/** ¿Reemplazar esa ranura hace perder una fusión? (hay que avisar y confirmar). */
export const replaceLosesFusion = (slots: readonly (MovePower | null)[], slot: number): boolean => !!slots[slot]?.fusion;

/** Por qué no se pueden fusionar los candidatos i y j al recoger (null = se puede). */
export function pickupFusionBlock(slots: readonly (MovePower | null)[], incoming: MovePower, i: number, j: number): string | null {
  if (!canFuseOnPickup(slots, incoming)) return 'Hacen falta dos poderes sin fusionar.';
  if (i === j) return 'Elige dos poderes distintos.';
  if (i < 0 || j < 0 || i > NEW_POWER_INDEX || j > NEW_POWER_INDEX) return 'Esa ranura no existe.';
  const c = pickupCandidates(slots, incoming);
  if (!c[i] || !c[j]) return 'Esa ranura está vacía.';
  if (c[i]!.fusion || c[j]!.fusion) return 'Un poder fusionado no se puede volver a fusionar.';
  return null;
}

/** Aplica la fusión al recoger: 4 ranuras nuevas, resultado, dónde quedó y dónde entró el nuevo (-1 = se gastó). */
export function applyPickupFusion(
  slots: readonly (MovePower | null)[],
  incoming: MovePower,
  i: number,
  j: number,
): { slots: (MovePower | null)[]; result: MovePower; at: number; newAt: number } | null {
  if (pickupFusionBlock(slots, incoming, i, j)) return null;
  const c = pickupCandidates(slots, incoming);
  const result = fusePowers(c[i] as MovePower, c[j] as MovePower);
  const out = slots.slice(0, 4);
  const fromSlots = [i, j].filter((k) => k !== NEW_POWER_INDEX);
  const at = fromSlots[0];
  out[at] = result;
  let newAt = -1;
  if (fromSlots.length === 2) {
    newAt = fromSlots[1];
    out[newAt] = incoming;
  }
  return { slots: out, result, at, newAt };
}
