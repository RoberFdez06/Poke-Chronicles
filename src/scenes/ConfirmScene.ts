import Phaser from 'phaser';
import { COVER_H, COVER_W, DCX, DCY, fitDesign } from '../ui/layout';
import { NavInput } from '../ui/nav';
import { drawBox, FONT, HEX } from '../ui/theme';
import { addPixelText } from '../ui/art/pixel';
import { sfx } from '../ui/audio';
import { accept, cancel, choose, CONFIRM_LABEL, CONFIRM_ORDER, moveFocus, newConfirm, type ConfirmChoice, type ConfirmState } from '../data/confirm';

export interface ConfirmData {
  /** La pregunta («¿Seguro que quieres comprar X por N monedas?»). */
  text: string;
  /** Título del cuadro (por defecto «CONFIRMAR COMPRA»). */
  title?: string;
  /** `true` si se confirma; `false` con No, Esc, B o un clic fuera del cuadro. */
  onResult: (yes: boolean) => void;
}

const BOX = { x: 220, y: 200, w: 520, h: 240 };
const BTN = { w: 170, h: 54, y: 360 };

/**
 * Confirmación Sí / No sobre otra escena (que queda en pausa, como con SlotSwapScene e ItemChoiceScene).
 * Teclado (←/→ o A/D, Enter o Espacio confirman, Esc cancela), ratón (clic en Sí o No; clic fuera = No) y mando
 * (cruceta o stick, A confirma, B cancela). El foco empieza en «No». La lógica está en data/confirm.ts.
 */
export class ConfirmScene extends Phaser.Scene {
  private args!: ConfirmData;
  private nav!: NavInput;
  private state: ConfirmState = newConfirm();
  private btns = new Map<ConfirmChoice, Phaser.GameObjects.Graphics>();
  private labels = new Map<ConfirmChoice, Phaser.GameObjects.Text>();
  private born = 0;
  private fired = false;

  constructor() {
    super('Confirm');
  }

  init(data: ConfirmData) {
    this.args = data;
    this.state = newConfirm();
    this.btns = new Map();
    this.labels = new Map();
    this.fired = false;
    this.sys.settings.data = {};
  }

  create() {
    fitDesign(this);
    this.born = this.time.now;
    this.nav = new NavInput(this);
    // Clic fuera del cuadro = No (el cuadro y los botones, encima, se quedan los suyos)
    this.add
      .rectangle(DCX, DCY, COVER_W + 4, COVER_H + 4, 0x0d1425, 0.82)
      .setInteractive()
      .on('pointerdown', () => this.armed() && this.apply(cancel(this.state)));
    drawBox(this.add.graphics(), BOX.x, BOX.y, BOX.w, BOX.h, { radius: 16, border: 0xd4a017 });
    this.add.zone(BOX.x + BOX.w / 2, BOX.y + BOX.h / 2, BOX.w, BOX.h).setInteractive();
    addPixelText(this, DCX, BOX.y + 40, this.args.title ?? 'CONFIRMAR COMPRA', { size: 16, scale: 2.2, color: '#f8d030', stroke: '#283068', strokeWidth: 3, shadow: '#101828' });
    this.add
      .text(DCX, BOX.y + 118, this.args.text, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: HEX.text, align: 'center', wordWrap: { width: BOX.w - 60 } })
      .setOrigin(0.5);
    CONFIRM_ORDER.forEach((c, i) => {
      const x = DCX + (i === 0 ? -1 : 1) * 105;
      const g = this.add.graphics();
      this.btns.set(c, g);
      this.labels.set(c, this.add.text(x, BTN.y, CONFIRM_LABEL[c], { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: HEX.text }).setOrigin(0.5));
      const zone = this.add.zone(x, BTN.y, BTN.w, BTN.h).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => !this.state.result && this.focusOn(c));
      zone.on('pointerdown', () => this.armed() && this.apply(choose(this.state, c)));
    });
    this.add.text(DCX, BOX.y + BOX.h - 22, '←/→ o A/D: elegir · Enter: aceptar · Esc o B: cancelar', { fontFamily: FONT, fontSize: '13px', color: HEX.textSoft }).setOrigin(0.5);
    this.paint();
    sfx('select');
  }

  /** Un instante tras abrir no se atiende el ratón: el clic que abrió el cuadro no lo cierra. */
  private armed() {
    return this.time.now - this.born > 150 && !this.fired;
  }

  private focusOn(c: ConfirmChoice) {
    if (this.state.focus === c) return;
    this.state = { ...this.state, focus: c };
    sfx('select');
    this.paint();
  }

  private paint() {
    for (const c of CONFIRM_ORDER) {
      const x = DCX + (c === 'yes' ? -1 : 1) * 105;
      const g = this.btns.get(c)!;
      g.clear();
      drawBox(g, x - BTN.w / 2, BTN.y - BTN.h / 2, BTN.w, BTN.h, { selected: this.state.focus === c });
    }
  }

  private apply(next: ConfirmState) {
    if (next === this.state) return;
    this.state = next;
    this.paint();
    if (next.result === null || this.fired) return;
    this.fired = true;
    sfx('select');
    this.args.onResult(next.result);
  }

  update() {
    if (this.fired) return;
    const s = this.nav.read();
    if (s.back) return this.apply(cancel(this.state));
    if (s.dx) {
      const next = moveFocus(this.state, s.dx);
      if (next !== this.state) {
        this.state = next;
        sfx('select');
        this.paint();
      }
    }
    if (s.ok) this.apply(accept(this.state));
  }
}

/**
 * Abre la confirmación sobre `host` (que queda en pausa) y llama a `onResult` ya con `host` reanudado.
 * Devuelve false si no se pudo abrir (entonces no se ha preguntado nada y quien llama NO debe comprar).
 */
export function openConfirm(host: Phaser.Scene, text: string, onResult: (yes: boolean) => void, title?: string): boolean {
  const mgr = host.scene.manager;
  if (!mgr.keys['Confirm'] || host.scene.isActive('Confirm') || host.scene.isPaused('Confirm')) return false;
  host.scene.launch('Confirm', {
    text,
    title,
    onResult: (yes: boolean) => {
      host.scene.stop('Confirm');
      host.scene.resume();
      host.input.keyboard?.resetKeys();
      onResult(yes);
    },
  } satisfies ConfirmData);
  host.scene.pause();
  return true;
}
