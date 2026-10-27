import Phaser from 'phaser';
import { loadTutorial, saveTutorial } from '../data/save';
import { markTipSeen, shouldShowTip, TIPS, type TipId } from '../data/tutorial';
import { UI } from './nav';
import { drawBox } from './theme';

/**
 * Consejo de la defensa de torres: una tira arriba que no para la partida, sale una sola vez por consejo (y respeta
 * "No más consejos") y se cierra sola a los 9 s o con un clic encima. Devuelve si se ha enseñado.
 */
export function showTdTip(scene: Phaser.Scene, id: TipId): boolean {
  if (scene.data.get('tdTip')) return false; // ya hay uno en pantalla: este saldrá la próxima vez
  const state = loadTutorial();
  if (!shouldShowTip(state, id)) return false;
  saveTutorial(markTipSeen(state, id));
  const w = 700;
  const h = 64;
  const x = 480 - w / 2;
  const y = 6;
  scene.data.set('tdTip', true);
  const c = scene.add.container(0, 0).setDepth(90);
  const box = drawBox(scene.add.graphics(), x, y, w, h, { radius: 12 }).setAlpha(0.95);
  const title = scene.add.text(x + 16, y + 8, `Consejo · ${TIPS[id].title}`, { fontFamily: UI.FONT, fontSize: '14px', fontStyle: 'bold', color: '#b8860b' });
  const text = scene.add.text(x + 16, y + 28, TIPS[id].text.replace(/\n/g, ' '), { fontFamily: UI.FONT, fontSize: '12px', color: '#2b3a67', wordWrap: { width: w - 32 } });
  const zone = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
  c.add([box, title, text, zone]);
  const close = () => {
    if (!c.active) return;
    scene.data.set('tdTip', false);
    scene.tweens.add({ targets: c, alpha: 0, duration: 250, onComplete: () => c.destroy() });
  };
  zone.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => {
    ev?.stopPropagation?.();
    close();
  });
  scene.time.delayedCall(9000, close);
  return true;
}
