import Phaser from 'phaser';
import { advance, currentStep, newTutorial, skipAll, stepCounter, stepText, tutButtons, type TutEvent, type TutorialMode, type TutProgress } from '../data/bossTutorial';
import { GAME_VIEW, H } from '../ui/layout';
import { drawBox, FONT, HEX } from '../ui/theme';
import { hudFont } from '../ui/uiScale';
import { sfx } from '../ui/audio';

/**
 * Cartel del tutorial de práctica (bossTutorial.ts), abajo de la sala como los consejos. Avanza con la acción que pide
 * cada paso o con «Continuar» (T, R3 del mando, clic o toque) y se salta con «Saltar» (N, L3, clic o toque).
 * Teclado, ratón, mando y táctil funcionan cada uno por separado.
 */
export class TutorialPanel {
  readonly progress: TutProgress;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private keyNext?: Phaser.Input.Keyboard.Key;
  private keySkip?: Phaser.Input.Keyboard.Key;
  private padPrev = { next: false, skip: false };

  constructor(
    private scene: Phaser.Scene,
    mode: TutorialMode,
    private opts: { touch: () => boolean; addHud: (o: Phaser.GameObjects.GameObject) => void; onSkip: () => void },
  ) {
    this.progress = newTutorial(mode);
    this.keyNext = scene.input.keyboard?.addKey('T', false);
    this.keySkip = scene.input.keyboard?.addKey('N', false);
    this.draw();
  }

  /** Una acción del jugador (o «continue»): si es la que pide el paso, avanza y redibuja. */
  event(ev: TutEvent) {
    if (!advance(this.progress, ev)) return;
    sfx(ev === 'continue' ? 'select' : 'levelup');
    this.draw();
  }

  skip() {
    skipAll(this.progress);
    this.draw();
    this.opts.onSkip();
  }

  /** Teclas y mando (llamar en cada frame). */
  tick() {
    const J = Phaser.Input.Keyboard.JustDown;
    if (this.keyNext && J(this.keyNext)) this.event('continue');
    if (this.keySkip && J(this.keySkip)) return this.skip();
    const pad = this.scene.input.gamepad?.getPad(0);
    const next = !!pad?.connected && !!pad.buttons[11]?.pressed;
    const skip = !!pad?.connected && !!pad.buttons[10]?.pressed;
    if (next && !this.padPrev.next) this.event('continue');
    if (skip && !this.padPrev.skip) this.skip();
    this.padPrev = { next, skip };
  }

  destroy() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
  }

  private draw() {
    this.destroy();
    const step = currentStep(this.progress);
    if (!step) return;
    const touch = this.opts.touch();
    const s = this.scene;
    const w = GAME_VIEW.w;
    const x = GAME_VIEW.x;
    const pad = 16;
    const btnW = 190;
    const title = s.add.text(x + pad, 0, `Tutorial · ${step.title} · ${stepCounter(this.progress)}`, {
      fontFamily: FONT, fontSize: `${hudFont(16)}px`, fontStyle: 'bold', color: '#b8860b',
    }).setOrigin(0, 0);
    const body = s.add.text(x + pad, 0, stepText(step, touch), {
      fontFamily: FONT, fontSize: `${hudFont(14)}px`, color: HEX.text, wordWrap: { width: w - pad * 2 - btnW },
    }).setOrigin(0, 0);
    const action = step.until !== 'continue';
    const h = Math.ceil(title.height + body.height + 26);
    const y = H - h - 2;
    const box = drawBox(s.add.graphics(), x, y, w, h, { radius: 12 }).setAlpha(0.97);
    title.setY(y + 8);
    body.setY(y + 14 + title.height);
    const labels = tutButtons(touch);
    const button = (by: number, label: string, onClick: () => void) => {
      const b = s.add.text(x + w - pad, by, label, { fontFamily: FONT, fontSize: `${hudFont(15)}px`, fontStyle: 'bold', color: '#b8860b' })
        .setOrigin(1, 0.5).setPadding(8, 6).setInteractive({ useHandCursor: true });
      b.on('pointerover', () => b.setColor(HEX.text));
      b.on('pointerout', () => b.setColor('#b8860b'));
      b.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => {
        ev?.stopPropagation?.();
        onClick();
      });
      return b;
    };
    // En los pasos de acción, «Continuar» también vale (por si no puedes hacerla), pero se ve más apagado
    const next = button(y + h * 0.3, action ? `${labels.next.replace('Continuar', 'Saltar paso')}` : labels.next, () => this.event('continue'));
    if (action) next.setAlpha(0.7);
    const skip = button(y + h * 0.72, labels.skip, () => this.skip());
    this.objs = [box, title, body, next, skip];
    this.objs.forEach((o) => this.opts.addHud(o));
  }
}
