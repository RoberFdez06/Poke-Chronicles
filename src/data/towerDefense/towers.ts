// Defensa de torres: estadísticas de cada torre a partir de las estadísticas reales del Pokémon (pokeStats), su
// rareza y sus mejoras de la colección; niveles 1-5 con dinero, dos ramas al nivel 3 y evolución (o nivel final con
// aura) al 5. Quien tenga megaevolución (powerForm.ts) puede pagar un nivel 6 extra: forma mega, ataque mega y aura
// mega que refuerza a las torres cercanas. Lógica pura, sin Phaser.
import { rawEffectiveness } from '../typeChart.ts';
import { hasMegaEvolution, megaFormName } from '../powerForm.ts';
import { FARM_IDS, finalMoveOf, type TdMon } from './species.ts';

export const MAX_TOWER_LEVEL = 5;
/** Nivel extra de megaevolución (solo quien tenga forma mega). */
export const MEGA_LEVEL = 6;
/** Nivel en el que se elige rama. */
export const BRANCH_LEVEL = 3;

/** Cómo ataca cada torre (según su primer tipo). */
export type TowerStyle = 'single' | 'splash' | 'chain' | 'slow' | 'sniper' | 'rapid' | 'support' | 'farm';

export const STYLE_LABEL: Record<TowerStyle, string> = {
  single: 'Disparo',
  splash: 'Área',
  chain: 'Cadena',
  slow: 'Ralentiza',
  sniper: 'Francotirador',
  rapid: 'Ráfaga',
  support: 'Apoyo',
  farm: 'Granja',
};

const STYLE_BY_TYPE: Readonly<Record<string, TowerStyle>> = {
  fire: 'splash', rock: 'splash', ground: 'splash', poison: 'splash',
  electric: 'chain',
  ice: 'slow', water: 'slow',
  psychic: 'sniper', dragon: 'sniper', steel: 'sniper',
  bug: 'rapid', normal: 'rapid', fighting: 'rapid', flying: 'rapid',
  fairy: 'support',
};

/** Tipos que alcanzan a los voladores (ataques a distancia, rayos, viento, mente…). */
export const AIR_TYPES: ReadonlySet<string> = new Set(['flying', 'electric', 'psychic', 'dragon', 'ghost', 'fairy', 'ice']);

/**
 * Ventaja de tipos en este modo (más marcada que en el juego normal): súper eficaz ×2, poco eficaz ×0,5 y sin
 * efecto ×0,25 (nunca cero, para que ningún enemigo sea invencible).
 */
export function tdTypeMul(attack: string, defend: readonly string[]): number {
  const m = rawEffectiveness(attack, defend);
  if (m === 0) return 0.25;
  if (m > 1) return 2;
  if (m < 1) return 0.5;
  return 1;
}

/** El mejor multiplicador de los tipos de la torre contra el enemigo (el Pokémon usa su mejor ataque). */
export function bestTypeMul(attackTypes: readonly string[], defend: readonly string[]): { mul: number; type: string } {
  let best = { mul: -1, type: attackTypes[0] ?? 'normal' };
  for (const t of attackTypes) {
    const mul = tdTypeMul(t, defend);
    if (mul > best.mul) best = { mul, type: t };
  }
  return best;
}

export type Rarity = TdMon['rarity'];
export const RARITY_COST: Record<Rarity, number> = { common: 100, rare: 130, epic: 170, ultra: 220, legendary: 260 };
const RARITY_POWER: Record<Rarity, number> = { common: 1, rare: 1.08, epic: 1.16, ultra: 1.24, legendary: 1.32 };

export type Branch = 'a' | 'b';

export interface BranchInfo {
  name: string;
  desc: string;
}

/** Las dos ramas del nivel 3: más daño, o más táctica (según cómo ataque). */
export function branchInfo(style: TowerStyle, b: Branch): BranchInfo {
  if (style === 'farm') {
    return b === 'a'
      ? { name: 'Banca', desc: '+40 % de dinero por oleada' }
      : { name: 'Guardiana', desc: 'Ataca como una torre normal y alcanza voladores' };
  }
  if (b === 'a') return { name: 'Fuerza', desc: '+35 % de daño y golpes críticos' };
  if (style === 'support') return { name: 'Bendición', desc: 'Más aura: +25 % de daño a las torres cercanas' };
  return { name: 'Táctica', desc: '+20 % de alcance, ralentiza, golpea en área y alcanza voladores' };
}

/** Estadísticas de una torre en un nivel concreto. */
export interface TowerStats {
  style: TowerStyle;
  /** Daño por golpe. */
  damage: number;
  /** Disparos por segundo. */
  rate: number;
  /** Alcance en casillas. */
  range: number;
  /** Radio del área (0 si no golpea en área). */
  splash: number;
  /** Saltos extra de la cadena. */
  chain: number;
  /** Ralentiza (multiplicador de velocidad) y durante cuánto (s). */
  slow: number;
  slowTime: number;
  /** Alcanza a los voladores. */
  air: boolean;
  /** Probabilidad de crítico (×2). */
  crit: number;
  /** Aura de apoyo: multiplicador de daño de las torres a 1,6 casillas. */
  aura: number;
  /** Dinero al final de cada oleada (granjas). */
  income: number;
  /** Cada cuántos disparos sale el ataque nuevo del nivel final (0 = aún no). */
  specialEvery: number;
  /** Megaevolucionada (nivel 6): ataque mega en lugar del final y aura mega. */
  mega: boolean;
  /** Aura mega: multiplicador de daño de las torres a AURA_RANGE (1 si no tiene). */
  megaAura: number;
}

export function towerStyle(mon: Pick<TdMon, 'id' | 'types'>): TowerStyle {
  if (FARM_IDS.has(mon.id)) return 'farm';
  return STYLE_BY_TYPE[mon.types[0]] ?? 'single';
}

export const towerCost = (mon: Pick<TdMon, 'rarity'>): number => RARITY_COST[mon.rarity];

/** Dinero para pasar del nivel `level` al siguiente (null en el máximo). */
export function upgradeCostFor(mon: Pick<TdMon, 'rarity'>, level: number): number | null {
  if (level >= MAX_TOWER_LEVEL) return null;
  const k = [0, 0.6, 0.9, 1.25, 1.9][Math.max(0, Math.min(4, level))];
  return Math.round((towerCost(mon) * k) / 5) * 5;
}

/** Lo gastado en total en una torre de ese nivel (para vender). */
export function spentFor(mon: Pick<TdMon, 'rarity'>, level: number): number {
  let n = towerCost(mon) + (level >= MEGA_LEVEL ? megaCostFor(mon) : 0);
  for (let l = 1; l < level; l++) n += upgradeCostFor(mon, l) ?? 0;
  return n;
}

export const SELL_PART = 0.7;
export const sellValue = (mon: Pick<TdMon, 'rarity'>, level: number): number => Math.floor(spentFor(mon, level) * SELL_PART);

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function towerStats(mon: TdMon, level: number, branch: Branch | null): TowerStats {
  const s = mon.stats;
  const style = towerStyle(mon);
  const mega = Math.floor(level) >= MEGA_LEVEL;
  const lv = clamp(Math.floor(level), 1, MAX_TOWER_LEVEL);
  const up = mon.upgrades ?? {};
  const power = RARITY_POWER[mon.rarity];
  const atk = Math.max(s.attack, s.spAttack);
  let damage = (6 + atk * 0.13) * power * (1 + 0.04 * (up.damage ?? 0));
  let rate = clamp(0.65 + s.speed / 130, 0.75, 1.8) * (1 + 0.03 * (up.rate ?? 0));
  let range = clamp(2.2 + (s.defense + s.spDefense) / 2 / 110, 2.5, 3.6) * (1 + 0.03 * (up.range ?? 0));
  let splash = 0;
  let chain = 0;
  let slow = 1;
  let slowTime = 0;
  let aura = 1;
  let income = 0;
  let crit = 0.05;
  switch (style) {
    case 'splash': damage *= 0.8; rate *= 0.85; splash = 0.9; break;
    case 'chain': damage *= 0.75; chain = 2; break;
    case 'slow': damage *= 0.85; slow = 0.65; slowTime = 1.4; break;
    case 'sniper': damage *= 1.6; rate *= 0.6; range += 1.4; crit = 0.12; break;
    case 'rapid': damage *= 0.62; rate *= 1.6; range -= 0.2; break;
    case 'support': damage *= 0.7; aura = 1.15; break;
    case 'farm': damage *= 0.35; rate *= 0.8; income = 35; break;
    default: break;
  }
  // Cada nivel: más daño, alcance y velocidad
  damage *= 1 + 0.38 * (lv - 1);
  range *= 1 + 0.06 * (lv - 1);
  rate *= 1 + 0.1 * (lv - 1);
  if (style === 'farm') income = [35, 55, 80, 110, 150][lv - 1];
  const types = mon.types;
  let air = types.some((t) => AIR_TYPES.has(t));
  if (lv >= BRANCH_LEVEL && branch) {
    if (style === 'farm') {
      if (branch === 'a') income = Math.round(income * 1.4);
      else {
        damage /= 0.35;
        air = true;
      }
    } else if (branch === 'a') {
      damage *= 1.35;
      crit += 0.1;
    } else if (style === 'support') {
      aura = 1.25;
    } else {
      range *= 1.2;
      slow = Math.min(slow, 0.75);
      slowTime = Math.max(slowTime, 1);
      splash = Math.max(splash * 1.4, 0.6);
      air = true;
    }
  }
  if (style === 'support' && lv >= 4) aura += 0.05;
  // Megaevolución: mucho más fuerte, más rápida y con más alcance; alcanza voladores y la granja da más
  if (mega) {
    damage *= MEGA_DAMAGE_MUL;
    rate *= 1.15;
    range *= 1.1;
    crit += 0.05;
    air = true;
    if (income) income = Math.round(income * 1.3);
  }
  return {
    style,
    damage: Math.round(damage * 10) / 10,
    rate: Math.round(rate * 100) / 100,
    range: Math.round(range * 100) / 100,
    splash,
    chain,
    slow,
    slowTime,
    air,
    crit,
    aura,
    income,
    // Nivel final: el ataque nuevo sale uno de cada 4 disparos (triple de daño y en área)
    specialEvery: mega ? 3 : lv >= MAX_TOWER_LEVEL ? 4 : 0,
    mega,
    megaAura: mega ? MEGA_AURA : 1,
  };
}

/** Nombre del ataque nuevo del nivel final. */
export const specialMoveOf = (mon: Pick<TdMon, 'types'>): string => finalMoveOf(mon.types[0] ?? 'normal');

/** Multiplicador de daño de la megaevolución y aura mega (+12 % a las torres cercanas). */
export const MEGA_DAMAGE_MUL = 1.6;
export const MEGA_AURA = 1.12;
/** Coste del nivel 6 (megaevolución): bastante dinero, tres veces la torre. */
export const megaCostFor = (mon: Pick<TdMon, 'rarity'>): number => Math.round((towerCost(mon) * 3) / 5) * 5;

/**
 * Especie que megaevoluciona: la evolucionada (o la propia si no evoluciona) si tiene forma mega; null si no tiene y
 * se queda en el nivel 5.
 */
export function megaSpeciesOf(monId: number, evolved: number | null): number | null {
  const id = evolved ?? monId;
  return hasMegaEvolution(id) ? id : null;
}
/** Nombre de la forma mega en PokeAPI (para su sprite). */
export const megaSpriteName = (speciesId: number): string | null => megaFormName(speciesId);

/** Ataque mega del nivel 6, por tipo. */
export const MEGA_MOVE: Readonly<Record<string, string>> = {
  normal: 'Mega Hiperrayo', fire: 'Anillo Ígneo', water: 'Hidroariete', electric: 'Electrocañón', grass: 'Planta Feroz', ice: 'Frío Polar',
  fighting: 'Puño Dinámico', poison: 'Lanza Mugre', ground: 'Filo del Abismo', flying: 'Ascenso Draco', psychic: 'Onda Mental',
  bug: 'Megacuerno', rock: 'Joya de Luz', ghost: 'Golpe Fantasma', dragon: 'Enfado Draco', dark: 'Juego Sucio',
  steel: 'Meteoimpacto', fairy: 'Carantoña',
};
export const megaMoveOf = (mon: Pick<TdMon, 'types'>): string => MEGA_MOVE[mon.types[0] ?? 'normal'] ?? 'Mega Hiperrayo';

/** Texto corto de cada nivel para el panel. */
export function levelLabel(level: number, evolved: boolean): string {
  if (level >= MEGA_LEVEL) return 'Nv. 6 · Megaevolución';
  if (level >= MAX_TOWER_LEVEL) return evolved ? 'Nv. 5 · Evolución' : 'Nv. 5 · Aura final';
  return `Nv. ${level}`;
}
