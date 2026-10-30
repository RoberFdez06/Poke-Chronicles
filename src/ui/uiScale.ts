// Modo móvil (interfaz legible en móvil y tableta). El lienzo es fijo de 1920×1080 con Scale.FIT: en un móvil apaisado
// se ve a ~0,36 y un texto de 14 px de diseño queda en pocos píxeles CSS. Aquí, sin tocar la escala ni el aspecto de
// escritorio, se calcula un factor acotado que agranda los textos pequeños (main.ts lo aplica al crear cada texto) y
// cuánto se estiran las zonas de toque de las filas de menú. Sin Phaser: se prueba con node --test.
import { H, U, W } from './layout.ts';

/** Tamaño mínimo de letra que se busca, en píxeles CSS reales. */
export const MIN_TEXT_CSS = 12;
/** Tope del aumento de letra: más rompería la composición de los menús (960×640). */
export const MAX_TEXT_BOOST = 1.5;
/** Zona de toque mínima recomendada (px CSS). */
export const MIN_TOUCH_CSS = 44;

/**
 * Píxeles CSS por píxel del lienzo con Scale.FIT, suponiendo el móvil en horizontal (en vertical sale el aviso
 * «Gira el móvil»; así el factor no cambia al girar).
 */
export function cssPerGamePx(viewW: number, viewH: number): number {
  const long = Math.max(viewW, viewH);
  const short = Math.min(viewW, viewH);
  if (!(long > 0 && short > 0)) return 1;
  return Math.min(long / W, short / H);
}

/** Factor por el que se multiplica una letra de `size` px (vista con `zoom`) para llegar al mínimo CSS, con tope. */
export function textBoost(size: number, cssPerPx: number, zoom = U, minCss = MIN_TEXT_CSS, cap = MAX_TEXT_BOOST): number {
  const css = size * zoom * cssPerPx;
  if (!(css > 0) || css >= minCss) return 1;
  return Math.min(cap, minCss / css);
}

/** Tamaño de letra final (entero) en modo móvil. */
export const boostedSize = (size: number, cssPerPx: number, zoom = U): number => Math.round(size * textBoost(size, cssPerPx, zoom));

/** Lee el tamaño en px de un `fontSize` de Phaser ("14px", 14 o "1.2em"); null si no se entiende. */
export function parseFontPx(v: unknown): number | null {
  if (typeof v === 'number') return v > 0 ? v : null;
  if (typeof v !== 'string') return null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*px\s*$/.exec(v);
  return m ? Number(m[1]) : null;
}

/** Alto de la zona de toque de una fila de menú: en móvil cubre también el hueco hasta la siguiente fila. */
export const rowHitHeight = (h: number, gap: number, mobile: boolean): number => (mobile ? h + gap : h);

let mobile = false;
/** Lo fija main.ts al arrancar (dispositivo solo táctil). En escritorio queda en false y nada cambia. */
export function setMobileUi(on: boolean) {
  mobile = on;
}
export const mobileUi = (): boolean => mobile;

/** Escala actual (px CSS por px del lienzo) a partir de la ventana del navegador. */
export function viewportCssPerPx(): number {
  if (typeof window === 'undefined') return 1;
  return cssPerGamePx(window.innerWidth, window.innerHeight);
}
