import Phaser from 'phaser';

const FONT = 'system-ui, sans-serif';
const NAVY = 0x2b3a67;
const PANEL = 0xeaf4ff;
const GOLD = 0xffd34d;

type Key = Phaser.Input.Keyboard.Key;
type KeyName = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'W' | 'A' | 'S' | 'D' | 'ENTER' | 'SPACE' | 'ESC' | 'P';

export interface NavState {
  dx: number;
  dy: number;
  /** Enter / espacio / A. */
  ok: boolean;
  /** Esc / B. */
  back: boolean;
  /** P / Start. */
  pause: boolean;
}

/**
 * Lectura de menús con teclado y mando (el ratón va en los botones de MenuList).
 * Al crearse toma el estado actual del mando, así un botón que ya estaba pulsado no cuenta.
 */
export class NavInput {
  private keys: Record<KeyName, Key>;
  private prev: Record<string, boolean>;

  constructor(private scene: Phaser.Scene) {
    this.keys = scene.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,ENTER,SPACE,ESC,P', false) as Record<KeyName, Key>;
    // Las teclas que ya estaban pulsadas al abrir no cuentan
    Object.values(this.keys).forEach((k) => (k as Key & { _justDown: boolean })._justDown = false);
    this.prev = this.padNow();
  }

  private padNow(): Record<string, boolean> {
    const pad = this.scene.input.gamepad?.getPad(0);
    if (!pad || !pad.connected) return {};
    return {
      up: pad.up || pad.leftStick.y < -0.5,
      down: pad.down || pad.leftStick.y > 0.5,
      left: pad.left || pad.leftStick.x < -0.5,
      right: pad.right || pad.leftStick.x > 0.5,
      ok: pad.A,
      back: pad.B,
      pause: !!pad.buttons[9]?.pressed || !!pad.buttons[8]?.pressed,
    };
  }

  read(): NavState {
    const J = Phaser.Input.Keyboard.JustDown;
    const k = this.keys;
    const s: NavState = {
      dx: (J(k.RIGHT) || J(k.D) ? 1 : 0) - (J(k.LEFT) || J(k.A) ? 1 : 0),
      dy: (J(k.DOWN) || J(k.S) ? 1 : 0) - (J(k.UP) || J(k.W) ? 1 : 0),
      ok: J(k.ENTER) || J(k.SPACE),
      back: J(k.ESC),
      pause: J(k.P),
    };
    const now = this.padNow();
    const edge = (name: string) => !!now[name] && !this.prev[name];
    if (edge('up')) s.dy -= 1;
    if (edge('down')) s.dy += 1;
    if (edge('left')) s.dx -= 1;
    if (edge('right')) s.dx += 1;
    if (edge('ok')) s.ok = true;
    if (edge('back')) s.back = true;
    if (edge('pause')) s.pause = true;
    this.prev = now;
    return s;
  }
}

export interface MenuListOptions {
  w?: number;
  h?: number;
  gap?: number;
  fontSize?: number;
  depth?: number;
}

/** Columna de botones: ratón (pasar y clic), y move()/activate() para teclado y mando. */
export class MenuList {
  readonly container: Phaser.GameObjects.Container;
  private items: { bg: Phaser.GameObjects.Graphics; box: Phaser.GameObjects.Container }[] = [];
  selected = 0;
  /** Solo la lista activa responde (las de debajo de un diálogo, no). */
  active = true;
  private w: number;
  private h: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    labels: string[],
    private onPick: (index: number) => void,
    opts: MenuListOptions = {},
  ) {
    this.w = opts.w ?? 300;
    this.h = opts.h ?? 54;
    const gap = opts.gap ?? 14;
    this.container = scene.add.container(x, y).setDepth(opts.depth ?? 0);
    labels.forEach((label, i) => {
      const bg = scene.add.graphics();
      const text = scene.add
        .text(0, 0, label, { fontFamily: FONT, fontSize: `${opts.fontSize ?? 24}px`, fontStyle: 'bold', color: '#2b3a67' })
        .setOrigin(0.5);
      const box = scene.add.container(0, i * (this.h + gap), [bg, text]).setSize(this.w, this.h);
      box.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.w, this.h) /* Phaser la centra solo */, Phaser.Geom.Rectangle.Contains);
      box.input!.cursor = 'pointer';
      box.on('pointerover', () => this.active && this.select(i));
      box.on('pointerdown', () => {
        if (!this.active) return;
        this.select(i);
        this.onPick(i);
      });
      this.container.add(box);
      this.items.push({ bg, box });
    });
    this.select(0);
  }

  select(i: number) {
    this.selected = i;
    this.items.forEach(({ bg, box }, k) => {
      const sel = k === i;
      bg.clear();
      bg.fillStyle(sel ? GOLD : PANEL, 1).fillRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, 16);
      bg.lineStyle(5, NAVY, 1).strokeRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, 16);
      box.setScale(sel ? 1.05 : 1);
    });
  }

  move(d: number) {
    const n = this.items.length;
    if (d !== 0 && n > 0) this.select((this.selected + Math.sign(d) + n) % n);
  }

  activate() {
    this.onPick(this.selected);
  }

  destroy() {
    this.container.destroy();
  }
}

/** Fondo oscuro + panel para diálogos. El fondo se traga los clics. */
export function addPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, depth: number) {
  const dim = scene.add.rectangle(480, 320, 960, 640, 0x000000, 0.65).setInteractive().setScrollFactor(0);
  const panel = scene.add.graphics().setScrollFactor(0);
  panel.fillStyle(PANEL, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 24);
  panel.lineStyle(6, NAVY, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 24);
  return scene.add.container(0, 0, [dim, panel]).setDepth(depth);
}

export const UI = { FONT, NAVY, PANEL, GOLD };
