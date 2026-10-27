// Defensa de torres: la partida. Dibuja el motor (src/data/towerDefense/engine.ts) y le pasa lo que hace el jugador.
// Controles (cada dispositivo vale solo; teclas y botones en data/towerDefense/controls.ts):
// - Un cursor de casillas: flechas/WASD, cruceta o stick (mantener = avanza solo), o el ratón encima.
// - Aceptar (Enter/Espacio, A, clic): con un Pokémon elegido lo coloca; sobre una torre la abre; en una casilla libre
//   sin nada elegido, elige el último Pokémon usado. Cancelar (Esc, B, clic derecho): suelta lo elegido; sin nada, pausa.
// - Equipo: Q/E, LB/RB, rueda o clic. Torre abierta: panel con acciones numeradas (1-4, cruceta y A, o clic).
// - Habilidades Z/X/C (LT/RT/Y), oleada N (X), velocidad F (R3), pausa P (Start): cada botón enseña su tecla.
// Abajo a la derecha, una barra de ayuda cambia según lo elegido y el dispositivo con el que se juega.
import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { NavInput, PadButtons, UI, MenuList } from '../ui/nav';
import { drawBox, fadeIn, goTo, lowFx, RARITY_COLORS, shorten } from '../ui/theme';
import { ToastStack } from '../ui/toast';
import { sfx } from '../ui/audio';
import { currentInput } from '../ui/inputMode';
import { HoldRepeat, cycle, stepCursor, tdHelp, tdKeyLabel, type TdDevice, type TdHelpContext, type TdKeyAction } from '../data/towerDefense/controls';
import { loadPmd, pmdAnimKey, pmdKey, type PmdSheet } from '../ui/pmdSprites';
import { dir8Row, pmdScale } from '../data/pmdAnim';
import { fetchFormSprites, fetchNextEvolutions, fetchPokemonCard, fetchSpeciesName } from '../data/pokeapi';
import { withTimeout } from '../data/offline';
import { addCandies, addTickets, loadUpgrades } from '../data/save';
import { levelsFor } from '../data/upgrades';
import { typeColor, typeNameEs } from '../data/types';
import { bakeBiomeTiles } from '../ui/art/tiles';
import { bakeProjectiles, bakeTypeFx, projKey, projRotation, typeImpact, typeTrail } from '../ui/art/typeFx';
import { bakeCombatFx, bossAura, damageNumber, evolveBurst, evolveGlow, hitSpark, phaseShock, starBurst } from '../ui/art/combatFx';
import { pixBlast, pixBolt, pixDebris, pixFlash, pixRing } from '../ui/art/pixelFx';
import {
  P, bakeTdArt, confetti, drawAbilityFrame, drawAura, drawBar, drawBase, drawCursor, drawDecor, drawFlow, drawPads, drawPedestal, drawPortal,
  drawRange, drawRoad, pickDecor, tdIcon, tdIconKey, type Decor, type MapGeom,
} from '../ui/art/tdArt';
import { biomeById } from '../level/biomes';
import { TD_COLS, TD_MAPS, TD_ROWS, baseCell, buildableCells, entryCells, type TdMap } from '../data/towerDefense/maps';
import { BASE_HP, TARGETING_LABEL, TdGame, type TdEnemy, type TdEvent, type TdTower, type TeamMon } from '../data/towerDefense/engine';
import { ABILITIES, ABILITY_INFO, LIGHTNING_TARGETS, type AbilityId } from '../data/towerDefense/abilities';
import { BRANCH_LEVEL, MAX_TOWER_LEVEL, MEGA_LEVEL, STYLE_LABEL, branchInfo, levelLabel, megaMoveOf, megaSpriteName, specialMoveOf, towerCost, towerStats } from '../data/towerDefense/towers';
import { drawMegaAura, towerMegaFx } from '../ui/art/tdMegaArt';
import { ENEMY_KIND_LABEL, MAP_FOES, TRIAL_TEAM, type EnemyKind } from '../data/towerDefense/species';
import { waveSpawns } from '../data/towerDefense/waves';
import { isLevelUnlocked, loadTdProgress, starsFor, submitTdOutcome, type TdRewards } from '../data/towerDefense/progress';
import { tdMonKey, type TowerDefenseData } from './TowerDefenseMenuScene';
import { openConfirm } from './ConfirmScene';
import { onFocusLost } from '../ui/focusPause';
import { openControls } from './ControlsScene';
import { showTdTip } from '../ui/tdTips';
import { accountInfo } from '../net/cloud';
import type { BaseStats } from '../data/pokeStats';

const CELL = 48;
const OX = 12;
const OY = 62;
const GEO: MapGeom = { ox: OX, oy: OY, cell: CELL };
const PANEL_X = 792;
const NAVY = '#2b3a67';
const SPEEDS = [1, 2, 3] as const;
const spriteUrl = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const sx = (x: number) => OX + x * CELL;
const sy = (y: number) => OY + y * CELL;

interface Btn {
  x: number;
  y: number;
  w: number;
  h: number;
  text?: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
  zone: Phaser.GameObjects.Zone;
  act: () => void;
  enabled: () => boolean;
  color?: number;
}

interface EnemyView {
  spr: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  row: number;
  pmd: boolean;
  bob: number;
}

interface TowerView {
  spr: Phaser.GameObjects.Sprite;
  row: number;
  id: number;
  pmd: boolean;
}

/** Dónde va el teclado o el mando: el cursor del mapa o las acciones de la torre abierta. */
type Focus = { zone: 'grid' } | { zone: 'panel'; i: number };

export class TowerDefenseScene extends Phaser.Scene {
  private args!: TowerDefenseData;
  private map!: TdMap;
  private td!: TdGame;
  private ready = false;
  private paused = false;
  private ended = false;
  private speedIdx = 0;
  private nav!: NavInput;
  private pad!: PadButtons;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private toasts!: ToastStack;
  private sheets = new Map<number, PmdSheet>();
  private names = new Map<number, string>();
  // Dibujo
  private ambient!: Phaser.GameObjects.Graphics;
  private towerG!: Phaser.GameObjects.Graphics;
  private overG!: Phaser.GameObjects.Graphics;
  private uiG!: Phaser.GameObjects.Graphics;
  private decor: Decor[] = [];
  private freeCells: { x: number; y: number }[] = [];
  private enemyViews = new Map<number, EnemyView>();
  private towerViews = new Map<number, TowerView>();
  private shotViews = new Map<number, Phaser.GameObjects.Image>();
  private baseFlash = 0;
  private lastAmbient = 0;
  // Interfaz
  private cursor = { x: 0, y: 0 };
  private hover: { x: number; y: number } | null = null;
  private focus: Focus = { zone: 'grid' };
  private placing: number | null = null;
  private selected: number | null = null;
  /** Último Pokémon del equipo elegido (aceptar en una casilla libre sin nada elegido lo toma). */
  private teamSel = 0;
  private repeat = new HoldRepeat();
  private help: Phaser.GameObjects.Text[] = [];
  private helpKey = '';
  private teamHead!: Phaser.GameObjects.Text;
  private keyTexts: { t: Phaser.GameObjects.Text; a: TdKeyAction; fmt?: (k: string) => string }[] = [];
  private teamBtns: Btn[] = [];
  private barBtns: Btn[] = [];
  private panelBtns: Btn[] = [];
  private panelTexts: Phaser.GameObjects.Text[] = [];
  private panelKey = '';
  private hud!: { hp: Phaser.GameObjects.Text; money: Phaser.GameObjects.Text; wave: Phaser.GameObjects.Text; next: Phaser.GameObjects.Text; title: Phaser.GameObjects.Text };
  private cdTexts: Phaser.GameObjects.Text[] = [];
  private overlay: Phaser.GameObjects.Container | null = null;
  private overlayList: MenuList | null = null;
  private loadingText!: Phaser.GameObjects.Text;

  constructor() {
    super('TowerDefense');
  }

  init(data: TowerDefenseData) {
    // Sin equipo (no debería pasar desde el menú): el equipo de prueba
    const trialTeam = TRIAL_TEAM.map((t) => ({ id: t.id, name: t.name, types: [...t.types], rarity: t.rarity, bst: 300 }));
    const hasTeam = !!data?.team?.length;
    this.args = { mapIdx: data?.mapIdx ?? 0, level: data?.level ?? 1, team: hasTeam ? data.team : trialTeam, trial: hasTeam ? data.trial : true };
    this.map = TD_MAPS[this.args.mapIdx] ?? TD_MAPS[0];
    this.ready = false;
    this.paused = false;
    this.ended = false;
    this.speedIdx = 0;
    this.enemyViews = new Map();
    this.towerViews = new Map();
    this.shotViews = new Map();
    this.placing = null;
    this.selected = null;
    this.teamSel = 0;
    this.repeat = new HoldRepeat();
    this.help = [];
    this.helpKey = '';
    this.keyTexts = [];
    this.hover = null;
    this.focus = { zone: 'grid' };
    this.cursor = { x: 0, y: 0 };
    this.overlay = null;
    this.overlayList = null;
    this.panelKey = '';
    this.teamBtns = [];
    this.barBtns = [];
    this.panelBtns = [];
    this.panelTexts = [];
    this.cdTexts = [];
  }

  create() {
    fadeIn(this);
    fitDesign(this);
    this.cameras.main.setBackgroundColor(0x18202c);
    bakeTdArt(this);
    bakeTypeFx(this);
    bakeProjectiles(this);
    bakeCombatFx(this);
    this.nav = new NavInput(this);
    this.pad = new PadButtons(this);
    // Al perder el foco la ventana o la pestaña, se abre la pausa (openPause ya ignora si hay pausa, confirmación o fin)
    onFocusLost(this, () => this.scene.isActive() && this.openPause());
    const kb = this.input.keyboard!;
    const add = (k: string) => kb.addKey(k, false);
    const names = ['ONE', 'TWO', 'THREE', 'FOUR', 'Z', 'X', 'C', 'N', 'F', 'Q', 'E', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'W', 'A', 'S', 'D'];
    this.keys = Object.fromEntries(names.map((n) => [n, add(n)]));
    this.input.mouse?.disableContextMenu();
    this.loadingText = this.add.text(480, 320, 'Preparando el mapa…', { fontFamily: UI.FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
    void this.prepare();
  }

  // --- Carga: estadísticas reales, evoluciones y sprites ---

  private async prepare() {
    const book = loadUpgrades();
    const team: TeamMon[] = await Promise.all(
      this.args.team.map(async (p) => {
        const trial = TRIAL_TEAM.find((t) => t.id === p.id);
        let stats: BaseStats = trial?.stats ?? fromBst(p.bst);
        let types: readonly string[] = p.types;
        if (!this.args.trial || !trial) {
          try {
            const card = await withTimeout(fetchPokemonCard(p.id), 5000, 'estadísticas');
            stats = card.stats;
            if (card.types.length) types = card.types;
          } catch {
            // sin conexión: estadísticas aproximadas por su total
          }
        }
        const lv = this.args.trial ? null : levelsFor(book, p.id);
        let evolveId: number | null = null;
        try {
          let cur = p.id;
          for (let i = 0; i < 2; i++) {
            const next = await withTimeout(fetchNextEvolutions(cur), 4000, 'evolución');
            if (!next.length) break;
            cur = next[0];
          }
          evolveId = cur !== p.id ? cur : null;
        } catch {
          evolveId = null;
        }
        return { id: p.id, name: p.name, types, stats, rarity: p.rarity, evolveId, upgrades: lv ? { damage: lv.damage, rate: lv.rate, range: lv.range } : undefined };
      }),
    );
    if (!this.scene.isActive()) return;
    const foes = MAP_FOES[this.map.biome] ?? MAP_FOES.bosque;
    const evoIds = team.map((t) => t.evolveId).filter((n): n is number => !!n);
    const ids = [...new Set([...team.map((t) => t.id), ...evoIds, ...Object.values(foes).flat()])];
    for (const id of evoIds) void fetchSpeciesName(id).then((n) => this.names.set(id, n)).catch(() => undefined);
    try {
      this.sheets = await withTimeout(loadPmd(this, ids), 15000, 'sprites');
    } catch {
      this.sheets = new Map();
    }
    // Sprite de PokeAPI para los que no tengan hoja animada
    let queued = 0;
    for (const id of ids) {
      if (this.sheets.has(id) || this.textures.exists(tdMonKey(id))) continue;
      this.load.image(tdMonKey(id), spriteUrl(id));
      queued++;
    }
    if (queued) {
      await new Promise<void>((res) => {
        this.load.once(Phaser.Loader.Events.COMPLETE, () => res());
        this.load.start();
      });
    }
    if (!this.scene.isActive()) return;
    this.td = new TdGame({ map: this.map, level: this.args.level, team, seed: Date.now() % 100000 });
    this.loadingText.destroy();
    this.build();
    this.ready = true;
    showTdTip(this, 'td_place');
  }

  // --- Montaje ---

  private build() {
    const biome = biomeById(this.map.biome);
    const tiles = bakeBiomeTiles(this, biome);
    const W = TD_COLS * CELL;
    const H = TD_ROWS * CELL;
    // Marco del mapa y suelo del bioma
    const frame = this.add.graphics().setDepth(0);
    frame.fillStyle(0x0c1018, 1).fillRect(OX - 6, OY - 6, W + 12, H + 12);
    frame.fillStyle(biome.colors.wall, 1).fillRect(OX - 4, OY - 4, W + 8, H + 8);
    this.add.tileSprite(OX, OY, W, H, tiles.floor).setOrigin(0).setTileScale(1.5).setDepth(0.1);
    const ground = this.add.graphics().setDepth(0.2);
    drawPads(ground, buildableCells(this.map), biome.colors.floor, GEO);
    drawRoad(ground, this.map, this.map.biome, GEO);
    for (const b of this.map.blocked) {
      this.add.image(sx(b.x) + CELL / 2, sy(b.y) + CELL / 2 + 2, tiles.rock).setDisplaySize(CELL, CELL).setDepth(10 + b.y);
    }
    this.freeCells = buildableCells(this.map);
    this.decor = pickDecor(this.map, this.freeCells, GEO);
    this.ambient = this.add.graphics().setDepth(0.3);
    this.towerG = this.add.graphics().setDepth(0.6);
    this.overG = this.add.graphics().setDepth(40);
    this.uiG = this.add.graphics().setDepth(60);

    // Zona del mapa: ratón
    const zone = this.add.zone(OX, OY, W, H).setOrigin(0).setInteractive().setDepth(1);
    // El ratón mueve el mismo cursor que el teclado y el mando (así solo hay un cursor en pantalla)
    zone.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.hover = this.cellAt(p);
      if (this.hover && this.canAct()) this.cursor = { ...this.hover };
    });
    zone.on('pointerout', () => (this.hover = null));
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.canAct()) return;
      if (p.rightButtonDown()) return this.cancel();
      const c = this.cellAt(p);
      if (!c) return;
      this.cursor = { ...c };
      this.activateCell(c.x, c.y);
    });
    // Rueda del ratón: Pokémon anterior o siguiente del equipo
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.canAct() && dy) this.cycleTeam(dy > 0 ? 1 : -1);
    });

    this.buildHud();
    this.buildTeam();
    this.buildBar();
    this.drawAmbient(0);
    // Avisos arriba a la izquierda del mapa (nunca en el centro): estrechos, como mucho 2 y breves para no tapar el camino
    this.toasts = new ToastStack(this, OX + 6, OY + 6, 220, (c) => c.setDepth(70), 2);
  }

  private toast(text: string, kind: 'info' | 'reward' | 'warning' | 'danger' = 'info') {
    this.toasts.show(text, { kind, ms: kind === 'warning' ? 1800 : 2600 });
  }

  private cellAt(p: Phaser.Input.Pointer): { x: number; y: number } | null {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const x = Math.floor((w.x - OX) / CELL);
    const y = Math.floor((w.y - OY) / CELL);
    return x >= 0 && y >= 0 && x < TD_COLS && y < TD_ROWS ? { x, y } : null;
  }

  private canAct() {
    return this.ready && !this.paused && !this.ended && !this.overlay;
  }

  private makeBtn(x: number, y: number, w: number, h: number, label: string, act: () => void, enabled: () => boolean = () => true, size = 16, color?: number): Btn {
    const text = label
      ? this.add.text(x + w / 2, y + h / 2, label, { fontFamily: UI.FONT, fontSize: `${size}px`, fontStyle: 'bold', color: NAVY, align: 'center' }).setOrigin(0.5).setDepth(62)
      : undefined;
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(63);
    const b: Btn = { x, y, w, h, text, zone, act, enabled, color };
    zone.on('pointerdown', () => {
      if (!this.canAct() || !b.enabled()) return;
      sfx('select');
      b.act();
    });
    return b;
  }

  private buildHud() {
    const top = this.add.graphics().setDepth(55);
    drawBox(top, 4, 4, 780, 52, { radius: 10 });
    tdIcon(this, 30, 30, 'heart', 3).setDepth(62);
    tdIcon(this, 232, 30, 'coin', 3).setDepth(62);
    const st = (x: number, size = 18, color = NAVY) =>
      this.add.text(x, 30, '', { fontFamily: UI.FONT, fontSize: `${size}px`, fontStyle: 'bold', color }).setOrigin(0, 0.5).setDepth(62);
    this.hud = { hp: st(150, 15), money: st(252, 20, '#8a6a00'), wave: st(340), next: st(470, 15), title: st(612, 12) };
    this.hud.title.setText(shorten(`${this.map.name} · ${this.td.endless ? 'Infinito' : `Nv. ${this.args.level}`}`, 26));
    const side = this.add.graphics().setDepth(55);
    drawBox(side, PANEL_X, 4, 164, 588, { radius: 10 });
    this.teamHead = this.add.text(PANEL_X + 82, 24, 'Tu equipo', { fontFamily: UI.FONT, fontSize: '15px', fontStyle: 'bold', color: NAVY }).setOrigin(0.5).setDepth(62);
    const bottom = this.add.graphics().setDepth(55);
    drawBox(bottom, 4, 596, 952, 42, { radius: 10 });
  }

  private buildTeam() {
    this.td.team.forEach((m, i) => {
      const x = PANEL_X + 12 + (i % 2) * 72;
      const y = 42 + Math.floor(i / 2) * 72;
      const b = this.makeBtn(x, y, 66, 66, '', () => this.pickSlot(i));
      const tex = this.monTexture(m.id);
      b.icon = this.add.image(x + 33, y + 28, tex.key, tex.frame).setDepth(62);
      const fit = 44 / Math.max(1, b.icon.width, b.icon.height);
      b.icon.setScale(tex.pmd ? Math.min(2.2, fit * 1.5) : tex.key === tdIconKey('ball') ? 2.6 : fit * 1.3);
      b.text = this.add.text(x + 33, y + 56, `${towerCost(m)} $`, { fontFamily: UI.FONT, fontSize: '13px', fontStyle: 'bold', color: NAVY }).setOrigin(0.5).setDepth(62);
      this.teamBtns.push(b);
    });
  }

  private buildBar() {
    const keyText = (x: number, a: TdKeyAction, fmt?: (k: string) => string) => {
      const t = this.add.text(x, 617, '', { fontFamily: UI.FONT, fontSize: '13px', fontStyle: 'bold', color: NAVY }).setOrigin(0, 0.5).setDepth(64);
      this.keyTexts.push({ t, a, fmt });
      return t;
    };
    ABILITIES.forEach((id, i) => {
      // Cada habilidad: su botón cuadrado y, al lado, la tecla o el botón del mando que la lanza
      const b = this.makeBtn(12 + i * 58, 601, 32, 32, '', () => this.useAbility(id));
      b.zone.setSize(54, 32);
      b.icon = tdIcon(this, b.x + 16, b.y + 16, id, 2.2).setDepth(62);
      b.color = ABILITY_INFO[id].color;
      this.cdTexts.push(this.add.text(b.x + 16, b.y + 16, '', { fontFamily: UI.FONT, fontSize: '14px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setStroke('#18202c', 4).setDepth(64));
      keyText(b.x + 37, id);
      this.barBtns.push(b);
    });
    this.barBtns.push(this.makeBtn(188, 601, 214, 32, 'Siguiente oleada', () => this.callWave(), () => this.td.phase === 'prep', 13));
    this.barBtns.push(this.makeBtn(410, 601, 74, 32, 'x1', () => this.cycleSpeed(), () => true, 14));
    this.barBtns.push(this.makeBtn(492, 601, 84, 32, 'Pausa', () => this.openPause(), () => true, 14));
    // Barra de ayuda: cambia con lo elegido y con el dispositivo (drawUi)
    for (let i = 0; i < 2; i++) {
      this.help.push(this.add.text(586, 607 + i * 19, '', { fontFamily: UI.FONT, fontSize: '12px', color: NAVY }).setOrigin(0, 0.5).setDepth(62));
    }
  }

  private monTexture(id: number): { key: string; frame?: number; pmd: boolean } {
    const sheet = this.sheets.get(id);
    if (sheet) return { key: pmdKey(id, sheet.hasIdle ? 'idle' : 'walk'), frame: 0, pmd: true };
    return { key: this.staticKey(id), pmd: false };
  }

  /** Sprite de PokeAPI o, si no ha cargado (sin conexión), una Poké Ball de píxeles. */
  private staticKey(id: number): string {
    const k = tdMonKey(id);
    return this.textures.exists(k) && this.textures.get(k).key !== '__MISSING' && this.textures.get(k).getSourceImage().width > 1 ? k : tdIconKey('ball');
  }

  // --- Acciones del jugador ---

  /** Clic o toque en un Pokémon del equipo: lo elige (otra vez, lo suelta). */
  private pickSlot(i: number) {
    if (this.placing === i) return this.cancel();
    this.setPlacing(i);
  }

  private setPlacing(i: number) {
    this.placing = i;
    this.teamSel = i;
    this.selected = null;
    this.focus = { zone: 'grid' };
    sfx('select');
  }

  /** Q/E, LB/RB o la rueda: Pokémon anterior o siguiente (sin nada elegido, empieza por el último usado). */
  private cycleTeam(d: number) {
    const n = this.td.team.length;
    if (!n) return;
    this.setPlacing(this.placing === null && this.selected === null ? this.teamSel : cycle(this.placing ?? this.teamSel, d, n));
  }

  private cancel() {
    this.placing = null;
    this.selected = null;
    this.focus = { zone: 'grid' };
  }

  /** Esc o B: cierra la torre, suelta el Pokémon o, si no hay nada elegido, abre la pausa. */
  private back() {
    if (this.placing !== null || this.selected !== null) return this.cancel();
    this.openPause();
  }

  /** Aceptar sobre una casilla (Enter, Espacio, A, clic o toque). */
  private activateCell(x: number, y: number) {
    const t = this.td.towerAt(x, y);
    if (t) {
      this.placing = null;
      this.selected = t.id;
      this.focus = { zone: 'panel', i: 0 };
      sfx('select');
      return;
    }
    if (this.placing !== null) {
      const err = this.td.placeError(this.placing, x, y);
      if (err) {
        sfx('warn');
        this.toast(err, 'warning');
        return;
      }
      const tw = this.td.place(this.placing, x, y)!;
      sfx('buy');
      const cx = sx(x) + CELL / 2;
      const cy = sy(y) + CELL / 2;
      pixRing(this, cx, cy + 10, 30, RARITY_COLORS[tw.mon.rarity], 360, 5);
      if (!lowFx()) starBurst(this, cx, cy, 0xffffff, 4, 0.8, 9);
      // Sigue con el mismo Pokémon mientras pueda colocar más
      if (this.td.placedOf(this.placing) >= this.td.limitOf(this.placing)) this.placing = null;
      return;
    }
    // Con una torre abierta, aceptar fuera la cierra
    if (this.selected !== null) return this.cancel();
    // Casilla libre sin nada elegido: se elige el último Pokémon usado (el siguiente aceptar lo coloca)
    if (this.freeCells.some((c) => c.x === x && c.y === y) && this.td.team.length) this.setPlacing(Math.min(this.teamSel, this.td.team.length - 1));
  }

  /** Acción `i` del panel de la torre abierta (tecla 1-4, A o clic). */
  private pressPanel(i: number) {
    const b = this.panelBtns[i];
    if (!b) return;
    if (this.focus.zone === 'panel') this.focus.i = i;
    if (!b.enabled()) {
      sfx('warn');
      return;
    }
    sfx('select');
    b.act();
  }

  private selectedTower(): TdTower | undefined {
    return this.selected === null ? undefined : this.td.towers.find((t) => t.id === this.selected);
  }

  private doUpgrade(branch?: 'a' | 'b') {
    const t = this.selectedTower();
    if (!t) return;
    const r = this.td.upgrade(t.id, branch);
    if (r === 'ok') {
      sfx('levelup');
      const cx = sx(t.x) + CELL / 2;
      const cy = sy(t.y) + CELL / 2;
      pixRing(this, cx, cy + 10, 34, 0xffd34d, 420, 5);
      starBurst(this, cx, cy - 10, 0xffd34d, 5, 1, 9);
    } else if (r === 'poor') {
      sfx('warn');
      this.toast('No tienes bastante dinero', 'warning');
    } else if (r === 'branch') {
      this.toast('Elige una rama en el panel (1 o 2)', 'info');
      this.focus = { zone: 'panel', i: 0 };
    }
  }

  private doSell() {
    const t = this.selectedTower();
    if (!t) return;
    const v = this.td.sell(t.id);
    sfx('coin');
    const cx = sx(t.x) + CELL / 2;
    const cy = sy(t.y) + CELL / 2;
    pixDebris(this, cx, cy, RARITY_COLORS[t.mon.rarity], 10, 1, 9);
    this.floatMoney(cx, cy - 10, v);
    this.selected = null;
    if (this.focus.zone === 'panel') this.focus = { zone: 'grid' };
  }

  private callWave() {
    if (this.td.callNextWave()) sfx('door');
  }

  private cycleSpeed() {
    this.speedIdx = (this.speedIdx + 1) % SPEEDS.length;
  }

  private useAbility(id: AbilityId) {
    if (!this.canAct()) return;
    // Objetivos del Rayo antes de lanzarlo (para dibujar el trueno sobre ellos)
    const strongest = [...this.td.enemies]
      .sort((a, b) => b.hp + b.shield - (a.hp + a.shield))
      .slice(0, LIGHTNING_TARGETS)
      .map((e) => this.enemyPos(e));
    if (!this.td.useAbility(id)) {
      const left = Math.ceil(this.td.cooldowns[id]);
      sfx('warn');
      this.toast(left > 0 ? `${ABILITY_INFO[id].name}: lista en ${left} s` : id === 'curar' ? 'La base ya está entera' : 'No hay enemigos', 'warning');
      return;
    }
    if (id === 'rayo') {
      sfx('boom');
      for (const p of strongest) {
        pixBolt(this, p.x + Phaser.Math.Between(-20, 20), OY - 10, p.x, p.y, 0xffd34d, 45);
        pixFlash(this, p.x, p.y, 34, 0xffffff, 220, 44);
      }
      this.cameras.main.shake(180, 0.006);
    } else if (id === 'ventisca') {
      sfx('hit');
      const veil = this.add.rectangle(OX, OY, TD_COLS * CELL, TD_ROWS * CELL, 0x8fe0ff, 0.35).setOrigin(0).setDepth(45);
      this.tweens.add({ targets: veil, alpha: 0, duration: 900, onComplete: () => veil.destroy() });
      if (!lowFx()) {
        for (let i = 0; i < 26; i++) typeImpact(this, OX + Math.random() * TD_COLS * CELL, OY + Math.random() * TD_ROWS * CELL, 'ice', 0.8, 2, 46);
      }
      for (const e of this.td.enemies) {
        const p = this.enemyPos(e);
        pixRing(this, p.x, p.y + 8, 24, 0x8fe0ff, 420, 6);
      }
    } else {
      sfx('heal');
      const b = this.basePos();
      pixRing(this, b.x, b.y + 10, 50, 0x7cf07a, 500, 8);
      pixRing(this, b.x, b.y + 10, 30, 0xffffff, 380, 8);
      starBurst(this, b.x, b.y - 10, 0x7cf07a, 6, 1, 9);
    }
  }

  // --- Pausa y resultado ---

  private openPause() {
    if (!this.ready || this.ended || this.overlay) return;
    this.paused = true;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(480, 320, 1600, 1000, 0x000000, 0.6).setInteractive();
    const g = this.add.graphics();
    drawBox(g, 300, 170, 360, 360, { radius: 16 });
    const t = this.add.text(480, 205, 'Pausa', { fontFamily: UI.FONT, fontSize: '30px', fontStyle: 'bold', color: NAVY }).setOrigin(0.5);
    c.add([dim, g, t]);
    this.overlay = c;
    this.overlayList = new MenuList(
      this,
      480,
      262,
      ['Continuar', 'Controles', 'Reiniciar nivel', 'Salir a los niveles'],
      (i) => {
        if (i === 0) return this.closePause();
        if (i === 1) return openControls(this);
        const go = () => (i === 2 ? this.restart() : this.toMaps());
        // Se pierde la partida en curso: se pregunta antes
        const asked = openConfirm(this, i === 2 ? '¿Reiniciar el nivel? Perderás esta partida.' : '¿Salir a los niveles? Perderás esta partida.', (yes) => {
          if (yes) go();
        });
        if (!asked) go();
      },
      { w: 300, h: 48, gap: 12, depth: 101 },
    );
    c.add(this.overlayList.container);
  }

  private closePause() {
    this.overlay?.destroy();
    this.overlay = null;
    this.overlayList = null;
    this.paused = false;
  }

  private restart() {
    goTo(this, 'TowerDefense', this.args);
  }

  private toMaps() {
    goTo(this, 'TowerDefenseMenu', { mapIdx: this.args.mapIdx, stage: 'levels' });
  }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    this.placing = null;
    this.selected = null;
    const o = this.td.outcome();
    const stars = starsFor(o.hp, o.maxHp, o.won);
    const rewards = submitTdOutcome({ mapId: this.map.id, level: this.args.level, waves: o.waves, won: o.won, stars });
    // Tickets y caramelos (nunca monedas)
    if (rewards.tickets > 0) addTickets(rewards.tickets);
    if (rewards.candies > 0) addCandies(rewards.candies);
    if (!o.won) {
      const b = this.basePos();
      pixBlast(this, b.x, b.y, 60, 0xff5a4a, 50);
      this.cameras.main.shake(400, 0.012);
    }
    this.time.delayedCall(o.won ? 700 : 1000, () => this.showResult(o.won, stars, o.waves, rewards));
  }

  private showResult(won: boolean, stars: number, waves: number, r: TdRewards) {
    sfx(won ? 'clear' : 'faint');
    const c = this.add.container(0, 0).setDepth(100);
    this.overlay = c;
    const dim = this.add.rectangle(480, 320, 1600, 1000, 0x000000, 0.65).setInteractive();
    const g = this.add.graphics();
    drawBox(g, 230, 86, 500, 486, { radius: 18 });
    // Cinta del título
    const endless = this.td.endless;
    const ribbon = this.add.graphics();
    const rc = endless ? 0x8a5ae0 : won ? 0x2ecc71 : 0xe53935;
    ribbon.fillStyle(0x18202c, 1).fillRect(236, 118, 18, 44).fillRect(706, 118, 18, 44);
    ribbon.fillStyle(darken(rc), 1).fillRect(240, 122, 12, 36).fillRect(708, 122, 12, 36);
    ribbon.fillStyle(0x18202c, 1).fillRect(250, 100, 460, 62);
    ribbon.fillStyle(rc, 1).fillRect(254, 104, 452, 54);
    ribbon.fillStyle(0xffffff, 0.25).fillRect(254, 104, 452, 6);
    ribbon.fillStyle(darken(rc), 1).fillRect(254, 152, 452, 6);
    const title = endless ? `¡Has llegado a la oleada ${waves}!` : won ? '¡Nivel superado!' : 'La base ha caído';
    const tt = this.add.text(480, 131, title, { fontFamily: UI.FONT, fontSize: '28px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setStroke('#18202c', 6);
    c.add([dim, g, ribbon, tt]);
    if (!endless) {
      for (let i = 0; i < 3; i++) {
        const on = i < stars;
        const s = tdIcon(this, 400 + i * 80, i === 1 ? 206 : 216, on ? 'star' : 'starOff', 0.1);
        c.add(s);
        this.tweens.add({
          targets: s,
          scale: i === 1 ? 7.5 : 6,
          duration: 320,
          delay: 300 + i * 260,
          ease: 'Back.easeOut',
          onStart: () => {
            if (on) sfx('coin');
          },
          onComplete: () => {
            if (on) starBurst(this, s.x, s.y, 0xffd34d, 6, 1.2, 102);
            // Las estrellas conseguidas laten un poco
            if (on && !lowFx()) this.tweens.add({ targets: s, scale: s.scale * 1.08, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.easeInOut' });
          },
        });
      }
    } else {
      const sk = tdIcon(this, 480, 214, 'skull', 6);
      c.add(sk);
    }
    const lines: string[] = [];
    lines.push(endless ? (r.newRecord ? '¡Nuevo récord en este mapa!' : 'Sin mejorar el récord') : `Oleadas superadas: ${waves}/${this.td.totalWaves}`);
    lines.push(`Vida de la base: ${this.td.hp}/${BASE_HP} · Derrotados: ${this.td.kills}`);
    const prize: string[] = [];
    if (r.tickets) prize.push(`+${r.tickets} tickets`);
    if (r.candies) prize.push(`+${r.candies} caramelos`);
    if (prize.length) lines.push(prize.join(' · '));
    if (r.newStars) lines.push(`¡${r.newStars} ${r.newStars === 1 ? 'estrella nueva' : 'estrellas nuevas'}! (premio extra)`);
    if (accountInfo().mode === 'guest') lines.push('Invitado: el progreso no se guarda al cerrar');
    const body = this.add
      .text(480, 266, lines.join('\n'), { fontFamily: UI.FONT, fontSize: '18px', color: NAVY, align: 'center', lineSpacing: 6 })
      .setOrigin(0.5, 0);
    c.add(body);
    if (won) confetti(this, 250, 710, 90, 101);
    const opts: { label: string; act: () => void }[] = [];
    const nextLevel = this.args.level + 1;
    if (won && !endless && nextLevel <= this.map.levels && isLevelUnlocked(loadTdProgress(), this.args.mapIdx, nextLevel)) {
      opts.push({ label: `Siguiente: nivel ${nextLevel}`, act: () => goTo(this, 'TowerDefense', { ...this.args, level: nextLevel }) });
    }
    opts.push({ label: 'Reintentar', act: () => this.restart() });
    opts.push({ label: 'Elegir nivel', act: () => this.toMaps() });
    this.overlayList = new MenuList(this, 480, 540 - (opts.length - 1) * 50, opts.map((o) => o.label), (i) => opts[i].act(), { w: 320, h: 42, gap: 8, fontSize: 20, depth: 101 });
    c.add(this.overlayList.container);
  }

  // --- Bucle ---

  update(time: number, delta: number) {
    if (!this.ready) return;
    this.readInput(delta);
    if (!this.paused && !this.ended && !this.overlay) {
      this.td.step((Math.min(delta, 100) / 1000) * SPEEDS[this.speedIdx]);
      for (const e of this.td.drainEvents()) this.onEvent(e);
      if (this.td.over) this.finish();
    }
    this.syncEnemies(time);
    this.syncTowers();
    this.syncShots();
    if (time - this.lastAmbient > 90) {
      this.lastAmbient = time;
      this.drawAmbient(time);
    }
    this.drawTowersLayer(time);
    this.drawOverlay(time);
    this.drawUi(time);
  }

  /** Dirección que se mantiene pulsada ahora (teclado y mando), para el cursor con repetición. */
  private heldDir(): { dx: number; dy: number } {
    const k = this.keys;
    const pad = this.input.gamepad?.getPad(0);
    const p = pad && pad.connected ? pad : null;
    const right = k.RIGHT.isDown || k.D.isDown || !!(p && (p.right || p.leftStick.x > 0.5));
    const left = k.LEFT.isDown || k.A.isDown || !!(p && (p.left || p.leftStick.x < -0.5));
    const down = k.DOWN.isDown || k.S.isDown || !!(p && (p.down || p.leftStick.y > 0.5));
    const up = k.UP.isDown || k.W.isDown || !!(p && (p.up || p.leftStick.y < -0.5));
    return { dx: (right ? 1 : 0) - (left ? 1 : 0), dy: (down ? 1 : 0) - (up ? 1 : 0) };
  }

  private readInput(delta: number) {
    const s = this.nav.read();
    const pb = this.pad.read();
    const J = Phaser.Input.Keyboard.JustDown;
    const k = this.keys;
    // Se leen siempre (si no, una pulsación vieja saltaría al abrir una torre)
    const num = [k.ONE, k.TWO, k.THREE, k.FOUR].findIndex((key) => J(key));
    if (this.overlayList) {
      this.repeat.update(0, 0, delta);
      if (this.paused && (s.back || s.pause)) return this.closePause();
      if (s.dy) this.overlayList.move(s.dy);
      if (s.ok) this.overlayList.activate();
      return;
    }
    if (this.ended) return;
    if (s.pause) return this.openPause();
    if (J(k.Z) || pb.has('LT')) this.useAbility('rayo');
    if (J(k.X) || pb.has('RT')) this.useAbility('ventisca');
    if (J(k.C) || pb.has('Y')) this.useAbility('curar');
    if (J(k.N) || pb.has('X')) this.callWave();
    if (J(k.F) || pb.has('R3')) this.cycleSpeed();
    if (J(k.Q) || pb.has('LB')) this.cycleTeam(-1);
    if (J(k.E) || pb.has('RB')) this.cycleTeam(1);
    if (s.back) return this.back();
    const d = this.heldDir();
    const step = this.repeat.update(d.dx, d.dy, delta);
    const f = this.focus;
    if (f.zone === 'panel') {
      const m = this.panelBtns.length;
      if (!m || !this.selectedTower()) {
        this.focus = { zone: 'grid' };
        return;
      }
      if (step.dy || step.dx) f.i = cycle(f.i, step.dy || step.dx, m);
      if (num >= 0 && num < m) this.pressPanel(num);
      else if (s.ok) this.pressPanel(f.i);
      return;
    }
    if (step.dx || step.dy) this.cursor = stepCursor(this.cursor, step.dx, step.dy, TD_COLS, TD_ROWS);
    if (s.ok) this.activateCell(this.cursor.x, this.cursor.y);
  }

  // --- Eventos del motor → efectos ---

  private onEvent(e: TdEvent) {
    const X = (x: number) => OX + x * CELL;
    const Y = (y: number) => OY + y * CELL;
    switch (e.t) {
      case 'fire': {
        const t = this.td.towers.find((q) => q.id === e.towerId);
        if (t && e.special) {
          const cx = sx(t.x) + CELL / 2;
          const cy = sy(t.y) + CELL / 2 - 12;
          pixFlash(this, cx, cy, 26, typeColor(t.mon.types[0]), 200, 30);
          this.floatText(cx, cy - 24, t.mega ? megaMoveOf(t.mon) : specialMoveOf(t.mon), t.mega ? '#ffb8f0' : '#ffe9a8', 13);
        }
        if (Math.random() < 0.2) sfx('shot');
        break;
      }
      case 'hit': {
        const x = X(e.x);
        const y = Y(e.y) - 8;
        if (!lowFx() || e.special) typeImpact(this, x, y, e.type, e.special ? 1.3 : 0.7, e.special ? 12 : 4, 30);
        if (e.splash > 0) pixRing(this, x, y + 6, e.splash * CELL, typeColor(e.type), 300, 7);
        if (e.special) pixBlast(this, x, y, 28, typeColor(e.type), 31);
        // Números: siempre los críticos, súper eficaces y especiales; los normales, uno de cada tres (para no tapar el mapa)
        if (e.mul >= 2 || e.crit || e.special || (!lowFx() && Math.random() < 0.34)) {
          damageNumber(this, x, y - 14, e.dmg, {
            crit: e.crit || e.special,
            color: e.mul >= 2 ? '#ffd34d' : e.mul < 1 ? '#9aa4b8' : e.shielded ? '#8fd0ff' : undefined,
            depth: 50,
          });
        }
        if (e.mul >= 2 && Math.random() < 0.2) this.floatText(x, y - 36, '¡Súper eficaz!', '#ffd34d', 12);
        break;
      }
      case 'chain':
        for (let i = 1; i < e.pts.length; i++) pixBolt(this, X(e.pts[i - 1].x), Y(e.pts[i - 1].y) - 8, X(e.pts[i].x), Y(e.pts[i].y) - 8, typeColor(e.type), 32);
        break;
      case 'kill': {
        const x = X(e.x);
        const y = Y(e.y) - (e.air ? 26 : 8);
        pixDebris(this, x, y, 0xffffff, e.boss ? 24 : 8, e.boss ? 2 : 1, 30);
        this.floatMoney(x, y - 10, e.money);
        if (e.boss) {
          sfx('roar');
          pixBlast(this, x, y, 70, 0xffd34d, 31);
          starBurst(this, x, y, 0xffd34d, 10, 1.6, 32);
          this.cameras.main.shake(320, 0.01);
          this.toast('¡Has vencido al jefe legendario!', 'reward');
        } else sfx('hit');
        break;
      }
      case 'leak': {
        sfx('hurt');
        this.baseFlash = 260;
        const b = this.basePos();
        damageNumber(this, b.x, b.y - 30, e.dmg, { color: '#ff5a4a', depth: 50 });
        hitSpark(this, b.x, b.y - 6, 0xff5a4a, 8, 1.2, 31);
        this.cameras.main.shake(140, 0.004);
        break;
      }
      case 'heal':
        if (!e.base && !lowFx()) damageNumber(this, X(e.x), Y(e.y) - 22, e.amount, { heal: true, depth: 50 });
        break;
      case 'shieldBreak':
        pixDebris(this, X(e.x), Y(e.y) - 8, 0x8fd0ff, 10, 1, 31);
        hitSpark(this, X(e.x), Y(e.y) - 8, 0x8fd0ff, 6, 1, 31);
        break;
      case 'bossPhase':
        sfx('enrage');
        phaseShock(this, X(e.x), Y(e.y), 0xff5a4a, 1.4, 30);
        this.toast(e.phase === 2 ? '¡El jefe llama a su escolta!' : '¡El jefe se enfurece y recupera el escudo!', 'danger');
        break;
      case 'waveStart':
        sfx(e.boss ? 'roar' : 'door');
        this.toast(e.boss ? `Oleada ${e.wave}: ¡jefe legendario!` : `Oleada ${e.wave}`, e.boss ? 'danger' : 'info');
        for (const c of entryCells(this.map)) pixRing(this, sx(c.x) + CELL / 2, sy(c.y) + CELL / 2, 36, 0xb08aff, 500, 5);
        if (e.wave >= 2) showTdTip(this, 'td_skills');
        break;
      case 'waveEnd':
        sfx('clear');
        this.toast(`Oleada superada: +${e.bonus} $${e.perfect ? ' (sin fugas)' : ''}${e.farm ? ` · granjas +${e.farm} $` : ''}`, 'reward');
        break;
      case 'farm': {
        const t = this.td.towers.find((q) => q.id === e.towerId);
        if (t) {
          const cx = sx(t.x) + CELL / 2;
          const cy = sy(t.y);
          this.floatMoney(cx, cy, e.amount);
          if (!lowFx()) starBurst(this, cx, cy + 10, 0xffd34d, 4, 0.8, 30);
        }
        break;
      }
      case 'evolve': {
        const t = this.td.towers.find((q) => q.id === e.towerId);
        const v = this.towerViews.get(e.towerId);
        if (t) {
          sfx('evolve');
          const cx = sx(t.x) + CELL / 2;
          const cy = sy(t.y) + CELL / 2;
          const done = () => {
            if (!v || !v.spr.active) return;
            this.setTowerSprite(v, t.evolved ?? t.mon.id);
            evolveBurst(this, cx, cy - 12, cy + 8);
          };
          if (lowFx() || !v) done();
          else {
            evolveGlow(this, v.spr, 900, 35);
            this.time.delayedCall(900, done);
          }
          const evoName = t.evolved ? this.names.get(t.evolved) : null;
          this.toast(
            t.evolved
              ? `¡${t.mon.name} evoluciona${evoName ? ` en ${evoName}` : ''}! Ataque: ${specialMoveOf(t.mon)}`
              : `¡${t.mon.name}: nivel final! Ataque: ${specialMoveOf(t.mon)}`,
            'reward',
          );
        }
        break;
      }
      case 'mega':
        this.onMega(e.towerId);
        break;
      default:
        break;
    }
  }

  /** Nivel 6: destello de megaevolución (megaFx) y cambio al sprite de la forma mega de PokeAPI si lo hay. */
  private onMega(towerId: number) {
    const t = this.td.towers.find((q) => q.id === towerId);
    if (!t || t.mega === null) return;
    const v = this.towerViews.get(towerId);
    const cx = sx(t.x) + CELL / 2;
    const cy = sy(t.y) + CELL / 2;
    sfx('evolve');
    const ms = towerMegaFx(this, cx, cy - 8, cy + 16, typeColor(t.mon.types[0]), 40);
    if (v && !lowFx()) evolveGlow(this, v.spr, ms * 0.7, 35);
    const species = t.mega;
    const name = this.names.get(species) ?? (t.evolved ? null : t.mon.name);
    this.toast(`¡${name ? `Mega ${name}` : `${t.mon.name} megaevoluciona`}! Ataque: ${megaMoveOf(t.mon)}`, 'reward');
    const form = megaSpriteName(species);
    const key = `tdmega-${species}`;
    const swap = () => {
      const view = this.towerViews.get(towerId);
      if (!view || !view.spr.active || !this.textures.exists(key)) return;
      view.spr.anims.stop();
      view.pmd = false;
      view.id = -species;
      view.spr.setTexture(key).setScale((46 / Math.max(1, view.spr.width)) * 1.5);
    };
    if (!form) return;
    const loaded = this.textures.exists(key)
      ? Promise.resolve(true)
      : fetchFormSprites(form).then(
          (sp) =>
            new Promise<boolean>((res) => {
              if (!sp?.front || !this.scene.isActive()) return res(false);
              this.load.image(key, sp.front);
              this.load.once(Phaser.Loader.Events.COMPLETE, () => res(this.textures.exists(key)));
              this.load.start();
            }),
        );
    void loaded.then((ok) => {
      if (ok) this.time.delayedCall(Math.max(0, ms * 0.73), swap);
    });
  }

  private floatText(x: number, y: number, text: string, color: string, size = 14) {
    const t = this.add.text(x, y, text, { fontFamily: UI.FONT, fontSize: `${size}px`, fontStyle: 'bold', color }).setOrigin(0.5).setStroke('#18202c', 4).setDepth(52);
    this.tweens.add({ targets: t, y: y - 22, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  private floatMoney(x: number, y: number, n: number) {
    const coin = tdIcon(this, x - 14, y, 'coin', 2).setDepth(52);
    const t = this.add.text(x - 6, y, `+${n}`, { fontFamily: UI.FONT, fontSize: '14px', fontStyle: 'bold', color: '#ffd34d' }).setOrigin(0, 0.5).setStroke('#18202c', 4).setDepth(52);
    this.tweens.add({
      targets: [coin, t],
      y: y - 26,
      alpha: 0,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => {
        coin.destroy();
        t.destroy();
      },
    });
  }

  // --- Sprites ---

  private basePos() {
    const b = baseCell(this.map);
    return { x: sx(b.x) + CELL / 2, y: sy(b.y) + CELL / 2 };
  }

  private enemyPos(e: TdEnemy) {
    return { x: OX + e.x * CELL, y: OY + e.y * CELL - (e.def.air ? 26 : 6) };
  }

  private syncEnemies(time: number) {
    const alive = new Set<number>();
    for (const e of this.td.enemies) {
      alive.add(e.id);
      let v = this.enemyViews.get(e.id);
      if (!v) {
        v = this.makeEnemyView(e);
        this.enemyViews.set(e.id, v);
      }
      const p = this.enemyPos(e);
      // Voladores: siguen el camino por encima, con un vuelo suave (sube y baja, se mece) y la sombra en el suelo,
      // separada del cuerpo, que se encoge y se aclara cuando sube
      const fly = e.def.air && !lowFx() ? Math.sin(time / 200 + v.bob) : 0;
      const bob = fly * 5;
      v.spr.setPosition(p.x, p.y + bob).setDepth(10 + e.y + (e.def.air ? 20 : 0));
      if (e.def.air) v.spr.setRotation(lowFx() ? 0 : Math.sin(time / 330 + v.bob) * 0.08);
      v.shadow.setPosition(p.x, OY + e.y * CELL + 10).setDepth(2);
      if (e.def.air) v.shadow.setScale(1 + fly * 0.12).setAlpha(0.85 + fly * 0.15);
      const row = dir8Row(e.dx, e.dy, v.row);
      if (row !== v.row && v.pmd) {
        v.row = row;
        v.spr.anims.play(pmdAnimKey(e.def.species, 'walk', row), true);
      }
      if (!v.pmd) v.spr.setFlipX(e.dx > 0);
      if (v.pmd) v.spr.anims.timeScale = this.paused || this.ended || e.frozen > 0 ? 0 : SPEEDS[this.speedIdx] * (e.slowLeft > 0 ? e.slowMul : 1);
      if (e.frozen > 0) v.spr.setTint(0x9fe0ff);
      else if (e.slowLeft > 0) v.spr.setTint(0xb8c8ff);
      else v.spr.clearTint();
    }
    for (const [id, v] of this.enemyViews) {
      if (alive.has(id)) continue;
      this.enemyViews.delete(id);
      v.shadow.destroy();
      if (lowFx()) v.spr.destroy();
      else this.tweens.add({ targets: v.spr, alpha: 0, scaleY: v.spr.scaleY * 0.2, duration: 220, onComplete: () => v.spr.destroy() });
    }
  }

  private makeEnemyView(e: TdEnemy): EnemyView {
    const boss = e.def.kind === 'boss';
    const size = boss ? 78 : e.def.kind === 'tank' ? 50 : e.def.kind === 'fast' ? 36 : 42;
    const sheet = this.sheets.get(e.def.species);
    let spr: Phaser.GameObjects.Sprite;
    const row = dir8Row(e.dx, e.dy, 2);
    if (sheet) {
      spr = this.add.sprite(0, 0, pmdKey(e.def.species, 'walk'), 0).setScale(pmdScale(size) * 1.25);
      spr.anims.play(pmdAnimKey(e.def.species, 'walk', row));
    } else {
      const key = this.staticKey(e.def.species);
      spr = this.add.sprite(0, 0, key);
      spr.setScale((size / Math.max(1, spr.width)) * (key === tdIconKey('ball') ? 0.7 : 1.4));
    }
    spr.setOrigin(0.5, 0.62);
    const shadow = this.add.ellipse(0, 0, size * (e.def.air ? 0.45 : 0.7), size * 0.22, 0x000000, e.def.air ? 0.18 : 0.3);
    if (boss) {
      bossAura(this, spr, typeColor(e.def.types[0]), () => OY + e.y * CELL + 8, 3);
      phaseShock(this, OX + e.x * CELL, OY + e.y * CELL, typeColor(e.def.types[0]), 1.2, 30);
    }
    return { spr, shadow, row, pmd: !!sheet, bob: Math.random() * 6 };
  }

  private setTowerSprite(v: TowerView, id: number) {
    const sheet = this.sheets.get(id);
    v.id = id;
    if (sheet) {
      const anim = sheet.hasIdle ? 'idle' : 'walk';
      v.spr.setTexture(pmdKey(id, anim), 0).setScale(pmdScale(46) * 1.3);
      v.spr.anims.play(pmdAnimKey(id, anim, v.row), true);
      v.pmd = true;
    } else {
      v.spr.anims.stop();
      const key = this.staticKey(id);
      v.spr.setTexture(key);
      v.spr.setScale((46 / Math.max(1, v.spr.width)) * (key === tdIconKey('ball') ? 0.7 : 1.4));
      v.pmd = false;
    }
  }

  private syncTowers() {
    const alive = new Set<number>();
    for (const t of this.td.towers) {
      alive.add(t.id);
      let v = this.towerViews.get(t.id);
      const cx = sx(t.x) + CELL / 2;
      const cy = sy(t.y) + CELL / 2;
      if (!v) {
        const spr = this.add.sprite(cx, cy, '__MISSING').setOrigin(0.5, 0.7);
        v = { spr, row: 0, id: 0, pmd: false };
        this.setTowerSprite(v, t.evolved ?? t.mon.id);
        this.towerViews.set(t.id, v);
        if (!lowFx()) {
          const s0x = spr.scaleX;
          const s0y = spr.scaleY;
          spr.setScale(s0x * 0.2, s0y * 1.6);
          this.tweens.add({ targets: spr, scaleX: s0x, scaleY: s0y, duration: 260, ease: 'Back.easeOut' });
        }
      }
      v.spr.setPosition(cx, cy + 6).setDepth(10 + t.y + 0.5);
      const row = dir8Row(Math.cos(t.facing), Math.sin(t.facing), v.row);
      if (row !== v.row) {
        v.row = row;
        if (v.pmd) {
          const sheet = this.sheets.get(v.id)!;
          v.spr.anims.play(pmdAnimKey(v.id, sheet.hasIdle ? 'idle' : 'walk', row), true);
        } else v.spr.setFlipX(Math.cos(t.facing) > 0);
      }
      if (v.pmd) v.spr.anims.timeScale = this.paused || this.ended ? 0 : 1;
    }
    for (const [id, v] of this.towerViews) {
      if (alive.has(id)) continue;
      this.towerViews.delete(id);
      v.spr.destroy();
    }
  }

  private syncShots() {
    const alive = new Set<number>();
    for (const s of this.td.shots) {
      alive.add(s.id);
      let img = this.shotViews.get(s.id);
      if (!img) {
        img = this.add.image(0, 0, projKey(s.type)).setScale(s.special ? 4.2 : 2.6).setDepth(36);
        this.shotViews.set(s.id, img);
      }
      const x = OX + s.x * CELL;
      const y = OY + s.y * CELL - 10;
      img.setPosition(x, y).setRotation(projRotation(s.type, Math.atan2(s.ty - s.y, s.tx - s.x)));
      if (!lowFx() && !this.paused && (s.special || Math.random() < 0.3)) typeTrail(this, x, y, s.type, s.special ? 1.2 : 0.7, 35);
    }
    for (const [id, img] of this.shotViews) {
      if (alive.has(id)) continue;
      this.shotViews.delete(id);
      img.destroy();
    }
  }

  // --- Capas dibujadas ---

  private drawAmbient(t: number) {
    const g = this.ambient;
    g.clear();
    drawFlow(g, this.map, this.map.biome, GEO, t);
    drawDecor(g, this.map.biome, this.decor, t);
    for (const c of entryCells(this.map)) drawPortal(g, sx(c.x) + CELL / 2, sy(c.y) + CELL / 2, 0xb08aff, t);
    const b = this.basePos();
    drawBase(g, b.x, b.y, t, this.td.hp / this.td.maxHp, this.baseFlash);
  }

  private drawTowersLayer(t: number) {
    const g = this.towerG;
    g.clear();
    for (const tw of this.td.towers) {
      const cx = sx(tw.x) + CELL / 2;
      const cy = sy(tw.y) + CELL / 2 + 10;
      drawPedestal(g, cx, cy, RARITY_COLORS[tw.mon.rarity], tw.level, tw.branch, tw.id === this.selected, t);
      if (tw.level >= MEGA_LEVEL) drawMegaAura(g, cx, cy - 2, typeColor(tw.mon.types[0]), t);
      else if (tw.level >= MAX_TOWER_LEVEL) drawAura(g, cx, cy - 2, typeColor(tw.mon.types[0]), t, tw.evolved !== null);
    }
  }

  private drawOverlay(t: number) {
    const g = this.overG;
    g.clear();
    this.baseFlash = Math.max(0, this.baseFlash - 16);
    const still = lowFx();
    // Barras de vida, escudo y marcas de los enemigos
    for (const e of this.td.enemies) {
      const v = this.enemyViews.get(e.id);
      if (!v) continue;
      const boss = e.def.kind === 'boss';
      const w = boss ? 64 : 30;
      const x = Math.round(v.spr.x - w / 2);
      const y = Math.round(v.spr.y - (boss ? 58 : 32));
      const r = e.hp / e.def.maxHp;
      drawBar(g, x, y, w, boss ? 6 : 4, r, r > 0.5 ? 0x4cd964 : r > 0.25 ? 0xffcc00 : 0xff3b30);
      if (e.maxShield > 0 && e.shield > 0) drawBar(g, x, y - (boss ? 7 : 5), w, boss ? 4 : 3, e.shield / e.maxShield, 0x5ab4ff, 0x18304a);
      const k = e.def.kind as EnemyKind;
      if (k === 'healer') {
        const pulse = still ? 1 : (Math.sin(t / 200 + e.id) + 1) / 2;
        g.fillStyle(0x18202c, 1).fillRect(x + w + 2, y - 4, 9, 9);
        g.fillStyle(0x7cf07a, 0.6 + 0.4 * pulse).fillRect(x + w + 5, y - 3, 3, 7).fillRect(x + w + 3, y - 1, 7, 3);
        if (!still) g.lineStyle(2, 0x7cf07a, 0.22 * pulse).strokeCircle(v.spr.x, v.spr.y + 6, 2.2 * CELL * (0.55 + 0.45 * pulse));
      } else if (k === 'hastener' && !still) {
        for (let i = 0; i < 3; i++) {
          const a = t / 300 + (i * Math.PI * 2) / 3;
          g.fillStyle(0xffd34d, 0.85).fillRect(Math.round(v.spr.x + Math.cos(a) * 20) - 2, Math.round(v.spr.y + 10 + Math.sin(a) * 7) - 2, P + 1, P + 1);
        }
      } else if (k === 'shielded' && e.shield > 0) {
        g.lineStyle(2, 0x8fd0ff, 0.5 + (still ? 0 : 0.3 * Math.sin(t / 150))).strokeEllipse(v.spr.x, v.spr.y - 2, 40, 44);
      }
      if (e.def.air) {
        g.fillStyle(0x18202c, 1).fillRect(x - 12, y - 3, 10, 9);
        g.fillStyle(0xffffff, 1).fillRect(x - 11, y - 2, 3, 2).fillRect(x - 9, y, 4, 2).fillRect(x - 7, y + 2, 4, 2);
      }
      if (e.haste > 0 && !still && Math.random() < 0.06) typeTrail(this, v.spr.x, v.spr.y + 6, 'electric', 0.6, 9);
    }
    // Barra de vida de la base
    const b = this.basePos();
    drawBar(g, b.x - 26, b.y - 42, 52, 6, this.td.hp / this.td.maxHp, 0x4cd964);
    // Alcance de la torre elegida y fantasma al colocar
    const sel = this.selectedTower();
    if (sel) drawRange(g, sx(sel.x) + CELL / 2, sy(sel.y) + CELL / 2, this.td.statsOf(sel).range * CELL, true, t);
    // Un solo cursor para todo: lo mueven las flechas, la cruceta o el ratón (en táctil, solo con el dedo encima)
    const touch = currentInput() === 'touch';
    const target = touch ? this.hover : this.cursor;
    if (this.placing !== null && !this.ended) {
      const m = this.td.team[this.placing];
      // Casillas libres en verde suave
      for (const c of this.freeCells) {
        if (this.td.towerAt(c.x, c.y)) continue;
        g.fillStyle(0x7cf07a, 0.08 + (still ? 0 : 0.05 * Math.sin(t / 220))).fillRect(sx(c.x) + 3, sy(c.y) + 3, CELL - 6, CELL - 6);
      }
      if (target) {
        const ok = !this.td.placeError(this.placing, target.x, target.y);
        drawRange(g, sx(target.x) + CELL / 2, sy(target.y) + CELL / 2, towerStats(m, 1, null).range * CELL, ok, t);
        g.fillStyle(ok ? 0x7cf07a : 0xff5a4a, 0.35).fillRect(sx(target.x), sy(target.y), CELL, CELL);
      }
    }
    if (!touch && this.focus.zone === 'grid' && !this.overlay && !this.ended) drawCursor(g, sx(this.cursor.x), sy(this.cursor.y), CELL, this.placing !== null ? 0x7cf07a : 0xffd34d, t);
  }

  private drawUi(t: number) {
    const g = this.uiG;
    g.clear();
    const game = this.td;
    const dev = currentInput() as TdDevice;
    const hr = game.hp / game.maxHp;
    drawBar(g, 46, 24, 96, 12, hr, hr > 0.5 ? 0x4cd964 : hr > 0.25 ? 0xffcc00 : 0xff3b30);
    this.hud.hp.setText(`${game.hp}/${game.maxHp}`);
    this.hud.money.setText(`${game.money}`);
    this.hud.wave.setText(game.endless ? `Oleada ${Math.max(1, game.wave)}` : `Oleada ${Math.max(1, game.wave)}/${game.totalWaves}`);
    this.hud.next.setText(game.phase === 'prep' ? `Llega en ${Math.max(0, Math.ceil(game.prepLeft))} s` : game.phase === 'wave' ? `${game.enemies.length} en el mapa` : '');
    // Equipo
    this.teamBtns.forEach((b, i) => {
      const m = game.team[i];
      const afford = game.money >= towerCost(m);
      const full = game.placedOf(i) >= game.limitOf(i);
      const on = this.placing === i;
      const foc = !on && this.placing === null && this.teamSel === i;
      g.fillStyle(0x18202c, 1).fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
      g.fillStyle(on ? 0xffd34d : full ? 0x8a90a0 : afford ? 0xe8ecf4 : 0xc8ccd4, 1).fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle(0xffffff, 0.5).fillRect(b.x, b.y, b.w, 3);
      g.fillStyle(RARITY_COLORS[m.rarity], 1).fillRect(b.x, b.y + b.h - 4, b.w, 4);
      for (let q = 0; q < game.limitOf(i); q++) g.fillStyle(q < game.placedOf(i) ? 0x2e86de : 0xb8bcc6, 1).fillRect(b.x + 4 + q * 8, b.y + 5, 6, 6);
      if (foc) g.lineStyle(2, 0xffd34d, 0.8).strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
      b.icon?.setAlpha(afford && !full ? 1 : 0.45);
      b.text?.setColor(afford ? NAVY : '#a04040');
    });
    // Barra de abajo
    this.barBtns.forEach((b, i) => {
      const foc = false;
      if (i < 3) {
        const id = ABILITIES[i];
        const left = game.cooldowns[id];
        drawAbilityFrame(g, b.x, b.y, b.w, ABILITY_INFO[id].color, 1 - left / ABILITY_INFO[id].cooldown, foc, t);
        this.cdTexts[i].setText(left > 0 ? `${Math.ceil(left)}` : '');
        b.icon?.setAlpha(left > 0 ? 0.45 : 1);
      } else {
        const en = b.enabled();
        g.fillStyle(0x18202c, 1).fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
        const base = i === 3 ? (en ? 0x7cf07a : 0xb8bcc6) : 0xe8ecf4;
        g.fillStyle(foc ? 0xffd34d : base, 1).fillRect(b.x, b.y, b.w, b.h);
        g.fillStyle(0xffffff, 0.5).fillRect(b.x, b.y, b.w, 3);
        const key = (a: TdKeyAction) => (tdKeyLabel(a, dev) ? ` [${tdKeyLabel(a, dev)}]` : '');
        if (i === 4) b.text?.setText(`x${SPEEDS[this.speedIdx]}${key('speed')}`);
        if (i === 5) b.text?.setText(`Pausa${key('pause')}`);
        if (i === 3) {
          b.text?.setText(game.phase === 'prep' ? `Oleada ya (+${Math.max(0, Math.floor(game.prepLeft))} $)${key('wave')}` : game.phase === 'wave' ? 'Oleada en curso' : '—');
          // Flecha que empuja cuando se puede llamar
          if (en && !lowFx()) {
            const k = Math.floor(t / 200) % 3;
            g.fillStyle(0x2e6a2c, 1).fillRect(b.x + b.w - 14 + k * 2, b.y + 12, 3, 9).fillRect(b.x + b.w - 11 + k * 2, b.y + 14, 3, 5);
          }
        }
      }
    });
    this.updatePanel(g);
    this.updateHelp(dev);
  }

  /** Teclas de los botones, cabecera del equipo y barra de ayuda (solo se reescriben si cambian). */
  private updateHelp(dev: TdDevice) {
    const tw = this.selectedTower();
    const ctx: TdHelpContext = tw
      ? { kind: 'tower', actions: this.panelBtns.length }
      : this.placing !== null
        ? { kind: 'placing', name: this.td.team[this.placing].name, cost: towerCost(this.td.team[this.placing]), canPlace: this.td.money >= towerCost(this.td.team[this.placing]) }
        : { kind: 'idle' };
    const key = `${dev}|${JSON.stringify(ctx)}`;
    if (key === this.helpKey) return;
    this.helpKey = key;
    const lines = tdHelp(dev, ctx);
    this.help.forEach((t, i) => {
      t.setScale(1).setText(lines[i]);
      // Que no se salga de la barra
      if (t.width > 362) t.setScale(362 / t.width, 1);
    });
    for (const { t, a } of this.keyTexts) t.setText(tdKeyLabel(a, dev));
    const prev = tdKeyLabel('prev', dev);
    const next = tdKeyLabel('next', dev);
    this.teamHead.setText(prev ? `${prev} ◀ Tu equipo ▶ ${next}` : 'Tu equipo');
  }

  private updatePanel(g: Phaser.GameObjects.Graphics) {
    const tw = this.selectedTower();
    const key = tw ? `t${tw.id}-${tw.level}-${tw.branch}-${tw.targeting}-${tw.evolved}-${tw.mega}` : this.placing !== null ? `p${this.placing}` : `i${this.td.wave}-${this.td.phase}`;
    if (key !== this.panelKey) {
      this.panelKey = key;
      this.rebuildPanel(tw);
    }
    g.fillStyle(0x18202c, 0.1).fillRect(PANEL_X + 8, 264, 148, 322);
    this.panelBtns.forEach((b, i) => {
      const en = b.enabled();
      const foc = this.focus.zone === 'panel' && this.focus.i === i && currentInput() !== 'mouse' && currentInput() !== 'touch';
      g.fillStyle(0x18202c, 1).fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
      g.fillStyle(foc ? 0xffd34d : en ? b.color ?? 0xe8ecf4 : 0xb8bcc6, 1).fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle(0xffffff, 0.45).fillRect(b.x, b.y, b.w, 3);
    });
    if (tw && this.panelTexts[1]) {
      const s = this.td.statsOf(tw);
      this.panelTexts[1].setText(
        `${STYLE_LABEL[s.style]} · ${tw.mon.types.map(typeNameEs).join('/')}\nDaño ${s.damage}  Cad. ${s.rate}/s\nAlcance ${s.range.toFixed(1)}${s.air ? ' · aéreo' : ''}\n${s.income ? `Granja: +${s.income} $/oleada\n` : ''}Derrotados: ${tw.kills}`,
      );
    }
  }

  private rebuildPanel(tw: TdTower | undefined) {
    for (const o of this.panelTexts) o.destroy();
    for (const b of this.panelBtns) {
      b.text?.destroy();
      b.zone.destroy();
    }
    this.panelTexts = [];
    this.panelBtns = [];
    const x = PANEL_X + 12;
    const y0 = 268;
    const txt = (y: number, s: string, size = 14, color = NAVY, bold = false) => {
      const t = this.add
        .text(x, y, s, { fontFamily: UI.FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color, wordWrap: { width: 140 }, lineSpacing: 2 })
        .setDepth(62);
      this.panelTexts.push(t);
      return t;
    };
    if (tw) {
      const base = tw.evolved ? this.names.get(tw.evolved) ?? tw.mon.name : tw.mon.name;
      const name = tw.mega !== null ? `Mega ${base}` : base;
      txt(y0, `${shorten(name, 13)}\n${levelLabel(tw.level, tw.evolved !== null)}`, 15, NAVY, true);
      showTdTip(this, 'td_upgrade');
      txt(y0 + 40, '', 12);
      let by = y0 + 130;
      // Acciones numeradas: la tecla 1-4 hace la de su número
      const btn = (label: string, act: () => void, en: () => boolean, color?: number, h = 34) => {
        this.panelBtns.push(this.makeBtn(x, by, 140, h, `${this.panelBtns.length + 1} · ${label}`, act, en, 12, color));
        by += h + 8;
      };
      const cost = this.td.upgradeCost(tw);
      if (cost === null) {
        txt(by, 'Nivel máximo', 13, '#b8860b', true);
        by += 24;
      } else if (tw.level + 1 === BRANCH_LEVEL && !tw.branch) {
        const style = towerStats(tw.mon, 1, null).style;
        const a = branchInfo(style, 'a');
        const bb = branchInfo(style, 'b');
        txt(by - 18, `Rama (${cost} $):`, 12, NAVY, true);
        btn(`${a.name}\n${a.desc}`, () => this.doUpgrade('a'), () => this.td.money >= cost, 0xffb0a8, 50);
        btn(`${bb.name}\n${bb.desc}`, () => this.doUpgrade('b'), () => this.td.money >= cost, 0xa8d0ff, 50);
        for (const b of this.panelBtns) b.text?.setWordWrapWidth(132).setFontSize(10);
      } else {
        const evo = tw.level + 1 === MEGA_LEVEL ? '\nMegaevoluciona' : tw.level + 1 === MAX_TOWER_LEVEL ? (tw.mon.evolveId ? '\nEvoluciona' : '\nAura final') : '';
        btn(`Mejorar · ${cost} $${evo}`, () => this.doUpgrade(), () => this.td.money >= cost, 0xb8f0c8, evo ? 40 : 34);
      }
      btn(`Objetivo: ${TARGETING_LABEL[tw.targeting]}`, () => this.td.cycleTargeting(tw.id), () => true);
      btn(`Vender · +${this.td.sellValue(tw)} $`, () => this.doSell(), () => true, 0xffe0a0);
      if (this.focus.zone === 'panel') this.focus.i = Math.min(this.focus.i, this.panelBtns.length - 1);
      return;
    }
    if (this.focus.zone === 'panel') this.focus = { zone: 'grid' };
    if (this.placing !== null) {
      const m = this.td.team[this.placing];
      const s = towerStats(m, 1, null);
      txt(y0, shorten(m.name, 14), 16, NAVY, true);
      txt(
        y0 + 24,
        `${STYLE_LABEL[s.style]} · ${m.types.map(typeNameEs).join('/')}\nCoste ${towerCost(m)} $\nDaño ${s.damage}  Cad. ${s.rate}/s\nAlcance ${s.range.toFixed(1)}${s.air ? ' · aéreo' : ''}${s.income ? `\nGranja: +${s.income} $/oleada` : ''}\n\nColocados ${this.td.placedOf(this.placing)}/${this.td.limitOf(this.placing)}\n\nElige una casilla libre: mira la ayuda de abajo.`,
        12,
      );
      return;
    }
    // Sin nada elegido: lo que trae la oleada
    const next = this.td.phase === 'wave' ? this.td.wave : this.td.wave + 1;
    if (this.td.over) return;
    const spawns = waveSpawns(this.map, this.args.level, Math.max(1, next));
    const count = new Map<EnemyKind, number>();
    for (const s of spawns) count.set(s.kind, (count.get(s.kind) ?? 0) + 1);
    txt(y0, this.td.phase === 'wave' ? `Oleada ${next}` : `Próxima: oleada ${next}`, 15, NAVY, true);
    const lines = [...count.entries()].map(([k, n]) => `${ENEMY_KIND_LABEL[k]}: ${n}`);
    txt(y0 + 24, lines.join('\n'), 13);
    if (count.get('flying')) {
      showTdTip(this, 'td_air');
      txt(y0 + 34 + lines.length * 17, '¡Voladores! Solo los alcanzan Volador, Eléctrico, Psíquico, Dragón, Fantasma, Hada y Hielo (o la rama Táctica).', 11, '#a04040');
    }
  }
}

function fromBst(bst: number): BaseStats {
  const v = Math.round(Math.max(30, bst) / 6);
  return { hp: v, attack: v, defense: v, spAttack: v, spDefense: v, speed: v };
}

const darken = (c: number) =>
  (Math.round(((c >> 16) & 255) * 0.65) << 16) | (Math.round(((c >> 8) & 255) * 0.65) << 8) | Math.round((c & 255) * 0.65);
