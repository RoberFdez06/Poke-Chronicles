import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { MODE_LABEL, progressText } from '../data/modes';
import { formatDuration, type RunRecord } from '../data/runHistory';
import { MenuList, NavInput } from '../ui/nav';
import { drawBox, fadeIn, FONT, goTo, HEX } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';

export interface SummaryData {
  record: RunRecord;
  /** Hueco en el que se jugaba (para "Otra partida"). */
  slot: number;
}

/**
 * Resumen al morir o ganar (T28): tiempo, hasta dónde llegaste, enemigos, daño, objetos, tickets y récord.
 * Otra partida, Historial o Menú con teclado, ratón o mando; Esc o B van al menú.
 */
export class SummaryScene extends Phaser.Scene {
  private data_!: SummaryData;
  private nav!: NavInput;
  private menu!: MenuList;
  private leaving = false;

  constructor() {
    super('Summary');
  }

  init(data: SummaryData) {
    this.data_ = data;
  }

  create() {
    this.leaving = false;
    this.nav = new NavInput(this);
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    const r = this.data_.record;

    this.add.text(480, 52, r.won ? '¡Victoria!' : 'Fin de la partida', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: HEX.gold })
      .setOrigin(0.5).setStroke('#2b3a67', 10);

    drawBox(this.add.graphics(), 40, 100, 560, 470, { radius: 18 });
    const t = (x: number, y: number, s: string, size = 18, color: string = HEX.text, bold = false) =>
      this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', wordWrap: { width: 510 } });
    t(66, 118, r.starterName, 26, HEX.text, true);
    t(66, 156, `${MODE_LABEL[r.mode]} · ${r.won ? 'completada' : `hasta ${progressText(r.mode, r.floor).toLowerCase()}`}`, 17, HEX.textSoft);
    const rows: [string, string][] = [
      ['Tiempo', formatDuration(r.seconds)],
      ['Enemigos vencidos', `${r.kills}`],
      ['Daño hecho', `${r.damage}`],
      ['Tickets ganados', `+${r.tickets}`],
    ];
    rows.forEach(([k, v], i) => {
      t(66, 200 + i * 36, k, 19, HEX.textSoft);
      t(330, 200 + i * 36, v, 19, HEX.text, true);
    });
    if (r.newRecord) t(66, 350, '★ ¡Nuevo récord!', 22, '#b8860b', true);
    t(66, 392, 'Objetos', 19, HEX.text, true);
    t(66, 420, r.items.length ? r.items.join(' · ') : 'Ninguno', 15, HEX.textSoft);

    this.menu = new MenuList(this, 780, 230, ['Otra partida', 'Historial', 'Menú'], (i) => this.pick(i), { w: 280, h: 56, gap: 22 });
    this.add
      .text(480, 612, 'Flechas, ratón o mando para elegir · Enter, clic o A · Esc o B: menú', { fontFamily: FONT, fontSize: '15px', color: '#ffffff' })
      .setOrigin(0.5).setAlpha(0.6);
  }

  private pick(i: number) {
    if (this.leaving) return;
    this.leaving = true;
    if (i === 0) goTo(this, 'Starter', { slot: this.data_.slot });
    else if (i === 1) goTo(this, 'History', { from: 'Menu' });
    else goTo(this, 'Menu');
  }

  update() {
    if (this.leaving) return;
    const s = this.nav.read();
    if (s.back) return this.pick(2);
    this.menu.move(s.dy || s.dx);
    if (s.ok) this.menu.activate();
  }
}
