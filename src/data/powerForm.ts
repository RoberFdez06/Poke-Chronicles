// T74: formas de poder del jugador. De momento solo la megaevolución; T75 añadirá Dinamax, Teracristal, etc. con la
// misma estructura (un objeto que la permite, un botón, una sola forma activa a la vez y una vez por piso).
// Lógica pura, sin Phaser, para poder testearla. GameScene solo pregunta aquí si se puede, cuánto dura y cuánto da.
//
// Como la adrenalina (adrenaline.ts), el estado guarda lo que queda (ms), no un momento del reloj: así se puede
// guardar y continuar la partida tal cual, y la pausa no la gasta (el paso grande de después se recorta).

/** Formas de poder que existen. T75 añadirá las suyas aquí. */
export const POWER_FORM_KINDS = ['mega'] as const;
export type PowerFormKind = (typeof POWER_FORM_KINDS)[number];

export interface PowerFormDef {
  /** Nombre para los avisos. */
  label: string;
  /** Objeto pasivo (items.ts) que hace falta llevar. */
  item: string;
  /** Lo que dura (ms). */
  durationMs: number;
  /** Multiplicadores mientras dura. */
  damageMul: number;
  speedMul: number;
  /** PS máximos extra mientras dura (se quitan al acabar, sin matarte). */
  maxHpBonus: number;
  /** Cada cuánto suelta su ataque propio (ms). */
  pulseMs: number;
}

/** Id del objeto Mega Piedra (está en items.ts como pasivo raro). */
export const MEGA_STONE_ID = 'mega-piedra';

export const POWER_FORMS: Readonly<Record<PowerFormKind, PowerFormDef>> = {
  mega: { label: 'Megaevolución', item: MEGA_STONE_ID, durationMs: 30_000, damageMul: 1.35, speedMul: 1.15, maxHpBonus: 40, pulseMs: 3000 },
};

/** Paso más largo que se cuenta de una vez (ms): el fotograma de después de una pausa no se come la forma. */
export const POWER_FORM_MAX_STEP_MS = 100;

/**
 * Especies con megaevolución (o regresión primigenia) en los juegos, con el nombre de la forma en PokeAPI (allí
 * tienen sprite propio, ids desde 10000). Las que tienen dos (Charizard y Mewtwo X/Y) usan la X. Incluye las de
 * Leyendas Z-A; si alguna forma no tuviera sprite, la escena deja el normal con brillo.
 */
export const MEGA_FORMS: ReadonlyMap<number, string> = new Map([
  // Clásicas (Gen 6 y Rubí Omega / Zafiro Alfa)
  [3, 'venusaur-mega'], [6, 'charizard-mega-x'], [9, 'blastoise-mega'], [15, 'beedrill-mega'], [18, 'pidgeot-mega'],
  [65, 'alakazam-mega'], [80, 'slowbro-mega'], [94, 'gengar-mega'], [115, 'kangaskhan-mega'], [127, 'pinsir-mega'],
  [130, 'gyarados-mega'], [142, 'aerodactyl-mega'], [150, 'mewtwo-mega-x'], [181, 'ampharos-mega'], [208, 'steelix-mega'],
  [212, 'scizor-mega'], [214, 'heracross-mega'], [229, 'houndoom-mega'], [248, 'tyranitar-mega'], [254, 'sceptile-mega'],
  [257, 'blaziken-mega'], [260, 'swampert-mega'], [282, 'gardevoir-mega'], [302, 'sableye-mega'], [303, 'mawile-mega'],
  [306, 'aggron-mega'], [308, 'medicham-mega'], [310, 'manectric-mega'], [319, 'sharpedo-mega'], [323, 'camerupt-mega'],
  [334, 'altaria-mega'], [354, 'banette-mega'], [359, 'absol-mega'], [362, 'glalie-mega'], [373, 'salamence-mega'],
  [376, 'metagross-mega'], [380, 'latias-mega'], [381, 'latios-mega'], [382, 'kyogre-primal'], [383, 'groudon-primal'],
  [384, 'rayquaza-mega'], [428, 'lopunny-mega'], [445, 'garchomp-mega'], [448, 'lucario-mega'], [460, 'abomasnow-mega'],
  [475, 'gallade-mega'], [531, 'audino-mega'], [719, 'diancie-mega'],
  // Leyendas Z-A
  [36, 'clefable-mega'], [71, 'victreebel-mega'], [121, 'starmie-mega'], [149, 'dragonite-mega'], [154, 'meganium-mega'],
  [160, 'feraligatr-mega'], [227, 'skarmory-mega'], [478, 'froslass-mega'], [500, 'emboar-mega'], [530, 'excadrill-mega'],
  [545, 'scolipede-mega'], [560, 'scrafty-mega'], [604, 'eelektross-mega'], [609, 'chandelure-mega'], [652, 'chesnaught-mega'],
  [655, 'delphox-mega'], [658, 'greninja-mega'], [668, 'pyroar-mega'], [687, 'malamar-mega'], [689, 'barbaracle-mega'],
  [691, 'dragalge-mega'], [701, 'hawlucha-mega'], [718, 'zygarde-mega'], [780, 'drampa-mega'], [870, 'falinks-mega'],
]);

export const hasMegaEvolution = (speciesId: number): boolean => MEGA_FORMS.has(speciesId);
/** Nombre de la forma mega en PokeAPI (para su sprite), o null si no tiene. */
export const megaFormName = (speciesId: number): string | null => MEGA_FORMS.get(speciesId) ?? null;
/** Nombre para el aviso: «Mega Charizard» (Kyogre y Groudon, «Primigenio»). */
export const megaDisplayName = (speciesId: number, name: string): string =>
  megaFormName(speciesId)?.endsWith('-primal') ? `${name} Primigenio` : `Mega ${name}`;

export interface PowerFormState {
  /** Forma activa ahora (null = ninguna). Solo una a la vez. */
  active: PowerFormKind | null;
  /** Lo que le queda a la forma activa (ms). */
  leftMs: number;
  /** Ya se ha usado una forma en este piso (se recarga al cambiar de piso). */
  usedThisFloor: boolean;
}

export const newPowerFormState = (): PowerFormState => ({ active: null, leftMs: 0, usedThisFloor: false });

export const powerFormActive = (s: PowerFormState): boolean => s.active !== null && s.leftMs > 0;

/** Lo que pide megaevolucionar. */
export interface MegaContext {
  /** Especie de la forma actual del jugador. */
  speciesId: number;
  passives: readonly string[];
  /** La barra de adrenalina está llena (ver adrenaline.ts: adrenalineFull). */
  adrenalineFull: boolean;
}

/** Por qué no se puede: sin especie mega, sin piedra, ya usada en el piso, ya activa o barra sin llenar. */
export type MegaBlock = 'species' | 'stone' | 'used' | 'active' | 'adrenaline';

/**
 * ¿Se ofrece el botón? Solo si llevas la Mega Piedra y tu Pokémon tiene megaevolución: a los demás la piedra no
 * les hace nada y no se les enseña.
 */
export const megaOffered = (c: Pick<MegaContext, 'speciesId' | 'passives'>): boolean =>
  hasMegaEvolution(c.speciesId) && c.passives.includes(MEGA_STONE_ID);

/** null = se puede; si no, el primer motivo que lo impide (en el orden en que conviene decírselo al jugador). */
export function megaBlock(s: PowerFormState, c: MegaContext): MegaBlock | null {
  if (!hasMegaEvolution(c.speciesId)) return 'species';
  if (!c.passives.includes(MEGA_STONE_ID)) return 'stone';
  if (powerFormActive(s)) return 'active';
  if (s.usedThisFloor) return 'used';
  if (!c.adrenalineFull) return 'adrenaline';
  return null;
}

/** Texto del aviso cuando no se puede (los de especie y piedra no salen: el botón ni se enseña). */
export const MEGA_BLOCK_TEXT: Readonly<Record<MegaBlock, string>> = {
  species: 'Tu Pokémon no puede megaevolucionar',
  stone: 'Necesitas una Mega Piedra',
  used: 'Ya has megaevolucionado en este piso',
  active: 'Ya estás megaevolucionado',
  adrenaline: 'Llena la barra de adrenalina para megaevolucionar',
};

/** Activa la forma (sin comprobar requisitos: eso es megaBlock). Gasta la del piso. */
export function startPowerForm(s: PowerFormState, kind: PowerFormKind): PowerFormState {
  return { active: kind, leftMs: POWER_FORMS[kind].durationMs, usedThisFloor: true };
}

/** Avanza `dtMs` (recortado). Devuelve true si en este paso se acaba la forma. */
export function tickPowerForm(s: PowerFormState, dtMs: number): boolean {
  if (!powerFormActive(s)) return false;
  const dt = Math.max(0, Math.min(dtMs, POWER_FORM_MAX_STEP_MS));
  s.leftMs = Math.max(0, s.leftMs - dt);
  if (s.leftMs > 0) return false;
  s.active = null;
  return true;
}

/** Piso nuevo: la forma se acaba y se recarga. */
export const nextFloorPowerForm = (): PowerFormState => newPowerFormState();

const def = (s: PowerFormState): PowerFormDef | null => (powerFormActive(s) ? POWER_FORMS[s.active!] : null);
export const powerFormDamageMul = (s: PowerFormState): number => def(s)?.damageMul ?? 1;
export const powerFormSpeedMul = (s: PowerFormState): number => def(s)?.speedMul ?? 1;
export const powerFormMaxHpBonus = (s: PowerFormState): number => def(s)?.maxHpBonus ?? 0;
/** Lo que queda, de 1 (recién activada) a 0. */
export const powerFormFill = (s: PowerFormState): number => {
  const d = def(s);
  return d ? s.leftMs / d.durationMs : 0;
};

/** Lo que se guarda en RunSave (null = sin forma ni usada; así los guardados quedan cortos). */
export interface PowerFormSave {
  active: PowerFormKind | null;
  leftMs: number;
  used: boolean;
}

export const powerFormToSave = (s: PowerFormState): PowerFormSave => ({
  active: powerFormActive(s) ? s.active : null,
  leftMs: powerFormActive(s) ? Math.round(s.leftMs) : 0,
  used: s.usedThisFloor,
});

export function isPowerFormSave(v: unknown): v is PowerFormSave {
  const o = v as PowerFormSave;
  if (!o || typeof o !== 'object' || typeof o.used !== 'boolean' || typeof o.leftMs !== 'number' || !Number.isFinite(o.leftMs)) return false;
  if (o.active === null) return o.leftMs === 0;
  return (POWER_FORM_KINDS as readonly string[]).includes(o.active) && o.leftMs > 0 && o.leftMs <= POWER_FORMS[o.active].durationMs && o.used;
}

export const powerFormFromSave = (v: PowerFormSave): PowerFormState => ({ active: v.active, leftMs: v.leftMs, usedThisFloor: v.used });
