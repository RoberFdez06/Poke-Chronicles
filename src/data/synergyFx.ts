// Sinergias que transforman: suma de efectos especiales, descubrimiento (Libro de sinergias), pistas de qué objeto
// completaría una y el guardado de las descubiertas. Lógica pura, sin Phaser, para poder testearla.
import { passiveById } from './items.ts';
import { SYNERGIES, synergyActive, type Synergy, type SynergyFx } from './synergies.ts';

/** Todos los efectos especiales activos a la vez, ya sumados (lo que lee GameScene). */
export interface SynergyFxState {
  orbitals: { count: number; radius: number; dmg: number; color: number } | null;
  /** Daño por toque de cada rastro (0 = sin rastro). */
  trail: { fire: number; ice: number };
  chain: { chance: number; jumps: number; range: number; mul: number } | null;
  healOnKill: number;
  echo: { delay: number; mul: number } | null;
  aura: { radius: number; dps: number; color: number } | null;
  reflect: number;
  extraDrop: number;
  burst: { radius: number; mul: number } | null;
  split: { count: number; mul: number } | null;
  ricochet: number;
  nova: { every: number; count: number; mul: number } | null;
  retaliate: { radius: number; dmg: number } | null;
  /** Transformación activa (la última de la lista si hubiera varias) para el aspecto del jugador. */
  transform: { id: string; name: string; color: number; glow: number } | null;
}

/** Topes para que varias sinergias juntas no rompan el juego. */
export const FX_CAPS = { orbitals: 6, chance: 0.9, healOnKill: 6, extraDrop: 0.5, split: 5, ricochet: 3 } as const;

export const emptyFx = (): SynergyFxState => ({
  orbitals: null, trail: { fire: 0, ice: 0 }, chain: null, healOnKill: 0, echo: null, aura: null, reflect: 0,
  extraDrop: 0, burst: null, split: null, ricochet: 0, nova: null, retaliate: null, transform: null,
});

/** Junta dos probabilidades (como tiradas independientes), con tope. */
const orChance = (a: number, b: number, cap = FX_CAPS.chance) => Math.min(cap, 1 - (1 - a) * (1 - b));

function addFx(st: SynergyFxState, f: SynergyFx) {
  switch (f.kind) {
    case 'orbitals': {
      const o = st.orbitals;
      st.orbitals = o
        ? { count: Math.min(FX_CAPS.orbitals, o.count + f.count), radius: Math.max(o.radius, f.radius), dmg: Math.max(o.dmg, f.dmg), color: f.color }
        : { ...f, count: Math.min(FX_CAPS.orbitals, f.count) };
      return;
    }
    case 'trail':
      st.trail[f.element] = Math.max(st.trail[f.element], f.dmg);
      return;
    case 'chain': {
      const c = st.chain;
      st.chain = c
        ? { chance: Math.min(1, Math.max(c.chance, f.chance, orChance(c.chance, f.chance))), jumps: Math.max(c.jumps, f.jumps), range: Math.max(c.range, f.range), mul: Math.max(c.mul, f.mul) }
        : { chance: f.chance, jumps: f.jumps, range: f.range, mul: f.mul };
      return;
    }
    case 'healOnKill':
      st.healOnKill = Math.min(FX_CAPS.healOnKill, st.healOnKill + f.hp);
      return;
    case 'echo':
      st.echo = st.echo ? { delay: Math.min(st.echo.delay, f.delay), mul: Math.max(st.echo.mul, f.mul) } : { delay: f.delay, mul: f.mul };
      return;
    case 'aura':
      st.aura = st.aura ? { radius: Math.max(st.aura.radius, f.radius), dps: st.aura.dps + f.dps, color: f.color } : { radius: f.radius, dps: f.dps, color: f.color };
      return;
    case 'reflect':
      st.reflect = orChance(st.reflect, f.chance);
      return;
    case 'extraDrop':
      st.extraDrop = Math.min(FX_CAPS.extraDrop, st.extraDrop + f.chance);
      return;
    case 'burst':
      st.burst = st.burst ? { radius: Math.max(st.burst.radius, f.radius), mul: Math.max(st.burst.mul, f.mul) } : { radius: f.radius, mul: f.mul };
      return;
    case 'split':
      st.split = st.split ? { count: Math.min(FX_CAPS.split, st.split.count + 1), mul: Math.max(st.split.mul, f.mul) } : { count: f.count, mul: f.mul };
      return;
    case 'ricochet':
      st.ricochet = Math.min(FX_CAPS.ricochet, st.ricochet + f.times);
      return;
    case 'nova':
      st.nova = st.nova ? { every: Math.min(st.nova.every, f.every), count: Math.max(st.nova.count, f.count), mul: Math.max(st.nova.mul, f.mul) } : { every: f.every, count: f.count, mul: f.mul };
      return;
    case 'retaliate':
      st.retaliate = st.retaliate ? { radius: Math.max(st.retaliate.radius, f.radius), dmg: st.retaliate.dmg + f.dmg } : { radius: f.radius, dmg: f.dmg };
      return;
  }
}

/** Suma los efectos de las sinergias activas (ids en cualquier orden; los que no existen se ignoran). */
export function synergyFxFor(activeIds: readonly string[]): SynergyFxState {
  const st = emptyFx();
  for (const syn of SYNERGIES) {
    if (!activeIds.includes(syn.id)) continue;
    for (const f of syn.fx ?? []) addFx(st, f);
    if (syn.transform) st.transform = { id: syn.id, name: syn.name, ...syn.transform };
  }
  return st;
}

export const hasAnyFx = (st: SynergyFxState): boolean => JSON.stringify(st) !== JSON.stringify(emptyFx());

export const synergyById = (id: string): Synergy | undefined => SYNERGIES.find((s) => s.id === id);
export const isTransformation = (s: Synergy): boolean => !!s.transform;

/** Cuántas piezas pide la receta (objetos y poder). */
export function recipeSize(s: Synergy): number {
  return (s.all?.length ?? 0) + (s.anyOf?.count ?? 0) + (s.powerType ? 1 : 0);
}

const TYPE_ES: Record<string, string> = {
  fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta', ice: 'Hielo', fighting: 'Lucha', psychic: 'Psíquico',
  dragon: 'Dragón', ghost: 'Fantasma', dark: 'Siniestro', steel: 'Acero', normal: 'Normal', flying: 'Volador', bug: 'Bicho',
  poison: 'Veneno', ground: 'Tierra', rock: 'Roca', fairy: 'Hada',
};

/** Receta legible: «Carbón + Pluma Ligera», «2 de: Cinta Elegida, …», «+ poder de Planta». */
export function recipeText(s: Synergy): string {
  const name = (id: string) => passiveById(id)?.name ?? id;
  const parts: string[] = [];
  if (s.all) parts.push(...s.all.map(name));
  if (s.anyOf) parts.push(`${s.anyOf.count} de: ${s.anyOf.ids.map(name).join(', ')}`);
  if (s.powerType) parts.push(`poder de ${TYPE_ES[s.powerType] ?? s.powerType}`);
  return parts.join(' + ');
}

/** Sinergias que se activarían al coger `itemId` y que ahora no lo están. */
export function synergiesCompletedBy(itemId: string, passives: readonly string[], powerTypes: readonly string[]): Synergy[] {
  const now = passives;
  const next = [...passives, itemId];
  return SYNERGIES.filter((s) => !synergyActive(s, now, powerTypes) && synergyActive(s, next, powerTypes));
}

/** Sinergias activas que se romperían al soltar `itemId` (una copia). */
export function synergiesBrokenBy(itemId: string, passives: readonly string[], powerTypes: readonly string[]): Synergy[] {
  const i = passives.indexOf(itemId);
  if (i < 0) return [];
  const next = passives.filter((_, k) => k !== i);
  return SYNERGIES.filter((s) => synergyActive(s, passives, powerTypes) && !synergyActive(s, next, powerTypes));
}

/** Texto de pista corto para una lista: «Sinergia: Rueda Fuego» (o varias separadas por coma). */
export function hintText(list: readonly Synergy[], prefix = 'Sinergia'): string | undefined {
  if (list.length === 0) return undefined;
  return `${prefix}: ${list.map((s) => s.name).join(', ')}`;
}

// --- Descubrimiento ---

/** Las que se descubren ahora (activas y no vistas antes), en el orden de la lista. */
export function newDiscoveries(found: readonly string[], active: readonly string[]): string[] {
  const seen = new Set(found);
  return [...new Set(active)].filter((id) => !seen.has(id) && !!synergyById(id));
}

export interface BookEntry {
  id: string;
  found: boolean;
  /** «???» si no se ha descubierto. */
  name: string;
  /** Receta, o pista («Receta de 3 piezas») si no. */
  recipe: string;
  description: string;
  transform: boolean;
  pieces: number;
}

/** Entradas del Libro de sinergias: primero las normales y al final las transformaciones. */
export function bookEntries(found: readonly string[]): BookEntry[] {
  const seen = new Set(found);
  const list = [...SYNERGIES].sort((a, b) => Number(!!a.transform) - Number(!!b.transform));
  return list.map((s) => {
    const ok = seen.has(s.id);
    const pieces = recipeSize(s);
    return {
      id: s.id,
      found: ok,
      name: ok ? s.name : '???',
      recipe: ok ? recipeText(s) : `Receta de ${pieces} piezas${s.powerType ? ' (una es un poder)' : ''}`,
      description: ok ? s.description.replace(/^[^:]*:\s*/, '') : s.transform ? 'Transformación sin descubrir.' : 'Sinergia sin descubrir.',
      transform: !!s.transform,
      pieces,
    };
  });
}

export const bookProgress = (found: readonly string[]): { found: number; total: number } => ({
  found: SYNERGIES.filter((s) => found.includes(s.id)).length,
  total: SYNERGIES.length,
});

// --- Guardado ---

export const SYNERGY_BOOK_VERSION = 1;

/**
 * Lee lo guardado: { v: 1, ids: [...] }. Migra la lista suelta (formato sin versión) y descarta ids que ya no existen.
 */
export function parseSynergiesFound(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    const ids = Array.isArray(data) ? data : (data as { ids?: unknown })?.ids;
    if (!Array.isArray(ids)) return [];
    return [...new Set(ids.filter((x): x is string => typeof x === 'string' && !!synergyById(x)))];
  } catch {
    return [];
  }
}

export const serializeSynergiesFound = (ids: readonly string[]): string => JSON.stringify({ v: SYNERGY_BOOK_VERSION, ids: [...new Set(ids)] });

/** Lo que falta de una receta (nombres): objetos sin coger, «1 de: …» o el poder del tipo. */
export function missingPieces(s: Synergy, passives: readonly string[], powerTypes: readonly string[]): string[] {
  const have = new Set(passives);
  const name = (id: string) => passiveById(id)?.name ?? id;
  const out = (s.all ?? []).filter((id) => !have.has(id)).map(name);
  if (s.anyOf) {
    const got = s.anyOf.ids.filter((id) => have.has(id)).length;
    const left = s.anyOf.ids.filter((id) => !have.has(id));
    for (let k = got; k < s.anyOf.count; k++) out.push(`1 de: ${left.map(name).join(', ')}`);
  }
  if (s.powerType && !powerTypes.includes(s.powerType)) out.push(`poder de ${TYPE_ES[s.powerType] ?? s.powerType}`);
  return out;
}

/** Sinergias a las que solo les falta una pieza (para la pausa): «Rueda Fuego (falta Pluma Ligera)». */
export function nearSynergies(passives: readonly string[], powerTypes: readonly string[], found: readonly string[] = []): { id: string; label: string }[] {
  return SYNERGIES.filter((s) => !synergyActive(s, passives, powerTypes))
    .map((s) => ({ s, miss: missingPieces(s, passives, powerTypes) }))
    .filter(({ s, miss }) => miss.length === 1 && recipeSize(s) - 1 >= 1)
    .map(({ s, miss }) => ({ id: s.id, label: `${found.includes(s.id) ? s.name : '???'} (falta ${miss[0]})` }));
}
