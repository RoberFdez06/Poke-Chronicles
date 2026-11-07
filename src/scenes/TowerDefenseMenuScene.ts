// Defensa de torres: elegir mapa (con candado y progreso), nivel (o el infinito) y el equipo de 5-6 Pokémon de tu
// colección. Teclado, ratón y mando por separado: flechas/cruceta para moverse, Enter/A para elegir, Esc/B para
// volver; en el equipo, Q/E o LB/RB cambian de página.
// Táctil (rama `tdmovil`, data/towerDefense/touchMenu.ts): fichas y botones de ≥ 56 px CSS con el lienzo a todo el
// ancho; en vertical sale el aviso «Gira el móvil» de index.html.
import Phaser from 'phaser';
import { addHelpBar } from '../ui/helpBar';
import { playTdMenuMusic, releaseMusic } from '../ui/audio';
import { fitDesign } from '../ui/layout';
import { touchOnlyDevice } from '../data/controls';
import { gridCell, levelsLayout, mapsLayout, menuFrame, menuUnits, teamLayout, type GridFit, type TeamTouchLayout } from '../data/towerDefense/touchMenu';
import type { Rect } from '../data/towerDefense/touchTd';
import { fitTextIn, tdTouchView, useTdTouchWidth } from '../ui/tdTouchScene';
import { fitTextLine } from '../ui/fitText';
import { addBackButton } from '../ui/cards';
import { NavInput, PadButtons, UI, type PadButton } from '../ui/nav';
import { drawBox, fadeIn, goTo, RARITY_COLORS, shorten } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';
import { ToastStack } from '../ui/toast';
import { bakeTdArt, drawMapThumb, tdIcon, tdIconKey } from '../ui/art/tdArt';
import { bakeClassIcons, classIconKey } from '../ui/art/tdClassIcons';
import {
  barBack, barFromColumn, classFilterOptions, filterPicksBy, typeFilterOptions, BAR_CLASS, BAR_RESET, BAR_SORT, BAR_TYPE, NO_FILTERS, type PickFilters,
  canHitAir, clampCursor, clampPanel, cycle, filterLabel, indexOf, jumpPage, moveCursor, movePanel, pageCount,
  sortPicks, turnPage, CLASS_COLOR, CLASS_TRAITS, SORT_KEYS, SORT_LABEL, START_FOCUS, TRIAL_FOCUS, type GridCursor, type SortKey,
} from '../data/towerDefense/teamPick';
import { TD_MAPS } from '../data/towerDefense/maps';
import { variantSummary } from '../data/towerDefense/variants';
import { levelTheme, themeSummary, themesOf } from '../data/towerDefense/themes';
import { bakeTypeIcons, typeIcon, typeIconKey } from '../ui/art/tdThemeArt';
import { bakeWarnIcons, warnIconKey, WARN_FILL, WARN_TEXT } from '../ui/art/tdWarnArt';
import { levelFoesLine, levelHint, matchupForLevel, VERDICT_LABEL } from '../data/towerDefense/matchupWarning';
import { TD_GUIDE } from '../data/towerDefense/guide';
import { wavesInLevel } from '../data/towerDefense/waves';
import {
  LEVEL_COLS, LEVEL_GRID_BOTTOM, levelBox, levelsNeeded, isEndlessUnlocked, isLevelUnlocked, isMapUnlocked, levelsCleared, loadTdProgress, mapProgress, mapStars, type TdProgress,
} from '../data/towerDefense/progress';
import { TRIAL_TEAM } from '../data/towerDefense/species';
import { towerCost, towerStyle, STYLE_LABEL } from '../data/towerDefense/towers';
import { biomeById } from '../level/biomes';
import { loadUnlocked } from '../data/save';
import { loadCollectionIndex } from '../data/speciesIndex';
import { classifyRarity, RARITY_LABEL, type Rarity, type SpeciesFact } from '../data/gacha';
import { typeNameEs } from '../data/types';
import { activeStorage } from '../data/storage';
import { accountInfo } from '../net/cloud';

/** Lo que se pasa a la partida de cada Pokémon del equipo (las estadísticas se piden allí). */
export interface TdPick {
  id: number;
  name: string;
  types: string[];
  rarity: Rarity;
  bst: number;
}

export interface TowerDefenseData {
  mapIdx: number;
  level: number;
  team: TdPick[];
  /** El equipo de prueba (no viene de la colección). */
  trial?: boolean;
}

const TEAM_KEY = 'pokeisaac.towerdef.team';
export const TEAM_MAX = 6;
export const TEAM_MIN = 1;
const spriteUrl = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
export const tdMonKey = (id: number) => `tdmon-${id}`;
const NAVY = '#2b3a67';
const COLS = 6;
const ROWS = 4;
const PER_PAGE = COLS * ROWS;
const GRID = { cols: COLS, rows: ROWS };
/** Lado del sprite en la casilla y lo máximo que crece al enfocarlo (sin salirse de la baldosa de 72). */
const SPRITE_BOX = 50;
const SPRITE_MAX = 58;

type Stage = 'maps' | 'levels' | 'team';

export class TowerDefenseMenuScene extends Phaser.Scene {
  private nav!: NavInput;
  private pad!: PadButtons;
  private stage: Stage = 'maps';
  private layer!: Phaser.GameObjects.Container;
  private progress!: TdProgress;
  private mapSel = 0;
  private levelSel = 0;
  private toasts!: ToastStack;
  private back = { slot: 0, starterId: 4 };
  // Equipo
  private owned: TdPick[] = [];
  private team: TdPick[] = [];
  private page = 0;
  private teamSel = 0;
  /** Dónde está el foco: la rejilla, la barra de filtro/orden o el panel del equipo. */
  private zone: 'grid' | 'bar' | 'panel' = 'grid';
  private barSel = 0;
  /** Panel: 0-5 huecos, START_FOCUS «¡A jugar!», TRIAL_FOCUS equipo de prueba. */
  private panelSel = START_FOCUS;
  private filters: PickFilters = { ...NO_FILTERS };
  private sort: SortKey = 'poder';
  private hold = { dir: 0, next: 0 };
  private trial = false;
  private loading = false;
  private redraw: (grid?: boolean) => void = () => {};
  private keys!: Record<'Q' | 'E' | 'H' | 'F' | 'T' | 'O' | 'R' | 'PGUP' | 'PGDN', Phaser.Input.Keyboard.Key>;
  /** Pantalla «Cómo se juega» abierta (y su página). */
  private help: { box: Phaser.GameObjects.Container; page: number; draw: () => void } | null = null;
  /** Táctil: px CSS por unidad y lo que se ve del diseño (null con teclado y ratón). */
  private tv: { k: number; view: Rect } | null = null;
  /** Columnas de las rejillas de mapas y niveles (para las flechas) y rejilla del equipo. */
  private mapCols = 4;
  private mapGrid: GridFit | null = null;
  private levelCols = 0;
  private grid = GRID;
  private backBtn: Phaser.GameObjects.Text | null = null;
  private helpBtn: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('TowerDefenseMenu');
  }

  init(data: { slot?: number; starterId?: number; mapIdx?: number; stage?: Stage; levelSel?: number; picks?: number[] }) {
    this.back = { slot: data?.slot ?? 0, starterId: data?.starterId ?? 4 };
    this.stage = data?.stage ?? 'maps';
    if (data?.mapIdx !== undefined) this.mapSel = data.mapIdx;
    if (data?.levelSel !== undefined) this.levelSel = data.levelSel;
    this.keepPicks = data?.picks ?? null;
  }

  /** Equipo elegido sin guardar aún (al rehacer la pantalla en táctil por girar o por las barras del navegador). */
  private keepPicks: number[] | null = null;

  /** wideScreen: el lienzo cambió de ancho. En táctil, si cambia la disposición, la pantalla se rehace en su sitio. */
  relayoutWide() {
    fitDesign(this);
    if (!this.tv || this.data?.get('leaving')) return;
    const next = tdTouchView();
    if (Math.abs(next.view.w - this.tv.view.w) < 0.5 && Math.abs(next.k - this.tv.k) < 1e-4) return;
    this.closeHelp();
    this.scene.restart({
      ...this.back,
      mapIdx: this.mapSel,
      stage: this.stage,
      levelSel: this.levelSel,
      picks: this.stage === 'team' && !this.loading ? this.team.map((t) => t.id) : undefined,
    });
  }

  create() {
    // Música del menú de torres; al salir, la del menú si nadie la ha cambiado ya (la partida pone la de su tipo)
    playTdMenuMusic();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => releaseMusic((k) => k === 'td-menu'));
    fadeIn(this);
    fitDesign(this);
    // Táctil: lienzo a todo el ancho (hasta 3:1) y fichas grandes; al cerrarse suelta los dedos
    this.tv = null;
    this.mapCols = 4;
    this.mapGrid = null;
    this.levelCols = 0;
    this.grid = GRID;
    if (useTdTouchWidth(this)) {
      fitDesign(this);
      this.tv = tdTouchView();
    }
    addMenuBackdrop(this);
    bakeTdArt(this);
    bakeTypeIcons(this);
    this.nav = new NavInput(this);
    this.pad = new PadButtons(this);
    const kb = this.input.keyboard!;
    this.keys = { Q: kb.addKey('Q', false), E: kb.addKey('E', false), H: kb.addKey('H', false), F: kb.addKey('F', false), O: kb.addKey('O', false), T: kb.addKey('T', false), R: kb.addKey('R', false), PGUP: kb.addKey('PAGE_UP', false), PGDN: kb.addKey('PAGE_DOWN', false) };
    const tb = this.tv ? menuFrame(this.tv.view, this.tv.k).body : null;
    this.toasts = tb ? new ToastStack(this, tb.x, tb.y, Math.min(tb.w * 0.5, 420), (c) => c.setDepth(50)) : new ToastStack(this, 20, 92, 300, (c) => c.setDepth(50));
    this.progress = loadTdProgress();
    const fr = this.tv ? menuFrame(this.tv.view, this.tv.k) : null;
    const um = this.tv ? menuUnits(this.tv.k) : null;
    this.backBtn = fr ? addBackButton(this, () => this.goBack(), fr.back.x + 4, fr.back.y + fr.back.h / 2) : addBackButton(this, () => this.goBack());
    const helpBtn = this.add
      .text(fr ? fr.help.x + fr.help.w - 4 : 924, fr ? fr.help.y + fr.help.h / 2 : 40, fr ? 'Cómo se juega' : 'Cómo se juega (H · Y)', { fontFamily: UI.FONT, fontSize: `${um ? um.font : 18}px`, color: '#ffffff' })
      .setOrigin(1, 0.5)
      .setPadding(8, 6)
      .setDepth(5)
      .setStroke('#18202c', 4)
      .setInteractive({ useHandCursor: true });
    helpBtn.on('pointerover', () => helpBtn.setColor('#ffd34d')).on('pointerout', () => helpBtn.setColor('#ffffff'));
    helpBtn.on('pointerdown', () => this.openHelp());
    this.helpBtn = helpBtn;
    if (fr) {
      growHit(this.backBtn, fr.back);
      growHit(helpBtn, fr.help);
    }
    this.layer = this.add.container(0, 0);
    this.showStage(this.stage);
  }

  private showStage(s: Stage) {
    this.stage = s;
    this.layer.removeAll(true);
    // Táctil: en «Elige tu equipo» la ayuda va a la izquierda de la columna del equipo
    if (this.tv && this.helpBtn) {
      const h = s === 'team' ? teamLayout(this.tv.view, this.tv.k).frame.help : menuFrame(this.tv.view, this.tv.k).help;
      this.helpBtn.setPosition(h.x + h.w - 4, h.y + h.h / 2);
      growHit(this.helpBtn, h);
    }
    if (s === 'maps') this.buildMaps();
    else if (s === 'levels') this.buildLevels();
    else this.buildTeam();
  }

  // --- Cómo se juega ---

  private openHelp() {
    if (this.help || this.data?.get('leaving')) return;
    const box = this.add.container(0, 0).setDepth(200);
    const dim = this.add.rectangle(480, 320, 4000, 4000, 0x000000, 0.7).setInteractive();
    const g = this.add.graphics();
    drawBox(g, 90, 60, 780, 520, { radius: 16 });
    const head = this.add.text(480, 92, '', { fontFamily: UI.FONT, fontSize: '28px', fontStyle: 'bold', color: NAVY }).setOrigin(0.5);
    const body = this.add.text(130, 140, '', { fontFamily: UI.FONT, fontSize: '19px', color: NAVY, wordWrap: { width: 700 }, lineSpacing: 10 });
    const foot = this.add.text(480, 556, '', { fontFamily: UI.FONT, fontSize: '15px', color: '#4a5578' }).setOrigin(0.5);
    const mk = (x: number, label: string, d: number) => {
      const b = this.add.text(x, 92, label, { fontFamily: UI.FONT, fontSize: '28px', fontStyle: 'bold', color: NAVY }).setOrigin(0.5).setPadding(10, 4).setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => this.helpPage(d));
      return b;
    };
    const close = this.add.text(850, 76, '✕', { fontFamily: UI.FONT, fontSize: '26px', color: NAVY }).setOrigin(0.5).setPadding(8, 4).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.closeHelp());
    const prevB = mk(130, '◀', -1);
    const nextB = mk(830, '▶', 1);
    // Táctil: ◀ ▶ y ✕ con zona de toque de un botón (≥ 56 px CSS)
    if (this.tv) {
      const b = menuUnits(this.tv.k).btn;
      for (const t of [prevB, nextB, close]) growHit(t, { x: t.x - b / 2, y: t.y - b / 2, w: b, h: b });
    }
    box.add([dim, g, head, body, foot, prevB, nextB, close]);
    const h = { box, page: 0, draw: () => {} };
    h.draw = () => {
      const p = TD_GUIDE[h.page];
      head.setText(p.title);
      body.setText(p.lines.map((l) => `• ${l}`).join('\n'));
      foot.setText(`Página ${h.page + 1} de ${TD_GUIDE.length} · Izquierda/derecha, Q/E, LB/RB o ◀ ▶: cambiar · Esc, B, Enter o A: cerrar`);
    };
    this.help = h;
    h.draw();
  }

  private helpPage(d: number) {
    if (!this.help) return;
    this.help.page = (this.help.page + d + TD_GUIDE.length) % TD_GUIDE.length;
    this.help.draw();
  }

  private closeHelp() {
    this.help?.box.destroy();
    this.help = null;
  }

  private goBack() {
    if (this.stage === 'team') return this.showStage('levels');
    if (this.stage === 'levels') return this.showStage('maps');
    goTo(this, 'Mode', { select: 'towerdef' });
  }

  private title(text: string, sub?: string) {
    if (this.tv) {
      // Táctil: en la fila de arriba, entre Volver y la ayuda
      const tv = this.tv;
      const r = this.stage === 'team' ? teamLayout(tv.view, tv.k).frame.title : menuFrame(tv.view, tv.k).title;
      const u = menuUnits(tv.k);
      const t = this.add.text(r.x + r.w / 2, r.y + (sub ? r.h * 0.32 : r.h / 2), text, { fontFamily: UI.FONT, fontSize: `${u.title}px`, color: '#ffffff', align: 'center' }).setOrigin(0.5).setStroke('#18202c', 6);
      fitTextIn(t, r.w, sub ? r.h * 0.6 : r.h, u.title, u.fontMin);
      this.layer.add(t);
      if (sub) {
        const st = this.add.text(r.x + r.w / 2, r.y + r.h * 0.78, sub, { fontFamily: UI.FONT, fontSize: `${u.fontMin}px`, color: '#ffe9a8', align: 'center' }).setOrigin(0.5).setStroke('#18202c', 4);
        fitTextIn(st, r.w, r.h * 0.42, u.fontMin, Math.ceil(u.fontMin * 0.8));
        this.layer.add(st);
      }
      return;
    }
    const t = this.add.text(480, 50, text, { fontFamily: UI.FONT, fontSize: '32px', color: '#ffffff' }).setOrigin(0.5).setStroke('#18202c', 6);
    this.layer.add(t);
    if (sub) this.layer.add(this.add.text(480, 80, sub, { fontFamily: UI.FONT, fontSize: '16px', color: '#ffe9a8' }).setOrigin(0.5).setStroke('#18202c', 4));
  }

  private hint(text: string) {
    // Táctil: sin barra de teclas (todo se toca)
    if (this.tv) return;
    // Teclas dibujadas en pixel art; con mando se esconde (la barra del mando ya lo dice)
    const pc = text.replace(/ o cruceta/g, '').replace(/Flechas\/cruceta/g, 'Flechas').replace(/, clic o A/g, ' o clic').replace(/Enter\/A/g, 'Enter')
      .replace(/Esc, B o /g, 'Esc o ').replace(/Q\/E, LB\/RB/g, 'Q/E');
    this.layer.add(addHelpBar(this, 480, 622, pc, { fontSize: 14, color: '#ffffff' }).setAlpha(0.85));
  }

  // --- Mapas ---

  private buildMaps() {
    if (this.tv) return this.buildMapsTouch(this.tv);
    const total = TD_MAPS.length;
    this.title('Defensa de torres', `${TD_MAPS.filter((_, i) => isMapUnlocked(this.progress, i)).length}/${total} mapas abiertos`);
    // 4 columnas; con más de 16 mapas (18: una fase por tipo) las fichas se encogen para que quepan 5 filas
    const cw = 214;
    const compact = total > 16;
    const ch = compact ? 96 : 118;
    const x0 = 52;
    const y0 = 98;
    // Posiciones dentro de la ficha (miniatura más pequeña en modo compacto)
    const cell = compact ? 4 : 5;
    const L = compact ? { thumbY: 28, stars: 50, bar: 66, inf: 74, icons: 82, lock: 48 } : { thumbY: 30, stars: 63, bar: 84, inf: 94, icons: 102, lock: 57 };
    const cards: { g: Phaser.GameObjects.Graphics; i: number }[] = [];
    TD_MAPS.forEach((m, i) => {
      const cx = x0 + (i % 4) * cw;
      const cy = y0 + Math.floor(i / 4) * (ch + 4);
      const open = isMapUnlocked(this.progress, i);
      const g = this.add.graphics();
      const thumb = this.add.graphics();
      drawMapThumb(thumb, m, biomeById(m.biome).colors, cx + 12, cy + L.thumbY, cell, !open);
      const name = this.add.text(cx + 12, cy + (compact ? 7 : 10), `${i + 1}. ${m.name}`, { fontFamily: UI.FONT, fontSize: compact ? '15px' : '16px', fontStyle: 'bold', color: NAVY });
      const cleared = levelsCleared(this.progress, m.id);
      const info = this.add.text(cx + (compact ? 86 : 100), cy + (compact ? 28 : 32), open ? `Niveles ${cleared}/${m.levels}\n${mapStars(this.progress, m.id)}/${m.levels * 3}` : `Supera ${levelsNeeded(TD_MAPS[i - 1]?.levels ?? 0)}\nniveles del\nmapa ${i}`, {
        fontFamily: UI.FONT, fontSize: compact ? '12px' : '13px', color: open ? NAVY : '#6a7080', lineSpacing: compact ? 0 : 2,
      });
      const ix = cx + (compact ? 86 : 100);
      const parts: Phaser.GameObjects.GameObject[] = [g, thumb, name, info];
      // Tipos tema del mapa (el suyo primero) debajo de la miniatura
      themesOf(m).forEach((ty, k) => parts.push(typeIcon(this, cx + 21 + k * 22, cy + L.icons, ty, compact ? 1.4 : 1.6).setAlpha(open ? 1 : 0.5)));
      // Dentro de la ficha (ancho cw − 8): el nombre a lo ancho y los datos a la derecha de la miniatura
      fitTextLine(name, cw - 8 - 22, 10);
      if (open) {
        info.setText(`Niveles ${cleared}/${m.levels}`);
        fitTextLine(info, cx + cw - 8 - 6 - ix, 9);
        // Con letra de móvil las líneas de la ficha compacta (96 px) se pisaban: cada una cabe en su franja
        const capH = (t: Phaser.GameObjects.Text, h: number) => t.setScale(Math.min(t.scaleX, h / Math.max(1, t.height)));
        capH(info, L.stars - 9 - (compact ? 28 : 32));
        const star = tdIcon(this, ix + 8, cy + L.stars, 'star', 1.8);
        parts.push(star);
        // La cifra empieza donde acaba la estrella (antes la estrella tapaba el primer número)
        const sx = Math.max(ix + 20, star.x + star.displayWidth / 2 + 3);
        parts.push(capH(fitTextLine(this.add.text(sx, cy + L.stars, `${mapStars(this.progress, m.id)}/${m.levels * 3}`, { fontFamily: UI.FONT, fontSize: '13px', color: NAVY }).setOrigin(0, 0.5), cx + cw - 8 - 6 - sx, 9), 2 * (L.bar - 2 - L.stars)));
        // Barra de niveles superados
        const bar = this.add.graphics();
        const bw = compact ? 110 : 98;
        bar.fillStyle(0x18202c, 1).fillRect(ix, cy + L.bar, bw, 8);
        bar.fillStyle(cleared >= m.levels ? 0xffd34d : 0x2ecc71, 1).fillRect(ix + 1, cy + L.bar + 1, ((bw - 2) * cleared) / m.levels, 6);
        parts.push(bar);
        if (isEndlessUnlocked(this.progress, m.id)) parts.push(capH(this.add.text(ix, cy + L.inf, '∞ abierto', { fontFamily: UI.FONT, fontSize: '12px', color: '#b8860b' }), ch - 7 - L.inf));
      } else {
        parts.push(tdIcon(this, cx + (compact ? 44 : 52), cy + L.lock, 'lock', compact ? 2.4 : 3));
      }
      const zone = this.add.zone(cx, cy, cw - 8, ch).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        this.mapSel = i;
        this.redraw();
      });
      zone.on('pointerdown', () => this.pickMap(i));
      parts.push(zone);
      this.layer.add(parts);
      cards.push({ g, i });
    });
    this.redraw = () => {
      for (const { g, i } of cards) {
        g.clear();
        const cx = x0 + (i % 4) * cw;
        const cy = y0 + Math.floor(i / 4) * (ch + 4);
        drawBox(g, cx, cy, cw - 8, ch, { selected: i === this.mapSel, fill: isMapUnlocked(this.progress, i) ? undefined : 0xc8ccd4 });
      }
    };
    this.redraw();
    this.hint('Flechas o cruceta: elegir mapa · Enter, clic o A: entrar · Esc, B o «Volver»: modos');
  }

  /** Táctil: las 18 fichas con todo el ancho (≥ 56 px CSS de alto); si no caben, por páginas con flechas. */
  private buildMapsTouch(tv: { k: number; view: Rect }) {
    const total = TD_MAPS.length;
    this.title('Defensa de torres', `${TD_MAPS.filter((_, i) => isMapUnlocked(this.progress, i)).length}/${total} mapas abiertos`);
    const L = mapsLayout(total, tv.view, tv.k);
    const u = menuUnits(tv.k);
    this.mapGrid = L.grid;
    this.mapCols = L.grid.cols;
    const per = L.grid.perPage;
    const page = Math.floor(this.mapSel / per);
    const cards: { g: Phaser.GameObjects.Graphics; i: number; r: Rect }[] = [];
    for (let i = page * per; i < Math.min(total, (page + 1) * per); i++) {
      const m = TD_MAPS[i];
      const r = gridCell(L.grid, i);
      const open = isMapUnlocked(this.progress, i);
      const pad = u.pad * 0.6;
      const g = this.add.graphics();
      const name = this.add.text(r.x + pad, r.y + pad, `${i + 1}. ${m.name}`, { fontFamily: UI.FONT, fontSize: `${u.font}px`, fontStyle: 'bold', color: NAVY });
      fitTextIn(name, r.w - pad * 2, r.h * 0.42, u.font, u.fontMin);
      const top = name.y + name.height + pad * 0.5;
      // Miniatura a la izquierda (casilla entera de al menos 2 px) y datos a la derecha
      const cell = Math.max(2, Math.floor(Math.min((r.w * 0.46) / 16, (r.y + r.h - pad - top) / 11)));
      const thumb = this.add.graphics();
      drawMapThumb(thumb, m, biomeById(m.biome).colors, r.x + pad, top, cell, !open);
      const ix = r.x + pad * 2 + cell * 16;
      const iw = r.x + r.w - pad - ix;
      const parts: Phaser.GameObjects.GameObject[] = [g, thumb, name];
      const cleared = levelsCleared(this.progress, m.id);
      const k = u.fontMin / 13;
      if (open) {
        const t = this.add.text(ix, top, `Niveles ${cleared}/${m.levels}`, { fontFamily: UI.FONT, fontSize: `${u.fontMin}px`, color: NAVY });
        fitTextIn(t, iw, u.fontMin * 1.4, u.fontMin, u.fontMin * 0.8);
        const sy = t.y + t.height + u.fontMin * 0.6;
        parts.push(t, tdIcon(this, ix + 8 * k, sy, 'star', 1.8 * k));
        parts.push(this.add.text(ix + 20 * k, sy, `${mapStars(this.progress, m.id)}/${m.levels * 3}`, { fontFamily: UI.FONT, fontSize: `${u.fontMin}px`, color: NAVY }).setOrigin(0, 0.5));
        if (isEndlessUnlocked(this.progress, m.id)) parts.push(this.add.text(ix, sy + u.fontMin * 0.8, 'Infinito abierto', { fontFamily: UI.FONT, fontSize: `${u.fontMin}px`, color: '#b8860b' }));
      } else {
        parts.push(tdIcon(this, ix + 12 * k, top + 14 * k, 'lock', 2.4 * k));
        const t = this.add.text(ix, top + 30 * k, `Supera ${levelsNeeded(TD_MAPS[i - 1]?.levels ?? 0)} niveles del mapa ${i}`, { fontFamily: UI.FONT, fontSize: `${u.fontMin}px`, color: '#6a7080' });
        fitTextIn(t, iw, r.y + r.h - pad - (top + 30 * k), u.fontMin, u.fontMin * 0.75);
        parts.push(t);
      }
      const zone = this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        this.mapSel = i;
        this.redraw();
      });
      zone.on('pointerdown', () => this.pickMap(i));
      parts.push(zone);
      this.layer.add(parts);
      cards.push({ g, i, r });
    }
    // Páginas: flechas grandes a los lados
    if (L.prev && L.next && L.grid.pages > 1) {
      const pages = L.grid.pages;
      const arrow = (r: Rect, label: string, d: number) => {
        const g = this.add.graphics();
        drawBox(g, r.x, r.y, r.w, r.h, { radius: 10 });
        const t = this.add.text(r.x + r.w / 2, r.y + r.h / 2, label, { fontFamily: UI.FONT, fontSize: `${u.title}px`, color: NAVY }).setOrigin(0.5);
        const z = this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive({ useHandCursor: true });
        z.on('pointerdown', () => {
          const np = (page + d + pages) % pages;
          this.mapSel = Math.min(total - 1, np * per);
          this.showStage('maps');
        });
        this.layer.add([g, t, z]);
      };
      arrow(L.prev, '◀', -1);
      arrow(L.next, '▶', 1);
    }
    this.redraw = () => {
      for (const { g, i, r } of cards) {
        g.clear();
        drawBox(g, r.x, r.y, r.w, r.h, { selected: i === this.mapSel, fill: isMapUnlocked(this.progress, i) ? undefined : 0xc8ccd4 });
      }
    };
    this.redraw();
  }

  private pickMap(i: number) {
    if (!isMapUnlocked(this.progress, i)) {
      this.toasts.show(`Mapa cerrado: supera ${levelsNeeded(TD_MAPS[i - 1].levels)} niveles de «${TD_MAPS[i - 1].name}»`, { kind: 'warning', icon: 'key' });
      return;
    }
    this.mapSel = i;
    this.levelSel = Math.min(TD_MAPS[i].levels - 1, levelsCleared(this.progress, TD_MAPS[i].id));
    this.showStage('levels');
  }

  // --- Niveles ---

  private buildLevels() {
    if (this.tv) return this.buildLevelsTouch(this.tv);
    const m = TD_MAPS[this.mapSel];
    const mp = mapProgress(this.progress, m.id);
    this.title(m.name, `${biomeById(m.biome).name} · ${m.desc}`);
    // Rejilla de LEVEL_COLS columnas: 2 filas con 10 niveles y 3 con 15 (todo cabe encima del infinito)
    const L = m.levels;
    const boxes: { g: Phaser.GameObjects.Graphics; i: number; x: number; y: number; w: number; h: number }[] = [];
    for (let i = 0; i < L; i++) {
      const { x, y, w: bw0, h: bh } = levelBox(i);
      const bw = bw0 + 10;
      const open = isLevelUnlocked(this.progress, this.mapSel, i + 1);
      const g = this.add.graphics();
      const parts: Phaser.GameObjects.GameObject[] = [g];
      const mid = x + (bw - 10) / 2;
      parts.push(this.add.text(mid, y + 15, `Nivel ${i + 1}`, { fontFamily: UI.FONT, fontSize: '17px', fontStyle: 'bold', color: open ? NAVY : '#6a7080' }).setOrigin(0.5));
      // Tipo tema del nivel (themes.ts): su insignia arriba a la izquierda
      parts.push(typeIcon(this, x + 16, y + 15, levelTheme(m, i + 1), 1.8).setAlpha(open ? 1 : 0.55));
      if (open) {
        for (let s = 0; s < 3; s++) parts.push(tdIcon(this, mid + (s - 1) * 24, y + 38, s < mp.stars[i] ? 'star' : 'starOff', 2));
        parts.push(this.add.text(mid, y + 60, `${wavesInLevel(i + 1, L)} oleadas + jefe${i === L - 1 ? ' final' : ''}`, { fontFamily: UI.FONT, fontSize: '12px', color: NAVY }).setOrigin(0.5));
      } else parts.push(tdIcon(this, mid, y + 46, 'lock', 2.4));
      if (i === L - 1) parts.push(tdIcon(this, x + bw - 24, y + 14, 'skull', 2));
      const zone = this.add.zone(x, y, bw - 10, bh).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        this.levelSel = i;
        this.redraw();
      });
      zone.on('pointerdown', () => this.pickLevel(i));
      parts.push(zone);
      this.layer.add(parts);
      boxes.push({ g, i, x, y, w: bw - 10, h: bh });
    }
    // Infinito
    const ex = 72;
    const ey = LEVEL_GRID_BOTTOM;
    const ew = 806;
    const eg = this.add.graphics();
    const endlessOpen = isEndlessUnlocked(this.progress, m.id);
    this.layer.add(eg);
    this.layer.add(
      this.add
        .text(ex + ew / 2, ey + 30, endlessOpen ? `Modo infinito · Récord: oleada ${mp.endless}` : `Modo infinito · supera los ${L} niveles para abrirlo`, {
          fontFamily: UI.FONT, fontSize: '20px', fontStyle: 'bold', color: endlessOpen ? NAVY : '#6a7080',
        })
        .setOrigin(0.5),
    );
    if (!endlessOpen) this.layer.add(tdIcon(this, ex + 30, ey + 30, 'lock', 2.6));
    const ez = this.add.zone(ex, ey, ew, 60).setOrigin(0).setInteractive({ useHandCursor: true });
    ez.on('pointerover', () => {
      this.levelSel = L;
      this.redraw();
    });
    ez.on('pointerdown', () => this.pickLevel(L));
    this.layer.add(ez);
    boxes.push({ g: eg, i: L, x: ex, y: ey, w: ew, h: 60 });
    // Descripción del nivel elegido
    const info = this.add.text(480, 470, '', { fontFamily: UI.FONT, fontSize: '17px', color: '#ffffff', align: 'center', wordWrap: { width: 800 } }).setOrigin(0.5, 0).setStroke('#18202c', 4);
    this.layer.add(info);
    // Tipo tema del nivel elegido: insignia y bonus (debajo de la descripción, sin pisar la barra de ayuda)
    const themeText = this.add.text(494, 0, '', { fontFamily: UI.FONT, fontSize: '14px', color: '#ffe9a8', align: 'center', wordWrap: { width: 740 } }).setOrigin(0.5, 0).setStroke('#18202c', 4);
    const themeBadge = typeIcon(this, 0, 0, levelTheme(m, 1), 1.8);
    this.layer.add([themeText, themeBadge]);
    this.redraw = () => {
      for (const b of boxes) {
        b.g.clear();
        const open = b.i === L ? endlessOpen : isLevelUnlocked(this.progress, this.mapSel, b.i + 1);
        drawBox(b.g, b.x, b.y, b.w, b.h, { selected: b.i === this.levelSel, fill: open ? undefined : 0xc8ccd4 });
      }
      const i = this.levelSel;
      info.setText(
        i === L
          ? `Oleadas sin fin cada vez más duras. Guarda tu mejor oleada.\n${levelFoesLine(m, 0)}`
          : `Nivel ${i + 1} de ${L} · ${wavesInLevel(i + 1, L)} oleadas y jefe ${i === L - 1 ? 'final' : 'legendario'} · 3 estrellas con el 90 % de la base\n${levelFoesLine(m, i + 1)}\nMapa: ${variantSummary(m, i + 1)}`,
      );
      const theme = levelTheme(m, i === L ? 0 : i + 1);
      themeText.setText(`${themeSummary(theme)}\n${levelHint(theme, i === L ? L : i + 1)}`).setY(info.y + info.height + 6);
      themeBadge.setTexture(typeIconKey(theme)).setPosition(themeText.x - themeText.width / 2 - 16, themeText.y + 9);
    };
    this.redraw();
    this.hint('Flechas o cruceta: elegir nivel · Enter, clic o A: elegir equipo · Esc, B o «Volver»: mapas');
  }

  /** Táctil: niveles e infinito en una rejilla de fichas ≥ 56 px CSS y, a la derecha, lo que trae el nivel elegido. */
  private buildLevelsTouch(tv: { k: number; view: Rect }) {
    const m = TD_MAPS[this.mapSel];
    const mp = mapProgress(this.progress, m.id);
    this.title(m.name, `${biomeById(m.biome).name} · ${m.desc}`);
    const L = m.levels;
    const lay = levelsLayout(L + 1, tv.view, tv.k);
    const u = menuUnits(tv.k);
    this.levelCols = lay.grid.cols;
    const endlessOpen = isEndlessUnlocked(this.progress, m.id);
    const boxes: { g: Phaser.GameObjects.Graphics; i: number; r: Rect }[] = [];
    const k = u.fontMin / 12;
    for (let i = 0; i <= L; i++) {
      const r = gridCell(lay.grid, i);
      const endless = i === L;
      const open = endless ? endlessOpen : isLevelUnlocked(this.progress, this.mapSel, i + 1);
      const g = this.add.graphics();
      const parts: Phaser.GameObjects.GameObject[] = [g];
      const mid = r.x + r.w / 2;
      const head = this.add.text(mid, r.y + r.h * 0.22, endless ? 'Infinito' : `Nivel ${i + 1}`, { fontFamily: UI.FONT, fontSize: `${u.font}px`, fontStyle: 'bold', color: open ? NAVY : '#6a7080' }).setOrigin(0.5);
      fitTextIn(head, r.w - u.pad, r.h * 0.4, u.font, u.fontMin);
      parts.push(head);
      if (!endless) parts.push(typeIcon(this, r.x + 14 * k, r.y + 14 * k, levelTheme(m, i + 1), 1.6 * k).setAlpha(open ? 1 : 0.55));
      if (open && !endless) {
        for (let q = 0; q < 3; q++) parts.push(tdIcon(this, mid + (q - 1) * 22 * k, r.y + r.h * 0.52, q < mp.stars[i] ? 'star' : 'starOff', 1.8 * k));
        const w = this.add.text(mid, r.y + r.h * 0.8, `${wavesInLevel(i + 1, L)} oleadas`, { fontFamily: UI.FONT, fontSize: `${u.fontMin}px`, color: NAVY }).setOrigin(0.5);
        fitTextIn(w, r.w - u.pad, r.h * 0.3, u.fontMin, u.fontMin * 0.8);
        parts.push(w);
      } else if (endless && open) {
        const w = this.add.text(mid, r.y + r.h * 0.66, `Récord: oleada ${mp.endless}`, { fontFamily: UI.FONT, fontSize: `${u.fontMin}px`, color: NAVY, align: 'center' }).setOrigin(0.5);
        fitTextIn(w, r.w - u.pad, r.h * 0.5, u.fontMin, u.fontMin * 0.75);
        parts.push(w);
      } else parts.push(tdIcon(this, mid, r.y + r.h * 0.62, 'lock', 2.2 * k));
      if (i === L - 1) parts.push(tdIcon(this, r.x + r.w - 14 * k, r.y + 14 * k, 'skull', 1.8 * k));
      const zone = this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        this.levelSel = i;
        this.redraw();
      });
      zone.on('pointerdown', () => this.pickLevel(i));
      parts.push(zone);
      this.layer.add(parts);
      boxes.push({ g, i, r });
    }
    const I = lay.info;
    const info = this.add.text(I.x + u.pad, I.y + u.pad, '', { fontFamily: UI.FONT, fontSize: `${u.fontMin}px`, color: '#ffffff', wordWrap: { width: I.w - u.pad * 2 }, lineSpacing: 2 }).setStroke('#18202c', 4);
    const themeText = this.add.text(I.x + u.pad + 22 * k, 0, '', { fontFamily: UI.FONT, fontSize: `${u.fontMin}px`, color: '#ffe9a8', wordWrap: { width: I.w - u.pad * 2 - 22 * k } }).setStroke('#18202c', 4);
    const themeBadge = typeIcon(this, 0, 0, levelTheme(m, 1), 1.6 * k);
    const infoBg = this.add.graphics();
    this.layer.add([infoBg, info, themeText, themeBadge]);
    this.redraw = () => {
      for (const b of boxes) {
        b.g.clear();
        const open = b.i === L ? endlessOpen : isLevelUnlocked(this.progress, this.mapSel, b.i + 1);
        drawBox(b.g, b.r.x, b.r.y, b.r.w, b.r.h, { selected: b.i === this.levelSel, fill: open ? undefined : 0xc8ccd4 });
      }
      const i = this.levelSel;
      info.setText(
        i === L
          ? `Oleadas sin fin cada vez más duras. Guarda tu mejor oleada.${endlessOpen ? '' : `\nSupera los ${L} niveles para abrirlo.`}\n${levelFoesLine(m, 0)}`
          : `Nivel ${i + 1} de ${L} · ${wavesInLevel(i + 1, L)} oleadas y jefe ${i === L - 1 ? 'final' : 'legendario'} · 3 estrellas con el 90 % de la base\n${levelFoesLine(m, i + 1)}\nMapa: ${variantSummary(m, i + 1)}`,
      );
      const theme = levelTheme(m, i === L ? 0 : i + 1);
      themeText.setText(`${themeSummary(theme)}\n${levelHint(theme, i === L ? L : i + 1)}`);
      // Que todo quepa en su columna: baja la letra de los dos textos a la vez
      for (let fs = u.font; fs >= Math.round(u.fontMin * 0.8); fs--) {
        info.setFontSize(fs);
        themeText.setFontSize(fs);
        themeText.setY(info.y + info.height + u.pad);
        if (themeText.y + themeText.height <= I.y + I.h - u.pad) break;
      }
      themeBadge.setTexture(typeIconKey(theme)).setPosition(I.x + u.pad + 10 * k, themeText.y + 10 * k);
      infoBg.clear();
      infoBg.fillStyle(0x18202c, 0.55).fillRect(I.x, I.y, I.w, I.h);
    };
    this.redraw();
  }

  private pickLevel(i: number) {
    const m = TD_MAPS[this.mapSel];
    const open = i === m.levels ? isEndlessUnlocked(this.progress, m.id) : isLevelUnlocked(this.progress, this.mapSel, i + 1);
    if (!open) {
      this.toasts.show(i === m.levels ? `Supera los ${m.levels} niveles para abrir el infinito` : 'Supera antes el nivel anterior', { kind: 'warning', icon: 'key' });
      return;
    }
    this.levelSel = i;
    this.showStage('team');
  }

  // --- Equipo ---

  private buildTeam() {
    const m = TD_MAPS[this.mapSel];
    const lvText = this.levelSel === m.levels ? 'Infinito' : `Nivel ${this.levelSel + 1}`;
    this.title('Elige tu equipo', `${m.name} · ${lvText} · hasta ${TEAM_MAX} Pokémon de tu colección`);
    this.zone = 'grid';
    this.teamSel = 0;
    this.page = 0;
    this.filters = { ...NO_FILTERS };
    const loadingText = this.add.text(300, 300, 'Cargando tu colección…', { fontFamily: UI.FONT, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setStroke('#18202c', 4);
    this.layer.add(loadingText);
    this.loading = true;
    void this.loadOwned().then(() => {
      if (!this.scene.isActive() || this.stage !== 'team') return;
      this.loading = false;
      loadingText.destroy();
      this.layoutTeam();
    });
  }

  private async loadOwned() {
    const ids = loadUnlocked();
    let index: SpeciesFact[] = [];
    try {
      index = await loadCollectionIndex();
    } catch {
      index = [];
    }
    const byId = new Map(index.map((s) => [s.id, s]));
    this.owned = ids
      .map((id) => {
        const s = byId.get(id);
        return { id, name: s?.nameEs ?? s?.name ?? `#${id}`, types: s?.types ?? ['normal'], rarity: s ? classifyRarity(s) : 'common', bst: s?.bst ?? 420 } as TdPick;
      })
      .sort((a, b) => b.bst - a.bst);
    // Sin Pokémon (o invitado sin colección): el equipo de prueba
    this.trial = this.owned.length === 0;
    let last: number[] = [];
    try {
      const raw = activeStorage()?.getItem(TEAM_KEY);
      if (raw) last = (JSON.parse(raw) as unknown[]).filter((n): n is number => typeof n === 'number');
    } catch {
      last = [];
    }
    if (this.keepPicks) {
      last = this.keepPicks;
      this.keepPicks = null;
    }
    const fromLast = last.map((id) => this.owned.find((o) => o.id === id)).filter((o): o is TdPick => !!o);
    this.team = (fromLast.length ? fromLast : this.owned.slice(0, TEAM_MAX)).slice(0, TEAM_MAX);
    // Sprites de la colección (y del equipo de prueba)
    const all = [...this.owned, ...TRIAL_TEAM.map((t) => ({ id: t.id }))];
    let queued = 0;
    for (const o of all) {
      if (this.textures.exists(tdMonKey(o.id))) continue;
      this.load.image(tdMonKey(o.id), spriteUrl(o.id));
      queued++;
    }
    if (queued) {
      await new Promise<void>((res) => {
        this.load.once(Phaser.Loader.Events.COMPLETE, () => res());
        this.load.start();
      });
    }
  }

  private trialPicks(): TdPick[] {
    return TRIAL_TEAM.map((t) => ({ id: t.id, name: t.name, types: [...t.types], rarity: t.rarity, bst: 300 }));
  }

  /** Lista que se ve en la rejilla: filtrada y ordenada (o el equipo de prueba). */
  private viewList(): TdPick[] {
    if (this.trial) return this.trialPicks();
    return sortPicks(filterPicksBy(this.owned, this.filters, new Set(this.team.map((t) => t.id))), this.sort);
  }

  private cursor(): GridCursor {
    const c = clampCursor({ page: this.page, idx: this.teamSel }, this.viewList().length, this.grid);
    this.page = c.page;
    this.teamSel = c.idx;
    return c;
  }

  private setCursor(c: GridCursor) {
    this.page = c.page;
    this.teamSel = c.idx;
  }

  private cycleBar(which: number, d: number) {
    if (this.trial) return;
    if (which === BAR_CLASS) this.filters = { ...this.filters, cls: cycle(classFilterOptions(this.owned), this.filters.cls, d) };
    else if (which === BAR_TYPE) this.filters = { ...this.filters, tipo: cycle(typeFilterOptions(this.owned), this.filters.tipo, d) };
    else if (which === BAR_SORT) this.sort = cycle(SORT_KEYS, this.sort, d);
    else this.filters = { ...NO_FILTERS };
    this.setCursor({ page: 0, idx: 0 });
    this.redraw();
  }

  private layoutTeam() {
    bakeClassIcons(this);
    // Táctil: [información][colección][equipo] con todo pulsable ≥ 56 px CSS (touchMenu.ts teamLayout)
    const T: TeamTouchLayout | null = this.tv ? teamLayout(this.tv.view, this.tv.k, TEAM_MAX) : null;
    const u = this.tv ? menuUnits(this.tv.k) : null;
    this.grid = T ? { cols: T.grid.cols, rows: T.grid.rows } : GRID;
    const COLS_ = this.grid.cols;
    const PER = this.grid.cols * this.grid.rows;
    const inner = T ? T.grid.w : 72;
    const cell = T ? T.grid.w + T.grid.gap : 78;
    const x0 = T ? T.grid.area.x : 40;
    const y0 = T ? T.grid.area.y : 126;
    /** Escala de lo que va dentro de una casilla de la colección (72 = la de escritorio). */
    const ck = inner / 72;
    const grid = this.add.container(0, 0);
    this.layer.add(grid);
    const sel = this.add.graphics().setDepth(2);
    this.layer.add(sel);
    // Barra de filtro y orden (arriba de la rejilla)
    const barG = this.add.graphics();
    this.layer.add(barG);
    // Clase · Tipo · Orden · «Todos» (quita los filtros de golpe)
    const barW = inner + cell * 5;
    const bars = T
      ? T.bars
      : [
          { x: x0, y: 98, w: 150, h: 24 },
          { x: x0 + 156, y: 98, w: 150, h: 24 },
          { x: x0 + 312, y: 98, w: 92, h: 24 },
          { x: x0 + 410, y: 98, w: barW - 410, h: 24 },
        ];
    const barTexts = bars.map((b, i) => {
      const t = this.add.text(b.x + b.w / 2, b.y + b.h / 2, '', { fontFamily: UI.FONT, fontSize: `${u ? u.font : 14}px`, color: NAVY, fontStyle: 'bold', align: 'center' }).setOrigin(0.5);
      if (u) t.setWordWrapWidth(b.w - u.pad);
      const z = this.add.zone(b.x, b.y, b.w, b.h).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => { this.zone = 'bar'; this.barSel = i; this.redraw(false); });
      z.on('pointerdown', (p: Phaser.Input.Pointer) => this.cycleBar(i, p.rightButtonDown() ? -1 : 1));
      this.layer.add([t, z]);
      return t;
    });
    const pageText = T
      ? this.add.text(T.pageText.x + T.pageText.w / 2, T.pageText.y + T.pageText.h / 2, '', { fontFamily: UI.FONT, fontSize: `${u!.fontMin}px`, color: '#ffe9a8', align: 'center', wordWrap: { width: T.pageText.w } }).setOrigin(0.5).setStroke('#18202c', 3)
      : this.add.text(x0 + (cell * COLS - 6) / 2, 446, '', { fontFamily: UI.FONT, fontSize: '15px', color: '#ffe9a8' }).setOrigin(0.5).setStroke('#18202c', 3);
    this.layer.add(pageText);
    const arrowAt = (r: Rect | null, x: number, label: string, d: number) => {
      const a = this.add
        .text(r ? r.x + r.w / 2 : x, r ? r.y + r.h / 2 : 446, label, { fontFamily: UI.FONT, fontSize: `${u ? u.title * 1.4 : 24}px`, color: '#ffd34d' })
        .setOrigin(0.5)
        .setStroke('#18202c', 4)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.turnPage(d));
      if (r) growHit(a, r);
      return a;
    };
    const arrows = [arrowAt(T ? T.prev : null, x0 + 14, '◀', -1), arrowAt(T ? T.next : null, x0 + cell * COLS - 20, '▶', 1)];
    this.layer.add(arrows);
    // Aviso previo de emparejamiento (no bloquea): caja bajo la ficha, a la izquierda del botón «¡A jugar!»
    bakeWarnIcons(this);
    const warn = T ? T.warn : { x: x0, y: 538, w: 520, h: 64 };
    // Táctil: icono del aviso más pequeño (a la izquierda, arriba) y textos con el ancho que queda
    const wk = T ? Math.min(1, (u!.font * 2.2) / 60) * (u!.font / 13) : 1;
    const wIconX = warn.x + (T ? 18 * wk : 30);
    const wTextX = warn.x + (T ? 38 * wk : 60);
    const warnG = this.add.graphics();
    const warnIcon = this.add.image(wIconX, T ? warn.y + 22 * wk : warn.y + warn.h / 2, warnIconKey('justo')).setScale(T ? 2.4 * wk : 3.4);
    const warnTitle = this.add.text(wTextX, warn.y + 7 * wk, '', { fontFamily: UI.FONT, fontSize: `${u ? u.fontMin : 15}px`, fontStyle: 'bold', color: NAVY, wordWrap: { width: warn.x + warn.w - wTextX - 6 } });
    const warnBody = this.add.text(T ? warn.x + 8 : warn.x + 60, warn.y + 26, '', { fontFamily: UI.FONT, fontSize: '13px', color: NAVY, wordWrap: { width: T ? warn.w - 16 : warn.w - 72 }, lineSpacing: 1 });
    this.layer.add([warnG, warnIcon, warnTitle, warnBody]);
    // Ficha de la torre enfocada
    const infoIcon = T ? this.add.image(T.info.x + 4, T.info.y + u!.font, classIconKey('single')).setScale(2 * (u!.font / 15)).setOrigin(0, 0.5) : this.add.image(x0 + 10, 482, classIconKey('single')).setScale(3).setOrigin(0, 0.5);
    const infoText = T
      ? this.add.text(T.info.x + 4, T.info.y + u!.font * 2, '', { fontFamily: UI.FONT, fontSize: `${u!.fontMin}px`, color: '#ffffff', wordWrap: { width: T.info.w - 8 }, lineSpacing: 2 }).setStroke('#18202c', 4)
      : this.add.text(x0 + 46, 464, '', { fontFamily: UI.FONT, fontSize: '15px', color: '#ffffff', wordWrap: { width: 460 }, lineSpacing: 3 }).setStroke('#18202c', 4);
    this.layer.add([infoIcon, infoText]);
    // Columna derecha: el equipo y los botones
    const side = this.add.container(0, 0);
    this.layer.add(side);
    const sideG = this.add.graphics();
    side.add(sideG);
    const startBtn = T ? T.start : { x: 600, y: 470, w: 320, h: 50 };
    const trialBtn = T ? T.trial : { x: 600, y: 530, w: 320, h: 40 };
    const startText = this.add.text(startBtn.x + startBtn.w / 2, startBtn.y + startBtn.h / 2, '¡A jugar!', { fontFamily: UI.FONT, fontSize: `${u ? u.font : 24}px`, fontStyle: 'bold', color: NAVY, align: 'center' }).setOrigin(0.5);
    const trialText = this.add.text(trialBtn.x + trialBtn.w / 2, trialBtn.y + trialBtn.h / 2, '', { fontFamily: UI.FONT, fontSize: `${u ? u.fontMin : 17}px`, color: NAVY, align: 'center' }).setOrigin(0.5);
    if (u) fitTextIn(startText, startBtn.w - u.pad, startBtn.h - u.pad, u.font * 1.2, u.fontMin);
    side.add([startText, trialText]);
    const sz = this.add.zone(startBtn.x, startBtn.y, startBtn.w, startBtn.h).setOrigin(0).setInteractive({ useHandCursor: true });
    sz.on('pointerover', () => { this.zone = 'panel'; this.panelSel = START_FOCUS; this.redraw(false); }).on('pointerdown', () => this.startGame());
    const tz = this.add.zone(trialBtn.x, trialBtn.y, trialBtn.w, trialBtn.h).setOrigin(0).setInteractive({ useHandCursor: true });
    tz.on('pointerover', () => { this.zone = 'panel'; this.panelSel = TRIAL_FOCUS; this.redraw(false); }).on('pointerdown', () => this.toggleTrial());
    side.add([sz, tz]);
    const slotPos = (k: number) => (T ? { sx: T.slots[k].x, sy: T.slots[k].y } : { sx: 616 + (k % 2) * 150, sy: 148 + Math.floor(k / 2) * 98 });
    const slotW = T ? T.slots[0].w : 140;
    const slotH = T ? T.slots[0].h : 90;
    for (let k = 0; k < TEAM_MAX; k++) {
      const { sx, sy } = slotPos(k);
      const z = this.add.zone(sx, sy, slotW, slotH).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => { if (k < this.team.length) { this.zone = 'panel'; this.panelSel = k; this.redraw(false); } });
      z.on('pointerdown', () => { const q = this.team[k]; if (q && !this.trial) this.togglePick(q); });
      side.add(z);
    }
    const slotImgs: Phaser.GameObjects.GameObject[] = [];
    type CellRef = { img: Phaser.GameObjects.Image; fit: number; icon: Phaser.GameObjects.Image; iy: number };
    let cells: CellRef[] = [];
    let focused = -1;

    const paintGrid = () => {
      grid.removeAll(true);
      cells = [];
      focused = -1;
      const lst = this.viewList();
      const c = this.cursor();
      const pagesN = pageCount(lst.length, this.grid);
      pageText.setText(this.trial ? 'Equipo de prueba' : lst.length ? `Página ${c.page + 1}/${pagesN}` : 'Nadie con este filtro');
      if (T && u) fitTextIn(pageText, T.pageText.w - 4, T.pageText.h - 4, u.fontMin, Math.round(u.fontMin * 0.75));
      arrows.forEach((a) => a.setVisible(!this.trial && pagesN > 1));
      const items = lst.slice(c.page * PER, (c.page + 1) * PER);
      const teamIds = new Set(this.team.map((t) => t.id));
      items.forEach((p, k) => {
        const x = x0 + (k % COLS_) * cell;
        const y = y0 + Math.floor(k / COLS_) * cell;
        const g = this.add.graphics();
        const inTeam = !this.trial && teamIds.has(p.id);
        const style = towerStyle(p);
        g.fillStyle(0x18202c, 0.85).fillRect(x, y, inner, inner);
        g.fillStyle(inTeam ? 0x2e5a3a : 0x2a3350, 1).fillRect(x + 3, y + 3, inner - 6, inner - 6);
        // Franja de la clase arriba y de la rareza abajo
        g.fillStyle(CLASS_COLOR[style], 1).fillRect(x + 3, y + 3, inner - 6, 2);
        g.fillStyle(RARITY_COLORS[p.rarity], 1).fillRect(x + 3, y + inner - 7, inner - 6, 4);
        // Sprite encajado en la casilla: nunca más grande que su hueco (ni al enfocarse)
        const key = this.textures.exists(tdMonKey(p.id)) ? tdMonKey(p.id) : tdIconKey('ball');
        const img = this.add.image(x + inner / 2, y + inner / 2 - 4 * ck, key);
        const fit = Math.min((SPRITE_BOX * ck) / img.width, (SPRITE_BOX * ck) / img.height);
        img.setScale(fit);
        const icon = this.add.image(x + 4 * ck, y + 6 * ck, classIconKey(style)).setOrigin(0).setScale(2 * ck);
        const parts: Phaser.GameObjects.GameObject[] = [g, img, icon];
        if (canHitAir(p)) parts.push(this.add.image(x + 24 * ck, y + 7 * ck, classIconKey('air')).setOrigin(0).setScale(1.5 * ck));
        parts.push(this.add.text(x + inner / 2, y + inner - 9 * ck, `${towerCost(p)} $`, { fontFamily: UI.FONT, fontSize: `${u ? u.fontMin : 12}px`, fontStyle: 'bold', color: '#ffe082' }).setOrigin(0.5, 1).setStroke('#18202c', 3));
        if (inTeam) parts.push(this.add.text(x + inner - 4 * ck, y + 3 * ck, '✓', { fontFamily: UI.FONT, fontSize: `${Math.round(16 * ck)}px`, color: '#7cf07a' }).setOrigin(1, 0).setStroke('#18202c', 3));
        const z = this.add.zone(x, y, inner, inner).setOrigin(0).setInteractive({ useHandCursor: true });
        z.on('pointerover', () => {
          this.zone = 'grid';
          this.setCursor({ page: this.page, idx: k });
          this.redraw(false);
        });
        z.on('pointerdown', () => this.togglePick(p));
        parts.push(z);
        grid.add(parts);
        cells.push({ img, fit, icon, iy: icon.y });
      });
    };

    const focusCell = (k: number) => {
      if (k === focused) return;
      const old = cells[focused];
      if (old) {
        this.tweens.killTweensOf([old.img, old.icon]);
        old.img.setScale(old.fit);
        old.icon.setY(old.iy).setScale(2 * ck);
      }
      focused = k;
      const c = cells[k];
      if (!c) return;
      // Crece un poco pero sin pasar de su baldosa (SPRITE_MAX), y el icono de la clase da un saltito
      const grow = Math.min(c.fit * 1.12, (c.fit * SPRITE_MAX) / SPRITE_BOX);
      this.tweens.add({ targets: c.img, scale: grow, duration: 140, ease: 'Back.Out' });
      this.tweens.add({ targets: c.icon, y: c.iy - 2 * ck, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    };

    this.redraw = (repaint = true) => {
      if (repaint) paintGrid();
      const lst = this.viewList();
      const c = this.cursor();
      const items = lst.slice(c.page * PER, (c.page + 1) * PER);
      if (this.zone === 'grid' && !items.length && !this.trial) this.zone = 'bar';
      sel.clear();
      // Barra de filtro y orden
      barG.clear();
      bars.forEach((b, i) => drawBox(barG, b.x, b.y, b.w, b.h, { radius: 6, selected: this.zone === 'bar' && this.barSel === i, fill: this.trial ? 0xc8ccd4 : undefined }));
      if (u) bars.forEach((b, i) => fitTextIn(barTexts[i], b.w - u.pad, b.h - u.pad, u.font, u.fontMin));
      const short = (t: string) => (t.length > 13 ? `${t.slice(0, 12)}.` : t);
      barTexts[BAR_CLASS].setText(`Clase: ${short(filterLabel(this.filters.cls))}`);
      barTexts[BAR_TYPE].setText(this.filters.tipo === 'todos' ? 'Tipo: Todos' : short(filterLabel(this.filters.tipo)));
      barTexts[BAR_SORT].setText(SORT_LABEL[this.sort]);
      barTexts[BAR_RESET].setText('Todos').setAlpha(this.filters.cls === 'todos' && this.filters.tipo === 'todos' ? 0.5 : 1);
      if (u) bars.forEach((b, i) => fitTextIn(barTexts[i], b.w - u.pad, b.h - u.pad, u.font, u.fontMin));
      const ring = (x: number, y: number, w: number, h: number) => {
        sel.lineStyle(3, 0x18202c, 1).strokeRect(x - 3, y - 3, w + 6, h + 6);
        sel.lineStyle(2, 0xffd34d, 1).strokeRect(x - 1, y - 1, w + 2, h + 2);
        sel.lineStyle(1, 0xffffff, 1).strokeRect(x + 1, y + 1, w - 2, h - 2);
      };
      if (this.zone === 'grid' && items.length) {
        ring(x0 + (c.idx % COLS_) * cell, y0 + Math.floor(c.idx / COLS_) * cell, inner, inner);
        focusCell(c.idx);
      } else focusCell(-1);
      const p = this.zone === 'grid' ? items[c.idx] : this.zone === 'panel' && this.panelSel < START_FOCUS ? (this.trial ? this.trialPicks() : this.team)[this.panelSel] : undefined;
      if (p) {
        const style = towerStyle(p);
        const tr = CLASS_TRAITS[style];
        infoIcon.setTexture(classIconKey(style)).setVisible(true);
        infoText.setText(`${p.name} · ${p.types.map(typeNameEs).join('/')} · ${RARITY_LABEL[p.rarity]}\nTorre: ${STYLE_LABEL[style]} · Coste ${towerCost(p)} $ · Alcance ${tr.range} · Daño ${tr.damage}${canHitAir(p) ? ' · Aéreo' : ''}\n${tr.note}`);
        if (T && u) fitTextIn(infoText, T.info.w - 8, warn.y - infoText.y - u.pad, u.fontMin, Math.round(u.fontMin * 0.75));
      } else {
        infoIcon.setVisible(false);
        infoText.setText(this.trial ? 'Equipo de prueba: para probar el modo. Juega con tus Pokémon del gacha para ir más lejos.' : '');
      }
      // Aviso previo: el veredicto cambia al elegir o quitar torres (y con el equipo de prueba)
      {
        const lm = TD_MAPS[this.mapSel];
        const lv = this.levelSel === lm.levels ? 0 : this.levelSel + 1;
        const w = matchupForLevel(lm, lv, (this.trial ? this.trialPicks() : this.team).map((t) => t.types));
        warnG.clear();
        drawBox(warnG, warn.x, warn.y, warn.w, warn.h, { radius: 10, fill: WARN_FILL[w.verdict] });
        warnIcon.setTexture(warnIconKey(w.verdict));
        warnTitle.setText(`${VERDICT_LABEL[w.verdict]} · nivel ${typeNameEs(w.theme)}`).setColor(WARN_TEXT[w.verdict]);
        warnBody.setText(w.tip ? `${w.reason} ${w.tip}` : w.reason).setColor(WARN_TEXT[w.verdict]);
        // Que quepa en su caja aunque salgan muchos tipos: baja la letra hasta que entre
        if (T && u) {
          fitTextIn(warnTitle, warn.x + warn.w - wTextX - 6, u.fontMin * 2.6, u.fontMin, Math.round(u.fontMin * 0.8));
          const top = Math.max(warnTitle.y + warnTitle.height, warnIcon.y + warnIcon.displayHeight / 2) + 4;
          warnBody.setY(top);
          fitTextIn(warnBody, warn.w - 16, warn.y + warn.h - top - 4, u.fontMin, Math.round(u.fontMin * 0.7));
        } else
          for (let fs = 13; fs >= 10; fs--) {
            warnBody.setFontSize(fs);
            if (warnBody.height <= warn.h - 32) break;
          }
      }
      // Equipo
      sideG.clear();
      if (T) {
        const s0 = T.slots[0];
        drawBox(sideG, s0.x - 6, s0.y - 6, T.trial.x + T.trial.w - s0.x + 12, T.trial.y + T.trial.h - s0.y + 12, { radius: 14 });
      } else drawBox(sideG, 600, 104, 320, 352, { radius: 14 });
      slotImgs.forEach((o) => o.destroy());
      slotImgs.length = 0;
      const teamNow = this.trial ? this.trialPicks() : this.team;
      this.panelSel = clampPanel(this.panelSel, teamNow.length);
      if (!T) slotImgs.push(this.add.text(760, 126, `Tu equipo (${teamNow.length}/${TEAM_MAX})`, { fontFamily: UI.FONT, fontSize: '19px', fontStyle: 'bold', color: NAVY }).setOrigin(0.5));
      for (let k = 0; k < TEAM_MAX; k++) {
        const { sx, sy } = slotPos(k);
        const g = this.add.graphics();
        g.fillStyle(0x18202c, 0.15).fillRect(sx, sy, slotW, slotH);
        slotImgs.push(g);
        const q = teamNow[k];
        if (q && T && u) {
          // Táctil: sprite arriba y nombre abajo (la ficha de la izquierda dice el resto al tocarlo)
          g.fillStyle(RARITY_COLORS[q.rarity], 1).fillRect(sx, sy + slotH - 4, slotW, 4);
          const key = this.textures.exists(tdMonKey(q.id)) ? tdMonKey(q.id) : tdIconKey('ball');
          const im = this.add.image(sx + slotW / 2, sy + slotH * 0.38, key);
          im.setScale(Math.min((slotH * 0.62) / im.width, (slotH * 0.62) / im.height));
          slotImgs.push(im);
          const nm = this.add.text(sx + slotW / 2, sy + slotH - 6, shorten(q.name, 10), { fontFamily: UI.FONT, fontSize: `${u.fontMin}px`, fontStyle: 'bold', color: NAVY }).setOrigin(0.5, 1);
          fitTextIn(nm, slotW - 6, u.fontMin * 1.3, u.fontMin, Math.round(u.fontMin * 0.75));
          slotImgs.push(nm);
          slotImgs.push(this.add.text(sx + slotW - 4, sy + 4, `${towerCost(q)} $`, { fontFamily: UI.FONT, fontSize: `${Math.round(u.fontMin * 0.85)}px`, color: NAVY }).setOrigin(1, 0));
          if (this.zone === 'panel' && this.panelSel === k) {
            g.lineStyle(3, 0x18202c, 1).strokeRect(sx - 2, sy - 2, slotW + 4, slotH + 4);
            g.lineStyle(2, 0xffd34d, 1).strokeRect(sx, sy, slotW, slotH);
          }
        } else if (q) {
          const st = towerStyle(q);
          g.fillStyle(RARITY_COLORS[q.rarity], 1).fillRect(sx, sy + 86, 140, 4);
          const key = this.textures.exists(tdMonKey(q.id)) ? tdMonKey(q.id) : tdIconKey('ball');
          const im = this.add.image(sx + 38, sy + 44, key);
          im.setScale(Math.min(72 / im.width, 72 / im.height));
          slotImgs.push(im);
          slotImgs.push(this.add.text(sx + 74, sy + 18, shorten(q.name, 8), { fontFamily: UI.FONT, fontSize: '13px', fontStyle: 'bold', color: NAVY }));
          slotImgs.push(this.add.image(sx + 74, sy + 38, classIconKey(st)).setOrigin(0).setScale(2));
          slotImgs.push(this.add.text(sx + 96, sy + 40, `${towerCost(q)} $`, { fontFamily: UI.FONT, fontSize: '12px', color: NAVY }));
          slotImgs.push(this.add.text(sx + 74, sy + 62, STYLE_LABEL[st], { fontFamily: UI.FONT, fontSize: '11px', color: NAVY }));
          if (this.zone === 'panel' && this.panelSel === k) {
            g.lineStyle(3, 0x18202c, 1).strokeRect(sx - 2, sy - 2, 144, 94);
            g.lineStyle(2, 0xffd34d, 1).strokeRect(sx, sy, 140, 90);
          }
        } else slotImgs.push(this.add.text(sx + slotW / 2, sy + slotH / 2, 'vacío', { fontFamily: UI.FONT, fontSize: `${u ? u.fontMin : 14}px`, color: '#8a90a0' }).setOrigin(0.5));
      }
      slotImgs.forEach((o) => side.add(o));
      side.bringToTop(startText);
      side.bringToTop(trialText);
      side.list.filter((o) => o instanceof Phaser.GameObjects.Zone).forEach((o) => side.bringToTop(o));
      drawBox(sideG, startBtn.x, startBtn.y, startBtn.w, startBtn.h, { selected: this.zone === 'panel' && this.panelSel === START_FOCUS, fill: teamNow.length >= TEAM_MIN ? undefined : 0xc8ccd4 });
      drawBox(sideG, trialBtn.x, trialBtn.y, trialBtn.w, trialBtn.h, { selected: this.zone === 'panel' && this.panelSel === TRIAL_FOCUS });
      trialText.setText(this.trial ? (this.owned.length ? 'Usar mi colección' : 'Sin Pokémon: equipo de prueba') : 'Usar equipo de prueba');
      if (u) fitTextIn(trialText, trialBtn.w - u.pad, trialBtn.h - u.pad, u.fontMin, Math.round(u.fontMin * 0.75));
    };
    this.redraw();
    const guest = accountInfo().mode === 'guest';
    this.hint(
      `Flechas/cruceta: moverse (los bordes cambian de página) · Enter/A: añadir o quitar · Q/E, LB/RB: página · AvPág/RePág: ±5 · F: clase · T: tipo · O: orden · R/X: quitar filtros · En la barra: ◀▶ o LB/RB cambian, ▲ siguiente, B quita · P: ¡A jugar!${guest ? ' · Invitado: no se guarda al cerrar' : ''}`,
    );
  }

  private turnPage(d: number) {
    if (this.trial) return;
    this.zone = 'grid';
    this.setCursor(turnPage(this.cursor(), d, this.viewList().length, this.grid));
    this.redraw();
  }

  private jumpPages(d: number) {
    if (this.trial) return;
    this.zone = 'grid';
    this.setCursor(jumpPage(this.cursor(), d, this.viewList().length, this.grid));
    this.redraw();
  }

  /** LB/RB mantenidos: repiten el paso de página. */
  private padRepeat(): number {
    const pad = this.input.gamepad?.getPad(0);
    const held = pad?.connected ? (pad.buttons[4]?.pressed ? -1 : pad.buttons[5]?.pressed ? 1 : 0) : 0;
    const now = this.time.now;
    if (held !== this.hold.dir) {
      this.hold = { dir: held, next: now + 420 };
      return 0;
    }
    if (held && now >= this.hold.next) {
      this.hold.next = now + 110;
      return held;
    }
    return 0;
  }

  private togglePick(p: TdPick) {
    if (this.trial) return;
    const i = this.team.findIndex((t) => t.id === p.id);
    if (i >= 0) this.team.splice(i, 1);
    else if (this.team.length < TEAM_MAX) this.team.push(p);
    else {
      this.toasts.show(`Máximo ${TEAM_MAX} Pokémon: quita uno antes`, { kind: 'warning' });
      return;
    }
    this.redraw();
  }

  private toggleTrial() {
    if (!this.owned.length) return;
    this.trial = !this.trial;
    this.page = 0;
    this.teamSel = 0;
    this.redraw();
  }

  private startGame() {
    const team = this.trial ? this.trialPicks() : this.team;
    if (team.length < TEAM_MIN) {
      this.toasts.show('Elige al menos un Pokémon', { kind: 'warning' });
      return;
    }
    if (!this.trial) {
      try {
        activeStorage()?.setItem(TEAM_KEY, JSON.stringify(team.map((t) => t.id)));
      } catch {
        // sin almacenamiento
      }
    }
    const level = this.levelSel === TD_MAPS[this.mapSel].levels ? 0 : this.levelSel + 1;
    goTo(this, 'TowerDefense', { mapIdx: this.mapSel, level, team, trial: this.trial } satisfies TowerDefenseData);
  }

  update() {
    if (this.data?.get('leaving')) return;
    const s = this.nav.read();
    const pb = this.pad.read();
    const J = Phaser.Input.Keyboard.JustDown;
    if (this.help) {
      const prev = J(this.keys.Q) || pb.has('LB');
      const next = J(this.keys.E) || pb.has('RB');
      if (s.back || s.ok || J(this.keys.H) || pb.has('Y')) this.closeHelp();
      else if (s.dx || prev || next) this.helpPage(s.dx || (prev ? -1 : 1));
      return;
    }
    if (J(this.keys.H) || pb.has('Y')) return this.openHelp();
    if (s.back && this.stage === 'team' && this.zone === 'bar' && !this.loading) {
      // B/Esc en la barra: primero quita el filtro (Todos de golpe); si no hay ninguno, sale como siempre
      const r = barBack(this.filters, this.barSel);
      if (r.consumed) {
        this.filters = r.f;
        this.setCursor({ page: 0, idx: 0 });
        return this.redraw();
      }
    }
    if (s.back) return this.goBack();
    if (this.stage === 'maps') {
      if (s.dx || s.dy) {
        const n = TD_MAPS.length;
        const before = this.mapGrid ? Math.floor(this.mapSel / this.mapGrid.perPage) : 0;
        this.mapSel = (this.mapSel + s.dx + s.dy * this.mapCols + n) % n;
        // Táctil por páginas: si cambia de página, se rehace
        if (this.mapGrid && Math.floor(this.mapSel / this.mapGrid.perPage) !== before) this.showStage('maps');
        else this.redraw();
      }
      if (s.ok) this.pickMap(this.mapSel);
    } else if (this.stage === 'levels') {
      if (s.dx || s.dy) {
        let i = this.levelSel;
        const L = TD_MAPS[this.mapSel].levels;
        if (this.levelCols) i = Math.max(0, Math.min(L, i + s.dx + s.dy * this.levelCols));
        else if (i === L) {
          if (s.dy < 0) i = Math.max(0, L - LEVEL_COLS);
        } else if (s.dy > 0 && i + LEVEL_COLS >= L) i = L;
        else if (s.dy) i = Math.max(0, Math.min(L - 1, i + s.dy * LEVEL_COLS));
        else i = Math.max(0, Math.min(L - 1, i + s.dx));
        this.levelSel = i;
        this.redraw();
      }
      if (s.ok) this.pickLevel(this.levelSel);
    } else if (!this.loading) this.updateTeam(s, pb);
  }

  private updateTeam(s: ReturnType<NavInput['read']>, pb: Set<PadButton>) {
    const J = Phaser.Input.Keyboard.JustDown;
    const rep = this.padRepeat();
    if (this.zone === 'bar' && !this.trial) {
      // En la barra, LB/RB (y Q/E) cambian el valor del selector enfocado en los dos sentidos
      const d = J(this.keys.Q) || pb.has('LB') ? -1 : J(this.keys.E) || pb.has('RB') ? 1 : 0;
      if (d) return this.cycleBar(this.barSel === BAR_RESET ? BAR_RESET : this.barSel, d);
    } else {
      if (J(this.keys.Q) || pb.has('LB') || rep < 0) return this.turnPage(-1);
      if (J(this.keys.E) || pb.has('RB') || rep > 0) return this.turnPage(1);
    }
    if (J(this.keys.PGUP) || pb.has('LT')) return this.jumpPages(-5);
    if (J(this.keys.PGDN) || pb.has('RT')) return this.jumpPages(5);
    if (J(this.keys.F)) return this.cycleBar(BAR_CLASS, 1);
    if (J(this.keys.T)) return this.cycleBar(BAR_TYPE, 1);
    if (J(this.keys.O)) return this.cycleBar(BAR_SORT, 1);
    if (J(this.keys.R) || pb.has('X')) return this.cycleBar(BAR_RESET, 1);
    if (s.pause) {
      this.zone = 'panel';
      this.panelSel = START_FOCUS;
      return this.redraw(false);
    }
    const lst = this.viewList();
    if (this.zone === 'panel') {
      const team = this.trial ? this.trialPicks() : this.team;
      if (s.dx || s.dy) {
        const f = movePanel(this.panelSel, s.dx, s.dy, team.length);
        if (f < 0) this.zone = lst.length ? 'grid' : 'bar';
        else this.panelSel = f;
        this.redraw(false);
      }
      if (s.ok) {
        if (this.panelSel === START_FOCUS) this.startGame();
        else if (this.panelSel === TRIAL_FOCUS) this.toggleTrial();
        else if (!this.trial && this.team[this.panelSel]) this.togglePick(this.team[this.panelSel]);
      }
    } else if (this.zone === 'bar') {
      // ◀▶ cambian el valor del selector; ▲ pasa al siguiente selector; ▼ vuelve a la rejilla.
      // En «Todos», ◀▶ pasan de selector y A quita los filtros; más allá de «Todos» (▶) se va al panel del equipo.
      if (s.dx && this.barSel !== BAR_RESET) this.cycleBar(this.barSel, s.dx);
      else if (s.dx > 0) { this.zone = 'panel'; this.panelSel = START_FOCUS; this.redraw(false); }
      else if (s.dx < 0) { this.barSel = BAR_SORT; this.redraw(false); }
      if (s.dy < 0) { this.barSel = (this.barSel + 1) % 4; this.redraw(false); }
      if (s.dy > 0 && lst.length) { this.zone = 'grid'; this.redraw(false); }
      if (s.ok) this.cycleBar(this.barSel, 1);
    } else {
      if (s.dx || s.dy) {
        const before = this.cursor();
        const r = moveCursor(before, s.dx, s.dy, lst.length, this.grid);
        if (r.exit === 'right') { this.zone = 'panel'; this.panelSel = clampPanel(0, (this.trial ? this.trialPicks() : this.team).length); }
        else if (r.exit === 'up') { this.zone = 'bar'; this.barSel = barFromColumn(before.idx % this.grid.cols, this.grid.cols); }
        this.setCursor(r.cur);
        this.redraw(r.cur.page !== before.page);
      }
      if (s.ok && lst.length) this.togglePick(lst[indexOf(this.cursor(), this.grid)]);
    }
  }
}

/** Táctil: la zona de toque de un texto cubre todo `r` (unidades de diseño). */
function growHit(t: Phaser.GameObjects.Text | null, r: Rect) {
  const area = t?.input?.hitArea as Phaser.Geom.Rectangle | undefined;
  if (!t || !area) return;
  area.setTo(r.x - (t.x - t.originX * t.width), r.y - (t.y - t.originY * t.height), r.w, r.h);
}
