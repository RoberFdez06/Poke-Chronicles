import Phaser from 'phaser';
import { addHelpBar } from '../ui/helpBar';
import { COVER_H, COVER_W, DCX, DCY, fitDesign } from '../ui/layout';
import { MenuList, NavInput } from '../ui/nav';
import { drawBox, FONT, HEX } from '../ui/theme';
import { addPixelText } from '../ui/art/pixel';
import { addIcon } from '../ui/art/icons';
import { sfx } from '../ui/audio';

export type FinalChoice = 'enter' | 'surrender' | 'later';

export interface FinalPromptData {
  onChoice: (c: FinalChoice) => void;
}

/**
 * Pregunta al pisar la trampilla dorada (supervisor): entrar al reto final, rendirse (la partida acaba ganada) o
 * todavía no (para recoger lo que quede). Teclado, ratón y mando; Esc o B = todavía no.
 */
export class FinalPromptScene extends Phaser.Scene {
  private args!: FinalPromptData;
  private nav!: NavInput;
  private menu!: MenuList;
  private done = false;

  constructor() {
    super('FinalPrompt');
  }

  init(data: FinalPromptData) {
    this.args = data;
    this.done = false;
  }

  create() {
    fitDesign(this);
    this.nav = new NavInput(this);
    this.add.rectangle(DCX, DCY, COVER_W + 4, COVER_H + 4, 0x0d1425, 0.82).setInteractive();
    drawBox(this.add.graphics(), 140, 100, 680, 460, { radius: 16, border: 0xd4a017 });
    const title = addPixelText(this, 480, 170, 'RETO FINAL', { size: 16, scale: 3, color: '#f8d030', stroke: '#283068', strokeWidth: 3, shadow: '#101828' });
    this.tweens.add({ targets: title, scale: title.scale * 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    addIcon(this, 300, 170, 'star', 3);
    addIcon(this, 660, 170, 'star', 3);
    this.add
      .text(480, 238, 'Bajo esta trampilla espera un poder legendario.\nSi lo vences, ganarás muchos más tickets.\n¿Aceptas el reto o terminas aquí con la victoria?', {
        fontFamily: FONT, fontSize: '19px', color: HEX.text, align: 'center', lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
    this.menu = new MenuList(this, 480, 345, ['Aceptar el reto', 'Rendirse y ganar', 'Todavía no'], (i) => this.pick(i), { w: 320, h: 48, gap: 10, fontSize: 21 });
    addHelpBar(this, 480, 538, 'Flechas o ratón · Enter o clic · Esc: todavía no', { fontFamily: FONT, fontSize: '13px', color: HEX.textSoft }).setOrigin(0.5);
    sfx('select');
  }

  private pick(i: number) {
    if (this.done) return;
    this.done = true;
    this.args.onChoice((['enter', 'surrender', 'later'] as const)[i]);
  }

  update() {
    if (this.done) return;
    const s = this.nav.read();
    if (s.back) return this.pick(2);
    this.menu.move(s.dy || s.dx);
    if (s.ok) this.menu.activate();
  }
}
