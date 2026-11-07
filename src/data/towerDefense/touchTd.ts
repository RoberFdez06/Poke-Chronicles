// Defensa de torres en móvil o tableta táctil (rama `tdmovil`): disposición propia, solo en dispositivos táctiles
// (teclado, ratón y mando siguen con la de siempre). Parte pura (sin Phaser ni DOM), con pruebas en
// tests/tdTouch.test.ts. Unidades: «px CSS» de la página, «diseño» = el espacio 960×640 de las pantallas de menú
// (la cámara lo escala ×1,6875 hasta los 1080 px del lienzo) y «lienzo» = px del lienzo de Phaser.
//
// Idea: en un móvil apaisado el alto manda (258-430 px CSS), así que una barra arriba y otra abajo se comen el mapa.
// Aquí los botones van en dos COLUMNAS a los lados (izquierda: pausa, velocidad, oleada y habilidades; derecha: el
// equipo o la hoja de la torre/camino) y el mapa queda en el centro con todo el alto, con zoom y arrastre. Cada
// botón mide al menos 56 px CSS. El lienzo se ensancha hasta 3:1 (no hay bandas DOM fuera de la partida).

/** Lado mínimo de un botón táctil (px CSS). */
export const TD_TOUCH_CSS = 56;
/** Letra mínima de botones y textos (px CSS). */
export const TD_TEXT_CSS = 12;
/** Letra más pequeña permitida al encoger un texto largo para que quepa (px CSS). */
export const TD_TEXT_MIN_CSS = 10;
/** Aspecto máximo del lienzo táctil (igual que la partida: TOUCH_MAX_ASPECT). */
export const TD_MAX_ASPECT = 3;
/** Alto lógico del lienzo y escala de la cámara de diseño (1080 / 640). */
export const CANVAS_H = 1080;
export const DESIGN_W = 960;
export const DESIGN_H = 640;
export const DESIGN_ZOOM = CANVAS_H / DESIGN_H;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const rectContains = (r: Rect, x: number, y: number): boolean => x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
export const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
export const inside = (a: Rect, b: Rect, eps = 1e-6): boolean => a.x >= b.x - eps && a.y >= b.y - eps && a.x + a.w <= b.x + b.w + eps && a.y + a.h <= b.y + b.h + eps;

/**
 * Ancho lógico del lienzo para las pantallas de la Defensa de torres en táctil: llena el ancho de la caja (sin
 * bandas) hasta 3:1; nunca menos de 1920 (con la caja más estrecha que 16:9 el lienzo se ajusta al ancho). Par.
 */
export function tdTouchWidth(cssW: number, cssH: number, maxAspect = TD_MAX_ASPECT, baseW = 1920): number {
  if (!(cssW > 0 && cssH > 0)) return baseW;
  let w = Math.min(Math.round(CANVAS_H * maxAspect), Math.floor((CANVAS_H * cssW) / cssH));
  w -= w % 2;
  return Math.max(baseW, w);
}

/** px CSS por unidad de diseño con un lienzo de `lw`×1080 ajustado (Scale.FIT) a la caja. */
export function cssPerUnit(cssW: number, cssH: number, lw: number): number {
  if (!(cssW > 0 && cssH > 0 && lw > 0)) return 0;
  return Math.min(cssW / lw, cssH / CANVAS_H) * DESIGN_ZOOM;
}

/** Lo que se ve del espacio de diseño con un lienzo de `lw` (centrado como fitDesign). */
export function designView(lw: number): Rect {
  const w = lw / DESIGN_ZOOM;
  return { x: (DESIGN_W - w) / 2, y: 0, w, h: DESIGN_H };
}

/** Diseño → lienzo (cámara de diseño centrada, como fitDesign). */
export function designToCanvas(r: Rect, lw: number): Rect {
  return { x: (r.x - DESIGN_W / 2) * DESIGN_ZOOM + lw / 2, y: (r.y - DESIGN_H / 2) * DESIGN_ZOOM + CANVAS_H / 2, w: r.w * DESIGN_ZOOM, h: r.h * DESIGN_ZOOM };
}
export function canvasToDesign(x: number, y: number, lw: number): { x: number; y: number } {
  return { x: (x - lw / 2) / DESIGN_ZOOM + DESIGN_W / 2, y: (y - CANVAS_H / 2) / DESIGN_ZOOM + DESIGN_H / 2 };
}

export interface TdTouchLayout {
  /** px CSS por unidad de diseño. */
  k: number;
  /** Lado de un botón, hueco y margen (diseño). */
  btn: number;
  gap: number;
  pad: number;
  /** Letras (diseño): normal, pequeña (mínimo al encoger) y grande. */
  font: number;
  fontMin: number;
  fontBig: number;
  view: Rect;
  left: Rect;
  right: Rect;
  /** Franja de datos (vida, dinero, oleada) encima del mapa y hueco del mapa debajo. */
  strip: Rect;
  map: Rect;
  pause: Rect;
  speed: Rect;
  wave: Rect;
  abilities: Rect[];
  /** Casillas del equipo (2 columnas) y fila de Confirmar / Cancelar debajo. */
  team: Rect[];
  confirm: Rect;
  cancel: Rect;
  /** Filas de botones que caben en cada columna. */
  rows: number;
  /** ¿Llegan los botones a TD_TOUCH_CSS? (false solo en cajas extremas, < 250 px CSS de alto). */
  ok: boolean;
}

/** Celda `col`,`row` de una columna de 2 botones. */
const cellOf = (col: Rect, btn: number, gap: number, c: number, r: number, span = 1): Rect => ({
  x: col.x + c * (btn + gap),
  y: col.y + r * (btn + gap),
  w: span * btn + (span - 1) * gap,
  h: btn,
});

/**
 * Disposición táctil de la partida para lo que se ve del diseño (`view`), a `k` px CSS por unidad. Izquierda
 * (de arriba abajo): [Pausa][Velocidad], [Oleada], 2×2 habilidades. Derecha: equipo 2×N y [Confirmar][Cancelar]
 * en la última fila (también ahí va la hoja de la torre o del camino). El mapa, en el centro con todo el alto.
 */
export function tdTouchLayout(view: Rect, k: number, teamN = 6, abilitiesN = 4): TdTouchLayout {
  const u = (css: number) => (k > 0 ? css / k : css);
  const pad = Math.ceil(u(4));
  const gap = Math.ceil(u(4));
  const availH = view.h - pad * 2;
  const leftRows = 2 + Math.ceil(abilitiesN / 2);
  const rightRows = Math.ceil(teamN / 2) + 1;
  const need = Math.max(leftRows, rightRows);
  // 56 px CSS; si no caben las filas (cajas muy bajas), lo justo para que quepan
  const btn = Math.max(1, Math.min(Math.ceil(u(TD_TOUCH_CSS)), Math.floor((availH - (need - 1) * gap) / need)));
  const rows = Math.max(need, Math.floor((availH + gap) / (btn + gap)));
  const colW = btn * 2 + gap;
  // Columnas centradas en vertical en su hueco: pegadas a los lados
  const colH = rows * btn + (rows - 1) * gap;
  const cy = view.y + pad + Math.max(0, (availH - colH) / 2);
  const left: Rect = { x: view.x + pad, y: cy, w: colW, h: colH };
  const right: Rect = { x: view.x + view.w - pad - colW, y: cy, w: colW, h: colH };
  const midX = left.x + colW + pad;
  const midW = Math.max(0, right.x - pad - midX);
  const stripH = Math.ceil(u(TD_TEXT_CSS + 10));
  const strip: Rect = { x: midX, y: view.y + pad, w: midW, h: stripH };
  const map: Rect = { x: midX, y: strip.y + stripH + gap, w: midW, h: Math.max(0, view.y + view.h - pad - (strip.y + stripH + gap)) };
  const L = (c: number, r: number, span = 1) => cellOf(left, btn, gap, c, r, span);
  const R = (c: number, r: number, span = 1) => cellOf(right, btn, gap, c, r, span);
  const abilities = Array.from({ length: abilitiesN }, (_, i) => L(i % 2, 2 + Math.floor(i / 2)));
  const team = Array.from({ length: teamN }, (_, i) => R(i % 2, Math.floor(i / 2)));
  const last = rows - 1;
  return {
    k,
    btn,
    gap,
    pad,
    font: Math.ceil(u(TD_TEXT_CSS)),
    fontMin: Math.ceil(u(TD_TEXT_MIN_CSS)),
    fontBig: Math.ceil(u(TD_TEXT_CSS + 3)),
    view,
    left,
    right,
    strip,
    map,
    pause: L(0, 0),
    speed: L(1, 0),
    wave: L(0, 1, 2),
    abilities,
    team,
    confirm: R(0, last),
    cancel: R(1, last),
    rows,
    ok: btn * k >= TD_TOUCH_CSS - 0.5,
  };
}

/** Todos los botones de la disposición (para pruebas de solapes y tamaños). */
export function layoutButtons(l: TdTouchLayout): Rect[] {
  return [l.pause, l.speed, l.wave, ...l.abilities, ...l.team, l.confirm, l.cancel];
}

/**
 * Hoja de acciones en la columna derecha: cada acción ocupa media fila (`span` 1) o la fila entera (2). Se llenan
 * por filas; una media que no tiene pareja queda sola. Si no caben todas, las que sobran salen null.
 */
export function sheetSlots(col: Rect, btn: number, gap: number, rows: number, spans: readonly (1 | 2)[]): (Rect | null)[] {
  const out: (Rect | null)[] = [];
  let r = 0;
  let c = 0;
  for (const s of spans) {
    if (c + s > 2) {
      r++;
      c = 0;
    }
    if (r >= rows) {
      out.push(null);
      continue;
    }
    out.push(cellOf(col, btn, gap, c, r, s));
    c += s;
    if (c >= 2) {
      r++;
      c = 0;
    }
  }
  return out;
}

// --- Mapa: zoom, arrastre y la casilla que se toca ------------------------------------------------------------

/** Zoom (px de lienzo por unidad de mundo) para que el mapa `world` quepa entero en `vp` (lienzo). */
export const fitZoom = (vp: { w: number; h: number }, world: { w: number; h: number }): number =>
  world.w > 0 && world.h > 0 ? Math.min(vp.w / world.w, vp.h / world.h) : 1;

/** Zoom máximo: la casilla llega a `cellCss` px CSS (con `cssPerCanvas` px CSS por px de lienzo). Nunca menos que `fit`. */
export const maxZoom = (fit: number, cell: number, cellCss: number, cssPerCanvas: number): number =>
  Math.max(fit, cssPerCanvas > 0 && cell > 0 ? cellCss / (cell * cssPerCanvas) : fit);

export const clampZoom = (z: number, fit: number, max: number): number => Math.max(fit, Math.min(max, z));

/**
 * Centro de la vista (mundo) para que no se salga del mapa: si la vista es más grande que el mapa en un eje, el
 * centro va al del mapa en ese eje.
 */
export function clampCenter(cx: number, cy: number, viewW: number, viewH: number, b: Rect): { x: number; y: number } {
  const ax = viewW >= b.w ? b.x + b.w / 2 : Math.max(b.x + viewW / 2, Math.min(b.x + b.w - viewW / 2, cx));
  const ay = viewH >= b.h ? b.y + b.h / 2 : Math.max(b.y + viewH / 2, Math.min(b.y + b.h - viewH / 2, cy));
  return { x: ax, y: ay };
}

/**
 * Zoom alrededor de un punto: el punto del mundo que está bajo (`fx`,`fy`) (desplazamiento en px de lienzo desde el
 * centro del visor) sigue debajo tras pasar de `z0` a `z1`. Devuelve el centro nuevo (sin acotar).
 */
export function zoomAbout(cx: number, cy: number, z0: number, z1: number, fx: number, fy: number): { x: number; y: number } {
  const wx = cx + fx / z0;
  const wy = cy + fy / z0;
  return { x: wx - fx / z1, y: wy - fy / z1 };
}

export interface CellPick {
  x: number;
  y: number;
}

/**
 * Casilla más cercana a un punto del mundo (`wx`,`wy`) entre `cells` (casillas de `cell` de lado desde `ox`,`oy`),
 * a como mucho `maxDist` unidades de mundo del centro de la casilla. La casilla bajo el dedo gana si está en la lista.
 */
export function nearestCell(wx: number, wy: number, cells: readonly CellPick[], ox: number, oy: number, cell: number, maxDist: number): CellPick | null {
  const ux = Math.floor((wx - ox) / cell);
  const uy = Math.floor((wy - oy) / cell);
  let best: CellPick | null = null;
  let bd = Infinity;
  for (const c of cells) {
    if (c.x === ux && c.y === uy) return { x: c.x, y: c.y };
    const dx = ox + (c.x + 0.5) * cell - wx;
    const dy = oy + (c.y + 0.5) * cell - wy;
    const d = Math.hypot(dx, dy);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best && bd <= maxDist ? { x: best.x, y: best.y } : null;
}

/**
 * Radio (px de lienzo) del anillo de confirmación: al menos la mitad de TD_TOUCH_CSS y nunca menos que la casilla.
 * Un toque dentro confirma. Así la zona efectiva es ≥ 56 px CSS aunque la casilla se vea de 20.
 */
export const ringRadius = (cellCanvas: number, cssPerCanvas: number, minCss = TD_TOUCH_CSS): number =>
  Math.max(cellCanvas * 0.75, cssPerCanvas > 0 ? minCss / 2 / cssPerCanvas : cellCanvas);

/** Distancia (mundo) hasta la que un toque se pega a la casilla válida más cercana: 28 px CSS, mínimo media casilla. */
export const snapRadius = (zoom: number, cssPerCanvas: number, cell: number, minCss = TD_TOUCH_CSS): number =>
  Math.max(cell * 0.5, zoom > 0 && cssPerCanvas > 0 ? minCss / 2 / (cssPerCanvas * zoom) : cell);

/**
 * Lupa: un cuadro de `size` (lienzo) encima del dedo, separado `lift`, dentro de `bounds`. Si arriba no cabe, va al
 * lado (el que tenga más sitio), así el dedo nunca la tapa.
 */
export function loupeRect(fx: number, fy: number, size: number, lift: number, bounds: Rect): Rect {
  const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const x0 = bounds.x;
  const x1 = bounds.x + bounds.w - size;
  const y0 = bounds.y;
  const y1 = bounds.y + bounds.h - size;
  const above = fy - lift - size;
  if (above >= y0) return { x: cl(fx - size / 2, x0, Math.max(x0, x1)), y: above, w: size, h: size };
  // Al lado con más sitio
  const y = cl(fy - size / 2, y0, Math.max(y0, y1));
  const roomLeft = fx - bounds.x;
  const roomRight = bounds.x + bounds.w - fx;
  const x = roomLeft > roomRight ? fx - lift - size : fx + lift;
  return { x: cl(x, x0, Math.max(x0, x1)), y, w: size, h: size };
}

/** Esquina para la ficha de información: la mitad del mapa contraria a la casilla elegida (no la tapa). */
export const infoSide = (cellScreenX: number, map: Rect): 'left' | 'right' => (cellScreenX < map.x + map.w / 2 ? 'right' : 'left');

// --- Gestos del mapa ------------------------------------------------------------------------------------------
// Un dedo: toque = elegir casilla; mantener quieto = lupa (al soltar, elige la casilla de la lupa); arrastrar =
// mover el mapa. Dos dedos: pellizco (zoom) y arrastre a la vez. Nunca más de dos dedos: un tercero se ignora.
// Seguro contra dedos pillados (como StickArbiter): `sync` suelta los dedos que el sistema ya no tiene pulsados,
// un `up` cancelado (touchcancel, touchSanity) nunca cuenta como toque y `releaseAll` (pausa, cambio de escena,
// perder el foco) lo suelta todo.

export const GESTURE_HOLD_MS = 320;

export type GestureOut =
  | { kind: 'tap'; x: number; y: number }
  | { kind: 'pan'; dx: number; dy: number }
  | { kind: 'pinch'; factor: number; cx: number; cy: number; dx: number; dy: number }
  | { kind: 'hold'; x: number; y: number }
  | { kind: 'holdEnd'; x: number; y: number; commit: boolean };

interface Finger {
  id: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  t0: number;
}

type Mode = 'idle' | 'press' | 'pan' | 'hold' | 'pinch';

export class MapGesture {
  private fingers: Finger[] = [];
  private mode: Mode = 'idle';
  private slop: number;
  private holdMs: number;
  /** `slop`: px (de lienzo) que puede moverse un dedo sin dejar de ser toque. */
  constructor(slop: number, holdMs = GESTURE_HOLD_MS) {
    this.slop = slop;
    this.holdMs = holdMs;
  }

  setSlop(s: number) {
    this.slop = s;
  }

  get active(): readonly number[] {
    return this.fingers.map((f) => f.id);
  }

  get state(): Mode {
    return this.mode;
  }

  /** ¿Se está mirando con la lupa? */
  get holding(): boolean {
    return this.mode === 'hold';
  }

  down(id: number, x: number, y: number, t: number): GestureOut[] {
    const out: GestureOut[] = [];
    const same = this.fingers.find((f) => f.id === id);
    if (same) {
      // El sistema reusa el id sin habernos dado su up: empieza de nuevo
      out.push(...this.lift(id, false));
    }
    if (this.fingers.length >= 2) return out;
    this.fingers.push({ id, x, y, sx: x, sy: y, t0: t });
    if (this.fingers.length === 1) this.mode = 'press';
    else {
      // Segundo dedo: pasa a pellizco (si había lupa, se cierra sin elegir)
      if (this.mode === 'hold') out.push({ kind: 'holdEnd', x: this.fingers[0].x, y: this.fingers[0].y, commit: false });
      this.mode = 'pinch';
    }
    return out;
  }

  move(id: number, x: number, y: number): GestureOut[] {
    const f = this.fingers.find((q) => q.id === id);
    if (!f) return [];
    const out: GestureOut[] = [];
    if (this.mode === 'pinch' && this.fingers.length === 2) {
      const [a, b] = this.fingers;
      const d0 = Math.hypot(a.x - b.x, a.y - b.y);
      const m0x = (a.x + b.x) / 2;
      const m0y = (a.y + b.y) / 2;
      f.x = x;
      f.y = y;
      const d1 = Math.hypot(a.x - b.x, a.y - b.y);
      const m1x = (a.x + b.x) / 2;
      const m1y = (a.y + b.y) / 2;
      const factor = d0 > 1 && d1 > 1 ? d1 / d0 : 1;
      out.push({ kind: 'pinch', factor, cx: m1x, cy: m1y, dx: m1x - m0x, dy: m1y - m0y });
      return out;
    }
    const px = f.x;
    const py = f.y;
    f.x = x;
    f.y = y;
    if (this.mode === 'press' && Math.hypot(x - f.sx, y - f.sy) > this.slop) {
      this.mode = 'pan';
      out.push({ kind: 'pan', dx: x - f.sx, dy: y - f.sy });
    } else if (this.mode === 'pan') out.push({ kind: 'pan', dx: x - px, dy: y - py });
    else if (this.mode === 'hold') out.push({ kind: 'hold', x, y });
    return out;
  }

  /** Cada fotograma: un dedo quieto `holdMs` abre la lupa. */
  tick(t: number): GestureOut[] {
    if (this.mode !== 'press' || this.fingers.length !== 1) return [];
    const f = this.fingers[0];
    if (t - f.t0 < this.holdMs) return [];
    this.mode = 'hold';
    return [{ kind: 'hold', x: f.x, y: f.y }];
  }

  /** Dedo levantado. `canceled` (touchcancel o cancelado por touchSanity): nunca es un toque. */
  up(id: number, x: number, y: number, canceled = false): GestureOut[] {
    const f = this.fingers.find((q) => q.id === id);
    if (!f) return [];
    f.x = x;
    f.y = y;
    return this.lift(id, !canceled);
  }

  private lift(id: number, commit: boolean): GestureOut[] {
    const f = this.fingers.find((q) => q.id === id);
    if (!f) return [];
    const out: GestureOut[] = [];
    this.fingers = this.fingers.filter((q) => q !== f);
    if (this.fingers.length === 0) {
      if (this.mode === 'press' && commit) out.push({ kind: 'tap', x: f.x, y: f.y });
      else if (this.mode === 'hold') out.push({ kind: 'holdEnd', x: f.x, y: f.y, commit });
      this.mode = 'idle';
    } else {
      // Queda un dedo tras el pellizco: sigue moviendo el mapa (nunca es un toque)
      const r = this.fingers[0];
      r.sx = r.x;
      r.sy = r.y;
      this.mode = 'pan';
    }
    return out;
  }

  /** Suelta los dedos que el sistema ya no tiene pulsados (sin toque ni elección). */
  sync(isLive: (id: number) => boolean): GestureOut[] {
    const out: GestureOut[] = [];
    for (const f of [...this.fingers]) if (!isLive(f.id)) out.push(...this.lift(f.id, false));
    return out;
  }

  /** Lo suelta todo (pausa, perder el foco, cambio de escena). */
  releaseAll(): GestureOut[] {
    const out: GestureOut[] = [];
    for (const f of [...this.fingers]) out.push(...this.lift(f.id, false));
    this.mode = 'idle';
    return out;
  }
}

/**
 * Al cerrarse una pantalla de la Defensa de torres: ¿sigue haciendo falta el lienzo a todo el ancho? Sí si alguna
 * de ellas está arrancando, abierta, en pausa o dormida (estados de escena de Phaser INIT..SLEEPING = 1..7); con
 * todas cerradas (SHUTDOWN 8) o sin arrancar (PENDING 0) se vuelve al ancho de siempre.
 */
export const tdWidthStillNeeded = (statuses: readonly number[], init = 1, sleeping = 7): boolean => statuses.some((s) => s >= init && s <= sleeping);
