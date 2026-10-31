// Iconos pixel art de las clases de torre (Francotirador, Ráfaga, Área…) y del distintivo «Aéreo», para la pantalla
// «Elige tu equipo». Dibujados aquí a mano (9×9), con el color de cada clase de teamPick.ts como leyenda.
import Phaser from 'phaser';
import type { TowerStyle } from '../../data/towerDefense/towers';
import { AIR_COLOR, CLASS_COLOR } from '../../data/towerDefense/teamPick';

export type ClassIconName = TowerStyle | 'air';

// k contorno, C color de la clase, L luz, D sombra, W blanco
const ROWS: Record<ClassIconName, string[]> = {
  sniper: [
    '...kCk...',
    '..kCCCk..',
    '.kLk.kCk.',
    'kCk.W.kCk',
    'CCkWWWkCC',
    'kCk.W.kDk',
    '.kCk.kDk.',
    '..kDDDk..',
    '...kDk...',
  ],
  rapid: [
    'kk.......',
    'kLCk.kk..',
    '.kCCkLCk.',
    'kk.kDkCCk',
    'kLCk.kDk.',
    '.kCCkk...',
    '..kDkLCk.',
    '...k.kCCk',
    '......kDk',
  ],
  splash: [
    '.k..k..k.',
    'kCk.C.kCk',
    '.kCLLLCk.',
    '..LWWWL..',
    'kCLWWWLCk',
    '..LWWWL..',
    '.kCLLLDk.',
    'kDk.D.kDk',
    '.k..k..k.',
  ],
  chain: [
    '....kkkk.',
    '...kLCk..',
    '..kLCk...',
    '.kLCCkkk.',
    'kCCCCCCk.',
    '.kkkCCk..',
    '...kCk...',
    '..kDk....',
    '.kk......',
  ],
  slow: [
    '...kWk...',
    '.k.kCk.k.',
    'kLk.C.kLk',
    '.kCkCkCk.',
    'WCCCWCCCW',
    '.kCkCkCk.',
    'kDk.C.kDk',
    '.k.kCk.k.',
    '...kWk...',
  ],
  single: [
    '......kk.',
    '.....kWLk',
    '....kLCk.',
    '...kLCk..',
    'k.kCCk...',
    'kkCCk....',
    '.kDk.....',
    'kDkkk....',
    'kk.......',
  ],
  support: [
    '..kkkkk..',
    '.kkLCCkk.',
    '.kLWWCCk.',
    'kkkWWWkkk',
    'kLWWWWWCk',
    'kCCWWWCDk',
    'kkkWWWkkk',
    '.kCCCDDk.',
    '..kkkkk..',
  ],
  farm: [
    '..kkkkk..',
    '.kLLCCCk.',
    'kLWkkkCDk',
    'kLkLCCkDk',
    'kCCkkCCDk',
    'kCkCCkCDk',
    'kCDkkkDDk',
    '.kDDDDDk.',
    '..kkkkk..',
  ],
  air: [
    '.......kk',
    '.....kkWk',
    '...kkWLCk',
    '.kkWLCCk.',
    'kWLCCCk..',
    '.kkCCDk..',
    '..kkDDkk.',
    '....kkDk.',
    '......kk.',
  ],
};

const shade = (c: number, f: number) => {
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((c >> s) & 0xff) * f)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

export const classIconKey = (n: ClassIconName) => `td-cls-${n}`;

export function bakeClassIcons(scene: Phaser.Scene) {
  for (const [name, rows] of Object.entries(ROWS) as [ClassIconName, string[]][]) {
    const key = classIconKey(name);
    if (scene.textures.exists(key)) continue;
    const base = name === 'air' ? AIR_COLOR : CLASS_COLOR[name];
    const pal: Record<string, number> = { k: 0x18202c, C: base, L: shade(base, 1.35) | 0x202020, D: shade(base, 0.62), W: 0xffffff };
    const g = scene.make.graphics({}, false);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = pal[row[x]];
        if (c !== undefined) g.fillStyle(c, 1).fillRect(x, y, 1, 1);
      }
    });
    g.generateTexture(key, 9, rows.length);
    g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

export const classIcon = (scene: Phaser.Scene, x: number, y: number, n: ClassIconName, scale = 2) =>
  scene.add.image(x, y, classIconKey(n)).setScale(scale);
