import Phaser from 'phaser';
import { fetchAbility, fetchAttackMovesForTypes, fetchMoveInfo, fetchNextEvolutions, fetchPokemon, fetchPokemonCard, pickSprites } from '../data/pokeapi';
import { pickEvolution, shouldEvolve } from '../data/evolution';
import { filterMovesByTypes } from '../data/moves';
import { typeColor, typeNameEs } from '../data/types';
import { addTickets } from '../data/save';
import { clearRun, saveRun, FloorItemSave, RunSave, RUN_VERSION, SavedDrop, FLOOR_LAYOUT } from '../data/runSave';
import { loadSpeciesIndex } from '../data/speciesIndex';
import {
  bossTicketsFor,
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
import { addRunHistory, loadMissions, loadShinies, loadTutorial, loadUpgrades, recordMission, saveTutorial, submitRecord } from '../data/save';
import { disableTips, markTipSeen, shouldShowTip, TIPS, type TipId } from '../data/tutorial';
import { abilityFor, pinchMul, type Ability } from '../data/abilities';
import { emptyCounters, type RunCounters, type RunRecord } from '../data/runHistory';
import { ToastStack, type ToastOptions } from '../ui/toast';
import { ACHIEVEMENTS, lockedItems, rewardText, type MissionEvent } from '../data/missions';
import {
  attackInterval,
  bossAttacks,
  bossPhase,
  mixBehaviors,
  pickAttack,
  rainCount,
  ringCount,
  BossAttack,
  PHASE2_SPEED,
  TELEGRAPH_MS,
  HELPER_HP_MUL,
  helpersToSummon,
} from '../data/bossPatterns';
import {
  ACTIVE_DROP_CHANCE,
  ACTIVE_EFFECT,
  ACTIVE_IDS,
  activeById,
  applySynergies,
  chargeAfterClear,
  isCharged,
  SYNERGIES,
} from '../data/synergies';
import { rollShiny, SHINY_ENEMY, SHINY_ODDS } from '../data/shiny';
import { sparkle } from '../ui/sparkle';
import { applyUpgrades, levelsFor } from '../data/upgrades';
import { cry, sfx } from '../ui/audio';
import { bakeIcons, iconKey } from '../ui/art/icons';
import { bakeBiomeTiles, TILE as ART_TILE } from '../ui/art/tiles';
import { loadPmd, pmdAnimKey, pmdKey, PmdSheet } from '../ui/pmdSprites';
import { dir8Row, pmdScale } from '../data/pmdAnim';
import { CX, CY, DCX, DCY, GAME_VIEW, GAME_ZOOM, H, HUD, W } from '../ui/layout';
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
  CLEAR_DROP_CHANCE,
  roomClearCoins,
  rollChest,
  inBlast,
  challengeWaveSize,
  BOMB,
  CHALLENGE_REWARD,
  CHALLENGE_WAVES,
  START_BOMBS,
  START_KEYS,
  LootDrop,
  ShopSlot,
} from '../data/loot';
import { addHpBar, addTypeChip, drawBox, fadeIn, FONT, goTo, HEX, hpColor, shorten } from '../ui/theme';
import {
  applyStatus,
  drainHeal,
  STATUS_EFFECTS,
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
  PASSIVE_ITEMS,
  passiveById,
  rollItem,
  toMovePower,
  DroppedItem,
  MovePower,
  PlayerStats,
} from '../data/items';
import { generateFloor, mulberry32, doorKey, DIRS, OPPOSITE, Dir, Floor, Room } from '../level/floorGen';
import { biomeBossPool, biomeEnemyPool, biomeFor, Biome, BIOMES } from '../level/biomes';
import { behaviorFor, enemyStats, pickFloorEnemies, EnemyBehavior, FALLBACK_ENEMIES } from '../data/enemies';
import { drawMinimap } from './minimap';

// Cada sala ocupa una pantalla del mundo; ROOM es su interior relativo a la celda
const VIEW = { w: 960, h: 640 };
const ROOM = { x: 80, y: 80, w: 800, h: 480 };
const WALL = 40;
const DOOR = 120;
const SLOT_COUNT = 4;
/** Separación en radianes entre los proyectiles de un abanico. */
const SPREAD = 0.2;

const DOOR_COLOR = 0x8a5a3c;
const FLOOR_COLORS: Record<Room['kind'], number> = {
  start: 0xdff3ff,
  combat: 0xcdeee0,
  item: 0xfff1c9,
  boss: 0xf6d6d6,
  center: 0xffe3ef,
  shop: 0xe2f4e4,
  secret: 0xc9bca8,
  challenge: 0xece0e0,
};
/** Marco de la puerta a la sala de desafío y a la sala secreta (cuando se ha abierto). */
const CHALLENGE_SILVER = 0xbdc3c7;
const SECRET_PURPLE = 0x8e44ad;
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
  'floor' | 'bossHistory' | 'hp' | 'passives' | 'slots' | 'nextSlotReplace' | 'movePool' | 'earned' | 'coins' | 'formId' | 'keys' | 'bombs' | 'active' | 'healed' | 'counters'
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
  /** Todos sus tipos (misiones de "vence enemigos de tipo X"). */
  types: string[];
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
  /** Jefe: ataques que sabe, cuándo toca el siguiente, el último y su fase (2 por debajo del 50 %). */
  attacks?: BossAttack[];
  nextAttack?: number;
  lastAttack?: BossAttack;
  phase?: 1 | 2;
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
  private bossTypes: string[] = ['normal'];
  /** Texturas de suelo, pared y obstáculos del bioma (ui/art/tiles.ts). */
  private tiles!: ReturnType<typeof bakeBiomeTiles>;
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
  /** Tienes shiny al Pokémon elegido: juegas con su sprite shiny (también al evolucionar). */
  private shiny = false;
  /** Te has curado en esta partida (misiones "sin curarte"); hpMark = PS del fotograma anterior (-1 = sin medir). */
  private healedRun = false;
  /** Registro de la partida al terminar (para el resumen). */
  private lastRecord?: RunRecord;
  private leavingToSummary = false;
  /** Tiempo, enemigos vencidos, daño hecho y récord de la partida (para el resumen, T28). */
  private counters: RunCounters = emptyCounters();
  /** Habilidad de PokeAPI de tu Pokémon (T27); null mientras carga o si no tiene. */
  private ability: Ability | null = null;
  private hpMark = -1;
  /** Sprites animados de SpriteCollab cargados (por id de Pokémon); los que no estén usan el de PokeAPI. */
  private pmd = new Map<number, PmdSheet>();
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
  /** Bioma del piso (o del nivel de Oleadas): colores, obstáculos y tipos de enemigos (biomes.ts). */
  private biome: Biome = BIOMES[0];
  private bossHistory: number[] = [];
  /** Trampilla al piso siguiente: aparece al vencer al jefe y se activa cuando te alejas de ella. */
  private trapdoor?: { x: number; y: number; armed: boolean };
  /** Objetos que hay en el suelo (para guardarlos). */
  private floorItems: FloorItemSave[] = [];
  private pauseKey!: Key;
  /** Consejos del tutorial: T cierra el que se ve, N los desactiva (en el mando, RT y LT). */
  private tipKey!: Key;
  private noTipsKey!: Key;
  private tipQueue: TipId[] = [];
  private tipObjects: Phaser.GameObjects.GameObject[] = [];
  private tipTimer?: Phaser.Time.TimerEvent;
  private triggerPrev = [false, false];

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
  private keysHud!: Phaser.GameObjects.Text;
  private bombsHud!: Phaser.GameObjects.Text;
  /** Llaves (abren cofres) y bombas (rompen rocas y abren la sala secreta). */
  private keys = START_KEYS;
  private bombs = START_BOMBS;
  private bombKey!: Key;
  private rbPrev = false;
  /** Cofres de este piso: sala → posición y dibujo. */
  private chests = new Map<number, { x: number; y: number; img: Phaser.GameObjects.Image }>();
  private openedChests = new Set<number>();
  private chestTouch = false;
  /** Puertas ocultas ya abiertas con una bomba, y los trozos de pared que las tapan aún. */
  private revealedDoors = new Set<string>();
  private secretWalls = new Map<string, Phaser.GameObjects.GameObject[]>();
  /** Rocas que se pueden romper con bombas: "sala:x,y" → dibujo y cuerpo. */
  private rocks = new Map<string, Phaser.GameObjects.GameObject[]>();
  /** Sala de desafío: oleada en curso (0 = no ha empezado). */
  private challengeWave = 0;
  /** Objeto activo (Espacio, LB o clic en su cuadro) y cuántas salas lleva cargadas. */
  private active: { id: string; charge: number } | null = null;
  private activeKey!: Key;
  private lbPrev = false;
  private activeHud?: { g: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; shown: string };
  /** Sinergias activas (ids) para avisar cuando aparece una nueva. */
  private synergies: string[] = [];
  /** Ataque X: hasta cuándo dura el daño extra. */
  private buffUntil = 0;
  /** Escudo de esta sala, Banda Focus de este piso y Hierba Blanca ya usada. */
  private shieldLeft = 0;
  private focusLeft = 0;
  private lowHpUsed = false;
  private shieldRing?: Phaser.GameObjects.Arc;
  /** Restos de PS del robo de vida (se cura de uno en uno). */
  private lifestealAcc = 0;
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
  private toasts?: ToastStack;
  private bannerBox!: Phaser.GameObjects.Graphics;
  private minimap!: Phaser.GameObjects.Graphics;
  /** HUD (T30/N8): capa en coordenadas reales, con su propia cámara sin zoom, en las franjas de alrededor de la sala. */
  private hudLayer!: Phaser.GameObjects.Container;
  private hudCam?: Phaser.Cameras.Scene2D.Camera;

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
    this.shiny = loadShinies().includes(this.starterId);
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
    this.keys = START_KEYS;
    this.bombs = START_BOMBS;
    this.rbPrev = false;
    this.chests.clear();
    this.openedChests.clear();
    this.chestTouch = false;
    this.revealedDoors.clear();
    this.secretWalls.clear();
    this.rocks.clear();
    this.challengeWave = 0;
    this.active = null;
    this.lbPrev = false;
    this.activeHud = undefined;
    this.synergies = [];
    this.buffUntil = 0;
    this.shieldLeft = 0;
    this.lowHpUsed = false;
    this.lifestealAcc = 0;
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
    this.trapdoor = undefined;
    this.floorNum = 1;
    this.ability = null;
    this.healedRun = false;
    this.counters = emptyCounters();
    this.lastRecord = undefined;
    this.leavingToSummary = false;
    this.hpMark = -1;
    this.tipQueue = [];
    this.tipObjects = [];
    this.tipTimer = undefined;
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
      this.keys = c.keys;
      this.bombs = c.bombs;
      this.active = c.active ? { ...c.active } : null;
      this.healedRun = c.healed;
      this.counters = { ...c.counters };
    }
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.resetFX();
    // La sala ocupa el centro de la pantalla; alrededor quedan las franjas del HUD
    for (const c of [...this.cameras.cameras]) if (c !== this.cameras.main) this.cameras.remove(c);
    this.hudCam = undefined;
    this.cameras.main.setViewport(GAME_VIEW.x, GAME_VIEW.y, GAME_VIEW.w, GAME_VIEW.h).setZoom(GAME_ZOOM).centerOn(DCX, DCY);
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
    this.biome = biomeFor(this.mode, this.mode === 'waves' ? this.level() : this.floorNum);
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
        extra: this.layout >= 3,
      });
    }
    if (r) {
      r.openedChests.forEach((id) => this.openedChests.add(id));
      r.revealedDoors.forEach((k) => this.revealedDoors.add(k));
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
      // El jefe intenta ser de un tipo del bioma
      bossId = pickBoss(biomeBossPool(index, this.biome), Math.random, this.bossHistory);
      this.bossHistory.push(bossId);
    }
    this.bossId = bossId;
    // Enemigos del piso: más fuertes cuanto más hondo; la semilla del piso los fija (no hace falta guardarlos)
    const foeIds = pickFloorEnemies(biomeEnemyPool(index, this.level(), this.biome), this.foeRng(this.level()));
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
    this.bossTypes = boss.types.length > 0 ? boss.types : ['normal'];
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
    this.playerKey = `starter-${starter.id}${this.shiny ? '-s' : ''}`;
    this.bossKey = `boss-${boss.id}`;
    await poolReady;

    this.load.crossOrigin = 'anonymous';
    // Cada hoja: clave y sprites (los enemigos también en shiny, por si sale uno)
    const sheets: [string, { front: string; back: string }][] = [
      [this.playerKey, pickSprites(starter.sprites, this.shiny)],
      [this.bossKey, pickSprites(boss.sprites, false)],
      ...foes.flatMap((c) => [
        [`foe-${c.id}`, pickSprites(c.sprites, false)] as [string, { front: string; back: string }],
        [`foe-${c.id}-s`, pickSprites(c.sprites, true)] as [string, { front: string; back: string }],
      ]),
    ];
    for (const [key, urls] of sheets) {
      if (!this.textures.exists(`${key}-front`)) this.load.image(`${key}-front`, urls.front);
      if (!this.textures.exists(`${key}-back`)) this.load.image(`${key}-back`, urls.back);
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      // Sprites pixel: escalado sin suavizar para que se vean nítidos
      for (const [key] of sheets) {
        for (const side of ['front', 'back']) {
          const tex = `${key}-${side}`;
          if (this.textures.exists(tex)) this.textures.get(tex).setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
      }
      // Sprites animados de 8 direcciones (T31). El shiny se queda con el de PokeAPI (SpriteCollab no lo tiene igual)
      const pmdIds = [bossId!, ...foes.map((c) => c.id), ...(this.shiny ? [] : [this.formId])];
      loadPmd(this, pmdIds)
        .catch(() => new Map<number, PmdSheet>())
        .then((m) => {
          this.pmd = m;
          loading.destroy();
          this.startFloor();
        });
    });
    this.load.start();
  }

  /**
   * Usa el sprite animado de SpriteCollab para este Pokémon si lo hay: textura de la hoja, escala y cuerpo físico.
   * Devuelve si lo ha usado (si no, el sprite sigue con el de PokeAPI).
   */
  private applyPmd(sprite: Sprite, id: number | undefined, size: number, circle = false): boolean {
    const sheet = id === undefined ? undefined : this.pmd.get(id);
    if (!sheet) {
      sprite.setData('pmd', undefined);
      return false;
    }
    sprite.anims.stop();
    sprite.setTexture(pmdKey(sheet.id, 'walk'), 0).setFlipX(false).setScale(pmdScale(size));
    sprite.setData('pmd', sheet).setData('row', 0).setData('facing', undefined);
    const fw = sheet.walk.frameWidth;
    const fh = sheet.walk.frameHeight;
    const body = sprite.body as Body | null;
    if (body) {
      // Cuerpo hacia los pies del Pokémon (los frames tienen aire por arriba)
      if (circle) {
        const rad = Math.min(fw, fh) * 0.3;
        sprite.setCircle(rad, fw / 2 - rad, fh * 0.62 - rad);
      } else body.setSize(fw * 0.6, fh * 0.55).setOffset(fw * 0.2, fh * 0.38);
    }
    this.playPmd(sprite);
    return true;
  }

  /** Animación de caminar (o reposo si está quieto) en la fila de la dirección a la que mira. */
  private playPmd(sprite: Sprite) {
    const sheet = sprite.getData('pmd') as PmdSheet | undefined;
    if (!sheet) return;
    const row = (sprite.getData('row') as number | undefined) ?? 0;
    const moving = (sprite.getData('moving') as boolean | undefined) ?? true;
    const anim = moving || !sheet.hasIdle ? 'walk' : 'idle';
    sprite.anims.play(pmdAnimKey(sheet.id, anim, row), true);
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
    const types = this.slots.flatMap((m) => (m ? [m.type] : []));
    const { stats, active } = applySynergies(computeStats(this.passives, this.base), this.passives, types);
    this.synergies = active.map((syn) => syn.id);
    this.ability?.apply?.(stats);
    return stats;
  }

  /** Multiplicador de daño de Ataque X mientras dura. */
  private dmgMul(): number {
    return this.time.now < this.buffUntil ? ACTIVE_EFFECT.buffMul : 1;
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
      types: c.types.length > 0 ? [...c.types] : ['normal'],
      stats: c.stats,
    }));
  }

  /** Oleadas: al subir de nivel, cambia a especies más fuertes (si no se pueden cargar, siguen las de antes). */
  private async reloadFoes(level: number) {
    const index = await loadSpeciesIndex().catch(() => [] as SpeciesFact[]);
    this.biome = biomeFor(this.mode, level);
    const ids = pickFloorEnemies(biomeEnemyPool(index, level, this.biome), this.foeRng(level));
    const cards = (await Promise.all(ids.map((id) => fetchPokemonCard(id).catch(() => null)))).filter((c) => c !== null);
    if (cards.length === 0 || !this.scene.isActive()) return;
    await new Promise<void>((resolve) => {
      let queued = 0;
      for (const c of cards) {
        for (const sh of [false, true]) {
          const urls = pickSprites(c.sprites, sh);
          for (const side of ['front', 'back'] as const) {
            const key = `foe-${c.id}${sh ? '-s' : ''}-${side}`;
            if (this.textures.exists(key)) continue;
            this.load.image(key, urls[side]);
            queued++;
          }
        }
      }
      if (queued === 0) return resolve();
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.start();
    });
    const ok = cards.filter((c) => this.textures.exists(`foe-${c.id}-front`));
    for (const c of ok) {
      for (const side of ['front', 'back', 's-front', 's-back']) {
        const tex = `foe-${c.id}-${side}`;
        if (this.textures.exists(tex)) this.textures.get(tex).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    if (ok.length > 0) this.foeKinds = this.toFoeKinds(ok, index);
    for (const [id, sheet] of await loadPmd(this, ok.map((c) => c.id)).catch(() => new Map<number, PmdSheet>())) this.pmd.set(id, sheet);
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
    if (sprite.getData('pmd')) {
      const row = dir8Row(v.x, v.y);
      if (sprite.getData('row') !== row) {
        sprite.setData('row', row);
        this.playPmd(sprite);
      }
      return;
    }
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
    // Arte pixel del supervisor (T33): iconos y baldosas del bioma, antes de montar las salas
    bakeIcons(this);
    this.tiles = bakeBiomeTiles(this, this.biome);
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
    this.makeExtraTextures();
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
    if (!this.shiny) this.applyPmd(this.player, this.formId, 84, true);

    this.enemies = this.physics.add.group();
    this.shots = this.physics.add.group();
    this.foeShots = this.physics.add.group();

    this.physics.add.collider(this.player, [this.walls, this.doorBlocks, this.bushes]);
    // Con Levitación cruzas los agujeros
    this.physics.add.collider(this.player, this.holes, undefined, () => !this.ability?.levitate);
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
    this.bombKey = kb.addKey(K.E);
    this.activeKey = kb.addKey(K.SPACE);
    this.escKey = kb.addKey(K.ESC);
    this.pauseKey = kb.addKey(K.P);
    this.tipKey = kb.addKey(K.T);
    this.noTipsKey = kb.addKey(K.N);
    this.menuPadPrev = false;
    // El clic derecho sirve para moverse con el ratón, así que sin menú contextual
    this.input.mouse?.disableContextMenu();

    // HUD (N8): fuera de la sala, en las franjas de alrededor, con una cámara sin zoom (coordenadas reales).
    // Lo que se crea en la escena no sale en esa cámara salvo lo que va en la capa del HUD.
    this.hudLayer = this.add.container(0, 0).setDepth(50);
    this.cameras.main.ignore(this.hudLayer);
    const hudCam = this.cameras.add(0, 0, W, H).setName('hud');
    this.hudCam = hudCam;
    hudCam.ignore(this.children.list.filter((o) => o !== this.hudLayer));
    const onAdded = (go: Phaser.GameObjects.GameObject) => go !== this.hudLayer && hudCam.ignore(go);
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded));
    const hud = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.hudLayer.add(o);
      o.cameraFilter &= ~hudCam.id;
      return o;
    };
    const txt = (x: number, y: number, size: number, color: string = HEX.text, bold = false) =>
      hud(this.add.text(x, y, '', { fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color }));
    const over = (o: Phaser.GameObjects.Zone | Phaser.GameObjects.Text) => {
      o.on('pointerover', () => (this.overHud = true));
      o.on('pointerout', () => (this.overHud = false));
      return o;
    };
    const LX = HUD.left.x + HUD.pad;
    const LW = HUD.left.w - HUD.pad * 2;
    const RX = HUD.right.x + HUD.pad;
    const RW = HUD.right.w - HUD.pad * 2;

    // Pausa (arriba a la izquierda), para jugar solo con ratón
    hud(drawBox(this.add.graphics(), LX, 16, 64, 64, { radius: 12 }));
    const pb = over(
      hud(this.add.text(LX + 32, 48, '❚❚', { fontFamily: FONT, fontSize: '28px', color: HEX.text }))
        .setOrigin(0.5)
        .setPadding(14, 12)
        .setInteractive({ useHandCursor: true }),
    );
    // Ficha del Pokémon: nombre, progreso y PS
    hud(drawBox(this.add.graphics(), LX, 96, LW, 150, { radius: 14 }));
    this.nameText = txt(LX + 16, 124, 24, HEX.text, true).setOrigin(0, 0.5);
    this.progressHud = txt(LX + 16, 154, 16, HEX.textSoft).setOrigin(0, 0.5);
    this.hpBar = addHpBar(this, LX + 16, 180, LW - 32, 14);
    this.hpBar.objects.forEach((o) => hud(o));
    this.hpText = txt(LX + LW - 16, 222, 20, HEX.text, true).setOrigin(1, 0.5);
    // Monedas, llaves y bombas (clic en la bomba para soltar una)
    hud(drawBox(this.add.graphics(), LX, 258, LW, 60, { radius: 12 }));
    const count = (iconKey: string, x: number) => {
      hud(this.add.image(x, 288, iconKey).setScale(2));
      return txt(x + 16, 288, 20, HEX.text, true).setOrigin(0, 0.5);
    };
    this.coinsHud = count(iconKey('coin'), LX + 26);
    this.keysHud = count(iconKey('key'), LX + 94);
    this.bombsHud = count(iconKey('bomb'), LX + 160);
    const bombBtn = over(hud(this.add.zone(LX + 172, 288, 64, 52).setInteractive({ useHandCursor: true })));
    bombBtn.on('pointerdown', () => this.placeBomb());
    // Objetos pasivos
    this.invText = hud(
      this.add.text(LX, 334, '', { fontFamily: FONT, fontSize: '15px', color: '#ffffff', wordWrap: { width: LW }, lineSpacing: 4 }),
    );
    // Objeto activo: abajo a la izquierda (clic para usarlo)
    this.activeHud = {
      g: hud(this.add.graphics()),
      text: txt(LX + 70, H - 82, 15, HEX.text, true).setOrigin(0, 0.5),
      shown: '',
    };
    const activeBtn = over(hud(this.add.zone(LX + LW / 2, H - 71, LW, 110).setInteractive({ useHandCursor: true })));
    activeBtn.on('pointerdown', () => this.useActive());
    // Poderes: cuatro cuadros abajo a la derecha (clic para lanzar)
    for (let i = 0; i < SLOT_COUNT; i++) {
      const y = this.slotY(i);
      this.slotBoxes.push(hud(this.add.graphics()));
      this.slotTypes.push(
        txt(RX + RW - 52, y + 2, 12, '#ffffff', true).setOrigin(0.5).setShadow(1, 1, '#00000088', 0),
      );
      this.slotShown.push('');
      this.hud.push(txt(RX + 30, y + 34, 18, HEX.text, true).setOrigin(0, 0.5));
      const zone = over(hud(this.add.zone(RX + RW / 2, y + 32, RW, 64).setInteractive({ useHandCursor: true })));
      zone.on('pointerdown', () => !this.ended && !this.transitioning && this.castSlot(i, this.time.now));
    }
    // Minimapa arriba a la derecha
    this.minimap = hud(this.add.graphics());
    // Avisos (T37): tarjetas en la franja derecha, bajo el minimapa
    this.toasts?.clear();
    this.toasts = new ToastStack(this, HUD.right.x + HUD.pad, 200, HUD.right.w - HUD.pad * 2, (box, parts) => {
      this.hudLayer.add(box);
      if (this.hudCam) for (const o of [box, ...parts]) o.cameraFilter &= ~this.hudCam.id;
    });
    // Cartel del centro, solo para el fin de partida (como los diálogos de los juegos)
    this.bannerBox = hud(this.add.graphics());
    this.banner = hud(
      this.add.text(CX, CY, '', {
        fontFamily: FONT,
        fontSize: '46px',
        fontStyle: 'bold',
        color: HEX.text,
        align: 'center',
        wordWrap: { width: GAME_VIEW.w - 200 },
      }),
    ).setOrigin(0.5);
    pb.on('pointerdown', () => this.openPause());

    // Tienda: al continuar, lo que quedaba; si no, artículos nuevos para este piso
    if (this.floor.shopId !== undefined) {
      if (this.shop.length === 0) this.shop = rollShop(Math.random, new Set(this.passives), this.movePool, this.passivePool());
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
    void this.loadAbility(this.formId);
    // En Oleadas el cartel de la ronda lo pone startWave
    if (this.mode !== 'waves') {
      const where = progressText(this.mode, this.floorNum);
      const head = r ? 'Partida cargada' : MODE_LABEL[this.mode];
      this.notify(`${head}
${where} — ${this.biome.name}`, { kind: 'info', icon: 'trapdoor' });
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
      const key = `starter-${next}${this.shiny ? '-s' : ''}`;
      const evoUrls = pickSprites(data.sprites, this.shiny);
      await new Promise<void>((resolve) => {
        let queued = 0;
        for (const side of ['front', 'back'] as const) {
          if (this.textures.exists(`${key}-${side}`)) continue;
          this.load.image(`${key}-${side}`, evoUrls[side]);
          queued++;
        }
        if (queued === 0) return resolve();
        this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
        this.load.start();
      });
      if (!this.shiny) for (const [id, sheet] of await loadPmd(this, [next])) this.pmd.set(id, sheet);
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
          // Con SpriteCollab si la nueva forma lo tiene; si no, vuelve al de PokeAPI
          if (this.shiny || !this.applyPmd(this.player, next, 84, true)) {
            this.player.anims.stop();
            this.player.setScale(1);
          }
          this.face(this.player, this.aim);
          const prevMax = this.stats.maxHp;
          this.baseStats = data.stats;
          this.base = applyUpgrades(playerBaseStats(data.stats), levelsFor(loadUpgrades(), this.starterId));
          this.stats = this.calcStats();
          // Lo que suben los PS máximos también te cura
          this.hp = Math.min(this.stats.maxHp, this.hp + Math.max(0, this.stats.maxHp - prevMax));
          this.hpMark = this.hp;
          this.starterName = data.name;
          this.tearType = data.types[0] ?? this.tearType;
          this.notify(`¡${oldName} ha evolucionado!\nAhora es ${data.name}`, { kind: 'item', icon: 'pokeball' });
          void cry(next);
          // La forma nueva puede tener otra habilidad
          void this.loadAbility(next);
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
    if (item.kind === 'active') return { kind: 'active', id: item.id };
    return item.kind === 'passive' ? { kind: 'passive', id: item.item.id } : { kind: 'move', move: item.move };
  }

  private fromSaved(d: SavedDrop): DroppedItem | null {
    if (d.kind === 'move') return { kind: 'move', move: d.move };
    if (d.kind === 'active') return activeById(d.id) ? { kind: 'active', id: d.id } : null;
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
    this.keys = r.keys;
    this.bombs = r.bombs;
    this.active = r.active && activeById(r.active.id) ? { ...r.active } : null;
    this.healedRun = r.healed;
    this.counters = { ...r.counters };
    this.centerUsed = r.centerUsed;
    this.shop = r.shop.map((s) => ({ ...s }));
    for (const f of r.floorItems) {
      if (f.drop.kind === 'coin' || f.drop.kind === 'berry' || f.drop.kind === 'key' || f.drop.kind === 'bomb') {
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
      keys: this.keys,
      bombs: this.bombs,
      openedChests: [...this.openedChests],
      revealedDoors: [...this.revealedDoors],
      active: this.active ? { ...this.active } : null,
      healed: this.healedRun,
      counters: { ...this.counters },
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
      ability: this.ability ? { name: this.ability.name, description: this.ability.description } : undefined,
      items: [
        ...[...counts].map(([id, n]) => (passiveById(id)?.name ?? id) + (n > 1 ? ` x${n}` : '')),
        ...(this.active ? [`Activo: ${activeById(this.active.id)?.name} (${this.active.charge}/${activeById(this.active.id)?.charge})`] : []),
        ...this.synergies.map((id) => `¡Sinergia! ${SYNERGIES.find((syn) => syn.id === id)?.name}`),
      ],
      moves: [...this.slots],
      roomsCleared: this.cleared.size,
      coins: this.coins,
      keys: this.keys,
      bombs: this.bombs,
      roomCount: this.floor.rooms.length,
      earned: this.earned,
      onResume: () => {
        this.scene.stop('Pause');
        this.scene.resume();
        // Mientras estaba en pausa no se enteró de que soltaste Esc/P: sin esto, la siguiente Esc no pausaba
        this.input.keyboard?.resetKeys();
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
    // Inicio, combate y jefe llevan el suelo del bioma; objeto, Centro y tienda conservan el suyo
    const plain = room.kind === 'start' || room.kind === 'combat' || room.kind === 'boss';
    const floorColor = plain ? this.biome.colors.floor : FLOOR_COLORS[room.kind];
    const g = this.add.graphics().setDepth(0);

    // Baldosas de 32 px escaladas a las casillas de 40 de la sala, así cuadran con los obstáculos
    const ts = TILE / ART_TILE;
    this.add.tileSprite(i.x0 - WALL, i.y0 - WALL, ROOM.w + WALL * 2, ROOM.h + WALL * 2, this.tiles.wall).setOrigin(0).setTileScale(ts).setDepth(0);
    if (plain) this.add.tileSprite(i.x0, i.y0, ROOM.w, ROOM.h, this.tiles.floor).setOrigin(0).setTileScale(ts).setDepth(0);
    else g.fillStyle(floorColor, 1).fillRoundedRect(i.x0, i.y0, ROOM.w, ROOM.h, 24);
    g.setDepth(0.5);

    for (const d of DIRS) {
      const to = room.doors[d];
      if (to === undefined) continue;
      // Puerta oculta: parece pared (con una grieta de pista) hasta que una bomba la abre
      if (this.isHiddenDoor(room.id, d)) {
        this.buildSecretWall(room, d);
        continue;
      }
      this.drawDoor(room, d, g, floorColor);
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
    // Sala secreta: un objeto y monedas, como premio por encontrarla
    if (room.kind === 'secret' && !this.resume) {
      this.dropItem(room.id, i.cx, i.cy);
      for (const dx of [-60, 60]) this.spawnLoot(room.id, i.cx + dx, i.cy + 70, { kind: 'coin', value: 5 });
    }
    if (this.floor.chestRooms?.includes(room.id)) this.buildChest(room);
  }

  /** Suelo de la sala (el del bioma en las normales, el suyo en las especiales). */
  private floorColorOf(room: Room): number {
    const plain = room.kind === 'start' || room.kind === 'combat' || room.kind === 'boss';
    return plain ? this.biome.colors.floor : FLOOR_COLORS[room.kind];
  }

  /** Hueco de puerta con su marco (el color dice adónde lleva) y su bloque para cerrarla en combate. */
  private drawDoor(room: Room, d: Dir, g: Phaser.GameObjects.Graphics, floorColor: number) {
    const r = this.doorRect(room, d);
    const plain = room.kind === 'start' || room.kind === 'combat' || room.kind === 'boss';
    if (plain) this.add.tileSprite(r.x, r.y, r.w, r.h, this.tiles.floor).setOrigin(0).setTileScale(TILE / ART_TILE).setDepth(0.4);
    else g.fillStyle(floorColor, 1).fillRect(r.x, r.y, r.w, r.h);
    const kind = this.floor.rooms[room.doors[d]!].kind;
    const frame =
      kind === 'boss' ? 0xe53935
      : kind === 'item' ? 0xffc107
      : kind === 'center' ? CENTER_PINK
      : kind === 'shop' ? SHOP_GREEN
      : kind === 'challenge' ? CHALLENGE_SILVER
      : kind === 'secret' || room.kind === 'secret' ? SECRET_PURPLE
      : 0x1d2848;
    g.lineStyle(6, frame, 1).strokeRect(r.x, r.y, r.w, r.h);
    if (kind === 'challenge') g.lineStyle(2, 0xffffff, 1).strokeRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10);
    const block = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, DOOR_COLOR).setDepth(1);
    this.doorBlocks.add(block);
    this.doorMap.set(doorKey(room.id, d), block);
  }

  private addWall(x: number, y: number, w: number, h: number) {
    const wall = this.add.rectangle(x + w / 2, y + h / 2, w, h).setVisible(false);
    this.walls.add(wall);
    return wall;
  }

  // --- Sala secreta, bombas y cofres (T21) ---

  private isHiddenDoor(roomId: number, d: Dir): boolean {
    const k = doorKey(roomId, d);
    return !!this.floor.hiddenDoors?.includes(k) && !this.revealedDoors.has(k);
  }

  /** Trozo de pared que tapa una puerta oculta, con una grieta en la sala desde la que se puede encontrar. */
  private buildSecretWall(room: Room, d: Dir) {
    const r = this.doorRect(room, d);
    const wall = this.addWall(r.x, r.y, r.w, r.h);
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(this.biome.colors.wall, 1).fillRect(r.x, r.y, r.w, r.h);
    if (room.kind !== 'secret') {
      // Grieta: la pista para usar una bomba aquí
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      g.lineStyle(3, 0x0d0905, 0.9);
      g.lineBetween(cx - 18, cy - 12, cx - 4, cy + 2).lineBetween(cx - 4, cy + 2, cx + 6, cy - 6).lineBetween(cx + 6, cy - 6, cx + 18, cy + 10);
      g.lineBetween(cx - 4, cy + 2, cx - 8, cy + 14);
    }
    this.secretWalls.set(doorKey(room.id, d), [wall, g]);
  }

  /** Abre una puerta oculta por los dos lados (la bomba ha estallado cerca). */
  private revealDoor(room: Room, d: Dir) {
    const other = this.floor.rooms[room.doors[d]!];
    const pairs: [Room, Dir][] = [[room, d], [other, OPPOSITE[d]]];
    for (const [rm, dir] of pairs) {
      const k = doorKey(rm.id, dir);
      if (this.revealedDoors.has(k)) continue;
      this.revealedDoors.add(k);
      this.secretWalls.get(k)?.forEach((o) => o.destroy());
      this.secretWalls.delete(k);
      this.drawDoor(rm, dir, this.add.graphics().setDepth(0), this.floorColorOf(rm));
      const block = this.doorMap.get(k);
      if (block) {
        block.setVisible(false);
        (block.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      }
    }
    this.notify('¡Has encontrado una sala secreta!', { kind: 'reward', icon: 'bomb' });
    sfx('pickup');
    this.drawMap();
  }

  private makeExtraTextures() {
    const make = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      if (this.textures.exists(key)) return;
      const g = this.add.graphics();
      draw(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };
    make('key', 22, 22, (g) => {
      g.fillStyle(0x8a6d1a, 1).fillCircle(7, 8, 7);
      g.fillStyle(0xffd34d, 1).fillCircle(7, 8, 5).fillRect(11, 6, 10, 4).fillRect(17, 10, 3, 5).fillRect(13, 10, 3, 4);
      g.fillStyle(0x8a6d1a, 1).fillCircle(7, 8, 2);
    });
    make('bomb', 24, 24, (g) => {
      g.fillStyle(0x1d2848, 1).fillCircle(11, 14, 10);
      g.fillStyle(0x3d4466, 1).fillCircle(9, 12, 4);
      g.fillStyle(0xc9a26b, 1).fillRect(14, 2, 3, 6);
      g.fillStyle(0xff9f43, 1).fillCircle(16, 2, 2);
    });
    make('chest', 44, 36, (g) => {
      g.fillStyle(0x5a3a1e, 1).fillRoundedRect(0, 4, 44, 32, 6);
      g.fillStyle(0x9a6534, 1).fillRoundedRect(3, 7, 38, 26, 5);
      g.fillStyle(0x5a3a1e, 1).fillRect(0, 16, 44, 4);
      g.fillStyle(0xffd34d, 1).fillRect(18, 13, 8, 10);
    });
    make('chest-open', 44, 36, (g) => {
      g.fillStyle(0x5a3a1e, 1).fillRoundedRect(0, 12, 44, 24, 6);
      g.fillStyle(0x2b1a0c, 1).fillRect(4, 12, 36, 8);
      g.fillStyle(0x9a6534, 1).fillRoundedRect(3, 0, 38, 12, 5);
    });
  }

  /** Cofre en una casilla libre de la parte de arriba de la sala. Se abre con una llave. */
  private buildChest(room: Room) {
    const grid = this.grids.get(room.id);
    const i = this.interior(room);
    const [tx, ty] = grid ? nearestWalkable(grid, 15, 2) : [15, 2];
    const x = i.x0 + tx * TILE + TILE / 2;
    const y = i.y0 + ty * TILE + TILE / 2;
    const img = this.add.image(x, y, iconKey(this.openedChests.has(room.id) ? 'chestOpen' : 'chest')).setScale(3).setDepth(2);
    img.setInteractive({ useHandCursor: true });
    img.on('pointerover', () => (this.overHud = true));
    img.on('pointerout', () => (this.overHud = false));
    img.on('pointerdown', () => this.current?.id === room.id && this.openChest(room.id));
    this.chests.set(room.id, { x, y, img });
  }

  private openChest(roomId: number) {
    if (this.ended || this.transitioning || this.openedChests.has(roomId)) return;
    const chest = this.chests.get(roomId);
    if (!chest) return;
    if (this.keys <= 0) return this.notify('Necesitas una llave para abrir el cofre', { kind: 'warning', icon: 'key' });
    this.keys--;
    this.openedChests.add(roomId);
    this.mission({ kind: 'chest' });
    chest.img.setTexture(iconKey('chestOpen'));
    sfx('buy');
    const prize = rollChest(Math.random);
    if (prize.kind === 'item') {
      const p = this.freeSpot(chest.x, chest.y + 60);
      this.dropItem(roomId, p.x, p.y);
    } else {
      prize.drops.forEach((d, k) => this.dropLoot(chest.x + (k - (prize.drops.length - 1) / 2) * 26, chest.y + 56, d));
    }
    this.notify('¡Cofre abierto!', { kind: 'reward', icon: 'chestOpen' });
    this.saveNow();
  }

  /** Bomba a tus pies: E, RB o clic en la bomba del HUD. */
  private placeBomb() {
    if (this.ended || this.transitioning || this.bombs <= 0 || !this.player?.active) return;
    this.bombs--;
    const x = this.player.x;
    const y = this.player.y + 10;
    const roomId = this.current.id;
    const b = this.add.image(x, y, iconKey('bomb')).setDepth(3).setScale(2.4);
    this.tweens.add({ targets: b, scale: 2.9, duration: 160, yoyo: true, repeat: -1 });
    this.time.delayedCall(BOMB.fuse, () => {
      this.tweens.killTweensOf(b);
      b.destroy();
      if (!this.ended && this.current.id === roomId) this.explode(x, y);
    });
  }

  /** Estalla: daña a enemigos (y a ti si te pilla), rompe rocas y hierba y abre puertas ocultas cercanas. */
  private explode(x: number, y: number) {
    const R = BOMB.radius;
    sfx('boom');
    this.cameras.main.shake(180, 0.006);
    const fx = this.add.circle(x, y, R, 0xffb347, 0.55).setDepth(12);
    this.tweens.add({ targets: fx, alpha: 0, scale: 1.2, duration: 300, onComplete: () => fx.destroy() });

    for (const c of [...this.enemies.getChildren()]) {
      const e = c as Sprite;
      if (!e.active || !inBlast(x, y, e.x, e.y, R + (e.getData('size') as number) / 3)) continue;
      this.countDamage(e, BOMB.damage);
      const hp = (e.getData('hp') as number) - BOMB.damage;
      e.setData('hp', hp).setTint(0xff6666).setData('flashUntil', this.time.now + 120);
      if (hp <= 0) this.killEnemy(e);
    }
    if (inBlast(x, y, this.player.x, this.player.y, R * 0.8) && this.time.now >= this.invulnUntil) {
      this.invulnUntil = this.time.now + 900;
      this.hp -= BOMB.selfDamage;
      sfx('hurt');
      if (this.hp <= 0) this.finish(false, `Has caído · +${this.earned} tickets\nPulsa R, Start o haz clic para ver el resumen`);
    }

    // Rocas y hierba alta de la sala
    const room = this.current;
    const grid = this.grids.get(room.id);
    const i = this.interior(room);
    if (grid) {
      grid.forEach((row, ty) =>
        row.forEach((c, tx) => {
          const cx = i.x0 + tx * TILE + TILE / 2;
          const cy = i.y0 + ty * TILE + TILE / 2;
          if ((c !== 'R' && c !== 'B') || !inBlast(x, y, cx, cy, R + TILE / 2)) return;
          const k = `${room.id}:${tx},${ty}`;
          if (c === 'R') {
            this.rocks.get(k)?.forEach((o) => o.destroy());
            this.rocks.delete(k);
          } else {
            for (const b of [...this.bushes.getChildren()]) {
              const [bx, by] = (b.getData('tile') as [number, number] | undefined) ?? [-1, -1];
              if (b.getData('room') === room.id && bx === tx && by === ty) b.destroy();
            }
          }
          row[tx] = '.';
        }),
      );
      this.flow = undefined;
    }
    // Paredes con grieta: la puerta oculta se abre si la bomba estalla cerca
    for (const d of DIRS) {
      if (room.doors[d] === undefined || !this.isHiddenDoor(room.id, d)) continue;
      const r = this.doorRect(room, d);
      if (inBlast(x, y, r.x + r.w / 2, r.y + r.h / 2, R + 40)) this.revealDoor(room, d);
    }
    this.saveNow();
  }

  private drawMap() {
    if (!this.current) return;
    // La sala secreta no sale en el mapa hasta que se abre una de sus puertas
    const hidden = new Set<number>();
    const sid = this.floor.secretId;
    if (sid !== undefined && !this.visited.has(sid)) {
      const open = Object.entries(this.floor.rooms[sid].doors).some(([d]) => this.revealedDoors.has(doorKey(sid, d as Dir)));
      if (!open) hidden.add(sid);
    }
    const bottom = drawMinimap(this.minimap, this.floor, this.current.id, this.visited, W - HUD.pad, HUD.pad, hidden, 1.5, HUD.right.w - HUD.pad * 2);
    this.toasts?.setTop(bottom + 16);
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
    this.spawnPickup(roomId, x, y, rollItem(Math.random, new Set(this.passives), this.movePool, ACTIVE_DROP_CHANCE, ACTIVE_IDS, this.passivePool()));
  }

  private spawnPickup(roomId: number, x: number, y: number, item: DroppedItem) {
    const entry: FloorItemSave = { roomId, x, y, drop: this.toSaved(item) };
    this.floorItems.push(entry);
    const act = item.kind === 'active' ? activeById(item.id) : undefined;
    const color = item.kind === 'passive' ? item.item.color : item.kind === 'move' ? typeColor(item.move.type) : (act?.color ?? 0xffffff);
    const name = item.kind === 'passive' ? item.item.name : item.kind === 'move' ? pretty(item.move.name) : `${act?.name ?? item.id} (activo)`;

    const shadow = this.add.ellipse(x, y + 18, 90, 34, 0xc9b27a).setDepth(1);
    // Pasivo: bolsa; poder: disco del color de su tipo; activo: Poké Ball
    const icon = item.kind === 'passive' ? 'bag' : item.kind === 'move' ? 'disc' : 'pokeball';
    const s = this.pickups.create(x, y, iconKey(icon)) as Sprite;
    s.setScale(3).setDepth(2).setData('item', item).setData('entry', entry);
    if (item.kind === 'move') s.setTint(color);
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

  /** Pasivos que pueden salir: todos menos los que aún bloquea un logro (missions.ts). */
  private passivePool() {
    const locked = lockedItems(loadMissions());
    return PASSIVE_ITEMS.filter((i) => !locked.has(i.id));
  }

  /** Suma un suceso a las misiones y logros; lo que se cumpla se avisa abajo (los premios ya se han dado). */
  private mission(e: MissionEvent) {
    for (const c of recordMission(e)) {
      const reward = rewardText(c.reward, { item: c.reward.item ? passiveById(c.reward.item)?.name : undefined });
      sfx('buy');
      if (c.kind === 'daily') this.notify(`¡Misión cumplida!\n${c.text}\n${reward}`, { kind: 'mission', ms: 5000 });
      else this.notify(`¡Logro: ${c.text}!\n${ACHIEVEMENTS.find((a) => a.id === c.id)?.text ?? ''}\n${reward}`, { kind: 'mission', ms: 5000 });
    }
  }

  /** Pone en cola un consejo del tutorial si aún no se ha visto (y no están desactivados). */
  private tip(id: TipId) {
    if (!shouldShowTip(loadTutorial(), id) || this.tipQueue.includes(id)) return;
    this.tipQueue.push(id);
    this.nextTip();
  }

  /** Cartel del consejo arriba de la sala: no para el juego y se cierra solo, con T / RT / "Vale" o para siempre con N / LT. */
  private nextTip(): void {
    if (this.tipObjects.length > 0 || !this.hudLayer?.active || this.ended) return;
    const id = this.tipQueue.shift();
    if (!id) return;
    const state = loadTutorial();
    if (!shouldShowTip(state, id)) return this.nextTip();
    saveTutorial(markTipSeen(state, id));
    // En la franja de abajo, debajo de la sala: no la tapa (T37)
    const w = GAME_VIEW.w;
    const x = GAME_VIEW.x;
    const h = 56;
    const y = H - h - 2;
    const box = drawBox(this.add.graphics(), x, y, w, h, { radius: 12 }).setAlpha(0.96);
    const title = this.add.text(x + 20, y + h / 2, `Consejo · ${TIPS[id].title}`, { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#b8860b' }).setOrigin(0, 0.5);
    const text = this.add.text(title.x + title.width + 14, y + h / 2, TIPS[id].text.replace(/\n/g, ' '), {
      fontFamily: FONT, fontSize: '14px', color: HEX.text, wordWrap: { width: w - title.width - 440 },
    }).setOrigin(0, 0.5);
    const button = (bx: number, label: string, onClick: () => void) => {
      const b = this.add.text(bx, y + h / 2, label, { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#b8860b' })
        .setOrigin(1, 0.5).setPadding(8, 6).setInteractive({ useHandCursor: true });
      b.on('pointerover', () => b.setColor(HEX.text));
      b.on('pointerout', () => b.setColor('#b8860b'));
      b.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => {
        ev?.stopPropagation?.();
        onClick();
      });
      return b;
    };
    const ok = button(x + w - 20, 'Vale (T · RT)', () => this.closeTip());
    const off = button(ok.x - ok.width - 24, 'No más consejos (N · LT)', () => this.closeTip(true));
    this.tipObjects = [box, title, text, ok, off];
    for (const o of this.tipObjects) {
      this.hudLayer.add(o);
      if (this.hudCam) o.cameraFilter &= ~this.hudCam.id;
    }
    this.tipTimer = this.time.delayedCall(9000, () => this.closeTip());
  }

  private closeTip(all = false) {
    if (all) {
      saveTutorial(disableTips(loadTutorial()));
      this.tipQueue = [];
    }
    this.tipTimer?.remove();
    this.tipTimer = undefined;
    this.tipObjects.forEach((o) => o.destroy());
    this.tipObjects = [];
    if (this.tipQueue.length > 0) this.time.delayedCall(500, () => this.nextTip());
  }

  /** Carga la habilidad de la forma actual (al empezar y al evolucionar) y recalcula las estadísticas. */
  private async loadAbility(id: number) {
    const a = await fetchAbility(id);
    if (!a || this.ended || !this.player?.active) return;
    const prevMax = this.stats.maxHp;
    this.ability = abilityFor(a.id, a.nameEs);
    this.stats = this.calcStats();
    this.hp = Math.min(this.stats.maxHp, this.hp + Math.max(0, this.stats.maxHp - prevMax));
    this.hpMark = this.hp;
  }

  /** Te quedas un pasivo o un poder (cogido del suelo o comprado). */
  private gainItem(item: DroppedItem) {
    sfx('pickup');
    this.mission({ kind: 'item' });
    this.tip(item.kind === 'move' ? 'powers' : item.kind === 'passive' ? 'items' : 'active');
    const before = new Set(this.synergies);
    if (item.kind === 'active') {
      // Como en Isaac: si ya llevabas uno, se queda en el suelo
      if (this.active && this.player) this.spawnPickup(this.current.id, this.player.x + 70, this.player.y, { kind: 'active', id: this.active.id });
      const a = activeById(item.id);
      this.active = { id: item.id, charge: a?.charge ?? 1 };
      this.notify(`${a?.name ?? item.id}\n${a?.description ?? ''}\nEspacio, LB o clic en su cuadro`, { kind: 'item', icon: 'pokeball' });
    } else if (item.kind === 'passive') {
      if (item.item.id === 'banda-focus') this.focusLeft++;
      const prevMax = this.stats.maxHp;
      this.passives.push(item.item.id);
      this.stats = this.calcStats();
      // Más PS máximos también te curan esa misma cantidad
      this.hp = Math.min(this.stats.maxHp, this.hp + Math.max(0, this.stats.maxHp - prevMax));
      this.hpMark = this.hp;
      this.notify(`${item.item.name}\n${item.item.description}`, { kind: 'item', icon: 'bag' });
    } else {
      const free = this.slots.indexOf(null);
      const slot = free !== -1 ? free : this.nextSlotReplace++ % SLOT_COUNT;
      this.slots[slot] = item.move;
      this.slotReady[slot] = 0;
      this.stats = this.calcStats();
      this.notify(`${pretty(item.move.name)}\nTecla ${slot + 1}`, { kind: 'item', icon: 'disc', tint: typeColor(item.move.type) });
    }
    // ¡Sinergia! nueva (objeto + objeto o objeto + poder)
    const fresh = this.synergies.filter((id) => !before.has(id));
    for (const id of fresh) {
      const syn = SYNERGIES.find((x) => x.id === id);
      if (syn) this.time.delayedCall(1400, () => !this.ended && this.notify(`¡Sinergia!\n${syn.name}: ${syn.description}`, { kind: 'reward', icon: 'bag' }));
    }
    this.refreshInventory();
    this.saveNow();
  }

  // --- Objeto activo ---

  private useActive() {
    if (this.ended || this.transitioning || !this.active || !this.player?.active) return;
    const a = activeById(this.active.id);
    if (!a) return;
    if (!isCharged(this.active.charge, a.charge)) {
      this.notify(`${a.name}: aún no está cargado (${this.active.charge}/${a.charge})\nSe carga limpiando salas`, { kind: 'warning', icon: 'pokeball' });
      return;
    }
    this.active.charge = 0;
    const now = this.time.now;
    sfx('heal');
    const all = this.enemies.getChildren() as Sprite[];
    if (a.id === 'poke-flauta' || a.id === 'repelente') {
      const base = a.id === 'poke-flauta' ? STATUS_EFFECTS.stun : STATUS_EFFECTS.fear;
      const effect = { ...base, duration: a.id === 'poke-flauta' ? ACTIVE_EFFECT.stunMs : ACTIVE_EFFECT.fearMs };
      for (const e of all) {
        if (!e.active) continue;
        const prev = (e.getData('statuses') as ActiveStatus[] | undefined) ?? [];
        e.setData('statuses', applyStatus(prev, effect, now, 0));
        this.popup(e.x, e.y - 40, effect.label, effect.color);
      }
    } else if (a.id === 'pokeblock') {
      this.hp = Math.min(this.stats.maxHp, this.hp + ACTIVE_EFFECT.heal);
      this.popup(this.player.x, this.player.y - 50, `+${ACTIVE_EFFECT.heal} PS`, a.color);
    } else if (a.id === 'ataque-x') {
      this.buffUntil = now + ACTIVE_EFFECT.buffMs;
      this.popup(this.player.x, this.player.y - 50, '¡Ataque X!', a.color);
    }
    this.notify(a.name, { kind: 'info', icon: 'pokeball' });
    this.saveNow();
  }

  /** Limpiar una sala recarga el objeto activo. */
  private chargeActive() {
    if (!this.active) return;
    const a = activeById(this.active.id);
    if (a) this.active.charge = chargeAfterClear(this.active.charge, a.charge);
  }

  /** Cuadro del objeto activo abajo a la izquierda: color, nombre corto y carga por casillas. */
  private paintActive() {
    const h = this.activeHud;
    if (!h) return;
    const a = this.active ? activeById(this.active.id) : undefined;
    const key = a ? `${a.id}:${this.active!.charge}` : 'nada';
    if (h.shown === key) return;
    h.shown = key;
    const g = h.g.clear();
    const x = HUD.left.x + HUD.pad;
    const bw = HUD.left.w - HUD.pad * 2;
    const y = H - HUD.pad - 110;
    drawBox(g, x, y, bw, 110, { radius: 14, fillAlpha: a ? 1 : 0.5 });
    if (!a) return void h.text.setText('Sin objeto activo');
    const ready = isCharged(this.active!.charge, a.charge);
    g.fillStyle(a.color, ready ? 1 : 0.45).fillCircle(x + 36, y + 40, 20);
    const sw = (bw - 32) / a.charge;
    for (let k = 0; k < a.charge; k++) {
      g.fillStyle(k < this.active!.charge ? 0x3fc35a : 0x404a5c, 1).fillRect(x + 16 + k * sw, y + 80, sw - 4, 12);
    }
    h.text.setText(`${shorten(a.name, 12)}\n${ready ? '¡LISTO!' : `${this.active!.charge}/${a.charge}`}`);
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
    this.shieldLeft = this.stats.shieldPerRoom;
    this.visited.add(room.id);
    // Tutorial: la primera vez que pasa cada cosa
    if (room.kind === 'start') this.tip('move');
    else if (room.kind === 'center') this.tip('center');
    else if (room.kind === 'shop') this.tip('shop');
    if (!this.cleared.has(room.id) && (this.mode === 'waves' || room.kind === 'combat' || room.kind === 'boss' || room.kind === 'challenge')) this.tip('shoot');
    if (this.chests.has(room.id)) this.tip('chest');

    if (this.mode === 'waves') this.startWave(1200);
    else if (room.kind === 'challenge' && !this.cleared.has(room.id)) {
      // Sala de desafío: se cierra y salen oleadas; al ganarlas, premio
      this.challengeWave = 1;
      this.setDoorsLocked(room, true);
      sfx('door');
      this.notify(`¡Sala de desafío!\nOleada 1/${CHALLENGE_WAVES}`, { kind: 'danger', icon: 'heart' });
      this.time.delayedCall(900, () => this.spawnChallengeWave(room.id));
    } else if ((room.kind === 'combat' || room.kind === 'boss') && !this.cleared.has(room.id)) {
      if (room.kind === 'boss') this.spawnBoss();
      else {
        const n = Phaser.Math.Between(...this.difficulty.enemies);
        this.spawnEnemies(n);
      }
      this.setDoorsLocked(room, true);
      sfx('door');
    }

    this.drawMap();
    this.saveNow();
  }

  private spawnChallengeWave(roomId: number) {
    if (this.ended || this.current.id !== roomId) return;
    const n = challengeWaveSize(this.floorNum, this.challengeWave);
    this.spawnEnemies(n);
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
    grid.forEach((row, ty) =>
      row.forEach((c, tx) => {
        const x = i.x0 + tx * TILE;
        const y = i.y0 + ty * TILE;
        const cx = x + TILE / 2;
        const cy = y + TILE / 2;
        const sc = TILE / ART_TILE;
        switch (c) {
          case 'R': {
            // Cada roca va aparte para que una bomba pueda romperla
            const rock = this.add.image(cx, cy, this.tiles.rock).setScale(sc).setDepth(1);
            this.rocks.set(`${room.id}:${tx},${ty}`, [rock, this.addWall(x, y, TILE, TILE)]);
            break;
          }
          case 'P':
            // La columna es más alta que la casilla: apoyada en su base
            this.add.image(cx, y + TILE, this.tiles.pillar).setOrigin(0.5, 1).setScale(sc).setDepth(2);
            this.addWall(x, y, TILE, TILE);
            break;
          case 'H': {
            this.add.image(cx, cy, this.tiles.hole).setScale(sc).setDepth(0.6);
            const hole = this.add.rectangle(cx, cy, TILE - 6, TILE - 6).setVisible(false);
            this.holes.add(hole);
            break;
          }
          case 'W':
            this.add.image(cx, cy, this.tiles.puddle).setScale(sc).setDepth(0.6);
            break;
          case 'B': {
            const bush = this.bushes.create(cx, cy, this.tiles.bush) as Sprite;
            bush.setScale(sc).refreshBody();
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

  /** Varios enemigos del piso; al menos uno de cada tres dispara, sea del tipo que sea (T32). */
  private spawnEnemies(n: number) {
    const kinds = Array.from({ length: n }, () => Phaser.Utils.Array.GetRandom(this.foeKinds) as FoeKind);
    const behaviors = mixBehaviors(kinds.map((k) => k.behavior));
    kinds.forEach((k, i) => this.spawnEnemy(k, behaviors[i]));
  }

  private spawnEnemy(
    kind: FoeKind = Phaser.Utils.Array.GetRandom(this.foeKinds) as FoeKind,
    behavior: EnemyBehavior = kind.behavior,
    /** Ayudante invocado por el jefe: sale donde se le dice, con menos vida y sin botín. */
    helper?: { x: number; y: number },
  ) {
    const { x, y } = helper ?? this.randomSpotInRoom(60);
    // Shiny (1/200): otro color, más vida y más premio
    const shiny = rollShiny(Math.random, SHINY_ODDS.enemy) && this.textures.exists(`${kind.key}-s-front`);
    const sheet = shiny ? `${kind.key}-s` : kind.key;
    const e = this.enemies.create(x, y, `${sheet}-front`) as Sprite;
    e.setDisplaySize(60, 60).setData('sheet', sheet).setData('size', 60).setData('shiny', shiny);
    if (!shiny) this.applyPmd(e, Number(kind.key.replace('foe-', '')), 60);
    const st = shapeEnemyStats(enemyStats(kind.bst, behavior, this.difficulty), kind.stats);
    const hp = Math.round(st.hp * (shiny ? SHINY_ENEMY.hpMul : 1) * (helper ? HELPER_HP_MUL : 1));
    e.setData('helper', !!helper);
    e.setData('hp', hp).setData('maxHp', hp).setData('speed', st.speed).setData('dmg', st.damage);
    if (shiny) {
      sparkle(this, x, y);
      this.popup(x, y - 40, '¡Shiny!', 0xffd34d);
      this.mission({ kind: 'shiny' });
    }
    e.setData('ai', this.newAI(behavior, kind.type, false)).setData('types', kind.types);
  }

  private spawnBoss() {
    const { x, y } = this.randomSpotInRoom(110);
    const b = this.enemies.create(x, y, `${this.bossKey}-front`) as Sprite;
    b.setDisplaySize(150, 150).setData('sheet', this.bossKey).setData('size', 150);
    this.applyPmd(b, this.bossId, 150);
    const d = this.difficulty;
    const st = bossStats(this.bossBase, d);
    b.setData('hp', st.hp).setData('speed', st.speed).setData('dmg', st.damage);
    b.setData('maxHp', b.getData('hp'));
    this.buildBossBar(b);
    // El jefe también se comporta según su tipo
    const ai = this.newAI(behaviorFor([this.bossType]), this.bossType, true);
    ai.attacks = bossAttacks(this.bossTypes);
    ai.nextAttack = this.time.now + 2200;
    ai.phase = 1;
    b.setData('ai', ai);
    this.notify(`¡${this.bossName}, jefe legendario!`, { kind: 'danger', icon: 'pokeball' });
    void cry(this.bossId);
  }

  // --- Ataques de los jefes (bossPatterns.ts): aviso, ataque y fase 2 ---

  private updateBossAttacks(b: Sprite, time: number) {
    const ai = b.getData('ai') as EnemyAI;
    if (!ai.attacks || !b.active) return;
    // Fase 2: por debajo de la mitad de vida, más rápido y con más ataques
    const ratio = (b.getData('hp') as number) / (b.getData('maxHp') as number);
    if (ai.phase === 1 && bossPhase(ratio) === 2) {
      ai.phase = 2;
      b.setData('speed', (b.getData('speed') as number) * PHASE2_SPEED);
      this.cameras.main.shake(250, 0.006);
      this.notify(`¡${this.bossName} se enfurece!`, { kind: 'danger', icon: 'pokeball' });
      ai.nextAttack = time + 900;
    }
    if (time < (ai.nextAttack ?? 0) || this.ended) return;
    const attack = pickAttack(ai.attacks, Math.random, ai.lastAttack);
    ai.lastAttack = attack;
    ai.nextAttack = time + attackInterval(ai.phase ?? 1) + TELEGRAPH_MS;
    if (attack === 'ring') this.bossRing(b, ai);
    else if (attack === 'charge') this.bossCharge(b, ai, time);
    else if (attack === 'summon') this.bossSummon(b, ai);
    else this.bossRain(b, ai);
  }

  /** Invocación: círculos del color del jefe donde van a salir sus ayudantes (si ya hay muchos, hace una ráfaga). */
  private bossSummon(b: Sprite, ai: EnemyAI) {
    const alive = this.enemies.getChildren().filter((c) => c.active && (c as Sprite).getData('helper')).length;
    const n = helpersToSummon(ai.phase ?? 1, alive);
    if (n === 0 || this.foeKinds.length === 0) return this.bossRing(b, ai);
    const i = this.interior(this.current);
    const color = typeColor(ai.type);
    const spots = Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2 + Math.random();
      return {
        x: Phaser.Math.Clamp(b.x + Math.cos(a) * 140, i.x0 + 50, i.x1 - 50),
        y: Phaser.Math.Clamp(b.y + Math.sin(a) * 140, i.y0 + 50, i.y1 - 50),
      };
    });
    b.setData('flashUntil', this.time.now + TELEGRAPH_MS).setTintFill(color);
    const marks = spots.map((p) => {
      const c = this.add.circle(p.x, p.y, 10, color, 0.25).setStrokeStyle(3, color, 0.9).setDepth(3);
      this.tweens.add({ targets: c, radius: 34, duration: TELEGRAPH_MS });
      return c;
    });
    this.time.delayedCall(TELEGRAPH_MS, () => {
      // Primero su tween: si sigue vivo, en el siguiente fotograma tocaría un objeto ya destruido
      marks.forEach((m) => {
        this.tweens.killTweensOf(m);
        m.destroy();
      });
      if (!b.active || this.ended) return;
      for (const p of spots) {
        sparkle(this, p.x, p.y);
        const kind = Phaser.Utils.Array.GetRandom(this.foeKinds) as FoeKind;
        this.spawnEnemy(kind, kind.behavior, p);
      }
    });
  }

  /** Ráfaga en círculo: el jefe brilla y crece un anillo de aviso; luego salen proyectiles en todas direcciones. */
  private bossRing(b: Sprite, ai: EnemyAI) {
    const warn = this.add.circle(b.x, b.y, 30).setStrokeStyle(4, typeColor(ai.type), 0.9).setDepth(5);
    this.tweens.add({ targets: warn, radius: 120, alpha: 0.2, duration: TELEGRAPH_MS, onComplete: () => warn.destroy() });
    b.setData('flashUntil', this.time.now + TELEGRAPH_MS).setTintFill(0xffffff);
    this.time.delayedCall(TELEGRAPH_MS, () => {
      if (!b.active || this.ended) return;
      const n = ringCount(ai.phase ?? 1);
      const offset = Math.random() * Math.PI;
      for (let k = 0; k < n; k++) {
        const a = offset + (k / n) * Math.PI * 2;
        this.fireFoeShot(b, new Phaser.Math.Vector2(Math.cos(a), Math.sin(a)), ai.type);
      }
    });
  }

  /** Embestida: marca una línea hacia ti, se para y se lanza por ella. */
  private bossCharge(b: Sprite, ai: EnemyAI, time: number) {
    const dir = new Phaser.Math.Vector2(this.player.x - b.x, this.player.y - b.y).normalize();
    const line = this.add.graphics().setDepth(4);
    line.lineStyle(20, 0xe53935, 0.25).lineBetween(b.x, b.y, b.x + dir.x * 600, b.y + dir.y * 600);
    line.lineStyle(3, 0xe53935, 0.8).lineBetween(b.x, b.y, b.x + dir.x * 600, b.y + dir.y * 600);
    this.tweens.add({ targets: line, alpha: 0.4, yoyo: true, repeat: 2, duration: TELEGRAPH_MS / 6 });
    // Quieto mientras avisa (la IA no manda)
    ai.knockUntil = time + TELEGRAPH_MS;
    b.setVelocity(0, 0);
    this.time.delayedCall(TELEGRAPH_MS, () => {
      line.destroy();
      if (!b.active || this.ended) return;
      const speed = (ai.phase === 2 ? 720 : 600);
      b.setVelocity(dir.x * speed, dir.y * speed);
      ai.knockUntil = this.time.now + 650;
    });
  }

  /** Lluvia: círculos de aviso en el suelo (uno donde estás); al caer, quien esté dentro recibe daño. */
  private bossRain(b: Sprite, ai: EnemyAI) {
    const i = this.interior(this.current);
    const R = 56;
    const spots = Array.from({ length: rainCount(ai.phase ?? 1) }, (_, k) =>
      k === 0
        ? { x: this.player.x, y: this.player.y }
        : {
            x: Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-260, 260), i.x0 + R, i.x1 - R),
            y: Phaser.Math.Clamp(this.player.y + Phaser.Math.Between(-200, 200), i.y0 + R, i.y1 - R),
          },
    );
    const marks = spots.map((p) => {
      const c = this.add.circle(p.x, p.y, R, 0xe53935, 0.18).setStrokeStyle(3, 0xe53935, 0.8).setDepth(3);
      this.tweens.add({ targets: c, fillAlpha: 0.4, duration: TELEGRAPH_MS + 150 });
      return c;
    });
    this.time.delayedCall(TELEGRAPH_MS + 150, () => {
      // Primero su tween: si sigue vivo, en el siguiente fotograma tocaría un objeto ya destruido
      marks.forEach((m) => {
        this.tweens.killTweensOf(m);
        m.destroy();
      });
      if (this.ended) return;
      for (const p of spots) {
        const fx = this.add.circle(p.x, p.y, R, typeColor(ai.type), 0.7).setDepth(12);
        this.tweens.add({ targets: fx, alpha: 0, scale: 1.3, duration: 260, onComplete: () => fx.destroy() });
        if (b.active && inBlast(p.x, p.y, this.player.x, this.player.y, R)) this.hurtPlayer(b);
      }
    });
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
    this.add.image(i.cx, i.cy, iconKey('trapdoor')).setScale(5).setDepth(1);
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
      keys: this.keys,
      bombs: this.bombs,
      active: this.active ? { ...this.active } : null,
      healed: this.healedRun,
      counters: { ...this.counters },
    };
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({ slot: this.slot, starterId: this.starterId, mode: this.mode, carry } satisfies GameData);
    });
  }

  // --- Bucle ---

  update(time: number, delta = 16) {
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
    if (!this.ended) this.counters.seconds += delta / 1000;
    // Cualquier subida de PS (bayas, pociones, Centro, robo de vida…) cuenta como curarse
    if (this.hpMark >= 0 && this.hp > this.hpMark + 0.001) this.healedRun = true;
    this.hpMark = this.hp;

    const pad = this.input.gamepad?.getPad(0);
    const hasPad = !!pad && pad.connected;

    if (this.ended) {
      // Nueva partida (vuelves a elegir inicial): R, Start, o A del mando pasado un momento.
      // El clic se registra en armRestartClick.
      const start = hasPad && (!!pad!.buttons[9]?.pressed || (pad!.A && time - this.endedAt > 700));
      if (Phaser.Input.Keyboard.JustDown(this.restartKey) || start) this.toSummary();
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
    if (mx === 0 && my === 0 && pointer.rightButtonDown() && this.inGameView(pointer)) {
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
    if (this.player.getData('pmd')) {
      const moving = dir.length() > 0.2;
      if (this.player.getData('moving') !== moving) {
        this.player.setData('moving', moving);
        this.playPmd(this.player);
      }
    }
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
    // Bomba: E o RB (el clic va en el icono del HUD)
    const rbNow = hasPad && !!pad!.buttons[5]?.pressed;
    if (Phaser.Input.Keyboard.JustDown(this.bombKey) || (rbNow && !this.rbPrev)) this.placeBomb();
    this.rbPrev = rbNow;
    // Objeto activo: Espacio o LB (el clic va en su cuadro)
    const lbNow = hasPad && !!pad!.buttons[4]?.pressed;
    if (Phaser.Input.Keyboard.JustDown(this.activeKey) || (lbNow && !this.lbPrev)) this.useActive();
    this.lbPrev = lbNow;
    if (this.stats.homing > 0) this.steerShots(delta);
    const ltNow = hasPad && (pad!.buttons[6]?.value ?? 0) > 0.5;
    const rtNow = hasPad && (pad!.buttons[7]?.value ?? 0) > 0.5;
    if (this.tipObjects.length > 0) {
      if (Phaser.Input.Keyboard.JustDown(this.noTipsKey) || (ltNow && !this.triggerPrev[0])) this.closeTip(true);
      else if (Phaser.Input.Keyboard.JustDown(this.tipKey) || (rtNow && !this.triggerPrev[1])) this.closeTip();
    }
    this.triggerPrev = [ltNow, rtNow];
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
      if ((e.getData('ai') as EnemyAI | undefined)?.boss) this.updateBossAttacks(e, time);
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
    this.paintActive();
    if (this.shieldRing) this.shieldRing.setPosition(this.player.x, this.player.y).setVisible(this.shieldLeft > 0);
    this.coinsHud.setText(String(this.coins));
    this.keysHud.setText(String(this.keys));
    this.bombsHud.setText(String(this.bombs));
    this.slots.forEach((m, i) => this.paintSlot(i, m, !m || time >= this.slotReady[i]));

    this.checkTrapdoor();
    if (!this.transitioning) this.checkExit();
  }

  /**
   * Dirección de disparo. Flechas (dos a la vez disparan en diagonal; dos opuestas se anulan),
   * si no, clic mantenido hacia el ratón, y si no, stick derecho.
   */
  /** El puntero está sobre la sala (no sobre las franjas del HUD). */
  private inGameView(p: Phaser.Input.Pointer): boolean {
    return p.x >= GAME_VIEW.x && p.x <= GAME_VIEW.x + GAME_VIEW.w && p.y >= GAME_VIEW.y && p.y <= GAME_VIEW.y + GAME_VIEW.h;
  }

  private readShootDir(pad: Phaser.Input.Gamepad.Gamepad | null): Phaser.Math.Vector2 | null {
    const { left, right, up, down } = this.arrows;
    const ax = (right.isDown ? 1 : 0) - (left.isDown ? 1 : 0);
    const ay = (down.isDown ? 1 : 0) - (up.isDown ? 1 : 0);
    if (ax !== 0 || ay !== 0) return new Phaser.Math.Vector2(ax, ay).normalize();

    const pointer = this.input.activePointer;
    // Solo el clic izquierdo dispara (el derecho es para moverse) y no sobre las ranuras de poder
    if (pointer.leftButtonDown() && !this.overHud && this.inGameView(pointer)) {
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

  /** Telescopio: tus disparos giran poco a poco hacia el enemigo más cercano. */
  private steerShots(delta: number) {
    const enemies = (this.enemies.getChildren() as Sprite[]).filter((e) => e.active && (e.body as Body).enable);
    if (enemies.length === 0) return;
    const maxTurn = this.stats.homing * (delta / 1000);
    for (const c of this.shots.getChildren()) {
      const shot = c as Sprite;
      const body = shot.body as Body | null;
      if (!shot.active || !body) continue;
      let best: Sprite | null = null;
      let bestD = 360 * 360;
      for (const e of enemies) {
        const d = (e.x - shot.x) ** 2 + (e.y - shot.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (!best) continue;
      const v = body.velocity;
      const speed = v.length();
      const cur = Math.atan2(v.y, v.x);
      const want = Math.atan2(best.y - shot.y, best.x - shot.x);
      const diff = Phaser.Math.Angle.Wrap(want - cur);
      const turn = Phaser.Math.Clamp(diff, -maxTurn, maxTurn);
      shot.setVelocity(Math.cos(cur + turn) * speed, Math.sin(cur + turn) * speed);
    }
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
    const opts = {
      damage: s.damage * this.dmgMul() * pinchMul(this.ability, this.tearType, this.hp, s.maxHp),
      speed: s.shotSpeed,
      // Pokéradar: más alcance cuantos más enemigos queden
      life: s.range * (1 + s.rangePerEnemy * this.enemies.countActive(true)),
      size: 0.7 * s.shotScale,
      color: typeColor(this.tearType),
      pierce: s.pierce,
      bounces: s.bounces,
    };
    for (let k = 0; k < n; k++) this.spawnShot(dir, (k - (n - 1) / 2) * SPREAD, opts);
    // Cola Gemela: también hacia atrás
    for (let k = 0; k < s.backShots; k++) this.spawnShot(dir.clone().negate(), (k - (s.backShots - 1) / 2) * SPREAD, opts);
  }

  /** Poder activo: el movimiento de la ranura sale hacia donde miras. */
  private castSlot(i: number, time: number) {
    const m = this.slots[i];
    if (!m || time < this.slotReady[i]) return;
    this.slotReady[i] = time + m.cooldown;
    sfx('shot');

    const dir = this.aim.clone();
    // At. Esp. del Pokémon y, encima, lo que suban el daño los objetos
    // Potenciadores de tipo (Carbón, Imán…) y Ataque X van encima
    const boost = 1 + (this.stats.typeBoost[m.type] ?? 0);
    const dmg = Math.max(6, Math.round(m.power * 0.5 * this.stats.powerMul * (this.stats.damage / this.base.damage) * boost * this.dmgMul() * pinchMul(this.ability, m.type, this.hp, this.stats.maxHp)));
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
    let dmg = (shot.getData('dmg') as number) * (status ? hitDamageMul(status) : 1);
    if (this.stats.critChance > 0 && Math.random() < this.stats.critChance) {
      dmg *= this.stats.critMul;
      this.popup(enemy.x, enemy.y - 30, '¡Crítico!', 0xffd34d);
    }
    // Concha Campana: parte del daño vuelve como PS
    if (this.stats.lifesteal > 0) {
      this.lifestealAcc += dmg * this.stats.lifesteal;
      const heal = Math.floor(this.lifestealAcc);
      if (heal > 0) {
        this.lifestealAcc -= heal;
        this.hp = Math.min(this.stats.maxHp, this.hp + heal);
      }
    }
    this.countDamage(enemy, dmg);
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

  /** Suma al daño hecho de la partida (sin contar lo que sobra al rematar). */
  private countDamage(e: Sprite, dmg: number) {
    this.counters.damage += Math.max(0, Math.min(dmg, e.getData('hp') as number));
  }

  private killEnemy(enemy: Sprite) {
    const boss = !!(enemy.getData('ai') as EnemyAI | undefined)?.boss;
    this.counters.kills++;
    this.mission({ kind: 'defeat', types: boss ? this.bossTypes : ((enemy.getData('types') as string[] | undefined) ?? []) });
    // Monedas solo donde hay tienda en la que gastarlas; bayas siempre
    const hasShop = this.floor.shopId !== undefined;
    const loot = enemy.getData('helper') ? [] : rollEnemyLoot(Math.random, boss);
    if (enemy.getData('shiny')) {
      // Un shiny suelta más: monedas de 5 y una llave
      for (let k = 0; k < SHINY_ENEMY.extraCoins; k++) loot.push({ kind: 'coin', value: 5 });
      loot.push({ kind: 'key' });
      sparkle(this, enemy.x, enemy.y);
    }
    loot
      .filter((d) => hasShop || d.kind !== 'coin')
      .forEach((d, k) => this.dropLoot(enemy.x + (k - 1) * 26, enemy.y + 10, d));
    (enemy.getData('bar') as Phaser.GameObjects.Graphics | undefined)?.destroy();
    if (this.bossBar?.boss === enemy) {
      this.bossBar.objects.forEach((o) => o.destroy());
      this.bossBar = undefined;
    }
    enemy.destroy();
    if (boss) {
      // Al caer el jefe se van sus ayudantes
      for (const c of [...this.enemies.getChildren()]) {
        const h = c as Sprite;
        if (!h.active || !h.getData('helper')) continue;
        sparkle(this, h.x, h.y);
        (h.getData('bar') as Phaser.GameObjects.Graphics | undefined)?.destroy();
        h.destroy();
      }
    }
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
    // En la franja de arriba, encima de la sala (no la tapa)
    const bx = CX - 440;
    const box = drawBox(this.add.graphics(), bx, 4, 880, 52, { radius: 12 });
    const name = this.add.text(bx + 20, 30, this.bossName, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: HEX.text }).setOrigin(0, 0.5);
    const chip = addTypeChip(this, bx + 20 + name.width + 56, 30, typeNameEs(this.bossType), typeColor(this.bossType), 92, 24);
    const barX = bx + 20 + name.width + 116;
    const bar = addHpBar(this, barX, 23, bx + 860 - barX, 14);
    const objects = [box, name, ...chip, ...bar.objects];
    for (const o of objects) {
      this.hudLayer.add(o);
      if (this.hudCam) o.cameraFilter &= ~this.hudCam.id;
    }
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
    const icon = drop.kind === 'berry' ? iconKey(drop.id) : iconKey(drop.kind);
    const s = this.loot.create(x, y, icon) as Sprite;
    // Iconos de 16 px: la moneda de 5 algo más grande
    s.setScale(drop.kind === 'coin' && drop.value > 1 ? 2.6 : 2);
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
    } else if (drop.kind === 'coin') {
      const value = Math.round(drop.value * this.stats.coinMul);
      this.coins += value;
      this.mission({ kind: 'coins', amount: value });
      sfx('coin');
      this.popup(sprite.x, sprite.y - 16, `+${value}`, 0xffd34d);
    } else if (drop.kind === 'key') {
      this.keys++;
      sfx('coin');
      this.popup(sprite.x, sprite.y - 16, '+1 llave', 0xffd34d);
    } else {
      this.bombs++;
      sfx('coin');
      this.popup(sprite.x, sprite.y - 16, '+1 bomba', 0xc8c8d8);
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
    if (this.centerUsed) return this.notify('Ya te has curado en este piso', { kind: 'warning', icon: 'center' });
    if (!canHeal(this.hp, this.stats.maxHp)) return this.notify('Ya tienes todos los PS', { kind: 'warning', icon: 'center' });
    const amount = centerHeal(this.stats.maxHp);
    this.hp = healed(this.hp, this.stats.maxHp, amount);
    this.centerUsed = true;
    sfx('heal');
    this.paintCounter();
    this.popup(this.player.x, this.player.y - 50, `+${amount} PS`, CENTER_PINK);
    this.notify(`¡Centro Pokémon!\n+${amount} PS`, { kind: 'heal', icon: 'center' });
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
      const g = slot.goods;
      const iconName = g.kind === 'potion' ? (g.id === 'pocion' ? 'potion' : 'superpotion') : g.kind === 'move' ? 'disc' : 'bag';
      const icon = this.add.image(x, y, iconKey(iconName)).setScale(3).setDepth(2);
      if (g.kind === 'move') icon.setTint(color);
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
    if (res === 'poor') return this.notify(`Te faltan monedas\n(cuesta ${slot.price}, tienes ${this.coins})`, { kind: 'warning', icon: 'coin' });
    if (res === 'full') return this.notify('Ya tienes todos los PS', { kind: 'warning', icon: 'potion' });
    this.coins -= slot.price;
    sfx('buy');
    slot.sold = true;
    this.shopViews[k]?.forEach((o) => o.destroy());
    this.shopViews[k] = [];
    const g = slot.goods;
    if (g.kind === 'potion') {
      const p = POTIONS[g.id];
      this.hp = healed(this.hp, this.stats.maxHp, p.heal);
      this.notify(`${p.name}\n+${p.heal} PS`, { kind: 'heal', icon: 'potion' });
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
    // Cofre: pisarlo o Enter / A cerca lo abre si tienes llave
    const chest = this.chests.get(this.current.id);
    if (chest && !this.openedChests.has(this.current.id)) {
      const d = Phaser.Math.Distance.Between(px, py, chest.x, chest.y);
      const touching = d < TOUCH;
      if (touching && !this.chestTouch) this.openChest(this.current.id);
      this.chestTouch = touching;
      if (d < NEAR && !this.openedChests.has(this.current.id)) {
        this.prompt.setText(`Enter / A / clic: abrir (llaves: ${this.keys})`).setPosition(chest.x, chest.y - 30);
        if (act) {
          this.openChest(this.current.id);
          return padA;
        }
        return false;
      }
    }
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
    const baseEffect = statusForType(type);
    if (!baseEffect) return;
    // Sinergias (Carbón + Fuego…): el estado dura más y pega o frena más
    const boost = this.stats.statusBoost[type] ?? 1;
    const effect =
      boost === 1 || baseEffect.duration <= 0
        ? baseEffect
        : {
            ...baseEffect,
            duration: baseEffect.duration * boost,
            dpsFraction: baseEffect.dpsFraction * boost,
            slow: baseEffect.slow > 0 && baseEffect.slow < 1 ? Math.max(0.1, 1 - (1 - baseEffect.slow) * boost) : baseEffect.slow,
          };
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
    this.countDamage(e, damage);
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
    else if (ai?.phase === 2) e.setTint(0xff9a8a); // jefe enfurecido
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
    this.notify(`Ronda ${round} — ${this.biome.name}`, { kind: 'info', icon: 'pokeball' });
    this.time.delayedCall(delay, () => {
      if (this.ended || this.floorNum !== round) return;
      const { count } = waveSpec(round);
      this.spawnEnemies(count);
      this.waveActive = true;
    });
  }

  private onWaveCleared() {
    if (!this.waveActive) return;
    this.waveActive = false;
    this.chargeActive();
    sfx('clear');
    const round = this.floorNum;
    this.foeShots.clear(true, true);
    this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.healOnClear);
    const reward = waveTickets(round);
    this.earned += reward;
    addTickets(reward);
    const record = submitRecord('waves', round);
    if (record) this.counters.newRecord = true;

    let text = `¡Ronda ${round} superada! +${reward} tickets`;
    if (record) text += '\n¡Nuevo récord!';
    if (waveDropsItem(round)) {
      const i = this.interior(this.current);
      this.dropItem(this.current.id, i.cx, i.cy);
      text += '\nHa caído un objeto';
    }
    this.notify(text, { kind: 'reward', icon: 'ticket' });

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
    if (room.kind === 'challenge' && this.challengeWave > 0 && this.challengeWave < CHALLENGE_WAVES) {
      this.challengeWave++;
      this.notify(`Oleada ${this.challengeWave}/${CHALLENGE_WAVES}`, { kind: 'danger', icon: 'heart' });
      this.time.delayedCall(1000, () => this.spawnChallengeWave(room.id));
      return;
    }
    this.cleared.add(room.id);
    this.chargeActive();
    this.mission({ kind: 'room' });
    this.tip('pause');
    if (room.kind === 'boss') this.mission({ kind: 'boss' });
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
      if (record) this.counters.newRecord = true;
      if (isLastStage(this.mode, this.floorNum)) {
        if (this.mode === 'normal') this.mission({ kind: 'win' });
        this.finish(
          true,
          `¡Has completado los ${FLOOR_COUNT} pisos!\n+${this.earned} tickets en total\nPulsa R, Start o haz clic para ver el resumen`,
        );
        return;
      }
      // Como en Isaac: el jefe deja un objeto y una trampilla al piso siguiente
      const i = this.interior(room);
      this.dropItem(room.id, i.cx + 170, i.cy);
      this.spawnTrapdoor();
      const next = this.mode === 'bossrush' ? `ir al jefe ${this.floorNum + 1}` : `bajar al piso ${this.floorNum + 1}`;
      const best = record ? '\n¡Nuevo récord!' : '';
      this.notify(`¡Jefe derrotado! +${reward} tickets${best}\nPisa la trampilla para ${next}`, { kind: 'reward', icon: 'trapdoor' });
      this.saveNow();
      return;
    }

    if (room.kind === 'challenge') {
      this.challengeWave = 0;
      const i = this.interior(room);
      this.dropItem(room.id, i.cx, i.cy);
      CHALLENGE_REWARD.forEach((d, k) => this.dropLoot(i.cx + (k - 1.5) * 40, i.cy + 70, d));
      this.notify(`¡Desafío superado! +${reward} tickets\nHa caído un premio`, { kind: 'reward', icon: 'chest' });
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
      this.notify(`¡Sala limpia! +${reward} tickets\nHa caído un objeto`, { kind: 'reward', icon: 'ticket' });
    } else {
      this.notify(`¡Sala limpia! +${reward} tickets`, { kind: 'reward', icon: 'ticket' });
    }
    this.saveNow();
  }

  /** Alto de cada ranura de poder en el HUD (abajo a la derecha). */
  private slotY(i: number): number {
    return H - HUD.pad - (SLOT_COUNT - i) * 74;
  }

  /** Ranura de poder: cuadro con una franja del color del tipo; apagada mientras recarga. */
  private paintSlot(i: number, m: MovePower | null, ready: boolean) {
    const key = m ? `${m.id}:${m.name}:${ready}` : 'vacía';
    if (this.slotShown[i] === key) return;
    this.slotShown[i] = key;
    const g = this.slotBoxes[i].clear();
    const x = HUD.right.x + HUD.pad;
    const w = HUD.right.w - HUD.pad * 2;
    const y = this.slotY(i);
    drawBox(g, x, y, w, 64, { radius: 12, fillAlpha: m ? 1 : 0.5 });
    if (m) {
      g.fillStyle(typeColor(m.type), 1).fillRoundedRect(x + 12, y + 14, 10, 36, 5);
      // Ficha con el nombre del tipo sobre el borde de arriba
      g.fillStyle(0x1d2848, 1).fillRoundedRect(x + w - 98, y - 9, 92, 22, 11);
      g.fillStyle(typeColor(m.type), 1).fillRoundedRect(x + w - 96, y - 7, 88, 18, 9);
    }
    this.slotTypes[i].setText(m ? typeNameEs(m.type).toUpperCase() : '');
    const text = this.hud[i];
    if (!m) text.setText(`${i + 1}  —`).setAlpha(0.6);
    else text.setText(`${i + 1}  ${shorten(pretty(m.name), 13)}`).setAlpha(ready ? 1 : 0.4);
    g.setAlpha(ready ? 1 : 0.7);
  }

  /** Aviso en la columna derecha del HUD (T37): no tapa la sala. */
  private notify(text: string, o: ToastOptions = {}) {
    if (!this.toasts) return;
    this.toasts.show(text, o);
  }

  /** Cartel en el centro: solo para lo que para el juego (fin de partida). Ajusta su cuadro al texto. */
  private setBanner(text: string) {
    this.banner.setText(text);
    this.bannerBox.clear();
    if (!text) return;
    const w = Math.min(GAME_VIEW.w - 80, this.banner.width + 100);
    const h = this.banner.height + 60;
    drawBox(this.bannerBox, CX - w / 2, CY - h / 2, w, h, { radius: 20 });
  }

  private hurtPlayer(enemy: Sprite) {
    const now = this.time.now;
    if (this.ended || this.transitioning || now < this.invulnUntil) return;
    // Quien salta no hace daño mientras desaparece o recién aparecido
    const ai = enemy.getData('ai') as EnemyAI | undefined;
    if (ai && ai.behavior === 'hop' && ai.state !== 'walk') return;
    if (this.stats.dodge > 0 && Math.random() < this.stats.dodge) {
      this.invulnUntil = now + 500;
      this.popup(this.player.x, this.player.y - 50, '¡Esquivado!', 0xfff8c0);
      return;
    }
    if (this.shieldLeft > 0) {
      this.shieldLeft--;
      this.invulnUntil = now + 700;
      this.popup(this.player.x, this.player.y - 50, '¡Escudo!', 0x6ad0f0);
      return;
    }
    this.invulnUntil = now + 900;
    sfx('hurt');
    // Casco Dentado: quien te toca se hace daño
    if (ai && this.stats.thorns > 0 && enemy.active) {
      this.countDamage(enemy, this.stats.thorns);
      const ehp = (enemy.getData('hp') as number) - this.stats.thorns;
      enemy.setData('hp', ehp).setData('flashUntil', now + 90).setTint(0xff6666);
      if (ehp <= 0) this.time.delayedCall(0, () => enemy.active && this.killEnemy(enemy));
    }
    // Defensa y Def. Esp. reducen el daño recibido
    // Los proyectiles ya llevan el debilitamiento; el contacto lo mira ahora (Hada: −30 %)
    const weak = enemy.getData('ai') ? enemyDamageMul((enemy.getData('statuses') as ActiveStatus[] | undefined) ?? [], now) : 1;
    const taken = Math.max(1, Math.round(((enemy.getData('dmg') as number | undefined) ?? 10) * weak * this.stats.damageTaken));
    if (this.hp - taken <= 0 && this.focusLeft > 0) {
      // Banda Focus: aguanta con 1 PS
      this.focusLeft--;
      this.hp = 1;
      this.notify('¡Aguantó gracias a la Banda Focus!', { kind: 'heal', icon: 'heart' });
    } else this.hp -= taken;
    if (!this.lowHpUsed && this.stats.lowHpHeal > 0 && this.hp > 0 && this.hp < this.stats.maxHp * 0.25) {
      // Hierba Blanca: una vez por piso
      this.lowHpUsed = true;
      this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.lowHpHeal);
      this.popup(this.player.x, this.player.y - 50, `Hierba Blanca +${this.stats.lowHpHeal} PS`, 0xf0f0e0);
    }
    this.player.setTint(0xff6666);
    this.time.delayedCall(150, () => this.player.active && this.player.clearTint());

    if (this.hp <= 0) {
      const where = this.mode === 'normal' ? '' : ` en ${progressText(this.mode, this.floorNum).toLowerCase()}`;
      this.finish(false, `Has caído${where} · +${this.earned} tickets\nPulsa R, Start o haz clic para ver el resumen`);
    }
  }

  /** Fin de partida: congela el juego y deja salir con teclado (R), mando (Start / A) o ratón (clic). */
  private finish(won: boolean, message: string) {
    // Como en Isaac: al morir o ganar, la partida guardada se borra
    clearRun(this.slot);
    this.ended = true;
    this.endedAt = this.time.now;
    this.physics.pause();
    this.setBanner(message);
    // Se apunta en el historial (T28) y luego se ve el resumen
    const counts = new Map<string, number>();
    for (const id of this.passives) counts.set(id, (counts.get(id) ?? 0) + 1);
    this.lastRecord = {
      endedAt: Date.now(),
      starterId: this.starterId,
      starterName: this.starterName,
      mode: this.mode,
      floor: this.floorNum,
      won,
      seconds: Math.round(this.counters.seconds),
      kills: this.counters.kills,
      damage: Math.round(this.counters.damage),
      items: [...counts].map(([id, n]) => (passiveById(id)?.name ?? id) + (n > 1 ? ` x${n}` : '')),
      tickets: this.earned,
      newRecord: this.counters.newRecord,
    };
    addRunHistory(this.lastRecord);
    // Un momento de margen y un clic nuevo, para no saltarse la pantalla si estabas disparando; si no, va solo
    this.time.delayedCall(700, () => this.input.once('pointerdown', () => this.toSummary()));
    this.time.delayedCall(3500, () => this.toSummary());
  }

  /** Pantalla de resumen de la partida que acaba de terminar. */
  private toSummary() {
    if (!this.lastRecord || this.leavingToSummary) return;
    this.leavingToSummary = true;
    goTo(this, 'Summary', { record: this.lastRecord, slot: this.slot });
  }
}
