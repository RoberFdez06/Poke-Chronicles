import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { emptyRecords, MODES, MODE_LABEL, modeDesc, recordText, Records } from '../data/modes';
import { beginDaily, loadCandies, loadDaily, loadRecords, spendCandies } from '../data/save';
import { towerCheckpointOptions } from '../level/towerExtras';
import { dailyStarter, dailyText } from '../data/daily';
import { dayNumber } from '../data/gacha';
import { fetchSpeciesName } from '../data/pokeapi';
import { FLOOR_COUNT } from '../level/progression';
import { DIFFICULTIES, DIFFICULTY_DESC, DIFFICULTY_LABEL, type Difficulty } from '../data/difficulty';
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
/** T81: y la partida con código (lleva a la pantalla de escribirlo). */
const CODE_INDEX = MODES.length + 1;

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
  /** Dificultad elegida (T40): se cambia con izquierda/derecha o con las flechas de la fila de abajo. */
  private diff: Difficulty = 'normal';
  private diffText!: Phaser.GameObjects.Text;
  private diffDesc!: Phaser.GameObjects.Text;

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

    this.diff = 'normal';
    this.records = loadRecords(undefined, this.diff);
    this.day = dayNumber();
    this.dailyName = '';
    void fetchSpeciesName(dailyStarter(this.day))
      .then((n) => {
        this.dailyName = n;
        this.shown = -1;
      })
      .catch(() => undefined);
    this.list = new MenuList(this, 280, 184, [...MODES.map((m) => MODE_LABEL[m]), 'Desafío diario', 'Partida con código'], (i) => this.start(i), {
      // Siete opciones a la altura del panel de la derecha (160-540), sin tocar la fila de la dificultad
      w: 320, h: 46, gap: 8,
    });

    const panel = this.add.graphics();
    drawBox(panel, 480, 160, 420, 380, { radius: 20 });
    this.desc = this.add
      .text(510, 190, '', { fontFamily: UI.FONT, fontSize: '22px', color: '#2b3a67', wordWrap: { width: 360 } })
      .setLineSpacing(6);
    this.record = this.add
      .text(510, 430, '', { fontFamily: UI.FONT, fontSize: '19px', fontStyle: 'bold', color: '#b8860b', wordWrap: { width: 370 } })
      .setLineSpacing(4);

    // Fila de la dificultad: ◀ Normal ▶ (clic en las flechas o en el nombre; izquierda/derecha con teclado o mando)
    const arrow = (x: number, label: string, d: number) =>
      this.add
        .text(x, 568, label, { fontFamily: UI.FONT, fontSize: '28px', color: '#ffd34d' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.changeDiff(d));
    this.add.text(330, 568, 'Dificultad:', { fontFamily: UI.FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(1, 0.5);
    arrow(360, '◀', -1);
    arrow(560, '▶', 1);
    this.diffText = this.add
      .text(460, 568, '', { fontFamily: UI.FONT, fontSize: '24px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .on('pointerdown', () => this.changeDiff(1));
    this.diffDesc = this.add
      .text(590, 568, '', { fontFamily: UI.FONT, fontSize: '15px', color: '#ffffff', wordWrap: { width: 330 } })
      .setOrigin(0, 0.5)
      .setAlpha(0.85);
    this.paintDiff();

    this.add
      .text(480, 616, 'Arriba/abajo: modo · Izquierda/derecha: dificultad · Enter, clic o A: empezar · Esc, B o "Volver": cambiar de Pokémon', {
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
    if (i === CODE_INDEX) {
      goTo(this, 'SeedCode', { slot: this.args.slot, starterId: this.args.starterId });
      return;
    }
    if (i === DAILY_INDEX) {
      // Mismo inicial para todos; solo la primera partida del día cuenta
      const counts = beginDaily(this.day);
      goTo(this, 'Game', { starterId: dailyStarter(this.day), slot: this.args.slot, mode: 'normal', daily: { day: this.day, counts }, difficulty: 'normal' });
      return;
    }
    if (MODES[i] === 'tower' && this.askTowerStart()) return;
    goTo(this, 'Game', { starterId: this.args.starterId, slot: this.args.slot, mode: MODES[i], difficulty: this.diff });
  }

  /**
   * T72: puntos de control de la Torre. Si ya has vencido algún jefe, eliges desde qué descanso empiezas (pagando
   * caramelos; el piso 1 es gratis). Usa la lista genérica de ItemChoiceScene (teclado, ratón y mando).
   * Devuelve false si no hay nada que elegir.
   */
  private askTowerStart(): boolean {
    const opts = towerCheckpointOptions(this.records.tower);
    if (opts.length <= 1 || !this.scene.manager.keys['ItemChoice']) return false;
    const candies = loadCandies();
    this.scene.launch('ItemChoice', {
      title: 'PUNTO DE CONTROL',
      text: `¿Desde qué piso empiezas la Torre?\nTienes ${candies} caramelos`,
      options: opts.map((o) => (o.cost > 0 ? `Piso ${o.floor} · ${o.cost} caramelos` : `Piso ${o.floor} · gratis`)),
      cancel: 'Volver',
      disabled: opts.map((o) => o.cost > candies),
      onChoice: (k: number) => {
        this.scene.stop('ItemChoice');
        const o = opts[k];
        if (!o || (o.cost > 0 && !spendCandies(o.cost))) {
          this.leaving = false;
          this.readyAt = this.time.now + INPUT_DELAY_MS;
          return;
        }
        goTo(this, 'Game', { starterId: this.args.starterId, slot: this.args.slot, mode: 'tower', difficulty: this.diff, towerStart: o.floor });
      },
    });
    return true;
  }

  private changeDiff(d: number) {
    if (this.leaving) return;
    const n = DIFFICULTIES.length;
    this.diff = DIFFICULTIES[(DIFFICULTIES.indexOf(this.diff) + d + n) % n];
    this.records = loadRecords(undefined, this.diff);
    this.paintDiff();
    this.shown = -1;
  }

  private paintDiff() {
    const colors: Record<Difficulty, string> = { easy: '#8fe39a', normal: '#ffffff', hard: '#ff8a7a' };
    this.diffText.setText(DIFFICULTY_LABEL[this.diff]).setColor(colors[this.diff]);
    // Área de clic fija (el texto cambia de largo)
    this.diffText.setInteractive(new Phaser.Geom.Rectangle(0, 0, Math.max(120, this.diffText.width), this.diffText.height), Phaser.Geom.Rectangle.Contains);
    this.diffDesc.setText(DIFFICULTY_DESC[this.diff]);
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
    if (s.dx !== 0) this.changeDiff(s.dx);
    if (s.ok) this.list.activate();
    // La descripción sigue a la opción seleccionada (con teclado, mando o pasando el ratón)
    if (this.list.selected !== this.shown) {
      this.shown = this.list.selected;
      if (this.shown === DAILY_INDEX) {
        const who = this.dailyName || 'cargando…';
        this.desc.setText(`Desafío diario\n\nNormal con los mismos pisos, jefes y objetos para todos hoy (siempre en Normal). Inicial del día: ${who}.`);
        this.record.setText(dailyText(loadDaily(), this.day, FLOOR_COUNT));
        return;
      }
      if (this.shown === CODE_INDEX) {
        this.desc.setText('Partida con código\n\nEscribe el código de otra partida (sale en la pausa y al terminar) y juega los mismos pisos, salas, jefes y objetos, con su Pokémon, modo y dificultad.');
        this.record.setText('No cuenta para récords, desafío diario, misiones ni registro de combate; sí guarda tu mejor resultado con cada código.');
        return;
      }
      const m = MODES[this.shown];
      this.desc.setText(`${MODE_LABEL[m]}\n\n${modeDesc(m)}`);
      this.record.setText(recordText(m, this.records[m]));
    }
  }
}
