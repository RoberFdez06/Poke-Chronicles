// Logo pixel de Poké Chronicles: letras gordas con degradado amarillo-naranja, borde azul marino y sombra,
// como los títulos de los juegos de GBA. Medidas relativas a la escala que se le pase.
import Phaser from 'phaser';
import { FONT } from '../theme';

/** Crea el logo centrado en (x, y). `scale` multiplica los píxeles (4 = como el menú a 960×640). */
export function addLogo(scene: Phaser.Scene, x: number, y: number, scale = 4) {
  const t = scene.add
    .text(x, y, 'Poké Chronicles', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#f8d030', resolution: 1 })
    .setOrigin(0.5)
    .setScale(scale)
    .setStroke('#283068', 3)
    .setShadow(1, 2, '#101828', 0, true, true);
  // Degradado vertical: amarillo claro arriba, naranja abajo
  const grd = t.context.createLinearGradient(0, 0, 0, t.height);
  grd.addColorStop(0.15, '#fff3a0');
  grd.addColorStop(0.5, '#f8d030');
  grd.addColorStop(0.9, '#f08820');
  t.setFill(grd);
  t.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return t;
}

/** Destellos de 4 puntas que parpadean alrededor de un rectángulo (el logo). */
export function addSparkles(scene: Phaser.Scene, area: Phaser.Geom.Rectangle, count = 6, u = 4) {
  const key = 'sparkle-star';
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1);
    g.fillRect(2, 0, 1, 5).fillRect(0, 2, 5, 1);
    g.fillStyle(0xfff3a0, 1).fillRect(2, 2, 1, 1);
    g.generateTexture(key, 5, 5);
    g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  const stars: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < count; i++) {
    const s = scene.add.image(0, 0, key).setScale(u).setAlpha(0);
    stars.push(s);
    const blink = () => {
      const p = area.getRandomPoint();
      s.setPosition(Math.round(p.x), Math.round(p.y));
      scene.tweens.add({ targets: s, alpha: { from: 0, to: 1 }, duration: 260, yoyo: true, hold: 120, onComplete: () => {
        if (s.active) scene.time.delayedCall(300 + Math.random() * 1400, blink);
      } });
    };
    scene.time.delayedCall(i * 250, blink);
  }
  return stars;
}
