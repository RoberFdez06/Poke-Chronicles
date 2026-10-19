import Phaser from 'phaser';
import { DCX, fitDesign } from '../ui/layout';
import { FONT } from '../ui/theme';
import { currentInput, LEGEND_SCENES, legendFor } from '../ui/inputMode';

/**
 * Barra de ayuda con los botones del mando, siempre encima de los menús (no en la partida). Solo se ve cuando lo
 * último que se ha usado es el mando; con teclado o ratón no sale. Cada menú enseña sus botones.
 */
export class PadLegendScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Rectangle;
  private text!: Phaser.GameObjects.Text;
  private shown = '';

  constructor() {
    super('PadLegend');
  }

  create() {
    fitDesign(this);
    this.bg = this.add.rectangle(DCX, 612, 880, 28, 0x0d1425, 1).setStrokeStyle(2, 0xf8d030, 0.9).setVisible(false);
    this.text = this.add.text(DCX, 612, '', { fontFamily: FONT, fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setVisible(false);
    this.scene.bringToTop();
  }

  update() {
    // La escena de menú que manda: la de arriba que no sea esta ni una de introducción
    let key = '';
    for (const s of this.scene.manager.getScenes(true)) {
      if (s.scene.key !== 'PadLegend' && LEGEND_SCENES.has(s.scene.key)) key = s.scene.key;
    }
    const show = currentInput() === 'gamepad' && key !== '';
    this.bg.setVisible(show);
    this.text.setVisible(show);
    if (!show) {
      this.shown = '';
      return;
    }
    const msg = legendFor(key);
    if (msg !== this.shown) {
      this.shown = msg;
      this.text.setText(msg);
      this.bg.setSize(Math.min(940, this.text.width + 36), 28);
    }
    this.scene.bringToTop();
  }
}
