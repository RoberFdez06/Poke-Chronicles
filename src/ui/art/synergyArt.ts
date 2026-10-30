// Arte pixel de las sinergias que transforman: lunas/chispas orbitales, llamas y cristales del rastro, insignia de
// «Sinergia» (dos anillos enlazados con estrella), aura de lucha, aspecto de las transformaciones y el destello al
// descubrir una. Todo con cuadrados de píxel gordo; con lowFx() se dibuja la versión simple (sin animación).
import Phaser from 'phaser';
import { drawPixelGrid, type PixelIcon } from './icons';
import { animate, darkOf, lightOf, PX, pixRing } from './pixelFx';

const K = 0x18202c;

const ORB: PixelIcon = {
  desc: 'Esfera orbital',
  palette: { k: K, c: 0xffffff, l: 0xffffff, d: 0x000000 },
  rows: ['..kkkk..', '.kllcck.', 'kllccccd', 'klcccccd', 'kccccccd', 'kcccccdd', '.kccddk.', '..kkkk..'],
};
const FLAME: PixelIcon = {
  desc: 'Llama del rastro',
  palette: { k: K, r: 0xd8401c, o: 0xff8a2a, y: 0xffe066, w: 0xfff8d0 },
  rows: ['...k....', '..kok...', '..kork..', '.korrok.', '.kroyrk.', 'kroyyork', 'kryywyrk', '.kkkkkk.'],
};
const ICE: PixelIcon = {
  desc: 'Cristal del rastro helado',
  palette: { k: 0x2a4a6a, b: 0x7ad0f0, l: 0xd8f4ff, w: 0xffffff },
  rows: ['...kk...', '..kwlk..', '.kwlbbk.', 'kwlbbbbk', 'klbbbbbk', '.kbbbbk.', '..kbbk..', '...kk...'],
};
/** Insignia de sinergia: dos anillos enlazados y una estrella encima. */
export const SYNERGY_BADGE: PixelIcon = {
  desc: 'Sinergia',
  palette: { k: K, y: 0xffd34d, Y: 0xfff3a8, p: 0xe060a0, b: 0x5aa8ff },
  rows: [
    '.....kk.....',
    '....kYyk....',
    '.kkkyYYykkk.',
    '..kyyyyyyk..',
    '...kyyyyk...',
    '..kyk..kyk..',
    '.kkkk.kkkk..',
    'kppkkbkkbbk.',
    'kp.kbpk.b.k.',
    'kp.kbpk.b.k.',
    'kppkkbkkbbk.',
    '.kkkk.kkkk..',
  ],
};
/** Libro de sinergias (icono para el menú). */
export const SYNERGY_BOOK: PixelIcon = {
  desc: 'Libro de sinergias',
  palette: { k: K, r: 0x8a2a3a, R: 0xc84a5a, p: 0xf0e8d0, y: 0xffd34d },
  rows: [
    '.kkkkkkkkkk.',
    'kRRRRRRRRRpk',
    'kRrrrrrrrRpk',
    'kRryyyyyrRpk',
    'kRryRRRyrRpk',
    'kRryyyyyrRpk',
    'kRrrrrrrrRpk',
    'kRrryyyrrRpk',
    'kRrrrrrrrRpk',
    'kRRRRRRRRRpk',
    'krrrrrrrrrrk',
    '.kkkkkkkkkk.',
  ],
};

const bake = (scene: Phaser.Scene, key: string, icon: PixelIcon) => {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  drawPixelGrid(g, icon);
  g.generateTexture(key, icon.rows[0].length, icon.rows.length);
  g.destroy();
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
};

/** Textura de una esfera orbital de ese color (luna, chispa, alma). */
export function orbTexture(scene: Phaser.Scene, color: number): string {
  return bake(scene, `syn-orb-${color.toString(16)}`, { ...ORB, palette: { k: K, c: color, l: lightOf(color), d: darkOf(color) } });
}
export const flameTexture = (scene: Phaser.Scene) => bake(scene, 'syn-flame', FLAME);
export const iceTexture = (scene: Phaser.Scene) => bake(scene, 'syn-ice', ICE);
export const badgeTexture = (scene: Phaser.Scene) => bake(scene, 'syn-badge', SYNERGY_BADGE);
export const bookTexture = (scene: Phaser.Scene) => bake(scene, 'syn-book', SYNERGY_BOOK);

/** Dibuja la insignia de sinergia en una Graphics (listas, pausa…). */
export function drawSynergyBadge(g: Phaser.GameObjects.Graphics, x: number, y: number, u = 2) {
  drawPixelGrid(g, SYNERGY_BADGE, x, y, u);
}

const snap = (v: number) => Math.round(v / PX) * PX;

/** Aura de lucha alrededor del jugador: anillo de píxeles que gira. Redibujar cada pocos frames. */
export function drawAura(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, t: number, low: boolean) {
  g.clear();
  if (low) {
    g.lineStyle(3, color, 0.45).strokeEllipse(x, y, r * 2, r * 1.3);
    return;
  }
  const n = Math.max(12, Math.round(r / 7));
  const rot = t / 900;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rot;
    const pulse = 0.55 + 0.45 * Math.sin(t / 160 + i);
    const px = snap(x + Math.cos(a) * r);
    const py = snap(y + Math.sin(a) * r * 0.65);
    g.fillStyle(darkOf(color), 0.35 * pulse).fillRect(px - 5, py - 5, 10, 10);
    g.fillStyle(i % 3 === 0 ? 0xffffff : lightOf(color), 0.75 * pulse).fillRect(px - 3, py - 3, 6, 6);
  }
}

/**
 * Aspecto de la transformación: silueta de píxeles alrededor del jugador (llamas que suben, chispas o niebla
 * espectral según la sinergia) y corona de brillo encima. Redibujar cada pocos frames.
 */
export function drawTransformLook(g: Phaser.GameObjects.Graphics, id: string, x: number, y: number, color: number, glow: number, t: number, low: boolean) {
  g.clear();
  if (low) {
    g.lineStyle(4, color, 0.6).strokeEllipse(x, y + 4, 86, 100);
    g.fillStyle(glow, 0.9).fillRect(x - 9, y - 66, 18, 6);
    return;
  }
  const flick = (i: number) => 0.5 + 0.5 * Math.sin(t / 90 + i * 1.7);
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rx = 40;
    const ry = 50;
    const bx = x + Math.cos(a) * rx;
    const by = y + 4 + Math.sin(a) * ry;
    const f = flick(i);
    if (id === 'fuego-sagrado') {
      // Llamas que suben por el contorno
      const h = 6 + f * 14;
      g.fillStyle(darkOf(color), 0.55).fillRect(snap(bx) - 4, snap(by - h), 8, h);
      g.fillStyle(color, 0.8).fillRect(snap(bx) - 3, snap(by - h * 0.8), 6, h * 0.7);
      g.fillStyle(glow, 0.9 * f).fillRect(snap(bx) - 2, snap(by - h), 4, 4);
    } else if (id === 'tormenta-eterna') {
      // Chispas que saltan del contorno
      g.fillStyle(color, 0.75 * f).fillRect(snap(bx) - 3, snap(by) - 3, 6, 6);
      if (f > 0.8) g.fillStyle(0xffffff, 1).fillRect(snap(bx + Math.cos(a) * 10) - 2, snap(by + Math.sin(a) * 10) - 2, 4, 4);
    } else {
      // Niebla espectral: manchas que flotan hacia fuera
      const o = (t / 25 + i * 9) % 18;
      g.fillStyle(color, 0.35 * (1 - o / 18)).fillRect(snap(bx + Math.cos(a) * o) - 5, snap(by + Math.sin(a) * o) - 5, 10, 10);
      g.fillStyle(glow, 0.5 * f).fillRect(snap(bx) - 2, snap(by) - 2, 4, 4);
    }
  }
  // Corona encima de la cabeza (tres puntas)
  const cy = y - 64 + Math.round(Math.sin(t / 300) * 2);
  g.fillStyle(K, 0.9).fillRect(x - 14, cy - 2, 28, 10);
  g.fillStyle(glow, 1).fillRect(x - 12, cy, 24, 6);
  for (const dx of [-10, 0, 10]) {
    g.fillStyle(K, 0.9).fillRect(x + dx - 3, cy - 10, 6, 10);
    g.fillStyle(dx === 0 ? 0xffffff : glow, 1).fillRect(x + dx - 2, cy - 8, 4, 8);
  }
}

/** Destello al descubrir una sinergia: anillo, rayos de estrella e insignia que sube sobre el jugador. */
export function discoveryBurst(scene: Phaser.Scene, x: number, y: number, color: number, low: boolean, transform = false) {
  const tex = badgeTexture(scene);
  const badge = scene.add.image(x, y - 70, tex).setScale(low ? 3 : 1).setDepth(12);
  if (low) {
    scene.time.delayedCall(900, () => badge.destroy());
    return;
  }
  pixRing(scene, x, y, transform ? 160 : 110, color, 520, 11);
  if (transform) scene.time.delayedCall(160, () => pixRing(scene, x, y, 220, lightOf(color), 600, 11));
  animate(scene, 11, 600, (g, k) => {
    const a = 1 - k;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + k * 0.6;
      const r0 = 30 + k * 60;
      const r1 = r0 + 22;
      for (let s = r0; s < r1; s += PX) g.fillStyle(i % 2 ? 0xffffff : color, a).fillRect(snap(x + Math.cos(ang) * s) - 3, snap(y + Math.sin(ang) * s * 0.7) - 3, 6, 6);
    }
  });
  scene.tweens.add({ targets: badge, scale: { from: 1, to: 3.4 }, y: y - 96, duration: 380, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: badge, alpha: 0, delay: 900, duration: 300, onComplete: () => badge.destroy() });
}

/** Onda de Represalia: anillo grueso que se abre. */
export function retaliateWave(scene: Phaser.Scene, x: number, y: number, r: number, low: boolean) {
  if (low) {
    const c = scene.add.circle(x, y, r, 0xffd34d, 0.18).setDepth(7);
    scene.time.delayedCall(180, () => c.destroy());
    return;
  }
  pixRing(scene, x, y, r, 0xffd34d, 340, 8, 0.7);
  pixRing(scene, x, y, r * 0.7, 0xff8a3a, 280, 8, 0.7);
}
