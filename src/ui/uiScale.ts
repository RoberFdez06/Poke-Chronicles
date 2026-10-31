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

/**
 * HUD de la partida en móvil: va en una cámara sin zoom (no la de los menús, ×1,6875), así que con el aumento de
 * arriba sus letras se quedaban en 5-7 px CSS. Aquí se busca un mínimo propio, con un tope mayor porque el HUD
 * ocupa las franjas laterales y no la composición 960×640 de los menús.
 */
export const HUD_MIN_CSS = 9.5;
export const HUD_MAX_BOOST = 2;

/** Tamaño de letra de un texto del HUD: igual en escritorio; en móvil, al menos HUD_MIN_CSS (con tope y `max`). */
export function hudFontSize(size: number, cssPerPx: number, mobile: boolean, max = Infinity, ui = 1): number {
  if (!mobile) return size;
  // «Tamaño de la interfaz» (Ajustes, solo móvil): agranda también el tope
  const k = ui > 0 ? ui : 1;
  const s = Math.round(size * textBoost(size, cssPerPx, 1, HUD_MIN_CSS, HUD_MAX_BOOST) * k);
  return Math.max(size, Math.min(s, Math.round(max * k)));
}

let hudUi = 1;
/** Factor de «Tamaño de la interfaz» (1, 1,25 o 1,5); lo fija la partida al empezar. Fuera de móvil no cambia nada. */
export function setHudUiScale(k: number) {
  hudUi = k > 0 ? k : 1;
}
export const hudUiScale = (): number => (mobile ? hudUi : 1);

/** Atajo para las escenas: tamaño del HUD con la ventana actual y el modo móvil fijado al arrancar. */
export const hudFont = (size: number, max = Infinity): number => hudFontSize(size, viewportCssPerPx(), mobile, max, hudUi);
