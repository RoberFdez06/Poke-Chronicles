// Arte de la Defensa de torres más retadora (todo pixel art propio, sin emojis): terreno especial de cada nivel
// (colina, cristal, lodazal, barro y corriente), rutas selladas o con barricada, trampas del camino (mina y
// telaraña), enlaces de sinergia entre torres (y el Dúo, más vistoso) y las marcas de los enemigos con truco. Con
// pocos efectos (lowFx) queda quieto. Solo dibujo: la partida es src/data/towerDefense/engine.ts.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { darkOf, lightOf } from './pixelFx';
import type { MapGeom } from './tdArt';
import type { TerrainCell } from '../../data/towerDefense/variants';
import type { TrapKind } from '../../data/towerDefense/live';

type G = Phaser.GameObjects.Graphics;
const OUT = 0x18202c;
const P = 3;
const snap = (v: number) => Math.round(v / P) * P;
const px = (g: G, c: number, x: number, y: number, w = P, h = P, a = 1) => g.fillStyle(c, a).fillRect(snap(x), snap(y), w, h);

/** Terreno especial (fijo, se hornea con el suelo). */
export function drawTerrain(g: G, cells: readonly TerrainCell[], geo: MapGeom) {
  const S = geo.cell;
  for (const q of cells) {
    const X = geo.ox + q.x * S;
    const Y = geo.oy + q.y * S;
    if (q.kind === 'alto') {
      // Colina: loma de hierba con escalones y cima clara
      g.fillStyle(0x3a6a2a, 1).fillRect(X + P * 2, Y + P * 9, S - P * 4, P * 5);
      g.fillStyle(0x5a9a3a, 1).fillRect(X + P * 3, Y + P * 6, S - P * 6, P * 4);
      g.fillStyle(0x8fd06a, 1).fillRect(X + P * 5, Y + P * 4, S - P * 10, P * 3);
      g.fillStyle(0xc8f0a0, 1).fillRect(X + P * 6, Y + P * 4, P * 2, P);
      g.fillStyle(OUT, 0.5).fillRect(X + P * 2, Y + P * 14, S - P * 4, P);
    } else if (q.kind === 'cristal') {
      // Cristales que salen del suelo
      g.fillStyle(0x2e6ab0, 1).fillRect(X + P * 3, Y + P * 8, P * 3, P * 6).fillRect(X + P * 10, Y + P * 7, P * 3, P * 7);
      g.fillStyle(0x5ab4ff, 1).fillRect(X + P * 6, Y + P * 4, P * 4, P * 10);
      g.fillStyle(0x8fe0ff, 1).fillRect(X + P * 7, Y + P * 3, P * 2, P * 8).fillRect(X + P * 4, Y + P * 8, P, P * 4).fillRect(X + P * 11, Y + P * 7, P, P * 4);
      g.fillStyle(0xffffff, 1).fillRect(X + P * 7, Y + P * 4, P, P * 3);
    } else if (q.kind === 'lodo') {
      // Lodazal: charco marrón con burbujas
      g.fillStyle(0x4a3420, 1).fillRect(X + P * 2, Y + P * 5, S - P * 4, P * 8);
      g.fillStyle(0x8a6a3a, 1).fillRect(X + P * 3, Y + P * 6, S - P * 6, P * 6);
      g.fillStyle(0xa8875a, 1).fillRect(X + P * 4, Y + P * 7, P * 2, P).fillRect(X + P * 10, Y + P * 10, P * 2, P);
      g.fillStyle(0x4a3420, 1).fillRect(X + P * 7, Y + P * 8, P, P).fillRect(X + P * 12, Y + P * 7, P, P);
    } else if (q.kind === 'barro') {
      // Barro en el camino: manchas oscuras y huellas
      g.fillStyle(0x4a3420, 0.75).fillRect(X + P * 2, Y + P * 3, P * 5, P * 4).fillRect(X + P * 9, Y + P * 9, P * 5, P * 4).fillRect(X + P * 4, Y + P * 10, P * 3, P * 3);
      g.fillStyle(0x6a4a2a, 0.9).fillRect(X + P * 10, Y + P * 3, P * 3, P * 2).fillRect(X + P * 3, Y + P * 4, P * 2, P);
    } else {
      // Corriente: rayas claras de viento o agua que empujan
      g.fillStyle(0xc8f0ff, 0.8);
      for (let i = 0; i < 3; i++) g.fillRect(X + P * (2 + i * 4), Y + P * (3 + i * 4), P * 5, P).fillRect(X + P * (5 + i * 4), Y + P * (4 + i * 4), P * 2, P);
    }
  }
}

/** Ruta cerrada: sellada con rocas (aún no se ha abierto) o barricada de madera (cerrada por ti, con oleadas que le quedan). */
export function drawGate(g: G, cx: number, cy: number, state: 'sealed' | 'barricade', left: number, t: number) {
  const x = cx - 24;
  const y = cy - 24;
  if (state === 'sealed') {
    g.fillStyle(OUT, 1).fillRect(x + 4, y + 18, 40, 24);
    g.fillStyle(0x6a7080, 1).fillRect(x + 6, y + 22, 16, 18).fillRect(x + 22, y + 20, 20, 20);
    g.fillStyle(0x9aa0ac, 1).fillRect(x + 8, y + 22, 10, 4).fillRect(x + 24, y + 20, 12, 4);
    g.fillStyle(0x3a4050, 1).fillRect(x + 20, y + 30, 3, 10);
    // Grietas que laten: se va a abrir
    if (!lowFx()) {
      const k = (Math.sin(t / 260) + 1) / 2;
      g.fillStyle(0xb08aff, 0.3 + 0.5 * k).fillRect(x + 14, y + 28, 3, 6).fillRect(x + 30, y + 26, 3, 8);
    }
    return;
  }
  // Barricada: dos postes y tablas cruzadas
  g.fillStyle(OUT, 1).fillRect(x + 4, y + 10, 40, 32);
  g.fillStyle(0x6a4a2a, 1).fillRect(x + 6, y + 12, 6, 28).fillRect(x + 36, y + 12, 6, 28);
  g.fillStyle(0xb8864a, 1).fillRect(x + 6, y + 18, 36, 6).fillRect(x + 6, y + 30, 36, 6);
  g.fillStyle(0xd8a868, 1).fillRect(x + 6, y + 18, 36, 2).fillRect(x + 6, y + 30, 36, 2);
  g.fillStyle(0xe53935, 1).fillRect(x + 20, y + 22, 8, 10);
  g.fillStyle(0xffffff, 1).fillRect(x + 22, y + 24, 4, 2);
  // Oleadas que le quedan: puntitos
  for (let i = 0; i < left; i++) g.fillStyle(OUT, 1).fillRect(x + 16 + i * 10, y + 4, 8, 6).fillStyle(0xffd34d, 1).fillRect(x + 17 + i * 10, y + 5, 6, 4);
}

/** Trampa colocada en el camino. */
export function drawTrap(g: G, cx: number, cy: number, kind: TrapKind, uses: number, t: number) {
  if (kind === 'mina') {
    const blink = lowFx() || Math.floor(t / 300) % 2 === 0;
    g.fillStyle(OUT, 1).fillRect(cx - 11, cy - 5, 22, 13);
    g.fillStyle(0x4a5060, 1).fillRect(cx - 9, cy - 3, 18, 9);
    g.fillStyle(0x7a8494, 1).fillRect(cx - 9, cy - 3, 18, 3);
    g.fillStyle(blink ? 0xff3b30 : 0x7a2020, 1).fillRect(cx - 2, cy - 7, 4, 4);
    return;
  }
  // Telaraña: hilos en estrella y anillos
  const c = 0xe8ecf4;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    for (let r = -14; r <= 14; r += 3) px(g, c, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6, 2, 2, 0.85);
  }
  g.lineStyle(1, c, 0.7).strokeEllipse(cx, cy, 16, 10).strokeEllipse(cx, cy, 26, 16);
  for (let i = 0; i < uses; i++) g.fillStyle(OUT, 1).fillRect(cx - 10 + i * 6, cy + 10, 5, 5).fillStyle(c, 1).fillRect(cx - 9 + i * 6, cy + 11, 3, 3);
}

/** Enlace de sinergia entre dos torres: puntos del color del combo que avanzan; el Dúo, doble y dorado. */
export function drawLink(g: G, x1: number, y1: number, x2: number, y2: number, color: number, duo: boolean, t: number) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(3, Math.floor(d / 7));
  const still = lowFx();
  const head = still ? -1 : Math.floor(t / 90) % n;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const on = i === head || i === (head + Math.floor(n / 2)) % n;
    const c = on ? 0xffffff : duo ? (i % 2 ? 0xffd34d : color) : color;
    px(g, OUT, x1 + (x2 - x1) * k - 1, y1 + (y2 - y1) * k - 1, P + 2, P + 2, 0.6);
    px(g, c, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, P, P, duo ? 1 : 0.85);
  }
  if (duo && !still) {
    const p = (Math.sin(t / 200) + 1) / 2;
    g.fillStyle(0xffd34d, 0.15 + 0.15 * p).fillCircle((x1 + x2) / 2, (y1 + y2) / 2, 8 + p * 4);
  }
}

/** Distintivo del combo sobre una torre: rombo pequeño del color (dorado si es Dúo). */
export function drawSynergyGem(g: G, x: number, y: number, color: number, duo: boolean) {
  g.fillStyle(OUT, 1).fillRect(x - 5, y - 2, 10, 4).fillRect(x - 2, y - 5, 4, 10).fillRect(x - 4, y - 4, 8, 8);
  g.fillStyle(duo ? 0xffd34d : color, 1).fillRect(x - 3, y - 1, 6, 2).fillRect(x - 1, y - 3, 2, 6).fillRect(x - 2, y - 2, 4, 4);
  g.fillStyle(0xffffff, 1).fillRect(x - 1, y - 2, 1, 1);
}

/** Marcas de los enemigos con truco (se dibujan junto a su barra de vida o alrededor). */
export function drawTrickMark(g: G, kind: string, x: number, y: number, sprX: number, sprY: number, t: number, color = 0xffffff) {
  const still = lowFx();
  if (kind === 'dodger') {
    // Estelas: copias desplazadas que parpadean
    if (!still) {
      const k = Math.floor(t / 120) % 3;
      g.fillStyle(0xf0f0ff, 0.35).fillRect(sprX - 18 - k * 2, sprY - 8, 4, 14).fillRect(sprX + 14 + k * 2, sprY - 8, 4, 14);
    }
    g.fillStyle(OUT, 1).fillRect(x - 12, y - 3, 10, 9);
    g.fillStyle(0xffffff, 1).fillRect(x - 11, y - 2, 2, 7).fillRect(x - 8, y - 1, 2, 5).fillRect(x - 5, y, 2, 3);
  } else if (kind === 'saboteur') {
    // Llave inglesa roja
    g.fillStyle(OUT, 1).fillRect(x - 12, y - 4, 11, 11);
    g.fillStyle(0xff5a4a, 1).fillRect(x - 11, y - 3, 3, 3).fillRect(x - 6, y - 3, 3, 3).fillRect(x - 10, y - 1, 6, 2).fillRect(x - 8, y + 1, 2, 5);
  } else if (kind === 'splitter') {
    // Dos bolitas (se parte en dos)
    g.fillStyle(OUT, 1).fillRect(x - 13, y - 3, 12, 8);
    g.fillStyle(0x7cf07a, 1).fillRect(x - 12, y - 2, 4, 6).fillRect(x - 6, y - 2, 4, 6);
  } else if (kind === 'adapter') {
    // Anillo del color del tipo que resiste
    const p = still ? 0.6 : 0.45 + 0.35 * Math.sin(t / 180);
    g.lineStyle(2, color, p).strokeEllipse(sprX, sprY + 6, 38, 16);
    g.fillStyle(OUT, 1).fillRect(x - 12, y - 3, 10, 10);
    g.fillStyle(color, 1).fillRect(x - 11, y - 2, 8, 8);
    g.fillStyle(darkOf(color), 1).fillRect(x - 11, y + 4, 8, 2);
    g.fillStyle(lightOf(color), 1).fillRect(x - 10, y - 1, 2, 2);
  }
}
