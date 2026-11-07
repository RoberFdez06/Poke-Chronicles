// Ayudas para las pantallas de la Defensa de torres en táctil (rama `tdmovil`): lienzo a todo el ancho mientras
// están abiertas, soltar los dedos al cerrarse y encoger textos para que quepan en su botón.
import Phaser from 'phaser';
import { touchOnlyDevice } from '../data/controls';
import { cssPerUnit, designView, tdWidthStillNeeded, type Rect } from '../data/towerDefense/touchTd';
import { LW } from './layout';
import { releaseAllTouches } from './touchSanity';
import { setTouchFullWidth } from './wideScreen';

const TD_KEYS = ['TowerDefense', 'TowerDefenseMenu'];

/** Caja de la página donde va el juego (px CSS), como la mide wideScreen. */
export function tdTouchBox(): { w: number; h: number } {
  if (typeof document === 'undefined') return { w: 0, h: 0 };
  const r = document.getElementById('game')?.getBoundingClientRect();
  return { w: r && r.width > 0 ? r.width : window.innerWidth, h: r && r.height > 0 ? r.height : window.innerHeight };
}

/** px CSS por unidad de diseño y lo que se ve del diseño ahora mismo. */
export function tdTouchView(): { k: number; view: Rect } {
  const b = tdTouchBox();
  return { k: cssPerUnit(b.w, b.h, LW), view: designView(LW) };
}

/**
 * En táctil: pide el lienzo a todo el ancho mientras la escena esté abierta y, al cerrarse, suelta en Phaser todos
 * los dedos (ninguno se queda «pulsado» en la pantalla siguiente) y devuelve el ancho normal si no sigue otra
 * pantalla de la Defensa de torres. Devuelve si se usa la disposición táctil.
 */
export function useTdTouchWidth(scene: Phaser.Scene): boolean {
  if (!touchOnlyDevice()) return false;
  setTouchFullWidth(true);
  const game = scene.game;
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    releaseAllTouches(game);
    window.setTimeout(() => {
      // Abierta, en pausa o arrancando (del menú a la partida y vuelta)
      const still = tdWidthStillNeeded(TD_KEYS.map((k) => game.scene.getScene(k)?.sys.settings.status ?? Phaser.Scenes.PENDING), Phaser.Scenes.INIT, Phaser.Scenes.SLEEPING);
      if (!still) setTouchFullWidth(false);
    }, 60);
  });
  return true;
}

/** Encoge `t` (con salto de línea al ancho `w`) desde `max` hasta `min` px hasta que quepa en `w`×`h`. */
export function fitTextIn(t: Phaser.GameObjects.Text | undefined, w: number, h: number, max: number, min: number) {
  if (!t) return;
  t.setWordWrapWidth(Math.max(1, w));
  for (let fs = Math.round(max); fs >= Math.round(min); fs--) {
    t.setFontSize(fs);
    if (t.width <= w + 0.5 && t.height <= h + 0.5) return;
  }
}
