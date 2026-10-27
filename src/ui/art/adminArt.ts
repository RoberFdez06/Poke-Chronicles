import Phaser from 'phaser';

// Distintivo del modo admin en pixel art propio: una llave inglesa dorada sobre una placa roja.
const WRENCH = [
  '..##....',
  '.#..#...',
  '.#..#...',
  '..###...',
  '....##..',
  '.....##.',
  '......##',
  '.......#',
];

/** Dibuja la llave (8×8 celdas de `u` px) con la esquina superior izquierda en (x, y). */
export function drawAdminWrench(g: Phaser.GameObjects.Graphics, x: number, y: number, u = 3, color = 0xf8d030) {
  WRENCH.forEach((row, j) =>
    [...row].forEach((c, i) => {
      if (c !== '#') return;
      g.fillStyle(0x3a2208, 1).fillRect(x + i * u + 1, y + j * u + 1, u, u);
      g.fillStyle(color, 1).fillRect(x + i * u, y + j * u, u, u);
    }),
  );
}

/** Placa «ADMIN» (rectángulo pixelado + llave); (x, y) es la esquina superior izquierda; devuelve el ancho. */
export function drawAdminPlate(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.fillStyle(0x1a0d12, 1).fillRect(x, y + 2, w, h - 4).fillRect(x + 2, y, w - 4, h);
  g.fillStyle(0xc0392b, 1).fillRect(x + 2, y + 4, w - 4, h - 8).fillRect(x + 4, y + 2, w - 8, h - 4);
  g.fillStyle(0xffffff, 0.35).fillRect(x + 6, y + 4, w - 12, 2);
  drawAdminWrench(g, x + 6, y + Math.round((h - 24) / 2), 3);
  return w;
}
