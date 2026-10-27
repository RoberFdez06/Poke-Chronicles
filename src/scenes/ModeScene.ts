import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { emptyRecords, MODES, MODE_LABEL, modeDesc, recordText, Records, type GameMode } from '../data/modes';
import { loadCandies, loadDaily, loadRecords } from '../data/save';
import { loadAllRuns } from '../data/runSave';
import { towerCheckpointOptions } from '../level/towerExtras';
import { dailyText } from '../data/daily';
import { dayNumber } from '../data/gacha';
import { FLOOR_COUNT } from '../level/progression';
import { DIFFICULTIES, DIFFICULTY_DESC, DIFFICULTY_LABEL, type Difficulty } from '../data/difficulty';
import { type RunPlan } from '../data/runPlan';
import { NavInput, PadButtons, UI } from '../ui/nav';
import { addBackButton } from '../ui/cards';
import { COLORS, drawBox, fadeIn, goTo } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';
import { sfx } from '../ui/audio';
import { loadTdProgress, totalStars } from '../data/towerDefense/progress';
import { currentPlan } from './runLaunch';

/** Margen tras abrir la pantalla en el que se ignora confirmar (el Enter que pulsó «Jugar» no elige modo). */
const INPUT_DELAY_MS = 350;

export interface ModeData {
  /** Tarjeta que sale elegida al llegar (p. ej. al volver de la Defensa de torres). */
  select?: ModeCardId;
}

type ModeCardId = GameMode | 'daily' | 'code';

interface CardDef {
  id: ModeCardId;
  icon: string;
  name: string;
  desc: string;
  /** Qué viene después de elegirla. */
  next: string;
}

const CARD = { w: 212, h: 212, gap: 14, cols: 4, top: 92 };
const cardX = (i: number) => (960 - (CARD.cols * CARD.w + (CARD.cols - 1) * CARD.gap)) / 2 + (i % CARD.cols) * (CARD.w + CARD.gap);
const cardY = (i: number) => CARD.top + Math.floor(i / CARD.cols) * (CARD.h + CARD.gap);

const ICON: Record<ModeCardId, string> = {
  normal: '🗺️', waves: '🌊', endless: '♾️', bossrush: '👑', tower: '🗼', towerdef: '🏰', daily: '📅', code: '🔑',
};

const CARDS: CardDef[] = [
  ...MODES.map((m): CardDef => ({
    id: m,
    icon: ICON[m],
    name: MODE_LABEL[m],
    desc: modeDesc(m),
    next: m === 'towerdef' ? 'Entra directo' : 'Luego: hueco y Pokémon',
  })),
  { id: 'daily', icon: ICON.daily, name: 'Desafío diario', desc: 'Los mismos pisos, jefes, objetos y Pokémon para todos hoy. Siempre en Normal.', next: 'Luego: hueco' },
  { id: 'code', icon: ICON.code, name: 'Partida con código', desc: 'Escribe el código de otra partida y juega exactamente lo mismo.', next: 'Luego: hueco y código' },
];

/** La tarjeta elegida la última vez (para volver a ella). */
let lastCard = 0;

/**
 * Pantalla de modos (lo primero al pulsar «Jugar»): tarjetas grandes con icono, descripción y récord. La Defensa de
 * torres entra directa; el resto pide después hueco y, si hace falta, Pokémon. Teclado (flechas, Enter, Q/E
 * dificultad, C continuar, Esc), ratón (pasar, clic, ◀ ▶) y mando (cruceta, A, LB/RB, X, B) por separado.
 */
export class ModeScene extends Phaser.Scene {
  private nav!: NavInput;
  private pad!: PadButtons;
  private keys!: Record<'Q' | 'E' | 'C', Phaser.Input.Keyboard.Key>;
  private cards: { frame: Phaser.GameObjects.Graphics; box: Phaser.GameObjects.Container; record: Phaser.GameObjects.Text }[] = [];
  private selected = 0;
  private records: Records = emptyRecords();
  private readyAt = 0;
  private leaving = false;
  private diff: Difficulty = 'normal';
  private diffRow!: Phaser.GameObjects.Container;
  private diffText!: Phaser.GameObjects.Text;
  private diffDesc!: Phaser.GameObjects.Text;
  private hasRuns = false;

  constructor() {
    super('Mode');
  }

  init(data?: ModeData) {
    const k = data?.select ? CARDS.findIndex((c) => c.id === data.select) : -1;
    if (k >= 0) lastCard = k;
  }

  create() {
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    this.leaving = false;
    this.cards = [];
    this.nav = new NavInput(this);
    this.pad = new PadButtons(this);
    this.keys = this.input.keyboard!.addKeys('Q,E,C', false) as ModeScene['keys'];
    addBackButton(this, () => this.back());
    this.add.text(480, 48, '¿A qué quieres jugar?', { fontFamily: UI.FONT, fontSize: '34px', fontStyle: 'bold', color: '#ffd34d' })
      .setOrigin(0.5).setStroke('#2b3a67', 8);

    // Continuar una partida guardada, sin tener que elegir modo (solo si hay alguna)
    this.hasRuns = loadAllRuns().some((r) => !!r);
    if (this.hasRuns) {
      const c = this.add
        .text(930, 48, '▶ Continuar partida', { fontFamily: UI.FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#2b3a67' })
        .setOrigin(1, 0.5).setPadding(10, 6).setInteractive({ useHandCursor: true });
      c.on('pointerover', () => c.setColor('#ffd34d'));
      c.on('pointerout', () => c.setColor('#ffffff'));
      c.on('pointerdown', () => this.resume());
    }

    const prev = currentPlan();
    this.diff = prev.kind === 'mode' ? prev.difficulty : 'normal';
    this.records = loadRecords(undefined, this.diff);
    CARDS.forEach((def, i) => this.cards.push(this.buildCard(def, i)));

    // Fila de la dificultad (solo para los modos que se juegan con un Pokémon)
    const arrow = (x: number, label: string, d: number) =>
      this.add.text(x, 0, label, { fontFamily: UI.FONT, fontSize: '26px', color: '#ffd34d' })
        .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.changeDiff(d));
    const lbl = this.add.text(260, 0, 'Dificultad:', { fontFamily: UI.FONT, fontSize: '20px', color: '#ffffff' }).setOrigin(1, 0.5);
    this.diffText = this.add.text(360, 0, '', { fontFamily: UI.FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.changeDiff(1));
    this.diffDesc = this.add.text(470, 0, '', { fontFamily: UI.FONT, fontSize: '14px', color: '#ffffff', wordWrap: { width: 460 } }).setOrigin(0, 0.5);
    this.diffRow = this.add.container(0, 562, [lbl, arrow(285, '◀', -1), this.diffText, arrow(440, '▶', 1), this.diffDesc]);

    this.add
      .text(480, 604, 'Flechas o ratón: elegir · Enter o clic: jugar · Q/E o ◀ ▶: dificultad' + (this.hasRuns ? ' · C: continuar' : '') + ' · Esc: menú', {
        fontFamily: UI.FONT, fontSize: '14px', color: '#ffffff',
      })
      .setOrigin(0.5).setAlpha(0.85);
    this.select(Math.min(lastCard, CARDS.length - 1));
    this.paintDiff();
    this.readyAt = this.time.now + INPUT_DELAY_MS;
  }

  private buildCard(def: CardDef, i: number) {
    const { w, h } = CARD;
    const bg = drawBox(this.add.graphics(), 0, 0, w, h, { radius: 16, fill: COLORS.panel });
    const frame = this.add.graphics();
    const icon = this.add.text(w / 2, 32, def.icon, { fontFamily: UI.FONT, fontSize: '38px' }).setOrigin(0.5);
    const name = this.add.text(w / 2, 74, def.name, { fontFamily: UI.FONT, fontSize: '20px', fontStyle: 'bold', color: '#2b3a67', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5);
    const desc = this.add.text(w / 2, 92, def.desc, { fontFamily: UI.FONT, fontSize: '12px', color: '#4a5578', align: 'center', wordWrap: { width: w - 20 } }).setOrigin(0.5, 0);
    const record = this.add.text(w / 2, h - 36, '', { fontFamily: UI.FONT, fontSize: '13px', fontStyle: 'bold', color: '#b8860b', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5);
    const next = this.add.text(w / 2, h - 14, def.next, { fontFamily: UI.FONT, fontSize: '12px', color: '#7a849e' }).setOrigin(0.5);
    const box = this.add.container(cardX(i), cardY(i), [bg, frame, icon, name, desc, record, next]).setSize(w, h);
    box.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    box.input!.cursor = 'pointer';
    box.on('pointerover', () => !this.leaving && this.select(i));
    box.on('pointerdown', () => {
      if (this.leaving) return;
      this.select(i);
      this.pick(i);
    });
    return { frame, box, record };
  }

  private recordFor(id: ModeCardId): string {
    if (id === 'daily') return dailyText(loadDaily(), dayNumber(), FLOOR_COUNT);
    if (id === 'code') return 'No cuenta para récords';
    if (id === 'towerdef') return recordText(id, totalStars(loadTdProgress()));
    return recordText(id, this.records[id]);
  }

  private select(i: number) {
    this.selected = i;
    lastCard = i;
    this.cards.forEach((c, k) => {
      const on = k === i;
      c.frame.clear();
      if (on) c.frame.lineStyle(5, UI.GOLD, 1).strokeRoundedRect(-3, -3, CARD.w + 6, CARD.h + 6, 18);
      c.box.setScale(on ? 1.04 : 1).setDepth(on ? 2 : 1);
      // Al crecer desde la esquina se descoloca: se corrige para que crezca desde el centro
      c.box.setPosition(cardX(k) - (on ? CARD.w * 0.02 : 0), cardY(k) - (on ? CARD.h * 0.02 : 0));
    });
    // La dificultad solo cuenta en los modos con Pokémon
    this.diffRow?.setAlpha(this.usesDiff() ? 1 : 0.35);
  }

  private usesDiff(): boolean {
    const id = CARDS[this.selected].id;
    return id !== 'towerdef' && id !== 'daily' && id !== 'code';
  }

  private changeDiff(d: number) {
    if (this.leaving) return;
    const n = DIFFICULTIES.length;
    this.diff = DIFFICULTIES[(DIFFICULTIES.indexOf(this.diff) + d + n) % n];
    sfx('select');
    this.records = loadRecords(undefined, this.diff);
    this.paintDiff();
  }

  private paintDiff() {
    const colors: Record<Difficulty, string> = { easy: '#8fe39a', normal: '#ffffff', hard: '#ff8a7a' };
    this.diffText.setText(DIFFICULTY_LABEL[this.diff]).setColor(colors[this.diff]);
    this.diffDesc.setText(DIFFICULTY_DESC[this.diff]);
    this.cards.forEach((c, k) => c.record.setText(this.recordFor(CARDS[k].id)));
  }

  private pick(i: number) {
    if (this.leaving || this.time.now < this.readyAt) return;
    const id = CARDS[i].id;
    sfx('select');
    if (id === 'towerdef') {
      // Defensa de torres: su propio menú de mapas, niveles y equipo (no usa hueco, inicial ni dificultad)
      this.leaving = true;
      goTo(this, 'TowerDefenseMenu', {});
      return;
    }
    if (id === 'daily') return this.toSlots({ kind: 'daily' });
    if (id === 'code') return this.toSlots({ kind: 'code' });
    if (id === 'tower' && this.askTowerStart()) return;
    this.toSlots({ kind: 'mode', mode: id, difficulty: this.diff });
  }

  private toSlots(plan: RunPlan) {
    this.leaving = true;
    goTo(this, 'Slots', { plan });
  }

  private resume() {
    if (this.leaving || !this.hasRuns || this.time.now < this.readyAt) return;
    this.toSlots({ kind: 'resume' });
  }

  /**
   * T72: puntos de control de la Torre. Si ya has vencido algún jefe, eliges desde qué descanso empiezas (los caramelos
   * se pagan al empezar la partida; el piso 1 es gratis). Devuelve false si no hay nada que elegir.
   */
  private askTowerStart(): boolean {
    const opts = towerCheckpointOptions(this.records.tower);
    if (opts.length <= 1 || !this.scene.manager.keys['ItemChoice']) return false;
    const candies = loadCandies();
    this.leaving = true;
    this.scene.launch('ItemChoice', {
      title: 'PUNTO DE CONTROL',
      text: `¿Desde qué piso empiezas la Torre?\nTienes ${candies} caramelos (se pagan al empezar)`,
      options: opts.map((o) => (o.cost > 0 ? `Piso ${o.floor} · ${o.cost} caramelos` : `Piso ${o.floor} · gratis`)),
      cancel: 'Volver',
      disabled: opts.map((o) => o.cost > candies),
      onChoice: (k: number) => {
        this.scene.stop('ItemChoice');
        const o = opts[k];
        if (!o || o.cost > candies) {
          this.leaving = false;
          this.readyAt = this.time.now + INPUT_DELAY_MS;
          this.nav = new NavInput(this);
          return;
        }
        this.leaving = false;
        this.toSlots({ kind: 'mode', mode: 'tower', difficulty: this.diff, towerStart: { floor: o.floor, cost: o.cost } });
      },
    });
    return true;
  }

  private back() {
    if (this.leaving) return;
    this.leaving = true;
    goTo(this, 'Menu');
  }

  update() {
    if (this.leaving) return;
    const s = this.nav.read();
    const pb = this.pad.read();
    const J = Phaser.Input.Keyboard.JustDown;
    if (s.back) return this.back();
    if (s.dx !== 0 || s.dy !== 0) {
      const n = CARDS.length;
      const next = (this.selected + s.dx + s.dy * CARD.cols + n) % n;
      sfx('select');
      this.select(next);
    }
    if (this.usesDiff()) {
      if (J(this.keys.Q) || pb.has('LB')) this.changeDiff(-1);
      if (J(this.keys.E) || pb.has('RB')) this.changeDiff(1);
    }
    if (J(this.keys.C) || pb.has('X')) return this.resume();
    if (s.ok) this.pick(this.selected);
  }
}
