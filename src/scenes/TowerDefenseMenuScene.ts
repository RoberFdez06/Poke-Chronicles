// Defensa de torres: elegir mapa (con candado y progreso), nivel (o el infinito) y el equipo de 5-6 Pokémon de tu
// colección. Teclado, ratón y mando por separado: flechas/cruceta para moverse, Enter/A para elegir, Esc/B para
// volver; en el equipo, Q/E o LB/RB cambian de página.
import Phaser from 'phaser';
import { addHelpBar } from '../ui/helpBar';
import { fitDesign } from '../ui/layout';
import { addBackButton } from '../ui/cards';
import { NavInput, PadButtons, UI, type PadButton } from '../ui/nav';
import { drawBox, fadeIn, goTo, RARITY_COLORS, shorten } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';
import { ToastStack } from '../ui/toast';
import { bakeTdArt, drawMapThumb, tdIcon, tdIconKey } from '../ui/art/tdArt';
import { bakeClassIcons, classIconKey } from '../ui/art/tdClassIcons';
import {
  canHitAir, clampCursor, clampPanel, cycle, filterLabel, filterOptions, filterPicks, indexOf, jumpPage, moveCursor, movePanel, pageCount,
  sortPicks, turnPage, CLASS_COLOR, CLASS_TRAITS, SORT_KEYS, SORT_LABEL, START_FOCUS, TRIAL_FOCUS, type FilterKey, type GridCursor, type SortKey,
} from '../data/towerDefense/teamPick';
import { TD_MAPS } from '../data/towerDefense/maps';
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
  private filter: FilterKey = 'todos';
  private sort: SortKey = 'poder';
  private hold = { dir: 0, next: 0 };
  private trial = false;
  private loading = false;
  private redraw: (grid?: boolean) => void = () => {};
  private keys!: Record<'Q' | 'E' | 'H' | 'F' | 'O' | 'PGUP' | 'PGDN', Phaser.Input.Keyboard.Key>;
  /** Pantalla «Cómo se juega» abierta (y su página). */
  private help: { box: Phaser.GameObjects.Container; page: number; draw: () => void } | null = null;

  constructor() {
    super('TowerDefenseMenu');
  }

  init(data: { slot?: number; starterId?: number; mapIdx?: number; stage?: Stage }) {
    this.back = { slot: data?.slot ?? 0, starterId: data?.starterId ?? 4 };
    this.stage = data?.stage ?? 'maps';
    if (data?.mapIdx !== undefined) this.mapSel = data.mapIdx;
  }

  create() {
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    bakeTdArt(this);
    this.nav = new NavInput(this);
    this.pad = new PadButtons(this);
    const kb = this.input.keyboard!;
    this.keys = { Q: kb.addKey('Q', false), E: kb.addKey('E', false), H: kb.addKey('H', false), F: kb.addKey('F', false), O: kb.addKey('O', false), PGUP: kb.addKey('PAGE_UP', false), PGDN: kb.addKey('PAGE_DOWN', false) };
    this.toasts = new ToastStack(this, 20, 92, 300, (c) => c.setDepth(50));
    this.progress = loadTdProgress();
    addBackButton(this, () => this.goBack());
    const helpBtn = this.add
      .text(924, 40, 'Cómo se juega (H · Y)', { fontFamily: UI.FONT, fontSize: '18px', color: '#ffffff' })
      .setOrigin(1, 0.5)
      .setPadding(8, 6)
      .setDepth(5)
      .setStroke('#18202c', 4)
      .setInteractive({ useHandCursor: true });
    helpBtn.on('pointerover', () => helpBtn.setColor('#ffd34d')).on('pointerout', () => helpBtn.setColor('#ffffff'));
    helpBtn.on('pointerdown', () => this.openHelp());
    this.layer = this.add.container(0, 0);
    this.showStage(this.stage);
  }

  private showStage(s: Stage) {
    this.stage = s;
    this.layer.removeAll(true);
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
    box.add([dim, g, head, body, foot, mk(130, '◀', -1), mk(830, '▶', 1), close]);
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
    const t = this.add.text(480, 50, text, { fontFamily: UI.FONT, fontSize: '32px', color: '#ffffff' }).setOrigin(0.5).setStroke('#18202c', 6);
    this.layer.add(t);
    if (sub) this.layer.add(this.add.text(480, 80, sub, { fontFamily: UI.FONT, fontSize: '16px', color: '#ffe9a8' }).setOrigin(0.5).setStroke('#18202c', 4));
  }

  private hint(text: string) {
    // Teclas dibujadas en pixel art; con mando se esconde (la barra del mando ya lo dice)
    const pc = text.replace(/ o cruceta/g, '').replace(/Flechas\/cruceta/g, 'Flechas').replace(/, clic o A/g, ' o clic').replace(/Enter\/A/g, 'Enter')
      .replace(/Esc, B o /g, 'Esc o ').replace(/Q\/E, LB\/RB/g, 'Q/E');
    this.layer.add(addHelpBar(this, 480, 622, pc, { fontSize: 14, color: '#ffffff' }).setAlpha(0.85));
  }

  // --- Mapas ---

  private buildMaps() {
    const total = TD_MAPS.length;
    this.title('Defensa de torres', `${TD_MAPS.filter((_, i) => isMapUnlocked(this.progress, i)).length}/${total} mapas abiertos`);
    const cw = 214;
    const ch = 118;
    const x0 = 52;
    const y0 = 98;
    const cards: { g: Phaser.GameObjects.Graphics; i: number }[] = [];
    TD_MAPS.forEach((m, i) => {
      const cx = x0 + (i % 4) * cw;
      const cy = y0 + Math.floor(i / 4) * (ch + 4);
      const open = isMapUnlocked(this.progress, i);
      const g = this.add.graphics();
      const thumb = this.add.graphics();
      drawMapThumb(thumb, m, biomeById(m.biome).colors, cx + 12, cy + 30, 5, !open);
      const name = this.add.text(cx + 12, cy + 10, `${i + 1}. ${m.name}`, { fontFamily: UI.FONT, fontSize: '16px', fontStyle: 'bold', color: NAVY });
      const cleared = levelsCleared(this.progress, m.id);
      const info = this.add.text(cx + 100, cy + 32, open ? `Niveles ${cleared}/${m.levels}\n${mapStars(this.progress, m.id)}/${m.levels * 3}` : `Supera ${levelsNeeded(TD_MAPS[i - 1]?.levels ?? 0)}\nniveles del\nmapa ${i}`, {
        fontFamily: UI.FONT, fontSize: '13px', color: open ? NAVY : '#6a7080', lineSpacing: 2,
      });
      const parts: Phaser.GameObjects.GameObject[] = [g, thumb, name, info];
      if (open) {
        info.setText(`Niveles ${cleared}/${m.levels}`);
        parts.push(tdIcon(this, cx + 108, cy + 63, 'star', 1.8));
        parts.push(this.add.text(cx + 120, cy + 63, `${mapStars(this.progress, m.id)}/${m.levels * 3}`, { fontFamily: UI.FONT, fontSize: '13px', color: NAVY }).setOrigin(0, 0.5));
        // Barra de niveles superados
        const bar = this.add.graphics();
        bar.fillStyle(0x18202c, 1).fillRect(cx + 100, cy + 84, 98, 8);
        bar.fillStyle(cleared >= m.levels ? 0xffd34d : 0x2ecc71, 1).fillRect(cx + 101, cy + 85, (96 * cleared) / m.levels, 6);
        parts.push(bar);
        if (isEndlessUnlocked(this.progress, m.id)) parts.push(this.add.text(cx + 100, cy + 94, '∞ abierto', { fontFamily: UI.FONT, fontSize: '12px', color: '#b8860b' }));
      } else {
        parts.push(tdIcon(this, cx + 52, cy + 57, 'lock', 3));
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
      if (open) {
        for (let s = 0; s < 3; s++) parts.push(tdIcon(this, mid + (s - 1) * 24, y + 38, s < mp.stars[i] ? 'star' : 'starOff', 2));
        parts.push(this.add.text(mid, y + 60, i === L - 1 ? `${wavesInLevel(i + 1, L)} oleadas + jefe` : `${wavesInLevel(i + 1, L)} oleadas`, { fontFamily: UI.FONT, fontSize: '12px', color: NAVY }).setOrigin(0.5));
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
    this.redraw = () => {
      for (const b of boxes) {
        b.g.clear();
        const open = b.i === L ? endlessOpen : isLevelUnlocked(this.progress, this.mapSel, b.i + 1);
        drawBox(b.g, b.x, b.y, b.w, b.h, { selected: b.i === this.levelSel, fill: open ? undefined : 0xc8ccd4 });
      }
      const i = this.levelSel;
      info.setText(
        i === L
          ? 'Oleadas sin fin cada vez más duras, con un jefe legendario cada 10. Guarda tu mejor oleada.'
          : `Nivel ${i + 1} de ${L}: ${wavesInLevel(i + 1, L)} oleadas${i === L - 1 ? ' y un jefe legendario al final' : ''}. Estrellas según la vida de la base que conserves (3: 90 % o más).`,
      );
    };
    this.redraw();
    this.hint('Flechas o cruceta: elegir nivel · Enter, clic o A: elegir equipo · Esc, B o «Volver»: mapas');
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
    this.filter = 'todos';
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
    return sortPicks(filterPicks(this.owned, this.filter, new Set(this.team.map((t) => t.id))), this.sort);
  }

  private cursor(): GridCursor {
    const c = clampCursor({ page: this.page, idx: this.teamSel }, this.viewList().length, GRID);
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
    if (which === 0) this.filter = cycle(filterOptions(this.owned), this.filter, d);
    else this.sort = cycle(SORT_KEYS, this.sort, d);
    this.setCursor({ page: 0, idx: 0 });
    this.redraw();
  }

  private layoutTeam() {
    bakeClassIcons(this);
    const cell = 78;
    const inner = cell - 6;
    const x0 = 40;
    const y0 = 126;
    const grid = this.add.container(0, 0);
    this.layer.add(grid);
    const sel = this.add.graphics().setDepth(2);
    this.layer.add(sel);
    // Barra de filtro y orden (arriba de la rejilla)
    const barG = this.add.graphics();
    this.layer.add(barG);
    const bars = [
      { x: x0, y: 98, w: 228, h: 24 },
      { x: x0 + 236, y: 98, w: inner + cell * 5 - 236, h: 24 },
    ];
    const barTexts = bars.map((b, i) => {
      const t = this.add.text(b.x + b.w / 2, b.y + b.h / 2, '', { fontFamily: UI.FONT, fontSize: '14px', color: NAVY, fontStyle: 'bold' }).setOrigin(0.5);
      const z = this.add.zone(b.x, b.y, b.w, b.h).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => { this.zone = 'bar'; this.barSel = i; this.redraw(false); });
      z.on('pointerdown', (p: Phaser.Input.Pointer) => this.cycleBar(i, p.rightButtonDown() ? -1 : 1));
      this.layer.add([t, z]);
      return t;
    });
    const pageText = this.add.text(x0 + (cell * COLS - 6) / 2, 446, '', { fontFamily: UI.FONT, fontSize: '15px', color: '#ffe9a8' }).setOrigin(0.5).setStroke('#18202c', 3);
    this.layer.add(pageText);
    const arrows = [
      this.add.text(x0 + 14, 446, '◀', { fontFamily: UI.FONT, fontSize: '24px', color: '#ffd34d' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.turnPage(-1)),
      this.add.text(x0 + cell * COLS - 20, 446, '▶', { fontFamily: UI.FONT, fontSize: '24px', color: '#ffd34d' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.turnPage(1)),
    ];
    this.layer.add(arrows);
    // Ficha de la torre enfocada
    const infoIcon = this.add.image(x0 + 10, 482, classIconKey('single')).setScale(3).setOrigin(0, 0.5);
    const infoText = this.add.text(x0 + 46, 464, '', { fontFamily: UI.FONT, fontSize: '15px', color: '#ffffff', wordWrap: { width: 460 }, lineSpacing: 3 }).setStroke('#18202c', 4);
    this.layer.add([infoIcon, infoText]);
    // Columna derecha: el equipo y los botones
    const side = this.add.container(0, 0);
    this.layer.add(side);
    const sideG = this.add.graphics();
    side.add(sideG);
    const startBtn = { x: 600, y: 470, w: 320, h: 50 };
    const trialBtn = { x: 600, y: 530, w: 320, h: 40 };
    const startText = this.add.text(startBtn.x + startBtn.w / 2, startBtn.y + 25, '¡A jugar!', { fontFamily: UI.FONT, fontSize: '24px', fontStyle: 'bold', color: NAVY }).setOrigin(0.5);
    const trialText = this.add.text(trialBtn.x + trialBtn.w / 2, trialBtn.y + 20, '', { fontFamily: UI.FONT, fontSize: '17px', color: NAVY }).setOrigin(0.5);
    side.add([startText, trialText]);
    const sz = this.add.zone(startBtn.x, startBtn.y, startBtn.w, startBtn.h).setOrigin(0).setInteractive({ useHandCursor: true });
    sz.on('pointerover', () => { this.zone = 'panel'; this.panelSel = START_FOCUS; this.redraw(false); }).on('pointerdown', () => this.startGame());
    const tz = this.add.zone(trialBtn.x, trialBtn.y, trialBtn.w, trialBtn.h).setOrigin(0).setInteractive({ useHandCursor: true });
    tz.on('pointerover', () => { this.zone = 'panel'; this.panelSel = TRIAL_FOCUS; this.redraw(false); }).on('pointerdown', () => this.toggleTrial());
    side.add([sz, tz]);
    const slotPos = (k: number) => ({ sx: 616 + (k % 2) * 150, sy: 148 + Math.floor(k / 2) * 98 });
    for (let k = 0; k < TEAM_MAX; k++) {
      const { sx, sy } = slotPos(k);
      const z = this.add.zone(sx, sy, 140, 90).setOrigin(0).setInteractive({ useHandCursor: true });
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
      const pagesN = pageCount(lst.length, GRID);
      pageText.setText(this.trial ? 'Equipo de prueba' : lst.length ? `Página ${c.page + 1}/${pagesN}` : 'Nadie con este filtro');
      arrows.forEach((a) => a.setVisible(!this.trial && pagesN > 1));
      const items = lst.slice(c.page * PER_PAGE, (c.page + 1) * PER_PAGE);
      const teamIds = new Set(this.team.map((t) => t.id));
      items.forEach((p, k) => {
        const x = x0 + (k % COLS) * cell;
        const y = y0 + Math.floor(k / COLS) * cell;
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
        const img = this.add.image(x + inner / 2, y + inner / 2 - 4, key);
        const fit = Math.min(SPRITE_BOX / img.width, SPRITE_BOX / img.height);
        img.setScale(fit);
        const icon = this.add.image(x + 4, y + 6, classIconKey(style)).setOrigin(0).setScale(2);
        const parts: Phaser.GameObjects.GameObject[] = [g, img, icon];
        if (canHitAir(p)) parts.push(this.add.image(x + 24, y + 7, classIconKey('air')).setOrigin(0).setScale(1.5));
        parts.push(this.add.text(x + inner / 2, y + inner - 9, `${towerCost(p)} $`, { fontFamily: UI.FONT, fontSize: '12px', fontStyle: 'bold', color: '#ffe082' }).setOrigin(0.5, 1).setStroke('#18202c', 3));
        if (inTeam) parts.push(this.add.text(x + inner - 4, y + 3, '✓', { fontFamily: UI.FONT, fontSize: '16px', color: '#7cf07a' }).setOrigin(1, 0).setStroke('#18202c', 3));
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
        old.icon.setY(old.iy).setScale(2);
      }
      focused = k;
      const c = cells[k];
      if (!c) return;
      // Crece un poco pero sin pasar de su baldosa (SPRITE_MAX), y el icono de la clase da un saltito
      const grow = Math.min(c.fit * 1.12, (c.fit * SPRITE_MAX) / SPRITE_BOX);
      this.tweens.add({ targets: c.img, scale: grow, duration: 140, ease: 'Back.Out' });
      this.tweens.add({ targets: c.icon, y: c.iy - 2, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    };

    this.redraw = (repaint = true) => {
      if (repaint) paintGrid();
      const lst = this.viewList();
      const c = this.cursor();
      const items = lst.slice(c.page * PER_PAGE, (c.page + 1) * PER_PAGE);
      if (this.zone === 'grid' && !items.length && !this.trial) this.zone = 'bar';
      sel.clear();
      // Barra de filtro y orden
      barG.clear();
      bars.forEach((b, i) => drawBox(barG, b.x, b.y, b.w, b.h, { radius: 6, selected: this.zone === 'bar' && this.barSel === i, fill: this.trial ? 0xc8ccd4 : undefined }));
      barTexts[0].setText(`Filtro: ${filterLabel(this.filter)}`);
      barTexts[1].setText(`Orden: ${SORT_LABEL[this.sort]}`);
      const ring = (x: number, y: number, w: number, h: number) => {
        sel.lineStyle(3, 0x18202c, 1).strokeRect(x - 3, y - 3, w + 6, h + 6);
        sel.lineStyle(2, 0xffd34d, 1).strokeRect(x - 1, y - 1, w + 2, h + 2);
        sel.lineStyle(1, 0xffffff, 1).strokeRect(x + 1, y + 1, w - 2, h - 2);
      };
      if (this.zone === 'grid' && items.length) {
        ring(x0 + (c.idx % COLS) * cell, y0 + Math.floor(c.idx / COLS) * cell, inner, inner);
        focusCell(c.idx);
      } else focusCell(-1);
      const p = this.zone === 'grid' ? items[c.idx] : this.zone === 'panel' && this.panelSel < START_FOCUS ? (this.trial ? this.trialPicks() : this.team)[this.panelSel] : undefined;
      if (p) {
        const style = towerStyle(p);
        const tr = CLASS_TRAITS[style];
        infoIcon.setTexture(classIconKey(style)).setVisible(true);
        infoText.setText(`${p.name} · ${p.types.map(typeNameEs).join('/')} · ${RARITY_LABEL[p.rarity]}\nTorre: ${STYLE_LABEL[style]} · Coste ${towerCost(p)} $ · Alcance ${tr.range} · Daño ${tr.damage}${canHitAir(p) ? ' · Aéreo' : ''}\n${tr.note}`);
      } else {
        infoIcon.setVisible(false);
        infoText.setText(this.trial ? 'Equipo de prueba: para probar el modo. Juega con tus Pokémon del gacha para ir más lejos.' : '');
      }
      // Equipo
      sideG.clear();
      drawBox(sideG, 600, 104, 320, 352, { radius: 14 });
      slotImgs.forEach((o) => o.destroy());
      slotImgs.length = 0;
      const teamNow = this.trial ? this.trialPicks() : this.team;
      this.panelSel = clampPanel(this.panelSel, teamNow.length);
      slotImgs.push(this.add.text(760, 126, `Tu equipo (${teamNow.length}/${TEAM_MAX})`, { fontFamily: UI.FONT, fontSize: '19px', fontStyle: 'bold', color: NAVY }).setOrigin(0.5));
      for (let k = 0; k < TEAM_MAX; k++) {
        const { sx, sy } = slotPos(k);
        const g = this.add.graphics();
        g.fillStyle(0x18202c, 0.15).fillRect(sx, sy, 140, 90);
        slotImgs.push(g);
        const q = teamNow[k];
        if (q) {
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
        } else slotImgs.push(this.add.text(sx + 70, sy + 45, 'vacío', { fontFamily: UI.FONT, fontSize: '14px', color: '#8a90a0' }).setOrigin(0.5));
      }
      slotImgs.forEach((o) => side.add(o));
      side.bringToTop(startText);
      side.bringToTop(trialText);
      side.list.filter((o) => o instanceof Phaser.GameObjects.Zone).forEach((o) => side.bringToTop(o));
      drawBox(sideG, startBtn.x, startBtn.y, startBtn.w, startBtn.h, { selected: this.zone === 'panel' && this.panelSel === START_FOCUS, fill: teamNow.length >= TEAM_MIN ? undefined : 0xc8ccd4 });
      drawBox(sideG, trialBtn.x, trialBtn.y, trialBtn.w, trialBtn.h, { selected: this.zone === 'panel' && this.panelSel === TRIAL_FOCUS });
      trialText.setText(this.trial ? (this.owned.length ? 'Usar mi colección' : 'Sin Pokémon: equipo de prueba') : 'Usar equipo de prueba');
    };
    this.redraw();
    const guest = accountInfo().mode === 'guest';
    this.hint(
      `Flechas/cruceta: moverse (los bordes cambian de página) · Enter/A: añadir o quitar · Q/E, LB/RB: página · AvPág/RePág: ±5 · F: filtro · O: orden · P: ¡A jugar!${guest ? ' · Invitado: no se guarda al cerrar' : ''}`,
    );
  }

  private turnPage(d: number) {
    if (this.trial) return;
    this.zone = 'grid';
    this.setCursor(turnPage(this.cursor(), d, this.viewList().length, GRID));
    this.redraw();
  }

  private jumpPages(d: number) {
    if (this.trial) return;
    this.zone = 'grid';
    this.setCursor(jumpPage(this.cursor(), d, this.viewList().length, GRID));
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
    if (s.back) return this.goBack();
    if (this.stage === 'maps') {
      if (s.dx || s.dy) {
        const n = TD_MAPS.length;
        this.mapSel = (this.mapSel + s.dx + s.dy * 4 + n) % n;
        this.redraw();
      }
      if (s.ok) this.pickMap(this.mapSel);
    } else if (this.stage === 'levels') {
      if (s.dx || s.dy) {
        let i = this.levelSel;
        const L = TD_MAPS[this.mapSel].levels;
        if (i === L) {
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
    if (J(this.keys.Q) || pb.has('LB') || rep < 0) return this.turnPage(-1);
    if (J(this.keys.E) || pb.has('RB') || rep > 0) return this.turnPage(1);
    if (J(this.keys.PGUP) || pb.has('LT')) return this.jumpPages(-5);
    if (J(this.keys.PGDN) || pb.has('RT')) return this.jumpPages(5);
    if (J(this.keys.F) || pb.has('X')) return this.cycleBar(0, 1);
    if (J(this.keys.O)) return this.cycleBar(1, 1);
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
      if (s.dx > 0 && this.barSel === 1) { this.zone = 'panel'; this.panelSel = START_FOCUS; }
      else if (s.dx) this.barSel = s.dx > 0 ? 1 : 0;
      if (s.dy > 0 && lst.length) this.zone = 'grid';
      if (s.dx || s.dy) this.redraw(false);
      if (s.ok) this.cycleBar(this.barSel, 1);
    } else {
      if (s.dx || s.dy) {
        const before = this.cursor();
        const r = moveCursor(before, s.dx, s.dy, lst.length, GRID);
        if (r.exit === 'right') { this.zone = 'panel'; this.panelSel = clampPanel(0, (this.trial ? this.trialPicks() : this.team).length); }
        else if (r.exit === 'up') { this.zone = 'bar'; this.barSel = (before.idx % COLS) < COLS / 2 ? 0 : 1; }
        this.setCursor(r.cur);
        this.redraw(r.cur.page !== before.page);
      }
      if (s.ok && lst.length) this.togglePick(lst[indexOf(this.cursor(), GRID)]);
    }
  }
}
