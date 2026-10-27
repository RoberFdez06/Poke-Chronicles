import { MOVE_RARITY_LABEL, moveRarity } from '../data/items';
import Phaser from 'phaser';
import { addHelpBar } from '../ui/helpBar';
import { COVER_H, COVER_W, DCX, DCY, fitDesign } from '../ui/layout';
import { MenuList, NavInput } from '../ui/nav';
import { drawBox, FONT, HEX } from '../ui/theme';
import { addPixelText } from '../ui/art/pixel';
import { sfx } from '../ui/audio';
import { typeColor, typeNameEs } from '../data/types';
import type { MovePower } from '../data/items';

export interface SlotSwapData {
  /** El poder nuevo. */
  move: MovePower;
  /** Lo que llevas ahora en cada ranura (todas llenas). */
  slots: (MovePower | null)[];
  /** Ranura elegida (0 a 3) o -1 si prefieres quedarte como estás. */
  onChoice: (slot: number) => void;
}

const pretty = (s: string) => s.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

/**
 * Llevas 4 poderes y te ofrecen uno nuevo (suelo, tienda o mercader): aquí eliges cuál sustituir o lo dejas.
 * Teclado (flechas + Enter o 1-4), ratón y mando; Esc o B = dejarlo.
 */
export class SlotSwapScene extends Phaser.Scene {
  private args!: SlotSwapData;
  private nav!: NavInput;
  private menu!: MenuList;
  private done = false;

  constructor() {
    super('SlotSwap');
  }

  init(data: SlotSwapData) {
    this.args = data;
    this.done = false;
    this.sys.settings.data = {};
  }

  create() {
    fitDesign(this);
    this.nav = new NavInput(this);
    this.add.rectangle(DCX, DCY, COVER_W + 4, COVER_H + 4, 0x0d1425, 0.82).setInteractive();
    drawBox(this.add.graphics(), 130, 70, 700, 500, { radius: 16, border: 0xd4a017 });
    addPixelText(this, 480, 112, 'CAMBIAR PODER', { size: 16, scale: 2.4, color: '#f8d030', stroke: '#283068', strokeWidth: 3, shadow: '#101828' });
    const m = this.args.move;
    this.add.circle(250, 178, 9, typeColor(m.type)).setStrokeStyle(2, 0xffffff);
    this.add
      .text(270, 178, `Nuevo: ${pretty(m.name)} · ${typeNameEs(m.type)} · ${MOVE_RARITY_LABEL[moveRarity(m.power)]} · potencia ${m.power}`, { fontFamily: FONT, fontSize: '19px', color: HEX.text })
      .setOrigin(0, 0.5);
    this.add.text(480, 216, '¿Cuál quieres sustituir?', { fontFamily: FONT, fontSize: '16px', color: HEX.textSoft }).setOrigin(0.5);
    const labels = this.args.slots.map((s, i) => (s ? `${i + 1} · ${pretty(s.name)} (${typeNameEs(s.type)}, pot. ${s.power})` : `${i + 1} · vacío`));
    labels.push('Dejarlo como está');
    this.menu = new MenuList(this, 480, 250, labels, (i) => this.pick(i), { w: 500, h: 46, gap: 8, fontSize: 18 });
    addHelpBar(this, 480, 542, 'Flechas o ratón · Enter o clic · 1-4 elige · Esc: dejarlo', { fontFamily: FONT, fontSize: '13px', color: HEX.textSoft }).setOrigin(0.5);
    (['ONE', 'TWO', 'THREE', 'FOUR'] as const).forEach((k, i) => this.input.keyboard?.on(`keydown-${k}`, () => this.pick(i)));
    sfx('select');
  }

  private pick(i: number) {
    if (this.done) return;
    this.done = true;
    this.args.onChoice(i >= this.args.slots.length ? -1 : i);
  }

  update() {
    if (this.done) return;
    const s = this.nav.read();
    if (s.back) return this.pick(this.args.slots.length);
    this.menu.move(s.dy || s.dx);
    if (s.ok) this.menu.activate();
  }
}
