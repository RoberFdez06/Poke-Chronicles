// Arte de los easter eggs (supervisor): el camión de la sala secreta, la figura glitch de MissingNo. (un bloque de
// ruido de colores, dibujo propio) y el destello de "error" de pantalla. Todo pixel art hecho con rectángulos.
import Phaser from 'phaser';

const K = 0x18202c;

/** Camioneta blanca y azul aparcada (unos 150×80 px). (x, y) = centro de la base. */
export function drawTruck(sc: Phaser.Scene, x: number, y: number) {
  const c = sc.add.container(x, y).setDepth(2);
  const g = sc.add.graphics();
  const P = 5;
  const r = (cx: number, cy: number, w: number, h: number, col: number) => g.fillStyle(col, 1).fillRect(cx * P, cy * P, w * P, h * P);
  // Sombra
  g.fillStyle(0x000000, 0.28).fillEllipse(0, 2, 32 * P, 7 * P);
  // Caja (detrás) y cabina (delante, a la derecha)
  r(-15, -12, 18, 11, K);
  r(-14, -11, 16, 9, 0xf4f4f0);
  r(-14, -11, 16, 2, 0xffffff);
  r(-14, -4, 16, 2, 0xc8ccd8);
  r(3, -16, 13, 15, K);
  r(4, -15, 11, 13, 0x3a6ad0);
  r(4, -15, 11, 2, 0x6a9af0);
  // Ventanilla y faro
  r(9, -13, 5, 5, K);
  r(10, -12, 3, 3, 0x9fd8ff);
  r(10, -12, 1, 1, 0xffffff);
  r(14, -5, 2, 2, 0xffe066);
  // Parachoques y bajos
  r(-16, -2, 33, 2, K);
  r(-15, -2, 31, 1, 0x8a94a8);
  // Ruedas
  for (const wx of [-11, 8]) {
    r(wx - 1, -3, 6, 6, K);
    r(wx, -2, 4, 4, 0x3a3a44);
    r(wx + 1, -1, 2, 2, 0xb0b0c0);
  }
  c.add(g);
  return c;
}

/** Figura glitch (bloques de ruido que cambian de color a saltos), con un brillo que parpadea. */
export function drawGlitchFigure(sc: Phaser.Scene, x: number, y: number) {
  const c = sc.add.container(x, y).setDepth(2);
  const g = sc.add.graphics();
  c.add(g);
  const P = 8;
  const cols = 6;
  const rows = 11;
  const pal = [0x18202c, 0xf8f8f8, 0x9a9aa8, 0x5a5a68, 0xd85ab0, 0x5ad8c8, 0xe8c040];
  const draw = () => {
    if (!c.active) return ev.remove();
    g.clear();
    g.fillStyle(0x000000, 0.25).fillEllipse(0, 4, cols * P * 1.2, 16);
    for (let j = 0; j < rows; j++) {
      // Forma irregular que cambia: más ancha abajo, con huecos
      const w = Math.max(2, Math.min(cols, 2 + Math.floor(Math.random() * 5)));
      const ox = Math.floor(Math.random() * (cols - w + 1));
      for (let i = ox; i < ox + w; i++) {
        if (Math.random() < 0.12) continue;
        const col = pal[Math.floor(Math.random() * pal.length)];
        g.fillStyle(col, 1).fillRect((i - cols / 2) * P, -(rows - j) * P, P, P);
      }
    }
  };
  const ev = sc.time.addEvent({ delay: 140, loop: true, callback: draw });
  draw();
  return c;
}

/** Pantalla "rota" un momento: franjas y bloques de colores sobre la cámara y un temblor. */
export function glitchFlash(sc: Phaser.Scene, cx: number, cy: number, w: number, h: number) {
  const g = sc.add.graphics().setDepth(40);
  let n = 0;
  const ev = sc.time.addEvent({
    delay: 60,
    repeat: 9,
    callback: () => {
      g.clear();
      n++;
      if (n >= 10) return g.destroy();
      for (let k = 0; k < 14; k++) {
        const bw = 20 + Math.random() * w * 0.4;
        const bh = 4 + Math.random() * 30;
        const col = [0xff3a8a, 0x3affd8, 0xffffff, 0x000000, 0xe8c040][Math.floor(Math.random() * 5)];
        g.fillStyle(col, 0.35 + Math.random() * 0.4).fillRect(cx - w / 2 + Math.random() * w, cy - h / 2 + Math.random() * h, bw, bh);
      }
    },
  });
  sc.cameras.main.shake(400, 0.006);
  return ev;
}
