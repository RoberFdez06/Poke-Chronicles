import Phaser from 'phaser';
import { addHelpBar } from '../ui/helpBar';
import { COVER_H, COVER_W, DCX, DCY, fitDesign } from '../ui/layout';
import { MenuList, NavInput } from '../ui/nav';
import { FONT, HEX } from '../ui/theme';
import { addForgeFrame } from '../ui/art/forgeArt';
import { addPixelText } from '../ui/art/pixel';
import { sfx } from '../ui/audio';

export interface ItemChoiceData {
  /** Título en mayúsculas (FORJA, HUECOS LLENOS…). */
  title: string;
  /** Una o dos líneas de explicación: qué estás eligiendo, coste y resultado. */
  text: string;
  /** Opciones; la última que se añade sola es «Cancelar». */
  options: string[];
  /** Texto de la opción de salir (por defecto «Cancelar»). */
  cancel?: string;
  /** T79: opciones apagadas (no se pueden pagar): se ven más tenues y al elegirlas no pasa nada. */
  disabled?: boolean[];
  /** Índice elegido o -1 si cancelas (Esc, B o la última opción). */
  onChoice: (index: number) => void;
}

/**
 * Lista genérica para elegir un objeto (T73): soltar uno con los huecos llenos y los pasos de la forja (qué reciclar,
 * qué fusionar y la confirmación con el coste y el resultado). Teclado (flechas + Enter, números 1-9), ratón (clic)
 * y mando (cruceta/stick + A); Esc o B cancelan. Se usa en pausa sobre GameScene, como SlotSwapScene.
 */
export class ItemChoiceScene extends Phaser.Scene {
  private args!: ItemChoiceData;
  private nav!: NavInput;
  private menu!: MenuList;
  private done = false;

  constructor() {
    super('ItemChoice');
  }

  init(data: ItemChoiceData) {
    this.args = data;
    this.done = false;
    this.sys.settings.data = {};
  }

  create() {
    fitDesign(this);
    this.nav = new NavInput(this);
    // Marco de hierro con yunques (forja) o huecos dibujados: ui/art/forgeArt.ts
    this.add.rectangle(DCX, DCY, COVER_W + 4, COVER_H + 4, 0x0d1425, 0.82).setInteractive();
    addForgeFrame(this, 130, 30, 700, 580, this.args.title);
    addPixelText(this, 480, 62, this.args.title, { size: 16, scale: 2.2, color: '#f8d030', stroke: '#283068', strokeWidth: 3, shadow: '#101828' });
    this.add
      .text(480, 112, this.args.text, { fontFamily: FONT, fontSize: '16px', color: HEX.text, align: 'center', wordWrap: { width: 640 }, lineSpacing: 4 })
      .setOrigin(0.5);
    const labels = this.args.options.map((o, i) => (i < 9 ? `${i + 1} · ${o}` : o));
    labels.push(this.args.cancel ?? 'Cancelar');
    // Hasta 16 objetos + cancelar: filas bajas para que quepan todas sin desplazar
    const many = labels.length > 8;
    this.menu = new MenuList(this, 480, 160, labels, (i) => this.pick(i), { w: 560, h: many ? 22 : 40, gap: many ? 3 : 8, fontSize: many ? 14 : 18 });
    this.args.disabled?.forEach((off, i) => off && this.menu.setDimmed(i, true));
    addHelpBar(this, 480, 596, 'Flechas o ratón · Enter o clic · 1-9 elige · Esc: cancelar', { fontFamily: FONT, fontSize: '13px', color: HEX.textSoft })
      .setOrigin(0.5);
    (['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'] as const).forEach((k, i) =>
      this.input.keyboard?.on(`keydown-${k}`, () => i < this.args.options.length && this.pick(i)),
    );
    sfx('select');
  }

  private pick(i: number) {
    if (this.done) return;
    if (this.args.disabled?.[i]) return sfx('hurt');
    this.done = true;
    this.args.onChoice(i >= this.args.options.length ? -1 : i);
  }

  update() {
    if (this.done) return;
    const s = this.nav.read();
    if (s.back) return this.pick(this.args.options.length);
    this.menu.move(s.dy || s.dx);
    if (s.ok) this.menu.activate();
  }
}
