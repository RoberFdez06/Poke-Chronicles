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
}

export class TouchControls {
  private sticks: { move: Stick; aim: Stick };
  private buttons: Btn[] = [];
  private pressed = new Set<TouchButton>();
  private objects: Phaser.GameObjects.GameObject[] = [];

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
    const btn = (id: TouchButton, x: number, y: number, label: string, color: number) => {
      const circle = keep(scene.add.circle(x, y, BTN, color, 0.5).setStrokeStyle(3, 0xffffff, 0.7));
      keep(scene.add.text(x, y, label, { fontFamily: 'sans-serif', fontSize: label.length > 2 ? '15px' : '24px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5));
      this.buttons.push({ id, x, y, circle });
    };
    // Encima del joystick derecho: poderes 1-4 en rombo; encima del izquierdo: activo, bomba y usar
    const ax = this.sticks.aim.cx;
    const ay = bottom - R - 100;
    btn('power1', ax, ay - 46, '1', 0x3b6fd6);
    btn('power2', ax + 56, ay, '2', 0x3b6fd6);
    btn('power3', ax, ay + 46, '3', 0x3b6fd6);
    btn('power4', ax - 56, ay, '4', 0x3b6fd6);
    // T53: parry encima del rombo de poderes, a mano del pulgar derecho (el que apunta)
    btn('parry', ax, ay - 112, 'Parry', 0xd4a017);
    const lx = this.sticks.move.cx;
    const ly = bottom - R - 70;
    btn('active', lx - 64, ly, 'Activo', 0x8e44ad);
    btn('bomb', lx, ly - 30, 'Bomba', 0x555555);
    btn('use', lx + 64, ly, 'Usar', 0x2e9e5b);
    btn('potion', lx, ly + 34, 'Poción', 0x9b59d0);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
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
    return this.buttons.find((b) => Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y) <= BTN + 10) ?? null;
  }

  private onDown(p: Phaser.Input.Pointer) {
    const b = this.hitButton(p);
    if (b) {
      this.pressed.add(b.id);
      b.circle.setFillStyle(b.circle.fillColor, 0.9);
      this.scene.time.delayedCall(120, () => b.circle.active && b.circle.setFillStyle(b.circle.fillColor, 0.5));
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
