// Árbol de mejoras (supervisor): nodos con la banda del color de su rama (comprados, disponibles, bloqueados con
// candado, finales con corona) y ramas de píxel con codo por las que corre un flujo de luz cuando el padre está
// comprado. Los disponibles laten. Solo dibujo: costes y compras en UpgradeScene / data/upgradeTree.
import type Phaser from 'phaser';
import { COLORS } from '../theme';
import { darkOf, lightOf, mixColor } from './pixelFx';
import { OUT, live, stamp, twinkle } from './menuArt';

/** Color de cada rama (ataque, defensa, botín, utilidad). */
export const BRANCH_COLORS: Record<string, number> = { attack: 0xe0533a, defense: 0x3b82d6, loot: 0xe0a923, utility: 0x45b36b };

export type TreeNodeLook = 'locked' | 'available' | 'owned' | 'max';

const LOCK = ['.kkk.', 'k...k', 'k...k', 'kkkkk', 'kGGGk', 'kGkGk', 'kkkkk'];
const CROWN = ['k.k.k', 'kGkGk', 'kGGGk', 'kkkkk'];

/** Nodo del árbol (x, y = centro). Los niveles van en casillas de píxel abajo. */
export function drawTreeNode(
  g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number,
  o: { look: TreeNodeLook; sel: boolean; final: boolean; color: number; lv: number; max: number },
) {
  const l = x - w / 2;
  const t = y - h / 2;
  const u = 4;
  const locked = o.look === 'locked';
  const fill = o.sel ? COLORS.gold : locked ? 0xb9bfcc : o.look === 'max' ? mixColor(o.color, 0xffffff, 0.72) : o.look === 'owned' ? mixColor(o.color, 0xffffff, 0.82) : COLORS.panel;
  const rim = locked ? 0x5f6b7a : o.color;
  // Sombra y borde doble con esquinas escalonadas
  g.fillStyle(0x000000, 0.3).fillRect(l + 4, t + 6, w, h);
  const block = (i: number, c: number) => {
    g.fillStyle(c, 1).fillRect(l + i + u, t + i, w - 2 * (i + u), h - 2 * i).fillRect(l + i, t + i + u, w - 2 * i, h - 2 * (i + u));
  };
  block(0, OUT);
  block(u, o.sel ? 0xc99a1e : rim);
  block(u * 2, fill);
  // Banda superior del color de la rama
  g.fillStyle(locked ? 0x8d95a5 : o.color, 1).fillRect(l + 8, t + 8, w - 16, 4);
  g.fillStyle(locked ? 0xb9bfcc : lightOf(o.color), 1).fillRect(l + 8, t + 8, w - 16, 2);
  // Esquina: candado, corona o marca de comprado
  if (locked) stamp(g, l + 8, t + 18, LOCK, { k: OUT, G: 0x8d95a5 }, 3);
  if (o.final) stamp(g, x - 8, t - 12, CROWN, { k: OUT, G: locked ? 0x9aa5b1 : 0xffd34d }, 4);
  // Niveles: casillas de píxel
  const cw = Math.min(14, (w - 16) / o.max - 3);
  const left = x - (o.max * (cw + 3) - 3) / 2;
  for (let k = 0; k < o.max; k++) {
    const on = k < o.lv;
    g.fillStyle(OUT, 1).fillRect(left + k * (cw + 3) - 1, y - 1, cw + 2, 11);
    g.fillStyle(on ? COLORS.hpGreen : COLORS.hpTrack, 1).fillRect(left + k * (cw + 3), y, cw, 9);
    if (on) g.fillStyle(0xb8f0c8, 1).fillRect(left + k * (cw + 3), y, cw, 2);
  }
}

export interface TreeLink {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  on: boolean;
  color: number;
}
export interface TreeHalo {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  sel: boolean;
}

/**
 * Ramas (con codo) y halos de los nodos disponibles en un Graphics vivo. `set` cambia lo que se dibuja; la luz corre
 * por las ramas encendidas de padre a hijo.
 */
export function addTreeLinks(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics) {
  let links: TreeLink[] = [];
  let halos: TreeHalo[] = [];
  const path = (a: TreeLink) => {
    const my = Math.round((a.y1 + a.y2) / 2 / 2) * 2;
    return [
      [a.x1, a.y1, a.x1, my],
      [a.x1, my, a.x2, my],
      [a.x2, my, a.x2, a.y2],
    ] as const;
  };
  const seg = (x1: number, y1: number, x2: number, y2: number, w: number, c: number) => {
    g.fillStyle(c, 1).fillRect(Math.min(x1, x2) - w / 2, Math.min(y1, y2) - w / 2, Math.abs(x2 - x1) + w, Math.abs(y2 - y1) + w);
  };
  const paint = (t: number) => {
    for (const h of halos) {
      const k = 0.5 + 0.5 * Math.sin(t / 240);
      g.fillStyle(h.color, 0.18 + 0.22 * k).fillRect(h.x - h.w / 2 - 6, h.y - h.h / 2 - 6, h.w + 12, h.h + 12);
      if (h.sel) twinkle(g, h.x + h.w / 2 - 2, h.y - h.h / 2 + 2, 0xffffff, k, 2);
    }
    for (const a of links) {
      const parts = path(a);
      for (const p of parts) seg(p[0], p[1], p[2], p[3], 10, OUT);
      for (const p of parts) seg(p[0], p[1], p[2], p[3], 4, a.on ? darkOf(a.color) : COLORS.hpTrack);
      if (!a.on) continue;
      for (const p of parts) seg(p[0], p[1], p[2], p[3], 2, a.color);
      // Pulsos de luz que bajan por la rama
      const len = parts.reduce((s, p) => s + Math.abs(p[2] - p[0]) + Math.abs(p[3] - p[1]), 0);
      for (let q = 0; q < 2; q++) {
        let d = (((t / 900 + q / 2) % 1) * len);
        for (const p of parts) {
          const l = Math.abs(p[2] - p[0]) + Math.abs(p[3] - p[1]);
          if (d <= l) {
            const f = l ? d / l : 0;
            const px = Math.round((p[0] + (p[2] - p[0]) * f) / 2) * 2;
            const py = Math.round((p[1] + (p[3] - p[1]) * f) / 2) * 2;
            g.fillStyle(lightOf(a.color), 1).fillRect(px - 4, py - 4, 8, 8);
            g.fillStyle(0xffffff, 1).fillRect(px - 2, py - 2, 4, 4);
            break;
          }
          d -= l;
        }
      }
    }
  };
  live(scene, g, paint, 60);
  return {
    set(l: TreeLink[], h: TreeHalo[]) {
      links = l;
      halos = h;
      g.clear();
      paint(scene.time.now);
    },
  };
}
