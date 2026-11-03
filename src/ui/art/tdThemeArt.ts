// Arte de los niveles temáticos de la Defensa de torres (todo pixel art propio, sin emojis): insignia de cada tipo
// (los 18), suelo teñido con marcas del tipo, terreno propio de cada tipo (lava, charca, niebla de almas, placa de
// acero…), obstáculos acordes (lápidas, bloques de hielo, rocas de magma, cristales…) y ambiente animado (almas y
// niebla, brasas, copos, burbujas, chispas, hojas…). Colores de TYPE_COLORS y TYPE_FX. Con pocos efectos (lowFx)
// queda quieto. Solo dibujo: la lógica es src/data/towerDefense/themes.ts y variants.ts.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { darkOf, lightOf, mixColor } from './pixelFx';
import { TYPE_FX } from './typeFx';
import { typeColor } from '../../data/types';
import type { MapGeom } from './tdArt';
import type { Cell } from '../../data/towerDefense/maps';
import type { TerrainCell } from '../../data/towerDefense/variants';

type G = Phaser.GameObjects.Graphics;
const OUT = 0x18202c;
const P = 3;
const snap = (v: number) => Math.round(v / P) * P;
const px = (g: G, c: number, x: number, y: number, w = P, h = P, a = 1) => g.fillStyle(c, a).fillRect(snap(x), snap(y), w, h);

/** Símbolo de cada tipo (7x7): W claro, D sombra. */
export const TYPE_GLYPH: Readonly<Record<string, readonly string[]>> = {
  normal: ['..WWW..', '.W...W.', 'W.....W', 'W..D..W', 'W.....W', '.W...W.', '..WWW..'],
  fire: ['...W...', '..WW...', '..WWW.W', '.WWDWW.', 'WWDDDWW', 'WWDDDWW', '.WWWWW.'],
  water: ['...W...', '..WWW..', '.WWWWW.', '.WDWWW.', 'WWDWWWW', 'WWWWWWW', '.WWWWW.'],
  electric: ['....WW.', '...WW..', '..WW...', '.WWWWW.', '...WW..', '..WW...', '.WW....'],
  grass: ['....WWW', '..WWWWW', '.WWWDWW', '.WWDWW.', 'WWDWW..', 'WDWW...', 'D......'],
  ice: ['...W...', '.W.W.W.', '..WWW..', 'WWWDWWW', '..WWW..', '.W.W.W.', '...W...'],
  fighting: ['.WWWW..', 'WWWWWW.', 'WDWDWDW', 'WWWWWWW', 'WWWWWW.', '.WWWW..', '.WWW...'],
  poison: ['..WWW..', '.WWWWW.', 'WDDWDDW', 'WDDWDDW', 'WWWDWWW', '.WWWWW.', '.W.W.W.'],
  ground: ['.......', '...W...', '..WWW..', '.WWDWW.', '.WDWWW.', 'WWWDWWW', 'WWWWWWW'],
  flying: ['W......', 'WW.....', 'WWW....', 'WWWWW..', '.WWWWWW', '..WWWDD', '....WWW'],
  psychic: ['..WWW..', '.W...W.', 'W.WWW.W', 'W.W.W.W', 'W.W..W.', '.W.WW..', '..W....'],
  bug: ['W.....W', '.W...W.', '..WWW..', '.WWDWW.', 'WWWDWWW', '.WWDWW.', 'W.WWW.W'],
  rock: ['.......', '..WWW..', '.WWWWW.', 'WWDWWWW', 'WDWWWDW', 'WWWWWWW', '.WWWWW.'],
  ghost: ['..WWW..', '.WWWWW.', '.WDWDW.', 'WWWWWWW', 'WWWWWWW', 'WWWWWWW', 'W.W.W.W'],
  dragon: ['W.....W', 'WW...WW', '.WWWWW.', '.WDWDW.', '.WWWWW.', '..WWW..', '..W.W..'],
  dark: ['..WWWW.', '.WWW...', 'WWW....', 'WWW....', 'WWW....', '.WWW...', '..WWWW.'],
  steel: ['..WWW..', '.WWWWW.', 'WWW.WWW', 'WW...WW', 'WWW.WWW', '.WWWWW.', '..WWW..'],
  fairy: ['...W...', '...W...', '.WWWWW.', 'WWWDWWW', '.WWWWW.', '..W.W..', '.W...W.'],
};

const lum = (c: number) => (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255;
/** Colores del símbolo sobre el color del tipo (oscuro sobre los tipos claros, para que se lea). */
function glyphColors(type: string): { fill: number; w: number; d: number } {
  const fill = typeColor(type);
  return lum(fill) > 0.62 ? { fill, w: 0x2b3a67, d: darkOf(fill) } : { fill, w: 0xffffff, d: lightOf(darkOf(fill)) };
}

export const typeIconKey = (type: string) => `td-type-${type}`;

/** Insignias 11x11 de los 18 tipos (una vez por escena). */
export function bakeTypeIcons(scene: Phaser.Scene) {
  for (const [type, rows] of Object.entries(TYPE_GLYPH)) {
    const key = typeIconKey(type);
    if (scene.textures.exists(key)) continue;
    const { fill, w, d } = glyphColors(type);
    const g = scene.make.graphics({}, false);
    const dot = (c: number, x: number, y: number) => g.fillStyle(c, 1).fillRect(x, y, 1, 1);
    for (let x = 2; x <= 8; x++) {
      dot(OUT, x, 0);
      dot(OUT, x, 10);
    }
    for (let y = 2; y <= 8; y++) {
      dot(OUT, 0, y);
      dot(OUT, 10, y);
    }
    for (const [x, y] of [[1, 1], [9, 1], [1, 9], [9, 9]]) dot(OUT, x, y);
    for (let y = 1; y <= 9; y++) for (let x = 1; x <= 9; x++) if (!((x === 1 || x === 9) && (y === 1 || y === 9))) dot(fill, x, y);
    for (let x = 2; x <= 8; x++) dot(lightOf(fill), x, 1);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] !== '.') dot(row[x] === 'W' ? w : d, x + 2, y + 2);
    });
    g.generateTexture(key, 11, 11);
    g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

/** Insignia del tipo como imagen escalada sin suavizar. */
export const typeIcon = (scene: Phaser.Scene, x: number, y: number, type: string, scale = 2) =>
  scene.add.image(x, y, typeIconKey(TYPE_GLYPH[type] ? type : 'normal')).setScale(scale);

/** Símbolo del tipo pintado en un Graphics (en el terreno), con píxel `u`. */
function drawGlyph(g: G, type: string, x: number, y: number, u: number, a = 1) {
  const rows = TYPE_GLYPH[type] ?? TYPE_GLYPH.normal;
  const { w, d } = glyphColors(type);
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] !== '.') g.fillStyle(row[i] === 'W' ? w : d, a).fillRect(x + i * u, y + j * u, u, u);
  });
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fxColors = (type: string) => (TYPE_FX[type] ?? TYPE_FX.normal).colors;

// --- Suelo ---

/** Marca de suelo de cada tipo (en las casillas libres, 1 de cada 3 más o menos). */
type Mark = 'grieta' | 'charco' | 'mata' | 'motas' | 'remache' | 'flor' | 'escarcha' | 'pluma' | 'ceniza' | 'runa' | 'seda' | 'guijarro' | 'huella' | 'escama' | 'chispa';
const GROUND_MARK: Readonly<Record<string, Mark>> = {
  normal: 'huella', fire: 'ceniza', water: 'charco', electric: 'chispa', grass: 'mata', ice: 'escarcha', fighting: 'huella',
  poison: 'charco', ground: 'grieta', flying: 'pluma', psychic: 'runa', bug: 'seda', rock: 'guijarro', ghost: 'motas',
  dragon: 'escama', dark: 'motas', steel: 'remache', fairy: 'flor',
};

/** Suelo del tipo tema (se hornea con el suelo): tinte suave del color del tipo y marcas propias. */
export function drawThemeGround(g: G, type: string, cells: readonly Cell[], geo: MapGeom, seed: number) {
  const S = geo.cell;
  const base = typeColor(type);
  const [c1, c2, c3] = fxColors(type);
  const mark = GROUND_MARK[type] ?? 'motas';
  const r = rng(seed);
  for (const q of cells) {
    const X = geo.ox + q.x * S;
    const Y = geo.oy + q.y * S;
    g.fillStyle(base, 0.13).fillRect(X, Y, S, S);
    if (r() > 0.38) continue;
    const x = X + P * (2 + Math.floor(r() * 9));
    const y = Y + P * (3 + Math.floor(r() * 9));
    switch (mark) {
      case 'grieta':
        px(g, darkOf(c2), x, y, P * 3, P);
        px(g, darkOf(c2), x + P * 2, y + P, P, P * 2);
        px(g, darkOf(c2), x - P, y - P);
        break;
      case 'charco':
        px(g, darkOf(c1), x - P, y, P * 5, P * 2, 0.7);
        px(g, c1, x, y, P * 3, P, 0.8);
        px(g, 0xffffff, x + P, y, P, P, 0.6);
        break;
      case 'mata':
        px(g, darkOf(c3), x, y, P, P * 2);
        px(g, c1, x + P, y - P, P, P * 3);
        px(g, c2, x + P * 2, y, P, P * 2);
        break;
      case 'motas':
        px(g, c1, x, y, P, P, 0.6);
        px(g, c2, x + P * 2, y + P, P, P, 0.5);
        px(g, c3, x - P, y + P * 2, P, P, 0.5);
        break;
      case 'remache':
        px(g, darkOf(c3), x - P, y - P, P * 4, P * 4, 0.5);
        px(g, c2, x, y, P * 2, P * 2);
        px(g, 0xffffff, x, y, P, P, 0.7);
        break;
      case 'flor':
        px(g, c1, x - P, y);
        px(g, c1, x + P, y);
        px(g, c1, x, y - P);
        px(g, c1, x, y + P);
        px(g, 0xffe14a, x, y);
        break;
      case 'escarcha':
        px(g, 0xffffff, x, y, P * 3, P, 0.7);
        px(g, 0xffffff, x + P, y - P, P, P * 3, 0.7);
        px(g, c3, x + P * 3, y + P * 2, P, P, 0.6);
        break;
      case 'pluma':
        px(g, 0xffffff, x, y, P * 3, P, 0.8);
        px(g, c1, x + P, y + P, P * 3, P, 0.8);
        px(g, darkOf(c1), x + P * 4, y + P);
        break;
      case 'ceniza':
        px(g, 0x3a3030, x - P, y, P * 4, P * 2, 0.6);
        px(g, c1, x + P, y, P, P);
        break;
      case 'runa':
        g.lineStyle(P, c1, 0.45).strokeRect(snap(x - P * 2), snap(y - P * 2), P * 5, P * 5);
        px(g, c2, x, y, P, P, 0.7);
        break;
      case 'seda':
        g.lineStyle(1, 0xffffff, 0.5).lineBetween(x - 8, y - 6, x + 8, y + 6).lineBetween(x + 8, y - 6, x - 8, y + 6).lineBetween(x, y - 8, x, y + 8);
        break;
      case 'guijarro':
        px(g, darkOf(c2), x, y, P * 2, P * 2);
        px(g, c3, x, y, P, P);
        px(g, darkOf(c2), x + P * 3, y + P, P, P);
        break;
      case 'huella':
        px(g, darkOf(c3), x, y, P * 2, P * 2, 0.45);
        px(g, darkOf(c3), x + P * 3, y + P * 2, P * 2, P * 2, 0.45);
        break;
      case 'escama':
        px(g, c1, x, y, P * 2, P, 0.7);
        px(g, c2, x - P, y + P, P * 2, P, 0.7);
        px(g, c1, x + P, y + P, P * 2, P, 0.7);
        break;
      case 'chispa':
        px(g, c1, x, y, P, P * 2);
        px(g, c1, x + P, y + P * 2, P, P * 2);
        px(g, 0xffffff, x, y, P, P);
        break;
    }
  }
}

// --- Terreno propio de cada tipo ---

/** Terreno temático (se hornea con el suelo): losas de torre con el símbolo del tipo o tramos del camino. */
export function drawThemeTerrain(g: G, q: TerrainCell, geo: MapGeom) {
  const S = geo.cell;
  const X = geo.ox + q.x * S;
  const Y = geo.oy + q.y * S;
  const tileType: Partial<Record<string, string>> = {
    entreno: 'normal', generador: 'electric', dojo: 'fighting', termica: 'flying', runa: 'psychic', escamas: 'dragon', penumbra: 'dark', placa: 'steel', hadas: 'fairy',
  };
  const tt = tileType[q.kind];
  if (tt) {
    // Losa con el símbolo del tipo (la penumbra, oscura y con borde rojo: es mala)
    const c = typeColor(tt);
    const bad = q.kind === 'penumbra';
    g.fillStyle(OUT, 0.55).fillRect(X + P * 2, Y + P * 3, S - P * 3, S - P * 3);
    g.fillStyle(darkOf(c), 1).fillRect(X + P, Y + P * 2, S - P * 3, S - P * 3);
    g.fillStyle(bad ? 0x2a2030 : mixColor(c, 0xffffff, 0.15), 1).fillRect(X + P * 2, Y + P * 3, S - P * 5, S - P * 5);
    g.fillStyle(bad ? 0xff5a4a : lightOf(c), 1).fillRect(X + P, Y + P * 2, S - P * 3, P);
    drawGlyph(g, tt, X + P * 4, Y + P * 5, P, bad ? 0.55 : 1);
    return;
  }
  const r = rng(q.x * 131 + q.y * 17 + q.kind.length);
  switch (q.kind) {
    case 'lava': {
      g.fillStyle(0x2a1410, 1).fillRect(X + P, Y + P, S - P * 2, S - P * 2);
      g.fillStyle(0xd83a10, 1).fillRect(X + P * 2, Y + P * 2, S - P * 4, S - P * 4);
      g.fillStyle(0xff8a20, 1).fillRect(X + P * 3, Y + P * 4, S - P * 7, S - P * 8);
      for (let i = 0; i < 3; i++) px(g, 0xffe14a, X + P * (3 + Math.floor(r() * 9)), Y + P * (3 + Math.floor(r() * 9)), P * 2, P);
      break;
    }
    case 'charca':
      g.fillStyle(0x2e6ab0, 0.85).fillRect(X + P * 2, Y + P * 3, S - P * 4, S - P * 6);
      g.fillStyle(0x5aa0e0, 1).fillRect(X + P * 3, Y + P * 4, S - P * 6, S - P * 8);
      px(g, 0xffffff, X + P * 4, Y + P * 5, P * 3, P, 0.8);
      px(g, 0xbfe0ff, X + P * 9, Y + P * 9, P * 2, P, 0.8);
      break;
    case 'hierba':
      for (let i = 0; i < 6; i++) {
        const x = X + P * (2 + Math.floor(r() * 12));
        const y = Y + P * (4 + Math.floor(r() * 9));
        px(g, 0x2f7a32, x, y, P, P * 3);
        px(g, 0x6ad05a, x + P, y - P, P, P * 3);
      }
      px(g, 0xff8ab0, X + P * 7, Y + P * 7, P, P);
      px(g, 0xffffff, X + P * 11, Y + P * 4, P, P);
      break;
    case 'hielo':
      g.fillStyle(0xbfeaff, 0.85).fillRect(X + P, Y + P, S - P * 2, S - P * 2);
      g.fillStyle(0xe8f8ff, 0.9).fillRect(X + P * 2, Y + P * 2, S - P * 6, P);
      g.lineStyle(P - 1, 0xffffff, 0.8).lineBetween(X + P * 4, Y + S - P * 4, X + S - P * 5, Y + P * 5);
      px(g, 0x7cc6ff, X + S - P * 5, Y + S - P * 4, P * 2, P);
      break;
    case 'toxico':
      g.fillStyle(0x4a2060, 0.9).fillRect(X + P * 2, Y + P * 3, S - P * 4, S - P * 6);
      g.fillStyle(0xb060d0, 1).fillRect(X + P * 3, Y + P * 4, S - P * 6, S - P * 8);
      for (let i = 0; i < 3; i++) {
        const x = X + P * (4 + Math.floor(r() * 7));
        const y = Y + P * (5 + Math.floor(r() * 5));
        px(g, 0xe0a0ff, x, y, P * 2, P * 2);
        px(g, 0x6a2080, x + P, y + P);
      }
      break;
    case 'arenas':
      g.fillStyle(0xc89850, 1).fillRect(X + P, Y + P, S - P * 2, S - P * 2);
      g.lineStyle(P - 1, 0x8a6030, 0.8).strokeCircle(X + S / 2, Y + S / 2, S / 4).strokeCircle(X + S / 2, Y + S / 2, S / 8);
      px(g, 0xf0d898, X + P * 4, Y + P * 3, P * 2, P);
      break;
    case 'seda': {
      g.lineStyle(1, 0xffffff, 0.85);
      const cx = X + S / 2;
      const cy = Y + S / 2;
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 4;
        g.lineBetween(cx - Math.cos(a) * 20, cy - Math.sin(a) * 20, cx + Math.cos(a) * 20, cy + Math.sin(a) * 20);
      }
      g.strokeCircle(cx, cy, 8).strokeCircle(cx, cy, 15);
      break;
    }
    case 'losas':
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          const x = X + P + i * (S / 2 - 1);
          const y = Y + P + j * (S / 2 - 1);
          g.fillStyle(0x5a5040, 1).fillRect(x, y, S / 2 - P, S / 2 - P);
          g.fillStyle(0xa89a70, 1).fillRect(x, y, S / 2 - P * 2, S / 2 - P * 2);
          g.fillStyle(0xc8bc90, 1).fillRect(x, y, S / 2 - P * 2, P);
        }
      break;
    case 'almas':
      // Niebla morada baja (las almas que se mueven las dibuja el ambiente)
      g.fillStyle(0x705898, 0.45).fillRect(X, Y + P * 2, S, S - P * 4);
      g.fillStyle(0xa08ad0, 0.35).fillRect(X + P * 2, Y + P * 4, S - P * 4, P * 3).fillRect(X + P * 4, Y + P * 10, S - P * 6, P * 2);
      break;
  }
}

// --- Obstáculos ---

type Prop = 'lapida' | 'bloque' | 'monticulo' | 'cristal' | 'planta' | 'poste' | 'arbol' | 'magma' | 'nido' | 'roca' | 'caja' | 'seta';
const PROP: Readonly<Record<string, Prop>> = {
  normal: 'poste', fire: 'magma', water: 'roca', electric: 'poste', grass: 'planta', ice: 'bloque', fighting: 'poste', poison: 'monticulo',
  ground: 'monticulo', flying: 'nido', psychic: 'cristal', bug: 'planta', rock: 'roca', ghost: 'lapida', dragon: 'cristal', dark: 'arbol',
  steel: 'caja', fairy: 'seta',
};

/** ¿El tipo tiene obstáculo propio? (si no, se queda la roca del bioma). */
export const hasThemeProp = (type: string): boolean => !!PROP[type];

/** Obstáculo del tipo tema en una casilla bloqueada (centro abajo en cx, by). */
export function drawThemeProp(g: G, type: string, cx: number, by: number) {
  const c = typeColor(type);
  const [c1, c2] = fxColors(type);
  const x = snap(cx);
  const y = snap(by);
  g.fillStyle(OUT, 0.35).fillRect(x - P * 6, y - P, P * 12, P * 2);
  switch (PROP[type] ?? 'roca') {
    case 'lapida':
      px(g, OUT, x - P * 5, y - P * 11, P * 10, P * 11);
      px(g, 0x8a84a0, x - P * 4, y - P * 10, P * 8, P * 10);
      px(g, 0xb8b0d0, x - P * 4, y - P * 10, P * 8, P * 2);
      px(g, 0x5a5470, x - P, y - P * 7, P * 2, P * 5);
      px(g, 0x5a5470, x - P * 3, y - P * 6, P * 6, P);
      px(g, 0x4a8a3a, x - P * 5, y - P, P * 10, P);
      break;
    case 'bloque':
      px(g, OUT, x - P * 6, y - P * 10, P * 12, P * 10);
      px(g, 0x7cc6ff, x - P * 5, y - P * 9, P * 10, P * 9);
      px(g, 0xbfeaff, x - P * 5, y - P * 9, P * 10, P * 3);
      px(g, 0xffffff, x - P * 3, y - P * 7, P, P * 3);
      px(g, 0x4a8ac0, x + P * 2, y - P * 4, P * 3, P);
      break;
    case 'monticulo':
      px(g, OUT, x - P * 6, y - P * 5, P * 12, P * 5);
      px(g, OUT, x - P * 4, y - P * 7, P * 8, P * 2);
      px(g, darkOf(c), x - P * 5, y - P * 4, P * 10, P * 4);
      px(g, c, x - P * 3, y - P * 6, P * 6, P * 3);
      px(g, lightOf(c), x - P * 2, y - P * 6, P * 2, P);
      if (type === 'poison') px(g, c1, x + P * 2, y - P * 8, P * 2, P * 2);
      break;
    case 'cristal':
      px(g, OUT, x - P * 4, y - P * 12, P * 8, P * 12);
      px(g, darkOf(c), x - P * 3, y - P * 9, P * 6, P * 9);
      px(g, c, x - P * 2, y - P * 11, P * 4, P * 11);
      px(g, lightOf(c), x - P, y - P * 10, P, P * 6);
      px(g, 0xffffff, x - P, y - P * 10);
      break;
    case 'planta':
      px(g, OUT, x - P * 6, y - P * 9, P * 12, P * 9);
      px(g, darkOf(c), x - P * 5, y - P * 8, P * 10, P * 8);
      px(g, c, x - P * 4, y - P * 8, P * 7, P * 5);
      px(g, lightOf(c), x - P * 3, y - P * 7, P * 2, P * 2);
      if (type === 'bug') {
        px(g, 0xffe14a, x + P, y - P * 5, P * 2, P * 2);
        px(g, OUT, x + P, y - P * 4, P * 2, P);
      }
      break;
    case 'poste':
      px(g, OUT, x - P * 2, y - P * 12, P * 4, P * 12);
      px(g, type === 'electric' ? 0x6a7080 : 0x8a5a2a, x - P, y - P * 11, P * 2, P * 11);
      px(g, OUT, x - P * 5, y - P * 10, P * 10, P * 3);
      px(g, type === 'electric' ? 0xffe14a : type === 'fighting' ? 0xc22e28 : 0xd8b07a, x - P * 4, y - P * 9, P * 8, P);
      break;
    case 'arbol':
      px(g, OUT, x - P, y - P * 12, P * 3, P * 12);
      px(g, 0x3a3040, x, y - P * 11, P, P * 11);
      px(g, 0x3a3040, x - P * 4, y - P * 9, P * 4, P);
      px(g, 0x3a3040, x + P, y - P * 7, P * 4, P);
      px(g, 0x3a3040, x - P * 4, y - P * 10, P, P);
      px(g, 0xff5a4a, x + P * 4, y - P * 8, P, P);
      break;
    case 'magma':
      px(g, OUT, x - P * 6, y - P * 8, P * 12, P * 8);
      px(g, 0x3a2420, x - P * 5, y - P * 7, P * 10, P * 7);
      px(g, 0x5a3a30, x - P * 4, y - P * 7, P * 6, P * 2);
      px(g, 0xff6a20, x - P * 2, y - P * 4, P * 4, P);
      px(g, 0xffd34d, x + P, y - P * 5, P, P * 3);
      break;
    case 'nido':
      px(g, OUT, x - P * 6, y - P * 5, P * 12, P * 5);
      px(g, 0x8a5a2a, x - P * 5, y - P * 4, P * 10, P * 3);
      px(g, 0xb8864a, x - P * 5, y - P * 4, P * 10, P);
      px(g, 0xf0f0f0, x - P * 2, y - P * 6, P * 2, P * 2);
      px(g, 0xd8ccff, x + P, y - P * 6, P * 2, P * 2);
      break;
    case 'caja':
      px(g, OUT, x - P * 6, y - P * 10, P * 12, P * 10);
      px(g, 0x8888a8, x - P * 5, y - P * 9, P * 10, P * 9);
      px(g, 0xd0d0e0, x - P * 5, y - P * 9, P * 10, P);
      px(g, 0x5a5a78, x - P * 5, y - P * 5, P * 10, P);
      for (const dx of [-4, 3]) for (const dy of [-8, -2]) px(g, 0xe0e0f0, x + P * dx, y + P * dy);
      break;
    case 'seta':
      px(g, OUT, x - P * 6, y - P * 10, P * 12, P * 5);
      px(g, OUT, x - P * 2, y - P * 5, P * 4, P * 5);
      px(g, c, x - P * 5, y - P * 9, P * 10, P * 3);
      px(g, 0xffffff, x - P * 3, y - P * 9, P * 2, P);
      px(g, 0xffffff, x + P * 2, y - P * 8, P, P);
      px(g, 0xf0e8d8, x - P, y - P * 5, P * 2, P * 5);
      break;
    default:
      px(g, OUT, x - P * 6, y - P * 8, P * 12, P * 8);
      px(g, darkOf(c2 ?? c), x - P * 5, y - P * 7, P * 10, P * 7);
      px(g, c2 ?? c, x - P * 4, y - P * 7, P * 6, P * 3);
      px(g, lightOf(c2 ?? c), x - P * 3, y - P * 7, P * 2, P);
  }
}

// --- Ambiente ---

/** Motas del ambiente (fijas por mapa: posición, fase y velocidad). */
export interface Mote {
  x: number;
  y: number;
  phase: number;
  speed: number;
}

export function pickMotes(seed: number, geo: MapGeom, w: number, h: number, n = 22): Mote[] {
  const r = rng(seed);
  return Array.from({ length: n }, () => ({ x: geo.ox + r() * w, y: geo.oy + r() * h, phase: r() * 10, speed: 0.6 + r() * 0.8 }));
}

/** Cómo se mueve el ambiente de cada tipo. */
type Motion = 'sube' | 'cae' | 'deriva' | 'parpadea';
const MOTION: Readonly<Record<string, Motion>> = {
  normal: 'deriva', fire: 'sube', water: 'sube', electric: 'parpadea', grass: 'deriva', ice: 'cae', fighting: 'deriva', poison: 'sube',
  ground: 'deriva', flying: 'deriva', psychic: 'parpadea', bug: 'parpadea', rock: 'cae', ghost: 'sube', dragon: 'sube', dark: 'sube',
  steel: 'parpadea', fairy: 'parpadea',
};
/** Tipos con niebla baja que se mueve (fantasma: niebla y almas). */
const FOG: Readonly<Record<string, number>> = { ghost: 0x9a80d0, dark: 0x3a3040, poison: 0x8a5aa8, psychic: 0xf0a0c8 };

/**
 * Ambiente animado del tipo tema (sobre el suelo, debajo de torres y enemigos): niebla baja y almas que suben en
 * Fantasma, brasas en Fuego, copos en Hielo, burbujas en Agua y Veneno, chispas en Eléctrico, luciérnagas en Bicho,
 * destellos en Hada y Acero… Las almas también salen de la Niebla de almas del camino.
 */
export function drawThemeAmbient(g: G, type: string, motes: readonly Mote[], area: { x: number; y: number; w: number; h: number }, t: number, soulCells: readonly { x: number; y: number }[] = []) {
  if (lowFx()) return;
  const fog = FOG[type];
  if (fog !== undefined) {
    for (let i = 0; i < 6; i++) {
      const bx = area.x + ((i * 211 + t / 55) % (area.w + 200)) - 100;
      const by = area.y + 40 + ((i * 137) % Math.max(1, area.h - 80));
      g.fillStyle(fog, 0.1).fillRect(snap(bx), snap(by), 150, 15).fillRect(snap(bx) + 30, snap(by) - 9, 90, 9);
    }
  }
  const [c1, c2, c3] = fxColors(type);
  const mo = MOTION[type] ?? 'deriva';
  for (const m of motes) {
    const k = ((t / 1000) * m.speed * 0.25 + m.phase) % 1;
    let x = m.x;
    let y = m.y;
    let a = 0.8;
    if (mo === 'sube') {
      y = m.y - k * 60;
      x = m.x + Math.sin(k * 6 + m.phase) * 6;
      a = 0.9 * (1 - k);
    } else if (mo === 'cae') {
      y = m.y + k * 60 - 30;
      x = m.x + Math.sin(k * 5 + m.phase) * 8;
      a = 0.9 * Math.min(1, (1 - k) * 2);
    } else if (mo === 'deriva') {
      x = m.x + Math.sin(t / 1400 * m.speed + m.phase) * 14;
      y = m.y + Math.cos(t / 1800 * m.speed + m.phase) * 6;
      a = 0.6;
    } else {
      a = Math.max(0, Math.sin(t / 300 * m.speed + m.phase * 3)) * 0.95;
    }
    if (a <= 0.05 || x < area.x || y < area.y || x > area.x + area.w - P || y > area.y + area.h - P) continue;
    if (type === 'ghost') {
      drawSoul(g, x, y, a);
      continue;
    }
    const col = [c1, c2, c3][Math.floor(m.phase) % 3];
    px(g, col, x, y, P, P, a);
    if (mo === 'parpadea' && a > 0.7) {
      px(g, 0xffffff, x - P, y, P, P, a * 0.5);
      px(g, 0xffffff, x + P, y, P, P, a * 0.5);
      px(g, 0xffffff, x, y - P, P, P, a * 0.5);
      px(g, 0xffffff, x, y + P, P, P, a * 0.5);
    } else if (type === 'ice') px(g, 0xffffff, x + P, y + P, P, P, a * 0.7);
  }
  // Almas que suben de la niebla de almas del camino
  soulCells.forEach((c, i) => {
    const k = ((t / 2400) + i * 0.37) % 1;
    drawSoul(g, c.x + Math.sin(k * 7 + i) * 5, c.y + 10 - k * 34, 0.8 * (1 - k));
  });
}

/** Alma: fantasmita blanco-morado de 3x4 píxeles con ojos. */
function drawSoul(g: G, x: number, y: number, a: number) {
  px(g, 0xe8e0ff, x - P, y - P * 2, P * 3, P * 3, a);
  px(g, 0xe8e0ff, x - P, y + P, P, P, a);
  px(g, 0xe8e0ff, x + P, y + P, P, P, a);
  px(g, 0x3a2a5a, x - P, y - P, P, P, a);
  px(g, 0x3a2a5a, x + P, y - P, P, P, a);
  g.fillStyle(0xa080ff, 0.12 * a).fillCircle(x + 1, y, 9);
}
