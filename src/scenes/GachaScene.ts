import Phaser from 'phaser';
import { DARK_GACHA_ODDS, rollDark } from '../data/darkMon';
import { addHelpBar } from '../ui/helpBar';
import { DCX, DCY, COVER_W, COVER_H, fitDesign } from '../ui/layout';
import { fetchPokemonCard, type PokemonCard } from '../data/pokeapi';
import {
  dayNumber, PULL10_COST, PULL_COST, RARITIES, RARITY_LABEL, type PullResult, type Rarity, type RarityPools,
} from '../data/gacha';
import {
  ALL_BANNER, BANNERS, bannerById, bannerIndex, bannerProgress, bannerTop, buildBannerPools, effectiveRates, featuredOf, FORMS_BANNER,
  formsProgress, loadBannerState, PITY, pityLeft, pityOf, poolIds, pullBanner, rememberBanner, saveBannerState,
} from '../data/gachaBanners';
import { FORM_REGIONS, FORM_REGION_LABEL } from '../data/regionalForms';
import { loadHistory, pushHistory, type HistoryEntry } from '../data/gachaHistory';
import { loadCollectionIndex } from '../data/speciesIndex';
import { openConfirm } from './ConfirmScene';
import { confirmText } from '../data/confirm';
import { addDark, addShiny, addTickets, loadShinies, loadTickets, loadUnlocked, spendTickets, unlockPokemon } from '../data/save';
import { rollShiny, SHINY_ODDS } from '../data/shiny';
import { takeKonamiShiny } from '../data/easterEggs';
import { sparkle } from '../ui/sparkle';
import { typeColor, typeNameEs } from '../data/types';
import { cry, sfx } from '../ui/audio';
import { ARROW, addTypeChip, drawBox, fadeIn, FONT, goTo, hex, RARITY_COLORS } from '../ui/theme';
import { fitTextLine, setFitLine } from '../ui/fitText';
import { addMenuBackdrop } from '../ui/art/landscape';
import { NavInput, PadButtons } from '../ui/nav';
import { bakeBannerArt, bannerKey } from '../ui/art/bannerArt';
import { BANNER_COLORS } from '../ui/art/bannerEmblems';
import { addBurst, addMachineIdle, addRays, bakeGachaArt, ballKey, CRANK_KEY, MACHINE, MACHINE_KEY } from '../ui/art/gachaMachine';

/** Tickets que devuelve una tirada repetida. */
/** Tickets que devuelve un repetido: menos que una tirada (si no, tirar daría tickets gratis). */
const DUPLICATE_REFUND = Math.max(1, Math.round(PULL_COST * 0.3));
const BTN = { w: 176, h: 50, y: 470, gap: 14 };
/** Máquina: posición (diseño 960×640) y escala de sus píxeles. */
const MAC = { x: 190, y: 330, s: 3 };
const RANK = (r: Rarity) => RARITIES.indexOf(r);

type Phase = 'menu' | 'anim' | 'result';
/** Ficha del banner (diseño 960×640): arriba a la derecha, con las pestañas de los banners abajo. */
const CARD = { x: 380, y: 104, w: 564, h: 170, tabY: 252, tabGap: 46 };
/** Distancia mínima (px) para que un deslizamiento en la ficha cambie de banner (táctil). */
const SWIPE = 50;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Una tirada ya resuelta (y ya guardada) lista para enseñarse. */
interface Reveal {
  res: PullResult;
  shiny: boolean;
  duplicate: boolean;
  note: string;
  card?: PokemonCard;
  key?: string;
}

/**
 * Gacha con máquina de bolas (supervisor): tirada x1 o x10 (con épico o mejor garantizado), la bola de la rareza
 * cae, tiembla y se abre con efectos según la rareza; escaparate con el legendario del día e historial.
 * Teclado, ratón y mando.
 */
export class GachaScene extends Phaser.Scene {
  private bannerPools: Record<string, RarityPools> | null = null;
  private bannerId = ALL_BANNER;
  /** Qué fila manejan el teclado y el mando: la ficha del banner o los botones. */
  private focus: 'banner' | 'buttons' = 'buttons';
  private cardBg!: Phaser.GameObjects.Graphics;
  private cardLayer?: Phaser.GameObjects.Container;
  private tabs: { img: Phaser.GameObjects.Image; frame: Phaser.GameObjects.Graphics }[] = [];
  private ratesText!: Phaser.GameObjects.Text;
  private pad?: PadButtons;
  private keyQ?: Phaser.Input.Keyboard.Key;
  private keyE?: Phaser.Input.Keyboard.Key;
  private swipeX: number | null = null;
  /** Sube al cambiar de banner: un destacado que llega tarde de otro banner no se pinta. */
  private cardToken = 0;
  private buttons: { box: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics; arrow: Phaser.GameObjects.Text }[] = [];
  private actions: (() => void)[] = [];
  private selected = 0;
  private phase: Phase = 'menu';
  private leaving = false;
  /** Teclado y mando con la misma lectura que el resto de menús (ui/nav.ts). */
  private nav?: NavInput;
  private ticketsText!: Phaser.GameObjects.Text;
  private ownedText!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private crank!: Phaser.GameObjects.Image;
  private machine!: Phaser.GameObjects.Image;
  private historyLayer?: Phaser.GameObjects.Container;
  private overlay?: Phaser.GameObjects.Container;
  private alive = true;

  constructor() {
    super('Gacha');
  }

  create() {
    this.confirmOpen = false;
    this.bannerPools = null;
    this.bannerId = loadBannerState().last;
    this.focus = 'buttons';
    this.tabs = [];
    this.cardLayer = undefined;
    this.swipeX = null;
    this.buttons = [];
    this.selected = 0;
    this.phase = 'menu';
    this.leaving = false;
    this.overlay = undefined;
    this.historyLayer = undefined;
    this.alive = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (this.alive = false));
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    bakeGachaArt(this);
    bakeBannerArt(this);
    this.tweens.timeScale = 1;

    this.add.text(480, 40, 'Gacha', { fontFamily: FONT, fontSize: '48px', fontStyle: 'bold', color: '#ffd34d' }).setOrigin(0.5).setStroke('#2b3a67', 10);

    // Máquina de bolas con su manivela
    this.machine = this.add.image(MAC.x, MAC.y, MACHINE_KEY).setScale(MAC.s);
    const left = MAC.x - (MACHINE.w * MAC.s) / 2;
    const top = MAC.y - (MACHINE.h * MAC.s) / 2;
    this.crank = this.add.image(left + MACHINE.crankX * MAC.s, top + MACHINE.crankY * MAC.s, CRANK_KEY).setScale(MAC.s);
    this.tweens.add({ targets: this.machine, y: MAC.y - 3, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    addMachineIdle(this, this.machine, MAC.s);

    // Tickets y desbloqueados
    drawBox(this.add.graphics(), 690, 14, 254, 80, { radius: 12 });
    this.ticketsText = this.add.text(924, 40, '', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#b8860b' }).setOrigin(1, 0.5);
    this.ownedText = this.add.text(924, 70, '', { fontFamily: FONT, fontSize: '16px', color: '#4a5578' }).setOrigin(1, 0.5);

    // Ficha del banner (se rellena al cargar la lista de especies), pestañas e historial
    this.cardBg = this.add.graphics();
    this.drawCardBg();
    this.buildTabs();
    drawBox(this.add.graphics(), 380, 282, 564, 76, { radius: 12 });
    this.add.text(398, 296, 'Últimas tiradas', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#2b3a67' }).setOrigin(0, 0.5);

    // Mensajes
    drawBox(this.add.graphics(), 380, 366, 564, 64, { radius: 12 });
    this.message = this.add
      .text(662, 398, 'Cargando…', { fontFamily: FONT, fontSize: '19px', color: '#2b3a67', align: 'center', wordWrap: { width: 540 } })
      .setOrigin(0.5);

    // Botones: x1, x10 y volver
    const bx = (i: number) => 380 + BTN.w / 2 + i * (BTN.w + BTN.gap);
    this.buildButton(`x1 · ${PULL_COST}`, bx(0), () => this.doPull(1));
    this.buildButton(`x10 · ${PULL10_COST}`, bx(1), () => this.doPull(10));
    this.buildButton('Volver', bx(2), () => this.goBack());
    this.actions = [() => this.doPull(1), () => this.doPull(10), () => this.goBack()];

    // Probabilidades del banner elegido (se rellenan al cargar)
    this.ratesText = this.add.text(662, 522, '', { fontFamily: FONT, fontSize: '15px', color: '#ffffff' }).setOrigin(0.5).setShadow(1, 1, '#101828', 0);
    this.add
      .text(662, 546, `x10: al menos un Épico o mejor · Repetido: +${DUPLICATE_REFUND} tickets`, {
        fontFamily: FONT, fontSize: '14px', color: '#ffd34d',
      })
      .setOrigin(0.5).setShadow(1, 1, '#101828', 0);
    addHelpBar(
      this, 480, 616,
      'Flechas o ratón: elegir · Arriba y luego ←/→, o Q/E: cambiar de banner · Enter o clic: tirar · Esc: volver',
      { fontFamily: FONT, fontSize: '14px', color: '#ffffff' },
      'Toca una pestaña o desliza la ficha para cambiar de banner · Toca x1 o x10 para tirar',
    ).setAlpha(0.6);

    this.nav = new NavInput(this);
    this.pad = new PadButtons(this);
    const kb = this.input.keyboard;
    this.keyQ = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.Q, false);
    this.keyE = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.E, false);
    this.keyQ?.reset();
    this.keyE?.reset();
    // Clic en cualquier sitio cierra el resultado; deslizar sobre la ficha cambia de banner (táctil y ratón)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.phase === 'result') return this.closeResult();
      this.swipeX = this.inCard(p) ? p.x : null;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const from = this.swipeX;
      this.swipeX = null;
      if (from === null || this.phase !== 'menu') return;
      const dx = p.x - from;
      if (Math.abs(dx) >= SWIPE) this.changeBanner(dx < 0 ? 1 : -1);
    });
    this.select(0);
    this.refreshHud();
    this.loadIndex().catch((err) => {
      this.message.setText('No se pudo cargar la lista de Pokémon.\nEjecuta: node scripts/buildSpeciesIndex.mjs\n' + String(err));
    });
  }

  private async loadIndex() {
    this.bannerPools = buildBannerPools(await loadCollectionIndex());
    if (!this.alive) return;
    this.message.setText('Elige banner y gira la manivela: cada Poké Ball es una rareza');
    this.buildBannerCard();
    this.buildHistory();
  }

  private get pools(): RarityPools | null {
    return this.bannerPools?.[this.bannerId] ?? null;
  }

  // --- Banners ---

  private inCard(p: Phaser.Input.Pointer): boolean {
    // Las coordenadas del puntero están en pantalla; la cámara de fitDesign las pasa a diseño
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    return w.x >= CARD.x && w.x <= CARD.x + CARD.w && w.y >= CARD.y && w.y <= CARD.y + CARD.h;
  }

  private drawCardBg() {
    this.cardBg.clear();
    drawBox(this.cardBg, CARD.x, CARD.y, CARD.w, CARD.h, {
      radius: 12, selected: this.focus === 'banner', border: BANNER_COLORS[this.bannerId],
    });
  }

  /** Pestañas: el emblema pixel art de cada banner; se tocan o se pulsan con el ratón. */
  private buildTabs() {
    const x0 = CARD.x + CARD.w / 2 - ((BANNERS.length - 1) * CARD.tabGap) / 2;
    BANNERS.forEach((b, i) => {
      const x = x0 + i * CARD.tabGap;
      const frame = this.add.graphics();
      const img = this.add.image(x, CARD.tabY, bannerKey(b.id)).setScale(2);
      // Zona de toque de 44×44 px (la textura mide 16: en sus píxeles, 22)
      img.setInteractive(new Phaser.Geom.Rectangle(-3, -3, 22, 22), Phaser.Geom.Rectangle.Contains);
      img.input!.cursor = 'pointer';
      let downX: number | null = null;
      img.on('pointerdown', (p: Phaser.Input.Pointer) => (downX = p.x));
      img.on('pointerup', (p: Phaser.Input.Pointer) => {
        const from = downX;
        downX = null;
        // Si era un deslizamiento lo hace la ficha
        if (from === null || Math.abs(p.x - from) >= SWIPE || this.phase !== 'menu') return;
        this.setBanner(b.id);
      });
      this.tabs.push({ img, frame });
    });
    this.paintTabs();
  }

  private paintTabs() {
    const cur = bannerIndex(this.bannerId);
    this.tabs.forEach(({ img, frame }, i) => {
      const sel = i === cur;
      frame.clear();
      if (sel) {
        frame.fillStyle(0xffffff, 1).fillRect(img.x - 21, img.y - 21, 42, 42);
        frame.lineStyle(4, BANNER_COLORS[BANNERS[i].id] ?? 0x2b3a67, 1).strokeRect(img.x - 21, img.y - 21, 42, 42);
      }
      img.setScale(sel ? 2.25 : 2).setAlpha(sel ? 1 : 0.75);
    });
  }

  private changeBanner(step: number) {
    const n = BANNERS.length;
    this.setBanner(BANNERS[(bannerIndex(this.bannerId) + step + n) % n].id);
  }

  private setBanner(id: string) {
    if (this.phase !== 'menu' || this.confirmOpen || !bannerById(id) || id === this.bannerId) return;
    this.bannerId = id;
    rememberBanner(id);
    sfx('select');
    this.drawCardBg();
    this.paintTabs();
    this.buildBannerCard();
    this.message.setText(`Banner ${bannerById(id)!.name}: solo salen Pokémon de este banner`);
  }

  /** Contenido de la ficha: emblema, nombre, progreso X/Y, garantías, destacado de hoy y probabilidades. */
  private buildBannerCard() {
    this.cardLayer?.destroy();
    const token = ++this.cardToken;
    const pools = this.pools;
    const banner = bannerById(this.bannerId)!;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const navy = '#2b3a67';
    const soft = '#4a5578';
    const midY = 168;

    // Flechas (ratón y táctil): triángulos dibujados con zona de toque alta
    const arrow = (x: number, dir: -1 | 1) => {
      const g = this.add.graphics();
      g.fillStyle(0x2b3a67, 1).fillTriangle(x - 6 * dir, midY, x + 6 * dir, midY - 12, x + 6 * dir, midY + 12);
      const zone = this.add.zone(x, midY, 40, 100).setInteractive({ cursor: 'pointer' });
      zone.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => {
        ev?.stopPropagation?.();
        if (this.phase === 'menu') this.changeBanner(dir);
      });
      parts.push(g, zone);
    };
    arrow(CARD.x + 16, -1);
    arrow(CARD.x + CARD.w - 16, 1);

    parts.push(this.add.image(452, midY - 4, bannerKey(banner.id)).setScale(4));
    parts.push(this.add.text(500, 124, banner.name, { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: navy }).setOrigin(0, 0.5));
    if (!pools) {
      parts.push(this.add.text(500, 152, 'Cargando…', { fontFamily: FONT, fontSize: '15px', color: soft }).setOrigin(0, 0.5));
      this.cardLayer = this.add.container(0, 0, parts);
      return;
    }

    // Progreso X/Y del banner (cuenta lo que ya tenías de antes)
    const owned = loadUnlocked();
    const prog = bannerProgress(pools, owned);
    const bar = this.add.graphics();
    const bw = 190;
    bar.fillStyle(0x2b3a67, 1).fillRect(500, 144, bw + 4, 14);
    bar.fillStyle(0xe4e4ec, 1).fillRect(502, 146, bw, 10);
    const frac = prog.total > 0 ? prog.got / prog.total : 0;
    bar.fillStyle(prog.got === prog.total ? 0xffd34d : 0x58b048, 1).fillRect(502, 146, Math.round(bw * frac), 10);
    // Los textos de la ficha acaban antes del destacado (x 862 ± 44 con sus rayos): con letra de móvil lo pisaban
    const TXT_END = 862 - 46;
    parts.push(bar, fitTextLine(this.add.text(702, 151, `${prog.got}/${prog.total} conseguidos`, { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: navy }).setOrigin(0, 0.5), TXT_END - 702, 9));

    // Garantías de este banner
    const top = bannerTop(pools);
    const left = pityLeft(pityOf(loadBannerState(), banner.id), top);
    const pity = left.top !== null
      ? `Garantía: ${RARITY_LABEL[top]} en ${left.top} · Épico o mejor en ${left.epic}`
      : `Garantía: Épico o mejor en ${left.epic} (sin legendarios)`;
    parts.push(fitTextLine(this.add.text(500, 176, pity, { fontFamily: FONT, fontSize: '14px', color: navy }).setOrigin(0, 0.5), TXT_END - 500, 9));

    // Qué hay en el banner
    let info: string;
    if (banner.id === FORMS_BANNER) {
      const fp = formsProgress(pools, owned);
      info = FORM_REGIONS.map((r) => `${FORM_REGION_LABEL[r]} ${fp[r].got}/${fp[r].total}`).join(' · ');
    } else if (banner.kind === 'region') info = `Pokédex n.º ${banner.first}-${banner.last} · ${poolIds(pools).length} Pokémon`;
    else info = `Todas las regiones y formas · ${poolIds(pools).length} Pokémon`;
    parts.push(fitTextLine(this.add.text(500, 220, info, { fontFamily: FONT, fontSize: '13px', color: soft }).setOrigin(0, 0.5), TXT_END - 500, 9));
    const featText = this.add.text(500, 198, '', { fontFamily: FONT, fontSize: '14px', color: soft }).setOrigin(0, 0.5);
    parts.push(featText);
    this.cardLayer = this.add.container(0, 0, parts);

    // Probabilidades reales del banner (sin las rarezas que no tiene)
    const er = effectiveRates(pools);
    this.ratesText.setText(RARITIES.filter((r) => er[r] > 0).map((r) => `${RARITY_LABEL[r]} ${er[r]}%`).join(' · '));

    // Destacado de hoy (llega después: sprite de PokeAPI)
    const id = featuredOf(pools, dayNumber(), banner.id);
    if (id === null) return;
    void fetchPokemonCard(id)
      .then(async (card) => {
        const key = await this.loadSprite(card, false);
        if (!this.alive || token !== this.cardToken || !this.cardLayer?.active) return;
        fitTextLine(featText.setText(`Destacado de hoy: ${capitalize(card.name)} (${RARITY_LABEL[top]})`), TXT_END - 500, 9);
        this.cardLayer.add(addRays(this, 862, midY - 10, RARITY_COLORS[top], 44, 10));
        if (key) this.cardLayer.add(this.add.image(862, midY - 10, key).setDisplaySize(72, 72));
      })
      .catch(() => undefined);
  }

  private refreshHud() {
    // Saldos grandes (999999): bajan de letra en vez de salirse del cuadro
    setFitLine(this.ticketsText, `Tickets: ${loadTickets()}`, 924 - 704, 12);
    setFitLine(this.ownedText, `Desbloqueados: ${loadUnlocked().length}`, 924 - 704, 11);
  }

  // --- Botones ---

  private buildButton(text: string, x: number, action: () => void) {
    const i = this.buttons.length;
    const bg = this.add.graphics();
    const label = this.add.text(8, 0, text, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#2b3a67' }).setOrigin(0.5);
    const arrow = this.add.text(-BTN.w / 2 + 12, 0, ARROW, { fontFamily: FONT, fontSize: '18px', color: '#2b3a67' }).setOrigin(0, 0.5);
    const box = this.add.container(x, BTN.y, [bg, label, arrow]).setSize(BTN.w, BTN.h);
    box.setInteractive(new Phaser.Geom.Rectangle(0, 0, BTN.w, BTN.h), Phaser.Geom.Rectangle.Contains);
    box.input!.cursor = 'pointer';
    box.on('pointerover', () => {
      if (this.phase !== 'menu') return;
      this.focus = 'buttons';
      this.drawCardBg();
      this.select(i);
    });
    box.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => {
      if (this.phase !== 'menu') return;
      ev?.stopPropagation?.();
      this.focus = 'buttons';
      this.drawCardBg();
      this.select(i);
      action();
    });
    this.buttons.push({ box, bg, arrow });
  }

  private select(i: number) {
    this.selected = i;
    this.buttons.forEach(({ box, bg, arrow }, k) => {
      const sel = k === i && this.focus === 'buttons';
      bg.clear();
      drawBox(bg, -BTN.w / 2, -BTN.h / 2, BTN.w, BTN.h, { selected: sel });
      arrow.setVisible(sel);
      box.setScale(sel ? 1.04 : 1);
    });
  }

  private goBack() {
    if (this.leaving || this.phase === 'anim') return;
    if (this.phase === 'result') return this.closeResult();
    this.leaving = true;
    goTo(this, 'Menu');
  }

  // --- Escaparate e historial ---

  private buildHistory() {
    this.historyLayer?.destroy();
    const list = loadHistory();
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (list.length === 0) {
      parts.push(this.add.text(662, 330, 'Todavía no has tirado', { fontFamily: FONT, fontSize: '15px', color: '#7a849e' }).setOrigin(0.5));
    }
    list.forEach((e: HistoryEntry, i) => {
      const x = 410 + i * 44;
      const y = 332;
      parts.push(this.add.image(x, y, ballKey(e.rarity)).setScale(2));
      if (e.shiny) parts.push(this.add.text(x + 12, y - 16, '★', { fontFamily: FONT, fontSize: '14px', color: '#ffd34d' }).setStroke('#2b3a67', 3));
      // El sprite tapa la bola cuando carga (si ya estaba en caché, al momento)
      void fetchPokemonCard(e.id)
        .then((card) => this.loadSprite(card, e.shiny))
        .then((key) => {
          if (!key || !this.alive || !this.historyLayer?.active) return;
          this.historyLayer.add(this.add.image(x, y - 2, key).setDisplaySize(44, 44));
        })
        .catch(() => undefined);
    });
    this.historyLayer = this.add.container(0, 0, parts);
  }

  /** Carga el sprite de frente (normal o shiny) y devuelve su clave, o undefined si falla. */
  private async loadSprite(card: PokemonCard, shiny: boolean): Promise<string | undefined> {
    const key = `starter-${card.id}${shiny ? '-s' : ''}-front`;
    if (!this.textures.exists(key)) {
      const url = shiny ? card.sprites.shinyFront : card.sprites.front;
      if (!url) return undefined;
      this.load.crossOrigin = 'anonymous';
      this.load.image(key, url);
      await new Promise<void>((resolve) => {
        this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
        this.load.start();
      });
    }
    if (!this.textures.exists(key)) return undefined;
    this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return key;
  }

  // --- Tirar ---

  /** Resuelve y guarda la tirada antes de animarla: así cerrar la página a medias no la pierde. */
  private resolve(results: PullResult[]): Reveal[] {
    const shinies = new Set(loadShinies());
    const out: Reveal[] = results.map((res, k) => {
      // Easter egg: el código Konami de la pantalla de título hace shiny la primera de la próxima tirada
      const shiny = (k === 0 && takeKonamiShiny()) || rollShiny(Math.random, SHINY_ODDS.gacha);
      const duplicate = shiny ? shinies.has(res.speciesId) : res.duplicate;
      let note: string;
      if (duplicate) {
        addTickets(DUPLICATE_REFUND);
        note = `Repetido: +${DUPLICATE_REFUND} tickets`;
      } else if (shiny) {
        addShiny(res.speciesId);
        shinies.add(res.speciesId);
        note = '¡Shiny nuevo!';
      } else {
        unlockPokemon(res.speciesId);
        note = '¡Nuevo!';
      }
      // Pokémon oscuro (darkMon.ts): muy raro; si es nuevo oscuro se guarda aparte (Pokédex y elegirlo oscuro)
      if (rollDark(Math.random, DARK_GACHA_ODDS) && addDark(res.speciesId)) note += ' · ¡Oscuro!';
      return { res, shiny, duplicate, note };
    });
    pushHistory(out.map((r) => ({ id: r.res.speciesId, rarity: r.res.rarity, shiny: r.shiny, at: Date.now(), banner: this.bannerId })));
    return out;
  }

  private confirmOpen = false;

  private doPull(n: 1 | 10, confirmed = false) {
    if (this.phase !== 'menu' || this.leaving) return;
    if (!this.pools) {
      this.message.setText('La lista de Pokémon aún no está lista');
      return;
    }
    const cost = n === 1 ? PULL_COST : PULL10_COST;
    if (loadTickets() < cost) {
      this.message.setText(`Te faltan tickets (hacen falta ${cost}). Se ganan jugando partidas`);
      return;
    }
    if (!confirmed) {
      if (this.confirmOpen) return;
      this.confirmOpen = true;
      const ok = openConfirm(this, confirmText(n === 1 ? '1 tirada' : '10 tiradas', cost, 'tickets'), (yes) => {
        this.confirmOpen = false;
        // El mando que se usó en el cuadro no cuenta aquí como pulsación nueva
        this.nav = new NavInput(this);
        if (yes) this.doPull(n, true);
      });
      if (!ok) this.confirmOpen = false;
      return;
    }
    if (!spendTickets(cost)) {
      this.message.setText(`Te faltan tickets (hacen falta ${cost}). Se ganan jugando partidas`);
      return;
    }
    const owned = new Set(loadUnlocked());
    // Garantía del banner: se guarda con la tirada (antes de animarla)
    const state = loadBannerState();
    const { results, pity } = pullBanner(Math.random, this.pools, owned, pityOf(state, this.bannerId), n);
    state.banners[this.bannerId] = pity;
    state.last = this.bannerId;
    saveBannerState(state);
    const reveals = this.resolve(results);
    this.refreshHud();
    this.phase = 'anim';
    this.message.setText(n === 1 ? '…' : '¡Diez bolas!');
    // Las imágenes se piden ya, mientras gira la manivela
    const loaded = Promise.all(
      reveals.map(async (r) => {
        r.card = await fetchPokemonCard(r.res.speciesId).catch(() => undefined);
        if (r.card) r.key = await this.loadSprite(r.card, r.shiny);
      }),
    );
    const best = reveals.reduce((a, b) => (RANK(b.res.rarity) > RANK(a.res.rarity) ? b : a));
    this.playMachine(best.res.rarity, () => {
      void loaded.then(() => {
        if (!this.alive) return;
        if (n === 1) this.revealOne(reveals[0]);
        else this.revealTen(reveals, best);
      });
    });
  }

  /** Gira la manivela, la máquina tiembla y cae la bola de la mejor rareza, que tiembla y se abre. */
  private playMachine(rarity: Rarity, done: () => void) {
    sfx('select');
    this.tweens.add({ targets: this.crank, angle: this.crank.angle + 360, duration: 520, ease: 'Cubic.easeInOut' });
    this.tweens.add({ targets: this.machine, x: MAC.x + 3, duration: 50, yoyo: true, repeat: 5, delay: 360 });

    const left = MAC.x - (MACHINE.w * MAC.s) / 2;
    const top = MAC.y - (MACHINE.h * MAC.s) / 2;
    const ball = this.add
      .image(left + MACHINE.chuteX * MAC.s, top + MACHINE.chuteY * MAC.s, ballKey(rarity))
      .setScale(MAC.s)
      .setDepth(30)
      .setAlpha(0);
    const wiggles = 2 + Math.max(0, RANK(rarity) - 1);
    this.tweens.chain({
      targets: ball,
      tweens: [
        { alpha: 1, duration: 120, delay: 620 },
        { x: DCX, y: DCY - 20, scale: 7, duration: 520, ease: 'Quad.easeOut', onStart: () => sfx('coin') },
        { angle: { from: -16, to: 16 }, duration: 120, yoyo: true, repeat: wiggles, ease: 'Sine.easeInOut', onRepeat: () => sfx('hit') },
        {
          angle: 0, scale: 9, alpha: 0, duration: 160,
          onStart: () => this.openEffects(rarity, DCX, DCY - 20),
        },
      ],
      onComplete: () => {
        ball.destroy();
        done();
      },
    });
  }

  /** Destello, rayos, ráfaga y temblor según la rareza. */
  private openEffects(rarity: Rarity, x: number, y: number) {
    const color = RARITY_COLORS[rarity];
    const cam = this.cameras.main;
    const rank = RANK(rarity);
    if (rarity === 'legendary') {
      cam.flash(420, 255, 220, 90);
      cam.shake(500, 0.012);
      sfx('clear');
    } else {
      cam.flash(240, 255, 255, 255);
      sfx('boom');
    }
    if (rarity === 'ultra') cam.shake(420, 0.01);
    if (rank >= 2) addBurst(this, x, y, [color, 0xffffff, 0xffd34d], 18 + rank * 8, 6, 220 + rank * 30);
  }

  // --- Resultado ---

  private openOverlay(): Phaser.GameObjects.Container {
    const dim = this.add.rectangle(DCX, DCY, COVER_W + 4, COVER_H + 4, 0x0d1425, 0.82);
    const layer = this.add.container(0, 0, [dim]).setDepth(20);
    this.overlay = layer;
    return layer;
  }

  private revealOne(r: Reveal) {
    const layer = this.openOverlay();
    const rarity = r.res.rarity;
    const color = RARITY_COLORS[rarity];
    if (RANK(rarity) >= 2) layer.add(addRays(this, DCX, 236, color, 300, 14));
    const card = this.buildCard(r, 340, 300, 1);
    card.setPosition(DCX, 250).setScale(0.2).setAlpha(0);
    layer.add(card);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 340, ease: 'Back.easeOut' });
    if (r.shiny) for (let k = 0; k < 4; k++) this.time.delayedCall(200 + k * 320, () => this.alive && sparkle(this, DCX, 200, 120, 40));
    layer.add(this.add.text(DCX, 470, 'Enter, clic o A para seguir', { fontFamily: FONT, fontSize: '18px', color: '#ffffff' }).setOrigin(0.5));
    if (r.card) void cry(r.card.id);
    this.message.setText(`${RARITY_LABEL[rarity]}: ${r.card ? capitalize(r.card.name) : '#' + r.res.speciesId}`);
    this.phase = 'result';
  }

  private revealTen(rs: Reveal[], best: Reveal) {
    const layer = this.openOverlay();
    layer.add(this.add.text(DCX, 54, 'Tirada x10', { fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: '#ffd34d' }).setOrigin(0.5).setStroke('#2b3a67', 8));
    const cw = 160;
    const ch = 200;
    rs.forEach((r, i) => {
      const x = DCX + ((i % 5) - 2) * (cw + 12);
      const y = 200 + Math.floor(i / 5) * (ch + 16);
      // Primero la bola de su rareza; luego se abre y sale la tarjeta
      const ball = this.add.image(x, y, ballKey(r.res.rarity)).setScale(0).setDepth(21);
      layer.add(ball);
      const delay = 120 + i * 170;
      this.tweens.add({ targets: ball, scale: 4, duration: 200, delay, ease: 'Back.easeOut' });
      this.time.delayedCall(delay + 420, () => {
        if (!this.alive || !layer.active) return;
        ball.destroy();
        if (RANK(r.res.rarity) >= 2) addBurst(this, x, y, [RARITY_COLORS[r.res.rarity], 0xffffff], 12, 5, 90);
        const card = this.buildCard(r, cw, ch, 0.5).setPosition(x, y).setScale(0.3);
        layer.add(card);
        this.tweens.add({ targets: card, scale: 1, duration: 220, ease: 'Back.easeOut' });
        if (r.shiny) sparkle(this, x, y - 30, 50, 40);
        sfx(RANK(r.res.rarity) >= 3 ? 'clear' : 'pickup');
      });
    });
    const end = 120 + rs.length * 170 + 600;
    this.time.delayedCall(end, () => {
      if (!this.alive || !layer.active) return;
      layer.add(this.add.text(DCX, 610, 'Enter, clic o A para seguir', { fontFamily: FONT, fontSize: '18px', color: '#ffffff' }).setOrigin(0.5));
      this.phase = 'result';
      if (best.card) void cry(best.card.id);
    });
    const nNew = rs.filter((r) => !r.duplicate).length;
    this.message.setText(`Mejor: ${RARITY_LABEL[best.res.rarity]} · ${nNew} nuevos`);
  }

  /** Tarjeta de un resultado (centrada en 0,0). `k` escala los textos (1 = grande, 0,5 = la de x10). */
  private buildCard(r: Reveal, w: number, h: number, k: number) {
    const rarity = r.res.rarity;
    const color = RARITY_COLORS[rarity];
    const parts: Phaser.GameObjects.GameObject[] = [drawBox(this.add.graphics(), -w / 2, -h / 2, w, h, { radius: 16, border: color })];
    const imgSize = h * 0.55;
    const imgY = -h / 2 + 12 + imgSize / 2;
    if (r.key) parts.push(this.add.image(0, imgY, r.key).setDisplaySize(imgSize, imgSize));
    else parts.push(this.add.image(0, imgY, ballKey(rarity)).setScale(imgSize / 24));
    const name = (r.shiny ? '★ ' : '') + (r.card ? capitalize(r.card.name) : `#${r.res.speciesId}`);
    const fs = (n: number) => `${Math.round(n * (0.55 + 0.45 * k))}px`;
    parts.push(
      this.add.text(0, h * 0.2, name, { fontFamily: FONT, fontSize: fs(26), fontStyle: 'bold', color: r.shiny ? '#b8860b' : '#2b3a67' }).setOrigin(0.5),
      this.add.text(0, h * 0.32, RARITY_LABEL[rarity], { fontFamily: FONT, fontSize: fs(20), fontStyle: 'bold', color: hex(color) }).setOrigin(0.5).setStroke('#2b3a67', 3),
      this.add.text(0, h * 0.43, r.note, { fontFamily: FONT, fontSize: fs(16), color: r.duplicate ? '#7a849e' : '#2e8b57' }).setOrigin(0.5),
    );
    if (k >= 1 && r.card) {
      r.card.types.forEach((t, i) => {
        const cx = (i - (r.card!.types.length - 1) / 2) * 84;
        parts.push(...addTypeChip(this, cx, -h / 2 - 18, typeNameEs(t), typeColor(t), 78, 24));
      });
    }
    return this.add.container(0, 0, parts);
  }

  private closeResult() {
    if (this.phase !== 'result') return;
    this.overlay?.destroy();
    this.overlay = undefined;
    this.phase = 'menu';
    this.tweens.timeScale = 1;
    this.buildHistory();
    this.buildBannerCard();
    this.refreshHud();
    this.message.setText(`¿Otra en ${bannerById(this.bannerId)!.name}? Gira la manivela`);
  }

  update() {
    if (this.leaving || !this.nav) return;
    const n0 = this.nav.read();
    const ok = n0.ok;
    const back = n0.back;
    const pb = this.pad?.read() ?? new Set();
    const J = Phaser.Input.Keyboard.JustDown;
    const prevBanner = (this.keyQ && J(this.keyQ)) || pb.has('LB');
    const nextBanner = (this.keyE && J(this.keyE)) || pb.has('RB');

    if (this.phase === 'anim') {
      // Acelerar la animación si tienes prisa
      if (ok || back) this.tweens.timeScale = 4;
      return;
    }
    if (this.phase === 'result') {
      if (ok || back) this.closeResult();
      return;
    }
    if (back) return this.goBack();
    if (this.confirmOpen) return;
    // Q/E (teclado) y LB/RB (mando) cambian de banner desde cualquier fila
    if (prevBanner) this.changeBanner(-1);
    if (nextBanner) this.changeBanner(1);
    if (this.focus === 'banner') {
      if (n0.dx !== 0) this.changeBanner(Math.sign(n0.dx));
      if (n0.dy > 0 || ok) this.setFocus('buttons');
      return;
    }
    if (n0.dy < 0) return this.setFocus('banner');
    const n = this.buttons.length;
    if (n0.dx !== 0) this.select((this.selected + Math.sign(n0.dx) + n) % n);
    if (ok) this.actions[this.selected]();
  }

  private setFocus(f: 'banner' | 'buttons') {
    if (this.focus === f) return;
    this.focus = f;
    this.drawCardBg();
    this.select(this.selected);
    sfx('select');
  }
}
