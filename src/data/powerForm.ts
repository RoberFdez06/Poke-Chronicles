// T74: formas de poder del jugador. De momento solo la megaevolución; T75 añadirá Dinamax, Teracristal, etc. con la
// misma estructura (un objeto que la permite, un botón, una sola forma activa a la vez y una vez por piso).
// Lógica pura, sin Phaser, para poder testearla. GameScene solo pregunta aquí si se puede, cuánto dura y cuánto da.
//
// Como la adrenalina (adrenaline.ts), el estado guarda lo que queda (ms), no un momento del reloj: así se puede
// guardar y continuar la partida tal cual, y la pausa no la gasta (el paso grande de después se recorta).

/**
 * Formas de poder que duran un rato. T75 añade Dinamax, Gigamax y Teracristalización. El Cristal Z no está aquí:
 * es un único ataque al momento (ver zMove* más abajo), no una forma que dure.
 */
export const POWER_FORM_KINDS = ['mega', 'dynamax', 'gigamax', 'tera'] as const;
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
  /** Cada cuánto suelta su ataque propio (ms); 0 = no tiene. */
  pulseMs: number;
  /** T75: tamaño del Pokémon y de sus disparos mientras dura (Dinamax ×1,5). */
  sizeMul: number;
  /** T75: escudo de vida extra al empezar (se gasta antes que los PS y se pierde al acabar). */
  shield: number;
  /** T75: parte del medidor de poder (powerMeter.ts) que gasta; la mega usa la adrenalina y gasta 0 aquí. */
  meterCost: number;
}

/** Id del objeto Mega Piedra (está en items.ts como pasivo raro). */
export const MEGA_STONE_ID = 'mega-piedra';

export const POWER_FORMS: Readonly<Record<PowerFormKind, PowerFormDef>> = {
  mega: { label: 'Megaevolución', item: MEGA_STONE_ID, durationMs: 30_000, damageMul: 1.35, speedMul: 1.15, maxHpBonus: 40, pulseMs: 3000, sizeMul: 1, shield: 0, meterCost: 0 },
  // T75: Dinamax es el recurso del que va perdiendo (solo con 50 % de PS o menos): gigante, más lento y con un escudo
  // que aguanta varios golpes. Gasta todo el medidor.
  dynamax: { label: 'Dinamax', item: 'banda-dinamax', durationMs: 20_000, damageMul: 1.25, speedMul: 0.9, maxHpBonus: 0, pulseMs: 0, sizeMul: 1.5, shield: 45, meterCost: 100 },
  // Gigamax: lo mismo para las especies que lo tienen, algo más fuerte y con su ataque propio (pulso de su tipo)
  gigamax: { label: 'Gigamax', item: 'banda-dinamax', durationMs: 20_000, damageMul: 1.3, speedMul: 0.9, maxHpBonus: 0, pulseMs: 3500, sizeMul: 1.7, shield: 45, meterCost: 100 },
  // Teracristal: corto, cambia el tipo de tus ataques a uno con ventaja en el bioma. Gasta algo más de la mitad.
  tera: { label: 'Teracristalización', item: 'teragema', durationMs: 15_000, damageMul: 1.2, speedMul: 1, maxHpBonus: 0, pulseMs: 0, sizeMul: 1, shield: 0, meterCost: 60 },
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
  /** T75: tipo elegido mientras dura la Teracristalización (null en las demás). */
  teraType: string | null;
  /** T75: lo que queda del escudo del Dinamax/Gigamax. */
  shield: number;
}

export const newPowerFormState = (): PowerFormState => ({ active: null, leftMs: 0, usedThisFloor: false, teraType: null, shield: 0 });

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
export function startPowerForm(_s: PowerFormState, kind: PowerFormKind, teraType: string | null = null): PowerFormState {
  const d = POWER_FORMS[kind];
  return { active: kind, leftMs: d.durationMs, usedThisFloor: true, teraType: kind === 'tera' ? teraType : null, shield: d.shield };
}

/** Avanza `dtMs` (recortado). Devuelve true si en este paso se acaba la forma. */
export function tickPowerForm(s: PowerFormState, dtMs: number): boolean {
  if (!powerFormActive(s)) return false;
  const dt = Math.max(0, Math.min(dtMs, POWER_FORM_MAX_STEP_MS));
  s.leftMs = Math.max(0, s.leftMs - dt);
  if (s.leftMs > 0) return false;
  s.active = null;
  s.teraType = null;
  s.shield = 0;
  return true;
}

/** Piso nuevo: la forma se acaba y se recarga. */
export const nextFloorPowerForm = (): PowerFormState => newPowerFormState();

const def = (s: PowerFormState): PowerFormDef | null => (powerFormActive(s) ? POWER_FORMS[s.active!] : null);
export const powerFormDamageMul = (s: PowerFormState): number => def(s)?.damageMul ?? 1;
export const powerFormSpeedMul = (s: PowerFormState): number => def(s)?.speedMul ?? 1;
export const powerFormMaxHpBonus = (s: PowerFormState): number => def(s)?.maxHpBonus ?? 0;
/** T75: tamaño del Pokémon y de sus disparos (1 sin forma). */
export const powerFormSizeMul = (s: PowerFormState): number => def(s)?.sizeMul ?? 1;
/** T75: tipo de los ataques mientras dura el Teracristal, o null. */
export const powerFormTeraType = (s: PowerFormState): string | null => (powerFormActive(s) && s.active === 'tera' ? s.teraType : null);

/**
 * T75: el escudo del Dinamax para un golpe de `dmg`. Devuelve lo que pasa a los PS (el resto lo para el escudo, que
 * baja). Sin forma o sin escudo, pasa todo.
 */
export function absorbWithShield(s: PowerFormState, dmg: number): number {
  if (!powerFormActive(s) || s.shield <= 0 || dmg <= 0) return Math.max(0, dmg);
  const stop = Math.min(s.shield, dmg);
  s.shield -= stop;
  return dmg - stop;
}
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
  /** T75 (opcionales para que los v20 de la mega sigan valiendo): tipo del Teracristal y escudo que queda. */
  tera?: string | null;
  shield?: number;
}

export const powerFormToSave = (s: PowerFormState): PowerFormSave => ({
  active: powerFormActive(s) ? s.active : null,
  leftMs: powerFormActive(s) ? Math.round(s.leftMs) : 0,
  used: s.usedThisFloor,
  // Solo si hacen falta: así los guardados sin Tera ni escudo quedan como los de T74
  ...(powerFormTeraType(s) ? { tera: powerFormTeraType(s) } : {}),
  ...(powerFormActive(s) && s.shield > 0 ? { shield: Math.round(s.shield) } : {}),
});

export function isPowerFormSave(v: unknown): v is PowerFormSave {
  const o = v as PowerFormSave;
  if (!o || typeof o !== 'object' || typeof o.used !== 'boolean' || typeof o.leftMs !== 'number' || !Number.isFinite(o.leftMs)) return false;
  if (o.tera !== undefined && o.tera !== null && typeof o.tera !== 'string') return false;
  if (o.shield !== undefined && (typeof o.shield !== 'number' || !Number.isFinite(o.shield) || o.shield < 0)) return false;
  if (o.active === null) return o.leftMs === 0;
  if (o.active === 'tera' && typeof o.tera !== 'string') return false;
  if ((o.shield ?? 0) > POWER_FORMS[o.active as PowerFormKind]?.shield) return false;
  return (POWER_FORM_KINDS as readonly string[]).includes(o.active) && o.leftMs > 0 && o.leftMs <= POWER_FORMS[o.active].durationMs && o.used;
}

export const powerFormFromSave = (v: PowerFormSave): PowerFormState => ({
  active: v.active,
  leftMs: v.leftMs,
  usedThisFloor: v.used,
  teraType: v.active === 'tera' ? (v.tera ?? null) : null,
  shield: v.active ? (v.shield ?? 0) : 0,
});

// --- T75: Dinamax/Gigamax, Teracristalización y Cristal Z ---

export const DYNAMAX_BAND_ID = 'banda-dinamax';
export const TERA_GEM_ID = 'teragema';
export const Z_CRYSTAL_ID = 'cristal-z';
/** Dinamax y Gigamax solo con esta fracción de PS o menos: es el recurso del que va perdiendo. */
export const DYNAMAX_HP_LIMIT = 0.5;
/** El Cristal Z gasta todo el medidor, y solo una vez por partida. */
export const Z_MOVE_COST = 100;
/** Multiplicador de daño del ataque Z sobre el daño normal. */
export const Z_MOVE_DAMAGE_MUL = 6;

/** Especies con Gigamax en Espada/Escudo y su forma en PokeAPI (con sprite propio). */
export const GMAX_FORMS: ReadonlyMap<number, string> = new Map([
  [3, 'venusaur-gmax'], [6, 'charizard-gmax'], [9, 'blastoise-gmax'], [12, 'butterfree-gmax'], [25, 'pikachu-gmax'],
  [52, 'meowth-gmax'], [68, 'machamp-gmax'], [94, 'gengar-gmax'], [99, 'kingler-gmax'], [131, 'lapras-gmax'],
  [133, 'eevee-gmax'], [143, 'snorlax-gmax'], [569, 'garbodor-gmax'], [809, 'melmetal-gmax'], [812, 'rillaboom-gmax'],
  [815, 'cinderace-gmax'], [818, 'inteleon-gmax'], [823, 'corviknight-gmax'], [826, 'orbeetle-gmax'], [834, 'drednaw-gmax'],
  [839, 'coalossal-gmax'], [841, 'flapple-gmax'], [842, 'appletun-gmax'], [844, 'sandaconda-gmax'],
  [849, 'toxtricity-amped-gmax'], [851, 'centiskorch-gmax'], [858, 'hatterene-gmax'], [861, 'grimmsnarl-gmax'],
  [869, 'alcremie-gmax'], [879, 'copperajah-gmax'], [884, 'duraludon-gmax'], [892, 'urshifu-single-strike-gmax'],
]);
export const hasGigamax = (speciesId: number): boolean => GMAX_FORMS.has(speciesId);
export const gmaxFormName = (speciesId: number): string | null => GMAX_FORMS.get(speciesId) ?? null;

/** Lo que piden las formas de T75 (además de la mega, que va con megaBlock). */
export interface PowerContext {
  speciesId: number;
  passives: readonly string[];
  /** Medidor de poder (0..100, powerMeter.ts). */
  meter: number;
  hp: number;
  maxHp: number;
  /** El Cristal Z ya se ha usado en la partida. */
  zUsed: boolean;
}

/** Lo que puede hacer el botón de forma de poder en T75: una de las formas que duran o el ataque Z. */
export type PowerChoice = 'dynamax' | 'gigamax' | 'tera' | 'z';
export type PowerBlock = 'item' | 'active' | 'used' | 'meter' | 'hp' | 'zUsed';

/** Coste en medidor de cada opción. */
export const powerCost = (c: PowerChoice): number => (c === 'z' ? Z_MOVE_COST : POWER_FORMS[c].meterCost);

/** ¿Se ofrece? Lleva el objeto (Gigamax solo en sus especies; Dinamax en las demás; Z hasta usarlo). */
export function powerOffered(c: PowerChoice, ctx: Pick<PowerContext, 'speciesId' | 'passives' | 'zUsed'>): boolean {
  if (c === 'z') return ctx.passives.includes(Z_CRYSTAL_ID) && !ctx.zUsed;
  if (c === 'tera') return ctx.passives.includes(TERA_GEM_ID);
  if (!ctx.passives.includes(DYNAMAX_BAND_ID)) return false;
  return c === 'gigamax' ? hasGigamax(ctx.speciesId) : !hasGigamax(ctx.speciesId);
}

/** null = se puede; si no, el primer motivo. Una sola forma a la vez y una por piso (el ataque Z también cuenta). */
export function powerBlock(s: PowerFormState, c: PowerChoice, ctx: PowerContext): PowerBlock | null {
  if (!powerOffered(c, ctx)) return c === 'z' && ctx.zUsed ? 'zUsed' : 'item';
  if (powerFormActive(s)) return 'active';
  if (s.usedThisFloor) return 'used';
  if ((c === 'dynamax' || c === 'gigamax') && ctx.hp > ctx.maxHp * DYNAMAX_HP_LIMIT) return 'hp';
  if (ctx.meter < powerCost(c)) return 'meter';
  return null;
}

export const POWER_BLOCK_TEXT: Readonly<Record<PowerBlock, string>> = {
  item: 'Te falta el objeto para esa forma',
  active: 'Ya tienes una forma de poder activa',
  used: 'Ya has usado una forma de poder en este piso',
  meter: 'Llena más el medidor de poder',
  hp: 'El Dinamax solo con la mitad de PS o menos',
  zUsed: 'El Cristal Z ya se ha usado en esta partida',
};

/**
 * El mismo botón de la mega sirve para todas: si hay varias, la primera que se pueda en este orden (Gigamax/Dinamax
 * cuando vas perdiendo, luego Teracristal y por último el Z, que es de una vez por partida y conviene guardarlo).
 * Si ninguna se puede, devuelve la primera que se ofrece con su motivo (para el aviso); null si no llevas nada.
 */
export const POWER_ORDER: readonly PowerChoice[] = ['gigamax', 'dynamax', 'tera', 'z'];
export function pickPower(s: PowerFormState, ctx: PowerContext): { choice: PowerChoice; block: PowerBlock | null } | null {
  const offered = POWER_ORDER.filter((c) => powerOffered(c, ctx));
  if (offered.length === 0) return null;
  for (const c of offered) if (powerBlock(s, c, ctx) === null) return { choice: c, block: null };
  return { choice: offered[0], block: powerBlock(s, offered[0], ctx) };
}

/** Gasta el piso con el ataque Z (no deja forma activa: es un golpe al momento). */
export function useZMove(s: PowerFormState): PowerFormState {
  return { ...s, usedThisFloor: true };
}

/**
 * Tipo del Teracristal: el que más daño hace a los tipos del bioma (rawEffectiveness de typeChart). Si empata con el
 * tuyo, el tuyo; si no, el primero de la lista. `effect(atk, defs)` se pasa para no atar esto a la tabla.
 */
export const TERA_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] as const;
/**
 * Tipo Tera elegido a mano (null = automático) o el automático si la elección no es un tipo válido.
 */
export function resolveTeraType(
  chosen: string | null,
  biomeTypes: readonly string[],
  ownType: string,
  effect: (atk: string, defs: readonly string[]) => number,
): string {
  return chosen && isTeraType(chosen) ? chosen : pickTeraType(biomeTypes, ownType, effect);
}

export const isTeraType = (t: unknown): t is string => typeof t === 'string' && (TERA_TYPES as readonly string[]).includes(t);

export function pickTeraType(biomeTypes: readonly string[], ownType: string, effect: (atk: string, defs: readonly string[]) => number): string {
  if (biomeTypes.length === 0) return ownType;
  let best = ownType;
  let bestMul = effect(ownType, biomeTypes);
  for (const t of TERA_TYPES) {
    const m = effect(t, biomeTypes);
    if (m > bestMul) [best, bestMul] = [t, m];
  }
  return best;
}
