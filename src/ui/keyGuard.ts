// Capa de teclado robusta (ver data/keyHold.ts): lleva qué teclas están pulsadas según el navegador y, cada fotograma,
// suelta en todas las escenas las teclas de Phaser que se quedaron «pilladas». Suelta todo al perder el foco, ocultar la
// pestaña, pagehide o abrirse el menú contextual del sistema, y las teclas de una escena al reanudarse o despertarse.
// No toca el ratón, el mando ni el táctil.
import Phaser from 'phaser';
import { anyModHeld, emptyKeys, isHeld, keepJustDown, stepKeys, stuckKeys, type KeyEvt, type KeyHold, type Mods } from '../data/keyHold';

let state: KeyHold = emptyKeys();
const navListeners = new Set<() => void>();

const step = (e: KeyEvt) => {
  state = stepKeys(state, e);
};

/** ¿Está esta tecla (keyCode) pulsada de verdad? */
export const keyHeldNow = (keyCode: number): boolean => isHeld(state, keyCode);

/** Avisa en cada keydown (para que el ratón vuelva a mandar sobre la selección al moverse, ui/menuPointer.ts). */
export function onKeyNav(f: () => void): () => void {
  navListeners.add(f);
  return () => void navListeners.delete(f);
}

const modsOf = (e: { shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean }): Mods => ({
  shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey,
});

type PhaserKey = Phaser.Input.Keyboard.Key;

/** Teclas de Phaser de una escena (el array de KeyboardPlugin es disperso). */
function sceneKeys(scene: Phaser.Scene): PhaserKey[] {
  const kb = (scene.input as Phaser.Input.InputPlugin | undefined)?.keyboard as (Phaser.Input.Keyboard.KeyboardPlugin & { keys?: (PhaserKey | undefined)[] }) | null | undefined;
  return (kb?.keys ?? []).filter((k): k is PhaserKey => !!k);
}

/** Suelta en todas las escenas las teclas que el navegador ya no tiene pulsadas. */
function releaseStuck(game: Phaser.Game) {
  for (const scene of game.scene.scenes) {
    const keys = sceneKeys(scene);
    if (!keys.length) continue;
    const stuck = new Set(stuckKeys(state, keys));
    if (stuck.size) for (const k of keys) if (stuck.has(k.keyCode)) k.reset();
  }
}

let installed = false;

/** Engancha el seguro (una vez, al crear el juego). */
export function installKeyGuard(game: Phaser.Game) {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  // Fase de captura: se entera antes que Phaser y aunque alguien pare el evento
  window.addEventListener('keydown', (e) => {
    step({ type: 'down', key: e.keyCode, phys: e.code, t: e.timeStamp, mods: modsOf(e) });
    navListeners.forEach((f) => f());
  }, true);
  window.addEventListener('keyup', (e) => step({ type: 'up', key: e.keyCode, phys: e.code, mods: modsOf(e) }), true);
  // El ratón también trae el estado real de Mayús, Ctrl, Alt y Cmd (un Alt soltado fuera de la ventana)
  const mods = (e: PointerEvent) => anyModHeld(state) && step({ type: 'mods', mods: modsOf(e) });
  window.addEventListener('pointerdown', mods, true);
  window.addEventListener('pointermove', mods, true);
  const all = () => step({ type: 'blur' });
  window.addEventListener('blur', all);
  window.addEventListener('focus', all);
  window.addEventListener('pagehide', all);
  document.addEventListener('visibilitychange', all);
  // Menú contextual del navegador (no el que el juego anula): se lleva los keyup mientras está abierto
  window.addEventListener('contextmenu', (e) => !e.defaultPrevented && all());
  // Pulsaciones breves: keydown y keyup en el mismo fotograma no deben perder el JustDown (Phaser lo borra al soltar)
  type KeyIn = { _justDown: boolean; onDown(e: KeyboardEvent): void; onUp(e: KeyboardEvent): void };
  const KP = Phaser.Input.Keyboard.Key.prototype as unknown as KeyIn;
  const downFrame = new WeakMap<object, number>();
  const kept = new Set<KeyIn & { isDown: boolean }>();
  const origDown = KP.onDown;
  KP.onDown = function (this: KeyIn, e: KeyboardEvent) {
    origDown.call(this, e);
    if (this._justDown) downFrame.set(this, game.loop.frame);
  };
  const origUp = KP.onUp;
  KP.onUp = function (this: KeyIn & { isDown: boolean }, e: KeyboardEvent) {
    const was = this._justDown;
    origUp.call(this, e);
    if (keepJustDown(was, downFrame.get(this) ?? -1, game.loop.frame)) {
      this._justDown = true;
      kept.add(this);
    }
  };
  // Después de que Phaser procese la cola de eventos del fotograma: lo que siga pulsado y no lo esté, se suelta, y el
  // «recién pulsada» conservado de una pulsación breve que nadie leyó caduca
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    releaseStuck(game);
    for (const k of kept) if (!k.isDown) k._justDown = false;
    kept.clear();
  });
  // Al volver una escena a primer plano no vale lo que creía pulsado antes de pararse (Phaser ya suelta al pausar)
  game.events.once(Phaser.Core.Events.READY, () => {
    for (const scene of game.scene.scenes) {
      const reset = () => (scene.input as Phaser.Input.InputPlugin | undefined)?.keyboard?.resetKeys();
      scene.sys.events.on(Phaser.Scenes.Events.RESUME, reset);
      scene.sys.events.on(Phaser.Scenes.Events.WAKE, reset);
    }
  });
}
