// Colocación vertical de la parte baja del panel de la pausa (objetos, reacciones y poderes).
// Lógica pura, sin Phaser, para poder testearla: la lista de objetos puede ocupar 1, 2 o 3 líneas y todo lo que
// va debajo se recoloca a partir de dónde termina de verdad.

/** Donde empieza la lista de objetos (justo bajo el título «Objetos»). */
export const PAUSE_ITEMS_Y = 436;
/** Alto de una línea de objetos (fuente de 14 px). */
export const PAUSE_ITEM_LINE_H = 17;
/** Máximo de líneas que se dibujan para los objetos (el resto se recorta). */
export const PAUSE_ITEM_MAX_LINES = 3;
/** Alto del panel por defecto y donde empieza (ver PauseScene). */
export const PAUSE_PANEL_Y = 100;
export const PAUSE_PANEL_MIN_H = 470;

export interface PauseTailLayout {
  /** Líneas de objetos realmente usadas (1..3). */
  itemLines: number;
  reactionsY: number | null;
  powersTitleY: number;
  movesY: number;
  /** Borde inferior del contenido. */
  bottom: number;
  /** Alto que debe tener el panel para que todo quepa. */
  panelH: number;
}

/** Líneas de objetos a partir del alto real del texto dibujado (o una estimación). */
export function itemLinesFromHeight(height: number): number {
  const n = Math.round(height / PAUSE_ITEM_LINE_H);
  return Math.min(PAUSE_ITEM_MAX_LINES, Math.max(1, n));
}

export function pauseTailLayout(itemLines: number, hasReactions: boolean, moveCount: number): PauseTailLayout {
  const lines = Math.min(PAUSE_ITEM_MAX_LINES, Math.max(1, Math.floor(itemLines)));
  const afterItems = PAUSE_ITEMS_Y + lines * PAUSE_ITEM_LINE_H;
  const reactionsY = hasReactions ? afterItems + 3 : null;
  const powersTitleY = reactionsY !== null ? reactionsY + 18 : afterItems + 21;
  const movesY = powersTitleY + 26;
  const rows = Math.ceil(Math.max(0, moveCount) / 2);
  const bottom = movesY + rows * 30 + 8;
  return { itemLines: lines, reactionsY, powersTitleY, movesY, bottom, panelH: Math.max(PAUSE_PANEL_MIN_H, bottom - PAUSE_PANEL_Y) };
}
