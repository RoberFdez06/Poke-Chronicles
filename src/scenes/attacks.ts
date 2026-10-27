// Motor de ataques (supervisor): saca y mueve los ataques del catálogo src/data/movePatterns.ts — chorros, rayos,
// ondas, lluvias, bombas en parábola, órbitas, olas, cadenas, erupciones, trampas, embestidas y remolinos — para el
// jugador y para enemigos y jefes. La partida (GameScene) le da un `AttackHost` con lo que necesita: crear
// proyectiles, hacer daño y saber dónde está cada uno.
import Phaser from 'phaser';
import type { Anim, Motion, Pattern } from '../data/movePatterns';
import { typeColor } from '../data/types';
import { typeImpact, typeTrail, projKey, projTailKey, fitProjectile, PROJ_FIT } from '../ui/art/typeFx';
import { dustBurst, hitSpark } from '../ui/art/combatFx';
import { animate, drawPixBeam, drawPixJet, drawPixOrb, lightOf, pixBlast, pixBolt, pixCracks, pixDebris, pixGeyser, pixMarker, pixMuzzle, pixRing, pixSpeedLines, pixTrap, pixFlash, pixSpokes, pixSpikes, darkOf, PX } from '../ui/art/pixelFx';
import { lowFx } from '../ui/theme';
import { clipBeamToBounds } from '../level/bounds';
import { drawJetFx, drawWaveFx, mineBlastFx, trapFx, waveBreakFx, waveLaunchFx } from '../ui/art/flowFx';

/** Mezcla dos colores (t = 0 → a, t = 1 → b). */
function mixColor(a: number, b: number, t: number): number {
  const ch = (sh: number) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

type Sprite = Phaser.Physics.Arcade.Sprite;
type Body = Phaser.Physics.Arcade.Body;
export type Side = 'player' | 'foe';

export interface ShootOpts {
  speed: number;
  size: number;
  type: string;
  dmg: number;
  life: number;
  pierce?: number;
  motion?: Motion;
  anim?: Anim;
  explode?: number;
}

export interface AttackHost {
  scene: Phaser.Scene;
  /** Crea un proyectil de ese lado en (x, y) hacia `angle` (radianes), ya volando. */
  shoot(side: Side, x: number, y: number, angle: number, o: ShootOpts): Sprite;
  /** Daño a todo lo que esté en el círculo (enemigos si es del jugador; el jugador si es de un enemigo). */
  area(side: Side, x: number, y: number, r: number, dmg: number, type: string, src: Sprite, once?: Set<object>): void;
  /** Daño a un enemigo concreto (cadenas). */
  hitOne(enemy: Sprite, dmg: number, type: string): void;
  enemies(): Sprite[];
  player(): Sprite;
  /** Hacia dónde apunta ahora el jugador (para chorros y rayos que siguen tu puntería). */
  aim(): Phaser.Math.Vector2;
  room(): { x0: number; y0: number; x1: number; y1: number };
  /** El jugador se lanza (embestida): mueve, protege y deja que el motor golpee. */
  dash(dir: Phaser.Math.Vector2, speed: number, ms: number): void;
  alive(): boolean;
}

const now = (h: AttackHost) => h.scene.time.now;
const later = (h: AttackHost, ms: number, fn: () => void) => h.scene.time.delayedCall(ms, () => h.alive() && fn());

/** El objetivo más cercano a (x, y): un enemigo (lado jugador) o el jugador (lado enemigo). */
export function nearestTarget(h: AttackHost, side: Side, x: number, y: number, exclude?: Set<object>, range = Infinity): Sprite | undefined {
  if (side === 'foe') return h.player();
  let best: Sprite | undefined;
  let bd = range;
  for (const e of h.enemies()) {
    if (!e.active || exclude?.has(e)) continue;
    const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** Distancia de un punto a un segmento. */
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  const t = Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Datos de movimiento de un proyectil (los lee updateShots). */
export function setMotion(s: Sprite, side: Side, angle: number, speed: number, motion: Motion | undefined, anim: Anim | undefined, owner: Sprite, t: number) {
  // Arte: escala del dibujo grande (el cuerpo de colisión no cambia), estela pegada y chispas al chocar
  fitProjectile(s);
  dressProjectile(s);
  s.setData('mv', motion).setData('anim', anim).setData('born', t).setData('ang', angle).setData('spd', speed);
  s.setData('side', side).setData('owner', owner).setData('baseScale', s.scaleX);
}

/** Tipo del proyectil a partir de su textura (`proj-fire` → `fire`). */
const projType = (s: Sprite) => s.texture.key.slice(5);

/**
 * Arte de cada proyectil (una vez): estela horneada que lo sigue (una imagen, sin Graphics) y, al desaparecer,
 * destello y chispas de su tipo si ha golpeado a algo (o una bocanada pequeña si se apaga sin dar).
 */
function dressProjectile(s: Sprite) {
  if (s.getData('dressed') || !s.texture.key.startsWith('proj-')) return;
  s.setData('dressed', true);
  const sc = s.scene;
  const type = projType(s);
  if (!lowFx()) {
    const tail = sc.add.image(s.x, s.y, projTailKey(type)).setOrigin(1, 0.5).setDepth(s.depth - 0.05).setVisible(false);
    s.setData('tail', tail).setData('x0', s.x).setData('y0', s.y);
    s.once(Phaser.GameObjects.Events.DESTROY, () => tail.destroy());
  }
  s.once(Phaser.GameObjects.Events.DESTROY, (_o: unknown, fromScene?: boolean) => {
    if (fromScene || !sc.sys.isActive()) return;
    const hit = (s.getData('hit') as Set<object> | undefined)?.size;
    const k = s.scaleX / PROJ_FIT / 2.2;
    if (lowFx()) {
      if (hit) typeImpact(sc, s.x, s.y, type, 0.6, 3);
      return;
    }
    if (!hit) {
      typeImpact(sc, s.x, s.y, type, 0.5 * k, 2);
      return;
    }
    const f = sc.add.image(s.x, s.y, 'proj-flash').setTint(0xffffff).setScale(2 * k).setDepth(8).setAngle(Phaser.Math.Between(0, 1) * 45);
    sc.tweens.add({ targets: f, scale: 4 * k, alpha: 0, angle: f.angle + 45, duration: 160, onComplete: () => f.destroy() });
    typeImpact(sc, s.x, s.y, type, 0.8 * k, 5);
  });
}

/** Coloca la estela detrás del proyectil según su velocidad, con un pequeño latido. */
function updateTail(s: Sprite, body: Body, t: number) {
  const tail = s.getData('tail') as Phaser.GameObjects.Image | undefined;
  if (!tail) return;
  const vx = body.velocity.x;
  const vy = body.velocity.y;
  const sp = Math.hypot(vx, vy);
  // Los chorros ya tienen su cuerpo; y la estela nunca asoma por detrás de quien dispara
  const x0 = s.getData('x0') as number | undefined;
  const y0 = s.getData('y0') as number | undefined;
  const gone = x0 === undefined || y0 === undefined ? 999 : Math.hypot(s.x - x0, s.y - y0);
  if (sp < 40 || !s.visible || s.getData('anim') === 'flicker' || gone < 8) {
    tail.setVisible(false);
    return;
  }
  const k = s.scaleX / PROJ_FIT; // escala que pidió la partida
  const len = Math.min(Phaser.Math.Clamp(sp / 360, 0.7, 1.5), gone / (36 * k * 0.8));
  tail
    .setVisible(true)
    .setPosition(s.x - (vx / sp) * 3 * k, s.y - (vy / sp) * 3 * k)
    .setRotation(Math.atan2(vy, vx))
    .setScale(k * 0.8 * len, k * 0.85 * (1 + 0.12 * Math.sin(t / 45)))
    .setAlpha(s.alpha * 0.9);
}

/**
 * Lanza un ataque. `dir` es la dirección (normalizada); `dmg`, el daño de cada golpe. Los enemigos lo usan con
 * velocidades más bajas (`slow`) para que se pueda esquivar.
 */
export function castPattern(h: AttackHost, side: Side, src: Sprite, dir: Phaser.Math.Vector2, p: Pattern, dmg: number, type: string, slow = 1) {
  const sc = h.scene;
  const color = typeColor(type);
  const ang = Math.atan2(dir.y, dir.x);
  const target = () => nearestTarget(h, side, src.x, src.y);
  const fire = (a: number, o: Partial<ShootOpts> & { speed: number; size: number }) => {
    const s = h.shoot(side, src.x, src.y, a, { type, dmg, life: 1100, ...o, speed: o.speed * slow });
    setMotion(s, side, a, o.speed * slow, o.motion, o.anim, src, now(h));
    return s;
  };

  switch (p.k) {
    case 'shot': {
      const one = () => {
        if (!src.active) return;
        const a0 = p.burst ? Math.atan2((side === 'player' ? h.aim() : dir).y, (side === 'player' ? h.aim() : dir).x) : ang;
        const n = p.burst ? 1 : p.n;
        // Fogonazo pixel en la boca (arte)
        if (!lowFx()) pixMuzzle(sc, src.x, src.y, a0, color, Math.min(1.4, p.size));
        for (let k = 0; k < n; k++) {
          const a = a0 + (n > 1 ? (k / (n - 1) - 0.5) * p.spread : 0);
          fire(a, { speed: p.speed, size: p.size, motion: p.motion, anim: p.anim, life: p.life ?? 1100, pierce: p.pierce, explode: p.explode });
        }
      };
      if (p.burst) for (let b = 0; b < p.burst; b++) later(h, b * (p.gap ?? 80), one);
      else one();
      break;
    }

    case 'stream': {
      // Chorro: partículas cortas con algo de dispersión mientras dura; sigue tu puntería
      // Arte: cuerpo del chorro (cono pixel con núcleo blanco) que sigue la puntería; las partículas hacen el daño
      if (!lowFx()) {
        const jg = sc.add.graphics().setDepth(3.9);
        const jt0 = now(h);
        const len = Phaser.Math.Clamp(p.speed * slow * (p.life / 1000) * 0.85, 140, 280);
        const w1 = Phaser.Math.Clamp(Math.tan(p.spread / 2) * len * 2.2, PX * 7, PX * 13);
        const je = sc.time.addEvent({
          delay: 40,
          loop: true,
          callback: () => {
            const el = now(h) - jt0;
            if (!src.active || !h.alive() || el > p.ms + 120) {
              je.remove();
              jg.destroy();
              return;
            }
            const d = side === 'player' ? h.aim() : new Phaser.Math.Vector2(h.player().x - src.x, h.player().y - src.y).normalize();
            const grow = Math.min(1, el / 120) * (el > p.ms ? 1 - (el - p.ms) / 120 : 1);
            jg.clear();
            drawJetFx(jg, src.x, src.y, Math.atan2(d.y, d.x), len * grow, len, PX * 3, w1, color, el, el > p.ms ? grow : 1, el < p.ms ? grow : 1);
          },
        });
      }
      const ev = sc.time.addEvent({
        delay: p.every,
        repeat: Math.max(0, Math.floor(p.ms / p.every) - 1),
        callback: () => {
          if (!src.active || !h.alive()) return ev.remove();
          const d = side === 'player' ? h.aim() : new Phaser.Math.Vector2(h.player().x - src.x, h.player().y - src.y).normalize();
          const a = Math.atan2(d.y, d.x) + (Math.random() - 0.5) * p.spread;
          const s = fire(a, { speed: p.speed * (0.85 + Math.random() * 0.3), size: p.size * (0.8 + Math.random() * 0.4), life: p.life, anim: 'flicker', pierce: 2 });
          sc.tweens.add({ targets: s, scale: s.scale * 1.6, alpha: 0.4, duration: p.life });
        },
      });
      break;
    }

    case 'beam': {
      // Rayo: aviso fino (enemigos) y luego un haz con núcleo blanco que golpea cada poco
      const g = sc.add.graphics().setDepth(6);
      const warn = side === 'foe' ? 600 : 90;
      const t0 = now(h) + warn;
      const hits = new Map<object, number>();
      const draw = () => {
        const t = now(h);
        const d = side === 'player' ? h.aim() : dir;
        let a = Math.atan2(d.y, d.x);
        if (p.sweep && t > t0) a += (((t - t0) / p.ms) - 0.5) * p.sweep;
        // El haz se corta en el borde de la arena: ni se dibuja ni golpea fuera del mapa
        const len = clipBeamToBounds(src.x, src.y, a, p.length, h.room());
        const x2 = src.x + Math.cos(a) * len;
        const y2 = src.y + Math.sin(a) * len;
        g.clear();
        if (t < t0) {
          g.lineStyle(4, color, 0.5).lineBetween(src.x, src.y, x2, y2);
          return { x2, y2, on: false };
        }
        // Rayo pixel art (supervisor): bandas de color con núcleo blanco y anillos de energía que viajan
        drawPixBeam(g, src.x, src.y, x2, y2, Math.max(PX * 3, p.width), color, t);
        return { x2, y2, on: true };
      };
      const ev = sc.time.addEvent({
        delay: 30,
        loop: true,
        callback: () => {
          if (!src.active || !h.alive() || now(h) > t0 + p.ms) {
            ev.remove();
            g.destroy();
            return;
          }
          const { x2, y2, on } = draw();
          if (!on) return;
          if (Math.random() < 0.5) typeTrail(sc, Phaser.Math.Linear(src.x, x2, Math.random()), Phaser.Math.Linear(src.y, y2, Math.random()), type, 1.2, 7);
          // Cada objetivo recibe un golpe cada 120 ms mientras está dentro
          const targets = side === 'player' ? h.enemies() : [h.player()];
          for (const e of targets) {
            if (!e.active) continue;
            const r = side === 'player' ? ((e.getData('size') as number) ?? 60) * 0.4 : 18;
            if (distToSegment(e.x, e.y, src.x, src.y, x2, y2) > p.width / 2 + r) continue;
            if ((hits.get(e) ?? 0) > now(h)) continue;
            hits.set(e, now(h) + 120);
            if (side === 'player') h.hitOne(e, dmg, type);
            else h.area('foe', e.x, e.y, 1, dmg, type, src);
          }
        },
      });
      break;
    }

    case 'nova': {
      const rings = p.rings ?? 1;
      for (let r = 0; r < rings; r++) {
        later(h, r * 170, () => {
          if (!src.active) return;
          const off = r * (Math.PI / p.n) + (side === 'foe' ? Math.random() : 0);
          pixRing(sc, src.x, src.y + 10, 70 + r * 20, color, 300, 6);
          // Arte: destello en el centro, rayos que salen entre los proyectiles y un segundo anillo más ancho
          if (!lowFx()) {
            pixFlash(sc, src.x, src.y, 46 + r * 8, color, 220, 8);
            pixSpokes(sc, src.x, src.y, 18, 110 + r * 20, p.n, color, 320, 7.5, off + Math.PI / p.n);
            if (r === 0) pixRing(sc, src.x, src.y + 10, 130, color, 420, 5.5, 0.62);
            sc.cameras.main.shake(70, 0.0025);
          }
          for (let k = 0; k < p.n; k++) fire(off + (k / p.n) * Math.PI * 2, { speed: p.speed, size: p.size, motion: p.motion, anim: p.anim, life: 900 });
        });
      }
      break;
    }

    case 'quake': {
      // Onda en el suelo: un anillo que se abre; golpea una vez a cada uno cuando le pasa por debajo
      const cx = src.x;
      const cy = src.y + 20;
      const once = new Set<object>();
      const g = sc.add.graphics().setDepth(1.5);
      const warn = side === 'foe' ? 500 : 0;
      if (warn) {
        const w = pixMarker(sc, cx, cy, p.radius, color);
        sc.tweens.add({ targets: w, alpha: 0.3, yoyo: true, repeat: 2, duration: warn / 6, onComplete: () => w.destroy() });
      }
      // Arte (enemigos): el suelo se carga antes de romper: anillo que se cierra hacia el centro
      if (warn && !lowFx()) pixRing(sc, cx, cy, p.radius, darkOf(color), warn, 1.55, 0.65);
      later(h, warn, () => {
        sc.cameras.main.shake(p.ms * 0.6, 0.008);
        dustBurst(sc, cx, cy, 1.6, 12);
        if (!lowFx()) {
          // Pisotón: destello en el centro y un pincho grande que sale y se hunde
          pixFlash(sc, cx, cy, 54, color, 240, 2);
          pixSpikes(sc, cx, cy + 4, color, 42, 520, 2.1);
        }
        const fancyQ = !lowFx();
        const spikeA = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2 + Math.random() * 0.3);
        pixCracks(sc, cx, cy, p.radius * 0.8, color, p.ms + 300);
        pixDebris(sc, cx, cy, color, 12, 1.1);
        const t0 = now(h);
        const ev = sc.time.addEvent({
          delay: 30,
          loop: true,
          callback: () => {
            const k = Math.min(1, (now(h) - t0) / p.ms);
            const r = p.radius * Phaser.Math.Easing.Cubic.Out(k);
            g.clear();
            if (fancyQ) {
              // Suelo hundido dentro de la onda y una segunda onda más baja detrás
              g.fillStyle(0x000000, 0.18 * (1 - k)).fillEllipse(cx, cy, r * 2, r * 1.3);
              g.fillStyle(color, 0.14 * (1 - k)).fillEllipse(cx, cy, r * 1.6, r * 1.04);
              const r2 = r * 0.72;
              const st2 = (PX * 1.2) / Math.max(r2, 10);
              for (let t = 0; t < Math.PI * 2; t += st2) {
                const px = Math.round((cx + Math.cos(t) * r2) / PX) * PX;
                const py = Math.round((cy + Math.sin(t) * r2 * 0.65) / PX) * PX;
                g.fillStyle(darkOf(color), 0.7 * (1 - k)).fillRect(px - PX / 2, py - PX / 2, PX, PX);
              }
              // Pinchos de roca que asoman en la cresta y se hunden detrás
              for (const a of spikeA) {
                const sx = Math.round((cx + Math.cos(a) * r) / PX) * PX;
                const sy = Math.round((cy + Math.sin(a) * r * 0.65) / PX) * PX;
                const hh = (k < 0.8 ? 1 : (1 - k) / 0.2) * (14 + 10 * Math.abs(Math.sin(a * 3)));
                for (let yy = 0; yy < hh; yy += PX) {
                  const w = Math.max(1, Math.round(((hh - yy) / hh) * 2));
                  g.fillStyle(0x18202c, 1).fillRect(sx - w * PX - 2, sy - yy - PX, w * 2 * PX + 4, PX);
                  g.fillStyle(lightOf(color), 1).fillRect(sx - w * PX, sy - yy - PX, w * PX, PX);
                  g.fillStyle(darkOf(color), 1).fillRect(sx, sy - yy - PX, w * PX, PX);
                }
                if (hh > PX) g.fillStyle(0xffffff, 1).fillRect(sx - PX / 2, sy - hh - PX, PX, PX);
              }
            }
            // Onda de tierra en píxeles: borde de rocas del color del tipo con cresta blanca
            const stepA = (PX * 0.9) / Math.max(r, 10);
            for (let t = 0; t < Math.PI * 2; t += stepA) {
              const px = Math.round((cx + Math.cos(t) * r) / PX) * PX;
              const py = Math.round((cy + Math.sin(t) * r * 0.65) / PX) * PX;
              g.fillStyle(0x18202c, 0.6 * (1 - k)).fillRect(px - PX, py - PX + 2, PX * 2, PX * 2);
              g.fillStyle(color, 1 - k).fillRect(px - PX, py - PX, PX * 2, PX);
              g.fillStyle((t * 5) % 2 < 1 ? 0xffffff : color, 1 - k).fillRect(px - PX / 2, py - PX, PX, PX);
            }
            if (Math.random() < 0.6) {
              const a = Math.random() * Math.PI * 2;
              typeImpact(sc, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.65, type, 0.6, 3);
            }
            h.area(side, cx, cy, r, dmg, type, src, once);
            if (k >= 1 || !h.alive()) {
              ev.remove();
              g.destroy();
            }
          },
        });
      });
      break;
    }

    case 'rain': {
      // Cae del cielo: marcas en el suelo y, al acabar el aviso, el golpe
      const t = target();
      const base = t ? { x: t.x, y: t.y } : { x: src.x + dir.x * 220, y: src.y + dir.y * 220 };
      const rm = h.room();
      for (let i = 0; i < p.n; i++) {
        later(h, i * p.spacing, () => {
          const first = i === 0;
          const x = Phaser.Math.Clamp(base.x + (first ? 0 : Phaser.Math.Between(-p.area / 2, p.area / 2)), rm.x0 + 30, rm.x1 - 30);
          const y = Phaser.Math.Clamp(base.y + (first ? 0 : Phaser.Math.Between(-p.area / 2, p.area / 2)), rm.y0 + 30, rm.y1 - 30);
          const mark = pixMarker(sc, x, y, p.radius, color);
          sc.tweens.add({ targets: mark, scale: { from: 1.3, to: 1 }, duration: p.delay });
          // Lo que cae: el dibujo del tipo, grande, desde arriba
          const fall = sc.add.image(x, y - 420, projKey(type)).setScale(4.5 * PROJ_FIT * 1.15).setDepth(12).setRotation(Math.PI / 2);
          // Arte: estela vertical de píxeles detrás de lo que cae (borde oscuro, color, claro y punta blanca)
          const streak = lowFx() ? undefined : sc.add.graphics().setDepth(11.9);
          const sl = lightOf(color);
          sc.tweens.add({
            targets: fall, y, duration: p.delay, ease: 'Quad.easeIn',
            onUpdate: (tw) => {
              if (!streak) return;
              streak.clear();
              const L = 30 + tw.progress * 90;
              for (let d = 0; d < L; d += PX) {
                const f = d / L;
                const w = f < 0.3 ? 3 : f < 0.7 ? 2 : 1;
                const yy = Math.round((fall.y - 14 - d) / PX) * PX;
                streak.fillStyle(0x18202c, 0.5 * (1 - f)).fillRect(x - (w + 1) * PX / 2 - 3, yy, (w + 1) * PX, PX);
                streak.fillStyle(f < 0.25 ? 0xffffff : f < 0.55 ? sl : color, 1 - f * 0.8).fillRect(x - w * PX / 2 - 3, yy, w * PX, PX);
              }
            },
            onComplete: () => {
              fall.destroy();
              streak?.destroy();
              sc.tweens.killTweensOf(mark);
              mark.destroy();
              if (!h.alive()) return;
              typeImpact(sc, x, y, type, 1, 6);
              pixBlast(sc, x, y, p.radius, color);
              sc.cameras.main.shake(90, 0.004);
              h.area(side, x, y, p.radius, dmg, type, src);
            },
          });
        });
      }
      break;
    }

    case 'lob': {
      // Bomba en parábola con su sombra; estalla al caer
      const t = target();
      for (let i = 0; i < p.n; i++) {
        const a = ang + (p.n > 1 ? (i / (p.n - 1) - 0.5) * p.spread : 0);
        const tx = p.dist === 0 && t ? t.x : src.x + Math.cos(a) * (p.dist || 260);
        const ty = p.dist === 0 && t ? t.y : src.y + Math.sin(a) * (p.dist || 260);
        const x0 = src.x;
        const y0 = src.y;
        const ms = (side === 'foe' ? 900 : 620) / slow;
        const shadow = sc.add.ellipse(x0, y0 + 20, 34, 12, 0x000000, 0.35).setDepth(1.5);
        const mark = side === 'foe' ? pixMarker(sc, tx, ty, p.radius, color) : !lowFx() ? pixMarker(sc, tx, ty, p.radius * 0.6, color).setAlpha(0.55) : undefined;
        const ball = sc.add.image(x0, y0, projKey(type)).setScale(3.6 * PROJ_FIT * 1.15).setDepth(12);
        // Arte: halo de energía detrás de la bomba y estela de píxeles que se apaga
        const glow = lowFx() ? undefined : sc.add.graphics().setDepth(11.9);
        const tail: [number, number][] = [];
        const lt = lightOf(color);
        const k = { v: 0 };
        sc.tweens.add({
          targets: k, v: 1, duration: ms, ease: 'Linear',
          onUpdate: () => {
            const x = Phaser.Math.Linear(x0, tx, k.v);
            const y = Phaser.Math.Linear(y0, ty, k.v);
            ball.setPosition(x, y - Math.sin(k.v * Math.PI) * 140).setAngle(k.v * 540);
            shadow.setPosition(x, y + 16).setScale(0.6 + 0.4 * Math.abs(k.v - 0.5) * 2);
            if (glow) {
              tail.unshift([ball.x, ball.y]);
              if (tail.length > 7) tail.pop();
              glow.clear();
              tail.forEach(([px, py], i) => {
                if (i === 0) return;
                const sz = PX * Math.max(1, 3 - i * 0.4);
                glow.fillStyle(0x18202c, 0.4 * (1 - i / 8)).fillRect(Math.round(px / PX) * PX - sz / 2 - 2, Math.round(py / PX) * PX - sz / 2 - 2, sz + 4, sz + 4);
                glow.fillStyle(i < 3 ? lt : color, 1 - i / 8).fillRect(Math.round(px / PX) * PX - sz / 2, Math.round(py / PX) * PX - sz / 2, sz, sz);
              });
              drawPixOrb(glow, ball.x, ball.y, 22, color, k.v * ms, 0.85);
            }
          },
          onComplete: () => {
            ball.destroy();
            shadow.destroy();
            mark?.destroy();
            glow?.destroy();
            if (!h.alive()) return;
            typeImpact(sc, tx, ty, type, 1, 6);
            dustBurst(sc, tx, ty, 1.1, 8);
            pixBlast(sc, tx, ty, p.radius, color);
            h.area(side, tx, ty, p.radius, dmg, type, src);
          },
        });
      }
      break;
    }

    case 'orbit': {
      // Giran a tu alrededor golpeando lo que tocan (cada uno puede volver a golpear al mismo cada 400 ms)
      const t0 = now(h);
      const orbs: { s: Sprite; phase: number }[] = [];
      for (let i = 0; i < p.n; i++) {
        const s = h.shoot(side, src.x, src.y, 0, { type, dmg, life: p.ms, speed: 0, size: p.size, pierce: 999 });
        s.setData('orbit', { src, r: p.radius, phase: (i / p.n) * Math.PI * 2, t0 }).setData('rehit', 400);
        setMotion(s, side, 0, 0, undefined, 'spin', src, t0);
        orbs.push({ s, phase: (i / p.n) * Math.PI * 2 });
      }
      // Arte: anillo de órbita que gira, halo detrás de cada uno y estela en arco (mismo cálculo que updateShots)
      if (!lowFx()) {
        const og = sc.add.graphics().setDepth(3.9);
        const ol = lightOf(color);
        const oe = sc.time.addEvent({
          delay: 40,
          loop: true,
          callback: () => {
            const live = orbs.filter((o) => o.s.active);
            if (!src.active || !h.alive() || !live.length) {
              oe.remove();
              og.destroy();
              return;
            }
            const tt = now(h);
            const turn = ((tt - t0) / 1000) * 5;
            og.clear();
            const R = p.radius;
            const step = (PX * 0.9) / R;
            for (let a = 0; a < Math.PI * 2; a += step) {
              if (Math.floor((a - turn * 0.3) / 0.4) % 2) continue;
              og.fillStyle(a % 1.2 < 0.4 ? ol : color, 0.45).fillRect(Math.round((src.x + Math.cos(a) * R) / PX) * PX - PX / 2, Math.round((src.y + Math.sin(a) * R * 0.8) / PX) * PX - PX / 2, PX, PX);
            }
            for (const o of live) {
              const a = o.phase + turn;
              for (let j = 1; j <= 10; j++) {
                const b = a - j * 0.1;
                const sz = PX * (j < 6 ? 2 : 1);
                const x = Math.round((src.x + Math.cos(b) * R) / PX) * PX;
                const y = Math.round((src.y + Math.sin(b) * R * 0.8) / PX) * PX;
                og.fillStyle(j < 3 ? 0xffffff : j < 6 ? ol : color, 1 - j / 11).fillRect(x - sz / 2, y - sz / 2, sz, sz);
              }
              drawPixOrb(og, src.x + Math.cos(a) * R, src.y + Math.sin(a) * R * 0.8, 12 + p.size * 8, color, tt - t0 + o.phase * 300, 0.9);
            }
          },
        });
      }
      break;
    }

    case 'wall': {
      // Ola: fila perpendicular a la dirección que avanza junta
      const px = -dir.y;
      const py = dir.x;
      const row: Sprite[] = [];
      for (let i = 0; i < p.n; i++) {
        const off = (i - (p.n - 1) / 2) * p.gap;
        const s = h.shoot(side, src.x + px * off + dir.x * 24, src.y + py * off + dir.y * 24, ang, { type, dmg, life: p.life, speed: p.speed * slow, size: p.size, pierce: 2 });
        setMotion(s, side, ang, p.speed * slow, undefined, 'wobble', src, now(h));
        row.push(s);
      }
      // Arte: cresta de ola que une la fila (espuma blanca delante, cuerpo del color y borde oscuro detrás) con salpicones
      if (!lowFx()) {
        const wg = sc.add.graphics().setDepth(3.9);
        const wt0 = now(h);
        let last: { x: number; y: number }[] = [];
        waveLaunchFx(sc, src.x + dir.x * 24, src.y + dir.y * 24, { x: px, y: py }, (p.n - 1) * p.gap, color);
        const we = sc.time.addEvent({
          delay: 40,
          loop: true,
          callback: () => {
            if (!h.alive() || !row.some((r) => r.active)) {
              we.remove();
              wg.destroy();
              if (h.alive()) waveBreakFx(sc, last, color);
              return;
            }
            const tt = now(h) - wt0;
            const al = Math.min(1, Math.max(0.15, 1 - (tt - p.life * 0.7) / (p.life * 0.3)));
            last = row.filter((r) => r.active).map((r) => ({ x: r.x, y: r.y }));
            wg.clear();
            drawWaveFx(wg, row, dir, { x: px, y: py }, tt, color, al);
          },
        });
      }
      break;
    }

    case 'chain': {
      // Descarga que salta de un enemigo a otro con un rayo quebrado
      const hit = new Set<object>();
      let from = { x: src.x, y: src.y };
      const jump = (k: number) => {
        if (k >= p.jumps || !h.alive()) return;
        const e = nearestTarget(h, side, from.x, from.y, hit, k === 0 ? p.range * 1.5 : p.range);
        if (!e) return;
        hit.add(e);
        pixBolt(sc, from.x, from.y, e.x, e.y, color);
        hitSpark(sc, e.x, e.y, color, 6, 1);
        if (side === 'player') h.hitOne(e, dmg, type);
        else h.area('foe', e.x, e.y, 1, dmg, type, src);
        from = { x: e.x, y: e.y };
        later(h, 90, () => jump(k + 1));
      };
      jump(0);
      break;
    }

    case 'eruption': {
      // Columnas que brotan del suelo una tras otra en línea
      const warn = side === 'foe' ? 450 : 0;
      const fancyE = !lowFx();
      // Arte: una fisura incandescente recorre el suelo por delante de las columnas (un solo Graphics)
      if (fancyE) {
        const fx0 = src.x;
        const fy0 = src.y + 10;
        const total = warn + p.steps * p.every + 700;
        const reach = p.gap * (p.steps + 0.4);
        const jit = Array.from({ length: 64 }, () => (Math.random() - 0.5) * PX * 1.6);
        const el = lightOf(color);
        animate(sc, 1.6, total, (g, k, tt) => {
          const head = Math.min(1, tt / Math.max(1, warn + (p.steps - 1) * p.every + 1)) * reach;
          const fade = tt > total - 400 ? (total - tt) / 400 : 1;
          let i = 0;
          for (let d = PX * 3; d < head; d += PX, i++) {
            const nx = -dir.y * jit[i % 64];
            const ny = dir.x * jit[i % 64];
            const x = Math.round((fx0 + dir.x * d + nx) / PX) * PX;
            const y = Math.round((fy0 + dir.y * d + ny) / PX) * PX;
            const hot = head - d < PX * 6;
            g.fillStyle(0x1a120c, 0.85 * fade).fillRect(x - PX, y - PX / 2, PX * 2, PX);
            g.fillStyle(hot ? 0xffffff : (i + Math.floor(tt / 80)) % 3 ? color : el, (hot ? 1 : 0.8) * fade).fillRect(x - PX / 2, y - PX / 2, PX, PX / 2 + 1);
          }
        }, 40);
      }
      for (let i = 0; i < p.steps; i++) {
        const x = src.x + dir.x * p.gap * (i + 1);
        const y = src.y + dir.y * p.gap * (i + 1) + 10;
        if (warn) {
          const m = pixMarker(sc, x, y, p.radius, color);
          later(h, warn + i * p.every, () => m.destroy());
        }
        later(h, warn + i * p.every, () => {
          // Grieta en el suelo y un géiser del tipo que sale hacia arriba
          const crack = sc.add.ellipse(x, y, p.radius * 1.6, p.radius * 0.6, 0x000000, 0.35).setDepth(1.5);
          sc.tweens.add({ targets: crack, alpha: 0, duration: 700, delay: 200, onComplete: () => crack.destroy() });
          // Géiser pixel art (supervisor) del color del tipo
          pixGeyser(sc, x, y, color, 100 + p.radius * 0.6, Math.max(30, p.radius * 0.8));
          typeImpact(sc, x, y - 30, type, 0.9, 5);
          dustBurst(sc, x, y, 0.9, 6);
          if (fancyE) {
            // Base del géiser: destello, onda de choque, trozos que saltan y temblor corto
            pixFlash(sc, x, y, p.radius * 0.9, color, 200, 8.5);
            pixRing(sc, x, y + 4, p.radius * 1.2, color, 320, 1.7, 0.5);
            pixDebris(sc, x, y - 10, color, 6, 0.8, 10);
            sc.cameras.main.shake(70, 0.003);
          }
          h.area(side, x, y, p.radius, dmg, type, src);
        });
      }
      break;
    }

    case 'mine': {
      // Trampas en el suelo delante de ti: laten y estallan cuando alguien las pisa
      for (let i = 0; i < p.n; i++) {
        const d = 90 + i * 55;
        const a = ang + (Math.random() - 0.5) * 0.9;
        const rm = h.room();
        const x = Phaser.Math.Clamp(src.x + Math.cos(a) * d, rm.x0 + 20, rm.x1 - 20);
        const y = Phaser.Math.Clamp(src.y + Math.sin(a) * d, rm.y0 + 20, rm.y1 - 20);
        // Runa de trampa pixel art que late (supervisor)
        const m = trapFx(sc, x, y, p.radius, color, p.life);
        const t0 = now(h);
        const ev = sc.time.addEvent({
          delay: 90,
          loop: true,
          callback: () => {
            const gone = !h.alive() || now(h) - t0 > p.life;
            const near = !gone && nearestTarget(h, side, x, y, undefined, p.radius * 0.7);
            if (!gone && !near) return;
            ev.remove();
            m.destroy();
            if (gone) return;
            typeImpact(sc, x, y, type, 1, 6);
            mineBlastFx(sc, x, y, p.radius, color);
            h.area(side, x, y, p.radius, dmg, type, src);
          },
        });
      }
      break;
    }

    case 'dash': {
      // Embestida (solo el jugador): sales disparado y golpeas a todo lo que tocas, con estela
      if (side !== 'player') break;
      const once = new Set<object>();
      const speed = (p.dist / p.ms) * 1000;
      h.dash(dir, speed, p.ms);
      // Arte: onda de arranque detrás, frente de choque en forma de arco delante y golpe de polvo al frenar
      const fancy = !lowFx();
      const bow = fancy ? sc.add.graphics().setDepth(src.depth + 0.1) : undefined;
      if (fancy) {
        pixRing(sc, src.x, src.y + 10, 46, color, 260, 3, 0.55);
        pixMuzzle(sc, src.x, src.y, Math.atan2(-dir.y, -dir.x), color, 1.2, 5);
        later(h, p.ms, () => {
          bow?.destroy();
          if (!src.active) return;
          dustBurst(sc, src.x, src.y + 14, 1.2, 8);
          pixRing(sc, src.x, src.y + 14, p.radius * 1.2, color, 300, 3, 0.55);
        });
      }
      const bl = lightOf(color);
      let bt = 0;
      const ev = sc.time.addEvent({
        delay: 30,
        repeat: Math.ceil(p.ms / 30),
        callback: () => {
          if (!src.active || !h.alive()) {
            bow?.destroy();
            return ev.remove();
          }
          if (bow?.active) {
            bt += 1;
            bow.clear();
            const a0 = Math.atan2(dir.y, dir.x);
            for (let row = 0; row < 3; row++) {
              const R = p.radius * 0.7 - row * PX;
              for (let a = -1.1; a <= 1.1; a += (PX * 0.9) / R) {
                const x = Math.round((src.x + Math.cos(a0 + a) * R) / PX) * PX;
                const y = Math.round((src.y + Math.sin(a0 + a) * R) / PX) * PX;
                const edge = Math.abs(a) > 0.8;
                const c = row === 0 ? (edge ? color : 0xffffff) : row === 1 ? bl : color;
                bow.fillStyle(c, (row === 0 ? 1 : 0.7) * (edge ? 0.6 : 1) * (bt % 2 ? 1 : 0.85)).fillRect(x - PX / 2, y - PX / 2, PX, PX);
              }
            }
          }
          const ghost = sc.add.image(src.x, src.y, src.texture.key, src.frame.name).setScale(src.scaleX, src.scaleY).setFlipX(src.flipX)
            .setTintFill(color).setAlpha(0.5).setDepth(src.depth - 0.1);
          sc.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
          typeTrail(sc, src.x, src.y, type, 1.3, 6);
          if (Math.random() < 0.5) pixSpeedLines(sc, src.x, src.y, dir.x, dir.y, color);
          h.area(side, src.x, src.y, p.radius, dmg, type, src, once);
        },
      });
      break;
    }

    case 'vortex': {
      // Remolino que avanza y se queda girando: atrapa y golpea a quien esté dentro
      const x0 = src.x;
      const y0 = src.y;
      // El remolino se queda dentro de la sala (si no, arrastraba a los enemigos al otro lado de la pared)
      const rmV = h.room();
      const tx = Phaser.Math.Clamp(x0 + dir.x * p.dist, rmV.x0 + 50, rmV.x1 - 50);
      const ty = Phaser.Math.Clamp(y0 + dir.y * p.dist, rmV.y0 + 50, rmV.y1 - 50);
      const c = sc.add.container(x0, y0).setDepth(7);
      // Tornado pixel art (supervisor): embudo de anillos que giran, más ancho arriba, con sombra en el suelo y
      // escombros dando vueltas. Se redibuja a saltos (como un sprite) para que se vea pixelado y no como líneas.
      const R = p.radius;
      const light = mixColor(color, 0xffffff, 0.45);
      const dark = mixColor(color, 0x000000, 0.35);
      const ground = sc.add.graphics();
      ground.fillStyle(0x000000, 0.28).fillEllipse(0, 0, R * 1.5, R * 0.45);
      ground.lineStyle(4, color, 0.45).strokeEllipse(0, 0, R * 1.7, R * 0.55);
      const g = sc.add.graphics();
      c.add([ground, g]);
      const PX = 6;
      const LAYERS = 9;
      let phase = 0;
      const ring = (k: number) => {
        const f = k / (LAYERS - 1);
        const rx = R * (0.16 + 0.6 * f * f + 0.1 * f);
        return {
          rx,
          ry: rx * 0.3,
          cy: -k * R * 0.13 + Math.sin(phase * 0.7 + k) * 2,
          cx: Math.sin(phase * 0.45 + k * 0.5) * R * 0.1 * f,
        };
      };
      const snap = (v: number) => Math.round(v / PX) * PX;
      const draw = () => {
        if (!c.active) return;
        g.clear();
        phase += 0.5;
        // Cuerpo del embudo: contorno oscuro y relleno translúcido del color del tipo (anillos solapados)
        for (let k = 0; k < LAYERS; k++) {
          const r = ring(k);
          g.fillStyle(0x18202c, 0.35).fillEllipse(r.cx, r.cy, r.rx * 2 + 8, r.ry * 2 + 8);
        }
        for (let k = 0; k < LAYERS; k++) {
          const r = ring(k);
          g.fillStyle(k % 2 ? color : dark, 0.6).fillEllipse(r.cx, r.cy, r.rx * 2, r.ry * 2);
        }
        // Jirones de viento que giran: detrás oscuros, delante claros con brillo blanco
        for (const front of [false, true]) {
          for (let k = 0; k < LAYERS; k++) {
            const r = ring(k);
            const step = (PX * 0.9) / r.rx;
            for (let a = 0; a < Math.PI * 2; a += step) {
              const sinA = Math.sin(a);
              if ((sinA > 0) !== front) continue;
              const band = (((a + phase + k * 0.7) % ((Math.PI * 2) / 3)) + Math.PI * 2) % ((Math.PI * 2) / 3);
              if (band > 1.5) continue;
              const x = snap(r.cx + Math.cos(a) * r.rx);
              const y = snap(r.cy + sinA * r.ry);
              const col = !front ? dark : band < 0.3 ? 0xffffff : band < 0.9 ? light : color;
              g.fillStyle(col, 1).fillRect(x - PX / 2, y - PX / 2, PX, PX);
            }
          }
        }
        // Escombros (hojas, piedras, chispas del color del tipo) dando vueltas
        for (let d = 0; d < 6; d++) {
          const a = phase * 1.3 + d * 1.05;
          const h = -(d % 3) * R * 0.32 - R * 0.15;
          const rx = R * (0.35 + (d % 3) * 0.18);
          const x = Math.round((Math.cos(a) * rx) / PX) * PX;
          const y = Math.round((h + Math.sin(a) * rx * 0.28) / PX) * PX;
          g.fillStyle(0x18202c, 1).fillRect(x - 4, y - 4, 8, 8);
          g.fillStyle(d % 2 ? light : color, 1).fillRect(x - 2, y - 2, 4, 4);
        }
      };
      draw();
      const spin = sc.time.addEvent({ delay: 60, loop: true, callback: () => (c.active ? draw() : spin.remove()) });
      sc.tweens.add({ targets: c, x: tx, y: ty, duration: 550 / slow, ease: 'Cubic.easeOut' });
      c.setScale(0.3);
      sc.tweens.add({ targets: c, scale: 1, duration: 300 });
      const t0 = now(h);
      const ev = sc.time.addEvent({
        delay: 240,
        loop: true,
        callback: () => {
          if (!h.alive() || now(h) - t0 > p.ms) {
            ev.remove();
            sc.tweens.add({ targets: c, scale: 0, alpha: 0, duration: 200, onComplete: () => c.destroy() });
            return;
          }
          typeTrail(sc, c.x + Phaser.Math.Between(-30, 30), c.y + Phaser.Math.Between(-20, 20), type, 1.3, 8);
          h.area(side, c.x, c.y, p.radius, dmg, type, src);
          // Arrastra hacia el centro (no a los jefes ni al jugador)
          if (side === 'player') {
            for (const e of h.enemies()) {
              const ai = e.getData('ai') as { boss?: boolean; knockUntil: number } | undefined;
              if (!e.active || ai?.boss || Phaser.Math.Distance.Between(e.x, e.y, c.x, c.y) > p.radius * 1.4) continue;
              e.setVelocity((c.x - e.x) * 2.2, (c.y - e.y) * 2.2);
              if (ai) ai.knockUntil = now(h) + 200;
              // Nunca fuera de la sala
              const rm = h.room();
              const cx = Phaser.Math.Clamp(e.x, rm.x0 + 20, rm.x1 - 20);
              const cy = Phaser.Math.Clamp(e.y, rm.y0 + 20, rm.y1 - 20);
              if (cx !== e.x || cy !== e.y) (e.body as Body).reset(cx, cy);
            }
          }
        },
      });
      break;
    }
  }
}


/**
 * Mueve y anima los proyectiles de un grupo cada fotograma: ondas, zigzag, aceleración, persecución, bumerán,
 * espiral, órbitas, y latido/parpadeo/bamboleo.
 */
export function updateShots(h: AttackHost, group: Phaser.Physics.Arcade.Group, time: number, dt: number) {
  for (const c of group.getChildren()) {
    const s = c as Sprite;
    const body = s.body as Body | null;
    if (!s.active || !body) continue;
    const born = (s.getData('born') as number | undefined) ?? time;
    const t = time - born;
    const side = (s.getData('side') as Side | undefined) ?? 'player';

    const orbit = s.getData('orbit') as { src: Sprite; r: number; phase: number; t0: number } | undefined;
    if (orbit) {
      if (!orbit.src.active) {
        s.destroy();
        continue;
      }
      const a = orbit.phase + ((time - orbit.t0) / 1000) * 5;
      body.reset(orbit.src.x + Math.cos(a) * orbit.r, orbit.src.y + Math.sin(a) * orbit.r * 0.8);
      const re = s.getData('rehit') as number | undefined;
      if (re && time >= ((s.getData('rehitAt') as number | undefined) ?? 0)) {
        (s.getData('hit') as Set<Sprite> | undefined)?.clear();
        s.setData('rehitAt', time + re);
      }
    }

    const mv = s.getData('mv') as Motion | undefined;
    const spd = (s.getData('spd') as number | undefined) ?? 0;
    let ang = (s.getData('ang') as number | undefined) ?? 0;
    if (mv && spd > 0) {
      let a = ang;
      let speed = spd;
      let extra = new Phaser.Math.Vector2(0, 0);
      switch (mv.m) {
        case 'wave': {
          const w = 2 * Math.PI * mv.freq;
          const lateral = mv.amp * w * Math.cos(w * (t / 1000));
          extra = new Phaser.Math.Vector2(-Math.sin(ang), Math.cos(ang)).scale(lateral);
          break;
        }
        case 'zigzag':
          a = ang + (Math.floor(t / mv.every) % 2 ? 1 : -1) * (mv.angle / 2);
          break;
        case 'accel':
          speed = spd * Phaser.Math.Linear(1, mv.to, Math.min(1, t / mv.ms));
          break;
        case 'homing': {
          if (t >= (mv.delay ?? 0)) {
            const tg = nearestTarget(h, side, s.x, s.y, undefined, side === 'player' ? 520 : Infinity);
            if (tg) {
              const want = Math.atan2(tg.y - s.y, tg.x - s.x);
              const diff = Phaser.Math.Angle.Wrap(want - ang);
              const step = mv.turn * (dt / 1000);
              ang += Phaser.Math.Clamp(diff, -step, step);
              s.setData('ang', ang);
            }
          }
          a = ang;
          break;
        }
        case 'boomerang': {
          if (t > mv.outMs) {
            const o = s.getData('owner') as Sprite | undefined;
            if (!o?.active) {
              s.destroy();
              continue;
            }
            a = Math.atan2(o.y - s.y, o.x - s.x);
            speed = spd * 1.15;
            if (Phaser.Math.Distance.Between(o.x, o.y, s.x, s.y) < 30) {
              s.destroy();
              continue;
            }
            if (!s.getData('back')) {
              s.setData('back', true);
              (s.getData('hit') as Set<Sprite> | undefined)?.clear(); // a la vuelta puede volver a dar
            }
          } else {
            speed = spd * (1 - (t / mv.outMs) * 0.6);
          }
          break;
        }
        case 'spiral':
          ang += mv.turn * (dt / 1000);
          s.setData('ang', ang);
          a = ang;
          break;
        default:
          break;
      }
      body.velocity.set(Math.cos(a) * speed + extra.x, Math.sin(a) * speed + extra.y);
    }

    updateTail(s, body, t);
    // Animación del propio proyectil
    const anim = s.getData('anim') as Anim | undefined;
    const base = (s.getData('baseScale') as number | undefined) ?? s.scaleX;
    switch (anim) {
      case 'pulse':
        s.setScale(base * (1 + 0.18 * Math.sin(t / 60)));
        break;
      case 'flicker':
        s.setAlpha(0.75 + Math.random() * 0.25).setScale(base * (0.92 + Math.random() * 0.16));
        break;
      case 'wobble':
        s.setScale(base * (1 + 0.15 * Math.sin(t / 50)), base * (1 - 0.15 * Math.sin(t / 50)));
        break;
      case 'spin':
        s.rotation += (dt / 1000) * 12;
        break;
      default:
        break;
    }
  }
}
