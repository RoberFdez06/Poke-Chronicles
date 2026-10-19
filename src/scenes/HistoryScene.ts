import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { MODE_LABEL, progressText } from '../data/modes';
import { formatDuration, HISTORY_SIZE } from '../data/runHistory';
import { loadRunHistory } from '../data/save';
import { addBackButton } from '../ui/cards';
import { NavInput } from '../ui/nav';
import { drawBox, fadeIn, FONT, goTo, HEX } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';

/** Historial de las últimas partidas (T28). Solo se consulta: Esc, B o "Volver" para salir. */
export class HistoryScene extends Phaser.Scene {
  private nav!: NavInput;
  private leaving = false;
  /** Pantalla a la que volver (Partidas o el menú, según desde dónde se abrió). */
  private from = 'Slots';

  constructor() {
    super('History');
  }

  init(data: { from?: string }) {
    this.from = data?.from ?? 'Slots';
    // Phaser guarda los datos del último start: que no se queden de una visita anterior
    this.sys.settings.data = {};
  }

  create() {
    this.leaving = false;
    this.nav = new NavInput(this);
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    addBackButton(this, () => this.back());
    this.add.text(480, 44, 'Historial', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: HEX.gold })
      .setOrigin(0.5).setStroke('#2b3a67', 10);

    const list = loadRunHistory();
    drawBox(this.add.graphics(), 30, 84, 900, 508, { radius: 14 });
    const t = (x: number, y: number, s: string, color: string = HEX.text, bold = false, size = 14) =>
      this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' }).setOrigin(0, 0.5);
    const COLS = [52, 176, 330, 440, 600, 690, 770, 850];
    ['Fecha', 'Pokémon', 'Modo', 'Hasta', 'Tiempo', 'Enem.', 'Daño', 'Tickets'].forEach((h, k) => t(COLS[k], 108, h, HEX.textSoft, true));
    if (list.length === 0) {
      t(52, 150, 'Todavía no has terminado ninguna partida.', HEX.textSoft, false, 18);
    }
    list.slice(0, HISTORY_SIZE).forEach((r, i) => {
      const y = 134 + i * 22.5;
      const date = new Date(r.endedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const color = r.won ? '#2e9a4a' : HEX.text;
      t(COLS[0], y, date, HEX.textSoft);
      t(COLS[1], y, r.starterName.slice(0, 14), color, true);
      t(COLS[2], y, MODE_LABEL[r.mode], color);
      t(COLS[3], y, `${r.won ? '✔ ' : ''}${progressText(r.mode, r.floor)}${r.newRecord ? ' ★' : ''}`, color);
      t(COLS[4], y, formatDuration(r.seconds), color);
      t(COLS[5], y, `${r.kills}`, color);
      t(COLS[6], y, `${r.damage}`, color);
      t(COLS[7], y, `+${r.tickets}`, '#b8860b', true);
    });

    this.add
      .text(480, 616, `Tus últimas ${HISTORY_SIZE} partidas · ★ récord · Esc, B o "Volver" para salir`, { fontFamily: FONT, fontSize: '14px', color: '#ffffff' })
      .setOrigin(0.5).setAlpha(0.7);
  }

  private back() {
    if (this.leaving) return;
    this.leaving = true;
    goTo(this, this.from);
  }

  update() {
    if (this.leaving) return;
    if (this.nav.read().back) this.back();
  }
}
