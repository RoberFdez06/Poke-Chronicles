import Phaser from 'phaser';
import { fetchAttackMovesForTypes, fetchMoveInfo, fetchNextEvolutions, fetchPokemon, fetchPokemonCard } from '../data/pokeapi';
import { pickEvolution, shouldEvolve } from '../data/evolution';
import { filterMovesByTypes } from '../data/moves';
import { typeColor, typeHex, typeNameEs } from '../data/types';
import { addTickets } from '../data/save';
import { clearRun, saveRun, FloorItemSave, RunSave, RUN_VERSION, SavedDrop, FLOOR_LAYOUT } from '../data/runSave';
import { loadSpeciesIndex } from '../data/speciesIndex';
import {
  bossTicketsFor,
  bossPool,
  difficultyFor,
  pickBoss,
  roomTicketsFor,
  roomCountFor,
  FloorDifficulty,
  FLOOR_COUNT,
} from '../level/progression';
import type { PauseData } from './PauseScene';
import {
  arenaFloor,
  isLastStage,
  progressText,
  waveTickets,
  waveDropsItem,
  waveSpec,
  GameMode,
  MODE_LABEL,
} from '../data/modes';
import { loadUpgrades, submitRecord } from '../data/save';
import { applyUpgrades, levelsFor } from '../data/upgrades';
import { cry, sfx } from '../ui/audio';
import {
  flowField,
  isWalkable,
  layoutFor,
  nearestWalkable,
  stepToward,
  Cell,
  Grid,
  TILE,
} from '../level/roomLayouts';
import { bossStats, playerBaseStats, shapeEnemyStats, AVERAGE_STATS, BaseStats } from '../data/pokeStats';
import {
  BERRIES,
  POTIONS,
  canBuy,
  canHeal,
  centerHeal,
  healed,
  rollEnemyLoot,
  rollShop,
  roomClearCoins,
  LootDrop,
  ShopSlot,
} from '../data/loot';
import { addHpBar, addTypeChip, drawBox, fadeIn, FONT, goTo, HEX, hpColor, shorten } from '../ui/theme';
import {
  applyStatus,
  drainHeal,
  isConfused,
  speedMultiplier,
  statusForType,
  statusTint,
  tickStatuses,
  enemyDamageMul,
  extraPierce,
  hitDamageMul,
  isFeared,
  KNOCKBACK_FORCE,
  ActiveStatus,
} from '../data/status';
import type { SpeciesFact } from '../data/gacha';
import type { PokemonCard } from '../data/pokeapi';
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
  center: 0xffe3ef,
  shop: 0xe2f4e4,
};
/** Marco de las puertas que llevan a cada sala especial (y su icono en el minimapa). */
const CENTER_PINK = 0xff6fae;
const SHOP_GREEN = 0x2ecc71;
/** Distancia para usar el mostrador o un artículo con Enter / A, y para usarlo al pisarlo. */
const NEAR = 120;
const TOUCH = 46;
/** Posiciones de los 3 artículos de la tienda respecto al centro de la sala. */
const SHOP_OFFSETS = [-200, 0, 200];

type Sprite = Phaser.Physics.Arcade.Sprite;
type Body = Phaser.Physics.Arcade.Body;
type Rect = { x: number; y: number; w: number; h: number };
type Key = Phaser.Input.Keyboard.Key;
const asSprite = (o: unknown) => o as Sprite;
const pretty = (s: string) => s.replace(/-/g, ' ');

/** Lo que pasa de un piso al siguiente al bajar por la trampilla. */
export type FloorCarry = Pick<
  RunSave,
  'floor' | 'bossHistory' | 'hp' | 'passives' | 'slots' | 'nextSlotReplace' | 'movePool' | 'earned' | 'coins' | 'formId'
>;

export interface GameData {
  starterId?: number;
  slot?: number;
  mode?: GameMode;
  resume?: RunSave;
  carry?: FloorCarry;
}

/** Una de las especies de enemigo del piso. */
interface FoeKind {
  key: string;
  behavior: EnemyBehavior;
  bst: number;
  type: string;
  /** Estadísticas base: reparten su fuerza (más vida, más daño o más velocidad). */
  stats: BaseStats;
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
  /** Hasta cuándo sale despedido por un golpe que empuja (la IA no manda mientras tanto). */
  knockUntil: number;
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
  /** Tipo del poder: aplica su estado al golpear (quemar, congelar…). Los disparos normales no llevan. */
  status?: string;
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
  private bossName = '';
  private pickups!: Phaser.Physics.Arcade.Group;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  /** Obstáculos: hierba alta (se rompe a disparos) y agujeros (los disparos pasan por encima). */
  private bushes!: Phaser.Physics.Arcade.StaticGroup;
  private holes!: Phaser.Physics.Arcade.StaticGroup;
  /** Cuadrícula de obstáculos de cada sala (ver roomLayouts.ts). */
  private grids = new Map<number, Grid>();
  /** Campo de flujo hacia el jugador en la sala actual, para que los enemigos rodeen los obstáculos. */
  private flow?: { roomId: number; tx: number; ty: number; dist: number[][] };
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
  /** Forma en la que va tu Pokémon ahora (evoluciona en ciertos pisos); starterId sigue siendo el elegido. */
  private formId = 4;
  /** Al bajar a este piso toca evolucionar (se hace cuando ya se ve la sala). */
  private evolvePending = false;
  private evolving = false;
  private starterName = '';
  private playerKey = 'starter-4';
  /** Hueco donde se guarda la partida y, si se continúa, lo guardado. */
  private slot = 0;
  private resume: RunSave | null = null;
  /** Estado que viene del piso anterior (al bajar por la trampilla). */
  private carry: FloorCarry | null = null;
  /** Modo de juego. En Oleadas `floorNum` es la ronda y en Rush de jefes, el jefe por el que vas. */
  private mode: GameMode = 'normal';
  /** Oleadas: hay una ronda en marcha (sus enemigos ya han salido). */
  private waveActive = false;
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
  /** Estadísticas del Pokémon (de PokeAPI) antes de los objetos pasivos. */
  private base: PlayerStats = { ...BASE_STATS };
  private baseStats: BaseStats = { ...AVERAGE_STATS };
  private bossBase: BaseStats = { ...AVERAGE_STATS };
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
  /** Monedas de la partida (solo para la tienda) y estado del Centro y la tienda de este piso. */
  private coins = 0;
  private centerUsed = false;
  private shop: ShopSlot[] = [];
  private layout = FLOOR_LAYOUT;
  private loot!: Phaser.Physics.Arcade.Group;
  private counter?: { x: number; y: number; g: Phaser.GameObjects.Graphics };
  private shopViews: Phaser.GameObjects.GameObject[][] = [];
  /** Artículo de la tienda que estás pisando (para no repetir el aviso de "te faltan monedas"). */
  private shopTouch = -1;
  private counterTouch = false;
  private prompt!: Phaser.GameObjects.Text;
  private enterKey!: Key;
  private coinsHud!: Phaser.GameObjects.Text;
  /** Barra grande del jefe arriba de la pantalla (nombre, tipo y vida), como en Isaac. */
  private bossBar?: { boss: Sprite; bar: ReturnType<typeof addHpBar>; objects: Phaser.GameObjects.GameObject[] };
  private escKey!: Phaser.Input.Keyboard.Key;
  private menuPadPrev = false;
  /** El cursor está sobre una ranura de poder: ahí un clic no dispara. */
  private overHud = false;

  private hud: Phaser.GameObjects.Text[] = [];
  /** HUD: nombre, progreso y PS en un cuadro arriba a la izquierda. */
  private nameText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private progressHud!: Phaser.GameObjects.Text;
  private hpBar!: ReturnType<typeof addHpBar>;
  private invText!: Phaser.GameObjects.Text;
  /** Fondo de cada ranura de poder y lo que muestra (para no redibujarlo en cada fotograma). */
  private slotBoxes: Phaser.GameObjects.Graphics[] = [];
  private slotShown: string[] = [];
  /** Nombre del tipo de cada poder (Volador y Veneno se confundían solo por el color). */
  private slotTypes: Phaser.GameObjects.Text[] = [];
  private banner!: Phaser.GameObjects.Text;
  private bannerBox!: Phaser.GameObjects.Graphics;
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
    this.formId = this.resume?.formId ?? data?.carry?.formId ?? this.starterId;
    // Solo al llegar a un piso nuevo por la trampilla (al continuar una partida ya había evolucionado)
    this.evolvePending = !!data?.carry && shouldEvolve(this.resume?.mode ?? data?.mode ?? 'normal', data.carry.floor);
    this.evolving = false;
    this.mode = this.resume?.mode ?? data?.mode ?? 'normal';
  }

  create() {
    // scene.restart reutiliza la instancia: reiniciamos el estado
    this.passives = [];
    this.base = { ...BASE_STATS };
    this.stats = this.calcStats();
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
    this.coins = 0;
    this.centerUsed = false;
    this.shop = [];
    this.layout = FLOOR_LAYOUT;
    this.counter = undefined;
    this.shopViews = [];
    this.shopTouch = -1;
    this.counterTouch = false;
    this.overHud = false;
    this.transitioning = false;
    this.padPrev = [false, false, false, false];
    this.hud = [];
    this.slotBoxes = [];
    this.slotShown = [];
    this.slotTypes = [];
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
      this.stats = this.calcStats();
      // Se recorta a los PS máximos en boot(), cuando ya se conocen las estadísticas del Pokémon
      this.hp = c.hp;
      this.slots = Array.from({ length: SLOT_COUNT }, (_, i) => c.slots[i] ?? null);
      this.nextSlotReplace = c.nextSlotReplace;
      this.movePool = [...c.movePool];
      this.earned = c.earned;
      this.coins = c.coins;
    }
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.resetFX();
    fadeIn(this);

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
    this.waveActive = false;
    this.difficulty = difficultyFor(this.level());
    // Al continuar, el piso se regenera igual con la misma semilla; cada piso nuevo es más grande.
    // Oleadas y Rush de jefes se juegan en una sola sala
    this.floorSeed = r?.floorSeed ?? Phaser.Math.Between(0, 0x7fffffff);
    if (this.mode === 'waves') this.floor = arenaFloor(this.floorSeed, 'combat');
    else if (this.mode === 'bossrush') this.floor = arenaFloor(this.floorSeed, 'boss');
    else {
      this.layout = r?.layout ?? FLOOR_LAYOUT;
      this.floor = generateFloor({
        seed: this.floorSeed,
        roomCount: r?.roomCount ?? roomCountFor(this.floorNum, Math.random),
        special: this.layout >= 2,
      });
    }

    // Los poderes que saldrán en el suelo son movimientos de los tipos de tu Pokémon; se piden ya, en paralelo
    if (r) {
      await this.spanishMoves(r);
      this.movePool = [...r.movePool];
    }
    const poolReady = fetchPokemon(this.formId)
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
    const foeIds = pickFloorEnemies(enemyPool(index, this.level()), this.foeRng(this.level()));
    const [starter, boss, foeCards] = await Promise.all([
      fetchPokemon(this.formId),
      fetchPokemon(bossId),
      Promise.all(foeIds.map((id) => fetchPokemonCard(id).catch(() => null))),
    ]);
    let foes = foeCards.filter((c) => c !== null);
    if (foes.length === 0) foes = [await fetchPokemonCard(FALLBACK_ENEMIES[0])];
    this.foeKinds = this.toFoeKinds(foes, index);
    this.bossType = boss.types[0] ?? 'normal';
    this.bossName = boss.name;
    this.bossBase = boss.stats;
    // Tus estadísticas salen de las de tu Pokémon; los objetos van encima
    this.baseStats = starter.stats;
    // Mejoras permanentes compradas para este Pokémon (pantalla Mejoras)
    this.base = applyUpgrades(playerBaseStats(starter.stats), levelsFor(loadUpgrades(), this.starterId));
    this.stats = this.calcStats();
    this.hp = !r && !this.carry ? this.stats.maxHp : Math.min(this.stats.maxHp, this.hp);
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

  /**
   * Partidas guardadas antes de tener nombres en español: sus poderes (en ranuras, en reserva y en el suelo)
   * venían con el nombre en inglés de PokeAPI ("flame-wheel"). Se traducen al continuar; si falla, se quedan.
   */
  private async spanishMoves(r: RunSave) {
    const tr = async (m: MovePower): Promise<MovePower> => {
      if (!/^[a-z0-9-]+$/.test(m.name)) return m; // ya está en español
      try {
        return { ...m, name: (await fetchMoveInfo(m.id)).name };
      } catch {
        return m;
      }
    };
    r.slots = await Promise.all(r.slots.map((m) => (m ? tr(m) : null)));
    r.movePool = await Promise.all(r.movePool.map(tr));
    r.floorItems = await Promise.all(
      r.floorItems.map(async (f) => (f.drop.kind === 'move' ? { ...f, drop: { kind: 'move' as const, move: await tr(f.drop.move) } } : f)),
    );
  }

  /** Tus estadísticas: las de tu Pokémon con los objetos pasivos encima. */
  private calcStats(): PlayerStats {
    return computeStats(this.passives, this.base);
  }

  /** Nivel de dificultad: el piso, el jefe por el que vas o, en Oleadas, el que toca a la ronda. */
  private level(): number {
    return this.mode === 'waves' ? waveSpec(this.floorNum).level : this.floorNum;
  }

  /** Semilla de las especies enemigas (en Oleadas cambia con el nivel, en el resto con el piso). */
  private foeRng(level: number) {
    const base = this.floorSeed ^ 0x5bd1e995;
    return mulberry32(this.mode === 'waves' ? base + level * 7919 : base);
  }

  private toFoeKinds(cards: readonly PokemonCard[], index: readonly SpeciesFact[]): FoeKind[] {
    return cards.map((c) => ({
      key: `foe-${c.id}`,
      behavior: behaviorFor(c.types),
      bst: index.find((s) => s.id === c.id)?.bst ?? 300,
      type: c.types[0] ?? 'normal',
      stats: c.stats,
    }));
  }

  /** Oleadas: al subir de nivel, cambia a especies más fuertes (si no se pueden cargar, siguen las de antes). */
  private async reloadFoes(level: number) {
    const index = await loadSpeciesIndex().catch(() => [] as SpeciesFact[]);
    const ids = pickFloorEnemies(enemyPool(index, level), this.foeRng(level));
    const cards = (await Promise.all(ids.map((id) => fetchPokemonCard(id).catch(() => null)))).filter((c) => c !== null);
    if (cards.length === 0 || !this.scene.isActive()) return;
    await new Promise<void>((resolve) => {
      let queued = 0;
      for (const c of cards) {
        for (const side of ['front', 'back'] as const) {
          const key = `foe-${c.id}-${side}`;
          if (this.textures.exists(key)) continue;
          this.load.image(key, c.sprites[side]);
          queued++;
        }
      }
      if (queued === 0) return resolve();
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.start();
    });
    const ok = cards.filter((c) => this.textures.exists(`foe-${c.id}-front`));
    for (const c of ok) {
      for (const side of ['front', 'back']) {
        const tex = `foe-${c.id}-${side}`;
        if (this.textures.exists(tex)) this.textures.get(tex).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    if (ok.length > 0) this.foeKinds = this.toFoeKinds(ok, index);
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
    this.bushes = this.physics.add.staticGroup();
    this.holes = this.physics.add.staticGroup();
    this.grids.clear();
    this.flow = undefined;
    this.makeObstacleTextures();
    this.doorBlocks = this.physics.add.staticGroup();
    this.pickups = this.physics.add.group();
    this.loot = this.physics.add.group();
    this.makeLootTextures();
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

    this.physics.add.collider(this.player, [this.walls, this.doorBlocks, this.bushes, this.holes]);
    this.physics.add.collider(this.enemies, [this.walls, this.doorBlocks, this.bushes, this.holes]);
    // Los enemigos se empujan entre sí para no amontonarse en el mismo sitio
    this.physics.add.collider(this.enemies, this.enemies);
    // Collider (no overlap) para que los disparos con rebote reboten de verdad
    this.physics.add.collider(this.shots, [this.walls, this.doorBlocks], (s) => this.onShotWall(asSprite(s)));
    // La hierba alta para los disparos y se rompe con ellos; los agujeros no paran nada
    this.physics.add.overlap(this.shots, this.bushes, (s, b) => this.onShotBush(asSprite(s), asSprite(b)));
    this.physics.add.overlap(this.shots, this.enemies, (s, e) => this.onHit(asSprite(s), asSprite(e)));
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => this.hurtPlayer(asSprite(e)));
    this.physics.add.collider(this.foeShots, [this.walls, this.doorBlocks], (s) => asSprite(s).destroy());
    this.physics.add.overlap(this.foeShots, this.bushes, (s) => asSprite(s).destroy());
    this.physics.add.overlap(this.player, this.foeShots, (_p, s) => {
      this.hurtPlayer(asSprite(s));
      asSprite(s).destroy();
    });
    this.physics.add.overlap(this.player, this.pickups, (_p, it) => this.pickItem(asSprite(it)));
    this.physics.add.overlap(this.player, this.loot, (_p, it) => this.pickLoot(asSprite(it)));

    // Entrada
    const kb = this.input.keyboard!;
    this.wasd = kb.addKeys('W,A,S,D') as GameScene['wasd'];
    this.arrows = kb.createCursorKeys();
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.abilityKeys = [K.ONE, K.TWO, K.THREE, K.FOUR].map((c) => kb.addKey(c));
    this.restartKey = kb.addKey(K.R);
    this.enterKey = kb.addKey(K.ENTER);
    this.escKey = kb.addKey(K.ESC);
    this.pauseKey = kb.addKey(K.P);
    this.menuPadPrev = false;
    // El clic derecho sirve para moverse con el ratón, así que sin menú contextual
    this.input.mouse?.disableContextMenu();

    // HUD fijo en pantalla, en cuadros como los de los combates de Pokémon
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T) =>
      o.setDepth(10).setScrollFactor(0);
    fixed(drawBox(this.add.graphics(), 76, 6, 470, 70, { radius: 12 }));
    this.nameText = fixed(this.add.text(94, 24, '', { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: HEX.text }).setOrigin(0, 0.5));
    this.progressHud = fixed(this.add.text(530, 24, '', { fontFamily: FONT, fontSize: '15px', color: HEX.textSoft }).setOrigin(1, 0.5));
    this.hpBar = addHpBar(this, 94, 46, 236, 10);
    this.hpBar.objects.forEach((o) => fixed(o as Phaser.GameObjects.Text));
    this.hpText = fixed(this.add.text(410, 51, '', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: HEX.text }).setOrigin(1, 0.5));
    this.coinsHud = fixed(this.add.text(530, 51, '', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#b8860b' }).setOrigin(1, 0.5));
    this.invText = this.add
      .text(560, 14, '', { fontFamily: FONT, fontSize: '14px', color: '#ffffff', wordWrap: { width: 240 } })
      .setDepth(10)
      .setScrollFactor(0);
    const style = { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: HEX.text };
    for (let i = 0; i < SLOT_COUNT; i++) {
      this.slotBoxes.push(fixed(this.add.graphics()));
      this.slotTypes.push(
        this.add
          .text(84 + i * 210 + 151, 580, '', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#ffffff' })
          .setOrigin(0.5)
          .setDepth(12)
          .setScrollFactor(0)
          .setShadow(1, 1, '#00000088', 0),
      );
      this.slotShown.push('');
      const slot = this.add.text(104 + i * 210, 591, '', style).setDepth(11).setScrollFactor(0);
      // Con ratón, un clic en la ranura lanza el poder
      // Área fija: el texto cambia de tamaño y el área de clic no se actualizaría sola
      slot.setInteractive(new Phaser.Geom.Rectangle(-20, -11, 200, 44), Phaser.Geom.Rectangle.Contains);
      if (slot.input) slot.input.cursor = 'pointer';
      slot.on('pointerover', () => (this.overHud = true));
      slot.on('pointerout', () => (this.overHud = false));
      slot.on('pointerdown', () => !this.ended && !this.transitioning && this.castSlot(i, this.time.now));
      this.hud.push(slot);
    }
    // Carteles en un cuadro de texto, como los diálogos de los juegos
    this.bannerBox = this.add.graphics().setDepth(19).setScrollFactor(0);
    this.banner = this.add
      .text(480, 320, '', {
        fontFamily: FONT,
        fontSize: '34px',
        fontStyle: 'bold',
        color: HEX.text,
        align: 'center',
        wordWrap: { width: 800 },
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setScrollFactor(0);
    this.minimap = this.add.graphics().setDepth(30).setScrollFactor(0);

    // Botón de pausa para jugar solo con ratón
    fixed(drawBox(this.add.graphics(), 12, 14, 54, 54, { radius: 10 }));
    const pb = this.add
      .text(39, 41, '❚❚', { fontFamily: FONT, fontSize: '22px', color: HEX.text })
      .setOrigin(0.5)
      .setPadding(10, 8)
      .setDepth(11)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    pb.on('pointerover', () => (this.overHud = true));
    pb.on('pointerout', () => (this.overHud = false));
    pb.on('pointerdown', () => this.openPause());
    this.pauseBtn = pb;

    // Tienda: al continuar, lo que quedaba; si no, artículos nuevos para este piso
    if (this.floor.shopId !== undefined) {
      if (this.shop.length === 0) this.shop = rollShop(Math.random, new Set(this.passives), this.movePool);
      this.buildShop(this.floor.rooms[this.floor.shopId]);
    }
    this.prompt = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#ffffff', align: 'center' })
      .setOrigin(0.5, 1)
      .setDepth(12)
      .setStroke('#1d2848', 5);

    // Si ya habías vencido al jefe, la trampilla sigue ahí
    if (this.mode !== 'waves' && this.cleared.has(this.floor.bossId) && !isLastStage(this.mode, this.floorNum)) this.spawnTrapdoor();

    this.refreshInventory();
    this.cameras.main.centerOn(si.cx, si.cy);
    this.enterRoom(start);
    // En Oleadas el cartel de la ronda lo pone startWave
    if (this.mode !== 'waves') {
      const where = progressText(this.mode, this.floorNum);
      this.showBanner(r ? `Partida cargada · ${where}` : `${MODE_LABEL[this.mode]} · ${where}`, 1200);
    }
    if (this.evolvePending) {
      this.evolvePending = false;
      this.time.delayedCall(1300, () => void this.evolve());
    }
  }

  // --- Evolución (evolution.ts) ---

  /**
   * Evoluciona a la siguiente forma de la cadena (al azar si hay varias): destello, sprite y nombre nuevos y sus
   * estadísticas (más altas), con las mejoras del Pokémon elegido encima. Si no evoluciona o falla la red, nada.
   */
  private async evolve() {
    if (this.evolving || this.ended) return;
    this.evolving = true;
    try {
      const next = pickEvolution(await fetchNextEvolutions(this.formId), Math.random);
      if (next === null) return;
      const data = await fetchPokemon(next);
      const key = `starter-${next}`;
      await new Promise<void>((resolve) => {
        let queued = 0;
        for (const side of ['front', 'back'] as const) {
          if (this.textures.exists(`${key}-${side}`)) continue;
          this.load.image(`${key}-${side}`, data.sprites[side]);
          queued++;
        }
        if (queued === 0) return resolve();
        this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
        this.load.start();
      });
      if (this.ended || !this.player?.active || !this.textures.exists(`${key}-front`)) return;
      for (const side of ['front', 'back']) {
        if (this.textures.exists(`${key}-${side}`)) this.textures.get(`${key}-${side}`).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
      const oldName = this.starterName;
      sfx('heal');
      this.cameras.main.flash(600, 255, 255, 255);
      // Parpadeo en blanco, como en los juegos, y al final cambia de forma
      this.player.setTintFill(0xffffff);
      this.tweens.add({
        targets: this.player,
        alpha: 0.3,
        yoyo: true,
        repeat: 5,
        duration: 110,
        onComplete: () => {
          if (!this.player?.active) return;
          this.player.clearTint().setAlpha(1);
          this.formId = next;
          this.playerKey = key;
          this.player.setData('sheet', key).setData('facing', undefined);
          this.face(this.player, this.aim);
          const prevMax = this.stats.maxHp;
          this.baseStats = data.stats;
          this.base = applyUpgrades(playerBaseStats(data.stats), levelsFor(loadUpgrades(), this.starterId));
          this.stats = this.calcStats();
          // Lo que suben los PS máximos también te cura
          this.hp = Math.min(this.stats.maxHp, this.hp + Math.max(0, this.stats.maxHp - prevMax));
          this.starterName = data.name;
          this.tearType = data.types[0] ?? this.tearType;
          this.showBanner(`¡${oldName} ha evolucionado!\nAhora es ${data.name}`, 2600);
          void cry(next);
          this.saveNow();
        },
      });
    } catch {
      // sin red: se queda como estaba
    } finally {
      this.evolving = false;
    }
  }

  // --- Guardado (como en Isaac: solo, en el hueco elegido) ---

  private toSaved(item: DroppedItem): SavedDrop {
    return item.kind === 'passive' ? { kind: 'passive', id: item.item.id } : { kind: 'move', move: item.move };
  }

  private fromSaved(d: SavedDrop): DroppedItem | null {
    if (d.kind === 'move') return { kind: 'move', move: d.move };
    if (d.kind !== 'passive') return null;
    const item = passiveById(d.id);
    return item ? { kind: 'passive', item } : null;
  }

  private restoreRun(r: RunSave) {
    this.passives = r.passives.filter((id) => passiveById(id));
    this.stats = this.calcStats();
    this.hp = Math.min(this.stats.maxHp, r.hp);
    this.slots = Array.from({ length: SLOT_COUNT }, (_, i) => r.slots[i] ?? null);
    this.nextSlotReplace = r.nextSlotReplace;
    this.earned = r.earned;
    r.visited.forEach((id) => this.visited.add(id));
    r.cleared.forEach((id) => this.cleared.add(id));
    this.coins = r.coins;
    this.centerUsed = r.centerUsed;
    this.shop = r.shop.map((s) => ({ ...s }));
    for (const f of r.floorItems) {
      if (f.drop.kind === 'coin' || f.drop.kind === 'berry') {
        this.spawnLoot(f.roomId, f.x, f.y, f.drop);
        continue;
      }
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
      formId: this.formId,
      starterName: this.starterName,
      mode: this.mode,
      floor: this.floorNum,
      bossHistory: [...this.bossHistory],
      floorSeed: this.floorSeed,
      roomCount: this.floor.rooms.length,
      bossId: this.bossId,
      roomId: this.current.id,
      visited: [...this.visited],
      cleared: [...this.cleared],
      hp: Math.max(1, this.hp),
      maxHp: this.stats.maxHp,
      passives: [...this.passives],
      slots: [...this.slots],
      nextSlotReplace: this.nextSlotReplace,
      movePool: [...this.movePool],
      floorItems: this.floorItems.map((f) => ({ ...f })),
      earned: this.earned,
      coins: this.coins,
      centerUsed: this.centerUsed,
      shop: this.shop.map((sl) => ({ ...sl })),
      layout: this.layout,
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
      modeLabel: MODE_LABEL[this.mode],
      progress: progressText(this.mode, this.floorNum),
      showRooms: this.mode === 'normal' || this.mode === 'endless',
      hp: this.hp,
      stats: this.stats,
      baseStats: this.baseStats,
      items: [...counts].map(([id, n]) => (passiveById(id)?.name ?? id) + (n > 1 ? ` x${n}` : '')),
      moves: [...this.slots],
      roomsCleared: this.cleared.size,
      coins: this.coins,
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
      onReset: () => {
        // El progreso ya se ha borrado: se sale sin guardar esta partida
        this.ended = true;
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
      const frame =
        kind === 'boss' ? 0xe53935 : kind === 'item' ? 0xffc107 : kind === 'center' ? CENTER_PINK : kind === 'shop' ? SHOP_GREEN : 0x1d2848;
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
    this.buildObstacles(room);

    this.setDoorsLocked(room, false);
    // Al continuar, los objetos salen del guardado (restoreRun)
    if (room.kind === 'item' && !this.resume) this.dropItem(room.id, i.cx, i.cy);
    if (room.kind === 'center') this.buildCenter(room);
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
    this.gainItem(item);
  }

  /** Te quedas un pasivo o un poder (cogido del suelo o comprado). */
  private gainItem(item: DroppedItem) {
    sfx('pickup');
    if (item.kind === 'passive') {
      const prevMax = this.stats.maxHp;
      this.passives.push(item.item.id);
      this.stats = this.calcStats();
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

    if (this.mode === 'waves') this.startWave(1200);
    else if ((room.kind === 'combat' || room.kind === 'boss') && !this.cleared.has(room.id)) {
      if (room.kind === 'boss') this.spawnBoss();
      else {
        const n = Phaser.Math.Between(...this.difficulty.enemies);
        for (let k = 0; k < n; k++) this.spawnEnemy();
      }
      this.setDoorsLocked(room, true);
      sfx('door');
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

  // --- Obstáculos (roomLayouts.ts) ---

  private makeObstacleTextures() {
    if (this.textures.exists('bush')) return;
    const g = this.add.graphics();
    g.fillStyle(0x2e6b2a, 1).fillCircle(20, 22, 17);
    g.fillStyle(0x3f8f3a, 1).fillCircle(13, 18, 11).fillCircle(27, 18, 11).fillCircle(20, 12, 11);
    g.fillStyle(0x6cc05a, 1).fillCircle(15, 13, 4).fillCircle(25, 11, 3);
    g.generateTexture('bush', 40, 40);
    g.destroy();
  }

  /** Dibuja y crea los cuerpos de los obstáculos de la sala. */
  private buildObstacles(room: Room) {
    const grid = layoutFor(this.floorSeed, room.id, room.kind);
    this.grids.set(room.id, grid);
    const i = this.interior(room);
    const g = this.add.graphics().setDepth(1);
    grid.forEach((row, ty) =>
      row.forEach((c, tx) => {
        const x = i.x0 + tx * TILE;
        const y = i.y0 + ty * TILE;
        const cx = x + TILE / 2;
        const cy = y + TILE / 2;
        switch (c) {
          case 'R':
            g.fillStyle(0x5f5f6e, 1).fillRoundedRect(x + 2, y + 4, TILE - 4, TILE - 6, 8);
            g.fillStyle(0x8d8d9c, 1).fillRoundedRect(x + 4, y + 3, TILE - 8, TILE - 12, 7);
            this.addWall(x, y, TILE, TILE);
            break;
          case 'P':
            g.fillStyle(0x3d4466, 1).fillRect(x + 4, y + 2, TILE - 8, TILE - 4);
            g.fillStyle(0x6c75a3, 1).fillRect(x + 8, y + 2, TILE - 20, TILE - 4);
            this.addWall(x, y, TILE, TILE);
            break;
          case 'H': {
            g.fillStyle(0x1a1410, 1).fillRoundedRect(x + 1, y + 1, TILE - 2, TILE - 2, 10);
            g.fillStyle(0x0b0806, 1).fillRoundedRect(x + 6, y + 8, TILE - 12, TILE - 12, 8);
            const hole = this.add.rectangle(cx, cy, TILE - 6, TILE - 6).setVisible(false);
            this.holes.add(hole);
            break;
          }
          case 'W':
            g.fillStyle(0x6fa8dc, 0.55).fillRoundedRect(x, y, TILE, TILE, 12);
            break;
          case 'B': {
            const bush = this.bushes.create(cx, cy, 'bush') as Sprite;
            bush.setDepth(2).setData('hp', 2).setData('room', room.id).setData('tile', [tx, ty]);
            break;
          }
        }
      }),
    );
  }

  /** Un disparo rompe un poco la hierba alta: con dos golpes desaparece y deja pasar. */
  private onShotBush(shot: Sprite, bush: Sprite) {
    if (!shot.active || !bush.active) return;
    shot.destroy();
    const hp = (bush.getData('hp') as number) - 1;
    bush.setData('hp', hp);
    if (hp > 0) {
      bush.setTint(0xb8e0a8);
      return;
    }
    const [tx, ty] = bush.getData('tile') as [number, number];
    const grid = this.grids.get(bush.getData('room') as number);
    if (grid) grid[ty][tx] = '.';
    bush.destroy();
    this.flow = undefined; // el camino ha cambiado
  }

  /** Casilla de la sala actual en (x, y) del mundo. */
  private tileOf(x: number, y: number): [number, number] {
    const i = this.interior(this.current);
    return [Math.floor((x - i.x0) / TILE), Math.floor((y - i.y0) / TILE)];
  }

  private cellAt(x: number, y: number): Cell | undefined {
    const grid = this.current && this.grids.get(this.current.id);
    if (!grid) return undefined;
    const [tx, ty] = this.tileOf(x, y);
    return grid[ty]?.[tx];
  }

  /** Se puede estar en (x, y): dentro de la sala y sin obstáculo. */
  private freeAt(x: number, y: number): boolean {
    const c = this.cellAt(x, y);
    return c === undefined || isWalkable(c);
  }

  /** El punto libre más cercano a (x, y) en la sala actual (centro de su casilla si estaba ocupado). */
  private freeSpot(x: number, y: number) {
    if (this.freeAt(x, y)) return { x, y };
    const grid = this.grids.get(this.current.id)!;
    const [tx, ty] = nearestWalkable(grid, ...this.tileOf(x, y));
    const i = this.interior(this.current);
    return { x: i.x0 + tx * TILE + TILE / 2, y: i.y0 + ty * TILE + TILE / 2 };
  }

  /** Recalcula el campo de flujo cuando el jugador cambia de casilla (solo en salas con obstáculos). */
  private updateFlow() {
    const grid = this.grids.get(this.current.id);
    if (!grid || grid.every((row) => row.every((c) => c === '.' || c === 'W'))) {
      this.flow = undefined;
      return;
    }
    const [tx, ty] = this.tileOf(this.player.x, this.player.y);
    const f = this.flow;
    if (f && f.roomId === this.current.id && f.tx === tx && f.ty === ty) return;
    this.flow = { roomId: this.current.id, tx, ty, dist: flowField(grid, tx, ty) };
  }

  /** Dirección para acercarse al jugador rodeando obstáculos; sin campo de flujo, en línea recta. */
  private flowDir(e: Sprite, toPlayer: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const f = this.flow;
    if (!f || f.roomId !== this.current.id) return toPlayer.clone();
    const [tx, ty] = this.tileOf(e.x, e.y);
    const here = f.dist[ty]?.[tx];
    // Cerca del jugador, o fuera del mapa de casillas, va directo
    if (here === undefined || here <= 1 || here === Infinity) return toPlayer.clone();
    const step = stepToward(f.dist, tx, ty);
    if (!step) return toPlayer.clone();
    const i = this.interior(this.current);
    const gx = i.x0 + (tx + step[0]) * TILE + TILE / 2;
    const gy = i.y0 + (ty + step[1]) * TILE + TILE / 2;
    const v = new Phaser.Math.Vector2(gx - e.x, gy - e.y);
    return v.length() > 0 ? v.normalize() : toPlayer.clone();
  }

  // --- Enemigos ---

  private randomSpotInRoom(margin: number) {
    const i = this.interior(this.current);
    let x = i.cx;
    let y = i.cy;
    for (let tries = 0; tries < 50; tries++) {
      x = Phaser.Math.Between(i.x0 + margin, i.x1 - margin);
      y = Phaser.Math.Between(i.y0 + margin, i.y1 - margin);
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) >= 220 && this.freeAt(x, y)) break;
    }
    return { x, y };
  }

  private spawnEnemy() {
    const kind = Phaser.Utils.Array.GetRandom(this.foeKinds) as FoeKind;
    const { x, y } = this.randomSpotInRoom(60);
    const e = this.enemies.create(x, y, `${kind.key}-front`) as Sprite;
    e.setDisplaySize(60, 60).setData('sheet', kind.key).setData('size', 60);
    const st = shapeEnemyStats(enemyStats(kind.bst, kind.behavior, this.difficulty), kind.stats);
    e.setData('hp', st.hp).setData('maxHp', st.hp).setData('speed', st.speed).setData('dmg', st.damage);
    e.setData('ai', this.newAI(kind.behavior, kind.type, false));
  }

  private spawnBoss() {
    const { x, y } = this.randomSpotInRoom(110);
    const b = this.enemies.create(x, y, `${this.bossKey}-front`) as Sprite;
    b.setDisplaySize(150, 150).setData('sheet', this.bossKey).setData('size', 150);
    const d = this.difficulty;
    const st = bossStats(this.bossBase, d);
    b.setData('hp', st.hp).setData('speed', st.speed).setData('dmg', st.damage);
    b.setData('maxHp', b.getData('hp'));
    this.buildBossBar(b);
    // El jefe también se comporta según su tipo
    b.setData('ai', this.newAI(behaviorFor([this.bossType]), this.bossType, true));
    this.showBanner(`¡${this.bossName}, jefe legendario!`, 1400);
    void cry(this.bossId);
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
      knockUntil: 0,
    };
  }

  /** IA de un enemigo según su comportamiento: perseguir, embestir, disparar o saltar. */
  private updateEnemy(e: Sprite, time: number) {
    const ai = e.getData('ai') as EnemyAI | undefined;
    if (ai && time < ai.knockUntil) return; // sale despedido: conserva la velocidad del empujón
    const statuses = (e.getData('statuses') as ActiveStatus[] | undefined) ?? [];
    const slow = speedMultiplier(statuses, time, ai?.boss);
    if (slow === 0) {
      // Paralizado: a ratos se queda quieto del todo
      e.setVelocity(0, 0);
      return;
    }
    const speed = (e.getData('speed') as number) * slow;
    const toPlayer = new Phaser.Math.Vector2(this.player.x - e.x, this.player.y - e.y);
    const dist = toPlayer.length();
    if (dist > 0) toPlayer.normalize();
    // Confuso: va (y apunta) dando bandazos
    // Para acercarse, rodea los obstáculos siguiendo el campo de flujo (para apuntar sigue mirando a ti)
    const toward = this.flowDir(e, toPlayer);
    if (isConfused(statuses, time)) {
      const wobble = Math.PI * 0.8 * Math.sin((time / 260) * (ai?.side ?? 1));
      toPlayer.rotate(wobble);
      toward.rotate(wobble);
    }
    const walk = (v: Phaser.Math.Vector2) => e.setVelocity(v.x * speed, v.y * speed);
    // Asustado (Siniestro): huye de ti y no ataca
    if (isFeared(statuses, time)) {
      walk(toPlayer.clone().negate());
      this.face(e, toPlayer);
      return;
    }

    if (!ai || ai.behavior === 'chase') {
      walk(toward);
      this.face(e, toPlayer);
      return;
    }

    switch (ai.behavior) {
      case 'charge':
        if (ai.state === 'walk') {
          walk(toward);
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
        if (dist > keep + 90) walk(toward);
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
          walk(toward);
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
      if (x > i.x0 + m && x < i.x1 - m && y > i.y0 + m && y < i.y1 - m && this.freeAt(x, y)) return { x, y };
    }
    return this.randomSpotInRoom(m);
  }

  /** Proyectil enemigo del color de su tipo, con borde oscuro para no confundirlo con los tuyos. */
  private fireFoeShot(e: Sprite, dir: Phaser.Math.Vector2, type: string) {
    const s = this.foeShots.create(e.x, e.y, 'foe-shot') as Sprite;
    s.setTint(typeColor(type)).setScale(0.75).setDepth(4);
    s.setVelocity(dir.x * FOE_SHOT_SPEED, dir.y * FOE_SHOT_SPEED);
    const weak = enemyDamageMul((e.getData('statuses') as ActiveStatus[] | undefined) ?? [], this.time.now);
    s.setData('dmg', Math.max(1, Math.round((e.getData('dmg') as number) * 0.8 * weak)));
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
      coins: this.coins,
      formId: this.formId,
    };
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({ slot: this.slot, starterId: this.starterId, mode: this.mode, carry } satisfies GameData);
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
      if (this.ended) goTo(this, 'Menu');
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
      if (Phaser.Input.Keyboard.JustDown(this.restartKey) || start) goTo(this, 'Starter', { slot: this.slot });
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
    // En los charcos vas más despacio
    const wade = this.cellAt(this.player.x, this.player.y) === 'W' ? 0.6 : 1;
    this.player.setVelocity(dir.x * this.stats.speed * wade, dir.y * this.stats.speed * wade);
    this.updateFlow();

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

    // Centro Pokémon y tienda: Enter o A cerca del mostrador o de un artículo (A no lanza entonces el poder 1)
    const padA = hasPad && pad!.A && !this.padPrev[0];
    const usedA = this.updateInteract(Phaser.Input.Keyboard.JustDown(this.enterKey), padA);

    // Poderes: teclas 1-4 o botones A, B, X, Y
    this.abilityKeys.forEach((k, i) => {
      if (Phaser.Input.Keyboard.JustDown(k)) this.castSlot(i, time);
    });
    if (hasPad) {
      [pad!.A, pad!.B, pad!.X, pad!.Y].forEach((down, i) => {
        if (down && !this.padPrev[i] && !(i === 0 && usedA)) this.castSlot(i, time);
        this.padPrev[i] = down;
      });
    }

    // IA de cada enemigo según su comportamiento
    // Copia: un enemigo puede caer por quemadura o veneno mientras se recorre
    [...this.enemies.getChildren()].forEach((c) => {
      const e = c as Sprite;
      if (!e.active || this.tickEnemyStatus(e, time)) return;
      this.updateEnemy(e, time);
      this.paintEnemy(e, time);
      this.drawEnemyBar(e);
    });

    // HUD
    const foes = this.enemies.countActive(true);
    this.nameText.setText(this.starterName.charAt(0).toUpperCase() + this.starterName.slice(1));
    this.progressHud.setText(`${progressText(this.mode, this.floorNum)}${foes ? ` · ${foes} enem.` : ''}`);
    this.hpText.setText(`${Math.max(0, Math.ceil(this.hp))}/${this.stats.maxHp}`);
    this.hpBar.set(this.hp / this.stats.maxHp);
    const bb = this.bossBar;
    if (bb) bb.bar.set((bb.boss.getData('hp') as number) / (bb.boss.getData('maxHp') as number));
    this.coinsHud.setText(`● ${this.coins}`);
    this.slots.forEach((m, i) => this.paintSlot(i, m, !m || time >= this.slotReady[i]));

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
    // Acero: los poderes atraviesan un enemigo más
    const pierce = o.pierce + (o.status ? extraPierce(o.status) : 0);
    s.setData('dmg', o.damage).setData('pierce', pierce).setData('bounces', o.bounces);
    s.setData('hit', new Set<Sprite>());
    s.setData('status', o.status);
    if (o.bounces > 0) s.setBounce(1, 1);
    this.time.delayedCall(o.life, () => s.destroy());
  }

  /** Disparo básico. Los pasivos cambian cuántos salen, cuánto daño hacen y hasta dónde llegan. */
  private fireTear(dir: Phaser.Math.Vector2) {
    sfx('shot');
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
    sfx('shot');

    const dir = this.aim.clone();
    // At. Esp. del Pokémon y, encima, lo que suban el daño los objetos
    const dmg = Math.max(6, Math.round(m.power * 0.5 * this.stats.powerMul * (this.stats.damage / this.base.damage)));
    const base = {
      color: typeColor(m.type),
      pierce: this.stats.pierce,
      bounces: this.stats.bounces,
      life: this.stats.range + 250,
      status: m.type,
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

    const status = shot.getData('status') as string | undefined;
    // Dragón: los poderes hacen más daño
    const dmg = (shot.getData('dmg') as number) * (status ? hitDamageMul(status) : 1);
    const hp = (enemy.getData('hp') as number) - dmg;
    sfx('hit');
    enemy.setData('hp', hp);
    enemy.setTint(0xff6666);
    enemy.setData('flashUntil', this.time.now + 90);
    // Drenar cura aunque el golpe lo derrote; el resto solo afecta a quien sigue en pie
    if (status && (hp > 0 || statusForType(status)?.kind === 'drain')) this.applyStatusTo(enemy, status, dmg);

    const pierce = shot.getData('pierce') as number;
    if (pierce > 0) shot.setData('pierce', pierce - 1);
    else shot.destroy();

    if (hp <= 0) this.killEnemy(enemy);
  }

  private killEnemy(enemy: Sprite) {
    const boss = !!(enemy.getData('ai') as EnemyAI | undefined)?.boss;
    // Monedas solo donde hay tienda en la que gastarlas; bayas siempre
    const hasShop = this.floor.shopId !== undefined;
    rollEnemyLoot(Math.random, boss)
      .filter((d) => hasShop || d.kind !== 'coin')
      .forEach((d, k) => this.dropLoot(enemy.x + (k - 1) * 26, enemy.y + 10, d));
    (enemy.getData('bar') as Phaser.GameObjects.Graphics | undefined)?.destroy();
    if (this.bossBar?.boss === enemy) {
      this.bossBar.objects.forEach((o) => o.destroy());
      this.bossBar = undefined;
    }
    enemy.destroy();
    this.checkClear();
  }

  // --- Barras de vida ---

  /** Barrita encima del enemigo, solo cuando ya ha recibido daño (el jefe usa la barra grande). */
  private drawEnemyBar(e: Sprite) {
    if (!e.active || this.bossBar?.boss === e) return;
    const hp = e.getData('hp') as number;
    const max = (e.getData('maxHp') as number | undefined) ?? hp;
    let g = e.getData('bar') as Phaser.GameObjects.Graphics | undefined;
    if (hp >= max) {
      g?.setVisible(false);
      return;
    }
    if (!g) {
      g = this.add.graphics().setDepth(6);
      e.setData('bar', g);
    }
    const w = 44;
    const x = e.x - w / 2;
    const y = e.y - (e.getData('size') as number) / 2 - 10;
    const ratio = Math.max(0, hp / max);
    g.clear().setVisible(e.alpha > 0.5);
    g.fillStyle(0x1d2848, 1).fillRoundedRect(x - 2, y - 2, w + 4, 8, 3);
    g.fillStyle(0x404a5c, 1).fillRect(x, y, w, 4);
    g.fillStyle(hpColor(ratio), 1).fillRect(x, y, w * ratio, 4);
  }

  private buildBossBar(boss: Sprite) {
    this.bossBar?.objects.forEach((o) => o.destroy());
    const box = drawBox(this.add.graphics(), 230, 84, 500, 50, { radius: 12 });
    const name = this.add.text(248, 109, this.bossName, { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: HEX.text }).setOrigin(0, 0.5);
    const chip = addTypeChip(this, 248 + name.width + 46, 109, typeNameEs(this.bossType), typeColor(this.bossType), 78, 22);
    const bar = addHpBar(this, 248 + name.width + 96, 103, 712 - (248 + name.width + 96), 12);
    const objects = [box, name, ...chip, ...bar.objects];
    objects.forEach((o) => (o as Phaser.GameObjects.Text).setScrollFactor(0).setDepth(10));
    this.bossBar = { boss, bar, objects };
  }

  // --- Monedas y bayas en el suelo ---

  private makeLootTextures() {
    if (!this.textures.exists('coin')) {
      const g = this.add.graphics();
      g.fillStyle(0x8a6d1a, 1).fillCircle(9, 9, 9);
      g.fillStyle(0xffd34d, 1).fillCircle(9, 9, 7);
      g.fillStyle(0xfff1b8, 1).fillCircle(7, 7, 2.5);
      g.generateTexture('coin', 18, 18);
      g.destroy();
    }
    if (!this.textures.exists('berry')) {
      const g = this.add.graphics();
      g.fillStyle(0x1d2848, 1).fillCircle(12, 14, 10);
      g.fillStyle(0xffffff, 1).fillCircle(12, 14, 8);
      g.fillStyle(0x3fa34d, 1).fillEllipse(12, 4, 12, 6);
      g.generateTexture('berry', 24, 24);
      g.destroy();
    }
  }

  /** Suelta botín dentro de la sala actual. */
  private dropLoot(x: number, y: number, drop: LootDrop) {
    const i = this.interior(this.current);
    const p = this.freeSpot(Phaser.Math.Clamp(x, i.x0 + 30, i.x1 - 30), Phaser.Math.Clamp(y, i.y0 + 30, i.y1 - 30));
    this.spawnLoot(this.current.id, p.x, p.y, drop);
  }

  private spawnLoot(roomId: number, x: number, y: number, drop: LootDrop) {
    const entry: FloorItemSave = { roomId, x, y, drop };
    this.floorItems.push(entry);
    const s = this.loot.create(x, y, drop.kind === 'coin' ? 'coin' : 'berry') as Sprite;
    if (drop.kind === 'coin') s.setScale(drop.value > 1 ? 1.3 : 1);
    else s.setTint(BERRIES[drop.id].color);
    s.setDepth(2).setData('drop', drop).setData('entry', entry);
    this.tweens.add({ targets: s, y: y - 5, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private pickLoot(sprite: Sprite) {
    if (!sprite.active) return;
    const drop = sprite.getData('drop') as LootDrop;
    if (drop.kind === 'berry') {
      // Con los PS al máximo la baya se queda en el suelo
      if (!canHeal(this.hp, this.stats.maxHp)) return;
      const b = BERRIES[drop.id];
      this.hp = healed(this.hp, this.stats.maxHp, b.heal);
      sfx('heal');
      this.popup(this.player.x, this.player.y - 50, `${b.name} +${b.heal} PS`, b.color);
    } else {
      this.coins += drop.value;
      sfx('coin');
      this.popup(sprite.x, sprite.y - 16, `+${drop.value}`, 0xffd34d);
    }
    this.floorItems = this.floorItems.filter((f) => f !== sprite.getData('entry'));
    this.tweens.killTweensOf(sprite);
    sprite.destroy();
  }

  // --- Centro Pokémon ---

  private buildCenter(room: Room) {
    const i = this.interior(room);
    const x = i.cx;
    const y = i.cy - 60;
    const g = this.add.graphics().setDepth(1);
    this.counter = { x, y, g };
    this.paintCounter();
    this.add
      .text(x, y - 56, 'Centro Pokémon', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#c2185b' })
      .setOrigin(0.5)
      .setDepth(3);
    // Con ratón: clic en el mostrador
    const hit = this.add.zone(x, y, 160, 70).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => (this.overHud = true));
    hit.on('pointerout', () => (this.overHud = false));
    hit.on('pointerdown', () => this.current?.id === room.id && this.useCenter());
  }

  private paintCounter() {
    const c = this.counter;
    if (!c) return;
    const g = c.g.clear();
    drawBox(g, c.x - 80, c.y - 35, 160, 70, { radius: 12, border: this.centerUsed ? 0x9aa5b1 : CENTER_PINK });
    const cross = this.centerUsed ? 0x9aa5b1 : 0xe53935;
    g.fillStyle(cross, 1).fillRect(c.x - 6, c.y - 20, 12, 40).fillRect(c.x - 20, c.y - 6, 40, 12);
  }

  /** El mostrador cura la mitad de tus PS máximos, una vez por piso (si te falta vida). */
  private useCenter() {
    if (this.ended || this.transitioning) return;
    if (this.centerUsed) return this.showBanner('Ya te has curado en este piso', 1200);
    if (!canHeal(this.hp, this.stats.maxHp)) return this.showBanner('Ya tienes todos los PS', 1200);
    const amount = centerHeal(this.stats.maxHp);
    this.hp = healed(this.hp, this.stats.maxHp, amount);
    this.centerUsed = true;
    sfx('heal');
    this.paintCounter();
    this.popup(this.player.x, this.player.y - 50, `+${amount} PS`, CENTER_PINK);
    this.showBanner(`¡Centro Pokémon!\n+${amount} PS`, 1600);
    this.saveNow();
  }

  // --- Tienda ---

  private buildShop(room: Room) {
    const i = this.interior(room);
    this.add
      .text(i.cx, i.cy - 120, 'Tienda', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#1e8449' })
      .setOrigin(0.5)
      .setDepth(3);
    this.shopViews = this.shop.map((slot, k) => {
      if (slot.sold) return [];
      const x = i.cx + SHOP_OFFSETS[k];
      const y = i.cy;
      const { name, color } = this.goodsInfo(slot);
      const shadow = this.add.ellipse(x, y + 18, 80, 30, 0xa8c9a8).setDepth(1);
      const icon = this.add.image(x, y, 'shot').setTint(color).setScale(1.5).setDepth(2);
      const label = this.add
        .text(x, y - 40, name, { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: HEX.text })
        .setOrigin(0.5)
        .setDepth(3);
      const price = this.add
        .text(x, y + 44, `● ${slot.price}`, { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#b8860b' })
        .setOrigin(0.5)
        .setDepth(3)
        .setStroke('#ffffff', 4);
      // Con ratón: clic en el artículo para comprarlo
      icon.setInteractive({ useHandCursor: true });
      icon.on('pointerover', () => (this.overHud = true));
      icon.on('pointerout', () => (this.overHud = false));
      icon.on('pointerdown', () => this.current?.id === room.id && this.buy(k));
      return [shadow, icon, label, price];
    });
  }

  private goodsInfo(slot: ShopSlot): { name: string; color: number } {
    const g = slot.goods;
    if (g.kind === 'potion') return { name: POTIONS[g.id].name, color: POTIONS[g.id].color };
    if (g.kind === 'move') return { name: pretty(g.move.name), color: typeColor(g.move.type) };
    const item = passiveById(g.id);
    return { name: item?.name ?? g.id, color: item?.color ?? 0xffffff };
  }

  private shopPos(k: number) {
    const i = this.interior(this.floor.rooms[this.floor.shopId!]);
    return { x: i.cx + SHOP_OFFSETS[k], y: i.cy };
  }

  private buy(k: number) {
    if (this.ended || this.transitioning) return;
    const slot = this.shop[k];
    if (!slot) return;
    const res = canBuy(slot, this.coins, this.hp, this.stats.maxHp);
    if (res === 'sold') return;
    if (res === 'poor') return this.showBanner(`Te faltan monedas\n(cuesta ${slot.price}, tienes ${this.coins})`, 1400);
    if (res === 'full') return this.showBanner('Ya tienes todos los PS', 1200);
    this.coins -= slot.price;
    sfx('buy');
    slot.sold = true;
    this.shopViews[k]?.forEach((o) => o.destroy());
    this.shopViews[k] = [];
    const g = slot.goods;
    if (g.kind === 'potion') {
      const p = POTIONS[g.id];
      this.hp = healed(this.hp, this.stats.maxHp, p.heal);
      this.showBanner(`${p.name}\n+${p.heal} PS`, 1400);
    } else if (g.kind === 'move') {
      this.gainItem({ kind: 'move', move: g.move });
    } else {
      const item = passiveById(g.id);
      if (item) this.gainItem({ kind: 'passive', item });
    }
    this.refreshInventory();
    this.saveNow();
  }

  /**
   * Mostrador y tienda: al pisarlos se usan; cerca, aparece un aviso y se usan con Enter o A.
   * Devuelve true si este fotograma ha usado el botón A (para no lanzar también el poder 1).
   */
  private updateInteract(enter: boolean, padA: boolean): boolean {
    this.prompt.setText('');
    const px = this.player.x;
    const py = this.player.y;
    const act = enter || padA;
    if (this.current.kind === 'center' && this.counter) {
      const d = Phaser.Math.Distance.Between(px, py, this.counter.x, this.counter.y);
      const touching = d < TOUCH + 30;
      if (touching && !this.counterTouch) this.useCenter();
      this.counterTouch = touching;
      if (d < NEAR + 30 && !this.centerUsed) {
        this.prompt.setText('Enter / A / clic: curarte').setPosition(this.counter.x, this.counter.y - 70);
        if (act) {
          this.useCenter();
          return padA;
        }
      }
      return false;
    }
    if (this.current.kind === 'shop') {
      let touched = -1;
      let nearest = -1;
      let best = NEAR;
      this.shop.forEach((slot, k) => {
        if (slot.sold) return;
        const pos = this.shopPos(k);
        const d = Phaser.Math.Distance.Between(px, py, pos.x, pos.y);
        if (d < TOUCH) touched = k;
        if (d < best) {
          best = d;
          nearest = k;
        }
      });
      // Pisar un artículo lo compra (una vez por pisada, como en Isaac)
      if (touched !== -1 && touched !== this.shopTouch) this.buy(touched);
      this.shopTouch = touched;
      if (nearest !== -1 && !this.shop[nearest].sold) {
        const pos = this.shopPos(nearest);
        this.prompt.setText(`Enter / A / clic: comprar (● ${this.shop[nearest].price})`).setPosition(pos.x, pos.y - 60);
        if (act) {
          this.buy(nearest);
          return padA;
        }
      }
    }
    return false;
  }

  // --- Estados (quemar, congelar, paralizar…) ---

  /** Aplica el estado del tipo del poder. Drenar cura al jugador y empujar aparta al enemigo al momento. */
  private applyStatusTo(enemy: Sprite, type: string, damage: number) {
    const effect = statusForType(type);
    if (!effect) return;
    const now = this.time.now;
    if (effect.kind === 'drain') {
      const heal = drainHeal(damage);
      this.hp = Math.min(this.stats.maxHp, this.hp + heal);
      this.popup(this.player.x, this.player.y - 50, `+${heal} PS`, effect.color);
      return;
    }
    const push = KNOCKBACK_FORCE[effect.kind];
    if (push) {
      // Lucha, Roca y Tierra empujan; Volador, con viento, más lejos
      const ai = enemy.getData('ai') as EnemyAI | undefined;
      const away = new Phaser.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y).normalize();
      const force = ai?.boss ? push * 0.45 : push;
      enemy.setVelocity(away.x * force, away.y * force);
      if (ai) ai.knockUntil = now + 200;
      return;
    }
    // Furia (Dragón) y atravesar (Acero) ya actuaron al disparar y golpear
    if (effect.duration <= 0) return;
    const prev = (enemy.getData('statuses') as ActiveStatus[] | undefined) ?? [];
    const fresh = !prev.some((s) => s.kind === effect.kind && now < s.until);
    enemy.setData('statuses', applyStatus(prev, effect, now, damage));
    if (fresh) this.popup(enemy.x, enemy.y - (enemy.getData('size') as number) / 2 - 10, effect.label, effect.color);
  }

  /** Daño de quemaduras y veneno. Devuelve true si el enemigo ha caído. */
  private tickEnemyStatus(e: Sprite, time: number): boolean {
    const list = e.getData('statuses') as ActiveStatus[] | undefined;
    if (!list || list.length === 0) return false;
    const { damage, list: rest } = tickStatuses(list, time);
    e.setData('statuses', rest);
    if (damage <= 0) return false;
    const hp = (e.getData('hp') as number) - damage;
    e.setData('hp', hp);
    if (hp > 0) return false;
    this.killEnemy(e);
    return true;
  }

  /** Tinte del enemigo: destello al recibir un golpe, aviso de embestida o el color de su estado. */
  private paintEnemy(e: Sprite, time: number) {
    if (!e.active || time < ((e.getData('flashUntil') as number | undefined) ?? 0)) return;
    const ai = e.getData('ai') as EnemyAI | undefined;
    if (ai?.state === 'windup') return;
    const tint = statusTint((e.getData('statuses') as ActiveStatus[] | undefined) ?? [], time);
    if (tint !== null) e.setTint(tint);
    else if (e.isTinted) e.clearTint();
  }

  /** Texto que sube y se desvanece (estados, curación). */
  private popup(x: number, y: number, text: string, color: number) {
    const t = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#' + color.toString(16).padStart(6, '0') })
      .setOrigin(0.5)
      .setDepth(15)
      .setStroke('#1d2848', 4);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  // --- Oleadas ---

  /** Empieza la ronda actual tras un momento de respiro. */
  private startWave(delay: number) {
    const round = this.floorNum;
    this.showBanner(`Ronda ${round}`, delay);
    this.time.delayedCall(delay, () => {
      if (this.ended || this.floorNum !== round) return;
      const { count } = waveSpec(round);
      for (let k = 0; k < count; k++) this.spawnEnemy();
      this.waveActive = true;
    });
  }

  private onWaveCleared() {
    if (!this.waveActive) return;
    this.waveActive = false;
    sfx('clear');
    const round = this.floorNum;
    this.foeShots.clear(true, true);
    this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.healOnClear);
    const reward = waveTickets(round);
    this.earned += reward;
    addTickets(reward);
    const record = submitRecord('waves', round);

    let text = `¡Ronda ${round} superada! +${reward} tickets`;
    if (record) text += '\n¡Nuevo récord!';
    if (waveDropsItem(round)) {
      const i = this.interior(this.current);
      this.dropItem(this.current.id, i.cx, i.cy);
      text += '\nHa caído un objeto';
    }
    this.showBanner(text, 1600);

    // Siguiente ronda: al subir de nivel, enemigos más fuertes y más dificultad
    const prevLevel = this.level();
    this.floorNum = round + 1;
    if (shouldEvolve(this.mode, this.floorNum)) void this.evolve();
    this.difficulty = difficultyFor(this.level());
    this.saveNow();
    const ready = this.level() !== prevLevel ? this.reloadFoes(this.level()).catch(() => undefined) : Promise.resolve();
    void ready.then(() => !this.ended && this.time.delayedCall(400, () => this.startWave(1400)));
  }

  private checkClear() {
    const room = this.current;
    if (this.mode === 'waves') {
      if (this.enemies.countActive(true) === 0) this.onWaveCleared();
      return;
    }
    if (this.cleared.has(room.id) || this.enemies.countActive(true) > 0) return;
    this.cleared.add(room.id);
    sfx('clear');
    this.setDoorsLocked(room, false);
    this.foeShots.clear(true, true);
    this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.healOnClear);

    // En Rush de jefes no hay salas que den tickets, así que cada jefe da algo menos que en un piso
    const bossReward = bossTicketsFor(this.mode === 'bossrush' ? Math.ceil(this.floorNum / 2) : this.floorNum);
    const reward = room.kind === 'boss' ? bossReward : roomTicketsFor(this.floorNum);
    this.earned += reward;
    addTickets(reward);

    if (room.kind === 'boss') {
      // Récord: pisos completados (Normal, Infinito) o jefes vencidos (Rush)
      const record = submitRecord(this.mode, this.floorNum);
      if (isLastStage(this.mode, this.floorNum)) {
        this.finish(
          `¡Has completado los ${FLOOR_COUNT} pisos!\n+${this.earned} tickets en total\nPulsa R, Start o haz clic para empezar otra partida`,
        );
        return;
      }
      // Como en Isaac: el jefe deja un objeto y una trampilla al piso siguiente
      const i = this.interior(room);
      this.dropItem(room.id, i.cx + 170, i.cy);
      this.spawnTrapdoor();
      const next = this.mode === 'bossrush' ? `ir al jefe ${this.floorNum + 1}` : `bajar al piso ${this.floorNum + 1}`;
      const best = record ? '\n¡Nuevo récord!' : '';
      this.showBanner(`¡Jefe derrotado! +${reward} tickets${best}\nPisa la trampilla para ${next}`, 2600);
      this.saveNow();
      return;
    }

    // Monedas de la partida al limpiar la sala (solo si hay tienda en el piso)
    if (this.floor.shopId !== undefined) {
      const i = this.interior(room);
      this.dropLoot(i.cx - 60, i.cy + 40, { kind: 'coin', value: roomClearCoins(Math.random, this.floorNum) });
    }

    // A veces la sala limpiada deja un objeto, como en Isaac
    if (Math.random() < CLEAR_DROP_CHANCE) {
      const i = this.interior(room);
      this.dropItem(room.id, i.cx, i.cy);
      this.showBanner(`¡Sala limpia! +${reward} tickets\nHa caído un objeto`, 1400);
    } else {
      this.showBanner(`¡Sala limpia! +${reward} tickets`, 1000);
    }
    this.saveNow();
  }

  /** Ranura de poder: cuadro con una franja del color del tipo; apagada mientras recarga. */
  private paintSlot(i: number, m: MovePower | null, ready: boolean) {
    const key = m ? `${m.id}:${m.name}:${ready}` : 'vacía';
    if (this.slotShown[i] === key) return;
    this.slotShown[i] = key;
    const g = this.slotBoxes[i].clear();
    const x = 84 + i * 210;
    drawBox(g, x, 580, 200, 44, { radius: 10, fillAlpha: m ? 1 : 0.5 });
    if (m) {
      g.fillStyle(typeColor(m.type), 1).fillRoundedRect(x + 9, 589, 8, 26, 4);
      // Ficha con el nombre del tipo sobre el borde de arriba
      g.fillStyle(0x1d2848, 1).fillRoundedRect(x + 110, 571, 82, 18, 9);
      g.fillStyle(typeColor(m.type), 1).fillRoundedRect(x + 112, 573, 78, 14, 7);
    }
    this.slotTypes[i].setText(m ? typeNameEs(m.type).toUpperCase() : '');
    const text = this.hud[i];
    if (!m) text.setText(`${i + 1}  —`).setAlpha(0.6);
    else text.setText(`${i + 1}  ${shorten(pretty(m.name), 13)}`).setAlpha(ready ? 1 : 0.4);
    g.setAlpha(ready ? 1 : 0.7);
  }

  private showBanner(text: string, ms?: number) {
    this.bannerTimer?.remove();
    this.setBanner(text);
    this.bannerTimer = ms ? this.time.delayedCall(ms, () => this.setBanner('')) : undefined;
  }

  /** Pone el texto del cartel y ajusta su cuadro al tamaño del texto (sin texto, sin cuadro). */
  private setBanner(text: string) {
    this.banner.setText(text);
    this.bannerBox.clear();
    if (!text) return;
    const w = Math.min(880, this.banner.width + 70);
    const h = this.banner.height + 44;
    drawBox(this.bannerBox, 480 - w / 2, 320 - h / 2, w, h, { radius: 16 });
  }

  private hurtPlayer(enemy: Sprite) {
    const now = this.time.now;
    if (this.ended || this.transitioning || now < this.invulnUntil) return;
    // Quien salta no hace daño mientras desaparece o recién aparecido
    const ai = enemy.getData('ai') as EnemyAI | undefined;
    if (ai && ai.behavior === 'hop' && ai.state !== 'walk') return;
    this.invulnUntil = now + 900;
    sfx('hurt');
    // Defensa y Def. Esp. reducen el daño recibido
    // Los proyectiles ya llevan el debilitamiento; el contacto lo mira ahora (Hada: −30 %)
    const weak = enemy.getData('ai') ? enemyDamageMul((enemy.getData('statuses') as ActiveStatus[] | undefined) ?? [], now) : 1;
    this.hp -= Math.max(1, Math.round(((enemy.getData('dmg') as number | undefined) ?? 10) * weak * this.stats.damageTaken));
    this.player.setTint(0xff6666);
    this.time.delayedCall(150, () => this.player.active && this.player.clearTint());

    if (this.hp <= 0) {
      const where = this.mode === 'normal' ? '' : ` en ${progressText(this.mode, this.floorNum).toLowerCase()}`;
      this.finish(`Has caído${where} · +${this.earned} tickets\nPulsa R, Start o haz clic para volver a empezar`);
    }
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
    this.time.delayedCall(700, () => this.input.once('pointerdown', () => goTo(this, 'Starter', { slot: this.slot })));
  }
}
