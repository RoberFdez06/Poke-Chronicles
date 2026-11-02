// Ejecución de los ataques frenéticos de los jefes (planes puros en src/data/bossFrenzy.ts, dibujo en
// src/ui/art/frenzyFx.ts). Va aparte de GameScene para tocarla lo mínimo: GameScene solo da un `FrenzyHost`.
// Rendimiento: UN Graphics y UN temporizador por ataque (se repinta cada ~16 ms); como mucho MAX_LANES líneas
// (en la tormenta, STORM_MAX_ACTIVE elementos vivos a la vez).
import Phaser from 'phaser';
import { dashEnd } from '../data/bossBlitz';
import {
  laneHits, laneState, waveHits, zoneHits, COMBO_ACT_MS, chaseOrder, closingRadius, creepStep, homingStep,
  type CascadePlan, type ChaseKind, type ChaseSpec, type ComboSpec, type ComboStep, type Pt,
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

/** Cascada (o tormenta: varias solapadas, ver stormPlan): todas las líneas en un solo Graphics reutilizado; cada una
 * daña una vez como mucho. La tormenta ya trae el tope de elementos a la vez (menor con lowFx). */
export function runCascade(h: FrenzyHost, plan: Pick<CascadePlan, 'lanes' | 'totalMs'>) {
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

/**
 * Acoso (fase 2): cada `everyMs` aparece algo que se ACERCA a ti, siempre con aviso y esquivable:
 * - zona que se arrastra hacia ti (más lenta que tú), late al final y estalla en área dejando un charco que dura;
 * - orbe teledirigido desde el jefe con giro limitado y vida corta (si giras cerca, se pasa de largo);
 * - anillo que se cierra sobre tu posición con un hueco por el que salir.
 * Un Graphics; como mucho `spec.maxLive` objetos vivos (charcos incluidos).
 */
export function runChase(h: FrenzyHost, spec: ChaseSpec) {
  const sc = h.scene;
  const order = chaseOrder(spec, Math.random);
  type O = { kind: ChaseKind | 'puddle'; t0: number; x: number; y: number; ang: number; gap: number; hit: boolean; last: number; done: boolean };
  const live: O[] = [];
  let next = 0;
  let idx = 0;
  const total = Math.min(spec.durMs, order.length * spec.everyMs) + spec.warnMs + Math.max(spec.creepLife + 400, spec.ringMs, spec.homerLife) + spec.puddleMs;
  const P = h.player;
  const far = (x: number, y: number) => Math.hypot(x - P.x, y - P.y);
  const B = h.arena;
  const inArena = (x: number, y: number) => ({ x: Math.min(B.x1 - 30, Math.max(B.x0 + 30, x)), y: Math.min(B.y1 - 30, Math.max(B.y0 + 30, y)) });
  run(h, (g, t) => {
    if (idx < order.length && t >= next && t < spec.durMs && live.filter((o) => !o.done).length < spec.maxLive) {
      const kind = order[idx++];
      next = t + spec.everyMs;
      let x = h.boss.x;
      let y = h.boss.y;
      if (kind === 'creep') {
        // Aparece a 220-360 px de ti, dentro de la sala
        const a = Math.random() * Math.PI * 2;
        const r = 220 + Math.random() * 140;
        ({ x, y } = inArena(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r));
      } else if (kind === 'ring') ({ x, y } = { x: P.x, y: P.y });
      live.push({ kind, t0: t, x, y, ang: Math.atan2(P.y - y, P.x - x), gap: Math.random() * Math.PI * 2, hit: false, last: t, done: false });
    }
    for (const o of live) {
      if (o.done) continue;
      const lt = t - o.t0;
      const dt = Math.min(50, t - o.last);
      o.last = t;
      if (o.kind === 'puddle') {
        g.fillStyle(h.color, 0.22).fillCircle(o.x, o.y, spec.puddleR);
        if (!h.low) g.lineStyle(2, h.color, 0.7).strokeCircle(o.x, o.y, spec.puddleR);
        if (!o.hit && far(o.x, o.y) < spec.puddleR + 8) {
          o.hit = true;
          h.hurt();
        }
        if (lt > spec.puddleMs) o.done = true;
        continue;
      }
      if (lt < spec.warnMs) {
        const k = lt / spec.warnMs;
        if (o.kind === 'creep') drawZoneWarn(g, o.x, o.y, spec.creepR, k, t, false, h.low);
        else if (o.kind === 'ring') drawWaveWarn(g, o.x, o.y, spec.ringR0, o.gap, spec.ringGap, k, t, false, h.low);
        else drawZoneWarn(g, o.x, o.y, 22, k, t, false, h.low);
        continue;
      }
      const at = lt - spec.warnMs;
      if (o.kind === 'creep') {
        if (at < spec.creepLife) {
          ({ x: o.x, y: o.y } = creepStep(o, P, spec.creepSpeed, dt));
          const pulse = at > spec.creepLife - 600 && Math.floor(t / 90) % 2 === 0;
          drawZoneBlast(g, o.x, o.y, spec.creepR, 0.25, h.color, h.low);
          if (pulse) drawZoneWarn(g, o.x, o.y, spec.blastR, (at - spec.creepLife + 600) / 600, t, false, h.low);
          if (!o.hit && far(o.x, o.y) < spec.creepR) {
            o.hit = true;
            h.hurt();
          }
        } else if (at < spec.creepLife + 260) {
          const k = (at - spec.creepLife) / 260;
          drawZoneBlast(g, o.x, o.y, spec.blastR, k, h.color, h.low);
          if (o.hit === false && k < 0.4 && zoneHits(o.x, o.y, spec.blastR, P.x, P.y)) {
            o.hit = true;
            h.hurt();
          }
        } else {
          // Charco persistente donde estalló (se acumulan unos segundos)
          o.done = true;
          h.sfx('boom');
          if (live.filter((q) => !q.done).length < spec.maxLive) live.push({ kind: 'puddle', t0: t, x: o.x, y: o.y, ang: 0, gap: 0, hit: false, last: t, done: false });
        }
      } else if (o.kind === 'homer') {
        if (at > spec.homerLife) {
          o.done = true;
          continue;
        }
        Object.assign(o, homingStep(o, o.ang, P, spec.homerSpeed, spec.homerTurn, dt));
        g.fillStyle(h.color, 0.95).fillCircle(o.x, o.y, 11);
        g.fillStyle(0xffffff, 0.9).fillCircle(o.x, o.y, 5);
        if (far(o.x, o.y) < 11 + 12) {
          o.done = true;
          h.hurt();
        }
        if (o.x < B.x0 || o.x > B.x1 || o.y < B.y0 || o.y > B.y1) o.done = true;
      } else {
        if (at > spec.ringMs) {
          o.done = true;
          continue;
        }
        const r = closingRadius(spec.ringR0, at, spec.ringMs);
        drawWave(g, o.x, o.y, r, 26, o.gap, spec.ringGap, h.color, h.low);
        if (!o.hit && r > 20 && waveHits(o.x, o.y, r, 26, o.gap, spec.ringGap, P.x, P.y)) {
          o.hit = true;
          h.hurt();
        }
      }
    }
    return t < total && (idx < order.length || live.some((o) => !o.done));
  }, 4, (t) => live.filter((o) => !o.done).map((o): Hazard => {
    if (o.kind === 'ring') return { kind: 'ring', cx: o.x, cy: o.y, rMin: 0, rMax: closingRadius(spec.ringR0, Math.max(0, t - o.t0 - spec.warnMs), spec.ringMs) + 20, gapAng: o.gap, gapW: spec.ringGap };
    const r = o.kind === 'puddle' ? spec.puddleR : o.kind === 'homer' ? 40 : spec.blastR;
    return { kind: 'circle', x: o.x, y: o.y, r };
  }));
  return total;
}
