import Phaser from 'phaser';
import { W, H } from '../ui/layout';
import { FONT } from '../ui/theme';
import { typeColor, typeNameEs } from '../data/types';
import { sfx } from '../ui/audio';

/** Un luchador de la intro: textura (y frame si es una hoja de sprites), nombre y tipos. */
export interface Fighter {
  texture: string;
  frame?: string | number;
  name: string;
  types?: string[];
}

export interface BossIntroData {
  player: Fighter;
  boss: Fighter;
  /** Texto pequeño encima del nombre del jefe, p. ej. "Legendario · Piso 3". */
  subtitle?: string;
  /** Se llama al terminar (o al saltarla): la partida debe parar esta escena y reanudarse. */
  onDone: () => void;
  /** Reto final con trío: los otros dos entran uno a uno detrás del primero. */
  extra?: Fighter[];
  /** Estilo: 'mini' (minijefe, más corto y plateado) o 'final' (reto final, dorado y más largo). */
  tier?: 'mini' | 'final';
}

const DURATION = 2600;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Intro de jefe tipo "VS" de los combates Pokémon (supervisor). Se lanza encima de la partida en pausa:
 *   this.scene.launch('BossIntro', { player, boss, subtitle, onDone: () => { this.scene.stop('BossIntro'); this.scene.resume(); } });
 *   this.scene.pause();
 * Dos franjas en diagonal entran desde los lados con cada Pokémon, "VS" en el centro con destello, y se va sola
 * a los 2,6 s. Enter, espacio, Esc, clic o cualquier botón del mando la saltan.
 */
export class BossIntroScene extends Phaser.Scene {
  private info!: BossIntroData;
  private done = false;

  constructor() {
    super('BossIntro');
  }

  init(data: BossIntroData) {
    this.info = data;
    this.done = false;
  }

  create() {
    const { player, boss } = this.info;
    const tier = this.info.tier;
    const dur = tier === 'final' ? DURATION + 900 : tier === 'mini' ? DURATION - 500 : DURATION;
    const cam = this.cameras.main;
    // Fondo oscuro con líneas de velocidad
    this.add.rectangle(W / 2, H / 2, W, H, 0x0d1425, 0.88);
    const speed = this.add.graphics();
    for (let i = 0; i < 26; i++) {
      const y = Phaser.Math.Between(0, H);
      speed.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.05, 0.18)).fillRect(Phaser.Math.Between(-200, W), y, Phaser.Math.Between(200, 700), 4);
    }
    this.tweens.add({ targets: speed, x: -400, duration: DURATION, ease: 'Linear' });

    // Franja del jefe (arriba, entra por la derecha) y del jugador (abajo, entra por la izquierda)
    const bossColor = typeColor(boss.types?.[0] ?? 'normal');
    const playerColor = typeColor(player.types?.[0] ?? 'normal');
    const band = (y: number, color: number, fromRight: boolean) => {
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.35).fillPoints(this.slant(0, y + 14, W, 300), true);
      g.fillStyle(color, 1).fillPoints(this.slant(0, y, W, 300), true);
      g.fillStyle(0xffffff, 0.25).fillPoints(this.slant(0, y, W, 18), true);
      g.x = fromRight ? W : -W;
      g.setDepth(1);
      this.tweens.add({ targets: g, x: 0, duration: 380, ease: 'Cubic.easeOut' });
      return g;
    };
    band(150, tier === 'final' ? 0xd4a017 : tier === 'mini' ? 0x8a94b8 : bossColor, true);
    band(H - 450, playerColor, false);
    if (tier) {
      // Cartel arriba: MINIJEFE o RETO FINAL
      const tag = this.add
        .text(W / 2, 70, tier === 'final' ? 'RETO FINAL' : 'MINIJEFE', { fontFamily: FONT, fontSize: '64px', fontStyle: 'bold', color: tier === 'final' ? '#ffd34d' : '#e8ecf8' })
        .setOrigin(0.5).setStroke('#101828', 12).setDepth(5).setAlpha(0).setScale(2);
      this.tweens.add({ targets: tag, alpha: 1, scale: 1, duration: 300, delay: 100, ease: 'Back.easeOut' });
      if (tier === 'final') this.tweens.add({ targets: tag, scale: 1.08, duration: 500, delay: 500, yoyo: true, repeat: -1 });
    }

    // Pokémon (pixel, sin suavizar) y nombres
    const sprite = (f: Fighter, x: number, y: number, flip: boolean, fromRight: boolean) => {
      const img = this.add.image(fromRight ? W + 300 : -300, y, f.texture, f.frame).setFlipX(flip).setDepth(2);
      img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      const size = 300;
      img.setScale(size / Math.max(img.width, img.height));
      this.tweens.add({ targets: img, x, duration: 520, delay: 120, ease: 'Back.easeOut' });
      this.tweens.add({ targets: img, y: y - 10, duration: 700, delay: 640, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return img;
    };
    const extra = this.info.extra ?? [];
    if (extra.length) {
      // Trío: entran uno tras otro, con un golpe de pantalla cada uno
      [boss, ...extra].forEach((f, k) => {
        const img = sprite(f, W - 700 + k * 270, 300 + (k === 1 ? -30 : 20), false, true);
        img.setScale(img.scale * 0.8);
        this.tweens.getTweensOf(img).forEach((tw) => tw.stop());
        this.tweens.add({ targets: img, x: W - 700 + k * 270, duration: 420, delay: 150 + k * 380, ease: 'Back.easeOut', onComplete: () => cam.shake(140, 0.006) });
        this.tweens.add({ targets: img, y: img.y - 10, duration: 700, delay: 700 + k * 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      });
    } else sprite(boss, W - 420, 300, false, true);
    sprite(player, 420, H - 300, true, false);

    const name = (text: string, x: number, y: number, align: 'left' | 'right', fromRight: boolean) => {
      const t = this.add
        .text(fromRight ? W + 200 : -200, y, capitalize(text), { fontFamily: FONT, fontSize: '72px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(align === 'left' ? 0 : 1, 0.5)
        .setStroke('#101828', 12)
        .setShadow(4, 4, '#101828', 0, true, true)
        .setDepth(3);
      this.tweens.add({ targets: t, x, duration: 460, delay: 220, ease: 'Cubic.easeOut' });
      return t;
    };
    name(extra.length ? boss.name : boss.name, 160, 260, 'left', true);
    if (this.info.subtitle) {
      const sub = this.add
        .text(W + 200, 330, this.info.subtitle, { fontFamily: FONT, fontSize: '34px', color: '#ffd34d' })
        .setOrigin(0, 0.5)
        .setStroke('#101828', 8)
        .setDepth(3);
      this.tweens.add({ targets: sub, x: 166, duration: 460, delay: 300, ease: 'Cubic.easeOut' });
    }
    (boss.types ?? []).forEach((t, i) => {
      const g = this.add.graphics();
      g.fillStyle(0x101828, 1).fillRoundedRect(-82, -26, 164, 52, 14);
      g.fillStyle(typeColor(t), 1).fillRoundedRect(-78, -22, 156, 44, 12);
      const label = this.add.text(0, 0, typeNameEs(t), { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0.5).setStroke('#101828', 6);
      const chip = this.add.container(166 + 82 + i * 180, 396, [g, label]).setAlpha(0).setDepth(3);
      this.tweens.add({ targets: chip, alpha: 1, duration: 200, delay: 520 + i * 80 });
    });
    name(player.name, W - 160, H - 260, 'right', false);

    // VS en el centro con destello
    const vs = this.add
      .text(W / 2, H / 2, 'VS', { fontFamily: FONT, fontSize: '200px', fontStyle: 'bold', color: '#ffd34d' })
      .setOrigin(0.5)
      .setStroke('#101828', 22)
      .setShadow(8, 8, '#101828', 0, true, true)
      .setScale(4)
      .setAlpha(0)
      .setAngle(-8)
      .setDepth(4);
    this.tweens.add({
      targets: vs, scale: 1, alpha: 1, duration: 260, delay: 560, ease: 'Back.easeOut',
      onStart: () => this.time.delayedCall(200, () => {
        if (this.done) return;
        cam.flash(220, 255, 255, 255);
        cam.shake(260, 0.008);
        sfx('boom');
        this.time.delayedCall(120, () => sfx('roar'));
      }),
    });
    this.tweens.add({ targets: vs, scale: 1.08, duration: 300, delay: 900, yoyo: true, repeat: -1 });

    // Fin solo o al saltar
    this.time.delayedCall(dur, () => this.finish());
    // Por si el juego va a pocos FPS: termina también en tiempo real
    window.setTimeout(() => this.finish(), dur + 1200);
    const skipAfter = this.time.now + 350;
    const skip = () => this.time.now > skipAfter && this.finish();
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => ['Enter', ' ', 'Escape', 'Backspace'].includes(e.key) && skip());
    this.input.on('pointerdown', skip);
    this.input.gamepad?.on('down', skip);
  }

  /** Paralelogramo inclinado (franja en diagonal). */
  private slant(x: number, y: number, w: number, h: number) {
    const k = 120;
    return [new Phaser.Math.Vector2(x, y + k), new Phaser.Math.Vector2(x + w, y), new Phaser.Math.Vector2(x + w, y + h), new Phaser.Math.Vector2(x, y + h + k)];
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    const cam = this.cameras.main;
    cam.fadeOut(180, 0, 0, 0);
    // Igual que goTo: si el fundido va lento, se termina igualmente
    let called = false;
    const end = () => {
      if (called) return;
      called = true;
      this.info.onDone();
    };
    cam.once('camerafadeoutcomplete', end);
    window.setTimeout(end, 300);
  }
}
