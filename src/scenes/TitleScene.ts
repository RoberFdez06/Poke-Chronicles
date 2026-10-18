import Phaser from 'phaser';
import { addMenuBackdrop } from '../ui/art/landscape';
import { addLogo, addSparkles } from '../ui/art/logo';
import { addIcon } from '../ui/art/icons';
import { FONT, fadeIn, goTo } from '../ui/theme';

/**
 * Pantalla de título al abrir el juego: cae una Poké Ball, se abre con un destello y aparece el logo.
 * Cualquier tecla, clic o botón del mando lleva al menú principal (también se puede saltar la animación).
 */
export class TitleScene extends Phaser.Scene {
  private leaving = false;
  private readyAt = 0;

  constructor() {
    super('Title');
  }

  create() {
    this.leaving = false;
    fadeIn(this);
    const W = this.scale.width;
    const H = this.scale.height;
    const u = H / 640; // 1 a 960×640, 1,6875 a 1920×1080
    addMenuBackdrop(this, 0.15);

    // Poké Ball que cae, bota y tiembla
    const ball = addIcon(this, W / 2, -60 * u, 'pokeball', Math.round(7 * u)).setDepth(5);
    const logo = addLogo(this, W / 2, H * 0.36, Math.round(5 * u)).setDepth(6).setScale(0);
    const sub = this.add
      .text(W / 2, H * 0.36 + 84 * u, 'Un roguelike de Pokémon', {
        fontFamily: FONT, fontSize: `${Math.round(22 * u)}px`, color: '#ffffff',
      })
      .setOrigin(0.5).setShadow(2, 2, '#101828', 0).setAlpha(0).setDepth(6);
    const press = this.add
      .text(W / 2, H * 0.78, 'Pulsa Enter, haz clic o pulsa A', {
        fontFamily: FONT, fontSize: `${Math.round(24 * u)}px`, color: '#f8f8f0',
      })
      .setOrigin(0.5).setShadow(2, 2, '#101828', 0).setAlpha(0).setDepth(6);
    this.add
      .text(W / 2, H - 18 * u, 'Fan game gratuito · Pokémon es de Nintendo, Game Freak y The Pokémon Company', {
        fontFamily: FONT, fontSize: `${Math.round(12 * u)}px`, color: '#a8b0c8',
      })
      .setOrigin(0.5).setDepth(6);

    this.tweens.chain({
      tweens: [
        { targets: ball, y: H * 0.42, duration: 700, ease: 'Bounce.easeOut' },
        { targets: ball, angle: { from: -14, to: 14 }, duration: 110, yoyo: true, repeat: 2 },
        {
          targets: ball, scale: ball.scale * 1.25, alpha: 0, duration: 160, angle: 0,
          onStart: () => this.cameras.main.flash(260, 255, 255, 255),
        },
        { targets: logo, scale: Math.round(5 * u), duration: 420, ease: 'Back.easeOut' },
        { targets: sub, alpha: 1, duration: 300 },
      ],
      onComplete: () => this.showReady(logo, press),
    });

    // Cualquier entrada lleva al menú (o salta la animación)
    this.readyAt = this.time.now + 250; // ignora la tecla que abrió la página
    this.input.keyboard?.on('keydown', () => this.next());
    this.input.on('pointerdown', () => this.next());
    this.input.gamepad?.on('down', () => this.next());
  }

  private showReady(logo: Phaser.GameObjects.Text, press: Phaser.GameObjects.Text) {
    this.tweens.add({ targets: logo, y: logo.y + 8, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: press, alpha: { from: 1, to: 0.15 }, duration: 650, yoyo: true, repeat: -1 });
    addSparkles(this, logo.getBounds(), 6, Math.max(3, Math.round(4 * (this.scale.height / 640)))).forEach((s) => s.setDepth(7));
  }

  private next() {
    if (this.leaving || this.time.now < this.readyAt) return;
    this.leaving = true;
    goTo(this, 'Menu');
  }
}
