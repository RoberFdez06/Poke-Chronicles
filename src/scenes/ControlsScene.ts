import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import {
  CONTROL_ACTIONS,
  CONTROL_ACTION_LABEL,
  CONTROL_MODE_LABEL,
  TD_CONTROLS,
  TD_CONTROL_ACTIONS,
  TD_CONTROL_ACTION_LABEL,
  controlSections,
  touchOnlyDevice,
  visibleModes,
  type ControlMode,
} from '../data/controls';
import { loadKeys } from '../data/save';
import { NavInput, PadButtons, UI } from '../ui/nav';
import { addBackButton } from '../ui/cards';
import { drawBox } from '../ui/theme';
import { controlModesFor, currentInput } from '../ui/inputMode';

export interface ControlsData {
  /** Escena que la abrió (se pausa debajo y se reanuda al cerrar). */
  from: string;
}

const TAB = { y: 120, w: 170, h: 46, gap: 14 };

/**
 * Controles por secciones (T35): pestañas Teclado, Ratón, Mando y Táctil (esta solo en móvil o tableta), cada una
 * con todo lo que se puede hacer. Se abre encima de la pausa o de Ajustes. Pestañas con izquierda/derecha, LB/RB
 * o clic; Esc, B, Enter, A o "Volver" cierran.
 */
export class ControlsScene extends Phaser.Scene {
  private from = '';
  private modes: ControlMode[] = [];
  private tab = 0;
  private nav!: NavInput;
  private padButtons!: PadButtons;
  private tabs: { box: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text }[] = [];
  private rows: Phaser.GameObjects.Text[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  /** Qué controles se enseñan: los de la partida o los de la defensa de torres (que se abre en ella si vienes de ahí). */
  private view: 'game' | 'td' = 'game';
  private viewBtn!: Phaser.GameObjects.Text;
  private viewBox!: Phaser.GameObjects.Graphics;
  private help!: Phaser.GameObjects.Text;
  private helpFor = '';
  private viewKey!: Phaser.Input.Keyboard.Key;
  private closing = false;
  private tabKey!: Phaser.Input.Keyboard.Key;
  private readyAt = 0;

  constructor() {
    super('Controls');
  }

  init(data: ControlsData) {
    this.from = data?.from ?? '';
    this.view = this.from.startsWith('TowerDefense') ? 'td' : 'game';
  }

  create() {
    fitDesign(this);
    this.closing = false;
    this.tabs = [];
    this.rows = [];
    this.labels = [];
    // Solo lo del dispositivo con el que juegas: teclado y ratón juntos en PC, el mando solo, o el táctil solo
    const family = controlModesFor(currentInput());
    const all = visibleModes(touchOnlyDevice());
    this.modes = all.filter((m) => family.includes(m));
    if (this.modes.length === 0) this.modes = all;
    // Empieza en la pestaña del modo con el que se juega: mando si hay uno conectado, táctil en móvil
    const start: ControlMode = this.modes.includes('touch') ? 'touch' : this.modes.includes('gamepad') ? 'gamepad' : 'keyboard';
    this.tab = Math.max(0, this.modes.indexOf(start));

    // Fondo que se traga los clics y panel
    this.add.rectangle(480, 320, 4000, 4000, 0x000000, 0.6).setInteractive();
    drawBox(this.add.graphics(), 60, 60, 840, 540, { radius: 16 });
    this.add.text(270, 86, 'Controles', { fontFamily: UI.FONT, fontSize: '30px', fontStyle: 'bold', color: '#2b3a67' }).setOrigin(0.5);
    addBackButton(this, () => this.close(), 70, 86).setColor('#2b3a67').on('pointerout', function (this: Phaser.GameObjects.Text) {
      this.setColor('#2b3a67');
    });

    // Botón Partida ⇄ Defensa de torres: un botón de verdad (caja), con clic, V/Tab… y la Y del mando
    this.viewBox = this.add.graphics();
    this.viewBtn = this.add
      .text(880, 86, '', { fontFamily: UI.FONT, fontSize: '15px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(1, 0.5)
      .setPadding(10, 7)
      .setDepth(1)
      .setInteractive({ useHandCursor: true });
    this.viewBtn.on('pointerdown', () => this.toggleView());
    this.viewBtn.on('pointerover', () => this.viewBtn.setColor('#ffd34d'));
    this.viewBtn.on('pointerout', () => this.viewBtn.setColor('#ffffff'));

    if (this.modes.length === 1) {
      // Una sola sección: es un título, no un botón (antes parecía una pestaña que no hacía nada)
      this.add
        .text(480, TAB.y + TAB.h / 2, `Controles con ${CONTROL_MODE_LABEL[this.modes[0]].toLowerCase()}`, { fontFamily: UI.FONT, fontSize: '22px', fontStyle: 'bold', color: '#b8860b' })
        .setOrigin(0.5);
      this.add.rectangle(480, TAB.y + TAB.h - 4, 360, 3, 0xb8860b, 0.8);
    } else {
      const total = this.modes.length * TAB.w + (this.modes.length - 1) * TAB.gap;
      this.modes.forEach((m, k) => {
        const x = 480 - total / 2 + k * (TAB.w + TAB.gap);
        const box = this.add.graphics();
        const text = this.add.text(x + TAB.w / 2, TAB.y + TAB.h / 2, CONTROL_MODE_LABEL[m], { fontFamily: UI.FONT, fontSize: '22px', fontStyle: 'bold', color: '#2b3a67' }).setOrigin(0.5);
        const zone = this.add.zone(x + TAB.w / 2, TAB.y + TAB.h / 2, TAB.w, TAB.h).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => this.select(k));
        box.setData('x', x);
        this.tabs.push({ box, text });
      });
    }

    const keys = loadKeys();
    const sections = controlSections(keys);
    CONTROL_ACTIONS.forEach((a, k) => {
      // T53/T65/T74/T77: 27 px por fila para que quepan parry, Poké Ball, megaevolución y ataque cargado sin pisar la ayuda de abajo
      const y = 182 + k * 27;
      this.labels.push(this.add.text(100, y, CONTROL_ACTION_LABEL[a], { fontFamily: UI.FONT, fontSize: '19px', fontStyle: 'bold', color: '#2b3a67' }));
      this.rows.push(this.add.text(400, y, '', { fontFamily: UI.FONT, fontSize: '18px', color: '#4a5578', wordWrap: { width: 470 } }).setData('a', a));
    });
    this.data.set('sections', sections);
    this.help = this.add.text(480, 576, '', { fontFamily: UI.FONT, fontSize: '15px', color: '#4a5578' }).setOrigin(0.5);
    this.helpFor = '';
    this.paintHelp();

    // Tab cambia de pestaña (no lo usa el navegador mientras se capture) y V cambia Partida ⇄ Defensa de torres
    this.tabKey = this.input.keyboard!.addKey('TAB', true);
    this.viewKey = this.input.keyboard!.addKey('V', false);
    this.nav = new NavInput(this);
    this.padButtons = new PadButtons(this);
    this.select(this.tab);
    // El Enter o la A que abrieron esta pantalla no la cierran
    this.readyAt = this.time.now + 250;
  }

  private select(k: number) {
    this.tab = (k + this.modes.length) % this.modes.length;
    const sections = this.data.get('sections') as ReturnType<typeof controlSections>;
    const mode = this.modes[this.tab];
    this.tabs.forEach((t, i) => {
      const on = i === this.tab;
      const x = t.box.getData('x') as number;
      t.box.clear();
      t.box.fillStyle(on ? 0x2b3a67 : 0xe8ecf6, 1).fillRoundedRect(x, TAB.y, TAB.w, TAB.h, 10);
      t.box.lineStyle(on ? 4 : 2, on ? 0xffd34d : 0x9aa6c4, 1).strokeRoundedRect(x, TAB.y, TAB.w, TAB.h, 10);
      // Marca debajo de la activa, para que se vea cuál es aunque no se distingan bien los colores
      if (on) t.box.fillStyle(0xffd34d, 1).fillTriangle(x + TAB.w / 2 - 9, TAB.y + TAB.h + 2, x + TAB.w / 2 + 9, TAB.y + TAB.h + 2, x + TAB.w / 2, TAB.y + TAB.h + 11);
      t.text.setColor(on ? '#ffffff' : '#7a849e').setText((on ? '● ' : '') + CONTROL_MODE_LABEL[this.modes[i]]);
    });
    this.paintView();
    this.rows.forEach((r, i) => {
      if (this.view === 'td') {
        const a = TD_CONTROL_ACTIONS[i];
        this.labels[i].setText(a ? TD_CONTROL_ACTION_LABEL[a] : '').setVisible(!!a);
        r.setText(a ? TD_CONTROLS[mode][a] : '').setVisible(!!a);
      } else {
        const a = CONTROL_ACTIONS[i];
        this.labels[i].setText(CONTROL_ACTION_LABEL[a]).setVisible(true);
        r.setText(sections[mode][a]).setVisible(true);
      }
    });
  }

  /** Ayuda de abajo: solo lo del dispositivo con el que juegas. */
  private paintHelp() {
    const dev = currentInput();
    const many = this.modes.length > 1;
    const key = `${dev}:${many}`;
    if (key === this.helpFor) return;
    this.helpFor = key;
    const parts =
      dev === 'gamepad'
        ? [many ? 'LB/RB o cruceta: sección' : '', 'Y: Partida ⇄ Defensa de torres', 'A o B: cerrar']
        : dev === 'touch'
          ? [many ? 'Toca una pestaña: sección' : '', 'Toca el botón de arriba: Partida ⇄ Defensa de torres', '"Volver": cerrar']
          : [many ? '←/→, Tab o clic en la pestaña: sección' : '', 'V o clic arriba: Partida ⇄ Defensa de torres', 'Esc, Enter o "Volver": cerrar'];
    this.help.setText(parts.filter(Boolean).join(' · '));
    this.paintView();
  }

  private paintView() {
    if (!this.viewBtn) return;
    const hint = currentInput() === 'gamepad' ? '  (Y)' : currentInput() === 'touch' ? '' : '  (V)';
    this.viewBtn.setText((this.view === 'td' ? 'Viendo: Defensa de torres  ⇄  Partida' : 'Viendo: Partida  ⇄  Defensa de torres') + hint);
    const b = this.viewBtn.getBounds();
    this.viewBox.clear();
    this.viewBox.fillStyle(0x2b3a67, 1).fillRoundedRect(b.x, b.y, b.width, b.height, 10);
    this.viewBox.lineStyle(2, 0xffd34d, 1).strokeRoundedRect(b.x, b.y, b.width, b.height, 10);
  }

  private toggleView() {
    this.view = this.view === 'td' ? 'game' : 'td';
    this.select(this.tab);
  }

  private close() {
    if (this.closing) return;
    this.closing = true;
    const from = this.from;
    this.scene.stop();
    if (from && this.scene.isPaused(from)) {
      this.scene.resume(from);
      // Las teclas que se soltaron aquí no las ve la escena de debajo (N10)
      this.scene.get(from).input.keyboard?.resetKeys();
    }
  }

  update() {
    if (this.closing) return;
    const s = this.nav.read();
    const pad = this.padButtons.read();
    if (pad.has('LB')) this.select(this.tab - 1);
    if (pad.has('RB')) this.select(this.tab + 1);
    if (pad.has('Y') || Phaser.Input.Keyboard.JustDown(this.viewKey)) this.toggleView();
    if (Phaser.Input.Keyboard.JustDown(this.tabKey)) this.select(this.tab + (this.tabKey.shiftKey ? -1 : 1));
    if (s.dx !== 0) this.select(this.tab + s.dx);
    this.paintHelp();
    if (s.back || s.pause || (s.ok && this.time.now >= this.readyAt)) this.close();
  }
}

/** Abre los Controles encima de `scene` (que se pausa debajo hasta cerrarlos). */
export function openControls(scene: Phaser.Scene) {
  scene.scene.launch('Controls', { from: scene.scene.key } satisfies ControlsData);
  scene.scene.bringToTop('Controls');
  scene.scene.pause();
}
