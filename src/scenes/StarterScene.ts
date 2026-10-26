import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { fetchPokemonCard, PokemonCard } from '../data/pokeapi';
import { loadShinies, loadUnlocked } from '../data/save';
import { loadCollectionIndex, loadSpeciesIndex } from '../data/speciesIndex';
import { classifyRarity, RARITY_LABEL } from '../data/gacha';
import { filterCollection, CollectionEntry } from '../data/regions';
import { NavInput, PadButtons, UI } from '../ui/nav';
import { FilterBar } from '../ui/collection';
import { addBackButton, buildPokemonCard, loadCardTextures, STATS_EXTRA_H } from '../ui/cards';
import { fadeIn, goTo, hex, RARITY_COLORS } from '../ui/theme';
import { cry } from '../ui/audio';
import { addMenuBackdrop } from '../ui/art/landscape';

/** Pokémon por página: una fila de 4 tarjetas con sus estadísticas. */
const PAGE_SIZE = 4;
const COLS = 4;
const CARD_SCALE = 0.88;
const CELL = { w: 200 * CARD_SCALE + 20, h: (270 + STATS_EXTRA_H) * CARD_SCALE + 14 };
const GRID_Y = 390;
/** Margen tras abrir la pantalla en el que se ignora confirmar: evita que un Enter mantenido desde el menú elija solo. */
const INPUT_DELAY_MS = 350;

type Key = Phaser.Input.Keyboard.Key;

/**
 * Pantalla para elegir el Pokémon con el que juegas entre los que tienes, dividida por regiones (pestañas)
 * y con filtros por nombre (teclado en pantalla) y por rareza.
 */
export class StarterScene extends Phaser.Scene {
  private entries: CollectionEntry[] = [];
  private view: CollectionEntry[] = [];
  /** Pestañas de región, búsqueda y rareza (ui/collection.ts). */
  private filters?: FilterBar;
  private grid?: Phaser.GameObjects.Container;
  private tiles: { box: Phaser.GameObjects.Container; glow: Phaser.GameObjects.Graphics }[] = [];
  private emptyText!: Phaser.GameObjects.Text;
  private pageLabel!: Phaser.GameObjects.Text;
  private page = -1;
  private selected = 0;
  /** Para descartar el dibujo de una página vieja si se ha cambiado de página mientras cargaba. */
  private pageToken = 0;
  private cardCache = new Map<number, PokemonCard>();
  /** Los que tienes shiny: con ellos juegas con su sprite shiny. */
  private shinies = new Set<number>();

  private nav!: NavInput;
  private pad!: PadButtons;
  private keys!: Record<'Q' | 'E' | 'R' | 'T' | 'F', Key>;
  private starting = false;
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
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    this.tiles = [];
    this.grid = undefined;
    this.filters = undefined;
    this.page = -1;
    this.selected = 0;
    this.starting = false;

    // Primera partida: sin ningún Pokémon, se elige región e inicial
    const unlocked = loadUnlocked();
    this.shinies = new Set(loadShinies());
    if (unlocked.length === 0) {
      this.starting = true;
      this.scene.start('FirstStarter', { slot: this.slot });
      return;
    }

    // Volver funciona siempre, también mientras carga o si PokeAPI falla
    this.nav = new NavInput(this);
    this.pad = new PadButtons(this);
    this.keys = this.input.keyboard!.addKeys('Q,E,R,T,F', false) as StarterScene['keys'];
    addBackButton(this, () => this.goBack());

    const loading = this.add
      .text(480, 320, 'Cargando Pokémon…', { fontFamily: UI.FONT, fontSize: '28px', color: '#ffffff' })
      .setOrigin(0.5);
    this.boot(unlocked, loading).catch((err) => {
      loading.setText('No se pudo cargar PokeAPI.\n' + String(err) + '\n\nEsc, B o "Volver" para salir');
    });
  }

  private goBack() {
    if (this.starting) return;
    if (this.filters?.closeSearch()) return;
    this.starting = true;
    goTo(this, 'Slots');
  }

  private async boot(unlocked: number[], loading: Phaser.GameObjects.Text) {
    // La rareza y el nombre salen de la lista de especies; las tarjetas se piden por páginas
    const index = await loadCollectionIndex().catch(() => []);
    const byId = new Map(index.map((s) => [s.id, s]));
    this.entries = unlocked.map((id) => {
      const s = byId.get(id);
      return { id, name: s?.nameEs ?? s?.name ?? `#${id}`, rarity: s ? classifyRarity(s) : 'common', types: s?.types };
    });
    loading.destroy();
    this.buildMenu();
  }

  private buildMenu() {
    const style = { fontFamily: UI.FONT, color: '#ffffff' };
    this.add.text(480, 40, 'Elige tu Pokémon', { ...style, fontSize: '32px' }).setOrigin(0.5);

    // Pestañas de región (con cuántos tienes de cada una), búsqueda por nombre y rareza
    this.filters = new FilterBar(this, {
      tabsY: 96,
      buttonsY: 150,
      countEntries: () => this.entries,
      onChange: () => this.applyFilters(),
    });

    this.emptyText = this.add
      .text(480, GRID_Y, '', { ...style, fontSize: '22px', align: 'center' })
      .setOrigin(0.5)
      .setAlpha(0.85);
    this.pageLabel = this.add.text(480, 590, '', { ...style, fontSize: '16px' }).setOrigin(0.5);
    this.buildArrow('◀', 50, () => this.turnPage(-1));
    this.buildArrow('▶', 910, () => this.turnPage(1));
    this.add
      .text(
        480,
        618,
        'Flechas: elegir · Enter/A: jugar · Q E / LB RB: región · R / X: rareza · F / Y: buscar · Esc/B: volver',
        { ...style, fontSize: '14px' },
      )
      .setOrigin(0.5)
      .setAlpha(0.8);

    this.readyAt = this.time.now + INPUT_DELAY_MS;
    this.applyFilters();
  }

  private buildArrow(text: string, x: number, action: () => void) {
    const t = this.add
      .text(x, GRID_Y, text, { fontFamily: UI.FONT, fontSize: '44px', color: '#ffffff' })
      .setOrigin(0.5)
      .setPadding(12, 8)
      .setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setColor('#ffd34d'));
    t.on('pointerout', () => t.setColor('#ffffff'));
    t.on('pointerdown', () => !this.filters?.searching && action());
  }

  // --- Filtros ---

  private applyFilters() {
    if (!this.filters) return;
    this.view = filterCollection(this.entries, this.filters.filter());
    this.filters.refresh(this.view.length);
    this.page = -1;
    this.select(0);
  }

  // --- Cuadrícula de tarjetas ---

  private pages() {
    return Math.max(1, Math.ceil(this.view.length / PAGE_SIZE));
  }

  private turnPage(d: number) {
    if (this.view.length === 0) return;
    const page = (this.page + d + this.pages()) % this.pages();
    this.select(Math.min(this.view.length - 1, page * PAGE_SIZE));
  }

  private async buildPage(page: number) {
    this.page = page;
    const token = ++this.pageToken;
    this.grid?.destroy();
    this.grid = undefined;
    this.tiles = [];
    this.pageLabel.setText(this.pages() > 1 ? `Página ${page + 1} / ${this.pages()}` : '');

    if (this.view.length === 0) {
      this.emptyText.setText('Ningún Pokémon con estos filtros.\nCambia de región, de rareza o de búsqueda.');
      return;
    }
    this.emptyText.setText('Cargando…');
    const slice = this.view.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    let cards: PokemonCard[];
    try {
      cards = await Promise.all(slice.map((e) => this.card(e.id)));
      await loadCardTextures(this, cards, this.shinies);
    } catch (err) {
      if (token === this.pageToken) this.emptyText.setText('No se pudo cargar PokeAPI.\n' + String(err));
      return;
    }
    if (token !== this.pageToken || !this.scene.isActive()) return;
    this.emptyText.setText('');

    const rows = Math.ceil(cards.length / COLS);
    const cols = Math.min(COLS, cards.length);
    const left = 480 - ((cols - 1) * CELL.w) / 2;
    const top = GRID_Y - ((rows - 1) * CELL.h) / 2;
    const parts = cards.map((c, k) => {
      const e = slice[k];
      const t = buildPokemonCard(this, c, left + (k % COLS) * CELL.w, top + Math.floor(k / COLS) * CELL.h, {
        scale: CARD_SCALE,
        stats: c.stats,
        shiny: this.shinies.has(c.id),
        tag: { text: (this.shinies.has(c.id) ? 'Shiny · ' : '') + RARITY_LABEL[e.rarity], color: hex(RARITY_COLORS[e.rarity]) },
      });
      const index = page * PAGE_SIZE + k;
      t.box.on('pointerover', () => !this.filters?.searching && this.select(index));
      t.box.on('pointerdown', () => !this.filters?.searching && this.choose(index));
      this.tiles.push(t);
      return t.box;
    });
    this.grid = this.add.container(0, 0, parts);
    this.highlight();
  }

  /** Tarjeta de un Pokémon, pedida una sola vez. */
  private async card(id: number): Promise<PokemonCard> {
    const hit = this.cardCache.get(id);
    if (hit) return hit;
    const c = await fetchPokemonCard(id);
    this.cardCache.set(id, c);
    return c;
  }

  private select(i: number) {
    this.selected = Math.max(0, Math.min(i, this.view.length - 1));
    const page = Math.floor(this.selected / PAGE_SIZE);
    if (page !== this.page) void this.buildPage(page);
    else this.highlight();
  }

  private highlight() {
    const local = this.selected - this.page * PAGE_SIZE;
    this.tiles.forEach((t, k) => {
      t.glow.setVisible(k === local);
      t.box.setScale(k === local ? CARD_SCALE * 1.08 : CARD_SCALE);
      t.box.setDepth(k === local ? 1 : 0);
    });
  }

  private choose(i: number) {
    if (this.starting || this.time.now < this.readyAt) return;
    const e = this.view[i];
    if (!e || !this.tiles.length) return;
    this.starting = true;
    void cry(e.id);
    goTo(this, 'Mode', { starterId: e.id, slot: this.slot });
  }

  update() {
    if (this.starting || !this.nav) return;
    // Se leen siempre para que lo pulsado mientras se escribe no cuente después
    const s = this.nav.read();
    const pad = this.pad.read();
    const J = Phaser.Input.Keyboard.JustDown;
    const k = this.keys;
    const keys = { q: J(k.Q), e: J(k.E), r: J(k.R), t: J(k.T), f: J(k.F) };
    if (!this.filters) {
      if (s.back) this.goBack();
      return;
    }
    // Búsqueda abierta (o recién cerrada con Enter/Esc): no hace nada más
    if (this.filters.handle(keys, pad)) return;
    if (s.back) return this.goBack();

    const n = this.view.length;
    if (n === 0) return;
    if (s.dx !== 0) this.select((this.selected + Math.sign(s.dx) + n) % n);
    if (s.dy !== 0) {
      const next = this.selected + Math.sign(s.dy) * COLS;
      if (next >= 0 && next < n) this.select(next);
    }
    if (s.ok) this.choose(this.selected);
  }
}
