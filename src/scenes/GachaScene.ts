import Phaser from 'phaser';
import { fetchPokemonCard } from '../data/pokeapi';
import { buildPools, GACHA_RATES, pull, PULL_COST, RARITIES, RARITY_LABEL, Rarity, RarityPools, SpeciesFact } from '../data/gacha';
import { addCoins, loadCoins, loadUnlocked, spendCoins, unlockPokemon } from '../data/save';
import { typeNameEs } from '../data/types';

const FONT = 'system-ui, sans-serif';
const NAVY = 0x2b3a67;
const PANEL = 0xeaf4ff;
const GOLD = 0xffd34d;
/** Monedas que devuelve una tirada repetida. */
const DUPLICATE_REFUND = 30;
const BTN = { w: 300, h: 54 };

const RARITY_COLOR: Record<Rarity, number> = {
  common: 0x9aa5b1,
  rare: 0x4aa3ff,
  epic: 0xb05cff,
  legendary: 0xffb02e,
  ultra: 0xff4fa0,
};

type Key = Phaser.Input.Keyboard.Key;
type KeyName = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'A' | 'D' | 'W' | 'S' | 'ENTER' | 'SPACE' | 'ESC';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Gacha: gasta monedas (ganadas jugando) para desbloquear Pokémon. Teclado, ratón y mando. */
export class GachaScene extends Phaser.Scene {
  private pools: RarityPools | null = null;
  private buttons: { box: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }[] = [];
  private actions: (() => void)[] = [];
  private selected = 0;
  private busy = false;
  private leaving = false;
  private keys!: Record<KeyName, Key>;
  private padPrev = { dir: 0, ok: false, back: false };
  private coinsText!: Phaser.GameObjects.Text;
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

    this.add.text(480, 56, 'Gacha', { fontFamily: FONT, fontSize: '52px', fontStyle: 'bold', color: '#ffd34d' }).setOrigin(0.5).setStroke('#2b3a67', 10);
    this.coinsText = this.add.text(924, 40, '', { fontFamily: FONT, fontSize: '26px', color: '#ffd34d' }).setOrigin(1, 0.5);
    this.ownedText = this.add.text(924, 72, '', { fontFamily: FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(1, 0.5).setAlpha(0.8);
    this.message = this.add
      .text(480, 372, 'Cargando…', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', align: 'center' })
      .setOrigin(0.5);

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

    this.buildButton(`Tirar (${PULL_COST} monedas)`, 480, 440, () => this.doPull());
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
    const res = await fetch(`${import.meta.env.BASE_URL}data/species-index.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const index = (await res.json()) as SpeciesFact[];
    if (!Array.isArray(index) || index.length === 0) throw new Error('lista vacía');
    this.pools = buildPools(index);
    if (this.alive) this.message.setText('Tira para conseguir un Pokémon nuevo');
  }

  private refreshHud() {
    this.coinsText.setText(`Monedas: ${loadCoins()}`);
    this.ownedText.setText(`Desbloqueados: ${loadUnlocked().length}`);
  }

  private buildButton(text: string, x: number, y: number, action: () => void) {
    const i = this.buttons.length;
    const bg = this.add.graphics();
    const label = this.add.text(0, 0, text, { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#2b3a67' }).setOrigin(0.5);
    const box = this.add.container(x, y, [bg, label]).setSize(BTN.w, BTN.h);
    box.setInteractive(new Phaser.Geom.Rectangle(-BTN.w / 2, -BTN.h / 2, BTN.w, BTN.h), Phaser.Geom.Rectangle.Contains);
    box.input!.cursor = 'pointer';
    box.on('pointerover', () => this.select(i));
    box.on('pointerdown', () => {
      this.select(i);
      action();
    });
    this.buttons.push({ box, bg, label });
  }

  private select(i: number) {
    this.selected = i;
    this.buttons.forEach(({ box, bg }, k) => {
      const sel = k === i;
      bg.clear();
      bg.fillStyle(sel ? GOLD : PANEL, 1).fillRoundedRect(-BTN.w / 2, -BTN.h / 2, BTN.w, BTN.h, 16);
      bg.lineStyle(5, NAVY, 1).strokeRoundedRect(-BTN.w / 2, -BTN.h / 2, BTN.w, BTN.h, 16);
      box.setScale(sel ? 1.06 : 1);
    });
  }

  private goBack() {
    if (this.leaving || this.busy) return;
    this.leaving = true;
    this.scene.start('Menu');
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
    if (!spendCoins(PULL_COST)) {
      this.say(`Te faltan monedas (hacen falta ${PULL_COST}).\nSe ganan limpiando salas en el juego`);
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
        addCoins(DUPLICATE_REFUND);
        note = `¡Repetido! Te devolvemos ${DUPLICATE_REFUND} monedas`;
      } else {
        unlockPokemon(result.speciesId);
        note = '¡Nuevo Pokémon desbloqueado!';
      }
      this.showResult(card.id, card.name, card.types, result.rarity, note, key);
    } catch (err) {
      // La tirada no se pierde si no se pudo mostrar: se desbloquea igual y se avisa
      if (!result.duplicate) unlockPokemon(result.speciesId);
      else addCoins(DUPLICATE_REFUND);
      this.say(`Ha salido el Pokémon nº ${result.speciesId} (${RARITY_LABEL[result.rarity]})\npero no se pudo cargar su imagen`);
    } finally {
      this.busy = false;
      if (this.alive) this.refreshHud();
    }
  }

  private showResult(id: number, name: string, types: string[], rarity: Rarity, note: string, key: string) {
    this.message.setText('');
    if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const color = RARITY_COLOR[rarity];

    const card = this.add.graphics();
    card.fillStyle(PANEL, 1).fillRoundedRect(-170, -150, 340, 300, 22);
    card.lineStyle(8, color, 1).strokeRoundedRect(-170, -150, 340, 300, 22);
    const img = this.add.image(0, -50, key).setDisplaySize(170, 170);
    const title = this.add.text(0, 56, `${capitalize(name)}  #${id}`, { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#2b3a67' }).setOrigin(0.5);
    const rar = this.add.text(0, 90, `${RARITY_LABEL[rarity]} · ${types.map(typeNameEs).join(' / ')}`, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#' + color.toString(16).padStart(6, '0') }).setOrigin(0.5).setStroke('#2b3a67', 3);
    const info = this.add.text(0, 124, note, { fontFamily: FONT, fontSize: '16px', color: '#4a5578' }).setOrigin(0.5);

    this.resultLayer = this.add.container(480, 230, [card, img, title, rar, info]).setScale(0.2).setAlpha(0);
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
