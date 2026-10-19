// Marcos pixel para el HUD de la partida (supervisor): paneles oscuros semitransparentes con borde doble y
// remaches, ranuras de poder con franja del tipo y contadores con icono. Coordenadas reales de pantalla.
//
// Uso (en GameScene, franjas del HUD de layout.ts):
//   drawHudFrame(g, x, y, w, h);                        // panel
//   drawSlotFrame(g, x, y, w, h, typeColor(m.type), ready); // ranura de poder (apagada si recarga)
//   const c = addCounter(this, x, y, 'coin');  c.set(12);  // icono + número
import Phaser from 'phaser';
import { addIcon, type IconName } from './icons';
import { FONT } from '../theme';

const NAVY = 0x101828;
const EDGE = 0x3a4a7a;
const GOLD = 0xd4a017;
const GOLD_L = 0xffd34d;

/** Panel del HUD: fondo oscuro translúcido, borde doble (navy + oro) en escalones de 4 px y remaches. */
export function drawHudFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, accent = GOLD) {
  const u = 4;
  const r = (i: number, c: number, a = 1) => {
    g.fillStyle(c, a);
    g.fillRect(x + i + u, y + i, w - 2 * (i + u), h - 2 * i);
    g.fillRect(x + i, y + i + u, w - 2 * i, h - 2 * (i + u));
  };
  r(0, NAVY);
  r(u, accent);
  r(u * 2, EDGE);
  r(u * 3, 0x18213a, 0.92);
  g.fillStyle(0xffffff, 0.12).fillRect(x + u * 4, y + u * 3, w - u * 8, 2);
  // Remaches en las esquinas
  for (const [cx, cy] of [[x + 10, y + 10], [x + w - 14, y + 10], [x + 10, y + h - 14], [x + w - 14, y + h - 14]]) {
    g.fillStyle(GOLD_L, 1).fillRect(cx, cy, 4, 4);
  }
  return g;
}

/** Ranura de poder: marco con franja izquierda del color del tipo; apagada (gris) mientras recarga. */
export function drawSlotFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, typeCol: number, ready = true) {
  drawHudFrame(g, x, y, w, h, ready ? GOLD : 0x5a6280);
  g.fillStyle(ready ? typeCol : 0x5a6280, 1).fillRect(x + 16, y + 14, 8, h - 28);
  if (ready) g.fillStyle(0xffffff, 0.35).fillRect(x + 16, y + 14, 2, h - 28);
  return g;
}

/** Contador con icono pixel (monedas, llaves, bombas, tickets…). Devuelve un objeto con set(n). */
export function addCounter(scene: Phaser.Scene, x: number, y: number, icon: IconName, scale = 3, size = 30) {
  const img = addIcon(scene, x, y, icon, scale).setScrollFactor(0);
  const text = scene.add
    .text(x + 8 * scale + 10, y, '0', { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color: '#ffffff' })
    .setOrigin(0, 0.5)
    .setStroke('#101828', 6)
    .setScrollFactor(0);
  let last = -1;
  return {
    img,
    text,
    set(n: number) {
      if (n === last) return;
      // Salto pequeño al cambiar, para que se note
      if (last >= 0) scene.tweens.add({ targets: [img, text], scale: '+=0.15', duration: 90, yoyo: true });
      last = n;
      text.setText(String(n));
    },
    setDepth(d: number) {
      img.setDepth(d);
      text.setDepth(d);
      return this;
    },
  };
}
