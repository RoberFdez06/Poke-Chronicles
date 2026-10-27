// Ambiente de la sala del jefe (pedido por Roberto, 27/10): la sala se tiñe del color del tema del jefe (el mismo de
// su arena de caída, arenaPhase.fallTheme), con viñeta que late, luz en el suelo y motas de su color que suben. En la
// fase 2 se intensifica. El reto final tiene una sala propia: gran sello dorado en el suelo, pilares con antorchas
// que se encienden al empezar y relámpagos. Con pocos efectos, solo el tinte y la viñeta quietos.
import Phaser from 'phaser';
import { darkOf, lightOf, mixColor, pixBolt, pixFlash } from './pixelFx';

export interface BossAmbienceOpts {
  x0: number;
  y0: number;
  w: number;
  h: number;
  /** Luz del tema (FALL_GLOW) y tinte (FALL_TINT). */
  glow: number;
  tint: number;
  final?: boolean;
  low?: boolean;
}

const snap = (v: number, s = 6) => Math.round(v / s) * s;

export function bossAmbience(sc: Phaser.Scene, o: BossAmbienceOpts) {
  const { x0, y0, w, h } = o;
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const final = !!o.final;
  const low = !!o.low;
  const gold = 0xffd34d;
  const glow = final ? mixColor(o.glow, gold, 0.5) : o.glow;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const timers: Phaser.Time.TimerEvent[] = [];
  let level = 1;
  const t0 = sc.time.now;

  // Sin tinte ni viñeta a franjas sobre el suelo: en arenas grandes se veían como un filtro con bandas y costuras
  const floor = sc.add.graphics().setDepth(0.44);
  objs.push(floor);
  const motes = sc.add.graphics().setDepth(4.2);
  objs.push(motes);

  // Motas que suben (posiciones fijas por semilla, se mueven con el tiempo)
  const N = Math.round((final ? 34 : 20) * Math.max(1, (w * h) / (880 * 560)));
  const seeds = Array.from({ length: N }, (_, i) => ({ x: ((i * 7919) % 997) / 997, sp: 0.4 + ((i * 131) % 17) / 17, ph: ((i * 613) % 101) / 101, big: i % 5 === 0 }));

  // Sala del final: sello, pilares y antorchas
  const pillars = final
    ? [[x0 + 70, y0 + 80], [x0 + w - 70, y0 + 80], [x0 + 70, y0 + h - 60], [x0 + w - 70, y0 + h - 60]].map(([x, y], i) => ({ x, y, litAt: t0 + (low ? 0 : 500 + i * 260) }))
    : [];
  const sealR = Math.min(w, h) * 0.36;
  const torches = sc.add.graphics().setDepth(1.2);
  if (final) objs.push(torches);

  const drawSeal = (g: Phaser.GameObjects.Graphics, t: number) => {
    const a = Math.min(1, (t - 200) / 900);
    if (a <= 0) return;
    const pulse = low ? 1 : 0.75 + 0.25 * Math.sin(t / 400);
    const ring = (r: number, c: number, alpha: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        g.fillStyle(c, alpha).fillRect(snap(cx + Math.cos(ang) * r) - 3, snap(cy + Math.sin(ang) * r * 0.62) - 3, 6, 6);
      }
    };
    ring(sealR, darkOf(gold), 0.55 * a, 120);
    ring(sealR - 8, gold, 0.75 * a * pulse, 110);
    ring(sealR * 0.62, gold, 0.6 * a * pulse, 76);
    // Estrella de 8 puntas que gira despacio
    const rot = low ? 0 : t / 6000;
    for (let k = 0; k < 8; k++) {
      const a1 = rot + (k / 8) * Math.PI * 2;
      const a2 = rot + ((k + 3) / 8) * Math.PI * 2;
      const steps = 22;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const px = cx + (Math.cos(a1) * (1 - u) + Math.cos(a2) * u) * sealR * 0.6;
        const py = cy + (Math.sin(a1) * (1 - u) + Math.sin(a2) * u) * sealR * 0.6 * 0.62;
        g.fillStyle(lightOf(gold), 0.45 * a * pulse).fillRect(snap(px) - 2, snap(py) - 2, 4, 4);
      }
    }
    // Runas alrededor (bloques que se encienden por turnos)
    for (let k = 0; k < 12; k++) {
      const ang = -rot * 2 + (k / 12) * Math.PI * 2;
      const rx = snap(cx + Math.cos(ang) * sealR * 0.82);
      const ry = snap(cy + Math.sin(ang) * sealR * 0.82 * 0.62);
      const on = low || Math.floor(t / 180) % 12 === k;
      g.fillStyle(on ? 0xffffff : gold, (on ? 0.9 : 0.5) * a).fillRect(rx - 6, ry - 3, 12, 6).fillRect(rx - 3, ry - 6, 6, 12);
    }
    // Brillo central
    g.fillStyle(gold, 0.12 * a * pulse).fillEllipse(cx, cy, sealR * 1.1, sealR * 0.7);
  };

  const drawPillar = (g: Phaser.GameObjects.Graphics, x: number, y: number, lit: number, t: number) => {
    // Columna de piedra con capitel
    g.fillStyle(0x101828, 1).fillRect(x - 17, y - 66, 34, 80);
    g.fillStyle(0x5a5470, 1).fillRect(x - 14, y - 60, 28, 72);
    g.fillStyle(0x7a7494, 1).fillRect(x - 14, y - 60, 8, 72);
    g.fillStyle(0x3a3650, 1).fillRect(x + 8, y - 60, 6, 72);
    g.fillStyle(0x101828, 1).fillRect(x - 22, y - 74, 44, 12).fillRect(x - 22, y + 10, 44, 10);
    g.fillStyle(0x8a84a8, 1).fillRect(x - 20, y - 72, 40, 8).fillRect(x - 20, y + 12, 40, 6);
    // Brasero
    g.fillStyle(0x101828, 1).fillRect(x - 14, y - 86, 28, 14);
    g.fillStyle(0x8a6a10, 1).fillRect(x - 12, y - 84, 24, 10);
    if (lit <= 0) return;
    // Llama pixel (animada) y halo
    const f = Math.min(1, lit);
    const fl = low ? 0 : Math.floor(t / 90);
    g.fillStyle(gold, 0.14 * f).fillCircle(x, y - 96, 46);
    const col = [0xff6a1a, 0xffa030, 0xffe066, 0xffffff];
    for (let i = 0; i < 4; i++) {
      const hgt = (32 - i * 7) * f + ((fl + i) % 3) * 3;
      const wid = 22 - i * 5;
      const sway = ((fl + i * 2) % 3) - 1;
      g.fillStyle(col[i], 1).fillRect(snap(x - wid / 2 + sway * 2, 2), snap(y - 86 - hgt, 2), wid, hgt);
    }
  };

  const paint = () => {
    const now = sc.time.now;
    const t = now - t0;
    floor.clear();
    motes.clear();
    // Luz del suelo: halo del color del tema que respira
    const breath = low ? 0.5 : 0.5 + 0.5 * Math.sin(t / (level > 1 ? 380 : 700));
    floor.fillStyle(glow, (0.06 + 0.05 * breath) * (level > 1 ? 1.5 : 1)).fillEllipse(cx, cy, w * 0.9, h * 0.8);
    if (!final) floor.fillStyle(glow, 0.04 * breath).fillEllipse(cx, cy, w * 0.5, h * 0.45);
    if (final) drawSeal(floor, t);
    if (low) return;
    // Motas que suben y parpadean
    for (const s of seeds) {
      const speed = (final ? 46 : 34) * s.sp * (level > 1 ? 1.6 : 1);
      const yy = y0 + h - (((t / 1000) * speed + s.ph * h) % h);
      const xx = x0 + s.x * w + Math.sin(t / 500 + s.ph * 6) * 10;
      const tw = 0.5 + 0.5 * Math.sin(t / 160 + s.ph * 20);
      const sz = s.big ? 8 : 4;
      motes.fillStyle(s.big ? lightOf(glow) : glow, 0.35 + 0.45 * tw).fillRect(snap(xx, 2), snap(yy, 2), sz, sz);
      if (final && s.big) motes.fillStyle(0xffffff, 0.6 * tw).fillRect(snap(xx, 2) + 2, snap(yy, 2) + 2, sz - 4, sz - 4);
    }
    if (final) {
      torches.clear();
      for (const p of pillars) drawPillar(torches, p.x, p.y, (now - p.litAt) / 300, t);
    }
  };
  if (final && low) {
    torches.clear();
    for (const p of pillars) drawPillar(torches, p.x, p.y, 1, 0);
  }
  paint();
  if (!low) timers.push(sc.time.addEvent({ delay: 60, loop: true, callback: paint }));
  // Antorchas: chispazo al encenderse
  if (final && !low) {
    for (const p of pillars) timers.push(sc.time.delayedCall(p.litAt - t0, () => pixFlash(sc, p.x, p.y - 96, 40, gold, 260, 4.3)));
  }
  // Relámpagos del final (cada 3-6 s; más a menudo en la fase 2)
  if (final && !low) {
    const strike = () => {
      const tx = x0 + 80 + Math.random() * (w - 160);
      const ty = y0 + 80 + Math.random() * (h - 160);
      pixBolt(sc, tx + (Math.random() - 0.5) * 120, y0 - 20, tx, ty, Math.random() < 0.5 ? 0xffffff : lightOf(glow), 4.4);
      pixFlash(sc, tx, ty, 50, lightOf(glow), 200, 4.4);
      sc.cameras.main.flash(90, 255, 250, 220);
      timers.push(sc.time.delayedCall((level > 1 ? 1800 : 3000) + Math.random() * 3000, strike));
    };
    timers.push(sc.time.delayedCall(1600, strike));
  }

  const api = {
    /** Fase 2: más luz, viñeta más fuerte y motas más rápidas. */
    intensify() {
      if (level > 1) return;
      level = 2;
      paint();
    },
    destroy() {
      timers.forEach((e) => e.remove());
      sc.tweens.add({ targets: objs, alpha: 0, duration: 900, onComplete: () => objs.forEach((g) => g.destroy()) });
    },
  };
  sc.events.once(Phaser.Scenes.Events.SHUTDOWN, () => timers.forEach((e) => e.remove()));
  return api;
}
