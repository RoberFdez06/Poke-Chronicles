import Phaser from 'phaser';
import { W, H } from '../ui/layout';
import { FONT } from '../ui/theme';
import { sfx } from '../ui/audio';

/** Datos del cartel de piso nuevo. */
export interface FloorIntroData {
  /** "Piso 2/5", "Piso 7"… */
  label: string;
  biomeId: string;
  biomeName: string;
  /** Colores del bioma (suelo y pared) para el emblema. */
  floor: number;
  wall: number;
  onDone: () => void;
}

/** Emblemas pixel 10x10 de cada bioma: '.' vacío; las letras son colores de EMBLEM_COLORS. */
const EMBLEMS: Record<string, string[]> = {
  bosque: ['....gg....', '...gGGg...', '..gGGGGg..', '.gGGGGGGg.', '..gGGGGg..', '.gGGGGGGg.', 'gGGGGGGGGg', '....bb....', '....bb....', '...bbbb...'],
  cueva: ['kkkkkkkkkk', '.kCk..kCk.', '..k....k..', '..........', '....c.....', '...cCc..c.', '..cCWCc.cC', '..cCCCccCc', '.ccCCCcCCc', 'kkkkkkkkkk'],
  mar: ['..........', '...bb.....', '..bWWb....', '.bWBBWb...', 'bWBBBBWb..', 'BBBBBBBWbb', 'BBBBBBBBWW', 'bbBBBBBBBB', 'BBbbBBBbbB', 'BBBBBBBBBB'],
  volcan: ['...r..o...', '..o.rr.o..', '....rr....', '...kRRk...', '...kRRk...', '..kkkkkk..', '..kkkkkkk.', '.kkkkkkkkk', '.kkkrkkkkk', 'kkkkkrrkkk'],
  torre: ['....yy....', '...kyyk...', '...kWWk...', '...kkkk...', '...kWkk...', '...kkkk...', '...kkWk...', '...kkkk...', '..kkkkkk..', '.kkkkkkkk.'],
  ciudad: ['......kk..', '.kk...kWk.', '.kWk..kkk.', '.kkk.kkWk.', 'kkWkkkkkk.', 'kkkkkWkWkk', 'kWkkkkkkkk', 'kkkWkkWkkk', 'kkkkkkkkkk', 'gggggggggg'],
  nieve: ['....W.....', '..W.W.W...', '...WWW....', 'WWWWCWWWW.', '...WWW....', '..W.W.W...', '....W.....', '..........', 'WWWWWWWWWW', 'CCCCCCCCCC'],
  pantano: ['..........', '.rr....rr.', 'rWrr..rrWr', 'rrrr..rrrr', '.bb....bb.', '.bb.g..bb.', '.bb.g.gbb.', 'gGgGgGgGgG', 'pPpPpPpPpP', 'PPPPPPPPPP'],
  cumbre: ['..........', '....W.....', '...WWk....', '..WWkkk...', '..Wkkkkk..', '.kkkkkkkk.', '.kkkkkkkkk', 'kkkkkkkkkk', 'gkkkkgkkkk', 'gggggggggg'],
};
const EMBLEM_COLORS: Record<string, number> = {
  g: 0x2f8a3a, G: 0x6ccf5a, b: 0x7a4a24, k: 0x3a3f58, C: 0x8fd8ff, c: 0x4aa0d8, W: 0xffffff,
  B: 0x3a7ae0, r: 0xe0402a, R: 0xffa030, o: 0xffd060, y: 0xffd34d, p: 0x4a6a3a, P: 0x2e4a2a,
};

const STAY = 1500;

/**
 * Cartel de piso nuevo (supervisor): fundido en negro con el emblema pixel del bioma, "Piso N" y el nombre del
 * bioma, que se abre como un telón. Se lanza encima de la partida en pausa y se va solo (Enter/Esc/clic/A lo saltan).
 */
export class FloorIntroScene extends Phaser.Scene {
  private info!: FloorIntroData;
  private done = false;

  constructor() {
    super('FloorIntro');
  }

  init(data: FloorIntroData) {
    this.info = data;
    this.done = false;
  }

  create() {
    const { info } = this;
    // Dos mitades negras que luego se abren (arriba y abajo)
    const top = this.add.rectangle(W / 2, H / 4, W, H / 2, 0x0d1425);
    const bottom = this.add.rectangle(W / 2, (H * 3) / 4, W, H / 2, 0x0d1425);
    // Franja del color del bioma detrás del texto
    const band = this.add.rectangle(W / 2, H / 2, W, 260, info.wall, 0.9).setScale(0, 1);
    const bandLine = this.add.rectangle(W / 2, H / 2 - 134, W, 8, info.floor).setScale(0, 1);
    const bandLine2 = this.add.rectangle(W / 2, H / 2 + 134, W, 8, info.floor).setScale(0, 1);
    this.tweens.add({ targets: [band, bandLine, bandLine2], scaleX: 1, duration: 360, ease: 'Cubic.easeOut' });

    // Emblema: círculo con el color del suelo y el dibujo del bioma en píxeles gordos
    const ex = W / 2 - 330;
    const emblem = this.add.container(ex, H / 2).setScale(0);
    const ring = this.add.graphics();
    ring.fillStyle(0x101828, 1).fillCircle(0, 0, 112);
    ring.fillStyle(info.floor, 1).fillCircle(0, 0, 100);
    ring.lineStyle(6, 0xffd34d, 1).strokeCircle(0, 0, 106);
    emblem.add(ring);
    const rows = EMBLEMS[info.biomeId] ?? EMBLEMS.bosque;
    const u = 14;
    const pix = this.add.graphics();
    rows.forEach((row, j) => {
      for (let i = 0; i < 10; i++) {
        const c = row[i];
        if (!c || c === '.') continue;
        pix.fillStyle(EMBLEM_COLORS[c] ?? 0xffffff, 1).fillRect(-5 * u + i * u, -5 * u + j * u, u, u);
      }
    });
    emblem.add(pix);
    this.tweens.add({ targets: emblem, scale: 1, angle: { from: -40, to: 0 }, duration: 480, delay: 160, ease: 'Back.easeOut' });

    // Textos: entran desde la derecha
    const label = this.add
      .text(W / 2 - 170, H / 2 - 50, info.label.toUpperCase(), { fontFamily: FONT, fontSize: '96px', fontStyle: 'bold', color: '#ffd34d' })
      .setOrigin(0, 0.5).setStroke('#101828', 14).setShadow(6, 6, '#101828', 0, true, true).setAlpha(0);
    const name = this.add
      .text(W / 2 - 166, H / 2 + 56, info.biomeName, { fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0, 0.5).setStroke('#101828', 10).setAlpha(0);
    for (const [t, d] of [[label, 260], [name, 380]] as const) {
      t.x += 220;
      this.tweens.add({ targets: t, x: t.x - 220, alpha: 1, duration: 380, delay: d, ease: 'Cubic.easeOut' });
    }
    this.time.delayedCall(300, () => sfx('select'));

    // Se abre como un telón y deja ver la sala
    this.time.delayedCall(STAY, () => {
      this.tweens.add({ targets: [band, bandLine, bandLine2, emblem, label, name], alpha: 0, duration: 260 });
      this.tweens.add({ targets: top, y: -H / 4, duration: 520, delay: 120, ease: 'Cubic.easeIn' });
      this.tweens.add({ targets: bottom, y: H + H / 4, duration: 520, delay: 120, ease: 'Cubic.easeIn', onComplete: () => this.finish() });
    });
    // Por si el reloj del juego va lento: también en tiempo real
    window.setTimeout(() => this.finish(), STAY + 1400);

    const skip = () => this.finish();
    this.input.keyboard?.once('keydown-ENTER', skip);
    this.input.keyboard?.once('keydown-ESC', skip);
    this.input.keyboard?.once('keydown-SPACE', skip);
    this.input.once('pointerdown', skip);
  }

  update() {
    const pad = this.input.gamepad?.getPad(0);
    if (pad?.connected && (pad.A || pad.B)) this.finish();
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    this.info.onDone();
  }
}
