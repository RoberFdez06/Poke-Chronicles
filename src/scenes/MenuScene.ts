import Phaser from 'phaser';
import { fetchPokemonCard } from '../data/pokeapi';
import { loadRecords, loadUnlocked } from '../data/save';
import { MODES, MODE_LABEL } from '../data/modes';
import { CONTROLS } from '../data/controls';

/** Récord de cada modo en una línea: "Normal 2 · Oleadas 7 · …". */
const recordsLine = () => {
  const r = loadRecords();
  return MODES.map((m) => `${MODE_LABEL[m]} ${r[m]}`).join(' · ');
};

const FONT = 'system-ui, sans-serif';
const NAVY = 0x2b3a67;
const PANEL = 0xeaf4ff;
const GOLD = 0xffd34d;
const BTN = { w: 320, h: 58, gap: 16 };

type Key = Phaser.Input.Keyboard.Key;
type KeyName = 'UP' | 'DOWN' | 'W' | 'S' | 'ENTER' | 'SPACE' | 'ESC';

interface MenuItem {
  label: string;
  action: () => void;
}

/** Menú principal: jugar, gacha y controles. */
export class MenuScene extends Phaser.Scene {
  private items: MenuItem[] = [];
  private buttons: { box: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics }[] = [];
  private keys!: Record<KeyName, Key>;
  private selected = 0;
  private overlay?: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;
  private padPrev = { up: false, down: false, ok: false, back: false };
  private alive = true;

  constructor() {
    super('Menu');
  }

  create() {
    this.items = [
      { label: 'Jugar', action: () => this.scene.start('Slots') },
      { label: 'Gacha', action: () => this.openGacha() },
      { label: 'Controles', action: () => this.showControls() },
    ];
    this.buttons = [];
    this.selected = 0;
    this.overlay = undefined;
    this.toastTimer = undefined;
    this.padPrev = { up: false, down: false, ok: false, back: false };
    this.alive = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (this.alive = false));

    // Título
    this.add
      .text(480, 118, 'PokeIsaac', { fontFamily: FONT, fontSize: '92px', fontStyle: 'bold', color: '#ffd34d' })
      .setOrigin(0.5)
      .setStroke('#2b3a67', 14)
      .setShadow(0, 7, '#0d1425', 0, true, true);
    this.add
      .text(480, 194, 'Un roguelike de Pokémon', { fontFamily: FONT, fontSize: '22px', color: '#ffffff' })
      .setOrigin(0.5)
      .setAlpha(0.85);

    // Botones
    const top = 290;
    this.items.forEach((item, i) => {
      this.buttons.push(this.buildButton(item, i, 480, top + i * (BTN.h + BTN.gap)));
    });

    this.toast = this.add
      .text(480, 540, '', { fontFamily: FONT, fontSize: '20px', color: '#ffd34d' })
      .setOrigin(0.5)
      .setDepth(60);

    this.add
      .text(480, 584, `Pokémon desbloqueados: ${loadUnlocked().length}   ·   Récords: ${recordsLine()}`, {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setAlpha(0.7);
    this.add
      .text(480, 612, 'Flechas o W S, ratón o mando para moverte · Enter, espacio, clic o A para elegir', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setAlpha(0.5);

    this.keys = this.input.keyboard!.addKeys('UP,DOWN,W,S,ENTER,SPACE,ESC') as Record<KeyName, Key>;
    this.select(0);

    // Decoración: dos Pokémon tuyos que flotan a los lados. Se cargan en segundo plano.
    this.decorate().catch(() => undefined);
  }

  private buildButton(item: MenuItem, index: number, x: number, y: number) {
    const bg = this.add.graphics();
    const label = this.add
      .text(0, 0, item.label, { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#2b3a67' })
      .setOrigin(0.5);

    const box = this.add.container(x, y, [bg, label]);
    box.setSize(BTN.w, BTN.h);
    // En un contenedor con tamaño, Phaser ya desplaza el área al centro: va de (0,0) a (w,h)
    box.setInteractive(new Phaser.Geom.Rectangle(0, 0, BTN.w, BTN.h), Phaser.Geom.Rectangle.Contains);
    box.input!.cursor = 'pointer';
    box.on('pointerover', () => !this.overlay && this.select(index));
    box.on('pointerdown', () => !this.overlay && this.activate(index));
    return { box, bg };
  }

  private paint(i: number) {
    const { box, bg } = this.buttons[i];
    const sel = i === this.selected;
    bg.clear();
    bg.fillStyle(sel ? GOLD : PANEL, 1).fillRoundedRect(-BTN.w / 2, -BTN.h / 2, BTN.w, BTN.h, 18);
    bg.lineStyle(5, NAVY, 1).strokeRoundedRect(-BTN.w / 2, -BTN.h / 2, BTN.w, BTN.h, 18);
    box.setScale(sel ? 1.06 : 1);
  }

  private select(i: number) {
    this.selected = i;
    this.buttons.forEach((_, k) => this.paint(k));
  }

  private activate(i: number) {
    this.select(i);
    this.items[i].action();
  }

  private openGacha() {
    // La escena del gacha se registra en main.ts cuando exista
    if (this.scene.manager.keys['Gacha']) this.scene.start('Gacha');
    else this.showToast('El gacha llegará pronto');
  }

  private showToast(msg: string) {
    this.toastTimer?.remove();
    this.toast.setText(msg);
    this.toastTimer = this.time.delayedCall(1800, () => this.toast.setText(''));
  }

  // --- Panel de controles ---

  private showControls() {
    const dim = this.add.rectangle(480, 320, 960, 640, 0x000000, 0.65).setInteractive();
    dim.on('pointerdown', () => this.closeControls());

    const panel = this.add.graphics();
    panel.fillStyle(PANEL, 1).fillRoundedRect(130, 110, 700, 400, 26);
    panel.lineStyle(6, NAVY, 1).strokeRoundedRect(130, 110, 700, 400, 26);

    const parts: Phaser.GameObjects.GameObject[] = [dim, panel];
    parts.push(
      this.add
        .text(480, 158, 'Controles', { fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: '#2b3a67' })
        .setOrigin(0.5),
    );
    CONTROLS.forEach(([what, how], k) => {
      const y = 212 + k * 62;
      parts.push(
        this.add.text(170, y, what, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#2b3a67' }),
        this.add.text(170, y + 28, how, { fontFamily: FONT, fontSize: '18px', color: '#4a5578' }),
      );
    });
    parts.push(
      this.add
        .text(480, 484, 'Esc, Enter o clic para cerrar', { fontFamily: FONT, fontSize: '15px', color: '#4a5578' })
        .setOrigin(0.5),
    );

    this.overlay = this.add.container(0, 0, parts).setDepth(50);
  }

  private closeControls() {
    this.overlay?.destroy();
    this.overlay = undefined;
  }

  // --- Decoración ---

  private async decorate() {
    const ids = Phaser.Utils.Array.Shuffle([...loadUnlocked()]).slice(0, 2);
    const cards = await Promise.all(ids.map(fetchPokemonCard));
    if (!this.alive) return;

    // Mismas claves que usan StarterScene y GameScene, así se reaprovechan
    this.load.crossOrigin = 'anonymous';
    for (const c of cards) {
      if (!this.textures.exists(`starter-${c.id}-front`)) this.load.image(`starter-${c.id}-front`, c.sprites.front);
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (!this.alive) return;
      cards.forEach((c, k) => {
        const key = `starter-${c.id}-front`;
        if (!this.textures.exists(key)) return;
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);

        const x = k === 0 ? 150 : 810;
        const img = this.add.image(x, 440, key).setDisplaySize(210, 210).setFlipX(k === 1).setDepth(1);
        this.tweens.add({
          targets: img,
          y: 426,
          duration: 1100 + k * 250,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      });
    });
    this.load.start();
  }

  // --- Entrada ---

  update() {
    if (!this.keys) return;
    const J = Phaser.Input.Keyboard.JustDown;
    const k = this.keys;

    const up = J(k.UP) || J(k.W);
    const down = J(k.DOWN) || J(k.S);
    let dy = (down ? 1 : 0) - (up ? 1 : 0);
    let ok = J(k.ENTER) || J(k.SPACE);
    let back = J(k.ESC);

    const pad = this.input.gamepad?.getPad(0);
    if (pad && pad.connected) {
      const now = {
        up: pad.up || pad.leftStick.y < -0.5,
        down: pad.down || pad.leftStick.y > 0.5,
        ok: pad.A,
        back: pad.B,
      };
      if (now.up && !this.padPrev.up) dy -= 1;
      if (now.down && !this.padPrev.down) dy += 1;
      if (now.ok && !this.padPrev.ok) ok = true;
      if (now.back && !this.padPrev.back) back = true;
      this.padPrev = now;
    }

    if (this.overlay) {
      if (ok || back) this.closeControls();
      return;
    }
    const n = this.items.length;
    if (dy !== 0) this.select((this.selected + Math.sign(dy) + n) % n);
    if (ok) this.activate(this.selected);
  }
}
