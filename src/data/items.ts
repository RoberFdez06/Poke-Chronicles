// Estadísticas del jugador, objetos pasivos y poderes (movimientos): lógica pura, sin Phaser ni red.

export interface PlayerStats {
  /** Daño por disparo. */
  damage: number;
  /** Milisegundos entre disparos. */
  fireDelay: number;
  /** Velocidad del disparo en px/s. */
  shotSpeed: number;
  /** Milisegundos que dura un disparo en el aire. */
  range: number;
  /** Velocidad del jugador en px/s. */
  speed: number;
  maxHp: number;
  /** Disparos extra en abanico. */
  extraShots: number;
  /** Enemigos que atraviesa cada disparo. */
  pierce: number;
  /** Rebotes en las paredes. */
  bounces: number;
  /** PS que recuperas al limpiar una sala. */
  healOnClear: number;
  /** Multiplicador del daño de los poderes (sale del Ataque Especial del Pokémon). */
  powerMul: number;
  /** Multiplicador del daño que recibes (sale de la Defensa y la Defensa Especial). */
  damageTaken: number;
  // --- Efectos especiales de los objetos (T23) ---
  /** Probabilidad (0-1) de golpe crítico y cuánto multiplica. */
  critChance: number;
  critMul: number;
  /** Fracción del daño hecho que recuperas como PS. */
  lifesteal: number;
  /** Daño que recibe quien te toca. */
  thorns: number;
  /** Probabilidad (0-1) de esquivar un golpe. */
  dodge: number;
  /** Golpes que para el escudo en cada sala. */
  shieldPerRoom: number;
  /** Veces por piso que aguantas con 1 PS un golpe que te dejaría a 0. */
  focusBand: number;
  /** PS que recuperas una vez por piso al bajar del 25 % de vida (0 = no). */
  lowHpHeal: number;
  /** Cuánto giran tus disparos hacia el enemigo más cercano (radianes por segundo). */
  homing: number;
  /** Disparos extra hacia atrás. */
  backShots: number;
  /** Alcance extra por cada enemigo vivo en la sala (fracción). */
  rangePerEnemy: number;
  /** T54: radio extra (px) al que el botín del suelo vuela hacia ti. */
  lootMagnet: number;
  /** Multiplicador de las monedas que recoges. */
  coinMul: number;
  /** Tamaño de tus disparos. */
  shotScale: number;
  /** Daño extra de los poderes de un tipo (fracción), p. ej. { fire: 0.25 }. */
  typeBoost: Partial<Record<string, number>>;
  /** Fuerza de los estados que aplican tus poderes de un tipo (1 = normal; lo suben las sinergias). */
  statusBoost: Partial<Record<string, number>>;
}

export const BASE_STATS: Readonly<PlayerStats> = {
  damage: 9,
  fireDelay: 340,
  shotSpeed: 520,
  range: 750,
  speed: 240,
  maxHp: 100,
  extraShots: 0,
  pierce: 0,
  bounces: 0,
  healOnClear: 0,
  powerMul: 1,
  damageTaken: 1,
  critChance: 0,
  critMul: 2,
  lifesteal: 0,
  thorns: 0,
  dodge: 0,
  shieldPerRoom: 0,
  focusBand: 0,
  lowHpHeal: 0,
  homing: 0,
  backShots: 0,
  rangePerEnemy: 0,
  lootMagnet: 0,
  coinMul: 1,
  shotScale: 1,
  typeBoost: {},
  statusBoost: {},
};

export const MIN_FIRE_DELAY = 90;

export interface PassiveItem {
  id: string;
  name: string;
  description: string;
  color: number;
  apply(stats: PlayerStats): void;
}

/** Objetos propios: mejoras numéricas que se acumulan. Los nombres son provisionales. */
export const PASSIVE_ITEMS: readonly PassiveItem[] = [
  {
    id: 'baya-aranja',
    name: 'Baya Aranja',
    description: '+20 PS máximos y los recuperas.',
    color: 0xff9f43,
    apply: (s) => void (s.maxHp += 20),
  },
  {
    id: 'vidasfera',
    name: 'Vidasfera',
    description: '+30 % de daño.',
    color: 0xd63031,
    apply: (s) => void (s.damage *= 1.3),
  },
  {
    id: 'garra-rapida',
    name: 'Garra Rápida',
    description: 'Disparas un 20 % más rápido.',
    color: 0xfdcb6e,
    apply: (s) => void (s.fireDelay *= 0.8),
  },
  {
    id: 'lupa',
    name: 'Lupa',
    description: 'Tus disparos llegan más lejos.',
    color: 0x74b9ff,
    apply: (s) => void (s.range *= 1.4),
  },
  {
    id: 'pluma-ligera',
    name: 'Pluma Ligera',
    description: 'Te mueves un 12 % más rápido.',
    color: 0xdfe6e9,
    apply: (s) => void (s.speed *= 1.12),
  },
  {
    id: 'doble-equipo',
    name: 'Doble Equipo',
    description: 'Un proyectil extra en abanico.',
    color: 0xa29bfe,
    apply: (s) => void (s.extraShots += 1),
  },
  {
    id: 'piedra-dura',
    name: 'Piedra Dura',
    description: 'Tus disparos atraviesan un enemigo.',
    color: 0x95a5a6,
    apply: (s) => void (s.pierce += 1),
  },
  {
    id: 'pelota-saltarina',
    name: 'Pelota Saltarina',
    description: 'Tus disparos rebotan una vez en las paredes.',
    color: 0x55efc4,
    apply: (s) => void (s.bounces += 1),
  },
  {
    id: 'restos',
    name: 'Restos',
    description: 'Recuperas 10 PS al limpiar una sala.',
    color: 0x00b894,
    apply: (s) => void (s.healOnClear += 10),
  },
];

/**
 * Objetos escondidos (easter eggs, ver easterEggs.ts): no salen al azar. Magikarp lo vende a veces el mercader y
 * no hace nada; al bajar de piso evoluciona en Gyarados, que es de los mejores objetos del juego.
 */
export const HIDDEN_ITEMS: readonly PassiveItem[] = [
  {
    id: 'magikarp',
    name: 'Magikarp',
    description: 'Salpica. No hace nada... de momento.',
    color: 0xf08a3a,
    apply: () => undefined,
  },
  {
    id: 'gyarados',
    name: 'Gyarados',
    description: '+40 % de daño, +25 PS máximos y +10 % de velocidad. ¡La paciencia tiene premio!',
    color: 0x3a7ad8,
    apply: (s) => {
      s.damage *= 1.4;
      s.maxHp += 25;
      s.speed *= 1.1;
    },
  },
];

export function passiveById(id: string): PassiveItem | undefined {
  return PASSIVE_ITEMS.find((i) => i.id === id) ?? HIDDEN_ITEMS.find((i) => i.id === id);
}

/** Nombres de tipo en español (copia mínima para no depender de types.ts en las descripciones). */
const TYPE_ES: Record<string, string> = {
  fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta', ice: 'Hielo', fighting: 'Lucha',
  psychic: 'Psíquico', dragon: 'Dragón', ghost: 'Fantasma', dark: 'Siniestro', steel: 'Acero', normal: 'Normal',
  flying: 'Volador', bug: 'Bicho', poison: 'Veneno', ground: 'Tierra',
};

/** Potenciadores de tipo (como los objetos de los juegos): +25 % de daño a los poderes de su tipo. */
const TYPE_BOOSTERS: [string, string, string, number][] = [
  ['carbon', 'Carbón', 'fire', 0x3d3d3d],
  ['agua-mistica', 'Agua Mística', 'water', 0x3d8fd6],
  ['iman', 'Imán', 'electric', 0xd0a020],
  ['semilla-milagro', 'Semilla Milagro', 'grass', 0x5aa83a],
  ['hielo-eterno', 'Hielo Eterno', 'ice', 0x8fd8e8],
  ['cinturon-negro', 'Cinturón Negro', 'fighting', 0x2b2b2b],
  ['cuchara-torcida', 'Cuchara Torcida', 'psychic', 0xe060a0],
  ['colmillo-dragon', 'Colmillo Dragón', 'dragon', 0x6f35fc],
  ['hechizo', 'Hechizo', 'ghost', 0x735797],
  ['gafas-de-sol', 'Gafas de Sol', 'dark', 0x40342c],
  ['revestimiento-metalico', 'Revestimiento Metálico', 'steel', 0xa8a8c0],
  ['seda-fina', 'Seda Fina', 'normal', 0xe8e0c8],
  ['pico-afilado', 'Pico Afilado', 'flying', 0xa98ff3],
  ['polvo-plata', 'Polvo Plata', 'bug', 0xc0c8a0],
  ['flecha-venenosa', 'Flecha Venenosa', 'poison', 0xa33ea1],
  ['arena-fina', 'Arena Fina', 'ground', 0xe2bf65],
];

const add = (map: Partial<Record<string, number>>, k: string, v: number) => void (map[k] = (map[k] ?? 0) + v);

/** Objetos nuevos (T23): con efectos que no son solo números. */
const SPECIAL_ITEMS: PassiveItem[] = [
  { id: 'cinta-elegida', name: 'Cinta Elegida', description: '+50 % de daño, pero disparas un poco más lento.', color: 0xe84a4a,
    apply: (s) => void ((s.damage *= 1.5), (s.fireDelay *= 1.15)) },
  { id: 'gafas-elegidas', name: 'Gafas Elegidas', description: 'Tus poderes hacen un 40 % más de daño.', color: 0x4a7ae8,
    apply: (s) => void (s.powerMul *= 1.4) },
  { id: 'panuelo-elegido', name: 'Pañuelo Elegido', description: 'Vas un 25 % más rápido y disparas algo antes.', color: 0x4ac86a,
    apply: (s) => void ((s.speed *= 1.25), (s.fireDelay *= 0.9)) },
  { id: 'lente-zoom', name: 'Lente Zoom', description: 'Más alcance y un 10 % de golpes críticos.', color: 0x8ab4e8,
    apply: (s) => void ((s.range *= 1.3), (s.critChance += 0.1)) },
  { id: 'periscopio', name: 'Periscopio', description: '+15 % de probabilidad de crítico.', color: 0x9ab0c0,
    apply: (s) => void (s.critChance += 0.15) },
  { id: 'garra-afilada', name: 'Garra Afilada', description: 'Críticos más probables y más fuertes.', color: 0xd8d8e8,
    apply: (s) => void ((s.critChance += 0.08), (s.critMul += 0.5)) },
  { id: 'banda-focus', name: 'Banda Focus', description: 'Una vez por piso aguantas con 1 PS un golpe mortal.', color: 0xff7a3a,
    apply: (s) => void (s.focusBand += 1) },
  { id: 'hierba-blanca', name: 'Hierba Blanca', description: 'Al bajar del 25 % de vida recuperas 30 PS (una vez por piso).', color: 0xf0f0e0,
    apply: (s) => void (s.lowHpHeal += 30) },
  { id: 'concha-campana', name: 'Concha Campana', description: 'Recuperas PS con el 8 % del daño que haces.', color: 0xf0c8a0,
    apply: (s) => void (s.lifesteal += 0.08) },
  { id: 'casco-dentado', name: 'Casco Dentado', description: 'Quien te toca recibe 30 de daño.', color: 0x8a6a4a,
    apply: (s) => void (s.thorns += 30) },
  { id: 'polvo-brillo', name: 'Polvo Brillo', description: 'Un 12 % de esquivar los golpes.', color: 0xfff8c0,
    apply: (s) => void (s.dodge = Math.min(0.5, s.dodge + 0.12)) },
  { id: 'gafas-protectoras', name: 'Gafas Protectoras', description: 'Un escudo para el primer golpe de cada sala.', color: 0x6ad0f0,
    apply: (s) => void (s.shieldPerRoom += 1) },
  { id: 'chaleco-asalto', name: 'Chaleco Asalto', description: 'Recibes un 20 % menos de daño.', color: 0x6a8a4a,
    apply: (s) => void (s.damageTaken *= 0.8) },
  { id: 'telescopio', name: 'Telescopio', description: 'Tus disparos siguen al enemigo más cercano.', color: 0xc0a0f0,
    apply: (s) => void (s.homing += 2.5) },
  { id: 'cola-gemela', name: 'Cola Gemela', description: 'También disparas hacia atrás.', color: 0xf0a0c8,
    apply: (s) => void (s.backShots += 1) },
  { id: 'pokeradar', name: 'Pokéradar', description: '+8 % de alcance por cada enemigo vivo en la sala.', color: 0x60d0a0,
    apply: (s) => void (s.rangePerEnemy += 0.08) },
  { id: 'moneda-amuleto', name: 'Moneda Amuleto', description: 'Las monedas valen el doble.', color: 0xffd34d,
    apply: (s) => void (s.coinMul *= 2) },
  { id: 'bola-ferrea', name: 'Bola Férrea', description: 'Disparos más grandes y un 25 % más fuertes, pero vas más lento.', color: 0x606878,
    apply: (s) => void ((s.shotScale *= 1.5), (s.damage *= 1.25), (s.speed *= 0.9)) },
  // Tanda 6: objetos con ventaja y precio (mejoran una cosa a cambio de otra)
  { id: 'baya-zidra', name: 'Baya Zidra', description: '+35 PS máximos, pero te mueves un 5 % más lento.', color: 0xf0d84a,
    apply: (s) => void ((s.maxHp += 35), (s.speed *= 0.95)) },
  { id: 'baya-meloc', name: 'Baya Meloc', description: '+10 PS máximos y recuperas 6 PS al limpiar una sala.', color: 0xe86a5a,
    apply: (s) => void ((s.maxHp += 10), (s.healOnClear += 6)) },
  { id: 'caramelo-raro', name: 'Caramelo Raro', description: '+8 % de daño, de velocidad y de cadencia de disparo.', color: 0x6ac8f0,
    apply: (s) => void ((s.damage *= 1.08), (s.speed *= 1.08), (s.fireDelay *= 0.92)) },
  { id: 'piedra-escudo', name: 'Piedra Escudo', description: 'Recibes un 10 % menos de daño y quien te toca recibe 15.', color: 0x8a96a8,
    apply: (s) => void ((s.damageTaken *= 0.9), (s.thorns += 15)) },
  { id: 'pluma-pretty', name: 'Pluma Pretty', description: 'Un 8 % de esquivar y vas un 8 % más rápido.', color: 0xf0b8d8,
    apply: (s) => void ((s.dodge = Math.min(0.5, s.dodge + 0.08)), (s.speed *= 1.08)) },
  { id: 'orbe-vital', name: 'Orbe Vital', description: '+10 % de daño y recuperas PS con el 5 % del daño que haces.', color: 0xe05a8a,
    apply: (s) => void ((s.damage *= 1.1), (s.lifesteal += 0.05)) },
  { id: 'lupa-doble', name: 'Lupa Doble', description: 'Tus disparos atraviesan un enemigo más y llegan un 15 % más lejos.', color: 0x5ab4e8,
    apply: (s) => void ((s.pierce += 1), (s.range *= 1.15)) },
  { id: 'cascabel-cura', name: 'Cascabel Cura', description: 'Recuperas 15 PS al limpiar una sala, pero tienes 10 PS máximos menos.', color: 0xf0c85a,
    apply: (s) => void ((s.healOnClear += 15), (s.maxHp -= 10)) },
  { id: 'tablilla-pesada', name: 'Tablilla Pesada', description: '+20 % de daño, pero disparas un 5 % más lento.', color: 0xa8895a,
    apply: (s) => void ((s.damage *= 1.2), (s.fireDelay *= 1.05)) },
  { id: 'reloj-arena', name: 'Reloj de Arena', description: 'Disparas un 15 % más rápido, pero con un 10 % menos de alcance.', color: 0xe8c878,
    apply: (s) => void ((s.fireDelay *= 0.85), (s.range *= 0.9)) },
  // T52: doce objetos más (con su rareza y precio en PASSIVE_RARITY)
  { id: 'mineral-evolutivo', name: 'Mineral Evolutivo', description: 'Recibes un 15 % menos de daño y tienes 10 PS máximos más.', color: 0xb388ff,
    apply: (s) => void ((s.damageTaken *= 0.85), (s.maxHp += 10)) },
  { id: 'cinta-experto', name: 'Cinta Experto', description: 'Tus poderes hacen un 15 % más de daño y +5 % de crítico.', color: 0xe57373,
    apply: (s) => void ((s.powerMul *= 1.15), (s.critChance = Math.min(1, s.critChance + 0.05))) },
  { id: 'gafas-especiales', name: 'Gafas Especiales', description: 'Tus poderes hacen un 25 % más de daño, pero recibes un 10 % más.', color: 0x7986cb,
    apply: (s) => void ((s.powerMul *= 1.25), (s.damageTaken *= 1.1)) },
  { id: 'roca-del-rey', name: 'Roca del Rey', description: '+8 % de crítico y críticos más fuertes.', color: 0xc9a13a,
    apply: (s) => void ((s.critChance = Math.min(1, s.critChance + 0.08)), (s.critMul += 0.25)) },
  { id: 'polvo-veloz', name: 'Polvo Veloz', description: 'Vas un 15 % más rápido y disparas un 5 % antes.', color: 0xffe082,
    apply: (s) => void ((s.speed *= 1.15), (s.fireDelay *= 0.95)) },
  { id: 'baya-lichi', name: 'Baya Lichi', description: '+12 % de daño y 5 PS máximos más.', color: 0xef9a9a,
    apply: (s) => void ((s.damage *= 1.12), (s.maxHp += 5)) },
  { id: 'seguro-debilidad', name: 'Seguro Debilidad', description: '+20 % de daño, pero recibes un 5 % más.', color: 0xba68c8,
    apply: (s) => void ((s.damage *= 1.2), (s.damageTaken *= 1.05)) },
  { id: 'bola-luminosa', name: 'Bola Luminosa', description: 'Disparos un 20 % más grandes que rebotan una vez más.', color: 0xfff59d,
    apply: (s) => void ((s.shotScale *= 1.2), (s.bounces += 1)) },
  { id: 'cuerda-huida', name: 'Cuerda Huida', description: 'Un 10 % de esquivar y vas un 5 % más rápido.', color: 0xa1887f,
    apply: (s) => void ((s.dodge = Math.min(0.5, s.dodge + 0.1)), (s.speed *= 1.05)) },
  { id: 'hierba-mental', name: 'Hierba Mental', description: 'Un escudo más en cada sala, pero 5 PS máximos menos.', color: 0x81c784,
    apply: (s) => void ((s.shieldPerRoom += 1), (s.maxHp -= 5)) },
  { id: 'pua-toxica', name: 'Púa Tóxica', description: 'Quien te toca recibe 20 de daño y tu veneno es un 30 % más fuerte.', color: 0x9c27b0,
    apply: (s) => void ((s.thorns += 20), (s.statusBoost.poison = (s.statusBoost.poison ?? 1) * 1.3)) },
  // T54: atrae el botín del suelo desde más lejos (el Zahorí de los juegos encuentra objetos escondidos)
  { id: 'zahori', name: 'Zahorí', description: 'Las monedas, bayas y demás botín vuelan hacia ti desde mucho más lejos.', color: 0x4fc3f7,
    apply: (s) => void (s.lootMagnet += 110) },
  { id: 'piedra-lunar', name: 'Piedra Lunar', description: 'Tus disparos giran un poco hacia los enemigos y llegan un 10 % más lejos.', color: 0xcfd8dc,
    apply: (s) => void ((s.homing += 1.2), (s.range *= 1.1)) },
  // T74: permite megaevolucionar (ver powerForm.ts) a los Pokémon que pueden; los 5 PS son para que también valga algo
  // a los demás y para que, como todo pasivo, cambie alguna estadística
  { id: 'mega-piedra', name: 'Mega Piedra', description: 'Si tu Pokémon tiene megaevolución, puedes megaevolucionar cuando quieras (una vez por piso). La suelta el guardián de su sala. +5 PS máximos.', color: 0x8fd3ff,
    apply: (s) => void (s.maxHp += 5) },
  // T75: formas de poder con el medidor de poder (ver powerForm.ts y powerMeter.ts). Cada una cambia algo pequeño
  // para que valga también sin usarla.
  { id: 'banda-dinamax', name: 'Banda Dinamax', description: 'Con el medidor de poder lleno y la mitad de PS o menos, Dinamax (o Gigamax si tu Pokémon lo tiene). +5 PS máximos.', color: 0xe8384f,
    apply: (s) => void (s.maxHp += 5) },
  { id: 'teragema', name: 'Teragema', description: 'El Teracristal cuesta menos medidor (40 %) y puedes elegir el tipo Tera. +5 % de daño.', color: 0x7fe0ff,
    apply: (s) => void (s.damage *= 1.05) },
  { id: 'cristal-z', name: 'Cristal Z', description: 'El Movimiento Z se puede repetir en cada piso (sin él, una vez por partida). +5 % de daño.', color: 0xffd34d,
    apply: (s) => void (s.damage *= 1.05) },
  ...TYPE_BOOSTERS.map(([id, name, type, color]) => ({
    id,
    name,
    description: `Tus poderes de tipo ${TYPE_ES[type]} hacen un 25 % más de daño.`,
    color,
    apply: (st: PlayerStats) => add(st.typeBoost, type, 0.25),
  })),
];

(PASSIVE_ITEMS as PassiveItem[]).push(...SPECIAL_ITEMS);

/**
 * Pasivos que NO salen en sorteos al azar (cofres, suelo, tienda, mercader, jefes, forja): solo se consiguen en su sala
 * dedicada. La Mega Piedra sale siempre, una vez por piso, en el Santuario de la Mega Piedra (level/roomEvents.ts).
 */
export const NON_RANDOM_PASSIVES: ReadonlySet<string> = new Set(['mega-piedra']);
/** Pasivos que pueden salir al azar: todos menos los de `NON_RANDOM_PASSIVES`. */
export const RANDOM_PASSIVES: readonly PassiveItem[] = PASSIVE_ITEMS.filter((i) => !NON_RANDOM_PASSIVES.has(i.id));

/** T73 (mejorar en la forja): cada nivel da +25 % al efecto del objeto, hasta el nivel 3. */
export const UPGRADE_STEP = 0.25;
export const UPGRADE_MAX = 3;
/** Estadísticas que son cuentas enteras (disparos, rebotes…): el extra se redondea hacia abajo. */
const INTEGER_STATS: ReadonlySet<string> = new Set(['extraShots', 'pierce', 'bounces', 'backShots', 'shieldPerRoom', 'focusBand']);

/**
 * Aplica `item` sobre `s` con su nivel de mejora: el cambio que hace en cada estadística numérica (y en los mapas por
 * tipo) se multiplica por 1 + 0,25 × nivel. Las cuentas enteras se redondean hacia abajo, así un +1 disparo no cambia.
 */
export function applyUpgraded(item: PassiveItem, s: PlayerStats, level: number): void {
  const lv = Math.max(0, Math.min(UPGRADE_MAX, Math.floor(level)));
  if (lv === 0) return item.apply(s);
  const mult = 1 + UPGRADE_STEP * lv;
  const before: PlayerStats = { ...s, typeBoost: { ...s.typeBoost }, statusBoost: { ...s.statusBoost } };
  item.apply(s);
  const rec = s as unknown as Record<string, unknown>;
  const old = before as unknown as Record<string, unknown>;
  for (const k of Object.keys(rec)) {
    const a = old[k];
    const b = rec[k];
    if (typeof a === 'number' && typeof b === 'number' && a !== b) {
      const d = (b - a) * mult;
      rec[k] = a + (INTEGER_STATS.has(k) ? Math.trunc(d) : d);
    }
  }
  for (const m of ['typeBoost', 'statusBoost'] as const) {
    const now = s[m];
    for (const t of Object.keys(now)) {
      const a = before[m][t] ?? 0;
      const b = now[t] ?? 0;
      if (a !== b) now[t] = a + (b - a) * mult;
    }
  }
}

/** ¿Mejorar `id` cambia algo? Solo los objetos con valor numérico (no Magikarp ni los que solo dan +1 disparo…). */
export function upgradeable(id: string): boolean {
  const item = passiveById(id);
  if (!item) return false;
  const a = computeStats([id]);
  const b = computeStats([id], BASE_STATS, { [id]: UPGRADE_MAX });
  return JSON.stringify(a) !== JSON.stringify(b);
}

/**
 * Estadísticas resultantes de tener estos objetos (se repiten si hay duplicados), encima de las del
 * Pokémon (`base`, ver pokeStats.ts) o de las de por defecto.
 */
export function computeStats(
  passiveIds: readonly string[],
  base: Readonly<PlayerStats> = BASE_STATS,
  levels: Readonly<Record<string, number>> = {},
): PlayerStats {
  // Copia también los mapas por tipo, para no tocar los de la base
  const s: PlayerStats = { ...base, typeBoost: { ...base.typeBoost }, statusBoost: { ...base.statusBoost } };
  for (const id of passiveIds) {
    const item = passiveById(id);
    if (item) applyUpgraded(item, s, levels[id] ?? 0);
  }
  s.fireDelay = Math.max(MIN_FIRE_DELAY, s.fireDelay);
  return s;
}

// --- Poderes: movimientos de PokeAPI que se usan con una tecla ---

export type MoveShape = 'bolt' | 'fan' | 'ring' | 'big';

export interface MoveInfo {
  id: number;
  name: string;
  type: string;
  power: number;
}

export interface MovePower extends MoveInfo {
  shape: MoveShape;
  /** Milisegundos de recarga. */
  cooldown: number;
}

/** La potencia del movimiento decide cómo sale: más potencia, más lento y más contundente. */
export function shapeForPower(power: number): MoveShape {
  if (power >= 100) return 'big'; // proyectil grande que atraviesa
  if (power >= 70) return 'fan'; // abanico de 3
  if (power >= 50) return 'ring'; // anillo de 8
  return 'bolt'; // disparo rápido
}

// --- Rarezas de los poderes: los más potentes son más raros, tardan más en recargar y salen más en pisos altos ---

export const MOVE_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type MoveRarity = (typeof MOVE_RARITIES)[number];

export const MOVE_RARITY_LABEL: Record<MoveRarity, string> = { common: 'Común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario' };
export const MOVE_RARITY_COLOR: Record<MoveRarity, number> = { common: 0xb8c4d8, rare: 0x4fa8ff, epic: 0xb36bff, legendary: 0xffb02e };

/** Rareza según la potencia del movimiento. */
export function moveRarity(power: number): MoveRarity {
  if (power >= 100) return 'legendary';
  if (power >= 70) return 'epic';
  if (power >= 50) return 'rare';
  return 'common';
}

/** Cuánto se alarga la recarga de cada rareza. */
const RARITY_COOLDOWN: Record<MoveRarity, number> = { common: 1, rare: 1.25, epic: 1.6, legendary: 2.1 };

/** Recarga en ms: más potencia y más rareza, más espera (antes salían demasiado seguidos). Tope de 9 s. */
export function cooldownForPower(power: number): number {
  return Math.min(9000, Math.round((900 + power * 12) * RARITY_COOLDOWN[moveRarity(power)]));
}

/** Probabilidad (en pesos) de cada rareza al soltar un poder, según el piso: cuanto más abajo, más raros. */
export function moveRarityWeights(floor: number): Record<MoveRarity, number> {
  const f = Math.max(1, Math.floor(floor));
  const table: Record<MoveRarity, number>[] = [
    { common: 70, rare: 25, epic: 5, legendary: 0 },
    { common: 55, rare: 32, epic: 11, legendary: 2 },
    { common: 40, rare: 35, epic: 20, legendary: 5 },
    { common: 28, rare: 34, epic: 27, legendary: 11 },
    { common: 18, rare: 30, epic: 32, legendary: 20 },
  ];
  return table[Math.min(f, table.length) - 1];
}

/**
 * Saca (y quita) un poder de `pool` eligiendo antes la rareza con los pesos del piso. Si de esa rareza no queda
 * ninguno, se baja a la siguiente que haya.
 */
export function takeMoveByRarity(rng: () => number, pool: MovePower[], floor: number): MovePower {
  const w = moveRarityWeights(floor);
  const present = MOVE_RARITIES.filter((r) => pool.some((m) => moveRarity(m.power) === r));
  const total = present.reduce((a, r) => a + w[r], 0);
  let pick: MoveRarity = present[0];
  if (total > 0) {
    let x = rng() * total;
    for (const r of present) {
      x -= w[r];
      if (x < 0) {
        pick = r;
        break;
      }
    }
  }
  const candidates = pool.filter((m) => moveRarity(m.power) === pick);
  const move = candidates[Math.floor(rng() * candidates.length)];
  pool.splice(pool.indexOf(move), 1);
  return move;
}

export function toMovePower(m: MoveInfo): MovePower {
  return { ...m, shape: shapeForPower(m.power), cooldown: cooldownForPower(m.power) };
}

// --- Objetos que aparecen en el suelo ---

export type DroppedItem =
  | { kind: 'passive'; item: PassiveItem }
  | { kind: 'move'; move: MovePower }
  | { kind: 'active'; id: string };

/** Probabilidad de que un objeto sea un poder (movimiento) en lugar de un pasivo. */
export const MOVE_ITEM_CHANCE = 0.5;

/**
 * Elige qué aparece en el suelo. Un poder se saca (y se quita) de `movePool`;
 * los pasivos evitan repetirse hasta que se tienen todos.
 */
// --- Rareza y precio de los pasivos (T52) ---

/** Rareza de cada pasivo (los que no están, raros). Más rara = sale menos y cuesta más en la tienda. */
export const PASSIVE_RARITY: Readonly<Record<string, MoveRarity>> = {
  'baya-aranja': 'common', 'pluma-ligera': 'common', 'piedra-dura': 'common', 'baya-meloc': 'common', 'baya-lichi': 'common',
  'polvo-veloz': 'common', 'cuerda-huida': 'common', 'reloj-arena': 'common', zahori: 'common',
  'cinta-elegida': 'epic', 'gafas-elegidas': 'epic', 'panuelo-elegido': 'epic', 'banda-focus': 'epic', 'telescopio': 'epic',
  'doble-equipo': 'epic', 'concha-campana': 'epic', 'gafas-especiales': 'epic', 'roca-del-rey': 'epic', 'mineral-evolutivo': 'epic',
  'bola-ferrea': 'epic', 'piedra-lunar': 'epic',
  'cola-gemela': 'legendary', 'orbe-vital': 'legendary',
  // T74: objeto raro de verdad; ya no sale al azar, solo en el Santuario de la Mega Piedra (una vez por piso)
  'mega-piedra': 'legendary',
  // T75: también raros de verdad
  'banda-dinamax': 'legendary', teragema: 'legendary', 'cristal-z': 'legendary',
};
export const passiveRarity = (id: string): MoveRarity => PASSIVE_RARITY[id] ?? 'rare';
/** Precio en la tienda según la rareza (monedas de la partida). */
export const PASSIVE_PRICE: Record<MoveRarity, number> = { common: 11, rare: 15, epic: 21, legendary: 28 };
export const passivePrice = (id: string): number => PASSIVE_PRICE[passiveRarity(id)];
/** Peso al sortear un pasivo: los comunes salen 4 veces más que los legendarios. */
export const PASSIVE_WEIGHT: Record<MoveRarity, number> = { common: 4, rare: 3, epic: 2, legendary: 1 };

/** Elige un pasivo con los pesos de su rareza (una sola tirada de `rng`). */
export function pickPassive(rng: () => number, list: readonly PassiveItem[]): PassiveItem {
  const total = list.reduce((a, i) => a + PASSIVE_WEIGHT[passiveRarity(i.id)], 0);
  let x = rng() * total;
  for (const i of list) {
    x -= PASSIVE_WEIGHT[passiveRarity(i.id)];
    if (x < 0) return i;
  }
  return list[list.length - 1];
}

export function rollItem(
  rng: () => number,
  ownedPassives: ReadonlySet<string>,
  movePool: MovePower[],
  /** Probabilidad de un objeto activo (ids en `actives`); 0 = nunca. */
  activeChance = 0,
  actives: readonly string[] = [],
  /** Pasivos que pueden salir (sin los bloqueados por logros, ver missions.ts). */
  pool: readonly PassiveItem[] = RANDOM_PASSIVES,
  /** Piso actual: cuanto más alto, más raros los poderes que salen. */
  floor = 1,
): DroppedItem {
  if (actives.length > 0 && rng() < activeChance) return { kind: 'active', id: actives[Math.floor(rng() * actives.length)] };
  if (movePool.length > 0 && rng() < MOVE_ITEM_CHANCE) {
    return { kind: 'move', move: takeMoveByRarity(rng, movePool, floor) };
  }
  const fresh = pool.filter((i) => !ownedPassives.has(i.id));
  const list = fresh.length > 0 ? fresh : pool;
  // T52: los raros salen menos
  return { kind: 'passive', item: pickPassive(rng, list) };
}

// --- Huecos de objetos pasivos (T73) ---
// Constantes sueltas para poder equilibrarlas sin tocar la lógica (ver forge.ts).

/** Huecos al empezar la partida. */
export const ITEM_SLOTS_BASE = 10;
/** Huecos que da cada jefe vencido. */
export const ITEM_SLOTS_PER_BOSS = 1;
/** Tope de huecos, por muchos jefes que caigan. */
export const ITEM_SLOTS_MAX = 16;

/** Cuántos movimientos especiales trae equipados una partida nueva según el modo (Rush de jefes: 2, resto: 1). */
export const starterMoveCount = (mode: string): number => (mode === 'bossrush' ? 2 : 1);

/**
 * Movimientos especiales con los que empieza una partida nueva, sacados de `pool` (ya filtrado por los tipos del
 * Pokémon). Con 1: uno al azar de los comunes/raros (lo de siempre). Con 2 (Rush de jefes): uno ligero (potencia
 * < 75) y uno pesado (≥ 75), como los jefes en bossStyles, prefiriendo el tipo principal; si falta alguna banda se
 * completa con lo que haya. No modifica `pool`; nunca repite movimiento.
 */
export function pickStarterMoves<T extends MoveInfo>(pool: readonly T[], count: number, rand: () => number, mainType?: string): T[] {
  if (pool.length === 0 || count <= 0) return [];
  const pick = (list: readonly T[]) => list[Math.floor(rand() * list.length) % list.length];
  if (count === 1) {
    const easy = pool.filter((m) => moveRarity(m.power) !== 'epic' && moveRarity(m.power) !== 'legendary');
    return [pick(easy.length > 0 ? easy : pool)];
  }
  const out: T[] = [];
  const left = () => pool.filter((m) => !out.includes(m));
  const band = (heavy: boolean) => {
    const inBand = left().filter((m) => (m.power >= 75) === heavy);
    const own = inBand.filter((m) => m.type === mainType);
    return own.length > 0 ? own : inBand;
  };
  for (const heavy of [false, true]) {
    const list = band(heavy);
    if (list.length > 0) out.push(pick(list));
  }
  while (out.length < count && left().length > 0) out.push(pick(left()));
  return out.slice(0, count);
}
