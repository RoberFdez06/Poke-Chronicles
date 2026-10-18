import Phaser from 'phaser';
import { fetchPokemonCard, PokemonCard } from '../data/pokeapi';
import { REGIONS, Region } from '../data/regions';
import { unlockPokemon } from '../data/save';
import { MenuList, NavInput, UI } from '../ui/nav';
import { addBackButton, buildPokemonCard, loadCardTextures } from '../ui/cards';

/** Margen tras cambiar de paso en el que se ignora confirmar (un Enter mantenido no elige solo). */
const INPUT_DELAY_MS = 350;

/**
 * Primera partida (aún no tienes ningún Pokémon): eliges región y luego uno de sus 3 iniciales.
 * Ese Pokémon queda desbloqueado para siempre.
 */
export class FirstStarterScene extends Phaser.Scene {
  private slot = 0;
  private nav!: NavInput;
  private step: 'region' | 'starter' | 'loading' = 'region';
  private regionList?: MenuList;
  private layer?: Phaser.GameObjects.Container;
  private region?: Region;
  private cards: PokemonCard[] = [];
  private tiles: { box: Phaser.GameObjects.Container; glow: Phaser.GameObjects.Graphics }[] = [];
  private selected = 0;
  private readyAt = 0;
  private leaving = false;
  /** Para descartar una carga vieja si se ha elegido otra región mientras tanto. */
  private loadToken = 0;

  constructor() {
    super('FirstStarter');
  }

  init(data?: { slot?: number }) {
    this.slot = data?.slot ?? 0;
  }

  create() {
    this.leaving = false;
    this.tiles = [];
    this.cards = [];
    this.nav = new NavInput(this);
    addBackButton(this, () => this.back());
    this.showRegions();
  }

  private clear() {
    this.regionList?.destroy();
    this.regionList = undefined;
    this.layer?.destroy();
    this.layer = undefined;
    this.tiles = [];
  }

  private showRegions(selected = 0) {
    this.clear();
    this.step = 'region';
    const title = this.add.text(480, 40, '¿De qué región es tu primer Pokémon?', { fontFamily: UI.FONT, fontSize: '30px', color: '#ffffff' }).setOrigin(0.5);
    const hint = this.add
      .text(480, 616, 'Flechas, ratón o mando para elegir · Enter, clic o A para seguir · Esc, B o "Volver" para salir', {
        fontFamily: UI.FONT,
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setAlpha(0.8);
    this.layer = this.add.container(0, 0, [title, hint]);
    this.regionList = new MenuList(this, 480, 106, REGIONS.map((r) => r.name), (i) => this.pickRegion(i), {
      w: 320,
      h: 46,
      gap: 9,
      fontSize: 22,
    });
    this.regionList.select(selected);
    this.readyAt = this.time.now + INPUT_DELAY_MS;
  }

  private async pickRegion(i: number) {
    if (this.step !== 'region' || this.time.now < this.readyAt) return;
    this.region = REGIONS[i];
    this.clear();
    this.step = 'loading';
    const token = ++this.loadToken;
    const loading = this.add.text(480, 320, 'Cargando Pokémon…', { fontFamily: UI.FONT, fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
    this.layer = this.add.container(0, 0, [loading]);
    try {
      this.cards = await Promise.all(this.region.starters.map(fetchPokemonCard));
      await loadCardTextures(this, this.cards);
    } catch (err) {
      if (token === this.loadToken && this.step === 'loading') loading.setText('No se pudo cargar PokeAPI.\n' + String(err) + '\n\nEsc, B o "Volver" para elegir otra región');
      return;
    }
    // Si mientras cargaba se ha vuelto atrás, no se dibuja
    if (token !== this.loadToken || this.step !== 'loading' || !this.scene.isActive()) return;
    this.showStarters();
  }

  private showStarters() {
    this.clear();
    this.step = 'starter';
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.text(480, 40, `Iniciales de ${this.region!.name}`, { fontFamily: UI.FONT, fontSize: '34px', color: '#ffffff' }).setOrigin(0.5),
      this.add
        .text(480, 616, 'Flechas, ratón o mando para elegir · Enter, clic o A para empezar · Esc, B o "Volver" para cambiar de región', {
          fontFamily: UI.FONT,
          fontSize: '15px',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setAlpha(0.8),
    ];
    this.cards.forEach((c, k) => {
      const t = buildPokemonCard(this, c, 480 + (k - 1) * 240, 330);
      t.box.on('pointerover', () => this.select(k));
      t.box.on('pointerdown', () => this.choose(k));
      this.tiles.push(t);
      parts.push(t.box);
    });
    this.layer = this.add.container(0, 0, parts);
    this.readyAt = this.time.now + INPUT_DELAY_MS;
    this.select(1);
  }

  private select(i: number) {
    this.selected = i;
    this.tiles.forEach((t, k) => {
      t.glow.setVisible(k === i);
      t.box.setScale(k === i ? 1.08 : 1);
    });
  }

  private choose(i: number) {
    if (this.leaving || this.step !== 'starter' || this.time.now < this.readyAt) return;
    this.leaving = true;
    const id = this.cards[i].id;
    unlockPokemon(id);
    this.scene.start('Game', { starterId: id, slot: this.slot });
  }

  private back() {
    if (this.leaving) return;
    if (this.step === 'region') {
      this.leaving = true;
      this.scene.start('Slots');
      return;
    }
    const i = REGIONS.indexOf(this.region!);
    this.showRegions(Math.max(0, i));
  }

  update() {
    if (this.leaving) return;
    const s = this.nav.read();
    if (s.back) return this.back();
    if (this.step === 'region' && this.regionList) {
      if (s.dy !== 0) this.regionList.move(s.dy);
      if (s.ok) this.regionList.activate();
    } else if (this.step === 'starter') {
      if (s.dx !== 0) this.select((this.selected + Math.sign(s.dx) + this.tiles.length) % this.tiles.length);
      if (s.ok) this.choose(this.selected);
    }
  }
}
