// Consola de pruebas de ataques (auditoría 01/11): crea el poder de un estilo del catálogo o la fusión de dos tipos
// para lanzarlos uno a uno desde window.__POKEISAAC_DEBUG__ (castStyle / castFusion / listStyles). Lógica pura.
import { normName, TYPE_STYLES } from './movePatterns.ts';
import { fusePowers, FUSION_TYPES } from './fusion.ts';
import { toMovePower, type MovePower } from './items.ts';
import { typeNameEs } from './types.ts';

/** Acepta el tipo en inglés (fire) o en español (Fuego). */
export function resolveType(t: string): string | null {
  const n = normName(t ?? '');
  return FUSION_TYPES.find((x) => x === n || normName(typeNameEs(x)) === n) ?? null;
}

/** Poder de prueba con ese estilo (o un texto de error en español). */
export function debugStyleMove(tipo: string, estilo: string): MovePower | string {
  const t = resolveType(tipo);
  if (!t) return `Tipo desconocido: ${tipo}. Usa uno de: ${FUSION_TYPES.join(', ')}.`;
  const st = TYPE_STYLES[t].find((s) => normName(s.id) === normName(estilo ?? ''));
  if (!st) return `«${estilo}» no es un estilo de ${typeNameEs(t)}. Estilos: ${TYPE_STYLES[t].map((s) => s.id).join(', ')}.`;
  return toMovePower({ id: 95000 + FUSION_TYPES.indexOf(t) * 20 + TYPE_STYLES[t].indexOf(st), name: st.id, type: t, power: 80 });
}

/** Fusión de prueba de dos tipos (con su primer estilo de cada uno). */
export function debugFusionMove(a: string, b: string): MovePower | string {
  const ta = resolveType(a);
  const tb = resolveType(b);
  if (!ta || !tb) return `Tipos desconocidos: ${a} / ${b}.`;
  const ma = debugStyleMove(ta, TYPE_STYLES[ta][0].id) as MovePower;
  const mb = toMovePower({ id: 96000 + FUSION_TYPES.indexOf(tb), name: TYPE_STYLES[tb][0].id, type: tb, power: 79 });
  return fusePowers(ma, mb);
}

/** Lista de estilos «tipo: estilo, estilo…». */
export function debugStyleList(tipo?: string): string {
  const types = tipo ? [resolveType(tipo)].filter((x): x is string => !!x) : FUSION_TYPES;
  return types.map((t) => `${t}: ${TYPE_STYLES[t].map((s) => s.id).join(', ')}`).join('\n');
}
