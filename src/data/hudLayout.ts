// Colocación del panel izquierdo del HUD de la partida (pausa, parry, adrenalina, medidor de poder, ficha del
// Pokémon con Poké Ball y Mega Piedra, contadores y rejilla de objetos pasivos).
// Lógica pura, sin Phaser, para poder testearla: con 0, 5, 10 o 16 objetos, nombres largos y todas las piezas a
// la vez, nada se pisa ni se sale de su cuadro. Las x son relativas al borde izquierdo del contenido (LX) y las y
// son absolutas (coordenadas reales de pantalla, 1920 × 1080).

export interface HudRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Alto de la etiqueta de tecla/botón (ver paintActionBadges). */
export const HUD_BADGE_H = 20;
/** Ancho máximo del fondo de la etiqueta de tecla bajo la Poké Ball y la Mega Piedra, y bajo bomba y poción
 * (si el nombre de la tecla es más largo, el texto se encoge para caber). */
export const HUD_BADGE_MAX_W = { ball: 38, mega: 38, counter: 44 } as const;
/** Tamaño de la fuente del texto de progreso (piso, clima, huevo…) y su máximo de líneas. */
export const HUD_PROGRESS_FONT = 14;
export const HUD_PROGRESS_LINES = 2;
/** Nombre del Pokémon: tamaño normal y mínimo (se encoge para no pisar la Poké Ball ni la Mega Piedra). */
export const HUD_NAME_FONT = 24;
export const HUD_NAME_MIN_FONT = 14;
/** Rejilla de objetos: radio del círculo de cada icono y separación mínima entre centros. */
export const HUD_ITEM_R = 20;
export const HUD_ITEM_GAP = 46;
/** Ancho de un contador: icono de 24 px + hueco + «99» en 16 px. */
export const COUNTER_W = 46;
/** Título «Objetos 7/10» (fuente de 15 px). */
export const HUD_ITEMS_TITLE_H = 18;

export interface HudLayout {
  pause: HudRect;
  parry: HudRect;
  parryBadge: { x: number; y: number };
  adrenaline: HudRect;
  meter: HudRect;
  card: HudRect;
  /** Centro vertical del nombre y ancho máximo (con y sin Mega Piedra a la vista). */
  name: { x: number; y: number; maxW: number; maxWMega: number };
  ball: { x: number; y: number; r: number; badgeY: number };
  mega: { x: number; y: number; r: number; badgeY: number };
  /** Texto de progreso: esquina de arriba a la izquierda y ancho de ajuste de línea. */
  progress: { x: number; y: number; w: number };
  hpBar: HudRect;
  hpText: { x: number; y: number };
  counters: HudRect;
  /** Centro vertical de los iconos y de las etiquetas de tecla de bomba y poción. */
  counterIconY: number;
  counterBadgeY: number;
  /** x del icono de cada contador (relativa a LX). */
  counterX: { coin: number; key: number; bomb: number; potion: number };
  itemsTitleY: number;
  /** Centro de la primera fila de iconos de objetos. */
  itemsY: number;
}

export function hudLayout(lw: number): HudLayout {
  const pause = { x: 0, y: 16, w: 64, h: 64 };
  const parry = { x: 76, y: 16, w: lw - 76, h: 30 };
  const adrenaline = { x: 76, y: 50, w: lw - 76, h: 30 };
  const meter = { x: 80, y: 84, w: lw - 84, h: 9 };
  const cardY = 104;
  const nameY = cardY + 28;
  const ball = { x: lw - 30, y: nameY, r: 17, badgeY: cardY + 56 };
  const mega = { x: lw - 72, y: nameY, r: 17, badgeY: cardY + 56 };
  const progressY = cardY + 70;
  const progressH = HUD_PROGRESS_LINES * (HUD_PROGRESS_FONT + 4);
  const hpBar = { x: 16, y: progressY + progressH + 6, w: lw - 32, h: 14 };
  const hpTextY = hpBar.y + hpBar.h + 20;
  const card = { x: 0, y: cardY, w: lw, h: hpTextY + 24 - cardY };
  const counters = { x: 0, y: card.y + card.h + 12, w: lw, h: 76 };
  const itemsTitleY = counters.y + counters.h + 14;
  return {
    pause,
    parry,
    parryBadge: { x: lw - 22, y: parry.y + parry.h / 2 },
    adrenaline,
    meter,
    card,
    name: { x: 22, y: nameY, maxW: ball.x - ball.r - 8 - 22, maxWMega: mega.x - mega.r - 8 - 22 },
    ball,
    mega,
    progress: { x: 22, y: progressY, w: lw - 44 },
    hpBar,
    hpText: { x: lw - 22, y: hpTextY },
    counters,
    counterIconY: counters.y + 28,
    counterBadgeY: counters.y + 56,
    // Cada contador: icono de 24 px (centro x) y la cifra justo a su derecha (hasta «99» en 16 px)
    counterX: { coin: 16, key: 16 + (lw - 60) / 3, bomb: 16 + ((lw - 60) / 3) * 2, potion: 16 + (lw - 60) },
    itemsTitleY,
    itemsY: itemsTitleY + HUD_ITEMS_TITLE_H + 8 + HUD_ITEM_R,
  };
}

/** Columnas de la rejilla de objetos y separación entre centros, repartidas en todo el ancho. */
export function itemGridCols(lw: number): { cols: number; step: number } {
  const cols = Math.max(1, Math.floor((lw - HUD_ITEM_R * 2) / HUD_ITEM_GAP) + 1);
  const step = cols > 1 ? (lw - HUD_ITEM_R * 2) / (cols - 1) : 0;
  return { cols, step };
}

/** Centro de cada icono de objeto (x relativa a LX). */
export function itemGrid(n: number, lw: number): { x: number; y: number }[] {
  const { itemsY } = hudLayout(lw);
  const { cols, step } = itemGridCols(lw);
  return Array.from({ length: Math.max(0, n) }, (_, k) => ({
    x: HUD_ITEM_R + (k % cols) * step,
    y: itemsY + Math.floor(k / cols) * HUD_ITEM_GAP,
  }));
}

/** Ancho aproximado de un texto en negrita de la fuente del juego (para elegir tamaño antes de medirlo). */
export const approxTextWidth = (text: string, size: number): number => text.length * size * 0.62;

/** Tamaño de fuente del nombre para que quepa en `maxW` (nunca menos de HUD_NAME_MIN_FONT). */
export function nameFontSize(name: string, maxW: number): number {
  for (let s = HUD_NAME_FONT; s > HUD_NAME_MIN_FONT; s--) if (approxTextWidth(name, s) <= maxW) return s;
  return HUD_NAME_MIN_FONT;
}

/** Rectángulos de todo lo que se dibuja (para comprobar en los tests que nada se pisa ni se sale). */
export function hudRects(lw: number, items: number): Record<string, HudRect> {
  const l = hudLayout(lw);
  const circ = (x: number, y: number, r: number): HudRect => ({ x: x - r, y: y - r, w: r * 2, h: r * 2 });
  const badge = (x: number, y: number, w: number): HudRect => ({ x: x - w / 2 - 2, y: y - HUD_BADGE_H / 2, w: w + 4, h: HUD_BADGE_H });
  const out: Record<string, HudRect> = {
    pause: l.pause,
    parry: l.parry,
    adrenaline: l.adrenaline,
    meter: l.meter,
    name: { x: l.name.x, y: l.name.y - HUD_NAME_FONT / 2 - 2, w: l.name.maxWMega, h: HUD_NAME_FONT + 4 },
    ball: circ(l.ball.x, l.ball.y, l.ball.r),
    mega: circ(l.mega.x, l.mega.y, l.mega.r),
    ballBadge: badge(l.ball.x, l.ball.badgeY, HUD_BADGE_MAX_W.ball),
    megaBadge: badge(l.mega.x, l.mega.badgeY, HUD_BADGE_MAX_W.mega),
    progress: { x: l.progress.x, y: l.progress.y, w: l.progress.w, h: HUD_PROGRESS_LINES * (HUD_PROGRESS_FONT + 4) },
    hpBar: l.hpBar,
    hpText: { x: l.hpText.x - 100, y: l.hpText.y - 12, w: 100, h: 24 },
    itemsTitle: { x: 0, y: l.itemsTitleY, w: 120, h: HUD_ITEMS_TITLE_H },
  };
  for (const k of ['coin', 'key', 'bomb', 'potion'] as const) {
    const x = l.counterX[k];
    out[`${k}Icon`] = { x: x - 12, y: l.counterIconY - 14, w: COUNTER_W, h: 28 };
    if (k === 'bomb' || k === 'potion') out[`${k}Badge`] = badge(x + 6, l.counterBadgeY, HUD_BADGE_MAX_W.counter);
  }
  itemGrid(items, lw).forEach((p, k) => (out[`item${k}`] = circ(p.x, p.y, HUD_ITEM_R)));
  return out;
}
