// Avisos (T37): tarjetas pequeñas que entran deslizando en una franja del HUD, se apilan (como mucho 4; la más
// vieja se va) y desaparecen solas. Así nada tapa la sala. Icono a la izquierda y color según el tipo de aviso.
import Phaser from 'phaser';
import { bakeIcons, iconKey, type IconName } from './art/icons';
import { drawBox, FONT, HEX } from './theme';

export type ToastKind = 'info' | 'reward' | 'item' | 'heal' | 'warning' | 'danger' | 'mission';

/** Color de la franja y del título, e icono por defecto, de cada tipo de aviso. */
export const TOAST_STYLE: Readonly<Record<ToastKind, { color: number; icon: IconName }>> = {
  info: { color: 0x4a7ae8, icon: 'pokeball' },
  reward: { color: 0xe0a800, icon: 'ticket' },
  item: { color: 0x2e9a4a, icon: 'bag' },
  heal: { color: 0xe0608a, icon: 'potion' },
  warning: { color: 0xe08a2a, icon: 'key' },
  danger: { color: 0xd63031, icon: 'pokeball' },
  mission: { color: 0xb8860b, icon: 'ticket' },
};

export interface ToastOptions {
  kind?: ToastKind;
  /** Icono distinto del de su tipo. */
  icon?: IconName;
  /** Tinte del icono (p. ej. el disco del color del tipo del poder). */
  tint?: number;
  /** Milisegundos que se queda (por defecto, según lo largo que sea). */
  ms?: number;
}

interface Card {
  box: Phaser.GameObjects.Container;
  h: number;
  timer?: Phaser.Time.TimerEvent;
  leaving: boolean;
}

/** Pila de avisos con la esquina superior izquierda en (x, top) y ancho `w`. */
export class ToastStack {
  private cards: Card[] = [];
  private top: number;

  constructor(
    private scene: Phaser.Scene,
    private x: number,
    top: number,
    private w: number,
    /** Dónde se añaden las tarjetas (p. ej. la capa del HUD) y qué hacer con cada objeto creado (cámaras). */
    private attach: (card: Phaser.GameObjects.Container, parts: Phaser.GameObjects.GameObject[]) => void = () => {},
    private max = 4,
  ) {
    this.top = top;
    bakeIcons(scene);
  }

  /** Mueve la pila (p. ej. justo debajo del minimapa, que cambia de alto). */
  setTop(top: number) {
    if (top === this.top) return;
    this.top = top;
    this.layout();
  }

  /** Muestra un aviso. La primera línea va en negrita como título; el resto, debajo en pequeño. */
  show(text: string, o: ToastOptions = {}) {
    const style = TOAST_STYLE[o.kind ?? 'info'];
    const [title, ...rest] = text.split('\n').filter((l) => l.trim() !== '');
    const pad = 10;
    const textX = 50;
    const tw = this.w - textX - pad;
    const head = this.scene.add.text(textX, pad + 2, title ?? '', {
      fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#' + style.color.toString(16).padStart(6, '0'), wordWrap: { width: tw },
    });
    const body = this.scene.add.text(textX, head.y + head.height + 2, rest.join('\n'), {
      fontFamily: FONT, fontSize: '13px', color: HEX.text, wordWrap: { width: tw },
    });
    const h = Math.max(52, Math.ceil(body.y + (rest.length ? body.height : 0) + pad));
    const bg = drawBox(this.scene.add.graphics(), 0, 0, this.w, h, { radius: 10 });
    // Franja del color del aviso a la izquierda
    bg.fillStyle(style.color, 1).fillRect(8, 8, 6, h - 16);
    const icon = this.scene.add.image(31, h / 2, iconKey(o.icon ?? style.icon)).setScale(1.75);
    if (o.tint !== undefined) icon.setTint(o.tint);
    const parts = [bg, icon, head, body];
    const box = this.scene.add.container(this.x + 40, this.top, parts).setAlpha(0);
    this.attach(box, parts);

    const card: Card = { box, h, leaving: false };
    this.cards.unshift(card);
    // Como mucho `max`: las más viejas se van
    for (const old of this.cards.filter((c) => !c.leaving).slice(this.max)) this.remove(old);
    this.layout(card);
    const ms = o.ms ?? Math.min(5000, 2200 + text.length * 30);
    card.timer = this.scene.time.delayedCall(ms, () => this.remove(card));
  }

  /** Quita todos los avisos (al cambiar de piso, por ejemplo). */
  clear() {
    for (const c of this.cards) {
      c.timer?.remove();
      this.scene.tweens.killTweensOf(c.box);
      c.box.destroy();
    }
    this.cards = [];
  }

  private remove(card: Card) {
    if (card.leaving) return;
    card.leaving = true;
    card.timer?.remove();
    this.scene.tweens.killTweensOf(card.box);
    this.scene.tweens.add({
      targets: card.box,
      x: this.x + 40,
      alpha: 0,
      duration: 220,
      onComplete: () => {
        card.box.destroy();
        this.cards = this.cards.filter((c) => c !== card);
        this.layout();
      },
    });
  }

  /** Coloca las tarjetas de arriba abajo (la más nueva arriba); la nueva entra deslizando desde la derecha. */
  private layout(entering?: Card) {
    let y = this.top;
    for (const c of this.cards) {
      if (c.leaving) continue;
      if (c === entering) {
        c.box.setY(y);
        this.scene.tweens.add({ targets: c.box, x: this.x, alpha: 1, duration: 240, ease: 'Back.easeOut' });
      } else {
        this.scene.tweens.add({ targets: c.box, y, x: this.x, alpha: 1, duration: 180 });
      }
      y += c.h + 8;
    }
  }
}
