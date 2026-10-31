// Controles táctiles de la partida (T35, rehechos para móvil): solo en móvil o tableta (data/controls.ts
// `touchOnlyDevice`). Coordenadas reales de pantalla (las del HUD) y varios dedos a la vez.
//  - Joysticks flotantes: el de moverse nace donde toques en la mitad izquierda y el de apuntar/disparar en la
//    mitad derecha (fuera de las ranuras de poder y de los botones). La base se dibuja donde empieza el dedo, el
//    pomo lo sigue y al soltar se esconde; queda una pista tenue de dónde tocar.
//  - Los poderes se lanzan tocando sus ranuras del HUD (las mismas que en PC; GameScene apunta solo al enemigo más
//    cercano, ver data/touchAim.ts). Aquí solo quedan los botones pixel art: Parry y Esquiva a la derecha, encima
//    de las ranuras; Activo, Bomba, Poción y Usar (solo cuando hay algo con lo que interactuar) a la izquierda.
// La parte pura (vector del joystick, zonas, colocación y toque) está en data/touchPad.ts con sus pruebas.
import Phaser from 'phaser';
import { GAME_VIEW, H, HUD, W } from './layout';
import { hitPadButton, padButtons, stickVector, stickZone, STICK_KNOB, STICK_R, type PadButton, type PadRect } from '../data/touchPad';
import { bakeTouchButtons, touchBtnKey, TOUCH_FRAME } from './art/touchButtons';
import { lowFx } from './theme';

export type TouchButton = PadButton;

/** Dónde se dibuja la pista tenue de cada joystick cuando no se toca (centro, px de lienzo). */
const HINT = {
  move: { x: GAME_VIEW.x + 190, y: H - 250 },
  aim: { x: GAME_VIEW.x + GAME_VIEW.w - 190, y: H - 250 },
};
/** Opacidad de la pista (y de la base y el pomo mientras se usa). */
const HINT_ALPHA = 0.16;
const BASE_ALPHA = 0.32;
const KNOB_ALPHA = 0.6;
/** Cuánto dura el estado «pulsado» de un botón al tocarlo (ms). */
const PRESS_MS = 120;
/** Zona de toque mínima de un botón (px CSS de radio): 22 = 44 px de diámetro. */
const MIN_HIT_CSS = 22;

interface Stick {
  side: 'move' | 'aim';
  color: number;
  base: Phaser.GameObjects.Arc;
  knob: Phaser.GameObjects.Arc;
  hint: Phaser.GameObjects.Arc;
  origin: { x: number; y: number };
  pointer: number | null;
  vec: Phaser.Math.Vector2;
}

interface Btn {
  id: TouchButton;
  x: number;
  y: number;
  size: number;
  img: Phaser.GameObjects.Image;
  visible: boolean;
  /** Apagado (recargando, vacío o sin carga): se puede tocar igual (el juego avisa si no hay). */
  dim: boolean;
  downUntil: number;
}

export class TouchControls {
  private sticks: { move: Stick; aim: Stick };
  private buttons: Btn[] = [];
  private pressed = new Set<TouchButton>();
  private objects: Phaser.GameObjects.GameObject[] = [];
  /** Px de lienzo por px CSS (para la zona de toque mínima). */
  private disp: number;

  constructor(
    private scene: Phaser.Scene,
    /** Mete cada objeto en la capa del HUD (cámara sin zoom). */
    add: (o: Phaser.GameObjects.GameObject) => void,
    /** y de arriba de la primera ranura de poder (Parry y Esquiva van encima). */
    slotsTop: number,
    /** Zonas donde un dedo no hace nacer un joystick (ranuras de poder, pausa, consejo…); se piden en cada toque. */
    private blocked: () => PadRect[] = () => [],
  ) {
    // Hasta 5 dedos: dos joysticks y botones a la vez
    scene.input.addPointer(4);
    bakeTouchButtons(scene);
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      add(o);
      this.objects.push(o);
      return o;
    };
    this.disp = Math.max(0.1, scene.scale.displaySize.width / W);
    const stick = (side: 'move' | 'aim', color: number): Stick => {
      const h = HINT[side];
      return {
        side,
        color,
        hint: keep(scene.add.circle(h.x, h.y, STICK_R, 0xffffff, 0).setStrokeStyle(4, color, HINT_ALPHA)),
        base: keep(scene.add.circle(h.x, h.y, STICK_R, 0x000000, BASE_ALPHA * 0.6).setStrokeStyle(5, color, BASE_ALPHA * 2).setVisible(false)),
        knob: keep(scene.add.circle(h.x, h.y, STICK_KNOB, color, KNOB_ALPHA).setStrokeStyle(3, 0xffffff, 0.7).setVisible(false)),
        origin: { ...h },
        pointer: null,
        vec: new Phaser.Math.Vector2(),
      };
    };
    this.sticks = { move: stick('move', 0x8fd3ff), aim: stick('aim', 0xff9a7a) };

    const layout = padButtons(HUD.left, HUD.right, H, HUD.pad, slotsTop);
    for (const id of Object.keys(layout) as TouchButton[]) {
      const b = layout[id];
      const img = keep(scene.add.image(b.x, b.y, touchBtnKey(id, 'up')).setScale(b.size / TOUCH_FRAME));
      this.buttons.push({ id, ...b, img, visible: true, dim: false, downUntil: 0 });
    }
    // «Usar» solo aparece cerca de algo con lo que interactuar (GameScene llama a setUseVisible)
    this.setUseVisible(false);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Radio de toque de un botón: un poco más que el dibujo y nunca menos de 44 px CSS de diámetro. */
  private hitR = (size: number) => Math.max(size / 2 + 10, MIN_HIT_CSS / this.disp);

  private paint(b: Btn) {
    if (!b.img.active) return;
    const down = this.scene.time.now < b.downUntil;
    b.img.setTexture(touchBtnKey(b.id, down ? 'down' : b.dim ? 'off' : 'up')).setVisible(b.visible).setAlpha(b.dim && !down ? 0.75 : 1);
  }

  private set(id: TouchButton, o: { dim?: boolean; visible?: boolean }) {
    const b = this.buttons.find((x) => x.id === id);
    if (!b) return;
    const dim = o.dim ?? b.dim;
    const visible = o.visible ?? b.visible;
    if (dim === b.dim && visible === b.visible) return;
    b.dim = dim;
    b.visible = visible;
    this.paint(b);
  }

  /** Botón «Activo»: apagado sin objeto o mientras se carga, encendido cuando está listo. */
  setActiveReady(has: boolean, ready: boolean): void {
    this.set('active', { dim: !has || !ready });
  }

  /** Botón «Esquiva»: apagado mientras recarga. */
  setDashReady(ready: boolean): void {
    this.set('dash', { dim: !ready });
  }

  /** Bomba y Poción: apagadas si no te queda ninguna. */
  setCount(id: 'bomb' | 'potion', n: number): void {
    this.set(id, { dim: n <= 0 });
  }

  /** «Usar»: solo se ve (y se puede tocar) cerca de algo interactuable. */
  setUseVisible(v: boolean): void {
    this.set('use', { visible: v });
  }

  /** Dirección de movimiento (largo 0 a 1). */
  get move(): Phaser.Math.Vector2 {
    return this.sticks.move.vec;
  }

  /** Dirección de disparo (largo 0 si no se dispara). */
  get aim(): Phaser.Math.Vector2 {
    return this.sticks.aim.vec;
  }

  /** ¿Se ha pulsado el botón desde la última vez? (una vez por toque) */
  consume(b: TouchButton): boolean {
    return this.pressed.delete(b);
  }

  /** ¿Este dedo está usando los controles táctiles? (para no disparar ni moverse con él como si fuera un clic) */
  owns(p: Phaser.Input.Pointer): boolean {
    return this.sticks.move.pointer === p.id || this.sticks.aim.pointer === p.id || this.hitButton(p) !== null;
  }

  private hitButton(p: Phaser.Input.Pointer): Btn | null {
    return hitPadButton(p.x, p.y, this.buttons, this.hitR);
  }

  private onDown(p: Phaser.Input.Pointer) {
    const b = this.hitButton(p);
    if (b) {
      this.pressed.add(b.id);
      b.downUntil = this.scene.time.now + PRESS_MS;
      this.paint(b);
      return;
    }
    const side = stickZone(p.x, p.y, W, this.blocked());
    if (!side) return;
    const s = this.sticks[side];
    if (s.pointer !== null) return;
    s.pointer = p.id;
    s.origin = { x: p.x, y: p.y };
    s.base.setPosition(p.x, p.y).setVisible(true);
    s.knob.setPosition(p.x, p.y).setVisible(true);
    s.hint.setVisible(false);
    s.vec.set(0, 0);
  }

  private onMove(p: Phaser.Input.Pointer) {
    for (const s of [this.sticks.move, this.sticks.aim]) {
      if (s.pointer !== p.id) continue;
      const v = stickVector(s.origin, { x: p.x, y: p.y });
      s.origin = { x: v.baseX, y: v.baseY };
      s.vec.set(v.x, v.y);
      s.base.setPosition(v.baseX, v.baseY);
      s.knob.setPosition(v.knobX, v.knobY);
    }
  }

  private onUp(p: Phaser.Input.Pointer) {
    for (const s of [this.sticks.move, this.sticks.aim]) {
      if (s.pointer !== p.id) continue;
      s.pointer = null;
      s.vec.set(0, 0);
      s.base.setVisible(false);
      s.knob.setVisible(false);
      s.hint.setVisible(true);
    }
  }

  /** Vuelve a pintar los botones cuyo «pulsado» ha terminado; con efectos bajos la pista no parpadea. */
  private tick() {
    const now = this.scene.time.now;
    for (const b of this.buttons) {
      if (b.downUntil > 0 && now >= b.downUntil) {
        b.downUntil = 0;
        this.paint(b);
      }
    }
    if (lowFx()) return;
    // Pista: respira muy suave para que se vea que ahí se toca
    const a = HINT_ALPHA * (0.75 + 0.25 * Math.sin(now / 600));
    for (const s of [this.sticks.move, this.sticks.aim]) if (s.pointer === null) s.hint.setStrokeStyle(4, s.color, a);
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('pointerupoutside', this.onUp, this);
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
  }
}
