// Destellos dorados alrededor de un punto: para los shinies al aparecer (gacha, enemigos, colección).
import Phaser from 'phaser';

export function sparkle(scene: Phaser.Scene, x: number, y: number, radius = 50, depth = 15) {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.random() * 0.4;
    const star = scene.add
      .text(x, y, k % 2 ? '✦' : '✧', { fontFamily: 'system-ui, sans-serif', fontSize: k % 2 ? '20px' : '14px', color: '#fff3a0' })
      .setOrigin(0.5)
      .setDepth(depth)
      .setStroke('#c99a1e', 3);
    scene.tweens.add({
      targets: star,
      x: x + Math.cos(a) * radius,
      y: y + Math.sin(a) * radius,
      alpha: 0,
      scale: 1.6,
      duration: 650 + Math.random() * 250,
      delay: k * 30,
      onComplete: () => star.destroy(),
    });
  }
}
