// Barra de ayuda al pie de los menús con las teclas dibujadas (glifos pixel art). Con teclado y ratón enseña su
// texto; con mando se esconde (la barra del mando, PadLegendScene, ya enseña sus botones dibujados encima); en
// táctil enseña su texto táctil o nada (los botones se ven y se tocan).
import Phaser from 'phaser';
import { GlyphText } from './art/keyGlyphs';
import { currentInput, onInputChange, type InputDevice } from './inputMode';

export interface HelpBarStyle {
  [k: string]: unknown;
  fontSize?: string | number;
  color?: string;
}

export function addHelpBar(scene: Phaser.Scene, x: number, y: number, pc: string, style: HelpBarStyle = {}, touch = ''): GlyphText {
  const size = typeof style.fontSize === 'number' ? style.fontSize : parseInt(style.fontSize ?? '14', 10) || 14;
  const t = new GlyphText(scene, x, y, '', { size, color: style.color ?? '#ffffff', bold: false, originX: 0.5, maxWidth: 920 });
  const paint = (d: InputDevice) => {
    if (!t.active) return;
    if (d === 'gamepad') return void t.setVisible(false);
    if (d === 'touch') {
      t.setVisible(!!touch);
      if (touch) t.setText(touch, 'touch');
      return;
    }
    t.setVisible(true).setText(pc, 'keyboard');
  };
  paint(currentInput());
  const off = onInputChange(paint);
  t.once(Phaser.GameObjects.Events.DESTROY, off);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  return t;
}
