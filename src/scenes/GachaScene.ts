import Phaser from 'phaser';
import { fetchPokemonCard } from '../data/pokeapi';
import { buildPools, GACHA_RATES, pull, PULL_COST, RARITIES, RARITY_LABEL, Rarity, RarityPools } from '../data/gacha';
import { loadSpeciesIndex } from '../data/speciesIndex';
import { addTickets, loadTickets, loadUnlocked, spendTickets, unlockPokemon } from '../data/save';
import { typeColor, typeNameEs } from '../data/types';
import { ARROW, addTypeChip, drawBox, fadeIn, FONT, goTo, hex, RARITY_COLORS } from '../ui/theme';
/** Tickets que devuelve una tirada repetida. */
const DUPLICATE_REFUND = 30;
const BTN = { w: 300, h: 54 };


type Key = Phaser.Input.Keyboard.Key;
type KeyName = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'A' | 'D' | 'W' | 'S' | 'ENTER' | 'SPACE' | 'ESC';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Gacha: gasta tickets (ganados jugando) para desbloquear Pokémon. Teclado, ratón y mando. */
export class GachaScene extends Phaser.Scene {
  private pools: RarityPools | null = null;
  private buttons: { box: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics; arrow: Phaser.GameObjects.Text }[] = [];
  private actions: (() => void)[] = [];
  private selected = 0;
  private busy = false;
  private leaving = false;
  private keys!: Record<KeyName, Key>;
  private padPrev = { dir: 0, ok: false, back: false };
  private ticketsText!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private ownedText!: Phaser.GameObjects.Text;
  private resultLayer?: Phaser.GameObjects.Container;
  private alive = true;

  constructor() {
    super('Gacha');
  }

  create() {
    this.pools = null;
    this.buttons = [];
    this.selected = 0;
    this.busy = false;
    this.leaving = false;
    this.resultLayer = undefined;
    this.padPrev = { dir: 0, ok: false, back: false };
    this.alive = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (this.alive = false));
    fadeIn(this);

    this.add.text(480, 56, 'Gacha', { fontFamily: FONT, fontSize: '52px', fontStyle: 'bold', color: '#ffd34d' }).setOrigin(0.5).setStroke('#2b3a67', 10);
    // Tickets y desbloqueados en un cuadro arriba a la derecha
    drawBox(this.add.graphics(), 690, 14, 254, 80, { radius: 12 });
    this.ticketsText = this.add.text(924, 40, '', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#b8860b' }).setOrigin(1, 0.5);
    this.ownedText = this.add.text(924, 70, '', { fontFamily: FONT, fontSize: '16px', color: '#4a5578' }).setOrigin(1, 0.5);
    // Cuadro de texto como los de los juegos para los mensajes
    drawBox(this.add.graphics(), 140, 344, 680, 62, { radius: 12 });
    this.message = this.add
      .text(480, 375, 'Cargando…', { fontFamily: FONT, fontSize: '20px', color: '#2b3a67', align: 'center' })
      .setOrigin(0.5)
      .setDepth(1);

    const rates = RARITIES.map((r) => `${RARITY_LABEL[r]} ${GACHA_RATES[r]}%`).join(' · ');
    this.add.text(480, 560, rates, { fontFamily: FONT, fontSize: '15px', color: '#ffffff' }).setOrigin(0.5).setAlpha(0.7);
    this.add
      .text(480, 612, 'Flechas, ratón o mando para moverte · Enter, espacio, clic o A para elegir · Esc o B para volver', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setAlpha(0.5);

    this.buildButton(`Tirar (${PULL_COST} tickets)`, 480, 440, () => this.doPull());
    this.buildButton('Volver', 480, 506, () => this.goBack());
    this.actions = [() => this.doPull(), () => this.goBack()];

    this.keys = this.input.keyboard!.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,ENTER,SPACE,ESC') as Record<KeyName, Key>;
    this.select(0);
    this.refreshHud();
    this.loadIndex().catch((err) => {
      this.message.setText('No se pudo cargar la lista de Pokémon.\nEjecuta: node scripts/buildSpeciesIndex.mjs\n' + String(err));
    });
  }

  private async loadIndex() {
    this.pools = buildPools(await loadSpeciesIndex());
    if (this.alive) this.message.setText('Tira para conseguir un Pokémon nuevo');
  }

  private refreshHud() {
    this.ticketsText.setText(`Tickets: ${loadTickets()}`);
    this.ownedText.setText(`Desbloqueados: ${loadUnlocked().length}`);
  }

  private buildButton(text: string, x: number, y: number, action: () => void) {
    const i = this.buttons.length;
    const bg = this.add.graphics();
    const label = this.add.text(0, 0, text, { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#2b3a67' }).setOrigin(0.5);
    const arrow = this.add.text(-BTN.w / 2 + 14, 0, ARROW, { fontFamily: FONT, fontSize: '20px', color: '#2b3a67' }).setOrigin(0, 0.5);
    const box = this.add.container(x, y, [bg, label, arrow]).setSize(BTN.w, BTN.h);
    box.setInteractive(new Phaser.Geom.Rectangle(0, 0, BTN.w, BTN.h) /* Phaser la centra solo */, Phaser.Geom.Rectangle.Contains);
    box.input!.cursor = 'pointer';
    box.on('pointerover', () => this.select(i));
    box.on('pointerdown', () => {
      this.select(i);
      action();
    });
    this.buttons.push({ box, bg, arrow });
  }

  private select(i: number) {
    this.selected = i;
    this.buttons.forEach(({ box, bg, arrow }, k) => {
      const sel = k === i;
      bg.clear();
      drawBox(bg, -BTN.w / 2, -BTN.h / 2, BTN.w, BTN.h, { selected: sel });
      arrow.setVisible(sel);
      box.setScale(sel ? 1.04 : 1);
    });
  }

  private goBack() {
    if (this.leaving || this.busy) return;
    this.leaving = true;
    goTo(this, 'Menu');
  }

  private say(text: string) {
    this.resultLayer?.destroy();
    this.resultLayer = undefined;
    this.message.setText(text);
  }

  private async doPull() {
    if (this.busy || this.leaving) return;
    if (!this.pools) {
      this.say('La lista de Pokémon aún no está lista');
      return;
    }
    if (!spendTickets(PULL_COST)) {
      this.say(`Te faltan tickets (hacen falta ${PULL_COST}).\nSe ganan limpiando salas en el juego`);
      return;
    }
    this.busy = true;
    this.refreshHud();
    this.say('…');

    const owned = new Set(loadUnlocked());
    const result = pull(Math.random, this.pools, owned);
    try {
      const card = await fetchPokemonCard(result.speciesId);
      const key = `starter-${card.id}-front`;
      if (!this.textures.exists(key)) {
        this.load.crossOrigin = 'anonymous';
        this.load.image(key, card.sprites.front);
        await new Promise<void>((resolve) => {
          this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
          this.load.start();
        });
      }
      if (!this.alive) return;

      let note: string;
      if (result.duplicate) {
        addTickets(DUPLICATE_REFUND);
        note = `¡Repetido! Te devolvemos ${DUPLICATE_REFUND} tickets`;
      } else {
        unlockPokemon(result.speciesId);
        note = '¡Nuevo Pokémon desbloqueado!';
      }
      this.showResult(card.id, card.name, card.types, result.rarity, note, key);
    } catch (err) {
      // La tirada no se pierde si no se pudo mostrar: se desbloquea igual y se avisa
      if (!result.duplicate) unlockPokemon(result.speciesId);
      else addTickets(DUPLICATE_REFUND);
      this.say(`Ha salido el Pokémon nº ${result.speciesId} (${RARITY_LABEL[result.rarity]})\npero no se pudo cargar su imagen`);
    } finally {
      this.busy = false;
      if (this.alive) this.refreshHud();
    }
  }

  private showResult(id: number, name: string, types: string[], rarity: Rarity, note: string, key: string) {
    this.message.setText('');
    if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const color = RARITY_COLORS[rarity];

    // Cuadro con borde doble del color de la rareza
    const card = drawBox(this.add.graphics(), -170, -150, 340, 300, { radius: 20, border: color });
    const img = this.add.image(0, -50, key).setDisplaySize(170, 170);
    const title = this.add.text(0, 56, `${capitalize(name)}  #${id}`, { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#2b3a67' }).setOrigin(0.5);
    const rar = this.add.text(-160 + 20, 90, RARITY_LABEL[rarity], { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: hex(color) }).setOrigin(0, 0.5).setStroke('#2b3a67', 3);
    const chips = types.flatMap((t, k) => addTypeChip(this, 40 + k * 80, 90, typeNameEs(t), typeColor(t), 74, 24));
    const info = this.add.text(0, 124, note, { fontFamily: FONT, fontSize: '16px', color: '#4a5578' }).setOrigin(0.5);

    this.resultLayer = this.add.container(480, 206, [card, img, title, rar, ...chips, info]).setScale(0.2).setAlpha(0);
    this.tweens.add({ targets: this.resultLayer, scale: 0.85, alpha: 1, duration: 320, ease: 'Back.easeOut' });
  }

  update() {
    if (this.leaving) return;
    const J = Phaser.Input.Keyboard.JustDown;
    const k = this.keys;
    let d = (J(k.DOWN) || J(k.S) || J(k.RIGHT) || J(k.D) ? 1 : 0) - (J(k.UP) || J(k.W) || J(k.LEFT) || J(k.A) ? 1 : 0);
    let ok = J(k.ENTER) || J(k.SPACE);
    let back = J(k.ESC);

    const pad = this.input.gamepad?.getPad(0);
    if (pad && pad.connected) {
      const dir = pad.down || pad.right || pad.leftStick.y > 0.5 || pad.leftStick.x > 0.5 ? 1 : pad.up || pad.left || pad.leftStick.y < -0.5 || pad.leftStick.x < -0.5 ? -1 : 0;
      const now = { dir, ok: pad.A, back: pad.B };
      if (dir !== 0 && dir !== this.padPrev.dir) d += dir;
      if (now.ok && !this.padPrev.ok) ok = true;
      if (now.back && !this.padPrev.back) back = true;
      this.padPrev = now;
    }

    if (back) return this.goBack();
    const n = this.buttons.length;
    if (d !== 0) this.select((this.selected + Math.sign(d) + n) % n);
    if (ok) this.actions[this.selected]();
  }
}
