import Phaser from 'phaser';
import { COVER_H, COVER_W, DCX, DCY, fitDesign } from '../ui/layout';
import { NavInput } from '../ui/nav';
import { drawBox, FONT, HEX } from '../ui/theme';
import { sfx } from '../ui/audio';
import { lowFx } from '../ui/theme';
import { addGymDoor, addGymSwitch, addPad, drawGymBlock, drawGymBoard, drawGymButton, drawGymTrainer } from '../ui/art/gymPuzzleArt';
import {
  GYM_PUZZLE_LABEL, generateGymPuzzle, rockStep, rockSolved, iceSlide, pressSwitch, electricSolved, ghostClueText,
  isWall, type Board, type Cell, type Dir, type GymPuzzle, type GymPuzzleKind, type RockState,
} from '../level/gymPuzzles';

export interface GymPuzzleData {
  kind: GymPuzzleKind;
  seed: number;
  tier: number;
  /** true si lo resolvió; false si se rindió (Esc/B): el paso al líder se abre igual, pero sin premio. */
  onDone: (solved: boolean) => void;
}

const CELL = 64;
const GX = DCX - (7 * CELL) / 2;
const GY = 210;

/**
 * T86: puzzle del gimnasio antes del líder. Se lanza en pausa sobre GameScene. Teclado (flechas/WASD, Enter, R, Esc),
 * ratón (clic en una casilla de la fila/columna, en un interruptor o en una puerta; botones de abajo) y mando
 * (cruceta/stick, A, Y reinicia, B se rinde) funcionan cada uno por separado.
 * Arte: ui/art/gymPuzzleArt.ts (baldosas, rocas, bloque que desliza, interruptores que se hunden, puertas que se abren).
 */
export class GymPuzzleScene extends Phaser.Scene {
  private args!: GymPuzzleData;
  private puzzle!: GymPuzzle;
  private nav!: NavInput;
  private done = false;
  private layer!: Phaser.GameObjects.Container;
  private info!: Phaser.GameObjects.Text;
  private rock?: RockState;
  private ice?: Cell;
  private progress = 0;
  private sel = 0;
  private triedDoors = new Set<number>();
  private showing = false;
  private padY = false;
  /** Solo dibujo: última posición de cada ficha (para deslizarla) y puerta que se acaba de abrir. */
  private lastAt = new Map<string, { x: number; y: number }>();
  private openingDoor = -1;

  constructor() {
    super('GymPuzzle');
  }

  init(data: GymPuzzleData) {
    this.args = data;
    this.done = false;
    this.lastAt.clear();
    this.openingDoor = -1;
    this.sys.settings.data = {};
  }

  create() {
    fitDesign(this);
    this.nav = new NavInput(this);
    this.puzzle = generateGymPuzzle(this.args.kind, this.args.seed, this.args.tier);
    this.add.rectangle(DCX, DCY, COVER_W + 4, COVER_H + 4, 0x0d1425, 0.86).setInteractive();
    drawBox(this.add.graphics(), 90, 30, 780, 580, { radius: 16, border: 0xf8d030 });
    this.add.text(480, 66, 'GIMNASIO', { fontFamily: FONT, fontSize: '28px', color: '#f8d030' }).setOrigin(0.5);
    this.add.text(480, 104, GYM_PUZZLE_LABEL[this.args.kind], { fontFamily: FONT, fontSize: '17px', color: HEX.text }).setOrigin(0.5);
    this.info = this.add.text(480, 140, '', { fontFamily: FONT, fontSize: '15px', color: HEX.textSoft, align: 'center', wordWrap: { width: 720 } }).setOrigin(0.5, 0);
    this.layer = this.add.container(0, 0);
    this.button(360, 580, 'Reiniciar (R / Y)', () => this.reset());
    this.button(600, 580, 'Rendirse (Esc / B)', () => this.finish(false));
    this.input.keyboard?.on('keydown-R', () => this.reset());
    (['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'] as const).forEach((k, i) => this.input.keyboard?.on(`keydown-${k}`, () => this.choose(i)));
    this.reset();
    sfx('select');
  }

  private button(x: number, y: number, label: string, cb: () => void) {
    const g = this.add.graphics();
    drawGymButton(g, x, y, 214, 38, false);
    const r = this.add.rectangle(x, y, 214, 38, 0x000000, 0).setInteractive({ useHandCursor: true });
    this.add.text(x, y - 1, label, { fontFamily: FONT, fontSize: '14px', color: HEX.text }).setOrigin(0.5);
    r.on('pointerdown', cb);
    r.on('pointerover', () => drawGymButton(g, x, y, 214, 38, true));
    r.on('pointerout', () => drawGymButton(g, x, y, 214, 38, false));
  }

  private reset() {
    if (this.done || this.showing) return;
    const p = this.puzzle;
    this.progress = 0;
    this.sel = 0;
    if (p.kind === 'roca') this.rock = { player: { ...p.start.player }, block: { ...p.start.block } };
    if (p.kind === 'hielo') this.ice = { ...p.start };
    if (p.kind === 'electrico') this.flashOrder();
    this.redraw();
  }

  /** Eléctrico: enseña el orden encendiendo los interruptores uno a uno. */
  private flashOrder() {
    if (this.puzzle.kind !== 'electrico') return;
    const order = this.puzzle.order;
    this.showing = true;
    order.forEach((i, k) => {
      this.time.delayedCall(500 + k * 650, () => { this.redraw(i); sfx('select'); });
      this.time.delayedCall(500 + k * 650 + 450, () => this.redraw());
    });
    this.time.delayedCall(500 + order.length * 650, () => { this.showing = false; this.redraw(); });
  }

  private drawBoard(b: Board) {
    const g = this.add.graphics();
    drawGymBoard(g, GX, GY, CELL, b.w, b.h, (x, y) => isWall(b, x, y), this.args.kind === 'hielo');
    this.layer.add(g);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      const wall = isWall(b, x, y);
      const r = this.add.rectangle(GX + x * CELL + CELL / 2, GY + y * CELL + CELL / 2, CELL - 4, CELL - 4, 0x000000, 0);
      if (!wall) r.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.clickCell(x, y));
      this.layer.add(r);
    }
  }
  private pad(c: Cell, color: number, exit: boolean) {
    this.layer.add(addPad(this, GX + c.x * CELL + CELL / 2, GY + c.y * CELL + CELL / 2, CELL, color, exit));
  }
  /** Ficha dibujada en (0, 0) que desliza desde donde estaba (sin efectos bajos). */
  private token(key: string, c: Cell, draw: (g: Phaser.GameObjects.Graphics) => void) {
    const cx = GX + c.x * CELL + CELL / 2;
    const cy = GY + c.y * CELL + CELL / 2;
    const g = this.add.graphics();
    draw(g);
    const was = this.lastAt.get(key);
    this.lastAt.set(key, { x: cx, y: cy });
    this.layer.add(g);
    if (!was || lowFx() || (was.x === cx && was.y === cy)) return g.setPosition(cx, cy);
    g.setPosition(was.x, was.y);
    const steps = Math.max(Math.abs(cx - was.x), Math.abs(cy - was.y)) / CELL;
    this.tweens.add({ targets: g, x: cx, y: cy, duration: Math.min(320, 70 + steps * 50), ease: key === 'ice' ? 'Quad.easeIn' : 'Quad.easeOut' });
    return g;
  }

  private redraw(lit = -1) {
    this.tweens.killTweensOf(this.layer.list);
    this.layer.removeAll(true);
    const p = this.puzzle;
    if (p.kind === 'roca' && this.rock) {
      this.drawBoard(p.board);
      this.pad(p.target, 0xf8d030, false);
      const on = rockSolved(p, this.rock);
      this.token('block', this.rock.block, (g) => drawGymBlock(g, CELL, on));
      this.token('player', this.rock.player, (g) => drawGymTrainer(g));
      this.info.setText('Flechas, WASD, cruceta o clic en tu fila/columna para moverte. Empuja el bloque marrón hasta la casilla amarilla.');
    } else if (p.kind === 'hielo' && this.ice) {
      this.drawBoard(p.board);
      this.pad(p.goal, 0x4caf50, true);
      this.token('ice', this.ice, (g) => drawGymTrainer(g));
      this.info.setText('Resbalas hasta chocar con una roca. Llega a la casilla verde. Flechas, WASD, cruceta o clic en tu fila/columna.');
    } else if (p.kind === 'electrico') {
      const w = 96;
      const x0 = DCX - ((p.count - 1) * (w + 16)) / 2;
      for (let i = 0; i < p.count; i++) {
        const on = i === lit;
        this.layer.add(addGymSwitch(this, x0 + i * (w + 16), 330, w, 120, { lit: on, sel: i === this.sel && !this.showing, sink: on }));
        const r = this.add.rectangle(x0 + i * (w + 16), 330, w, 120, 0x000000, 0);
        r.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.choose(i));
        this.layer.add([r, this.add.text(r.x, 420, String(i + 1), { fontFamily: FONT, fontSize: '20px', color: HEX.text }).setOrigin(0.5)]);
      }
      this.info.setText(this.showing ? 'Mira el orden…' : `Pulsa en el orden que se encendieron (${this.progress}/${p.order.length}). Un fallo reinicia. R / Y lo repite.`);
    } else if (p.kind === 'fantasma') {
      const w = 90;
      const x0 = DCX - ((p.doors - 1) * (w + 20)) / 2;
      for (let i = 0; i < p.doors; i++) {
        const tried = this.triedDoors.has(i);
        const real = this.done && i === p.real;
        this.layer.add(addGymDoor(this, x0 + i * (w + 20), 360, w, 150, { open: tried || real, opening: i === this.openingDoor, real, sel: i === this.sel }));
        const r = this.add.rectangle(x0 + i * (w + 20), 360, w, 150, 0x000000, 0);
        if (!tried) r.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.choose(i));
        this.layer.add([r, this.add.text(r.x, 455, String(i + 1), { fontFamily: FONT, fontSize: '20px', color: HEX.text }).setOrigin(0.5)]);
      }
      this.info.setText(`Pistas: ${p.clues.map(ghostClueText).join(' ')}\nElige con flechas + Enter/A, números o clic.`);
      this.openingDoor = -1;
    }
  }

  private clickCell(x: number, y: number) {
    const at = this.rock?.player ?? this.ice;
    if (!at) return;
    if (x === at.x && y !== at.y) this.move(y < at.y ? 'up' : 'down');
    else if (y === at.y && x !== at.x) this.move(x < at.x ? 'left' : 'right');
  }

  private move(d: Dir) {
    if (this.done) return;
    const p = this.puzzle;
    if (p.kind === 'roca' && this.rock) {
      this.rock = rockStep(p.board, this.rock, d);
      this.redraw();
      if (rockSolved(p, this.rock)) this.finish(true);
    } else if (p.kind === 'hielo' && this.ice) {
      this.ice = iceSlide(p.board, this.ice, d, p.goal);
      this.redraw();
      if (this.ice.x === p.goal.x && this.ice.y === p.goal.y) this.finish(true);
    }
  }

  private choose(i: number) {
    if (this.done || this.showing) return;
    const p = this.puzzle;
    if (p.kind === 'electrico' && i < p.count) {
      this.sel = i;
      const before = this.progress;
      this.progress = pressSwitch(p, this.progress, i);
      sfx(this.progress > before ? 'select' : 'hurt');
      this.redraw(this.progress > before ? i : -1);
      if (electricSolved(p, this.progress)) this.finish(true);
    } else if (p.kind === 'fantasma' && i < p.doors && !this.triedDoors.has(i)) {
      this.sel = i;
      this.openingDoor = i;
      if (i === p.real) {
        this.finish(true);
        return this.redraw();
      }
      sfx('hurt');
      this.triedDoors.add(i);
      this.cameras.main.shake(120, 0.004);
      this.redraw();
    }
  }

  private finish(solved: boolean) {
    if (this.done) return;
    this.done = true;
    sfx(solved ? 'select' : 'hurt');
    this.time.delayedCall(solved ? 450 : 0, () => this.args.onDone(solved));
  }

  update() {
    if (this.done) return;
    const s = this.nav.read();
    if (s.back) return this.finish(false);
    const pad = this.input.gamepad?.getPad(0);
    const y = !!pad?.connected && !!pad.Y;
    if (y && !this.padY) this.reset();
    this.padY = y;
    const p = this.puzzle;
    if (p.kind === 'roca' || p.kind === 'hielo') {
      if (s.dx) this.move(s.dx < 0 ? 'left' : 'right');
      else if (s.dy) this.move(s.dy < 0 ? 'up' : 'down');
    } else if (!this.showing) {
      const n = p.kind === 'electrico' ? p.count : p.doors;
      if (s.dx) { this.sel = (this.sel + s.dx + n) % n; this.redraw(); }
      if (s.ok) this.choose(this.sel);
    }
  }
}
