// Arte de las reacciones elementales (supervisor): cada una con su efecto (descarga que salta, cristales de
// ultrafrío, nube de vapor, explosión tóxica, deshielo, añicos de hielo, toma de tierra y pesadilla) y el estallido de
// rayos del jefe megaevolucionado. Píxel gordo y redibujado a saltos; con pocos efectos, solo un anillo corto.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { starBurst } from './combatFx';
import { PX, animate, darkOf, drawPixBeam, lightOf, mixColor, pixBlast, pixBolt, pixCracks, pixDebris, pixFlash, pixRing, pixSpokes } from './pixelFx';

const OUT = 0x18202c;
const snap = (v: number) => Math.round(v / PX) * PX;
const px = (g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, s = PX) =>
  g.fillStyle(c, a).fillRect(snap(x) - s / 2, snap(y) - s / 2, s, s);

/** Esquirla de hielo (rombo alargado orientado). */
function shard(g: Phaser.GameObjects.Graphics, x: number, y: number, ang: number, len: number, c: number, a = 1) {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  for (let d = -len / 2; d <= len / 2; d += PX * 0.8) {
    const w = (1 - Math.abs(d) / (len / 2)) * PX * 1.5;
    px(g, x + ux * d, y + uy * d, OUT, a * 0.7, PX + 2 + w);
    px(g, x + ux * d, y + uy * d, d < 0 ? 0xffffff : c, a, PX + w * 0.5);
  }
}

/** Efecto de una reacción sobre el enemigo en (x, y). `radius` para las de área. */
export function reactionFx(scene: Phaser.Scene, id: string, x: number, y: number, color: number, radius = 0, depth = 9) {
  if (lowFx()) {
    pixRing(scene, x, y, Math.max(50, radius), color, 300, depth);
    return;
  }
  const light = lightOf(color);
  switch (id) {
    case 'descarga': {
      // el enemigo empapado chisporrotea: arcos cortos que saltan a su alrededor
      animate(scene, depth, 420, (g, k, t) => {
        const fr = Math.floor(t / 60);
        for (let i = 0; i < 5; i++) {
          let ax = x;
          let ay = y;
          const ang = i * 1.26 + fr * 0.7;
          for (let s = 0; s < 5; s++) {
            const bx = ax + Math.cos(ang + ((fr + s * i) % 3 - 1) * 0.6) * 9;
            const by = ay + Math.sin(ang + ((fr + s) % 3 - 1) * 0.6) * 9;
            px(g, bx, by, s % 2 ? 0xffffff : color, 1 - k);
            ax = bx;
            ay = by;
          }
        }
        // gotas de agua que saltan
        for (let i = 0; i < 6; i++) px(g, x + Math.cos(i * 1.05) * (14 + k * 40), y + Math.sin(i * 1.05) * (10 + k * 26) - k * 10, 0x6ab8ff, 1 - k);
      }, 50);
      pixFlash(scene, x, y, 34, color, 200, depth);
      break;
    }
    case 'ultrafrio': {
      // cristales de hielo que se cierran sobre el enemigo y lo encierran
      animate(scene, depth, 620, (g, k) => {
        const close = Math.min(1, k * 2.5);
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * 6.283 + 0.2;
          const d = 22 + (1 - close) * 40;
          shard(g, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.85, ang, 18 + (i % 2) * 8, color, k > 0.75 ? (1 - k) * 4 : 1);
        }
        if (k > 0.35) for (let i = 0; i < 10; i++) px(g, x + Math.cos(i * 2.3) * (k * 50), y + Math.sin(i * 2.3) * (k * 40), 0xffffff, 1 - k);
      }, 50);
      scene.time.delayedCall(250, () => starBurst(scene, x, y, color, 6, 1, depth + 1));
      break;
    }
    case 'vapor': {
      // nube de vapor que sube y se ensancha, con siseo de gotas
      const puffs = Array.from({ length: 9 }, (_, i) => ({ ox: (i - 4) * 9 + Phaser.Math.Between(-4, 4), d: i * 0.05, s: 2 + (i % 3) }));
      animate(scene, depth, 900, (g, k) => {
        for (const p of puffs) {
          const kk = Math.max(0, Math.min(1, (k - p.d) / 0.8));
          if (kk <= 0) continue;
          const cx = x + p.ox * (1 + kk);
          const cy = y - 6 - kk * 60;
          const sz = PX * (p.s + 1 + kk * 4);
          const a = (1 - kk) * 0.85;
          px(g, cx, cy, 0x9aa6b8, a * 0.7, sz + 4);
          px(g, cx - 2, cy - 2, color, a, sz);
          px(g, cx - sz * 0.25, cy - sz * 0.25, 0xffffff, a, sz * 0.45);
        }
        if (k < 0.4) for (let i = 0; i < 6; i++) px(g, x + (i - 2.5) * 10, y + k * 40, 0x6ab8ff, 1 - k * 2.5);
      }, 60);
      break;
    }
    case 'toxica': {
      // explosión de gas venenoso: estallido morado, burbujas que revientan y un charco que se extiende
      pixBlast(scene, x, y, Math.max(50, radius * 0.6), color, depth);
      pixRing(scene, x, y, radius || 100, color, 420, depth);
      const bubbles = Array.from({ length: 12 }, (_, i) => ({ a: i * 0.52 + Math.random() * 0.4, d: 0.3 + Math.random() * 0.7, s: 1 + (i % 3) }));
      animate(scene, depth - 0.5, 900, (g, k) => {
        const R = (radius || 100) * Math.min(1, k * 2);
        for (const b of bubbles) {
          const bx = x + Math.cos(b.a) * R * b.d;
          const by = y + Math.sin(b.a) * R * b.d * 0.6 - k * 30 * b.s;
          const pop = k > 0.55 + b.d * 0.3;
          if (pop) {
            for (let j = 0; j < 4; j++) px(g, bx + Math.cos(j * 1.57) * PX * 1.5, by + Math.sin(j * 1.57) * PX * 1.5, light, 1 - k);
          } else {
            px(g, bx, by, OUT, 0.7, PX * b.s + 4);
            px(g, bx, by, j2(color, b.s), 0.95, PX * b.s);
            px(g, bx - 2, by - 2, 0xffffff, 0.9, PX - 2);
          }
        }
      }, 60);
      break;
    }
    case 'deshielo': {
      // el hielo se derrite: esquirlas azules que caen volviéndose gotas naranjas, con vaho y llamita
      animate(scene, depth, 700, (g, k) => {
        for (let i = 0; i < 7; i++) {
          const ang = -Math.PI / 2 + (i - 3) * 0.45;
          const d = 14 + k * 30;
          const fx = x + Math.cos(ang) * d;
          const fy = y + Math.sin(ang) * d + k * k * 60;
          const c = mixColor(0x9be7ff, color, Math.min(1, k * 1.6));
          if (k < 0.5) shard(g, fx, fy, ang + k * 3, 14, c, 1);
          else px(g, fx, fy, c, (1 - k) * 2, PX + 2);
        }
        for (let i = 0; i < 4; i++) px(g, x + (i - 1.5) * 12, y - 20 - k * 40, 0xe0e8f0, (1 - k) * 0.6, PX * 2);
      }, 50);
      pixFlash(scene, x, y, 40, color, 260, depth);
      break;
    }
    case 'anicos': {
      // el bloque de hielo revienta en esquirlas que salen disparadas
      const shards = Array.from({ length: 12 }, (_, i) => ({ a: (i / 12) * 6.283 + Math.random() * 0.3, sp: 0.6 + Math.random() * 0.5, l: 12 + Math.random() * 12 }));
      animate(scene, depth, 560, (g, k) => {
        const R = (radius || 70) * Phaser.Math.Easing.Cubic.Out(k);
        for (const s of shards) shard(g, x + Math.cos(s.a) * R * s.sp, y + Math.sin(s.a) * R * s.sp * 0.8, s.a + k * 4, s.l, 0x9be7ff, 1 - k * 0.8);
      }, 50);
      pixRing(scene, x, y, radius || 70, 0xffffff, 300, depth);
      pixDebris(scene, x, y, color, 8, 1, depth);
      break;
    }
    case 'tomaTierra': {
      // la electricidad baja a tierra: rayo al suelo, grietas y polvo
      pixBolt(scene, x, y - 70, x, y + 16, 0xffe14d, depth + 1);
      pixCracks(scene, x, y + 16, 46, color, 600, 1.6);
      pixSpokes(scene, x, y + 16, 10, 44, 8, color, 300, depth);
      break;
    }
    case 'pesadilla': {
      // remolino oscuro con dos ojos rojos que se abren y parpadean
      animate(scene, depth, 900, (g, k, t) => {
        const a = k < 0.8 ? 1 : (1 - k) * 5;
        for (let arm = 0; arm < 3; arm++) {
          for (let d = 4; d < 54; d += PX * 0.8) {
            const ang = arm * 2.094 + d * 0.09 - t * 0.008;
            px(g, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.75, d > 34 ? darkOf(color) : color, a * (1 - d / 60));
          }
        }
        const open = Math.min(1, k * 4) * (Math.floor(t / 120) % 6 === 0 ? 0.3 : 1);
        for (const sx of [-10, 10]) {
          px(g, x + sx, y - 8, OUT, a, PX * 2 + 2);
          g.fillStyle(0xff3048, a).fillRect(snap(x + sx) - PX, snap(y - 8) - (PX * open) / 2, PX * 2, Math.max(2, PX * open));
        }
      }, 60);
      break;
    }
    default:
      pixFlash(scene, x, y, 40, color, 220, depth);
      starBurst(scene, x, y, color, 6, 1, depth);
  }
}

/** Color de una burbuja: alterna el del tipo y uno verdoso de veneno. */
function j2(color: number, s: number) {
  return s % 2 ? color : mixColor(color, 0x7ad84a, 0.45);
}

/** La descarga salta de enemigo en enemigo: rayos encadenados desde (x, y). */
export function reactionChain(scene: Phaser.Scene, x: number, y: number, targets: { x: number; y: number }[], color: number, depth = 10) {
  let fx = x;
  let fy = y;
  targets.forEach((p, i) => {
    const sx = fx;
    const sy = fy;
    scene.time.delayedCall(i * 70, () => {
      pixBolt(scene, sx, sy, p.x, p.y, color, depth);
      if (!lowFx()) pixFlash(scene, p.x, p.y, 26, color, 180, depth);
    });
    fx = p.x;
    fy = p.y;
  });
}

/**
 * Estallido de rayos del jefe megaevolucionado: rayos gruesos que salen del centro y se estrechan, destello y anillo
 * en el centro y chispas al final de cada rayo. Con pocos efectos, los rayos quietos un momento.
 */
export function megaBlastFx(scene: Phaser.Scene, cx: number, cy: number, angles: readonly number[], length: number, width: number, color: number, depth = 12) {
  if (lowFx()) {
    const g = scene.add.graphics().setDepth(depth);
    for (const a of angles) drawPixBeam(g, cx, cy, cx + Math.cos(a) * length, cy + Math.sin(a) * length, width * 2, color, 0);
    scene.time.delayedCall(260, () => g.destroy());
    return;
  }
  animate(scene, depth, 380, (g, k, t) => {
    const w = width * 2.4 * (1 - k * 0.85);
    const len = length * Math.min(1, k * 5);
    for (const a of angles) drawPixBeam(g, cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len, Math.max(PX, w), color, t);
  }, 40);
  pixFlash(scene, cx, cy, 60, color, 300, depth + 1);
  pixRing(scene, cx, cy, 120, color, 380, depth);
  scene.time.delayedCall(80, () => {
    for (const a of angles) starBurst(scene, cx + Math.cos(a) * length, cy + Math.sin(a) * length, color, 4, 0.8, depth + 1);
  });
}
