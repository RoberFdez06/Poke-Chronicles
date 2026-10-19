import Phaser from 'phaser';
import { addMenuBackdrop } from '../ui/art/landscape';
import { addLogo, addSparkles } from '../ui/art/logo';
import { addIcon } from '../ui/art/icons';
import { FONT, fadeIn, goTo } from '../ui/theme';
import { COVER_H, COVER_W, DCX, DCY, DH, DW, fitDesign } from '../ui/layout';
import { audioReady, playMenuMusic, restoreMusicVolume, sfx, softMusicIn, unlockAudio } from '../ui/audio';
import { addRays } from '../ui/art/gachaMachine';
import { fetchPokemonCard } from '../data/pokeapi';
import { loadUnlocked } from '../data/save';

/** Pokémon que pueden cruzar la pantalla de título (además de los tuyos). */
const PARADE = [1, 4, 7, 25, 133, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728];

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
    // T30: como el resto de menús, en el espacio de diseño de 960×640 que la cámara escala a la pantalla
    fitDesign(this);
    const W = DW;
    const H = DH;
    const u = H / 640;
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

    // El navegador no deja sonar hasta que el jugador hace algo: si aún no puede, un primer "pulsa para empezar"
    if (audioReady()) this.startIntro(ball, logo, sub, press);
    else this.gate(() => this.startIntro(ball, logo, sub, press));
  }

  /** Pantalla previa (solo la primera vez): al pulsar se desbloquea el audio y empieza la intro con sonido. */
  private gate(go: () => void) {
    const cover = this.add.rectangle(DCX, DCY, COVER_W + 4, COVER_H + 4, 0x0d1425, 1).setDepth(20).setInteractive();
    const icon = addIcon(this, DW / 2, DH * 0.42, 'pokeball', Math.round(5 * (DH / 640))).setDepth(21);
    this.tweens.add({ targets: icon, angle: { from: -8, to: 8 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const t = this.add
      .text(DW / 2, DH * 0.62, 'Pulsa una tecla, haz clic o pulsa un botón del mando', { fontFamily: FONT, fontSize: `${Math.round(22 * (DH / 640))}px`, color: '#f8f8f0' })
      .setOrigin(0.5).setDepth(21);
    this.tweens.add({ targets: t, alpha: { from: 1, to: 0.25 }, duration: 700, yoyo: true, repeat: -1 });
    let done = false;
    const start = () => {
      if (done) return;
      done = true;
      void unlockAudio().then(() => {
        [cover, icon, t].forEach((o) => o.destroy());
        go();
      });
    };
    this.input.keyboard?.once('keydown', start);
    this.input.once('pointerdown', start);
    this.input.gamepad?.once('down', start);
  }

  private startIntro(ball: Phaser.GameObjects.Image, logo: Phaser.GameObjects.Text, sub: Phaser.GameObjects.Text, press: Phaser.GameObjects.Text) {
    const u = DH / 640;
    const H = DH;
    playMenuMusic();
    softMusicIn(2600);
    const bounce = [0.18, 0.34, 0.45].map((f) => 700 * f);
    bounce.forEach((ms) => this.time.delayedCall(ms * 1.6, () => sfx('ballBounce')));
    this.tweens.chain({
      tweens: [
        { targets: ball, y: H * 0.42, duration: 700, ease: 'Bounce.easeOut' },
        { targets: ball, angle: { from: -14, to: 14 }, duration: 110, yoyo: true, repeat: 2, onYoyo: () => sfx('ballShake') },
        {
          targets: ball, scale: ball.scale * 1.25, alpha: 0, duration: 160, angle: 0,
          onStart: () => { this.cameras.main.flash(260, 255, 255, 255); sfx('ballOpen'); },
        },
        { targets: logo, scale: Math.round(5 * u), duration: 420, ease: 'Back.easeOut', onStart: () => sfx('logo') },
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
    // Rayos dorados que giran detrás del logo
    const rays = addRays(this, logo.x, logo.y, 0xffe066, 420, 16).setDepth(5).setAlpha(0.22);
    this.tweens.add({ targets: rays, alpha: 0.32, duration: 1500, yoyo: true, repeat: -1 });
    // Un Pokémon al azar cruza la pantalla de vez en cuando
    this.time.addEvent({ delay: 4200, loop: true, callback: () => void this.parade() });
    this.time.delayedCall(600, () => void this.parade());
    this.tweens.add({ targets: logo, y: logo.y + 8, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: press, alpha: { from: 1, to: 0.15 }, duration: 650, yoyo: true, repeat: -1 });
    addSparkles(this, logo.getBounds(), 6, Math.max(3, 4)).forEach((s) => s.setDepth(7));
  }

  /** Un Pokémon (de los tuyos o de los iniciales) cruza corriendo por abajo con su sombra, a veces dando un salto. */
  private async parade() {
    if (this.leaving) return;
    const pool = [...new Set([...loadUnlocked(), ...PARADE])];
    const id = pool[Math.floor(Math.random() * pool.length)];
    const card = await fetchPokemonCard(id).catch(() => null);
    if (!card || this.leaving || !this.sys.isActive()) return;
    const key = `title-${id}`;
    if (!this.textures.exists(key)) {
      await new Promise<void>((done) => {
        this.load.crossOrigin = 'anonymous';
        this.load.image(key, card.sprites.front);
        this.load.once(Phaser.Loader.Events.COMPLETE, () => done());
        this.load.start();
      });
      if (!this.textures.exists(key) || this.leaving || !this.sys.isActive()) return;
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    const u = DH / 640;
    const right = Math.random() < 0.5;
    const y = DH * 0.9;
    const x0 = right ? -60 : DW + 60;
    const x1 = right ? DW + 60 : -60;
    const shadow = this.add.ellipse(x0, y + 4 * u, 46 * u, 12 * u, 0x000000, 0.3).setDepth(4);
    const img = this.add.image(x0, y, key).setOrigin(0.5, 0.9).setScale(1.2 * u).setFlipX(right).setDepth(4);
    const ms = 4200 + Math.random() * 1800;
    this.tweens.add({ targets: [img, shadow], x: x1, duration: ms, ease: 'Linear', onComplete: () => [img, shadow].forEach((o) => o.destroy()) });
    // Pasitos y, a mitad, un salto
    this.tweens.add({ targets: img, y: y - 6 * u, duration: 160, yoyo: true, repeat: Math.floor(ms / 320) });
    if (Math.random() < 0.6) {
      this.time.delayedCall(ms * (0.35 + Math.random() * 0.3), () => {
        if (!img.active) return;
        this.tweens.add({ targets: img, y: y - 50 * u, angle: right ? 360 : -360, duration: 520, yoyo: false, ease: 'Sine.easeOut',
          onComplete: () => img.active && this.tweens.add({ targets: img, y, angle: right ? 360 : -360, duration: 220, ease: 'Quad.easeIn' }) });
      });
    }
  }

  private next() {
    if (this.leaving || this.time.now < this.readyAt) return;
    this.leaving = true;
    restoreMusicVolume(900);
    goTo(this, 'Menu');
  }
}
