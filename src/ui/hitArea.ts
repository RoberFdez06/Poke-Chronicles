// Zona de toque más grande que el dibujo (móvil). Un Text de Phaser rehace su zona al cambiar de color o de texto:
// le vuelve a poner su ancho y alto pero deja el desplazamiento, y la zona ampliada acababa movida hacia arriba (el
// «Volver» solo respondía tocando por encima). Marcada como propia, Phaser ya no la toca.
import Phaser from 'phaser';

/** Pone la zona de toque de `o` (coordenadas locales) y evita que Phaser la cambie después. */
export function setHitRect(o: Phaser.GameObjects.GameObject, x: number, y: number, w: number, h: number) {
  const input = o.input;
  if (!input) return;
  (input.hitArea as Phaser.Geom.Rectangle).setTo(x, y, w, h);
  input.customHitArea = true;
}

/**
 * Zona de toque de al menos `minW`×`minH` (px de diseño) centrada en el dibujo de `o`. Si el texto cambia después
 * (setText) hay que volver a llamarla, porque la zona ya no sigue al tamaño del texto.
 */
export function padHit(o: Phaser.GameObjects.GameObject & { width: number; height: number }, minW: number, minH: number) {
  const w = Math.max(o.width, minW);
  const h = Math.max(o.height, minH);
  setHitRect(o, (o.width - w) / 2, (o.height - h) / 2, w, h);
}
