import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import {
  CONTROL_ACTIONS,
  CONTROL_ACTION_LABEL,
  CONTROL_MODE_LABEL,
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
  private closing = false;
  private readyAt = 0;

  constructor() {
    super('Controls');
  }

  init(data: ControlsData) {
    this.from = data?.from ?? '';
  }

  create() {
    fitDesign(this);
    this.closing = false;
    this.tabs = [];
    this.rows = [];
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
    this.add.text(480, 86, 'Controles', { fontFamily: UI.FONT, fontSize: '30px', fontStyle: 'bold', color: '#2b3a67' }).setOrigin(0.5);
    addBackButton(this, () => this.close(), 70, 86).setColor('#2b3a67').on('pointerout', function (this: Phaser.GameObjects.Text) {
      this.setColor('#2b3a67');
    });

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

    const keys = loadKeys();
    const sections = controlSections(keys);
    CONTROL_ACTIONS.forEach((a, k) => {
      const y = 190 + k * 42;
      this.add.text(100, y, CONTROL_ACTION_LABEL[a], { fontFamily: UI.FONT, fontSize: '19px', fontStyle: 'bold', color: '#2b3a67' });
      this.rows.push(this.add.text(400, y, '', { fontFamily: UI.FONT, fontSize: '18px', color: '#4a5578', wordWrap: { width: 470 } }).setData('a', a));
    });
    this.data.set('sections', sections);
    this.add
      .text(480, 576, 'Izquierda/derecha, LB/RB o clic: cambiar de sección · Esc, B, Enter, A o "Volver": cerrar', {
        fontFamily: UI.FONT,
        fontSize: '15px',
        color: '#4a5578',
      })
      .setOrigin(0.5);

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
      t.box.lineStyle(3, on ? 0xffd34d : 0x9aa6c4, 1).strokeRoundedRect(x, TAB.y, TAB.w, TAB.h, 10);
      t.text.setColor(on ? '#ffffff' : '#2b3a67');
    });
    for (const r of this.rows) r.setText(sections[mode][r.getData('a') as (typeof CONTROL_ACTIONS)[number]]);
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
    if (s.dx !== 0) this.select(this.tab + s.dx);
    if (s.back || s.pause || (s.ok && this.time.now >= this.readyAt)) this.close();
  }
}

/** Abre los Controles encima de `scene` (que se pausa debajo hasta cerrarlos). */
export function openControls(scene: Phaser.Scene) {
  scene.scene.launch('Controls', { from: scene.scene.key } satisfies ControlsData);
  scene.scene.bringToTop('Controls');
  scene.scene.pause();
}
