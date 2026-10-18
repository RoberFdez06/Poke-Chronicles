// Tamaños de pantalla en un solo sitio (T30).
//
// El juego se dibuja a 1920×1080 (16:9) y se adapta a la ventana con Scale.FIT. Las pantallas de menú están
// compuestas en un espacio de diseño de 960×640 (DW × DH) que la cámara escala sin suavizar (×1,6875) y centra:
// los cuadros y gráficos son vectoriales, el pixel art va con NEAREST y los textos se generan a doble resolución
// (ver main.ts), así que nada se ve borroso. Lo que sobra a los lados en 16:9 son las "bandas", que se rellenan con
// el fondo (COVER_*). La partida usa otra cámara (ver GAME_VIEW) y su HUD va en coordenadas reales de pantalla.
import type Phaser from 'phaser';

/** Pantalla real. */
export const W = 1920;
export const H = 1080;
export const CX = W / 2;
export const CY = H / 2;

/** Espacio de diseño de los menús. */
export const DW = 960;
export const DH = 640;
export const DCX = DW / 2;
export const DCY = DH / 2;

/** Cuánto se escala el diseño para ocupar todo el alto. */
export const U = Math.min(W / DW, H / DH);

/** Lo que se ve del espacio de diseño en 16:9 (con las bandas): para fondos y capas que tapan toda la pantalla. */
export const COVER_W = W / U;
export const COVER_H = H / U;
/** Ancho de cada banda lateral, en unidades de diseño. */
export const BAND = (COVER_W - DW) / 2;

/** Coordenada de diseño pegada al borde izquierdo o derecho real de la pantalla (no al del diseño). */
export const fromLeft = (x: number): number => -BAND + x;
export const fromRight = (x: number): number => DW + BAND - x;

/** Pone la cámara de una pantalla de menú en el espacio de diseño 960×640, centrado y escalado. */
export function fitDesign(scene: Phaser.Scene) {
  const cam = scene.cameras.main;
  cam.setZoom(U);
  cam.centerOn(DCX, DCY);
}

/**
 * Partida: la sala (una celda de 960×640 del mundo) se ve entera en el centro, escalada ×1,5, y alrededor quedan
 * franjas para el HUD: 240 px a cada lado y 60 px arriba y abajo (N8: el HUD ya no tapa la sala ni sus puertas).
 */
export const GAME_ZOOM = 1.5;
export const GAME_VIEW = {
  x: (W - DW * GAME_ZOOM) / 2,
  y: (H - DH * GAME_ZOOM) / 2,
  w: DW * GAME_ZOOM,
  h: DH * GAME_ZOOM,
};
/** Franjas del HUD de la partida (coordenadas reales). */
export const HUD = {
  left: { x: 0, w: GAME_VIEW.x },
  right: { x: GAME_VIEW.x + GAME_VIEW.w, w: W - GAME_VIEW.x - GAME_VIEW.w },
  top: { y: 0, h: GAME_VIEW.y },
  bottom: { y: GAME_VIEW.y + GAME_VIEW.h, h: H - GAME_VIEW.y - GAME_VIEW.h },
  pad: 16,
};
