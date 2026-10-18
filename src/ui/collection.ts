// Piezas comunes de las pantallas de colección (elegir Pokémon y Pokédex): botones sencillos, barra de filtros
// (pestañas de región, búsqueda por nombre, rareza y tipo) y teclado en pantalla para buscar.
// Teclado, ratón y mando: cada pantalla le pasa lo que lee en su update().
import Phaser from 'phaser';
import { RARITIES, RARITY_LABEL } from '../data/gacha';
import { countByRegion, REGIONS, SEARCH_LETTERS, type CollectionEntry, type CollectionFilter } from '../data/regions';
import { TYPE_COLORS, typeNameEs } from '../data/types';
import { addPanel, type PadButton } from './nav';
import { drawBox, FONT, HEX } from './theme';

/** Botón sencillo de interfaz (fondo + texto) con área de clic centrada. */
export interface Chip {
  box: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  w: number;
  h: number;
}

export function makeChip(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, size: number, onClick: () => void): Chip {
  const bg = scene.add.graphics();
  const text = scene.add
    .text(0, 0, label, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color: HEX.text, align: 'center' })
    .setOrigin(0.5);
  const box = scene.add.container(x, y, [bg, text]).setSize(w, h);
  box.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h) /* Phaser la centra solo */, Phaser.Geom.Rectangle.Contains);
  box.input!.cursor = 'pointer';
  box.on('pointerdown', onClick);
  const chip = { box, bg, text, w, h };
  paintChip(chip, false);
  return chip;
}

export function paintChip(c: Chip, on: boolean, dim = false) {
  c.bg.clear();
  drawBox(c.bg, -c.w / 2, -c.h / 2, c.w, c.h, { selected: on, radius: 10, fillAlpha: dim ? 0.6 : 1 });
}

const TYPES = Object.keys(TYPE_COLORS);
const KEYS = [...SEARCH_LETTERS, 'Borrar', 'Vaciar', 'Listo'];

export interface FilterBarOptions {
  /** Altura de las pestañas y de la fila de botones. */
  tabsY: number;
  buttonsY: number;
  /** Añade el botón de tipo (Pokédex). */
  withType?: boolean;
  /** Cuenta para las pestañas (por defecto, las entradas). */
  countEntries: () => readonly CollectionEntry[];
  onChange: () => void;
}

/**
 * Pestañas de región (Todas + 9), botón de búsqueda (abre un teclado en pantalla), botón de rareza y, si se pide,
 * de tipo. Teclado: Q/E región, R rareza, T tipo, F buscar. Mando: LB/RB región, X rareza, LT/RT tipo, Y buscar.
 */
export class FilterBar {
  /** -1 = todos; si no, índice en REGIONS, RARITIES o la lista de tipos. */
  regionIdx = -1;
  rarityIdx = -1;
  typeIdx = -1;
  query = '';
  private tabs: Chip[] = [];
  private searchBtn: Chip;
  private rarityBtn: Chip;
  private typeBtn?: Chip;
  private pad?: SearchPad;

  constructor(private scene: Phaser.Scene, private o: FilterBarOptions) {
    const n = REGIONS.length + 1;
    const tw = 88;
    for (let i = 0; i < n; i++) {
      const x = 480 + (i - (n - 1) / 2) * (tw + 4);
      this.tabs.push(makeChip(scene, x, o.tabsY, tw, 46, '', 14, () => this.setRegion(i - 1)));
    }
    if (o.withType) {
      this.searchBtn = makeChip(scene, 250, o.buttonsY, 300, 36, '', 17, () => this.openSearch());
      this.rarityBtn = makeChip(scene, 535, o.buttonsY, 240, 36, '', 17, () => this.cycleRarity(1));
      this.typeBtn = makeChip(scene, 780, o.buttonsY, 220, 36, '', 17, () => this.cycleType(1));
    } else {
      this.searchBtn = makeChip(scene, 330, o.buttonsY, 320, 36, '', 17, () => this.openSearch());
      this.rarityBtn = makeChip(scene, 650, o.buttonsY, 260, 36, '', 17, () => this.cycleRarity(1));
    }
  }

  /** El teclado de búsqueda está abierto: la pantalla no debe hacer nada más. */
  get searching(): boolean {
    return !!this.pad?.open;
  }

  filter(): CollectionFilter {
    return {
      region: this.regionIdx >= 0 ? REGIONS[this.regionIdx].id : null,
      rarity: this.rarityIdx >= 0 ? RARITIES[this.rarityIdx] : null,
      type: this.typeIdx >= 0 ? TYPES[this.typeIdx] : null,
      query: this.query,
    };
  }

  /** Repinta pestañas y botones; `shown` es cuántos pasan los filtros (sale en la búsqueda). */
  refresh(shown: number, ownedCounts?: Record<string, number>) {
    const all = this.o.countEntries();
    const counts = ownedCounts ?? countByRegion(all);
    const total = ownedCounts ? Object.values(ownedCounts).reduce((a, b) => a + b, 0) : all.length;
    this.tabs.forEach((t, i) => {
      t.text.setText(i === 0 ? `Todas\n${total}` : `${REGIONS[i - 1].name}\n${counts[REGIONS[i - 1].id]}`);
      paintChip(t, i - 1 === this.regionIdx, i > 0 && counts[REGIONS[i - 1].id] === 0);
    });
    const f = this.filter();
    this.searchBtn.text.setText(this.query ? `Buscar: ${this.query}` : 'Buscar por nombre…');
    paintChip(this.searchBtn, this.query !== '');
    this.rarityBtn.text.setText(`Rareza: ${f.rarity ? RARITY_LABEL[f.rarity] : 'Todas'}`);
    paintChip(this.rarityBtn, !!f.rarity);
    if (this.typeBtn) {
      this.typeBtn.text.setText(`Tipo: ${f.type ? typeNameEs(f.type) : 'Todos'}`);
      paintChip(this.typeBtn, !!f.type);
    }
    this.pad?.refresh(shown);
  }

  setRegion(i: number) {
    if (this.searching) return;
    this.regionIdx = i;
    this.o.onChange();
  }

  cycleRegion(d: number) {
    const n = REGIONS.length + 1;
    this.setRegion(((this.regionIdx + 1 + d + n) % n) - 1);
  }

  cycleRarity(d: number) {
    if (this.searching) return;
    const n = RARITIES.length + 1;
    this.rarityIdx = ((this.rarityIdx + 1 + d + n) % n) - 1;
    this.o.onChange();
  }

  cycleType(d: number) {
    if (this.searching || !this.typeBtn) return;
    const n = TYPES.length + 1;
    this.typeIdx = ((this.typeIdx + 1 + d + n) % n) - 1;
    this.o.onChange();
  }

  openSearch() {
    if (this.searching) return;
    this.pad ??= new SearchPad(this.scene, (q) => {
      this.query = q;
      this.o.onChange();
    });
    this.pad.show(this.query);
  }

  /**
   * Entrada de los filtros con teclado (teclas ya leídas con JustDown) y mando. Devuelve true si la ha
   * usado el teclado de búsqueda (abierto o recién cerrado), y entonces la pantalla no debe hacer nada más.
   */
  handle(keys: { q: boolean; e: boolean; r: boolean; t: boolean; f: boolean }, pad: Set<PadButton>): boolean {
    if (this.pad?.consume(pad)) return true;
    if (keys.q || pad.has('LB')) this.cycleRegion(-1);
    if (keys.e || pad.has('RB')) this.cycleRegion(1);
    if (keys.r || pad.has('X')) this.cycleRarity(1);
    if (keys.t || pad.has('RT')) this.cycleType(1);
    if (pad.has('LT')) this.cycleType(-1);
    if (keys.f || pad.has('Y')) {
      this.openSearch();
      return true;
    }
    return false;
  }

  /** Cierra la búsqueda si está abierta (para Esc o "Volver"). Devuelve si estaba abierta. */
  closeSearch(): boolean {
    if (!this.searching) return false;
    this.pad!.hide();
    return true;
  }
}

/** Teclado en pantalla para buscar por nombre (letras, Borrar, Vaciar, Listo), con teclado físico, mando y ratón. */
export class SearchPad {
  open = false;
  private query = '';
  private layer?: Phaser.GameObjects.Container;
  private keys: Chip[] = [];
  private field?: Phaser.GameObjects.Text;
  private focus = 0;
  private shown = 0;
  /** Se acaba de cerrar con Enter/Esc: ese mismo fotograma no cuenta para la pantalla. */
  private justClosed = false;

  constructor(private scene: Phaser.Scene, private onQuery: (q: string) => void) {
    const onKey = (ev: KeyboardEvent) => this.onKey(ev);
    scene.input.keyboard!.on('keydown', onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.keyboard?.off('keydown', onKey));
  }

  show(query: string) {
    if (this.open) return;
    this.open = true;
    this.query = query;
    const s = this.scene;
    const layer = addPanel(s, 480, 330, 640, 420, 40);
    const title = s.add.text(480, 150, 'Buscar por nombre', { fontFamily: FONT, fontSize: '26px', color: HEX.text }).setOrigin(0.5);
    this.field = s.add
      .text(480, 196, '', { fontFamily: FONT, fontSize: '26px', color: HEX.text, backgroundColor: '#ffffff' })
      .setOrigin(0.5)
      .setPadding(16, 6);
    const hint = s.add
      .text(480, 520, 'Escribe con el teclado, o elige letras con flechas / mando / ratón\nEnter o "Listo" para cerrar · Retroceso o "Borrar" para quitar una letra', {
        fontFamily: FONT,
        fontSize: '14px',
        color: HEX.text,
        align: 'center',
      })
      .setOrigin(0.5);
    layer.add([title, this.field, hint]);
    this.keys = KEYS.map((label, i) => {
      const special = i >= SEARCH_LETTERS.length;
      const col = special ? (i - SEARCH_LETTERS.length) * 3 : i % 10;
      const row = special ? 3 : Math.floor(i / 10);
      const w = special ? 150 : 46;
      const x = special ? 480 + (col / 3 - 1) * 170 : 480 + (col - 4.5) * 52;
      const y = 256 + row * 54;
      const chip = makeChip(s, x, y, w, 44, label, special ? 18 : 20, () => this.press(i));
      chip.box.on('pointerover', () => this.setFocus(i));
      layer.add(chip.box);
      return chip;
    });
    this.layer = layer.setDepth(40);
    this.focus = 0;
    this.paint();
  }

  hide() {
    this.layer?.destroy();
    this.layer = undefined;
    this.open = false;
    this.justClosed = true;
  }

  refresh(shown: number) {
    this.shown = shown;
    this.paint();
  }

  private paint() {
    if (!this.open) return;
    this.field?.setText(`${this.query || ' '}▏ (${this.shown})`);
    this.keys.forEach((k, i) => paintChip(k, i === this.focus));
  }

  private setFocus(i: number) {
    this.focus = i;
    this.paint();
  }

  private setQuery(q: string) {
    this.query = q.slice(0, 16);
    this.onQuery(this.query);
    this.paint();
  }

  private press(i: number) {
    const label = KEYS[i];
    if (label === 'Borrar') this.setQuery(this.query.slice(0, -1));
    else if (label === 'Vaciar') this.setQuery('');
    else if (label === 'Listo') this.hide();
    else this.setQuery(this.query + label.toLowerCase());
    if (this.open) this.setFocus(i);
  }

  /** Mueve el foco: 10 letras por fila y una fila de 3 botones abajo. */
  private move(dx: number, dy: number) {
    const n = SEARCH_LETTERS.length;
    let i = this.focus;
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
    this.setFocus(i);
  }

  /** Teclado físico mientras está abierto: letras escriben, Retroceso borra, Enter/Esc cierra. */
  private onKey(ev: KeyboardEvent) {
    if (!this.open) return;
    if (ev.key === 'Backspace') this.setQuery(this.query.slice(0, -1));
    else if (ev.key === 'Enter' || ev.key === 'Escape') this.hide();
    else if (ev.key === 'ArrowLeft') this.move(-1, 0);
    else if (ev.key === 'ArrowRight') this.move(1, 0);
    else if (ev.key === 'ArrowUp') this.move(0, -1);
    else if (ev.key === 'ArrowDown') this.move(0, 1);
    else if (ev.key === ' ') this.press(this.focus);
    else if (/^[a-zñáéíóúü0-9]$/i.test(ev.key)) this.setQuery(this.query + ev.key.toLowerCase());
  }

  /** Mando mientras está abierto. Devuelve true si se ha usado (abierto o recién cerrado). */
  consume(pad: Set<PadButton>): boolean {
    if (this.justClosed) {
      this.justClosed = false;
      return true;
    }
    if (!this.open) return false;
    const dx = (pad.has('right') ? 1 : 0) - (pad.has('left') ? 1 : 0);
    const dy = (pad.has('down') ? 1 : 0) - (pad.has('up') ? 1 : 0);
    if (dx || dy) this.move(dx, dy);
    if (pad.has('A')) this.press(this.focus);
    else if (pad.has('Y')) this.setQuery(this.query.slice(0, -1));
    else if (pad.has('B')) this.hide();
    return true;
  }
}
