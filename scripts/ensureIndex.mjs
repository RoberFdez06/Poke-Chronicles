// Antes de `npm run dev` / `build`: si falta public/data/species-index.json, lo genera desde PokeAPI.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (existsSync('public/data/species-index.json')) process.exit(0);
console.log('Generando la lista de especies para el gacha (solo la primera vez, necesita internet)…');
const r = spawnSync(process.execPath, ['scripts/buildSpeciesIndex.mjs'], { stdio: 'inherit' });
if (r.status !== 0) console.warn('No se pudo generar. El resto del juego funciona; el gacha avisará. Reintenta con: node scripts/buildSpeciesIndex.mjs');
process.exit(0);
