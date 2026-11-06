// Ratón fiable en TODAS las escenas de menú a la vez (ver data/menuPointer.ts), sin tocar la partida ni la defensa de
// torres ni el táctil:
// - Zona de clic generosa: los botones (objetos con cursor de mano) aceptan el clic y el paso del ratón también en un
//   margen alrededor de lo dibujado; un botón tocado de lleno gana al margen de su vecino y un fondo de diálogo sigue
//   tapando lo de debajo.
// - Clic fiable: solo botón izquierdo (el derecho donde hace algo), nada en los primeros ms de una pantalla y nada del
//   segundo clic de un doble clic que cae sobre algo nuevo (la pantalla o el diálogo que abrió el primero).
// - Hover = selección: tras moverse con teclado o mando, en cuanto el ratón se mueve vuelve a seleccionar lo de debajo.
import Phaser from 'phaser';
import { currentInput, onInputChange } from './inputMode';
import { onKeyNav } from './keyGuard';
import { hitPad, isMenuScene, judgeDown, padHit, pickHit, rectDist, shouldReHover, type ClickMemo } from '../data/menuPointer';

type GO = Phaser.GameObjects.GameObject & { displayOriginX?: number; displayOriginY?: number };

/** Resultado del último test de cada objeto: exacto o solo en el margen (y a qué distancia). */
const marks = new WeakMap<object, { exact: boolean; dist: number }>();
const ids = new WeakMap<object, number>();
let nextId = 1;
const idOf = (o: object | undefined): number => {
  if (!o) return -1;
  let id = ids.get(o);
  if (id === undefined) ids.set(o, (id = nextId++));
  return id;
};
const sceneKey = (go: { scene?: Phaser.Scene }): string => go.scene?.sys?.settings?.key ?? '';

/** Margen de un objeto, o 0 si no lleva (no es botón, no es menú, no es un rectángulo normal, o se juega en táctil). */
function padFor(go: GO): number {
  const input = go.input;
  if (!input || !input.enabled || !input.cursor) return 0;
  if (!isMenuScene(sceneKey(go)) || currentInput() === 'touch') return 0;
  const r = input.hitArea as unknown;
  if (!(r instanceof Phaser.Geom.Rectangle) || input.hitAreaCallback !== Phaser.Geom.Rectangle.Contains) return 0;
  return hitPad(r.width, r.height);
}

let installed = false;
let navSinceHover = false;
let lastClick: ClickMemo | null = null;
const armAt = new WeakMap<Phaser.Scene, number>();

export function installMenuPointer(game: Phaser.Game) {
  if (installed) return;
  installed = true;

  // 1) Prueba de impacto con margen
  const IM = Phaser.Input.InputManager.prototype as unknown as { pointWithinHitArea(go: GO, x: number, y: number): boolean };
  const origWithin = IM.pointWithinHitArea;
  IM.pointWithinHitArea = function (go: GO, x: number, y: number): boolean {
    if (origWithin.call(this, go, x, y)) {
      marks.set(go, { exact: true, dist: 0 });
      return true;
    }
    const pad = padFor(go);
    if (!pad) return false;
    const lx = x + (go.displayOriginX ?? 0);
    const ly = y + (go.displayOriginY ?? 0);
    const r = go.input!.hitArea as Phaser.Geom.Rectangle;
    const rect = { x: r.x, y: r.y, w: r.width, h: r.height };
    if (padHit(rect, lx, ly, pad) !== 'pad') return false;
    go.input!.localX = lx;
    go.input!.localY = ly;
    marks.set(go, { exact: false, dist: rectDist(rect, lx, ly) });
    return true;
  };

  type IPlugin = {
    scene: Phaser.Scene;
    _temp: GO[];
    sortGameObjects(list: GO[], pointer: Phaser.Input.Pointer): GO[];
    processDownEvents(pointer: Phaser.Input.Pointer): number;
    processMoveEvents(pointer: Phaser.Input.Pointer): number;
  };
  const IP = Phaser.Input.InputPlugin.prototype as unknown as IPlugin;

  // 2) Quién se queda el clic cuando hay varios (Phaser ordena el array en su sitio y no usa lo que devuelve)
  const origSort = IP.sortGameObjects;
  IP.sortGameObjects = function (this: IPlugin, list: GO[], pointer: Phaser.Input.Pointer) {
    const out = origSort.call(this, list, pointer);
    if (list.length < 2 || !isMenuScene(this.scene.sys.settings.key)) return out;
    const i = pickHit(list.map((go) => {
      const m = marks.get(go);
      return { exact: m?.exact ?? true, button: !!go.input?.cursor, dist: m?.dist ?? 0 };
    }));
    if (i > 0) list.unshift(...list.splice(i, 1));
    return list;
  };

  // 3) Clic fiable
  const origDown = IP.processDownEvents;
  IP.processDownEvents = function (this: IPlugin, pointer: Phaser.Input.Pointer) {
    const key = this.scene.sys.settings.key;
    if (!isMenuScene(key)) return origDown.call(this, pointer);
    const now = game.loop.now;
    const top = this._temp[0];
    const verdict = judgeDown({
      t: now,
      scene: key,
      target: idOf(top),
      button: pointer.button,
      clicks: (pointer.event as MouseEvent | undefined)?.detail ?? 1,
      sceneAge: now - (armAt.get(this.scene) ?? -Infinity),
      touch: pointer.wasTouch,
    }, lastClick);
    // Un clic descartado sobre algo de esta escena no pasa a la de debajo
    if (verdict !== 'ok') return this._temp.length ? 1 : 0;
    if (!pointer.wasTouch && top) lastClick = { t: now, scene: key, target: idOf(top) };
    return origDown.call(this, pointer);
  };

  // 4) Hover = selección después de usar teclado o mando
  onKeyNav(() => (navSinceHover = true));
  onInputChange((d) => d === 'gamepad' && (navSinceHover = true));
  const origMove = IP.processMoveEvents;
  IP.processMoveEvents = function (this: IPlugin, pointer: Phaser.Input.Pointer) {
    const total = origMove.call(this, pointer);
    const top = this._temp[0];
    const moved = pointer.x !== pointer.prevPosition.x || pointer.y !== pointer.prevPosition.y;
    if (top?.input?.cursor && isMenuScene(this.scene.sys.settings.key) && shouldReHover(navSinceHover, moved, pointer.wasTouch)) {
      navSinceHover = false;
      if (top.listenerCount(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER) > 0) {
        const ev = { cancelled: false, stopPropagation() { ev.cancelled = true; } };
        top.emit(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, pointer, top.input.localX, top.input.localY, ev);
      }
    }
    return total;
  };

  // Momento en que cada escena se abre o vuelve a primer plano (para ARM_MS)
  game.events.once(Phaser.Core.Events.READY, () => {
    for (const scene of game.scene.scenes) {
      const arm = () => armAt.set(scene, game.loop.now);
      for (const ev of [Phaser.Scenes.Events.START, Phaser.Scenes.Events.RESUME, Phaser.Scenes.Events.WAKE]) scene.sys.events.on(ev, arm);
      if (scene.sys.isActive()) arm();
    }
  });
}
