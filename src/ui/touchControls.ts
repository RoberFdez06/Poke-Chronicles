// Controles táctiles de la partida (T35): solo en móvil o tableta (ver data/controls.ts `touchOnlyDevice`).
// Joystick a la izquierda (moverse), joystick a la derecha (disparar hacia donde lo empujes) y botones de poderes
// 1-4, objeto activo, bomba, poción (T49) y "Usar". La pausa es el botón ❚❚ del HUD (tocar = clic). Coordenadas reales de
// pantalla (las del HUD), con varios dedos a la vez.
import Phaser from 'phaser';
import { H, HUD, W } from './layout';

export type TouchButton = 'power1' | 'power2' | 'power3' | 'power4' | 'active' | 'bomb' | 'potion' | 'use' | 'parry';

const R = 86; // radio del joystick
const KNOB = 38;
const BTN = 30; // radio de los botones
/** Zona alrededor del joystick que lo coge al tocar. */
const GRAB = R * 1.7;

interface Stick {
  cx: number;
  cy: number;
  base: Phaser.GameObjects.Arc;
  knob: Phaser.GameObjects.Arc;
  pointer: number | null;
  vec: Phaser.Math.Vector2;
}

interface Btn {
  id: TouchButton;
  x: number;
  y: number;
  circle: Phaser.GameObjects.Arc;
  color: number;
  /** Apagado (recargando, vacío o sin carga). */
  dim: boolean;
}

export class TouchControls {
  private sticks: { move: Stick; aim: Stick };
  private buttons: Btn[] = [];
  private pressed = new Set<TouchButton>();
  private objects: Phaser.GameObjects.GameObject[] = [];
  /** Radio de toque de los botones (mínimo 44 px CSS de diámetro). */
  private hitR = BTN + 10;

  constructor(
    private scene: Phaser.Scene,
    /** Mete cada objeto en la capa del HUD (cámara sin zoom). */
    add: (o: Phaser.GameObjects.GameObject) => void,
  ) {
    // Hasta 4 dedos: dos joysticks y un botón a la vez
    scene.input.addPointer(3);
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      add(o);
      this.objects.push(o);
      return o;
    };
    const stick = (cx: number, cy: number, color: number): Stick => ({
      cx,
      cy,
      base: keep(scene.add.circle(cx, cy, R, 0x000000, 0.28).setStrokeStyle(4, color, 0.6)),
      knob: keep(scene.add.circle(cx, cy, KNOB, color, 0.55)),
      pointer: null,
      vec: new Phaser.Math.Vector2(),
    });
    const bottom = H - HUD.pad - R - 10;
    this.sticks = {
      move: stick(HUD.left.w / 2, bottom, 0x8fd3ff),
      aim: stick(W - HUD.right.w / 2, bottom, 0xff9a7a),
    };
    // Tamaño de los botones según lo que mide de verdad la pantalla: al menos 44 px CSS de zona de toque (en un
    // móvil el lienzo de 1920×1080 se ve a ~0,36, y con radio 30 los botones medían 22 px)
    const disp = Math.max(0.1, scene.scale.displaySize.width / W);
    const r = Math.round(Math.min(58, Math.max(BTN, 21 / disp)));
    this.hitR = Math.max(r + 8, 22 / disp);
    const btn = (id: TouchButton, x: number, y: number, label: string, color: number) => {
      const circle = keep(scene.add.circle(x, y, r, color, 0.55).setStrokeStyle(3, 0xffffff, 0.75));
      const size = Math.round(r * (label.length > 2 ? 0.46 : 0.8));
      keep(scene.add.text(x, y, label, { fontFamily: 'sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setStroke('#101828', 3));
      this.buttons.push({ id, x, y, circle, color, dim: false });
    };
    // Dos columnas dentro de cada franja lateral, encima de su joystick (no tapan la sala ni se pisan)
    const col = Math.min(62, HUD.right.w / 2 - r - 2);
    const row1 = bottom - R - r - 14;
    const row2 = row1 - 2 * r - 14;
    const row3 = row2 - 2 * r - 14;
    const ax = this.sticks.aim.cx;
    btn('power1', ax - col, row2, '1', 0x3b6fd6);
    btn('power2', ax + col, row2, '2', 0x3b6fd6);
    btn('power3', ax - col, row1, '3', 0x3b6fd6);
    btn('power4', ax + col, row1, '4', 0x3b6fd6);
    // T53: parry encima de los poderes, a mano del pulgar derecho (el que apunta)
    btn('parry', ax, row3, 'Parry', 0xd4a017);
    const lx = this.sticks.move.cx;
    btn('active', lx - col, row2, 'Activo', 0x8e44ad);
    btn('bomb', lx + col, row2, 'Bomba', 0x555555);
    btn('use', lx - col, row1, 'Usar', 0x2e9e5b);
    btn('potion', lx + col, row1, 'Poción', 0x9b59d0);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /**
   * Botón de poder `i` (0-3) con el color del tipo del poder que tiene (gris si la ranura está vacía) y apagado
   * mientras recarga: en táctil las ranuras del HUD se esconden (las tapaban estos botones) y esto las sustituye.
   */
  setPower(i: number, color: number | null, ready: boolean): void {
    const b = this.buttons.find((x) => x.id === `power${i + 1}`);
    if (!b) return;
    b.color = color ?? 0x4a5468;
    b.dim = color === null || !ready;
    this.paint(b);
  }

  /** Botón «Activo»: gris sin objeto, apagado mientras se carga y encendido cuando está listo. */
  setActiveReady(has: boolean, ready: boolean): void {
    const b = this.buttons.find((x) => x.id === 'active');
    if (!b) return;
    b.color = has ? 0x8e44ad : 0x4a5468;
    b.dim = !ready;
    this.paint(b);
  }

  private paint(b: Btn) {
    if (!b.circle.active) return;
    b.circle.setFillStyle(b.color, b.dim ? 0.28 : 0.6).setStrokeStyle(3, 0xffffff, b.dim ? 0.35 : 0.85);
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
    return this.buttons.find((b) => Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y) <= this.hitR) ?? null;
  }

  private onDown(p: Phaser.Input.Pointer) {
    const b = this.hitButton(p);
    if (b) {
      this.pressed.add(b.id);
      b.circle.setFillStyle(b.circle.fillColor, 0.9);
      this.scene.time.delayedCall(120, () => b.circle.active && this.paint(b));
      return;
    }
    for (const s of [this.sticks.move, this.sticks.aim]) {
      if (s.pointer === null && Phaser.Math.Distance.Between(p.x, p.y, s.cx, s.cy) <= GRAB) {
        s.pointer = p.id;
        this.follow(s, p);
        return;
      }
    }
  }

  private onMove(p: Phaser.Input.Pointer) {
    for (const s of [this.sticks.move, this.sticks.aim]) if (s.pointer === p.id) this.follow(s, p);
  }

  private onUp(p: Phaser.Input.Pointer) {
    for (const s of [this.sticks.move, this.sticks.aim]) {
      if (s.pointer !== p.id) continue;
      s.pointer = null;
      s.vec.set(0, 0);
      s.knob.setPosition(s.cx, s.cy);
    }
  }

  private follow(s: Stick, p: Phaser.Input.Pointer) {
    const v = new Phaser.Math.Vector2(p.x - s.cx, p.y - s.cy);
    const len = Math.min(v.length(), R);
    // Zona muerta pequeña en el centro
    if (len < R * 0.15) s.vec.set(0, 0);
    else s.vec.copy(v.normalize().scale(len / R));
    s.knob.setPosition(s.cx + s.vec.x * R, s.cy + s.vec.y * R);
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('pointerupoutside', this.onUp, this);
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
  }
}
