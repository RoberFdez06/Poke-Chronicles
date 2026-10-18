import Phaser from 'phaser';
import { emptyRecords, MODES, MODE_LABEL, modeDesc, recordText, Records } from '../data/modes';
import { loadRecords } from '../data/save';
import { MenuList, NavInput, UI } from '../ui/nav';
import { addBackButton } from '../ui/cards';
import { drawBox, fadeIn, goTo } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';

/** Margen tras abrir la pantalla en el que se ignora confirmar (el Enter que eligió el Pokémon no elige modo). */
const INPUT_DELAY_MS = 350;

export interface ModeData {
  starterId: number;
  slot: number;
}

/** Tras elegir Pokémon: Normal, Oleadas, Infinito o Rush de jefes, con el récord de cada uno. */
export class ModeScene extends Phaser.Scene {
  private args!: ModeData;
  private nav!: NavInput;
  private list!: MenuList;
  private desc!: Phaser.GameObjects.Text;
  private record!: Phaser.GameObjects.Text;
  private records: Records = emptyRecords();
  private shown = -1;
  private readyAt = 0;
  private leaving = false;

  constructor() {
    super('Mode');
  }

  init(data: ModeData) {
    this.args = { starterId: data?.starterId ?? 4, slot: data?.slot ?? 0 };
  }

  create() {
    fadeIn(this);
    addMenuBackdrop(this);
    this.leaving = false;
    this.shown = -1;
    this.nav = new NavInput(this);
    addBackButton(this, () => this.back());
    this.add.text(480, 60, 'Elige modo de juego', { fontFamily: UI.FONT, fontSize: '36px', color: '#ffffff' }).setOrigin(0.5);

    this.records = loadRecords();
    this.list = new MenuList(this, 280, 190, MODES.map((m) => MODE_LABEL[m]), (i) => this.start(i), { w: 320, h: 62, gap: 22 });

    const panel = this.add.graphics();
    drawBox(panel, 480, 160, 420, 330, { radius: 20 });
    this.desc = this.add
      .text(510, 190, '', { fontFamily: UI.FONT, fontSize: '22px', color: '#2b3a67', wordWrap: { width: 360 } })
      .setLineSpacing(6);
    this.record = this.add.text(510, 440, '', { fontFamily: UI.FONT, fontSize: '22px', fontStyle: 'bold', color: '#b8860b' });

    this.add
      .text(480, 600, 'Flechas, ratón o mando para elegir · Enter, clic o A para empezar · Esc, B o "Volver" para cambiar de Pokémon', {
        fontFamily: UI.FONT,
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setAlpha(0.8);
    this.readyAt = this.time.now + INPUT_DELAY_MS;
  }

  private start(i: number) {
    if (this.leaving || this.time.now < this.readyAt) return;
    this.leaving = true;
    goTo(this, 'Game', { starterId: this.args.starterId, slot: this.args.slot, mode: MODES[i] });
  }

  private back() {
    if (this.leaving) return;
    this.leaving = true;
    goTo(this, 'Starter', { slot: this.args.slot });
  }

  update() {
    if (this.leaving) return;
    const s = this.nav.read();
    if (s.back) return this.back();
    if (s.dy !== 0) this.list.move(s.dy);
    if (s.ok) this.list.activate();
    // La descripción sigue a la opción seleccionada (con teclado, mando o pasando el ratón)
    if (this.list.selected !== this.shown) {
      this.shown = this.list.selected;
      const m = MODES[this.shown];
      this.desc.setText(`${MODE_LABEL[m]}\n\n${modeDesc(m)}`);
      this.record.setText(recordText(m, this.records[m]));
    }
  }
}
