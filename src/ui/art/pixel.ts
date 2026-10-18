// Piezas pixel art al estilo GBA: flecha de selección y texto pixelado (dibujado pequeño y escalado sin suavizar).
import Phaser from 'phaser';
import { FONT } from '../theme';

/** Flecha ▶ de los menús de la GBA, hecha de píxeles de 4x4. (x, y) es su esquina superior izquierda. */
export function drawPixelArrow(g: Phaser.GameObjects.Graphics, x: number, y: number, color = 0x303848, u = 4) {
  g.fillStyle(color, 1);
  [1, 2, 3, 4, 3, 2, 1].forEach((w, row) => g.fillRect(x, y + row * u, w * u, u));
  return g;
}

/**
 * Texto con píxeles gordos: se escribe con un tamaño pequeño y se escala `scale` veces con NEAREST,
 * como los títulos de los juegos de GBA.
 */
export function addPixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  o: { size: number; scale: number; color: string; stroke?: string; strokeWidth?: number; shadow?: string },
) {
  const t = scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${o.size}px`, fontStyle: 'bold', color: o.color, resolution: 1 })
    .setOrigin(0.5)
    .setScale(o.scale);
  if (o.stroke) t.setStroke(o.stroke, o.strokeWidth ?? 2);
  if (o.shadow) t.setShadow(1, 1, o.shadow, 0, true, true);
  t.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return t;
}
