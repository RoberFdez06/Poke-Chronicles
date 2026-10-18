import Phaser from 'phaser';
import { CONTROLS } from '../data/controls';
import { resetProgress } from '../data/save';
import { stepVolume } from '../data/sounds';
import { getAudioSettings, setAudioSettings, sfx } from '../ui/audio';
import { addPanel, MenuList, NavInput } from '../ui/nav';
import { addBackButton } from '../ui/cards';
import { ARROW, drawBox, fadeIn, FONT, goTo, HEX } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';

export interface SettingsData {
  /**
   * Abierta encima de la pausa: al cerrar se vuelve a ella (y no al menú). `onReset` se llama tras borrar el
   * progreso, para salir de la partida sin guardarla.
   */
  overlay?: boolean;
  onClose?: () => void;
  onReset?: () => void;
}

type Row = 'music' | 'sfx' | 'fullscreen' | 'controls' | 'reset' | 'back';
const ROWS: Row[] = ['music', 'sfx', 'fullscreen', 'controls', 'reset', 'back'];
const ROW = { w: 520, h: 54, gap: 12, top: 140 };

/** Ajustes: volumen de música y efectos, pantalla completa, controles y borrar progreso. Teclado, ratón y mando. */
export class SettingsScene extends Phaser.Scene {
  private args: SettingsData = {};
  private nav!: NavInput;
  private selected = 0;
  private rows: { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; arrow: Phaser.GameObjects.Text; y: number }[] = [];
  /** Diálogo de confirmación o panel de controles abierto encima. */
  private dialog?: { layer: Phaser.GameObjects.Container; list?: MenuList };
  private closing = false;

  constructor() {
    super('Settings');
  }

  init(data?: SettingsData) {
    this.args = data ?? {};
  }

  create() {
    this.rows = [];
    this.dialog = undefined;
    this.closing = false;
    this.selected = 0;
    this.nav = new NavInput(this);
    if (this.args.overlay) {
      // Encima de la pausa: tapa lo de debajo y sus clics
      this.add.rectangle(480, 320, 960, 640, 0x0d1425, 0.92).setInteractive();
    } else {
      fadeIn(this);
      addMenuBackdrop(this);
    }

    this.add
      .text(480, 70, 'Ajustes', { fontFamily: FONT, fontSize: '48px', fontStyle: 'bold', color: HEX.gold })
      .setOrigin(0.5)
      .setStroke('#2b3a67', 10);
    addBackButton(this, () => this.close());

    ROWS.forEach((row, i) => {
      const y = ROW.top + i * (ROW.h + ROW.gap);
      const bg = this.add.graphics();
      const text = this.add.text(480, y, '', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: HEX.text }).setOrigin(0.5);
      const arrow = this.add.text(480 - ROW.w / 2 + 16, y, ARROW, { fontFamily: FONT, fontSize: '20px', color: HEX.text }).setOrigin(0, 0.5);
      // Ratón: clic en la fila la usa; en las de volumen, la mitad izquierda baja y la derecha sube
      const zone = this.add.zone(480, y, ROW.w, ROW.h).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => !this.dialog && this.select(i));
      zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (this.dialog) return;
        this.select(i);
        if (row === 'music' || row === 'sfx') this.adjust(row, p.x < 480 ? -1 : 1);
        else this.activate();
      });
      this.rows.push({ bg, text, arrow, y });
    });

    this.add
      .text(480, 604, 'Arriba/abajo: elegir · Izquierda/derecha o clic en ◀ ▶: volumen · Enter, A o clic: usar · Esc o B: volver', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setAlpha(0.7);
    this.refresh();
  }

  private label(row: Row): string {
    const a = getAudioSettings();
    const pct = (v: number) => `${Math.round(v * 100)} %`;
    switch (row) {
      case 'music':
        return `Música   ◀ ${pct(a.music)} ▶`;
      case 'sfx':
        return `Efectos   ◀ ${pct(a.sfx)} ▶`;
      case 'fullscreen':
        return `Pantalla completa: ${this.scale.isFullscreen ? 'Sí' : 'No'}`;
      case 'controls':
        return 'Mostrar controles';
      case 'reset':
        return 'Borrar progreso';
      case 'back':
        return 'Volver';
    }
  }

  private refresh() {
    this.rows.forEach((r, i) => {
      const sel = i === this.selected;
      r.bg.clear();
      drawBox(r.bg, 480 - ROW.w / 2, r.y - ROW.h / 2, ROW.w, ROW.h, {
        selected: sel,
        border: ROWS[i] === 'reset' ? 0xc0392b : undefined,
      });
      r.text.setText(this.label(ROWS[i])).setColor(ROWS[i] === 'reset' ? '#c0392b' : HEX.text);
      r.arrow.setVisible(sel);
    });
  }

  private select(i: number) {
    this.selected = (i + ROWS.length) % ROWS.length;
    this.refresh();
  }

  private adjust(row: 'music' | 'sfx', d: number) {
    const a = getAudioSettings();
    a[row] = stepVolume(a[row], d);
    setAudioSettings(a);
    sfx('select'); // para oír cómo queda
    this.refresh();
  }

  private activate() {
    const row = ROWS[this.selected];
    sfx('select');
    if (row === 'music' || row === 'sfx') this.adjust(row, 1);
    else if (row === 'fullscreen') {
      // El navegador solo lo permite tras un gesto (Enter, A o clic lo son)
      try {
        this.scale.toggleFullscreen();
      } catch {
        // no disponible
      }
      this.time.delayedCall(150, () => this.refresh());
    } else if (row === 'controls') this.showControls();
    else if (row === 'reset') this.confirmReset();
    else this.close();
  }

  private close() {
    if (this.closing) return;
    if (this.dialog) return this.closeDialog();
    this.closing = true;
    if (this.args.overlay) {
      this.args.onClose?.();
      this.scene.stop();
    } else goTo(this, 'Menu');
  }

  private closeDialog() {
    this.dialog?.layer.destroy();
    this.dialog?.list?.destroy();
    this.dialog = undefined;
  }

  private showControls() {
    const layer = addPanel(this, 480, 330, 720, 420, 50);
    layer.add(this.add.text(480, 160, 'Controles', { fontFamily: FONT, fontSize: '32px', fontStyle: 'bold', color: HEX.text }).setOrigin(0.5));
    CONTROLS.forEach(([what, how], k) => {
      const y = 205 + k * 54;
      layer.add(this.add.text(160, y, what, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: HEX.text }));
      layer.add(this.add.text(160, y + 25, how, { fontFamily: FONT, fontSize: '16px', color: HEX.textSoft }));
    });
    layer.add(this.add.text(480, 510, 'Esc, Enter, B, A o clic para cerrar', { fontFamily: FONT, fontSize: '15px', color: HEX.textSoft }).setOrigin(0.5));
    (layer.list[0] as Phaser.GameObjects.Rectangle).on('pointerdown', () => this.closeDialog());
    this.dialog = { layer };
  }

  /** Doble confirmación: no se puede deshacer. */
  private confirmReset(step = 1) {
    this.closeDialog();
    const layer = addPanel(this, 480, 320, 600, 300, 50);
    const text =
      step === 1
        ? 'Se borrarán tus Pokémon, tickets,\nrécords y partidas guardadas.'
        : '¿Seguro del todo?\nNo se puede deshacer.';
    layer.add(
      this.add.text(480, 238, text, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#c0392b', align: 'center' }).setOrigin(0.5),
    );
    const options = step === 1 ? ['No, volver', 'Sí, borrar'] : ['No, volver', 'Sí, borrarlo todo'];
    const list = new MenuList(
      this,
      480,
      320,
      options,
      (k) => {
        if (k === 0) return this.closeDialog();
        if (step === 1) return this.confirmReset(2);
        this.doReset();
      },
      { w: 320, h: 50, gap: 14, depth: 51 },
    );
    this.dialog = { layer, list };
  }

  private doReset() {
    resetProgress();
    this.closeDialog();
    this.closing = true;
    if (this.args.overlay) {
      this.args.onReset?.();
      this.scene.stop();
    } else goTo(this, 'Menu');
  }

  update() {
    if (this.closing) return;
    const s = this.nav.read();
    const d = this.dialog;
    if (d) {
      if (s.back) return this.closeDialog();
      if (!d.list) {
        if (s.ok) this.closeDialog();
        return;
      }
      if (s.dy || s.dx) d.list.move(s.dy || s.dx);
      if (s.ok) d.list.activate();
      return;
    }
    if (s.back) return this.close();
    if (s.dy) this.select(this.selected + Math.sign(s.dy));
    const row = ROWS[this.selected];
    if (s.dx && (row === 'music' || row === 'sfx')) this.adjust(row, Math.sign(s.dx));
    if (s.ok) this.activate();
  }
}
