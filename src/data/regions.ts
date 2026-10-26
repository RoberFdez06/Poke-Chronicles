// Regiones, iniciales de cada región y filtros de la colección (por región, nombre y rareza).
// Lógica pura, sin Phaser ni red, para poder testearla.
import type { Rarity } from './gacha.ts';
import { regionalForm } from './regionalForms.ts';

export interface Region {
  id: string;
  name: string;
  /** Primer y último número de la Pokédex nacional de la región. */
  first: number;
  last: number;
  /** Sus 3 iniciales: planta, fuego y agua. */
  starters: readonly [number, number, number];
}

export const REGIONS: readonly Region[] = [
  { id: 'kanto', name: 'Kanto', first: 1, last: 151, starters: [1, 4, 7] },
  { id: 'johto', name: 'Johto', first: 152, last: 251, starters: [152, 155, 158] },
  { id: 'hoenn', name: 'Hoenn', first: 252, last: 386, starters: [252, 255, 258] },
  { id: 'sinnoh', name: 'Sinnoh', first: 387, last: 493, starters: [387, 390, 393] },
  { id: 'teselia', name: 'Teselia', first: 494, last: 649, starters: [495, 498, 501] },
  { id: 'kalos', name: 'Kalos', first: 650, last: 721, starters: [650, 653, 656] },
  { id: 'alola', name: 'Alola', first: 722, last: 809, starters: [722, 725, 728] },
  { id: 'galar', name: 'Galar', first: 810, last: 905, starters: [810, 813, 816] },
  { id: 'paldea', name: 'Paldea', first: 906, last: 1025, starters: [906, 909, 912] },
];

export function regionOf(id: number): Region | undefined {
  // T83: las formas regionales cuentan en su región (Vulpix de Alola en Alola)
  const form = regionalForm(id);
  if (form) return REGIONS.find((r) => r.id === form.region);
  return REGIONS.find((r) => id >= r.first && id <= r.last);
}

/** Minúsculas, sin tildes y con guiones como espacios, para buscar por nombre sin preocuparse de cómo se escribe. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Teclado en pantalla para buscar con ratón o mando (la búsqueda ignora tildes: Ñ cuenta como N). */
export const SEARCH_LETTERS: readonly string[] = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');

export interface CollectionEntry {
  id: number;
  name: string;
  rarity: Rarity;
  /** Tipos (de species-index.json); sin ellos, el filtro por tipo no lo deja pasar. */
  types?: readonly string[];
}

export interface CollectionFilter {
  /** Id de la región, o null para todas. */
  region?: string | null;
  /** Rareza, o null para todas. */
  rarity?: Rarity | null;
  /** Texto que tiene que aparecer en el nombre. */
  query?: string;
  /** Tipo ("fire"…), o null para todos. */
  type?: string | null;
}

/** Colección filtrada y ordenada por número de Pokédex (cada forma regional detrás de su especie). */
export function filterCollection<T extends CollectionEntry>(entries: readonly T[], f: CollectionFilter = {}): T[] {
  const q = normalizeText(f.query ?? '');
  const region = f.region ? REGIONS.find((r) => r.id === f.region) : undefined;
  return entries
    .filter((e) => !region || regionOf(e.id) === region)
    .filter((e) => !f.rarity || e.rarity === f.rarity)
    .filter((e) => !f.type || (e.types ?? []).includes(f.type))
    .filter((e) => q === '' || normalizeText(e.name).includes(q))
    // Las formas regionales van justo detrás de su especie normal
    .sort((a, b) => (regionalForm(a.id)?.baseId ?? a.id) - (regionalForm(b.id)?.baseId ?? b.id) || a.id - b.id);
}

/** Cuántos tienes de cada región (para las pestañas). */
export function countByRegion(entries: readonly { id: number }[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(REGIONS.map((r) => [r.id, 0]));
  for (const e of entries) {
    const r = regionOf(e.id);
    if (r) out[r.id]++;
  }
  return out;
}
