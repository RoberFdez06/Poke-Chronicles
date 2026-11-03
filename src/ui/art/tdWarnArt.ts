// Iconos pixel art propios (9x9, sin emojis) del aviso previo de emparejamiento de la Defensa de torres: un círculo
// con visto (Bien), uno con rayas (Justo) y un triángulo con exclamación (Arriesgado).
import Phaser from 'phaser';
import type { Verdict } from '../../data/towerDefense/matchupWarning';

export const WARN_COLOR: Readonly<Record<Verdict, number>> = { bien: 0x4caf50, justo: 0xf2b21a, arriesgado: 0xe5483f };
/** Fondo suave de la caja del aviso. */
export const WARN_FILL: Readonly<Record<Verdict, number>> = { bien: 0xdcf0dc, justo: 0xfff0c4, arriesgado: 0xffd8d2 };
export const WARN_TEXT: Readonly<Record<Verdict, string>> = { bien: '#1f5a24', justo: '#6b4a00', arriesgado: '#8a1f18' };

const ROWS: Readonly<Record<Verdict, readonly string[]>> = {
  bien: ['..kkkkk..', '.kCCCCCk.', 'kCCCCCWCk', 'kCCCCWCCk', 'kCWCWCCCk', 'kCCWCCCCk', 'kCCCCCCCk', '.kCCCCCk.', '..kkkkk..'],
  justo: ['..kkkkk..', '.kCCCCCk.', 'kCCCCCCCk', 'kCWWWWWCk', 'kCCCCCCCk', 'kCWWWWWCk', 'kCCCCCCCk', '.kCCCCCk.', '..kkkkk..'],
  arriesgado: ['....k....', '...kCk...', '...kCk...', '..kCWCk..', '..kCWCk..', '.kCCWCCk.', '.kCCCCCk.', 'kCCCWCCCk', 'kkkkkkkkk'],
};

export const warnIconKey = (v: Verdict) => `td-warn-${v}`;

export function bakeWarnIcons(scene: Phaser.Scene) {
  for (const v of Object.keys(ROWS) as Verdict[]) {
    const key = warnIconKey(v);
    if (scene.textures.exists(key)) continue;
    const pal: Record<string, number> = { k: 0x18202c, C: WARN_COLOR[v], W: 0xffffff };
    const g = scene.make.graphics({}, false);
    ROWS[v].forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = pal[row[x]];
        if (c !== undefined) g.fillStyle(c, 1).fillRect(x, y, 1, 1);
      }
    });
    g.generateTexture(key, 9, 9);
    g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}
