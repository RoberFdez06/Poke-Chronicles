import Phaser from 'phaser';
import { loadTutorial, saveTutorial } from '../data/save';
import { markTipSeen, shouldShowTip, TIPS, type TipId } from '../data/tutorial';
import { UI } from './nav';
import { drawBox } from './theme';
import { TD_COLS, TD_ROWS } from '../data/towerDefense/maps';

/**
 * Consejo de la defensa de torres: una tira arriba que no para la partida, sale una sola vez por consejo (y respeta
 * "No más consejos") y se cierra sola a los 9 s o con cualquier clic (que sigue haciendo lo suyo). Devuelve si se ha enseñado.
 */
export function showTdTip(scene: Phaser.Scene, id: TipId): boolean {
  if (scene.data.get('tdTip')) return false; // ya hay uno en pantalla: este saldrá la próxima vez
  const state = loadTutorial();
  if (!shouldShowTip(state, id)) return false;
  saveTutorial(markTipSeen(state, id));
  const w = 700;
  // Centrado sobre el mapa (x = 12, TD_COLS casillas de 48 px): centrado en la pantalla pisaba el panel del equipo
  const x = 12 + (TD_COLS * 48 - w) / 2;
  scene.data.set('tdTip', true);
  const c = scene.add.container(0, 0).setDepth(90);
  const title = scene.add.text(x + 16, 0, `Consejo · ${TIPS[id].title}`, { fontFamily: UI.FONT, fontSize: '14px', fontStyle: 'bold', color: '#b8860b' });
  const text = scene.add.text(x + 16, 0, TIPS[id].text.replace(/\n/g, ' '), { fontFamily: UI.FONT, fontSize: '12px', color: '#2b3a67', wordWrap: { width: w - 32 } });
  // Abajo del mapa (fila TD_ROWS de 48 px desde y = 62): arriba pisaba los avisos y el del nivel temático.
  // El alto sale del texto (en móvil la letra crece y antes se salía del cuadro)
  const h = Math.max(64, 8 + title.height + 4 + text.height + 8);
  const y = 62 + TD_ROWS * 48 - h - 8;
  title.setY(y + 8);
  text.setY(y + 12 + title.height);
  const box = drawBox(scene.add.graphics(), x, y, w, h, { radius: 12 }).setAlpha(0.95);
  c.add([box, title, text]);
  const close = () => {
    if (!c.active) return;
    scene.data.set('tdTip', false);
    scene.tweens.add({ targets: c, alpha: 0, duration: 250, onComplete: () => c.destroy() });
  };
  // Sin zona propia: tapaba el mapa y el clic no llegaba a la casilla. Cualquier clic o toque lo cierra (y hace lo suyo)
  scene.input.once('pointerdown', close);
  scene.time.delayedCall(9000, close);
  return true;
}
