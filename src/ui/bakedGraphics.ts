// Dibujos fijos del HUD ya pintados en una imagen. Un Graphics repite todas sus órdenes en cada fotograma y por cada
// cámara (el HUD tiene hasta 6): el fondo de los laterales y el minimapa, con decenas de miles de rectángulos, se
// comían casi todo el tiempo de dibujado. La imagen se pinta una vez y cuesta lo mismo que un solo sprite.
import Phaser from 'phaser';

export interface BakeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Píxeles de imagen por unidad: los paneles se ven ampliados hasta ×1,6 y con ×2 los bordes siguen nítidos. */
const BAKE_RES = 2;

/** Imagen vacía que cubre `r` (coordenadas de la escena); se pinta con paintBake. */
export function addBakeTarget(scene: Phaser.Scene, r: BakeRect): Phaser.GameObjects.RenderTexture {
  return scene.add.renderTexture(r.x, r.y, Math.ceil(r.w * BAKE_RES), Math.ceil(r.h * BAKE_RES)).setOrigin(0).setScale(1 / BAKE_RES);
}

/** Vuelca en la imagen lo que tiene `g` dentro de `r` (borrando lo anterior). `g` queda como estaba. */
export function paintBake(rt: Phaser.GameObjects.RenderTexture, g: Phaser.GameObjects.Graphics, r: BakeRect) {
  const { visible, scaleX, scaleY } = g;
  g.setVisible(true).setScale(BAKE_RES);
  rt.clear().draw(g, -r.x * BAKE_RES, -r.y * BAKE_RES);
  g.setVisible(visible).setScale(scaleX, scaleY);
}

/** Avisa si la tarjeta gráfica pierde y recupera el contexto (móviles en segundo plano): las imágenes vuelven vacías. */
export function onGpuRestored(scene: Phaser.Scene, repaint: () => void) {
  const renderer = scene.renderer;
  renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, repaint);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => renderer.off(Phaser.Renderer.Events.RESTORE_WEBGL, repaint));
}
