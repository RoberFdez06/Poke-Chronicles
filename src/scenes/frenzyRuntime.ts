// Ejecución de los ataques frenéticos de los jefes (planes puros en src/data/bossFrenzy.ts, dibujo en
// src/ui/art/frenzyFx.ts). Va aparte de GameScene para tocarla lo mínimo: GameScene solo da un `FrenzyHost`.
// Rendimiento: UN Graphics y UN temporizador por ataque (se repinta cada ~16 ms); como mucho MAX_LANES líneas
// (en la tormenta, STORM_MAX_ACTIVE elementos vivos a la vez).
import Phaser from 'phaser';
import { dashEnd } from '../data/bossBlitz';
import { PLAYER_HURT_R } from '../data/hitbox';
import {
  laneHits, laneState, strikeHits, aimStrike, zoneHits, COMBO_ACT_MS, LIGHTNING_ON_MS, chaseOrder, creepStep, homingStep,
  type CascadePlan, type ChaseKind, type ChaseSpec, type ComboSpec, type ComboStep, type Pt, type Strike,
} from '../data/bossFrenzy';
import type { Bounds } from '../level/bounds';
import type { Hazard } from '../data/autoMove';
import { drawDashWarn, drawLaneBeam, drawLaneFade, drawLaneWarn, drawStrikeBolt, drawStrikeFade, drawStrikeWarn, drawZoneBlast, drawZoneWarn } from '../ui/art/frenzyFx';

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

/** Línea de la cascada como zona de peligro. */
function laneHazard(l: CascadePlan['lanes'][number]): Hazard {
  return { kind: 'seg', x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, w: l.width };
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
      if (st.s === 'warn') drawLaneWarn(g, l, st.k, t, h.low);
      else if (st.s === 'on') {
        drawLaneBeam(g, l, st.k, h.color, h.low);
        if (!boomed) {
          boomed = true;
          h.sfx('hit');
        }
        if (!hit.has(i) && laneHits(l, h.player.x, h.player.y, 12)) {
          hit.add(i);
          h.hurt();
        }
      } else if (st.s === 'fade') drawLaneFade(g, l, st.k, h.color);
    }
    return t < plan.totalMs + 160;
  }, 4, (t) => plan.lanes.filter((l) => { const s = laneState(l, t).s; return s === 'warn' || s === 'on'; }).map(laneHazard));
}

/**
 * Rayos: cada círculo avisa (se rellena y parpadea) y al acabar el aviso cae un rayo que solo daña dentro (una vez por
 * rayo, como las líneas). Los apuntados se recolocan sobre el jugador al sacar su aviso (aimStrike): basta con moverse.
 * Un Graphics para todos; temblor y sonido al caer (sin temblor en low).
 */
export function runLightning(h: FrenzyHost, plan: { strikes: readonly Strike[]; totalMs: number }) {
  const ks: Strike[] = plan.strikes.map((k) => ({ ...k }));
  const aimed = new Set<number>();
  const hit = new Set<number>();
  const fell = new Set<number>();
  const live = (t: number) => ks.filter((k) => t >= k.warnAt && t < k.offAt);
  run(h, (g, t) => {
    for (let i = 0; i < ks.length; i++) {
      let k = ks[i];
      if (k.aimed && !aimed.has(i) && t >= k.warnAt) {
        aimed.add(i);
        k = ks[i] = aimStrike(k, h.player, h.arena);
      }
      const st = laneState(k, t, 160);
      if (st.s === 'warn') drawStrikeWarn(g, k, st.k, t, h.low);
      else if (st.s === 'on') {
        drawStrikeBolt(g, k, st.k, h.color, h.low);
        if (!fell.has(i)) {
          fell.add(i);
          h.sfx('boom');
          if (!h.low) h.shake(90, 0.004);
        }
        if (!hit.has(i) && strikeHits(k, h.player.x, h.player.y)) {
          hit.add(i);
          h.hurt();
        }
      } else if (st.s === 'fade') drawStrikeFade(g, k, st.k, h.color);
    }
    return t < plan.totalMs + 200;
  }, 4, (t) => live(t).map((k): Hazard => ({ kind: 'circle', x: k.x, y: k.y, r: k.r + 12 })));
}

/** Combo retardado: cada golpe apunta al sacar su aviso (te sigue entre golpes) y golpea al acabar el aviso. */
export function runCombo(h: FrenzyHost, steps: ComboStep[], spec: ComboSpec, dashWidth = 64) {
  const sc = h.scene;
  const b = h.boss;
  const bodyHalf = Math.min(70, ((b.body as Phaser.Physics.Arcade.Body | null)?.width ?? 120) / 2);
  type Live = { st: ComboStep; from: Pt; to: Pt; hit: boolean; done: boolean; aimed: boolean; sounded: boolean };
  const live: Live[] = steps.map((st) => ({ st, from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, hit: false, done: false, aimed: false, sounded: false }));
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
        } else if (st.kind === 'bolt') s.from = aimStrike({ x: p.x, y: p.y, r: spec.boltR, warnAt: 0, fireAt: 0, offAt: 0, aimed: true }, p, h.arena);
        else s.from = p;
      }
      const warnK = (t - st.warnAt) / Math.max(1, st.fireAt - st.warnAt);
      // Amago: pasado el aviso normal, el aviso se queda y late (el golpe llega más tarde)
      const held = st.feint && t - st.warnAt > spec.warnMs;
      if (t < st.fireAt) {
        if (st.kind === 'dash') drawDashWarn(g, s.from, s.to, dashWidth, warnK, t, held, h.low);
        else if (st.kind === 'bolt') drawStrikeWarn(g, { x: s.from.x, y: s.from.y, r: spec.boltR }, warnK, t, h.low, held);
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
        if (!s.hit && Math.hypot(h.player.x - b.x, h.player.y - b.y) < dashWidth / 2 + PLAYER_HURT_R) {
          s.hit = true;
          h.hurt();
        }
      } else if (st.kind === 'bolt') {
        const z = { x: s.from.x, y: s.from.y, r: spec.boltR };
        drawStrikeBolt(g, z, k, h.color, h.low);
        if (!s.hit && strikeHits(z, h.player.x, h.player.y)) {
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
      else if (s.st.kind === 'bolt') out.push({ kind: 'circle', x: s.from.x, y: s.from.y, r: spec.boltR + 12 });
      else out.push({ kind: 'circle', x: s.from.x, y: s.from.y, r: spec.zoneR });
    }
    return out;
  });
}

/**
 * Acoso (fase 2): cada `everyMs` aparece algo que se ACERCA a ti, siempre con aviso y esquivable:
 * - zona que se arrastra hacia ti (más lenta que tú), late al final y estalla en área dejando un charco que dura;
 * - orbe teledirigido desde el jefe con giro limitado y vida corta (si giras cerca, se pasa de largo);
 * - rayo en un círculo sobre tu posición (aviso y luego cae): sal del círculo.
 * Un Graphics; como mucho `spec.maxLive` objetos vivos (charcos incluidos).
 */
export function runChase(h: FrenzyHost, spec: ChaseSpec) {
  const sc = h.scene;
  const order = chaseOrder(spec, Math.random);
  type O = { kind: ChaseKind | 'puddle'; t0: number; x: number; y: number; ang: number; snd?: boolean; hit: boolean; last: number; done: boolean };
  const live: O[] = [];
  let next = 0;
  let idx = 0;
  const total = Math.min(spec.durMs, order.length * spec.everyMs) + spec.warnMs + Math.max(spec.creepLife + 400, LIGHTNING_ON_MS, spec.homerLife) + spec.puddleMs;
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
      } else if (kind === 'bolt') ({ x, y } = aimStrike({ x: P.x, y: P.y, r: spec.boltR, warnAt: 0, fireAt: 0, offAt: 0, aimed: true }, P, B));
      live.push({ kind, t0: t, x, y, ang: Math.atan2(P.y - y, P.x - x), hit: false, last: t, done: false });
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
        else if (o.kind === 'bolt') drawStrikeWarn(g, { x: o.x, y: o.y, r: spec.boltR }, k, t, h.low);
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
          if (live.filter((q) => !q.done).length < spec.maxLive) live.push({ kind: 'puddle', t0: t, x: o.x, y: o.y, ang: 0, hit: false, last: t, done: false });
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
        if (at > LIGHTNING_ON_MS) {
          o.done = true;
          continue;
        }
        const z = { x: o.x, y: o.y, r: spec.boltR };
        drawStrikeBolt(g, z, at / LIGHTNING_ON_MS, h.color, h.low);
        if (!o.snd) {
          o.snd = true;
          h.sfx('boom');
        }
        if (!o.hit && strikeHits(z, P.x, P.y)) {
          o.hit = true;
          h.hurt();
        }
      }
    }
    return t < total && (idx < order.length || live.some((o) => !o.done));
  }, 4, (t) => live.filter((o) => !o.done).map((o): Hazard => {
    const r = o.kind === 'puddle' ? spec.puddleR : o.kind === 'homer' ? 40 : o.kind === 'bolt' ? spec.boltR + 12 : spec.blastR;
    return { kind: 'circle', x: o.x, y: o.y, r };
  }));
  return total;
}
