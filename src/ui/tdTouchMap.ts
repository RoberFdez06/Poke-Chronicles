// Defensa de torres en táctil (rama `tdmovil`): el mapa en su propia cámara con zoom (pellizco), arrastre y lupa.
// Solo se crea en dispositivos táctiles (TowerDefenseScene). Lo que se dibuja con profundidad ≥ TD_UI_DEPTH es
// interfaz (cámara de diseño, la principal, que se pinta la última) y lo de debajo es el mapa (cámara del mapa y
// lupa). Los gestos son la máquina pura MapGesture (data/towerDefense/touchTd.ts), con su seguro de dedos.
import Phaser from 'phaser';
import {
  MapGesture, canvasToDesign, clampCenter, clampZoom, designToCanvas, fitZoom, loupeRect, maxZoom, zoomAbout, type GestureOut, type Rect,
} from '../data/towerDefense/touchTd';
import { LW, H } from './layout';

/** Desde esta profundidad, todo es interfaz (barra, columnas, avisos, pausa). */
export const TD_UI_DEPTH = 54;
/** Px CSS que puede moverse un dedo sin dejar de ser un toque. */
const SLOP_CSS = 10;
/** Lupa: lado y separación del dedo (px CSS) y tamaño de la casilla dentro (px CSS). */
const LOUPE_CSS = 128;
const LOUPE_LIFT_CSS = 36;
const LOUPE_CELL_CSS = 72;
/** Zoom máximo: la casilla llega a estos px CSS. */
const MAX_CELL_CSS = 84;

/** Profundidad del objeto o, si va dentro de contenedores, la del de más arriba (la que decide la cámara). */
function topDepth(o: Phaser.GameObjects.GameObject): number {
  let q: Phaser.GameObjects.GameObject = o;
  while (q.parentContainer) q = q.parentContainer;
  return (q as unknown as { depth?: number }).depth ?? 0;
}

export interface TdTouchHandlers {
  /** Toque (sin arrastre) en el mapa: punto del mundo y del lienzo. */
  tap(wx: number, wy: number, sx: number, sy: number): void;
  /** Lupa abierta o movida (mundo). */
  hold(wx: number, wy: number): void;
  /** Lupa cerrada: `commit` si el dedo se levantó con normalidad (elige esa casilla). */
  holdEnd(wx: number, wy: number, commit: boolean): void;
  /** ¿Se ignoran los gestos ahora (pausa, mejoras, fin)? */
  blocked(): boolean;
}

export class TdTouchMap {
  readonly cam: Phaser.Cameras.Scene2D.Camera;
  private loupe: Phaser.Cameras.Scene2D.Camera;
  private gesture: MapGesture;
  private zoom = 1;
  private fit = 1;
  private zMax = 1;
  private center = { x: 0, y: 0 };
  /** Visor del mapa (px de lienzo) y px CSS por px de lienzo. */
  private vp: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private cssPx = 1;
  private loupeAt: { x: number; y: number } | null = null;
  private loupeBox: Rect | null = null;
  private onPreRender = () => this.sweep();

  constructor(
    private scene: Phaser.Scene,
    private world: Rect,
    private cell: number,
    private h: TdTouchHandlers,
  ) {
    this.cam = scene.cameras.add(0, 0, 1, 1, false, 'tdMapa').setBackgroundColor(0x18202c);
    this.loupe = scene.cameras.add(0, 0, 1, 1, false, 'tdLupa').setBackgroundColor(0x18202c).setVisible(false);
    // Orden de pintado: mapa, lupa y por último la interfaz (la cámara principal, transparente)
    const list = scene.cameras.cameras;
    const main = scene.cameras.main;
    list.splice(list.indexOf(main), 1);
    list.push(main);
    // Sin fondo: en WebGL la cámara pinta su color si tiene alfa aunque `transparent` sea true, y tapaba el mapa
    main.setBackgroundColor('rgba(0,0,0,0)');
    this.gesture = new MapGesture(SLOP_CSS);
    // Dos dedos a la vez (pellizco): Phaser trae uno; los punteros son del juego entero
    const need = 3 - scene.input.manager.pointersTotal;
    if (need > 0) scene.input.addPointer(need);
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.onPreRender);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Coloca el visor del mapa en `mapDesign` (unidades de diseño) y recalcula el zoom de encaje. */
  layout(mapDesign: Rect, cssPerCanvas: number) {
    this.vp = designToCanvas(mapDesign, LW);
    this.cssPx = cssPerCanvas;
    this.gesture.setSlop(SLOP_CSS / Math.max(1e-6, cssPerCanvas));
    this.cam.setViewport(Math.round(this.vp.x), Math.round(this.vp.y), Math.max(1, Math.round(this.vp.w)), Math.max(1, Math.round(this.vp.h)));
    const oldFit = this.fit;
    this.fit = fitZoom(this.vp, this.world);
    this.zMax = maxZoom(this.fit, this.cell, MAX_CELL_CSS, cssPerCanvas);
    // Conserva el acercamiento relativo al cambiar de tamaño (girar, barras del navegador)
    const rel = oldFit > 0 && this.zoom > 0 ? this.zoom / oldFit : 1;
    this.zoom = clampZoom(this.fit * rel, this.fit, this.zMax);
    if (!this.center.x && !this.center.y) this.center = { x: this.world.x + this.world.w / 2, y: this.world.y + this.world.h / 2 };
    this.apply();
  }

  /** Acerca (o aleja) para que la casilla en (wx, wy) quede en el centro con el zoom `rel` × encaje. */
  focusOn(wx: number, wy: number, rel: number) {
    this.zoom = clampZoom(this.fit * rel, this.fit, this.zMax);
    this.center = { x: wx, y: wy };
    this.apply();
  }

  get zoomRel(): number {
    return this.fit > 0 ? this.zoom / this.fit : 1;
  }

  /** Lado de una casilla en pantalla (px de lienzo). */
  get cellCanvas(): number {
    return this.cell * this.zoom;
  }

  get cssPerCanvas(): number {
    return this.cssPx;
  }

  get zoomNow(): number {
    return this.zoom;
  }

  private apply() {
    const c = clampCenter(this.center.x, this.center.y, this.vp.w / this.zoom, this.vp.h / this.zoom, this.world);
    this.center = c;
    this.cam.setZoom(this.zoom).centerOn(c.x, c.y);
  }

  /** Punto del lienzo → mundo (con el zoom y el desplazamiento de la cámara del mapa). */
  worldAt(sx: number, sy: number): { x: number; y: number } {
    const p = this.cam.getWorldPoint(sx, sy);
    return { x: p.x, y: p.y };
  }

  /** Mundo → lienzo. */
  screenOf(wx: number, wy: number): { x: number; y: number } {
    const v = this.cam.worldView;
    return { x: this.cam.x + (wx - v.x) * this.zoom, y: this.cam.y + (wy - v.y) * this.zoom };
  }

  /** Mundo → diseño (para dibujar en la interfaz encima de una casilla). */
  designOf(wx: number, wy: number): { x: number; y: number } {
    const s = this.screenOf(wx, wy);
    return canvasToDesign(s.x, s.y, LW);
  }

  /** Recuadro de la lupa en diseño (para su marco), o null. */
  loupeFrame(): Rect | null {
    if (!this.loupeBox) return null;
    const a = canvasToDesign(this.loupeBox.x, this.loupeBox.y, LW);
    const b = canvasToDesign(this.loupeBox.x + this.loupeBox.w, this.loupeBox.y + this.loupeBox.h, LW);
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  }

  shake(ms: number, k: number) {
    this.cam.shake(ms, k);
  }

  private inVp(p: Phaser.Input.Pointer) {
    return p.x >= this.vp.x && p.y >= this.vp.y && p.x <= this.vp.x + this.vp.w && p.y <= this.vp.y + this.vp.h;
  }

  private onDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    if (!p.wasTouch || this.h.blocked()) return;
    // Un botón de la interfaz bajo el dedo se lo queda (la cámara de la interfaz se prueba antes)
    const ui = over.some((o) => topDepth(o) >= TD_UI_DEPTH);
    if (ui || !this.inVp(p)) return;
    this.run(this.gesture.down(p.id, p.x, p.y, this.scene.time.now));
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (!p.wasTouch) return;
    this.run(this.gesture.move(p.id, p.x, p.y));
  }

  private onUp(p: Phaser.Input.Pointer) {
    if (!p.wasTouch) return;
    this.run(this.gesture.up(p.id, p.x, p.y, p.wasCanceled));
  }

  private run(out: GestureOut[]) {
    for (const o of out) {
      if (o.kind === 'tap') {
        const w = this.worldAt(o.x, o.y);
        if (!this.h.blocked()) this.h.tap(w.x, w.y, o.x, o.y);
      } else if (o.kind === 'pan') {
        this.center = { x: this.center.x - o.dx / this.zoom, y: this.center.y - o.dy / this.zoom };
        this.apply();
      } else if (o.kind === 'pinch') {
        const z1 = clampZoom(this.zoom * o.factor, this.fit, this.zMax);
        const fx = o.cx - (this.vp.x + this.vp.w / 2);
        const fy = o.cy - (this.vp.y + this.vp.h / 2);
        const c = zoomAbout(this.center.x, this.center.y, this.zoom, z1, fx, fy);
        this.zoom = z1;
        this.center = { x: c.x - o.dx / z1, y: c.y - o.dy / z1 };
        this.apply();
      } else if (o.kind === 'hold') {
        this.loupeAt = { x: o.x, y: o.y };
        const w = this.worldAt(o.x, o.y);
        if (!this.h.blocked()) this.h.hold(w.x, w.y);
      } else if (o.kind === 'holdEnd') {
        this.loupeAt = null;
        const w = this.worldAt(o.x, o.y);
        this.h.holdEnd(w.x, w.y, o.commit && !this.h.blocked());
      }
    }
  }

  /** Cada fotograma: lupa por tiempo, dedos que el sistema ya no tiene pulsados y la cámara de la lupa. */
  update(time: number) {
    if (this.h.blocked() && this.gesture.active.length) this.release();
    this.run(this.gesture.tick(time));
    const pointers = this.scene.input.manager.pointers;
    this.run(this.gesture.sync((id) => pointers.some((q) => q.id === id && q.isDown)));
    this.updateLoupe();
  }

  private updateLoupe() {
    if (!this.loupeAt) {
      this.loupe.setVisible(false);
      this.loupeBox = null;
      return;
    }
    const k = Math.max(1e-6, this.cssPx);
    const size = LOUPE_CSS / k;
    // Dentro del visor del mapa si cabe; si no, dentro del lienzo
    const bounds = this.vp.w >= size && this.vp.h >= size ? this.vp : { x: 0, y: 0, w: LW, h: H };
    const r = loupeRect(this.loupeAt.x, this.loupeAt.y, size, LOUPE_LIFT_CSS / k, bounds);
    this.loupeBox = r;
    const w = this.worldAt(this.loupeAt.x, this.loupeAt.y);
    const z = Math.max(this.zoom * 2, LOUPE_CELL_CSS / (this.cell * k));
    this.loupe.setViewport(Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)).setZoom(z).centerOn(w.x, w.y).setVisible(true);
  }

  /** Suelta todos los dedos del mapa (pausa, perder el foco, cambio de escena): sin toque ni elección. */
  release() {
    this.run(this.gesture.releaseAll());
    this.loupeAt = null;
    this.updateLoupe();
  }

  /** Lo de debajo de TD_UI_DEPTH es mapa (cámaras del mapa y la lupa); lo de encima, interfaz. */
  private sweep() {
    const main = this.scene.cameras.main;
    const mapMask = this.cam.id | this.loupe.id;
    for (const o of this.scene.children.list) {
      const ui = ((o as unknown as { depth?: number }).depth ?? 0) >= TD_UI_DEPTH;
      o.cameraFilter = ui ? mapMask : main.id;
    }
  }

  destroy() {
    const s = this.scene;
    this.gesture.releaseAll();
    s.input.off('pointerdown', this.onDown, this);
    s.input.off('pointermove', this.onMove, this);
    s.input.off('pointerup', this.onUp, this);
    s.input.off('pointerupoutside', this.onUp, this);
    s.events.off(Phaser.Scenes.Events.PRE_RENDER, this.onPreRender);
  }
}
