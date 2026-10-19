import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { emptyRecords, MODES, MODE_LABEL, modeDesc, recordText, Records } from '../data/modes';
import { beginDaily, loadDaily, loadRecords } from '../data/save';
import { dailyStarter, dailyText } from '../data/daily';
import { dayNumber } from '../data/gacha';
import { fetchSpeciesName } from '../data/pokeapi';
import { FLOOR_COUNT } from '../level/progression';
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

/** La opción que va detrás de los modos: el desafío diario (T34), que es una partida de Normal con semilla del día. */
const DAILY_INDEX = MODES.length;

/** Tras elegir Pokémon: Normal, Oleadas, Infinito, Rush de jefes o Desafío diario, con el récord de cada uno. */
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
  private day = 0;
  /** Nombre en español del inicial del día (llega de PokeAPI o del índice). */
  private dailyName = '';

  constructor() {
    super('Mode');
  }

  init(data: ModeData) {
    this.args = { starterId: data?.starterId ?? 4, slot: data?.slot ?? 0 };
  }

  create() {
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    this.leaving = false;
    this.shown = -1;
    this.nav = new NavInput(this);
    addBackButton(this, () => this.back());
    this.add.text(480, 60, 'Elige modo de juego', { fontFamily: UI.FONT, fontSize: '36px', color: '#ffffff' }).setOrigin(0.5);

    this.records = loadRecords();
    this.day = dayNumber();
    this.dailyName = '';
    void fetchSpeciesName(dailyStarter(this.day))
      .then((n) => {
        this.dailyName = n;
        this.shown = -1;
      })
      .catch(() => undefined);
    this.list = new MenuList(this, 280, 170, [...MODES.map((m) => MODE_LABEL[m]), 'Desafío diario'], (i) => this.start(i), { w: 320, h: 58, gap: 14 });

    const panel = this.add.graphics();
    drawBox(panel, 480, 160, 420, 380, { radius: 20 });
    this.desc = this.add
      .text(510, 190, '', { fontFamily: UI.FONT, fontSize: '22px', color: '#2b3a67', wordWrap: { width: 360 } })
      .setLineSpacing(6);
    this.record = this.add
      .text(510, 430, '', { fontFamily: UI.FONT, fontSize: '19px', fontStyle: 'bold', color: '#b8860b', wordWrap: { width: 370 } })
      .setLineSpacing(4);

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
    if (i === DAILY_INDEX) {
      // Mismo inicial para todos; solo la primera partida del día cuenta
      const counts = beginDaily(this.day);
      goTo(this, 'Game', { starterId: dailyStarter(this.day), slot: this.args.slot, mode: 'normal', daily: { day: this.day, counts } });
      return;
    }
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
      if (this.shown === DAILY_INDEX) {
        const who = this.dailyName || 'cargando…';
        this.desc.setText(`Desafío diario\n\nNormal con los mismos pisos, jefes y objetos para todos hoy. Inicial del día: ${who}.`);
        this.record.setText(dailyText(loadDaily(), this.day, FLOOR_COUNT));
        return;
      }
      const m = MODES[this.shown];
      this.desc.setText(`${MODE_LABEL[m]}\n\n${modeDesc(m)}`);
      this.record.setText(recordText(m, this.records[m]));
    }
  }
}
