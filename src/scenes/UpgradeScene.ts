import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { fetchPokemonCard } from '../data/pokeapi';
import { buyUpgrade, loadCandies, loadUnlocked, loadUpgrades } from '../data/save';
import { levelsFor, UPGRADE_DESC, UPGRADE_LABEL, UPGRADE_MAX, type UpgradeKind } from '../data/upgrades';
import { BRANCH_LABEL, BRANCHES, moveInTree, nodeCost, nodeState, remainingTreeCost, treeNode, UPGRADE_TREE } from '../data/upgradeTree';
import { sfx } from '../ui/audio';
import { addBackButton, buildPokemonCard, loadCardTextures } from '../ui/cards';
import { NavInput, PadButtons } from '../ui/nav';
import { ARROW, COLORS, drawBox, fadeIn, FONT, goTo, HEX } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';
import { addIcon } from '../ui/art/icons';

// Árbol: una columna por rama y una fila por profundidad (T71)
const TREE = { x0: 505, dx: 114, y0: 178, dy: 84, w: 104, h: 66 };
const ROW = { x: 675 };
const CARD_X = 250;
const CARD_Y = 340;

/**
 * Mejoras permanentes en árbol (T71): eliges uno de tus Pokémon y le compras nodos de cuatro ramas (ataque, defensa,
 * botín y utilidad) con caramelos; cada nodo pide el anterior. Solo se aplican jugando con él. Teclado, ratón y mando.
 */
export class UpgradeScene extends Phaser.Scene {
  private ids: number[] = [];
  private index = 0;
  private selected: UpgradeKind = 'damage';
  private nav!: NavInput;
  private pad!: PadButtons;
  private nodes = new Map<UpgradeKind, { bg: Phaser.GameObjects.Graphics; cost: Phaser.GameObjects.Text; x: number; y: number }>();
  private lines!: Phaser.GameObjects.Graphics;
  private detail!: Phaser.GameObjects.Text;
  private goal!: Phaser.GameObjects.Text;
  private prevKey!: Phaser.Input.Keyboard.Key;
  private nextKey!: Phaser.Input.Keyboard.Key;
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
    this.nodes = new Map();
    this.card = undefined;
    this.index = 0;
    this.selected = 'damage';
    this.leaving = false;
    this.ids = [...loadUnlocked()].sort((a, b) => a - b);
    if (this.wantId !== undefined && this.ids.includes(this.wantId)) this.index = this.ids.indexOf(this.wantId);
    this.nav = new NavInput(this);
    this.pad = new PadButtons(this);
    this.findKey = this.input.keyboard!.addKey('F', false);
    // Las flechas ahora se mueven por el árbol; para cambiar de Pokémon con teclado, Q y E
    this.prevKey = this.input.keyboard!.addKey('Q', false);
    this.nextKey = this.input.keyboard!.addKey('E', false);
    addBackButton(this, () => this.back());

    this.add.text(480, 44, 'Mejoras', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: HEX.gold }).setOrigin(0.5).setStroke('#2b3a67', 10);
    drawBox(this.add.graphics(), 720, 18, 224, 52, { radius: 12 });
    addIcon(this, 746, 44, 'candy', 2);
    this.ticketsText = this.add.text(924, 44, '', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#b8860b' }).setOrigin(1, 0.5);
    this.message = this.add.text(ROW.x, 582, '', { fontFamily: FONT, fontSize: '18px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    this.add
      .text(480, 612, 'Q/E, LB/RB o ◀ ▶: Pokémon · F, Y o "Buscar": filtros · Flechas o cruceta: nodo · Enter, A o clic: comprar · Esc o B: volver', {
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

    // TODO(supervisor): dibujo propio de los nodos y de las ramas; de momento cajas de theme.ts y líneas lisas.
    this.lines = this.add.graphics();
    BRANCHES.forEach((b, i) => {
      this.add.text(TREE.x0 + i * TREE.dx, TREE.y0 - 52, BRANCH_LABEL[b], { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setStroke('#2b3a67', 6);
    });
    for (const n of UPGRADE_TREE) {
      const x = TREE.x0 + BRANCHES.indexOf(n.branch) * TREE.dx;
      const y = TREE.y0 + n.depth * TREE.dy;
      const bg = this.add.graphics();
      this.add.text(x, y - 14, UPGRADE_LABEL[n.kind], { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: HEX.text }).setOrigin(0.5);
      const cost = this.add.text(x, y + 22, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#b8860b' }).setOrigin(0.5);
      const zone = this.add.zone(x, y, TREE.w, TREE.h).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.select(n.kind));
      zone.on('pointerdown', () => {
        this.select(n.kind);
        this.buy();
      });
      this.nodes.set(n.kind, { bg, cost, x, y });
    }
    this.detail = this.add.text(ROW.x, 510, '', { fontFamily: FONT, fontSize: '15px', color: '#ffffff', align: 'center', wordWrap: { width: 470 } }).setOrigin(0.5).setStroke('#2b3a67', 5);
    this.goal = this.add.text(ROW.x, 548, '', { fontFamily: FONT, fontSize: '13px', color: '#ffffff' }).setOrigin(0.5).setAlpha(0.8);
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

  private select(kind: UpgradeKind) {
    if (kind !== this.selected) sfx('select');
    this.selected = kind;
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
    this.ticketsText.setText(`Caramelos: ${loadCandies()}`);
    if (this.ids.length === 0) return;
    const lv = levelsFor(loadUpgrades(), this.id);
    this.lines.clear();
    for (const n of UPGRADE_TREE) {
      const r = this.nodes.get(n.kind)!;
      const state = nodeState(n.kind, lv);
      const sel = n.kind === this.selected;
      // Rama hacia el padre: verde si el padre ya está comprado
      if (n.parent) {
        const p = this.nodes.get(n.parent)!;
        this.lines.lineStyle(4, lv[n.parent] > 0 ? COLORS.hpGreen : COLORS.hpTrack, 1).lineBetween(p.x, p.y + TREE.h / 2, r.x, r.y - TREE.h / 2);
      }
      r.bg.clear();
      drawBox(r.bg, r.x - TREE.w / 2, r.y - TREE.h / 2, TREE.w, TREE.h, { selected: sel, radius: n.final ? 18 : 10 });
      r.bg.setAlpha(state === 'locked' ? 0.55 : 1);
      // Niveles como casillas, al estilo de las barras de los juegos
      const max = UPGRADE_MAX[n.kind];
      const cw = Math.min(14, (TREE.w - 16) / max - 3);
      const left = r.x - (max * (cw + 3) - 3) / 2;
      for (let k = 0; k < max; k++) r.bg.fillStyle(k < lv[n.kind] ? COLORS.hpGreen : COLORS.hpTrack, 1).fillRoundedRect(left + k * (cw + 3), r.y, cw, 9, 2);
      const cost = nodeCost(n.kind, lv);
      r.cost.setText(state === 'locked' ? 'Bloqueado' : cost === null ? 'MÁX' : `${cost} car.`);
    }
    const n = treeNode(this.selected);
    const cost = nodeCost(this.selected, lv);
    const state = nodeState(this.selected, lv);
    const need = state === 'locked' && n.parent ? ` · Necesita ${UPGRADE_LABEL[n.parent]}` : '';
    this.detail.setText(
      `${UPGRADE_LABEL[this.selected]}${n.final ? ' (final)' : ''} · nivel ${lv[this.selected]}/${UPGRADE_MAX[this.selected]}\n${UPGRADE_DESC[this.selected]}` +
        (cost === null ? ' · al máximo' : ` · ${cost} caramelos`) + need,
    );
    this.goal.setText(`Para completar el árbol de este Pokémon faltan ${remainingTreeCost(lv)} caramelos`);
  }

  private buy() {
    if (this.ids.length === 0) return;
    const kind = this.selected;
    const res = buyUpgrade(this.id, kind);
    if (res === 'ok') {
      sfx('buy');
      this.message.setText(`¡${UPGRADE_LABEL[kind]} mejorado!`);
    } else if (res === 'max') this.message.setText('Esta mejora ya está al máximo');
    else if (res === 'locked') this.message.setText(`Antes compra ${UPGRADE_LABEL[treeNode(kind).parent ?? kind]}`);
    else this.message.setText(`Te faltan caramelos (cuesta ${nodeCost(kind, levelsFor(loadUpgrades(), this.id))})`);
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
    if (s.dx || s.dy) this.select(moveInTree(this.selected, s.dx, s.dy));
    if (Phaser.Input.Keyboard.JustDown(this.prevKey)) this.cycle(-1);
    if (Phaser.Input.Keyboard.JustDown(this.nextKey)) this.cycle(1);
    if (Phaser.Input.Keyboard.JustDown(this.findKey) || pad.has('Y')) return this.search();
    if (pad.has('LB')) this.cycle(-1);
    if (pad.has('RB')) this.cycle(1);
    if (s.ok) this.buy();
  }
}

