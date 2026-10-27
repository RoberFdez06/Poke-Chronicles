import Phaser from 'phaser';
import { addHelpBar } from '../ui/helpBar';
import { fitDesign } from '../ui/layout';
import { ACTION_LABEL, ACTIONS, bindKey, DEFAULT_KEYS, keyLabel, type Action, type KeyMap } from '../data/keybinds';
import { loadKeys, saveKeys } from '../data/save';
import { refreshControls } from '../data/controls';
import { sfx } from '../ui/audio';
import { addBackButton } from '../ui/cards';
import { keyNameFromCode } from '../ui/keys';
import { NavInput } from '../ui/nav';
import { drawBox, fadeIn, FONT, goTo, HEX } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';

// T53: filas algo más bajas para que quepan Restablecer y Volver. T74: 11 por columna (21 acciones con la megaevolución)
// Con «Cambiar forma de poder» son 23: 12 por columna y filas algo más bajas
const COL_ROWS = 12;
const ROW = { w: 420, h: 32, gap: 3, top: 84, x: [50, 490] };
/** Opciones: todas las acciones, "Restablecer" y "Volver". */
const RESET = ACTIONS.length;
const BACK = ACTIONS.length + 1;

/**
 * Ajustes > Controles (T44): cambiar la tecla de cada acción. Se elige con flechas/ratón/mando y se pulsa la tecla
 * nueva; si ya la usa otra acción, avisa y no la cambia. Esc cancela (salvo para "Volver", que puede ser Esc).
 */
export class KeysScene extends Phaser.Scene {
  private keys!: KeyMap;
  private selected = 0;
  private waiting: Action | null = null;
  private nav!: NavInput;
  private rows: { box: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text; x: number; y: number; w: number }[] = [];
  private message!: Phaser.GameObjects.Text;
  private leaving = false;
  /** Tras capturar una tecla, ese fotograma no cuenta para moverse por la lista. */
  private skipNav = false;

  constructor() {
    super('Keys');
  }

  create() {
    this.keys = loadKeys();
    this.selected = 0;
    this.waiting = null;
    this.leaving = false;
    this.rows = [];
    this.nav = new NavInput(this);
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    addBackButton(this, () => this.back());
    this.add.text(480, 44, 'Teclas', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: HEX.gold })
      .setOrigin(0.5).setStroke('#2b3a67', 10);

    ACTIONS.forEach((a, i) => {
      const x = ROW.x[Math.floor(i / COL_ROWS)];
      const y = ROW.top + (i % COL_ROWS) * (ROW.h + ROW.gap);
      this.addRow(i, x, y, ROW.w, ACTION_LABEL[a]);
    });
    this.addRow(RESET, 490, ROW.top + COL_ROWS * (ROW.h + ROW.gap), 200, 'Restablecer');
    this.addRow(BACK, 710, ROW.top + COL_ROWS * (ROW.h + ROW.gap), 200, 'Volver');

    this.message = this.add.text(480, 580, '', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    addHelpBar(this, 480, 612, 'Elige con Flechas o ratón · Enter o clic y pulsa la tecla nueva · Esc para volver', {
        fontFamily: FONT, fontSize: '14px', color: '#ffffff',
      })
      .setOrigin(0.5).setAlpha(0.7);

    // La tecla nueva se lee del evento del teclado (cualquier tecla, también las que no usan los menús)
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.capture(e));
    this.refresh();
  }

  private addRow(i: number, x: number, y: number, w: number, text: string) {
    const box = this.add.graphics();
    const label = this.add.text(x + 18, y + ROW.h / 2, text, { fontFamily: FONT, fontSize: '17px', color: HEX.text }).setOrigin(0, 0.5);
    const value = this.add.text(x + w - 18, y + ROW.h / 2, '', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: HEX.text }).setOrigin(1, 0.5);
    if (i >= RESET) label.setX(x + w / 2).setOrigin(0.5).setFontStyle('bold');
    const zone = this.add.zone(x + w / 2, y + ROW.h / 2, w, ROW.h).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => !this.waiting && this.select(i));
    zone.on('pointerdown', () => {
      if (this.waiting) return;
      this.select(i);
      this.activate();
    });
    this.rows.push({ box, label, value, x, y, w });
  }

  private refresh() {
    this.rows.forEach((r, i) => {
      r.box.clear();
      drawBox(r.box, r.x, r.y, r.w, ROW.h, { radius: 10, selected: i === this.selected });
      if (i < RESET) {
        const a = ACTIONS[i];
        const waiting = this.waiting === a;
        r.value.setText(waiting ? 'Pulsa una tecla…' : keyLabel(this.keys[a]));
        r.value.setColor(waiting ? '#b8860b' : this.keys[a] !== DEFAULT_KEYS[a] ? '#2e7d32' : HEX.text);
      }
    });
  }

  private select(i: number) {
    this.selected = Phaser.Math.Clamp(i, 0, BACK);
    this.refresh();
  }

  private activate() {
    if (this.selected === BACK) return this.back();
    if (this.selected === RESET) {
      this.keys = { ...DEFAULT_KEYS };
      this.save();
      this.say('Teclas restablecidas');
      return;
    }
    this.waiting = ACTIONS[this.selected];
    this.say(`${ACTION_LABEL[this.waiting]}: pulsa la tecla nueva (Esc, B o clic fuera para cancelar)`);
    this.refresh();
    // Con el ratón: un clic en cualquier sitio (que no sea una fila) cancela
    this.time.delayedCall(0, () => this.input.once('pointerdown', () => this.waiting && this.cancel()));
  }

  private capture(e: KeyboardEvent) {
    const action = this.waiting;
    if (!action) return;
    this.skipNav = true;
    const name = keyNameFromCode(e.keyCode);
    if (name === 'ESC' && action !== 'back') return this.cancel();
    if (!name) {
      sfx('hurt');
      return this.say('Esa tecla no se puede usar: pulsa otra');
    }
    const res = bindKey(this.keys, action, name);
    if (!res.ok) {
      sfx('hurt');
      return this.say(`${keyLabel(name)} ya es «${ACTION_LABEL[res.conflict]}»: pulsa otra (Esc para cancelar)`);
    }
    this.keys = res.keys;
    this.waiting = null;
    this.save();
    this.say(`${ACTION_LABEL[action]}: ${keyLabel(name)}`);
  }

  private cancel() {
    this.waiting = null;
    this.say('');
    this.refresh();
  }

  private save() {
    saveKeys(this.keys);
    refreshControls(this.keys);
    sfx('select');
    this.refresh();
  }

  private say(text: string) {
    this.message.setText(text);
  }

  private back() {
    if (this.leaving) return;
    this.leaving = true;
    goTo(this, 'Settings');
  }

  update() {
    if (this.leaving) return;
    const s = this.nav.read();
    if (this.skipNav) {
      this.skipNav = false;
      return;
    }
    if (this.waiting) {
      // El mando no puede escribir teclas: B cancela
      if (s.back) this.cancel();
      return;
    }
    if (s.back) return this.back();
    const last = ACTIONS.length - 1;
    if (s.dy) {
      const i = this.selected;
      // Restablecer y Volver están debajo de la columna derecha
      if (i >= RESET) this.select(s.dy < 0 ? last : i);
      else if (s.dy > 0 && i === last) this.select(RESET);
      else if ((s.dy > 0 && i === COL_ROWS - 1) || (s.dy < 0 && i === COL_ROWS)) this.select(i);
      else this.select(Phaser.Math.Clamp(i + s.dy, 0, last));
    }
    if (s.dx) {
      const i = this.selected;
      if (i === RESET) this.select(s.dx > 0 ? BACK : COL_ROWS - 1);
      else if (i === BACK) this.select(s.dx > 0 ? BACK : RESET);
      else {
        const next = i + s.dx * COL_ROWS;
        // Desde el último de la izquierda, a la derecha está Restablecer
        this.select(next === ACTIONS.length ? RESET : Phaser.Math.Clamp(next, 0, last));
      }
    }
    if (s.ok) this.activate();
  }
}
