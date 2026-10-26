// Lista de especies generada por scripts/buildSpeciesIndex.mjs (public/data/species-index.json).
// Se carga una sola vez y se comparte entre el gacha, los jefes y los enemigos.
import type { SpeciesFact } from './gacha';
import { withRegionalForms } from './regionalForms';

let cached: Promise<SpeciesFact[]> | null = null;

export function loadSpeciesIndex(): Promise<SpeciesFact[]> {
  cached ??= (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}data/species-index.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const index = (await res.json()) as SpeciesFact[];
    if (!Array.isArray(index) || index.length === 0) throw new Error('lista vacía');
    return index.filter(Boolean);
  })().catch((err) => {
    cached = null; // se podrá reintentar
    throw err;
  });
  return cached;
}

/** T83: la lista de especies más las formas regionales (Pokédex, gacha, colección y nombres). Los enemigos usan la normal. */
export async function loadCollectionIndex(): Promise<SpeciesFact[]> {
  return withRegionalForms(await loadSpeciesIndex());
}
