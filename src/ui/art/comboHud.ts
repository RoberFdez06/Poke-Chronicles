// Contador del combo (arriba a la izquierda de la sala): el número crece al subir, cambia de color por tramos
// y una barra fina dice cuánto queda para que se rompa.
import Phaser from 'phaser';
import { comboAlive, comboTier, type ComboState } from '../../data/combo';

export class ComboHud {
  private num: Phaser.GameObjects.Text;
  private label: Phaser.GameObjects.Text;
  private bar: Phaser.GameObjects.Graphics;
  private shown = 0;

  constructor(
    private scene: Phaser.Scene,
    private x: number,
    private y: number,
    font: string,
    /** Mete un objeto en la capa de la interfaz (así sale en pantalla y no en el mundo). */
    private adopt: <T extends Phaser.GameObjects.GameObject>(o: T) => T = (o) => o,
  ) {
    const style = { fontFamily: font, fontStyle: 'bold' as const, color: '#ffffff' };
    this.num = adopt(scene.add.text(x, y, '', { ...style, fontSize: '44px' }).setOrigin(0, 0.5).setDepth(11).setStroke('#1d2848', 7));
    this.label = adopt(scene.add.text(x, y + 30, '', { ...style, fontSize: '18px' }).setOrigin(0, 0.5).setDepth(11).setStroke('#1d2848', 5));
    this.bar = adopt(scene.add.graphics().setDepth(11));
    this.num.setVisible(false);
    this.label.setVisible(false);
  }

  /** Dibuja el estado. Al subir el número, "late" (sube de tamaño y vuelve). */
  update(s: ComboState, now: number) {
    const alive = comboAlive(s, now);
    const tier = comboTier(s.count);
    const show = alive && !!tier;
    this.num.setVisible(show);
    this.label.setVisible(show);
    this.bar.clear();
    if (!show || !tier) {
      this.shown = alive ? s.count : 0;
      return;
    }
    this.num.setText(`x${s.count}`).setColor(tier.hex);
    this.label.setText(tier.label).setColor(tier.hex);
    if (s.count !== this.shown) {
      this.shown = s.count;
      this.scene.tweens.killTweensOf(this.num);
      this.num.setScale(1.5);
      this.scene.tweens.add({ targets: this.num, scale: 1, duration: 160, ease: 'Back.easeOut' });
    }
    const left = Math.max(0, Math.min(1, (s.expiresAt - now) / Math.max(1, s.expiresAt - s.startedAt)));
    this.bar.fillStyle(0x1d2848, 0.85).fillRect(this.x - 2, this.y + 46, 124, 8);
    this.bar.fillStyle(tier.color, 1).fillRect(this.x, this.y + 48, 120 * left, 4);
  }

  /** Se rompe: el número cae y se desvanece. */
  broke(was: number) {
    if (was < 3) return;
    const t = this.adopt(this.scene.add.text(this.x, this.y, `x${was}`, { fontFamily: this.num.style.fontFamily, fontStyle: 'bold', fontSize: '44px', color: '#9aa4b8' })
      .setOrigin(0, 0.5).setDepth(11).setStroke('#1d2848', 7));
    this.scene.tweens.add({ targets: t, y: this.y + 40, alpha: 0, duration: 520, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
    this.shown = 0;
  }
}
