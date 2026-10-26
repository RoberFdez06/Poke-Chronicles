// Código de semilla (supervisor): casillas como ranuras de un lector con placa crema, cursor que parpadea con una
// flecha que bota, teclas con relieve (se hunden al pasar el ratón), panel de la partida con cinta de color según el
// estado y el «billete» del código (Pausa y Resumen) con un brillo que lo recorre. Solo dibujo.
import type Phaser from 'phaser';
import { COLORS } from '../theme';
import { darkOf, lightOf } from './pixelFx';
import { OUT, live, twinkle } from './menuArt';

/** Ranura del código (x, y = centro). `group` colorea la pestaña de arriba (cada grupo de 4 letras, un color). */
export function drawCodeSlot(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, o: { filled: boolean; cursor: boolean; group: number; bad?: boolean }) {
  const l = x - w / 2;
  const t = y - h / 2;
  const tabs = [0x3b82d6, 0xe0533a, 0x45b36b];
  g.fillStyle(0x000000, 0.35).fillRect(l + 3, t + 5, w, h);
  g.fillStyle(OUT, 1).fillRect(l, t + 4, w, h - 8).fillRect(l + 4, t, w - 8, h);
  g.fillStyle(o.cursor ? 0xc99a1e : 0x8fa6d8, 1).fillRect(l + 4, t + 4, w - 8, h - 8);
  const fill = o.bad ? 0xf6c9c4 : o.cursor ? COLORS.goldSoft : o.filled ? COLORS.panel : 0xdfe4ee;
  g.fillStyle(fill, 1).fillRect(l + 8, t + 8, w - 16, h - 16);
  // Hundido: sombra arriba, brillo abajo
  g.fillStyle(darkOf(fill), 1).fillRect(l + 8, t + 8, w - 16, 4);
  g.fillStyle(0xffffff, 0.8).fillRect(l + 8, t + h - 12, w - 16, 2);
  // Pestaña del grupo
  g.fillStyle(tabs[o.group % tabs.length], 1).fillRect(x - 8, t - 2, 16, 4);
  if (!o.filled) g.fillStyle(0x9aa5b1, 1).fillRect(x - 6, y + 8, 12, 4);
}

/** Cursor vivo: flecha que bota bajo la casilla y borde que parpadea. `move` lo cambia de sitio. */
export function addCodeCursor(scene: Phaser.Scene, w: number, h: number) {
  const g = scene.add.graphics();
  let x = -999;
  let y = -999;
  const paint = (t: number) => {
    const on = Math.floor(t / 380) % 2 === 0;
    if (on) {
      g.fillStyle(COLORS.gold, 1);
      g.fillRect(x - w / 2 - 6, y - h / 2 - 6, w + 12, 4).fillRect(x - w / 2 - 6, y + h / 2 + 2, w + 12, 4);
      g.fillRect(x - w / 2 - 6, y - h / 2 - 6, 4, h + 12).fillRect(x + w / 2 + 2, y - h / 2 - 6, 4, h + 12);
    }
    const bob = Math.round(Math.sin(t / 160)) * 2;
    const ay = y + h / 2 + 12 + bob;
    g.fillStyle(OUT, 1).fillRect(x - 10, ay - 2, 20, 4).fillRect(x - 6, ay - 6, 12, 4).fillRect(x - 2, ay - 10, 4, 4);
    g.fillStyle(COLORS.gold, 1).fillRect(x - 6, ay - 2, 12, 2).fillRect(x - 2, ay - 6, 4, 4);
  };
  live(scene, g, paint, 80);
  return {
    move(nx: number, ny: number) {
      x = nx;
      y = ny;
      g.clear();
      paint(scene.time.now);
    },
  };
}

/** Tecla con relieve (x, y = centro). `down`: hundida (ratón encima). `kind` cambia el color de las de acción. */
export function drawKeyCap(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, down: boolean, kind: 'letter' | 'erase' | 'paste' | 'play' = 'letter') {
  const face = kind === 'play' ? 0x6fd27f : kind === 'erase' ? 0xf0a090 : kind === 'paste' ? 0x9fc4f0 : COLORS.panel;
  const l = x - w / 2;
  const t = y - h / 2;
  const lift = down ? 2 : 6;
  g.clear();
  g.fillStyle(0x000000, 0.35).fillRect(l + 2, t + 6, w, h);
  g.fillStyle(OUT, 1).fillRect(l + 4, t, w - 8, h).fillRect(l, t + 4, w, h - 8);
  g.fillStyle(darkOf(face), 1).fillRect(l + 4, t + 4, w - 8, h - 8);
  g.fillStyle(face, 1).fillRect(l + 4, t + 4 + (6 - lift), w - 8, h - 8 - 6);
  g.fillStyle(lightOf(face), 1).fillRect(l + 6, t + 6 + (6 - lift), w - 12, 2);
  if (down) g.fillStyle(COLORS.gold, 1).fillRect(l + 6, t + h - 10, w - 12, 2);
}

export type CodePanelState = 'empty' | 'error' | 'ok';

/** Panel de la partida: caja del tema con cinta de color y muescas de billete a los lados. */
export function drawCodePanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, state: CodePanelState) {
  const band = state === 'ok' ? 0x45b36b : state === 'error' ? 0xe0533a : 0x8fa6d8;
  g.clear();
  g.fillStyle(0x000000, 0.3).fillRect(x + 4, y + 6, w, h);
  g.fillStyle(OUT, 1).fillRect(x + 4, y, w - 8, h).fillRect(x, y + 4, w, h - 8);
  g.fillStyle(band, 1).fillRect(x + 4, y + 4, w - 8, h - 8);
  g.fillStyle(COLORS.panel, 1).fillRect(x + 8, y + 16, w - 16, h - 24);
  g.fillStyle(lightOf(band), 1).fillRect(x + 8, y + 6, w - 16, 2);
  // Muescas del billete
  for (const sx of [x, x + w]) {
    g.fillStyle(OUT, 1).fillRect(sx - 8, y + h / 2 - 12, 16, 24);
    g.fillStyle(COLORS.bg, 1).fillRect(sx - 6, y + h / 2 - 10, 12, 20);
  }
  // Línea de puntos (troquel)
  for (let yy = y + 22; yy < y + h - 14; yy += 10) g.fillStyle(0xc9cfdb, 1).fillRect(x + w - 52, yy, 2, 5);
  // Sello del estado en el talón
  const sx = x + w - 28;
  const sy = y + h / 2;
  g.fillStyle(OUT, 1).fillRect(sx - 14, sy - 14, 28, 28);
  g.fillStyle(band, 1).fillRect(sx - 12, sy - 12, 24, 24);
  g.fillStyle(0xffffff, 1);
  if (state === 'ok') g.fillRect(sx - 8, sy, 4, 4).fillRect(sx - 4, sy + 4, 4, 4).fillRect(sx, sy, 4, 4).fillRect(sx + 4, sy - 4, 4, 4).fillRect(sx + 8, sy - 8, 4, 4);
  else if (state === 'error') for (let k = -2; k <= 2; k++) g.fillRect(sx + k * 3 - 2, sy + k * 3 - 2, 4, 4).fillRect(sx - k * 3 - 2, sy + k * 3 - 2, 4, 4);
  else g.fillRect(sx - 8, sy - 2, 4, 4).fillRect(sx - 2, sy - 2, 4, 4).fillRect(sx + 4, sy - 2, 4, 4);
}

/** Billete del código (x, y = centro, w × h) con brillo que lo recorre. Vivo. */
export function addCodeTicket(scene: Phaser.Scene, x: number, y: number, w: number, h: number, g = scene.add.graphics()) {
  const l = Math.round(x - w / 2);
  const t = Math.round(y - h / 2);
  return live(scene, g, (time) => {
    g.fillStyle(0x000000, 0.25).fillRect(l + 3, t + 4, w, h);
    g.fillStyle(OUT, 1).fillRect(l, t, w, h);
    g.fillStyle(0xc99a1e, 1).fillRect(l + 2, t + 2, w - 4, h - 4);
    g.fillStyle(0xfff1b8, 1).fillRect(l + 5, t + 5, w - 10, h - 10);
    // Muescas
    for (const sx of [l, l + w]) {
      g.fillStyle(OUT, 1).fillRect(sx - 4, y - 6, 8, 12);
      g.fillStyle(COLORS.panel, 1).fillRect(sx - 2, y - 4, 4, 8);
    }
    // Brillo en diagonal que cruza el billete cada poco
    const k = ((time / 2400) % 1) * 1.6 - 0.3;
    const bx = l + k * w;
    if (bx > l + 6 && bx < l + w - 16) {
      g.fillStyle(0xffffff, 0.7).fillRect(Math.round(bx / 2) * 2, t + 5, 6, h - 10);
      g.fillStyle(0xffffff, 0.4).fillRect(Math.round(bx / 2) * 2 + 8, t + 5, 3, h - 10);
    }
    if (k > 1.1) twinkle(g, l + w - 10, t + 6, 0xffd34d, 1, 2);
  }, 70);
}
