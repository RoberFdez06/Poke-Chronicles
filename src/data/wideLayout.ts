// Pantallas anchas (más de 16:9) en escritorio: el lienzo crece a lo ancho en vez de dejar franjas vacías.
// Lógica pura, sin Phaser, para poder testearla.
//
// La altura lógica sigue siendo 1080 y todo se diseña en 1920 de ancho (BASE_W). Si la ventana es más ancha, el
// lienzo pasa a medir LW = 1080 × aspecto (hasta MAX_ASPECT; con más ancho, Scale.FIT deja franjas como antes).
// Los menús quedan centrados con más fondo a los lados; en la partida la sala se ve igual (mismo tamaño y zoom,
// no se ve más mapa) y los paneles del HUD se separan hasta los bordes reales de la ventana.
// En táctil no se aplica: el móvil usa sus bandas laterales para los botones (touchLayout.ts).

export const BASE_W = 1920;
export const BASE_H = 1080;
/** Tope de aspecto: 21:9 «real» (2,4:1). */
export const MAX_ASPECT = 2.4;
export const MAX_W = Math.round(BASE_H * MAX_ASPECT);
/** Por debajo de este sobrante (px lógicos) no merece la pena ensanchar: se queda en 16:9. */
export const MIN_EXTRA = 32;

/** Ancho lógico del lienzo para una ventana de cssW × cssH (par, entre BASE_W y MAX_W). */
export function logicalWidth(cssW: number, cssH: number, touch: boolean): number {
  if (touch || !(cssW > 0) || !(cssH > 0)) return BASE_W;
  const want = Math.round((BASE_H * cssW) / cssH);
  if (want - BASE_W < MIN_EXTRA) return BASE_W;
  const w = Math.min(MAX_W, want);
  return w - (w % 2);
}

/** Desplazamiento para centrar el diseño de 1920 en un lienzo de ancho lw. */
export const centerOffset = (lw: number): number => Math.max(0, (lw - BASE_W) / 2);

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Una cámara del HUD: qué trozo del diseño (src, coordenadas de 1920) se pinta en qué sitio de la pantalla (dst). */
export interface HudSlice {
  src: Rect;
  dst: Rect;
}

/**
 * HUD de la partida partido en tres cámaras: panel izquierdo pegado al borde izquierdo, centro (sobre la sala)
 * centrado, y panel derecho pegado al borde derecho. Los trozos no se solapan (nada se pinta dos veces) y los
 * huecos que quedan entre paneles y sala son el aire extra. Con lw = 1920 sale el reparto de siempre.
 */
export function hudSlices(lw: number, leftW: number, rightW: number, h = BASE_H): { left: HudSlice; center: HudSlice; right: HudSlice } {
  const off = centerOffset(lw);
  const cw = BASE_W - leftW - rightW;
  return {
    left: { src: { x: 0, y: 0, w: leftW, h }, dst: { x: 0, y: 0, w: leftW, h } },
    center: { src: { x: leftW, y: 0, w: cw, h }, dst: { x: off + leftW, y: 0, w: cw, h } },
    right: { src: { x: BASE_W - rightW, y: 0, w: rightW, h }, dst: { x: lw - rightW, y: 0, w: rightW, h } },
  };
}

/** Pasa una x de pantalla (lienzo de ancho lw) a la x del diseño de 1920 según la cámara del HUD que la pinta. */
export function screenToHudX(sx: number, lw: number, leftW: number, rightW: number): number {
  const s = hudSlices(lw, leftW, rightW);
  if (sx < s.left.dst.x + s.left.dst.w) return sx;
  if (sx >= s.right.dst.x) return sx - s.right.dst.x + s.right.src.x;
  return sx - centerOffset(lw);
}

/**
 * Paneles laterales más grandes en pantalla ancha. Cada panel (columna de diseño de `panelW` × 1080) se parte en
 * tramos verticales: los fijos (con contenido) se pintan enteros a escala s; los «recortables» (huecos o zonas que
 * pueden mostrarse solo en parte, como la pila de avisos) reparten el alto que sobra y enseñan solo su parte de
 * arriba (al menos `minSrc` px de diseño). Todo con el mismo zoom s, así nada se deforma.
 */
export interface HudSeg {
  y0: number;
  y1: number;
  crop?: boolean;
  /** Solo recortables: alto de diseño que debe verse como mínimo. */
  minSrc?: number;
}
/** Una cámara de un panel: trozo del diseño (src), dónde se pinta (dst) y su zoom (dst = src × zoom). */
export interface HudCamSlice {
  src: Rect;
  dst: Rect;
  zoom: number;
}
export const HUD_SCALE_MAX = 1.6;
/** Margen total que se deja en la banda (repartido a partes iguales: borde de la ventana y sala). */
export const HUD_BAND_MARGIN = 12;

/**
 * Tramos de los paneles de la partida (coordenadas de diseño). Izquierda: pausa, parry, adrenalina, ficha,
 * contadores y rejilla de objetos (hasta 16 caben en 0..600), hueco recortable y objeto activo (cuadro en 954..1064).
 * Derecha: minimapa y avisos (recortable, se ven al menos 300 px: minimapa y 1-2 avisos) y esquiva + 4 ranuras
 * (desde 716).
 */
export const HUD_LEFT_SEGS: HudSeg[] = [
  { y0: 0, y1: 600 },
  { y0: 600, y1: 940, crop: true },
  { y0: 940, y1: BASE_H },
];
export const HUD_RIGHT_SEGS: HudSeg[] = [
  { y0: 0, y1: 700, crop: true, minSrc: 300 },
  { y0: 700, y1: BASE_H },
];

/** Táctil: el minimapa de móvil es mayor (MOBILE_MAP, hasta 16 + 380 px), así que su zona debe verse entera. */
export const HUD_RIGHT_SEGS_TOUCH: HudSeg[] = [
  { y0: 0, y1: 700, crop: true, minSrc: 400 },
  { y0: 700, y1: BASE_H },
];

/** Factor de escala de un panel lateral: 1 en 16:9; en ancho, lo que quepa a lo ancho y a lo alto, con tope. */
export function hudBandScale(lw: number, panelW: number, segs: HudSeg[], h = BASE_H): number {
  if (lw <= BASE_W || panelW <= 0) return 1;
  const band = centerOffset(lw) + panelW;
  const byW = (band - HUD_BAND_MARGIN) / panelW;
  const need = segs.reduce((a, g) => a + (g.crop ? (g.minSrc ?? 0) : g.y1 - g.y0), 0);
  const byH = need > 0 ? h / need : HUD_SCALE_MAX;
  return Math.max(1, Math.min(HUD_SCALE_MAX, byW, byH));
}

/** Cámaras de un panel lateral (izquierdo o derecho) para un lienzo de ancho lw. */
export function hudPanelSlices(lw: number, side: 'left' | 'right', panelW: number, segs: HudSeg[], h = BASE_H): HudCamSlice[] {
  const s = hudBandScale(lw, panelW, segs, h);
  const off = centerOffset(lw);
  const pw = panelW * s;
  // Centrado en su banda: el ancho que sobra (si el alto no deja crecer más) se reparte igual entre el borde de
  // la ventana y la sala, en vez de quedar todo como franja vacía en el borde exterior.
  const band = off + panelW;
  const bx = side === 'left' ? 0 : off + BASE_W - panelW;
  const dx = bx + Math.max(0, (band - pw) / 2);
  const sx = side === 'left' ? 0 : BASE_W - panelW;
  const fixedDst = segs.reduce((a, g) => a + (g.crop ? 0 : (g.y1 - g.y0) * s), 0);
  const cropSrc = segs.reduce((a, g) => a + (g.crop ? g.y1 - g.y0 : 0), 0);
  const free = Math.max(0, h - fixedDst);
  const out: HudCamSlice[] = [];
  let y = 0;
  segs.forEach((g, i) => {
    const full = (g.y1 - g.y0) * s;
    let dh = g.crop ? (cropSrc > 0 ? Math.min(full, (free * (g.y1 - g.y0)) / cropSrc) : 0) : full;
    if (i === segs.length - 1) dh = Math.max(0, Math.min(full, h - y));
    if (dh > 0) out.push({ src: { x: sx, y: g.y0, w: panelW, h: dh / s }, dst: { x: dx, y, w: pw, h: dh }, zoom: s });
    y += dh;
  });
  return out;
}

/** Pasa un punto de pantalla a coordenadas del diseño (1920 × 1080) según la cámara del HUD que lo pinta. */
export function screenToHud(sx: number, sy: number, lw: number, leftW: number, rightW: number, leftSegs: HudSeg[], rightSegs: HudSeg[]): { x: number; y: number } {
  for (const c of [...hudPanelSlices(lw, 'left', leftW, leftSegs), ...hudPanelSlices(lw, 'right', rightW, rightSegs)]) {
    const d = c.dst;
    if (sx >= d.x && sx < d.x + d.w && sy >= d.y && sy < d.y + d.h) return { x: c.src.x + (sx - d.x) / c.zoom, y: c.src.y + (sy - d.y) / c.zoom };
  }
  return { x: sx - centerOffset(lw), y: sy };
}

/**
 * Menús de dos columnas (p. ej. la Pausa): cuánto se separa cada columna hacia su lado, en unidades de diseño,
 * a partir del ancho de cada banda lateral. La mitad de la banda, con tope, y 0 en 16:9.
 */
export const MENU_SPREAD_MAX = 90;
export function menuSpread(band: number): number {
  const base = (BASE_W / BASE_H) * 640; // ancho visible del diseño 960×640 en 16:9 (≈ 1137,8)
  const extra = band - (base - 960) / 2;
  return extra > 4 ? Math.min(MENU_SPREAD_MAX, Math.floor(extra / 2)) : 0;
}
