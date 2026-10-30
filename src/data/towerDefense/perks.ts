// Defensa de torres: mejoras entre oleadas. Tras cada oleada eliges 1 de 3 (tras un jefe, épicas: el doble de fuerza y
// las de torre más grandes). Reliquias globales (alcance, cadencia, daño a un tipo, escarcha, botín, crítico, interés,
// recarga, vida de la base) y mejoras de torre (entrenamiento, evolución, fusión). Lógica pura, sin Phaser.

export const PERKS = ['alcance', 'cadencia', 'tipo', 'escarcha', 'botin', 'critico', 'interes', 'recarga', 'vida', 'entreno', 'evolucion', 'fusion'] as const;
export type PerkId = (typeof PERKS)[number];

export interface Perk {
  id: PerkId;
  epic: boolean;
  /** Tipo para «tipo» (daño a las torres de ese tipo). */
  type?: string;
}

export interface Relics {
  range: number;
  rate: number;
  crit: number;
  /** Daño extra de las torres por tipo (multiplicador). */
  typeDmg: Record<string, number>;
  /** Cada golpe ralentiza: multiplicador de velocidad (1 = nada). */
  frost: number;
  bounty: number;
  /** Parte del dinero que se gana al acabar cada oleada (con tope). */
  interest: number;
  interestCap: number;
  /** Multiplicador del enfriamiento de las habilidades. */
  cooldown: number;
}

export const freshRelics = (): Relics => ({ range: 1, rate: 1, crit: 0, typeDmg: {}, frost: 1, bounty: 1, interest: 0, interestCap: 0, cooldown: 1 });

/** Mejoras de torre (necesitan torres puestas); el resto son reliquias. */
export const TOWER_PERKS: ReadonlySet<PerkId> = new Set(['entreno', 'evolucion', 'fusion']);
/** Solo salen tras un jefe. */
export const EPIC_ONLY: ReadonlySet<PerkId> = new Set(['evolucion', 'fusion']);

export const PERK_ICON: Readonly<Record<PerkId, string>> = {
  alcance: 'pkRange', cadencia: 'pkRate', tipo: 'pkType', escarcha: 'ventisca', botin: 'coin', critico: 'pkCrit', interes: 'pkBank',
  recarga: 'pkClock', vida: 'heart', entreno: 'pkUp', evolucion: 'pkEvo', fusion: 'pkFuse',
};

const pct = (v: number) => `${Math.round(v * 100)} %`;
/** Fuerza de cada mejora (normal, épica). */
export const PERK_VALUE: Readonly<Record<PerkId, readonly [number, number]>> = {
  alcance: [0.1, 0.2],
  cadencia: [0.1, 0.2],
  tipo: [0.25, 0.5],
  escarcha: [0.12, 0.22],
  botin: [0.15, 0.3],
  critico: [0.05, 0.1],
  interes: [0.08, 0.15],
  recarga: [0.15, 0.3],
  vida: [3, 6],
  entreno: [1, 3],
  evolucion: [2, 2],
  fusion: [2, 3],
};
export const perkValue = (p: Perk): number => PERK_VALUE[p.id][p.epic ? 1 : 0];
export const INTEREST_CAP = [50, 110] as const;

export function perkName(p: Perk, typeName: (t: string) => string = (t) => t): string {
  const n: Record<PerkId, string> = {
    alcance: 'Catalejo', cadencia: 'Cinta rápida', tipo: `Emblema ${typeName(p.type ?? 'normal')}`, escarcha: 'Escarcha', botin: 'Amuleto moneda',
    critico: 'Garra afilada', interes: 'Hucha', recarga: 'Reloj de arena', vida: 'Muralla', entreno: 'Entrenamiento', evolucion: 'Piedra evolutiva',
    fusion: 'Fusión',
  };
  return n[p.id];
}

export function perkDesc(p: Perk, typeName: (t: string) => string = (t) => t): string {
  const v = perkValue(p);
  switch (p.id) {
    case 'alcance': return `+${pct(v)} de alcance a todas las torres`;
    case 'cadencia': return `+${pct(v)} de cadencia a todas las torres`;
    case 'tipo': return `+${pct(v)} de daño a las torres de tipo ${typeName(p.type ?? 'normal')}`;
    case 'escarcha': return `Cada golpe ralentiza un ${pct(v)} un momento`;
    case 'botin': return `+${pct(v)} de dinero por baja`;
    case 'critico': return `+${pct(v)} de probabilidad de crítico`;
    case 'interes': return `Al acabar cada oleada, +${pct(v)} de tu dinero (máx. ${INTEREST_CAP[p.epic ? 1 : 0]} $)`;
    case 'recarga': return `Habilidades: −${pct(v)} de enfriamiento`;
    case 'vida': return `+${v} de vida máxima de la base (y la cura)`;
    case 'entreno': return v > 1 ? `Sube gratis un nivel a tus ${v} torres más flojas` : 'Sube gratis un nivel a tu torre más floja';
    case 'evolucion': return `Tu mejor torre sube ${v} niveles gratis (puede evolucionar)`;
    case 'fusion': return `Funde 2 torres del mismo Pokémon: queda una con +${v} niveles`;
  }
}

/** Suma una reliquia. Devuelve las nuevas (no cambia las de entrada). */
export function addRelic(r: Relics, p: Perk): Relics {
  const v = perkValue(p);
  const out: Relics = { ...r, typeDmg: { ...r.typeDmg } };
  if (p.id === 'alcance') out.range += v;
  else if (p.id === 'cadencia') out.rate += v;
  else if (p.id === 'critico') out.crit += v;
  else if (p.id === 'tipo') out.typeDmg[p.type ?? 'normal'] = (out.typeDmg[p.type ?? 'normal'] ?? 1) + v;
  else if (p.id === 'escarcha') out.frost = Math.max(0.5, out.frost - v);
  else if (p.id === 'botin') out.bounty += v;
  else if (p.id === 'interes') {
    out.interest = Math.min(0.3, out.interest + v);
    out.interestCap = Math.max(out.interestCap, INTEREST_CAP[p.epic ? 1 : 0]);
  }
  else if (p.id === 'recarga') out.cooldown = Math.max(0.4, out.cooldown * (1 - v));
  return out;
}

/** Dinero del interés al acabar una oleada. */
export const interestOf = (r: Relics, money: number): number => (r.interest > 0 ? Math.min(r.interestCap, Math.floor(money * r.interest)) : 0);

export interface DraftContext {
  epic: boolean;
  /** Tipos del equipo (para el emblema). */
  types: readonly string[];
  towers: number;
  /** Hay 2 torres del mismo Pokémon (para la fusión). */
  canFuse: boolean;
}

/** 3 mejoras distintas al azar (rng 0..1). Las de torre solo si hay torres; la fusión, si se puede. */
export function draftPerks(rng: () => number, c: DraftContext): Perk[] {
  const pool = PERKS.filter((id) => {
    if (EPIC_ONLY.has(id) && !c.epic) return false;
    if (TOWER_PERKS.has(id) && c.towers === 0) return false;
    if (id === 'fusion' && !c.canFuse) return false;
    if (id === 'tipo' && !c.types.length) return false;
    return true;
  });
  const out: Perk[] = [];
  const left = [...pool];
  // Tras un jefe, una de torre (si hay) entre las tres
  if (c.epic) {
    const tw = left.filter((id) => EPIC_ONLY.has(id));
    if (tw.length) {
      const id = tw[Math.floor(rng() * tw.length)];
      left.splice(left.indexOf(id), 1);
      out.push({ id, epic: true });
    }
  }
  while (out.length < 3 && left.length) {
    const id = left.splice(Math.floor(rng() * left.length), 1)[0];
    const p: Perk = { id, epic: c.epic };
    if (id === 'tipo') p.type = c.types[Math.floor(rng() * c.types.length)];
    out.push(p);
  }
  return out;
}
