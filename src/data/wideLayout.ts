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
 * Menús de dos columnas (p. ej. la Pausa): cuánto se separa cada columna hacia su lado, en unidades de diseño,
 * a partir del ancho de cada banda lateral. La mitad de la banda, con tope, y 0 en 16:9.
 */
export const MENU_SPREAD_MAX = 90;
export function menuSpread(band: number): number {
  const base = (BASE_W / BASE_H) * 640; // ancho visible del diseño 960×640 en 16:9 (≈ 1137,8)
  const extra = band - (base - 960) / 2;
  return extra > 4 ? Math.min(MENU_SPREAD_MAX, Math.floor(extra / 2)) : 0;
}
