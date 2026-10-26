// Marco de la elección de objetos (supervisor): cuadro con borde de hierro remachado y brasa encendida. En la forja,
// un yunque a cada lado de la cabecera con un martillo que golpea y suelta chispas; con los huecos llenos, tres huecos
// de objeto dibujados (el último late porque no cabe). Solo dibujo: la lista sigue en ItemChoiceScene.
import type Phaser from 'phaser';
import { drawBox } from '../theme';
import { OUT, live, stamp, twinkle } from './menuArt';

const IRON = 0x4a5160;
const IRON_L = 0x8a93a6;
const EMBER = 0xe67e22;

const ANVIL = [
  'kkkkkkkkkkkk....',
  'kIIIIIIIIIIIkkk.',
  'kLLLLLLLLLLLLLLk',
  '.kIIIIIIIIIIIkk.',
  '...kkIIIIIkk....',
  '....kIIIIIk.....',
  '...kIIIIIIIk....',
  '..kkkkkkkkkkk...',
];
const HAMMER = ['kkkkk', 'kMMMk', 'kMMMk', 'kkkkk', '.kWk.', '.kWk.', '.kWk.', '.kWk.', '.kkk.'];

function anvil(g: Phaser.GameObjects.Graphics, x: number, y: number, t: number, flip: boolean) {
  stamp(g, x - 32, y - 8, ANVIL, { k: OUT, I: IRON, L: IRON_L }, 4);
  // Martillo: sube y baja de golpe cada 1,2 s
  const ph = (t / 1200 + (flip ? 0.5 : 0)) % 1;
  const lift = ph < 0.75 ? Math.round((ph / 0.75) * 3) * 4 : Math.round(((1 - ph) / 0.25) * 3) * 4;
  stamp(g, x - 4 + (flip ? -10 : 10), y - 46 - lift, HAMMER, { k: OUT, M: 0x6b7385, W: 0x9a6b3c }, 4);
  if (ph < 0.18) {
    const k = ph / 0.18;
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + (i / 5) * Math.PI;
      twinkle(g, x + 4 + Math.cos(a) * (6 + k * 26), y - 10 + Math.sin(a) * (4 + k * 16), i % 2 ? 0xffd34d : EMBER, 1 - k, 2);
    }
  }
}

function slots(g: Phaser.GameObjects.Graphics, x: number, y: number, t: number) {
  for (let i = 0; i < 3; i++) {
    const sx = x - 36 + i * 26;
    const full = i < 2 || Math.floor(t / 400) % 2 === 0;
    g.fillStyle(OUT, 1).fillRect(sx - 11, y - 11, 22, 22);
    g.fillStyle(i === 2 ? 0xe0533a : IRON_L, 1).fillRect(sx - 9, y - 9, 18, 18);
    g.fillStyle(0x2b3a67, 1).fillRect(sx - 7, y - 7, 14, 14);
    if (full) g.fillStyle(i === 2 ? 0xff9a8a : 0xffd34d, 1).fillRect(sx - 4, y - 4, 8, 8);
  }
}

/** Marco completo (x, y, w, h como drawBox) con la cabecera según `title`. Devuelve el Graphics vivo de los adornos. */
export function addForgeFrame(scene: Phaser.Scene, x: number, y: number, w: number, h: number, title: string) {
  const base = scene.add.graphics();
  // Borde de hierro con remaches, luego el cuadro del tema dentro
  base.fillStyle(0x000000, 0.35).fillRect(x + 6, y + 8, w, h);
  base.fillStyle(OUT, 1).fillRect(x - 8, y - 4, w + 16, h + 8).fillRect(x - 4, y - 8, w + 8, h + 16);
  base.fillStyle(IRON, 1).fillRect(x - 4, y - 4, w + 8, h + 8);
  base.fillStyle(IRON_L, 1).fillRect(x - 4, y - 4, w + 8, 3);
  for (let k = 0; k <= 10; k++) {
    for (const yy of [y - 1, y + h + 1]) {
      const rx = x + 10 + (k * (w - 20)) / 10;
      base.fillStyle(OUT, 1).fillRect(rx - 3, yy - 3, 6, 6);
      base.fillStyle(0xc9d2e0, 1).fillRect(rx - 2, yy - 2, 3, 3);
    }
  }
  drawBox(base, x, y, w, h, { radius: 16, border: EMBER });
  const forge = /forja/i.test(title);
  const deco = scene.add.graphics();
  return live(scene, deco, (t) => {
    // Brasa: la línea naranja interior respira
    const k = 0.5 + 0.5 * Math.sin(t / 380);
    deco.fillStyle(0xffb347, 0.35 * k).fillRect(x + 4, y + 4, w - 8, 3).fillRect(x + 4, y + h - 7, w - 8, 3);
    if (forge) {
      anvil(deco, x + 60, y + 36, t, false);
      anvil(deco, x + w - 60, y + 36, t, true);
    } else {
      slots(deco, x + 80, y + 34, t);
      slots(deco, x + w - 66, y + 34, t);
    }
  }, 70);
}
