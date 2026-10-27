// Qué hoja de SpriteCollab usar para cada Pokémon: forma regional, mega y shiny. Los datos salen de tracker.json de
// PMDCollab/SpriteCollab (consultado el 27-10-2026). Lógica pura, sin Phaser ni red, para poder testearla.
//
// En SpriteCollab cada especie tiene subcarpetas por forma (`0019/0001` = Rattata de Alola) y, dentro de cada forma,
// `0001` es la versión shiny (`0025/0000/0001` = Pikachu shiny). Para guardar todo en un único número (las claves de
// textura y la caché van por número) se codifica así: `shiny * 1e8 + forma * 1e5 + especie`.
import { regionalForm } from './regionalForms.ts';

const SHINY = 100_000_000;
const FORM = 100_000;

/** Carpeta de forma de SpriteCollab de cada forma regional del juego (id de PokeAPI → subcarpeta). */
export const REGIONAL_PMD_FORM: ReadonlyMap<number, number> = new Map([
  // Alola
  [10091, 1], [10092, 1], [10100, 1], [10101, 1], [10102, 1], [10103, 1], [10104, 1], [10105, 1], [10106, 1],
  [10107, 1], [10108, 1], [10109, 1], [10110, 1], [10111, 1], [10112, 1], [10113, 1], [10114, 1], [10115, 1],
  // Galar (Meowth y Darmanitan tienen otra forma antes)
  [10161, 2], [10162, 1], [10163, 1], [10164, 1], [10165, 1], [10166, 1], [10167, 1], [10168, 1], [10172, 1],
  [10173, 1], [10174, 1], [10175, 1], [10176, 1], [10177, 2], [10179, 1],
  // 10180 (Stunfisk de Galar): sin hoja en SpriteCollab
]);

/** Megas con hoja en SpriteCollab (especie → subcarpeta). Solo las que coinciden con la forma que usa el juego. */
export const MEGA_PMD_FORM: ReadonlyMap<number, number> = new Map([
  [6, 1], [65, 1], [94, 1], [115, 1], [142, 1], [208, 1], [227, 1], [229, 1], [248, 1], [282, 1], [302, 1], [303, 1],
  [308, 1], [310, 1], [323, 1], [334, 1], [354, 1], [359, 1], [362, 1], [380, 1], [381, 1], [382, 1], [383, 1],
  [384, 1], [428, 1], [448, 1], [475, 1], [530, 1], [604, 1], [691, 1], [718, 5], [719, 1], [780, 1],
]);

/** Especies sin hoja de SpriteCollab (sprite_complete 0): ni se piden, van con la animación procedural. */
export const PMD_MISSING: ReadonlySet<number> = new Set([
  514, 516, 520, 522, 523, 538, 558, 564, 565, 591, 592, 593, 616, 618, 626, 668, 683, 732, 733, 735, 756, 765, 838,
  839, 865, 866, 868, 870, 874, 878, 879, 883, 893, 917, 929, 931, 942, 943, 944, 945, 947, 948, 949, 950, 954, 956,
  962, 968, 973, 986, 990, 993, 999, 1001, 1002, 1003, 1008, 1014, 1020, 1021, 1022, 1023, 1025, 10180,
]);

export interface PmdRef {
  /** Id del juego (especie de la Pokédex o forma regional de PokeAPI). */
  species: number;
  /** Subcarpeta de forma extra (mega); 0 = la normal. */
  form: number;
  shiny: boolean;
}

export const encodePmd = (r: PmdRef): number => (r.shiny ? SHINY : 0) + r.form * FORM + r.species;
export const decodePmd = (id: number): PmdRef => ({
  species: id % FORM,
  form: Math.floor((id % SHINY) / FORM),
  shiny: id >= SHINY,
});

/** Id de la hoja shiny de un Pokémon (o del que ya es otra forma). */
export const pmdShiny = (id: number): number => (id >= SHINY ? id : id + SHINY);
/** Id de la hoja normal (sin shiny) a partir de cualquier id codificado. */
export const pmdPlain = (id: number): number => id % SHINY;
/** Id de la hoja de la mega de una especie, o null si SpriteCollab no la tiene. */
export const pmdMega = (species: number, shiny = false): number | null => {
  const f = MEGA_PMD_FORM.get(species);
  return f === undefined ? null : encodePmd({ species, form: f, shiny });
};

/** ¿Merece la pena pedir la hoja? (no para las especies que no tienen). */
export const pmdAvailable = (id: number): boolean => {
  const { species } = decodePmd(id);
  if (PMD_MISSING.has(species)) return false;
  return species < 10000 || REGIONAL_PMD_FORM.has(species);
};

/** Carpeta relativa en SpriteCollab (`0019/0001`, `0025/0000/0001`…), o null si no la hay. */
export function pmdFolder(id: number): string | null {
  if (!pmdAvailable(id)) return null;
  const { species, form, shiny } = decodePmd(id);
  const reg = regionalForm(species);
  const dex = reg ? reg.baseId : species;
  const sub = reg ? REGIONAL_PMD_FORM.get(species)! : form;
  const pad = (n: number) => String(n).padStart(4, '0');
  const parts = [pad(dex)];
  if (sub || shiny) parts.push(pad(sub));
  if (shiny) parts.push('0001');
  return parts.join('/');
}

/**
 * Giro de tono (grados) para pintar de shiny la hoja normal cuando SpriteCollab no trae la shiny: fijo por especie
 * (siempre el mismo color) y lejos de 0 para que se note.
 */
export const shinyHue = (id: number): number => 60 + ((pmdPlain(id) * 47) % 240);

/**
 * Gira el tono de unos píxeles RGBA (en el sitio), con la matriz de hue-rotate de CSS/SVG. Así funciona igual en
 * todos los navegadores (Safari no siempre tiene `ctx.filter`). Los píxeles transparentes no se tocan.
 */
export function hueRotatePixels(data: Uint8ClampedArray | number[], deg: number): void {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const m = [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
  const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    data[i] = clamp(r * m[0] + g * m[1] + b * m[2]);
    data[i + 1] = clamp(r * m[3] + g * m[4] + b * m[5]);
    data[i + 2] = clamp(r * m[6] + g * m[7] + b * m[8]);
  }
}
