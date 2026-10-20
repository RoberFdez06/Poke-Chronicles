// Formas de sala y fosos (supervisor). En vez de pintar cada casilla como una caja suelta:
//  - los muros 'X' se unen: el borde que da al suelo es pared (con canto, contorno y sombra) y el resto es el
//    paisaje de fuera, así una sala en L o en cruz se ve como una sala de verdad recortada;
//  - los agujeros 'H' se unen en fosos: fondo oscuro continuo, pared interior de tierra arriba y borde alrededor.
import Phaser from 'phaser';
import { shade, type BiomeLook } from './tiles';

type Cell = string;
type Grid = readonly (readonly Cell[])[];
const OUTLINE = 0x18202c;

const at = (grid: Grid, x: number, y: number): Cell | undefined => grid[y]?.[x];

/**
 * Dibuja las casillas 'X'. `room` es el interior (suelo), `tile` el lado de una casilla, `wall` el grosor de la
 * pared de la sala, `cell` la celda de la sala en el mapa (para que el paisaje case con el de fuera) y `outScale`
 * la escala del paisaje.
 */
export function drawShapedWalls(
  scene: Phaser.Scene,
  grid: Grid,
  room: { x0: number; y0: number },
  tile: number,
  wall: number,
  b: BiomeLook,
  wallKey: string,
  wallScale: number,
  cell: { x: number; y: number },
  outScale: number,
) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  // Fuera de la cuadrícula cuenta como muro (se funde con la pared de la sala)
  const solid = (x: number, y: number) => x < 0 || y < 0 || x >= cols || y >= rows || at(grid, x, y) === 'X';
  const edge = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!solid(x + dx, y + dy)) return true;
    return false;
  };
  const outKey = `outside-${b.id}`;
  const out = (x: number, y: number, w: number, h: number) => {
    if (!scene.textures.exists(outKey)) return;
    scene.add
      .tileSprite(x, y, w, h, outKey)
      .setOrigin(0)
      .setTileScale(outScale)
      .setTilePosition((x - cell.x) / outScale, (y - cell.y) / outScale)
      .setDepth(0.62);
  };
  const lip = shade(b.colors.wall, 0.4);
  const g = scene.add.graphics().setDepth(0.64);
  const shadow = scene.add.graphics().setDepth(0.31);
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      if (at(grid, tx, ty) !== 'X') continue;
      const x = room.x0 + tx * tile;
      const y = room.y0 + ty * tile;
      if (!edge(tx, ty)) {
        // Hueco: paisaje de fuera, que también tapa la pared de la sala si está pegado a ella
        const ex0 = tx === 0 ? x - wall : x;
        const ey0 = ty === 0 ? y - wall : y;
        const ex1 = tx === cols - 1 ? x + tile + wall : x + tile;
        const ey1 = ty === rows - 1 ? y + tile + wall : y + tile;
        out(ex0, ey0, ex1 - ex0, ey1 - ey0);
        continue;
      }
      // Borde: pared del bioma
      scene.add.tileSprite(x, y, tile, tile, wallKey).setOrigin(0).setTileScale(wallScale).setTilePosition((x - room.x0) / wallScale, (y - room.y0) / wallScale).setDepth(0.63);
      // Contorno y canto en los lados que dan al suelo; sombra sobre el suelo de abajo y de los lados
      if (!solid(tx, ty + 1)) {
        g.fillStyle(shade(b.colors.wall, -0.45), 1).fillRect(x, y + tile - 8, tile, 6);
        g.fillStyle(OUTLINE, 1).fillRect(x, y + tile - 2, tile, 2);
        for (let s = 0; s < 4; s++) shadow.fillStyle(0x000000, 0.2 - s * 0.045).fillRect(x, y + tile + s * 4, tile, 4);
      }
      if (!solid(tx, ty - 1)) {
        g.fillStyle(OUTLINE, 1).fillRect(x, y, tile, 2);
        g.fillStyle(lip, 1).fillRect(x, y + 2, tile, 3);
      }
      if (!solid(tx - 1, ty)) {
        g.fillStyle(OUTLINE, 1).fillRect(x, y, 2, tile);
        g.fillStyle(lip, 0.8).fillRect(x + 2, y, 2, tile);
        for (let s = 0; s < 3; s++) shadow.fillStyle(0x000000, 0.12 - s * 0.035).fillRect(x - (s + 1) * 4, y, 4, tile);
      }
      if (!solid(tx + 1, ty)) {
        g.fillStyle(OUTLINE, 1).fillRect(x + tile - 2, y, 2, tile);
        g.fillStyle(shade(b.colors.wall, -0.35), 1).fillRect(x + tile - 5, y, 3, tile);
        for (let s = 0; s < 3; s++) shadow.fillStyle(0x000000, 0.12 - s * 0.035).fillRect(x + tile + s * 4, y, 4, tile);
      }
    }
  }
}

/** Dibuja los agujeros 'H' unidos en fosos, con su pared interior y su borde. */
export function drawPits(scene: Phaser.Scene, grid: Grid, room: { x0: number; y0: number }, tile: number, b: BiomeLook) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const pit = (x: number, y: number) => at(grid, x, y) === 'H';
  const g = scene.add.graphics().setDepth(0.6);
  const h = b.colors.hole;
  const deep = shade(h, -0.45);
  const face = shade(b.colors.floor, -0.42);
  const faceDark = shade(b.colors.floor, -0.6);
  const rim = shade(b.colors.floor, -0.22);
  const glow: Record<string, number> = { volcan: 0xff5a1a, mar: 0x2e78c8, nieve: 0x9fd8ff, cumbre: 0x9fd8ff, torre: 0x7a4ad0, pantano: 0x3a6a3a };
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      if (!pit(tx, ty)) continue;
      const x = room.x0 + tx * tile;
      const y = room.y0 + ty * tile;
      g.fillStyle(h, 1).fillRect(x, y, tile, tile);
      // Cuanto más lejos del borde, más oscuro
      const inner = pit(tx - 1, ty) && pit(tx + 1, ty) && pit(tx, ty - 1) && pit(tx, ty + 1);
      if (inner) g.fillStyle(deep, 1).fillRect(x, y, tile, tile);
      else g.fillStyle(deep, 1).fillRect(x + (pit(tx - 1, ty) ? 0 : 8), y + (pit(tx, ty - 1) ? 0 : 16), tile - (pit(tx - 1, ty) ? 0 : 8) - (pit(tx + 1, ty) ? 0 : 8), tile - (pit(tx, ty - 1) ? 0 : 16) - (pit(tx, ty + 1) ? 0 : 6));
      const gc = glow[b.id];
      if (gc !== undefined && inner) g.fillStyle(gc, 0.35).fillRect(x + 6, y + 10, tile - 12, tile - 20);
      // Pared interior de tierra (lo que se ve del foso mirando desde arriba)
      if (!pit(tx, ty - 1)) {
        g.fillStyle(face, 1).fillRect(x, y, tile, 14);
        g.fillStyle(faceDark, 1).fillRect(x, y + 14, tile, 4);
        for (let k = 0; k < 3; k++) g.fillStyle(faceDark, 1).fillRect(x + 4 + Math.floor(rnd() * (tile - 10)), y + 4 + Math.floor(rnd() * 8), 4, 2);
        g.fillStyle(OUTLINE, 1).fillRect(x, y, tile, 2);
        g.fillStyle(rim, 1).fillRect(x, y - 3, tile, 3);
      }
      if (!pit(tx, ty + 1)) {
        g.fillStyle(rim, 1).fillRect(x, y + tile - 4, tile, 4);
        g.fillStyle(OUTLINE, 1).fillRect(x, y + tile - 6, tile, 2);
      }
      if (!pit(tx - 1, ty)) {
        g.fillStyle(faceDark, 1).fillRect(x + 2, y, 5, tile);
        g.fillStyle(OUTLINE, 1).fillRect(x, y, 2, tile);
        g.fillStyle(rim, 1).fillRect(x - 3, y, 3, tile);
      }
      if (!pit(tx + 1, ty)) {
        g.fillStyle(face, 1).fillRect(x + tile - 7, y, 5, tile);
        g.fillStyle(OUTLINE, 1).fillRect(x + tile - 2, y, 2, tile);
        g.fillStyle(rim, 1).fillRect(x + tile, y, 3, tile);
      }
      // Esquinas redondeadas por fuera (se come un píxel gordo)
      const corner = (cx: number, cy: number, open: boolean) => open && g.fillStyle(b.colors.floor, 1).fillRect(cx, cy, 4, 4);
      corner(x, y, !pit(tx - 1, ty) && !pit(tx, ty - 1));
      corner(x + tile - 4, y, !pit(tx + 1, ty) && !pit(tx, ty - 1));
      corner(x, y + tile - 4, !pit(tx - 1, ty) && !pit(tx, ty + 1));
      corner(x + tile - 4, y + tile - 4, !pit(tx + 1, ty) && !pit(tx, ty + 1));
    }
  }
}
