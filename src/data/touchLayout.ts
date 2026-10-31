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
