// Fondo temático de los laterales de la partida (lo que queda fuera de la sala): color y textura del bioma, motivos
// en pixel art (hojas, cristales, olas, lava, ladrillos, nieve…) y un marco de columna alrededor de la sala.
// Se dibuja una vez por piso; la única animación son unas pocas motas (copos, ascuas, hojas…) y se quita con lowFx.
import Phaser from 'phaser';
import { GAME_VIEW, H, W } from '../layout';
import { mix, MOTIFS, type HudTheme } from './hudTheme';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dibuja un motivo 8×8 de hudTheme.ts con píxel `p`. */
export function drawMotif(g: Phaser.GameObjects.Graphics, t: HudTheme, x: number, y: number, p: number, alpha: number, flip = false) {
  const rows = MOTIFS[t.motif];
  const col: Record<string, number> = { a: t.motifCols[0], b: t.motifCols[1], c: t.motifCols[2] };
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < 8; rx++) {
      const c = col[row[flip ? 7 - rx : rx]];
      if (c !== undefined) g.fillStyle(c, alpha).fillRect(x + rx * p, y + ry * p, p, p);
    }
  });
}

/** Rectángulos de pantalla que quedan fuera de la sala. */
function strips() {
  const gv = GAME_VIEW;
  return [
    { x: 0, y: 0, w: gv.x, h: H },
    { x: gv.x + gv.w, y: 0, w: W - gv.x - gv.w, h: H },
    { x: gv.x, y: 0, w: gv.w, h: gv.y },
    { x: gv.x, y: gv.y + gv.h, w: gv.w, h: H - gv.y - gv.h },
  ];
}

export function drawHudBackdrop(g: Phaser.GameObjects.Graphics, t: HudTheme, seed = 1) {
  g.clear();
  const r = rng(seed ^ 0x51ed);
  const dark = mix(t.bg, 0x000000, 0.35);
  for (const s of strips()) {
    g.fillStyle(t.bg, 1).fillRect(s.x, s.y, s.w, s.h);
    // Textura: baldosas de 16 px con un borde de luz y otro de sombra, desplazadas por filas
    for (let y = s.y; y < s.y + s.h; y += 16) {
      const off = ((y / 16) & 1) * 8;
      for (let x = s.x - off; x < s.x + s.w; x += 16) {
        const x0 = Math.max(s.x, x);
        const w0 = Math.min(x + 16, s.x + s.w) - x0;
        if (w0 <= 0) continue;
        g.fillStyle(t.bg2, 1).fillRect(x0, y, w0, 4);
        g.fillStyle(dark, 0.5).fillRect(x0, y + 12, w0, 4);
      }
    }
  }
  // Motivos repartidos por los laterales (tenues: encima van los paneles)
  for (const s of strips().slice(0, 2)) {
    for (let y = s.y + 8; y < s.y + s.h - 24; y += 72) {
      for (let x = s.x + 8; x < s.x + s.w - 24; x += 64) {
        if (r() < 0.35) continue;
        const jx = Math.floor(r() * 24);
        const jy = Math.floor(r() * 24);
        drawMotif(g, t, x + jx, y + jy, 3, 0.45, r() < 0.5);
      }
    }
  }
  // Columna alrededor de la sala: sombra, acento oscuro y filete de brillo
  const gv = GAME_VIEW;
  const ring = (i: number, c: number, a: number) => {
    g.fillStyle(c, a);
    g.fillRect(gv.x - i, gv.y - i, gv.w + 2 * i, 4).fillRect(gv.x - i, gv.y + gv.h + i - 4, gv.w + 2 * i, 4);
    g.fillRect(gv.x - i, gv.y - i, 4, gv.h + 2 * i).fillRect(gv.x + gv.w + i - 4, gv.y - i, 4, gv.h + 2 * i);
  };
  ring(12, 0x000000, 0.35);
  ring(8, mix(t.accent, 0x000000, 0.5), 1);
  ring(4, t.accent, 1);
  // Remaches del bioma en las cuatro esquinas de la sala y a mitad de cada lado
  const studs: [number, number][] = [
    [gv.x - 12, gv.y - 12], [gv.x + gv.w + 4, gv.y - 12], [gv.x - 12, gv.y + gv.h + 4], [gv.x + gv.w + 4, gv.y + gv.h + 4],
    [gv.x - 12, gv.y + gv.h / 2 - 4], [gv.x + gv.w + 4, gv.y + gv.h / 2 - 4],
  ];
  for (const [x, y] of studs) {
    g.fillStyle(0x000000, 0.5).fillRect(x, y, 8, 8);
    g.fillStyle(t.accentHi, 1).fillRect(x, y, 6, 6);
    g.fillStyle(0xffffff, 0.6).fillRect(x, y, 2, 2);
  }
  return g;
}

/**
 * Motas que se mueven por los laterales (copos que caen, ascuas que suben, hojas…). Pocas y con tweens: no redibuja
 * nada. `add` las mete en la capa del HUD por debajo de los paneles. Con lowFx no hay ninguna.
 */
export function addHudAmbient(scene: Phaser.Scene, t: HudTheme, add: (o: Phaser.GameObjects.GameObject) => void, low: boolean) {
  if (low) return;
  const r = rng(0xa11ce);
  const up = t.motif === 'lava' || t.motif === 'swamp' || t.motif === 'crystal';
  const gv = GAME_VIEW;
  for (let i = 0; i < 14; i++) {
    const left = i % 2 === 0;
    const x = left ? 8 + r() * (gv.x - 16) : gv.x + gv.w + 8 + r() * (W - gv.x - gv.w - 16);
    const size = t.motif === 'snow' || t.motif === 'cloud' ? 4 : t.motif === 'leaf' ? 6 : 3;
    const dot = scene.add.rectangle(x, up ? H + 10 : -10, size, size, t.motifCols[i % 3 === 0 ? 2 : 0], 0.7).setDepth(-1);
    add(dot);
    const dur = 9000 + r() * 9000;
    scene.tweens.add({
      targets: dot,
      y: up ? -10 : H + 10,
      x: x + (r() - 0.5) * 60,
      alpha: { from: 0.75, to: 0.15 },
      duration: dur,
      delay: r() * dur,
      repeat: -1,
    });
  }
}
