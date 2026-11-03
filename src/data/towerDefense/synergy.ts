// Defensa de torres: combos y sinergias entre torres vecinas (a una casilla, también en diagonal). Dos torres del
// mismo tipo se dan «Resonancia» (+8 % de daño por vecino, máx. +24 %); dos de tipos complementarios activan un
// combo con nombre y efecto propio. Si las dos están al nivel 5 o más, el combo se vuelve «Dúo»: efecto doble y sus
// ataques especiales salen juntos (ataque combinado). Lógica pura, sin Phaser.
import type { TowerStats } from './towers.ts';

export const SYNERGY_RANGE = 1.5;
export const RESONANCE_STEP = 0.08;
export const RESONANCE_MAX = 3;
/** Nivel desde el que dos torres en combo forman un Dúo. */
export const DUO_LEVEL = 5;
/** Ataque combinado de un Dúo: más daño y área. */
export const DUO_DAMAGE = 1.6;
export const DUO_SPLASH = 1.5;

export interface Combo {
  id: string;
  a: string;
  b: string;
  name: string;
  desc: string;
  color: number;
  dmg?: number;
  rate?: number;
  range?: number;
  splash?: number;
  chain?: number;
  slow?: number;
  crit?: number;
}

/** Pares de tipos que se potencian (sirve en cualquier orden). */
export const COMBOS: readonly Combo[] = [
  { id: 'electroagua', a: 'water', b: 'electric', name: 'Electroagua', desc: '+1 salto de cadena y +12 % de daño', color: 0x5ab4ff, chain: 1, dmg: 0.12 },
  { id: 'incendio', a: 'fire', b: 'grass', name: 'Incendio', desc: '+35 % de área y +10 % de daño', color: 0xff7a3a, splash: 0.35, dmg: 0.1 },
  { id: 'vapor', a: 'fire', b: 'water', name: 'Vapor', desc: '+12 % de cadencia', color: 0xd8e0e8, rate: 0.12 },
  { id: 'glaciar', a: 'ice', b: 'water', name: 'Glaciar', desc: 'Frena un 15 % más', color: 0x8fe0ff, slow: 0.15, dmg: 0.05 },
  { id: 'sismo', a: 'rock', b: 'ground', name: 'Sismo', desc: '+30 % de área', color: 0xb8945a, splash: 0.3, dmg: 0.05 },
  { id: 'vendaval', a: 'dragon', b: 'flying', name: 'Vendaval', desc: '+15 % de cadencia', color: 0xb08aff, rate: 0.15 },
  { id: 'mente', a: 'psychic', b: 'fairy', name: 'Mente mágica', desc: '+15 % de alcance', color: 0xff8ae0, range: 0.15 },
  { id: 'sombras', a: 'ghost', b: 'dark', name: 'Sombras', desc: '+10 % de críticos', color: 0x7a5ab0, crit: 0.1 },
  { id: 'enjambre', a: 'bug', b: 'grass', name: 'Enjambre', desc: '+12 % de cadencia', color: 0x9acd32, rate: 0.12 },
  { id: 'forja', a: 'steel', b: 'fire', name: 'Forja', desc: '+15 % de daño', color: 0xc0c8d4, dmg: 0.15 },
  { id: 'veneno', a: 'poison', b: 'bug', name: 'Plaga', desc: '+20 % de área y +8 % de daño', color: 0xb05ad0, splash: 0.2, dmg: 0.08 },
  { id: 'combate', a: 'fighting', b: 'normal', name: 'Entrenamiento', desc: '+10 % de daño y cadencia', color: 0xe08a5a, dmg: 0.1, rate: 0.1 },
  { id: 'tormenta', a: 'electric', b: 'flying', name: 'Tormenta', desc: '+12 % de alcance y +8 % de daño', color: 0xffd34d, range: 0.12, dmg: 0.08 },
  { id: 'escarcha', a: 'ice', b: 'psychic', name: 'Escarcha mental', desc: '+10 % de daño y frena un 10 % más', color: 0xa0c8ff, dmg: 0.1, slow: 0.1 },
];

export interface SynTower {
  id: number;
  x: number;
  y: number;
  types: readonly string[];
  level: number;
}

export interface SynergyLink {
  a: number;
  b: number;
  /** Mismo tipo (resonancia) o combo de tipos. */
  kind: 'same' | 'combo';
  /** Tipo compartido (resonancia) o id del combo. */
  key: string;
  color: number;
  duo: boolean;
}

export const comboById = (id: string): Combo | undefined => COMBOS.find((c) => c.id === id);

/** Combo entre dos listas de tipos (el primero que encaje), o null. */
export function comboOf(ta: readonly string[], tb: readonly string[]): Combo | null {
  for (const c of COMBOS) {
    if ((ta.includes(c.a) && tb.includes(c.b)) || (ta.includes(c.b) && tb.includes(c.a))) return c;
  }
  return null;
}

export const neighbours = (a: { x: number; y: number }, b: { x: number; y: number }): boolean => Math.hypot(a.x - b.x, a.y - b.y) <= SYNERGY_RANGE;

/** Enlaces de sinergia entre todas las torres (cada par como mucho uno: el combo manda sobre la resonancia). */
export function synergyLinks(towers: readonly SynTower[]): SynergyLink[] {
  const out: SynergyLink[] = [];
  for (let i = 0; i < towers.length; i++) {
    for (let j = i + 1; j < towers.length; j++) {
      const a = towers[i];
      const b = towers[j];
      if (!neighbours(a, b)) continue;
      const combo = comboOf(a.types, b.types);
      if (combo) {
        out.push({ a: a.id, b: b.id, kind: 'combo', key: combo.id, color: combo.color, duo: a.level >= DUO_LEVEL && b.level >= DUO_LEVEL });
        continue;
      }
      const same = a.types.find((t) => b.types.includes(t));
      if (same) out.push({ a: a.id, b: b.id, kind: 'same', key: same, color: 0xffffff, duo: false });
    }
  }
  return out;
}

export interface SynergyBonus {
  dmg: number;
  rate: number;
  range: number;
  splash: number;
  chain: number;
  slow: number;
  crit: number;
  /** Nombres de lo activo (para el panel). */
  names: string[];
  /** Torre con la que forma un Dúo (la primera), o null. */
  duoWith: number | null;
}

/** Bonus de una torre por sus enlaces. Cada combo cuenta una vez; la resonancia, por vecino (hasta 3). */
export function synergyBonus(id: number, links: readonly SynergyLink[]): SynergyBonus {
  const b: SynergyBonus = { dmg: 0, rate: 0, range: 0, splash: 0, chain: 0, slow: 0, crit: 0, names: [], duoWith: null };
  let same = 0;
  const seen = new Set<string>();
  for (const l of links) {
    if (l.a !== id && l.b !== id) continue;
    if (l.kind === 'same') {
      same++;
      continue;
    }
    const other = l.a === id ? l.b : l.a;
    if (l.duo && b.duoWith === null) b.duoWith = other;
    if (seen.has(l.key)) continue;
    seen.add(l.key);
    const c = comboById(l.key);
    if (!c) continue;
    const k = l.duo ? 2 : 1;
    b.dmg += (c.dmg ?? 0) * k;
    b.rate += (c.rate ?? 0) * k;
    b.range += (c.range ?? 0) * k;
    b.splash += (c.splash ?? 0) * k;
    b.chain += (c.chain ?? 0) * k;
    b.slow += (c.slow ?? 0) * k;
    b.crit += (c.crit ?? 0) * k;
    b.names.push(l.duo ? `Dúo ${c.name}` : c.name);
  }
  if (same) {
    const n = Math.min(RESONANCE_MAX, same);
    b.dmg += n * RESONANCE_STEP;
    b.names.unshift(`Resonancia ×${n}`);
  }
  return b;
}

/** Aplica el bonus a unas estadísticas. */
export function applySynergy(s: TowerStats, b: SynergyBonus): TowerStats {
  if (!b.names.length) return s;
  return {
    ...s,
    damage: Math.round(s.damage * (1 + b.dmg) * 10) / 10,
    rate: Math.round(s.rate * (1 + b.rate) * 100) / 100,
    range: Math.round(s.range * (1 + b.range) * 100) / 100,
    splash: s.splash > 0 ? s.splash * (1 + b.splash) : b.splash > 0 && s.style === 'splash' ? 0.9 * b.splash : 0,
    chain: s.chain > 0 ? s.chain + b.chain : 0,
    slow: s.slowTime > 0 ? Math.max(0.3, s.slow - b.slow) : s.slow,
    crit: Math.min(0.6, s.crit + b.crit),
  };
}
