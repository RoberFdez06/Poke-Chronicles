// Defensa de torres: elegir mapa (con candado y progreso), nivel (o el infinito) y el equipo de 5-6 Pokémon de tu
// colección. Teclado, ratón y mando por separado: flechas/cruceta para moverse, Enter/A para elegir, Esc/B para
// volver; en el equipo, Q/E o LB/RB cambian de página.
import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { addBackButton } from '../ui/cards';
import { NavInput, PadButtons, UI } from '../ui/nav';
import { drawBox, fadeIn, goTo, RARITY_COLORS, shorten } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';
import { ToastStack } from '../ui/toast';
import { bakeTdArt, drawMapThumb, tdIcon } from '../ui/art/tdArt';
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
  /** Columna derecha del equipo: 0 empezar, 1 prueba (o -1 si estás en la rejilla). */
  private sideSel = -1;
  private trial = false;
  private loading = false;
  private redraw: (grid?: boolean) => void = () => {};
  private keys!: { Q: Phaser.Input.Keyboard.Key; E: Phaser.Input.Keyboard.Key; H: Phaser.Input.Keyboard.Key };
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
    this.keys = { Q: kb.addKey('Q', false), E: kb.addKey('E', false), H: kb.addKey('H', false) };
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
    goTo(this, 'Mode', { slot: this.back.slot, starterId: this.back.starterId });
  }

  private title(text: string, sub?: string) {
    const t = this.add.text(480, 50, text, { fontFamily: UI.FONT, fontSize: '32px', color: '#ffffff' }).setOrigin(0.5).setStroke('#18202c', 6);
    this.layer.add(t);
    if (sub) this.layer.add(this.add.text(480, 80, sub, { fontFamily: UI.FONT, fontSize: '16px', color: '#ffe9a8' }).setOrigin(0.5).setStroke('#18202c', 4));
  }

  private hint(text: string) {
    this.layer.add(this.add.text(480, 622, text, { fontFamily: UI.FONT, fontSize: '14px', color: '#ffffff' }).setOrigin(0.5).setAlpha(0.85).setStroke('#18202c', 3));
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
    this.sideSel = -1;
    this.teamSel = 0;
    this.page = 0;
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

  private layoutTeam() {
    const list = this.trial ? this.trialPicks() : this.owned;
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    this.page = Math.min(this.page, pages - 1);
    const cell = 82;
    const x0 = 40;
    const y0 = 104;
    const grid = this.add.container(0, 0);
    this.layer.add(grid);
    const panel = this.add.graphics();
    this.layer.add(panel);
    const sel = this.add.graphics();
    this.layer.add(sel);
    const infoText = this.add.text(286, 456, '', { fontFamily: UI.FONT, fontSize: '16px', color: '#ffffff', align: 'center', wordWrap: { width: 500 }, lineSpacing: 4 }).setOrigin(0.5, 0).setStroke('#18202c', 4);
    this.layer.add(infoText);
    const pageText = this.add.text(286, 438, '', { fontFamily: UI.FONT, fontSize: '15px', color: '#ffe9a8' }).setOrigin(0.5).setStroke('#18202c', 3);
    this.layer.add(pageText);
    const arrows = [
      this.add.text(60, 438, '◀', { fontFamily: UI.FONT, fontSize: '24px', color: '#ffd34d' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.turnPage(-1)),
      this.add.text(512, 438, '▶', { fontFamily: UI.FONT, fontSize: '24px', color: '#ffd34d' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.turnPage(1)),
    ];
    this.layer.add(arrows);
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
    sz.on('pointerover', () => { this.sideSel = 0; this.redraw(false); }).on('pointerdown', () => this.startGame());
    const tz = this.add.zone(trialBtn.x, trialBtn.y, trialBtn.w, trialBtn.h).setOrigin(0).setInteractive({ useHandCursor: true });
    tz.on('pointerover', () => { this.sideSel = 1; this.redraw(false); }).on('pointerdown', () => this.toggleTrial());
    side.add([sz, tz]);
    const slotImgs: Phaser.GameObjects.GameObject[] = [];

    const paintGrid = () => {
      grid.removeAll(true);
      const lst = this.trial ? this.trialPicks() : this.owned;
      const pagesN = Math.max(1, Math.ceil(lst.length / PER_PAGE));
      pageText.setText(this.trial ? 'Equipo de prueba' : `Página ${this.page + 1}/${pagesN} · Q/E o LB/RB`);
      arrows.forEach((a) => a.setVisible(!this.trial && pagesN > 1));
      const items = lst.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
      items.forEach((p, k) => {
        const x = x0 + (k % COLS) * cell;
        const y = y0 + Math.floor(k / COLS) * cell;
        const g = this.add.graphics();
        const inTeam = this.team.some((t) => t.id === p.id);
        g.fillStyle(0x18202c, 0.85).fillRect(x, y, cell - 6, cell - 6);
        g.fillStyle(inTeam ? 0x2e5a3a : 0x2a3350, 1).fillRect(x + 3, y + 3, cell - 12, cell - 12);
        g.fillStyle(RARITY_COLORS[p.rarity], 1).fillRect(x + 3, y + cell - 13, cell - 12, 4);
        const img = this.textures.exists(tdMonKey(p.id)) ? this.add.image(x + (cell - 6) / 2, y + (cell - 6) / 2 - 4, tdMonKey(p.id)).setScale(0.75) : tdIcon(this, x + (cell - 6) / 2, y + (cell - 6) / 2 - 4, 'ball', 3);
        const parts: Phaser.GameObjects.GameObject[] = [g];
        if (img) parts.push(img);
        if (inTeam) parts.push(this.add.text(x + cell - 12, y + 6, '✓', { fontFamily: UI.FONT, fontSize: '16px', color: '#7cf07a' }).setOrigin(1, 0));
        const z = this.add.zone(x, y, cell - 6, cell - 6).setOrigin(0).setInteractive({ useHandCursor: true });
        z.on('pointerover', () => {
          this.sideSel = -1;
          this.teamSel = k;
          this.redraw(false);
        });
        z.on('pointerdown', () => this.togglePick(p));
        parts.push(z);
        grid.add(parts);
      });
    };

    this.redraw = (repaint = true) => {
      if (repaint) paintGrid();
      const lst = this.trial ? this.trialPicks() : this.owned;
      const items = lst.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
      this.teamSel = Math.min(this.teamSel, Math.max(0, items.length - 1));
      sel.clear();
      if (this.sideSel < 0 && items.length) {
        const x = x0 + (this.teamSel % COLS) * cell;
        const y = y0 + Math.floor(this.teamSel / COLS) * cell;
        sel.lineStyle(4, 0xffd34d, 1).strokeRect(x - 3, y - 3, cell, cell);
      }
      const p = this.sideSel < 0 ? items[this.teamSel] : undefined;
      if (p) {
        const style = towerStyle(p);
        infoText.setText(`${p.name} · ${p.types.map(typeNameEs).join('/')} · ${RARITY_LABEL[p.rarity]}\nTorre: ${STYLE_LABEL[style]} · Coste ${towerCost(p)} $`);
      } else infoText.setText(this.trial ? 'Equipo de prueba: para probar el modo. Juega con tus Pokémon del gacha para ir más lejos.' : '');
      // Equipo
      panel.clear();
      sideG.clear();
      drawBox(sideG, 600, 104, 320, 352, { radius: 14 });
      slotImgs.forEach((o) => o.destroy());
      slotImgs.length = 0;
      const teamNow = this.trial ? this.trialPicks() : this.team;
      slotImgs.push(this.add.text(760, 126, `Tu equipo (${teamNow.length}/${TEAM_MAX})`, { fontFamily: UI.FONT, fontSize: '19px', fontStyle: 'bold', color: NAVY }).setOrigin(0.5));
      for (let k = 0; k < TEAM_MAX; k++) {
        const sx = 616 + (k % 2) * 150;
        const sy = 148 + Math.floor(k / 2) * 98;
        const g = this.add.graphics();
        g.fillStyle(0x18202c, 0.15).fillRect(sx, sy, 140, 90);
        slotImgs.push(g);
        const q = teamNow[k];
        if (q) {
          g.fillStyle(RARITY_COLORS[q.rarity], 1).fillRect(sx, sy + 86, 140, 4);
          slotImgs.push(this.textures.exists(tdMonKey(q.id)) ? this.add.image(sx + 38, sy + 44, tdMonKey(q.id)).setScale(0.8) : tdIcon(this, sx + 38, sy + 44, 'ball', 3));
          slotImgs.push(this.add.text(sx + 74, sy + 22, shorten(q.name, 8), { fontFamily: UI.FONT, fontSize: '13px', fontStyle: 'bold', color: NAVY }));
          slotImgs.push(this.add.text(sx + 74, sy + 44, `${towerCost(q)} $\n${STYLE_LABEL[towerStyle(q)]}`, { fontFamily: UI.FONT, fontSize: '12px', color: NAVY }));
        } else slotImgs.push(this.add.text(sx + 70, sy + 45, 'vacío', { fontFamily: UI.FONT, fontSize: '14px', color: '#8a90a0' }).setOrigin(0.5));
      }
      slotImgs.forEach((o) => side.add(o));
      side.bringToTop(startText);
      side.bringToTop(trialText);
      side.bringToTop(sz);
      side.bringToTop(tz);
      drawBox(sideG, startBtn.x, startBtn.y, startBtn.w, startBtn.h, { selected: this.sideSel === 0, fill: teamNow.length >= TEAM_MIN ? undefined : 0xc8ccd4 });
      drawBox(sideG, trialBtn.x, trialBtn.y, trialBtn.w, trialBtn.h, { selected: this.sideSel === 1 });
      trialText.setText(this.trial ? (this.owned.length ? 'Usar mi colección' : 'Sin Pokémon: equipo de prueba') : 'Usar equipo de prueba');
    };
    this.redraw();
    const guest = accountInfo().mode === 'guest';
    this.hint(
      `Flechas/cruceta: moverse · Enter/A: añadir o quitar · Q/E, LB/RB: página · derecha del todo: botones${guest ? ' · Invitado: no se guarda al cerrar' : ''}`,
    );
  }

  private turnPage(d: number) {
    if (this.trial) return;
    const pages = Math.max(1, Math.ceil(this.owned.length / PER_PAGE));
    this.page = (this.page + d + pages) % pages;
    this.redraw();
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
    } else if (!this.loading) {
      if (J(this.keys.Q) || pb.has('LB')) this.turnPage(-1);
      if (J(this.keys.E) || pb.has('RB')) this.turnPage(1);
      const lst = this.trial ? this.trialPicks() : this.owned;
      const count = Math.min(PER_PAGE, Math.max(0, lst.length - this.page * PER_PAGE));
      if (this.sideSel >= 0) {
        if (s.dy) this.sideSel = s.dy > 0 ? 1 : 0;
        if (s.dx < 0) this.sideSel = -1;
        if (s.dx || s.dy) this.redraw(false);
        if (s.ok) {
          if (this.sideSel === 0) this.startGame();
          else this.toggleTrial();
        }
      } else {
        if (s.dx > 0 && (this.teamSel % COLS === COLS - 1 || this.teamSel + 1 >= count)) {
          this.sideSel = 0;
          this.redraw();
        } else if (s.dx || s.dy) {
          this.teamSel = Math.max(0, Math.min(count - 1, this.teamSel + s.dx + s.dy * COLS));
          this.redraw(false);
        }
        if (s.ok && count > 0) this.togglePick(lst[this.page * PER_PAGE + this.teamSel]);
      }
    }
  }
}
