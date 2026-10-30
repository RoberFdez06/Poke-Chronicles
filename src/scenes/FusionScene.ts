import Phaser from 'phaser';
import { addHelpBar } from '../ui/helpBar';
import { COVER_H, COVER_W, DCX, DCY, fitDesign } from '../ui/layout';
import { MenuList, NavInput } from '../ui/nav';
import { drawBox, FONT, HEX } from '../ui/theme';
import { addPixelText } from '../ui/art/pixel';
import { sfx } from '../ui/audio';
import { typeColor, typeNameEs } from '../data/types';
import type { MovePower } from '../data/items';
import { fusePowers, fusionBlock, fusionStyleOf, patternLabel, recipeByKey } from '../data/fusion';
import { addFusionPreview, fusionFlash } from '../ui/art/fusionArt';
import { openConfirm } from './ConfirmScene';

export interface FusionData {
  slots: (MovePower | null)[];
  /** Piso (o ronda) actual y último en el que se fusionó (0 = nunca). */
  floor: number;
  usedFloor: number;
  /** Panel admin: sin límite de una por piso. */
  free?: boolean;
  /** Fusiona las ranuras i (se queda el resultado) y j (queda libre). */
  onFuse: (i: number, j: number) => void;
  onClose: () => void;
}

const pretty = (s: string) => s.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
const typesOf = (m: MovePower) => (m.fusion ? m.fusion.types.map(typeNameEs).join('/') : typeNameEs(m.type));

/**
 * Fusionar poderes (desde la pausa): eliges el primer poder, luego el segundo, ves el resultado (nombre, tipos, daño,
 * patrón y su proyectil animado) y lo confirmas. Teclado (flechas, Enter, Esc, 1-4), ratón y mando.
 */
export class FusionScene extends Phaser.Scene {
  private args!: FusionData;
  private nav!: NavInput;
  private menu?: MenuList;
  private step: 'first' | 'second' | 'preview' = 'first';
  private first = -1;
  private second = -1;
  private layer?: Phaser.GameObjects.Container;
  private preview?: Phaser.GameObjects.Graphics;
  private note!: Phaser.GameObjects.Text;
  private busy = false;
  private done = false;

  constructor() {
    super('Fusion');
  }

  init(data: FusionData) {
    this.args = data;
    this.step = 'first';
    this.first = -1;
    this.second = -1;
    this.busy = false;
    this.done = false;
    this.sys.settings.data = {};
  }

  create() {
    fitDesign(this);
    this.nav = new NavInput(this);
    this.add.rectangle(DCX, DCY, COVER_W + 4, COVER_H + 4, 0x0d1425, 0.85).setInteractive();
    drawBox(this.add.graphics(), 90, 50, 780, 540, { radius: 16, border: 0xd4a017 });
    addPixelText(this, 480, 90, 'FUSIONAR PODERES', { size: 16, scale: 2.4, color: '#f8d030', stroke: '#283068', strokeWidth: 3, shadow: '#101828' });
    const limit = this.args.free ? 'Panel admin: sin límite.' : this.args.usedFloor === this.args.floor ? 'Ya has fusionado en este piso.' : 'Una fusión por piso. Es para siempre.';
    this.add.text(120, 126, `Junta dos poderes en uno más fuerte; la otra ranura queda libre. ${limit}`, {
      fontFamily: FONT, fontSize: '14px', color: HEX.textSoft, wordWrap: { width: 720 },
    });
    // Avisos abajo a la izquierda (nunca en el centro)
    this.note = this.add.text(120, 530, '', { fontFamily: FONT, fontSize: '15px', color: '#b03030', wordWrap: { width: 720 } });
    addHelpBar(this, 480, 566, 'Flechas o ratón · Enter o clic · 1-4 elige · Esc: atrás', { fontFamily: FONT, fontSize: '13px', color: HEX.textSoft }).setOrigin(0.5);
    (['ONE', 'TWO', 'THREE', 'FOUR'] as const).forEach((k, i) => this.input.keyboard?.on(`keydown-${k}`, () => this.pickSlot(i)));
    this.showList();
    sfx('select');
  }

  /** Lista de ranuras para elegir la primera o la segunda. */
  private showList() {
    this.clearStep();
    const s = this.args.slots;
    const title = this.step === 'first' ? 'Primer poder:' : `${pretty(s[this.first]?.name ?? '')} + ¿cuál?`;
    this.layer = this.add.container(0, 0);
    this.layer.add(this.add.text(120, 160, title, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: HEX.text }));
    const labels = s.map((m, i) => {
      if (!m) return `${i + 1} · vacía`;
      const tag = m.fusion ? ' · fusionado' : '';
      const mark = i === this.first ? ' (elegido)' : '';
      return `${i + 1} · ${pretty(m.name)} (${typesOf(m)}, pot. ${m.power})${tag}${mark}`;
    });
    labels.push(this.step === 'first' ? 'Volver' : 'Atrás');
    this.menu = new MenuList(this, 480, 200, labels, (i) => (i >= s.length ? this.back() : this.pickSlot(i)), { w: 640, h: 50, gap: 10, fontSize: 17 });
  }

  private pickSlot(i: number) {
    if (this.busy || this.done || this.step === 'preview' || i >= this.args.slots.length) return;
    const s = this.args.slots;
    const m = s[i];
    if (!m) return this.warn('Esa ranura está vacía.');
    if (m.fusion) return this.warn('Un poder fusionado no se puede volver a fusionar.');
    if (this.step === 'first') {
      this.first = i;
      this.step = 'second';
      sfx('select');
      return this.showList();
    }
    const block = fusionBlock(s, this.first, i, this.args.floor, this.args.usedFloor, this.args.free);
    if (block) return this.warn(block);
    this.second = i;
    this.step = 'preview';
    sfx('select');
    this.showPreview();
  }

  /** Vista previa: nombre, tipos, daño, recarga, patrón y el proyectil animado. */
  private showPreview() {
    this.clearStep();
    const a = this.args.slots[this.first] as MovePower;
    const b = this.args.slots[this.second] as MovePower;
    const r = fusePowers(a, b);
    const f = r.fusion!;
    const style = fusionStyleOf(r)!;
    const kind = recipeByKey(f.recipe).kind;
    const L = this.add.container(0, 0);
    this.layer = L;
    const g = this.add.graphics();
    // Marco dorado con las dos mitades de color
    g.fillStyle(0x7a5a10, 1).fillRect(116, 156, 728, 214);
    g.fillStyle(0xf8d030, 1).fillRect(118, 158, 724, 210);
    g.fillStyle(typeColor(f.types[0]), 0.35).fillRect(122, 162, 358, 202);
    g.fillStyle(typeColor(f.types[1]), 0.35).fillRect(480, 162, 358, 202);
    g.fillStyle(0xfff8e0, 0.85).fillRect(126, 166, 708, 194);
    L.add(g);
    const t = (x: number, y: number, s: string, size = 16, color: string = HEX.text, bold = false) =>
      L.add(this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', wordWrap: { width: 380 } }));
    t(140, 172, `${pretty(a.name)} + ${pretty(b.name)}  →`, 15, HEX.textSoft);
    t(140, 196, r.name, 26, '#8a5a00', true);
    const kindLabel = kind === 'named' ? 'Receta descubierta' : kind === 'superior' ? 'Versión Superior' : 'Fusión de tipos';
    t(140, 234, `${kindLabel} · Tipos: ${f.types[0] === f.types[1] ? typeNameEs(f.types[0]) : `${typeNameEs(f.types[0])} + ${typeNameEs(f.types[1])}`}`, 15);
    t(140, 258, `Potencia ${r.power} (antes ${Math.max(a.power, b.power)}) · Recarga ${(r.cooldown / 1000).toFixed(1)} s`, 15);
    t(140, 282, `Ataque: ${patternLabel(r)}`, 15);
    t(140, 306, `Proyectil: ${style.shape} · estela ${style.trail} · impacto ${style.impact}`, 13, HEX.textSoft);
    t(140, 328, `Ranura ${this.first + 1}: el resultado · Ranura ${this.second + 1}: queda libre`, 13, HEX.textSoft);
    // Proyectil animado de la receta
    const box = this.add.graphics();
    box.fillStyle(0x101828, 1).fillRect(560, 180, 260, 120);
    L.add(box);
    this.preview = addFusionPreview(this, 690, 240, 220, style, typeColor(f.types[0]), typeColor(f.types[1]));
    this.menu = new MenuList(this, 480, 400, ['Fusionar', 'Elegir otros'], (i) => (i === 0 ? this.ask(r.name) : this.restart()), { w: 340, h: 50, gap: 12, fontSize: 19 });
  }

  /** Diálogo de confirmación (ConfirmScene). */
  private ask(name: string) {
    if (this.busy) return;
    const a = this.args.slots[this.first] as MovePower;
    const b = this.args.slots[this.second] as MovePower;
    const ok = openConfirm(this, `¿Fusionar ${pretty(a.name)} y ${pretty(b.name)} en ${name}?\nNo se puede deshacer${this.args.free ? '.' : ' y gasta la fusión del piso.'}`, (yes) => {
      this.nav = new NavInput(this);
      if (yes) this.fuse();
    }, 'CONFIRMAR FUSIÓN');
    if (!ok) this.warn('No se pudo abrir la confirmación.');
  }

  private fuse() {
    this.busy = true;
    this.menu?.destroy();
    this.menu = undefined;
    const f = fusePowers(this.args.slots[this.first] as MovePower, this.args.slots[this.second] as MovePower).fusion!;
    fusionFlash(this, 690, 240, typeColor(f.types[0]), typeColor(f.types[1]), 30);
    sfx('evolve');
    this.time.delayedCall(950, () => {
      this.done = true;
      this.args.onFuse(this.first, this.second);
    });
  }

  private restart() {
    this.first = -1;
    this.second = -1;
    this.step = 'first';
    this.showList();
  }

  private back() {
    if (this.busy) return;
    if (this.step === 'first') {
      this.done = true;
      return this.args.onClose();
    }
    if (this.step === 'second') return this.restart();
    this.step = 'second';
    this.second = -1;
    this.showList();
  }

  private warn(s: string) {
    this.note.setText(s);
    sfx('warn');
  }

  private clearStep() {
    this.menu?.destroy();
    this.menu = undefined;
    this.layer?.destroy();
    this.layer = undefined;
    this.preview?.destroy();
    this.preview = undefined;
    this.note?.setText('');
  }

  update() {
    if (this.done || this.busy || !this.menu) return;
    const s = this.nav.read();
    if (s.back) return this.back();
    this.menu.move(s.dy || s.dx);
    if (s.ok) this.menu.activate();
  }
}
