// Genera public/aviso-legal.html y public/privacidad.html a partir de src/data/legal.ts.
// Uso: node scripts/genLegal.ts
import { writeFileSync } from 'node:fs';
import { LEGAL_DOCS, renderDocHtml } from '../src/data/legal.ts';

for (const d of LEGAL_DOCS) writeFileSync(new URL(`../public/${d.file}`, import.meta.url), renderDocHtml(d));
console.log('Páginas legales generadas.');
