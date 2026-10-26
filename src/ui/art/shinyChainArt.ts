// Contador de la cadena shiny (supervisor): la insignia de estrella de worldArt con un leve vaivén, destellos que
// giran a su alrededor y un salto cuando sube la cadena. Va junto al texto del HUD (mismas capa y cámaras).
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { drawShinyBadge } from './worldArt';

type Badge = { g: Phaser.GameObjects.Graphics; count: number; popAt: number; ev?: Phaser.Time.TimerEvent };
const badges = new WeakMap<Phaser.GameObjects.Text, Badge>();

function draw(scene: Phaser.Scene, text: Phaser.GameObjects.Text, b: Badge) {
  const t = scene.time.now;
  const g = b.g.clear();
  if (!text.visible) return;
  const x = text.x - 16;
  const y = text.y + text.height / 2;
  const pop = Math.max(0, 1 - (t - b.popAt) / 300);
  g.setPosition(x, y).setScale(1 + pop * 0.5);
  drawShinyBadge(g, 0, 0, t);
  if (lowFx()) return;
  // destellos que orbitan la estrella
  for (let i = 0; i < 3; i++) {
    const a = t * 0.003 + (i * Math.PI * 2) / 3;
    const on = Math.sin(t / 150 + i * 2) > 0;
    g.fillStyle(on ? 0xffffff : 0xfff3a8, on ? 1 : 0.6).fillRect(Math.round(Math.cos(a) * 15) - 1, Math.round(Math.sin(a) * 15) - 1, on ? 3 : 2, on ? 3 : 2);
  }
}

/** Pinta (o esconde con count = 0) la insignia de la cadena shiny a la izquierda de su texto del HUD. */
export function shinyChainBadge(scene: Phaser.Scene, text: Phaser.GameObjects.Text, count: number) {
  let b = badges.get(text);
  if (!b) {
    const g = scene.add.graphics().setDepth(text.depth);
    const layer = text.displayList as unknown as { add?: (o: Phaser.GameObjects.GameObject) => void } | null;
    if (layer && layer !== (scene.children as unknown) && typeof layer.add === 'function') layer.add(g);
    g.cameraFilter = text.cameraFilter;
    g.setScrollFactor(text.scrollFactorX, text.scrollFactorY);
    b = { g, count: 0, popAt: -1e9 };
    badges.set(text, b);
  }
  if (count > b.count && b.count > 0) b.popAt = scene.time.now;
  b.count = count;
  const st = b;
  if (count > 0 && !lowFx() && !st.ev) {
    st.ev = scene.time.addEvent({
      delay: 80,
      loop: true,
      callback: () => {
        if (!text.active) {
          st.ev?.remove();
          st.g.destroy();
          return;
        }
        draw(scene, text, st);
      },
    });
  }
  if (count <= 0 && st.ev) {
    st.ev.remove();
    st.ev = undefined;
  }
  draw(scene, text, st);
}
