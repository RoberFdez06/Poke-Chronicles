import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { fetchPokemonCard } from '../data/pokeapi';
import { buyUpgrade, loadTickets, loadUnlocked, loadUpgrades } from '../data/save';
import { levelsFor, MAX_UPGRADE_LEVEL, UPGRADE_DESC, UPGRADE_KINDS, UPGRADE_LABEL, upgradeCost } from '../data/upgrades';
import { sfx } from '../ui/audio';
import { addBackButton, buildPokemonCard, loadCardTextures } from '../ui/cards';
import { NavInput, PadButtons } from '../ui/nav';
import { ARROW, COLORS, drawBox, fadeIn, FONT, goTo, HEX } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';
import { addIcon } from '../ui/art/icons';

const ROW = { x: 680, w: 420, h: 88, gap: 14, top: 170 };
const CARD_X = 250;
const CARD_Y = 340;

/**
 * Mejoras permanentes: eliges uno de tus Pokémon (◀ ▶) y le compras niveles de daño, PS, velocidad y cadencia
 * con tickets. Solo se aplican jugando con él. Teclado, ratón y mando.
 */
export class UpgradeScene extends Phaser.Scene {
  private ids: number[] = [];
  private index = 0;
  private selected = 0;
  private nav!: NavInput;
  private pad!: PadButtons;
  private rows: { bg: Phaser.GameObjects.Graphics; texts: Phaser.GameObjects.Text[]; arrow: Phaser.GameObjects.Text; y: number }[] = [];
  private card?: Phaser.GameObjects.Container;
  private ticketsText!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private token = 0;
  private leaving = false;

  /** Pokémon elegido en el buscador (Pokédex en modo elegir). */
  private wantId?: number;
  private findKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Upgrades');
  }

  init(data?: { id?: number }) {
    this.wantId = data?.id;
    this.sys.settings.data = {};
  }

  create() {
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    this.rows = [];
    this.card = undefined;
    this.index = 0;
    this.selected = 0;
    this.leaving = false;
    this.ids = [...loadUnlocked()].sort((a, b) => a - b);
    if (this.wantId !== undefined && this.ids.includes(this.wantId)) this.index = this.ids.indexOf(this.wantId);
    this.nav = new NavInput(this);
    this.pad = new PadButtons(this);
    this.findKey = this.input.keyboard!.addKey('F', false);
    addBackButton(this, () => this.back());

    this.add.text(480, 44, 'Mejoras', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: HEX.gold }).setOrigin(0.5).setStroke('#2b3a67', 10);
    drawBox(this.add.graphics(), 720, 18, 224, 52, { radius: 12 });
    addIcon(this, 746, 44, 'ticket', 2);
    this.ticketsText = this.add.text(924, 44, '', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#b8860b' }).setOrigin(1, 0.5);
    this.message = this.add.text(ROW.x, 560, '', { fontFamily: FONT, fontSize: '18px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    this.add
      .text(480, 612, '◀ ▶: Pokémon · F, Y o "Buscar": elegir con filtros · Arriba/abajo: mejora · Enter, A o clic: comprar · Esc o B: volver', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setAlpha(0.75);

    if (this.ids.length === 0) {
      this.message.setText('Aún no tienes ningún Pokémon.\nEmpieza una partida para elegir el primero.').setPosition(480, 320);
      return;
    }

    for (const [label, x, d] of [['◀', CARD_X - 150, -1], ['▶', CARD_X + 150, 1]] as const) {
      const t = this.add
        .text(x, CARD_Y, label, { fontFamily: FONT, fontSize: '44px', color: '#ffffff' })
        .setOrigin(0.5)
        .setPadding(12, 8)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor(HEX.gold));
      t.on('pointerout', () => t.setColor('#ffffff'));
      t.on('pointerdown', () => this.cycle(d));
    }

    // Buscar: abre la Pokédex con filtros (región, rareza, tipo, nombre) para elegir sin ir de uno en uno
    drawBox(this.add.graphics(), CARD_X - 110, 540, 220, 44, { radius: 12 });
    this.add.text(CARD_X, 562, 'Buscar (F / Y)', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: HEX.text }).setOrigin(0.5);
    this.add.zone(CARD_X, 562, 220, 44).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.search());
    this.add.text(CARD_X, 104, `${this.index + 1} de ${this.ids.length}`, { fontFamily: FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setName('count');

    UPGRADE_KINDS.forEach((kind, i) => {
      const y = ROW.top + i * (ROW.h + ROW.gap);
      const bg = this.add.graphics();
      const left = ROW.x - ROW.w / 2;
      const name = this.add.text(left + 40, y - 22, UPGRADE_LABEL[kind], { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: HEX.text }).setOrigin(0, 0.5);
      const cost = this.add.text(left + ROW.w - 20, y - 22, '', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#b8860b' }).setOrigin(1, 0.5);
      const desc = this.add.text(left + 40, y + 22, UPGRADE_DESC[kind], { fontFamily: FONT, fontSize: '14px', color: HEX.textSoft }).setOrigin(0, 0.5);
      const arrow = this.add.text(left + 14, y - 22, ARROW, { fontFamily: FONT, fontSize: '18px', color: HEX.text }).setOrigin(0, 0.5);
      const zone = this.add.zone(ROW.x, y, ROW.w, ROW.h).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.select(i));
      zone.on('pointerdown', () => {
        this.select(i);
        this.buy();
      });
      this.rows.push({ bg, texts: [name, cost, desc], arrow, y });
    });
    this.showPokemon();
  }

  /** Abre el buscador (Pokédex en modo elegir). */
  private search() {
    if (this.leaving || this.ids.length === 0) return;
    this.leaving = true;
    sfx('select');
    goTo(this, 'Pokedex', { pick: { returnTo: 'Upgrades', current: this.id } });
  }

  private get id() {
    return this.ids[this.index];
  }

  private cycle(d: number) {
    if (this.ids.length === 0) return;
    this.index = (this.index + d + this.ids.length) % this.ids.length;
    sfx('select');
    (this.children.getByName('count') as Phaser.GameObjects.Text | null)?.setText(`${this.index + 1} de ${this.ids.length}`);
    this.showPokemon();
  }

  private select(i: number) {
    this.selected = (i + UPGRADE_KINDS.length) % UPGRADE_KINDS.length;
    this.refresh();
  }

  private async showPokemon() {
    const token = ++this.token;
    this.refresh();
    try {
      const card = await fetchPokemonCard(this.id);
      await loadCardTextures(this, [card]);
      if (token !== this.token || !this.scene.isActive()) return;
      this.card?.destroy();
      const t = buildPokemonCard(this, card, CARD_X, CARD_Y, { stats: card.stats, scale: 0.95 });
      t.box.disableInteractive();
      this.card = t.box;
    } catch {
      if (token === this.token) this.message.setText('No se pudo cargar el Pokémon');
    }
  }

  private refresh() {
    this.ticketsText.setText(`Tickets: ${loadTickets()}`);
    const lv = levelsFor(loadUpgrades(), this.id);
    UPGRADE_KINDS.forEach((kind, i) => {
      const r = this.rows[i];
      if (!r) return;
      const sel = i === this.selected;
      const left = ROW.x - ROW.w / 2;
      r.bg.clear();
      drawBox(r.bg, left, r.y - ROW.h / 2, ROW.w, ROW.h, { selected: sel, radius: 14 });
      // Niveles como casillas, al estilo de las barras de los juegos
      for (let k = 0; k < MAX_UPGRADE_LEVEL; k++) {
        r.bg.fillStyle(k < lv[kind] ? COLORS.hpGreen : COLORS.hpTrack, 1).fillRoundedRect(left + 170 + k * 26, r.y - 30, 20, 16, 4);
      }
      const cost = upgradeCost(lv[kind]);
      r.texts[1].setText(cost === null ? 'MÁX' : `${cost} tickets`);
      r.arrow.setVisible(sel);
    });
  }

  private buy() {
    if (this.ids.length === 0) return;
    const kind = UPGRADE_KINDS[this.selected];
    const res = buyUpgrade(this.id, kind);
    if (res === 'ok') {
      sfx('buy');
      this.message.setText(`¡${UPGRADE_LABEL[kind]} mejorado!`);
    } else if (res === 'max') this.message.setText('Esta mejora ya está al máximo');
    else this.message.setText(`Te faltan tickets (cuesta ${upgradeCost(levelsFor(loadUpgrades(), this.id)[kind])})`);
    this.refresh();
  }

  private back() {
    if (this.leaving) return;
    this.leaving = true;
    goTo(this, 'Menu');
  }

  update() {
    if (this.leaving) return;
    const s = this.nav.read();
    const pad = this.pad.read();
    if (s.back) return this.back();
    if (this.ids.length === 0) return;
    if (s.dx) this.cycle(Math.sign(s.dx));
    if (Phaser.Input.Keyboard.JustDown(this.findKey) || pad.has('Y')) return this.search();
    if (pad.has('LB')) this.cycle(-1);
    if (pad.has('RB')) this.cycle(1);
    if (s.dy) this.select(this.selected + Math.sign(s.dy));
    if (s.ok) this.buy();
  }
}

