// Barra de vida de jefe (pedido por Roberto, 27/10): nombre grande, título, ficha de tipo, marcas en los umbrales de
// fase, estela blanca del daño reciente y destello con sacudida al bajar de cada tramo. La del reto final es dorada y
// más gruesa. Coordenadas reales de pantalla (franja de arriba del HUD). Devuelve `set(ratio)` como addHpBar.
import Phaser from 'phaser';
import { FONT, hpColor, lowFx } from '../theme';
import { drawHudFrame } from './hud';
import { darkOf, lightOf, mixColor } from './pixelFx';

export interface BossHudOpts {
  x: number;
  w: number;
  label: string;
  title: string;
  typeLabel: string;
  color: number;
  final?: boolean;
  /** Umbrales de fase (0-1) en los que se dibuja una marca. */
  marks: readonly number[];
}

export function bossHud(sc: Phaser.Scene, o: BossHudOpts) {
  const final = !!o.final;
  const gold = 0xffd34d;
  const accent = final ? gold : o.color;
  const frame = drawHudFrame(sc.add.graphics(), o.x, 4, o.w, 52, final ? gold : o.color);
  // Nombre grande y título debajo
  const name = sc.add.text(o.x + 22, 22, o.label.toUpperCase(), { fontFamily: FONT, fontSize: final ? '26px' : '23px', fontStyle: 'bold', color: final ? '#ffe680' : '#f8f8f8' })
    .setOrigin(0, 0.5).setStroke('#101828', 5);
  const title = sc.add.text(o.x + 24, 44, o.title, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#' + lightOf(accent).toString(16).padStart(6, '0') })
    .setOrigin(0, 0.5).setStroke('#101828', 4);
  const left = o.x + 22 + Math.max(name.width, title.width) + 14;
  // Ficha del tipo (pixel)
  const chip = sc.add.graphics();
  const cw = 96;
  chip.fillStyle(0x101828, 1).fillRect(left - 2, 14, cw + 4, 28);
  chip.fillStyle(o.color, 1).fillRect(left, 16, cw, 24);
  chip.fillStyle(lightOf(o.color), 1).fillRect(left, 16, cw, 4);
  chip.fillStyle(darkOf(o.color), 1).fillRect(left, 36, cw, 4);
  const chipT = sc.add.text(left + cw / 2, 28, o.typeLabel.toUpperCase(), { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setStroke('#101828', 3);
  const bx = left + cw + 16;
  const bw = o.x + o.w - 20 - bx;
  const bh = final ? 20 : 16;
  const by = 30 - bh / 2 - (final ? 2 : 3);
  const g = sc.add.graphics();
  const fx = sc.add.graphics();
  let shown = 1;
  let trail = 1;
  let trailAt = 0;
  let flashUntil = 0;
  let last = 1;
  const low = lowFx();
  const paint = (now: number) => {
    g.clear();
    // Marco de la barra: doble, dorado en el final
    g.fillStyle(0x0a0f1c, 1).fillRect(bx - 6, by - 6, bw + 12, bh + 12);
    g.fillStyle(final ? 0x8a6a10 : darkOf(accent), 1).fillRect(bx - 4, by - 4, bw + 8, bh + 8);
    g.fillStyle(0x0a0f1c, 1).fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    g.fillStyle(0x2a3348, 1).fillRect(bx, by, bw, bh);
    // Estela del daño reciente (blanca) y la vida
    if (trail > shown) g.fillStyle(0xfff4d6, 0.9).fillRect(bx + bw * shown, by, bw * (trail - shown), bh);
    const fill = final ? mixColor(gold, 0xff6a2a, Math.max(0, 0.6 - shown)) : hpColor(shown);
    if (shown > 0) {
      const w = Math.max(4, bw * shown);
      g.fillStyle(fill, 1).fillRect(bx, by, w, bh);
      g.fillStyle(lightOf(fill), 1).fillRect(bx, by, w, Math.round(bh * 0.3));
      g.fillStyle(darkOf(fill), 1).fillRect(bx, by + bh - 3, w, 3);
      // Brillo que recorre la barra (animado)
      if (!low) {
        const sx = bx + ((now / (final ? 4 : 6)) % (bw + 60)) - 30;
        if (sx > bx && sx < bx + w - 8) g.fillStyle(0xffffff, final ? 0.55 : 0.35).fillRect(Math.round(sx / 4) * 4, by + 2, 8, bh - 4);
      }
    }
    // Marcas de fase: muesca oscura con un rombo arriba (apagado si ya se ha pasado)
    for (const m of o.marks) {
      const mx = Math.round(bx + bw * m);
      const past = shown < m;
      g.fillStyle(0x0a0f1c, 1).fillRect(mx - 2, by - 2, 4, bh + 4);
      g.fillStyle(past ? 0x5a6278 : final ? 0xfff0a0 : 0xffffff, 1).fillRect(mx - 1, by, 2, bh);
      g.fillStyle(past ? 0x5a6278 : accent, 1).fillRect(mx - 4, by - 9, 8, 4).fillRect(mx - 2, by - 11, 4, 8);
    }
    // Destello al cruzar un umbral
    fx.clear();
    if (now < flashUntil) {
      const k = (flashUntil - now) / 500;
      fx.fillStyle(0xffffff, 0.7 * k).fillRect(bx - 6, by - 6, bw + 12, bh + 12);
      fx.lineStyle(4, accent, k).strokeRect(o.x + 2, 6, o.w - 4, 48);
    } else if (final && !low) {
      // El final brilla siempre un poco (borde dorado que respira)
      fx.lineStyle(2, gold, 0.35 + 0.25 * Math.sin(now / 260)).strokeRect(o.x + 3, 7, o.w - 6, 46);
    }
  };
  paint(sc.time.now);
  const objects: Phaser.GameObjects.GameObject[] = [frame, g, fx, name, title, chip, chipT];
  const set = (ratio: number) => {
    const r = Math.max(0, Math.min(1, ratio));
    const now = sc.time.now;
    if (r < shown) {
      if (trail < shown) trail = shown;
      trailAt = now + 450;
    }
    shown = r;
    if (now > trailAt) trail = Math.max(shown, trail - 0.012);
    if (r > trail) trail = r;
    const crossed = o.marks.some((m) => last >= m && r < m);
    last = r;
    if (crossed) {
      flashUntil = now + 500;
      // Golpe: el marco y el nombre dan un salto
      if (!low) {
        for (const t of [name, title, chipT]) sc.tweens.add({ targets: t, y: t.y + 5, duration: 70, yoyo: true, repeat: 2 });
        sc.tweens.add({ targets: name, scale: 1.15, duration: 120, yoyo: true });
      }
    }
    paint(now);
  };
  return { set, objects, barX: bx, barW: bw };
}
