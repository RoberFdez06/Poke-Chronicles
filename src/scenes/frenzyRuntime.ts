// Ejecución de los ataques frenéticos de los jefes (planes puros en src/data/bossFrenzy.ts, dibujo en
// src/ui/art/frenzyFx.ts). Va aparte de GameScene para tocarla lo mínimo: GameScene solo da un `FrenzyHost`.
// Rendimiento: UN Graphics y UN temporizador por ataque (se repinta cada ~16 ms); como mucho MAX_LANES líneas.
import Phaser from 'phaser';
import { dashEnd } from '../data/bossBlitz';
import {
  laneHits, laneState, waveHits, zoneHits, COMBO_ACT_MS,
  type CascadePlan, type ComboSpec, type ComboStep, type Pt,
} from '../data/bossFrenzy';
import type { Bounds } from '../level/bounds';
import type { Hazard } from '../data/autoMove';
import { drawRingBeam, drawRingFade, drawRingWarn, drawDashWarn, drawLaneBeam, drawLaneFade, drawLaneWarn, drawWave, drawWaveWarn, drawZoneBlast, drawZoneWarn } from '../ui/art/frenzyFx';

export interface FrenzyHost {
  scene: Phaser.Scene;
  boss: Phaser.Physics.Arcade.Sprite;
  player: Pt;
  arena: Bounds;
  color: number;
  low: boolean;
  /** ¿Sigue la pelea? (jefe vivo, sin pausa, sin derrumbe). */
  ok(): boolean;
  hurt(): void;
  /** Registra un corte (stopBlitz); devuelve cómo quitarlo. */
  track(stop: () => void): () => void;
  /** Deja quieta la IA del jefe hasta `until` (mientras embiste él solo). */
  holdAi(until: number): void;
  shake(ms: number, k: number): void;
  sfx(name: 'boom' | 'hit'): void;
}

/** Zonas de peligro de los ataques en marcha (avisos y golpes), para el modo automático de móvil (data/autoMove.ts). */
const liveHazards = new Set<() => Hazard[]>();
export function frenzyHazards(): Hazard[] {
  const out: Hazard[] = [];
  for (const f of liveHazards) out.push(...f());
  return out;
}

/** Línea o anillo de la cascada como zona de peligro. */
function laneHazard(l: CascadePlan['lanes'][number]): Hazard {
  const r = l.ring;
  if (!r) return { kind: 'seg', x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, w: l.width };
  return { kind: 'ring', cx: r.cx, cy: r.cy, rMin: Math.min(r.r0, r.r1) - l.width / 2, rMax: Math.max(r.r0, r.r1) + l.width / 2, gapAng: r.gapAng, gapW: r.gapW };
}

/** Bucle por fotograma con un Graphics propio; para cuando `step` devuelve false, se corta o acaba la pelea. */
function run(h: FrenzyHost, step: (g: Phaser.GameObjects.Graphics, t: number) => boolean, depth = 5, hazards?: (t: number) => Hazard[]) {
  const sc = h.scene;
  const g = sc.add.graphics().setDepth(depth);
  const t0 = sc.time.now;
  const hz = hazards && (() => hazards(sc.time.now - t0));
  if (hz) liveHazards.add(hz);
  let untrack = () => {};
  const ev = sc.time.addEvent({
    delay: 16, loop: true,
    callback: () => {
      g.clear();
      if (!h.ok() || !step(g, sc.time.now - t0)) stop();
    },
  });
  function stop() {
    if (hz) liveHazards.delete(hz);
    untrack();
    ev.remove();
    g.destroy();
  }
  untrack = h.track(stop);
}

/** Cascada: todas las líneas en un solo Graphics; cada una daña una vez como mucho. */
export function runCascade(h: FrenzyHost, plan: CascadePlan) {
  const hit = new Set<number>();
  let boomed = false;
  run(h, (g, t) => {
    for (let i = 0; i < plan.lanes.length; i++) {
      const l = plan.lanes[i];
      const st = laneState(l, t);
      if (st.s === 'warn') {
        if (l.ring) drawRingWarn(g, l, st.k, t, h.arena, h.low);
        else drawLaneWarn(g, l, st.k, t, h.low);
      } else if (st.s === 'on') {
        if (l.ring) drawRingBeam(g, l, t, h.color, h.arena, h.low);
        else drawLaneBeam(g, l, st.k, h.color, h.low);
        if (!boomed) {
          boomed = true;
          h.sfx('hit');
        }
        if (!hit.has(i) && laneHits(l, h.player.x, h.player.y, 12, t)) {
          hit.add(i);
          h.hurt();
        }
      } else if (st.s === 'fade') {
        if (l.ring) drawRingFade(g, l, st.k, h.color, h.arena);
        else drawLaneFade(g, l, st.k, h.color);
      }
    }
    return t < plan.totalMs + 160;
  }, 4, (t) => plan.lanes.filter((l) => { const s = laneState(l, t).s; return s === 'warn' || s === 'on'; }).map(laneHazard));
}

/** Combo retardado: cada golpe apunta al sacar su aviso (te sigue entre golpes) y golpea al acabar el aviso. */
export function runCombo(h: FrenzyHost, steps: ComboStep[], spec: ComboSpec, dashWidth = 64) {
  const sc = h.scene;
  const b = h.boss;
  const bodyHalf = Math.min(70, ((b.body as Phaser.Physics.Arcade.Body | null)?.width ?? 120) / 2);
  type Live = { st: ComboStep; from: Pt; to: Pt; gapAng: number; hit: boolean; done: boolean; aimed: boolean; sounded: boolean };
  const live: Live[] = steps.map((st) => ({ st, from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, gapAng: 0, hit: false, done: false, aimed: false, sounded: false }));
  const total = steps[steps.length - 1].endAt;
  h.holdAi(sc.time.now + total + 300);
  run(h, (g, t) => {
    for (const s of live) {
      const { st } = s;
      if (s.done || t < st.warnAt) continue;
      if (!s.aimed) {
        // Apunta ahora (posición del jugador al sacar el aviso)
        s.aimed = true;
        const p = { x: h.player.x, y: h.player.y };
        if (st.kind === 'dash') {
          s.from = { x: b.x, y: b.y };
          s.to = dashEnd(s.from, p, h.arena, bodyHalf);
        } else if (st.kind === 'wave') {
          s.from = { x: b.x, y: b.y };
          // El hueco de la onda: hacia un lado del jugador (no detrás del jefe), para que haya que moverse
          s.gapAng = Math.atan2(p.y - b.y, p.x - b.x) + (Math.random() < 0.5 ? 1 : -1) * (0.7 + Math.random() * 0.9);
        } else s.from = p;
      }
      const warnK = (t - st.warnAt) / Math.max(1, st.fireAt - st.warnAt);
      // Amago: pasado el aviso normal, el aviso se queda y late (el golpe llega más tarde)
      const held = st.feint && t - st.warnAt > spec.warnMs;
      if (t < st.fireAt) {
        if (st.kind === 'dash') drawDashWarn(g, s.from, s.to, dashWidth, warnK, t, held, h.low);
        else if (st.kind === 'wave') drawWaveWarn(g, s.from.x, s.from.y, spec.waveR, s.gapAng, spec.waveGap, warnK, t, held, h.low);
        else drawZoneWarn(g, s.from.x, s.from.y, spec.zoneR, warnK, t, held, h.low);
        if (st.kind === 'dash') b.setVelocity(0, 0);
        continue;
      }
      const k = Math.min(1, (t - st.fireAt) / COMBO_ACT_MS[st.kind]);
      if (!s.sounded) {
        s.sounded = true;
        h.sfx(st.kind === 'dash' ? 'hit' : 'boom');
        if (st.kind !== 'dash') h.shake(110, 0.005);
      }
      if (st.kind === 'dash') {
        const dx = s.to.x - s.from.x;
        const dy = s.to.y - s.from.y;
        const dist = Math.hypot(dx, dy) || 1;
        const sp = dist / (COMBO_ACT_MS.dash / 1000);
        if (k < 1 && Math.hypot(s.to.x - b.x, s.to.y - b.y) > 16) b.setVelocity((dx / dist) * sp, (dy / dist) * sp);
        else b.setVelocity(0, 0);
        if (!s.hit && Math.hypot(h.player.x - b.x, h.player.y - b.y) < dashWidth / 2 + 20) {
          s.hit = true;
          h.hurt();
        }
      } else if (st.kind === 'wave') {
        const r = spec.waveR * k;
        drawWave(g, s.from.x, s.from.y, r, spec.waveThick, s.gapAng, spec.waveGap, h.color, h.low);
        if (!s.hit && waveHits(s.from.x, s.from.y, r, spec.waveThick, s.gapAng, spec.waveGap, h.player.x, h.player.y)) {
          s.hit = true;
          h.hurt();
        }
      } else {
        drawZoneBlast(g, s.from.x, s.from.y, spec.zoneR, k, h.color, h.low);
        if (!s.hit && k < 0.4 && zoneHits(s.from.x, s.from.y, spec.zoneR, h.player.x, h.player.y)) {
          s.hit = true;
          h.hurt();
        }
      }
      if (k >= 1) {
        s.done = true;
        if (st.kind === 'dash') b.setVelocity(0, 0);
      }
    }
    return t < total + 100;
  }, 4, (t) => {
    const out: Hazard[] = [];
    for (const s of live) {
      if (s.done || !s.aimed || t < s.st.warnAt) continue;
      if (s.st.kind === 'dash') out.push({ kind: 'seg', x1: s.from.x, y1: s.from.y, x2: s.to.x, y2: s.to.y, w: dashWidth + 20 });
      else if (s.st.kind === 'wave') out.push({ kind: 'ring', cx: s.from.x, cy: s.from.y, rMin: 0, rMax: spec.waveR + spec.waveThick, gapAng: s.gapAng, gapW: spec.waveGap });
      else out.push({ kind: 'circle', x: s.from.x, y: s.from.y, r: spec.zoneR });
    }
    return out;
  });
}
