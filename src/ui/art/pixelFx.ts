// Efectos pixel art animados para los ataques especiales (supervisor), en el mismo estilo que el tornado: todo se
// dibuja con cuadrados de píxel gordo encajados en una rejilla y se redibuja a saltos (como un sprite), con el color
// del tipo, su versión clara y oscura, brillo blanco y contorno. Solo dibujo: el daño lo pone attacks.ts.
import Phaser from 'phaser';

export const PX = 6;
const OUT = 0x18202c;
const snap = (v: number) => Math.round(v / PX) * PX;

export function mixColor(a: number, b: number, t: number): number {
  const ch = (sh: number) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
export const lightOf = (c: number) => mixColor(c, 0xffffff, 0.45);
export const darkOf = (c: number) => mixColor(c, 0x000000, 0.35);

/** Un píxel gordo (con contorno opcional). */
function dot(g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, size = PX, outline = false) {
  const sx = snap(x);
  const sy = snap(y);
  if (outline) g.fillStyle(OUT, a).fillRect(sx - size / 2 - 2, sy - size / 2 - 2, size + 4, size + 4);
  g.fillStyle(c, a).fillRect(sx - size / 2, sy - size / 2, size, size);
}

/** Anima un dibujo a saltos (cada `step` ms) durante `ms`; `draw(g, k)` recibe el avance 0-1. */
export function animate(sc: Phaser.Scene, depth: number, ms: number, draw: (g: Phaser.GameObjects.Graphics, k: number, t: number) => void, step = 50) {
  const g = sc.add.graphics().setDepth(depth);
  const t0 = sc.time.now;
  const tick = () => {
    // `__pixFxK` (solo pruebas): congela el avance para poder ver un fotograma concreto
    const forced = (globalThis as { __pixFxK?: number }).__pixFxK;
    const k = forced ?? Math.min(1, (sc.time.now - t0) / ms);
    const t = forced !== undefined ? forced * ms : sc.time.now - t0;
    g.clear();
    draw(g, k, t);
    if (k >= 1) {
      ev.remove();
      g.destroy();
    }
  };
  const ev = sc.time.addEvent({ delay: step, loop: true, callback: tick });
  tick();
  return g;
}

/** Anillo de píxeles que se abre (onda de choque), en perspectiva (más ancho que alto). */
export function pixRing(sc: Phaser.Scene, x: number, y: number, radius: number, color: number, ms = 360, depth = 7, flat = 0.6) {
  const light = lightOf(color);
  animate(sc, depth, ms, (g, k) => {
    const r = radius * Phaser.Math.Easing.Cubic.Out(k);
    const a = 1 - k * 0.8;
    const step = (PX * 0.9) / Math.max(r, 10);
    for (let t = 0; t < Math.PI * 2; t += step) {
      const px = x + Math.cos(t) * r;
      const py = y + Math.sin(t) * r * flat;
      dot(g, px, py, darkOf(color), a * 0.8, PX + 6);
      dot(g, px, py, (t * 7) % 2 < 1 ? 0xffffff : light, a);
      // Segunda fila por dentro, del color del tipo
      dot(g, x + Math.cos(t) * (r - PX), y + Math.sin(t) * (r - PX) * flat, color, a * 0.9);
    }
  });
}

/** Trozos que saltan (rocas, chispas, gotas…) con contorno y gravedad. */
export function pixDebris(sc: Phaser.Scene, x: number, y: number, color: number, n = 10, power = 1, depth = 9) {
  const light = lightOf(color);
  const bits = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const v = (120 + Math.random() * 160) * power;
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 220 * power, s: Math.random() < 0.4 ? PX * 2 : PX, c: i % 3 === 0 ? light : i % 3 === 1 ? color : 0xffffff };
  });
  animate(sc, depth, 650, (g, k, t) => {
    const s = t / 1000;
    for (const b of bits) {
      const px = x + b.vx * s;
      const py = y + b.vy * s + 900 * s * s;
      dot(g, px, py, b.c, 1 - k * 0.7, b.s, true);
    }
  });
}

/** Explosión pixel: destello, anillo y trozos. */
export function pixBlast(sc: Phaser.Scene, x: number, y: number, radius: number, color: number, depth = 8) {
  const light = lightOf(color);
  animate(sc, depth, 260, (g, k) => {
    // Bola que crece y se apaga en anillos de color
    const r = radius * (0.35 + 0.65 * k);
    const layers: [number, number][] = [[1, darkOf(color)], [0.8, color], [0.55, light], [0.3, 0xffffff]];
    for (const [f, c] of layers) {
      const rr = r * f * (1 - k * 0.3);
      for (let yy = -rr; yy <= rr; yy += PX) {
        const half = Math.sqrt(Math.max(0, rr * rr - yy * yy));
        g.fillStyle(c, 1 - k * 0.85).fillRect(snap(x - half), snap(y + yy * 0.8), snap(half * 2) || PX, PX);
      }
    }
  });
  pixRing(sc, x, y, radius * 1.15, color, 380, depth - 0.5);
  pixDebris(sc, x, y, color, 8, 0.8, depth + 1);
}

/** Rayo quebrado de píxeles entre dos puntos. */
export function pixBolt(sc: Phaser.Scene, x1: number, y1: number, x2: number, y2: number, color: number, depth = 9) {
  const n = Math.max(4, Math.round(Math.hypot(x2 - x1, y2 - y1) / 40));
  const pts: [number, number][] = [[x1, y1]];
  for (let i = 1; i < n; i++) pts.push([Phaser.Math.Linear(x1, x2, i / n) + Phaser.Math.Between(-18, 18), Phaser.Math.Linear(y1, y2, i / n) + Phaser.Math.Between(-18, 18)]);
  pts.push([x2, y2]);
  const light = lightOf(color);
  animate(sc, depth, 240, (g, k) => {
    const a = k < 0.5 ? 1 : 1 - (k - 0.5) * 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const steps = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / (PX * 0.8)));
      for (let s = 0; s <= steps; s++) {
        const px = Phaser.Math.Linear(ax, bx, s / steps);
        const py = Phaser.Math.Linear(ay, by, s / steps);
        dot(g, px, py, color, a * 0.7, PX * 2.4);
        dot(g, px, py, s % 3 === 0 ? light : 0xffffff, a);
      }
    }
    // Chispas en los quiebros
    if (k < 0.5) for (const [px, py] of pts) if (Math.random() < 0.5) dot(g, px + Phaser.Math.Between(-12, 12), py + Phaser.Math.Between(-12, 12), 0xffffff, 1, PX, true);
  }, 40);
}

/** Géiser que brota del suelo: columna de píxeles que sube, se ensancha arriba y cae en gotas. */
export function pixGeyser(sc: Phaser.Scene, x: number, y: number, color: number, height = 120, width = 36, depth = 9) {
  width *= 1.6;
  const light = lightOf(color);
  const dark = darkOf(color);
  animate(sc, depth, 520, (g, k, t) => {
    const up = Math.min(1, k * 2.5);
    const fall = Math.max(0, (k - 0.5) * 2);
    const top = y - height * up;
    // Columna con bandas que suben
    for (let yy = y; yy > top; yy -= PX) {
      const f = (y - yy) / height;
      const w = width * (0.6 + f * 0.6) * (1 - fall * 0.7);
      const band = Math.floor((yy + t * 0.6) / (PX * 2)) % 3;
      for (let xx = -w / 2; xx <= w / 2; xx += PX) {
        const edge = Math.abs(xx) > w / 2 - PX;
        dot(g, x + xx + Math.sin(yy * 0.08 + t * 0.02) * 3, yy, edge ? dark : band === 0 ? 0xffffff : band === 1 ? light : color, 1 - fall);
      }
    }
    // Corona arriba
    if (up >= 1) for (let i = 0; i < 6; i++) {
      const a = Math.PI + (i / 5) * Math.PI;
      const r = width * (0.7 + fall * 1.4);
      dot(g, x + Math.cos(a) * r, top + Math.sin(a) * r * 0.5 + fall * 60, i % 2 ? light : 0xffffff, 1 - fall, PX, true);
    }
    // Grieta en el suelo
    g.fillStyle(0x000000, 0.35 * (1 - k)).fillEllipse(x, y + 4, width * 1.8, width * 0.5);
  });
}

/** Rayo grueso de píxeles (para el ataque 'beam'): borde de color, cuerpo claro y núcleo blanco que vibran. */
export function drawPixBeam(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, width: number, color: number, t: number) {
  const light = lightOf(color);
  const dark = darkOf(color);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / (len || 1);
  const uy = (y2 - y1) / (len || 1);
  const nx = -uy;
  const ny = ux;
  for (let d = 0; d < len; d += PX) {
    // Anillos de energía que viajan por el rayo
    const pulse = Math.sin(d * 0.06 - t * 0.03);
    const w = width * (0.85 + 0.2 * pulse);
    const cx = x1 + ux * d;
    const cy = y1 + uy * d;
    for (let o = -w / 2; o <= w / 2; o += PX) {
      const f = Math.abs(o) / (w / 2);
      const c = f > 0.85 ? dark : f > 0.55 ? color : f > 0.25 ? light : 0xffffff;
      g.fillStyle(c, 1).fillRect(snap(cx + nx * o) - PX / 2, snap(cy + ny * o) - PX / 2, PX, PX);
    }
    if (pulse > 0.95) g.fillStyle(0xffffff, 1).fillRect(snap(cx + nx * (w / 2 + PX)) - PX / 2, snap(cy + ny * (w / 2 + PX)) - PX / 2, PX, PX);
  }
  // Boca del rayo y destello al final
  for (const [px, py, r] of [[x1, y1, width * 0.75], [x2, y2, width * 0.55]] as const) {
    for (let yy = -r; yy <= r; yy += PX) {
      const half = Math.sqrt(Math.max(0, r * r - yy * yy));
      g.fillStyle(color, 1).fillRect(snap(px - half), snap(py + yy), snap(half * 2) || PX, PX);
      const hw = half * 0.55;
      g.fillStyle(0xffffff, 1).fillRect(snap(px - hw), snap(py + yy * 0.55), snap(hw * 2) || PX, PX);
    }
  }
}

/** Grietas de píxeles que salen del centro (para terremotos). */
export function pixCracks(sc: Phaser.Scene, x: number, y: number, radius: number, color: number, ms = 700, depth = 1.6) {
  const arms = Array.from({ length: 7 }, (_, i) => {
    let a = (i / 7) * Math.PI * 2 + Math.random() * 0.4;
    const pts: [number, number][] = [];
    let px = x;
    let py = y;
    for (let s = 0; s < radius / PX; s++) {
      a += (Math.random() - 0.5) * 0.5;
      px += Math.cos(a) * PX;
      py += Math.sin(a) * PX * 0.6;
      pts.push([px, py]);
    }
    return pts;
  });
  animate(sc, depth, ms, (g, k) => {
    const grow = Math.min(1, k * 2.2);
    const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    for (const pts of arms) {
      const n = Math.floor(pts.length * grow);
      for (let i = 0; i < n; i++) {
        dot(g, pts[i][0], pts[i][1], 0x1a120c, a, PX);
        if (i % 4 === 0) dot(g, pts[i][0], pts[i][1] - PX, color, a * 0.8, PX);
      }
    }
  });
}

/**
 * Runa de trampa en el suelo que late (para minas): sombra, anillo de runas que gira, rombo con contorno, cruz y ojo
 * central que parpadea; de vez en cuando suelta una chispa del tipo hacia arriba (reposo). Devuelve el gráfico para
 * destruirlo al estallar.
 */
export function pixTrap(sc: Phaser.Scene, x: number, y: number, radius: number, color: number, depth = 1.6) {
  const light = lightOf(color);
  const dark = darkOf(color);
  const g = sc.add.graphics().setDepth(depth);
  let t = 0;
  const sparks: { x: number; y: number; age: number }[] = [];
  const draw = () => {
    if (!g.active) return ev.remove();
    t += 1;
    g.clear();
    const beat = Math.sin(t * 0.8);
    const r = radius * 0.45 * (1 + 0.12 * beat);
    // Sombra y brillo del suelo
    g.fillStyle(0x000000, 0.22).fillEllipse(x, y + 3, radius * 1.5, radius * 0.75);
    g.fillStyle(color, 0.12 + 0.08 * Math.max(0, beat)).fillEllipse(x, y, radius * 1.3, radius * 0.65);
    // Anillo exterior de runas que gira despacio
    const R = radius * 0.68;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + t * 0.06;
      if (i % 4 === 3) continue;
      dot(g, x + Math.cos(a) * R, y + Math.sin(a) * R * 0.6, i % 4 === 0 ? light : dark, 0.85);
    }
    // Rombo con contorno
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const k = 1 / (Math.abs(c) + Math.abs(s));
      dot(g, x + c * k * r, y + s * k * r * 0.7, i % 2 ? color : light, 0.95, PX, true);
    }
    // Cruz interior y ojo
    for (let i = 1; i <= 2; i++) {
      dot(g, x + i * PX, y, dark, 0.9);
      dot(g, x - i * PX, y, dark, 0.9);
      dot(g, x, y + i * PX * 0.7, dark, 0.9);
      dot(g, x, y - i * PX * 0.7, dark, 0.9);
    }
    dot(g, x, y, t % 4 < 2 ? 0xffffff : color, 1, PX * 2, true);
    // Chispas que suben (vida en reposo)
    if (t % 5 === 0) sparks.push({ x: x + (Math.random() - 0.5) * r * 1.6, y: y + (Math.random() - 0.5) * r * 0.6, age: 0 });
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i];
      sp.age += 1;
      if (sp.age > 8) {
        sparks.splice(i, 1);
        continue;
      }
      dot(g, sp.x, sp.y - sp.age * 4, sp.age < 3 ? 0xffffff : light, 1 - sp.age / 9);
    }
  };
  const ev = sc.time.addEvent({ delay: 90, loop: true, callback: draw });
  draw();
  return g;
}

/**
 * Chorro pixel art (para 'stream'): cono que se abre desde la boca con contorno oscuro, cuerpo del color, banda clara
 * y núcleo blanco cerca de la boca; el final se deshace en píxeles sueltos. Se dibuja en un Graphics que ya existe.
 */
export function drawPixJet(g: Phaser.GameObjects.Graphics, x: number, y: number, ang: number, len: number, w0: number, w1: number, color: number, t: number, a = 1) {
  const light = lightOf(color);
  const dark = darkOf(color);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const nx = -uy;
  const ny = ux;
  const fr = Math.floor(t / 50);
  for (let d = PX; d < len; d += PX) {
    const f = d / len;
    const w = (w0 + (w1 - w0) * Math.sqrt(f)) * (0.9 + 0.15 * Math.sin(d * 0.15 - t * 0.04));
    const cx = x + ux * d;
    const cy = y + uy * d;
    const di = Math.round(d / PX);
    for (let o = -w / 2 - PX; o <= w / 2 + PX; o += PX) {
      const oi = Math.round(o / PX);
      // El final del chorro se rompe en trozos (tramado que cambia cada fotograma)
      if (f > 0.65 && ((di * 7 + oi * 3 + fr) % 5) < Math.floor((f - 0.65) * 14)) continue;
      const k = Math.abs(o) / (w / 2);
      let c: number;
      let al = a;
      if (k > 1) {
        c = OUT;
        al = a * 0.55;
      } else if (k > 0.75) c = dark;
      else if (k > 0.45) c = color;
      else if (k > 0.18 || f > 0.55) c = light;
      else c = 0xffffff;
      g.fillStyle(c, al).fillRect(snap(cx + nx * o) - PX / 2, snap(cy + ny * o) - PX / 2, PX, PX);
    }
  }
  // Boca: destello blanco con borde del color
  const r = Math.max(PX * 1.5, w0 * 0.9);
  for (let yy = -r; yy <= r; yy += PX) {
    const half = Math.sqrt(Math.max(0, r * r - yy * yy));
    g.fillStyle(color, a).fillRect(snap(x + ux * PX - half), snap(y + uy * PX + yy), snap(half * 2) || PX, PX);
    g.fillStyle(0xffffff, a).fillRect(snap(x + ux * PX - half * 0.5), snap(y + uy * PX + yy * 0.5), snap(half) || PX, PX);
  }
}

/** Orbe de energía pixel (halo detrás de proyectiles grandes): contorno, color, claro y centro blanco que late. */
export function drawPixOrb(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, t: number, a = 1) {
  const rr = r * (1 + 0.12 * Math.sin(t * 0.02));
  const layers: [number, number, number][] = [[1.18, OUT, 0.45], [1, darkOf(color), 0.8], [0.78, color, 0.9], [0.5, lightOf(color), 1], [0.25, 0xffffff, 1]];
  for (const [f, c, al] of layers) {
    const R = rr * f;
    for (let yy = -R; yy <= R; yy += PX) {
      const half = Math.sqrt(Math.max(0, R * R - yy * yy));
      g.fillStyle(c, al * a).fillRect(snap(x - half), snap(y + yy), snap(half * 2) || PX, PX);
    }
  }
}

/** Fogonazo de disparo pixel: estrella corta hacia delante con chispas y núcleo blanco. */
export function pixMuzzle(sc: Phaser.Scene, x: number, y: number, ang: number, color: number, size = 1, depth = 6) {
  const light = lightOf(color);
  const rays = [-0.9, -0.45, 0, 0.45, 0.9];
  animate(sc, depth, 160, (g, k) => {
    const a = 1 - k;
    const ox = x + Math.cos(ang) * 22;
    const oy = y + Math.sin(ang) * 22;
    for (const r of rays) {
      const aa = ang + r;
      const l = (r === 0 ? 30 : 16) * size * (0.5 + k);
      for (let d = 0; d < l; d += PX) dot(g, ox + Math.cos(aa) * d, oy + Math.sin(aa) * d, d < PX * 2 ? 0xffffff : r === 0 ? light : color, a);
    }
    dot(g, ox, oy, 0xffffff, a, PX * 2, true);
  }, 40);
}

/** Estela de velocidad (líneas de píxel detrás de algo que va rápido). */
export function pixSpeedLines(sc: Phaser.Scene, x: number, y: number, dx: number, dy: number, color: number, depth = 5) {
  const nx = -dy;
  const ny = dx;
  const lines = Array.from({ length: 4 }, () => ({ o: (Math.random() - 0.5) * 50, l: 30 + Math.random() * 40 }));
  animate(sc, depth, 200, (g, k) => {
    for (const ln of lines) {
      for (let d = 0; d < ln.l; d += PX) dot(g, x - dx * (d + 20 + k * 30) + nx * ln.o, y - dy * (d + 20 + k * 30) + ny * ln.o, d < PX * 2 ? 0xffffff : lightOf(color), 1 - k);
    }
  });
}

/**
 * Marca de aviso en el suelo (donde va a caer algo): anillo de píxeles a trozos que gira y cuatro esquinas de mira.
 * Se dibuja alrededor de (0, 0) y se coloca en (x, y), así se puede escalar con un tween. Se destruye a mano.
 */
export function pixMarker(sc: Phaser.Scene, x: number, y: number, radius: number, color: number, depth = 1.5) {
  const g = sc.add.graphics().setDepth(depth).setPosition(x, y);
  const light = lightOf(color);
  let t = 0;
  const draw = () => {
    if (!g.active) return ev.remove();
    t += 1;
    g.clear();
    g.fillStyle(color, 0.16).fillEllipse(0, 0, radius * 2, radius * 1.3);
    const step = (PX * 0.9) / radius;
    for (let a = 0; a < Math.PI * 2; a += step) {
      if (Math.floor((a + t * 0.12) / 0.35) % 2) continue;
      dot(g, Math.cos(a) * radius, Math.sin(a) * radius * 0.65, t % 6 < 3 ? light : color, 0.95);
    }
    // Esquinas de mira
    const r = radius * 0.45;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      for (let i = 0; i < 3; i++) {
        dot(g, sx * r - sx * i * PX, sy * r * 0.65, 0xffffff, 0.9);
        dot(g, sx * r, sy * r * 0.65 - sy * i * PX, 0xffffff, 0.9);
      }
    }
  };
  const ev = sc.time.addEvent({ delay: 80, loop: true, callback: draw });
  draw();
  return g;
}

/** Rayos de píxeles que salen disparados del centro (estallido de una onda): punta blanca, cuerpo claro y cola del color. */
export function pixSpokes(sc: Phaser.Scene, x: number, y: number, r0: number, r1: number, n: number, color: number, ms = 300, depth = 8, off = 0) {
  const light = lightOf(color);
  animate(sc, depth, ms, (g, k) => {
    const head = r0 + (r1 - r0) * Phaser.Math.Easing.Cubic.Out(k);
    const tailR = r0 + (r1 - r0) * Phaser.Math.Easing.Cubic.Out(Math.max(0, k - 0.25) / 0.75);
    const a = 1 - k * 0.6;
    for (let i = 0; i < n; i++) {
      const ang = off + (i / n) * Math.PI * 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang) * 0.75;
      for (let r = tailR; r <= head; r += PX) {
        const f = (head - r) / Math.max(1, head - tailR);
        dot(g, x + c * r, y + s * r, f < 0.2 ? 0xffffff : f < 0.55 ? light : color, a * (1 - f * 0.5), f < 0.3 ? PX : PX, f < 0.2);
      }
    }
  }, 40);
}

/** Disco de luz que se abre y se apaga (destello central, sin anillo ni trozos). */
export function pixFlash(sc: Phaser.Scene, x: number, y: number, radius: number, color: number, ms = 220, depth = 8) {
  const light = lightOf(color);
  animate(sc, depth, ms, (g, k) => {
    const r = radius * (0.5 + 0.5 * Phaser.Math.Easing.Cubic.Out(k));
    const layers: [number, number][] = [[1, color], [0.7, light], [0.4, 0xffffff]];
    for (const [f, c] of layers) {
      const rr = r * f;
      for (let yy = -rr; yy <= rr; yy += PX) {
        const half = Math.sqrt(Math.max(0, rr * rr - yy * yy));
        g.fillStyle(c, (1 - k) * (f === 1 ? 0.55 : 0.9)).fillRect(snap(x - half), snap(y + yy * 0.7), snap(half * 2) || PX, PX);
      }
    }
  }, 40);
}

/** Pinchos de roca que asoman del suelo y se hunden (terremotos): contorno, color del tipo, cara clara y punta blanca. */
export function pixSpikes(sc: Phaser.Scene, x: number, y: number, color: number, height = 30, ms = 420, depth = 2) {
  const light = lightOf(color);
  const dark = darkOf(color);
  animate(sc, depth, ms, (g, k) => {
    const up = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65;
    const h = height * Phaser.Math.Easing.Back.Out(Math.max(0, up));
    for (let yy = 0; yy < h; yy += PX) {
      const w = Math.max(1, Math.round(((h - yy) / h) * 3));
      for (let i = -w; i <= w; i++) {
        const c = i === -w || i === w ? OUT : i < 0 ? light : i === 0 && yy > h - PX * 2 ? 0xffffff : i === 0 ? color : dark;
        dot(g, x + i * PX, y - yy, c, up > 0 ? 1 : 0);
      }
    }
  }, 40);
}
