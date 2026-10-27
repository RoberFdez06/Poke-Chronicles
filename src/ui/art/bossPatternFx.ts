// Arte pixel art de los ataques extra de jefe (bossExtra/bossRing en GameScene): espiral, onda expansiva, anillo,
// láser giratorio y zona de peligro. Solo dibujo: daño, tiempos e hitbox siguen en GameScene/bossPatterns.ts.
// Mismo lenguaje que el Torbellino y el Rayo: píxel gordo en rejilla, color del tipo con su claro/oscuro, núcleo
// blanco, contorno oscuro y redibujo a saltos.
import Phaser from 'phaser';
import { animate, darkOf, drawPixBeam, drawPixOrb, lightOf, mixColor, PX, pixDebris, pixRing, pixSpokes } from './pixelFx';

const OUT = 0x18202c;
const snap = (v: number) => Math.round(v / PX) * PX;
const TAU = Math.PI * 2;

function dot(g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, size = PX, outline = false) {
  const sx = snap(x);
  const sy = snap(y);
  if (outline) g.fillStyle(OUT, a * 0.8).fillRect(sx - size / 2 - 2, sy - size / 2 - 2, size + 4, size + 4);
  g.fillStyle(c, a).fillRect(sx - size / 2, sy - size / 2, size, size);
}

export type FlavorKind = 'foam' | 'flame' | 'spark' | 'leaf' | 'shard' | 'mote';
export interface Flavor {
  kind: FlavorKind;
  /** Color del tipo y su acento (espuma, llama azul del dragón, chispa…). */
  main: number;
  accent: number;
}

/** Sabor visual de cada tipo para los remolinos y estelas (agua = espuma, dragón = llamas violetas/azules…). */
export function typeFlavor(type: string, color: number): Flavor {
  switch (type) {
    case 'water': return { kind: 'foam', main: color, accent: 0xe8fbff };
    case 'ice': return { kind: 'shard', main: color, accent: 0xe8fbff };
    case 'dragon': return { kind: 'flame', main: 0x7b4dff, accent: 0x4da6ff };
    case 'fire': return { kind: 'flame', main: color, accent: 0xffd23f };
    case 'electric': return { kind: 'spark', main: color, accent: 0xffffff };
    case 'grass': case 'bug': return { kind: 'leaf', main: color, accent: 0xc6f26b };
    case 'rock': case 'ground': case 'steel': return { kind: 'shard', main: color, accent: lightOf(color) };
    case 'ghost': case 'dark': case 'poison': return { kind: 'mote', main: color, accent: 0xd18cff };
    case 'psychic': case 'fairy': return { kind: 'mote', main: color, accent: 0xffc6e8 };
    default: return { kind: 'spark', main: color, accent: lightOf(color) };
  }
}

/** Partícula pequeña con el sabor del tipo (2-4 píxeles). `f` 0-1 = vida; `s` semilla para variar la forma. */
function flavorBit(g: Phaser.GameObjects.Graphics, x: number, y: number, fl: Flavor, f: number, s: number, a = 1) {
  const al = a * (1 - f * 0.7);
  switch (fl.kind) {
    case 'foam': // rizo de espuma: arco de 3 píxeles blancos con borde azul
      dot(g, x, y, fl.main, al, PX, true);
      dot(g, x + PX, y - PX, fl.accent, al);
      dot(g, x + PX * 2, y, fl.accent, al * 0.8);
      break;
    case 'flame': // lengüeta: base de color, cuerpo acento y punta blanca hacia arriba
      dot(g, x, y, fl.main, al, PX, true);
      dot(g, x, y - PX, s % 2 ? fl.accent : lightOf(fl.main), al);
      if (f < 0.6) dot(g, x, y - PX * 2, 0xffffff, al * 0.9);
      break;
    case 'leaf':
      dot(g, x, y, darkOf(fl.main), al, PX, true);
      dot(g, x + PX, y - PX, fl.accent, al);
      break;
    case 'shard':
      dot(g, x, y, fl.accent, al, PX, true);
      dot(g, x + (s % 2 ? PX : -PX), y + PX, darkOf(fl.main), al);
      break;
    case 'mote':
      dot(g, x, y, fl.main, al * 0.8, PX + 2, true);
      dot(g, x, y, fl.accent, al, PX - 2);
      break;
    default: // chispa en cruz
      dot(g, x, y, 0xffffff, al);
      if (f < 0.5) {
        dot(g, x - PX, y, fl.accent, al * 0.8);
        dot(g, x + PX, y, fl.accent, al * 0.8);
        dot(g, x, y - PX, fl.main, al * 0.8);
        dot(g, x, y + PX, fl.main, al * 0.8);
      }
  }
}

type Pos = () => { x: number; y: number };

// ---------------- Espiral ----------------

/**
 * Aviso de la espiral: glifo de `arms` brazos curvos alrededor del jefe que gira y se va encendiendo desde el centro
 * hacia fuera, marcando por dónde saldrán los brazos de proyectiles. `curl` = rad/px que se tuerce cada brazo
 * (sale de spiralSpec: turn / distancia recorrida entre disparo y disparo). `base` = ángulo del primer brazo.
 */
export function spiralWarn(sc: Phaser.Scene, at: Pos, arms: number, base: number, curl: number, color: number, ms: number, depth = 4) {
  const light = lightOf(color);
  const dark = darkOf(color);
  const R = 120;
  animate(sc, depth, ms, (g, k, t) => {
    const { x, y } = at();
    // Disco de suelo que se oscurece y anillo exterior a trozos
    g.fillStyle(dark, 0.12 + 0.12 * k).fillCircle(x, y, R + 8);
    for (let a = 0; a < TAU; a += PX / R) {
      if (Math.floor((a - t * 0.004) / 0.3) % 2) continue;
      dot(g, x + Math.cos(a) * (R + 8), y + Math.sin(a) * (R + 8), k > 0.7 && Math.floor(t / 80) % 2 ? 0xffffff : color, 0.7);
    }
    // Brazos: giran hacia su sitio y se encienden de dentro afuera
    const spin = (1 - Phaser.Math.Easing.Cubic.Out(k)) * Math.PI * 1.2;
    const lit = R * Math.min(1, k * 1.25);
    for (let arm = 0; arm < arms; arm++) {
      const a0 = base + (arm / arms) * TAU + spin;
      for (let r = 18; r <= R; r += PX) {
        const a = a0 - r * curl;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        const on = r <= lit;
        const head = on && lit - r < PX * 3;
        const w = r < R * 0.35 ? PX : PX + 2;
        dot(g, px, py, head ? 0xffffff : on ? light : dark, on ? 0.95 : 0.45, w, on);
        if (on && (Math.round(r / PX) + Math.floor(t / 60)) % 7 === 0) dot(g, px, py, 0xffffff, 0.9);
      }
      // Punta de flecha al final de cada brazo cuando ya está encendido
      if (k > 0.8) {
        const a = a0 - R * curl;
        const tx = x + Math.cos(a) * (R + PX * 2);
        const ty = y + Math.sin(a) * (R + PX * 2);
        dot(g, tx, ty, 0xffffff, 1, PX, true);
        dot(g, tx - Math.cos(a + 0.5) * PX * 1.5, ty - Math.sin(a + 0.5) * PX * 1.5, light, 1);
        dot(g, tx - Math.cos(a - 0.5) * PX * 1.5, ty - Math.sin(a - 0.5) * PX * 1.5, light, 1);
      }
    }
  }, 50);
}

/** El jefe carga un remolino de energía de su tipo: partículas que caen en espiral hacia él y un núcleo que crece. */
export function vortexCharge(sc: Phaser.Scene, at: Pos, type: string, color: number, ms: number, depth = 6) {
  const fl = typeFlavor(type, color);
  const n = 14;
  animate(sc, depth, ms, (g, k, t) => {
    const { x, y } = at();
    for (let i = 0; i < n; i++) {
      // Cada partícula da vueltas cerrándose; reaparece fuera al llegar al centro
      const ph = ((t / ms) * 1.6 + i / n) % 1;
      const r = 90 * (1 - ph) + 10;
      const a = (i / n) * TAU + ph * Math.PI * 2.4 + t * 0.003;
      flavorBit(g, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, fl, ph, i);
      // Rastro curvo de cada partícula (2 píxeles detrás)
      for (let j = 1; j <= 2; j++) {
        const a2 = a - j * 0.22;
        const r2 = r + j * 7;
        dot(g, x + Math.cos(a2) * r2, y + Math.sin(a2) * r2 * 0.8, j === 1 ? fl.main : darkOf(fl.main), 0.6 / j);
      }
    }
    drawPixOrb(g, x, y, 8 + 14 * k, mixColor(fl.main, fl.accent, 0.3), t, 0.55 + 0.35 * k);
  }, 50);
}

/**
 * Estelas curvas de un grupo de proyectiles (una sola Graphics): cada disparo deja una cola que persiste `life` ms,
 * así los brazos de la espiral (o el anillo) se ven dibujados como arcos. Cabeza con halo y chispas del tipo.
 * Llama a `add(shot)` por disparo y a `done()` al acabar; se destruye sola cuando no quedan colas.
 */
export function shotTrails(sc: Phaser.Scene, type: string, color: number, life = 560, depth = 3.5) {
  const fl = typeFlavor(type, color);
  const light = lightOf(fl.main);
  const dark = darkOf(fl.main);
  const shots: { s: Phaser.GameObjects.Sprite; pts: { x: number; y: number; t: number }[]; seed: number }[] = [];
  const g = sc.add.graphics().setDepth(depth);
  let finished = false;
  let seed = 0;
  const tick = () => {
    const now = sc.time.now;
    g.clear();
    for (let i = shots.length - 1; i >= 0; i--) {
      const sh = shots[i];
      if (sh.s.active) sh.pts.push({ x: sh.s.x, y: sh.s.y, t: now });
      while (sh.pts.length && now - sh.pts[0].t > life) sh.pts.shift();
      if (!sh.s.active && !sh.pts.length) {
        shots.splice(i, 1);
        continue;
      }
      const m = sh.pts.length;
      sh.pts.forEach((p, j) => {
        const f = (now - p.t) / life; // 0 = recién dejado
        const w = f < 0.25 ? PX + 4 : f < 0.6 ? PX + 2 : PX;
        const c = f < 0.12 ? 0xffffff : f < 0.35 ? light : f < 0.7 ? fl.main : dark;
        dot(g, p.x, p.y, c, 1 - f * 0.85, w, f < 0.5);
        // Sabor del tipo salpicado a lo largo del arco
        if ((j + sh.seed) % 4 === 0 && f > 0.15) flavorBit(g, p.x + ((j * 7) % 3 - 1) * PX, p.y + ((j * 5) % 3 - 1) * PX, fl, f, j);
        if (j === m - 1 && sh.s.active) drawPixOrb(g, p.x, p.y, 11, fl.main, now + sh.seed * 40, 0.75);
      });
    }
    if (finished && !shots.length) {
      ev.remove();
      g.destroy();
    }
  };
  const ev = sc.time.addEvent({ delay: 40, loop: true, callback: tick });
  return {
    add(s: Phaser.GameObjects.Sprite) {
      shots.push({ s, pts: [], seed: seed++ });
    },
    done() {
      finished = true;
    },
  };
}

/** Fogonazo de salida de un brazo: chispa corta en la dirección del disparo. */
export function armMuzzle(sc: Phaser.Scene, x: number, y: number, ang: number, type: string, color: number, depth = 6) {
  const fl = typeFlavor(type, color);
  animate(sc, depth, 160, (g, k) => {
    const r = 24 + 22 * k;
    for (let d = 18; d < r; d += PX) dot(g, x + Math.cos(ang) * d, y + Math.sin(ang) * d, d > r - PX * 2 ? 0xffffff : fl.accent, 1 - k);
    flavorBit(g, x + Math.cos(ang + 0.5) * r * 0.8, y + Math.sin(ang + 0.5) * r * 0.8, fl, k, 1, 1 - k);
  }, 40);
}

/** Pequeño estallido al terminar la espiral (destello, rayos por cada brazo y trozos del tipo). */
export function spiralEndBurst(sc: Phaser.Scene, x: number, y: number, arms: number, off: number, type: string, color: number) {
  const fl = typeFlavor(type, color);
  pixSpokes(sc, x, y, 24, 96, arms * 2, fl.main, 320, 8, off);
  pixRing(sc, x, y, 80, fl.main, 380, 7, 0.75);
  pixDebris(sc, x, y, fl.accent, 8, 0.7, 9);
}

// ---------------- Onda expansiva ----------------

/** Aviso de la onda: anillo de peligro latiendo con el hueco marcado en blanco, postes en sus bordes y flechas de salida. */
export function shockWarn(sc: Phaser.Scene, at: Pos, gapAt: number, gap: number, color: number, ms: number, depth = 4) {
  const light = lightOf(color);
  animate(sc, depth, ms, (g, k, t) => {
    const { x, y } = at();
    const blink = Math.floor(t / 90) % 2 === 0;
    for (const R of [64, 92]) {
      for (let a = 0; a < TAU; a += PX / R) {
        const d = Math.atan2(Math.sin(a - gapAt), Math.cos(a - gapAt));
        if (Math.abs(d) < gap / 2) continue;
        const crack = Math.floor((a * R) / (PX * 3) + t * 0.01) % 3 === 0;
        dot(g, x + Math.cos(a) * R, y + Math.sin(a) * R, crack ? 0xe53935 : R === 64 ? color : darkOf(color), 0.5 + 0.4 * k, PX, R === 64);
      }
    }
    // Hueco: arco claro + postes a los lados
    for (let a = gapAt - gap / 2; a <= gapAt + gap / 2; a += PX / 78) dot(g, x + Math.cos(a) * 78, y + Math.sin(a) * 78, blink ? 0xffffff : 0x9cff8a, 0.5);
    for (const e of [gapAt - gap / 2, gapAt + gap / 2]) {
      for (let r = 54; r <= 104; r += PX) dot(g, x + Math.cos(e) * r, y + Math.sin(e) * r, r > 96 ? 0xffffff : light, 0.95, PX, true);
    }
    // Flechas (chevrons) que salen por el hueco
    for (let c = 0; c < 3; c++) {
      const r = 110 + ((c * 22 + t * 0.12) % 66);
      const ux = Math.cos(gapAt);
      const uy = Math.sin(gapAt);
      for (let s = -2; s <= 2; s++) {
        const bx = x + ux * (r - Math.abs(s) * PX) - uy * s * PX;
        const by = y + uy * (r - Math.abs(s) * PX) + ux * s * PX;
        dot(g, bx, by, 0xffffff, 0.9 * (1 - ((r - 110) / 66)), PX, true);
      }
    }
  }, 50);
}

/**
 * Dibuja una onda (en una Graphics que se limpia fuera): bolas de energía con halo y estela hacia dentro a lo largo
 * del arco, bordes del hueco con postes blancos y chispas. Las bolas siguen el radio real de daño.
 */
export function drawShockRing(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, gapAt: number, gap: number, type: string, color: number, t: number) {
  const fl = typeFlavor(type, color);
  const light = lightOf(fl.main);
  const from = gapAt + gap / 2;
  const span = TAU - gap;
  // Banda tenue del suelo
  g.lineStyle(14, fl.main, 0.18).beginPath().arc(cx, cy, r - 10, from, from + span).strokePath();
  const n = Math.max(6, Math.floor((span * r) / 30));
  for (let i = 0; i <= n; i++) {
    const a = from + (i / n) * span;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // Estela radial (de dentro hacia la bola)
    for (let j = 3; j >= 1; j--) dot(g, cx + ca * (r - j * PX * 1.4), cy + sa * (r - j * PX * 1.4), j === 1 ? light : j === 2 ? fl.main : darkOf(fl.main), 0.75 - j * 0.15);
    drawPixOrb(g, cx + ca * r, cy + sa * r, 9, fl.main, t + i * 60, 0.95);
    if ((i + Math.floor(t / 70)) % 5 === 0) flavorBit(g, cx + ca * (r + PX * 2), cy + sa * (r + PX * 2), fl, 0.2, i);
  }
  // Bordes del hueco: poste blanco que parpadea
  for (const e of [from, from + span]) {
    const ce = Math.cos(e);
    const se = Math.sin(e);
    for (let d = -18; d <= 18; d += PX) dot(g, cx + ce * (r + d), cy + se * (r + d), Math.abs(d) < 8 ? 0xffffff : fl.accent, Math.floor(t / 80) % 2 ? 1 : 0.7, PX, true);
  }
}

/** Golpe al soltar cada onda: anillo pixel, grietas de polvo y trozos. */
export function shockLaunch(sc: Phaser.Scene, x: number, y: number, type: string, color: number) {
  const fl = typeFlavor(type, color);
  pixRing(sc, x, y, 70, fl.main, 300, 7, 0.8);
  pixDebris(sc, x, y, fl.accent, 6, 0.6, 9);
}

// ---------------- Anillo de bolas ----------------

/** Aviso del anillo: N puntos alrededor del jefe que se encienden uno a uno y se cierran hacia él. */
export function ringWarn(sc: Phaser.Scene, at: Pos, n: number, off: number, color: number, ms: number, depth = 4) {
  const light = lightOf(color);
  animate(sc, depth, ms, (g, k, t) => {
    const { x, y } = at();
    const R = 120 - 60 * Phaser.Math.Easing.Cubic.In(k);
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * TAU;
      const on = i / n <= k * 1.3;
      const px = x + Math.cos(a) * R;
      const py = y + Math.sin(a) * R;
      dot(g, px, py, on ? (Math.floor(t / 80 + i) % 2 ? 0xffffff : light) : darkOf(color), on ? 1 : 0.5, PX + 2, true);
      if (on) for (let d = 1; d <= 2; d++) dot(g, px + Math.cos(a) * d * PX, py + Math.sin(a) * d * PX, color, 0.6 / d);
    }
  }, 50);
}

// ---------------- Láser giratorio ----------------

/** Aviso del láser: rayas de píxeles discontinuas que avanzan por donde saldrán los rayos. */
export function laserWarn(sc: Phaser.Scene, at: Pos, angles: number[], len: number, color: number, ms: number, depth = 4) {
  animate(sc, depth, ms, (g, k, t) => {
    const { x, y } = at();
    for (const a of angles) {
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (let d = 30; d < len; d += PX) {
        if (Math.floor((d - t * 0.4) / (PX * 3)) % 2) continue;
        dot(g, x + ca * d, y + sa * d, k > 0.66 && Math.floor(t / 70) % 2 ? 0xffffff : color, 0.75);
      }
    }
    drawPixOrb(g, x, y, 10 + 10 * k, color, t, 0.8);
  }, 50);
}

/** Un fotograma del láser (Graphics limpia): rayo pixel grueso como el Rayo, chispas en la boca. */
export function drawBossLaser(g: Phaser.GameObjects.Graphics, x: number, y: number, a: number, len: number, color: number, t: number) {
  drawPixBeam(g, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, 22, color, t);
}

// ---------------- Zona de peligro ----------------

/** Marca circular (redonda, como su hitbox) que se llena de fuera adentro y parpadea al final. Se destruye sola. */
export function hazardWarn(sc: Phaser.Scene, x: number, y: number, R: number, color: number, ms: number, depth = 3) {
  animate(sc, depth, ms, (g, k, t) => {
    g.fillStyle(0xff3d00, 0.1 + 0.25 * k).fillCircle(x, y, R);
    const fillR = R * Phaser.Math.Easing.Quadratic.In(k);
    g.fillStyle(color, 0.3).fillCircle(x, y, Math.max(PX, fillR));
    const blink = k > 0.7 && Math.floor(t / 70) % 2 === 0;
    for (let a = 0; a < TAU; a += PX / R) {
      if (Math.floor((a + t * 0.003) / 0.28) % 2) continue;
      dot(g, x + Math.cos(a) * R, y + Math.sin(a) * R, blink ? 0xffffff : 0xff3d00, 0.95, PX, true);
    }
    // Signo de peligro en el centro (triángulo con «!»)
    for (let row = 0; row < 4; row++) for (let c = -row; c <= row; c++) dot(g, x + c * PX, y - PX * 2 + row * PX, row === 3 || Math.abs(c) === row ? 0xffe066 : OUT, 0.9);
    dot(g, x, y - PX, 0xffe066, 0.9);
  }, 50);
}

/** Estallido de la zona: bola pixel redonda del tipo con anillo y trozos. */
export function hazardBlast(sc: Phaser.Scene, x: number, y: number, R: number, color: number, depth = 12) {
  const light = lightOf(color);
  animate(sc, depth, 300, (g, k) => {
    const r = R * (0.5 + 0.6 * Phaser.Math.Easing.Cubic.Out(k));
    for (const [f, c] of [[1, 0xff7043], [0.75, color], [0.5, light], [0.25, 0xffffff]] as [number, number][]) {
      const rr = r * f;
      for (let yy = -rr; yy <= rr; yy += PX) {
        const half = Math.sqrt(Math.max(0, rr * rr - yy * yy));
        g.fillStyle(c, 0.85 * (1 - k)).fillRect(snap(x - half), snap(y + yy), snap(half * 2) || PX, PX);
      }
    }
  }, 40);
  pixRing(sc, x, y, R * 1.1, color, 360, depth - 0.5, 1);
  pixDebris(sc, x, y, color, 6, 0.6, depth + 1);
}

// ---------------- Patrones de balas (estrella de 8, cruz, abanico, barrido) ----------------

/**
 * Aviso de un patrón: flechas pixel gordas que salen del jefe por cada dirección y avanzan, con el núcleo cargándose
 * (como el Torbellino). `sweep` dibuja además el arco que va a barrer.
 */
export function patternWarn(sc: Phaser.Scene, at: Pos, angles: number[], color: number, ms: number, sweep = false, depth = 4) {
  const light = lightOf(color);
  animate(sc, depth, ms, (g, k, t) => {
    const { x, y } = at();
    const blink = k > 0.6 && Math.floor(t / 70) % 2 === 0;
    for (const a of angles) {
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const len = 60 + 140 * Phaser.Math.Easing.Cubic.Out(k);
      // Raya de puntos que corre hacia fuera
      for (let d = 36; d < len; d += PX * 2) {
        if (Math.floor((d - t * 0.35) / (PX * 2)) % 3 === 0) continue;
        dot(g, x + ca * d, y + sa * d, blink ? 0xffffff : color, 0.8);
      }
      // Punta de flecha gorda (pixel) al final
      const hx = x + ca * len;
      const hy = y + sa * len;
      const nx = -sa;
      const ny = ca;
      for (let r = 0; r < 3; r++)
        for (let s = -r; s <= r; s++) dot(g, hx - ca * r * PX + nx * s * PX, hy - sa * r * PX + ny * s * PX, r === 0 || blink ? 0xffffff : light, 1, PX, true);
    }
    if (sweep && angles.length > 1) {
      for (let i = 0; i < angles.length - 1; i++) {
        const a = angles[i] + ((angles[i + 1] - angles[i]) * ((t / 40) % 1));
        dot(g, x + Math.cos(a) * 90, y + Math.sin(a) * 90, light, 0.7, PX + 2);
      }
    }
    drawPixOrb(g, x, y, 12 + 16 * k, color, t, 0.85);
  }, 50);
}

/** Destello de salida de cada ola: estrella de chispas en las direcciones disparadas. */
export function patternMuzzle(sc: Phaser.Scene, x: number, y: number, angles: number[], color: number) {
  animate(sc, 6, 220, (g, k) => {
    for (const a of angles) {
      const d = 26 + 30 * k;
      dot(g, x + Math.cos(a) * d, y + Math.sin(a) * d, k < 0.5 ? 0xffffff : color, 1 - k, PX + 2, true);
      dot(g, x + Math.cos(a) * (d - PX * 2), y + Math.sin(a) * (d - PX * 2), lightOf(color), (1 - k) * 0.7);
    }
  }, 40);
}
