// Efectos pixel por tipo (supervisor): partículas para el rastro de los disparos, el impacto y los estados.
// Cada forma es una textura 8x8 en blanco que se tiñe con los colores del tipo; todo con NEAREST.
//
// Uso (en GameScene):
//   bakeTypeFx(this);                                  // una vez en create()
//   typeTrail(this, shot.x, shot.y, 'fire');           // cada ~60 ms mientras vuela un poder
//   typeImpact(this, enemy.x, enemy.y, 'fire', 1.5);   // al golpear (escala opcional)
//   statusPuff(this, enemy.x, enemy.y, 'burn');        // cada ~300 ms mientras dura un estado
import Phaser from 'phaser';

export type FxShape = 'flame' | 'drop' | 'bolt' | 'leaf' | 'flake' | 'bubble' | 'rock' | 'star' | 'wisp' | 'ring' | 'shard' | 'gust' | 'dot';

const SHAPES: Record<FxShape, string[]> = {
  flame: ['...X....', '..XX....', '..XXX...', '.XXXX.X.', '.XXXXXX.', 'XXXXXXXX', '.XXXXXX.', '..XXXX..'],
  drop: ['...X....', '...X....', '..XXX...', '..XXX...', '.XXXXX..', '.XXXXX..', '.XXXXX..', '..XXX...'],
  bolt: ['....XX..', '...XX...', '..XX....', '.XXXXX..', '....XX..', '...XX...', '..XX....', '.X......'],
  leaf: ['......XX', '....XXXX', '...XXXX.', '..XXXX..', '.XXXX...', '.XXX....', 'XX......', 'X.......'],
  flake: ['...X....', '.X.X.X..', '..XXX...', 'XXXXXXX.', '..XXX...', '.X.X.X..', '...X....', '........'],
  bubble: ['..XXXX..', '.X....X.', 'X..X...X', 'X.X....X', 'X......X', 'X......X', '.X....X.', '..XXXX..'],
  rock: ['........', '..XXX...', '.XXXXX..', 'XXXXXXX.', 'XXXXXXX.', '.XXXXXX.', '..XXXX..', '........'],
  star: ['...X....', '...X....', '..XXX...', 'XXXXXXX.', '..XXX...', '.XX.XX..', '.X...X..', '........'],
  wisp: ['..XXX...', '.XXXXX..', 'XXXXXXX.', 'XX.X.XX.', 'XXXXXXX.', 'XXXXXXX.', 'X.X.X.X.', '........'],
  ring: ['..XXXX..', '.XX..XX.', 'XX....XX', 'X......X', 'X......X', 'XX....XX', '.XX..XX.', '..XXXX..'],
  shard: ['X.......', 'XX......', '.XXX....', '.XXXX...', '..XXXX..', '...XXX..', '....XX..', '.....X..'],
  gust: ['........', 'XXXXX...', '.....XX.', '........', '.XXXXXXX', '........', 'XXXX....', '....XX..'],
  dot: ['........', '..XXX...', '.XXXXX..', '.XXXXX..', '.XXXXX..', '..XXX...', '........', '........'],
};

/** Forma y colores de cada tipo (por nombre en inglés de PokeAPI). */
export const TYPE_FX: Record<string, { shape: FxShape; colors: number[]; rise?: boolean }> = {
  fire: { shape: 'flame', colors: [0xff5a1f, 0xffa62b, 0xfff06a], rise: true },
  water: { shape: 'drop', colors: [0x3d8fd6, 0x7cc6ff, 0xffffff] },
  electric: { shape: 'bolt', colors: [0xffe14a, 0xfff6b0, 0xffffff] },
  grass: { shape: 'leaf', colors: [0x48a848, 0x88d870, 0x2f7a32] },
  ice: { shape: 'flake', colors: [0xbfeaff, 0xffffff, 0x7cc6ff] },
  poison: { shape: 'bubble', colors: [0xa040c0, 0xd080f0, 0x6a2080], rise: true },
  ground: { shape: 'rock', colors: [0xc8a060, 0xa07840, 0xe0c890] },
  rock: { shape: 'rock', colors: [0x9a8a60, 0x6e6040, 0xc0b080] },
  fairy: { shape: 'star', colors: [0xff9ad0, 0xffd0f0, 0xffffff], rise: true },
  ghost: { shape: 'wisp', colors: [0x705898, 0xa08ad0, 0x3a2a5a], rise: true },
  psychic: { shape: 'ring', colors: [0xf95587, 0xff9ab8, 0xffffff] },
  dark: { shape: 'wisp', colors: [0x3a3040, 0x5a4a60, 0x201820], rise: true },
  dragon: { shape: 'flame', colors: [0x6f35fc, 0xa080ff, 0xd0c0ff], rise: true },
  steel: { shape: 'shard', colors: [0xb8b8d0, 0xe0e0f0, 0x8888a8] },
  flying: { shape: 'gust', colors: [0xa98ff3, 0xd8ccff, 0xffffff] },
  fighting: { shape: 'star', colors: [0xc22e28, 0xff7a50, 0xffd0a0] },
  bug: { shape: 'dot', colors: [0xa6b91a, 0xd0e050, 0x707c10] },
  normal: { shape: 'star', colors: [0xd8d8c8, 0xffffff, 0xa8a878] },
};

/** Estado → tipo cuyo efecto usa (los estados de STATUS_EFFECTS). */
const STATUS_TYPE: Record<string, string> = {
  burn: 'fire', poison: 'poison', freeze: 'ice', paralysis: 'electric', soak: 'water', drain: 'grass',
  confuse: 'psychic', knockback: 'fighting', fear: 'dark', weaken: 'fairy',
};

const fxKey = (s: FxShape) => `fx-${s}`;
const fxFor = (type: string) => TYPE_FX[type] ?? TYPE_FX.normal;
/** Tamaño de cada píxel de las partículas (las texturas son 8x8). */
const PX = 3;

/** Crea (una vez) las texturas de todas las formas. */
export function bakeTypeFx(scene: Phaser.Scene) {
  for (const shape of Object.keys(SHAPES) as FxShape[]) {
    const key = fxKey(shape);
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1);
    SHAPES[shape].forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === 'X') g.fillRect(x, y, 1, 1);
    });
    g.generateTexture(key, 8, 8);
    g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

function particle(scene: Phaser.Scene, x: number, y: number, type: string, scale: number, depth: number) {
  const fx = fxFor(type);
  const img = scene.add
    .image(x, y, fxKey(fx.shape))
    .setTint(Phaser.Utils.Array.GetRandom(fx.colors))
    .setScale(PX * scale)
    .setDepth(depth)
    .setAngle(fx.shape === 'flame' || fx.shape === 'wisp' || fx.shape === 'drop' ? 0 : Phaser.Math.Between(0, 3) * 90);
  return { img, fx };
}

/** Una partícula detrás de un disparo de ese tipo: se queda atrás y se desvanece. */
export function typeTrail(scene: Phaser.Scene, x: number, y: number, type: string, scale = 1, depth = 6) {
  const { img, fx } = particle(scene, x + Phaser.Math.Between(-4, 4), y + Phaser.Math.Between(-4, 4), type, scale * 0.8, depth);
  scene.tweens.add({
    targets: img, alpha: 0, scale: img.scale * 0.4, y: img.y + (fx.rise ? -18 : 8), duration: 360,
    onComplete: () => img.destroy(),
  });
}

/** Explosión de partículas de ese tipo al golpear. */
export function typeImpact(scene: Phaser.Scene, x: number, y: number, type: string, scale = 1, count = 9, depth = 7) {
  for (let i = 0; i < count; i++) {
    const { img, fx } = particle(scene, x, y, type, scale, depth);
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const d = (28 + Math.random() * 30) * scale;
    scene.tweens.add({
      targets: img, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d + (fx.rise ? -14 : 6), alpha: 0, angle: img.angle + 90,
      duration: 380 + Math.random() * 200, ease: 'Cubic.easeOut', onComplete: () => img.destroy(),
    });
  }
}

/** Una bocanada del estado (quemado, envenenado, congelado…) sobre un enemigo. */
export function statusPuff(scene: Phaser.Scene, x: number, y: number, status: string, scale = 1, depth = 7) {
  const type = STATUS_TYPE[status] ?? status;
  for (let i = 0; i < 2; i++) {
    const { img } = particle(scene, x + Phaser.Math.Between(-16, 16), y + Phaser.Math.Between(-8, 8), type, scale * 0.7, depth);
    scene.tweens.add({
      targets: img, y: img.y - 26 * scale, alpha: 0, duration: 520, delay: i * 90, onComplete: () => img.destroy(),
    });
  }
}

// --- Proyectiles con la forma de su tipo (supervisor, 19/10) ---
// Cada disparo es la forma del tipo (llama, gota, rayo, hoja, copo…) en 10x10 con contorno oscuro y brillo,
// en los colores del tipo (sin teñir). Cómo se orienta al volar:
//   'tail'  la punta del dibujo queda detrás (llama, gota): bola de fuego, gota que cae hacia delante
//   'head'  la parte redonda va delante (fantasma)
//   'aim'   apunta hacia donde va (rayo, hoja, esquirla, ráfaga)
//   'spin'  gira sobre sí mismo (estrella, roca, copo, burbuja, anillo, punto)
export type ProjMode = 'tail' | 'head' | 'aim' | 'spin';
const PROJ_MODE: Record<FxShape, ProjMode> = {
  flame: 'tail', drop: 'tail', wisp: 'head', bolt: 'aim', leaf: 'aim', shard: 'aim', gust: 'aim',
  star: 'spin', rock: 'spin', flake: 'spin', bubble: 'spin', ring: 'spin', dot: 'spin',
};
/** Giro extra para que las formas en diagonal (rayo, hoja, esquirla) apunten bien. */
const PROJ_OFFSET: Partial<Record<FxShape, number>> = { bolt: Math.PI * 0.75, leaf: Math.PI * 0.75, shard: Math.PI * 0.25, gust: Math.PI / 2 };

export const projKey = (type: string) => `proj-${TYPE_FX[type] ? type : 'normal'}`;
export const projMode = (type: string): ProjMode => PROJ_MODE[fxFor(type).shape];

/** Ángulo (radianes) del dibujo para un proyectil que va en dirección `a`. */
export function projRotation(type: string, a: number): number {
  const shape = fxFor(type).shape;
  switch (PROJ_MODE[shape]) {
    case 'tail':
      return a - Math.PI / 2;
    case 'head':
      return a + Math.PI / 2;
    case 'aim':
      return a + (PROJ_OFFSET[shape] ?? 0) + Math.PI / 2;
    default:
      return 0;
  }
}

/** Crea (una vez) las texturas de proyectil de todos los tipos (10x10). */
export function bakeProjectiles(scene: Phaser.Scene) {
  for (const type of Object.keys(TYPE_FX)) {
    const key = projKey(type);
    if (scene.textures.exists(key)) continue;
    const fx = TYPE_FX[type];
    const rows = SHAPES[fx.shape];
    const on = (x: number, y: number) => y >= 0 && y < 8 && x >= 0 && x < 8 && rows[y][x] === 'X';
    const g = scene.make.graphics({}, false);
    // Contorno: cualquier hueco que toca la forma
    for (let y = -1; y <= 8; y++) {
      for (let x = -1; x <= 8; x++) {
        if (on(x, y)) continue;
        if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) g.fillStyle(0x18202c, 1).fillRect(x + 1, y + 1, 1, 1);
      }
    }
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (!on(x, y)) continue;
        // Brillo arriba a la izquierda, sombra abajo a la derecha
        const edgeTL = !on(x - 1, y) || !on(x, y - 1);
        const edgeBR = !on(x + 1, y) || !on(x, y + 1);
        const c = edgeTL ? fx.colors[1] : edgeBR ? shadeHex(fx.colors[0], -0.25) : fx.colors[0];
        g.fillStyle(c, 1).fillRect(x + 1, y + 1, 1, 1);
      }
    }
    // Un punto de luz
    for (let y = 0; y < 8; y++) {
      const x = rows[y].indexOf('X');
      if (x >= 0 && on(x + 1, y + 1)) {
        g.fillStyle(fx.colors[2], 1).fillRect(x + 2, y + 2, 1, 1);
        break;
      }
    }
    g.generateTexture(key, 10, 10);
    g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

function shadeHex(c: number, f: number) {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}
