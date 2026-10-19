// Iconos pixel de los objetos (supervisor): cada pasivo, potenciador de tipo y activo con su dibujo (gafas, lupa,
// garra, pluma, piedra, cinta, pañuelo, hierba, concha, casco, chaleco, radar, imán, cuchara…) en su color, en vez
// de la bolsa genérica. Plantillas de 16x16: P color del objeto, p más oscuro, L más claro, W blanco, k contorno.
import Phaser from 'phaser';
import { PASSIVE_ITEMS } from '../../data/items';
import { ACTIVE_ITEMS } from '../../data/synergies';
import { iconKey, bakeIcons } from './icons';

const T: Record<string, string[]> = {
  glasses: ['', '', '', '', '.kkkkkk..kkkkkk.', 'kPPPPPPkkPPPPPPk', 'kPLLPPPkkPLLPPPk', 'kPLPPPPk.kPLPPPk', 'kPPPPPpk.kPPPPpk', '.kPPPpk...kPPpk.', '..kkkk.....kkkk.'],
  lens: ['....kkkk', '..kkLLLLkk', '.kLWWLLLLLk', '.kLWLLLLLLk', 'kLLLLLLLLLLk', 'kLLLLLLLLLLk', 'kLLLLLLLLLLk', '.kLLLLLLLLk', '.kLLLLLLLLk', '..kkLLLLkkpk', '....kkkk.kppk', '..........kppk', '...........kppk', '............kppk', '.............kk'],
  claw: ['', '..k....k....k', '.kWk..kWk..kWk', '.kWk..kWk..kWk', 'kWWk.kWWk.kWWk', 'kWLk.kWLk.kWLk', 'kWLk.kWLk.kWLk', 'kLLkkkLLkkkLLk', '.kPPPPPPPPPPPk', '.kPPPPPPPPPPPk', '..kpppppppppk', '...kkkkkkkkk'],
  feather: ['...........kk', '..........kLLk', '.........kLPLk', '........kLPPk', '.......kLPPLk', '......kLPPPk', '.....kLPPPLk', '....kLPPPPk', '...kLPPPLk', '...kLPPPk', '..kLPPPk', '..kPPpk', '.kppk', '.kk'],
  rock: ['', '.....kkkkk', '...kkLLPPPkk', '..kLLPPPPPPPk', '.kLPPPPPPpPPPk', '.kPPPPPPPPPPpk', 'kPPPpPPPPPPPPpk', 'kPPPPPPPPpPPPpk', 'kpPPPPPPPPPPppk', '.kppPPPPPPpppk', '..kkppppppkk', '....kkkkkk'],
  ball: ['.....kkkkk', '...kkLLPPPkk', '..kLWLPPPPPPk', '.kLWLPPPPPPPpk', '.kLLPPPPPPPPpk', 'kPPPPPPPPPPPPpk', 'kPPPPPPPPPPPppk', 'kPPPPPPPPPPPppk', 'kpPPPPPPPPPpppk', '.kpPPPPPPPpppk', '.kppPPPPppppk', '..kkppppppkk', '....kkkkkk'],
  band: ['', '', '', 'kkkkkkkkkkkkkkk', 'kLLLLLLLLLLLLLk', 'kPPPPPPPPPPPPPk', 'kPPPPPWWWPPPPPk', 'kPPPPPWkWPPPPPk', 'kpppppWWWpppppk', 'kkkkkkkPkkkkkkk', '......kPk', '.....kPPk', '.....kPpk', '....kPpk', '....kkk'],
  scarf: ['', '..kkkkkkkkkk', '.kLLLLLLLLLLk', '.kPPPPPPPPPPk', '.kPPPPPPPPPPk', '..kpppppppPPk', '...kkkkkkkPPk', '.........kPPk', '.........kPpk', '........kPPpk', '........kPPk', '........kPpk', '.......kPPk', '.......kppk', '.......kkk'],
  herb: ['', '.......kk', '......kLLk', '.....kLPPLk', '..kk.kLPPLk.kk', '.kLLkkPPPPkkLLk', '.kLPPkPPPPkPPLk', '..kPPPkPPkPPPk', '...kPPPkkPPPk', '....kkPPPPkk', '......kppk', '......kppk', '......kppk', '.......kk'],
  shell: ['', '......kkkk', '....kkLLLLkk', '...kLLPPPPLLk', '..kLPPLPPLPPLk', '..kLPLPPPPLPLk', '.kLPPLPPPPLPPLk', '.kPPLPPPPPPLPPk', '.kPPLPPPPPPLPPk', 'kPPPLPPPPPPLPPPk', 'kppppppppppppppk', '.kkkkkkkkkkkkkk'],
  helmet: ['.....k....k', '....kWk..kWk', '...kkWkkkkWkk', '..kPPPPPPPPPPk', '.kPLLPPPPPPPPPk', 'kWPLPPPPPPPPPPWk', 'kkPPPPPPPPPPPPkk', '.kPPPPPPPPPPPPk', 'kWPPPkkkkkkPPPWk', 'kkPPk......kPPkk', '.kPPk......kPPk', '.kppk......kppk', '..kk........kk'],
  powder: ['', '.......W', '......WLW', '.......W...W', '..W.......WLW', '.WLW.......W', '..W...kkkk', '.....kLLPPk', '...kkLPPPPPkk', '..kLPPPPPPPPPk', '.kPPPPPPPPPPPpk', 'kPPPPPPPPPPPpppk', 'kppppppppppppppk', '.kkkkkkkkkkkkkk'],
  vest: ['..kkk......kkk', '.kPPPk....kPPPk', 'kPPPPPkkkkPPPPPk', 'kPLPPPPLLPPPPPpk', 'kPLPPPPWkPPPPPpk', 'kPLPPPPLLPPPPPpk', 'kPPPPPPWkPPPPPpk', 'kPPPPPPLLPPPPPpk', 'kPPPPPPWkPPPPPpk', 'kpPPPPPLLPPPPppk', 'kppppppppppppppk', 'kkkkkkkkkkkkkkkk'],
  radar: ['.kkkkkkkkkkkkk', 'kPPPPPPPPPPPPPk', 'kPkkkkkkkkkkkPk', 'kPkGGGGGGGGGkPk', 'kPkGgGGGgGGGkPk', 'kPkGGgGgGGWGkPk', 'kPkGGGgGGGGGkPk', 'kPkGgGGGgGGGkPk', 'kPkGGGGGGGGGkPk', 'kPkkkkkkkkkkkPk', 'kPPPPPWPWPPPPPk', 'kppppppppppppPk', '.kkkkkkkkkkkkk'],
  telescope: ['', '..............kk', '............kkLk', '..........kkLPPk', '........kkLPPPk', '......kkLPPPkk', '....kkLPPPkk', '..kkLPPPkk', '.kWLPPkk', 'kWLPkk', 'kLkk...k', '.k....kpk', '.....kppk', '....kppk', '....kkk'],
  apple: ['......kk', '......kbk', '.....kkbk', '...kkPPkPPkk', '..kPPLPPPPPPk', '..kPLWPPPPPPk', '...kkPPPPPkk', '....kWWWWWk', '....kWWWWWk', '...kkPPPPPkk', '..kPPPPPPPPPk', '..kPPPPPPPPpk', '...kkpppppkk', '.....kkkkk'],
  fang: ['', '...kkkkkkkkk', '..kLLLLLLLLLk', '..kLWWLLLLLPk', '...kLWLLLLPk', '...kLLLLLLPk', '....kLLLLPk', '....kLLLLPk', '.....kLLPk', '.....kLLPk', '......kPk', '......kk'],
  magnet: ['', '..kkkk....kkkk', '.kWWWk....kWWWk', '.kWWWk....kWWWk', '.kPPPk....kPPPk', '.kPPPk....kPPPk', '.kPPPk....kPPPk', '.kPPPPk..kPPPPk', '..kPPPPkkPPPPk', '...kPPPPPPPPk', '....kkppppkk', '......kkkk'],
  drop: ['.......kk', '......kLLk', '.....kLWLPk', '.....kWLPPk', '....kLLPPPPk', '...kLPPPPPPPk', '..kLPPPPPPPPPk', '..kPPPPPPPPPPk', '.kPPPPPPPPPPPpk', '.kPPPPPPPPPPppk', '.kpPPPPPPPPpppk', '..kppPPPPPpppk', '...kkppppppkk', '.....kkkkkk'],
  seed: ['', '......kkk', '.....kLLPk', '....kLWLPPk', '...kLLLPPPPk', '...kLLPPPPPk', '..kLPPPPPPPpk', '..kPPPPPPPPpk', '..kPPPPPPPppk', '...kPPPPPpppk', '....kppppppk', '.....kkkkkk'],
  crystal: ['.......kk', '......kWLk', '.....kWLLPk', '....kWLLLPPk', '...kWLLLLPPPk', '..kWLLLLLPPPPk', '..kLLLLLLPPPPk', '...kLLLLPPPPk', '....kLLLPPPk', '.....kLLPPk', '......kLPk', '.......kk'],
  spoon: ['..........kkk', '.........kLLLk', '........kLWLLPk', '........kLLLPPk', '.........kLPPk', '........kPpkk', '.......kPpk', '......kPpk', '.....kPpk', '....kPpk', '...kPpk', '..kPpk', '..kkk'],
  tag: ['...kkkkkkkk', '...kWWWWWWk', '...kWPPPPWk', '...kWWWWWWk', '...kWPWWPWk', '...kWWPPWWk', '...kWPWWPWk', '...kWWWWWWk', '...kWPPPPWk', '...kWWWWWWk', '...kkkkkkkk', '.....kPk', '....kPk', '....kk'],
  plate: ['', '.kkkkkkkkkkkkk', 'kLLLLLLLLLLLLPk', 'kLWLLLLLLLLLLPk', 'kLLPPPPPPPPLLPk', 'kLLPLLLLLLPLLPk', 'kLLPLLLLLLPLLPk', 'kLLPPPPPPPPLLPk', 'kLLLLLLLLLLLLPk', 'kLWLLLLLLLLLWPk', 'kPPPPPPPPPPPPPk', '.kkkkkkkkkkkkk'],
  beak: ['', '', '..kkk', '..kLLkkk', '..kLWLLLkkk', '..kLLLLLLLLkkk', '..kPPPPPPPPPPPk', '..kPPPPPPPPkkk', '..kppppkkkk', '..kpkkk', '..kk'],
  arrow: ['.............kk', '...........kkWk', '..........kWWk', '.........kPWk', '........kPPk', '.......kPPk', '......kPPk', '.....kPPk', '..k.kPPk', '.kpkPPk', '.kppPk', '..kpppk', '.kppkppk', '.kk..kk'],
  flute: ['', '..............kk', '............kkLk', '..........kkLPk', '........kkLPPk', '......kkLPkPk', '....kkLPPPPk', '..kkLPkPPkk', '.kLPPPPkk', 'kLPPkkk', 'kPkk', '.k'],
  block: ['', '...kkkkkkkkk', '..kLLLLLLLLPk', '.kLWLLLLLLPPk', '.kkkkkkkkkPPk', '.kPPPPPPPkPPk', '.kPPLPPPPkPPk', '.kPPPPPPPkPk', '.kPPPPPPPkk', '.kkkkkkkkk'],
  bottle: ['......kkkk', '......kWWk', '.....kkkkkk', '......kLLk', '.....kLLPPk', '....kLWPPPPk', '....kLWPPPPk', '....kLPWWPPk', '....kLPPWPPk', '....kLPWWPPk', '....kLPPPPPk', '....kPPPPPpk', '.....kkkkkk'],
};

/** Qué dibujo lleva cada objeto (los que no salen aquí, una bola de su color). */
const SHAPE: Record<string, string> = {
  vidasfera: 'ball', 'garra-rapida': 'claw', lupa: 'lens', 'pluma-ligera': 'feather', 'doble-equipo': 'ball', 'piedra-dura': 'rock',
  'pelota-saltarina': 'ball', restos: 'apple', 'cinta-elegida': 'band', 'gafas-elegidas': 'glasses', 'panuelo-elegido': 'scarf',
  'lente-zoom': 'lens', periscopio: 'telescope', 'garra-afilada': 'claw', 'banda-focus': 'band', 'hierba-blanca': 'herb',
  'concha-campana': 'shell', 'casco-dentado': 'helmet', 'polvo-brillo': 'powder', 'gafas-protectoras': 'glasses', 'chaleco-asalto': 'vest',
  telescopio: 'telescope', 'cola-gemela': 'feather', pokeradar: 'radar', 'moneda-amuleto': 'ball', 'bola-ferrea': 'ball',
  carbon: 'rock', 'agua-mistica': 'drop', iman: 'magnet', 'semilla-milagro': 'seed', 'hielo-eterno': 'crystal', 'cinturon-negro': 'band',
  'cuchara-torcida': 'spoon', 'colmillo-dragon': 'fang', hechizo: 'tag', 'gafas-de-sol': 'glasses', 'revestimiento-metalico': 'plate',
  'seda-fina': 'scarf', 'pico-afilado': 'beak', 'polvo-plata': 'powder', 'flecha-venenosa': 'arrow', 'arena-fina': 'powder',
  'poke-flauta': 'flute', repelente: 'bottle', pokeblock: 'block', 'ataque-x': 'bottle',
  'baya-zidra': 'apple', 'baya-meloc': 'apple', 'caramelo-raro': 'ball', 'piedra-escudo': 'rock', 'pluma-pretty': 'feather',
  'orbe-vital': 'ball', 'lupa-doble': 'lens', 'cascabel-cura': 'shell', 'tablilla-pesada': 'plate', 'reloj-arena': 'drop',
};

const shade = (c: number, f: number) => {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
};

export const itemIconKey = (id: string) => (id === 'baya-aranja' ? iconKey('aranja') : `item-${id}`);

/** Crea (una vez) las texturas de los iconos de todos los objetos. */
export function bakeItemIcons(scene: Phaser.Scene) {
  bakeIcons(scene);
  const all: { id: string; color: number }[] = [...PASSIVE_ITEMS, ...ACTIVE_ITEMS];
  for (const { id, color } of all) {
    const key = itemIconKey(id);
    if (scene.textures.exists(key)) continue;
    const rows = T[SHAPE[id] ?? 'ball'];
    // Si el color es muy oscuro, el "claro" tira más a gris para que se lea
    const lum = ((color >> 16) & 255) * 0.3 + ((color >> 8) & 255) * 0.59 + (color & 255) * 0.11;
    const pal: Record<string, number> = {
      k: 0x101828, P: color, p: shade(color, -0.35), L: shade(color, lum < 80 ? 0.55 : 0.4), W: 0xffffff, b: 0x7a4a24, G: 0x58d068, g: 0x1f6a3a,
    };
    const g = scene.make.graphics({}, false);
    rows.forEach((row, j) => {
      for (let i = 0; i < Math.min(16, row.length); i++) {
        const c = row[i];
        if (c !== '.' && pal[c] !== undefined) g.fillStyle(pal[c], 1).fillRect(i, j, 1, 1);
      }
    });
    g.generateTexture(key, 16, 16);
    g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}
