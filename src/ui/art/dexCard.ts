// Arte de la Pokédex (supervisor): casillas con ventana del color del tipo, marco y gemas de rareza, brillo en
// legendarios y ultraentes, y la ficha grande que se abre al elegir un Pokémon (se voltea como una carta).
// Coordenadas de diseño (960x640, fitDesign).
import Phaser from 'phaser';
import { RARITIES, RARITY_LABEL, type Rarity } from '../../data/gacha';
import { typeColor, typeNameEs } from '../../data/types';
import { STAT_KEYS, type BaseStats } from '../../data/pokeStats';
import { addTypeChip, COLORS, drawBox, FONT, HEX, RARITY_COLORS } from '../theme';
import { addRays } from './gachaMachine';
import { bakeCombatFx, starBurst } from './combatFx';

const STAR = 'cfx-star';

/** Mezcla un color con blanco (t = 0 igual, 1 blanco). */
export function lighten(c: number, t: number) {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  const m = (v: number) => Math.round(v + (255 - v) * t);
  return (m(r) << 16) | (m(g) << 8) | m(b);
}

/** Cuántas gemas tiene cada rareza (común 1 … legendario 5). */
export const rarityGems = (r: Rarity) => RARITIES.indexOf(r) + 1;

/** Gemas de rareza en fila (rombos pixel) centradas en x. */
export function drawGems(g: Phaser.GameObjects.Graphics, x: number, y: number, rarity: Rarity, u = 2, dim = false) {
  const n = rarityGems(rarity);
  const col = dim ? 0x6a7494 : RARITY_COLORS[rarity];
  const step = u * 5;
  const x0 = x - ((n - 1) * step) / 2;
  for (let i = 0; i < n; i++) {
    const cx = Math.round(x0 + i * step);
    g.fillStyle(0x101828, 1).fillRect(cx - u, y - u * 2, u * 2, u * 4).fillRect(cx - u * 2, y - u, u * 4, u * 2);
    g.fillStyle(col, 1).fillRect(cx - u / 2, y - u * 1.5, u, u * 3).fillRect(cx - u * 1.5, y - u / 2, u * 3, u);
    if (!dim) g.fillStyle(0xffffff, 0.8).fillRect(cx - u / 2, y - u * 1.5, u / 2 + 0.5, u / 2 + 0.5);
  }
  return g;
}

/**
 * Fondo de una casilla de la Pokédex (centrada en 0,0): marco de rareza, ventana con el color del tipo, rayas en
 * diagonal y suelo. Sin tener el Pokémon: todo apagado.
 */
export function drawDexTile(g: Phaser.GameObjects.Graphics, w: number, h: number, o: { owned: boolean; rarity: Rarity; type: string }) {
  const tc = typeColor(o.type);
  drawBox(g, -w / 2, -h / 2, w, h, {
    radius: 10,
    border: o.owned ? RARITY_COLORS[o.rarity] : 0x4a5578,
    fill: o.owned ? COLORS.panel : 0x3a4566,
  });
  const wx = -w / 2 + 8;
  const wy = -h / 2 + 20;
  const ww = w - 16;
  const wh = h - 50;
  g.fillStyle(o.owned ? lighten(tc, 0.55) : 0x2b3450, 1).fillRect(wx, wy, ww, wh);
  // Rayas en diagonal del color del tipo
  g.fillStyle(o.owned ? tc : 0x232a40, o.owned ? 0.18 : 0.6);
  for (let k = -wh; k < ww; k += 12) {
    for (let j = 0; j < wh; j += 2) {
      const px = wx + k + j;
      if (px >= wx && px < wx + ww - 1) g.fillRect(px, wy + wh - j - 2, 4, 2);
    }
  }
  // Suelo: elipse más oscura donde se apoya
  g.fillStyle(o.owned ? lighten(tc, 0.2) : 0x1d2438, o.owned ? 0.55 : 0.8).fillEllipse(0, wy + wh - 8, ww * 0.7, 12);
  // Borde interior de la ventana
  g.lineStyle(2, o.owned ? lighten(tc, 0.1) : 0x4a5578, 1).strokeRect(wx, wy, ww, wh);
  drawGems(g, w / 2 - 8 - rarityGems(o.rarity) * 5, -h / 2 + 11, o.rarity, 2, !o.owned);
  return g;
}

/** Destellos que aparecen y se apagan sobre las casillas de legendarios y ultraentes. Devuelve los objetos. */
export function addTwinkles(scene: Phaser.Scene, w: number, h: number, color: number, count = 3) {
  bakeCombatFx(scene);
  const out: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < count; i++) {
    const s = scene.add.image(Phaser.Math.Between(-w / 2 + 10, w / 2 - 10), Phaser.Math.Between(-h / 2 + 22, h / 2 - 34), STAR)
      .setTint(i % 2 ? color : 0xffffff).setScale(0).setAlpha(0.9);
    const loop = () => {
      s.setPosition(Phaser.Math.Between(-w / 2 + 10, w / 2 - 10), Phaser.Math.Between(-h / 2 + 22, h / 2 - 34));
      scene.tweens.add({ targets: s, scale: 1.6, angle: 90, duration: 260, yoyo: true, ease: 'Quad.easeOut', delay: Phaser.Math.Between(300, 1800), onComplete: loop });
    };
    loop();
    out.push(s);
  }
  return out;
}

export interface DexCardInfo {
  id: number;
  name: string;
  rarity: Rarity;
  types: string[];
  owned: boolean;
  shiny: boolean;
  /** Textura del sprite (ya cargada) o undefined. */
  texture?: string;
}

const STAT_LABEL: Record<(typeof STAT_KEYS)[number], string> = {
  hp: 'PS', attack: 'Ataque', defense: 'Defensa', spAttack: 'At. Esp.', spDefense: 'Def. Esp.', speed: 'Velocidad',
};

/**
 * Ficha grande de un Pokémon encima de la Pokédex: entra volteándose como una carta, rayos del color de su tipo
 * detrás del sprite, que cae botando; tipos, rareza con gemas y barras de estadísticas que se llenan.
 * `dir` (-1/1) la hace entrar deslizando de lado al pasar al anterior/siguiente.
 */
export class DexCard {
  readonly root: Phaser.GameObjects.Container;
  private bars?: Phaser.GameObjects.Graphics;
  private statsText: Phaser.GameObjects.Text[] = [];
  private closing = false;
  private statTween?: Phaser.Tweens.Tween;

  constructor(private scene: Phaser.Scene, readonly info: DexCardInfo, onClose: () => void, dir = 0) {
    const W = 600;
    const Hh = 400;
    const root = scene.add.container(480, 322).setDepth(50);
    this.root = root;
    const tc = typeColor(info.types[0] ?? 'normal');
    const owned = info.owned;

    // Cortina: oscurece y cierra con clic
    const dim = scene.add.rectangle(0, 0, 4000, 4000, 0x0d1425, 0.7).setInteractive();
    dim.on('pointerdown', () => onClose());
    const frame = drawBox(scene.add.graphics(), -W / 2, -Hh / 2, W, Hh, { radius: 16, border: owned ? RARITY_COLORS[info.rarity] : 0x4a5578 });
    frame.setInteractive(new Phaser.Geom.Rectangle(-W / 2, -Hh / 2, W, Hh), Phaser.Geom.Rectangle.Contains);

    // Escenario del sprite (izquierda)
    const sx = -W / 2 + 150;
    const stage = scene.add.graphics();
    stage.fillStyle(owned ? lighten(tc, 0.45) : 0x2b3450, 1).fillRect(-W / 2 + 18, -Hh / 2 + 18, 264, Hh - 36);
    stage.lineStyle(3, owned ? tc : 0x4a5578, 1).strokeRect(-W / 2 + 18, -Hh / 2 + 18, 264, Hh - 36);
    const rays = addRays(scene, sx, -10, owned ? 0xffffff : 0x3a4566, 190, 14);
    rays.setAlpha(owned ? 0.55 : 0.4);
    const ground = scene.add.ellipse(sx, 98, 170, 34, owned ? lighten(tc, 0.1) : 0x1d2438, 0.7);
    const parts: Phaser.GameObjects.GameObject[] = [dim, frame, stage, rays, ground];
    // Máscara: los rayos no se salen del escenario
    const maskG = scene.make.graphics({}, false).fillRect(480 - W / 2 + 18, 322 - Hh / 2 + 18, 264, Hh - 36);
    rays.setMask(maskG.createGeometryMask());
    root.once(Phaser.GameObjects.Events.DESTROY, () => maskG.destroy());

    let sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
    if (info.texture && scene.textures.exists(info.texture)) {
      const img = scene.add.image(sx, -120, info.texture).setOrigin(0.5, 0.92).setAlpha(0);
      img.setScale(200 / Math.max(img.width, img.height, 1));
      if (!owned) img.setTintFill(0x161d33);
      sprite = img;
    } else {
      sprite = scene.add.text(sx, -120, '?', { fontFamily: FONT, fontSize: '120px', fontStyle: 'bold', color: owned ? HEX.text : '#5a6488' }).setOrigin(0.5, 0.9).setAlpha(0);
    }
    parts.push(sprite);
    if (info.shiny) {
      parts.push(scene.add.text(-W / 2 + 40, -Hh / 2 + 40, '★ SHINY', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffd34d' }).setStroke('#8a6d1a', 4));
    }

    // Datos (derecha)
    const rx = -W / 2 + 306;
    const txt = (x: number, y: number, s: string, size: number, color: string = HEX.text, bold = false) =>
      scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' });
    parts.push(txt(rx, -Hh / 2 + 22, `#${String(info.id).padStart(4, '0')}`, 16, HEX.textSoft));
    parts.push(txt(rx, -Hh / 2 + 42, owned ? info.name : '???', 32, HEX.text, true));
    info.types.forEach((t, i) => parts.push(...addTypeChip(scene, rx + 50 + i * 106, -Hh / 2 + 104, owned ? typeNameEs(t) : '???', owned ? typeColor(t) : 0x6a7494, 96, 26)));
    const gems = drawGems(scene.add.graphics(), rx + 8 + rarityGems(info.rarity) * 5, -Hh / 2 + 146, info.rarity, 3, !owned);
    parts.push(gems, txt(rx + 26 + rarityGems(info.rarity) * 15, -Hh / 2 + 146, RARITY_LABEL[info.rarity], 17, owned ? '#' + RARITY_COLORS[info.rarity].toString(16).padStart(6, '0') : HEX.textSoft, true).setOrigin(0, 0.5));

    if (owned) {
      this.bars = scene.add.graphics();
      parts.push(this.bars);
      STAT_KEYS.forEach((k, i) => {
        const y = -Hh / 2 + 186 + i * 30;
        parts.push(txt(rx, y, STAT_LABEL[k], 15, HEX.textSoft).setOrigin(0, 0.5));
        const v = txt(rx + 270, y, '…', 15, HEX.text, true).setOrigin(1, 0.5);
        this.statsText.push(v);
        parts.push(v);
      });
    } else {
      parts.push(txt(rx, -Hh / 2 + 200, 'Aún no lo tienes.\nConsíguelo en el gacha\npara ver sus estadísticas.', 18, HEX.textSoft).setLineSpacing(6));
    }
    parts.push(txt(rx + 138, Hh / 2 - 34, '◀ ▶ anterior / siguiente\nEnter, Esc, B o clic: cerrar', 13, HEX.textSoft).setOrigin(0.5).setAlign('center'));
    root.add(parts);

    // Entrada: se voltea como una carta (o desliza de lado al pasar a otro) y el Pokémon cae botando
    if (dir) {
      root.x += dir * 140;
      root.setAlpha(0);
      scene.tweens.add({ targets: root, x: 480, alpha: 1, duration: 200, ease: 'Cubic.easeOut' });
    } else {
      root.setScale(0.05, 0.9);
      scene.tweens.add({ targets: root, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' });
    }
    scene.tweens.add({ targets: sprite, alpha: 1, duration: 120, delay: dir ? 60 : 180 });
    scene.tweens.add({
      targets: sprite, y: 98, duration: 420, delay: dir ? 60 : 180, ease: 'Bounce.easeOut',
      onComplete: () => {
        if (owned) {
          starBurst(scene, 480 + sx, 322 - 20, tc, 6, 1.2);
          scene.tweens.add({ targets: sprite, y: 90, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
      },
    });
    // Destellos del borde en legendarios y ultraentes
    if (owned && (info.rarity === 'legendary' || info.rarity === 'ultra')) {
      for (const t of addTwinkles(scene, W, Hh, RARITY_COLORS[info.rarity], 5)) root.add(t);
    }
  }

  /** Rellena las barras de estadísticas (se llenan de izquierda a derecha). */
  setStats(stats: BaseStats) {
    if (!this.bars || this.closing) return;
    const W = 600;
    const Hh = 400;
    const rx = -W / 2 + 306;
    const bx = rx + 96;
    const bw = 130;
    const anim = { t: 0 };
    const draw = () => {
      if (this.closing || !this.bars?.active) return;
      const g = this.bars.clear();
      STAT_KEYS.forEach((k, i) => {
        const y = -Hh / 2 + 186 + i * 30;
        const v = stats[k];
        const fill = Math.min(1, v / 180) * anim.t;
        const col = v >= 110 ? 0x3fc35a : v >= 75 ? 0xf2c12e : 0xe0703a;
        g.fillStyle(0x101828, 1).fillRect(bx - 2, y - 7, bw + 4, 14);
        g.fillStyle(0x404a5c, 1).fillRect(bx, y - 5, bw, 10);
        g.fillStyle(col, 1).fillRect(bx, y - 5, Math.round(bw * fill), 10);
        g.fillStyle(0xffffff, 0.35).fillRect(bx, y - 5, Math.round(bw * fill), 3);
        this.statsText[i]?.setText(String(Math.round(v * anim.t)));
      });
    };
    this.statTween = this.scene.tweens.add({ targets: anim, t: 1, duration: 650, ease: 'Cubic.easeOut', onUpdate: draw, onComplete: draw });
  }

  /** Se cierra volteándose. */
  close(done?: () => void) {
    if (this.closing) return;
    this.closing = true;
    this.statTween?.stop();
    this.scene.tweens.add({
      targets: this.root, scaleX: 0.05, alpha: 0.4, duration: 150, ease: 'Quad.easeIn',
      onComplete: () => {
        this.root.destroy();
        done?.();
      },
    });
  }

  /** Quitar al momento (al pasar a otro). */
  destroy() {
    this.closing = true;
    this.statTween?.stop();
    this.root.destroy();
  }
}
