// Defensa de torres: AVISO PREVIO de emparejamiento. Antes de empezar un nivel temático, compara los tipos de las
// torres elegidas con el tipo tema y con los enemigos que de verdad salen (los del tema y los contra-tipos) y da un
// veredicto: Bien / Justo / Arriesgado, con el motivo y los tipos que sí funcionan. No bloquea nada. Lógica pura.
import { tdTypeMul } from './towers.ts';
import { tdTypesOf } from './species.ts';
import { ALL_TYPES, THEME_FOES, contraFoes, counterTypes, themeBoost, levelTheme } from './themes.ts';
import type { TdMap } from './maps.ts';
import { typeNameEs } from '../types.ts';

export type Verdict = 'bien' | 'justo' | 'arriesgado';
export const VERDICT_LABEL: Readonly<Record<Verdict, string>> = { bien: 'Bien', justo: 'Justo', arriesgado: 'Arriesgado' };

/** Por debajo de esta potencia media el equipo es «Arriesgado»; por debajo de JUSTO, «Justo»; si no, «Bien». */
export const RISKY_BELOW = 0.95;
export const FAIR_BELOW = 1.1;

export interface MatchupWarning {
  verdict: Verdict;
  /** Tipo tema del nivel. */
  theme: string;
  /** Potencia media del equipo (daño relativo contra los enemigos del nivel, con el bonus del tema). */
  score: number;
  /** Tipos del equipo que hacen poco daño a los enemigos del nivel (peor que ×0,9). */
  weakTypes: string[];
  /** Tipos que sí funcionan (Ventaja y los que potencian el tema) que el equipo aún no lleva. */
  suggest: string[];
  /** Motivo en español (una frase). */
  reason: string;
  /** Sugerencia en español (una frase; vacía si no hace falta). */
  tip: string;
}

const list = (ts: readonly string[]) => (ts.length <= 1 ? ts.map(typeNameEs).join('') : `${ts.slice(0, -1).map(typeNameEs).join(', ')} y ${typeNameEs(ts[ts.length - 1])}`);
const listO = (ts: readonly string[]) => (ts.length <= 1 ? ts.map(typeNameEs).join('') : `${ts.slice(0, -1).map(typeNameEs).join(', ')} o ${typeNameEs(ts[ts.length - 1])}`);

/** Enemigos del nivel con su peso: los del tema siempre; los contra-tipos pesan más según avanza el nivel. */
function foePool(theme: string, level: number): { types: readonly string[]; w: number }[] {
  const f = THEME_FOES[theme] ?? THEME_FOES.normal;
  const themeIds = [...new Set([...f.ground, ...f.air, ...f.big])];
  const c = contraFoes(theme);
  const contraIds = [...new Set([...c.ground, ...c.air, ...c.big])];
  // Cuota de contra-tipos: ~10 % al empezar, hasta ~45 % en los niveles altos (llegan en la segunda mitad de cada nivel)
  const share = 0.1 + 0.35 * Math.min(1, Math.max(0, level - 1) / 8);
  const out: { types: readonly string[]; w: number }[] = [];
  for (const id of themeIds) out.push({ types: tdTypesOf(id), w: (1 - share) / themeIds.length });
  for (const id of contraIds) out.push({ types: tdTypesOf(id), w: share / contraIds.length });
  return out;
}

/** Potencia de una torre (por sus tipos) contra el nivel: el mejor tipo de cada torre contra cada enemigo, con bonus. */
export function towerPower(theme: string, level: number, towerTypes: readonly string[]): number {
  const b = themeBoost(theme, towerTypes);
  let sum = 0;
  for (const foe of foePool(theme, level)) {
    let best = 0;
    for (const t of towerTypes) best = Math.max(best, tdTypeMul(t, foe.types));
    sum += best * foe.w;
  }
  return sum * b.damage;
}

/** Los niveles bajos perdonan más: el umbral sube de 0,8 a 1 del nivel 1 al 6. */
const forgive = (level: number) => 0.8 + 0.2 * Math.min(1, Math.max(0, level - 1) / 5);

/** Veredicto de un equipo (lista de tipos de cada torre) en un nivel de tipo tema. Sin torres: «Justo» sin motivo de queja. */
export function matchupWarning(theme: string, level: number, team: readonly (readonly string[])[]): MatchupWarning {
  const sug = ALL_TYPES.filter((t) => t === theme || counterTypes(theme).includes(t))
    .sort((a, b) => towerPower(theme, level, [b]) - towerPower(theme, level, [a]) || ALL_TYPES.indexOf(a) - ALL_TYPES.indexOf(b));
  const have = new Set(team.flat());
  const suggestMissing = sug.filter((t) => !have.has(t)).slice(0, 4);
  if (!team.length) {
    return { verdict: 'justo', theme, score: 0, weakTypes: [], suggest: suggestMissing,
      reason: `Aún no has elegido torres para el nivel ${typeNameEs(theme)}.`, tip: `Lleva ${listO(suggestMissing)}.` };
  }
  // Mitad media del equipo, mitad media de su mejor mitad: con unas pocas torres adecuadas ya se aguanta
  const pw = team.map((t) => towerPower(theme, level, t)).sort((a, b) => b - a);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const score = 0.5 * mean(pw) + 0.5 * mean(pw.slice(0, Math.ceil(pw.length / 2)));
  const need = forgive(level);
  const verdict: Verdict = score < RISKY_BELOW * need ? 'arriesgado' : score < FAIR_BELOW * need ? 'justo' : 'bien';
  const weakTypes = [...new Set(team.filter((t) => towerPower(theme, level, t) < 0.9).flat())]
    .filter((t) => themeBoost(theme, [t]).kind === null);
  const weakOnly = weakTypes.filter((t) => team.every((tw) => !tw.includes(t) || towerPower(theme, level, tw) < 0.9));
  const names = weakOnly.length ? weakOnly : weakTypes;
  let reason: string;
  if (verdict === 'bien') reason = `Tu equipo se lleva bien con el nivel ${typeNameEs(theme)}.`;
  else if (names.length) reason = `Tu equipo hace poco daño a ${typeNameEs(theme)}: ${list(names)}.`;
  else reason = `Tu equipo no saca ventaja en el nivel ${typeNameEs(theme)}.`;
  const tip = verdict === 'bien' || !suggestMissing.length ? '' : `Lleva ${listO(suggestMissing)}.`;
  return { verdict, theme, score, weakTypes: names, suggest: suggestMissing, reason, tip };
}

/** Atajo con el mapa y el nivel (0 = infinito, como en `levelTheme`). */
export function matchupForLevel(m: Pick<TdMap, 'id' | 'levels'>, level: number, team: readonly (readonly string[])[]): MatchupWarning {
  return matchupWarning(levelTheme(m, level), level <= 0 ? m.levels : level, team);
}

/** Pista para la ficha del nivel: «Lleva Agua, Tierra, Planta o Acero para el nivel Roca» (los 4 tipos que mejor funcionan). */
export function levelHint(theme: string, level = 8): string {
  const rec = matchupWarning(theme, level, []).suggest;
  return `Lleva ${listO(rec)} para el nivel ${typeNameEs(theme)}`;
}
