import Phaser from 'phaser';
import { fitDesign, COVER_H, COVER_W, DCX, DCY } from '../ui/layout';
import { fetchPokemonCard } from '../data/pokeapi';
import { loadRecords, loadUnlocked } from '../data/save';
import { MODES, MODE_LABEL } from '../data/modes';
import { openControls } from './ControlsScene';
import { accountInfo } from '../net/cloud';
import { FONT, drawBox, fadeIn, goTo } from '../ui/theme';
import { addLandscape, nextLandscape, PIX, WALK_Y, type Landscape } from '../ui/art/landscape';
import { addPixelText, drawPixelArrow } from '../ui/art/pixel';

/** Récord de cada modo en una línea: "Normal 2 · Oleadas 7 · …". */
const recordsLine = () => {
  const r = loadRecords();
  return MODES.map((m) => `${MODE_LABEL[m]} ${r[m]}`).join(' · ');
};

/** Menú en un único cuadro, como en la GBA: filas de texto y la flecha ▶ en la elegida. */
const MENU = { x: 480, top: 200, w: 340, row: 42, pad: 18 };
const TEXT = '#303848';
const TEXT_SHADOW = '#c8c8c0';

type Key = Phaser.Input.Keyboard.Key;
type KeyName = 'UP' | 'DOWN' | 'W' | 'S' | 'ENTER' | 'SPACE' | 'ESC' | 'BACKSPACE';

interface MenuItem {
  label: string;
  action: () => void;
}

interface Walker {
  img: Phaser.GameObjects.Image;
  vx: number;
  phase: number;
}

/** Menú principal con fondo pixel art animado al estilo de la GBA. */
export class MenuScene extends Phaser.Scene {
  private items: MenuItem[] = [];
  private rows: Phaser.GameObjects.Text[] = [];
  private arrow!: Phaser.GameObjects.Graphics;
  private keys!: Record<KeyName, Key>;
  private selected = 0;
  private overlay?: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Container;
  private toastText!: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;
  private padPrev = { up: false, down: false, ok: false, back: false };
  private alive = true;
  private land!: Landscape;
  private walkers: Walker[] = [];

  constructor() {
    super('Menu');
  }

  create() {
    this.items = [
      { label: 'Jugar', action: () => goTo(this, 'Slots') },
      { label: 'Gacha', action: () => this.openGacha() },
      { label: 'Pokédex', action: () => goTo(this, 'Pokedex') },
      { label: 'Mejoras', action: () => goTo(this, 'Upgrades') },
      { label: 'Controles', action: () => openControls(this) },
      { label: 'Ajustes', action: () => goTo(this, 'Settings') },
    ];
    this.rows = [];
    this.walkers = [];
    this.selected = 0;
    this.overlay = undefined;
    this.toastTimer = undefined;
    // N23: como si todo estuviera pulsado al llegar; así una A que sigue apretada desde la pantalla anterior no
    // cuenta como pulsación nueva (hay que soltarla primero)
    this.padPrev = { up: true, down: true, ok: true, back: true };
    this.alive = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (this.alive = false));
    fadeIn(this);
    fitDesign(this);

    // Fondo: un ambiente distinto cada vez que vuelves al menú
    this.land = addLandscape(this, nextLandscape(this));

    // Título con píxeles gordos y un leve balanceo
    const title = addPixelText(this, 480, 92, 'PokeIsaac', {
      size: 22, scale: 4, color: '#f8d030', stroke: '#283068', strokeWidth: 3, shadow: '#101828',
    });
    this.tweens.add({ targets: title, y: 100, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const sub = this.add.graphics();
    drawBox(sub, 480 - 170, 146, 340, 40, { radius: 4 });
    this.add.text(480, 166, 'Un roguelike de Pokémon', this.rowStyle(18)).setOrigin(0.5).setShadow(2, 2, TEXT_SHADOW, 0);

    this.buildMenu();
    this.addAccountBadge();

    // Franja de abajo: progreso y ayuda
    this.add.rectangle(DCX, 620, COVER_W + 4, 40, 0x101828, 0.85).setDepth(20);
    this.add
      .text(480, 610, `Pokémon desbloqueados: ${loadUnlocked().length}   ·   Récords: ${recordsLine()}`, {
        fontFamily: FONT, fontSize: '14px', color: '#f8f8f8',
      })
      .setOrigin(0.5).setDepth(21);
    this.add
      .text(480, 628, 'Flechas o W S, ratón o mando para moverte · Enter, espacio, clic o A para elegir', {
        fontFamily: FONT, fontSize: '12px', color: '#a8b0c8',
      })
      .setOrigin(0.5).setDepth(21);

    // Aviso corto (por ejemplo, si el gacha no está)
    const tg = this.add.graphics();
    drawBox(tg, 480 - 200, 0, 400, 44, { radius: 4 });
    this.toastText = this.add.text(480, 22, '', this.rowStyle(18)).setOrigin(0.5);
    this.toast = this.add.container(0, 510, [tg, this.toastText]).setDepth(40).setVisible(false);

    this.keys = this.input.keyboard!.addKeys('UP,DOWN,W,S,ENTER,SPACE,ESC,BACKSPACE') as Record<KeyName, Key>;
    Object.values(this.keys).forEach((k) => k.reset()); // ver NavInput: olvida pulsaciones viejas
    this.select(0);

    // Pokémon de tu colección paseando por el camino. Se cargan en segundo plano.
    this.addWalkers().catch(() => undefined);
  }

  /** Arriba a la derecha (T45): invitado (no se guarda) o la cuenta conectada. Clic: pantalla de cuenta. */
  private addAccountBadge() {
    const a = accountInfo();
    if (a.mode === 'local') return;
    const guest = a.mode !== 'cloud';
    const lines = guest
      ? ['Juegas como invitado', 'Tu progreso no se guardará · Crea una cuenta']
      : [`Cuenta: ${a.name || a.email || 'conectado'}`, 'Progreso guardado en la nube'];
    const w = 300;
    const h = 46;
    const x = 960 - w - 12;
    const y = 12;
    const g = this.add.graphics().setDepth(15);
    drawBox(g, x, y, w, h, { radius: 4, border: guest ? 0xc0392b : undefined });
    this.add.text(x + w / 2, y + 15, lines[0], { ...this.rowStyle(15), fontStyle: 'bold', color: guest ? '#c0392b' : TEXT }).setOrigin(0.5).setDepth(16);
    this.add.text(x + w / 2, y + 33, lines[1], this.rowStyle(12)).setOrigin(0.5).setDepth(16);
    this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true }).setDepth(17)
      .on('pointerdown', () => goTo(this, 'Account'));
  }

  private rowStyle(size: number) {
    return { fontFamily: FONT, fontSize: `${size}px`, color: TEXT };
  }

  private buildMenu() {
    const h = this.items.length * MENU.row + MENU.pad * 2;
    const left = MENU.x - MENU.w / 2;
    const g = this.add.graphics().setDepth(10);
    drawBox(g, left, MENU.top, MENU.w, h, { radius: 4 });
    this.arrow = this.add.graphics().setDepth(11);

    this.items.forEach((item, i) => {
      const y = MENU.top + MENU.pad + i * MENU.row + MENU.row / 2;
      const t = this.add
        .text(left + 64, y, item.label, { ...this.rowStyle(28), fontStyle: 'bold' })
        .setOrigin(0, 0.5)
        .setShadow(2, 2, TEXT_SHADOW, 0)
        .setDepth(11);
      this.rows.push(t);
      // Con ratón: cada fila es una zona (pasar = elegir, clic = entrar)
      const zone = this.add.zone(MENU.x, y, MENU.w - 24, MENU.row).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => !this.overlay && this.select(i));
      zone.on('pointerdown', () => !this.overlay && this.activate(i));
    });
    // La flecha "respira" de lado a lado
    this.tweens.add({ targets: this.arrow, x: 6, duration: 420, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [2] });
  }

  private select(i: number) {
    this.selected = i;
    const left = MENU.x - MENU.w / 2;
    const y = MENU.top + MENU.pad + i * MENU.row + MENU.row / 2;
    this.arrow.clear();
    drawPixelArrow(this.arrow, left + 30, y - 14);
    this.rows.forEach((t, k) => t.setColor(k === i ? '#2850b0' : TEXT));
  }

  private activate(i: number) {
    this.select(i);
    this.items[i].action();
  }

  private openGacha() {
    if (this.scene.manager.keys['Gacha']) goTo(this, 'Gacha');
    else this.showToast('El gacha llegará pronto');
  }

  private showToast(msg: string) {
    this.toastTimer?.remove();
    this.toastText.setText(msg);
    this.toast.setVisible(true);
    this.toastTimer = this.time.delayedCall(1800, () => this.toast.setVisible(false));
  }

  // --- Panel de controles ---

  private closeControls() {
    this.overlay?.destroy();
    this.overlay = undefined;
  }

  // --- Pokémon paseando ---

  private async addWalkers() {
    const unlocked = loadUnlocked();
    const pool = unlocked.length ? unlocked : [1, 4, 7, 25];
    const ids = Phaser.Utils.Array.Shuffle([...pool]).slice(0, 4);
    const cards = await Promise.all(ids.map((id) => fetchPokemonCard(id).catch(() => null)));
    if (!this.alive) return;

    this.load.crossOrigin = 'anonymous';
    for (const c of cards) {
      if (c && !this.textures.exists(`starter-${c.id}-front`)) this.load.image(`starter-${c.id}-front`, c.sprites.front);
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (!this.alive) return;
      cards.forEach((c, k) => {
        const key = c && `starter-${c.id}-front`;
        if (!key || !this.textures.exists(key)) return;
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
        const dir = k % 2 ? 1 : -1;
        const img = this.add
          .image(80 + k * 230 + Math.random() * 60, WALK_Y * PIX.scale, key)
          .setOrigin(0.5, 0.92)
          .setScale(1)
          .setDepth(5)
          .setFlipX(dir > 0);
        this.walkers.push({ img, vx: dir * (36 + Math.random() * 30), phase: Math.random() * 6 });
      });
    });
    this.load.start();
  }

  private moveWalkers(dt: number) {
    const s = dt / 1000;
    for (const w of this.walkers) {
      // Camina por el camino, que a su vez se desplaza con el paisaje
      w.img.x += (w.vx - this.land.groundSpeed) * s;
      w.phase += s * Math.abs(w.vx) * 0.18;
      // Pasitos: un saltito por paso, de 4 en 4 píxeles como en la GBA
      w.img.y = WALK_Y * PIX.scale - Math.round(Math.abs(Math.sin(w.phase)) * 2) * 4;
      if (w.img.x < -70) w.img.x = 1030;
      if (w.img.x > 1030) w.img.x = -70;
    }
  }

  // --- Entrada ---

  update(_time: number, delta: number) {
    this.land?.update(delta);
    this.moveWalkers(delta);
    if (!this.keys) return;
    const J = Phaser.Input.Keyboard.JustDown;
    const k = this.keys;

    const up = J(k.UP) || J(k.W);
    const down = J(k.DOWN) || J(k.S);
    let dy = (down ? 1 : 0) - (up ? 1 : 0);
    let ok = J(k.ENTER) || J(k.SPACE);
    let back = J(k.ESC) || J(k.BACKSPACE);

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
