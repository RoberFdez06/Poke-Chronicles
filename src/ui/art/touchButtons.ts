// Botones táctiles de la partida en pixel art: marco de 24×24 con bisel (luz arriba a la izquierda, sombra abajo a
// la derecha, esquinas recortadas) y su icono propio (touchIcons.ts) en el centro. Tres estados por botón: normal,
// pulsado (bisel invertido y el icono un píxel más abajo) y apagado (gris, para la recarga o sin cargas).
// Se hornean una vez como texturas de 1 px por celda y se escalan con NEAREST.
import Phaser from 'phaser';
import type { PadButton } from '../../data/touchPad';
import { TOUCH_BTN_COLOR, TOUCH_ICONS, greyOf, shade } from './touchIcons';

/** Lado del marco en celdas. */
export const TOUCH_FRAME = 24;
export type TouchBtnState = 'up' | 'down' | 'off';

export const touchBtnKey = (id: PadButton, s: TouchBtnState) => `tbtn-${id}-${s}`;

function bake(scene: Phaser.Scene, id: PadButton, state: TouchBtnState) {
  const key = touchBtnKey(id, state);
  if (scene.textures.exists(key)) return;
  const N = TOUCH_FRAME;
  const base = state === 'off' ? 0x3a4560 : state === 'down' ? shade(TOUCH_BTN_COLOR[id], -0.2) : TOUCH_BTN_COLOR[id];
  const light = state === 'down' ? shade(base, -0.35) : shade(base, 0.35);
  const dark = state === 'down' ? shade(base, 0.25) : shade(base, -0.4);
  const g = scene.make.graphics({}, false);
  const px = (x: number, y: number, c: number) => g.fillStyle(c, 1).fillRect(x, y, 1, 1);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      // Esquinas recortadas (2 celdas) para que parezca redondeado en pixel art
      const cx = Math.min(x, N - 1 - x);
      const cy = Math.min(y, N - 1 - y);
      if (cx + cy < 2) continue;
      const edge = x === 0 || y === 0 || x === N - 1 || y === N - 1 || cx + cy === 2;
      if (edge) px(x, y, 0x101828);
      else if (x === 1 || y === 1 || (cx + cy === 3 && (x < N / 2 && y < N / 2))) px(x, y, light);
      else if (x === N - 2 || y === N - 2 || cx + cy === 3) px(x, y, dark);
      else px(x, y, base);
    }
  const icon = TOUCH_ICONS[id];
  const iw = icon.rows[0].length;
  const ih = icon.rows.length;
  const ox = Math.floor((N - iw) / 2);
  const oy = Math.floor((N - ih) / 2) + (state === 'down' ? 1 : 0);
  icon.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const c = icon.palette[ch];
      px(ox + i, oy + j, state === 'off' && ch !== 'k' ? greyOf(c) : c);
    }
  });
  g.generateTexture(key, N, N);
  g.destroy();
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** Crea (una vez) las texturas de todos los botones táctiles. */
export function bakeTouchButtons(scene: Phaser.Scene) {
  for (const id of Object.keys(TOUCH_ICONS) as PadButton[]) for (const s of ['up', 'down', 'off'] as const) bake(scene, id, s);
}
