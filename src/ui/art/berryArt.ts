// Bayas y parcelas del huerto (supervisor): cada baya con su forma, hoja y brillo propios (Aranja redonda con
// gajos y corona de hojas, Gonlan alargada con pinchos, Aslac en gota con hoja ancha y destello), la mata de
// cada baya sobre la base de drawPlant y la parcela de drawSoil con gotas de riego, brote que asoma y la baya
// madura que bota y brilla. Píxel gordo; con pocos efectos todo queda quieto. Solo dibujo.
import Phaser from 'phaser';
import type { GardenBerryId, Plot } from '../../data/berries';
import { GARDEN_BERRIES } from '../../data/berries';
import { lowFx } from '../theme';
import { darkOf, lightOf } from './pixelFx';
import { drawPlant, drawSoil } from './worldArt';

const OUT = 0x18202c;
const P = 4;
const cell = (g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, w = P, h = P) =>
  g.fillStyle(c, a).fillRect(Math.round(x), Math.round(y), w, h);

/** Paleta propia de cada baya (cuerpo, marca y hoja). */
const LOOK: Record<GardenBerryId, { body: number; mark: number; leaf: number }> = {
  aranja: { body: 0x4f8fe0, mark: 0x2c5aa8, leaf: 0x3f8f3a },
  gonlan: { body: 0x8e7cc3, mark: 0xd8c8ff, leaf: 0x5a7d3a },
  aslac: { body: 0x6ab04c, mark: 0xf2e05a, leaf: 0x2e7a46 },
};

/** ¿El píxel (dx, dy) cae dentro de la silueta de la baya (r = radio en celdas)? */
function inside(id: GardenBerryId, dx: number, dy: number, r: number): boolean {
  if (id === 'aranja') return Math.hypot(dx, dy * 1.08) <= r;
  if (id === 'gonlan') return Math.hypot(dx * 1.35, dy * 0.85) <= r;
  // Aslac: gota con la punta hacia abajo
  if (dy <= 0) return Math.hypot(dx, dy) <= r;
  return Math.abs(dx) <= r * (1 - dy / (r + 2.5)) && dy <= r + 1;
}

/** Baya del huerto centrada en (cx, cy); `size` = escala de celda (1 = semilla, 1.5 = planta madura). */
export function drawBerry(g: Phaser.GameObjects.Graphics, id: GardenBerryId, cx: number, cy: number, size = 1, t = 0) {
  const L = LOOK[id];
  const s = Math.max(2, Math.round(P * size / 2) * 2);
  const r = 3;
  const rows = id === 'aslac' ? 5 : 4;
  // Contorno y cuerpo con luz arriba-izquierda y sombra abajo-derecha
  for (let dy = -r - 1; dy <= rows; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
    if (!inside(id, dx, dy, r + 1) || inside(id, dx, dy, r)) continue;
    g.fillStyle(OUT, 1).fillRect(cx + dx * s - s / 2, cy + dy * s - s / 2, s, s);
  }
  for (let dy = -r; dy <= rows; dy++) for (let dx = -r; dx <= r; dx++) {
    if (!inside(id, dx, dy, r)) continue;
    const c = dx + dy < -2 ? lightOf(L.body) : dx + dy > 2 ? darkOf(L.body) : L.body;
    g.fillStyle(c, 1).fillRect(cx + dx * s - s / 2, cy + dy * s - s / 2, s, s);
  }
  // Marcas propias
  if (id === 'aranja') {
    for (const dy of [-1, 0, 1, 2]) g.fillStyle(L.mark, 1).fillRect(cx - s / 2, cy + dy * s - s / 2, s, s);
    g.fillStyle(L.mark, 1).fillRect(cx - 2 * s - s / 2, cy - s / 2, s, s * 2).fillRect(cx + 2 * s - s / 2, cy - s / 2, s, s * 2);
  } else if (id === 'gonlan') {
    for (const [dx, dy] of [[-3, 0], [3, 0], [-2, -3], [2, -3], [-2, 3], [2, 3]] as const)
      g.fillStyle(OUT, 1).fillRect(cx + dx * s * 1.1 - s / 2, cy + dy * s * 1.1 - s / 2, s, s);
    for (const [dx, dy] of [[-1, -1], [1, 1], [0, 2], [-1, 2]] as const) g.fillStyle(L.mark, 1).fillRect(cx + dx * s - s / 2, cy + dy * s - s / 2, s, s);
  } else {
    for (const [dx, dy] of [[-1, 0], [1, 1], [0, 2], [-2, -1]] as const) g.fillStyle(L.mark, 1).fillRect(cx + dx * s - s / 2, cy + dy * s - s / 2, s, s);
  }
  // Hoja / corona
  const top = cy - (r + 1) * s - s / 2;
  if (id === 'aranja') {
    for (const dx of [-1, 0, 1]) g.fillStyle(OUT, 1).fillRect(cx + dx * s - s / 2 - 1, top - s - 1, s + 2, s * (dx === 0 ? 2 : 1) + 2);
    for (const dx of [-1, 0, 1]) g.fillStyle(L.leaf, 1).fillRect(cx + dx * s - s / 2, top - (dx === 0 ? s : 0), s, s * (dx === 0 ? 2 : 1));
  } else if (id === 'gonlan') {
    g.fillStyle(OUT, 1).fillRect(cx - s / 2 - 1, top - s * 2 - 1, s + 2, s * 3 + 2);
    g.fillStyle(0x7a5230, 1).fillRect(cx - s / 2, top - s * 2, s, s * 3);
    g.fillStyle(L.leaf, 1).fillRect(cx + s / 2, top - s * 2, s * 2, s);
  } else {
    g.fillStyle(OUT, 1).fillRect(cx - s - 1, top - s - 1, s * 4 + 2, s * 2 + 2);
    g.fillStyle(L.leaf, 1).fillRect(cx - s, top - s, s * 4, s * 2);
    g.fillStyle(lightOf(L.leaf), 1).fillRect(cx, top - s, s * 2, s);
  }
  // Brillo propio: punto de luz (Aranja), centelleo que gira (Gonlan) o destello en cruz (Aslac)
  if (lowFx()) {
    g.fillStyle(0xffffff, 0.8).fillRect(cx - 2 * s - s / 2, cy - 2 * s - s / 2, s, s);
    return;
  }
  const w = 0.5 + 0.5 * Math.sin(t / 260);
  if (id === 'aranja') g.fillStyle(0xffffff, 0.5 + 0.5 * w).fillRect(cx - 2 * s - s / 2, cy - 2 * s - s / 2, s, s);
  else if (id === 'gonlan') {
    const a = t / 400;
    g.fillStyle(0xffffff, 0.8).fillRect(cx + Math.round(Math.cos(a) * 2) * s - s / 2, cy + Math.round(Math.sin(a) * 2) * s - s / 2, s, s);
  } else if (w > 0.6) {
    const x = cx - s * 2;
    const y = cy - s * 2;
    g.fillStyle(0xffffff, w).fillRect(x - s, y, s * 3, s).fillRect(x, y - s, s, s * 3);
  }
}

/** Parcela del huerto animada: tierra, riego mientras crece, brote que asoma y la mata con su baya. */
export function drawGardenPlot(g: Phaser.GameObjects.Graphics, cx: number, soilY: number, w: number, plot: Plot | null, ripe: boolean, t = 0) {
  const still = lowFx();
  drawSoil(g, cx - w / 2, soilY, w, 60);
  const baseY = soilY + 28;
  if (!plot) {
    // Surco vacío con una semilla que asoma de vez en cuando
    const peek = still ? 0 : Math.max(0, Math.sin(t / 900)) * P;
    cell(g, cx - 6, baseY - 4 - Math.round(peek / P) * P, 0xc8a46a, 1, 12, 8);
    cell(g, cx - 6, baseY - 4 - Math.round(peek / P) * P, OUT, 1, 12, 2);
    return;
  }
  const b = GARDEN_BERRIES[plot.berry];
  const grow = Math.min(1, Math.max(0.15, plot.runs / b.growRuns));
  // Tierra mojada bajo la mata
  g.fillStyle(0x4a3220, 0.6).fillRect(cx - 36, baseY - 6, 72, 12);
  drawPlant(g, cx, baseY, grow, false, b.color, t);
  const hgt = Math.max(8, Math.round(60 * grow));
  if (ripe) {
    const bob = still ? 0 : Math.round(Math.sin(t / 380) * 1.5) * 2;
    drawBerry(g, plot.berry, cx, baseY - hgt - 18 + bob, 2, t);
    if (!still) for (let k = 0; k < 4; k++) {
      const life = (t / 1600 + k * 0.25) % 1;
      cell(g, cx - 30 + k * 20, baseY - hgt - life * 50, k % 2 ? 0xffffff : lightOf(b.color), 1 - life);
    }
    return;
  }
  // Brote que asoma (una baya pequeña verde) y gotas de riego que caen
  drawBerry(g, plot.berry, cx + 10, baseY - hgt + 4, 0.6, t);
  if (still) return;
  for (let k = 0; k < 5; k++) {
    const life = (t / 900 + k * 0.2) % 1;
    const x = cx - 28 + k * 14;
    const y = soilY - 70 + life * 90;
    if (life < 0.85) cell(g, x, y, 0x7fc4ff, 0.9, P, P * 2);
    else cell(g, x - P, baseY - 2, 0xbfe4ff, 1 - (life - 0.85) / 0.15, P * 3, P);
  }
}

/** Monta la parcela como Graphics que se anima sola (se para al destruirse). */
export function addGardenPlot(scene: Phaser.Scene, cx: number, soilY: number, w: number, plot: Plot | null, ripe: boolean): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawGardenPlot(g, cx, soilY, w, plot, ripe, 0);
  if (lowFx()) return g;
  const t0 = scene.time.now;
  const ev = scene.time.addEvent({ delay: 70, loop: true, callback: () => {
    g.clear();
    drawGardenPlot(g, cx, soilY, w, plot, ripe, scene.time.now - t0);
  } });
  g.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove());
  return g;
}

/** Icono de semilla/baya animado para la lista de semillas. */
export function addBerryIcon(scene: Phaser.Scene, id: GardenBerryId, x: number, y: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawBerry(g, id, x, y, 1.2, 0);
  if (lowFx()) return g;
  const t0 = scene.time.now;
  const ev = scene.time.addEvent({ delay: 90, loop: true, callback: () => {
    g.clear();
    drawBerry(g, id, x, y, 1.2, scene.time.now - t0);
  } });
  g.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove());
  return g;
}
