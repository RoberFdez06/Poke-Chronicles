// Frases con teclas y botones incrustados (sin Phaser, así se prueba con node --test): parte un texto en trozos de
// texto y glifos («key:Q», «pad:LB», «mouse:left»…). Los glifos los dibuja src/ui/art/keyGlyphs.ts.
//
// Dos formas de marcar una tecla:
//  - Explícita: entre llaves, «{Q}», «{pad:A}», «{mouse:right}». Sin prefijo, «{A}» es botón del mando si se juega
//    con mando y tecla en el resto.
//  - Automática (auto = true): se reconocen los nombres de teclas, botones y clics del dispositivo activo.

export type GlyphDevice = 'keyboard' | 'mouse' | 'gamepad' | 'touch';
export type GlyphToken = { t: 'text'; s: string } | { t: 'glyph'; name: string };

/** Botones del mando que se reconocen por su nombre. */
export const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'L3', 'R3', 'Start', 'Select'] as const;
/** Teclas con nombre (las de keyLabel de keybinds.ts). */
export const KEY_WORDS = ['Enter', 'Esc', 'Espacio', 'Tab', 'Retroceso', 'Mayús', 'Ctrl', 'Alt', 'Supr', 'Inicio', 'Fin'];

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}_]/u.test(c);

interface Rule {
  re: RegExp;
  /** Nombre del glifo (o null: no es glifo aquí). */
  glyph: (m: RegExpExecArray) => string | null;
  /** true: el glifo sustituye a la palabra; false: va delante y la palabra se queda. */
  replace: boolean;
}

const padRules: Rule[] = [
  { re: /\b(LB|RB|LT|RT|L3|R3|Start|Select)\b/y, glyph: (m) => `pad:${m[1]}`, replace: true },
  { re: /([ABXY])(?![\p{L}\p{N}])/uy, glyph: (m) => `pad:${m[1]}`, replace: true },
  { re: /[Cc]ruceta arriba(?!\/)/y, glyph: () => 'pad:dpad-up', replace: true },
  { re: /[Cc]ruceta abajo/y, glyph: () => 'pad:dpad-down', replace: true },
  { re: /[Cc]ruceta/y, glyph: () => 'pad:dpad', replace: true },
  { re: /(?:[Ss]tick|[Pp]alanca) (?:izquierd[oa]|izq\.)/y, glyph: () => 'pad:stickL', replace: true },
  { re: /(?:[Ss]tick|[Pp]alanca) (?:derech[oa]|der\.)/y, glyph: () => 'pad:stickR', replace: true },
];

const keyRules: Rule[] = [
  { re: new RegExp(`(${KEY_WORDS.join('|')})(?![\\p{L}\\p{N}])`, 'uy'), glyph: (m) => `key:${m[1]}`, replace: true },
  { re: /Num (\d)(?![\p{L}\p{N}])/uy, glyph: (m) => `key:Num ${m[1]}`, replace: true },
  { re: /[Ff]lechas(?![\p{L}])/uy, glyph: () => 'key:arrows', replace: true },
  { re: /([←→↑↓])/y, glyph: (m) => `key:${m[1]}`, replace: true },
  // Letra o cifra suelta («Q», «1»), pero no «0,8 s» ni «x1»
  { re: /([A-ZÑ0-9])(?![\p{L}\p{N}])(?![.,]\d)/uy, glyph: (m) => `key:${m[1]}`, replace: true },
  // Signos sueltos que son teclas en la lista de teclas configurables
  { re: /(?<=^|\s)([,.\-+`´ºÇ])(?=\s|$)/y, glyph: (m) => `key:${m[1]}`, replace: true },
];

const mouseRules: Rule[] = [
  { re: /[Cc]lic izquierdo/y, glyph: () => 'mouse:left', replace: false },
  { re: /[Cc]lic derecho/y, glyph: () => 'mouse:right', replace: false },
  { re: /[Cc]lic central/y, glyph: () => 'mouse:middle', replace: false },
  { re: /[Bb]otón lateral/y, glyph: () => 'mouse:side', replace: false },
  { re: /[Rr]ueda(?: del ratón)?/y, glyph: () => 'mouse:middle', replace: false },
  { re: /[Cc]lic/y, glyph: () => 'mouse:left', replace: false },
  { re: /[Mm]ueve el ratón/y, glyph: () => 'mouse:move', replace: false },
];

const touchRules: Rule[] = [{ re: /[Tt]oca/y, glyph: () => 'touch:tap', replace: false }];

function rulesFor(d: GlyphDevice): Rule[] {
  if (d === 'gamepad') return padRules;
  if (d === 'touch') return touchRules;
  // En PC el teclado y el ratón van juntos
  return [...mouseRules, ...keyRules];
}

/** Nombre del glifo de una marca explícita «{…}». */
export function explicitGlyph(inner: string, d: GlyphDevice): string {
  if (/^(key|pad|mouse|touch):/.test(inner)) return inner;
  if (d === 'gamepad' && (PAD_NAMES as readonly string[]).includes(inner)) return `pad:${inner}`;
  if (inner === 'Cruceta') return 'pad:dpad';
  return `key:${inner}`;
}

/** Parte `text` en trozos de texto y glifos para el dispositivo `d`. */
export function tokenizeGlyphs(text: string, d: GlyphDevice, auto = true): GlyphToken[] {
  const out: GlyphToken[] = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push({ t: 'text', s: buf });
    buf = '';
  };
  const rules = auto ? rulesFor(d) : [];
  let i = 0;
  outer: while (i < text.length) {
    const c = text[i];
    if (c === '{') {
      const end = text.indexOf('}', i);
      if (end > i + 1) {
        flush();
        out.push({ t: 'glyph', name: explicitGlyph(text.slice(i + 1, end), d) });
        i = end + 1;
        continue;
      }
    }
    // Las reglas solo empiezan en comienzo de palabra
    const inNumber = /[.,]/.test(text[i - 1] ?? '') && /\d/.test(text[i - 2] ?? '');
    if (!isWordChar(text[i - 1]) && !inNumber) {
      for (const r of rules) {
        r.re.lastIndex = i;
        const m = r.re.exec(text);
        if (!m || m[0].length === 0) continue;
        const g = r.glyph(m);
        if (!g) continue;
        flush();
        out.push({ t: 'glyph', name: g });
        if (r.replace) i += m[0].length;
        else {
          buf = m[0];
          i += m[0].length;
        }
        continue outer;
      }
    }
    buf += c;
    i++;
  }
  flush();
  return out;
}
