import Phaser from 'phaser';
import { fetchAttackMovesForTypes, fetchPokemon, fetchPokemonCard } from '../data/pokeapi';
import { filterMovesByTypes } from '../data/moves';
import { typeColor, typeHex } from '../data/types';
import { addCoins } from '../data/save';
import { clearRun, saveRun, FloorItemSave, RunSave, RUN_VERSION, SavedDrop } from '../data/runSave';
import { loadSpeciesIndex } from '../data/speciesIndex';
import {
  bossCoinsFor,
  bossPool,
  difficultyFor,
  pickBoss,
  roomCoinsFor,
  roomCountFor,
  FloorDifficulty,
  FLOOR_COUNT,
} from '../level/progression';
import type { PauseData } from './PauseScene';
import {
  BASE_STATS,
  computeStats,
  passiveById,
  rollItem,
  toMovePower,
  DroppedItem,
  MovePower,
  PlayerStats,
} from '../data/items';
import { generateFloor, mulberry32, DIRS, OPPOSITE, Dir, Floor, Room } from '../level/floorGen';
import { behaviorFor, enemyPool, enemyStats, pickFloorEnemies, EnemyBehavior, FALLBACK_ENEMIES } from '../data/enemies';
import { drawMinimap } from './minimap';

// Cada sala ocupa una pantalla del mundo; ROOM es su interior relativo a la celda
const VIEW = { w: 960, h: 640 };
const ROOM = { x: 80, y: 80, w: 800, h: 480 };
const WALL = 40;
const DOOR = 120;
const FONT = 'system-ui, sans-serif';
const SLOT_COUNT = 4;
/** Probabilidad de que una sala de combate limpiada deje un objeto. */
const CLEAR_DROP_CHANCE = 0.25;
/** Separación en radianes entre los proyectiles de un abanico. */
const SPREAD = 0.2;

const WALL_COLOR = 0x2b3a67;
const DOOR_COLOR = 0x8a5a3c;
const FLOOR_COLORS: Record<Room['kind'], number> = {
  start: 0xdff3ff,
  combat: 0xcdeee0,
  item: 0xfff1c9,
  boss: 0xf6d6d6,
};

type Sprite = Phaser.Physics.Arcade.Sprite;
type Body = Phaser.Physics.Arcade.Body;
type Rect = { x: number; y: number; w: number; h: number };
type Key = Phaser.Input.Keyboard.Key;
const asSprite = (o: unknown) => o as Sprite;
const pretty = (s: string) => s.replace(/-/g, ' ');

/** Lo que pasa de un piso al siguiente al bajar por la trampilla. */
export type FloorCarry = Pick<
  RunSave,
  'floor' | 'bossHistory' | 'hp' | 'passives' | 'slots' | 'nextSlotReplace' | 'movePool' | 'earned'
>;

export interface GameData {
  starterId?: number;
  slot?: number;
  resume?: RunSave;
  carry?: FloorCarry;
}

/** Una de las especies de enemigo del piso. */
interface FoeKind {
  key: string;
  behavior: EnemyBehavior;
  bst: number;
  type: string;
}

/** Estado de la IA de cada enemigo (guardado en el sprite con setData('ai')). */
interface EnemyAI {
  behavior: EnemyBehavior;
  /** Fase: 'walk' (normal), 'windup'/'dash' (embestir), 'vanish'/'appear' (saltar). */
  state: 'walk' | 'windup' | 'dash' | 'vanish' | 'appear';
  /** Momento en que acaba la fase actual (o toca el siguiente disparo). */
  until: number;
  dir: Phaser.Math.Vector2;
  /** Lado hacia el que rodea al jugador quien dispara: 1 o -1. */
  side: number;
  type: string;
  boss: boolean;
}

/** Velocidad de los proyectiles enemigos (px/s) y cuánto duran. */
const FOE_SHOT_SPEED = 250;
const FOE_SHOT_LIFE = 2600;

interface ShotOpts {
  damage: number;
  speed: number;
  /** Milisegundos en el aire. */
  life: number;
  size: number;
  color: number;
  /** Enemigos que atraviesa. */
  pierce: number;
  /** Rebotes en las paredes. */
  bounces: number;
}

export class GameScene extends Phaser.Scene {
  private player!: Sprite;
  private enemies!: Phaser.Physics.Arcade.Group;
  private shots!: Phaser.Physics.Arcade.Group;
  /** Proyectiles de los enemigos que disparan. */
  private foeShots!: Phaser.Physics.Arcade.Group;
  /** Especies de enemigo de este piso (salen de la semilla del piso, así al continuar son las mismas). */
  private foeKinds: FoeKind[] = [];
  private bossType = 'normal';
  private pickups!: Phaser.Physics.Arcade.Group;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private doorBlocks!: Phaser.Physics.Arcade.StaticGroup;
  private doorMap = new Map<string, Phaser.GameObjects.Rectangle>();
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Key>;
  private arrows!: Phaser.Types.Input.Keyboard.CursorKeys;
  private abilityKeys: Key[] = [];
  private restartKey!: Key;

  private floor!: Floor;
  private current!: Room;
  private visited = new Set<number>();
  private cleared = new Set<number>();
  private transitioning = false;
  private bossKey = '';
  /** Pokémon elegido en StarterScene y la clave de sus texturas. */
  private starterId = 4;
  private starterName = '';
  private playerKey = 'starter-4';
  /** Hueco donde se guarda la partida y, si se continúa, lo guardado. */
  private slot = 0;
  private resume: RunSave | null = null;
  /** Estado que viene del piso anterior (al bajar por la trampilla). */
  private carry: FloorCarry | null = null;
  private floorSeed = 0;
  private bossId = 1;
  /** Número de piso (1 = el primero) y su dificultad. */
  private floorNum = 1;
  private difficulty: FloorDifficulty = difficultyFor(1);
  private bossHistory: number[] = [];
  /** Trampilla al piso siguiente: aparece al vencer al jefe y se activa cuando te alejas de ella. */
  private trapdoor?: { x: number; y: number; armed: boolean };
  /** Objetos que hay en el suelo (para guardarlos). */
  private floorItems: FloorItemSave[] = [];
  private pauseKey!: Key;
  private pauseBtn?: Phaser.GameObjects.Text;

  // Combate: disparo continuo, objetos pasivos y poderes (movimientos) en ranuras
  private stats: PlayerStats = { ...BASE_STATS };
  private passives: string[] = [];
  private slots: (MovePower | null)[] = [];
  private slotReady: number[] = [];
  private nextSlotReplace = 0;
  private movePool: MovePower[] = [];
  private tearType = 'normal';
  private nextTear = 0;
  private padPrev = [false, false, false, false];
  /** Última dirección en la que miró o disparó el jugador. */
  private aim = new Phaser.Math.Vector2(0, 1);

  private hp = 100;
  private invulnUntil = 0;
  private ended = false;
  private endedAt = 0;
  private earned = 0;
  private escKey!: Phaser.Input.Keyboard.Key;
  private menuPadPrev = false;
  /** El cursor está sobre una ranura de poder: ahí un clic no dispara. */
  private overHud = false;

  private hud: Phaser.GameObjects.Text[] = [];
  private hpText!: Phaser.GameObjects.Text;
  private invText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private bannerTimer?: Phaser.Time.TimerEvent;
  private minimap!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Game');
  }

  init(data?: GameData) {
    this.resume = data?.resume ?? null;
    this.carry = data?.carry ?? null;
    this.slot = data?.slot ?? 0;
    this.starterId = this.resume?.starterId ?? data?.starterId ?? 4;
  }

  create() {
    // scene.restart reutiliza la instancia: reiniciamos el estado
    this.passives = [];
    this.stats = computeStats(this.passives);
    this.hp = this.stats.maxHp;
    this.slots = Array<MovePower | null>(SLOT_COUNT).fill(null);
    this.slotReady = Array<number>(SLOT_COUNT).fill(0);
    this.nextSlotReplace = 0;
    this.movePool = [];
    this.tearType = 'normal';
    this.nextTear = 0;
    this.aim.set(0, 1);
    this.invulnUntil = 0;
    this.ended = false;
    this.endedAt = 0;
    this.earned = 0;
    this.overHud = false;
    this.transitioning = false;
    this.padPrev = [false, false, false, false];
    this.hud = [];
    this.floorItems = [];
    this.doorMap.clear();
    this.visited.clear();
    this.cleared.clear();
    this.bannerTimer = undefined;
    this.trapdoor = undefined;
    this.floorNum = 1;
    this.bossHistory = [];
    const c = this.carry;
    if (c) {
      // Bajas al piso siguiente con tus objetos, poderes y PS
      this.floorNum = c.floor;
      this.bossHistory = [...c.bossHistory];
      this.passives = [...c.passives];
      this.stats = computeStats(this.passives);
      this.hp = Math.min(this.stats.maxHp, c.hp);
      this.slots = Array.from({ length: SLOT_COUNT }, (_, i) => c.slots[i] ?? null);
      this.nextSlotReplace = c.nextSlotReplace;
      this.movePool = [...c.movePool];
      this.earned = c.earned;
    }
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.resetFX();

    const loading = this.add
      .text(480, 320, 'Cargando Pokémon…', { fontFamily: FONT, fontSize: '28px', color: '#ffffff' })
      .setOrigin(0.5);

    this.boot(loading).catch((err) => {
      loading.setText('No se pudo cargar PokeAPI.\n' + String(err));
    });
  }

  private async boot(loading: Phaser.GameObjects.Text) {
    const r = this.resume;
    if (r) {
      this.floorNum = r.floor;
      this.bossHistory = [...r.bossHistory];
    }
    this.difficulty = difficultyFor(this.floorNum);
    // Al continuar, el piso se regenera igual con la misma semilla; cada piso nuevo es más grande
    this.floorSeed = r?.floorSeed ?? Phaser.Math.Between(0, 0x7fffffff);
    this.floor = generateFloor({ seed: this.floorSeed, roomCount: r?.roomCount ?? roomCountFor(this.floorNum, Math.random) });

    // Los poderes que saldrán en el suelo son movimientos de los tipos de tu Pokémon; se piden ya, en paralelo
    if (r) this.movePool = [...r.movePool];
    const poolReady = fetchPokemon(this.starterId)
      .then(async (s) => {
        // Las partidas guardadas antes de esto podían traer poderes de otros tipos
        this.movePool = filterMovesByTypes(this.movePool, s.types);
        if (this.movePool.length < 4) await this.fillMovePool(s.types, 6);
      })
      .catch(() => undefined);

    // El jefe siempre es un legendario o singular, sin repetir en la partida mientras se pueda
    const index = await loadSpeciesIndex().catch(() => []);
    let bossId = r?.bossId;
    if (bossId === undefined) {
      bossId = pickBoss(bossPool(index), Math.random, this.bossHistory);
      this.bossHistory.push(bossId);
    }
    this.bossId = bossId;
    // Enemigos del piso: más fuertes cuanto más hondo; la semilla del piso los fija (no hace falta guardarlos)
    const foeIds = pickFloorEnemies(enemyPool(index, this.floorNum), mulberry32(this.floorSeed ^ 0x5bd1e995));
    const [starter, boss, foeCards] = await Promise.all([
      fetchPokemon(this.starterId),
      fetchPokemon(bossId),
      Promise.all(foeIds.map((id) => fetchPokemonCard(id).catch(() => null))),
    ]);
    let foes = foeCards.filter((c) => c !== null);
    if (foes.length === 0) foes = [await fetchPokemonCard(FALLBACK_ENEMIES[0])];
    this.foeKinds = foes.map((c) => ({
      key: `foe-${c.id}`,
      behavior: behaviorFor(c.types),
      bst: index.find((s) => s.id === c.id)?.bst ?? 300,
      type: c.types[0] ?? 'normal',
    }));
    this.bossType = boss.types[0] ?? 'normal';
    this.tearType = starter.types[0] ?? 'normal';
    this.starterName = starter.name;
    // Misma clave que usa StarterScene, así las texturas ya están cargadas
    this.playerKey = `starter-${starter.id}`;
    this.bossKey = `boss-${boss.id}`;
    await poolReady;

    this.load.crossOrigin = 'anonymous';
    const sheets: [string, { sprites: { front: string; back: string } }][] = [
      [this.playerKey, starter],
      [this.bossKey, boss],
      ...foes.map((c) => [`foe-${c.id}`, c] as [string, typeof c]),
    ];
    for (const [key, data] of sheets) {
      if (!this.textures.exists(`${key}-front`)) this.load.image(`${key}-front`, data.sprites.front);
      if (!this.textures.exists(`${key}-back`)) this.load.image(`${key}-back`, data.sprites.back);
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      // Sprites pixel: escalado sin suavizar para que se vean nítidos
      for (const [key] of sheets) {
        for (const side of ['front', 'back']) {
          const tex = `${key}-${side}`;
          if (this.textures.exists(tex)) this.textures.get(tex).setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
      }
      loading.destroy();
      this.startFloor();
    });
    this.load.start();
  }

  /** Pide a PokeAPI movimientos de ataque de tus tipos; si alguno falla, simplemente habrá menos. */
  private async fillMovePool(types: readonly string[], n: number) {
    const found = await fetchAttackMovesForTypes(types, n + 4);
    // Sin repetir los que ya están en el suelo o en tus ranuras
    const seen = new Set<number>([...this.movePool, ...this.slots].flatMap((m) => (m ? [m.id] : [])));
    for (const m of found) {
      if (seen.has(m.id) || this.movePool.length >= n) continue;
      seen.add(m.id);
      this.movePool.push(toMovePower(m));
    }
  }

  /**
   * Gira el sprite hacia (v.x, v.y) como en Isaac: arriba enseña la espalda,
   * abajo el frente, y a los lados el frente volteado (derecha) o normal (izquierda).
   */
  private face(sprite: Sprite, v: { x: number; y: number }) {
    if (v.x === 0 && v.y === 0) return;
    // En diagonal (empate) gana el lado, para que se vea el volteo izquierda/derecha
    const dir: Dir = Math.abs(v.x) >= Math.abs(v.y) ? (v.x < 0 ? 'left' : 'right') : v.y < 0 ? 'up' : 'down';
    if (sprite.getData('facing') === dir) return;
    sprite.setData('facing', dir);

    const base = sprite.getData('sheet') as string;
    const size = sprite.getData('size') as number;
    sprite.setTexture(`${base}-${dir === 'up' ? 'back' : 'front'}`);
    sprite.setFlipX(dir === 'right');
    sprite.setDisplaySize(size, size);
  }

  private startFloor() {
    this.physics.resume();

    if (!this.textures.exists('shot')) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1).fillCircle(10, 10, 10);
      g.generateTexture('shot', 20, 20);
      g.destroy();
    }
    if (!this.textures.exists('foe-shot')) {
      // Disparo enemigo: con borde oscuro (el tinte no lo aclara) para distinguirlo de los tuyos
      const g = this.add.graphics();
      g.fillStyle(0x1d2848, 1).fillCircle(12, 12, 12);
      g.fillStyle(0xffffff, 1).fillCircle(12, 12, 8);
      g.generateTexture('foe-shot', 24, 24);
      g.destroy();
    }

    this.physics.world.setBounds(0, 0, this.floor.cols * VIEW.w, this.floor.rows * VIEW.h);
    this.walls = this.physics.add.staticGroup();
    this.doorBlocks = this.physics.add.staticGroup();
    this.pickups = this.physics.add.group();
    this.floor.rooms.forEach((r) => this.buildRoom(r));

    // Al continuar: objetos, estado del jugador y sala donde estabas
    const r = this.resume;
    if (r) this.restoreRun(r);

    // Jugador, con un cuerpo circular más pequeño que el arte para pasar por las puertas
    const start = this.floor.rooms[r?.roomId ?? this.floor.startId] ?? this.floor.rooms[this.floor.startId];
    const si = this.interior(start);
    this.player = this.physics.add.sprite(si.cx, si.cy, `${this.playerKey}-front`);
    this.player.setDisplaySize(84, 84).setDepth(5).setData('sheet', this.playerKey).setData('size', 84);
    const fw = this.player.width;
    this.player.setCircle(fw * 0.3, fw * 0.2, fw * 0.2);

    this.enemies = this.physics.add.group();
    this.shots = this.physics.add.group();
    this.foeShots = this.physics.add.group();

    this.physics.add.collider(this.player, [this.walls, this.doorBlocks]);
    this.physics.add.collider(this.enemies, [this.walls, this.doorBlocks]);
    // Collider (no overlap) para que los disparos con rebote reboten de verdad
    this.physics.add.collider(this.shots, [this.walls, this.doorBlocks], (s) => this.onShotWall(asSprite(s)));
    this.physics.add.overlap(this.shots, this.enemies, (s, e) => this.onHit(asSprite(s), asSprite(e)));
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => this.hurtPlayer(asSprite(e)));
    this.physics.add.collider(this.foeShots, [this.walls, this.doorBlocks], (s) => asSprite(s).destroy());
    this.physics.add.overlap(this.player, this.foeShots, (_p, s) => {
      this.hurtPlayer(asSprite(s));
      asSprite(s).destroy();
    });
    this.physics.add.overlap(this.player, this.pickups, (_p, it) => this.pickItem(asSprite(it)));

    // Entrada
    const kb = this.input.keyboard!;
    this.wasd = kb.addKeys('W,A,S,D') as GameScene['wasd'];
    this.arrows = kb.createCursorKeys();
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.abilityKeys = [K.ONE, K.TWO, K.THREE, K.FOUR].map((c) => kb.addKey(c));
    this.restartKey = kb.addKey(K.R);
    this.escKey = kb.addKey(K.ESC);
    this.pauseKey = kb.addKey(K.P);
    this.menuPadPrev = false;
    // El clic derecho sirve para moverse con el ratón, así que sin menú contextual
    this.input.mouse?.disableContextMenu();

    // HUD fijo en pantalla
    const style = { fontFamily: FONT, fontSize: '20px', color: '#ffffff' };
    this.hpText = this.add.text(90, 32, '', style).setDepth(10).setScrollFactor(0);
    this.invText = this.add
      .text(90, 58, '', { fontFamily: FONT, fontSize: '14px', color: '#ffffff', wordWrap: { width: 600 } })
      .setDepth(10)
      .setScrollFactor(0);
    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = this.add.text(90 + i * 210, 590, '', style).setDepth(10).setScrollFactor(0);
      // Con ratón, un clic en la ranura lanza el poder
      // Área fija: el texto cambia de tamaño y el área de clic no se actualizaría sola
      slot.setInteractive(new Phaser.Geom.Rectangle(-6, -6, 200, 38), Phaser.Geom.Rectangle.Contains);
      if (slot.input) slot.input.cursor = 'pointer';
      slot.on('pointerover', () => (this.overHud = true));
      slot.on('pointerout', () => (this.overHud = false));
      slot.on('pointerdown', () => !this.ended && !this.transitioning && this.castSlot(i, this.time.now));
      this.hud.push(slot);
    }
    this.banner = this.add
      .text(480, 320, '', {
        fontFamily: FONT,
        fontSize: '44px',
        color: '#2b3a67',
        align: 'center',
        wordWrap: { width: 820 },
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setScrollFactor(0);
    this.minimap = this.add.graphics().setDepth(30).setScrollFactor(0);

    // Botón de pausa para jugar solo con ratón
    const pb = this.add
      .text(24, 32, '❚❚', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', backgroundColor: '#2b3a67' })
      .setPadding(10, 6)
      .setDepth(10)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    pb.on('pointerover', () => (this.overHud = true));
    pb.on('pointerout', () => (this.overHud = false));
    pb.on('pointerdown', () => this.openPause());
    this.pauseBtn = pb;

    // Si ya habías vencido al jefe, la trampilla sigue ahí
    if (this.cleared.has(this.floor.bossId) && this.floorNum < FLOOR_COUNT) this.spawnTrapdoor();

    this.refreshInventory();
    this.cameras.main.centerOn(si.cx, si.cy);
    this.enterRoom(start);
    if (r) this.showBanner(`Partida cargada · Piso ${this.floorNum}`, 1200);
    else this.showBanner(`Piso ${this.floorNum}`, 1200);
  }

  // --- Guardado (como en Isaac: solo, en el hueco elegido) ---

  private toSaved(item: DroppedItem): SavedDrop {
    return item.kind === 'passive' ? { kind: 'passive', id: item.item.id } : { kind: 'move', move: item.move };
  }

  private fromSaved(d: SavedDrop): DroppedItem | null {
    if (d.kind === 'move') return { kind: 'move', move: d.move };
    const item = passiveById(d.id);
    return item ? { kind: 'passive', item } : null;
  }

  private restoreRun(r: RunSave) {
    this.passives = r.passives.filter((id) => passiveById(id));
    this.stats = computeStats(this.passives);
    this.hp = Math.min(this.stats.maxHp, r.hp);
    this.slots = Array.from({ length: SLOT_COUNT }, (_, i) => r.slots[i] ?? null);
    this.nextSlotReplace = r.nextSlotReplace;
    this.earned = r.earned;
    r.visited.forEach((id) => this.visited.add(id));
    r.cleared.forEach((id) => this.cleared.add(id));
    for (const f of r.floorItems) {
      const item = this.fromSaved(f.drop);
      if (item) this.spawnPickup(f.roomId, f.x, f.y, item);
    }
  }

  private saveNow() {
    if (this.ended || !this.current) return;
    saveRun(this.slot, {
      version: RUN_VERSION,
      savedAt: Date.now(),
      starterId: this.starterId,
      starterName: this.starterName,
      floor: this.floorNum,
      bossHistory: [...this.bossHistory],
      floorSeed: this.floorSeed,
      roomCount: this.floor.rooms.length,
      bossId: this.bossId,
      roomId: this.current.id,
      visited: [...this.visited],
      cleared: [...this.cleared],
      hp: Math.max(1, this.hp),
      passives: [...this.passives],
      slots: [...this.slots],
      nextSlotReplace: this.nextSlotReplace,
      movePool: [...this.movePool],
      floorItems: this.floorItems.map((f) => ({ ...f })),
      earned: this.earned,
    });
  }

  // --- Pausa ---

  private openPause() {
    if (this.ended || this.transitioning || !this.player || this.scene.isPaused()) return;
    this.player.setVelocity(0, 0);
    this.overHud = false;
    const counts = new Map<string, number>();
    for (const id of this.passives) counts.set(id, (counts.get(id) ?? 0) + 1);
    const data: PauseData = {
      starterName: this.starterName,
      slot: this.slot,
      floor: this.floorNum,
      floorCount: FLOOR_COUNT,
      hp: this.hp,
      stats: this.stats,
      items: [...counts].map(([id, n]) => (passiveById(id)?.name ?? id) + (n > 1 ? ` x${n}` : '')),
      moves: [...this.slots],
      roomsCleared: this.cleared.size,
      roomCount: this.floor.rooms.length,
      earned: this.earned,
      onResume: () => {
        this.scene.stop('Pause');
        this.scene.resume();
        this.menuPadPrev = true; // Start/Select aún pulsado no vuelve a pausar
        this.padPrev = [true, true, true, true]; // ni A/B lanza un poder al volver
      },
      onRestart: () => {
        clearRun(this.slot);
        this.scene.stop('Pause');
        this.scene.start('Starter', { slot: this.slot });
      },
      onQuit: () => {
        this.saveNow();
        this.scene.stop('Pause');
        this.scene.start('Menu');
      },
    };
    this.scene.launch('Pause', data);
    this.scene.pause();
  }

  // --- Geometría de las salas ---

  private interior(room: Room) {
    const x0 = room.gx * VIEW.w + ROOM.x;
    const y0 = room.gy * VIEW.h + ROOM.y;
    const x1 = x0 + ROOM.w;
    const y1 = y0 + ROOM.h;
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }

  /** Hueco de la puerta a través de la pared. */
  private doorRect(room: Room, d: Dir): Rect {
    const i = this.interior(room);
    switch (d) {
      case 'up':
        return { x: i.cx - DOOR / 2, y: i.y0 - WALL, w: DOOR, h: WALL };
      case 'down':
        return { x: i.cx - DOOR / 2, y: i.y1, w: DOOR, h: WALL };
      case 'left':
        return { x: i.x0 - WALL, y: i.cy - DOOR / 2, w: WALL, h: DOOR };
      case 'right':
        return { x: i.x1, y: i.cy - DOOR / 2, w: WALL, h: DOOR };
    }
  }

  private buildRoom(room: Room) {
    const i = this.interior(room);
    const floorColor = FLOOR_COLORS[room.kind];
    const g = this.add.graphics().setDepth(0);

    g.fillStyle(WALL_COLOR, 1).fillRect(i.x0 - WALL, i.y0 - WALL, ROOM.w + WALL * 2, ROOM.h + WALL * 2);
    g.fillStyle(floorColor, 1).fillRoundedRect(i.x0, i.y0, ROOM.w, ROOM.h, 24);

    for (const d of DIRS) {
      const to = room.doors[d];
      if (to === undefined) continue;
      const r = this.doorRect(room, d);
      // El suelo atraviesa la pared; el marco indica si lleva al jefe o al objeto
      g.fillStyle(floorColor, 1).fillRect(r.x, r.y, r.w, r.h);
      const kind = this.floor.rooms[to].kind;
      const frame = kind === 'boss' ? 0xe53935 : kind === 'item' ? 0xffc107 : 0x1d2848;
      g.lineStyle(6, frame, 1).strokeRect(r.x, r.y, r.w, r.h);

      const block = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, DOOR_COLOR).setDepth(1);
      this.doorBlocks.add(block);
      this.doorMap.set(`${room.id}:${d}`, block);
    }

    // Paredes físicas, partidas donde hay puerta
    const has = (d: Dir) => room.doors[d] !== undefined;
    const hSide = (y: number, door: boolean) => {
      const a = i.x0 - WALL;
      const b = i.x1 + WALL;
      if (!door) return this.addWall(a, y, b - a, WALL);
      this.addWall(a, y, i.cx - DOOR / 2 - a, WALL);
      this.addWall(i.cx + DOOR / 2, y, b - i.cx - DOOR / 2, WALL);
    };
    const vSide = (x: number, door: boolean) => {
      if (!door) return this.addWall(x, i.y0, WALL, ROOM.h);
      this.addWall(x, i.y0, WALL, i.cy - DOOR / 2 - i.y0);
      this.addWall(x, i.cy + DOOR / 2, WALL, i.y1 - i.cy - DOOR / 2);
    };
    hSide(i.y0 - WALL, has('up'));
    hSide(i.y1, has('down'));
    vSide(i.x0 - WALL, has('left'));
    vSide(i.x1, has('right'));

    this.setDoorsLocked(room, false);
    // Al continuar, los objetos salen del guardado (restoreRun)
    if (room.kind === 'item' && !this.resume) this.dropItem(room.id, i.cx, i.cy);
  }

  private addWall(x: number, y: number, w: number, h: number) {
    this.walls.add(this.add.rectangle(x + w / 2, y + h / 2, w, h).setVisible(false));
  }

  private setDoorsLocked(room: Room, locked: boolean) {
    for (const d of DIRS) {
      const block = this.doorMap.get(`${room.id}:${d}`);
      if (!block) continue;
      block.setVisible(locked);
      (block.body as Phaser.Physics.Arcade.StaticBody).enable = locked;
    }
  }

  // --- Objetos ---

  /** Deja en el suelo un objeto al azar: un pasivo propio o un poder (movimiento de PokeAPI). */
  private dropItem(roomId: number, x: number, y: number) {
    this.spawnPickup(roomId, x, y, rollItem(Math.random, new Set(this.passives), this.movePool));
  }

  private spawnPickup(roomId: number, x: number, y: number, item: DroppedItem) {
    const entry: FloorItemSave = { roomId, x, y, drop: this.toSaved(item) };
    this.floorItems.push(entry);
    const color = item.kind === 'passive' ? item.item.color : typeColor(item.move.type);
    const name = item.kind === 'passive' ? item.item.name : pretty(item.move.name);

    const shadow = this.add.ellipse(x, y + 18, 90, 34, 0xc9b27a).setDepth(1);
    const s = this.pickups.create(x, y, 'shot') as Sprite;
    s.setTint(color).setScale(1.6).setDepth(2).setData('item', item).setData('entry', entry);
    const label = this.add
      .text(x, y - 38, name, { fontFamily: FONT, fontSize: '16px', color: '#2b3a67' })
      .setOrigin(0.5)
      .setDepth(3);
    s.setData('label', label);
    s.setData('shadow', shadow);
    this.tweens.add({ targets: s, y: y - 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private pickItem(sprite: Sprite) {
    if (!sprite.active) return;
    const item = sprite.getData('item') as DroppedItem;
    (sprite.getData('label') as Phaser.GameObjects.Text | undefined)?.destroy();
    (sprite.getData('shadow') as Phaser.GameObjects.Ellipse | undefined)?.destroy();
    this.floorItems = this.floorItems.filter((f) => f !== sprite.getData('entry'));
    this.tweens.killTweensOf(sprite);
    sprite.destroy();

    if (item.kind === 'passive') {
      const prevMax = this.stats.maxHp;
      this.passives.push(item.item.id);
      this.stats = computeStats(this.passives);
      // Más PS máximos también te curan esa misma cantidad
      this.hp = Math.min(this.stats.maxHp, this.hp + Math.max(0, this.stats.maxHp - prevMax));
      this.showBanner(`${item.item.name}\n${item.item.description}`, 2400);
    } else {
      const free = this.slots.indexOf(null);
      const slot = free !== -1 ? free : this.nextSlotReplace++ % SLOT_COUNT;
      this.slots[slot] = item.move;
      this.slotReady[slot] = 0;
      this.showBanner(`${pretty(item.move.name)}\nTecla ${slot + 1}`, 2400);
    }
    this.refreshInventory();
    this.saveNow();
  }

  private refreshInventory() {
    const counts = new Map<string, number>();
    for (const id of this.passives) counts.set(id, (counts.get(id) ?? 0) + 1);
    const names = [...counts].map(([id, n]) => (passiveById(id)?.name ?? id) + (n > 1 ? ` x${n}` : ''));
    this.invText.setText(names.join(' · '));
  }

  // --- Navegación entre salas ---

  private enterRoom(room: Room) {
    this.current = room;
    this.visited.add(room.id);

    if ((room.kind === 'combat' || room.kind === 'boss') && !this.cleared.has(room.id)) {
      if (room.kind === 'boss') this.spawnBoss();
      else {
        const n = Phaser.Math.Between(...this.difficulty.enemies);
        for (let k = 0; k < n; k++) this.spawnEnemy();
      }
      this.setDoorsLocked(room, true);
    }

    drawMinimap(this.minimap, this.floor, room.id, this.visited, 940, 12);
    this.saveNow();
  }

  private transition(dir: Dir) {
    const next = this.floor.rooms[this.current.doors[dir]!];
    this.transitioning = true;
    this.player.setVelocity(0, 0);
    this.shots.clear(true, true);
    this.foeShots.clear(true, true);

    // Aparece dentro de la sala nueva, junto a la puerta por la que entra
    const n = this.interior(next);
    const inset = 70;
    const pos: Record<Dir, [number, number]> = {
      up: [n.cx, n.y0 + inset],
      down: [n.cx, n.y1 - inset],
      left: [n.x0 + inset, n.cy],
      right: [n.x1 - inset, n.cy],
    };
    const [x, y] = pos[OPPOSITE[dir]];
    (this.player.body as Body).reset(x, y);

    this.cameras.main.pan(n.cx, n.cy, 300, 'Sine.easeInOut', true, (_cam: unknown, progress: number) => {
      if (progress < 1) return;
      this.transitioning = false;
      this.enterRoom(next);
    });
  }

  private checkExit() {
    const i = this.interior(this.current);
    const { x, y } = this.player;
    let exit: Dir | null = null;
    if (y < i.y0 - WALL / 2) exit = 'up';
    else if (y > i.y1 + WALL / 2) exit = 'down';
    else if (x < i.x0 - WALL / 2) exit = 'left';
    else if (x > i.x1 + WALL / 2) exit = 'right';
    if (exit && this.current.doors[exit] !== undefined) this.transition(exit);
  }

  // --- Enemigos ---

  private randomSpotInRoom(margin: number) {
    const i = this.interior(this.current);
    let x = i.cx;
    let y = i.cy;
    for (let tries = 0; tries < 50; tries++) {
      x = Phaser.Math.Between(i.x0 + margin, i.x1 - margin);
      y = Phaser.Math.Between(i.y0 + margin, i.y1 - margin);
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) >= 220) break;
    }
    return { x, y };
  }

  private spawnEnemy() {
    const kind = Phaser.Utils.Array.GetRandom(this.foeKinds) as FoeKind;
    const { x, y } = this.randomSpotInRoom(60);
    const e = this.enemies.create(x, y, `${kind.key}-front`) as Sprite;
    e.setDisplaySize(60, 60).setData('sheet', kind.key).setData('size', 60);
    const st = enemyStats(kind.bst, kind.behavior, this.difficulty);
    e.setData('hp', st.hp).setData('speed', st.speed).setData('dmg', st.damage);
    e.setData('ai', this.newAI(kind.behavior, kind.type, false));
  }

  private spawnBoss() {
    const { x, y } = this.randomSpotInRoom(110);
    const b = this.enemies.create(x, y, `${this.bossKey}-front`) as Sprite;
    b.setDisplaySize(150, 150).setData('sheet', this.bossKey).setData('size', 150);
    const d = this.difficulty;
    b.setData('hp', Math.round(500 * d.hp)).setData('speed', 70 * d.speed).setData('dmg', Math.round(20 * d.damage));
    // El jefe también se comporta según su tipo
    b.setData('ai', this.newAI(behaviorFor([this.bossType]), this.bossType, true));
    this.showBanner('¡Jefe legendario!', 1200);
  }

  /** Estado inicial de la IA; deja un respiro al entrar antes de embestir, disparar o saltar. */
  private newAI(behavior: EnemyBehavior, type: string, boss: boolean): EnemyAI {
    return {
      behavior,
      type,
      boss,
      state: 'walk',
      until: this.time.now + Phaser.Math.Between(900, 1700),
      dir: new Phaser.Math.Vector2(0, 1),
      side: Math.random() < 0.5 ? 1 : -1,
    };
  }

  /** IA de un enemigo según su comportamiento: perseguir, embestir, disparar o saltar. */
  private updateEnemy(e: Sprite, time: number) {
    const ai = e.getData('ai') as EnemyAI | undefined;
    const speed = e.getData('speed') as number;
    const toPlayer = new Phaser.Math.Vector2(this.player.x - e.x, this.player.y - e.y);
    const dist = toPlayer.length();
    if (dist > 0) toPlayer.normalize();
    const walk = (v: Phaser.Math.Vector2) => e.setVelocity(v.x * speed, v.y * speed);

    if (!ai || ai.behavior === 'chase') {
      walk(toPlayer);
      this.face(e, toPlayer);
      return;
    }

    switch (ai.behavior) {
      case 'charge':
        if (ai.state === 'walk') {
          walk(toPlayer);
          this.face(e, toPlayer);
          if (time >= ai.until) {
            // Se para y avisa (tinte amarillo) antes de lanzarse en línea recta
            ai.state = 'windup';
            ai.until = time + 450;
            e.setVelocity(0, 0).setTint(0xffe082);
          }
        } else if (ai.state === 'windup') {
          e.setVelocity(0, 0);
          this.face(e, toPlayer);
          ai.dir.copy(toPlayer);
          if (time >= ai.until) {
            ai.state = 'dash';
            ai.until = time + 600;
            e.clearTint();
            e.setVelocity(ai.dir.x * speed * 4.5, ai.dir.y * speed * 4.5);
          }
        } else if (time >= ai.until) {
          ai.state = 'walk';
          ai.until = time + Phaser.Math.Between(1200, 2000);
        }
        break;

      case 'shoot': {
        // Guarda la distancia: se acerca si estás lejos, se aleja si estás cerca y si no, te rodea
        const keep = ai.boss ? 260 : 230;
        if (dist > keep + 90) walk(toPlayer);
        else if (dist < keep - 50) walk(toPlayer.clone().negate());
        else walk(new Phaser.Math.Vector2(-toPlayer.y * ai.side, toPlayer.x * ai.side));
        this.face(e, toPlayer);
        if (time >= ai.until) {
          if (Math.random() < 0.3) ai.side = -ai.side;
          const angles = ai.boss ? [-0.3, 0, 0.3] : [0];
          for (const a of angles) this.fireFoeShot(e, toPlayer.clone().rotate(a), ai.type);
          ai.until = time + (ai.boss ? 1100 : Phaser.Math.Between(1500, 2200));
        }
        break;
      }

      case 'hop':
        if (ai.state === 'walk') {
          walk(toPlayer);
          this.face(e, toPlayer);
          if (time >= ai.until) {
            // Desaparece un momento (sin cuerpo: ni se le puede dar ni hace daño)
            ai.state = 'vanish';
            ai.until = time + 260;
            e.setVelocity(0, 0).setAlpha(0.15);
            (e.body as Body).enable = false;
          }
        } else if (ai.state === 'vanish') {
          if (time >= ai.until) {
            const p = this.hopSpot(ai.boss ? 200 : 140);
            (e.body as Body).enable = true;
            (e.body as Body).reset(p.x, p.y);
            e.setAlpha(0.55);
            ai.state = 'appear';
            ai.until = time + 300;
          }
        } else {
          // Recién aparecido no hace daño: da tiempo a reaccionar
          e.setVelocity(0, 0);
          this.face(e, toPlayer);
          if (time >= ai.until) {
            e.setAlpha(1);
            ai.state = 'walk';
            ai.until = time + Phaser.Math.Between(1600, 2500);
          }
        }
        break;
    }
  }

  /** Sitio de la sala cerca del jugador (pero no encima) donde aparece quien salta. */
  private hopSpot(minDist: number) {
    const i = this.interior(this.current);
    const m = 50;
    for (let tries = 0; tries < 30; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = minDist + Math.random() * 90;
      const x = this.player.x + Math.cos(a) * r;
      const y = this.player.y + Math.sin(a) * r;
      if (x > i.x0 + m && x < i.x1 - m && y > i.y0 + m && y < i.y1 - m) return { x, y };
    }
    return this.randomSpotInRoom(m);
  }

  /** Proyectil enemigo del color de su tipo, con borde oscuro para no confundirlo con los tuyos. */
  private fireFoeShot(e: Sprite, dir: Phaser.Math.Vector2, type: string) {
    const s = this.foeShots.create(e.x, e.y, 'foe-shot') as Sprite;
    s.setTint(typeColor(type)).setScale(0.75).setDepth(4);
    s.setVelocity(dir.x * FOE_SHOT_SPEED, dir.y * FOE_SHOT_SPEED);
    s.setData('dmg', Math.max(1, Math.round((e.getData('dmg') as number) * 0.8)));
    this.time.delayedCall(FOE_SHOT_LIFE, () => s.active && s.destroy());
  }

  // --- Trampilla al piso siguiente ---

  private spawnTrapdoor() {
    const i = this.interior(this.floor.rooms[this.floor.bossId]);
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x3b2a1e, 1).fillRoundedRect(i.cx - 46, i.cy - 34, 92, 68, 10);
    g.fillStyle(0x0d0905, 1).fillRoundedRect(i.cx - 36, i.cy - 25, 72, 50, 8);
    g.lineStyle(4, 0xffd34d, 1).strokeRoundedRect(i.cx - 46, i.cy - 34, 92, 68, 10);
    this.add
      .text(i.cx, i.cy - 52, 'Trampilla', { fontFamily: FONT, fontSize: '16px', color: '#2b3a67' })
      .setOrigin(0.5)
      .setDepth(3);
    this.trapdoor = { x: i.cx, y: i.cy, armed: false };
  }

  /** Pisar la trampilla: se activa cuando te has alejado de ella (así no bajas sin querer). */
  private checkTrapdoor() {
    const t = this.trapdoor;
    if (!t || this.current.id !== this.floor.bossId) return;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y);
    if (!t.armed) {
      if (dist > 90) t.armed = true;
      return;
    }
    if (dist < 36) this.descend();
  }

  private descend() {
    this.transitioning = true;
    this.trapdoor = undefined;
    this.player.setVelocity(0, 0);
    const carry: FloorCarry = {
      floor: this.floorNum + 1,
      bossHistory: [...this.bossHistory],
      hp: this.hp,
      passives: [...this.passives],
      slots: [...this.slots],
      nextSlotReplace: this.nextSlotReplace,
      movePool: [...this.movePool],
      earned: this.earned,
    };
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({ slot: this.slot, starterId: this.starterId, carry } satisfies GameData);
    });
  }

  // --- Bucle ---

  update(time: number) {
    // Esc (teclado) o Select/Back (mando) vuelven al menú en cualquier momento
    const menuPad = this.input.gamepad?.getPad(0);
    const menuPadNow = !!menuPad && menuPad.connected && (!!menuPad.buttons[8]?.pressed || (!this.ended && !!menuPad.buttons[9]?.pressed));
    if (!this.escKey) return; // create() aún no ha terminado de cargar
    const menuPressed = Phaser.Input.Keyboard.JustDown(this.escKey) || Phaser.Input.Keyboard.JustDown(this.pauseKey) ||
      (menuPadNow && !this.menuPadPrev);
    this.menuPadPrev = menuPadNow;
    if (menuPressed) {
      // Durante la partida abre la pausa; con la partida terminada vuelve al menú
      if (this.ended) this.scene.start('Menu');
      else this.openPause();
      return;
    }
    if (!this.player || !this.player.active) return;

    const pad = this.input.gamepad?.getPad(0);
    const hasPad = !!pad && pad.connected;

    if (this.ended) {
      // Nueva partida (vuelves a elegir inicial): R, Start, o A del mando pasado un momento.
      // El clic se registra en armRestartClick.
      const start = hasPad && (!!pad!.buttons[9]?.pressed || (pad!.A && time - this.endedAt > 700));
      if (Phaser.Input.Keyboard.JustDown(this.restartKey) || start) this.scene.start('Starter', { slot: this.slot });
      return;
    }
    if (this.transitioning) return;

    // Movimiento: WASD o stick izquierdo
    let mx = (this.wasd.D.isDown ? 1 : 0) - (this.wasd.A.isDown ? 1 : 0);
    let my = (this.wasd.S.isDown ? 1 : 0) - (this.wasd.W.isDown ? 1 : 0);
    if (hasPad && pad!.leftStick.length() > 0.2) {
      mx = pad!.leftStick.x;
      my = pad!.leftStick.y;
    }
    // Ratón: mantener el clic derecho lleva al personaje hacia el cursor
    const pointer = this.input.activePointer;
    if (mx === 0 && my === 0 && pointer.rightButtonDown()) {
      const p = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const tx = p.x - this.player.x;
      const ty = p.y - this.player.y;
      if (Math.hypot(tx, ty) > 14) {
        mx = tx;
        my = ty;
      }
    }
    const dir = new Phaser.Math.Vector2(mx, my);
    if (dir.length() > 1) dir.normalize();
    this.player.setVelocity(dir.x * this.stats.speed, dir.y * this.stats.speed);

    // Disparo continuo como en Isaac: flechas (o clic / stick derecho) y mira hacia donde dispara
    const shoot = this.readShootDir(hasPad ? pad! : null);
    if (shoot) {
      this.aim.copy(shoot);
      this.face(this.player, shoot);
      if (time >= this.nextTear) {
        this.fireTear(shoot);
        this.nextTear = time + this.stats.fireDelay;
      }
    } else if (dir.length() > 0.2) {
      this.aim.copy(dir).normalize();
      this.face(this.player, dir);
    }

    // Poderes: teclas 1-4 o botones A, B, X, Y
    this.abilityKeys.forEach((k, i) => {
      if (Phaser.Input.Keyboard.JustDown(k)) this.castSlot(i, time);
    });
    if (hasPad) {
      [pad!.A, pad!.B, pad!.X, pad!.Y].forEach((down, i) => {
        if (down && !this.padPrev[i]) this.castSlot(i, time);
        this.padPrev[i] = down;
      });
    }

    // IA de cada enemigo según su comportamiento
    this.enemies.getChildren().forEach((c) => this.updateEnemy(c as Sprite, time));

    // HUD
    this.hpText.setText(
      `Piso ${this.floorNum}   PS ${Math.max(0, Math.ceil(this.hp))}/${this.stats.maxHp}   Enemigos ${this.enemies.countActive(true)}`,
    );
    this.slots.forEach((m, i) => {
      const text = this.hud[i];
      if (!m) {
        text.setText(`${i + 1}  —`).setColor('#ffffff').setAlpha(0.3);
        return;
      }
      const ready = time >= this.slotReady[i];
      text.setText(`${i + 1}  ${pretty(m.name)}`).setColor(typeHex(m.type)).setAlpha(ready ? 1 : 0.35);
    });

    this.checkTrapdoor();
    if (!this.transitioning) this.checkExit();
  }

  /**
   * Dirección de disparo. Flechas (dos a la vez disparan en diagonal; dos opuestas se anulan),
   * si no, clic mantenido hacia el ratón, y si no, stick derecho.
   */
  private readShootDir(pad: Phaser.Input.Gamepad.Gamepad | null): Phaser.Math.Vector2 | null {
    const { left, right, up, down } = this.arrows;
    const ax = (right.isDown ? 1 : 0) - (left.isDown ? 1 : 0);
    const ay = (down.isDown ? 1 : 0) - (up.isDown ? 1 : 0);
    if (ax !== 0 || ay !== 0) return new Phaser.Math.Vector2(ax, ay).normalize();

    const pointer = this.input.activePointer;
    // Solo el clic izquierdo dispara (el derecho es para moverse) y no sobre las ranuras de poder
    if (pointer.leftButtonDown() && !this.overHud) {
      // Se recalcula con la cámara actual: worldX se queda viejo si la cámara se mueve
      const p = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const d = new Phaser.Math.Vector2(p.x - this.player.x, p.y - this.player.y);
      if (d.length() > 1) return d.normalize();
    }

    if (pad && pad.rightStick.length() > 0.3) {
      return new Phaser.Math.Vector2(pad.rightStick.x, pad.rightStick.y).normalize();
    }
    return null;
  }

  private spawnShot(dir: Phaser.Math.Vector2, angle: number, o: ShotOpts) {
    const v = dir.clone().rotate(angle).scale(o.speed);
    const s = this.shots.create(this.player.x, this.player.y, 'shot') as Sprite;
    s.setTint(o.color).setScale(o.size).setDepth(4).setVelocity(v.x, v.y);
    s.setData('dmg', o.damage).setData('pierce', o.pierce).setData('bounces', o.bounces);
    s.setData('hit', new Set<Sprite>());
    if (o.bounces > 0) s.setBounce(1, 1);
    this.time.delayedCall(o.life, () => s.destroy());
  }

  /** Disparo básico. Los pasivos cambian cuántos salen, cuánto daño hacen y hasta dónde llegan. */
  private fireTear(dir: Phaser.Math.Vector2) {
    const s = this.stats;
    const n = 1 + s.extraShots;
    for (let k = 0; k < n; k++) {
      this.spawnShot(dir, (k - (n - 1) / 2) * SPREAD, {
        damage: s.damage,
        speed: s.shotSpeed,
        life: s.range,
        size: 0.7,
        color: typeColor(this.tearType),
        pierce: s.pierce,
        bounces: s.bounces,
      });
    }
  }

  /** Poder activo: el movimiento de la ranura sale hacia donde miras. */
  private castSlot(i: number, time: number) {
    const m = this.slots[i];
    if (!m || time < this.slotReady[i]) return;
    this.slotReady[i] = time + m.cooldown;

    const dir = this.aim.clone();
    const dmg = Math.max(6, Math.round(m.power * 0.5 * (this.stats.damage / BASE_STATS.damage)));
    const base = {
      color: typeColor(m.type),
      pierce: this.stats.pierce,
      bounces: this.stats.bounces,
      life: this.stats.range + 250,
    };

    switch (m.shape) {
      case 'bolt': // disparo rápido
        this.spawnShot(dir, 0, { ...base, damage: Math.round(dmg * 1.2), speed: 640, size: 1 });
        break;
      case 'fan': // abanico de 3
        for (const a of [-0.35, 0, 0.35]) {
          this.spawnShot(dir, a, { ...base, damage: Math.round(dmg * 0.8), speed: 520, size: 0.9 });
        }
        break;
      case 'ring': // anillo de 8
        for (let k = 0; k < 8; k++) {
          this.spawnShot(dir, (k * Math.PI) / 4, { ...base, damage: Math.round(dmg * 0.7), speed: 420, size: 0.9, life: 650 });
        }
        break;
      case 'big': // proyectil grande que atraviesa
        this.spawnShot(dir, 0, { ...base, damage: Math.round(dmg * 1.6), speed: 320, size: 2, pierce: 99, life: 1400 });
        break;
    }
  }

  private onShotWall(shot: Sprite) {
    if (!shot.active) return;
    const bounces = shot.getData('bounces') as number;
    if (bounces > 0) shot.setData('bounces', bounces - 1);
    else shot.destroy();
  }

  private onHit(shot: Sprite, enemy: Sprite) {
    if (!shot.active || !enemy.active) return;
    const hit = shot.getData('hit') as Set<Sprite>;
    if (hit.has(enemy)) return;
    hit.add(enemy);

    const hp = (enemy.getData('hp') as number) - (shot.getData('dmg') as number);
    enemy.setData('hp', hp);
    enemy.setTint(0xff6666);
    this.time.delayedCall(90, () => enemy.active && enemy.clearTint());

    const pierce = shot.getData('pierce') as number;
    if (pierce > 0) shot.setData('pierce', pierce - 1);
    else shot.destroy();

    if (hp <= 0) {
      enemy.destroy();
      this.checkClear();
    }
  }

  private checkClear() {
    const room = this.current;
    if (this.cleared.has(room.id) || this.enemies.countActive(true) > 0) return;
    this.cleared.add(room.id);
    this.setDoorsLocked(room, false);
    this.foeShots.clear(true, true);
    this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.healOnClear);

    const reward = room.kind === 'boss' ? bossCoinsFor(this.floorNum) : roomCoinsFor(this.floorNum);
    this.earned += reward;
    addCoins(reward);

    if (room.kind === 'boss') {
      if (this.floorNum >= FLOOR_COUNT) {
        this.finish(
          `¡Has completado los ${FLOOR_COUNT} pisos!\n+${this.earned} monedas en total\nPulsa R, Start o haz clic para empezar otra partida`,
        );
        return;
      }
      // Como en Isaac: el jefe deja un objeto y una trampilla al piso siguiente
      const i = this.interior(room);
      this.dropItem(room.id, i.cx + 170, i.cy);
      this.spawnTrapdoor();
      this.showBanner(`¡Jefe derrotado! +${reward} monedas\nPisa la trampilla para bajar al piso ${this.floorNum + 1}`, 2600);
      this.saveNow();
      return;
    }

    // A veces la sala limpiada deja un objeto, como en Isaac
    if (Math.random() < CLEAR_DROP_CHANCE) {
      const i = this.interior(room);
      this.dropItem(room.id, i.cx, i.cy);
      this.showBanner(`¡Sala limpia! +${reward} monedas\nHa caído un objeto`, 1400);
    } else {
      this.showBanner(`¡Sala limpia! +${reward} monedas`, 1000);
    }
    this.saveNow();
  }

  private showBanner(text: string, ms?: number) {
    this.bannerTimer?.remove();
    this.banner.setText(text);
    this.bannerTimer = ms ? this.time.delayedCall(ms, () => this.banner.setText('')) : undefined;
  }

  private hurtPlayer(enemy: Sprite) {
    const now = this.time.now;
    if (this.ended || this.transitioning || now < this.invulnUntil) return;
    // Quien salta no hace daño mientras desaparece o recién aparecido
    const ai = enemy.getData('ai') as EnemyAI | undefined;
    if (ai && ai.behavior === 'hop' && ai.state !== 'walk') return;
    this.invulnUntil = now + 900;
    this.hp -= (enemy.getData('dmg') as number | undefined) ?? 10;
    this.player.setTint(0xff6666);
    this.time.delayedCall(150, () => this.player.active && this.player.clearTint());

    if (this.hp <= 0) this.finish(`Has caído · +${this.earned} monedas\nPulsa R, Start o haz clic para volver a empezar`);
  }

  /** Fin de partida: congela el juego y deja salir con teclado (R), mando (Start / A) o ratón (clic). */
  private finish(message: string) {
    // Como en Isaac: al morir o ganar, la partida guardada se borra
    clearRun(this.slot);
    this.ended = true;
    this.endedAt = this.time.now;
    this.physics.pause();
    this.showBanner(message);
    // Un momento de margen y un clic nuevo, para no saltarse la pantalla si estabas disparando
    this.time.delayedCall(700, () => this.input.once('pointerdown', () => this.scene.start('Starter', { slot: this.slot })));
  }
}
