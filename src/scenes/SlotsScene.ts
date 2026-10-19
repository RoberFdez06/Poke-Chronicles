import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { loadAllRuns, RunSave } from '../data/runSave';
import { MODE_LABEL, progressText } from '../data/modes';
import { addPanel, MenuList, NavInput, UI } from '../ui/nav';
import { addHpBar, ARROW, drawBox, fadeIn, goTo, strokePixelFrame } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';

const CARD = { w: 600, h: 120, gap: 22 };
/** Botón "Misiones y logros" debajo de los huecos (es la opción 3 al moverse con flechas o mando). */
const MISSIONS = { y: 566, w: 320, h: 48 };
const OPTIONS = 4;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function describe(run: RunSave): string {
  const date = new Date(run.savedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const rooms = run.mode === 'normal' || run.mode === 'endless' ? ` · Salas ${run.cleared.length}/${run.roomCount}` : '';
  return `${capitalize(run.starterName)} · ${MODE_LABEL[run.mode]} · ${progressText(run.mode, run.floor)}${rooms} · PS ${Math.ceil(run.hp)} · ` +
    `${run.passives.length} objetos · ${date}`;
}

/** Los 3 huecos de partida: continuar una guardada o empezar una nueva (avisa antes de sobrescribir). */
export class SlotsScene extends Phaser.Scene {
  private runs: (RunSave | null)[] = [];
  private cards: { box: Phaser.GameObjects.Container; glow: Phaser.GameObjects.Graphics; arrow: Phaser.GameObjects.Text }[] = [];
  private selected = 0;
  private nav!: NavInput;
  private dialog?: { layer: Phaser.GameObjects.Container; list: MenuList; onBack: () => void };
  private leaving = false;

  constructor() {
    super('Slots');
  }

  create() {
    this.runs = loadAllRuns();
    this.cards = [];
    this.dialog = undefined;
    this.leaving = false;
    this.nav = new NavInput(this);
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);

    this.add.text(480, 56, 'Partidas', { fontFamily: UI.FONT, fontSize: '44px', fontStyle: 'bold', color: '#ffd34d' })
      .setOrigin(0.5).setStroke('#2b3a67', 10);
    const back = this.add
      .text(36, 50, '← Volver', { fontFamily: UI.FONT, fontSize: '22px', color: '#ffffff' })
      .setOrigin(0, 0.5).setPadding(8, 6).setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setColor('#ffd34d'));
    back.on('pointerout', () => back.setColor('#ffffff'));
    back.on('pointerdown', () => !this.dialog && this.goBack());

    const top = 300 - (3 * CARD.h + 2 * CARD.gap) / 2 + CARD.h / 2;
    this.runs.forEach((run, i) => this.cards.push(this.buildCard(run, i, 480, top + i * (CARD.h + CARD.gap))));
    this.cards.push(this.buildMissionsButton());

    this.add
      .text(480, 616, 'Flechas, ratón o mando para elegir · Enter, clic o A para abrir · Esc o B para volver', {
        fontFamily: UI.FONT, fontSize: '15px', color: '#ffffff',
      })
      .setOrigin(0.5).setAlpha(0.6);
    this.select(0);
  }

  private buildCard(run: RunSave | null, i: number, x: number, y: number) {
    const { w, h } = CARD;
    const bg = this.add.graphics();
    drawBox(bg, -w / 2, -h / 2, w, h, { radius: 18 });
    const glow = this.add.graphics();
    strokePixelFrame(glow, -w / 2 - 8, -h / 2 - 8, w + 16, h + 16, UI.GOLD, 6);
    // Flecha de selección por fuera del cuadro, a la izquierda
    const arrow = this.add.text(-w / 2 - 34, 0, ARROW, { fontFamily: UI.FONT, fontSize: '28px', color: '#ffd34d' }).setOrigin(0, 0.5);
    const title = this.add.text(-w / 2 + 28, -22, `Hueco ${i + 1}`, {
      fontFamily: UI.FONT, fontSize: '28px', fontStyle: 'bold', color: '#2b3a67',
    }).setOrigin(0, 0.5);
    const info = this.add.text(-w / 2 + 28, 22, run ? describe(run) : 'Vacío · Nueva partida', {
      fontFamily: UI.FONT, fontSize: '15px', color: run ? '#2b3a67' : '#7a849e', wordWrap: { width: CARD.w - 56 },
    }).setOrigin(0, 0.5);

    const parts: Phaser.GameObjects.GameObject[] = [bg, glow, arrow, title, info];
    if (run) {
      // Barra de PS de la partida guardada
      const hp = addHpBar(this, w / 2 - 230, -30, 200, 10);
      hp.set(run.hp / run.maxHp);
      parts.push(...hp.objects);
    }
    const box = this.add.container(x, y, parts).setSize(w, h);
    box.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h) /* Phaser la centra solo */, Phaser.Geom.Rectangle.Contains);
    box.input!.cursor = 'pointer';
    box.on('pointerover', () => !this.dialog && this.select(i));
    box.on('pointerdown', () => {
      if (this.dialog) return;
      this.select(i);
      this.open(i);
    });
    return { box, glow, arrow };
  }

  private buildMissionsButton() {
    const { w, h } = MISSIONS;
    const bg = drawBox(this.add.graphics(), -w / 2, -h / 2, w, h, { radius: 12 });
    const glow = this.add.graphics();
    strokePixelFrame(glow, -w / 2 - 8, -h / 2 - 8, w + 16, h + 16, UI.GOLD, 6);
    const arrow = this.add.text(-w / 2 - 34, 0, ARROW, { fontFamily: UI.FONT, fontSize: '24px', color: '#ffd34d' }).setOrigin(0, 0.5);
    const label = this.add.text(0, 0, 'Misiones y logros', { fontFamily: UI.FONT, fontSize: '22px', fontStyle: 'bold', color: '#2b3a67' }).setOrigin(0.5);
    const box = this.add.container(480, MISSIONS.y, [bg, glow, arrow, label]).setSize(w, h);
    box.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    box.input!.cursor = 'pointer';
    box.on('pointerover', () => !this.dialog && this.select(3));
    box.on('pointerdown', () => {
      if (this.dialog) return;
      this.select(3);
      this.open(3);
    });
    return { box, glow, arrow };
  }

  private select(i: number) {
    this.selected = i;
    this.cards.forEach((c, k) => {
      c.glow.setVisible(k === i);
      c.arrow.setVisible(k === i);
      c.box.setScale(k === i ? 1.03 : 1);
    });
  }

  private goBack() {
    if (this.leaving) return;
    this.leaving = true;
    goTo(this, 'Menu');
  }

  private startNew(slot: number) {
    this.leaving = true;
    goTo(this, 'Starter', { slot });
  }

  private open(slot: number) {
    if (slot === 3) {
      this.leaving = true;
      goTo(this, 'Missions');
      return;
    }
    const run = this.runs[slot];
    if (!run) return this.startNew(slot);
    this.showDialog(`Hueco ${slot + 1}\n${capitalize(run.starterName)}`, ['Continuar', 'Nueva partida', 'Cancelar'], (k) => {
      if (k === 0) {
        this.leaving = true;
        goTo(this, 'Game', { slot, resume: run });
      } else if (k === 1) {
        this.closeDialog();
        this.showDialog('Se perderá la partida guardada\nen este hueco. ¿Seguro?', ['No, volver', 'Sí, empezar de nuevo'], (j) => {
          if (j === 1) this.startNew(slot);
          else this.closeDialog();
        });
      } else this.closeDialog();
    });
  }

  private showDialog(text: string, options: string[], onPick: (k: number) => void) {
    const layer = addPanel(this, 480, 320, 520, 150 + options.length * 68, 50);
    const top = 320 - (150 + options.length * 68) / 2;
    layer.add(this.add.text(480, top + 60, text, {
      fontFamily: UI.FONT, fontSize: '24px', fontStyle: 'bold', color: '#2b3a67', align: 'center',
    }).setOrigin(0.5));
    const list = new MenuList(this, 480, top + 140, options, onPick, { w: 320, h: 52, gap: 16, depth: 51 });
    this.dialog = { layer, list, onBack: () => this.closeDialog() };
  }

  private closeDialog() {
    this.dialog?.layer.destroy();
    this.dialog?.list.destroy();
    this.dialog = undefined;
  }

  update() {
    if (this.leaving) return;
    const s = this.nav.read();
    if (this.dialog) {
      if (s.back) return this.dialog.onBack();
      this.dialog.list.move(s.dy || s.dx);
      if (s.ok) this.dialog.list.activate();
      return;
    }
    if (s.back) return this.goBack();
    const d = s.dy || s.dx;
    if (d !== 0) this.select((this.selected + Math.sign(d) + OPTIONS) % OPTIONS);
    if (s.ok) this.open(this.selected);
  }
}
