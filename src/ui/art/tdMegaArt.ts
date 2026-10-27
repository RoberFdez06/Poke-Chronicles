// Arte de la megaevolución de las torres (Defensa de torres, nivel 6): el destello de la transformación (la crisálida
// y el símbolo mega de megaFx, más pequeños para una casilla) y el aura mega que llevan siempre: aro de tres colores a
// los pies que gira, chispas mega que suben y el símbolo mega flotando sobre la cabeza. Píxel gordo; con pocos efectos
// (lowFx) queda quieto. Solo dibujo: la lógica está en src/data/towerDefense/towers.ts y engine.ts.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { drawMegaSymbol, playerMegaFx } from './megaFx';
import { lightOf } from './pixelFx';

type G = Phaser.GameObjects.Graphics;
const OUT = 0x18202c;
/** Los tres colores mega (los mismos que el símbolo de megaFx). */
const MEGA_COLS = [0xff9a3c, 0xff5ab4, 0x4ad0ff] as const;
const P = 3;
const snap = (v: number) => Math.round(v / P) * P;
const px = (g: G, c: number, x: number, y: number, a = 1, s = P) => g.fillStyle(c, a).fillRect(snap(x) - s / 2, snap(y) - s / 2, s, s);

/** Destello de la megaevolución de una torre: el de megaFx (piedra, rayos, crisálida y símbolo). Devuelve los ms. */
export function towerMegaFx(scene: Phaser.Scene, x: number, y: number, feetY: number, color: number, depth = 40): number {
  return playerMegaFx(scene, x, y, feetY, color, depth);
}

/**
 * Aura mega de una torre de nivel 6 (se llama cada fotograma en la capa de torres): aro tricolor a los pies con un
 * brillo que da vueltas, chispas de los tres colores que suben en espiral y el símbolo mega latiendo sobre la cabeza.
 */
export function drawMegaAura(g: G, x: number, y: number, color: number, t: number) {
  const still = lowFx();
  const tt = still ? 0 : t;
  // Aro a los pies: elipse de píxeles en tres arcos de color con contorno oscuro
  const n = 22;
  const head = still ? -1 : Math.floor((t / 70) % n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + tt / 900;
    const ex = x + Math.cos(a) * 25;
    const ey = y + Math.sin(a) * 9;
    px(g, OUT, ex, ey + 1, 0.55, P + 2);
    const near = head >= 0 && (i - head + n) % n < 3;
    px(g, near ? 0xffffff : MEGA_COLS[Math.floor((i / n) * 3)], ex, ey, 0.95);
  }
  // Chispas que suben en espiral (de los tres colores y del tipo)
  const k = 9;
  for (let i = 0; i < k; i++) {
    const up = still ? (i / k) * 0.6 : ((t / 1100 + i / k) % 1);
    const a = (i / k) * Math.PI * 2 + up * 3 + tt / 500;
    const c = i % 4 === 3 ? lightOf(color) : MEGA_COLS[i % 3];
    px(g, c, x + Math.cos(a) * (20 - up * 8), y - 6 + Math.sin(a) * 6 - up * 52, 1 - up * 0.85, up < 0.4 ? P + 1 : P);
  }
  // Halo suave del color del tipo que late
  if (!still) {
    const pulse = (Math.sin(t / 260) + 1) / 2;
    g.fillStyle(color, 0.08 + 0.08 * pulse).fillEllipse(x, y - 20, 50, 54);
  }
  // Símbolo mega sobre la cabeza, flotando
  const bob = still ? 0 : Math.round(Math.sin(t / 300) * 2);
  drawMegaSymbol(g, x + 20, y - 62 + bob, 12, tt, 0.95, 3);
}
