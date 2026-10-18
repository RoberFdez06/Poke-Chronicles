import Phaser from 'phaser';
import { fetchPokemonCard, PokemonCard } from '../data/pokeapi';
import { loadUnlocked } from '../data/save';
import { typeColor, typeNameEs } from '../data/types';

const FONT = 'system-ui, sans-serif';
const CARD = { w: 200, h: 270, gap: 24, cols: 4 };
/** Con más de una fila las tarjetas se encogen para que quepan en pantalla. */
const MULTI_ROW_SCALE = 0.78;
/** Pokémon por página (2 filas de 4). Con más desbloqueados hay varias páginas. */
const PAGE_SIZE = 8;

type Key = Phaser.Input.Keyboard.Key;
type KeyName = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'A' | 'D' | 'W' | 'S' | 'ENTER' | 'SPACE';
/** Margen tras abrir la pantalla en el que se ignora confirmar: evita que un Enter mantenido desde el menú elija solo. */
const INPUT_DELAY_MS = 350;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Pantalla para elegir el Pokémon inicial entre los que tienes desbloqueados. */
export class StarterScene extends Phaser.Scene {
  private cards: PokemonCard[] = [];
  private tiles: { box: Phaser.GameObjects.Container; glow: Phaser.GameObjects.Graphics }[] = [];
  private page = 0;
  private pageLabel?: Phaser.GameObjects.Text;
  private keys!: Record<KeyName, Key>;
  private selected = 0;
  private cols = 1;
  private starting = false;
  private padPrev = { left: false, right: false, up: false, down: false, ok: false };
  private escKey!: Key;
  private backPrev = false;
  private readyAt = 0;

  /** Hueco de partida en el que se guardará (lo elige SlotsScene). */
  private slot = 0;

  constructor() {
    super('Starter');
  }

  init(data?: { slot?: number }) {
    this.slot = data?.slot ?? 0;
  }

  create() {
    this.cards = [];
    this.tiles = [];
    this.page = -1;
    this.pageLabel = undefined;
    this.selected = 0;
    this.starting = false;
    this.padPrev = { left: false, right: false, up: false, down: false, ok: false };
    this.backPrev = false;
    this.readyAt = 0;
    // Volver funciona siempre, también mientras carga o si PokeAPI falla
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.buildBackButton();

    const loading = this.add
      .text(480, 320, 'Cargando Pokémon…', { fontFamily: FONT, fontSize: '28px', color: '#ffffff' })
      .setOrigin(0.5);

    this.boot(loading).catch((err) => {
      loading.setText('No se pudo cargar PokeAPI.\n' + String(err) + '\n\nEsc, B o "Volver" para salir');
    });
  }

  /** Botón de volver para jugar solo con ratón. */
  private buildBackButton() {
    const back = this.add
      .text(36, 50, '← Volver', { fontFamily: FONT, fontSize: '22px', color: '#ffffff' })
      .setOrigin(0, 0.5)
      .setPadding(8, 6)
      .setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setColor('#ffd34d'));
    back.on('pointerout', () => back.setColor('#ffffff'));
    back.on('pointerdown', () => this.goBack());
  }

  private goBack() {
    if (this.starting) return;
    this.starting = true;
    this.scene.start('Slots');
  }

  private async boot(loading: Phaser.GameObjects.Text) {
    this.cards = await Promise.all(loadUnlocked().map(fetchPokemonCard));

    // Las mismas texturas las reutiliza GameScene para el jugador
    this.load.crossOrigin = 'anonymous';
    for (const c of this.cards) {
      if (!this.textures.exists(`starter-${c.id}-front`)) this.load.image(`starter-${c.id}-front`, c.sprites.front);
      if (!this.textures.exists(`starter-${c.id}-back`)) this.load.image(`starter-${c.id}-back`, c.sprites.back);
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      for (const c of this.cards) {
        for (const side of ['front', 'back']) {
          const tex = `starter-${c.id}-${side}`;
          if (this.textures.exists(tex)) this.textures.get(tex).setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
      }
      loading.destroy();
      this.buildMenu();
    });
    this.load.start();
  }

  private buildMenu() {
    const style = { fontFamily: FONT, color: '#ffffff' };
    this.add.text(480, 50, 'Elige tu inicial', { ...style, fontSize: '40px' }).setOrigin(0.5);
    this.add
      .text(480, 604, 'Flechas o A D, ratón o mando para elegir · Enter, espacio, clic o A para empezar · Esc o B para volver', {
        ...style,
        fontSize: '16px',
      })
      .setOrigin(0.5)
      .setAlpha(0.8);

    const pages = Math.ceil(this.cards.length / PAGE_SIZE);
    if (pages > 1) {
      this.pageLabel = this.add.text(480, 572, '', { ...style, fontSize: '18px' }).setOrigin(0.5);
      this.buildArrow('◀', 60, () => this.select((this.selected - PAGE_SIZE + this.cards.length) % this.cards.length));
      this.buildArrow('▶', 900, () => this.select((this.selected + PAGE_SIZE) % this.cards.length));
    }

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,ENTER,SPACE') as Record<KeyName, Key>;
    this.readyAt = this.time.now + INPUT_DELAY_MS;
    this.select(0);
  }

  /** Flecha de página para jugar con ratón. */
  private buildArrow(text: string, x: number, action: () => void) {
    const t = this.add
      .text(x, 335, text, { fontFamily: FONT, fontSize: '48px', color: '#ffffff' })
      .setOrigin(0.5)
      .setPadding(14, 10)
      .setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setColor('#ffd34d'));
    t.on('pointerout', () => t.setColor('#ffffff'));
    t.on('pointerdown', action);
  }

  /** Dibuja las tarjetas de una página. */
  private buildPage(page: number) {
    this.tiles.forEach((t) => t.box.destroy());
    this.tiles = [];
    this.page = page;

    const first = page * PAGE_SIZE;
    const slice = this.cards.slice(first, first + PAGE_SIZE);
    const n = slice.length;
    this.cols = Math.min(n, CARD.cols);
    const rows = Math.ceil(n / this.cols);
    const scale = rows > 1 ? MULTI_ROW_SCALE : 1;
    const cw = CARD.w * scale;
    const ch = CARD.h * scale;
    const gap = CARD.gap * scale;
    const left = 480 - (this.cols * cw + (this.cols - 1) * gap) / 2 + cw / 2;
    const top = 335 - (rows * ch + (rows - 1) * gap) / 2 + ch / 2;

    slice.forEach((card, k) => {
      const x = left + (k % this.cols) * (cw + gap);
      const y = top + Math.floor(k / this.cols) * (ch + gap);
      this.tiles.push(this.buildCard(card, first + k, x, y, scale));
    });
    this.pageLabel?.setText(`Página ${page + 1} / ${Math.ceil(this.cards.length / PAGE_SIZE)}`);
  }

  private buildCard(card: PokemonCard, index: number, x: number, y: number, scale: number) {
    const { w, h } = CARD;
    const accent = typeColor(card.types[0] ?? 'normal');

    const bg = this.add.graphics();
    bg.fillStyle(0xeaf4ff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    bg.lineStyle(6, accent, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 22);

    const glow = this.add.graphics();
    glow.lineStyle(8, 0xffd34d, 1).strokeRoundedRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 28);

    const sprite = this.add.image(0, -42, `starter-${card.id}-front`).setDisplaySize(160, 160);
    const name = this.add
      .text(0, 70, capitalize(card.name), { fontFamily: FONT, fontSize: '26px', color: '#2b3a67' })
      .setOrigin(0.5);

    // Una etiqueta por tipo, centradas
    const chipW = 84;
    const chipGap = 8;
    const start = -((card.types.length * chipW + (card.types.length - 1) * chipGap) / 2) + chipW / 2;
    const chips = card.types.flatMap((t, k) => {
      const cx = start + k * (chipW + chipGap);
      const chip = this.add.graphics();
      chip.fillStyle(typeColor(t), 1).fillRoundedRect(cx - chipW / 2, 100, chipW, 26, 13);
      const label = this.add
        .text(cx, 113, typeNameEs(t), { fontFamily: FONT, fontSize: '15px', color: '#ffffff' })
        .setOrigin(0.5)
        .setShadow(0, 1, '#00000066', 2);
      return [chip, label];
    });

    const box = this.add.container(x, y, [bg, glow, sprite, name, ...chips]).setScale(scale);
    box.setSize(w, h);
    // El área interactiva de un contenedor parte de su esquina; la centramos
    box.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    box.input!.cursor = 'pointer';
    box.on('pointerover', () => this.select(index));
    box.on('pointerdown', () => this.choose(index));

    return { box, glow };
  }

  private select(i: number) {
    this.selected = i;
    const page = Math.floor(i / PAGE_SIZE);
    if (page !== this.page) this.buildPage(page);
    const local = i - page * PAGE_SIZE;
    const base = this.tiles.length > this.cols ? MULTI_ROW_SCALE : 1;
    this.tiles.forEach((t, k) => {
      t.glow.setVisible(k === local);
      t.box.setScale(k === local ? base * 1.08 : base);
      t.box.setDepth(k === local ? 1 : 0);
    });
  }

  private choose(i: number) {
    if (this.starting) return;
    this.starting = true;
    this.scene.start('Game', { starterId: this.cards[i].id, slot: this.slot });
  }

  update() {
    if (this.starting) return;
    const J = Phaser.Input.Keyboard.JustDown;

    // Volver: Esc o B del mando (el clic está en el botón "Volver"); sirve aunque aún no haya cargado
    const pad = this.input.gamepad?.getPad(0);
    const backNow = !!pad && pad.connected && pad.B;
    const back = J(this.escKey) || (backNow && !this.backPrev);
    this.backPrev = backNow;
    if (back) {
      this.goBack();
      return;
    }

    if (!this.keys) return;
    const k = this.keys;

    let dx = (J(k.RIGHT) || J(k.D) ? 1 : 0) - (J(k.LEFT) || J(k.A) ? 1 : 0);
    let dy = (J(k.DOWN) || J(k.S) ? 1 : 0) - (J(k.UP) || J(k.W) ? 1 : 0);
    let ok = J(k.ENTER) || J(k.SPACE);

    // Mando: cruceta o stick (un movimiento por pulsación) y A para confirmar
    if (pad && pad.connected) {
      const now = {
        left: pad.left || pad.leftStick.x < -0.5,
        right: pad.right || pad.leftStick.x > 0.5,
        up: pad.up || pad.leftStick.y < -0.5,
        down: pad.down || pad.leftStick.y > 0.5,
        ok: pad.A,
      };
      if (now.left && !this.padPrev.left) dx -= 1;
      if (now.right && !this.padPrev.right) dx += 1;
      if (now.up && !this.padPrev.up) dy -= 1;
      if (now.down && !this.padPrev.down) dy += 1;
      if (now.ok && !this.padPrev.ok) ok = true;
      this.padPrev = now;
    }

    const n = this.cards.length;
    if (dx !== 0) this.select((this.selected + Math.sign(dx) + n) % n);
    if (dy !== 0) {
      const next = this.selected + Math.sign(dy) * this.cols;
      if (next >= 0 && next < n && Math.floor(next / PAGE_SIZE) === this.page) this.select(next);
    }
    // Izquierda/derecha recorre todos y cambia de página solo; el ratón usa ◀ ▶
    if (ok && this.time.now >= this.readyAt) this.choose(this.selected);
  }
}
