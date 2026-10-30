// Sinergias que transforman, en la partida: orbitales, rastros, aura, anillo (nova), cadenas de rayos y el aspecto
// de las transformaciones. GameScene le pasa un anfitrión con lo que necesita (enemigos, cómo golpear…) y le llama
// en update(); los números salen de data/synergyFx.ts y el dibujo de ui/art/synergyArt.ts.
import Phaser from 'phaser';
import { emptyFx, type SynergyFxState } from '../data/synergyFx';
import { drawAura, drawTransformLook, flameTexture, iceTexture, orbTexture } from '../ui/art/synergyArt';
import { pixBolt } from '../ui/art/pixelFx';

type Sprite = Phaser.Physics.Arcade.Sprite;

export interface SynergyHost {
  scene: Phaser.Scene;
  player(): Sprite | undefined;
  enemies(): Sprite[];
  foeShots(): Sprite[];
  /** Golpea a un enemigo (pasa por críticos, números de daño, estados…). */
  hit(e: Sprite, dmg: number, type: string | undefined, sx: number, sy: number, color: number): void;
  /** Daño de un disparo normal ahora mismo. */
  shotDamage(): number;
  /** Suelta un anillo de `count` disparos desde el jugador con ese daño. */
  ring(count: number, dmg: number): void;
  /** Se puede jugar (no en pausa, transición ni fin). */
  live(): boolean;
  /** Presupuesto de efectos (para no saturar). */
  canFx(): boolean;
  low(): boolean;
}

interface Patch {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  until: number;
  element: 'fire' | 'ice';
}

const radiusOf = (e: Sprite) => ((e.getData('size') as number | undefined) ?? 60) * 0.35;
const TRAIL_MS = 1600;
const TRAIL_STEP_MS = 110;
const MAX_PATCHES = 18;

export class SynergyRuntime {
  private fx: SynergyFxState = emptyFx();
  private orbs: Phaser.GameObjects.Image[] = [];
  private orbCd = new WeakMap<Sprite, number>();
  private trailCd = new WeakMap<Sprite, number>();
  private patches: Patch[] = [];
  private nextPatch = 0;
  private auraAt = 0;
  private drawAt = 0;
  private novaAt = 0;
  private auraG?: Phaser.GameObjects.Graphics;
  private lookG?: Phaser.GameObjects.Graphics;

  constructor(private host: SynergyHost) {}

  get state(): SynergyFxState {
    return this.fx;
  }

  /** Cambian las sinergias activas: rehace orbitales y capas de dibujo. */
  set(fx: SynergyFxState) {
    this.fx = fx;
    const sc = this.host.scene;
    this.orbs.forEach((o) => o.destroy());
    this.orbs = [];
    if (fx.orbitals) {
      const tex = orbTexture(sc, fx.orbitals.color);
      for (let i = 0; i < fx.orbitals.count; i++) this.orbs.push(sc.add.image(0, -9999, tex).setScale(3.5).setDepth(5.5));
    }
    if (fx.aura && !this.auraG) this.auraG = sc.add.graphics().setDepth(1.7);
    if (!fx.aura && this.auraG) this.auraG = (this.auraG.destroy(), undefined);
    if (fx.transform && !this.lookG) this.lookG = sc.add.graphics().setDepth(4.8);
    if (!fx.transform && this.lookG) this.lookG = (this.lookG.destroy(), undefined);
  }

  update(time: number) {
    const p = this.host.player();
    const live = !!p?.active && this.host.live();
    for (const o of this.orbs) o.setVisible(live);
    this.auraG?.setVisible(live);
    this.lookG?.setVisible(live);
    this.fadePatches(time);
    if (!p || !live) return;
    const fx = this.fx;
    const enemies = this.host.enemies().filter((e) => e.active && (e.body as Phaser.Physics.Arcade.Body | null)?.enable);
    // Orbitales: giran, golpean al tocar (cada enemigo, como mucho una vez cada 0,4 s) y paran disparos
    if (fx.orbitals && this.orbs.length > 0) {
      const { radius, dmg, color } = fx.orbitals;
      const n = this.orbs.length;
      this.orbs.forEach((o, i) => {
        const a = time / 520 + (i / n) * Math.PI * 2;
        o.setPosition(p.x + Math.cos(a) * radius, p.y + Math.sin(a) * radius * 0.8).setRotation(a * 2);
        for (const e of enemies) {
          if (Phaser.Math.Distance.Between(o.x, o.y, e.x, e.y) > radiusOf(e) + 14) continue;
          if (time < (this.orbCd.get(e) ?? 0)) continue;
          this.orbCd.set(e, time + 400);
          this.host.hit(e, dmg, undefined, o.x, o.y, color);
        }
        for (const s of this.host.foeShots()) {
          if (s.active && Phaser.Math.Distance.Between(o.x, o.y, s.x, s.y) < 20) s.destroy();
        }
      });
    }
    // Rastro de fuego/hielo al moverte
    const moving = ((p.body as Phaser.Physics.Arcade.Body | null)?.velocity.length() ?? 0) > 40;
    const element = fx.trail.fire > 0 ? 'fire' : fx.trail.ice > 0 ? 'ice' : null;
    if (element && moving && time >= this.nextPatch) {
      this.nextPatch = time + TRAIL_STEP_MS * (this.host.low() ? 2 : 1);
      this.dropPatch(p.x, p.y + 22, element, time);
      if (fx.trail.fire > 0 && fx.trail.ice > 0) this.dropPatch(p.x + 10, p.y + 26, 'ice', time);
    }
    for (const pt of this.patches) {
      const dmg = fx.trail[pt.element];
      if (dmg <= 0) continue;
      for (const e of enemies) {
        if (Phaser.Math.Distance.Between(pt.x, pt.y, e.x, e.y) > radiusOf(e) + 20 || time < (this.trailCd.get(e) ?? 0)) continue;
        this.trailCd.set(e, time + (pt.element === 'ice' ? 1400 : 500));
        this.host.hit(e, dmg, pt.element, e.x, e.y, pt.element === 'fire' ? 0xff8a2a : 0x7ad0f0);
      }
    }
    // Aura: golpes suaves 4 veces por segundo a quien está dentro
    if (fx.aura && time >= this.auraAt) {
      this.auraAt = time + 250;
      for (const e of enemies) {
        if (Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) <= fx.aura.radius + radiusOf(e)) this.host.hit(e, fx.aura.dps / 4, undefined, e.x, e.y, fx.aura.color);
      }
    }
    // Nova: anillo de disparos cada poco si hay enemigos
    if (fx.nova && enemies.length > 0 && time >= this.novaAt) {
      if (this.novaAt > 0) this.host.ring(fx.nova.count, this.host.shotDamage() * fx.nova.mul);
      this.novaAt = time + fx.nova.every;
    }
    if (time >= this.drawAt) {
      this.drawAt = time + (this.host.low() ? 200 : 60);
      if (fx.aura && this.auraG) drawAura(this.auraG, p.x, p.y + 10, fx.aura.radius, fx.aura.color, time, this.host.low());
      if (fx.transform && this.lookG) drawTransformLook(this.lookG, fx.transform.id, p.x, p.y, fx.transform.color, fx.transform.glow, time, this.host.low());
    }
  }

  private dropPatch(x: number, y: number, element: 'fire' | 'ice', time: number) {
    const sc = this.host.scene;
    const img = sc.add.image(x, y, element === 'fire' ? flameTexture(sc) : iceTexture(sc)).setScale(4).setDepth(1.6).setAlpha(0.95);
    this.patches.push({ img, x, y, until: time + TRAIL_MS, element });
    while (this.patches.length > MAX_PATCHES) this.patches.shift()?.img.destroy();
  }

  private fadePatches(time: number) {
    this.patches = this.patches.filter((pt) => {
      const left = pt.until - time;
      if (left <= 0) {
        pt.img.destroy();
        return false;
      }
      pt.img.setAlpha(Math.min(0.95, left / 500));
      if (pt.element === 'fire' && !this.host.low()) pt.img.setScale(4, 4 + Math.sin(time / 70 + pt.x) * 0.5);
      return true;
    });
  }

  /** Rayo en cadena desde un enemigo golpeado: salta a los más cercanos que no estén ya en la cadena. */
  chainFrom(from: Sprite, dmg: number) {
    const c = this.fx.chain;
    if (!c || Math.random() >= c.chance) return;
    const done = new Set<Sprite>([from]);
    let cur = from;
    for (let j = 0; j < c.jumps; j++) {
      let best: Sprite | undefined;
      let bestD = c.range;
      for (const e of this.host.enemies()) {
        if (!e.active || done.has(e)) continue;
        const d = Phaser.Math.Distance.Between(cur.x, cur.y, e.x, e.y);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (!best) return;
      done.add(best);
      const sx = cur.x;
      const sy = cur.y;
      if (this.host.low()) {
        const g = this.host.scene.add.graphics().setDepth(9);
        g.lineStyle(3, 0xffe14a, 1).lineBetween(sx, sy, best.x, best.y);
        this.host.scene.time.delayedCall(120, () => g.destroy());
      } else pixBolt(this.host.scene, sx, sy, best.x, best.y, 0xffe14a);
      this.host.hit(best, dmg * c.mul, undefined, best.x, best.y, 0xffe14a);
      cur = best;
    }
  }

  destroy() {
    this.orbs.forEach((o) => o.destroy());
    this.patches.forEach((pt) => pt.img.destroy());
    this.auraG?.destroy();
    this.lookG?.destroy();
    this.orbs = [];
    this.patches = [];
    this.auraG = this.lookG = undefined;
  }
}
