// Contador del combo (arriba a la izquierda de la sala, nunca en el centro): número grande que late al subir, nombre
// del nivel (Racha, Frenesí, Imparable, Leyenda), barra pixel segmentada con el tiempo que queda (se rellena con cada
// golpe), cuatro marcas de nivel y la bonificación en letra pequeña. Al subir de nivel, destello y chispas pixel.
import Phaser from 'phaser';
import { COMBO_LEVELS, comboAlive, comboBonusText, comboLevel, comboTimeLeft, type ComboLevel, type ComboState } from '../../data/combo';
import { lowFx } from '../theme';

/** A partir de cuántos golpes se enseña el contador. */
const SHOW_FROM = 2;
const BAR_W = 150;
const SEG = 10;
const INK = 0x1d2848;

export class ComboHud {
  private num: Phaser.GameObjects.Text;
  private label: Phaser.GameObjects.Text;
  private bonus: Phaser.GameObjects.Text;
  private g: Phaser.GameObjects.Graphics;
  private shown = 0;
  private drawnKey = '';

  constructor(
    private scene: Phaser.Scene,
    private x: number,
    private y: number,
    font: string,
    /** Mete un objeto en la capa de la interfaz (así sale en pantalla y no en el mundo). */
    private adopt: <T extends Phaser.GameObjects.GameObject>(o: T) => T = (o) => o,
  ) {
    const style = { fontFamily: font, fontStyle: 'bold' as const, color: '#ffffff' };
    this.g = adopt(scene.add.graphics().setDepth(11));
    this.num = adopt(scene.add.text(x, y, '', { ...style, fontSize: '44px' }).setOrigin(0, 0.5).setDepth(11).setStroke('#1d2848', 7));
    this.label = adopt(scene.add.text(x, y + 30, '', { ...style, fontSize: '18px' }).setOrigin(0, 0.5).setDepth(11).setStroke('#1d2848', 5));
    this.bonus = adopt(scene.add.text(x, y + 70, '', { ...style, fontSize: '12px', color: '#e8ecf6' }).setOrigin(0, 0.5).setDepth(11).setStroke('#1d2848', 4));
    this.setVisible(false);
  }

  private setVisible(v: boolean) {
    this.num.setVisible(v);
    this.label.setVisible(v);
    this.bonus.setVisible(v);
    this.g.setVisible(v);
  }

  /** Dibuja el estado. Al subir el número, "late" (sube de tamaño y vuelve). */
  update(s: ComboState) {
    const alive = comboAlive(s);
    const show = alive && s.count >= SHOW_FROM;
    this.setVisible(show);
    if (!show) {
      this.shown = alive ? s.count : 0;
      this.drawnKey = '';
      return;
    }
    const lvl = comboLevel(s.count);
    const hex = lvl?.hex ?? '#ffffff';
    const color = lvl?.color ?? 0xffffff;
    this.num.setText(`x${s.count}`).setColor(hex);
    this.label.setText(lvl ? lvl.name : 'Combo').setColor(hex);
    this.bonus.setText(lvl ? comboBonusText(lvl) : `Racha a x${COMBO_LEVELS[0].at}`);
    if (s.count !== this.shown) {
      this.shown = s.count;
      this.scene.tweens.killTweensOf(this.num);
      this.num.setScale(1.4);
      this.scene.tweens.add({ targets: this.num, scale: 1, duration: 150, ease: 'Back.easeOut' });
    }
    // Barra segmentada (se redibuja solo cuando cambia un segmento) y marcas de nivel
    const left = comboTimeLeft(s);
    const lit = Math.ceil(left * SEG * 4) / 4;
    const idx = lvl ? COMBO_LEVELS.indexOf(lvl) : -1;
    const key = `${lit}:${idx}:${left < 0.3 && Math.floor(this.scene.time.now / 120) % 2}`;
    if (key === this.drawnKey) return;
    this.drawnKey = key;
    const g = this.g.clear();
    const bx = this.x;
    const by = this.y + 46;
    const sw = BAR_W / SEG;
    g.fillStyle(INK, 0.9).fillRect(bx - 3, by - 3, BAR_W + 6, 12);
    // Casi agotado: parpadea en blanco para avisar
    const warn = left < 0.3 && Math.floor(this.scene.time.now / 120) % 2 === 0;
    for (let i = 0; i < SEG; i++) {
      const fill = Math.max(0, Math.min(1, lit - i));
      g.fillStyle(0x3a4560, 1).fillRect(bx + i * sw + 1, by, sw - 2, 6);
      if (fill > 0) g.fillStyle(warn ? 0xffffff : color, 1).fillRect(bx + i * sw + 1, by, (sw - 2) * fill, 6);
    }
    // Cuatro marcas de nivel (rombos pixel) a la derecha del número
    for (let k = 0; k < COMBO_LEVELS.length; k++) {
      const cx = bx + BAR_W + 16;
      const cy = this.y - 18 + k * 14;
      const on = k <= idx;
      g.fillStyle(INK, 1).fillRect(cx - 6, cy - 2, 12, 4).fillRect(cx - 2, cy - 6, 4, 12).fillRect(cx - 4, cy - 4, 8, 8);
      g.fillStyle(on ? COMBO_LEVELS[k].color : 0x3a4560, 1).fillRect(cx - 4, cy - 1, 8, 2).fillRect(cx - 1, cy - 4, 2, 8).fillRect(cx - 2, cy - 2, 4, 4);
    }
  }

  /** Subida de nivel: destello del contador, chispas pixel y el nombre que crece (en la esquina, no en el centro). */
  levelUp(l: ComboLevel) {
    const sc = this.scene;
    const t = this.adopt(sc.add.text(this.x, this.y + 30, `¡${l.name}!`, { fontFamily: this.num.style.fontFamily, fontStyle: 'bold', fontSize: '26px', color: l.hex })
      .setOrigin(0, 0.5).setDepth(12).setStroke('#1d2848', 6));
    sc.tweens.add({ targets: t, x: this.x + 40, alpha: 0, scale: 1.4, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
    if (lowFx()) return;
    const g = this.adopt(sc.add.graphics().setDepth(12));
    const cx = this.x + 40;
    const cy = this.y;
    const parts = Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2, v: 60 + (i % 3) * 30 }));
    const t0 = sc.time.now;
    const ev = sc.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        const k = Math.min(1, (sc.time.now - t0) / 520);
        g.clear();
        // Destello: rectángulo pixel que se abre y se apaga
        const r = 18 + 50 * k;
        g.fillStyle(0xffffff, 0.5 * (1 - k)).fillRect(cx - r, cy - r * 0.5, r * 2, r);
        for (const p of parts) {
          const d = p.v * k;
          const s = k < 0.6 ? 6 : 4;
          g.fillStyle(INK, 1 - k).fillRect(Math.round(cx + Math.cos(p.a) * d) - s / 2 - 1, Math.round(cy + Math.sin(p.a) * d * 0.7) - s / 2 - 1, s + 2, s + 2);
          g.fillStyle(p.v > 80 ? 0xffffff : l.color, 1 - k).fillRect(Math.round(cx + Math.cos(p.a) * d) - s / 2, Math.round(cy + Math.sin(p.a) * d * 0.7) - s / 2, s, s);
        }
        if (k >= 1) {
          ev.remove();
          g.destroy();
        }
      },
    });
  }

  /** Se acaba: el número cae y se desvanece. */
  broke(was: number) {
    this.shown = 0;
    if (was < SHOW_FROM) return;
    const t = this.adopt(this.scene.add.text(this.x, this.y, `x${was}`, { fontFamily: this.num.style.fontFamily, fontStyle: 'bold', fontSize: '44px', color: '#9aa4b8' })
      .setOrigin(0, 0.5).setDepth(11).setStroke('#1d2848', 7));
    this.scene.tweens.add({ targets: t, y: this.y + 40, alpha: 0, duration: 520, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
  }
}
