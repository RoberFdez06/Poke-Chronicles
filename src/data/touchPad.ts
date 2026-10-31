// Controles táctiles de la partida, parte pura (sin Phaser): joysticks flotantes y colocación de los botones.
// Todo en coordenadas reales del lienzo (1920 × 1080, ver ui/layout.ts). En un móvil apaisado el lienzo se ve
// a ~0,35, así que 100 px de lienzo son ~35 px CSS: los tamaños de abajo están pensados para eso y se pueden
// afinar a ojo en un móvil real cambiando solo estas constantes.

export interface PadRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Radio del joystick (base) y del pomo, en px de lienzo. */
export const STICK_R = 110;
export const STICK_KNOB = 46;
/** Zona muerta (fracción del radio): por debajo el joystick da 0. */
export const STICK_DEAD = 0.15;
/** Si el dedo se aleja más de esto (× radio), la base lo sigue (así no hay que volver al centro). */
export const STICK_DRAG = 1.35;

export type StickSide = 'move' | 'aim';

/**
 * Vector de un joystick flotante: base en `origin`, dedo en `finger`. Devuelve la dirección con largo 0..1 (0
 * dentro de la zona muerta), dónde dibujar el pomo y dónde queda la base (se arrastra si el dedo se va lejos).
 */
export function stickVector(
  origin: { x: number; y: number },
  finger: { x: number; y: number },
  r = STICK_R,
  dead = STICK_DEAD,
  drag = STICK_DRAG,
): { x: number; y: number; knobX: number; knobY: number; baseX: number; baseY: number } {
  let bx = origin.x;
  let by = origin.y;
  let dx = finger.x - bx;
  let dy = finger.y - by;
  let len = Math.hypot(dx, dy);
  if (len > r * drag) {
    // La base se acerca al dedo hasta quedar a `drag` radios
    const k = (len - r * drag) / len;
    bx += dx * k;
    by += dy * k;
    dx = finger.x - bx;
    dy = finger.y - by;
    len = Math.hypot(dx, dy);
  }
  const l = Math.min(len, r);
  if (!(len > 0) || l < r * dead) return { x: 0, y: 0, knobX: bx + (len > 0 ? (dx / len) * l : 0), knobY: by + (len > 0 ? (dy / len) * l : 0), baseX: bx, baseY: by };
  const ux = dx / len;
  const uy = dy / len;
  // De la zona muerta al borde va de 0 a 1 (sin salto al salir de la zona muerta)
  const mag = Math.min(1, (l - r * dead) / (r * (1 - dead)));
  return { x: ux * mag, y: uy * mag, knobX: bx + ux * l, knobY: by + uy * l, baseX: bx, baseY: by };
}

const inRect = (x: number, y: number, r: PadRect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/**
 * Qué joystick nace con un dedo en (x, y): mitad izquierda = moverse, mitad derecha = apuntar. Nada si cae en
 * una zona reservada (`blocked`: ranuras de poder, pausa, minimapa…).
 */
export function stickZone(x: number, y: number, screenW: number, blocked: readonly PadRect[] = []): StickSide | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (blocked.some((b) => inRect(x, y, b))) return null;
  return x < screenW / 2 ? 'move' : 'aim';
}

export type PadButton = 'parry' | 'dash' | 'active' | 'bomb' | 'potion' | 'use';

/** Lado de cada botón (px de lienzo; múltiplos de la rejilla de 24 del marco pixel: ×4 y ×3) para que los píxeles
 * salgan iguales. Defensa, activo y Usar, grandes; Bomba y Poción, más pequeños (la zona de toque es mayor). */
export const PAD_BTN_BIG = 96;
export const PAD_BTN_SMALL = 72;
/** Hueco entre botones. */
export const PAD_GAP = 8;
const PAD_GAP_BASE = PAD_GAP;

/**
 * Dónde va cada botón (centro y lado). `left`/`right` son las franjas laterales del HUD; `slotsTop` es la y de
 * arriba de la primera ranura de poder (los botones de la derecha quedan justo encima, en su propia fila).
 *  - Derecha, encima de las ranuras 1-4: Parry y Esquiva (pulgar derecho, sin tapar las ranuras).
 *  - Izquierda, abajo (donde en PC está el cuadro del objeto activo): Activo y Bomba; encima, Usar y Poción.
 */
export function padButtons(
  left: { x: number; w: number },
  right: { x: number; w: number },
  screenH: number,
  pad: number,
  slotsTop: number,
  /** Tamaño de la interfaz (1 = 100 %): agranda botones y huecos. */
  k = 1,
): Record<PadButton, { x: number; y: number; size: number }> {
  // Sin salirse de las franjas: el aumento se queda en lo que quepa
  const fitL = (left.w - pad * 2) / (PAD_BTN_BIG + PAD_GAP_BASE + PAD_BTN_SMALL);
  const fitR = (right.w - pad * 2) / (PAD_BTN_BIG * 2 + PAD_GAP_BASE);
  k = Math.max(1, Math.min(k, fitL, fitR));
  const B = PAD_BTN_BIG * k;
  const S = PAD_BTN_SMALL * k;
  const PAD_GAP = PAD_GAP_BASE * k;
  const rx = right.x + pad;
  const ry = slotsTop - PAD_GAP * 2 - B / 2;
  const lx = left.x + pad;
  const bottom = screenH - pad - B / 2 - 10;
  const row2 = bottom - B / 2 - PAD_GAP * 2 - B / 2;
  const leftCol2 = lx + B + PAD_GAP + S / 2;
  return {
    parry: { x: rx + B / 2, y: ry, size: B },
    dash: { x: rx + B + PAD_GAP + B / 2, y: ry, size: B },
    active: { x: lx + B / 2, y: bottom, size: B },
    bomb: { x: leftCol2, y: bottom + (B - S) / 2, size: S },
    use: { x: lx + B / 2, y: row2, size: B },
    potion: { x: leftCol2, y: row2 + (B - S) / 2, size: S },
  };
}

/** Rectángulo de un botón (para pruebas y zonas reservadas). */
export const padRect = (b: { x: number; y: number; size: number }): PadRect => ({ x: b.x - b.size / 2, y: b.y - b.size / 2, w: b.size, h: b.size });

/**
 * El botón que toca un dedo: el más cercano cuyo centro está a menos de su radio de toque (`hitR(size)`), entre
 * los visibles. Así una zona de toque generosa no roba el toque a su vecino.
 */
export function hitPadButton<T extends { x: number; y: number; size: number; visible: boolean }>(
  px: number,
  py: number,
  buttons: readonly T[],
  hitR: (size: number) => number,
): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const b of buttons) {
    if (!b.visible) continue;
    const d = Math.hypot(px - b.x, py - b.y);
    if (d <= hitR(b.size) && d < bestD) {
      best = b;
      bestD = d;
    }
  }
  return best;
}
