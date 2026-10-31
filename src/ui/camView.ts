// Zona que ve una cámara en coordenadas de "pantalla de la cámara" (objetos con scrollFactor 0). Lógica pura.
// Ojo: Phaser escala también los objetos fijos (scrollFactor 0) con el zoom, alrededor del centro del visor. La
// partida usa zoom 1,5 y un visor desplazado (GAME_VIEW), así que pintar de 0 a scale.width ya no coincide con lo que se
// ve: el tinte quedaba con sus bandas corridas respecto a paredes y suelo, y las bandas de cine se salían de la vista.

export interface CamLike { width: number; height: number; zoom: number }

/** Rectángulo (en coordenadas de scrollFactor 0) que cubre exactamente el visor, más `margin` (temblor de cámara). */
export function fixedViewRect(cam: CamLike, margin = 0): { x: number; y: number; w: number; h: number } {
  const z = cam.zoom > 0 ? cam.zoom : 1;
  const w = cam.width / z;
  const h = cam.height / z;
  const x = cam.width / 2 - w / 2;
  const y = cam.height / 2 - h / 2;
  const m = margin / z;
  return { x: x - m, y: y - m, w: w + m * 2, h: h + m * 2 };
}

/** Dónde se ve en el visor (px locales) un punto fijo (x, y): para comprobar la cobertura en los tests. */
export function fixedToViewport(cam: CamLike, x: number, y: number): { x: number; y: number } {
  return { x: cam.width / 2 + (x - cam.width / 2) * cam.zoom, y: cam.height / 2 + (y - cam.height / 2) * cam.zoom };
}
