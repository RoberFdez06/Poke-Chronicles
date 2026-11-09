// Seguro contra teclas «pilladas» en teclado: una tecla que el juego cree pulsada porque su keyup no llegó (cambiar de
// pestaña o de ventana, Alt+Tab, abrir el menú del sistema, soltarla mientras la escena estaba parada o en una
// transición, Cmd en macOS, que se traga los keyup de las demás teclas, teclas muertas o IME que mandan otro código al
// soltar…). Es lo mismo que data/touchPointers.ts hace con los dedos. Lógica pura (sin Phaser ni DOM): ui/keyGuard.ts
// le pasa los eventos del navegador y, cada fotograma, suelta en Phaser las teclas que aquí ya no están pulsadas.

/** Códigos (keyCode) de las teclas modificadoras. */
export const KEY_SHIFT = 16;
export const KEY_CTRL = 17;
export const KEY_ALT = 18;
/** Cmd/Windows izquierda y derecha (Chrome), menú contextual y Cmd en Firefox. */
export const META_KEYS: readonly number[] = [91, 92, 93, 224];
/** keyCode que mandan los navegadores mientras un IME o una tecla muerta está componiendo: no es una tecla real. */
export const IME_KEY = 229;

export interface KeyHold {
  /** keyCode → momento (ms) de su último keydown. */
  readonly held: ReadonlyMap<number, number>;
  /** Tecla física (`KeyboardEvent.code`) → keyCode con el que bajó (para soltarla aunque suba con otro código). */
  readonly phys: ReadonlyMap<string, number>;
}

export interface Mods {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

export type KeyEvt =
  | { type: 'down'; key: number; phys?: string; t: number; mods?: Mods }
  | { type: 'up'; key: number; phys?: string; mods?: Mods }
  /** Estado real de los modificadores que trae cualquier evento de teclado o ratón. */
  | { type: 'mods'; mods: Mods }
  /** Pérdida de foco, pestaña oculta, pagehide, menú contextual del sistema: se sueltan todas. */
  | { type: 'blur' };

export const emptyKeys = (): KeyHold => ({ held: new Map(), phys: new Map() });

export const isMeta = (key: number): boolean => META_KEYS.includes(key);

/** Quita los modificadores que el evento dice que ya no están pulsados (Alt de un Alt+Tab, Shift soltado fuera…). */
function syncMods(held: Map<number, number>, m: Mods) {
  if (!m.shift) held.delete(KEY_SHIFT);
  if (!m.ctrl) held.delete(KEY_CTRL);
  if (!m.alt) held.delete(KEY_ALT);
  if (!m.meta) for (const k of META_KEYS) held.delete(k);
}

/** Nuevo estado tras un evento (no modifica el anterior). */
export function stepKeys(s: KeyHold, e: KeyEvt): KeyHold {
  if (e.type === 'blur') return emptyKeys();
  const held = new Map(s.held);
  const phys = new Map(s.phys);
  switch (e.type) {
    case 'down':
      if (e.key !== IME_KEY && e.key > 0) {
        held.set(e.key, e.t);
        if (e.phys) phys.set(e.phys, e.key);
      }
      break;
    case 'up': {
      held.delete(e.key);
      // La misma tecla física pudo bajar con otro código (Mayús, AltGr, tecla muerta): se suelta también ese
      if (e.phys) {
        const was = phys.get(e.phys);
        if (was !== undefined) held.delete(was);
        phys.delete(e.phys);
      }
      // macOS: con Cmd pulsado no llegan los keyup de las demás teclas; al soltar Cmd se sueltan todas
      if (isMeta(e.key)) {
        held.clear();
        phys.clear();
      }
      break;
    }
    case 'mods':
      break;
  }
  if (e.type !== 'down' || !isModifierKey(e.key)) {
    if (e.mods) syncMods(held, e.mods);
  } else if (e.mods) {
    // El keydown de un modificador ya lo trae puesto; solo se corrigen los demás
    syncMods(held, { ...e.mods, ...modFlag(e.key) });
  }
  for (const [p, k] of phys) if (!held.has(k)) phys.delete(p);
  return { held, phys };
}

const isModifierKey = (k: number): boolean => k === KEY_SHIFT || k === KEY_CTRL || k === KEY_ALT || isMeta(k);
const modFlag = (k: number): Partial<Mods> =>
  k === KEY_SHIFT ? { shift: true } : k === KEY_CTRL ? { ctrl: true } : k === KEY_ALT ? { alt: true } : isMeta(k) ? { meta: true } : {};

export const isHeld = (s: KeyHold, key: number): boolean => s.held.has(key);

/** ¿Hay algún modificador pulsado? (para no mirar los modificadores en cada movimiento del ratón sin necesidad). */
export const anyModHeld = (s: KeyHold): boolean => [KEY_SHIFT, KEY_CTRL, KEY_ALT, ...META_KEYS].some((k) => s.held.has(k));

/**
 * Teclas que el juego cree pulsadas y el navegador ya no: hay que soltarlas. Una tecla quieta y pulsada no se suelta
 * por tiempo (al mantener W y tocar D, el navegador deja de repetir W aunque siga pulsada).
 */
export function stuckKeys(s: KeyHold, gameKeys: Iterable<{ keyCode: number; isDown: boolean }>): number[] {
  const out: number[] = [];
  for (const k of gameKeys) if (k.isDown && !s.held.has(k.keyCode)) out.push(k.keyCode);
  return out;
}

/**
 * Pulsación breve (keydown y keyup procesados en el mismo fotograma, como un Enter sintético o un toque muy rápido):
 * Phaser borra el «recién pulsada» de la tecla al soltarla y `JustDown` no la ve nunca. Se conserva hasta el final de
 * ese fotograma (después se borra: una tecla que nadie miró no vale como pulsación en fotogramas posteriores).
 */
export const keepJustDown = (wasJustDown: boolean, downFrame: number, upFrame: number): boolean => wasJustDown && downFrame === upFrame;
