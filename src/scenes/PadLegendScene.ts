import Phaser from 'phaser';
import { DCX, fitDesign } from '../ui/layout';
import { GlyphText } from '../ui/art/keyGlyphs';
import { currentInput, LEGEND_SCENES, legendFor } from '../ui/inputMode';

/**
 * Barra de ayuda con los botones del mando, siempre encima de los menús (no en la partida). Solo se ve cuando lo
 * último que se ha usado es el mando; con teclado o ratón no sale. Cada menú enseña sus botones.
 */
export class PadLegendScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Rectangle;
  private text!: GlyphText;
  private shown = '';

  constructor() {
    super('PadLegend');
  }

  create() {
    fitDesign(this);
    this.bg = this.add.rectangle(DCX, 612, 880, 32, 0x0d1425, 1).setStrokeStyle(2, 0xf8d030, 0.9).setVisible(false);
    // Botones del mando dibujados (no «A», «LB» escritos)
    this.text = new GlyphText(this, DCX, 612, '', { size: 13, color: '#ffffff', originX: 0.5, device: 'gamepad', maxWidth: 920 }).setVisible(false);
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
      this.bg.setSize(Math.min(940, this.text.displayW + 36), 32);
    }
    this.scene.bringToTop();
  }
}
