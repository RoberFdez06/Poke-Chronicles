// Avisos sobre el juego, más limpios (T: textos flotantes). Según «Textos en pantalla» (Ajustes):
//  - Completos: como siempre, texto que sube (con icono pixel art si es una cifra).
//  - Reducidos (por defecto): icono pixel art + cifra; las palabras, pequeñas y quietas.
//  - Mínimos: solo cambios de vida e iconos sueltos.
// Los nombres de ataque de los jefes no flotan sobre su cabeza: van en una franja fija bajo su barra (bossCallout),
// y los «Enter / A / clic: …» de tiendas y eventos en un panel fijo abajo (PromptPanel), con la tecla dibujada.
import Phaser from 'phaser';
import { loadFx } from '../data/save';
import type { TextsLevel } from '../data/fxSettings';
import { classifyFloat, planFloat, type FloatIcon } from '../data/floatTexts';
import { FONT, lowFx } from './theme';
import { GlyphText } from './art/keyGlyphs';
import { currentInput } from './inputMode';

let cache = { at: -1e9, level: 'reduced' as TextsLevel };
/** Nivel de textos en pantalla (se relee como mucho una vez por segundo). */
export function textsLevel(): TextsLevel {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - cache.at > 1000) cache = { at: now, level: loadFx().texts };
  return cache.level;
}

/** Iconos de 7×7 para los avisos (cada letra un color; '.' vacío). */
const ICONS: Record<FloatIcon, { rows: string[]; pal: Record<string, number> }> = {
  heart: { rows: ['.kk.kk.', 'krrkrrk', 'krwrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'], pal: { k: 0x3a0a10, r: 0xff4a5a, w: 0xffd0d6 } },
  heartMax: { rows: ['.kk.kk.', 'kppkppk', 'kpwpppk', 'kpppppk', '.kpppk.', '..kpk..', '...k...'], pal: { k: 0x24103a, p: 0xb388ff, w: 0xeadcff } },
  coin: { rows: ['..kkk..', '.kyyyk.', 'kyywyyk', 'kywyyyk', 'kyyyyyk', '.kyyyk.', '..kkk..'], pal: { k: 0x5a4208, y: 0xffd34d, w: 0xfff6c8 } },
  key: { rows: ['.kkk...', 'kyyyk..', 'ky.yk..', 'kyyykkk', '.kkkyyk', '....kyk', '.....k.'], pal: { k: 0x4a3008, y: 0xffd34d } },
  potion: { rows: ['..kkk..', '..kwk..', '.kpppk.', 'kppwppk', 'kpppppk', 'kpppppk', '.kkkkk.'], pal: { k: 0x2a1040, p: 0xc39bd3, w: 0xffffff } },
  bomb: { rows: ['....yk.', '...k...', '.kkkk..', 'kggwgk.', 'kgggggk', 'kgggggk', '.kkkkk.'], pal: { k: 0x101828, g: 0x4a5578, w: 0xc8d2ea, y: 0xffd34d } },
  ticket: { rows: ['.......', 'kkkkkkk', 'koooook', '.kowok.', 'koooook', 'kkkkkkk', '.......'], pal: { k: 0x4a2a08, o: 0xffb347, w: 0xffffff } },
  star: { rows: ['...k...', '..kyk..', 'kkkykkk', 'kyyyyyk', '.kyyyk.', 'kyk.kyk', 'kk...kk'], pal: { k: 0x5a4208, y: 0xffe066 } },
  shield: { rows: ['kkkkkkk', 'kbbwbbk', 'kbwbbbk', 'kbbbbbk', '.kbbbk.', '..kbk..', '...k...'], pal: { k: 0x0e2a44, b: 0x6ad0f0, w: 0xe0f8ff } },
  spark: { rows: ['...w...', '...w...', '.w.w.w.', '..www..', 'wwwwwww', '..www..', '.w.w.w.'], pal: { w: 0xffffff } },
};

/** Textura del icono (se hace una vez por partida). Píxel de `p` px. */
export function floatIconKey(scene: Phaser.Scene, icon: FloatIcon, p = 3): string {
  const key = `float-${icon}-${p}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  const ic = ICONS[icon];
  ic.rows.forEach((row, y) => {
    for (let x = 0; x < 7; x++) {
      const c = ic.pal[row[x]];
      if (c !== undefined) g.fillStyle(c, 1).fillRect(x * p, y * p, p, p);
    }
  });
  g.generateTexture(key, 7 * p, 7 * p);
  g.destroy();
  return key;
}

const hexColor = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** Últimos avisos por sitio: si sale otro en el mismo sitio, el anterior se va (no se apilan). */
const recent = new WeakMap<Phaser.Scene, { x: number; y: number; obj: Phaser.GameObjects.Container; at: number }[]>();

/**
 * Aviso que sale sobre algo del juego (lo que antes era un texto que subía). Devuelve el objeto o undefined si con el
 * nivel de textos elegido no se enseña.
 */
export function floatPopup(scene: Phaser.Scene, x: number, y: number, text: string, color: number, depth = 15): Phaser.GameObjects.Container | undefined {
  const level = textsLevel();
  const plan = planFloat(classifyFloat(text, color === 0xffd34d), level);
  if (!plan.show) return undefined;
  const c = scene.add.container(x, y).setDepth(depth);
  let w = 0;
  if (plan.icon) {
    const img = scene.add.image(0, 0, floatIconKey(scene, plan.icon)).setOrigin(0, 0.5);
    c.add(img);
    w = img.width + (plan.text ? 4 : 0);
  }
  if (plan.text) {
    const t = scene.add
      .text(w, 0, plan.text, { fontFamily: FONT, fontSize: `${plan.size}px`, fontStyle: 'bold', color: hexColor(color) })
      .setOrigin(0, 0.5)
      .setStroke('#1d2848', plan.size >= 16 ? 4 : 3);
    c.add(t);
    w += t.width;
  }
  c.each((o: Phaser.GameObjects.GameObject) => void ((o as unknown as { x: number }).x -= w / 2));
  // No se apilan: el aviso anterior en el mismo sitio se quita
  const now = scene.time.now;
  const list = (recent.get(scene) ?? []).filter((r) => r.obj.active && now - r.at < 900);
  if (level !== 'full') {
    for (const r of list) if (Math.abs(r.x - x) < 50 && Math.abs(r.y - y) < 40) r.obj.destroy();
  }
  list.push({ x, y, obj: c, at: now });
  recent.set(scene, list.filter((r) => r.obj.active));
  if (plan.rise && !lowFx()) scene.tweens.add({ targets: c, y: y - 30, alpha: 0, duration: 800, onComplete: () => c.destroy() });
  else scene.tweens.add({ targets: c, alpha: 0, delay: 450, duration: 300, onComplete: () => c.destroy() });
  return c;
}

/**
 * Franja fija con el nombre del ataque del jefe, bajo su barra (a la izquierda, no centrada). Una sola: el siguiente
 * ataque la sustituye. `adopt` mete los objetos en la capa del HUD.
 */
export function bossCallout(scene: Phaser.Scene, x: number, y: number, text: string, color: number, adopt: (o: Phaser.GameObjects.GameObject) => void) {
  const prev = scene.data.get('bossCallout') as Phaser.GameObjects.Container | undefined;
  if (prev?.active) {
    scene.tweens.killTweensOf(prev);
    prev.destroy();
  }
  const c = scene.add.container(x, y);
  const t = scene.add.text(30, 0, text, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0, 0.5).setStroke('#101828', 4);
  const w = t.width + 46;
  const g = scene.add.graphics();
  // Placa pixel: borde oscuro, cuerpo del color del tipo y una flecha de aviso
  g.fillStyle(0x101828, 0.95).fillRect(0, -17, w, 34).fillRect(2, -19, w - 4, 38);
  g.fillStyle(color, 1).fillRect(4, -13, w - 8, 26);
  g.fillStyle(0x000000, 0.25).fillRect(4, 5, w - 8, 8);
  g.fillStyle(0xffffff, 0.35).fillRect(6, -13, w - 12, 2);
  g.fillStyle(0xffd34d, 1);
  [2, 4, 6, 4, 2].forEach((h, i) => g.fillRect(10 + i * 2, -h, 2, h * 2));
  c.add([g, t]);
  adopt(c);
  scene.data.set('bossCallout', c);
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: lowFx() ? 0 : 120 });
  scene.tweens.add({ targets: c, alpha: 0, delay: 1600, duration: 300, onComplete: () => c.destroy() });
}

/**
 * Panel fijo para «Enter / A / clic: comprar…»: antes flotaba sobre cada artículo o mostrador. Mismo uso que el
 * texto de antes (setText y setPosition, que ahora no lo mueve) y con la tecla del dispositivo dibujada.
 */
export class PromptPanel {
  private box: Phaser.GameObjects.Graphics;
  private text: GlyphText;
  private shown = '';
  private x: number;
  private y: number;
  private maxW: number;

  constructor(scene: Phaser.Scene, x: number, y: number, maxW: number, adopt: (o: Phaser.GameObjects.GameObject) => void) {
    this.x = x;
    this.y = y;
    this.maxW = maxW;
    this.box = scene.add.graphics();
    this.text = new GlyphText(scene, x + 14, y, '', { size: 18, color: '#ffffff', maxWidth: maxW - 28 });
    adopt(this.box);
    adopt(this.text);
  }

  /** Lo mismo que antes; «Enter / A / clic:» se cambia por la tecla o el botón del dispositivo activo. */
  setText(s: string): this {
    const d = currentInput();
    const key = `${d}|${s}`;
    if (key === this.shown) return this;
    this.shown = key;
    this.box.clear();
    if (!s) {
      this.text.setText('');
      return this;
    }
    const lead = d === 'gamepad' ? '{pad:A}' : d === 'touch' ? '{touch:tap}' : d === 'mouse' ? '{mouse:left}' : '{key:Enter}';
    const body = s.replace(/^Enter \/ A \/ clic:\s*/, `${lead} `);
    this.text.setText(body, d);
    const w = Math.min(this.maxW, this.text.displayW + 28);
    const h = 40;
    const g = this.box;
    g.fillStyle(0x101828, 0.92).fillRect(this.x + 2, this.y - h / 2, w - 4, h).fillRect(this.x, this.y - h / 2 + 2, w, h - 4);
    g.fillStyle(0x3a4560, 1).fillRect(this.x + 2, this.y - h / 2 + 2, w - 4, 2);
    g.fillStyle(0xffd34d, 1).fillRect(this.x + 2, this.y - h / 2 + 4, 4, h - 8);
    return this;
  }

  /** Antes lo ponía encima del objeto; ahora el panel no se mueve. */
  setPosition(_x?: number, _y?: number): this {
    return this;
  }

  setVisible(v: boolean): this {
    this.box.setVisible(v);
    this.text.setVisible(v);
    return this;
  }
}
