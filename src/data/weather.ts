// Clima por piso (T38): algunos pisos tienen Lluvia, Día soleado, Tormenta de arena, Granizo o Niebla, según el
// bioma y al azar (con la semilla del piso, así al continuar o en el desafío diario sale el mismo).
// Lógica pura, sin Phaser, para poder testearla.

export const WEATHERS = ['rain', 'sun', 'sand', 'hail', 'fog'] as const;
export type Weather = (typeof WEATHERS)[number];

export const WEATHER_LABEL: Record<Weather, string> = {
  rain: 'Lluvia',
  sun: 'Día soleado',
  sand: 'Tormenta de arena',
  hail: 'Granizo',
  fog: 'Niebla',
};

/** Qué hace cada clima, para el aviso al empezar el piso. */
export const WEATHER_DESC: Record<Weather, string> = {
  rain: 'Agua x1,3 · Fuego x0,7',
  sun: 'Fuego x1,3 · Agua x0,7',
  sand: 'Daña a quien no sea Roca, Tierra o Acero',
  hail: 'Daña a quien no sea Hielo',
  fog: 'Se ve menos',
};

/** Climas posibles en cada bioma (por id de biomes.ts). Un bioma que no esté aquí no tiene clima. */
export const BIOME_WEATHERS: Readonly<Record<string, readonly Weather[]>> = {
  bosque: ['rain', 'sun', 'fog'],
  cueva: ['sand', 'fog'],
  mar: ['rain', 'sun'],
  volcan: ['sun', 'sand'],
  torre: ['fog'],
  ciudad: ['rain', 'sun'],
  nieve: ['hail', 'fog'],
  pantano: ['rain', 'fog'],
  cumbre: ['hail', 'sand', 'sun'],
};

/** Probabilidad de que un piso tenga clima (el primero nunca, para empezar tranquilo). */
export const WEATHER_CHANCE = 0.45;

/** Clima del piso (o null). Usa dos tiradas de `rng`: si hay clima y cuál. */
export function weatherFor(biomeId: string, floor: number, rng: () => number): Weather | null {
  const options = BIOME_WEATHERS[biomeId] ?? [];
  const roll = rng();
  const pick = rng();
  if (floor <= 1 || options.length === 0 || roll >= WEATHER_CHANCE) return null;
  return options[Math.min(options.length - 1, Math.floor(pick * options.length))];
}

/** Multiplicador del daño de un ataque de tipo `type` con el clima. */
export function weatherPowerMul(w: Weather | null, type: string | undefined): number {
  if (!w || !type) return 1;
  if (w === 'rain') return type === 'water' ? 1.3 : type === 'fire' ? 0.7 : 1;
  if (w === 'sun') return type === 'fire' ? 1.3 : type === 'water' ? 0.7 : 1;
  return 1;
}

/** Tipos que no sufren la arena o el granizo. */
const IMMUNE: Partial<Record<Weather, readonly string[]>> = {
  sand: ['rock', 'ground', 'steel'],
  hail: ['ice'],
};

/** ¿La arena o el granizo hacen daño a un Pokémon con estos tipos? */
export function weatherHurts(w: Weather | null, types: readonly string[]): boolean {
  const immune = w ? IMMUNE[w] : undefined;
  if (!immune) return false;
  return !types.some((t) => immune.includes(t));
}

/** Cada cuánto hacen daño la arena y el granizo. */
export const WEATHER_TICK_MS = 4000;

/** Daño leve de cada tic: un 3 % de los PS máximos (al menos 1). */
export const weatherChip = (maxHp: number): number => Math.max(1, Math.round(maxHp * 0.03));
