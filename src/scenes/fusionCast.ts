// Lanza un poder fusionado (data/fusion.ts): sus dos partes con el motor de ataques de siempre (attacks.ts), cada una
// con su tipo (estado y debilidades de los dos), y viste cada proyectil con el arte único de la receta (fusionArt.ts).
import Phaser from 'phaser';
import type { MovePower } from '../data/items';
import { fusionParts, fusionStyleOf } from '../data/fusion';
import { typeColor } from '../data/types';
import { castPattern, type AttackHost } from './attacks';
import { dressFusionShot, fusionImpact, fusionPalette } from '../ui/art/fusionArt';

type Sprite = Phaser.Physics.Arcade.Sprite;

/** Lanza `m` (fusionado) desde `src` hacia `dir`; `dmg` es el daño base del poder. */
export function castFusion(h: AttackHost, src: Sprite, dir: Phaser.Math.Vector2, m: MovePower, dmg: number) {
  const style = fusionStyleOf(m);
  const f = m.fusion;
  if (!style || !f) return;
  const colA = typeColor(f.types[0]);
  const colB = typeColor(f.types[1]);
  // Anfitrión que viste cada proyectil que sale (los de las dos partes) con el arte de la receta
  const dressed: AttackHost = {
    ...h,
    shoot: (side, x, y, angle, o) => {
      const s = h.shoot(side, x, y, angle, o);
      // Después de que el motor le ponga su estela normal (setMotion), se cambia por la de la fusión
      h.scene.time.delayedCall(0, () => s.active && dressFusionShot(h.scene, s, style, o.type === f.types[0] ? colA : colB, o.type === f.types[0] ? colB : colA));
      return s;
    },
  };
  fusionImpact(h.scene, src.x + dir.x * 26, src.y + dir.y * 26, style.impact, fusionPalette(colA, colB), 0.6);
  for (const p of fusionParts(m)) {
    const go = () => {
      if (!src.active || !h.alive()) return;
      castPattern(dressed, 'player', src, p.delay > 0 ? h.aim() : dir, p.pattern, Math.max(3, Math.round(dmg * p.mul)), p.type);
    };
    if (p.delay > 0) h.scene.time.delayedCall(p.delay, go);
    else go();
  }
}
