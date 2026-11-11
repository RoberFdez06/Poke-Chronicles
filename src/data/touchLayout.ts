import { HUD_LEFT_SEGS, HUD_LEFT_SEGS_TOUCH_CANVAS, HUD_RIGHT_SEGS_TOUCH, HUD_RIGHT_SEGS_TOUCH_CANVAS, hudBandScale, type HudSeg } from './wideLayout.ts';

// Dónde van los controles táctiles: dentro del lienzo (como siempre) o en las bandas laterales que deja Scale.FIT
// en pantallas más anchas que 16:9. Parte pura (sin Phaser ni DOM): se prueba con node --test.

export type TouchLayoutMode = 'bands' | 'canvas';

/** Ancho mínimo (px CSS) de cada banda para poner ahí joystick y botones (un pulgar cómodo). */
export const MIN_BAND_CSS = 88;
/** Lado mínimo cómodo de un botón (px CSS); si dos columnas no llegan, los botones van en una sola. */
export const MIN_BTN_CSS = 40;

export interface CanvasFit {
  /** px CSS por px de lienzo. */
  scale: number;
  /** Tamaño del lienzo en pantalla (px CSS). */
  w: number;
  h: number;
  /** Ancho de cada banda lateral (px CSS; 0 si no sobra nada). */
  band: number;
}

/** Cómo queda un lienzo `cw`×`ch` ajustado con Scale.FIT (y centrado) en una caja `boxW`×`boxH`. */
export function fitCanvas(boxW: number, boxH: number, cw: number, ch: number): CanvasFit {
  if (!(boxW > 0 && boxH > 0 && cw > 0 && ch > 0)) return { scale: 0, w: 0, h: 0, band: 0 };
  const scale = Math.min(boxW / cw, boxH / ch);
  const w = cw * scale;
  const h = ch * scale;
  return { scale, w, h, band: Math.max(0, (boxW - w) / 2) };
}

/** 'bands' si cada banda lateral mide al menos `minBand` px CSS; si no, 'canvas' (diseño de siempre). */
export function touchLayoutMode(boxW: number, boxH: number, cw: number, ch: number, minBand = MIN_BAND_CSS): TouchLayoutMode {
  return fitCanvas(boxW, boxH, cw, ch).band >= minBand ? 'bands' : 'canvas';
}

export interface BandSpot {
  x: number;
  y: number;
  size: number;
}

export interface BandLayout {
  /** Radio del joystick (px CSS) y centro de su pista en cada banda (coordenadas dentro de la banda). */
  stickR: number;
  move: { x: number; y: number };
  aim: { x: number; y: number };
  /** Botones: los de la izquierda en la banda izquierda y los de la derecha en la derecha. */
  left: Record<'active' | 'bomb' | 'potion' | 'use', BandSpot>;
  right: Record<'parry' | 'dash', BandSpot>;
}

/**
 * Colocación dentro de una banda de `band`×`h` px CSS. Arriba los botones, abajo el joystick (los pulgares
 * quedan en la parte baja). `ui` agranda los botones (Tamaño de la interfaz) sin salirse de la banda.
 */
export function bandLayout(band: number, h: number, ui = 1): BandLayout {
  const pad = Math.max(6, band * 0.06);
  const inner = Math.max(0, band - pad * 2);
  const stickR = Math.max(20, Math.min(inner / 2, h * 0.2, 70 * ui));
  const stickY = h - pad - stickR;
  const cx = band / 2;
  const gap = Math.max(4, pad / 2);
  // Dos columnas de botones si caben a un tamaño cómodo; si no, una sola columna
  const two = (inner - gap) / 2 >= MIN_BTN_CSS;
  // Y que las filas quepan encima del joystick
  const rows = two ? 2 : 4;
  const avail = stickY - stickR - gap * 2 - pad;
  const big = Math.max(16, Math.min(two ? (inner - gap) / 2 : inner, 56 * ui, (avail - (rows - 1) * gap) / rows));
  const small = big * 0.78;
  const row1 = stickY - stickR - gap * 2 - big / 2;
  const step = big + gap;
  const colA = two ? cx - big / 2 - gap / 2 : cx;
  const colB = two ? cx + big / 2 + gap / 2 : cx;
  // Fila de cada botón (0 = la de abajo)
  const r = (one: number, dual: number) => row1 - (two ? dual : one) * step;
  return {
    stickR,
    move: { x: cx, y: stickY },
    aim: { x: cx, y: stickY },
    left: {
      active: { x: colA, y: r(0, 0), size: big },
      bomb: { x: colB, y: r(1, 0), size: small },
      use: { x: colA, y: r(3, 1), size: big },
      potion: { x: colB, y: r(2, 1), size: small },
    },
    right: {
      parry: { x: colA, y: r(1, 0), size: big },
      dash: { x: colB, y: r(0, 0), size: big },
    },
  };
}

// --- Móvil apaisado más ancho que 16:9 (rama `movilbandas`) ---------------------------------------------------
// Antes el lienzo táctil se quedaba fijo en 1920×1080 y todo lo que sobraba a los lados eran bandas (botones DOM
// en la parte de abajo y el resto vacío): en Safari con barras (≈3,2:1) cada banda medía ≈150 px CSS y casi toda
// quedaba sin uso. Ahora, si hay sitio para bandas, cada banda se queda con lo justo para los botones y el resto
// lo gana el lienzo (ancho lógico mayor, como en escritorio: menús con más fondo y paneles del HUD más grandes).
// La sala depende del alto (el lienzo siempre llena el alto cuando la pantalla es más ancha que 16:9), así que
// nunca se ve más pequeña que antes.

/** Ancho de banda (px CSS, interfaz al 100 %) para dos columnas de botones de ≥ 48 px y el joystick. */
export const TOUCH_BAND_BASE_CSS = 116;
/** Tope de aspecto del lienzo en táctil (más ancho, las bandas crecen como antes). */
export const TOUCH_MAX_ASPECT = 3;
export const TOUCH_MAX_W = Math.round(1080 * TOUCH_MAX_ASPECT);

/** Ancho que necesita cada banda con el «Tamaño de la interfaz» `ui` (1, 1,25 o 1,5). */
export const touchBandNeed = (ui = 1): number => Math.max(MIN_BAND_CSS, Math.ceil(TOUCH_BAND_BASE_CSS * (ui > 0 ? ui : 1)));

/**
 * Ancho lógico del lienzo táctil para una caja (ya sin zonas seguras) de cssW×cssH px CSS. 1920 si las bandas a
 * 16:9 no llegan al mínimo (modo «lienzo», como siempre); si llegan, el lienzo se ensancha dejando a cada lado
 * `touchBandNeed(ui)` (nunca menos que a 16:9 ni por debajo de MIN_BAND_CSS). Par y entre 1920 y TOUCH_MAX_W.
 */
export function touchLogicalWidth(cssW: number, cssH: number, ui = 1, baseW = 1920, baseH = 1080): number {
  if (!(cssW > 0 && cssH > 0)) return baseW;
  const f = fitCanvas(cssW, cssH, baseW, baseH);
  if (f.band < MIN_BAND_CSS) return baseW;
  const need = Math.min(touchBandNeed(ui), f.band);
  // floor: la banda real nunca queda por debajo de `need` (si no, el modo podría saltar a «lienzo»)
  const want = Math.floor((baseH * (cssW - 2 * need)) / cssH);
  const w = Math.max(baseW, Math.min(TOUCH_MAX_W, want));
  return w - (w % 2);
}

export interface TouchScreen {
  lw: number;
  mode: TouchLayoutMode;
  /** px CSS por px de lienzo. */
  scale: number;
  /** Anchos en px CSS. */
  band: number;
  canvas: number;
  room: number;
  /** Cada panel del HUD (izquierdo/derecho) más su margen, en px CSS. */
  hudSide: number;
}

/** Cómo queda la pantalla táctil con un ancho lógico `lw` (sala de `roomW` px de lienzo en el centro). */
export function touchScreen(cssW: number, cssH: number, lw: number, roomW = 1440, baseH = 1080): TouchScreen {
  const f = fitCanvas(cssW, cssH, lw, baseH);
  const mode = f.band >= MIN_BAND_CSS ? 'bands' : 'canvas';
  return { lw, mode, scale: f.scale, band: f.band, canvas: f.w, room: roomW * f.scale, hudSide: ((lw - roomW) / 2) * f.scale };
}

// --- HUD más grande sin bandas (rama `movilhud`) ----------------------------------------------------------------
// A ≈2,0–2,6:1 (iPhone sin barras, Galaxy S, Pixel, Safari con barras en partida) la banda a 16:9 no llega a lo que
// piden los botones de banda (116 px CSS × interfaz), así que touchLogicalWidth deja el lienzo en 1920: franjas
// muertas de 36–104 px y HUD a ×1. Aquí el lienzo ocupa TODO el ancho (sin bandas) y los controles se quedan en el
// lienzo (modo «lienzo» de siempre); los paneles del HUD crecen con hudBandScale usando tramos que dejan las filas
// de botones enteras (HUD_*_SEGS_TOUCH_CANVAS). La sala no cambia (manda el alto). Interruptor de seguridad:

/** Bandas DOM con los controles fuera del lienzo. Apagadas: los controles van siempre dentro del juego. */
export const TOUCH_BANDS_ENABLED = false;

/** Poner a false devuelve exactamente el comportamiento anterior (touchLogicalWidth). */
export const TOUCH_HUD_SCALE_ENABLED = true;
/** Ganancia mínima del panel izquierdo para ensanchar (por debajo no compensa un zoom no entero). */
export const TOUCH_HUD_MIN_GAIN = 1.1;

/**
 * Ancho lógico táctil con el HUD ampliado: igual que touchLogicalWidth salvo cuando esta deja 1920 en modo «lienzo»
 * en una caja más ancha que 16:9; entonces el lienzo llena la caja (par, hasta TOUCH_MAX_W) si el panel izquierdo gana ≥ ×1,1.
 */
export function touchWideWidth(cssW: number, cssH: number, ui = 1, enabled = TOUCH_HUD_SCALE_ENABLED, baseW = 1920, baseH = 1080): number {
  const old = touchLogicalWidth(cssW, cssH, ui, baseW, baseH);
  if (!enabled || !(cssW > 0 && cssH > 0)) return old;
  if (!TOUCH_BANDS_ENABLED) {
    // Sin bandas DOM: el lienzo llena la caja (par, hasta TOUCH_MAX_W) y los controles van siempre dentro del
    // juego. Antes, con la interfaz al 150 %, cada banda crecía hasta 174 px CSS casi vacíos.
    let full = Math.min(TOUCH_MAX_W, Math.floor((baseH * cssW) / cssH));
    full -= full % 2;
    return Math.max(baseW, full);
  }
  if (old !== baseW) return old;
  // Solo donde ya se jugaba en modo «lienzo» (banda < MIN_BAND_CSS): con bandas DOM (p. ej. Safari con barras a
  // 667×258, banda 104) pasar los botones al lienzo los haría más pequeños (< 44 px CSS), así que no se toca.
  if (touchScreen(cssW, cssH, baseW).mode !== 'canvas') return old;
  const want = Math.floor((baseH * cssW) / cssH);
  let w = Math.min(TOUCH_MAX_W, want);
  w -= w % 2;
  if (w <= baseW) return old;
  if (hudBandScale(w, 240, HUD_LEFT_SEGS_TOUCH_CANVAS, baseH) < TOUCH_HUD_MIN_GAIN) return old;
  // Sin bandas: el lienzo ocupa la caja y los controles siguen dentro (modo «lienzo»)
  if (touchScreen(cssW, cssH, w).mode !== 'canvas') return old;
  return w;
}

/** ¿Lienzo táctil ensanchado SIN bandas (controles dentro del lienzo y paneles escalados)? */
export function touchCanvasWide(cssW: number, cssH: number, lw: number, baseW = 1920): boolean {
  if (!TOUCH_BANDS_ENABLED) return lw > baseW;
  return lw > baseW && touchScreen(cssW, cssH, lw).mode === 'canvas';
}

/** Tramos de los paneles del HUD táctil: con los botones dentro del lienzo ensanchado, o los de siempre. */
export function touchHudSegs(canvasWide: boolean): { left: HudSeg[]; right: HudSeg[] } {
  return canvasWide ? { left: HUD_LEFT_SEGS_TOUCH_CANVAS, right: HUD_RIGHT_SEGS_TOUCH_CANVAS } : { left: HUD_LEFT_SEGS, right: HUD_RIGHT_SEGS_TOUCH };
}
