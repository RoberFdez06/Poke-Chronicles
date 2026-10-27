// Textos flotantes sobre el juego (sin Phaser, así se prueba con node --test): qué es cada aviso y cómo se enseña
// según el ajuste «Textos en pantalla» (Completos / Reducidos / Mínimos).
import type { TextsLevel } from './fxSettings.ts';

export type FloatIcon = 'heart' | 'heartMax' | 'coin' | 'key' | 'potion' | 'bomb' | 'ticket' | 'star' | 'shield' | 'spark';

export type FloatKind =
  /** Una cifra con su icono: «+12 PS», «−3 monedas», «+1 llave». */
  | { kind: 'number'; sign: '+' | '-'; amount: number; icon: FloatIcon | null; note: string }
  /** Una palabra o frase («¡Parry!», «Quemado», «¡Shiny!»). */
  | { kind: 'label'; text: string; icon: FloatIcon | null };

const UNIT_ICON: [RegExp, FloatIcon][] = [
  [/^PS máx/, 'heartMax'],
  [/^PS/, 'heart'],
  [/^monedas?/, 'coin'],
  [/^llaves?/, 'key'],
  [/^poci[oó]n(es)?/, 'potion'],
  [/^bombas?/, 'bomb'],
  [/^tickets?/, 'ticket'],
];

const LABEL_ICON: [RegExp, FloatIcon][] = [
  [/escudo|inmune/i, 'shield'],
  [/parry|esquivado|shiny|combo|ataque x|daño ×2/i, 'star'],
];

/** Lee un aviso flotante. `goldNumber`: una cifra sin unidad en dorado son monedas. */
export function classifyFloat(text: string, goldNumber = false): FloatKind {
  const m = /([+\-−])\s?(\d+)\s*(.*)$/.exec(text);
  if (m && !text.includes('\n')) {
    const rest = m[3].trim();
    let icon: FloatIcon | null = null;
    for (const [re, ic] of UNIT_ICON) if (re.test(rest)) icon = ic;
    if (!icon && !rest && goldNumber) icon = 'coin';
    // Lo que va delante («Baya Aranja», «Poción») y lo de después entre paréntesis («(lava)») es la nota
    const before = text.slice(0, m.index).trim();
    const after = rest.replace(/^(PS máx\.?|PS|monedas?|llaves?|poci[oó]n(es)?|bombas?|tickets?)/, '').trim();
    return { kind: 'number', sign: m[1] === '+' ? '+' : '-', amount: Number(m[2]), icon, note: [before, after].filter(Boolean).join(' ') };
  }
  let icon: FloatIcon | null = null;
  for (const [re, ic] of LABEL_ICON) if (re.test(text)) icon = ic;
  return { kind: 'label', text, icon };
}

export interface FloatPlan {
  show: boolean;
  /** Texto que acompaña al icono (vacío: solo icono y cifra). */
  text: string;
  icon: FloatIcon | null;
  /** Tamaño de letra y si sube (completos) o se queda quieto (reducidos). */
  size: number;
  rise: boolean;
}

/** Cómo se enseña un aviso con el nivel de textos elegido. */
export function planFloat(k: FloatKind, level: TextsLevel): FloatPlan {
  if (k.kind === 'number') {
    const n = `${k.sign === '+' ? '+' : '−'}${k.amount}`;
    if (level === 'full') return { show: true, text: `${n}${k.note ? ` ${k.note}` : ''}`, icon: k.icon, size: 16, rise: true };
    // Mínimos: solo lo que cambia tu vida (lo demás ya lo cuentan los contadores del HUD)
    if (level === 'minimal' && k.icon !== 'heart' && k.icon !== 'heartMax') return { show: false, text: '', icon: null, size: 0, rise: false };
    return { show: true, text: n, icon: k.icon, size: 14, rise: level === 'reduced' };
  }
  if (level === 'full') return { show: true, text: k.text, icon: k.icon, size: 16, rise: true };
  if (level === 'minimal') return { show: !!k.icon, text: '', icon: k.icon, size: 12, rise: false };
  return { show: true, text: k.text.replace(/^¡|!$/g, ''), icon: k.icon, size: 12, rise: false };
}
