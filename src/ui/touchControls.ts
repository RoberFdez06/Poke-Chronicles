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
import { GAME_VIEW, H, HUD, W } from './layout';
import { hitPadButton, padButtons, stickVector, stickZone, STICK_DEAD, STICK_DRAG, STICK_KNOB, STICK_R, type PadButton, type PadRect } from '../data/touchPad';
import { bandLayout, touchLayoutMode, type BandSpot, type TouchLayoutMode } from '../data/touchLayout';
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
    /** Tamaño de la interfaz (Ajustes, móvil): 1, 1,25 o 1,5. */
    private ui = 1,
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

    const layout = padButtons(HUD.left, HUD.right, H, HUD.pad, slotsTop, ui);
    for (const id of Object.keys(layout) as TouchButton[]) {
      const b = layout[id];
      const img = keep(scene.add.image(b.x, b.y, touchBtnKey(id, 'up')).setScale(b.size / TOUCH_FRAME));
      this.buttons.push({ id, ...b, img, visible: true, dim: false, downUntil: 0 });
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
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private band: BandLayer;
  private dead = false;
  /** Escena en pausa o dormida: la capa de las bandas se esconde (si no, quedaría encima del menú de pausa). */
  private hidden = false;
  private onPause = () => {
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
      for (const s of [this.sticks.move, this.sticks.aim]) this.release(s);
      this.band.releaseAll();
    }
    const inCanvas = mode === 'canvas';
    for (const s of [this.sticks.move, this.sticks.aim]) s.hint.setVisible(inCanvas && s.pointer === null);
    for (const b of this.buttons) this.paint(b);
    this.band.setVisible(!inCanvas && !this.hidden);
    this.disp = Math.max(0.1, this.scene.scale.displaySize.width / W);
  }

  /** ¿Van los controles en las bandas, fuera del lienzo? */
  get inBands(): boolean {
    return this.mode === 'bands';
  }

  private pressBtn(id: TouchButton) {
    this.pressed.add(id);
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
    return this.pressed.delete(b);
  }

  /** ¿Este dedo está usando los controles táctiles? (para no disparar ni moverse con él como si fuera un clic) */
  owns(p: Phaser.Input.Pointer): boolean {
    if (this.mode === 'bands') return false;
    return this.sticks.move.pointer === p.id || this.sticks.aim.pointer === p.id || this.hitButton(p) !== null;
  }

  private hitButton(p: Phaser.Input.Pointer): Btn | null {
    return hitPadButton(p.x, p.y, this.buttons, this.hitR);
  }

  private onDown(p: Phaser.Input.Pointer) {
    // En bandas los controles están fuera del lienzo: los toques del lienzo son solo del juego (ranuras, pausa…)
    if (this.mode === 'bands') return;
    const b = this.hitButton(p);
    if (b) {
      this.pressBtn(b.id);
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
    for (const s of [this.sticks.move, this.sticks.aim]) if (s.pointer === p.id) this.release(s);
  }

  private release(s: Stick) {
    s.pointer = null;
    s.vec.set(0, 0);
    s.base.setVisible(false);
    s.knob.setVisible(false);
    s.hint.setVisible(this.mode === 'canvas');
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
    if (lowFx() || this.mode !== 'canvas') return;
    // Pista: respira muy suave para que se vea que ahí se toca
    const a = HINT_ALPHA * (0.75 + 0.25 * Math.sin(now / 600));
    for (const s of [this.sticks.move, this.sticks.aim]) if (s.pointer === null) s.hint.setStrokeStyle(4, s.color, a);
  }

  destroy() {
    this.dead = true;
    for (const [ev, fn] of [[Phaser.Scenes.Events.PAUSE, this.onPause], [Phaser.Scenes.Events.SLEEP, this.onPause], [Phaser.Scenes.Events.RESUME, this.onResume], [Phaser.Scenes.Events.WAKE, this.onResume]] as const)
      this.scene.events.off(ev, fn);
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.onResize);
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
  side: 'move' | 'aim';
  hint: HTMLDivElement;
  base: HTMLDivElement;
  knob: HTMLDivElement;
  pointer: number | null;
  origin: { x: number; y: number };
  vec: Phaser.Math.Vector2;
  r: number;
}

/**
 * Capa DOM de las bandas laterales: dos cajas fijas a izquierda y derecha del lienzo con un joystick cada una
 * (izquierda mover, derecha apuntar) y los botones pixel art (las mismas texturas que en el lienzo). Usa Pointer
 * Events con captura por dedo, así que varios dedos a la vez funcionan igual que dentro del lienzo.
 */
class BandLayer {
  private root?: HTMLDivElement;
  private sides: Record<'move' | 'aim', HTMLDivElement> | undefined;
  private sticks: DomStick[] = [];
  private btns: DomBtn[] = [];
  private urls = new Map<string, string>();
  private band = 0;
  private visible = false;

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
    const side = (): HTMLDivElement => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden;';
      d.addEventListener('contextmenu', (e) => e.preventDefault());
      root.appendChild(d);
      return d;
    };
    this.sides = { move: side(), aim: side() };
    const circle = (parent: HTMLElement, css: string): HTMLDivElement => {
      const c = document.createElement('div');
      c.style.cssText = `position:absolute;border-radius:50%;box-sizing:border-box;pointer-events:none;transform:translate(-50%,-50%);${css}`;
      parent.appendChild(c);
      return c;
    };
    const mk = (s: 'move' | 'aim', color: string, vec: Phaser.Math.Vector2): DomStick => {
      const p = this.sides![s];
      const st: DomStick = {
        side: s,
        hint: circle(p, `border:3px solid ${color};opacity:0.35;`),
        base: circle(p, `border:3px solid ${color};background:rgba(0,0,0,0.25);opacity:0.7;display:none;`),
        knob: circle(p, `background:${color};border:2px solid rgba(255,255,255,0.7);opacity:0.8;display:none;`),
        pointer: null,
        origin: { x: 0, y: 0 },
        vec,
        r: 40,
      };
      p.addEventListener('pointerdown', (e) => this.down(st, e));
      p.addEventListener('pointermove', (e) => this.move(st, e));
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) p.addEventListener(ev, (e) => this.up(st, e));
      return st;
    };
    this.sticks = [mk('move', '#8fd3ff', moveVec), mk('aim', '#ff9a7a', aimVec)];
    const ids: [TouchButton, 'move' | 'aim'][] = [['active', 'move'], ['bomb', 'move'], ['use', 'move'], ['potion', 'move'], ['parry', 'aim'], ['dash', 'aim']];
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
    if (!this.root || !this.sides || !parent) return 'canvas';
    const r = parent.getBoundingClientRect();
    const mode = touchLayoutMode(r.width, r.height, W, H);
    if (mode !== 'bands') return mode;
    const c = this.scene.game.canvas.getBoundingClientRect();
    // Bandas reales: del borde de la caja al borde del lienzo
    this.band = Math.max(0, c.left - r.left);
    const lay = bandLayout(this.band, r.height, this.ui);
    const place = (d: HTMLDivElement, left: number) => Object.assign(d.style, { left: `${left}px`, top: `${r.top}px`, width: `${this.band}px`, height: `${r.height}px` });
    place(this.sides.move, r.left);
    place(this.sides.aim, c.right);
    for (const st of this.sticks) {
      st.r = lay.stickR;
      const h = st.side === 'move' ? lay.move : lay.aim;
      this.circle(st.hint, h.x, h.y, st.r * 2);
      this.circle(st.base, h.x, h.y, st.r * 2);
      this.circle(st.knob, h.x, h.y, st.r * (STICK_KNOB / STICK_R) * 2);
      st.origin = { ...h };
    }
    const spots: Record<TouchButton, BandSpot> = { ...lay.left, ...lay.right };
    for (const b of this.btns) {
      b.spot = spots[b.id];
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

  private local(st: DomStick, e: PointerEvent) {
    const r = this.sides![st.side].getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private down(st: DomStick, e: PointerEvent) {
    if (!this.visible) return;
    e.preventDefault();
    const p = this.local(st, e);
    // Botones de esta banda: el más cercano dentro de su radio de toque (al menos 22 px CSS)
    const mine = this.btns.filter((b) => (st.side === 'move') === ['active', 'bomb', 'use', 'potion'].includes(b.id));
    const hit = hitPadButton(p.x, p.y, mine.map((b) => ({ ...b.spot, visible: b.visible, id: b.id })), (size) => Math.max(size / 2 + 4, 22));
    if (hit) return this.press(hit.id);
    if (st.pointer !== null) return;
    st.pointer = e.pointerId;
    try {
      this.sides![st.side].setPointerCapture(e.pointerId);
    } catch {
      // sin captura: igual funciona mientras el dedo siga en la banda
    }
    st.origin = p;
    this.circle(st.base, p.x, p.y, st.r * 2);
    st.base.style.display = 'block';
    st.knob.style.display = 'block';
    Object.assign(st.knob.style, { left: `${p.x}px`, top: `${p.y}px` });
    st.hint.style.display = 'none';
    st.vec.set(0, 0);
  }

  private move(st: DomStick, e: PointerEvent) {
    if (st.pointer !== e.pointerId) return;
    e.preventDefault();
    const v = stickVector(st.origin, this.local(st, e), st.r, STICK_DEAD, STICK_DRAG);
    st.origin = { x: v.baseX, y: v.baseY };
    st.vec.set(v.x, v.y);
    Object.assign(st.base.style, { left: `${v.baseX}px`, top: `${v.baseY}px` });
    Object.assign(st.knob.style, { left: `${v.knobX}px`, top: `${v.knobY}px` });
  }

  private up(st: DomStick, e: PointerEvent) {
    if (st.pointer !== e.pointerId) return;
    this.reset(st);
  }

  private reset(st: DomStick) {
    st.pointer = null;
    st.vec.set(0, 0);
    st.base.style.display = 'none';
    st.knob.style.display = 'none';
    st.hint.style.display = 'block';
  }

  releaseAll() {
    for (const st of this.sticks) if (st.pointer !== null) this.reset(st);
  }

  destroy() {
    this.releaseAll();
    this.root?.remove();
    this.root = undefined;
  }
}
