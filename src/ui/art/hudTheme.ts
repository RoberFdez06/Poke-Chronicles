// Temas del HUD por bioma (lógica pura, sin Phaser; se prueba con node --test).
//
// Cada bioma tiene su paleta para los laterales (fondo y textura), los paneles (relleno, borde y acento), el marco del
// minimapa y un motivo en pixel art (hojas, cristales, olas, grietas de lava…). Los paneles siempre van oscuros y el
// texto claro: tests/hudTheme.test.ts comprueba que el contraste se mantiene en todos.

export type HudMotif = 'leaf' | 'crystal' | 'wave' | 'lava' | 'brick' | 'city' | 'snow' | 'swamp' | 'cloud' | 'sand';

export interface HudTheme {
  id: string;
  /** Fondo de los laterales y su textura (más clara u oscura). */
  bg: number;
  bg2: number;
  /** Relleno de los paneles (oscuro: encima va texto claro) y su borde interior. */
  panel: number;
  edge: number;
  /** Acento (marco dorado de siempre, pero del bioma) y su brillo. */
  accent: number;
  accentHi: number;
  /** Motivo pixel art que se reparte por los laterales y sus colores (0: principal, 1: sombra, 2: brillo). */
  motif: HudMotif;
  motifCols: [number, number, number];
  /** Fondo del minimapa: casillas sin explorar y niebla. */
  fog: number;
}

/** Texto claro que va encima de los paneles (el de siempre). */
export const HUD_TEXT = 0xf8f8f8;

const T = (id: string, t: Omit<HudTheme, 'id'>): HudTheme => ({ id, ...t });

export const HUD_THEMES: Readonly<Record<string, HudTheme>> = {
  bosque: T('bosque', { bg: 0x16301c, bg2: 0x1d3c22, panel: 0x122216, edge: 0x3f6b3a, accent: 0x8cc84b, accentHi: 0xd4f08a, motif: 'leaf', motifCols: [0x4f8f3a, 0x2c5a26, 0x9fd66a], fog: 0x0d1a10 }),
  cueva: T('cueva', { bg: 0x2a2018, bg2: 0x33271c, panel: 0x1e1712, edge: 0x6a5238, accent: 0xc9a46a, accentHi: 0xf0d79a, motif: 'crystal', motifCols: [0x9a7cff, 0x5a3fae, 0xe0d4ff], fog: 0x150f0a }),
  mar: T('mar', { bg: 0x0f2a44, bg2: 0x123352, panel: 0x0c1e34, edge: 0x2f6a9a, accent: 0x5fc6e8, accentHi: 0xc8f2ff, motif: 'wave', motifCols: [0x3a8cc8, 0x1d5486, 0xbfeaff], fog: 0x081726 }),
  volcan: T('volcan', { bg: 0x2a1210, bg2: 0x361614, panel: 0x1e0d0c, edge: 0x7a2e1c, accent: 0xff7a2a, accentHi: 0xffd34d, motif: 'lava', motifCols: [0xff6a1a, 0x8a1e0e, 0xffd34d], fog: 0x170807 }),
  torre: T('torre', { bg: 0x241a34, bg2: 0x2c2040, panel: 0x1a1326, edge: 0x5a4580, accent: 0xb58cf0, accentHi: 0xe8d6ff, motif: 'brick', motifCols: [0x4a3a66, 0x2e2244, 0x7a68a0], fog: 0x120c1c }),
  ciudad: T('ciudad', { bg: 0x1c2230, bg2: 0x242b3c, panel: 0x141a26, edge: 0x4a5670, accent: 0xf0c040, accentHi: 0xfff0a0, motif: 'city', motifCols: [0x3a4458, 0x262e3e, 0xffe08a], fog: 0x0e121a }),
  nieve: T('nieve', { bg: 0x1e3550, bg2: 0x26405e, panel: 0x14263c, edge: 0x6a9ac8, accent: 0xbfe6ff, accentHi: 0xffffff, motif: 'snow', motifCols: [0xe8f6ff, 0x8ab8e0, 0xffffff], fog: 0x0f1d2e }),
  pantano: T('pantano', { bg: 0x1e2a1a, bg2: 0x26331f, panel: 0x151e12, edge: 0x5a6a34, accent: 0xb0c050, accentHi: 0xe4f08a, motif: 'swamp', motifCols: [0x6a8a3a, 0x3a4a22, 0xc8e070], fog: 0x0e150c }),
  cumbre: T('cumbre', { bg: 0x2a3048, bg2: 0x323a56, panel: 0x1c2136, edge: 0x6a78a8, accent: 0xe8eefc, accentHi: 0xffffff, motif: 'cloud', motifCols: [0xdfe6f6, 0x9aa6c8, 0xffffff], fog: 0x141828 }),
  desierto: T('desierto', { bg: 0x3a2a14, bg2: 0x46331a, panel: 0x261b0e, edge: 0x8a6a34, accent: 0xe8b84a, accentHi: 0xffe08a, motif: 'sand', motifCols: [0x4f8a3a, 0x2c5a26, 0xe8c87a], fog: 0x1e150a }),
};

/** El de siempre (azul), para lo que no tiene bioma. */
export const DEFAULT_HUD_THEME: HudTheme = T('default', { bg: 0x172036, bg2: 0x1b2640, panel: 0x18213a, edge: 0x3a4a7a, accent: 0xd4a017, accentHi: 0xffd34d, motif: 'brick', motifCols: [0x26304e, 0x141c30, 0x3a4a7a], fog: 0x101828 });

export function hudThemeFor(biomeId: string | undefined): HudTheme {
  return (biomeId && HUD_THEMES[biomeId]) || DEFAULT_HUD_THEME;
}

/** Luminancia relativa (WCAG) de un color 0xRRGGBB. */
export function luminance(c: number): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch((c >> 16) & 255) + 0.7152 * ch((c >> 8) & 255) + 0.0722 * ch(c & 255);
}

/** Contraste WCAG entre dos colores (1 a 21). */
export function contrast(a: number, b: number): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Mezcla dos colores (t = 0 → a, 1 → b). */
export function mix(a: number, b: number, t: number): number {
  const m = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t) << s;
  return m(16) | m(8) | m(0);
}

/** Motivos 8×8 ('a' principal, 'b' sombra, 'c' brillo, '.' vacío). */
export const MOTIFS: Readonly<Record<HudMotif, readonly string[]>> = {
  leaf: ['....ca..', '...caab.', '..caaab.', '.caaab..', '.aaab...', '.aab....', 'bb......', 'b.......'],
  crystal: ['...c....', '..cab...', '..cab...', '.ccaab..', '.caaab..', 'cab.cab.', 'cab.cab.', 'bbb.bbb.'],
  wave: ['........', '..cc....', '.caab...', 'caab.c..', 'ab..cab.', '....aab.', 'bbbbbbbb', '........'],
  lava: ['b.......', '.b...b..', '..bab...', '..aca...', '.bab.b..', '.b....b.', 'b.....b.', '........'],
  brick: ['aaab.aaa', 'aaab.aaa', 'bbbbbbbb', 'a.aaab.a', 'a.aaab.a', 'bbbbbbbb', '........', '........'],
  city: ['.aa.....', '.ac.aaa.', '.aa.aca.', '.ac.aaa.', '.aa.aca.', 'aaaaaaa.', 'bbbbbbb.', '........'],
  snow: ['...c....', '.c.a.c..', '..aaa...', 'caacaac.', '..aaa...', '.c.a.c..', '...c....', '........'],
  swamp: ['........', '..c.....', '.cab..c.', '.ab..cb.', '..b..ab.', '..b...b.', 'bbbbbbbb', '.aaaaaa.'],
  cloud: ['........', '...cc...', '.ccaac..', 'caaaaac.', 'aaaaaaab', '.bbbbbb.', '........', '........'],
  sand: ['...a....', '.a.a....', '.aaa.a..', '...aaa..', '...a....', '...a....', 'cccccccc', '........'],
};
