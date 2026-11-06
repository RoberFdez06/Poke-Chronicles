// Controles táctiles de la partida (T35, rehechos para móvil): solo en móvil o tableta (data/controls.ts
// `touchOnlyDevice`). Coordenadas reales de pantalla (las del HUD) y varios dedos a la vez.
//  - Joysticks flotantes: el de moverse nace donde toques en la mitad izquierda y el de apuntar/disparar en la
//    mitad derecha (fuera de las ranuras de poder y de los botones). La base se dibuja donde empieza el dedo, el
//    pomo lo sigue y al soltar se esconde; queda una pista tenue de dónde tocar.
//  - Los poderes se lanzan tocando sus ranuras del HUD (las mismas que en PC; GameScene apunta solo al enemigo más
//    cercano, ver data/touchAim.ts). Aquí solo quedan los botones pixel art: Parry y Esquiva a la derecha, encima
//    de las ranuras; Activo, Bomba, Poción y Usar (solo cuando hay algo con lo que interactuar) a la izquierda.
// La parte pura (vector del joystick, zonas, colocación y toque) está en data/touchPad.ts con sus pruebas.
// Bandas: si la pantalla es más ancha que 16:9 y las bandas que deja Scale.FIT son anchas (data/touchLayout.ts),
// joysticks y botones van en una capa DOM en esas bandas, fuera del lienzo, y no tapan el juego (ver BandLayer).
import Phaser from 'phaser';
import { GAME_VIEW, H, HUD, LW, W } from './layout';
import { hitPadButton, padButtons, stickVector, stickZone, STICK_DEAD, STICK_DRAG, STICK_KNOB, STICK_R, type PadButton, type PadRect } from '../data/touchPad';
import { bandLayout, touchLayoutMode, type BandSpot, type TouchLayoutMode } from '../data/touchLayout';
import { bakeTouchButtons, touchBtnKey, TOUCH_FRAME } from './art/touchButtons';
import { lowFx } from './theme';
import { noFingersLeft, pressFresh, StickArbiter, touchHitR, type Release, type StickSide } from '../data/touchPointers';

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
const MIN_HIT_CSS = 28;


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

/** Ids de los dedos de un TouchEvent (lista `touches` o `changedTouches`). */
const touchIds = (l: TouchList): number[] => Array.from({ length: l.length }, (_, i) => l[i].identifier);
const hasTouchEvents = (): boolean => typeof window !== 'undefined' && 'ontouchstart' in window;

/**
 * Cómo se ven los controles cuando el HUD va escalado (lienzo táctil ensanchado, rama `movilhud`): los objetos se
 * pintan en una cámara sin zoom en coordenadas de pantalla; `toScreen` lleva un punto del diseño del HUD a la
 * pantalla (con el zoom de su panel) y `toDesign` hace lo contrario (data/wideLayout.ts: hudToScreen/screenToHud).
 * Sin vista (null), todo es como siempre: diseño = pantalla.
 */
export interface TouchView {
  toScreen(x: number, y: number): { x: number; y: number; zoom: number };
  toDesign(x: number, y: number): { x: number; y: number };
}

interface Btn {
  id: TouchButton;
  x: number;
  y: number;
  size: number;
  /** Dónde se ve y se toca en pantalla (igual que x, y, size sin vista escalada). */
  sx: number;
  sy: number;
  ss: number;
  img: Phaser.GameObjects.Image;
  visible: boolean;
  /** Apagado (recargando, vacío o sin carga): se puede tocar igual (el juego avisa si no hay). */
  dim: boolean;
  downUntil: number;
}

export class TouchControls {
  private sticks: { move: Stick; aim: Stick };
  private buttons: Btn[] = [];
  /** Toques de botón pendientes de usar, con su hora: caducan (data/touchPointers.ts `pressFresh`). */
  private pressed = new Map<TouchButton, number>();
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
    /** Tamaño de la interfaz (Ajustes, móvil): 1, 1,25 o 1,5. */
    private ui = 1,
  ) {
    // Hasta 5 dedos: dos joysticks y botones a la vez (al rehacer los controles no se añaden más)
    const mgr = scene.input.manager;
    if (!mgr || mgr.pointersTotal < 6) scene.input.addPointer(4);
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

    const layout = padButtons(HUD.left, HUD.right, H, HUD.pad, slotsTop, ui);
    for (const id of Object.keys(layout) as TouchButton[]) {
      const b = layout[id];
      const img = keep(scene.add.image(b.x, b.y, touchBtnKey(id, 'up')).setScale(b.size / TOUCH_FRAME));
      this.buttons.push({ id, ...b, sx: b.x, sy: b.y, ss: b.size, img, visible: true, dim: false, downUntil: 0 });
    }
    // «Usar» solo aparece cerca de algo con lo que interactuar (GameScene llama a setUseVisible)
    this.setUseVisible(false);

    // Bandas laterales: capa DOM fuera del lienzo (se decide ahora y al cambiar el tamaño de la ventana)
    this.band = new BandLayer(scene, ui, (id) => this.pressBtn(id), this.sticks.move.vec, this.sticks.aim.vec);
    this.applyMode();
    if (typeof window !== 'undefined') window.addEventListener('resize', this.onResize);
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    scene.events.on(Phaser.Scenes.Events.PAUSE, this.onPause);
    scene.events.on(Phaser.Scenes.Events.SLEEP, this.onPause);
    scene.events.on(Phaser.Scenes.Events.RESUME, this.onResume);
    scene.events.on(Phaser.Scenes.Events.WAKE, this.onResume);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    // Seguro: al perder el foco, ocultar la pestaña, salir de la página o girar el móvil se sueltan todos los dedos;
    // y en cada evento táctil, lo que el navegador ya no tenga apoyado (lista real `touches`) se suelta también
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', this.releaseEverything);
      window.addEventListener('pagehide', this.releaseEverything);
      window.addEventListener('orientationchange', this.releaseEverything);
      document.addEventListener('visibilitychange', this.releaseEverything);
      for (const ev of ['touchstart', 'touchend', 'touchcancel'] as const) window.addEventListener(ev, this.onWindowTouch, { capture: true, passive: true });
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private band: BandLayer;
  private dead = false;
  /** Escena en pausa o dormida: la capa de las bandas se esconde (si no, quedaría encima del menú de pausa). */
  private hidden = false;
  /** Toques de toda la página (fase de captura, antes que Phaser y las bandas). */
  private onWindowTouch = (e: TouchEvent) => {
    if (this.dead) return;
    if (noFingersLeft(e.type, e.touches.length)) return this.releaseEverything();
    this.band.sync(touchIds(e.touches), touchIds(e.changedTouches));
  };

  private onPause = () => {
    this.releaseEverything();
    this.hidden = true;
    this.band.setVisible(false);
  };
  private onResume = () => {
    this.hidden = false;
    this.applyMode();
  };
  private mode: TouchLayoutMode = 'canvas';

  private onResize = () => {
    // Tras girar o cambiar de tamaño el navegador tarda un instante en dar las medidas nuevas
    if (this.dead) return;
    this.scene.time.delayedCall(60, () => this.applyMode());
  };

  /** Bandas o lienzo según el hueco que quede a los lados. */
  private applyMode() {
    if (this.dead) return;
    const mode = this.band.measure();
    if (mode !== this.mode) {
      this.mode = mode;
      // Al cambiar se sueltan los dedos que hubiera
      this.arb.releaseAll();
      for (const s of [this.sticks.move, this.sticks.aim]) this.release(s);
      this.band.releaseAll();
    }
    const inCanvas = mode === 'canvas';
    for (const s of [this.sticks.move, this.sticks.aim]) s.hint.setVisible(inCanvas && s.pointer === null);
    for (const b of this.buttons) this.paint(b);
    this.band.setVisible(!inCanvas && !this.hidden);
    this.disp = Math.max(0.1, this.scene.scale.displaySize.width / LW);
  }

  /** ¿Van los controles en las bandas, fuera del lienzo? */
  get inBands(): boolean {
    return this.mode === 'bands';
  }

  private pressBtn(id: TouchButton) {
    this.pressed.set(id, this.scene.time.now);
    const b = this.buttons.find((x) => x.id === id);
    if (!b) return;
    b.downUntil = this.scene.time.now + PRESS_MS;
    this.paint(b);
  }

  /** Radio de toque de un botón: un poco más que el dibujo y nunca menos de 44 px CSS de diámetro. */
  private hitR = (size: number) => Math.max(size / 2 + 10, MIN_HIT_CSS / this.disp);

  private paint(b: Btn) {
    if (!b.img.active) return;
    const down = this.scene.time.now < b.downUntil;
    const key = touchBtnKey(b.id, down ? 'down' : b.dim ? 'off' : 'up');
    b.img.setTexture(key).setVisible(b.visible && this.mode === 'canvas').setAlpha(b.dim && !down ? 0.75 : 1);
    this.band?.paint(b.id, key, b.visible, b.dim && !down);
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
    const t = this.pressed.get(b);
    if (t === undefined) return false;
    this.pressed.delete(b);
    return pressFresh(t, this.scene.time.now);
  }

  /** ¿Este dedo está usando los controles táctiles? (para no disparar ni moverse con él como si fuera un clic) */
  owns(p: Phaser.Input.Pointer): boolean {
    if (this.mode === 'bands') return false;
    return this.sticks.move.pointer === p.id || this.sticks.aim.pointer === p.id || this.hitButton(p) !== null;
  }

  private hitButton(p: Phaser.Input.Pointer): Btn | null {
    const hit = hitPadButton(p.x, p.y, this.buttons.map((b) => ({ x: b.sx, y: b.sy, size: b.ss, visible: b.visible, b })), this.hitR);
    return hit ? hit.b : null;
  }

  private view: TouchView | null = null;

  /** Objetos de Phaser de los controles (GameScene los cambia de capa al escalar el HUD). */
  get displayObjects(): readonly Phaser.GameObjects.GameObject[] {
    return this.objects;
  }

  /** Pone (o quita, con null) la vista escalada: recoloca botones y pistas y suelta los joysticks. */
  setView(v: TouchView | null) {
    if (this.dead) return;
    this.view = v;
    this.arb.releaseAll();
    for (const s of [this.sticks.move, this.sticks.aim]) {
      if (s.pointer !== null) this.release(s);
      const h = v ? v.toScreen(HINT[s.side].x, HINT[s.side].y) : HINT[s.side];
      s.hint.setPosition(h.x, h.y);
    }
    for (const b of this.buttons) {
      const p = v ? v.toScreen(b.x, b.y) : { x: b.x, y: b.y, zoom: 1 };
      b.sx = p.x;
      b.sy = p.y;
      b.ss = b.size * p.zoom;
      if (b.img.active) b.img.setPosition(b.sx, b.sy).setScale(b.ss / TOUCH_FRAME);
    }
  }

  /** Árbitro de los joysticks del lienzo (dedo por stick, dedos en espera y dedos perdidos: data/touchPointers.ts). */
  private arb = new StickArbiter();

  private onDown(p: Phaser.Input.Pointer) {
    // En bandas los controles están fuera del lienzo: los toques del lienzo son solo del juego (ranuras, pausa…)
    if (this.mode === 'bands' || this.hidden) return;
    const b = this.hitButton(p);
    if (b) {
      this.pressBtn(b.id);
      return;
    }
    // Las zonas reservadas están en coordenadas del diseño del HUD
    const d = this.view ? this.view.toDesign(p.x, p.y) : p;
    const side = stickZone(d.x, d.y, W, this.blocked());
    if (!side) return;
    if (this.arb.down({ id: p.id, side, x: p.x, y: p.y, t: this.scene.time.now })) this.start(this.sticks[side], p.id, p.x, p.y);
  }

  /** El dedo `id` se queda el stick y su base nace en (x, y). */
  private start(s: Stick, id: number, x: number, y: number) {
    s.pointer = id;
    s.origin = { x, y };
    s.base.setPosition(x, y).setVisible(true);
    s.knob.setPosition(x, y).setVisible(true);
    s.hint.setVisible(false);
    s.vec.set(0, 0);
  }

  private onMove(p: Phaser.Input.Pointer) {
    const side = this.arb.move(p.id, p.x, p.y, this.scene.time.now);
    if (!side) return;
    const s = this.sticks[side];
    const v = stickVector(s.origin, { x: p.x, y: p.y });
    s.origin = { x: v.baseX, y: v.baseY };
    s.vec.set(v.x, v.y);
    s.base.setPosition(v.baseX, v.baseY);
    s.knob.setPosition(v.knobX, v.knobY);
  }

  private onUp(p: Phaser.Input.Pointer) {
    const r = this.arb.up(p.id);
    if (r) this.applyRelease(r);
  }

  /** Stick soltado por el árbitro; si un dedo esperaba en ese lado, el stick nace donde está ese dedo. */
  private applyRelease(r: Release) {
    const s = this.sticks[r.side];
    this.release(s);
    if (r.adopt) this.start(s, r.adopt.id, r.adopt.x, r.adopt.y);
  }

  private release(s: Stick) {
    s.pointer = null;
    s.vec.set(0, 0);
    s.base.setVisible(false);
    s.knob.setVisible(false);
    s.hint.setVisible(this.mode === 'canvas');
  }

  /** Suelta sticks del lienzo y de las bandas (blur, pestaña oculta, pagehide, giro, pausa, sin dedos). */
  private releaseEverything = () => {
    if (this.dead) return;
    this.arb.releaseAll();
    for (const s of [this.sticks.move, this.sticks.aim]) if (s.pointer !== null) this.release(s);
    this.band.releaseAll();
    this.pressed.clear();
  };

  /** Depuración y pruebas: qué dedos tiene cada stick (lienzo y bandas). */
  get held(): { move: number | null; aim: number | null; bandMove: number | null; bandAim: number | null } {
    return { move: this.sticks.move.pointer, aim: this.sticks.aim.pointer, bandMove: this.band.owner('move'), bandAim: this.band.owner('aim') };
  }

  private tick() {
    const now = this.scene.time.now;
    // Dedo perdido (sin pointerup): si Phaser ya no lo tiene pulsado, se suelta (y adopta el que espere)
    const ptrs = this.scene.input.manager?.pointers ?? [];
    for (const r of this.arb.sync((id) => ptrs.find((q) => q.id === id)?.isDown === true)) this.applyRelease(r);
    for (const b of this.buttons) {
      if (b.downUntil > 0 && now >= b.downUntil) {
        b.downUntil = 0;
        this.paint(b);
      }
    }
    if (lowFx() || this.mode !== 'canvas') return;
    // Pista: respira muy suave para que se vea que ahí se toca
    const a = HINT_ALPHA * (0.75 + 0.25 * Math.sin(now / 600));
    for (const s of [this.sticks.move, this.sticks.aim]) if (s.pointer === null) s.hint.setStrokeStyle(4, s.color, a);
  }

  destroy() {
    this.releaseEverything();
    this.dead = true;
    for (const [ev, fn] of [[Phaser.Scenes.Events.PAUSE, this.onPause], [Phaser.Scenes.Events.SLEEP, this.onPause], [Phaser.Scenes.Events.RESUME, this.onResume], [Phaser.Scenes.Events.WAKE, this.onResume]] as const)
      this.scene.events.off(ev, fn);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('blur', this.releaseEverything);
      window.removeEventListener('pagehide', this.releaseEverything);
      window.removeEventListener('orientationchange', this.releaseEverything);
      document.removeEventListener('visibilitychange', this.releaseEverything);
      for (const ev of ['touchstart', 'touchend', 'touchcancel'] as const) window.removeEventListener(ev, this.onWindowTouch, { capture: true });
    }
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    this.band.destroy();
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('pointerupoutside', this.onUp, this);
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
  }
}

/** Botón dibujado en la capa DOM de las bandas. */
interface DomBtn {
  id: TouchButton;
  el: HTMLImageElement;
  spot: BandSpot;
  visible: boolean;
}

interface DomStick {
  side: StickSide;
  hint: HTMLDivElement;
  base: HTMLDivElement;
  knob: HTMLDivElement;
  pointer: number | null;
  origin: { x: number; y: number };
  vec: Phaser.Math.Vector2;
  r: number;
}

const BAND_LEFT_BTNS: readonly TouchButton[] = ['active', 'bomb', 'use', 'potion'];

/**
 * Capa DOM de las bandas laterales: dos cajas fijas a izquierda y derecha del lienzo con un joystick cada una
 * (izquierda mover, derecha apuntar) y los botones pixel art (las mismas texturas que en el lienzo).
 * Entrada: eventos táctiles (cada dedo con su `identifier` y la lista real `touches` en cada evento, así un dedo
 * cuyo «touchend» se pierde se suelta en el siguiente evento) y, donde no existen, Pointer Events con captura.
 * Los toques de las bandas se cancelan (`preventDefault`): Phaser no los ve y no gastan sus punteros.
 */
class BandLayer {
  private root?: HTMLDivElement;
  private sides: Record<StickSide, HTMLDivElement> | undefined;
  private sticks: Record<StickSide, DomStick> | undefined;
  private btns: DomBtn[] = [];
  private urls = new Map<string, string>();
  private band = 0;
  private visible = false;
  private arb = new StickArbiter();
  private flashTimers = new Set<number>();

  constructor(
    private scene: Phaser.Scene,
    private ui: number,
    private press: (id: TouchButton) => void,
    moveVec: Phaser.Math.Vector2,
    aimVec: Phaser.Math.Vector2,
  ) {
    if (typeof document === 'undefined') return;
    const root = document.createElement('div');
    root.id = 'touch-bands';
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;display:none;';
    const touch = hasTouchEvents();
    const side = (s: StickSide): HTMLDivElement => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overflow:hidden;';
      d.addEventListener('contextmenu', (e) => e.preventDefault());
      if (touch) {
        d.addEventListener('touchstart', (e) => this.onTouch(s, e), { passive: false });
        for (const ev of ['touchmove', 'touchend', 'touchcancel'] as const) d.addEventListener(ev, (e) => this.onTouch(s, e), { passive: false });
      } else {
        // Sin eventos táctiles (lápiz, navegadores raros): Pointer Events con captura por dedo
        d.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          try {
            d.setPointerCapture(e.pointerId);
          } catch {
            // sin captura: igual funciona mientras el dedo siga en la banda
          }
          this.downAt(s, e.pointerId, e.clientX, e.clientY, e.timeStamp);
        });
        d.addEventListener('pointermove', (e) => this.moveAt(s, e.pointerId, e.clientX, e.clientY, e.timeStamp));
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) d.addEventListener(ev, (e) => this.upAt(e.pointerId));
      }
      root.appendChild(d);
      return d;
    };
    this.sides = { move: side('move'), aim: side('aim') };
    const circle = (parent: HTMLElement, css: string): HTMLDivElement => {
      const c = document.createElement('div');
      c.style.cssText = `position:absolute;border-radius:50%;box-sizing:border-box;pointer-events:none;transform:translate(-50%,-50%);${css}`;
      parent.appendChild(c);
      return c;
    };
    const mk = (s: StickSide, color: string, vec: Phaser.Math.Vector2): DomStick => {
      const p = this.sides![s];
      return {
        side: s,
        hint: circle(p, `border:3px solid ${color};background:radial-gradient(circle, ${color} 0 7%, rgba(0,0,0,0.28) 8% 100%);opacity:0.55;`),
        base: circle(p, `border:3px solid ${color};background:rgba(0,0,0,0.25);opacity:0.7;display:none;`),
        knob: circle(p, `background:${color};border:2px solid rgba(255,255,255,0.7);opacity:0.8;display:none;`),
        pointer: null,
        origin: { x: 0, y: 0 },
        vec,
        r: 40,
      };
    };
    this.sticks = { move: mk('move', '#8fd3ff', moveVec), aim: mk('aim', '#ff9a7a', aimVec) };
    const ids: [TouchButton, StickSide][] = [['active', 'move'], ['bomb', 'move'], ['use', 'move'], ['potion', 'move'], ['parry', 'aim'], ['dash', 'aim']];
    for (const [id, s] of ids) {
      const el = document.createElement('img');
      el.alt = '';
      el.draggable = false;
      el.style.cssText = 'position:absolute;image-rendering:pixelated;pointer-events:none;transform:translate(-50%,-50%);';
      this.sides[s].appendChild(el);
      this.btns.push({ id, el, spot: { x: 0, y: 0, size: 0 }, visible: true });
    }
    document.body.appendChild(root);
    this.root = root;
  }

  /** Mide el lienzo y decide el modo; en bandas, coloca las cajas y lo de dentro. */
  measure(): TouchLayoutMode {
    const parent = this.scene.game.canvas?.parentElement;
    if (!this.root || !this.sides || !this.sticks || !parent) return 'canvas';
    const r = parent.getBoundingClientRect();
    const mode = touchLayoutMode(r.width, r.height, LW, H);
    if (mode !== 'bands') return mode;
    const c = this.scene.game.canvas.getBoundingClientRect();
    // Bandas reales: del borde de la caja al borde del lienzo
    this.band = Math.max(0, c.left - r.left);
    const lay = bandLayout(this.band, r.height, this.ui);
    // Zona táctil de cada lado: toda la banda y además la zona segura hasta el borde de la ventana (se puede tocar
    // ahí, pero los botones se dibujan solo dentro de la banda). `dx`: lo que se desplaza el dibujo en la izquierda.
    const vw = typeof window !== 'undefined' ? window.innerWidth : c.right + this.band;
    const vh = typeof window !== 'undefined' ? window.innerHeight : r.bottom;
    const dx = Math.max(0, r.left);
    const place = (d: HTMLDivElement, left: number, width: number) => Object.assign(d.style, { left: `${left}px`, top: '0px', width: `${width}px`, height: `${vh}px` });
    const oldLeft = this.sides.aim.getBoundingClientRect().left;
    place(this.sides.move, 0, dx + this.band);
    place(this.sides.aim, c.right, Math.max(this.band, vw - c.right));
    const sh = (side: StickSide, pt: { x: number; y: number }) => ({ x: pt.x + (side === 'move' ? dx : 0), y: pt.y + r.top });
    for (const st of [this.sticks.move, this.sticks.aim]) {
      st.r = lay.stickR;
      const h = sh(st.side, st.side === 'move' ? lay.move : lay.aim);
      this.circle(st.hint, h.x, h.y, st.r * 2);
      this.circle(st.knob, h.x, h.y, st.r * (STICK_KNOB / STICK_R) * 2);
      if (st.pointer === null) {
        this.circle(st.base, h.x, h.y, st.r * 2);
        st.origin = { ...h };
      } else if (st.side === 'aim' && oldLeft !== c.right) {
        // La caja derecha se ha movido con el dedo puesto (barra del navegador, giro): la base sigue bajo el dedo
        st.origin = { x: st.origin.x + oldLeft - c.right, y: st.origin.y };
      }
    }
    const spots: Record<TouchButton, BandSpot> = { ...lay.left, ...lay.right };
    for (const b of this.btns) {
      const sideOf: StickSide = BAND_LEFT_BTNS.includes(b.id) ? 'move' : 'aim';
      b.spot = { ...spots[b.id], ...sh(sideOf, spots[b.id]) };
      Object.assign(b.el.style, { left: `${b.spot.x}px`, top: `${b.spot.y}px`, width: `${b.spot.size}px`, height: `${b.spot.size}px` });
    }
    return mode;
  }

  private circle(el: HTMLElement, x: number, y: number, d: number) {
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${d}px`, height: `${d}px` });
  }

  setVisible(v: boolean) {
    this.visible = v;
    if (this.root) this.root.style.display = v ? 'block' : 'none';
    if (!v) this.releaseAll();
  }

  /** Imagen de un botón (la textura pixel art del lienzo pasada a data URL una sola vez). */
  paint(id: TouchButton, key: string, visible: boolean, dim: boolean) {
    const b = this.btns.find((x) => x.id === id);
    if (!b) return;
    let url = this.urls.get(key);
    if (url === undefined) {
      try {
        url = this.scene.textures.getBase64(key);
      } catch {
        url = '';
      }
      this.urls.set(key, url);
    }
    if (url && b.el.src !== url) b.el.src = url;
    b.visible = visible;
    b.el.style.display = visible ? 'block' : 'none';
    b.el.style.opacity = dim ? '0.75' : '1';
  }

  /** Dueño actual de un stick de banda (depuración). */
  owner(side: StickSide): number | null {
    return this.arb.owner(side);
  }

  private onTouch(side: StickSide, e: TouchEvent) {
    if (e.cancelable) e.preventDefault();
    const t = e.timeStamp;
    for (const tc of Array.from(e.changedTouches)) {
      if (e.type === 'touchstart') this.downAt(side, tc.identifier, tc.clientX, tc.clientY, t);
      else if (e.type === 'touchmove') this.moveAt(side, tc.identifier, tc.clientX, tc.clientY, t);
      else this.upAt(tc.identifier);
    }
    if (e.type !== 'touchmove') this.sync(touchIds(e.touches), touchIds(e.changedTouches));
  }

  /** Suelta los sticks cuyos dedos ya no están en la pantalla (lista real del navegador). */
  sync(live: readonly number[], changed: readonly number[] = []) {
    if (!this.sticks || !hasTouchEvents()) return;
    const ok = new Set([...live, ...changed]);
    for (const r of this.arb.sync((id) => ok.has(id))) this.applyRelease(r);
  }

  private local(side: StickSide, cx: number, cy: number) {
    const r = this.sides![side].getBoundingClientRect();
    return { x: cx - r.left, y: cy - r.top };
  }

  private downAt(side: StickSide, id: number, cx: number, cy: number, t: number) {
    if (!this.visible || !this.sticks) return;
    const p = this.local(side, cx, cy);
    // Botones de esta banda: el más cercano dentro de su radio de toque (al menos 28 px CSS)
    const mine = this.btns.filter((b) => (side === 'move') === BAND_LEFT_BTNS.includes(b.id));
    const hit = hitPadButton(p.x, p.y, mine.map((b) => ({ ...b.spot, visible: b.visible, id: b.id })), touchHitR);
    if (hit) {
      this.flash(hit.id);
      return this.press(hit.id);
    }
    if (this.arb.down({ id, side, x: p.x, y: p.y, t })) this.start(this.sticks[side], id, p);
  }

  private start(st: DomStick, id: number, p: { x: number; y: number }) {
    st.pointer = id;
    st.origin = p;
    this.circle(st.base, p.x, p.y, st.r * 2);
    st.base.style.display = 'block';
    st.knob.style.display = 'block';
    Object.assign(st.knob.style, { left: `${p.x}px`, top: `${p.y}px` });
    st.hint.style.display = 'none';
    st.vec.set(0, 0);
  }

  /** `from`: la caja donde empezó el dedo (los eventos de un dedo siempre llegan a esa caja). */
  private moveAt(from: StickSide, id: number, cx: number, cy: number, t: number) {
    if (!this.sticks) return;
    const p = this.local(from, cx, cy);
    const side = this.arb.move(id, p.x, p.y, t);
    if (!side) return;
    const st = this.sticks[side];
    const v = stickVector(st.origin, p, st.r, STICK_DEAD, STICK_DRAG);
    st.origin = { x: v.baseX, y: v.baseY };
    st.vec.set(v.x, v.y);
    Object.assign(st.base.style, { left: `${v.baseX}px`, top: `${v.baseY}px` });
    Object.assign(st.knob.style, { left: `${v.knobX}px`, top: `${v.knobY}px` });
  }

  private upAt(id: number) {
    const r = this.arb.up(id);
    if (r) this.applyRelease(r);
  }

  private applyRelease(r: Release) {
    if (!this.sticks) return;
    const st = this.sticks[r.side];
    this.reset(st);
    if (r.adopt && this.visible) this.start(st, r.adopt.id, { x: r.adopt.x, y: r.adopt.y });
  }

  private reset(st: DomStick) {
    st.pointer = null;
    st.vec.set(0, 0);
    st.base.style.display = 'none';
    st.knob.style.display = 'none';
    st.hint.style.display = 'block';
  }

  releaseAll() {
    this.arb.releaseAll();
    if (this.sticks) for (const st of [this.sticks.move, this.sticks.aim]) if (st.pointer !== null || st.vec.lengthSq() > 0) this.reset(st);
  }

  /** Respuesta al pulsar un botón de banda: se encoge y brilla un instante (nunca se queda encogido). */
  private flash(id: TouchButton) {
    const b = this.btns.find((x) => x.id === id);
    if (!b || typeof window === 'undefined') return;
    b.el.style.transition = 'transform 90ms, filter 90ms';
    b.el.style.transform = 'translate(-50%,-50%) scale(0.86)';
    b.el.style.filter = 'brightness(1.5)';
    const h = window.setTimeout(() => {
      this.flashTimers.delete(h);
      b.el.style.transform = 'translate(-50%,-50%)';
      b.el.style.filter = '';
    }, 140);
    this.flashTimers.add(h);
  }

  destroy() {
    this.releaseAll();
    for (const h of this.flashTimers) window.clearTimeout(h);
    this.flashTimers.clear();
    this.root?.remove();
    this.root = undefined;
  }
}
