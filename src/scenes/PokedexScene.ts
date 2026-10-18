import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { classifyRarity, RARITY_LABEL } from '../data/gacha';
import { countByRegion, filterCollection, type CollectionEntry } from '../data/regions';
import { loadShinies, loadUnlocked } from '../data/save';
import { loadSpeciesIndex } from '../data/speciesIndex';
import { typeNameEs } from '../data/types';
import { cry } from '../ui/audio';
import { addBackButton } from '../ui/cards';
import { FilterBar } from '../ui/collection';
import { NavInput, PadButtons } from '../ui/nav';
import { COLORS, drawBox, fadeIn, FONT, goTo, hex, HEX, RARITY_COLORS, shorten, strokePixelFrame } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';

const COLS = 7;
const ROWS = 3;
const PAGE_SIZE = COLS * ROWS;
const TILE = { w: 106, h: 108, gap: 6 };
/** Centro de la primera fila: debajo de los filtros (que acaban en y ≈ 164). */
const GRID_TOP = 228;

/** Sprite pixel de frente del repositorio de PokeAPI (sin pedir /pokemon/{id} por cada uno). */
const spriteUrl = (id: number, shiny = false) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny ? 'shiny/' : ''}${id}.png`;
const dexKey = (e: { id: number; shiny: boolean }) => `dex-${e.id}${e.shiny ? '-s' : ''}`;

type Key = Phaser.Input.Keyboard.Key;

interface DexEntry extends CollectionEntry {
  owned: boolean;
  shiny: boolean;
}

/**
 * Pokédex: todos los Pokémon por región, los que tienes en color y los demás en silueta, con su rareza y filtros
 * por nombre, rareza, región y tipo. Teclado, ratón y mando.
 */
export class PokedexScene extends Phaser.Scene {
  private entries: DexEntry[] = [];
  private view: DexEntry[] = [];
  private filters?: FilterBar;
  private nav!: NavInput;
  private pad!: PadButtons;
  private keys!: Record<'Q' | 'E' | 'R' | 'T' | 'F', Key>;
  private grid?: Phaser.GameObjects.Container;
  private tiles: { box: Phaser.GameObjects.Container; glow: Phaser.GameObjects.Graphics }[] = [];
  private page = -1;
  private selected = 0;
  private pageToken = 0;
  private info!: Phaser.GameObjects.Text;
  private pageLabel!: Phaser.GameObjects.Text;
  private leaving = false;
  /** Cuántos tienes de cada región (para las pestañas). */
  private ownedCounts?: Record<string, number>;

  constructor() {
    super('Pokedex');
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
    this.leaving = false;
    this.nav = new NavInput(this);
    this.pad = new PadButtons(this);
    this.keys = this.input.keyboard!.addKeys('Q,E,R,T,F', false) as PokedexScene['keys'];
    addBackButton(this, () => this.goBack());
    const loading = this.add.text(480, 320, 'Cargando Pokédex…', { fontFamily: FONT, fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
    this.boot(loading).catch((err) => loading.setText('No se pudo cargar la lista de Pokémon.\n' + String(err)));
  }

  private async boot(loading: Phaser.GameObjects.Text) {
    const index = await loadSpeciesIndex();
    const owned = new Set(loadUnlocked());
    const shinies = new Set(loadShinies());
    this.entries = index.map((s) => ({
      id: s.id,
      name: s.nameEs ?? s.name,
      rarity: classifyRarity(s),
      types: s.types,
      owned: owned.has(s.id),
      shiny: shinies.has(s.id),
    }));
    loading.destroy();

    const have = this.entries.filter((e) => e.owned);
    this.add
      .text(480, 40, `Pokédex · Tienes ${have.length} de ${this.entries.length} · ★ ${shinies.size} shiny`, { fontFamily: FONT, fontSize: '30px', color: '#ffffff' })
      .setOrigin(0.5);
    this.filters = new FilterBar(this, {
      tabsY: 92,
      buttonsY: 146,
      withType: true,
      countEntries: () => this.entries,
      onChange: () => this.applyFilters(),
    });
    // Las pestañas cuentan los que tienes de cada región
    this.ownedCounts = countByRegion(have);

    drawBox(this.add.graphics(), 100, 540, 760, 44, { radius: 12 });
    this.info = this.add.text(480, 562, '', { fontFamily: FONT, fontSize: '17px', color: HEX.text }).setOrigin(0.5);
    this.pageLabel = this.add.text(480, 596, '', { fontFamily: FONT, fontSize: '15px', color: '#ffffff' }).setOrigin(0.5);
    for (const [label, x, d] of [['◀', 50, -1], ['▶', 910, 1]] as const) {
      const t = this.add
        .text(x, GRID_TOP + TILE.h + TILE.gap, label, { fontFamily: FONT, fontSize: '44px', color: '#ffffff' })
        .setOrigin(0.5)
        .setPadding(12, 8)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor(HEX.gold));
      t.on('pointerout', () => t.setColor('#ffffff'));
      t.on('pointerdown', () => !this.filters?.searching && this.turnPage(d));
    }
    this.add
      .text(480, 620, 'Flechas: mover · Enter/A/clic: grito · Q E / LB RB: región · R / X: rareza · T / LT RT: tipo · F / Y: buscar · Esc/B: volver', {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setAlpha(0.75);
    this.applyFilters();
  }

  private goBack() {
    if (this.leaving) return;
    if (this.filters?.closeSearch()) return;
    this.leaving = true;
    goTo(this, 'Menu');
  }

  private applyFilters() {
    if (!this.filters) return;
    this.view = filterCollection(this.entries, this.filters.filter());
    this.filters.refresh(this.view.length, this.ownedCounts);
    this.page = -1;
    this.select(0);
  }

  private pages() {
    return Math.max(1, Math.ceil(this.view.length / PAGE_SIZE));
  }

  private turnPage(d: number) {
    if (this.view.length === 0) return;
    const page = (this.page + d + this.pages()) % this.pages();
    this.select(page * PAGE_SIZE);
  }

  private select(i: number) {
    this.selected = Math.max(0, Math.min(i, this.view.length - 1));
    const page = Math.floor(this.selected / PAGE_SIZE);
    if (page !== this.page) void this.buildPage(page);
    else this.highlight();
  }

  /** Carga los sprites que falten de esta página (los que fallan se quedan con un "?"). */
  private loadSprites(entries: DexEntry[]): Promise<void> {
    return new Promise((resolve) => {
      this.load.crossOrigin = 'anonymous';
      let queued = 0;
      for (const e of entries) {
        if (this.textures.exists(dexKey(e))) continue;
        this.load.image(dexKey(e), spriteUrl(e.id, e.shiny));
        queued++;
      }
      if (queued === 0) return resolve();
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        for (const e of entries) if (this.textures.exists(dexKey(e))) this.textures.get(dexKey(e)).setFilter(Phaser.Textures.FilterMode.NEAREST);
        resolve();
      });
      this.load.start();
    });
  }

  private async buildPage(page: number) {
    this.page = page;
    const token = ++this.pageToken;
    this.grid?.destroy();
    this.grid = undefined;
    this.tiles = [];
    this.pageLabel.setText(this.pages() > 1 ? `Página ${page + 1} / ${this.pages()}` : '');
    if (this.view.length === 0) {
      this.info.setText('Ningún Pokémon con estos filtros');
      return;
    }
    const slice = this.view.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    this.info.setText('Cargando…');
    await this.loadSprites(slice);
    if (token !== this.pageToken || !this.scene.isActive()) return;

    const left = 480 - ((COLS - 1) * (TILE.w + TILE.gap)) / 2;
    const parts = slice.map((e, k) => {
      const x = left + (k % COLS) * (TILE.w + TILE.gap);
      const y = GRID_TOP + Math.floor(k / COLS) * (TILE.h + TILE.gap);
      const t = this.buildTile(e, x, y);
      const index = page * PAGE_SIZE + k;
      t.box.on('pointerover', () => !this.filters?.searching && this.select(index));
      t.box.on('pointerdown', () => {
        if (this.filters?.searching) return;
        this.select(index);
        this.use();
      });
      this.tiles.push(t);
      return t.box;
    });
    this.grid = this.add.container(0, 0, parts);
    this.highlight();
  }

  private buildTile(e: DexEntry, x: number, y: number) {
    const { w, h } = TILE;
    const bg = drawBox(this.add.graphics(), -w / 2, -h / 2, w, h, {
      radius: 10,
      border: e.owned ? RARITY_COLORS[e.rarity] : 0x4a5578,
      fill: e.owned ? COLORS.panel : 0xd5dae6,
    });
    const glow = this.add.graphics();
    strokePixelFrame(glow, -w / 2 - 6, -h / 2 - 6, w + 12, h + 12, COLORS.gold, 4).setVisible(false);
    const key = dexKey(e);
    const sprite = this.textures.exists(key)
      ? this.add.image(0, -10, key).setDisplaySize(84, 84)
      : this.add.text(0, -10, '?', { fontFamily: FONT, fontSize: '40px', color: HEX.text }).setOrigin(0.5);
    // Los que no tienes, en silueta
    if (!e.owned && sprite instanceof Phaser.GameObjects.Image) sprite.setTintFill(0x2b3a67).setAlpha(0.75);
    const num = this.add.text(-w / 2 + 10, -h / 2 + 8, `#${String(e.id).padStart(4, '0')}`, { fontFamily: FONT, fontSize: '11px', color: HEX.textSoft });
    const name = this.add
      .text(0, h / 2 - 16, shorten(e.name, 12), { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: e.owned ? HEX.text : '#5f6b7a' })
      .setOrigin(0.5);
    const parts: Phaser.GameObjects.GameObject[] = [bg, glow, sprite, num, name];
    if (e.shiny) {
      parts.push(this.add.text(w / 2 - 14, -h / 2 + 14, '★', { fontFamily: FONT, fontSize: '18px', color: '#ffd34d' }).setOrigin(0.5).setStroke('#8a6d1a', 3));
    }
    const box = this.add.container(x, y, parts).setSize(w, h);
    box.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h) /* Phaser la centra solo */, Phaser.Geom.Rectangle.Contains);
    box.input!.cursor = 'pointer';
    return { box, glow };
  }

  private highlight() {
    const local = this.selected - this.page * PAGE_SIZE;
    this.tiles.forEach((t, k) => {
      t.glow.setVisible(k === local);
      t.box.setScale(k === local ? 1.08 : 1).setDepth(k === local ? 1 : 0);
    });
    const e = this.view[this.selected];
    if (!e) return;
    const types = (e.types ?? []).map(typeNameEs).join(' / ');
    const owned = e.shiny ? '¡Lo tienes shiny!' : e.owned ? '¡Lo tienes!' : 'Aún no lo tienes: sale en el gacha';
    this.info.setText(`#${e.id} ${e.name} · ${RARITY_LABEL[e.rarity]}${types ? ' · ' + types : ''} · ${owned}`);
    this.info.setColor(e.owned ? hex(RARITY_COLORS[e.rarity]) : HEX.textSoft);
  }

  /** Enter, A o clic: suena el grito de los que tienes. */
  private use() {
    const e = this.view[this.selected];
    if (e?.owned) void cry(e.id);
  }

  update() {
    if (this.leaving || !this.nav) return;
    const s = this.nav.read();
    const pad = this.pad.read();
    const J = Phaser.Input.Keyboard.JustDown;
    const k = this.keys;
    const keys = { q: J(k.Q), e: J(k.E), r: J(k.R), t: J(k.T), f: J(k.F) };
    if (!this.filters) {
      if (s.back) this.goBack();
      return;
    }
    if (this.filters.handle(keys, pad)) return;
    if (s.back) return this.goBack();
    const n = this.view.length;
    if (n === 0) return;
    if (s.dx) this.select((this.selected + Math.sign(s.dx) + n) % n);
    if (s.dy) {
      const next = this.selected + Math.sign(s.dy) * COLS;
      if (next >= 0 && next < n) this.select(next);
    }
    if (s.ok) this.use();
  }
}
