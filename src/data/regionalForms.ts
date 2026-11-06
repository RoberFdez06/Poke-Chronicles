// T83: formas regionales (Alola, Galar, Hisui y Paldea) de especies que ya salen. Cada forma tiene su propio id de
// PokeAPI (`/pokemon/{id}`), con sus tipos, estadísticas y sprites, y cuenta como entrada propia en el Pokédex y el gacha.
// Las de Hisui y Paldea (gachareg) salen solo en el gacha y la colección: no tienen hoja de SpriteCollab en el juego
// (van con la animación procedural) y su sprite es el de PokeAPI (o su ilustración oficial si no lo hay).
// Lógica pura, sin Phaser ni red, para poder testearla.
import type { SpeciesFact } from './gacha.ts';

export type FormRegion = 'alola' | 'galar' | 'hisui' | 'paldea';

/** Orden y nombre de cada región de formas (banner «Formas regionales» del gacha). */
export const FORM_REGIONS: readonly FormRegion[] = ['alola', 'galar', 'hisui', 'paldea'];
export const FORM_REGION_LABEL: Readonly<Record<FormRegion, string>> = { alola: 'Alola', galar: 'Galar', hisui: 'Hisui', paldea: 'Paldea' };
/** Región de `regions.ts` donde cuenta cada forma en el Pokédex: Hisui es la Sinnoh antigua. */
export const FORM_REGION_HOME: Readonly<Record<FormRegion, string>> = { alola: 'alola', galar: 'galar', hisui: 'sinnoh', paldea: 'paldea' };
/** Formas que también salen como enemigos en las partidas (las que tienen hoja de SpriteCollab). */
const WILD_REGIONS: ReadonlySet<FormRegion> = new Set(['alola', 'galar']);

export interface RegionalForm {
  /** Id de la forma en PokeAPI (`/pokemon/{id}`). */
  id: number;
  /** Especie normal de la Pokédex nacional. */
  baseId: number;
  region: FormRegion;
  /** Nombre en inglés de PokeAPI. */
  name: string;
  /** Nombre en español con la región. */
  nameEs: string;
  types: readonly string[];
  /** Suma de estadísticas base de la forma. */
  bst: number;
}

/** `apiName` y `variant` solo cuando PokeAPI no lo llama `<especie>-<región>` (las tres razas de Tauros de Paldea). */
const f = (
  id: number, baseId: number, region: FormRegion, name: string, es: string, types: string[], bst: number, apiName?: string, variant?: string,
): RegionalForm => ({
  id,
  baseId,
  region,
  name: apiName ?? `${name}-${region}`,
  nameEs: `${es} de ${FORM_REGION_LABEL[region]}${variant ? ` (${variant})` : ''}`,
  types,
  bst,
});

export const REGIONAL_FORMS: readonly RegionalForm[] = [
  f(10091, 19, 'alola', 'rattata', 'Rattata', ['dark', 'normal'], 253),
  f(10092, 20, 'alola', 'raticate', 'Raticate', ['dark', 'normal'], 413),
  f(10100, 26, 'alola', 'raichu', 'Raichu', ['electric', 'psychic'], 485),
  f(10101, 27, 'alola', 'sandshrew', 'Sandshrew', ['ice', 'steel'], 300),
  f(10102, 28, 'alola', 'sandslash', 'Sandslash', ['ice', 'steel'], 450),
  f(10103, 37, 'alola', 'vulpix', 'Vulpix', ['ice'], 299),
  f(10104, 38, 'alola', 'ninetales', 'Ninetales', ['ice', 'fairy'], 505),
  f(10105, 50, 'alola', 'diglett', 'Diglett', ['ground', 'steel'], 265),
  f(10106, 51, 'alola', 'dugtrio', 'Dugtrio', ['ground', 'steel'], 425),
  f(10107, 52, 'alola', 'meowth', 'Meowth', ['dark'], 290),
  f(10108, 53, 'alola', 'persian', 'Persian', ['dark'], 440),
  f(10109, 74, 'alola', 'geodude', 'Geodude', ['rock', 'electric'], 300),
  f(10110, 75, 'alola', 'graveler', 'Graveler', ['rock', 'electric'], 390),
  f(10111, 76, 'alola', 'golem', 'Golem', ['rock', 'electric'], 495),
  f(10112, 88, 'alola', 'grimer', 'Grimer', ['poison', 'dark'], 325),
  f(10113, 89, 'alola', 'muk', 'Muk', ['poison', 'dark'], 500),
  f(10114, 103, 'alola', 'exeggutor', 'Exeggutor', ['grass', 'dragon'], 530),
  f(10115, 105, 'alola', 'marowak', 'Marowak', ['fire', 'ghost'], 425),
  f(10161, 52, 'galar', 'meowth', 'Meowth', ['steel'], 290),
  f(10162, 77, 'galar', 'ponyta', 'Ponyta', ['psychic'], 410),
  f(10163, 78, 'galar', 'rapidash', 'Rapidash', ['psychic', 'fairy'], 500),
  f(10164, 79, 'galar', 'slowpoke', 'Slowpoke', ['psychic'], 315),
  f(10165, 80, 'galar', 'slowbro', 'Slowbro', ['poison', 'psychic'], 490),
  f(10166, 83, 'galar', 'farfetchd', "Farfetch'd", ['fighting'], 377),
  f(10167, 110, 'galar', 'weezing', 'Weezing', ['poison', 'fairy'], 490),
  f(10168, 122, 'galar', 'mr-mime', 'Mr. Mime', ['ice', 'psychic'], 460),
  f(10172, 199, 'galar', 'slowking', 'Slowking', ['poison', 'psychic'], 490),
  f(10173, 222, 'galar', 'corsola', 'Corsola', ['ghost'], 410),
  f(10174, 263, 'galar', 'zigzagoon', 'Zigzagoon', ['dark', 'normal'], 240),
  f(10175, 264, 'galar', 'linoone', 'Linoone', ['dark', 'normal'], 420),
  f(10176, 554, 'galar', 'darumaka', 'Darumaka', ['ice'], 315),
  f(10177, 555, 'galar', 'darmanitan', 'Darmanitan', ['ice'], 480),
  f(10179, 562, 'galar', 'yamask', 'Yamask', ['ground', 'ghost'], 303),
  f(10180, 618, 'galar', 'stunfisk', 'Stunfisk', ['ground', 'steel'], 471),
  // Hisui (gachareg)
  f(10229, 58, 'hisui', 'growlithe', 'Growlithe', ['fire', 'rock'], 450),
  f(10230, 59, 'hisui', 'arcanine', 'Arcanine', ['fire', 'rock'], 565),
  f(10231, 100, 'hisui', 'voltorb', 'Voltorb', ['electric', 'grass'], 330),
  f(10232, 101, 'hisui', 'electrode', 'Electrode', ['electric', 'grass'], 490),
  f(10233, 157, 'hisui', 'typhlosion', 'Typhlosion', ['fire', 'ghost'], 534),
  f(10234, 211, 'hisui', 'qwilfish', 'Qwilfish', ['dark', 'poison'], 440),
  f(10235, 215, 'hisui', 'sneasel', 'Sneasel', ['fighting', 'poison'], 430),
  f(10236, 503, 'hisui', 'samurott', 'Samurott', ['water', 'dark'], 528),
  f(10237, 549, 'hisui', 'lilligant', 'Lilligant', ['grass', 'fighting'], 480),
  f(10238, 570, 'hisui', 'zorua', 'Zorua', ['normal', 'ghost'], 330),
  f(10239, 571, 'hisui', 'zoroark', 'Zoroark', ['normal', 'ghost'], 510),
  f(10240, 628, 'hisui', 'braviary', 'Braviary', ['psychic', 'flying'], 510),
  f(10241, 705, 'hisui', 'sliggoo', 'Sliggoo', ['steel', 'dragon'], 452),
  f(10242, 706, 'hisui', 'goodra', 'Goodra', ['steel', 'dragon'], 600),
  f(10243, 713, 'hisui', 'avalugg', 'Avalugg', ['ice', 'rock'], 514),
  f(10244, 724, 'hisui', 'decidueye', 'Decidueye', ['grass', 'fighting'], 530),
  // Paldea (gachareg): las tres razas de Tauros y Wooper
  f(10250, 128, 'paldea', 'tauros', 'Tauros', ['fighting'], 490, 'tauros-paldea-combat-breed', 'Raza Combatiente'),
  f(10251, 128, 'paldea', 'tauros', 'Tauros', ['fighting', 'fire'], 490, 'tauros-paldea-blaze-breed', 'Raza Ardiente'),
  f(10252, 128, 'paldea', 'tauros', 'Tauros', ['fighting', 'water'], 490, 'tauros-paldea-aqua-breed', 'Raza Acuática'),
  f(10253, 194, 'paldea', 'wooper', 'Wooper', ['poison', 'ground'], 210),
];

/** Probabilidad de que un enemigo con forma regional salga en esa forma, y de que el bioma meta una que le encaje. Ajustables. */
export const REGIONAL_FORM_ODDS = { swap: 0.08, biomeFitMul: 2, inject: 0.05 } as const;

const byId = new Map(REGIONAL_FORMS.map((r) => [r.id, r]));

export const regionalForm = (id: number): RegionalForm | undefined => byId.get(id);
export const isRegionalForm = (id: number): boolean => byId.has(id);
export const formsOf = (baseId: number): RegionalForm[] => REGIONAL_FORMS.filter((r) => r.baseId === baseId);
/** Las que salen como enemigos (Alola y Galar): las de Hisui y Paldea solo se consiguen en el gacha. */
const WILD_FORMS: readonly RegionalForm[] = REGIONAL_FORMS.filter((r) => WILD_REGIONS.has(r.region));
const wildFormsOf = (baseId: number): RegionalForm[] => WILD_FORMS.filter((r) => r.baseId === baseId);

/** Las formas como entradas de la lista de especies (Pokédex, gacha, colección). */
export function formFacts(): SpeciesFact[] {
  return REGIONAL_FORMS.map((r) => ({ id: r.id, name: r.name, nameEs: r.nameEs, types: [...r.types], bst: r.bst, legendary: false, mythical: false }));
}

/** Lista de especies más las formas regionales (sin repetir ids). */
export function withRegionalForms<T extends SpeciesFact>(index: readonly T[]): (T | SpeciesFact)[] {
  const ids = new Set(index.map((s) => s.id));
  return [...index, ...formFacts().filter((s) => !ids.has(s.id))];
}

const fits = (r: RegionalForm, biomeTypes: readonly string[]) => r.types.some((t) => biomeTypes.includes(t));

/**
 * Enemigos del piso con formas regionales: cada especie que tiene forma puede salir en ella (más si encaja con el
 * bioma) y, de vez en cuando, el bioma mete una forma que le encaje en el último hueco. Determinista con `rng`.
 */
export function applyRegionalForms(ids: readonly number[], biomeTypes: readonly string[], rng: () => number, odds = REGIONAL_FORM_ODDS): number[] {
  const out = ids.map((id) => {
    const forms = wildFormsOf(id);
    if (forms.length === 0) return id;
    const form = forms[Math.floor(rng() * forms.length)];
    const p = odds.swap * (fits(form, biomeTypes) ? odds.biomeFitMul : 1);
    return rng() < p ? form.id : id;
  });
  const fitting = WILD_FORMS.filter((r) => fits(r, biomeTypes) && !out.includes(r.id));
  if (out.length > 0 && fitting.length > 0 && rng() < odds.inject) out[out.length - 1] = fitting[Math.floor(rng() * fitting.length)].id;
  return out;
}
