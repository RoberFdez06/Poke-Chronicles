import Phaser from 'phaser';
import { fetchPokemonCard, PokemonCard } from '../data/pokeapi';
import { loadUnlocked } from '../data/save';
import { loadSpeciesIndex } from '../data/speciesIndex';
import { classifyRarity, RARITIES, RARITY_LABEL, Rarity } from '../data/gacha';
import { countByRegion, filterCollection, CollectionEntry, REGIONS, SEARCH_LETTERS } from '../data/regions';
import { addPanel, NavInput, PadButtons, UI } from '../ui/nav';
import { addBackButton, buildPokemonCard, loadCardTextures } from '../ui/cards';

/** Pokémon por página (2 filas de 4). */
const PAGE_SIZE = 8;
const COLS = 4;
const CARD_SCALE = 0.68;
const CELL = { w: 200 * CARD_SCALE + 18, h: 270 * CARD_SCALE + 14 };
const GRID_Y = 384;
/** Margen tras abrir la pantalla en el que se ignora confirmar: evita que un Enter mantenido desde el menú elija solo. */
const INPUT_DELAY_MS = 350;

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#5f6b7a',
  rare: '#2e86de',
  epic: '#8e44ad',
  ultra: '#e84393',
  legendary: '#d4a017',
};

type Key = Phaser.Input.Keyboard.Key;

/** Botón sencillo de interfaz (fondo + texto) con área de clic centrada. */
interface Chip {
  box: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  w: number;
  h: number;
}

/**
 * Pantalla para elegir el Pokémon con el que juegas entre los que tienes, dividida por regiones (pestañas)
 * y con filtros por nombre (teclado en pantalla) y por rareza.
 */
export class StarterScene extends Phaser.Scene {
  private entries: CollectionEntry[] = [];
  private view: CollectionEntry[] = [];
  /** -1 = todas las regiones; si no, índice en REGIONS. */
  private regionIdx = -1;
  /** -1 = todas las rarezas; si no, índice en RARITIES. */
  private rarityIdx = -1;
  private query = '';

  private tabs: Chip[] = [];
  private searchBtn!: Chip;
  private rarityBtn!: Chip;
  private grid?: Phaser.GameObjects.Container;
  private tiles: { box: Phaser.GameObjects.Container; glow: Phaser.GameObjects.Graphics }[] = [];
  private emptyText!: Phaser.GameObjects.Text;
  private pageLabel!: Phaser.GameObjects.Text;
  private page = -1;
  private selected = 0;
  /** Para descartar el dibujo de una página vieja si se ha cambiado de página mientras cargaba. */
  private pageToken = 0;
  private cardCache = new Map<number, PokemonCard>();

  private nav!: NavInput;
  private pad!: PadButtons;
  private keys!: Record<'Q' | 'E' | 'R' | 'F', Key>;
  private ready = false;
  private starting = false;
  private readyAt = 0;

  /** Teclado en pantalla para buscar por nombre. */
  private search?: {
    layer: Phaser.GameObjects.Container;
    keys: Chip[];
    field: Phaser.GameObjects.Text;
    focus: number;
  };
  /** La búsqueda se acaba de cerrar con Enter/Esc: ese mismo fotograma no cuenta como jugar o volver. */
  private justClosed = false;

  /** Hueco de partida en el que se guardará (lo elige SlotsScene). */
  private slot = 0;

  constructor() {
    super('Starter');
  }

  init(data?: { slot?: number }) {
    this.slot = data?.slot ?? 0;
  }

  create() {
    this.tabs = [];
    this.tiles = [];
    this.grid = undefined;
    this.search = undefined;
    this.justClosed = false;
    this.page = -1;
    this.selected = 0;
    this.regionIdx = -1;
    this.rarityIdx = -1;
    this.query = '';
    this.ready = false;
    this.starting = false;

    // Primera partida: sin ningún Pokémon, se elige región e inicial
    const unlocked = loadUnlocked();
    if (unlocked.length === 0) {
      this.starting = true;
      this.scene.start('FirstStarter', { slot: this.slot });
      return;
    }

    // Volver funciona siempre, también mientras carga o si PokeAPI falla
    this.nav = new NavInput(this);
    this.pad = new PadButtons(this);
    this.keys = this.input.keyboard!.addKeys('Q,E,R,F', false) as StarterScene['keys'];
    addBackButton(this, () => this.goBack());
    const onKey = (ev: KeyboardEvent) => this.onSearchKey(ev);
    this.input.keyboard!.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', onKey));

    const loading = this.add
      .text(480, 320, 'Cargando Pokémon…', { fontFamily: UI.FONT, fontSize: '28px', color: '#ffffff' })
      .setOrigin(0.5);
    this.boot(unlocked, loading).catch((err) => {
      loading.setText('No se pudo cargar PokeAPI.\n' + String(err) + '\n\nEsc, B o "Volver" para salir');
    });
  }

  private goBack() {
    if (this.starting) return;
    if (this.search) return this.closeSearch();
    this.starting = true;
    this.scene.start('Slots');
  }

  private async boot(unlocked: number[], loading: Phaser.GameObjects.Text) {
    // La rareza y el nombre salen de la lista de especies; las tarjetas se piden por páginas
    const index = await loadSpeciesIndex().catch(() => []);
    const byId = new Map(index.map((s) => [s.id, s]));
    this.entries = unlocked.map((id) => {
      const s = byId.get(id);
      return { id, name: s?.nameEs ?? s?.name ?? `#${id}`, rarity: s ? classifyRarity(s) : 'common' };
    });
    loading.destroy();
    this.buildMenu();
  }

  private buildMenu() {
    const style = { fontFamily: UI.FONT, color: '#ffffff' };
    this.add.text(480, 40, 'Elige tu Pokémon', { ...style, fontSize: '32px' }).setOrigin(0.5);

    // Pestañas: Todas + una por región, con cuántos tienes de cada una
    const counts = countByRegion(this.entries);
    const labels = [`Todas\n${this.entries.length}`, ...REGIONS.map((r) => `${r.name}\n${counts[r.id]}`)];
    const tw = 88;
    labels.forEach((label, i) => {
      const x = 480 + (i - (labels.length - 1) / 2) * (tw + 4);
      const chip = this.makeChip(x, 96, tw, 46, label, 14, () => this.setRegion(i - 1));
      this.tabs.push(chip);
    });

    this.searchBtn = this.makeChip(330, 150, 320, 36, '', 17, () => this.openSearch());
    this.rarityBtn = this.makeChip(650, 150, 260, 36, '', 17, () => this.cycleRarity(1));

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

    this.ready = true;
    this.readyAt = this.time.now + INPUT_DELAY_MS;
    this.applyFilters();
  }

  private makeChip(x: number, y: number, w: number, h: number, label: string, size: number, onClick: () => void): Chip {
    const bg = this.add.graphics();
    const text = this.add
      .text(0, 0, label, { fontFamily: UI.FONT, fontSize: `${size}px`, fontStyle: 'bold', color: '#2b3a67', align: 'center' })
      .setOrigin(0.5);
    const box = this.add.container(x, y, [bg, text]).setSize(w, h);
    box.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h) /* Phaser la centra solo */, Phaser.Geom.Rectangle.Contains);
    box.input!.cursor = 'pointer';
    box.on('pointerdown', onClick);
    const chip = { box, bg, text, w, h };
    this.paintChip(chip, false);
    return chip;
  }

  private paintChip(c: Chip, on: boolean, dim = false) {
    c.bg.clear();
    c.bg.fillStyle(on ? UI.GOLD : UI.PANEL, dim ? 0.55 : 1).fillRoundedRect(-c.w / 2, -c.h / 2, c.w, c.h, 12);
    c.bg.lineStyle(3, UI.NAVY, 1).strokeRoundedRect(-c.w / 2, -c.h / 2, c.w, c.h, 12);
  }

  private buildArrow(text: string, x: number, action: () => void) {
    const t = this.add
      .text(x, GRID_Y, text, { fontFamily: UI.FONT, fontSize: '44px', color: '#ffffff' })
      .setOrigin(0.5)
      .setPadding(12, 8)
      .setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setColor('#ffd34d'));
    t.on('pointerout', () => t.setColor('#ffffff'));
    t.on('pointerdown', () => !this.search && action());
  }

  // --- Filtros ---

  private setRegion(i: number) {
    if (this.search) return;
    this.regionIdx = i;
    this.applyFilters();
  }

  private cycleRegion(d: number) {
    const n = REGIONS.length + 1;
    this.setRegion(((this.regionIdx + 1 + d + n) % n) - 1);
  }

  private cycleRarity(d: number) {
    if (this.search) return;
    const n = RARITIES.length + 1;
    this.rarityIdx = ((this.rarityIdx + 1 + d + n) % n) - 1;
    this.applyFilters();
  }

  private applyFilters(keepSelection = false) {
    const region = this.regionIdx >= 0 ? REGIONS[this.regionIdx].id : null;
    const rarity = this.rarityIdx >= 0 ? RARITIES[this.rarityIdx] : null;
    const prevId = this.view[this.selected]?.id;
    this.view = filterCollection(this.entries, { region, rarity, query: this.query });

    const counts = countByRegion(this.entries);
    this.tabs.forEach((t, i) => this.paintChip(t, i - 1 === this.regionIdx, i > 0 && counts[REGIONS[i - 1].id] === 0));
    this.searchBtn.text.setText(this.query ? `Buscar: ${this.query}` : 'Buscar por nombre…');
    this.paintChip(this.searchBtn, this.query !== '');
    this.rarityBtn.text.setText(`Rareza: ${rarity ? RARITY_LABEL[rarity] : 'Todas'}`);
    this.paintChip(this.rarityBtn, rarity !== null);

    const keep = keepSelection ? this.view.findIndex((e) => e.id === prevId) : -1;
    this.page = -1;
    this.select(Math.max(0, keep));
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
      await loadCardTextures(this, cards);
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
        tag: { text: RARITY_LABEL[e.rarity], color: RARITY_COLOR[e.rarity] },
      });
      const index = page * PAGE_SIZE + k;
      t.box.on('pointerover', () => !this.search && this.select(index));
      t.box.on('pointerdown', () => !this.search && this.choose(index));
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
    this.scene.start('Mode', { starterId: e.id, slot: this.slot });
  }

  // --- Búsqueda por nombre: teclado físico o en pantalla (ratón y mando) ---

  private openSearch() {
    if (this.search || this.starting) return;
    const layer = addPanel(this, 480, 330, 640, 420, 40);
    const title = this.add.text(480, 150, 'Buscar por nombre', { fontFamily: UI.FONT, fontSize: '26px', color: '#2b3a67' }).setOrigin(0.5);
    const field = this.add
      .text(480, 196, '', { fontFamily: UI.FONT, fontSize: '26px', color: '#2b3a67', backgroundColor: '#ffffff' })
      .setOrigin(0.5)
      .setPadding(16, 6);
    const hint = this.add
      .text(480, 520, 'Escribe con el teclado, o elige letras con flechas / mando / ratón\nEnter o "Listo" para cerrar · Retroceso o "Borrar" para quitar una letra', {
        fontFamily: UI.FONT,
        fontSize: '14px',
        color: '#2b3a67',
        align: 'center',
      })
      .setOrigin(0.5);
    layer.add([title, field, hint]);

    const labels = [...SEARCH_LETTERS, 'Borrar', 'Vaciar', 'Listo'];
    const keys = labels.map((label, i) => {
      const special = i >= SEARCH_LETTERS.length;
      const col = special ? (i - SEARCH_LETTERS.length) * 3 : i % 10;
      const row = special ? 3 : Math.floor(i / 10);
      const w = special ? 150 : 46;
      const x = special ? 480 + (col / 3 - 1) * 170 : 480 + (col - 4.5) * 52;
      const y = 256 + row * 54;
      const chip = this.makeChip(x, y, w, 44, label, special ? 18 : 20, () => this.pressSearchKey(i));
      chip.box.on('pointerover', () => this.focusSearchKey(i));
      layer.add(chip.box);
      return chip;
    });
    this.search = { layer, keys, field, focus: 0 };
    this.refreshSearch();
  }

  private closeSearch() {
    this.search?.layer.destroy();
    this.search = undefined;
    this.justClosed = true;
  }

  private focusSearchKey(i: number) {
    if (!this.search) return;
    this.search.focus = i;
    this.refreshSearch();
  }

  private pressSearchKey(i: number) {
    const label = [...SEARCH_LETTERS, 'Borrar', 'Vaciar', 'Listo'][i];
    if (label === 'Borrar') this.setQuery(this.query.slice(0, -1));
    else if (label === 'Vaciar') this.setQuery('');
    else if (label === 'Listo') this.closeSearch();
    else this.setQuery(this.query + label.toLowerCase());
    if (this.search) this.focusSearchKey(i);
  }

  private setQuery(q: string) {
    this.query = q.slice(0, 16);
    this.refreshSearch();
    this.applyFilters();
  }

  private refreshSearch() {
    const s = this.search;
    if (!s) return;
    s.field.setText(`${this.query || ' '}▏ (${this.view.length})`);
    s.keys.forEach((k, i) => this.paintChip(k, i === s.focus));
  }

  /** Mueve el foco del teclado en pantalla: 10 letras por fila y una fila de 3 botones abajo. */
  private moveSearchFocus(dx: number, dy: number) {
    const s = this.search!;
    const n = SEARCH_LETTERS.length;
    let i = s.focus;
    if (i < n) {
      const row = Math.floor(i / 10);
      const col = i % 10;
      if (dx) i = row * 10 + ((col + dx + 10) % 10);
      if (i >= n) i = dx > 0 ? row * 10 : n - 1;
      if (dy > 0) i = row === 2 || i + 10 >= n ? n + Math.min(2, Math.floor(col / 4)) : i + 10;
      if (dy < 0) i = row === 0 ? n + Math.min(2, Math.floor(col / 4)) : i - 10;
    } else {
      const col = i - n;
      if (dx) i = n + ((col + dx + 3) % 3);
      if (dy < 0) i = Math.min(n - 1, 20 + col * 4);
      if (dy > 0) i = col * 4;
    }
    s.focus = i;
    this.refreshSearch();
  }

  /** Teclado físico mientras está abierta la búsqueda: letras escriben, Retroceso borra, Enter/Esc cierra. */
  private onSearchKey(ev: KeyboardEvent) {
    if (!this.search) return;
    if (ev.key === 'Backspace') this.setQuery(this.query.slice(0, -1));
    else if (ev.key === 'Enter' || ev.key === 'Escape') this.closeSearch();
    else if (ev.key === 'ArrowLeft') this.moveSearchFocus(-1, 0);
    else if (ev.key === 'ArrowRight') this.moveSearchFocus(1, 0);
    else if (ev.key === 'ArrowUp') this.moveSearchFocus(0, -1);
    else if (ev.key === 'ArrowDown') this.moveSearchFocus(0, 1);
    else if (ev.key === ' ') this.pressSearchKey(this.search.focus);
    else if (/^[a-zñáéíóúü0-9]$/i.test(ev.key)) this.setQuery(this.query + ev.key.toLowerCase());
  }

  update() {
    if (this.starting || !this.nav) return;
    // Se leen siempre para que lo pulsado mientras se escribe no cuente después
    const s = this.nav.read();
    const pad = this.pad.read();
    const J = Phaser.Input.Keyboard.JustDown;
    const k = this.keys;
    const kq = J(k.Q);
    const ke = J(k.E);
    const kr = J(k.R);
    const kf = J(k.F);

    if (this.search) {
      // El teclado físico va por onSearchKey; aquí solo el mando
      const dx = (pad.has('right') ? 1 : 0) - (pad.has('left') ? 1 : 0);
      const dy = (pad.has('down') ? 1 : 0) - (pad.has('up') ? 1 : 0);
      if (dx || dy) this.moveSearchFocus(dx, dy);
      if (pad.has('A')) this.pressSearchKey(this.search.focus);
      else if (pad.has('Y')) this.setQuery(this.query.slice(0, -1));
      else if (pad.has('B')) this.closeSearch();
      return;
    }

    if (this.justClosed) {
      this.justClosed = false;
      return;
    }
    if (s.back) return this.goBack();
    if (!this.ready) return;

    if (kq || pad.has('LB')) this.cycleRegion(-1);
    if (ke || pad.has('RB')) this.cycleRegion(1);
    if (kr || pad.has('X')) this.cycleRarity(1);
    if (kf || pad.has('Y')) return this.openSearch();

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
