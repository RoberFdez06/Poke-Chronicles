// Menús de la Defensa de torres en táctil (rama `tdmovil`): mapas, niveles y «Elige tu equipo» con fichas y botones
// de al menos 56 px CSS, usando todo el ancho del lienzo táctil (hasta 3:1). Parte pura con pruebas en
// tests/tdTouch.test.ts. Unidades de diseño (960×640 centrado), como touchTd.ts.
import { TD_TEXT_CSS, TD_TEXT_MIN_CSS, TD_TOUCH_CSS, type Rect } from './touchTd.ts';

export interface GridFit {
  cols: number;
  rows: number;
  /** Fichas por página y páginas. */
  perPage: number;
  pages: number;
  w: number;
  h: number;
  gap: number;
  area: Rect;
}

/** Rectángulo de la ficha `i` (dentro de su página). */
export function gridCell(g: GridFit, i: number): Rect {
  const k = i % g.perPage;
  const c = k % g.cols;
  const r = Math.floor(k / g.cols);
  return { x: g.area.x + c * (g.w + g.gap), y: g.area.y + r * (g.h + g.gap), w: g.w, h: g.h };
}

/**
 * Rejilla para `n` fichas en `area` con fichas de al menos `minW`×`minH`: la de fichas más grandes (puntuación
 * min(ancho, alto × `aspect`)) entre las que caben enteras; si no cabe ninguna, por páginas con todas las que quepan.
 */
export function fitGrid(n: number, area: Rect, minW: number, minH: number, gap: number, aspect = 1): GridFit {
  const N = Math.max(1, n);
  const maxCols = Math.max(1, Math.floor((area.w + gap) / (minW + gap)));
  const maxRows = Math.max(1, Math.floor((area.h + gap) / (minH + gap)));
  let best: GridFit | null = null;
  let score = -1;
  for (let cols = 1; cols <= Math.min(N, maxCols); cols++) {
    const rows = Math.ceil(N / cols);
    if (rows > maxRows) continue;
    const w = (area.w - (cols - 1) * gap) / cols;
    const h = (area.h - (rows - 1) * gap) / rows;
    const s = Math.min(w, h * aspect);
    if (s > score) {
      score = s;
      best = { cols, rows, perPage: cols * rows, pages: 1, w, h, gap, area };
    }
  }
  if (best) return best;
  const cols = maxCols;
  const rows = maxRows;
  const perPage = cols * rows;
  return { cols, rows, perPage, pages: Math.ceil(N / perPage), w: (area.w - (cols - 1) * gap) / cols, h: (area.h - (rows - 1) * gap) / rows, gap, area };
}

/** Medidas comunes en diseño para `k` px CSS por unidad. */
export function menuUnits(k: number) {
  const u = (css: number) => (k > 0 ? css / k : css);
  return { btn: Math.ceil(u(TD_TOUCH_CSS)), gap: Math.ceil(u(6)), pad: Math.ceil(u(8)), font: Math.ceil(u(TD_TEXT_CSS)), fontMin: Math.ceil(u(TD_TEXT_MIN_CSS)), title: Math.ceil(u(16)) };
}

export interface MenuFrame {
  /** Volver (arriba a la izquierda), ayuda (arriba a la derecha) y título entre los dos. */
  back: Rect;
  help: Rect;
  title: Rect;
  body: Rect;
}

/** Cabecera táctil de los menús: una fila de un botón de alto con Volver, título y ayuda; debajo, el cuerpo. */
export function menuFrame(view: Rect, k: number): MenuFrame {
  const m = menuUnits(k);
  const top = view.y + m.pad;
  const backW = Math.max(m.btn * 2, Math.ceil(m.font * 6));
  const helpW = Math.max(m.btn * 2, Math.ceil(m.font * 7));
  const back = { x: view.x + m.pad, y: top, w: backW, h: m.btn };
  const help = { x: view.x + view.w - m.pad - helpW, y: top, w: helpW, h: m.btn };
  const title = { x: back.x + backW + m.gap, y: top, w: Math.max(0, help.x - m.gap - (back.x + backW + m.gap)), h: m.btn };
  const bodyY = top + m.btn + m.gap;
  return { back, help, title, body: { x: view.x + m.pad, y: bodyY, w: view.w - m.pad * 2, h: Math.max(0, view.y + view.h - m.pad - bodyY) } };
}

/** Mapas: rejilla de fichas apaisadas (≥ 2 botones de ancho y 1 de alto) y flechas de página si hacen falta. */
export function mapsLayout(n: number, view: Rect, k: number): { frame: MenuFrame; grid: GridFit; prev: Rect | null; next: Rect | null } {
  const m = menuUnits(k);
  const frame = menuFrame(view, k);
  let grid = fitGrid(n, frame.body, m.btn * 2, m.btn, m.gap, 2.2);
  if (grid.pages <= 1) return { frame, grid, prev: null, next: null };
  // Por páginas: flechas a los lados de la rejilla
  const b = frame.body;
  const inner = { x: b.x + m.btn + m.gap, y: b.y, w: b.w - 2 * (m.btn + m.gap), h: b.h };
  grid = fitGrid(n, inner, m.btn * 2, m.btn, m.gap, 2.2);
  const ay = b.y + (b.h - m.btn * 2) / 2;
  return { frame, grid, prev: { x: b.x, y: ay, w: m.btn, h: m.btn * 2 }, next: { x: b.x + b.w - m.btn, y: ay, w: m.btn, h: m.btn * 2 } };
}

/** Niveles: rejilla de `n` fichas (niveles + infinito) a la izquierda y el texto del nivel elegido a la derecha. */
export function levelsLayout(n: number, view: Rect, k: number): { frame: MenuFrame; grid: GridFit; info: Rect } {
  const m = menuUnits(k);
  const frame = menuFrame(view, k);
  const b = frame.body;
  // El texto del nivel quiere unas 26 letras de ancho (mínimo 12); la rejilla, el resto en una sola página.
  // Se prueba de más ancho de texto y fichas más anchas a menos, hasta que la rejilla quepa entera.
  const maxInfo = Math.min(b.w * 0.42, Math.ceil(m.font * 26));
  const minInfo = Math.min(maxInfo, Math.ceil(m.font * 12));
  const fitFor = (infoW: number, ratio: number) => fitGrid(n, { x: b.x, y: b.y, w: Math.max(m.btn, b.w - infoW - m.gap), h: b.h }, Math.ceil(m.btn * ratio), m.btn, m.gap, 1.4);
  let grid = fitFor(minInfo, 1);
  search: for (const ratio of [1.4, 1.2, 1]) {
    for (let infoW = maxInfo; infoW >= minInfo; infoW -= m.font) {
      const g = fitFor(infoW, ratio);
      if (g.pages === 1) {
        grid = g;
        break search;
      }
    }
  }
  const gw = grid.cols * grid.w + (grid.cols - 1) * grid.gap;
  const info = { x: b.x + gw + m.gap, y: b.y, w: b.x + b.w - (b.x + gw + m.gap), h: b.h };
  return { frame, grid, info };
}

export interface TeamTouchLayout {
  frame: MenuFrame;
  /** Columna de información: ficha del Pokémon, aviso de equipo y página (◀ texto ▶). */
  info: Rect;
  warn: Rect;
  prev: Rect;
  next: Rect;
  pageText: Rect;
  /** Barra de filtros (Clase, Tipo, Orden, Todos) y rejilla de la colección. */
  bars: Rect[];
  grid: GridFit;
  /** Equipo (2 columnas) y [¡A jugar!][Prueba] en la última fila. */
  slots: Rect[];
  start: Rect;
  trial: Rect;
}

/** «Elige tu equipo» en táctil: [información][colección][equipo]. Todo pulsable ≥ 56 px CSS (si la caja lo permite). */
export function teamLayout(view: Rect, k: number, teamMax = 6): TeamTouchLayout {
  const m = menuUnits(k);
  const frame = menuFrame(view, k);
  const b = frame.body;
  const rowsTeam = Math.ceil(teamMax / 2) + 1;
  // Alto de fila: el de un botón, o lo justo para que quepan las filas del equipo
  const rowH = Math.max(1, Math.min(m.btn, Math.floor((view.h - m.pad * 2 - (rowsTeam - 1) * m.gap) / rowsTeam)));
  const slotW = Math.max(rowH, Math.ceil(m.font * 6));
  const teamW = slotW * 2 + m.gap;
  // El equipo ocupa todo el alto de la pantalla a la derecha (la cabecera se queda en su parte izquierda)
  const top = view.y + m.pad;
  const teamX = view.x + view.w - m.pad - teamW;
  const slots = Array.from({ length: teamMax }, (_, i) => ({ x: teamX + (i % 2) * (slotW + m.gap), y: top + Math.floor(i / 2) * (rowH + m.gap), w: slotW, h: rowH }));
  const lastY = top + (rowsTeam - 1) * (rowH + m.gap);
  const start = { x: teamX, y: lastY, w: slotW, h: rowH };
  const trial = { x: teamX + slotW + m.gap, y: lastY, w: slotW, h: rowH };
  // Ayuda: arriba, a la izquierda del equipo
  frame.help = { ...frame.help, x: teamX - m.gap - frame.help.w };
  frame.title = { ...frame.title, w: Math.max(0, frame.help.x - m.gap - frame.title.x) };
  // Información a la izquierda, rejilla en medio
  const infoW = Math.max(Math.ceil(m.font * 14), Math.min(Math.ceil(m.font * 24), (teamX - b.x) * 0.36));
  const info = { x: b.x, y: b.y, w: infoW, h: b.h };
  const pageY = info.y + info.h - rowH;
  const prev = { x: info.x, y: pageY, w: m.btn, h: rowH };
  const next = { x: info.x + info.w - m.btn, y: pageY, w: m.btn, h: rowH };
  const pageText = { x: prev.x + m.btn, y: pageY, w: Math.max(0, info.w - m.btn * 2), h: rowH };
  const warn = { x: info.x, y: info.y + info.h * 0.42, w: info.w, h: Math.max(0, pageY - m.gap - (info.y + info.h * 0.42)) };
  const gx = info.x + info.w + m.gap;
  const gw = Math.max(m.btn, teamX - m.gap - gx);
  const barW = (gw - 3 * m.gap) / 4;
  const bars = [0, 1, 2, 3].map((i) => ({ x: gx + i * (barW + m.gap), y: b.y, w: barW, h: rowH }));
  const gridArea = { x: gx, y: b.y + rowH + m.gap, w: gw, h: Math.max(0, b.y + b.h - (b.y + rowH + m.gap)) };
  // Cuántas caben por página (la colección es larga: siempre por páginas)
  const cols = Math.max(1, Math.floor((gridArea.w + m.gap) / (rowH + m.gap)));
  const rows = Math.max(1, Math.floor((gridArea.h + m.gap) / (rowH + m.gap)));
  const cw = (gridArea.w - (cols - 1) * m.gap) / cols;
  const ch = (gridArea.h - (rows - 1) * m.gap) / rows;
  const side = Math.min(cw, ch);
  const grid: GridFit = { cols, rows, perPage: cols * rows, pages: 1, w: side, h: side, gap: m.gap, area: { ...gridArea, w: cols * side + (cols - 1) * m.gap, h: rows * side + (rows - 1) * m.gap } };
  return { frame, info, warn, prev, next, pageText, bars, grid, slots, start, trial };
}
