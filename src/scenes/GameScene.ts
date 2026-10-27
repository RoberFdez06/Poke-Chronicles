import Phaser from 'phaser';
import { fetchAbility, offlinePokemonIds, onOfflineData, usingOfflineData, fetchAttackMovesForTypes, fetchMoveInfo, fetchEvolutionsLeft, fetchNextEvolutions, fetchPokemon, fetchPokemonCard, fetchFormSprites, pickSprites } from '../data/pokeapi';
import { evolveFloors, pickEvolution, shouldEvolve } from '../data/evolution';
import { filterMovesByTypes } from '../data/moves';
import { typeColor, typeNameEs } from '../data/types';
import { GYM_PUZZLE_TICKETS, gymPuzzleKind, gymTier, hasGym } from '../level/gymPuzzles';
import { addCandies, addTickets, CANDY_PER_TICKET, earnMedal, loadCandies, loadDaily, loadDefeated, loadTickets, saveDefeated, spendCandies, spendTickets, submitSeedBest } from '../data/save';
import { buildDexIndex, registerDefeat, type DexIndex } from '../data/runDex';
import { clearRun, saveRun, DailyRun, FloorItemSave, RunSave, RUN_VERSION, SavedDrop, FLOOR_LAYOUT } from '../data/runSave';
import { dailySeed, seedFloorSeed, seedRng, streakReward } from '../data/daily';
import { encodeSeed, newSeed, type SeedRun } from '../data/seedCode';
import { damageMul, effectOf, EFFECT_COLOR, EFFECT_LABEL, rawEffectiveness } from '../data/typeChart';
import { weatherChip, weatherFor, weatherHurts, weatherPowerMul, WEATHER_DESC, WEATHER_LABEL, WEATHER_TICK_MS, type Weather } from '../data/weather';
import { WeatherFx } from '../ui/weatherFx';
import { phaseAtSeconds, phasePowerMul, pickByPhase, PHASE_DESC, PHASE_NOTICE, type Phase } from '../data/dayNight';
import { TouchControls, type TouchButton } from '../ui/touchControls';
import { touchOnlyDevice } from '../data/controls';
import { FxBudget } from '../data/fxSettings';
import {
  altarCost,
  canUseAltar,
  merchantStock,
  pickRoomEvent,
  DAILY_EVENTS,
  ROOM_EVENTS,
  planMegaStoneRoom,
  reserveSanctuaryRoom,
  megaStoneDoneKey,
  runawayTickets,
  trapChestOutcome,
  RoomEvent,
  RoomEventKind,
  ROOM_EVENT_COLOR,
  ROOM_EVENT_LABEL,
  RUNAWAY_HP_MUL,
  RUNAWAY_SECONDS,
  EGG_ROOMS,
  FOUNTAIN_TIRED_ROOMS,
  FOUNTAIN_TIRED_SPEED,
  HELPER_ATTACK_MS,
  HELPER_DAMAGE_MUL,
  rivalMemberHpMul,
  rivalTeamSize,
  rivalTrainerName,
  pickRivalTeam,
  ROOM_EVENT_DESC,
  TIME_TRIAL_SECONDS,
  eggHatch,
  eggTick,
  fountainHeal,
  fountainPrice,
  rivalBonus,
  timeTrialExtra,
  timeTrialSize,
} from '../level/roomEvents';
import { THIEF_HP_MUL, THIEF_SPEED_MUL, coinsAfterTheft, thiefCanAppear, thiefEscapeDoor, thiefEscaped, thiefRefund, thiefSteal } from '../level/thief';
import { FISH_MAX_CASTS, FISH_PRIZE_LABEL, FISH_RARE_HP_MUL, canCast, fishBiteDelay, fishCoins, fishPrize, fishRareCoins, hookResult } from '../level/fishing';
import { SLOT_BETS, SLOT_MAX_SPINS, SLOT_OUTCOME_LABEL, canSpin, spinSlot } from '../level/slotMachine';
import { applyDifficulty, scaleHeal, scaleTickets, withDifficulty, type Difficulty } from '../data/difficulty';
import { loadCollectionIndex, loadSpeciesIndex } from '../data/speciesIndex';
import { applyRegionalForms, regionalForm } from '../data/regionalForms';
import {
  bossTicketsFor,
  difficultyFor,
  pickBoss,
  roomTicketsFor,
  minibossTicketsFor,
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
import { acceptNpcMission, gainSeed, takeGardenBerries, updateGarden, addRunHistory, loadKeys, loadMissions, loadShinies, loadTutorial, loadUpgrades, recordMissionEvent, saveTutorial, submitDaily, submitRecord, loadFx } from '../data/save';
import { disableTips, markTipSeen, shouldShowTip, TIPS, type TipId } from '../data/tutorial';
import { abilityFor, pinchMul, type Ability } from '../data/abilities';
import { closeFloor, emptyCounters, floorTimes, noteParry, notePickup, noteRoomTime, openFloor, type RunCounters, type RunRecord } from '../data/runHistory';
import { ToastStack, type ToastOptions } from '../ui/toast';
import { reportError } from '../ui/errorScreen';
import { keyCode } from '../ui/keys';
import { keyLabel, type Action } from '../data/keybinds';
import { currentInput } from '../ui/inputMode';
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
  reinforceEvery,
  volleyEvery,
  volleyShots,
  biomeExtraAttacks,
  bossAttacksFor,
  hazardSpec,
  laserHits,
  MAX_HELPERS,
  MEGA_ATTACK_LABEL,
  MEGA_BLAST_WIDTH,
  megaBlastAngles,
  megaBlastSpec,
  laserSpec,
  shockwaveHits,
  shockwaveSpec,
  spiralSpec,
  BOSS_ATTACK_LABEL,
  type ExtraAttack,
  twistBehaviors,
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
import { chainBreak, chainHit, chainOdds, chainVisible, newShinyChain, rollShiny, SHINY_ENEMY, SHINY_ODDS, type ShinyChain } from '../data/shiny';
import { sparkle } from '../ui/sparkle';
import { applyUpgrades, levelsFor } from '../data/upgrades';
import { cry, playMenuMusic, playTrack, sfx } from '../ui/audio';
import { shotSfx } from '../data/sounds';
import { trackForBiome, TRACKS } from '../data/music';
import { drawHudFrame, drawSlotFrame } from '../ui/art/hud';
import { bakeProjectiles, bakeTypeFx, projKey, projMode, projRotation, statusPuff, typeImpact, typeTrail } from '../ui/art/typeFx';
import { ARENA_WARN_MS, arenaFall, arenaPhase, FALL_FADE_MS, FALL_GLOW, FALL_HAZARD, FALL_HOLD_MS, FALL_LANDING, FALL_SHAKE_MS, FALL_TINT, FALL_TOTAL_MS, FALL_WARNING, nextBossEvent, type ArenaPhase } from '../level/arenaPhase';
import { MEGA_DAMAGE_MUL, MEGA_SPEED_MUL, MEGA_WARN_MS, megaHelpersToSummon, megaInvulnerable, megaName, megaWarning, shouldMegaEvolve } from '../data/megaBoss';
import { bombExplosion, bombFuse } from '../ui/art/bombFx';
import { fallConceptFx, sacredFlame } from '../ui/art/fallArt';
import { pixRing } from '../ui/art/pixelFx';
import { arenaBackdrop, arenaChasm, arenaFallFx, fallStyleOf, arenaCrack, arenaLanding, arenaLetterbox, arenaQuake, arenaIce, arenaLava, arenaPuddle, arenaRubble, arenaWarnTile } from '../ui/art/arenaArt';
import { dynamaxBurst, teraBurst, zMoveFx } from '../ui/art/formsFx';
import { drawMegaStoneHud, drawPowerMeterFill, playerFormAura, playerMegaFx } from '../ui/art/megaFx';
import { chargedShotFx, chargeGlow } from '../ui/art/shotFx';
import { megaBlastFx, reactionChain, reactionFx } from '../ui/art/reactionFx';
import { shinyChainBadge } from '../ui/art/shinyChainArt';
import { buildClue, buildNpc, drawBallIcon } from '../ui/art/worldArt';
import { buildShopArt, type ShopArt } from '../ui/art/shopArt';
import { buildForgeArt, buildLagoonArt, buildSlotArt } from '../ui/art/eventArt';
import { ballEscape, ballShake, ballSuccess, ballThrow, dayNightLayer, megaAura, megaEvolveFx } from '../ui/art/powerFx';
import { adrenalineTrail, lootFlash, parryHit, parryStance, reviveBurst, bakeCombatFx, bossAura, evolveBurst, evolveGlow, phaseShock, clawMarks, dustBurst, cheerPlayer, damageNumber, faintBoss, faintEnemy, faintPlayer, hitSpark, muzzle, wallPop } from '../ui/art/combatFx';
import { bakeIcons, iconKey } from '../ui/art/icons';
import { bakeItemIcons, itemIconKey } from '../ui/art/itemIcons';
import { bakeBiomeTiles, bushKeyAt, shade, TILE as ART_TILE } from '../ui/art/tiles';
import { decorateRoom, drawRoomRug } from '../ui/art/roomDecor';
import { drawGlitchFigure, drawTruck, glitchFlash } from '../ui/art/easterArt';
import { buildCenterArt, type CenterArt } from '../ui/art/centerArt';
import { evolveMagikarp, GYARADOS, MAGIKARP, MAGIKARP_PRICE, MEW_CHANCE, OAK_LINE, secretVariant, sellsMagikarp } from '../data/easterEggs';
import { drawPits, drawPuddleLinks, drawShapedWalls } from '../ui/art/roomShape';
import {
  SUPPLY_CHOICES, TOWER_HAZARD_LABEL, TOWER_MINIBOSS_DMG_MUL, TOWER_MINIBOSS_HP_MUL, towerFloor, towerFloorSpec, towerGrid, towerLevel,
  upcomingRule, type TowerFloorSpec,
} from '../level/tower';
import { towerArrive, towerAscend } from '../ui/art/towerFx';
import { buildLegendLair, legendReveal } from '../ui/art/lairArt';
import { buildMegaShrine, buildStoryArt, coinsStolenFx, fishLeap, legendAura, thiefGear } from '../ui/art/storyArt';
import { buildHazards, buildLightColumn, buildSupplyStall, buildTowerAltar, buildTowerStall } from '../ui/art/towerArt';
import {
  iceVelocity, isTowerFinale, TOWER_ALTAR_COUNT, TOWER_REST_LAYOUT, TOWER_SHOP_SOLD, towerAltarItems, towerCheckpointKit, towerMinibossItem, towerShopOffer,
} from '../level/towerExtras';
import { FINALE_BONUS, GIANT_HP_MUL, GIANT_RAGE_AT, GIANT_SIZE, isFinalFloor, isFinaleGate, pickFinale, TRIO_HP_MUL, type Finale } from '../data/finale';
import type { FinalChoice } from './FinalPromptScene';
import { castPattern, setMotion, updateShots, type AttackHost, type ShootOpts, type Side } from './attacks';
import { basicShotFor, bossStyles, foeStyleFor, styleForMove, TYPE_STYLES, type Anim, type Motion, type MoveStyle } from '../data/movePatterns';
import { loadPmd, pmdAnimKey, pmdKey, PmdSheet } from '../ui/pmdSprites';
import { dir8Row, pmdScale } from '../data/pmdAnim';
import { CX, CY, DCX, DCY, GAME_VIEW, GAME_ZOOM, H, HUD, W } from '../ui/layout';
import { hudLayout, itemGrid, nameFontSize, HUD_BADGE_MAX_W, HUD_ITEM_R, HUD_PROGRESS_FONT } from '../data/hudLayout';
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
  CARRIED_POTION_HEAL,
  canCarryPotion,
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
import { canReact, consumeStatus, discover, discoveredLine, findReaction, reactionDamage, type ReactionId } from '../data/reactions';
import { comboAlive, comboBreak, comboHit, milestoneReward, newCombo, type ComboState } from '../data/combo';
import { ComboHud } from '../ui/art/comboHud';
import { addHpBar, addTypeChip, COLORS, drawBox, fadeIn, FONT, goTo, HEX, hpColor, lowFx, shorten } from '../ui/theme';
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
  RANDOM_PASSIVES,
  passiveById,
  passiveRarity,
  rollItem,
  toMovePower,
  moveRarity,
  MOVE_RARITY_COLOR,
  MOVE_RARITY_LABEL,
  UPGRADE_MAX,
  UPGRADE_STEP,
  DroppedItem,
  MovePower,
  PlayerStats,
  PassiveItem,
} from '../data/items';
import {
  canTakePassive,
  distinctPassives,
  fuse,
  fuseCost,
  fusePartners,
  fuseResult,
  itemSlots,
  recycle,
  recycleCoins,
  removePassive,
  slotsLabel,
  levelLabel, levelOf, pruneLevels, upgrade, upgradeCandidates, upgradeCost, type ItemLevels,
} from '../data/forge';
import { canAfford, describeEffects, optionLabel, pickStory, resolveChoice, type ChoiceEffects, type ChoiceState, type ChoiceStory } from '../level/choiceEvents';
import { GARDEN_BERRIES, GARDEN_HEAL, GARDEN_SHIELD, growGarden, rollSeed, SEED_CHANCE, shouldAutoHeal, useCarried, type GardenBerryId } from '../data/berries';
import { generateFloor, mulberry32, doorKey, DIRS, OPPOSITE, sameGroup, Dir, Floor, Room } from '../level/floorGen';
import { biomeBossPool, biomeById, biomeEnemyPool, biomeFor, Biome, BIOMES, pickBossWeighted, pickMixedFoes } from '../level/biomes';
import { forcedEventRng, hasRoutes, ROUTE_EVENT, routeLabel, routeMul, routeOptions, type RouteOption } from '../level/routes';
import type { RouteSceneData } from './RouteScene';
import { behaviorFor, behaviorForSpecies, enemyStats, pickFloorEnemies, EnemyBehavior, FALLBACK_ENEMIES,
  HEAL_EVERY_MS,
  HEAL_PART,
  HEAL_RANGE,
  MINE_ARM_DIST,
  MINE_FUSE_MS,
  MINE_RADIUS,
  ORBIT_RADIUS,
  ORBIT_SHOT_MS,
  SHIELD_TURN,
  absorbShieldHit,
  shieldPoolFor,
  turnToward,
} from '../data/enemies';
import { drawMinimap } from './minimap';
import { cancelCharge, chargedShapeFor, chargeProgress, CHARGE_DAMAGE_MUL, CHARGE_MOVE_MUL, CHARGE_SOURCES, isCharging, newCharge, stepCharge, type ChargeSource, type ChargeState } from '../data/charge.ts';
import { newParry, parryCooldownLeft, pressParry, takeCounterCrit, tryParry, PARRY_GRACE_MS, type ParryState } from '../data/parry';
import { clampToBounds, launchLoot, magnetRadius, restingLoot, scatterTarget, stepLoot, type Bounds as LootBounds, type LootBody } from '../data/lootMotion';
import { openConfirm } from './ConfirmScene';
import { confirmText } from '../data/confirm';
import { adrenalineActive, adrenalineDamageMul, adrenalineFill, adrenalineFull, adrenalineSpeedMul, fillAdrenaline, gainAdrenaline, spendAdrenaline, newAdrenaline, tickAdrenaline, touchAdrenaline, type AdrenalineSource, type AdrenalineState } from '../data/adrenaline';
import { MEGA_STONE_ID, MEGA_BLOCK_TEXT, megaBlock, megaDisplayName, megaFormName, megaOffered, newPowerFormState, POWER_FORMS, powerFormActive, powerFormDamageMul, powerFormFill, powerFormFromSave, powerFormMaxHpBonus, powerFormSpeedMul, powerFormToSave, startPowerForm, tickPowerForm, type PowerFormState, absorbWithShield, gmaxFormName, pickPower, pickTeraType, resolveTeraType, TERA_TYPES, TERA_GEM_ID, POWER_BLOCK_TEXT, powerCost, powerFormSizeMul, powerFormTeraType, useZMove, Z_MOVE_DAMAGE_MUL, type PowerChoice, type PowerContext } from '../data/powerForm';
import { meterOnDamage, meterOnParry, newPowerMeter, powerMeterFill, spendPowerMeter, tickPowerMeter, type PowerMeterState } from '../data/powerMeter';
import {
  canCaptureLegend, CLUE_NAMES, clueOnFloor, finishLair, HUNT, huntText, lairOnFloor, leaveFloor, legendCaptureChance, legendPhase,
  noHunt, pickHuntRoom, rollHunt, takeClue, type LegendHunt,
} from '../data/legendHunt';
import { unlockPokemon } from '../data/save';
import { canCapture, canThrow, CAPTURE_RANGE, CAPTURE_RETRY_MS, newCaptureState, nextFloorCapture, resolveThrow, rollCapture, type CaptureState } from '../data/capture';
import { DARK_RADIUS, darkEdge, oneTypeFor, pickRoomRules, ROOM_RULE_COLOR, ruleDamageMul, ruleNotice, shouldMultiply, speedRoomBonus, MULTIPLY_HP, MULTIPLY_SIZE, SPEED_ROOM_MUL, type RoomRule } from '../level/roomRules';
import { canOfferRevive, reviveCost, revivedHp, REVIVE_IMMUNE_MS } from '../data/secondChance';
import type { SecondChanceChoice } from './SecondChanceScene';
import { accountInfo } from '../net/cloud';

const FALL_LOOK_MS = 500; // pausa tras aterrizar en la arena nueva (nadie se mueve ni recibe daño)

// Cada sala ocupa una pantalla del mundo; ROOM es su interior relativo a la celda
const VIEW = { w: 960, h: 640 };
const ROOM = { x: 80, y: 80, w: 800, h: 480 };
/** T72: marcas en eventsDone del descanso de la Torre (lejos de las salas y de MEGA_STONE_DONE_BASE). */
const TOWER_ALTAR_DONE = 200000;
/** Suministros de la Torre ya elegidos en este piso. */
const TOWER_SUPPLY_DONE = 200005;
const WALL = 40;
/** Radio máximo del cuerpo del jugador (px): menos de media casilla, para caber por pasillos de una casilla. */
const PLAYER_BODY_R = 16;
const DOOR = 120;
const SLOT_COUNT = 4;
/** Separación en radianes entre los proyectiles de un abanico. */
const SPREAD = 0.2;

const DOOR_COLOR = 0x8a5a3c;
/** Árbol pequeño de Corte (10x10, 4 px por píxel) y roca de Golpe Roca: tapan las puertas de las salas cerradas. */
const CUT_TREE = [
  '...kkkk...', '..kGGGGk..', '.kGgGGgGk.', 'kGGGgGGGGk', 'kGgGGGgGGk',
  '.kGGgGGGk.', '..kkbbkk..', '....bb....', '...kbbk...', '..kkkkkk..',
];
const CUT_TREE_PAL: Record<string, number> = { k: 0x1d3a1a, G: 0x58b848, g: 0x2f7a2a, b: 0x7a4a24 };
const SMASH_ROCK = [
  '...kkkk...', '..kRRRRk..', '.kRWRRrRk.', 'kRWRRRrRRk', 'kRRRrrRRrk',
  'kRRrRRRrRk', 'krRRRRrRRk', 'kRrRRRRrrk', '.krrrrrrk.', '..kkkkkk..',
];
const SMASH_ROCK_PAL: Record<string, number> = { k: 0x2a2a30, R: 0x9a8a7a, r: 0x6e6052, W: 0xd8ccb8 };
/** Probabilidad de que un enemigo salga élite: nada en el piso 1 y cada piso más (hasta la mitad). */
const eliteChance = (level: number) => Math.min(0.5, Math.max(0, (level - 1) * 0.1));

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
/** T49: posición (desde el borde izquierdo de la franja) de los contadores de monedas, llaves, bombas y pociones. */
/** Panel izquierdo del HUD: posiciones de cada pieza (data/hudLayout.ts, con tests para que nada se pise). */
const HL = hudLayout(HUD.left.w - HUD.pad * 2);
const HUD_COUNT_X = HL.counterX;
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
  'floor' | 'bossHistory' | 'hp' | 'passives' | 'slots' | 'nextSlotReplace' | 'movePool' | 'earned' | 'coins' | 'formId' | 'keys' | 'bombs' | 'active' | 'healed' | 'counters' | 'hpSacrificed' | 'eggLeft' | 'allyId' | 'tiredRooms' | 'potions' | 'secondChance' | 'bossesBeaten' | 'powerMeter' | 'zUsed' | 'reactionsFound' | 'storiesSeen' | 'route' | 'routesTaken' | 'gardenBerries' | 'legendHunt'
> & Partial<Pick<RunSave, 'itemLevels' | 'teraPick'>>;

/** Secuencias de azar del desafío diario (ver GameScene.rng). */
const RNG = { rooms: 0, boss: 1, items: 2, chest: 3, shop: 4, clear: 5 } as const;

export interface GameData {
  starterId?: number;
  slot?: number;
  mode?: GameMode;
  resume?: RunSave;
  carry?: FloorCarry;
  /** Desafío diario (T34): lo decide ModeScene al empezar y pasa de piso en piso. */
  daily?: DailyRun | null;
  /** Fácil, Normal o Difícil (T40); el desafío diario siempre es Normal. */
  difficulty?: Difficulty;
  /** T81: semilla de la partida (de un código o nueva); pasa de piso en piso. Si falta en una partida nueva se crea. */
  seeded?: SeedRun | null;
  /** T72: piso de la Torre desde el que se empieza (punto de control elegido en ModeScene). */
  towerStart?: number;
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
  /** Nombre en español (minijefes). */
  name?: string;
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
  /** Movimientos de su tipo (jefes, catálogo de ataques). */
  moves?: MoveStyle[];
  /** Élite (pisos altos): ataque extra de su tipo cada poco. */
  eliteMove?: MoveStyle;
  eliteAt?: number;
  nextAttack?: number;
  lastAttack?: BossAttack;
  phase?: 1 | 2;
  /** T51: hacia dónde mira el escudado (rad). */
  facing?: number;
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
  /** Tipo para el dibujo del proyectil (si no, el de `status`; si tampoco, normal). */
  type?: string;
  /** Movimiento y animación (catálogo de ataques). */
  motion?: Motion;
  anim?: Anim;
  /** Estalla con este radio al chocar o al acabar. */
  explode?: number;
  /** Desde dónde sale (si no, el jugador). */
  from?: { x: number; y: number };
  /** Sin estela (chorros: ya son muchas partículas). */
  noTrail?: boolean;
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
  /** Empujón al recibir un golpe: hasta entonces el movimiento no pisa la velocidad. */
  private playerKnockUntil = 0;
  /** Lo que el motor de ataques (attacks.ts) necesita de la partida. */
  private host!: AttackHost;
  /** Cayendo por la trampilla (la animación mueve al jugador; dressSprites no lo toca). */
  private falling = false;
  /** Cartel de piso en pantalla: la intro del jefe espera a que acabe. */
  private floorIntroOn = false;
  /** Reto final (piso 6 de Normal): trío o gigante y los datos de cada miembro. */
  private finale?: Finale;
  private finaleMembers: { id: number; name: string; types: string[]; stats: BaseStats; key: string }[] = [];
  /** Ayudantes que invocan los jefes: de su tipo. */
  private summonKinds: FoeKind[] = [];
  /** Sala del minijefe de este piso (si hay). */
  private minibossRoom?: number;
  /** Curación por golpes (Drenar, Concha Campana): tope por segundo y una vez por lanzamiento. */
  private healBudget = 0;
  private drainReadyAt = 0;
  /** Reacciones de tipo descubiertas en esta partida (T76). */
  private reactionsFound: ReactionId[] = [];
  /** Destello rojo sobre la sala al recibir daño (capa del HUD). */
  private hurtFlash?: Phaser.GameObjects.Rectangle;
  /** Tienes shiny al Pokémon elegido: juegas con su sprite shiny (también al evolucionar). */
  private shiny = false;
  /** Te has curado en esta partida (misiones "sin curarte"); hpMark = PS del fotograma anterior (-1 = sin medir). */
  private healedRun = false;
  /** Registro de la partida al terminar (para el resumen). */
  private lastRecord?: RunRecord;
  private leavingToSummary = false;
  /** Tiempo, enemigos vencidos, daño hecho y récord de la partida (para el resumen, T28). */
  private counters: RunCounters = emptyCounters();
  /** T62: segundo de partida al entrar en la sala (para la sala más rápida; el del piso va en los contadores). */
  private roomStartSec = 0;
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
  /** Desafío diario (null = partida normal) y el azar fijo de cada cosa del piso (ver rng). */
  private daily: DailyRun | null = null;
  /** T81: semilla de la partida (pisos, salas, jefes y objetos salen de ella) y si se empezó con un código. */
  private seeded: SeedRun | null = null;
  private dailyRngs = new Map<number, () => number>();
  private diff: Difficulty = 'normal';
  /** Clima del piso (T38) y su efecto visual; la arena y el granizo hacen daño cada WEATHER_TICK_MS. */
  private weather: Weather | null = null;
  private combo: ComboState = newCombo();
  private comboHud?: ComboHud;
  /** T84: cadena shiny (misma especie seguida). No cuenta en el desafío diario. */
  private shinyChain: ShinyChain = newShinyChain();
  private shinyChainHud?: Phaser.GameObjects.Text;
  private weatherFx?: WeatherFx;
  private weatherTickAt = 0;
  /** Día o noche (T67), según el tiempo jugado; null hasta el primer fotograma (así al continuar no avisa). */
  private phase: Phase | null = null;
  private nightLayer?: ReturnType<typeof dayNightLayer>;
  /** Tipos del Pokémon del jugador (cambian al evolucionar). */
  private playerTypes: string[] = ['normal'];
  /** Joysticks y botones táctiles (T35): solo en móvil o tableta. */
  private touch?: TouchControls;
  /**
   * Rendimiento (T41): lo que se dibujó al construir cada sala. La cámara solo pinta la sala en la que estás (y la
   * siguiente mientras pasas la puerta); antes pintaba todas las del piso cada fotograma.
   */
  private roomObjs = new Map<number, Phaser.GameObjects.GameObject[]>();
  /** Tope de partículas por momento (con efectos bajos, ninguna) y contador de FPS (Ajustes). */
  private fxBudget = new FxBudget();
  private fpsText?: Phaser.GameObjects.Text;
  /** Sala sorpresa del piso (T39), las ya resueltas y los PS máximos dados en altares (toda la partida). */
  private roomEvent: RoomEvent | null = null;
  private eventsDone = new Set<number>();
  /** Sala del Santuario de la Mega Piedra de este piso (se calcula al cargarlo; lo cogido va en eventsDone). */
  private megaRoomId: number | undefined;
  private hpSacrificed = 0;
  /** T57: la segunda oportunidad («Una más») ya se usó en esta partida (pasa de piso a piso y se guarda). */
  private secondChanceUsed = false;
  /** T56: reglas de sala del piso (sala → regla) y la oscuridad de la sala a oscuras mientras dura. */
  private roomRules = new Map<number, RoomRule>();
  /** T63: registro de combate. `dexIndex` llega cuando carga la lista de especies; `dexDefeated` es lo guardado hasta ahora. */
  private dexIndex?: DexIndex;
  private dexDefeated = new Set<number>();
  private darkness?: { hole: Phaser.GameObjects.Image; sides: Phaser.GameObjects.Rectangle[]; eyes: Phaser.GameObjects.Graphics };
  /** T48: oleada del entrenador rival (0 = no hay), sala del tiempo en marcha, huevo, ayudante y cansancio. */
  private rivalWave = 0;
  /** T59: cuántos Pokémon tiene el entrenador rival y cómo se llama. */
  private rivalTeam = 0;
  private rivalName = '';
  /** Especies del equipo del rival, en el orden en que salen (del piso y su bioma; ver pickRivalTeam). */
  private rivalKinds: FoeKind[] = [];
  private timeTrial?: { roomId: number; until: number; failed: boolean; label: Phaser.GameObjects.Text };
  private eggLeft = 0;
  private allyId = 0;
  private ally?: { sprite: Sprite; type: string; nextAt: number };
  /** T65: captura del piso (una por piso, espera tras fallar) y la Poké Ball del HUD; `capturing` = hay una en el aire. */
  private capture: CaptureState = newCaptureState();
  private capturing = false;
  private ballKey!: Key;
  private r3Prev = false;
  private ballHud?: { g: Phaser.GameObjects.Graphics; x: number; y: number; shown: string };
  /**
   * T74: forma de poder (megaevolución). El tiempo avanza con `game.loop.time` (no con Clock.now) y se recorta el paso,
   * así la pausa no la gasta. `megaKey` = textura de la forma mega cargada (null = sin sprite: el normal con brillo).
   */
  private powerForm: PowerFormState = newPowerFormState();
  private powerFormLoopAt = 0;
  private megaPulseAt = 0;
  private megaKey: string | null = null;
  /** T75: medidor de poder (Dinamax, Tera, Z), si ya se usó el Cristal Z y su barra del HUD. */
  private powerMeter: PowerMeterState = newPowerMeter();
  private zUsed = false;
  /** T79: historias con decisiones ya vistas en la partida (cada una sale una vez). */
  private storiesSeen: string[] = [];
  /** T80: ruta por la que se ha llegado a este piso (null = la de siempre) y las elegidas en la partida. */
  private route: RouteOption | null = null;
  private routesTaken: RouteOption[] = [];
  private powerMeterHud?: { g: Phaser.GameObjects.Graphics; x: number; y: number; w: number; h: number; shown: string };
  private megaGlowAt = 0;
  private megaInputKey!: Key;
  private dpadUpPrev = false;
  private megaHud?: { g: Phaser.GameObjects.Graphics; x: number; y: number; shown: string };
  private megaZone?: Phaser.GameObjects.Zone;
  private tiredRooms = 0;
  /** Lo dibujado del evento de la sala actual y los sitios donde se usa con Enter / A / clic. */
  private eventObjs: Phaser.GameObjects.GameObject[] = [];
  /** T68: tiradas hechas en cada sala de juegos del piso (sala -> tiradas). */
  private slotSpins = new Map<number, number>();
  /** T69: lanzamientos hechos en cada laguna y la caña echada (cuándo pica; `token` invalida los avisos viejos). */
  private fishCasts = new Map<number, number>();
  private fishLine?: { roomId: number; biteAt: number; token: number };
  private eventSpots: { x: number; y: number; prompt: () => string; use: () => void }[] = [];
  /** Pokémon raro que huye: hasta cuándo se queda y su cuenta atrás. */
  private runaway?: { sprite: Sprite; until: number; label: Phaser.GameObjects.Text; name: string };
  /** T70: ladrón de la sala sorpresa (puerta a la que huye y monedas que lleva robadas). */
  private thief?: { sprite: Sprite; door: { x: number; y: number }; stolen: number; label: Phaser.GameObjects.Text };
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
  private trapdoor?: { x: number; y: number; armed: boolean; final?: boolean };
  /** T72: cómo es el piso actual de la Torre (solo en ese modo) y la semilla de toda la subida. */
  private towerSpec?: TowerFloorSpec;
  private towerSeed = 0;
  private towerStart = 1;
  /** T72: dibujo y puntos de uso de la tienda y el altar del descanso (aparte de los de la forja). */
  private towerRestObjs: Phaser.GameObjects.GameObject[] = [];
  /** T72: dibujo de la tienda del descanso (se rehace si coges algo que vendía) y la clave de lo que enseña. */
  private towerShopObjs: Phaser.GameObjects.GameObject[] = [];
  private towerShopKey = '';
  private towerRestSpots: { x: number; y: number; prompt: () => string; use: () => void }[] = [];
  private hazardTickAt = 0;
  /** T78: arena del jefe. Fase ya aplicada, aviso en curso y casillas con grietas (daño) de la sala del jefe. */
  private arenaDone: 0 | 1 | 2 = 0;
  private arenaWarn?: { at: number; roomId: number; phase: ArenaPhase; marks: Phaser.GameObjects.GameObject[] };
  /** Casillas que queman al pisarlas ("sala:x,y"): grietas de la fase 1 (poco) y lava de la fase 2 (más). */
  private arenaCracks = new Map<string, 'grieta' | 'lava'>();
  /** Casillas de hielo de la fase 2 ("sala:x,y"): resbalan. */
  private arenaIce = new Set<string>();
  private arenaTickAt = 0;
  /** Hasta cuándo dura el último suceso del jefe (fase de arena o megaevolución): el siguiente espera EVENT_GAP_MS. */
  private bossBusyUntil: number | undefined;
  /** Derrumbe de la fase 2 en marcha: jugador y jefes invulnerables (se guarda la vida de cada jefe al empezar). */
  private arenaFallAt: number | undefined;
  /** Dibujos de la arena (fase 1 y 2) y obstáculos de cada sala, para poder quitarlos al caer a la arena nueva. */
  private arenaObjs: Phaser.GameObjects.GameObject[] = [];
  private obstacleObjs = new Map<number, Phaser.GameObjects.GameObject[]>();
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
  private lastShotAt = -1e9;
  /** Ranura que has elegido en la pantalla de cambio (la usa gainItem una sola vez). */
  private chosenSlot?: number;
  private swapOpen = false;
  /** T73: jefes vencidos (dan huecos de objeto) y la lista de elegir objeto (huecos llenos o forja) abierta. */
  private bossesBeaten = 0;
  /** T73: niveles de «mejorar» de la forja por objeto y tipo Tera elegido a mano (null = automático). */
  private itemLevels: ItemLevels = {};
  private teraPick: string | null = null;
  private itemChoiceOpen = false;
  private itemChoiceCooldownUntil = 0;
  /** Confirmación de compra abierta, y hora real hasta la que no se reabre (que un Enter o clic de más no la repita). */
  private confirmOpen = false;
  private confirmCooldownUntil = 0;
  private swapCooldownUntil = 0;
  /** Tras coger un activo, 1 s sin poder coger otro (si no, el que sueltas y el nuevo se intercambian sin parar). */
  private activeSwapUntil = 0;
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
  /** T87: en este piso ya ha ofrecido encargo un NPC (uno por piso, en el Centro Pokémon o la tienda). */
  private npcOffered = false;
  private shop: ShopSlot[] = [];
  private layout = FLOOR_LAYOUT;
  private loot!: Phaser.Physics.Arcade.Group;
  private counter?: { x: number; y: number; art: CenterArt };
  private shopViews: Phaser.GameObjects.GameObject[][] = [];
  private shopArt?: ShopArt;
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
  /** T49: pociones que llevas, su tecla, el stick izquierdo pulsado (L3) del fotograma anterior y su contador. */
  private potions = 0;
  /** T85: bayas del huerto que llevas (se usan solas, ver berries.ts). */
  private gardenBerries: GardenBerryId[] = [];
  /** T88: cacería legendaria (rastro de pistas por pisos y sala del legendario). */
  private hunt: LegendHunt = noHunt();
  /** T88: especie del legendario si este piso tiene su sala, y lo dibujado de la pista o la guarida. */
  private legendKind?: FoeKind;
  private huntObjs: Phaser.GameObjects.GameObject[] = [];
  private potionKey!: Key;
  private l3Prev = false;
  private potionsHud?: Phaser.GameObjects.Text;
  /** T53: parry (ventana, recarga y crítico pendiente), su tecla y su cuadro del HUD con la recarga. */
  private parry: ParryState = newParry();
  /** T77: carga del disparo cargado, una por fuente (teclado, ratón, mando). Es una entrada propia, no el disparo normal. */
  private charges: Record<ChargeSource, ChargeState> = this.newCharges();
  private chargeKey!: Key;
  private parryKey!: Key;
  private parryHud?: { g: Phaser.GameObjects.Graphics; x: number; y: number; w: number; h: number; shown: string };
  /** T55: adrenalina (sube con bajas, esquivas y parrys) y su barra del HUD. */
  private adrenaline: AdrenalineState = newAdrenaline();
  /** Cuándo toca la siguiente brasa de la adrenalina (reloj de la escena). */
  private adrenalineTrailAt = 0;
  private adrenalineHud?: { g: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; x: number; y: number; w: number; h: number; shown: string };
  /** Multiplicador de daño mientras dura Ataque X o el Caramelo Raro. */
  private buffMul = 1;
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
  private bossBar?: { boss: Sprite; bar: ReturnType<typeof addHpBar>; objects: Phaser.GameObjects.GameObject[]; group?: Sprite[]; shield?: { g: Phaser.GameObjects.Graphics; x: number; w: number } };
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
  /** Iconos de los objetos pasivos en el HUD. */
  private invIcons: Phaser.GameObjects.GameObject[] = [];
  private activeIcon?: Phaser.GameObjects.Image;
  /** Fondo de cada ranura de poder y lo que muestra (para no redibujarlo en cada fotograma). */
  private slotBoxes: Phaser.GameObjects.Graphics[] = [];
  private slotShown: string[] = [];
  /** Nombre del tipo de cada poder (Volador y Veneno se confundían solo por el color). */
  private slotTypes: Phaser.GameObjects.Text[] = [];
  /** Botón con el que se lanza cada poder (tecla o botón del mando, según con qué juegues). */
  private slotBadges: Phaser.GameObjects.Text[] = [];
  /** Botón de la bomba, la poción y el objeto activo (tecla o botón del mando), junto a cada uno en el HUD. */
  private actionBadges: { g: Phaser.GameObjects.Graphics; t: Phaser.GameObjects.Text; x: number; y: number; pad: string; action: 'active' | 'bomb' | 'potion' | 'parry' | 'ball' | 'mega'; maxW: number }[] = [];
  private badgeShown = '';
  private banner!: Phaser.GameObjects.Text;
  private toasts?: ToastStack;
  /** Quita el aviso de "sin conexión" al salir de la escena. */
  private offlineOff?: () => void;
  private static offlineNotified = false;
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
    this.falling = false;
    this.shiny = loadShinies().includes(this.starterId);
    this.mode = this.resume?.mode ?? data?.mode ?? 'normal';
    this.daily = this.resume ? this.resume.daily : (data?.daily ?? null);
    // T81: el diario usa la semilla del día; una partida nueva sin código, una semilla nueva (las v24 cargadas no tienen)
    this.seeded = this.resume ? this.resume.seeded : (data?.seeded ?? (data?.carry ? null : { seed: newSeed(), fromCode: false }));
    if (this.daily) this.seeded = { seed: dailySeed(this.daily.day), fromCode: false };
    this.dailyRngs.clear();
    // T84: la cadena shiny sigue entre pisos de la misma partida; una partida nueva o cargada empieza de cero
    if (!data?.carry || this.resume) this.shinyChain = newShinyChain();
    this.diff = this.resume ? this.resume.difficulty : (data?.difficulty ?? 'normal');
    this.towerStart = !this.resume && !data?.carry && this.mode === 'tower' ? Math.max(1, Math.floor(data?.towerStart ?? 1)) : 1;
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
    this.parry = newParry();
    this.charges = this.newCharges();
    this.parryHud = undefined;
    this.adrenaline = newAdrenaline();
    this.adrenalineHud = undefined;
    this.dexIndex = undefined;
    this.dexDefeated = new Set(loadDefeated());
    loadCollectionIndex().then((ix) => void (this.dexIndex = buildDexIndex(ix))).catch(() => undefined);
    this.darkness = undefined;
    this.nightLayer = undefined;
    this.roomRules = new Map();
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
    this.npcOffered = false;
    this.shop = [];
    this.layout = FLOOR_LAYOUT;
    this.counter?.art.destroy();
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
    this.slotBadges = [];
    this.actionBadges = [];
    this.badgeShown = '';
    this.floorItems = [];
    this.doorMap.clear();
    this.visited.clear();
    this.cleared.clear();
    this.trapdoor = undefined;
    this.invIcons = [];
    this.activeIcon = undefined;
    this.finale = undefined;
    this.finaleMembers = [];
    this.summonKinds = [];
    this.minibossRoom = undefined;
    this.healBudget = 0;
    this.drainReadyAt = 0;
    this.reactionsFound = [];
    this.floorNum = 1;
    this.ability = null;
    this.healedRun = false;
    this.counters = emptyCounters();
    this.roomStartSec = 0;
    this.lastRecord = undefined;
    this.leavingToSummary = false;
    this.hpMark = -1;
    this.tipQueue = [];
    this.tipObjects = [];
    this.tipTimer = undefined;
    this.bossHistory = [];
    // T72: punto de control de la Torre (partida nueva)
    if (this.towerStart > 1) this.floorNum = this.towerStart;
    const c = this.carry;
    if (c) {
      // Bajas al piso siguiente con tus objetos, poderes y PS
      this.floorNum = c.floor;
      this.bossHistory = [...c.bossHistory];
      // Easter egg: Magikarp evoluciona en Gyarados al bajar de piso
      const karp = evolveMagikarp(c.passives);
      this.passives = karp.passives;
      if (karp.evolved) {
        this.time.delayedCall(2800, () => {
          if (this.ended) return;
          sfx('evolve');
          this.notify('¿Eh? ¡Magikarp está evolucionando!\n¡Tu Magikarp ha evolucionado en Gyarados!', { kind: 'reward', icon: 'star' });
        });
      }
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
    // Efectos bajos (T41): sin partículas decorativas ni temblores de cámara
    const fx = loadFx();
    this.fxBudget = new FxBudget(fx.low);
    const mainCam = this.cameras.main as Phaser.Cameras.Scene2D.Camera & { shake: Phaser.Cameras.Scene2D.Camera['shake'] };
    if (fx.low) mainCam.shake = (() => mainCam) as typeof mainCam.shake;
    else delete (mainCam as Partial<typeof mainCam>).shake;
    this.fpsText = undefined;
    fadeIn(this);

    const loading = this.add
      .text(480, 320, 'Cargando Pokémon…', { fontFamily: FONT, fontSize: '28px', color: '#ffffff' })
      .setOrigin(0.5);

    this.boot(loading).catch((err) => {
      loading.setText('');
      reportError(this.game, err);
    });
  }

  private async boot(loading: Phaser.GameObjects.Text) {
    const r = this.resume;
    this.hpSacrificed = r?.hpSacrificed ?? this.carry?.hpSacrificed ?? 0;
    this.secondChanceUsed = r?.secondChance ?? this.carry?.secondChance ?? false;
    this.bossesBeaten = r?.bossesBeaten ?? this.carry?.bossesBeaten ?? 0;
    this.itemChoiceOpen = false;
    this.confirmOpen = false;
    this.eventsDone = new Set(r?.eventsDone ?? []);
    this.slotSpins = new Map(r?.slotSpins ?? []);
    this.fishCasts = new Map(r?.fishCasts ?? []);
    this.fishLine = undefined;
    this.eventObjs = [];
    this.eventSpots = [];
    this.huntObjs = [];
    this.visitedHuntStart = false;
    this.legendKind = undefined;
    this.runaway = undefined;
    this.rivalWave = 0;
    this.timeTrial = undefined;
    this.ally = undefined;
    this.eggLeft = r?.eggLeft ?? this.carry?.eggLeft ?? 0;
    this.allyId = r?.allyId ?? this.carry?.allyId ?? 0;
    // T65: al continuar, lo guardado; en un piso nuevo, la captura recargada (el aliado capturado ya se quitó al bajar)
    this.capture = r ? { ...newCaptureState(), done: r.captureDone, prevAllyId: r.capturePrevAlly >= 0 ? r.capturePrevAlly : null } : newCaptureState();
    this.capturing = false;
    this.r3Prev = false;
    // T74: al continuar, la forma de poder tal cual (lo que le quedaba); en un piso nuevo, recargada y sin forma
    this.powerForm = r ? powerFormFromSave(r.powerForm) : newPowerFormState();
    this.powerFormLoopAt = this.game.loop.time;
    // T75: el medidor y el Z son de toda la partida (pasan de piso)
    this.powerMeter = newPowerMeter(r?.powerMeter ?? this.carry?.powerMeter ?? 0);
    this.zUsed = r?.zUsed ?? this.carry?.zUsed ?? false;
    // T76: las reacciones descubiertas son de toda la partida (se guardan y pasan de piso)
    this.reactionsFound = [...(r?.reactionsFound ?? this.carry?.reactionsFound ?? [])];
    this.storiesSeen = [...(r?.storiesSeen ?? this.carry?.storiesSeen ?? [])];
    this.route = r ? r.route : (this.carry?.route ?? null);
    this.routesTaken = [...(r?.routesTaken ?? this.carry?.routesTaken ?? [])];
    this.powerMeterHud = undefined;
    this.megaPulseAt = 0;
    this.megaKey = null;
    this.megaGlowAt = 0;
    this.dpadUpPrev = false;
    this.megaHud = undefined;
    this.megaZone = undefined;
    this.tiredRooms = r?.tiredRooms ?? this.carry?.tiredRooms ?? 0;
    this.potions = r?.potions ?? this.carry?.potions ?? 0;
    // T85: al empezar partida (no al bajar de piso ni al continuar) te llevas bayas de la cesta del huerto
    this.gardenBerries = r ? [...r.gardenBerries] : this.carry ? [...this.carry.gardenBerries] : this.codeRun ? [] : takeGardenBerries();
    if (!r && !this.carry && this.gardenBerries.length > 0) {
      const names = this.gardenBerries.map((b) => GARDEN_BERRIES[b].name).join(', ');
      this.time.delayedCall(1500, () => !this.ended && this.notify(`Del huerto llevas:\n${names}`, { kind: 'reward', icon: 'heart' }));
    }
    this.buffMul = 1;
    if (r) {
      this.floorNum = r.floor;
      this.bossHistory = [...r.bossHistory];
    }
    this.waveActive = false;
    this.difficulty = applyDifficulty(difficultyFor(this.level()), this.diff);
    this.biome = biomeFor(this.mode, this.mode === 'waves' ? this.level() : this.floorNum);
    // T80: la ruta elegida cambia el bioma y endurece a los enemigos (vida y daño)
    if (this.route && (this.mode === 'normal' || this.mode === 'endless')) {
      const m = routeMul(this.route);
      this.difficulty = { ...this.difficulty, hp: this.difficulty.hp * m, damage: this.difficulty.damage * m };
      this.biome = biomeById(this.route.biomeId);
    }
    this.towerSpec = undefined;
    this.towerRestObjs = [];
    this.towerShopObjs = [];
    this.towerShopKey = '';
    this.towerRestSpots = [];
    this.hazardTickAt = 0;
    this.arenaDone = 0;
    this.arenaWarn = undefined;
    this.arenaCracks = new Map();
    this.arenaIce = new Set();
    this.arenaTickAt = 0;
    this.bossBusyUntil = undefined;
    this.arenaFallAt = undefined;
    this.arenaObjs = [];
    this.obstacleObjs = new Map();
    // Al continuar, el piso se regenera igual con la misma semilla; cada piso nuevo es más grande.
    // Oleadas y Rush de jefes se juegan en una sola sala
    this.floorSeed = r?.floorSeed ?? (this.seeded ? seedFloorSeed(this.seeded.seed, this.floorNum) : Phaser.Math.Between(0, 0x7fffffff));
    if (this.mode === 'tower') {
      // T72: la semilla de la subida es la misma en todos los pisos (así no se repiten forma, plantilla ni regla seguidas);
      // la del piso se saca de ella y del número, y al continuar se recupera deshaciendo la mezcla (no cambia RunSave)
      const mix = Math.imul(this.floorNum, 0x9e3779b1) >>> 0;
      if (r) this.towerSeed = (r.floorSeed ^ mix) >>> 0;
      else if (!this.carry || this.towerSeed === 0) this.towerSeed = this.seeded ? seedFloorSeed(this.seeded.seed, 0) || 1 : Phaser.Math.Between(1, 0x7fffffff);
      if (!r) this.floorSeed = (this.towerSeed ^ mix) >>> 0;
      this.towerSpec = towerFloorSpec(this.floorNum, this.towerSeed);
      // T72: empezar desde un punto de control: huecos de los jefes saltados y un lote de objetos (con tope)
      if (!r && !this.carry && this.towerStart > 1 && this.floorNum === this.towerStart) {
        const kit = towerCheckpointKit(this.towerStart, mulberry32(this.towerSeed ^ 0x6d2b79f5), this.passivePool());
        this.bossesBeaten = kit.bosses;
        this.passives = [...this.passives, ...kit.passives];
        this.coins += kit.coins;
        this.potions += kit.potions;
        if (kit.passives.length > 0) this.time.delayedCall(1500, () => !this.ended && this.notify(`Punto de control: piso ${this.towerStart}\n+${kit.passives.length} objetos, +${kit.coins} monedas y huecos de ${kit.bosses} jefes`, { kind: 'reward', icon: 'bag' }));
      }
      this.biome = this.towerSpec.biome;
      this.floor = towerFloor(this.towerSpec, this.floorSeed);
    } else if (this.mode === 'waves') this.floor = arenaFloor(this.floorSeed, 'combat');
    else if (this.mode === 'bossrush' || isFinalFloor(this.mode, this.floorNum)) this.floor = arenaFloor(this.floorSeed, 'boss');
    else {
      this.layout = r?.layout ?? FLOOR_LAYOUT;
      this.floor = generateFloor({
        seed: this.floorSeed,
        roomCount: r?.roomCount ?? roomCountFor(this.floorNum, this.rng(RNG.rooms)),
        special: this.layout >= 2,
        extra: this.layout >= 3,
        big: this.layout >= 4,
      });
      // Santuario obligatorio: si el piso no tiene sala normal para él, una sala de cofre pasa a ser normal
      this.floor = reserveSanctuaryRoom(this.floor);
    }
    this.weather =
      (this.mode === 'normal' || this.mode === 'endless') && !isFinalFloor(this.mode, this.floorNum)
        ? weatherFor(this.biome.id, this.floorNum, mulberry32(this.floorSeed ^ 0x3c6ef372))
        : null;
    this.weatherFx = undefined;
    this.weatherTickAt = 0;
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
    // Sin conexión (T42): enemigos y jefe de entre los que hay guardados, para que tengan sus sprites
    const bundled = usingOfflineData() || navigator.onLine === false ? await offlinePokemonIds() : null;
    const onlyBundled = (ids: number[]) => {
      const kept = bundled ? ids.filter((id) => bundled.has(id)) : ids;
      return kept.length > 0 ? kept : ids;
    };
    let bossId = r?.bossId;
    if (isFinalFloor(this.mode, this.floorNum) || isTowerFinale(this.mode, this.floorNum)) {
      // Reto final: trío legendario o legendario gigante, al azar (también en el piso 100 de la Torre, T72)
      const okIds = bundled;
      this.finale = pickFinale(this.rng(RNG.boss), (id) => !okIds || okIds.has(id));
      bossId = this.finale.ids[0];
    } else if (bossId === undefined) {
      // T64: sale de todos los legendarios y singulares; el tipo del bioma solo le da peso ×3
      bossId = pickBossWeighted(onlyBundled(biomeBossPool(index, this.biome)), this.rng(RNG.boss), this.bossHistory, this.biome, index);
      this.bossHistory.push(bossId);
    }
    this.bossId = bossId;
    // T88: la cacería se sortea al empezar (solo Normal; nunca con código ni en el desafío diario) y pasa de piso en piso
    this.itemLevels = r ? { ...r.itemLevels } : { ...(this.carry?.itemLevels ?? {}) };
    this.teraPick = r ? r.teraPick : (this.carry?.teraPick ?? null);
    this.hunt = r ? r.legendHunt : this.carry ? this.carry.legendHunt
      : this.mode === 'normal' && !this.daily && !this.codeRun
        ? rollHunt(Math.random, this.biome, onlyBundled(biomeBossPool(index, this.biome)), index, FLOOR_COUNT - 1, this.bossHistory)
        : noHunt();
    const legendCard = lairOnFloor(this.hunt, this.floorNum) ? await fetchPokemonCard(this.hunt.legendId).catch(() => null) : null;
    this.legendKind = legendCard ? this.toFoeKinds([legendCard], index)[0] : undefined;
    // Enemigos del piso: más fuertes cuanto más hondo; la semilla del piso los fija (no hace falta guardarlos)
    // Una especie del tipo del bioma y el resto de cualquier tipo (biomes.ts)
    // T83: alguno puede salir en su forma regional (más si encaja con el bioma)
    const foeIds = applyRegionalForms(pickMixedFoes(index, this.level(), this.biome, this.foeRng(this.level()), onlyBundled), this.biome.types, this.foeRng(this.level() + 131));
    const [starter, boss, foeCards] = await Promise.all([
      fetchPokemon(this.formId),
      fetchPokemon(bossId),
      Promise.all(foeIds.map((id) => fetchPokemonCard(id).catch(() => null))),
    ]);
    // Miembros del reto final y ayudantes de los jefes (de su tipo)
    if (this.finale) {
      const fs = await Promise.all(this.finale.ids.map((id) => fetchPokemon(id).catch(() => null)));
      this.finaleMembers = fs.filter((f) => f !== null).map((f) => ({ id: f.id, name: f.name, types: f.types.length ? f.types : ['normal'], stats: f.stats, key: `boss-${f.id}` }));
      if (this.finale.kind === 'giant') this.finale.name = this.finaleMembers[0]?.name ?? '';
    }
    const summonTypes = this.finale ? [...new Set(this.finaleMembers.flatMap((m) => m.types))] : boss.types;
    const summonIds = pickFloorEnemies(onlyBundled(biomeEnemyPool(index, this.level(), { ...this.biome, types: summonTypes })), this.foeRng(this.level() + 77), 3);
    const summonCards = (await Promise.all(summonIds.map((id) => fetchPokemonCard(id).catch(() => null)))).filter((c) => c !== null);
    let foes = foeCards.filter((c) => c !== null);
    if (foes.length === 0) foes = [await fetchPokemonCard(FALLBACK_ENEMIES[0])];
    this.foeKinds = this.toFoeKinds(foes, index);
    this.summonKinds = this.toFoeKinds(summonCards, index);
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
    this.playerTypes = starter.types.length > 0 ? [...starter.types] : ['normal'];
    this.starterName = starter.name;
    // Misma clave que usa StarterScene, así las texturas ya están cargadas
    this.playerKey = `starter-${starter.id}${this.shiny ? '-s' : ''}`;
    this.bossKey = `boss-${boss.id}`;
    await poolReady;
    // Partida nueva: empiezas con un ataque especial al azar del tipo de tu Pokémon (de los más comunes)
    if (!r && !this.carry && this.slots.every((m: MovePower | null) => !m) && this.movePool.length > 0) {
      const easy = this.movePool.filter((m) => moveRarity(m.power) !== 'epic' && moveRarity(m.power) !== 'legendary');
      const list = easy.length > 0 ? easy : this.movePool;
      const first = list[Math.floor(Math.random() * list.length)];
      this.movePool.splice(this.movePool.indexOf(first), 1);
      (this.slots as (MovePower | null)[])[0] = first;
    }

    this.load.crossOrigin = 'anonymous';
    // Cada hoja: clave y sprites (los enemigos también en shiny, por si sale uno)
    const sheets: [string, { front: string; back: string }][] = [
      [this.playerKey, pickSprites(starter.sprites, this.shiny)],
      [this.bossKey, pickSprites(boss.sprites, false)],
      ...(await Promise.all(this.finaleMembers.slice(1).map(async (m) => [m.key, pickSprites((await fetchPokemon(m.id)).sprites, false)] as [string, { front: string; back: string }]))),
      ...[...foes, ...summonCards.filter((c) => !foes.some((f) => f.id === c.id)), ...(legendCard ? [legendCard] : [])].flatMap((c) => [
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
      const pmdIds = [bossId!, ...this.finaleMembers.map((m) => m.id), ...foes.map((c) => c.id), ...summonCards.map((c) => c.id), ...(legendCard ? [legendCard.id] : []), ...(this.shiny ? [] : [this.formId])];
      loadPmd(this, pmdIds)
        .catch(() => new Map<number, PmdSheet>())
        .then((m) => {
          this.pmd = m;
          loading.destroy();
          this.startFloor();
          // Misiones de "llega al piso N (sin curarte)"
          this.mission({ kind: 'floor', floor: this.floorNum, healed: this.healedRun });
        });
    });
    this.load.start();
  }

  /**
   * Usa el sprite animado de SpriteCollab para este Pokémon si lo hay: textura de la hoja, escala y cuerpo físico.
   * Devuelve si lo ha usado (si no, el sprite sigue con el de PokeAPI).
   */
  private applyPmd(sprite: Sprite, id: number | undefined, size: number, circle = false): boolean {
    // Quita el saltito de dressSprites antes de cambiar de hoja (el cuerpo se recalcula abajo)
    const lift = (sprite.getData('lift') as number | undefined) ?? 0;
    if (lift) {
      sprite.setOrigin(0.5, 0.5);
      (sprite.body as Body | null)?.offset.add({ x: 0, y: -lift });
      sprite.setData('lift', 0);
    }
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
        // El del jugador nunca pasa de PLAYER_BODY_R px de radio: con frames grandes (Genesect…) medía más de una
        // casilla y no cabía entre dos matas de hierba alta
        const rad = Math.min(Math.min(fw, fh) * 0.3, PLAYER_BODY_R / pmdScale(size));
        sprite.setCircle(rad, fw / 2 - rad, fh * 0.62 - rad);
      } else body.setSize(fw * 0.6, fh * 0.55).setOffset(fw * 0.2, fh * 0.38);
    }
    this.playPmd(sprite);
    return true;
  }

  /**
   * Como en PokéSurvivor: sombra redonda bajo los pies de cada Pokémon (jugador, enemigos y jefe) que le sigue, y
   * al andar un pequeño saltito con balanceo. Los de SpriteCollab ya mueven las patas: a esos solo un saltito suave;
   * los de PokeAPI (shiny o sin hoja animada) se balancean más para que se note que caminan. Solo toca lo visual
   * (ángulo y sombra), nunca el cuerpo físico.
   */
  /** Los proyectiles que apuntan (rayo, hoja, llama…) siguen mirando hacia donde van al rebotar o perseguir. */
  private orientShots() {
    if (!this.shots) return;
    for (const c of this.shots.getChildren()) {
      const s = c as Sprite;
      const body = s.body as Body | null;
      const t = s.getData('ptype') as string | undefined;
      if (!s.active || !body || !t || projMode(t) === 'spin' || body.velocity.lengthSq() < 1) continue;
      s.setRotation(projRotation(t, Math.atan2(body.velocity.y, body.velocity.x)));
    }
  }

  /** Dónde acaba el dibujo por abajo (fila, ancho y centro de los píxeles de los pies), cacheado por fotograma. */
  private feetCache = new Map<string, { bottom: number; span: number; cx: number } | null>();
  private feetOf(s: Sprite): { bottom: number; span: number; cx: number } | null {
    const f = s.frame;
    if (!f || !f.source?.image) return null;
    const key = `${f.texture.key}|${f.name}`;
    const hit = this.feetCache.get(key);
    if (hit !== undefined) return hit;
    let res: { bottom: number; span: number; cx: number } | null = null;
    try {
      const w = Math.max(1, f.cutWidth), h = Math.max(1, f.cutHeight);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const cx = c.getContext('2d', { willReadFrequently: true });
      if (cx) {
        cx.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, w, h, 0, 0, w, h);
        const d = cx.getImageData(0, 0, w, h).data;
        const rowHas = (y: number) => { let n = 0; for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) n++; return n; };
        let bottom = -1;
        for (let y = h - 1; y >= 0; y--) if (rowHas(y) >= 2) { bottom = y; break; }
        if (bottom >= 0) {
          // Ancho de los pies: las filas más bajas del dibujo (un cuarto de su altura)
          let top = 0;
          for (let y = 0; y < h; y++) if (rowHas(y) >= 1) { top = y; break; }
          const from = Math.max(top, bottom - Math.max(2, Math.round((bottom - top) * 0.25)));
          let lo = w, hi = -1;
          for (let y = from; y <= bottom; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
          if (hi >= lo) res = { bottom: bottom + 1, span: hi - lo + 1, cx: (lo + hi + 1) / 2 };
        }
      }
    } catch {
      res = null; // imagen de otro origen sin permiso de lectura: se usa el cálculo de siempre
    }
    this.feetCache.set(key, res);
    return res;
  }

  private dressSprites(time: number) {
    const all = [this.player, ...(this.enemies.getChildren() as Sprite[])];
    for (const s of all) {
      if (!s.active || (this.falling && s === this.player)) continue;
      const body = s.body as Body | null;
      if (!body) continue;
      if (s !== this.player && s.depth < 3) s.setDepth(3);
      let sh = s.getData('shadow') as Phaser.GameObjects.Ellipse | undefined;
      if (!sh || !sh.active) {
        sh = this.add.ellipse(0, 0, 10, 4, 0x000000, 0.28).setDepth(0.5);
        s.setData('shadow', sh);
        const shadow = sh;
        s.once(Phaser.GameObjects.Events.DESTROY, () => shadow.destroy());
      }
      const w = Math.max(16, body.width * 0.85);
      const moving = body.velocity.lengthSq() > 400;
      const pmd = !!s.getData('pmd');
      // Saltito al andar: el sprite sube y la sombra se encoge un poco; el balanceo va con cada paso
      const phase = time / (pmd ? 85 : 70) + ((s.getData('stepSeed') as number | undefined) ?? (s.setData('stepSeed', Math.random() * 6), 0));
      const hop = moving ? Math.abs(Math.sin(phase)) : 0;
      // Pegada a los pies (Roberto: con la sombra más abajo parecía que volaba). En las hojas de SpriteCollab los
      // pies quedan un poco por encima del final del cuerpo físico; en los de PokeAPI, hacia el 86 % del dibujo.
      // Mejor aún: se mira dónde acaban de verdad los píxeles del dibujo (los jefes grandes, como Groudon, tienen
      // márgenes distintos y con una cifra fija la sombra les quedaba lejos y parecían volar).
      const feet = this.feetOf(s);
      const feetY = feet ? s.y + (feet.bottom - s.originY * s.frame.height) * s.scaleY - 1 : pmd ? body.bottom - body.height * 0.26 : s.y + s.displayHeight * 0.34;
      const sw = feet ? Math.max(14, feet.span * Math.abs(s.scaleX) * 0.95) : w;
      sh.setPosition(feet ? s.x + ((s.flipX ? s.frame.width - feet.cx : feet.cx) - s.originX * s.frame.width) * s.scaleX : body.center.x, feetY);
      sh.setSize(sw, sw * 0.3);
      // Parpadeo mientras el jugador es invulnerable tras un golpe
      if (s === this.player && !this.ended && !this.evolving) s.setAlpha(time < this.invulnUntil && Math.floor(time / 70) % 2 ? 0.35 : 1);
      sh.setVisible(s.visible).setAlpha(Math.max(0.4, s.alpha));
      // Subir el dibujo sin mover el cuerpo: el origen y el desfase del cuerpo cambian lo mismo (en px del frame)
      // Los de SpriteCollab ya mueven las patas: sin saltito; los de PokeAPI, uno muy pequeño
      const lift = (hop * (pmd ? 0 : 2.5)) / Math.max(0.01, s.scaleY);
      const delta = lift - ((s.getData('lift') as number | undefined) ?? 0);
      if (Math.abs(delta) > 0.01 && s.height > 0) {
        s.setOrigin(s.originX, s.originY + delta / s.height);
        body.offset.y += delta;
        s.setData('lift', lift);
      }
      // Quieto respira (balanceo suave) y al disparar se echa un poco hacia atrás
      const idle = !moving && !pmd ? Math.sin(time / 420 + ((s.getData('stepSeed') as number | undefined) ?? 0)) * 1.6 : 0;
      const kick = s === this.player ? Math.max(0, 1 - (time - this.lastShotAt) / 130) * -Math.sign(this.aim.x || 1) * 7 : 0;
      const tilt = (moving ? Math.sin(phase) * (pmd ? 3 : 8) : idle) + kick;
      // Suaviza la vuelta a 0 al pararse (al acabar, el jugador lo anima combatFx: no se toca)
      if (!(this.ended && s === this.player)) s.setAngle(Phaser.Math.Linear(s.angle, tilt, 0.35));
    }
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
    const { stats, active } = applySynergies(computeStats(this.passives, this.base, this.itemLevels), this.passives, types);
    this.synergies = active.map((syn) => syn.id);
    this.ability?.apply?.(stats);
    // Altares (T39): los PS máximos dados se pierden para el resto de la partida
    if (this.hpSacrificed > 0) stats.maxHp = Math.max(1, stats.maxHp - this.hpSacrificed);
    // Fuente curativa (T48): beber gratis cansa unas salas
    if (this.tiredRooms > 0) stats.speed *= FOUNTAIN_TIRED_SPEED;
    // T74: la megaevolución da PS máximos mientras dura (se quitan al acabar; ver endPowerForm)
    stats.maxHp += powerFormMaxHpBonus(this.powerForm);
    // T75: con Dinamax los ataques también son más grandes
    stats.shotScale *= powerFormSizeMul(this.powerForm);
    return stats;
  }

  /** Multiplicador de daño de Ataque X mientras dura. */
  private dmgMul(): number {
    // T55: la adrenalina activa se suma a Ataque X (se multiplican)
    // T74: la megaevolución también
    return (this.time.now < this.buffUntil ? this.buffMul : 1) * adrenalineDamageMul(this.adrenaline) * powerFormDamageMul(this.powerForm);
  }

  /**
   * Azar de las cosas del piso que deben ser iguales para todos en el desafío diario (salas, jefe, objetos, cofres,
   * tienda): una secuencia fija por piso y por cosa. Fuera del desafío, Math.random.
   */
  private rng(stream: number): () => number {
    if (!this.seeded) return Math.random;
    let r = this.dailyRngs.get(stream);
    if (!r) {
      r = seedRng(this.seeded.seed, this.floorNum, stream);
      this.dailyRngs.set(stream, r);
    }
    return r;
  }

  /**
   * Día y noche (T67): la fase sale del tiempo jugado (counters.seconds, que se para en pausa y se guarda con la
   * partida, así que al continuar sigue igual). Solo avisa cuando cambia mientras juegas.
   */
  private dayNightTick() {
    const now = phaseAtSeconds(this.counters.seconds);
    const before = this.phase;
    this.phase = now;
    if (!this.nightLayer) this.nightLayer = dayNightLayer(this);
    this.nightLayer.setNight(now === 'night');
    if (before === null || before === now || this.ended) return;
    this.notify(`${PHASE_NOTICE[now]}\n${PHASE_DESC[now]}`, { kind: 'info', icon: 'star' });
  }

  /**
   * Arena y granizo (T38): cada WEATHER_TICK_MS hacen un poco de daño al jugador y a los enemigos que no son de sus
   * tipos. Al jugador nunca lo deja por debajo de 1 PS; a los jefes no les afecta.
   */
  private weatherTick(time: number) {
    const w = this.weather;
    // Solo mientras hay pelea en la sala (en las salas tranquilas no molesta)
    if (!w || this.ended || this.transitioning || (w !== 'sand' && w !== 'hail') || this.enemies.countActive(true) === 0) return;
    if (this.weatherTickAt === 0) this.weatherTickAt = time + WEATHER_TICK_MS;
    if (time < this.weatherTickAt) return;
    this.weatherTickAt = time + WEATHER_TICK_MS;
    const color = w === 'sand' ? 0xe7c27a : 0xcfe8ff;
    if (weatherHurts(w, this.playerTypes) && this.hp > 1) {
      const chip = Math.min(weatherChip(this.stats.maxHp), Math.ceil(this.hp) - 1);
      if (chip > 0) {
        this.hp -= chip;
        this.popup(this.player.x, this.player.y - 50, `-${chip} PS`, color);
      }
    }
    for (const o of this.enemies.getChildren()) {
      const e = o as Sprite;
      const ai = e.getData('ai') as EnemyAI | undefined;
      if (!e.active || !ai || ai.boss || !weatherHurts(w, (e.getData('types') as string[] | undefined) ?? [ai.type])) continue;
      const hp = (e.getData('hp') as number) - weatherChip((e.getData('maxHp') as number | undefined) ?? 10);
      e.setData('hp', hp).setData('flashUntil', time + 80);
      if (hp <= 0) this.time.delayedCall(0, () => e.active && this.killEnemy(e));
    }
  }

  // --- Salas sorpresa (T39, roomEvents.ts) ---

  /** Al entrar en la sala sorpresa sin resolver: prepara su evento. */
  private startEvent(room: Room, kind: RoomEventKind) {
    this.clearEventObjs();
    const i = this.interior(room);
    // Mismo azar cada vez que entras en esta sala (y en el desafío diario, el de todos)
    const rng = mulberry32((this.floorSeed ^ Math.imul(room.id + 1, 0x9e3779b1)) >>> 0);
    this.notify(kind === 'megaStone' ? `${ROOM_EVENT_LABEL[kind]}\n${ROOM_EVENT_DESC[kind]}` : `¡Sala sorpresa! ${ROOM_EVENT_LABEL[kind]}\n${ROOM_EVENT_DESC[kind]}`, { kind: 'info', icon: 'star' });
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.eventObjs.push(o);
      return o;
    };
    const clickable = (o: Phaser.GameObjects.Image | Phaser.GameObjects.Zone, use: () => void) => {
      o.setInteractive({ useHandCursor: true });
      o.on('pointerover', () => (this.overHud = true));
      o.on('pointerout', () => (this.overHud = false));
      o.on('pointerdown', () => this.current?.id === room.id && use());
    };
    const label = (x: number, y: number, text: string, size = 15, color = '#ffffff') =>
      keep(this.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#101828', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(4));

    if (kind === 'megaStone') {
      // Sin enemigos ni puertas cerradas: solo el altar (ver placeMegaAltar)
      this.cleared.add(room.id);
      this.placeMegaAltar(room, i.cx, i.cy);
      return;
    }

    if (kind === 'runaway') {
      if (this.foeKinds.length === 0) return this.finishEvent(room);
      // El más raro del piso (el de más estadísticas), brillante y deprisa
      const k = [...this.foeKinds].sort((a, b) => b.bst - a.bst)[0];
      const e = this.spawnEnemy(k, 'chase');
      const ai = e.getData('ai') as EnemyAI;
      ai.eliteMove = undefined;
      const hp = Math.round((e.getData('maxHp') as number) * RUNAWAY_HP_MUL);
      e.setData('hp', hp).setData('maxHp', hp).setData('runaway', true).setData('elite', false);
      this.glowAura(e, 0x4fc3f7);
      sparkle(this, e.x, e.y);
      void cry(Number(k.key.replace('foe-', '')));
      const name = k.name ? k.name.charAt(0).toUpperCase() + k.name.slice(1) : 'Pokémon raro';
      this.runaway = { sprite: e, until: this.time.now + RUNAWAY_SECONDS * 1000, label: label(e.x, e.y - 50, '', 16, '#9fe3ff'), name };
      this.notify(`¡Un ${name} raro! Véncelo antes de que huya`, { kind: 'danger', icon: 'clock' });
      this.setDoorsLocked(room, true, true);
      sfx('door');
      return;
    }

    if (kind === 'thief') {
      // T70: ladrón rápido y sin ataque. Toca para robar y corre hacia la puerta más lejana de ti.
      if (this.foeKinds.length === 0) return this.finishEvent(room);
      const k = this.foeKinds[Math.floor(rng() * this.foeKinds.length) % this.foeKinds.length];
      const e = this.spawnEnemy(k, 'chase');
      thiefGear(this, e);
      const ai = e.getData('ai') as EnemyAI;
      ai.eliteMove = undefined;
      const hp = Math.max(1, Math.round((e.getData('maxHp') as number) * THIEF_HP_MUL));
      e.setData('hp', hp).setData('maxHp', hp).setData('thief', true).setData('elite', false);
      e.setData('speed', ((e.getData('speed') as number | undefined) ?? 100) * THIEF_SPEED_MUL);
      const inset = 30;
      const spots: Record<string, { x: number; y: number }> = { up: { x: i.cx, y: i.y0 + inset }, down: { x: i.cx, y: i.y1 - inset }, left: { x: i.x0 + inset, y: i.cy }, right: { x: i.x1 - inset, y: i.cy } };
      const door = thiefEscapeDoor(Object.keys(room.doors).map((d) => spots[d]), this.player);
      if (!door) return this.finishEvent(room);
      this.thief = { sprite: e, door, stolen: 0, label: label(e.x, e.y - 50, '¡Ladrón!', 15, '#ffcc80') };
      // Aviso fuera del centro (notify ya los coloca en su zona)
      this.notify('¡Un ladrón! Si te toca, te roba monedas', { kind: 'danger', icon: 'coin' });
      return;
    }

    if (kind === 'merchant') {
      // Puesto con tres artículos; los poderes se copian para no gastar la bolsa si no compras
      const stock = merchantStock(rng, new Set(this.passives), [...this.movePool], this.passivePool(), this.floorNum);
      // Easter egg: a veces vende un Magikarp «por solo 5 monedas»
      const karp = sellsMagikarp(rng(), this.passives);
      if (karp) stock[0] = { goods: { kind: 'passive', id: MAGIKARP }, price: MAGIKARP_PRICE, sold: false };
      const g = keep(this.add.graphics().setDepth(2));
      g.fillStyle(0x6b4423, 1).fillRect(i.cx - 200, i.cy - 120, 400, 26);
      for (let k = 0; k < 5; k++) g.fillStyle(k % 2 ? 0xf4f1e6 : 0x1abc9c, 1).fillTriangle(i.cx - 200 + k * 80, i.cy - 120, i.cx - 120 + k * 80, i.cy - 120, i.cx - 160 + k * 80, i.cy - 156);
      label(i.cx, i.cy - 176, karp ? '«¡Un Magikarp por solo 5 monedas! ¡Una ganga!»' : 'Mercader ambulante: elige uno y se marcha', 16, '#ffe9a8');
      stock.forEach((slot, k) => {
        const x = i.cx + (k - 1) * 150;
        const y = i.cy + 10;
        const gd = slot.goods;
        const passive = gd.kind === 'passive' ? passiveById(gd.id) : undefined;
        const name = gd.kind === 'move' ? pretty(gd.move.name) : (passive?.name ?? 'Objeto');
        keep(this.add.ellipse(x, y + 26, 80, 26, 0x000000, 0.25).setDepth(1));
        const img = keep(this.add.image(x, y, iconKey(gd.kind === 'move' ? 'disc' : 'bag')).setScale(3).setDepth(3));
        if (gd.kind === 'move') img.setTint(typeColor(gd.move.type));
        clickable(img, () => this.buyFromMerchant(room, slot, name));
        label(x, y + 48, name, 14);
        label(x, y + 68, `${slot.price} monedas`, 14, '#ffd34d');
        this.eventSpots.push({ x, y, prompt: () => `Enter / A / clic: comprar ${name} por ${slot.price} (tienes ${this.coins})`, use: () => this.buyFromMerchant(room, slot, name) });
      });
      return;
    }

    if (kind === 'altar') {
      const g = keep(this.add.graphics().setDepth(2));
      g.fillStyle(0x4a4a5a, 1).fillRect(i.cx - 60, i.cy - 10, 120, 50);
      g.fillStyle(0x6e6e84, 1).fillRect(i.cx - 72, i.cy - 22, 144, 16);
      g.fillStyle(0xb388ff, 0.8).fillRect(i.cx - 40, i.cy + 4, 80, 6);
      const orb = keep(this.add.image(i.cx, i.cy - 56, iconKey('star')).setScale(3).setDepth(3).setTint(0xd9c2ff));
      this.tweens.add({ targets: orb, y: i.cy - 66, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      label(i.cx, i.cy + 64, 'Altar: da PS máximos a cambio de un objeto', 15, '#e3d4ff');
      const use = () => this.useAltar(room, i.cx, i.cy + 90);
      clickable(keep(this.add.zone(i.cx, i.cy + 9, 144, 62)), use);
      this.eventSpots.push({
        x: i.cx,
        y: i.cy,
        prompt: () =>
          canUseAltar(this.stats.maxHp) ? `Enter / A / clic: dar ${altarCost(this.stats.maxHp)} PS máximos por un objeto` : 'Tienes muy pocos PS máximos para el altar',
        use,
      });
      return;
    }

    if (kind === 'rival') {
      // Entrenador rival: oleadas cortas seguidas; al ganar, el doble de tickets de la sala (ver checkClear)
      this.rivalWave = 1;
      this.rivalTeam = rivalTeamSize(this.floorNum);
      this.rivalName = rivalTrainerName(Math.random);
      this.rivalKinds = pickRivalTeam(this.foeKinds, this.rivalTeam, Math.random);
      label(i.cx, i.y0 + 40, this.rivalName, 22, '#ff8a80');
      this.setDoorsLocked(room, true, true);
      sfx('door');
      this.notify(`¡${this.rivalName} te desafía!\nTiene ${this.rivalTeam} Pokémon · 1/${this.rivalTeam}`, { kind: 'danger', icon: 'sword' });
      this.time.delayedCall(700, () => !this.ended && this.current.id === room.id && this.spawnRivalMember(1));
      return;
    }

    if (kind === 'timeTrial') {
      // Sala del tiempo: enemigos y un reloj; si se acaba, entran más (ver updateTimeTrial y checkClear)
      this.setDoorsLocked(room, true, true);
      sfx('door');
      const clock = label(i.cx, i.y0 + 40, '', 26, '#ffd34d');
      this.timeTrial = { roomId: room.id, until: this.time.now + TIME_TRIAL_SECONDS * 1000, failed: false, label: clock };
      this.spawnEnemies(timeTrialSize(this.floorNum));
      return;
    }

    if (kind === 'fountain') {
      // Fuente curativa: pagar monedas o beber gratis y cansarse unas salas
      const g = keep(this.add.graphics().setDepth(2));
      g.fillStyle(0x6e7686, 1).fillCircle(i.cx, i.cy, 62);
      g.fillStyle(0x9aa3b4, 1).fillCircle(i.cx, i.cy, 54);
      g.fillStyle(0x64b5f6, 0.95).fillCircle(i.cx, i.cy, 44);
      g.fillStyle(0xbbdefb, 0.9).fillCircle(i.cx - 12, i.cy - 12, 10);
      const drops = keep(this.add.graphics().setDepth(3));
      this.tweens.addCounter({ from: 0, to: 1, duration: 900, repeat: -1, onUpdate: (tw) => {
        const v = tw.getValue() ?? 0;
        drops.clear().fillStyle(0xe3f2fd, 1 - v);
        for (let k = 0; k < 3; k++) drops.fillRect(i.cx - 20 + k * 20, i.cy - 30 - v * 30, 4, 4);
      } });
      const price = fountainPrice(this.floorNum);
      const amount = () => fountainHeal(this.stats.maxHp);
      const pay = () => this.useFountain(room, true, price);
      const free = () => this.useFountain(room, false, price);
      for (const [x, text, use] of [[i.cx - 150, `Pagar ${price} monedas`, pay], [i.cx + 150, 'Beber gratis (cansa)', free]] as const) {
        const z = keep(this.add.zone(x, i.cy + 70, 170, 50));
        clickable(z, use);
        label(x, i.cy + 70, text, 15, '#bbdefb');
      }
      label(i.cx, i.cy - 84, 'Fuente curativa', 18, '#e3f2fd');
      this.eventSpots.push(
        { x: i.cx - 150, y: i.cy + 70, prompt: () => `Enter / A / clic: curar ${amount()} PS por ${price} monedas (tienes ${this.coins})`, use: pay },
        { x: i.cx + 150, y: i.cy + 70, prompt: () => `Enter / A / clic: curar ${amount()} PS gratis, pero irás más lento ${FOUNTAIN_TIRED_ROOMS} salas`, use: free },
      );
      return;
    }

    if (kind === 'forge') {
      this.placeForge(room, i.cx, i.cy);
      return;
    }

    if (kind === 'story') {
      this.placeStory(room, i.cx, i.cy, rng);
      return;
    }

    if (kind === 'slots') {
      // T68: sala de juegos. Tres apuestas fijas; cada una es un punto de uso (Enter / A cerca, o clic)
      keep(buildSlotArt(this, i.cx, i.cy));
      const reelTxt = [-72, 0, 72].map((dx) => label(i.cx + dx, i.cy - 35, '?', 22, '#101828'));
      const status = label(i.cx, i.cy - 128, 'Sala de juegos', 18, '#ffccbc');
      const spinsLeft = () => SLOT_MAX_SPINS - (this.slotSpins.get(room.id) ?? 0);
      SLOT_BETS.forEach((bet, k) => {
        const x = i.cx + (k - 1) * 150;
        const y = i.cy + 70;
        const play = () => this.playSlots(room, bet, reelTxt, status);
        clickable(keep(this.add.zone(x, y, 130, 50)), play);
        label(x, y, `Apostar ${bet}`, 15, '#ffd34d');
        this.eventSpots.push({
          x,
          y,
          prompt: () => (spinsLeft() <= 0 ? 'La máquina se ha parado' : `Enter / A / clic: apostar ${bet} monedas (tienes ${this.coins}, quedan ${spinsLeft()} tiradas)`),
          use: play,
        });
      });
      return;
    }

    if (kind === 'fishing') {
      // T69: laguna de pesca. Un solo botón (Enter / A cerca, o clic en el agua): lanzar y, cuando pica, recoger
      keep(buildLagoonArt(this, i.cx, i.cy));
      const status = label(i.cx, i.cy - 120, 'Laguna de pesca', 18, '#b3e5fc');
      const castsLeft = () => FISH_MAX_CASTS - (this.fishCasts.get(room.id) ?? 0);
      const use = () => this.useFishingRod(room, status, rng);
      clickable(keep(this.add.zone(i.cx, i.cy - 20, 300, 150)), use);
      this.eventSpots.push({
        x: i.cx,
        y: i.cy + 70,
        prompt: () =>
          this.fishLine?.roomId === room.id
            ? 'Enter / A / clic: ¡recoger cuando pique!'
            : `Enter / A / clic: lanzar la caña (quedan ${castsLeft()} lanzamientos)`,
        use,
      });
      return;
    }

    if (kind === 'egg') {
      // Huevo misterioso: se lleva y eclosiona tras unas salas limpiadas
      const g = keep(this.add.graphics().setDepth(3));
      g.fillStyle(0x101828, 1).fillEllipse(i.cx, i.cy, 52, 66);
      g.fillStyle(0xfdf6e3, 1).fillEllipse(i.cx, i.cy, 46, 60);
      g.fillStyle(0x7cb342, 1).fillCircle(i.cx - 8, i.cy - 10, 6).fillCircle(i.cx + 10, i.cy + 8, 5).fillCircle(i.cx - 4, i.cy + 18, 4);
      this.tweens.add({ targets: g, angle: { from: -3, to: 3 }, duration: 300, yoyo: true, repeat: -1, repeatDelay: 900 });
      label(i.cx, i.cy + 56, 'Huevo misterioso', 15, '#f8bbd0');
      const take = () => this.takeEgg(room);
      const z = keep(this.add.zone(i.cx, i.cy, 70, 80));
      clickable(z, take);
      this.eventSpots.push({ x: i.cx, y: i.cy, prompt: () => (this.eggLeft > 0 ? 'Ya llevas un huevo' : 'Enter / A / clic: coger el huevo'), use: take });
      return;
    }

    // Cofre misterioso: se abre sin llave… pero puede ser una trampa
    const img = keep(this.add.image(i.cx, i.cy, iconKey('chest')).setScale(3.4).setDepth(3).setTint(0xd9b3ff));
    this.tweens.add({ targets: img, angle: { from: -4, to: 4 }, duration: 260, yoyo: true, repeat: -1, repeatDelay: 1400 });
    label(i.cx, i.cy + 52, 'Cofre misterioso (sin llave)', 15, '#f0dcff');
    const open = () => this.openTrapChest(room, i.cx, i.cy, rng);
    clickable(img, open);
    this.eventSpots.push({ x: i.cx, y: i.cy, prompt: () => 'Enter / A / clic: abrir el cofre', use: open });
  }

  private buyFromMerchant(room: Room, slot: ShopSlot, name: string, confirmed = false) {
    if (this.ended || this.transitioning || this.eventsDone.has(room.id)) return;
    if (this.coins < slot.price) return this.notify(`Te faltan monedas (${this.coins}/${slot.price})`, { kind: 'warning', icon: 'coin' });
    if (!confirmed) return void this.askBuy(name, slot.price, () => this.buyFromMerchant(room, slot, name, true));
    if (slot.goods.kind === 'move' && this.chosenSlot === undefined && this.askSlot(slot.goods.move, (s) => { this.chosenSlot = s; this.buyFromMerchant(room, slot, name, true); }, () => undefined)) return;
    this.coins -= slot.price;
    sfx('buy');
    const g = slot.goods;
    if (g.kind === 'move') {
      // Sale de la bolsa de poderes, como en la tienda
      const k = this.movePool.findIndex((m) => m.name === g.move.name);
      if (k >= 0) this.movePool.splice(k, 1);
      this.gainItem({ kind: 'move', move: g.move });
    } else if (g.kind === 'passive') {
      const item = passiveById(g.id);
      if (item) this.gainItem({ kind: 'passive', item });
    }
    this.notify(`Has comprado ${name}\nEl mercader se marcha`, { kind: 'item', icon: 'shop' });
    this.refreshInventory();
    this.finishEvent(room);
  }

  private useAltar(room: Room, x: number, y: number) {
    if (this.ended || this.transitioning || this.eventsDone.has(room.id)) return;
    if (!canUseAltar(this.stats.maxHp)) return this.notify('Tienes muy pocos PS máximos para el altar', { kind: 'warning', icon: 'heart' });
    const cost = altarCost(this.stats.maxHp);
    this.hpSacrificed += cost;
    this.stats = this.calcStats();
    this.hp = Math.min(this.hp, this.stats.maxHp);
    sfx('heal');
    this.cameras.main.flash(250, 180, 140, 255);
    this.popup(this.player.x, this.player.y - 50, `-${cost} PS máx.`, 0xb388ff);
    this.notify(`Has dado ${cost} PS máximos\nEl altar te da un objeto`, { kind: 'item', icon: 'star' });
    const p = this.freeSpot(x, y);
    this.dropItem(room.id, p.x, p.y);
    this.finishEvent(room);
  }

  private openTrapChest(room: Room, x: number, y: number, rng: () => number) {
    if (this.ended || this.transitioning || this.eventsDone.has(room.id)) return;
    this.clearEventObjs();
    if (trapChestOutcome(rng) === 'item') {
      sfx('chest');
      const img = this.add.image(x, y, iconKey('chestOpen')).setScale(3.4).setDepth(2);
      this.time.delayedCall(4000, () => img.active && img.destroy());
      const p = this.freeSpot(x, y + 60);
      this.dropItem(room.id, p.x, p.y);
      this.notify('¡Cofre abierto!', { kind: 'reward', icon: 'chestOpen' });
      this.finishEvent(room);
      return;
    }
    // ¡Trampa! Sale un Pokémon fuerte del piso; al vencerlo suelta el objeto
    if (this.foeKinds.length === 0) return this.finishEvent(room);
    const k = [...this.foeKinds].sort((a, b) => b.bst - a.bst)[0];
    const e = this.spawnEnemy(k, k.behavior);
    (e.body as Body).reset(x, y);
    const hp = Math.round((e.getData('maxHp') as number) * 2);
    e.setData('hp', hp).setData('maxHp', hp).setData('mimic', true);
    this.cameras.main.shake(160, 0.006);
    sfx('hurt');
    this.notify('¡Era una trampa!\nVence al Pokémon para quedarte el objeto', { kind: 'danger', icon: 'chest' });
    this.setDoorsLocked(room, true, true);
  }

  /** Cada fotograma: el Pokémon raro se aleja de ti y, si se acaba el tiempo, huye. */
  private updateRunaway(time: number) {
    const r = this.runaway;
    if (!r) return;
    const e = r.sprite;
    if (!e.active) {
      r.label.destroy();
      this.runaway = undefined;
      return;
    }
    const left = Math.max(0, Math.ceil((r.until - time) / 1000));
    r.label.setText(`¡Huye! ${left} s`).setPosition(e.x, e.y - 50);
    if (this.ended || this.transitioning) return;
    if (time >= r.until) {
      // Se escapa: humo y fuera; la sala queda limpia, sin premio extra
      const room = this.current;
      this.runaway = undefined;
      r.label.destroy();
      dustBurst(this, e.x, e.y + 20);
      e.destroy();
      this.notify(`¡${r.name} ha huido!`, { kind: 'warning', icon: 'clock' });
      this.eventsDone.add(room.id);
      this.checkClear();
      return;
    }
    const away = new Phaser.Math.Vector2(e.x - this.player.x, e.y - this.player.y);
    if (away.lengthSq() === 0) away.set(1, 0);
    away.normalize();
    // Contra una pared, se escurre de lado
    const b = e.body as Body;
    if (!b.blocked.none) away.add(new Phaser.Math.Vector2(-away.y, away.x).scale(1.2)).normalize();
    const speed = ((e.getData('speed') as number | undefined) ?? 100) * 1.2;
    e.setVelocity(away.x * speed, away.y * speed);
  }

  /** El Pokémon raro o el del cofre trampa caen: premio (el raro, además, tickets). */
  private eventFoeDefeated(enemy: Sprite) {
    const room = this.current;
    this.eventsDone.add(room.id);
    if (enemy.getData('runaway')) {
      this.runaway?.label.destroy();
      this.runaway = undefined;
      const t = this.giveTickets(runawayTickets(this.floorNum));
      this.notify(`¡Lo has vencido a tiempo! +${t} tickets\nHa caído un objeto`, { kind: 'reward', icon: 'ticket' });
    } else if (enemy.getData('fished')) {
      // T69: más botín que la trampa: el objeto y además monedas
      this.spawnLoot(room.id, enemy.x, enemy.y, { kind: 'coin', value: fishRareCoins(this.floorNum) });
      this.notify('¡Has vencido al Pokémon de la laguna!\nMonedas y un objeto', { kind: 'reward', icon: 'star' });
    } else this.notify('¡Has vencido a la trampa!\nHa caído un objeto', { kind: 'reward', icon: 'chestOpen' });
    const p = this.freeSpot(enemy.x, enemy.y);
    this.time.delayedCall(800, () => !this.ended && this.dropItem(room.id, p.x, p.y));
  }

  /** Evento resuelto sin pelea (mercader, altar, cofre con premio): la sala queda limpia sin dar tickets. */
  private finishEvent(room: Room) {
    this.eventsDone.add(room.id);
    this.cleared.add(room.id);
    // T72: la tienda del descanso de la Torre sigue aunque se gaste la forja
    this.eventSpots = [...this.towerRestSpots];
    this.prompt.setText('');
    this.drawMap();
    this.saveNow();
    // Lo dibujado se va con un fundido
    const objs = this.eventObjs;
    this.eventObjs = [];
    this.tweens.add({ targets: objs, alpha: 0, duration: 500, onComplete: () => objs.forEach((o) => o.destroy()) });
  }

  private clearEventObjs() {
    this.eventObjs.forEach((o) => o.destroy());
    this.eventObjs = [];
    this.eventSpots = [];
    this.runaway?.label.destroy();
    this.runaway = undefined;
    this.thief?.label.destroy();
    this.thief = undefined;
    this.fishLine = undefined; // T69: al salir, la caña echada se recoge sola (sin premio)
  }

  /**
   * T70: cada fotograma el ladrón va a por ti hasta robarte y luego corre hacia su puerta. Si llega, se escapa con
   * las monedas (ya descontadas al robar) y la sala queda resuelta.
   */
  private updateThief() {
    const t = this.thief;
    if (!t) return;
    const e = t.sprite;
    if (!e.active) {
      t.label.destroy();
      this.thief = undefined;
      return;
    }
    t.label.setPosition(e.x, e.y - 50).setText(t.stolen > 0 ? `¡Ladrón! (${t.stolen} monedas)` : '¡Ladrón!');
    if (this.ended || this.transitioning) return;
    // Antes de robar, la IA normal lo lleva hacia ti; después, huye a la puerta
    if (t.stolen === 0) return;
    if (thiefEscaped(e, t.door)) {
      const room = this.current;
      this.thief = undefined;
      t.label.destroy();
      dustBurst(this, e.x, e.y + 20);
      e.destroy();
      this.notify(`¡El ladrón ha escapado con ${t.stolen} monedas!`, { kind: 'warning', icon: 'coin' });
      this.eventsDone.add(room.id);
      this.checkClear();
      return;
    }
    const dir = new Phaser.Math.Vector2(t.door.x - e.x, t.door.y - e.y);
    if (dir.lengthSq() === 0) dir.set(1, 0);
    dir.normalize();
    const b = e.body as Body;
    if (!b.blocked.none) dir.add(new Phaser.Math.Vector2(-dir.y, dir.x).scale(1.2)).normalize();
    const speed = (e.getData('speed') as number | undefined) ?? 140;
    e.setVelocity(dir.x * speed, dir.y * speed);
  }

  /** T70: el ladrón te toca. Solo roba una vez y nunca hace daño. */
  private thiefTouch() {
    const t = this.thief;
    if (!t || t.stolen > 0) return;
    const stolen = thiefSteal(this.coins);
    if (stolen <= 0) return;
    t.stolen = stolen;
    this.coins = coinsAfterTheft(this.coins, stolen);
    this.popup(this.player.x, this.player.y - 50, `−${stolen} monedas`, 0xffcc80);
    coinsStolenFx(this, this.player, t.sprite, stolen);
    this.notify(`¡Te ha robado ${stolen} monedas!\nAbátelo antes de que salga de la sala`, { kind: 'danger', icon: 'coin' });
  }

  /** T70: abates al ladrón: te devuelve lo robado y un extra. */
  private thiefDefeated() {
    const t = this.thief;
    if (!t) return;
    this.thief = undefined;
    t.label.destroy();
    this.eventsDone.add(this.current.id);
    const back = thiefRefund(t.stolen);
    this.coins += back;
    this.notify(t.stolen > 0 ? `¡Has atrapado al ladrón! +${back} monedas` : `¡Has ahuyentado al ladrón! +${back} monedas`, { kind: 'reward', icon: 'coin' });
  }

  /**
   * Solo estas salas se pintan en la cámara de la sala (T41). Usa el filtro de cámara, no `visible`, para no pisar
   * lo que el juego enseña u oculta (rejas de las puertas, paredes con grieta…).
   */
  private showRooms(ids: number[]) {
    const cam = this.cameras.main.id;
    const all = new Set(ids.flatMap((id) => this.groupIds(this.floor.rooms[id])));
    for (const [id, objs] of this.roomObjs) {
      const show = all.has(id);
      for (const o of objs) {
        if (!o.active) continue;
        if (show) o.cameraFilter &= ~cam;
        else o.cameraFilter |= cam;
      }
    }
  }

  // --- Eventos de la T48: fuente, huevo, sala del tiempo y ayudante ---

  private useFountain(room: Room, paid: boolean, price: number, confirmed = false) {
    if (this.ended || this.transitioning || this.eventsDone.has(room.id)) return;
    if (!canHeal(this.hp, this.stats.maxHp)) return this.notify('Ya tienes todos los PS', { kind: 'warning', icon: 'heart' });
    if (paid && this.coins < price) return this.notify(`Te faltan monedas (${this.coins}/${price})`, { kind: 'warning', icon: 'coin' });
    if (paid && !confirmed) return void this.askBuy('la curación de la fuente', price, () => this.useFountain(room, true, price, true));
    if (paid) this.coins -= price;
    const amount = scaleHeal(fountainHeal(this.stats.maxHp), this.diff);
    this.hp = healed(this.hp, this.stats.maxHp, amount);
    sfx('heal');
    this.popup(this.player.x, this.player.y - 50, `+${amount} PS`, 0x64b5f6);
    if (!paid) {
      this.tiredRooms = FOUNTAIN_TIRED_ROOMS;
      this.stats = this.calcStats();
    }
    this.notify(paid ? `¡Fuente curativa! +${amount} PS` : `¡Fuente curativa! +${amount} PS\nCansado: más lento ${FOUNTAIN_TIRED_ROOMS} salas`, { kind: 'heal', icon: 'heart' });
    this.finishEvent(room);
  }

  /** T68: una tirada de la tragaperras (la lógica, el premio y el tope están en slotMachine.ts). */
  private playSlots(room: Room, bet: number, reels: Phaser.GameObjects.Text[], status: Phaser.GameObjects.Text) {
    if (this.ended || this.transitioning || this.eventsDone.has(room.id)) return;
    const done = this.slotSpins.get(room.id) ?? 0;
    if (done >= SLOT_MAX_SPINS) return this.notify('La máquina se ha parado', { kind: 'warning', icon: 'coin' });
    if (!canSpin(this.coins, bet, done)) return this.notify(`Te faltan monedas (${this.coins}/${bet})`, { kind: 'warning', icon: 'coin' });
    this.slotSpins.set(room.id, done + 1);
    this.coins -= bet;
    const res = spinSlot(bet, Math.random);
    this.coins += res.payout;
    reels.forEach((t, k) => t.setText(res.reels[k] === 'siete' ? '7' : res.reels[k].slice(0, 2).replace(/^./, (c) => c.toUpperCase())));
    status.setText(`${SLOT_OUTCOME_LABEL[res.outcome]}${res.payout > 0 ? ` · +${res.payout}` : ''}`);
    sfx(res.payout > bet ? 'pickup' : 'buy');
    if (res.payout > bet) this.popup(this.player.x, this.player.y - 50, `+${res.payout - bet} monedas`, 0xffd34d);
    if (res.item) {
      const p = this.freeSpot(this.player.x, this.player.y + 60);
      this.dropItem(room.id, p.x, p.y);
      this.notify('¡Premio extra!\nLa máquina suelta un objeto', { kind: 'item', icon: 'star' });
    }
    if (done + 1 >= SLOT_MAX_SPINS) {
      this.notify('Fin de la sala de juegos\nLa máquina se apaga', { kind: 'info', icon: 'coin' });
      this.finishEvent(room);
    } else {
      this.saveNow();
    }
  }

  /**
   * T69: la caña. Sin sedal echado, lanza y programa el picotazo; con él, comprueba la ventana (fishing.ts). Si no
   * pulsas a tiempo, el pez se va solo y gasta el lanzamiento igual.
   */
  private useFishingRod(room: Room, status: Phaser.GameObjects.Text, rng: () => number) {
    if (this.ended || this.transitioning || this.eventsDone.has(room.id)) return;
    const now = this.time.now;
    const line = this.fishLine?.roomId === room.id ? this.fishLine : undefined;
    if (!line) {
      const done = this.fishCasts.get(room.id) ?? 0;
      if (!canCast(done)) return;
      this.fishCasts.set(room.id, done + 1);
      const token = Math.random();
      const delay = fishBiteDelay(Math.random());
      this.fishLine = { roomId: room.id, biteAt: now + delay, token };
      status.setText('Esperando a que pique…');
      sfx('door');
      // Aviso de que pica (fuera del centro, como todos) y, si no recoges, se escapa
      this.time.delayedCall(delay, () => {
        if (this.fishLine?.token !== token || this.current?.id !== room.id) return;
        status.setText('¡Pica! ¡Recoge ya!');
        sfx('pickup');
        this.notify('¡Pica!\nEnter / A / clic para recoger', { kind: 'warning', icon: 'star' });
      });
      this.time.delayedCall(delay + 1500, () => this.fishLine?.token === token && this.endCast(room, status, 'late', rng));
      return;
    }
    this.endCast(room, status, hookResult(line.biteAt, now), rng);
  }

  /** Fin de un lanzamiento: premio si ha picado a tiempo; al gastar el último, la laguna se acaba. */
  private endCast(room: Room, status: Phaser.GameObjects.Text, res: 'early' | 'hooked' | 'late', rng: () => number) {
    this.fishLine = undefined;
    const last = !canCast(this.fishCasts.get(room.id) ?? FISH_MAX_CASTS);
    if (res !== 'hooked') {
      status.setText(res === 'early' ? 'Demasiado pronto: el pez se asusta' : 'Se ha escapado');
      this.notify(res === 'early' ? 'Demasiado pronto\nEl pez se ha asustado' : 'Se ha escapado', { kind: 'warning', icon: 'clock' });
    } else {
      const prize = fishPrize(rng(), this.passives);
      status.setText(FISH_PRIZE_LABEL[prize]);
      const p = this.freeSpot(this.player.x, this.player.y + 60);
      fishLeap(this, this.interior(room).cx, this.interior(room).cy - 20, p.x, p.y);
      if (prize === 'coins') this.spawnLoot(room.id, p.x, p.y, { kind: 'coin', value: fishCoins(this.floorNum) });
      else if (prize === 'berry') this.spawnLoot(room.id, p.x, p.y, { kind: 'berry', id: rng() < 0.25 ? 'zidra' : 'aranja' });
      else if (prize === 'item') this.dropItem(room.id, p.x, p.y);
      else if (prize === 'magikarp' || prize === 'gyarados') {
        // Easter egg (easterEggs.ts): el mismo pasivo que vende el mercader
        const item = passiveById(prize === 'magikarp' ? MAGIKARP : GYARADOS);
        if (item) this.gainItem({ kind: 'passive', item });
        this.refreshInventory();
      } else return this.hookRareFish(room, status);
      this.notify(`¡Has pescado algo!\n${FISH_PRIZE_LABEL[prize]}`, { kind: 'reward', icon: 'star' });
      sfx('pickup');
    }
    if (last) {
      this.notify('La laguna se ha quedado en calma', { kind: 'info', icon: 'star' });
      this.finishEvent(room);
    } else this.saveNow();
  }

  /** Premio gordo: un Pokémon de agua raro sale a pelear; al vencerlo suelta un objeto y monedas (eventFoeDefeated). */
  private hookRareFish(room: Room, status: Phaser.GameObjects.Text) {
    const water = this.foeKinds.filter((k) => k.types.includes('water'));
    const pool = water.length > 0 ? water : this.foeKinds;
    if (pool.length === 0) return this.finishEvent(room);
    const k = [...pool].sort((a, b) => b.bst - a.bst)[0];
    const e = this.spawnEnemy(k, k.behavior);
    const i = this.interior(room);
    (e.body as Body).reset(i.cx, i.cy - 20);
    const hp = Math.round((e.getData('maxHp') as number) * FISH_RARE_HP_MUL);
    // Reutiliza el camino del cofre trampa («mimic»): puertas cerradas y premio al caer
    e.setData('hp', hp).setData('maxHp', hp).setData('mimic', true).setData('fished', true);
    this.glowAura(e, 0x29b6f6);
    sparkle(this, e.x, e.y);
    void cry(Number(k.key.replace('foe-', '')));
    status.setText('¡Ha salido a pelear!');
    this.notify('¡Un Pokémon acuático raro!\nVéncelo para llevarte su botín', { kind: 'danger', icon: 'star' });
    this.setDoorsLocked(room, true, true);
  }

  private takeEgg(room: Room) {
    if (this.ended || this.transitioning || this.eventsDone.has(room.id)) return;
    if (this.eggLeft > 0) return this.notify('Ya llevas un huevo', { kind: 'warning', icon: 'star' });
    this.eggLeft = EGG_ROOMS;
    sfx('pickup');
    this.notify(`¡Huevo misterioso!\nEclosiona tras ${EGG_ROOMS} salas limpias`, { kind: 'item', icon: 'star' });
    this.finishEvent(room);
  }

  /** Al limpiar una sala: el huevo cuenta y, si toca, eclosiona; el cansancio de la fuente se pasa. */
  private onRoomClearedT48() {
    if (this.tiredRooms > 0) {
      this.tiredRooms--;
      if (this.tiredRooms === 0) {
        this.stats = this.calcStats();
        this.notify('Ya no estás cansado', { kind: 'info', icon: 'heart' });
      }
    }
    if (this.eggLeft <= 0) return;
    this.eggLeft = eggTick(this.eggLeft);
    if (this.eggLeft > 0) return void this.notify(`El huevo se mueve…\nFalta ${this.eggLeft} sala${this.eggLeft === 1 ? '' : 's'}`, { kind: 'info', icon: 'star' });
    const rng = mulberry32((this.floorSeed ^ (this.current.id * 7919 + 13)) >>> 0);
    sparkle(this, this.player.x, this.player.y);
    if (eggHatch(rng) === 'helper' && this.foeKinds.length > 0) {
      const k = this.foeKinds[Math.floor(rng() * this.foeKinds.length)];
      this.allyId = Number(k.key.replace('foe-', ''));
      this.spawnAlly();
      const name = k.name ? k.name.charAt(0).toUpperCase() + k.name.slice(1) : 'Un Pokémon';
      this.notify(`¡El huevo ha eclosionado!\n${name} te ayuda a pelear`, { kind: 'reward', icon: 'star' });
    } else {
      const p = this.freeSpot(this.player.x + 60, this.player.y);
      this.dropItem(this.current.id, p.x, p.y);
      this.notify('¡El huevo ha eclosionado!\nHabía un objeto dentro', { kind: 'reward', icon: 'star' });
    }
  }

  /**
   * T65: lanza una Poké Ball al enemigo capturable más cercano (normal, al 25 % de PS o menos y a tiro). Mientras se
   * sacude el enemigo queda dentro (invisible y sin cuerpo) para que nadie le pegue; luego se decide con captureChance.
   */
  private throwBall() {
    if (this.ended || this.transitioning || this.capturing || !this.player) return;
    const now = this.time.now;
    const check = canThrow(this.capture, now);
    // T88: al legendario de la cacería se le puede lanzar aunque ya hayas capturado en el piso
    const legend = this.enemies.getChildren().find((c) => (c as Sprite).active && (c as Sprite).getData('legendHunt')) as Sprite | undefined;
    if (legend && check !== 'cooldown') return this.throwLegendBall(legend);
    if (check === 'done') return this.notify('Ya has capturado en este piso', { kind: 'warning', icon: 'star' });
    if (check === 'cooldown') return this.notify('Espera un momento para lanzar otra Poké Ball', { kind: 'warning', icon: 'clock' });
    let best: Sprite | undefined;
    let bestD = CAPTURE_RANGE;
    let weakFarOrBad = false;
    for (const c of this.enemies.getChildren()) {
      const e = c as Sprite;
      if (!e.active || e.getData('capturing')) continue;
      const ok = canCapture(this.captureTarget(e));
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (ok && d <= bestD) {
        best = e;
        bestD = d;
      } else if (!ok && d <= CAPTURE_RANGE) weakFarOrBad = true;
    }
    if (!best) {
      return this.notify(weakFarOrBad ? 'Ese no se puede capturar\nDebilítalo al 25 % (jefes y élites, nunca)' : 'No hay ningún enemigo débil cerca', { kind: 'warning', icon: 'star' });
    }
    const target = best;
    const hp = target.getData('hp') as number;
    const max = (target.getData('maxHp') as number | undefined) ?? hp;
    const success = rollCapture(hp, max, Math.random());
    this.capturing = true;
    target.setData('capturing', true).setVisible(false).setVelocity(0, 0);
    const body = target.body as Body | null;
    if (body) body.enable = false;
    (target.getData('bar') as Phaser.GameObjects.Graphics | undefined)?.setVisible(false);
    const shakes = success ? 3 : 2;
    const from = { x: this.player.x, y: this.player.y };
    const to = { x: target.x, y: target.y };
    const flyMs = ballThrow(this, from, to);
    this.time.delayedCall(flyMs, () => {
      const shakeMs = ballShake(this, to.x, to.y, shakes);
      this.time.delayedCall(shakeMs, () => {
        if (success) ballSuccess(this, to.x, to.y);
        else ballEscape(this, to.x, to.y);
        this.finishCapture(target, success);
      });
    });
  }

  /** Lo que mira captureTarget: tipo de enemigo y vida (jefes, minijefes, élites, legendarios y los de evento no). */
  private captureTarget(e: Sprite) {
    const id = (e.getData('speciesId') as number | undefined) ?? 0;
    return {
      hp: e.getData('hp') as number,
      maxHp: (e.getData('maxHp') as number | undefined) ?? 1,
      boss: !!(e.getData('ai') as EnemyAI | undefined)?.boss,
      miniboss: !!e.getData('miniboss'),
      elite: !!e.getData('elite'),
      // Los legendarios y singulares de la partida son los jefes que salen (los de este piso y los ya vistos)
      legendary: id > 0 && (id === this.bossId || this.bossHistory.includes(id)),
      helper: !!e.getData('helper'),
      shinyBoss: !!e.getData('shiny') && !!(e.getData('ai') as EnemyAI | undefined)?.boss,
      special: !!(e.getData('runaway') || e.getData('thief') || e.getData('mimic') || e.getData('finale') || e.getData('rival')),
    };
  }

  /** T88: Poké Ball al legendario: solo en su última fase y al 15 % o menos; si falla, se escapa y sigue la pelea. */
  private throwLegendBall(target: Sprite) {
    const hp = target.getData('hp') as number;
    const max = (target.getData('maxHp') as number | undefined) ?? hp;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y) > CAPTURE_RANGE * 1.5) {
      return this.notify('Acércate más al legendario', { kind: 'warning', icon: 'star' });
    }
    if (!canCaptureLegend(hp, max)) {
      return this.notify('Aún no se deja capturar\nDebilítalo hasta su última fase (15 %)', { kind: 'warning', icon: 'star' });
    }
    const success = Math.random() < legendCaptureChance(hp, max);
    this.capturing = true;
    target.setData('capturing', true).setVisible(false).setVelocity(0, 0);
    const body = target.body as Body | null;
    if (body) body.enable = false;
    (target.getData('bar') as Phaser.GameObjects.Graphics | undefined)?.setVisible(false);
    const to = { x: target.x, y: target.y };
    const flyMs = ballThrow(this, { x: this.player.x, y: this.player.y }, to);
    this.time.delayedCall(flyMs, () => {
      const shakeMs = ballShake(this, to.x, to.y, success ? 3 : 2);
      this.time.delayedCall(shakeMs, () => {
        this.capturing = false;
        if (!target.active) return;
        if (!success || this.ended) {
          ballEscape(this, to.x, to.y);
          this.capture = { ...this.capture, readyAt: this.time.now + CAPTURE_RETRY_MS };
          target.setData('capturing', false).setVisible(true);
          if (body) body.enable = true;
          (target.getData('bar') as Phaser.GameObjects.Graphics | undefined)?.setVisible(true);
          if (!this.ended) this.notify('¡Se ha escapado!\nSigue intentándolo', { kind: 'warning', icon: 'star' });
          return;
        }
        ballSuccess(this, to.x, to.y);
        this.counters.kills++;
        this.registerDex(target);
        (target.getData('bar') as Phaser.GameObjects.Graphics | undefined)?.destroy();
        if (!lowFx()) sparkle(this, to.x, to.y);
        target.destroy();
        const id = this.hunt.legendId;
        if (!this.codeRun) unlockPokemon(id);
        this.hunt = finishLair(this.hunt);
        this.notify(`¡${this.legendName()} capturado!\nYa puedes elegirlo como inicial`, { kind: 'reward', icon: 'star' });
        sfx('evolve');
        this.checkClear();
        this.saveNow();
      });
    });
  }

  private legendName(): string {
    const n = this.legendKind?.name ?? 'El legendario';
    return n.charAt(0).toUpperCase() + n.slice(1);
  }

  /** T88: sala de la pista o de la guarida en este piso (una de combate, nunca la del minijefe ni la sorpresa). */
  private huntRoomId(): number | undefined {
    const ids = this.floor.rooms
      .filter((rm) => rm.kind === 'combat' && rm.group === undefined && rm.id !== this.minibossRoom && rm.id !== this.roomEvent?.roomId)
      .map((rm) => rm.id);
    return pickHuntRoom(ids, this.floorSeed);
  }

  /** T88: al entrar en una sala, la pista del rastro (si toca aquí) y el texto del rastro en la columna de avisos. */
  private huntEnterRoom(room: Room) {
    this.huntObjs.forEach((o) => o.destroy());
    this.huntObjs = [];
    if (room.kind === 'start' && !this.visitedHuntStart) {
      this.visitedHuntStart = true;
      const t = huntText(this.hunt);
      if (t) this.time.delayedCall(2200, () => !this.ended && this.notify(t, { kind: 'info', icon: 'star' }));
    }
    if (!clueOnFloor(this.hunt, this.floorNum) || room.id !== this.huntRoomId()) return;
    const kind = this.hunt.kinds[this.hunt.found];
    const i = this.interior(room);
    const x = i.x0 + 70;
    const y = i.y0 + 70;
    const mark = buildClue(this, x, y, kind);
    const z = this.add.zone(x, y, 48, 48).setInteractive({ useHandCursor: true });
    z.on('pointerover', () => (this.overHud = true));
    z.on('pointerout', () => (this.overHud = false));
    const take = () => {
      if (!clueOnFloor(this.hunt, this.floorNum) || this.current?.id !== room.id) return;
      this.hunt = takeClue(this.hunt, this.floorNum);
      this.huntObjs.forEach((o) => o.destroy());
      this.huntObjs = [];
      this.overHud = false;
      this.eventSpots = this.eventSpots.filter((sp) => sp.use !== take);
      sfx('pickup');
      this.notify(`${CLUE_NAMES[kind]}\n${huntText(this.hunt)}`, { kind: 'reward', icon: 'star' });
      this.saveNow();
    };
    z.on('pointerdown', take);
    this.huntObjs.push(mark, z);
    this.eventSpots.push({ x, y, prompt: () => (clueOnFloor(this.hunt, this.floorNum) ? 'Enter / A / clic: seguir el rastro' : ''), use: take });
  }

  private visitedHuntStart = false;

  /** T88: ¿esta sala es la guarida del legendario (aún sin pelear)? */
  private isLairRoom(room: Room): boolean {
    return !!this.legendKind && lairOnFloor(this.hunt, this.floorNum) && !this.cleared.has(room.id) && room.id === this.huntRoomId();
  }

  /** T88: el legendario de la cacería: más vida (HUNT.hpMul), fases que lo enfurecen y captura solo al final. */
  private spawnLegend(room: Room) {
    const k = this.legendKind!;
    const id = this.hunt.legendId;
    this.setGroupDoorsLocked(room, true, true);
    sfx('door');
    const e = this.spawnEnemy(k, k.behavior);
    const size = 130;
    e.setDisplaySize(size, size).setData('size', size).setData('sheet', k.key).setData('shiny', false).setData('elite', false);
    this.applyPmd(e, id, size);
    const st = bossStats(k.stats, this.difficulty);
    const hp = Math.round(st.hp * HUNT.hpMul);
    e.setData('hp', hp).setData('maxHp', hp).setData('dmg', st.damage).setData('speed', st.speed).setData('legendHunt', true);
    const ai = e.getData('ai') as EnemyAI;
    ai.moves = bossStyles(k.types, id);
    ai.eliteMove = ai.moves[0];
    ai.eliteAt = Number.POSITIVE_INFINITY;
    legendAura(this, e, typeColor(k.types[0]), () => {
      const bd = e.body as Body | null;
      return bd ? bd.bottom : e.y + e.displayHeight / 2;
    });
    const ri = this.interior(room);
    this.huntObjs.push(buildLegendLair(this, ri.cx, ri.cy, typeColor(k.types[0])));
    legendReveal(this, e.x, e.y, typeColor(k.types[0]));
    void cry(id);
    this.notify(`¡Sala oculta!\n${this.legendName()} te esperaba`, { kind: 'danger', icon: 'star' });
    this.showBossIntro(ai, { boss: { texture: `${k.key}-front`, name: this.legendName(), types: k.types }, tier: 'mini', subtitle: 'Cacería legendaria · Fase 1/3' });
    let phase = 0;
    const timer = this.time.addEvent({
      delay: 250, loop: true,
      callback: () => {
        if (!e.active || this.ended) return timer.remove();
        const p = legendPhase(e.getData('hp') as number, e.getData('maxHp') as number);
        if (p <= phase) return;
        phase = p;
        e.setData('speed', (e.getData('speed') as number) * 1.2).setData('dmg', Math.round((e.getData('dmg') as number) * 1.2));
        ai.eliteAt = this.time.now + 600;
        this.cameras.main.shake(200, 0.006);
        this.notify(p === 2 ? `¡${this.legendName()} está agotado! Fase 3/3\nLánzale la Poké Ball` : `¡${this.legendName()} se enfurece! Fase 2/3`, { kind: 'danger', icon: 'star' });
      },
    });
  }

  private finishCapture(target: Sprite, success: boolean) {
    this.capturing = false;
    if (!target.active) return;
    const name = this.foeKinds.find((k) => k.key === `foe-${target.getData('speciesId')}`)?.name;
    const nice = name ? name.charAt(0).toUpperCase() + name.slice(1) : 'El Pokémon';
    const caughtId = (target.getData('speciesId') as number | undefined) ?? 0;
    const r = resolveThrow(this.capture, this.time.now, success, this.allyId, caughtId);
    this.capture = r.state;
    if (!success || this.ended) {
      // Se escapa: vuelve a la sala tal cual estaba
      target.setData('capturing', false).setVisible(true);
      const body = target.body as Body | null;
      if (body) body.enable = true;
      if (!this.ended) this.notify(`Se ha escapado\n${nice} ha salido de la Poké Ball`, { kind: 'warning', icon: 'star' });
      return;
    }
    // Capturado: cuenta en el registro de combate (T63) y pasa a ser el ayudante hasta acabar el piso
    this.counters.kills++;
    this.chainShiny(target);
    this.registerDex(target);
    (target.getData('bar') as Phaser.GameObjects.Graphics | undefined)?.destroy();
    if (!lowFx()) sparkle(this, target.x, target.y);
    target.destroy();
    this.allyId = r.allyId;
    this.spawnAlly();
    this.notify(`¡${nice} capturado!\nTe ayuda hasta el final del piso`, { kind: 'reward', icon: 'star' });
    this.checkClear();
  }

  /** Poké Ball del HUD: a color si se puede lanzar, apagada si ya capturaste o estás esperando. */
  private paintBall(time: number) {
    const h = this.ballHud;
    if (!h) return;
    const state = canThrow(this.capture, time);
    if (h.shown === state) return;
    h.shown = state;
    const a = state === 'ok' ? 1 : 0.3;
    h.g.clear();
    drawBallIcon(h.g, h.x, h.y, a, state === 'done');
  }

  /** Ayudante del huevo: sigue al jugador y ataca al enemigo más cercano. Se crea si su dibujo está cargado. */
  private spawnAlly() {
    this.ally?.sprite.destroy();
    this.ally = undefined;
    const key = `foe-${this.allyId}`;
    if (!this.allyId || !this.textures.exists(`${key}-front`) || !this.player) return;
    const sprite = this.add.sprite(this.player.x - 50, this.player.y + 20, `${key}-front`).setDisplaySize(44, 44).setDepth(4) as Sprite;
    // Con hoja de movimiento (la del enemigo capturado) se ve en las 8 direcciones, como los demás
    this.applyPmd(sprite, this.allyId, 44);
    const type = this.foeKinds.find((k) => k.key === key)?.type ?? 'normal';
    this.ally = { sprite, type, nextAt: this.time.now + HELPER_ATTACK_MS };
  }

  private updateAlly(time: number, delta: number) {
    const a = this.ally;
    if (!a || !this.player) return;
    const s = a.sprite;
    // Va detrás del jugador, un poco a un lado
    const tx = this.player.x - 50;
    const ty = this.player.y + 20;
    const f = Math.min(1, (delta / 1000) * 6);
    const mx = tx - s.x;
    const my = ty - s.y;
    s.setPosition(s.x + mx * f, s.y + my * f + Math.sin(time / 180) * 0.6);
    // Mira hacia donde camina; parado, hacia el jugador
    if (s.getData('pmd')) this.face(s, Math.hypot(mx, my) > 6 ? { x: mx, y: my } : { x: this.player.x - s.x, y: this.player.y - s.y });
    else s.setFlipX(this.player.x > s.x);
    if (this.ended || this.transitioning || time < a.nextAt) return;
    a.nextAt = time + HELPER_ATTACK_MS;
    let best: Sprite | undefined;
    let bestD = 520;
    for (const c of this.enemies.getChildren()) {
      const e = c as Sprite;
      if (!e.active || e.getData('runaway') || e.getData('thief') || e.getData('capturing')) continue;
      const d = Phaser.Math.Distance.Between(s.x, s.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best) return;
    const target = best;
    const color = typeColor(a.type);
    const ball = this.add.circle(s.x, s.y, 7, color).setStrokeStyle(2, 0xffffff, 0.9).setDepth(6);
    if (s.getData('pmd')) this.face(s, { x: target.x - s.x, y: target.y - s.y });
    else s.setFlipX(target.x > s.x);
    this.tweens.add({
      targets: ball, x: target.x, y: target.y, duration: Math.max(120, bestD * 0.9),
      onComplete: () => {
        ball.destroy();
        if (target.active && !this.ended) this.hitEnemy(target, Math.max(1, this.stats.damage * HELPER_DAMAGE_MUL), a.type, target.x, target.y, color);
      },
    });
  }

  /** Sala del tiempo: cuenta atrás; si se acaba con enemigos vivos, entran más. */
  private updateTimeTrial(time: number) {
    const t = this.timeTrial;
    if (!t || this.current?.id !== t.roomId) return;
    const left = Math.max(0, Math.ceil((t.until - time) / 1000));
    t.label.setText(t.failed ? '¡Tiempo!' : `⏱ ${left} s`).setColor(left <= 5 || t.failed ? '#ff6e6e' : '#ffd34d');
    if (!t.failed && time >= t.until && !this.ended && !this.transitioning) {
      t.failed = true;
      this.cameras.main.shake(160, 0.005);
      this.notify('¡Se acabó el tiempo!\nEntran más enemigos', { kind: 'danger', icon: 'clock' });
      this.spawnEnemies(timeTrialExtra(this.floorNum));
    }
  }

  /** Tickets ganados con la dificultad (T40): se suman al total y a los de la partida; devuelve cuántos. */
  private giveTickets(base: number): number {
    const n = scaleTickets(base, this.diff);
    if (n > 0) {
      this.earned += n;
      addTickets(n);
      addCandies(n * CANDY_PER_TICKET);
    }
    return n;
  }

  /** Nivel de dificultad: el piso, el jefe por el que vas o, en Oleadas, el que toca a la ronda. */
  private level(): number {
    if (this.mode === 'tower') return towerLevel(this.floorNum); // T72: sube suave (100 pisos)
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
      behavior: behaviorForSpecies(c.types, c.id),
      bst: index.find((s) => s.id === c.id)?.bst ?? regionalForm(c.id)?.bst ?? 300,
      type: c.types[0] ?? 'normal',
      types: c.types.length > 0 ? [...c.types] : ['normal'],
      stats: c.stats,
      name: c.name,
    }));
  }

  /** Oleadas: al subir de nivel, cambia a especies más fuertes (si no se pueden cargar, siguen las de antes). */
  private async reloadFoes(level: number) {
    const index = await loadSpeciesIndex().catch(() => [] as SpeciesFact[]);
    this.biome = biomeFor(this.mode, level);
    const ids = applyRegionalForms(pickMixedFoes(index, level, this.biome, this.foeRng(level)), this.biome.types, this.foeRng(level + 131));
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
    bakeTypeFx(this);
    bakeProjectiles(this);
    bakeCombatFx(this);
    bakeItemIcons(this);
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
    this.roomObjs.clear();
    this.floor.rooms.forEach((r) => {
      const before = this.children.list.length;
      this.buildRoom(r);
      this.roomObjs.set(r.id, this.children.list.slice(before));
    });
    // Minijefe del piso (Normal e Infinito): la sala de combate más lejos de la entrada
    this.minibossRoom = undefined;
    if ((this.mode === 'normal' || this.mode === 'endless') && !isFinalFloor(this.mode, this.floorNum)) {
      const st = this.floor.rooms[this.floor.startId];
      const far = this.floor.rooms
        .filter((rm) => rm.kind === 'combat' && rm.group === undefined)
        .sort((a, b) => Math.abs(b.gx - st.gx) + Math.abs(b.gy - st.gy) - (Math.abs(a.gx - st.gx) + Math.abs(a.gy - st.gy)) || a.id - b.id)[0];
      this.minibossRoom = far?.id;
    }
    // T72: en la Torre, el minijefe «chetado» ocupa la sala entera de su piso
    if (this.towerSpec?.kind === 'miniboss') this.minibossRoom = 0;
    // Sala sorpresa (T39): con la semilla del piso (la misma al continuar), nunca la del minijefe ni las de cofre
    this.roomEvent =
      (this.mode === 'normal' || this.mode === 'endless') && !isFinalFloor(this.mode, this.floorNum)
        ? pickRoomEvent(this.floor, this.floorNum, mulberry32(this.floorSeed ^ 0x2545f491), new Set([...(this.minibossRoom !== undefined ? [this.minibossRoom] : []), ...this.floor.rooms.filter((rm) => rm.group !== undefined).map((rm) => rm.id)]), this.biome.types, this.daily ? DAILY_EVENTS : ROOM_EVENTS)
        : null;
    // T80: el premio de la ruta (mercader, fuente o historia) es la sala sorpresa del piso, siempre
    const routeEvent = this.route ? ROUTE_EVENT[this.route.reward] : undefined;
    if (routeEvent && (this.mode === 'normal' || this.mode === 'endless') && !isFinalFloor(this.mode, this.floorNum)) {
      const exclude = new Set([...(this.minibossRoom !== undefined ? [this.minibossRoom] : []), ...this.floor.rooms.filter((rm) => rm.group !== undefined).map((rm) => rm.id)]);
      this.roomEvent = pickRoomEvent(this.floor, this.floorNum, forcedEventRng(mulberry32(this.floorSeed ^ 0x2545f491)), exclude, this.biome.types, [routeEvent]) ?? this.roomEvent;
    }
    // T56: reglas de sala, con otra semilla del piso; nunca en la del evento ni la del minijefe (ya tienen lo suyo) ni
    // en las salas grandes (se puede entrar por cualquiera de sus casillas y la regla quedaría en otra)
    this.roomRules =
      this.mode === 'normal' || this.mode === 'endless'
        ? pickRoomRules(this.floor, this.floorNum, mulberry32(this.floorSeed ^ 0x6c8e9cf5), new Set([...(this.minibossRoom !== undefined ? [this.minibossRoom] : []), ...(this.roomEvent ? [this.roomEvent.roomId] : []), ...this.floor.rooms.filter((rm) => rm.group !== undefined).map((rm) => rm.id)]))
        : new Map();
    // Santuario de la Mega Piedra: una sala por piso (Normal, Infinito y diario), elegida DESPUÉS de lo demás y con su
    // propia semilla para no alterar el resto del piso (ver pickMegaStoneRoom)
    this.megaRoomId = undefined;
    if ((this.mode === 'normal' || this.mode === 'endless') && !isFinalFloor(this.mode, this.floorNum)) {
      // Solo en una sala de combate normal; si no queda ninguna, se convierte la menos especial (sin regla o sin evento)
      const plan = planMegaStoneRoom(this.floor, this.floorSeed, { miniboss: this.minibossRoom, eventRoom: this.roomEvent?.roomId, ruleRooms: this.roomRules.keys() });
      if (plan) {
        this.megaRoomId = plan.roomId;
        if (plan.dropRule) this.roomRules.delete(plan.roomId);
        if (plan.dropEvent) this.roomEvent = null;
      }
    }
    // T72: la regla del piso de la Torre vale para todas sus casillas (es una sola sala)
    const tRule = this.towerSpec?.rule;
    if (tRule) this.roomRules = new Map(this.floor.rooms.map((rm) => [rm.id, tRule]));

    // Al continuar: objetos, estado del jugador y sala donde estabas
    const r = this.resume;
    if (r) this.restoreRun(r);
    // T62: el piso empieza a contar ya con los contadores buenos (los del piso anterior o los de la partida guardada)
    openFloor(this.counters);

    // Jugador, con un cuerpo circular más pequeño que el arte para pasar por las puertas
    const start = this.floor.rooms[r?.roomId ?? this.floor.startId] ?? this.floor.rooms[this.floor.startId];
    const si = this.interior(start);
    this.player = this.physics.add.sprite(si.cx, si.cy, `${this.playerKey}-front`);
    this.player.setDisplaySize(84, 84).setDepth(5).setData('sheet', this.playerKey).setData('size', 84);
    const fw = this.player.width;
    const pr = Math.min(fw * 0.3, PLAYER_BODY_R / this.player.scaleX);
    this.player.setCircle(pr, fw / 2 - pr, fw / 2 - pr);
    if (!this.shiny) this.applyPmd(this.player, this.formId, 84, true);
    // T74: al continuar con la megaevolución a medias, vuelve a ponerse la forma
    // T75: al continuar con Dinamax/Gigamax, el tamaño o la forma Gigamax; la mega, su sprite; el Tera no cambia de sprite
    const pf = this.powerForm.active;
    if (powerFormActive(this.powerForm)) {
      if (pf === 'mega') void this.applyMegaLook();
      else if (pf === 'dynamax' || pf === 'gigamax') void this.applyMaxLook(pf);
    }

    this.enemies = this.physics.add.group();
    this.shots = this.physics.add.group();
    this.foeShots = this.physics.add.group();
    this.host = this.makeHost();

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
    // Teclas configurables (T44, Ajustes > Teclas): moverse, disparar, poderes, activo, bomba, pausa, usar y volver
    const b = loadKeys();
    const key = (a: Action) => kb.addKey(keyCode(b[a]));
    this.wasd = { W: key('up'), A: key('left'), S: key('down'), D: key('right') };
    this.arrows = { up: key('shootUp'), down: key('shootDown'), left: key('shootLeft'), right: key('shootRight') } as Phaser.Types.Input.Keyboard.CursorKeys;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.abilityKeys = (['power1', 'power2', 'power3', 'power4'] as const).map(key);
    this.restartKey = kb.addKey(K.R);
    this.enterKey = key('accept');
    this.bombKey = key('bomb');
    this.potionKey = key('potion');
    this.parryKey = key('parry');
    this.ballKey = key('ball');
    this.chargeKey = key('charge');
    this.megaInputKey = key('mega');
    this.activeKey = key('active');
    this.escKey = key('back');
    this.pauseKey = key('pause');
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
    const txt = (x: number, y: number, size: number, color: string = '#f8f8f8', bold = false) =>
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
    hud(drawHudFrame(this.add.graphics(), LX + HL.pause.x, HL.pause.y, HL.pause.w, HL.pause.h));
    const pb = over(
      hud(this.add.text(LX + HL.pause.x + HL.pause.w / 2, HL.pause.y + HL.pause.h / 2, '❚❚', { fontFamily: FONT, fontSize: '28px', color: '#f8f8f8' }))
        .setOrigin(0.5)
        .setPadding(14, 12)
        .setInteractive({ useHandCursor: true }),
    );
    // T53: cuadro del parry a la derecha de la pausa (la recarga se ve vaciándose); clic en él también hace parry,
    // aunque con ratón lo cómodo es el clic central, que no obliga a quitar el puntero de donde apuntas.
    {
      const { x: px0, y: py, w: pw, h: ph } = HL.parry;
      const px = LX + px0;
      this.parryHud = { g: hud(this.add.graphics()), x: px, y: py, w: pw, h: ph, shown: '' };
      txt(px + 12, py + ph / 2, 14, '#f8f8f8', true).setOrigin(0, 0.5).setText('Parry');
      const parryBtn = over(hud(this.add.zone(px + pw / 2, py + ph / 2, pw, ph).setInteractive({ useHandCursor: true })));
      parryBtn.on('pointerdown', () => this.doParry());
    }
    // T55: barra de adrenalina debajo del parry (se llena con bajas, esquivas y parrys; al llenarse, subidón)
    {
      const a = HL.adrenaline;
      const g = hud(this.add.graphics());
      const text = txt(LX + a.x + a.w / 2, a.y + a.h / 2, 12, '#f8f8f8', true).setOrigin(0.5).setText('Adrenalina');
      this.adrenalineHud = { g, text, x: LX + a.x, y: a.y, w: a.w, h: a.h, shown: '' };
      // T75: medidor de poder, una tira fina entre la adrenalina y la ficha (solo con Banda Dinamax, Teragema o Cristal Z)
      this.powerMeterHud = { g: hud(this.add.graphics()), x: LX + HL.meter.x, y: HL.meter.y, w: HL.meter.w, h: HL.meter.h, shown: '' };
    }
    // Ficha del Pokémon: nombre, progreso y PS
    hud(drawHudFrame(this.add.graphics(), LX, HL.card.y, LW, HL.card.h));
    this.nameText = txt(LX + HL.name.x, HL.name.y, 24, '#f8f8f8', true).setOrigin(0, 0.5);
    // El progreso (piso, clima, huevo, enemigos…) puede ser largo: dos líneas como mucho, dentro de la ficha
    this.progressHud = txt(LX + HL.progress.x, HL.progress.y, HUD_PROGRESS_FONT, '#b8c4e0')
      .setOrigin(0, 0)
      .setWordWrapWidth(HL.progress.w, true)
      .setMaxLines(2);
    this.hpBar = addHpBar(this, LX + HL.hpBar.x, HL.hpBar.y, HL.hpBar.w, HL.hpBar.h);
    this.hpBar.objects.forEach((o) => hud(o));
    this.hpText = txt(LX + HL.hpText.x, HL.hpText.y, 20, '#f8f8f8', true).setOrigin(1, 0.5);
    // Monedas, llaves y bombas (clic en la bomba para soltar una)
    hud(drawHudFrame(this.add.graphics(), LX, HL.counters.y, LW, HL.counters.h));
    const count = (iconKey: string, x: number) => {
      hud(this.add.image(x, HL.counterIconY, iconKey).setScale(2));
      return txt(x + 15, HL.counterIconY, 16, '#f8f8f8', true).setOrigin(0, 0.5);
    };
    {
      // Esquina superior izquierda de la sala, en coordenadas reales de pantalla
      const k = GAME_VIEW.w / VIEW.w;
      this.comboHud = new ComboHud(this, GAME_VIEW.x + (ROOM.x + 22) * k, GAME_VIEW.y + (ROOM.y + 36) * k, FONT, hud);
      // T84: contador de la cadena shiny, debajo del combo (la estrella la pinta shinyChainBadge a su izquierda)
      this.shinyChainHud = hud(
        this.add.text(GAME_VIEW.x + (ROOM.x + 22) * k + 18, GAME_VIEW.y + (ROOM.y + 96) * k, '', { fontFamily: FONT, fontSize: '16px', color: '#ffd34d', stroke: '#000000', strokeThickness: 4 }),
      ).setVisible(false);
    }
    // T49: cuatro contadores (monedas, llaves, bombas y pociones); clic en la bomba o en la poción para usarlas
    this.coinsHud = count(iconKey('coin'), LX + HUD_COUNT_X.coin);
    this.keysHud = count(iconKey('key'), LX + HUD_COUNT_X.key);
    this.bombsHud = count(iconKey('bomb'), LX + HUD_COUNT_X.bomb);
    this.potionsHud = count(iconKey('potion'), LX + HUD_COUNT_X.potion);
    const bombBtn = over(hud(this.add.zone(LX + HUD_COUNT_X.bomb + 12, HL.counterIconY + 8, 50, 60).setInteractive({ useHandCursor: true })));
    bombBtn.on('pointerdown', () => this.placeBomb());
    const potionBtn = over(hud(this.add.zone(LX + HUD_COUNT_X.potion + 12, HL.counterIconY + 8, 50, 60).setInteractive({ useHandCursor: true })));
    potionBtn.on('pointerdown', () => this.drinkPotion());
    // Objetos pasivos
    this.invText = hud(this.add.text(LX + 2, HL.itemsTitleY, '', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#ffffff' }));
    // Objeto activo: abajo a la izquierda (clic para usarlo)
    this.activeHud = {
      g: hud(this.add.graphics()),
      text: txt(LX + 70, H - 82, 15, '#f8f8f8', true).setOrigin(0, 0.5),
      shown: '',
    };
    const activeBtn = over(hud(this.add.zone(LX + LW / 2, H - 71, LW, 110).setInteractive({ useHandCursor: true })));
    // Con qué se usa cada cosa (se redibuja al cambiar de teclado a mando): bomba, poción y objeto activo
    const badge = (x: number, y: number, pad: string, action: 'active' | 'bomb' | 'potion' | 'parry' | 'ball' | 'mega', maxW = 60) =>
      this.actionBadges.push({ g: hud(this.add.graphics()), t: txt(x, y, 11, '#1d2848', true).setOrigin(0.5), x, y, pad, action, maxW });
    badge(LX + HUD_COUNT_X.bomb + 6, HL.counterBadgeY, 'RB', 'bomb', HUD_BADGE_MAX_W.counter);
    badge(LX + HUD_COUNT_X.potion + 6, HL.counterBadgeY, 'L3', 'potion', HUD_BADGE_MAX_W.counter);
    badge(LX + LW - 36, H - HUD.pad - 110 + 18, 'LB', 'active');
    badge(LX + HL.parryBadge.x, HL.parryBadge.y, 'RT', 'parry', 36);
    // T65: Poké Ball arriba a la derecha del cuadro del nombre (clic para lanzarla)
    this.ballHud = { g: hud(this.add.graphics()), x: LX + HL.ball.x, y: HL.ball.y, shown: '' };
    const ballBtn = over(hud(this.add.zone(LX + HL.ball.x, HL.ball.y + 10, 42, 56).setInteractive({ useHandCursor: true })));
    ballBtn.on('pointerdown', () => this.throwBall());
    badge(LX + HL.ball.x, HL.ball.badgeY, 'R3', 'ball', HUD_BADGE_MAX_W.ball);
    // T74: Mega Piedra a la izquierda de la Poké Ball (clic para megaevolucionar). Solo se ve si se ofrece (paintMega)
    this.megaHud = { g: hud(this.add.graphics()), x: LX + HL.mega.x, y: HL.mega.y, shown: '' };
    const megaZone = this.add.zone(LX + HL.mega.x, HL.mega.y + 10, 42, 56).setInteractive({ useHandCursor: true });
    over(hud(megaZone));
    megaZone.on('pointerdown', () => this.powerButton());
    this.megaZone = megaZone;
    badge(LX + HL.mega.x, HL.mega.badgeY, '↑', 'mega', HUD_BADGE_MAX_W.mega);
    activeBtn.on('pointerdown', () => this.useActive());
    // Poderes: cuatro cuadros abajo a la derecha (clic para lanzar)
    for (let i = 0; i < SLOT_COUNT; i++) {
      const y = this.slotY(i);
      this.slotBoxes.push(hud(this.add.graphics()));
      this.slotTypes.push(
        txt(RX + RW - 52, y + 2, 12, '#ffffff', true).setOrigin(0.5).setShadow(1, 1, '#00000088', 0),
      );
      this.slotShown.push('');
      this.slotBadges.push(txt(RX + 30, y + 34, 13, '#ffffff', true).setOrigin(0.5).setShadow(1, 1, '#00000088', 0));
      this.hud.push(txt(RX + 50, y + 34, 18, '#f8f8f8', true).setOrigin(0, 0.5));
      const zone = over(hud(this.add.zone(RX + RW / 2, y + 32, RW, 64).setInteractive({ useHandCursor: true })));
      zone.on('pointerdown', () => !this.ended && !this.transitioning && this.castSlot(i, this.time.now));
    }
    // Minimapa arriba a la derecha
    this.minimap = hud(this.add.graphics());
    // Contador de FPS (Ajustes > Mostrar FPS), abajo a la derecha
    if (loadFx().showFps) this.fpsText = hud(this.add.text(W - 8, H - 6, '', { fontFamily: FONT, fontSize: '16px', color: '#9fe39a' }).setOrigin(1, 1));
    // Controles táctiles (T35), solo en móvil o tableta (en PC nunca)
    this.touch = touchOnlyDevice() ? new TouchControls(this, (o) => void hud(o)) : undefined;
    this.hurtFlash = hud(this.add.rectangle(GAME_VIEW.x + GAME_VIEW.w / 2, GAME_VIEW.y + GAME_VIEW.h / 2, GAME_VIEW.w, GAME_VIEW.h, 0xff2a2a, 0));
    // Avisos (T37): tarjetas en la franja derecha, bajo el minimapa
    this.toasts?.clear();
    this.offlineOff?.();
    this.offlineOff = onOfflineData(() => this.notifyOffline());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.offlineOff?.());
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
    // T53: con ratón, el parry es el clic central (rueda): no hay que quitar el puntero de donde apuntas
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => p.middleButtonDown() && this.doParry());

    // Tienda: al continuar, lo que quedaba; si no, artículos nuevos para este piso
    if (this.floor.shopId !== undefined) {
      if (this.shop.length === 0) this.shop = rollShop(this.rng(RNG.shop), new Set(this.passives), this.movePool, this.passivePool(), this.floorNum);
      this.buildShop(this.floor.rooms[this.floor.shopId]);
    }
    this.prompt = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#ffffff', align: 'center' })
      .setOrigin(0.5, 1)
      .setDepth(12)
      .setStroke('#1d2848', 5);

    // Si ya habías vencido al jefe, la trampilla sigue ahí
    if (this.mode === 'tower') this.towerEnter();
    else if (this.mode !== 'waves' && this.cleared.has(this.floor.bossId)) {
      if (isFinaleGate(this.mode, this.floorNum)) this.spawnTrapdoor(true);
      else if (!isLastStage(this.mode, this.floorNum)) this.spawnTrapdoor();
    }

    this.refreshInventory();
    this.cameras.main.centerOn(si.cx, si.cy);
    // T72: llegada al piso nuevo de la Torre con su destello
    if (this.mode === 'tower' && this.carry && !this.resume) towerArrive(this, this.player.x, this.player.y, { lift: this.player, low: lowFx() });
    // Música del bioma (la del jefe la pone spawnBoss); al salir de la partida, la del menú
    playTrack(trackForBiome(this.biome.id));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => playMenuMusic());
    // Llegada por la trampilla: cartel del piso y el jugador cae desde arriba (antes de entrar en la sala, para
    // que la intro del jefe de las arenas espere a que acabe)
    if (this.carry && !r) this.showFloorIntro();
    this.enterRoom(start);
    // T80: ruta de «mejor botín»: un objeto más en la sala de llegada
    if (this.carry && !r && this.route?.reward === 'loot') this.dropItem(start.id, si.cx, si.cy + 110);
    void this.loadAbility(this.formId);
    if (usingOfflineData()) this.notifyOffline();
    // En Oleadas el cartel de la ronda lo pone startWave
    if (this.mode !== 'waves') {
      const where = progressText(this.mode, this.floorNum);
      const head = r ? 'Partida cargada' : this.runLabel();
      this.notify(`${head}
${where} — ${this.biome.name}`, { kind: 'info', icon: 'trapdoor' });
    }
    if (this.allyId) this.spawnAlly();
    if (this.weather) {
      this.weatherFx = new WeatherFx(this, this.weather, 20, this.fxBudget.low);
      const w = this.weather;
      this.time.delayedCall(900, () => !this.ended && this.notify(`${WEATHER_LABEL[w]}\n${WEATHER_DESC[w]}`, { kind: 'info', icon: 'star' }));
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
      // Las líneas de tres formas evolucionan en los pisos 2 y 4; las de dos, una vez en el piso 3 (evolution.ts)
      const left = await fetchEvolutionsLeft(this.starterId).catch(() => 2);
      if (!evolveFloors(this.mode, left).includes(this.floorNum)) return;
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
      sfx('evolve');
      this.cameras.main.flash(600, 255, 255, 255);
      // Parpadeo en blanco, como en los juegos, y al final cambia de forma
      this.player.setTintFill(0xffffff);
      evolveGlow(this, this.player, 1320);
      this.tweens.add({
        targets: this.player,
        alpha: 0.3,
        yoyo: true,
        repeat: 5,
        duration: 110,
        onComplete: () => {
          if (!this.player?.active) return;
          this.player.clearTint().setAlpha(1);
          {
            const pb = this.player.body as Body | null;
            evolveBurst(this, this.player.x, this.player.y, pb ? pb.bottom : this.player.y + 30);
          }
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
          if (data.types.length > 0) this.playerTypes = [...data.types];
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


  // --- Megaevolución del jugador (T74, powerForm.ts) ---

  /** Nombre del Pokémon del jugador con mayúscula para los avisos. */
  private niceName(): string {
    return this.starterName.charAt(0).toUpperCase() + this.starterName.slice(1);
  }

  /** Especie de la forma actual (la mega depende de ella: Charmander no, Charizard sí). */
  private megaContext() {
    return { speciesId: this.formId, passives: this.passives, adrenalineFull: adrenalineFull(this.adrenaline) };
  }

  /**
   * Megaevoluciona si se cumple todo: Mega Piedra, especie con mega, adrenalina llena (se gasta) y no usada en el piso.
   * Dura POWER_FORMS.mega.durationMs: más daño, velocidad y PS máximos, y una descarga de su tipo cada pocos segundos.
   */
  private megaEvolve() {
    if (this.ended || this.transitioning || this.falling || !this.player?.active || this.scene.isPaused()) return;
    const ctx = this.megaContext();
    // Sin piedra o sin mega en los juegos no se ofrece: el botón ni se ve, así que tampoco se avisa
    if (!megaOffered(ctx)) return;
    const why = megaBlock(this.powerForm, ctx);
    if (why) return this.notify(MEGA_BLOCK_TEXT[why], { kind: 'warning', icon: 'pokeball' });
    spendAdrenaline(this.adrenaline);
    if (this.adrenalineHud) this.adrenalineHud.shown = '';
    this.powerForm = startPowerForm(this.powerForm, 'mega');
    this.powerFormLoopAt = this.game.loop.time;
    this.megaPulseAt = this.game.loop.time + POWER_FORMS.mega.pulseMs;
    // Los PS máximos extra también curan lo mismo (como al evolucionar)
    const prevMax = this.stats.maxHp;
    this.stats = this.calcStats();
    this.hp = Math.min(this.stats.maxHp, this.hp + Math.max(0, this.stats.maxHp - prevMax));
    this.hpMark = this.hp;
    sfx('evolve');
    const pb = this.player.body as Body | null;
    // Mega Piedra, crisálida de luz y símbolo mega (con efectos bajos, solo un anillo)
    playerMegaFx(this, this.player.x, this.player.y, pb ? pb.bottom : this.player.y + 30, typeColor(this.tearType));
    if (!lowFx()) this.cameras.main.flash(300, 255, 255, 255);
    this.notify(`¡${megaDisplayName(this.formId, this.niceName())}!\nMás daño, velocidad y PS durante ${Math.round(POWER_FORMS.mega.durationMs / 1000)} s`, { kind: 'item', icon: 'pokeball' });
    void cry(this.formId);
    void this.applyMegaLook();
    this.saveNow();
  }

  /**
   * Cambia al sprite de la forma mega de PokeAPI si lo hay (se carga la primera vez). Si no hay red o la forma no trae
   * sprite, se queda el normal y updatePowerForm le pone el brillo de evolveGlow cada pocos segundos.
   */
  private async applyMegaLook() {
    const form = megaFormName(this.formId);
    if (!form) return;
    const sprites = await fetchFormSprites(form);
    if (!sprites || !powerFormActive(this.powerForm) || !this.player?.active) return;
    const key = `mega-${form}${this.shiny ? '-s' : ''}`;
    const urls = pickSprites(sprites, this.shiny);
    await new Promise<void>((resolve) => {
      let queued = 0;
      for (const side of ['front', 'back'] as const) {
        if (this.textures.exists(`${key}-${side}`)) continue;
        this.load.image(`${key}-${side}`, urls[side]);
        queued++;
      }
      if (queued === 0) return resolve();
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.start();
    });
    if (!this.textures.exists(`${key}-front`) || !powerFormActive(this.powerForm) || !this.player?.active || this.ended) return;
    for (const side of ['front', 'back']) {
      if (this.textures.exists(`${key}-${side}`)) this.textures.get(`${key}-${side}`).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.megaKey = key;
    // Un poco más grande: la forma mega impone más (el cuerpo físico es el de siempre)
    this.setStaticLook(key, 96);
  }

  /** Pone un sprite de PokeAPI (sin hoja animada de SpriteCollab) con su cuerpo redondo de siempre. */
  private setStaticLook(sheet: string, size: number) {
    const p = this.player;
    p.anims.stop();
    p.setData('pmd', undefined).setData('sheet', sheet).setData('size', size).setData('facing', undefined);
    p.setTexture(`${sheet}-front`).setFlipX(false).setScale(1).setDisplaySize(size, size);
    const fw = p.width;
    const pr = Math.min(fw * 0.3, PLAYER_BODY_R / p.scaleX);
    p.setCircle(pr, fw / 2 - pr, fw / 2 - pr);
    this.face(p, this.aim);
  }

  /** Vuelve a la forma normal: sprite de antes, sin PS extra (sin matarte) y aviso. */
  private endPowerForm() {
    this.stats = this.calcStats();
    this.hp = Math.max(1, Math.min(this.hp, this.stats.maxHp));
    this.hpMark = this.hp;
    if (this.player?.active && this.megaKey) {
      this.setStaticLook(this.playerKey, 84);
      if (!this.shiny) this.applyPmd(this.player, this.formId, 84, true);
      this.face(this.player, this.aim);
    }
    this.megaKey = null;
    if (!this.ended) this.notify(`${this.niceName()} vuelve a su forma normal`, { kind: 'info', icon: 'pokeball' });
    this.saveNow();
  }

  /** Cada fotograma: avanza la forma con game.loop.time, suelta la descarga de su tipo y el brillo si no hay sprite. */
  private updatePowerForm() {
    const now = this.game.loop.time;
    const dt = now - this.powerFormLoopAt;
    this.powerFormLoopAt = now;
    // T75: el medidor baja poco a poco si no peleas (con el mismo paso recortado: la pausa no lo vacía)
    if (!this.ended) tickPowerMeter(this.powerMeter, dt);
    // Aura de la forma: la mega (ligera) y la roja del Dinamax si no hay sprite Gigamax; sin sprite propio, más grande
    const formNow = powerFormActive(this.powerForm) ? this.powerForm.active : null;
    const auraKind = formNow === 'mega' ? 'mega' : (formNow === 'dynamax' || formNow === 'gigamax') && this.megaKey === this.playerKey ? 'max' : null;
    if (this.player) playerFormAura(this, this.player, auraKind, typeColor(this.tearType), (this.player.body as Body | null)?.bottom ?? this.player.y + 30, auraKind === 'max' || !this.megaKey);
    if (!powerFormActive(this.powerForm)) return;
    if (tickPowerForm(this.powerForm, dt)) return this.endPowerForm();
    // Sin sprite mega: el normal con el brillo de evolución de vez en cuando (con efectos bajos, nada)
    if (!this.megaKey && !lowFx() && now >= this.megaGlowAt && this.player?.active) {
      this.megaGlowAt = now + 4000;
      evolveGlow(this, this.player, 900);
    }
    // Pulso propio: la «Mega descarga» o el ataque Gigamax (Dinamax y Tera no tienen)
    const pulse = POWER_FORMS[this.powerForm.active!].pulseMs;
    if (pulse > 0 && now >= this.megaPulseAt) {
      this.megaPulseAt = now + pulse;
      this.megaPulse();
    }
  }

  /**
   * Ataque nuevo de la forma mega: «Mega descarga», un anillo de 8 disparos grandes de su tipo alrededor del jugador.
   * Sale solo cada pulseMs para no pedir otro botón.
   */
  private megaPulse() {
    if (!this.player?.active || this.ended || this.enemies.countActive(true) === 0) return;
    const s = this.stats;
    const basic = basicShotFor(this.shotType());
    const opts = {
      damage: s.damage * 1.5 * this.dmgMul(),
      speed: s.shotSpeed * basic.speed,
      life: s.range * 0.8,
      size: 1.1 * s.shotScale * basic.size,
      color: typeColor(this.shotType()),
      type: this.shotType(),
      pierce: s.pierce + 1,
      bounces: 0,
      motion: basic.motion,
      anim: basic.anim,
    };
    sfx(shotSfx(this.shotType()));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      this.spawnShot(new Phaser.Math.Vector2(Math.cos(a), Math.sin(a)), 0, opts);
    }
  }

  /** T75: lo que piden Dinamax, Tera y Z. */
  private powerContext(): PowerContext {
    return { speciesId: this.formId, passives: this.passives, meter: this.powerMeter.value, hp: this.hp, maxHp: this.stats.maxHp, zUsed: this.zUsed };
  }

  /** ¿Se ve el botón de forma de poder? Con la mega o con alguna forma de T75 que se ofrezca. */
  private powerButtonOffered(): boolean {
    return megaOffered(this.megaContext()) || pickPower(this.powerForm, this.powerContext()) !== null;
  }

  /** Tipo de los disparos: el Tera mientras dura, si no el de siempre. */
  private shotType(): string {
    return powerFormTeraType(this.powerForm) ?? this.tearType;
  }

  /**
   * T75: el botón de forma de poder (el de la mega). La mega va primero si se puede; si no, la forma de T75 que toque
   * (pickPower); si no se puede ninguna, el aviso de la que se ofrece.
   */
  private powerButton() {
    if (this.ended || this.transitioning || this.falling || !this.player?.active || this.scene.isPaused()) return;
    const mctx = this.megaContext();
    const megaOk = megaOffered(mctx) && megaBlock(this.powerForm, mctx) === null;
    const pick = pickPower(this.powerForm, this.powerContext());
    if (megaOk || !pick) return this.megaEvolve();
    if (pick.block) return this.notify(POWER_BLOCK_TEXT[pick.block], { kind: 'warning', icon: 'pokeball' });
    this.startPower(pick.choice);
  }

  private startPower(choice: PowerChoice) {
    if (!spendPowerMeter(this.powerMeter, powerCost(choice))) return;
    if (this.powerMeterHud) this.powerMeterHud.shown = '';
    if (choice === 'z') return this.zMove();
    const tera = choice === 'tera' ? resolveTeraType(this.teraPick, this.biome.types, this.tearType, rawEffectiveness) : null;
    this.powerForm = startPowerForm(this.powerForm, choice, tera);
    this.powerFormLoopAt = this.game.loop.time;
    this.megaPulseAt = this.game.loop.time + POWER_FORMS[choice].pulseMs;
    this.stats = this.calcStats();
    sfx('evolve');
    const secs = Math.round(POWER_FORMS[choice].durationMs / 1000);
    const name = this.niceName();
    if (choice === 'tera') {
      teraBurst(this, this.player.x, this.player.y, typeColor(tera!));
      if (!lowFx()) evolveGlow(this, this.player, 900);
      this.notify(`¡${name} se teracristaliza!\nTus ataques son de tipo ${typeNameEs(tera!)} durante ${secs} s`, { kind: 'item', icon: 'pokeball' });
    } else {
      dynamaxBurst(this, this.player.x, this.player.y, this.player.y + this.player.displayHeight / 2);
      if (!lowFx()) this.cameras.main.flash(250, 232, 56, 79);
      const label = choice === 'gigamax' ? `${name} Gigamax` : `${name} Dinamax`;
      this.notify(`¡${label}!\nGigante, con escudo y ataques más grandes durante ${secs} s`, { kind: 'item', icon: 'pokeball' });
      void this.applyMaxLook(choice);
    }
    void cry(this.formId);
    this.saveNow();
  }

  /**
   * Aspecto del Dinamax/Gigamax: la forma Gigamax de PokeAPI si la hay (como la mega), y si no el sprite de siempre
   * ×1,5 con el aura roja del Dinamax (playerFormAura, desde updatePowerForm).
   */
  private async applyMaxLook(choice: 'dynamax' | 'gigamax') {
    const size = Math.round(84 * POWER_FORMS[choice].sizeMul);
    const form = choice === 'gigamax' ? gmaxFormName(this.formId) : null;
    if (form) {
      const sprites = await fetchFormSprites(form);
      if (sprites && powerFormActive(this.powerForm) && this.player?.active && !this.ended) {
        const key = `gmax-${form}${this.shiny ? '-s' : ''}`;
        const urls = pickSprites(sprites, this.shiny);
        await new Promise<void>((resolve) => {
          let queued = 0;
          for (const side of ['front', 'back'] as const) {
            if (this.textures.exists(`${key}-${side}`)) continue;
            this.load.image(`${key}-${side}`, urls[side]);
            queued++;
          }
          if (queued === 0) return resolve();
          this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
          this.load.start();
        });
        if (this.textures.exists(`${key}-front`) && powerFormActive(this.powerForm) && this.player?.active && !this.ended) {
          for (const side of ['front', 'back']) {
            if (this.textures.exists(`${key}-${side}`)) this.textures.get(`${key}-${side}`).setFilter(Phaser.Textures.FilterMode.NEAREST);
          }
          this.megaKey = key;
          this.setStaticLook(key, size);
          return;
        }
      }
    }
    if (!powerFormActive(this.powerForm) || !this.player?.active || this.ended) return;
    this.megaKey = this.playerKey;
    this.setStaticLook(this.playerKey, size);
  }

  /**
   * Cristal Z: un único ataque devastador de tu tipo, una vez por partida (y gasta la forma del piso). Un anillo
   * doble de disparos enormes que atraviesan todo.
   */
  private zMove() {
    this.zUsed = true;
    this.powerForm = useZMove(this.powerForm);
    const s = this.stats;
    const type = this.shotType();
    const basic = basicShotFor(type);
    const opts = {
      damage: s.damage * Z_MOVE_DAMAGE_MUL * this.dmgMul(),
      speed: s.shotSpeed * basic.speed,
      life: s.range * 1.2,
      size: 1.8 * s.shotScale * basic.size,
      color: typeColor(type),
      type,
      pierce: s.pierce + 99,
      bounces: 0,
      motion: basic.motion,
      anim: basic.anim,
    };
    sfx('evolve');
    zMoveFx(this, this.player.x, this.player.y, typeColor(type));
    if (!lowFx()) this.cameras.main.flash(300, 255, 230, 120);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      this.spawnShot(new Phaser.Math.Vector2(Math.cos(a), Math.sin(a)), 0, opts);
    }
    this.notify(`¡Movimiento Z de ${this.niceName()}!\nEl Cristal Z ya no se puede volver a usar`, { kind: 'item', icon: 'star' });
    this.saveNow();
  }

  /** T75: tira del medidor de poder con las formas de theme.ts (cuadro GBA); solo si llevas un objeto que lo use. */
  private paintPowerMeter() {
    const h = this.powerMeterHud;
    if (!h) return;
    const show = pickPower(this.powerForm, this.powerContext()) !== null;
    const fill = powerMeterFill(this.powerMeter);
    const key = `${show}:${Math.round(fill * 50)}${fill >= 1 && !lowFx() ? ':' + Math.floor(this.game.loop.time / 60) : ''}`;
    if (h.shown === key) return;
    h.shown = key;
    h.g.clear();
    if (!show) return;
    drawBox(h.g, h.x, h.y, h.w, h.h, { fill: 0x1d2440 });
    // Relleno con franjas, marcas del gasto de cada forma (Tera 60 %, Dinamax/Z 100 %) y destello al llenarse
    drawPowerMeterFill(h.g, h.x, h.y, h.w, h.h, fill, this.game.loop.time);
  }

  /** Mega Piedra del HUD: solo si llevas la piedra y tu Pokémon tiene mega; brilla si se puede, se vacía mientras dura. */
  private paintMega() {
    const h = this.megaHud;
    if (!h) return;
    const ctx = this.megaContext();
    // T75: el mismo botón sirve para Dinamax, Tera y Z: se ve si se ofrece alguna y brilla si alguna se puede
    const offered = this.powerButtonOffered();
    const on = powerFormActive(this.powerForm);
    const pick = pickPower(this.powerForm, this.powerContext());
    const ready = (megaOffered(ctx) && megaBlock(this.powerForm, ctx) === null) || (!!pick && pick.block === null);
    const fill = on ? powerFormFill(this.powerForm) : 0;
    const key = `${offered}:${ready}:${on}:${Math.round(fill * 20)}:${this.powerForm.usedThisFloor}:${(ready || on) && !lowFx() ? Math.floor(this.game.loop.time / 80) : 0}`;
    if (h.shown === key) return;
    // Si cambia si se ofrece (coges o sueltas la piedra, evolucionas), se redibuja su etiqueta de tecla/botón
    if (h.shown.split(':')[0] !== String(offered)) this.badgeShown = '';
    h.shown = key;
    h.g.clear();
    this.megaZone?.setVisible(offered);
    if (!offered) return;
    // Mega Piedra: esfera con la hélice del símbolo mega; aro dorado que se vacía mientras dura la forma
    const used = this.powerForm.usedThisFloor && !on;
    drawMegaStoneHud(h.g, h.x, h.y, used ? 'used' : on ? 'on' : ready ? 'ready' : 'idle', fill, this.game.loop.time);
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
      if (f.drop.kind === 'coin' || f.drop.kind === 'berry' || f.drop.kind === 'key' || f.drop.kind === 'bomb' || f.drop.kind === 'potion') {
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
      daily: this.daily ? { ...this.daily } : null,
      seeded: this.seeded ? { ...this.seeded } : null,
      difficulty: this.diff,
      eventsDone: [...this.eventsDone],
      hpSacrificed: this.hpSacrificed,
      eggLeft: this.eggLeft,
      allyId: this.allyId,
      tiredRooms: this.tiredRooms,
      potions: this.potions,
      gardenBerries: [...this.gardenBerries],
      legendHunt: { ...this.hunt, floors: [...this.hunt.floors], kinds: [...this.hunt.kinds] },
      itemLevels: pruneLevels(this.itemLevels, this.passives),
      teraPick: this.teraPick,
      secondChance: this.secondChanceUsed,
      bossesBeaten: this.bossesBeaten,
      captureDone: this.capture.done,
      capturePrevAlly: this.capture.prevAllyId ?? -1,
      slotSpins: [...this.slotSpins],
      fishCasts: [...this.fishCasts],
      powerForm: powerFormToSave(this.powerForm),
      powerMeter: Math.round(this.powerMeter.value * 10) / 10,
      zUsed: this.zUsed,
      reactionsFound: [...this.reactionsFound],
      storiesSeen: [...this.storiesSeen],
      route: this.route ? { ...this.route } : null,
      routesTaken: this.routesTaken.map((x) => ({ ...x })),
    });
  }

  // --- Pausa ---

  private openPause() {
    this.cancelCharges();
    if (this.ended || this.transitioning || !this.player || this.scene.isPaused()) return;
    this.player.setVelocity(0, 0);
    this.overHud = false;
    const counts = new Map<string, number>();
    for (const id of this.passives) counts.set(id, (counts.get(id) ?? 0) + 1);
    const data: PauseData = {
      starterName: this.starterName,
      slot: this.slot,
      modeLabel: this.runLabel(),
      seedCode: this.seedCode(),
      progress: progressText(this.mode, this.floorNum),
      showRooms: this.mode === 'normal' || this.mode === 'endless',
      hp: this.hp,
      stats: this.stats,
      baseStats: this.baseStats,
      ability: this.ability ? { name: this.ability.name, description: this.ability.description } : undefined,
      reactions: discoveredLine(this.reactionsFound),
      items: [
        `Huecos ${slotsLabel(this.passives, this.bossesBeaten)}`,
        ...[...counts].map(([id, n]) => this.passiveName(id) + (n > 1 ? ` x${n}` : '')),
        ...(this.passives.includes(TERA_GEM_ID) ? [`Tipo Tera: ${this.teraPick ? typeNameEs(this.teraPick) : 'automático'}`] : []),
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
      // Tipo Tera a mano: solo con la Teragema. Cierra la pausa y abre la lista (teclado, ratón y mando)
      onTera: this.passives.includes(TERA_GEM_ID)
        ? () => {
            this.scene.stop('Pause');
            this.scene.resume();
            this.input.keyboard?.resetKeys();
            this.menuPadPrev = true;
            this.padPrev = [true, true, true, true];
            this.time.delayedCall(60, () => !this.ended && this.chooseTeraType());
          }
        : undefined,
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

  // --- Salas grandes (varias salas del piso unidas en una, sin pared entre ellas) ---

  /** Salas que forman la misma sala grande que `room` (solo ella misma si no es grande). */
  private groupIds(room: Room): number[] {
    return room.group === undefined ? [room.id] : this.floor.groups?.[room.group] ?? [room.id];
  }

  /** ¿La puerta `d` de `room` da a otra parte de su misma sala grande? */
  private mergedSide(room: Room, d: Dir): boolean {
    const to = room.doors[d];
    return to !== undefined && sameGroup(room, this.floor.rooms[to]);
  }

  /**
   * Lados unidos de la casilla (sala grande) y esquinas interiores de las salas en L, para el decorado: en una
   * esquina en L, la pared que bordea el hueco la pinta la casilla que la tiene al lado (roomDecor.ts).
   */
  private decorOpen(room: Room) {
    const m = (d: Dir) => this.mergedSide(room, d);
    const nb = (d: Dir) => this.floor.rooms[room.doors[d]!];
    const left = m('left');
    const up = m('up');
    return {
      left,
      right: m('right'),
      up,
      down: m('down'),
      topLeft: left && !up && this.mergedSide(nb('left'), 'up'),
      bottomLeft: left && !m('down') && this.mergedSide(nb('left'), 'down'),
      rightUp: up && !m('right') && this.mergedSide(nb('up'), 'right'),
      leftUp: up && !left && this.mergedSide(nb('up'), 'left'),
    };
  }

  /** Zona de juego de la sala actual: el rectángulo que contiene toda su sala grande (o ella sola). */
  private arena() {
    const cells = this.groupIds(this.current).map((id) => this.interior(this.floor.rooms[id]));
    const x0 = Math.min(...cells.map((c) => c.x0));
    const y0 = Math.min(...cells.map((c) => c.y0));
    const x1 = Math.max(...cells.map((c) => c.x1));
    const y1 = Math.max(...cells.map((c) => c.y1));
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }

  /** La sala (casilla del piso) que hay en (x, y): dentro de una sala grande, la que toque; si no, la actual. */
  private cellRoom(x: number, y: number): Room {
    if (this.current.group === undefined) return this.current;
    const gx = Math.floor(x / VIEW.w);
    const gy = Math.floor(y / VIEW.h);
    for (const id of this.groupIds(this.current)) {
      const r = this.floor.rooms[id];
      if (r.gx === gx && r.gy === gy) return r;
    }
    return this.current;
  }

  /** Dentro de una sala grande, la sala actual pasa a ser la casilla donde está el jugador (sin volver a empezar). */
  private followCell() {
    if (this.current.group === undefined) return;
    const here = this.cellRoom(this.player.x, this.player.y);
    if (here.id === this.current.id) return;
    this.current = here;
    this.visited.add(here.id);
    this.flow = undefined;
    this.drawMap();
  }

  /** Cámara: fija en la sala, o siguiendo al jugador dentro de los límites de la sala grande. */
  private setRoomCamera(room: Room) {
    const cam = this.cameras.main;
    if (room.group === undefined) {
      cam.stopFollow();
      cam.removeBounds();
      return;
    }
    const cells = this.groupIds(room).map((id) => this.floor.rooms[id]);
    const x0 = Math.min(...cells.map((r) => r.gx)) * VIEW.w;
    const y0 = Math.min(...cells.map((r) => r.gy)) * VIEW.h;
    const x1 = (Math.max(...cells.map((r) => r.gx)) + 1) * VIEW.w;
    const y1 = (Math.max(...cells.map((r) => r.gy)) + 1) * VIEW.h;
    cam.setBounds(x0, y0, x1 - x0, y1 - y0);
    cam.startFollow(this.player, true, 0.12, 0.12);
  }

  /** Cierra o abre las puertas de toda la sala grande. */
  private setGroupDoorsLocked(room: Room, locked: boolean, animate = false) {
    for (const id of this.groupIds(room)) this.setDoorsLocked(this.floor.rooms[id], locked, animate);
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
    this.add.tileSprite(i.x0, i.y0, ROOM.w, ROOM.h, this.tiles.floor).setOrigin(0).setTileScale(ts).setTilePosition(i.x0 / ts, i.y0 / ts).setDepth(0);
    // Paisaje alrededor, manchas, detalles y sombras del bioma (supervisor)
    decorateRoom(this, this.biome, { x: room.gx * VIEW.w, y: room.gy * VIEW.h, w: VIEW.w, h: VIEW.h }, i, WALL, this.floorSeed * 31 + room.id, ts * 2.4, this.decorOpen(room));
    if (!plain) {
      // Salas especiales: alfombra de su color (Centro rosa, tienda verde, objeto dorado…) sobre el suelo del bioma
      const m = 70;
      drawRoomRug(this, i.x0 + m, i.y0 + m * 0.7, ROOM.w - m * 2, ROOM.h - m * 1.4, floorColor, ts * 2.4);
    }
    g.setDepth(0.5);

    for (const d of DIRS) {
      const to = room.doors[d];
      if (to === undefined) continue;
      // Hacia otra parte de su sala grande no hay puerta ni pared
      if (this.mergedSide(room, d)) continue;
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
    if (!this.mergedSide(room, 'up')) hSide(i.y0 - WALL, has('up'));
    if (!this.mergedSide(room, 'down')) hSide(i.y1, has('down'));
    if (!this.mergedSide(room, 'left')) vSide(i.x0 - WALL, has('left'));
    if (!this.mergedSide(room, 'right')) vSide(i.x1, has('right'));
    this.buildJoin(room);
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

  /**
   * Une esta sala con su vecina de la misma sala grande por la derecha y por abajo: suelo continuo entre las dos y
   * pared (con su cuerpo físico) en los bordes que quedan al descubierto.
   */
  private buildJoin(room: Room) {
    const a = this.interior(room);
    const ts = TILE / ART_TILE;
    // Sala en L: la casilla que falta para completar el rectángulo se rellena con el paisaje de fuera (si no, se
    // veía el fondo azul oscuro al mover la cámara). Lo pinta la primera casilla del grupo.
    const ids = this.groupIds(room);
    if (ids.length > 2 && ids[0] === room.id && this.textures.exists(`outside-${this.biome.id}`)) {
      const cells = ids.map((id) => this.floor.rooms[id]);
      const gxs = cells.map((c) => c.gx);
      const gys = cells.map((c) => c.gy);
      for (let gx = Math.min(...gxs); gx <= Math.max(...gxs); gx++) {
        for (let gy = Math.min(...gys); gy <= Math.max(...gys); gy++) {
          if (cells.some((c) => c.gx === gx && c.gy === gy)) continue;
          const sc = ts * 2.4;
          this.add.tileSprite(gx * VIEW.w, gy * VIEW.h, VIEW.w, VIEW.h, `outside-${this.biome.id}`).setOrigin(0).setTileScale(sc).setDepth(-1.5);
        }
      }
    }
    const wallTile = (x: number, y: number, w: number, h: number) => {
      // Por debajo del relieve de roomDecor (0.31), que pinta su canto y su sombra también sobre esta unión
      this.add.tileSprite(x, y, w, h, this.tiles.wall).setOrigin(0).setTileScale(ts).setDepth(0.25);
      this.addWall(x, y, w, h);
    };
    if (this.mergedSide(room, 'right')) {
      const b = this.interior(this.floor.rooms[room.doors.right!]);
      this.add.tileSprite(a.x1, a.y0, b.x0 - a.x1, a.y1 - a.y0, this.tiles.floor).setOrigin(0).setTileScale(ts).setTilePosition(a.x1 / ts, a.y0 / ts).setDepth(0.02);
      wallTile(a.x1 + WALL, a.y0 - WALL, b.x0 - a.x1 - WALL * 2, WALL);
      wallTile(a.x1 + WALL, a.y1, b.x0 - a.x1 - WALL * 2, WALL);
    }
    if (this.mergedSide(room, 'down')) {
      const b = this.interior(this.floor.rooms[room.doors.down!]);
      this.add.tileSprite(a.x0, a.y1, a.x1 - a.x0, b.y0 - a.y1, this.tiles.floor).setOrigin(0).setTileScale(ts).setTilePosition(a.x0 / ts, a.y1 / ts).setDepth(0.02);
      wallTile(a.x0 - WALL, a.y1, WALL, b.y0 - a.y1);
      wallTile(a.x1, a.y1, WALL, b.y0 - a.y1);
    }
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
    void plain;
    void floorColor;
    this.add.tileSprite(r.x, r.y, r.w, r.h, this.tiles.floor).setOrigin(0).setTileScale(TILE / ART_TILE).setTilePosition((r.x * ART_TILE) / TILE, (r.y * ART_TILE) / TILE).setDepth(0.4);
    const kind = this.floor.rooms[room.doors[d]!].kind;
    const frame =
      kind === 'boss' ? 0xe53935
      : kind === 'item' ? 0xffc107
      : kind === 'center' ? CENTER_PINK
      : kind === 'shop' ? SHOP_GREEN
      : kind === 'challenge' ? CHALLENGE_SILVER
      : kind === 'secret' || room.kind === 'secret' ? SECRET_PURPLE
      : 0x1d2848;
    // Puerta de Gimnasio (supervisor): marco de acero con una luz del color de la sala a la que lleva y dos hojas
    // metálicas con media Poké Ball cada una que se cierran en combate y se abren deslizándose a los lados.
    const across = r.w >= r.h;
    const boss = kind === 'boss';
    const steel = boss ? 0xb84a4a : 0x8a94a8;
    const steelDark = boss ? 0x6a1e1e : 0x4a5468;
    const steelLight = boss ? 0xf08a7a : 0xd0d8e8;
    // Marco: postes a los lados del hueco y la luz encima (en la pared)
    const post = 10;
    if (across) {
      for (const px of [r.x - post, r.x + r.w]) {
        g.fillStyle(0x101828, 1).fillRect(px - 2, r.y - 2, post + 4, r.h + 4);
        g.fillStyle(steelDark, 1).fillRect(px, r.y, post, r.h);
        g.fillStyle(steelLight, 1).fillRect(px + 2, r.y, 2, r.h);
      }
    } else {
      for (const py of [r.y - post, r.y + r.h]) {
        g.fillStyle(0x101828, 1).fillRect(r.x - 2, py - 2, r.w + 4, post + 4);
        g.fillStyle(steelDark, 1).fillRect(r.x, py, r.w, post);
        g.fillStyle(steelLight, 1).fillRect(r.x, py + 2, r.w, 2);
      }
    }
    // Luz indicadora (en el lado de la pared que da a la sala)
    const lx = across ? r.x + r.w / 2 : d === 'left' ? r.x + r.w - 6 : r.x + 6;
    const ly = across ? (d === 'up' ? r.y + r.h - 6 : r.y + 6) : r.y + r.h / 2;
    g.fillStyle(0x101828, 1).fillCircle(lx, ly, 8);
    g.fillStyle(frame === 0x1d2848 ? 0x8fa6d8 : frame, 1).fillCircle(lx, ly, 6);
    g.fillStyle(0xffffff, 0.8).fillCircle(lx - 2, ly - 2, 2);
    const glow = this.add.circle(lx, ly, 14, frame === 0x1d2848 ? 0x8fa6d8 : frame, 0.25).setDepth(0.45);
    this.tweens.add({ targets: glow, alpha: 0.05, duration: 900, yoyo: true, repeat: -1 });
    if (kind === 'challenge') g.lineStyle(2, 0xffffff, 1).strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
    const block = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0x000000, 0.25).setDepth(1);
    // Dos hojas (cada una con media Poké Ball en su borde de cierre)
    const bars = this.add.container(r.x + r.w / 2, r.y + r.h / 2).setDepth(1.6);
    const half = (sgn: -1 | 1) => {
      const h = this.add.graphics();
      const w = across ? r.w / 2 : r.w;
      const hh = across ? r.h : r.h / 2;
      const x0 = across ? (sgn < 0 ? -w : 0) : -w / 2;
      const y0 = across ? -hh / 2 : sgn < 0 ? -hh : 0;
      h.fillStyle(0x101828, 1).fillRect(x0, y0, w, hh);
      h.fillStyle(steel, 1).fillRect(x0 + 2, y0 + 2, w - 4, hh - 4);
      h.fillStyle(steelLight, 0.7).fillRect(x0 + 2, y0 + 2, w - 4, 3);
      h.fillStyle(steelDark, 1).fillRect(x0 + 2, y0 + hh - 5, w - 4, 3);
      // Remaches
      for (const [rx, ry] of [[x0 + 6, y0 + 6], [x0 + w - 8, y0 + 6], [x0 + 6, y0 + hh - 8], [x0 + w - 8, y0 + hh - 8]]) h.fillStyle(steelLight, 1).fillRect(rx, ry, 2, 2);
      // Media Poké Ball en el borde de cierre (centro de la puerta = 0,0)
      const R = 13;
      const start = across ? (sgn < 0 ? Math.PI / 2 : -Math.PI / 2) : sgn < 0 ? Math.PI : 0;
      const end = start + Math.PI;
      h.fillStyle(0x101828, 1).slice(0, 0, R + 2, start, end, false).fillPath();
      if (across) {
        // Arriba roja y abajo blanca, cada hoja con su mitad
        h.fillStyle(0xe53935, 1).slice(0, 0, R, sgn < 0 ? Math.PI : -Math.PI / 2, sgn < 0 ? Math.PI * 1.5 : 0, false).fillPath();
        h.fillStyle(0xf8f8f8, 1).slice(0, 0, R, sgn < 0 ? Math.PI / 2 : 0, sgn < 0 ? Math.PI : Math.PI / 2, false).fillPath();
      } else {
        h.fillStyle(sgn < 0 ? 0xe53935 : 0xf8f8f8, 1).slice(0, 0, R, start, end, false).fillPath();
      }
      h.fillStyle(0x101828, 1).fillRect(across ? (sgn < 0 ? -R : 0) : -R, -1.5, R, 3);
      h.fillStyle(0x101828, 1).slice(0, 0, 6, start, end, false).fillPath();
      h.fillStyle(0xffffff, 1).slice(0, 0, 4, start, end, false).fillPath();
      if (boss) {
        // Pinchos en la del jefe
        for (let k = 1; k < 4; k++) {
          const t = (k / 4) * (across ? w : hh);
          if (across) h.fillStyle(0x101828, 1).fillTriangle(x0 + t - 4, y0, x0 + t + 4, y0, x0 + t, y0 - 6).fillTriangle(x0 + t - 4, y0 + hh, x0 + t + 4, y0 + hh, x0 + t, y0 + hh + 6);
          else h.fillStyle(0x101828, 1).fillTriangle(x0, y0 + t - 4, x0, y0 + t + 4, x0 - 6, y0 + t).fillTriangle(x0 + w, y0 + t - 4, x0 + w, y0 + t + 4, x0 + w + 6, y0 + t);
        }
      }
      return h;
    };
    const leafA = half(-1);
    const leafB = half(1);
    bars.add([leafA, leafB]);
    block.setData('leaves', [leafA, leafB]).setData('slide', across ? r.w / 2 : r.h / 2);
    block.setData('bars', bars).setData('across', across);
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
      // Si la sala está cerrada por un combate (u otro evento), la puerta nueva nace cerrada también: no se puede
      // huir a la sala secreta con enemigos vivos. Se abre con las demás al limpiar la sala.
      const roomLocked = DIRS.some((dd) => {
        const b = this.doorMap.get(doorKey(rm.id, dd));
        return !!b && b !== block && (b.body as Phaser.Physics.Arcade.StaticBody).enable;
      });
      if (block && roomLocked) {
        block.setVisible(true);
        (block.getData('bars') as Phaser.GameObjects.Container | undefined)?.setVisible(true);
        (block.body as Phaser.Physics.Arcade.StaticBody).enable = true;
      } else if (block) {
        block.setVisible(false);
        (block.getData('bars') as Phaser.GameObjects.Graphics | undefined)?.setVisible(false);
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
    const prize = rollChest(this.rng(RNG.chest));
    if (prize.kind === 'item') {
      const p = this.freeSpot(chest.x, chest.y + 60);
      this.dropItem(roomId, p.x, p.y);
    } else {
      prize.drops.forEach((d, k) => this.dropLoot(chest.x + (k - (prize.drops.length - 1) / 2) * 26, chest.y + 56, d));
    }
    this.notify('¡Cofre abierto!', { kind: 'reward', icon: 'chestOpen' });
    this.maybeSeed(SEED_CHANCE.chest, roomId);
    this.saveNow();
  }

  /** Bomba a tus pies: E, RB o clic en la bomba del HUD. */
  private placeBomb() {
    if (this.ended || this.transitioning || !this.player?.active) return;
    if (this.bombs <= 0) return this.notify(`${OAK_LINE}\nNo te quedan bombas`, { kind: 'warning', icon: 'bomb' });
    this.bombs--;
    const x = this.player.x;
    const y = this.player.y + 10;
    const roomId = this.current.id;
    const b = bombFuse(this, x, y, BOMB.fuse, BOMB.radius);
    this.time.delayedCall(BOMB.fuse, () => {
      b.destroy();
      if (!this.ended && this.current.id === roomId) this.explode(x, y);
    });
  }

  /** Estalla: daña a enemigos (y a ti si te pilla), rompe rocas y hierba y abre puertas ocultas cercanas. */
  private explode(x: number, y: number) {
    const R = BOMB.radius;
    sfx('boom');
    this.cameras.main.shake(180, 0.006);
    bombExplosion(this, x, y, R);

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
      if (this.hp <= 0) this.playerDown(`Has caído · +${this.earned} tickets\nPulsa R, Start o haz clic para ver el resumen`);
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
    const marks = new Map<number, number>();
    if (this.minibossRoom !== undefined && !this.cleared.has(this.minibossRoom)) marks.set(this.minibossRoom, 0xff8c1a);
    // Sala sorpresa: se marca al descubrirla, hasta resolverla
    const ev = this.roomEvent;
    if (ev && this.visited.has(ev.roomId) && !this.eventsDone.has(ev.roomId)) marks.set(ev.roomId, ROOM_EVENT_COLOR[ev.kind]);
    // Santuario de la Mega Piedra: se marca al descubrirlo, hasta coger la piedra
    if (this.megaRoomId !== undefined && this.visited.has(this.megaRoomId) && !this.eventsDone.has(megaStoneDoneKey(this.megaRoomId))) marks.set(this.megaRoomId, ROOM_EVENT_COLOR.megaStone);
    // T56: salas con regla, en cuanto se ven en el mapa y hasta limpiarlas
    for (const [id, rule] of this.roomRules) if (!this.cleared.has(id)) marks.set(id, ROOM_RULE_COLOR[rule]);
    const bottom = drawMinimap(this.minimap, this.floor, this.current.id, this.visited, W - HUD.pad, HUD.pad, hidden, 1.5, HUD.right.w - HUD.pad * 2, marks);
    this.toasts?.setTop(bottom + 16);
  }

  /** Trozos que salen despedidos y caen (roca rota, hojas cortadas). */
  private shatter(x: number, y: number, colors: number[]) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 20 + Math.random() * 40;
      const size = 4 + Math.floor(Math.random() * 3) * 2;
      const p = this.add.rectangle(x, y, size, size, colors[i % colors.length]).setDepth(7).setStrokeStyle(1, 0x101828, 0.8);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 20, angle: Phaser.Math.Between(-180, 180), duration: 260, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: p, y: `+=${30 + Math.random() * 20}`, alpha: 0, duration: 380, delay: 260, ease: 'Quad.easeIn', onComplete: () => p.destroy() });
    }
  }

  /** Cierra o abre las puertas de la sala. Con `animate`, los barrotes caen con un golpe o se retiran con polvo. */
  private setDoorsLocked(room: Room, locked: boolean, animate = false) {
    for (const d of DIRS) {
      const block = this.doorMap.get(`${room.id}:${d}`);
      if (!block) continue;
      (block.body as Phaser.Physics.Arcade.StaticBody).enable = locked;
      const bars = block.getData('bars') as Phaser.GameObjects.Container | undefined;
      const across = !!block.getData('across');
      const leaves = (block.getData('leaves') as Phaser.GameObjects.Graphics[] | undefined) ?? [];
      const slide = (block.getData('slide') as number | undefined) ?? 60;
      if (!bars || leaves.length < 2) {
        block.setVisible(locked);
        continue;
      }
      // Posición de cada hoja: cerrada en el centro, abierta metida en la pared (y oculta)
      const place = (open: number) =>
        leaves.forEach((l, k) => (across ? l.setX((k === 0 ? -1 : 1) * slide * open) : l.setY((k === 0 ? -1 : 1) * slide * open)));
      this.tweens.killTweensOf(leaves);
      if (!animate) {
        block.setVisible(locked);
        bars.setVisible(locked);
        place(locked ? 0 : 1);
        continue;
      }
      const prop = across ? 'x' : 'y';
      if (locked) {
        // Se cierran deslizándose desde los lados con un golpe al encajar
        sfx('gymClose');
        block.setVisible(true);
        bars.setVisible(true);
        place(1);
        leaves.forEach((l, k) => this.tweens.add({ targets: l, [prop]: 0, duration: 260, ease: 'Quad.easeIn', onComplete: () => k === 0 && (this.cameras.main.shake(70, 0.002), hitSpark(this, block.x, block.y, 0xffffff, 4, 0.7)) }));
      } else {
        // Se abren: la luz destella y las hojas se meten en la pared
        sfx('gymOpen');
        hitSpark(this, block.x, block.y, 0xffd34d, 6, 1);
        leaves.forEach((l, k) => this.tweens.add({
          targets: l, [prop]: (k === 0 ? -1 : 1) * slide, duration: 360, ease: 'Cubic.easeOut', delay: 80,
          onComplete: () => {
            if (k !== 0) return;
            bars.setVisible(false);
            block.setVisible(false);
          },
        }));
      }
    }
  }

  // --- Objetos ---

  /** Deja en el suelo un objeto al azar: un pasivo propio o un poder (movimiento de PokeAPI). */
  private dropItem(roomId: number, x: number, y: number) {
    // T54: si cae en la sala en la que estás (cofre, jefe, evento…) se ve el salto; al montar el piso, no
    this.spawnPickup(roomId, x, y, rollItem(this.rng(RNG.items), new Set(this.passives), this.movePool, ACTIVE_DROP_CHANCE, ACTIVE_IDS, this.passivePool(), this.floorNum), this.current?.id === roomId);
  }

  private spawnPickup(roomId: number, x: number, y: number, item: DroppedItem, hop = false) {
    const entry: FloorItemSave = { roomId, x, y, drop: this.toSaved(item) };
    this.floorItems.push(entry);
    const act = item.kind === 'active' ? activeById(item.id) : undefined;
    const color = item.kind === 'passive' ? item.item.color : item.kind === 'move' ? typeColor(item.move.type) : (act?.color ?? 0xffffff);
    const name = item.kind === 'passive' ? item.item.name : item.kind === 'move' ? pretty(item.move.name) : `${act?.name ?? item.id} (activo)`;

    const shadow = this.add.ellipse(x, y + 18, 90, 34, 0xc9b27a).setDepth(1);
    // Pasivo: bolsa; poder: disco del color de su tipo; activo: Poké Ball
    // Cada objeto con su dibujo (gafas, garra, lupa…); los poderes, un disco de su tipo
    const tex = item.kind === 'passive' ? itemIconKey(item.item.id) : item.kind === 'move' ? iconKey('disc') : itemIconKey(item.id);
    const s = this.pickups.create(x, y, this.textures.exists(tex) ? tex : iconKey('bag')) as Sprite;
    s.setScale(3).setDepth(2).setData('item', item).setData('entry', entry);
    if (item.kind === 'move') s.setTint(color);
    const label = this.add
      .text(x, y - 38, name, { fontFamily: FONT, fontSize: '16px', color: '#2b3a67' })
      .setOrigin(0.5)
      .setDepth(3);
    s.setData('label', label);
    s.setData('shadow', shadow);
    // Rareza del poder: nombre en su color y, en los épicos y legendarios, un halo que late
    if (item.kind === 'move') {
      const rar = moveRarity(item.move.power);
      if (rar !== 'common') {
        const rc = MOVE_RARITY_COLOR[rar];
        label.setText(`${name}\n${MOVE_RARITY_LABEL[rar]}`).setColor('#' + rc.toString(16).padStart(6, '0')).setY(y - 48).setAlign('center');
        if (rar === 'epic' || rar === 'legendary') {
          const halo = this.add.circle(x, y, 30, rc, 0.28).setDepth(1.5).setStrokeStyle(3, rc, 0.9);
          this.tweens.add({ targets: halo, scale: 1.5, alpha: 0.05, duration: rar === 'legendary' ? 650 : 900, repeat: -1 });
          s.setData('halo', halo);
        }
      }
    }
    const bob = () => s.active && this.tweens.add({ targets: s, y: y - 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (hop) {
      // T54: cae desde arriba y rebota en su sitio (que ya es libre y dentro de la sala). Sin atracción: al cogerlo
      // puede preguntar si cambias un poder, y que se te eche encima obligaría a elegir sin querer.
      s.y = y - 70;
      this.tweens.add({ targets: s, y, duration: 560, ease: 'Bounce.easeOut', onComplete: bob });
    } else bob();
  }

  /**
   * Lo recogido salta y vuela en arco hasta su sitio en el HUD (contador, PS, ranuras…), con destello al llegar y
   * un saltito del contador. Solo visual: el valor ya se ha sumado.
   */
  private flyToHud(texture: string, frame: string | number | undefined, wx: number, wy: number, tx: number, ty: number, bump?: Phaser.GameObjects.Text) {
    const cam = this.cameras.main;
    const hudCam = this.hudCam;
    if (!hudCam || !this.textures.exists(texture)) return;
    const sx = (wx - cam.worldView.x) * cam.zoom + cam.x;
    const sy = (wy - cam.worldView.y) * cam.zoom + cam.y;
    const toHud = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.hudLayer.add(o);
      o.cameraFilter &= ~hudCam.id;
      return o;
    };
    const img = toHud(this.add.image(sx, sy, texture, frame).setScale(3.4).setDepth(60));
    const ctrl = { x: (sx + tx) / 2, y: Math.min(sy, ty) - 160 };
    const t = { v: 0 };
    // Saltito en el sitio y luego vuela en arco (curva de Bézier)
    this.tweens.add({ targets: img, scale: 4.2, duration: 110, yoyo: true });
    this.tweens.add({
      targets: t, v: 1, duration: 520, delay: 120, ease: 'Sine.easeIn',
      onUpdate: () => {
        const u = 1 - t.v;
        img.setPosition(u * u * sx + 2 * u * t.v * ctrl.x + t.v * t.v * tx, u * u * sy + 2 * u * t.v * ctrl.y + t.v * t.v * ty);
        img.setScale(3.4 - 1.4 * t.v).setAngle(t.v * 360);
      },
      onComplete: () => {
        img.destroy();
        const ring = toHud(this.add.circle(tx, ty, 8).setStrokeStyle(4, 0xffd34d, 1));
        this.tweens.add({ targets: ring, radius: 30, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
        if (bump?.active) this.tweens.add({ targets: bump, scale: 1.45, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
      },
    });
  }

  /**
   * Con las 4 ranuras llenas, pregunta cuál sustituir (o dejarlo). Devuelve true si ha abierto la pantalla:
   * entonces `then(ranura)` se llama al elegir y `cancel()` si lo dejas.
   */
  /**
   * Confirmación «¿Seguro que quieres comprar X por N monedas?» (Sí / No, foco en No). El juego queda en pausa y el
   * jugador quieto hasta responder; `then` se llama ya reanudado y solo con Sí. Si no se puede preguntar, no se compra.
   * Al cerrar, 0,4 s sin reabrir: seguir encima de un artículo tras decir No no vuelve a preguntar (la tienda solo
   * pregunta una vez por pisada) y un Enter o clic de más no la repite.
   */
  private askBuy(name: string, price: number, then: () => void): boolean {
    if (this.confirmOpen || this.swapOpen || this.itemChoiceOpen || this.game.loop.time < this.confirmCooldownUntil) return false;
    this.confirmOpen = true;
    this.player?.setVelocity(0, 0);
    const ok = openConfirm(this, confirmText(name, price), (yes) => {
      this.confirmOpen = false;
      this.overHud = false; // el ratón pudo salir del artículo con el juego en pausa
      this.confirmCooldownUntil = this.game.loop.time + 400;
      if (yes) then();
    });
    if (!ok) this.confirmOpen = false;
    return ok;
  }

  private askSlot(move: MovePower, then: (slot: number) => void, cancel: () => void): boolean {
    if (this.slots.indexOf(null) !== -1 || this.swapOpen || !this.scene.manager.keys['SlotSwap']) return false;
    this.swapOpen = true;
    this.player?.setVelocity(0, 0);
    this.scene.launch('SlotSwap', {
      move,
      slots: [...this.slots],
      onChoice: (slot: number) => {
        this.scene.stop('SlotSwap');
        this.scene.resume();
        this.input.keyboard?.resetKeys();
        this.swapOpen = false;
        // Hora real del juego: el reloj de la escena estaba parado mientras elegías, así que `this.time.now` es la
        // de cuando se abrió la pantalla y el enfriamiento ya habría pasado al volver (se reabría al momento)
        this.swapCooldownUntil = this.game.loop.time + 1200;
        if (slot >= 0) then(slot);
        else cancel();
      },
    });
    this.scene.pause();
    return true;
  }

  private pickItem(sprite: Sprite) {
    if (!sprite.active) return;
    const item = sprite.getData('item') as DroppedItem;
    if (item.kind === 'active' && this.time.now < this.activeSwapUntil) return;
    // Con la ranura ya elegida en la pantalla de cambio se recoge en el acto. Antes también miraba el enfriamiento que
    // la propia elección acaba de poner (1,2 s): no se recogía, y al seguir encima se volvía a abrir la pantalla
    if (item.kind === 'move' && this.slots.indexOf(null) === -1 && this.chosenSlot === undefined) {
      // Ranuras llenas: elige cuál sustituir; si lo dejas, el poder se queda en el suelo
      if (this.swapOpen || this.time.now < this.swapCooldownUntil) return;
      if (this.askSlot(item.move, (slot) => { this.chosenSlot = slot; this.pickItem(sprite); }, () => undefined)) return;
    }
    // T73: huecos de objeto llenos: eliges cuál soltar; si cancelas, el nuevo se queda en el suelo
    if (item.kind === 'passive' && !canTakePassive(item.item.id, this.passives, this.bossesBeaten)) {
      if (this.itemChoiceOpen || this.game.loop.time < this.itemChoiceCooldownUntil) return;
      this.askDropFor(item.item, () => this.pickItem(sprite), () => undefined);
      return;
    }
    {
      const LX = HUD.left.x + HUD.pad;
      const LW = HUD.left.w - HUD.pad * 2;
      const [tx, ty] =
        item.kind === 'move' ? [HUD.right.x + HUD.right.w / 2, this.slotY(0) + 32] : item.kind === 'active' ? [LX + LW / 2, H - 71] : [LX + LW / 2, HL.itemsY];
      this.flyToHud(sprite.texture.key, sprite.frame.name, sprite.x, sprite.y, tx, ty);
    }
    (sprite.getData('label') as Phaser.GameObjects.Text | undefined)?.destroy();
    (sprite.getData('shadow') as Phaser.GameObjects.Ellipse | undefined)?.destroy();
    const halo = sprite.getData('halo') as Phaser.GameObjects.Arc | undefined;
    if (halo) {
      this.tweens.killTweensOf(halo);
      halo.destroy();
    }
    this.floorItems = this.floorItems.filter((f) => f !== sprite.getData('entry'));
    this.tweens.killTweensOf(sprite);
    const altar = !!sprite.getData('towerAltar');
    sprite.destroy();
    this.gainItem(item);
    if (altar) this.towerAltarTaken();
  }

  /** T81: la partida se empezó escribiendo un código (no cuenta para récords, diario, misiones ni registro de combate). */
  private get codeRun(): boolean {
    return !!this.seeded?.fromCode;
  }

  /** T81: código de semilla de la partida para compartirla (undefined si no tiene semilla, p. ej. una v24 cargada). */
  private seedCode(): string | undefined {
    if (!this.seeded) return undefined;
    try {
      return encodeSeed({ seed: this.seeded.seed, mode: this.mode, difficulty: this.diff, starterId: this.starterId });
    } catch {
      return undefined;
    }
  }

  /** Nombre de la partida para avisos y la pausa: modo (o desafío diario), «con código» y dificultad. */
  private runLabel(): string {
    return withDifficulty(this.daily ? 'Desafío diario' : `${MODE_LABEL[this.mode]}${this.codeRun ? ' con código' : ''}`, this.diff);
  }

  /** Pasivos que pueden salir: todos menos los que aún bloquea un logro (missions.ts). */
  private passivePool() {
    const locked = lockedItems(loadMissions());
    return RANDOM_PASSIVES.filter((i) => !locked.has(i.id));
  }

  /** Suma un suceso a las misiones y logros; lo que se cumpla se avisa abajo (los premios ya se han dado). */
  private mission(e: MissionEvent) {
    // T81: las partidas con código no cuentan para misiones ni logros
    if (this.codeRun) return;
    const { completed, expired } = recordMissionEvent(e);
    for (const m of expired) this.notify(`Encargo caducado\n${m.npc}: ${m.text}`, { kind: 'warning', ms: 4000 });
    for (const c of completed) {
      const reward = rewardText(c.reward, { item: c.reward.item ? passiveById(c.reward.item)?.name : undefined });
      sfx('buy');
      if (c.kind === 'daily') this.notify(`¡Misión cumplida!\n${c.text}\n${reward}`, { kind: 'mission', ms: 5000 });
      else if (c.kind === 'npc') this.notify(`¡Encargo cumplido!\n${c.text}\n${reward}`, { kind: 'mission', ms: 5000 });
      else this.notify(`¡Logro: ${c.text}!\n${ACHIEVEMENTS.find((a) => a.id === c.id)?.text ?? ''}\n${reward}`, { kind: 'mission', ms: 5000 });
    }
  }

  /**
   * T87: el NPC de la sala especial ofrece un encargo (como mucho uno por piso y 3 activos). Se acepta solo, sin
   * pulsar nada, así funciona igual con teclado, ratón o mando. Las partidas con código no cuentan.
   */
  private npcEncounter(room: Room) {
    if (this.npcOffered || this.codeRun || this.ended) return;
    this.npcOffered = true;
    const m = acceptNpcMission((this.floorSeed ^ Math.imul(room.id + 1, 0x9e3779b1)) >>> 0);
    if (!m) return this.deliverBerry();
    sfx('buy');
    this.time.delayedCall(800, () => this.deliverBerry());
    this.notify(`${m.npc}: «${m.dialog}»\nEncargo: ${m.text} (${m.runs === 1 ? '1 partida' : `${m.runs} partidas`})`, { kind: 'mission', ms: 6000 });
  }

  /** T87 + T85: si un NPC te ha pedido una baya y llevas una del huerto, se la das (la que menos falta haga). */
  private deliverBerry() {
    if (this.ended || this.codeRun || !loadMissions().npc.some((a) => a.id === 'npc-baya')) return;
    const berry = (['aslac', 'gonlan', 'aranja'] as const).find((b) => this.gardenBerries.includes(b));
    if (!berry) return;
    this.gardenBerries = useCarried(this.gardenBerries, berry) ?? this.gardenBerries;
    this.notify(`Le das una ${GARDEN_BERRIES[berry].name} a la granjera`, { kind: 'reward', icon: 'heart' });
    this.mission({ kind: 'berry' });
    this.saveNow();
  }

  /** T85: Baya Aranja del huerto: se come sola con pocos PS. */
  private gardenAutoHeal() {
    if (this.hp <= 0 || !shouldAutoHeal(this.hp, this.stats.maxHp)) return;
    const left = useCarried(this.gardenBerries, 'aranja');
    if (!left) return;
    this.gardenBerries = left;
    const amount = scaleHeal(GARDEN_HEAL, this.diff);
    this.hp = healed(this.hp, this.stats.maxHp, amount);
    sfx('heal');
    this.popup(this.player.x, this.player.y - 50, `Baya Aranja +${amount} PS`, GARDEN_BERRIES.aranja.color);
  }

  /** T85: al entrar en la sala del jefe, la Gonlan da escudo y la Aslac llena la adrenalina. */
  private gardenBossBerries() {
    const shield = useCarried(this.gardenBerries, 'gonlan');
    if (shield) {
      this.gardenBerries = shield;
      this.shieldLeft += GARDEN_SHIELD;
      this.notify(`Baya Gonlan\nEscudo para ${GARDEN_SHIELD} golpes`, { kind: 'reward', icon: 'star' });
    }
    const adr = useCarried(this.gardenBerries, 'aslac');
    if (adr && fillAdrenaline(this.adrenaline)) {
      this.gardenBerries = adr;
      this.notify('Baya Aslac\n¡Adrenalina a tope!', { kind: 'reward', icon: 'star' });
      sfx('levelup');
    }
  }

  /** T85: semilla para el huerto (cofres y tiendas). Las partidas con código no dan. */
  private maybeSeed(chance: number, salt: number) {
    if (this.codeRun) return;
    const rng = mulberry32((this.floorSeed ^ Math.imul(salt + 11, 0x85ebca6b)) >>> 0);
    if (rng() >= chance) return;
    const berry = rollSeed(rng);
    gainSeed(berry);
    this.notify(`¡Semilla de ${GARDEN_BERRIES[berry].name}!\nPlántala en el huerto`, { kind: 'reward', icon: 'heart' });
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
    // T73: comprado o regalado (tienda, mercader, eventos…) con los huecos llenos: eliges qué soltar o se queda al lado
    if (item.kind === 'passive' && !canTakePassive(item.item.id, this.passives, this.bossesBeaten)) {
      this.askDropFor(item.item, () => this.gainItem(item), () => this.dropBeside(item));
      return;
    }
    sfx('pickup');
    this.mission({ kind: 'item' });
    this.tip(item.kind === 'move' ? 'powers' : item.kind === 'passive' ? 'items' : 'active');
    const before = new Set(this.synergies);
    if (item.kind === 'active') {
      // Como en Isaac: si ya llevabas uno, se queda en el suelo
      // (dentro de la sala: al lado contrario si estás pegado a una pared)
      if (this.active && this.player) {
        const rm = this.host.room();
        const side = this.player.x + 70 > rm.x1 - 40 ? -70 : 70;
        const dx = Phaser.Math.Clamp(this.player.x + side, rm.x0 + 40, rm.x1 - 40);
        const dy = Phaser.Math.Clamp(this.player.y, rm.y0 + 50, rm.y1 - 40);
        this.spawnPickup(this.current.id, dx, dy, { kind: 'active', id: this.active.id });
      }
      this.activeSwapUntil = this.time.now + 1000;
      const a = activeById(item.id);
      this.active = { id: item.id, charge: a?.charge ?? 1 };
      this.notify(`${a?.name ?? item.id}\n${a?.description ?? ''}\nEspacio, LB o clic en su cuadro`, { kind: 'item', icon: 'pokeball' });
    } else if (item.kind === 'passive') {
      if (item.item.id === 'banda-focus') this.focusLeft++;
      const prevMax = this.stats.maxHp;
      this.passives.push(item.item.id);
      notePickup(this.counters);
      this.stats = this.calcStats();
      // Más PS máximos también te curan esa misma cantidad
      this.hp = Math.min(this.stats.maxHp, this.hp + Math.max(0, this.stats.maxHp - prevMax));
      this.hpMark = this.hp;
      this.notify(`${item.item.name}\n${item.item.description}`, { kind: 'item', icon: 'bag' });
      // La primera Teragema deja elegir el tipo Tera (o seguir con el automático); luego se cambia en la pausa
      if (item.item.id === TERA_GEM_ID && this.passives.filter((p) => p === TERA_GEM_ID).length === 1) this.time.delayedCall(400, () => !this.ended && this.chooseTeraType());
    } else {
      const free = this.slots.indexOf(null);
      const slot = this.chosenSlot ?? (free !== -1 ? free : this.nextSlotReplace++ % SLOT_COUNT);
      this.chosenSlot = undefined;
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

  // --- T73: huecos de objeto y forja (lógica en data/forge.ts) ---

  /** Jefe vencido: cuenta para los huecos de objeto y avisa si da uno más. */
  private bossBeaten() {
    const before = itemSlots(this.bossesBeaten);
    this.bossesBeaten++;
    this.mission({ kind: 'boss' });
    if (itemSlots(this.bossesBeaten) > before) {
      this.notify(`+1 hueco de objeto\nObjetos ${slotsLabel(this.passives, this.bossesBeaten)}`, { kind: 'reward', icon: 'bag' });
      this.refreshInventory();
    }
  }

  private passiveName(id: string, withCount = false) {
    const n = this.passives.filter((p) => p === id).length;
    return levelLabel(passiveById(id)?.name ?? id, levelOf(this.itemLevels, id)) + (withCount && n > 1 ? ` x${n}` : '');
  }

  /**
   * Abre la lista de ItemChoiceScene con el juego en pausa (como askSlot). Devuelve false si no se puede abrir.
   * `then(i)` recibe la opción o -1; se llama ya con la escena reanudada.
   */
  private openItemChoice(title: string, text: string, options: string[], then: (i: number) => void, cancel?: string, disabled?: boolean[]): boolean {
    if (this.itemChoiceOpen || this.swapOpen || !this.scene.manager.keys['ItemChoice']) return false;
    this.itemChoiceOpen = true;
    this.player?.setVelocity(0, 0);
    this.scene.launch('ItemChoice', {
      title,
      text,
      options,
      cancel,
      disabled,
      onChoice: (i: number) => {
        this.scene.stop('ItemChoice');
        this.scene.resume();
        this.input.keyboard?.resetKeys();
        this.itemChoiceOpen = false;
        // Hora real (el reloj de la escena estaba parado): que no se reabra al seguir encima del objeto
        this.itemChoiceCooldownUntil = this.game.loop.time + 1200;
        then(i);
      },
    });
    this.scene.pause();
    return true;
  }

  /** Encadena otra lista justo después de cerrar una (la de pasos de la forja): un instante para que Phaser la cierre. */
  private nextItemChoice(...args: Parameters<GameScene['openItemChoice']>) {
    this.time.delayedCall(60, () => !this.ended && this.openItemChoice(...args));
  }

  /** Huecos llenos: pregunta qué objeto soltar para coger `item`. Si no se puede preguntar, cuenta como cancelar. */
  private askDropFor(item: PassiveItem, then: () => void, cancel: () => void) {
    const owned = distinctPassives(this.passives);
    const ok = this.openItemChoice(
      'HUECOS LLENOS',
      `Objetos ${slotsLabel(this.passives, this.bossesBeaten)}: ¿cuál sueltas para coger ${item.name}?\nEl que sueltes se queda en el suelo.`,
      owned.map((id) => this.passiveName(id, true)),
      (i) => {
        if (i < 0) return cancel();
        this.dropPassiveToFloor(owned[i]);
        then();
      },
      `Dejar ${item.name} en el suelo`,
    );
    if (!ok) cancel();
  }

  /** Deja un objeto en el suelo a tu lado (dentro de la sala). */
  private dropBeside(item: DroppedItem) {
    if (!this.player) return;
    const rm = this.host.room();
    const side = this.player.x + 70 > rm.x1 - 40 ? -70 : 70;
    const p = this.freeSpot(Phaser.Math.Clamp(this.player.x + side, rm.x0 + 40, rm.x1 - 40), Phaser.Math.Clamp(this.player.y, rm.y0 + 50, rm.y1 - 40));
    this.spawnPickup(this.current.id, p.x, p.y, item, true);
  }

  /** Suelta un objeto entero (con sus copias, que van al suelo una a una) y libera su hueco. */
  private dropPassiveToFloor(id: string) {
    const item = passiveById(id);
    const copies = this.passives.filter((p) => p === id).length;
    this.passives = removePassive(this.passives, id);
    if (id === 'banda-focus') this.focusLeft = Math.max(0, this.focusLeft - copies);
    if (item) for (let k = 0; k < copies; k++) this.dropBeside({ kind: 'passive', item });
    this.passivesChanged();
    this.notify(`Has soltado ${item?.name ?? id}`, { kind: 'info', icon: 'bag' });
  }

  /** Tras quitar o cambiar pasivos: estadísticas, PS (los máximos de más también curan), HUD y guardado. */
  private passivesChanged() {
    this.itemLevels = pruneLevels(this.itemLevels, this.passives);
    const prevMax = this.stats.maxHp;
    this.stats = this.calcStats();
    this.hp = Math.max(1, Math.min(this.stats.maxHp, this.hp + Math.max(0, this.stats.maxHp - prevMax)));
    this.hpMark = this.hp;
    this.refreshInventory();
    this.saveNow();
  }

  // --- T79: historias con decisiones (lógica en level/choiceEvents.ts) ---

  /** Un cartel con la historia de la sala; al usarlo se abre la lista de elecciones (ItemChoiceScene). */
  private placeStory(room: Room, x: number, y: number, rng: () => number) {
    const story = pickStory(this.storiesSeen, rng());
    if (!story) return this.finishEvent(room);
    this.eventObjs.push(buildStoryArt(this, story.id, x, y));
    const t = this.add.text(x, y + 70, `${story.title}\n¿Qué haces?`, { fontFamily: FONT, fontSize: '16px', color: '#e6f4d0', stroke: '#101828', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(4);
    this.eventObjs.push(t);
    const open = () => this.openStory(room, story);
    const z = this.add.zone(x, y, 260, 110).setInteractive({ useHandCursor: true });
    z.on('pointerover', () => (this.overHud = true));
    z.on('pointerout', () => (this.overHud = false));
    z.on('pointerdown', () => this.current?.id === room.id && open());
    this.eventObjs.push(z);
    this.eventSpots.push({ x, y, prompt: () => 'Enter / A / clic: ver qué pasa', use: open });
  }

  private openStory(room: Room, story: ChoiceStory) {
    if (this.ended || this.transitioning || this.eventsDone.has(room.id) || this.game.loop.time < this.itemChoiceCooldownUntil) return;
    const st = (): ChoiceState => ({ coins: this.coins, hp: this.hp, maxHp: this.stats.maxHp });
    const s0 = st();
    this.openItemChoice(
      story.title,
      story.text,
      story.options.map((o) => optionLabel(o, s0)),
      (k) => {
        if (k < 0 || this.eventsDone.has(room.id)) return;
        // Mismo azar cada vez que se resuelve esta sala (semilla del piso y de la sala)
        const r = resolveChoice(story, k, mulberry32((this.floorSeed ^ Math.imul(room.id + 7, 0x27d4eb2d)) >>> 0), st());
        if (!r) return;
        this.storiesSeen.push(story.id);
        this.applyStory(room, r.effects);
        const extra = describeEffects(r.effects);
        this.notify(extra ? `${r.text}\n${extra}` : r.text, { kind: r.effects.fight ? 'danger' : 'info', icon: 'star' });
      },
      'Marcharse sin decidir',
      story.options.map((o) => !canAfford(o, s0)),
    );
  }

  /** Aplica lo que salió de la historia (ya ajustado: nada queda en negativo). */
  private applyStory(room: Room, e: ChoiceEffects) {
    this.coins += e.coins ?? 0;
    if (e.maxHpLoss) {
      this.hpSacrificed += e.maxHpLoss;
      this.stats = this.calcStats();
    }
    this.hp = Math.max(1, Math.min(this.stats.maxHp, this.hp + (e.hp ?? 0)));
    if ((e.hp ?? 0) > 0) sfx('heal');
    if ((e.hp ?? 0) < 0) sfx('hurt');
    if (e.coins && e.coins > 0) sfx('coin');
    this.potions += e.potions ?? 0;
    this.keys += e.keys ?? 0;
    this.bombs += e.bombs ?? 0;
    if (e.tickets) this.giveTickets(e.tickets);
    if (e.item) {
      const p = this.freeSpot(this.player.x, this.player.y - 60);
      this.dropItem(room.id, p.x, p.y);
    }
    this.refreshInventory();
    if (e.fight && this.foeKinds.length > 0) {
      // Pelea: la sala no queda limpia hasta vencerlos (checkClear), como el cofre trampa
      this.eventsDone.add(room.id);
      this.eventSpots = [];
      this.prompt.setText('');
      this.clearEventObjs();
      for (let n = 0; n < e.fight; n++) {
        const k = this.foeKinds[n % this.foeKinds.length];
        this.spawnEnemy(k, k.behavior);
      }
      this.setDoorsLocked(room, true, true);
      this.cameras.main.shake(160, 0.006);
      this.drawMap();
      this.saveNow();
      return;
    }
    this.finishEvent(room);
  }

  /** Forja: yunque con dos puntos de uso (reciclar y fusionar). Un solo uso por forja. */
  private placeForge(room: Room, x: number, y: number) {
    const g = buildForgeArt(this, x, y);
    this.eventObjs.push(g);
    const label = (lx: number, ly: number, text: string, color = '#ffffff') => {
      const t = this.add.text(lx, ly, text, { fontFamily: FONT, fontSize: '15px', color, stroke: '#101828', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(4);
      this.eventObjs.push(t);
    };
    label(x, y - 44, 'Forja', '#ffcc80');
    const actions: [number, string, () => void][] = [
      [x - 150, 'Reciclar', () => this.forgeRecycle(room)],
      [x, 'Mejorar', () => this.forgeUpgrade(room)],
      [x + 150, 'Fusionar', () => this.forgeFuse(room)],
    ];
    for (const [ax, text, use] of actions) {
      const z = this.add.zone(ax, y + 70, 130, 44).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => (this.overHud = true));
      z.on('pointerout', () => (this.overHud = false));
      z.on('pointerdown', () => this.current?.id === room.id && use());
      this.eventObjs.push(z);
      label(ax, y + 70, text, '#ffe0b2');
    }
    this.eventSpots.push(
      { x: x - 150, y: y + 70, prompt: () => 'Enter / A / clic: reciclar un objeto por monedas (libera su hueco)', use: actions[0][2] },
      { x, y: y + 70, prompt: () => 'Enter / A / clic: mejorar un objeto (+25 % a su efecto, hasta +3)', use: actions[1][2] },
      { x: x + 150, y: y + 70, prompt: () => 'Enter / A / clic: fusionar dos objetos de la misma rareza en uno mejor', use: actions[2][2] },
    );
  }

  /**
   * Altar de la Mega Piedra (una sola vez por piso). Si ya la llevas, el altar sale apagado y no la vuelve a dar.
   * Usa su propia marca en eventsDone (megaStoneDoneKey) para convivir con la forja de la Torre.
   */
  private placeMegaAltar(room: Room, x: number, y: number) {
    const mine: Phaser.GameObjects.GameObject[] = [];
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      mine.push(o);
      this.eventObjs.push(o);
      return o;
    };
    const have = this.passives.includes(MEGA_STONE_ID);
    keep(buildMegaShrine(this, x, y, have));
    keep(
      this.add
        .text(x, y + 58, have ? 'Santuario de la Mega Piedra\nYa la llevas' : 'Santuario de la Mega Piedra', { fontFamily: FONT, fontSize: '15px', color: have ? '#9aa3b4' : '#c8ecff', stroke: '#101828', strokeThickness: 4, align: 'center' })
        .setOrigin(0.5)
        .setDepth(4),
    );
    const spot = { x, y, prompt: () => (have ? 'Ya llevas la Mega Piedra' : 'Enter / A / clic: coger la Mega Piedra'), use: () => take() };
    const take = () => {
      const key = megaStoneDoneKey(room.id);
      if (have || this.ended || this.transitioning || this.eventsDone.has(key) || this.itemChoiceOpen || this.current?.id !== room.id) return;
      this.eventsDone.add(key);
      const item = passiveById(MEGA_STONE_ID);
      if (item) this.gainItem({ kind: 'passive', item });
      this.refreshInventory();
      this.eventSpots = this.eventSpots.filter((sp) => sp !== spot);
      this.prompt.setText('');
      this.eventObjs = this.eventObjs.filter((o) => !mine.includes(o));
      this.tweens.add({ targets: mine, alpha: 0, duration: 500, onComplete: () => mine.forEach((o) => o.destroy()) });
      this.drawMap();
      this.saveNow();
    };
    if (!have) {
      const z = keep(this.add.zone(x, y + 10, 120, 80));
      z.setInteractive({ useHandCursor: true });
      z.on('pointerover', () => (this.overHud = true));
      z.on('pointerout', () => (this.overHud = false));
      z.on('pointerdown', () => this.current?.id === room.id && take());
    }
    this.eventSpots.push(spot);
  }

  private forgeUsable(room: Room) {
    return !this.ended && !this.transitioning && !this.eventsDone.has(room.id) && !this.itemChoiceOpen;
  }

  private forgeRecycle(room: Room) {
    if (!this.forgeUsable(room)) return;
    const owned = distinctPassives(this.passives);
    if (owned.length === 0) return this.notify('Forja: no llevas objetos que reciclar', { kind: 'warning', icon: 'bag' });
    this.openItemChoice(
      'FORJA: RECICLAR',
      'Elige el objeto que quieres destruir: te da monedas y libera su hueco.',
      owned.map((id) => `${this.passiveName(id, true)} → +${recycleCoins(id, this.passives)} monedas`),
      (i) => {
        if (i < 0) return;
        const id = owned[i];
        const coins = recycleCoins(id, this.passives);
        this.nextItemChoice('FORJA: RECICLAR', `¿Destruir ${this.passiveName(id, true)} por ${coins} monedas?\nLa forja solo se puede usar una vez.`, [`Reciclar por ${coins} monedas`], (ok) => {
          if (ok !== 0 || !this.forgeUsable(room)) return;
          const r = recycle(this.passives, id);
          if (id === 'banda-focus') this.focusLeft = 0;
          this.passives = r.passives;
          this.coins += r.coins;
          sfx('coin');
          this.notify(`Forja: ${passiveById(id)?.name ?? id} reciclado\n+${r.coins} monedas`, { kind: 'reward', icon: 'bag' });
          this.passivesChanged();
          this.finishEvent(room);
        });
      },
    );
  }

  /** T73: mejorar un objeto con valor numérico (+25 % a su efecto por nivel, hasta +3). */
  private forgeUpgrade(room: Room) {
    if (!this.forgeUsable(room)) return;
    const list = upgradeCandidates(this.passives, this.itemLevels);
    if (list.length === 0) return this.notify('Forja: no llevas objetos que se puedan mejorar', { kind: 'warning', icon: 'bag' });
    const cost = (id: string) => upgradeCost(id, levelOf(this.itemLevels, id));
    this.openItemChoice(
      'FORJA: MEJORAR',
      `Cada nivel da +25 % al efecto del objeto (hasta +${UPGRADE_MAX}). Tienes ${this.coins} monedas.`,
      list.map((id) => `${this.passiveName(id, true)} → +${levelOf(this.itemLevels, id) + 1} · ${cost(id)} monedas`),
      (i) => {
        if (i < 0) return;
        const id = list[i];
        const c = cost(id);
        const lv = levelOf(this.itemLevels, id) + 1;
        const name = passiveById(id)?.name ?? id;
        this.nextItemChoice(
          'FORJA: MEJORAR',
          `¿Mejorar ${this.passiveName(id)} a ${levelLabel(name, lv)}?\nSu efecto pasa a ×${(1 + UPGRADE_STEP * lv).toFixed(2)}. Cuesta ${c} monedas (tienes ${this.coins}). La forja solo se puede usar una vez.`,
          [this.coins >= c ? `Mejorar por ${c} monedas` : `Te faltan ${c - this.coins} monedas`],
          (ok) => {
            if (ok !== 0 || !this.forgeUsable(room)) return;
            if (this.coins < c) return this.notify(`Forja: te faltan ${c - this.coins} monedas`, { kind: 'warning', icon: 'bag' });
            this.coins -= c;
            this.itemLevels = upgrade(this.itemLevels, id);
            sfx('pickup');
            this.notify(`¡Mejorado!\n${levelLabel(name, lv)}`, { kind: 'reward', icon: 'bag' });
            this.passivesChanged();
            this.finishEvent(room);
          },
          undefined,
          [this.coins < c],
        );
      },
    );
  }

  /** Elegir a mano el tipo Tera (o dejarlo automático). Dos páginas de 9 tipos para que quepan con teclado 1-9. */
  private chooseTeraType(page = 0) {
    const auto = typeNameEs(pickTeraType(this.biome.types, this.tearType, rawEffectiveness));
    const types = TERA_TYPES.slice(page * 9, page * 9 + 9);
    const now = this.teraPick ? typeNameEs(this.teraPick) : `automático (${auto})`;
    const options = [`Automático (en este bioma: ${auto})`, ...types.map((t) => typeNameEs(t)), page === 0 ? 'Más tipos…' : 'Tipos anteriores…'];
    const open = page === 0 && !this.itemChoiceOpen ? this.openItemChoice.bind(this) : this.nextItemChoice.bind(this);
    open('TIPO TERA', `Ahora: ${now}. El automático elige el de más ventaja contra el bioma.`, options, (i) => {
      if (i < 0) return;
      if (i === options.length - 1) return this.chooseTeraType(1 - page);
      this.teraPick = i === 0 ? null : types[i - 1];
      this.notify(`Tipo Tera: ${this.teraPick ? typeNameEs(this.teraPick) : 'automático'}`, { kind: 'info', icon: 'pokeball' });
      this.saveNow();
    });
  }

  private forgeFuse(room: Room) {
    if (!this.forgeUsable(room)) return;
    const firsts = distinctPassives(this.passives).filter((a) => fusePartners(a, this.passives).length > 0);
    if (firsts.length === 0) {
      return this.notify('Forja: necesitas dos objetos distintos de la misma rareza (no legendarios)', { kind: 'warning', icon: 'bag' });
    }
    const rarity = (id: string) => MOVE_RARITY_LABEL[passiveRarity(id)];
    this.openItemChoice('FORJA: FUSIONAR', 'Primer objeto (se gasta una copia de cada uno):', firsts.map((id) => `${this.passiveName(id, true)} (${rarity(id)})`), (i) => {
      if (i < 0) return;
      const a = firsts[i];
      const partners = fusePartners(a, this.passives);
      this.nextItemChoice('FORJA: FUSIONAR', `${this.passiveName(a)} + ¿cuál?`, partners.map((id) => `${this.passiveName(id, true)} (${rarity(id)})`), (j) => {
        if (j < 0) return;
        const b = partners[j];
        // Azar fijo por piso, sala y pareja: el resultado se enseña antes de aceptar y no cambia al repetir
        const seed = (this.floorSeed ^ Math.imul(room.id + 7, 0x2c1b3c6d) ^ Math.imul(this.passives.indexOf(a) + 31 * this.passives.indexOf(b) + 1, 0x297a2d39)) >>> 0;
        const res = fuseResult(a, b, this.passives, mulberry32(seed), this.passivePool());
        if (!res) return this.notify('Forja: no hay objetos de la rareza siguiente', { kind: 'warning', icon: 'bag' });
        const cost = fuseCost(a);
        this.nextItemChoice(
          'FORJA: FUSIONAR',
          `${this.passiveName(a)} + ${this.passiveName(b)} → ${res.name} (${rarity(res.id)})\n${res.description}\nCuesta ${cost} monedas (tienes ${this.coins}). La forja solo se puede usar una vez.`,
          [this.coins >= cost ? `Fusionar por ${cost} monedas` : `Te faltan ${cost - this.coins} monedas`],
          (ok) => {
            if (ok !== 0 || !this.forgeUsable(room)) return;
            if (this.coins < cost) return this.notify(`Forja: te faltan ${cost - this.coins} monedas`, { kind: 'warning', icon: 'bag' });
            this.coins -= cost;
            for (const gone of [a, b]) if (gone === 'banda-focus') this.focusLeft = Math.max(0, this.focusLeft - 1);
            if (res.id === 'banda-focus') this.focusLeft++;
            this.passives = fuse(this.passives, a, b, res.id);
            sfx('pickup');
            this.notify(`¡Fusión!\n${res.name}: ${res.description}`, { kind: 'reward', icon: 'bag' });
            this.passivesChanged();
            this.finishEvent(room);
          },
        );
      });
    });
  }

  // --- Objeto activo ---

  private useActive() {
    if (this.ended || this.transitioning || !this.active || !this.player?.active) return;
    this.cancelCharges();
    const a = activeById(this.active.id);
    if (!a) return;
    if (!isCharged(this.active.charge, a.charge)) {
      this.notify(`${OAK_LINE}\n${a.name}: aún no está cargado (${this.active.charge}/${a.charge}), se carga limpiando salas`, { kind: 'warning', icon: 'pokeball' });
      return;
    }
    if (a.id === 'teletransporte') {
      const why = this.teleportBlocked();
      if (why) return this.notify(`${a.name}: ${why}`, { kind: 'warning', icon: 'pokeball' });
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
      this.buffMul = ACTIVE_EFFECT.buffMul;
      this.popup(this.player.x, this.player.y - 50, '¡Ataque X!', a.color);
    } else if (a.id === 'pocion-activa') {
      const amount = scaleHeal(ACTIVE_EFFECT.potionHeal, this.diff);
      this.hp = Math.min(this.stats.maxHp, this.hp + amount);
      this.popup(this.player.x, this.player.y - 50, `+${amount} PS`, a.color);
    } else if (a.id === 'caramelo-raro-activo') {
      this.buffUntil = now + ACTIVE_EFFECT.candyMs;
      this.buffMul = ACTIVE_EFFECT.candyMul;
      this.popup(this.player.x, this.player.y - 50, '¡Daño ×2!', a.color);
    } else if (a.id === 'bomba-cebo') {
      this.baitBlast(this.player.x, this.player.y);
    } else if (a.id === 'silbato') {
      this.invulnUntil = Math.max(this.invulnUntil, now + ACTIVE_EFFECT.whistleMs);
      this.player.setTint(a.color);
      this.time.delayedCall(ACTIVE_EFFECT.whistleMs, () => this.player?.active && this.player.clearTint());
      this.popup(this.player.x, this.player.y - 50, '¡Inmune!', a.color);
    } else if (a.id === 'teletransporte') {
      this.teleportToStart();
    }
    this.notify(a.name, { kind: 'info', icon: 'pokeball' });
    this.saveNow();
  }

  // --- T49: poción, Bomba Cebo y Teletransporte ---

  /** Bebe una de las pociones que llevas (tecla, L3, clic en el HUD o botón táctil). */
  private drinkPotion() {
    if (this.ended || this.transitioning || !this.player?.active) return;
    if (this.potions <= 0) return this.notify(`${OAK_LINE}\nNo llevas pociones`, { kind: 'warning', icon: 'potion' });
    if (!canHeal(this.hp, this.stats.maxHp)) return this.notify('Ya tienes todos los PS', { kind: 'warning', icon: 'potion' });
    this.potions--;
    const amount = scaleHeal(CARRIED_POTION_HEAL, this.diff);
    this.hp = healed(this.hp, this.stats.maxHp, amount);
    sfx('heal');
    this.popup(this.player.x, this.player.y - 50, `Poción +${amount} PS`, 0xc39bd3);
    this.saveNow();
  }

  /** Bomba Cebo: gran explosión a tu alrededor que solo daña a los enemigos. */
  private baitBlast(x: number, y: number) {
    const R = BOMB.radius * ACTIVE_EFFECT.baitRadiusMul;
    const dmg = BOMB.damage * ACTIVE_EFFECT.baitDamageMul;
    sfx('boom');
    this.cameras.main.shake(220, 0.008);
    bombExplosion(this, x, y, R, 0xff5a3c);
    for (const c of [...this.enemies.getChildren()]) {
      const e = c as Sprite;
      if (!e.active || !inBlast(x, y, e.x, e.y, R + (e.getData('size') as number) / 3)) continue;
      this.hitEnemy(e, dmg, 'fire', e.x, e.y, 0xff7043);
    }
  }

  /** Por qué no se puede usar el Teletransporte aquí (o null si sí). */
  private teleportBlocked(): string | null {
    if (this.floor.rooms.length <= 1) return 'aquí no hay a dónde ir';
    if (this.current.kind === 'boss') return 'no funciona contra el jefe';
    if (this.current.id === this.floor.startId) return 'ya estás en la sala de inicio';
    return null;
  }

  /** Vuelve a la sala de inicio del piso. Si la sala actual no estaba limpia, sus enemigos te esperarán al volver. */
  private teleportToStart() {
    const from = this.current;
    const start = this.floor.rooms[this.floor.startId];
    this.clearEventObjs();
    this.rivalWave = 0;
    this.timeTrial?.label.destroy();
    this.timeTrial = undefined;
    this.enemies.clear(true, true);
    this.shots.clear(true, true);
    this.foeShots.clear(true, true);
    if (!this.cleared.has(from.id)) this.setDoorsLocked(from, false);
    sparkle(this, this.player.x, this.player.y);
    const n = this.interior(start);
    (this.player.body as Body).reset(n.cx, n.cy);
    this.cameras.main.centerOn(n.cx, n.cy);
    this.cameras.main.flash(250, 225, 190, 231);
    this.enterRoom(start);
    sparkle(this, n.cx, n.cy);
  }

  /** Limpiar una sala recarga el objeto activo. */
  private chargeActive() {
    if (!this.active) return;
    const a = activeById(this.active.id);
    if (a) this.active.charge = chargeAfterClear(this.active.charge, a.charge);
  }

  /**
   * T53: se pulsa parry (tecla, RT, clic central, clic en su cuadro o botón táctil). La recarga va con el reloj del
   * bucle (game.loop.time) y no con el de la escena, que se para en pausa (ver data/parry.ts).
   */
  private doParry() {
    if (this.ended || this.transitioning || this.evolving) return;
    if (!pressParry(this.parry, this.game.loop.time)) return;
    sfx('select');
    parryStance(this, this.player.x, this.player.y);
  }

  /** Cuadro del parry: dorado cuando está listo; mientras recarga, una barra que se vacía. */
  private paintParry() {
    const h = this.parryHud;
    if (!h) return;
    const left = parryCooldownLeft(this.parry, this.game.loop.time);
    const counter = this.parry.counterUntil > this.time.now;
    // Redibujar solo cuando cambia algo que se vea (pasos de 1/20)
    const key = `${Math.ceil(left * 20)}:${counter}`;
    if (h.shown === key) return;
    h.shown = key;
    h.g.clear();
    h.g.fillStyle(0x101828, 1).fillRoundedRect(h.x, h.y, h.w, h.h, 8);
    h.g.fillStyle(counter ? 0xff6b3d : left > 0 ? 0x3a4560 : COLORS.gold, 1).fillRoundedRect(h.x + 3, h.y + 3, h.w - 6, h.h - 6, 6);
    if (left > 0) h.g.fillStyle(0x6a7898, 1).fillRect(h.x + 3, h.y + h.h - 7, (h.w - 6) * left, 4);
  }

  // --- T56: salas con reglas especiales (level/roomRules.ts) ---

  /** Regla de la sala en la que estás mientras no esté limpia (una vez limpia es una sala más). */
  private activeRule(): RoomRule | undefined {
    const id = this.current?.id;
    if (id === undefined || this.cleared.has(id)) return undefined;
    return this.roomRules.get(id);
  }

  /** Al entrar en una sala con regla (ya con sus enemigos): aviso en la columna de avisos y su efecto. */
  private applyRoomRule(room: Room) {
    const rule = this.roomRules.get(room.id);
    if (!rule || this.cleared.has(room.id)) return;
    this.notify(ruleNotice(rule, typeNameEs(oneTypeFor(this.playerTypes, room.id))), { kind: 'warning', icon: 'star' });
    if (rule === 'speed') {
      for (const c of this.enemies.getChildren()) {
        const e = c as Sprite;
        if (e.active) e.setData('speed', (e.getData('speed') as number) * SPEED_ROOM_MUL);
      }
    } else if (rule === 'dark') this.makeDarkness();
  }

  /** Sala con regla limpia: se va la oscuridad y la de velocidad suelta su botín extra. */
  private onRuleRoomCleared(room: Room) {
    const rule = this.roomRules.get(room.id);
    if (!rule) return;
    this.clearDarkness();
    if (rule === 'speed') {
      const i = this.interior(room);
      speedRoomBonus(this.floorNum, this.floor.shopId !== undefined).forEach((d, k) => this.dropLoot(i.cx + (k - 1) * 40, i.cy + 20, d));
      this.notify('¡Sala de velocidad superada!\nBotín extra', { kind: 'reward', icon: 'star' });
    }
  }

  /**
   * Sala de la plaga: sale un Pokémon pequeño de la misma especie donde cayó el otro. Va marcado como ayudante: así no
   * suelta botín ni vuelve a multiplicarse (shouldMultiply no deja a los ayudantes), y la cadena siempre se acaba.
   */
  private spawnSmallCopy(parent: Sprite) {
    if (this.foeKinds.length === 0) return;
    const sheet = ((parent.getData('sheet') as string | undefined) ?? '').replace(/-s$/, '');
    const kind = this.foeKinds.find((k) => k.key === sheet) ?? (Phaser.Utils.Array.GetRandom(this.foeKinds) as FoeKind);
    const ai = parent.getData('ai') as EnemyAI | undefined;
    const p = this.freeSpot(parent.x, parent.y);
    const e = this.spawnEnemy(kind, ai?.behavior ?? kind.behavior, p);
    const size = Math.round(60 * MULTIPLY_SIZE);
    e.setDisplaySize(size, size).setData('size', size);
    if (!e.getData('shiny')) this.applyPmd(e, Number(kind.key.replace('foe-', '')), size);
    const hp = Math.max(1, Math.round(((parent.getData('maxHp') as number | undefined) ?? 20) * MULTIPLY_HP));
    e.setData('hp', hp).setData('maxHp', hp);
    if (this.fxBudget.take(this.time.now)) this.popup(p.x, p.y - 30, '¡Se multiplica!', 0x9ccc65);
  }

  /**
   * Sala a oscuras: una capa negra con un agujero alrededor del jugador (un círculo de textura y cuatro rectángulos
   * que tapan el resto). Con efectos bajos el borde es duro: la textura no lleva degradado (ver darkEdge).
   */
  private makeDarkness() {
    this.clearDarkness();
    const R = DARK_RADIUS;
    const edge = darkEdge(lowFx());
    const key = `dark-hole-${edge}`;
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, R * 2, R * 2);
      if (!tex) return;
      const ctx = tex.getContext();
      if (edge > 0) {
        const grad = ctx.createRadialGradient(R, R, R - edge, R, R, R);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.93)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, R * 2, R * 2);
        // Escalones: el borde de la luz se ve a bandas, como un sprite, no como un degradado de foto
        const img = ctx.getImageData(0, 0, R * 2, R * 2);
        for (let i = 3; i < img.data.length; i += 4) img.data[i] = Math.round((img.data[i] / 255) * 6) * (255 / 6);
        ctx.putImageData(img, 0, 0);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.93)';
        ctx.fillRect(0, 0, R * 2, R * 2);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(R, R, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      tex.refresh();
    }
    // Por encima de enemigos, disparos y botín; el HUD va en su propia cámara y no se tapa
    const depth = 40;
    const hole = this.add.image(this.player.x, this.player.y, key).setDepth(depth);
    const big = 4000;
    const side = (ox: number, oy: number, w: number, h: number) =>
      this.add.rectangle(0, 0, w, h, 0x000000, 0.93).setOrigin(ox, oy).setDepth(depth);
    // Ojos brillantes de los enemigos que están en la sombra (por encima de la oscuridad)
    const eyes = this.add.graphics().setDepth(depth + 1);
    this.darkness = { hole, sides: [side(1, 0.5, big, big * 2), side(0, 0.5, big, big * 2), side(0.5, 1, R * 2, big), side(0.5, 0, R * 2, big)], eyes };
    this.updateDarkness();
  }

  /** La oscuridad sigue al jugador. */
  private updateDarkness() {
    const d = this.darkness;
    if (!d || !this.player) return;
    const { x, y } = this.player;
    const R = DARK_RADIUS;
    d.hole.setPosition(x, y);
    d.sides[0].setPosition(x - R, y);
    d.sides[1].setPosition(x + R, y);
    d.sides[2].setPosition(x, y - R);
    d.sides[3].setPosition(x, y + R);
    // Dos píxeles rojos por enemigo fuera de la luz; parpadean con un ritmo distinto para cada uno
    d.eyes.clear();
    const t = this.time.now;
    for (const o of this.enemies?.getChildren() ?? []) {
      const e = o as Phaser.GameObjects.Sprite;
      if (!e.active || !e.visible) continue;
      const dist = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (dist < R * 0.8 || dist > R * 3) continue;
      if (Math.floor((t + e.x * 7) / 240) % 9 === 0) continue; // parpadeo
      d.eyes.fillStyle(0xff3030, 1).fillRect(Math.round((e.x - 9) / 3) * 3, Math.round((e.y - 6) / 3) * 3, 6, 6);
      d.eyes.fillRect(Math.round((e.x + 3) / 3) * 3, Math.round((e.y - 6) / 3) * 3, 6, 6);
    }
  }

  private clearDarkness() {
    if (!this.darkness) return;
    this.darkness.hole.destroy();
    this.darkness.sides.forEach((s) => s.destroy());
    this.darkness.eyes.destroy();
    this.darkness = undefined;
  }

  /** T55: suma adrenalina; si se llena, avisa en la columna de avisos (nunca en el centro). */
  private addAdrenaline(source: AdrenalineSource) {
    if (this.ended || !gainAdrenaline(this.adrenaline, source)) return;
    this.notify('¡Adrenalina!\nMás velocidad y daño unos segundos', { kind: 'reward', icon: 'star' });
    sfx('levelup');
  }

  /** Barra de adrenalina con las formas de theme.ts: cuadro GBA y relleno naranja (rojo intenso mientras está activa). */
  private paintAdrenaline() {
    const h = this.adrenalineHud;
    if (!h) return;
    const fill = adrenalineFill(this.adrenaline);
    const on = adrenalineActive(this.adrenaline);
    // Brasas que salen de los pies del jugador mientras dura la adrenalina (cada ~140 ms, sin acumular con la pausa)
    if (on && this.player?.active && this.time.now >= this.adrenalineTrailAt && this.fxBudget.take(this.time.now)) {
      this.adrenalineTrailAt = this.time.now + 140;
      adrenalineTrail(this, this.player.x, this.player.y);
    }
    const key = `${Math.round(fill * 40)}:${on}`;
    if (h.shown === key) return;
    h.shown = key;
    h.g.clear();
    drawBox(h.g, h.x, h.y, h.w, h.h, { fill: 0x1d2440 });
    const inner = { x: h.x + 10, y: h.y + 10, w: h.w - 20, h: h.h - 20 };
    if (fill > 0) h.g.fillStyle(on ? 0xff3d3d : 0xff9a3d, 1).fillRect(inner.x, inner.y, Math.max(2, inner.w * fill), inner.h);
    h.text.setText(on ? '¡Adrenalina!' : 'Adrenalina').setColor(on ? '#fff3b0' : '#f8f8f8');
  }

  /** Cuadro del objeto activo abajo a la izquierda: color, nombre corto y carga por casillas. */
  private paintActionBadges() {
    const device = currentInput();
    if (this.badgeShown === device) return;
    this.badgeShown = device;
    const keys = loadKeys();
    for (const b of this.actionBadges) {
      b.g.clear();
      // T74: la etiqueta de la megaevolución solo si se ofrece (Mega Piedra y Pokémon con mega)
      if (b.action === 'mega' && !this.powerButtonOffered()) {
        b.t.setVisible(false);
        continue;
      }
      if (device === 'touch') {
        b.t.setVisible(false);
        continue;
      }
      const pad = device === 'gamepad';
      const label = pad ? b.pad : keyLabel(keys[b.action]);
      // Nunca más ancho que su hueco (las teclas de nombre largo encogen el texto)
      const want = Math.max(22, 10 + label.length * 7);
      const w = Math.min(want, b.maxW);
      b.t.setScale(want > w ? Math.max(0.6, (w - 6) / (want - 10)) : 1);
      b.g.fillStyle(0x101828, 1).fillRoundedRect(b.x - w / 2 - 2, b.y - 10, w + 4, 20, 6);
      b.g.fillStyle(pad ? 0x4a5468 : 0xe8e8f0, 1).fillRoundedRect(b.x - w / 2, b.y - 8, w, 16, 5);
      if (!pad) b.g.fillStyle(0xb8bcc8, 1).fillRect(b.x - w / 2 + 2, b.y + 5, w - 4, 2);
      b.t.setText(label).setColor(pad ? '#ffffff' : '#1d2848').setPosition(b.x, b.y - 1).setVisible(true);
    }
  }

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
    drawHudFrame(g, x, y, bw, 110).setAlpha(a ? 1 : 0.6);
    if (!a) {
      this.activeIcon?.setVisible(false);
      return void h.text.setText('Sin objeto activo');
    }
    const ready = isCharged(this.active!.charge, a.charge);
    g.fillStyle(0x000000, 0.35).fillCircle(x + 36, y + 40, 22);
    if (!this.activeIcon || !this.activeIcon.active) {
      this.activeIcon = this.add.image(x + 36, y + 40, itemIconKey(a.id)).setScale(2.4);
      this.hudLayer.add(this.activeIcon);
      if (this.hudCam) this.activeIcon.cameraFilter &= ~this.hudCam.id;
    }
    this.activeIcon.setTexture(this.textures.exists(itemIconKey(a.id)) ? itemIconKey(a.id) : iconKey('pokeball')).setVisible(true).setAlpha(ready ? 1 : 0.5);
    const sw = (bw - 32) / a.charge;
    for (let k = 0; k < a.charge; k++) {
      g.fillStyle(k < this.active!.charge ? 0x3fc35a : 0x404a5c, 1).fillRect(x + 16 + k * sw, y + 80, sw - 4, 12);
    }
    h.text.setText(`${shorten(a.name, 12)}\n${ready ? '¡LISTO!' : `${this.active!.charge}/${a.charge}`}`);
  }

  private refreshInventory() {
    const counts = new Map<string, number>();
    for (const id of this.passives) counts.set(id, (counts.get(id) ?? 0) + 1);
    // Iconos de los objetos en rejilla (con "x2" si se repiten); el texto queda vacío
    this.invIcons.forEach((o) => o.destroy());
    this.invIcons = [];
    // T73: huecos ocupados / disponibles encima de los iconos
    this.invText.setText(`Objetos ${slotsLabel(this.passives, this.bossesBeaten)}`);
    const LX = HUD.left.x + HUD.pad;
    const LW = HUD.left.w - HUD.pad * 2;
    // Rejilla de data/hudLayout.ts: debajo del título, repartida en todo el ancho (4 por fila)
    const cells = itemGrid(counts.size, LW);
    [...counts].forEach(([id, n], k) => {
      const x = LX + cells[k].x;
      const y = cells[k].y;
      const key = this.textures.exists(itemIconKey(id)) ? itemIconKey(id) : iconKey('bag');
      const img = this.add.image(x, y, key);
      // El icono cabe en su círculo sea cual sea el tamaño de su textura
      img.setScale(Math.min(2.2, (HUD_ITEM_R * 2 - 6) / Math.max(1, img.width, img.height)));
      const objs: Phaser.GameObjects.GameObject[] = [this.add.circle(x, y, HUD_ITEM_R, 0x000000, 0.35), img];
      // T73: nivel de mejora de la forja («+2») arriba a la izquierda del icono
      const lv = levelOf(this.itemLevels, id);
      if (lv > 0) objs.push(this.add.text(x - 18, y - 16, `+${lv}`, { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#ffcc80' }).setOrigin(0, 0).setStroke('#101828', 4));
      if (n > 1) objs.push(this.add.text(x + 18, y + 16, `x${n}`, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(1, 1).setStroke('#101828', 4));
      for (const o of objs) {
        this.hudLayer.add(o);
        if (this.hudCam) o.cameraFilter &= ~this.hudCam.id;
        this.invIcons.push(o);
      }
    });
  }

  // --- Navegación entre salas ---

  private enterRoom(room: Room) {
    this.cancelCharges();
    this.current = room;
    this.roomStartSec = this.counters.seconds;
    // T56: la oscuridad es de la sala de la que vienes
    this.clearDarkness();
    this.showRooms([room.id]);
    this.setRoomCamera(room);
    this.shieldLeft = this.stats.shieldPerRoom;
    this.visited.add(room.id);
    this.huntEnterRoom(room);
    // Tutorial: la primera vez que pasa cada cosa
    if (room.kind === 'start') this.tip('move');
    else if (room.kind === 'center') this.tip('center');
    else if (room.kind === 'shop') this.tip('shop');
    if (room.kind === 'center' || room.kind === 'shop') this.npcEncounter(room);
    if (room.kind === 'boss' && !this.cleared.has(room.id)) this.gardenBossBerries();
    if (!this.cleared.has(room.id) && (this.mode === 'waves' || room.kind === 'combat' || room.kind === 'boss' || room.kind === 'challenge')) this.tip('shoot');
    if (this.chests.has(room.id)) this.tip('chest');

    if (this.mode === 'waves') this.startWave(1200);
    else if (room.kind === 'challenge' && !this.cleared.has(room.id)) {
      // Sala de desafío: se cierra y salen oleadas; al ganarlas, premio
      this.challengeWave = 1;
      this.setDoorsLocked(room, true, true);
      sfx('door');
      this.notify(`¡Sala de desafío!\nOleada 1/${CHALLENGE_WAVES}`, { kind: 'danger', icon: 'heart' });
      this.time.delayedCall(900, () => this.spawnChallengeWave(room.id));
    } else if (this.megaRoomId === room.id && !this.eventsDone.has(megaStoneDoneKey(room.id))) {
      // Santuario de la Mega Piedra: se redibuja al volver mientras no la hayas cogido
      this.startEvent(room, 'megaStone');
    } else if (this.roomEvent?.roomId === room.id && !this.eventsDone.has(room.id) && !this.cleared.has(room.id) && (this.roomEvent.kind !== 'thief' || thiefCanAppear(this.coins))) {
      // T70: sin monedas el ladrón no aparece y la sala se juega como una de combate normal (rama de abajo)
      this.startEvent(room, this.roomEvent.kind);
    } else if (this.isLairRoom(room)) {
      this.spawnLegend(room);
    } else if ((room.kind === 'combat' || room.kind === 'boss') && !this.cleared.has(room.id)) {
      if (room.kind === 'boss') this.gymThenBoss(room.id);
      else if (room.id === this.minibossRoom) {
        this.spawnMiniboss();
        this.spawnEnemies(1);
      } else {
        // Una sala grande lleva más enemigos (algo menos por casilla)
        const cells = this.groupIds(room).length;
        const n = Math.round(Phaser.Math.Between(...this.difficulty.enemies) * (cells > 1 ? cells * 0.75 : 1));
        this.spawnEnemies(n);
        this.applyRoomRule(room);
      }
      this.setGroupDoorsLocked(room, true, true);
      sfx('door');
    }

    if (room.kind === 'secret') this.enterSecret(room);

    this.drawMap();
    this.saveNow();
  }

  /** Easter eggs de las salas secretas (easterEggs.ts): MissingNo. duplica el objeto; el camión esconde algo. */
  private enterSecret(room: Room) {
    const v = secretVariant(this.floorSeed, room.id);
    if (v === 'normal') return;
    this.clearEventObjs();
    const i = this.interior(room);
    if (v === 'missingno') {
      this.eventObjs.push(drawGlitchFigure(this, i.x0 + 120, i.y0 + 150));
      this.eventObjs.push(this.add.text(i.x0 + 120, i.y0 + 170, 'MissingNo.', { fontFamily: FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setStroke('#18202c', 4).setDepth(3));
      if (this.eventsDone.has(room.id)) return;
      this.eventsDone.add(room.id);
      glitchFlash(this, i.cx, i.cy, ROOM.w, ROOM.h);
      sfx('boom');
      // Copia el objeto de la sala (como el famoso truco del sexto objeto)
      const original = this.floorItems.find((f) => f.roomId === room.id);
      const copy = original ? this.fromSaved(original.drop) : null;
      if (copy) this.spawnPickup(room.id, i.cx + 110, i.cy, copy);
      else this.dropItem(room.id, i.cx + 110, i.cy);
      this.notify('¡¿MissingNo.?!\nEl objeto de la sala se ha duplicado', { kind: 'reward', icon: 'star' });
      return;
    }
    // El camión: ¿hay un Mew debajo?
    const tx = i.x0 + 170;
    const ty = i.y0 + 130;
    this.eventObjs.push(drawTruck(this, tx, ty));
    if (this.eventsDone.has(room.id)) return;
    const look = () => {
      if (this.eventsDone.has(room.id) || this.current?.id !== room.id) return;
      this.eventsDone.add(room.id);
      const roll = mulberry32((this.floorSeed ^ Math.imul(room.id + 3, 0x27d4eb2f)) >>> 0)();
      if (roll < MEW_CHANCE) {
        sfx('evolve');
        this.dropItem(room.id, tx, ty + 70);
        this.notify('¡Había un Mew debajo del camión!\nSe ha ido volando, pero te ha dejado un regalo', { kind: 'reward', icon: 'star' });
      } else {
        sfx('pickup');
        for (const dx of [-40, 0, 40]) this.spawnLoot(room.id, tx + dx, ty + 60, { kind: 'coin', value: 2 });
        this.notify('Debajo del camión no hay ningún Mew...\nPero sí unas monedas', { kind: 'info', icon: 'coin' });
      }
      this.saveNow();
    };
    this.eventSpots.push({ x: tx, y: ty + 30, prompt: () => (this.eventsDone.has(room.id) ? '' : 'Enter / A / clic: mirar debajo del camión'), use: look });
    // Con el ratón: clic en el camión
    const z = this.add.zone(tx, ty - 30, 170, 90).setInteractive({ useHandCursor: true });
    z.on('pointerover', () => (this.overHud = true));
    z.on('pointerout', () => (this.overHud = false));
    z.on('pointerdown', look);
    this.eventObjs.push(z);
  }

  private spawnChallengeWave(roomId: number) {
    if (this.ended || this.current.id !== roomId) return;
    const n = challengeWaveSize(this.floorNum, this.challengeWave);
    this.spawnEnemies(n);
  }

  private transition(dir: Dir) {
    const next = this.floor.rooms[this.current.doors[dir]!];
    this.transitioning = true;
    touchAdrenaline(this.adrenaline);
    this.clearEventObjs();
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
    let [x, y] = pos[OPPOSITE[dir]];
    // Nunca aparecer encima de un obstáculo (la zona de aparición va libre, pero por si acaso)
    const ng = this.grids.get(next.id);
    if (ng) {
      const [tx, ty] = [Math.floor((x - n.x0) / TILE), Math.floor((y - n.y0) / TILE)];
      if (!isWalkable(ng[ty]?.[tx] ?? '.')) {
        const [fx, fy] = nearestWalkable(ng, tx, ty);
        [x, y] = [n.x0 + fx * TILE + TILE / 2, n.y0 + fy * TILE + TILE / 2];
      }
    }
    (this.player.body as Body).reset(x, y);

    this.showRooms([this.current.id, next.id]);
    this.cameras.main.stopFollow();
    this.cameras.main.removeBounds();
    this.cameras.main.pan(n.cx, n.cy, 300, 'Sine.easeInOut', true, (_cam: unknown, progress: number) => {
      if (progress < 1) return;
      this.transitioning = false;
      this.enterRoom(next);
    });
  }

  private checkExit() {
    this.followCell();
    const i = this.interior(this.current);
    const { x, y } = this.player;
    let exit: Dir | null = null;
    if (y < i.y0 - WALL / 2) exit = 'up';
    else if (y > i.y1 + WALL / 2) exit = 'down';
    else if (x < i.x0 - WALL / 2) exit = 'left';
    else if (x > i.x1 + WALL / 2) exit = 'right';
    if (exit && this.current.doors[exit] !== undefined && !this.mergedSide(this.current, exit)) this.transition(exit);
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
    // T72: la Torre decide su plantilla (towerFloorSpec) para no repetirla en dos pisos seguidos
    const grid = this.towerSpec ? towerGrid(this.towerSpec) : layoutFor(this.floorSeed, room.id, room.kind, this.groupIds(room).length > 1);
    this.renderObstacles(room, grid);
  }

  /**
   * Dibuja los obstáculos de la cuadrícula y crea sus cuerpos. Todo lo que se crea aquí se apunta en obstacleObjs
   * (T78: al caer a la arena nueva de la fase 2 se quita entero y se dibuja la nueva).
   */
  private renderObstacles(room: Room, grid: Grid) {
    this.grids.set(room.id, grid);
    const n0 = this.children.list.length;
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
            // Un poco de desorden (posición y espejo) para que un grupo de rocas no parezca una cuadrícula
            const jit = ((tx * 73856093) ^ (ty * 19349663) ^ room.id) >>> 0;
            const rock = this.add.image(cx + ((jit % 5) - 2), cy + (((jit >> 3) % 5) - 2), this.tiles.rock).setScale(sc).setDepth(1).setFlipX((jit & 64) !== 0);
            this.rocks.set(`${room.id}:${tx},${ty}`, [rock, this.addWall(x, y, TILE, TILE)]);
            break;
          }
          case 'X': {
            // Muro que da forma a la sala (en L, cruz, T…): se dibuja entero en drawShapedWalls
            this.addWall(x, y, TILE, TILE);
            break;
          }
          case 'P':
            // La columna es más alta que la casilla: apoyada en su base
            this.add.image(cx, y + TILE, this.tiles.pillar).setOrigin(0.5, 1).setScale(sc).setDepth(2);
            this.addWall(x, y, TILE, TILE);
            break;
          case 'H': {
            // El foso se dibuja entero en drawPits
            const hole = this.add.rectangle(cx, cy, TILE - 6, TILE - 6).setVisible(false);
            this.holes.add(hole);
            break;
          }
          case 'W':
            this.add.image(cx, cy, this.tiles.puddle).setScale(sc).setDepth(0.6);
            break;
          case 'B': {
            const bush = this.bushes.create(cx, cy, bushKeyAt(this.tiles.bush, tx, ty)) as Sprite;
            bush.setScale(sc).refreshBody();
            bush.setDepth(2).setData('hp', 2).setData('room', room.id).setData('tile', [tx, ty]);
            break;
          }
        }
      }),
    );
    // Muros y fosos unidos (supervisor): se dibujan por zonas, no casilla a casilla
    const sc = TILE / ART_TILE;
    if (grid.some((row) => row.includes('X'))) {
      drawShapedWalls(this, grid, i, TILE, WALL, this.biome, this.tiles.wall, sc, { x: room.gx * VIEW.w, y: room.gy * VIEW.h }, sc * 2.4);
    }
    if (grid.some((row) => row.includes('H'))) drawPits(this, grid, i, TILE, this.biome);
    if (grid.some((row) => row.includes('W'))) drawPuddleLinks(this, grid, i, TILE, this.biome);
    this.obstacleObjs.set(room.id, this.children.list.slice(n0));
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
  private tileOf(x: number, y: number, room: Room = this.cellRoom(x, y)): [number, number] {
    const i = this.interior(room);
    return [Math.floor((x - i.x0) / TILE), Math.floor((y - i.y0) / TILE)];
  }

  private cellAt(x: number, y: number): Cell | undefined {
    const room = this.current && this.cellRoom(x, y);
    const grid = room && this.grids.get(room.id);
    if (!grid) return undefined;
    const [tx, ty] = this.tileOf(x, y, room);
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
    const room = this.cellRoom(x, y);
    const grid = this.grids.get(room.id)!;
    const [tx, ty] = nearestWalkable(grid, ...this.tileOf(x, y, room));
    const i = this.interior(room);
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
    if (!f || f.roomId !== this.current.id || this.cellRoom(e.x, e.y).id !== this.current.id) return toPlayer.clone();
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
    let i = this.interior(this.current);
    let x = i.cx;
    let y = i.cy;
    const cells = this.groupIds(this.current);
    for (let tries = 0; tries < 50; tries++) {
      // En una sala grande, cada intento cae en una de sus casillas al azar
      i = this.interior(this.floor.rooms[cells[Math.floor(Math.random() * cells.length)]]);
      x = Phaser.Math.Between(i.x0 + margin, i.x1 - margin);
      y = Phaser.Math.Between(i.y0 + margin, i.y1 - margin);
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) >= 220 && this.freeAt(x, y)) break;
    }
    return { x, y };
  }

  /** Varios enemigos del piso; al menos uno de cada tres dispara, sea del tipo que sea (T32). */
  /** T59: un Pokémon del equipo del rival: uno solo, con más vida que uno normal y más cuanto más tarde sale. */
  private spawnRivalMember(member: number) {
    // Su especie es la que le tocó en el equipo (si por lo que sea no está, una del piso)
    const e = this.spawnEnemy(this.rivalKinds[member - 1]);
    const maxHp = Math.round((e.getData('maxHp') as number) * rivalMemberHpMul(this.floorNum, member));
    e.setData('hp', maxHp).setData('maxHp', maxHp).setData('rival', true);
  }

  private spawnEnemies(n: number) {
    const kinds = Array.from({ length: n }, () => Phaser.Utils.Array.GetRandom(this.foeKinds) as FoeKind);
    // T51: algunos pasan a los comportamientos nuevos del bioma (más cuanto más hondo)
    const behaviors = twistBehaviors(mixBehaviors(kinds.map((k) => k.behavior)), this.level(), this.biome.types, Math.random);
    kinds.forEach((k, i) => this.spawnEnemy(k, behaviors[i]));
  }

  private spawnEnemy(
    kind: FoeKind = pickByPhase(this.foeKinds, this.phase ?? 'day', (k) => k.types, Math.random) as FoeKind,
    behavior: EnemyBehavior = kind.behavior,
    /** Ayudante invocado por el jefe: sale donde se le dice, con menos vida y sin botín. */
    helper?: { x: number; y: number },
  ): Sprite {
    const { x, y } = helper ?? this.randomSpotInRoom(60);
    // Shiny (1/200): otro color, más vida y más premio
    // T84: la cadena shiny sube la probabilidad (en el desafío diario no: mismas condiciones para todos)
    const odds = this.daily ? SHINY_ODDS.enemy : chainOdds(this.shinyChain.speciesId === Number(kind.key.replace('foe-', '')) ? this.shinyChain.count : 0);
    const shiny = rollShiny(Math.random, odds) && this.textures.exists(`${kind.key}-s-front`);
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
    const ai = this.newAI(behavior, kind.type, false);
    e.setData('ai', ai).setData('types', kind.types).setData('speciesId', Number(kind.key.replace('foe-', '')));
    // Élites: cada piso salen más. Más vida, algo más rápidos, brillo de su tipo y un ataque extra de su tipo
    if (!helper && Math.random() < eliteChance(this.level())) {
      const light = (TYPE_STYLES[kind.type] ?? TYPE_STYLES.normal).filter((st) => !['dash', 'chain', 'orbit', 'mine'].includes(st.pattern.k));
      ai.eliteMove = light[Math.floor(Math.random() * Math.min(light.length, 4))];
      ai.eliteAt = this.time.now + Phaser.Math.Between(2200, 3400);
      e.setData('hp', Math.round(hp * 1.5)).setData('maxHp', Math.round(hp * 1.5)).setData('speed', st.speed * 1.12).setData('elite', true);
      this.glowAura(e, typeColor(kind.type));
    }
    return e;
  }

  /**
   * Minijefe del piso: el Pokémon más fuerte del bioma en grande, con mucha vida y dos movimientos de su tipo (con
   * su nombre y aviso). Al caer suelta un objeto y tickets.
   */
  /**
   * Brillo de los enemigos especiales (minijefe, élite, Pokémon raro): aura que late a sus pies y chispas que suben.
   * Antes era un `preFX.addGlow`, que en muchos navegadores dejaba el sprite invisible (solo se veía la sombra).
   */
  private glowAura(e: Sprite, color: number) {
    bossAura(this, e, color, () => {
      const bd = e.body as Body | null;
      return bd ? bd.bottom : e.y + e.displayHeight / 2;
    }, 1.8);
  }

  private spawnMiniboss() {
    if (this.foeKinds.length === 0) return;
    const kind = [...this.foeKinds].sort((a, b) => b.bst - a.bst)[0];
    const e = this.spawnEnemy(kind, kind.behavior);
    const id = Number(kind.key.replace('foe-', ''));
    const size = 112;
    e.setDisplaySize(size, size).setData('size', size).setData('sheet', kind.key);
    if (!e.getData('shiny')) this.applyPmd(e, id, size);
    const hp = Math.round((e.getData('maxHp') as number) * (6 + this.level() * 0.6));
    e.setData('hp', hp).setData('maxHp', hp).setData('dmg', Math.round((e.getData('dmg') as number) * 1.3)).setData('miniboss', true);
    if (this.mode === 'tower') {
      // T72: minijefe «chetado» de la Torre: más vida y daño; encadena un segundo movimiento y suelta un objeto épico
      const thp = Math.round(hp * TOWER_MINIBOSS_HP_MUL);
      e.setData('hp', thp).setData('maxHp', thp).setData('dmg', Math.round((e.getData('dmg') as number) * TOWER_MINIBOSS_DMG_MUL));
    }
    const ai = e.getData('ai') as EnemyAI;
    ai.moves = bossStyles(kind.types, id);
    ai.eliteMove = ai.moves[0];
    ai.eliteAt = Number.POSITIVE_INFINITY; // empieza al acabar su intro
    this.glowAura(e, 0xffd34d);
    const name = kind.name ? kind.name.charAt(0).toUpperCase() + kind.name.slice(1) : 'Pokémon';
    this.notify(`¡Minijefe: ${name}!`, { kind: 'danger', icon: 'star' });
    sparkle(this, e.x, e.y);
    void cry(id);
    this.showBossIntro(ai, { boss: { texture: `${kind.key}-front`, name, types: kind.types }, tier: 'mini', subtitle: `Minijefe · ${progressText(this.mode, this.floorNum)}` });
  }

  /**
   * Reto final: el trío (los tres a la vez, barra compartida; si cae uno, los demás se enfurecen) o el gigante
   * (mucha vida y una última furia). Todos invocan ayudantes de su tipo y usan movimientos de su tipo.
   */
  private spawnFinale() {
    const f = this.finale!;
    const trio = f.kind === 'trio';
    const st = bossStats(this.bossBase, this.difficulty);
    const room = this.interior(this.current);
    const group: Sprite[] = [];
    this.finaleMembers.forEach((m, k) => {
      const size = trio ? 130 : GIANT_SIZE;
      const x = trio ? room.cx + (k - 1) * 220 : room.cx;
      const y = trio ? room.cy - 80 + (k === 1 ? -40 : 0) : room.cy - 60;
      const b = this.enemies.create(x, y, `${m.key}-front`) as Sprite;
      b.setDisplaySize(size, size).setData('sheet', m.key).setData('size', size);
      this.applyPmd(b, m.id, size);
      const ms = bossStats(m.stats, this.difficulty);
      const hp = Math.round(ms.hp * (trio ? TRIO_HP_MUL : GIANT_HP_MUL));
      b.setData('hp', hp).setData('maxHp', hp).setData('speed', ms.speed * (trio ? 0.9 : 0.8)).setData('dmg', ms.damage);
      b.setData('bname', m.name).setData('btypes', m.types).setData('finale', true).setData('speciesId', m.id);
      const ai = this.newAI(behaviorFor([m.types[0]]), m.types[0], true);
      ai.attacks = [...new Set([...bossAttacksFor(m.types, this.biome.types), 'summon' as const])];
      ai.moves = bossStyles(m.types, m.id);
      ai.nextAttack = Number.POSITIVE_INFINITY; // los activa la intro al acabar
      ai.phase = 1;
      b.setData('ai', ai);
      group.push(b);
    });
    void st;
    const label = trio ? f.name : this.finaleMembers[0].name;
    this.buildBossBar(group[0], label, this.finaleMembers[0].types[0], group);
    this.notify(trio ? `¡Reto final: ${f.name}!` : `¡Reto final: ${label}, más fuerte que nunca!`, { kind: 'danger', icon: 'star' });
    this.finaleMembers.forEach((m) => void cry(m.id));
    playTrack(TRACKS.jefe);
    const fighter = (m: (typeof this.finaleMembers)[number]) => ({ texture: `${m.key}-front`, name: m.name, types: m.types });
    this.showBossIntro(group[0].getData('ai') as EnemyAI, {
      boss: { ...fighter(this.finaleMembers[0]), name: label },
      extra: trio ? this.finaleMembers.slice(1).map(fighter) : undefined,
      tier: 'final',
      subtitle: trio ? 'Tres legendarios a la vez' : 'Legendario gigante',
    });
  }

  /** Un ataque de su tipo (élites y jefes): aviso con su nombre y destello, y luego sale (más lento que los tuyos). */
  private foeMove(e: Sprite, style: MoveStyle, type: string, dmg: number, warnMs: number, label: boolean) {
    const color = typeColor(type);
    if (label) {
      const t = this.add.text(e.x, e.y - (e.getData('size') as number) * 0.7, `¡${style.id}!`, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0.5).setStroke('#' + color.toString(16).padStart(6, '0'), 6).setDepth(16).setScale(0.4);
      this.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, alpha: 0, y: t.y - 20, delay: warnMs + 300, duration: 300, onComplete: () => t.destroy() });
    }
    const ring = this.add.circle(e.x, e.y, (e.getData('size') as number) * 0.6).setStrokeStyle(4, color, 0.9).setDepth(5);
    this.tweens.add({ targets: ring, scale: 0.4, alpha: 0.2, duration: warnMs, onComplete: () => ring.destroy() });
    e.setTintFill(color).setData('flashUntil', this.time.now + warnMs * 0.6);
    this.time.delayedCall(warnMs, () => {
      if (!e.active || this.ended || this.transitioning) return;
      const dir = new Phaser.Math.Vector2(this.player.x - e.x, this.player.y - e.y).normalize();
      castPattern(this.host, 'foe', e, dir, style.pattern, dmg, type, 0.55);
    });
  }

  /** T86: antes del líder, el puzzle del gimnasio (en pausa encima). Resolverlo da tickets; rendirse abre el paso sin premio. */
  private gymThenBoss(roomId: number) {
    if (!hasGym(this.mode, 'boss', !!this.finale && this.finaleMembers.length > 0) || !this.scene.manager.keys['GymPuzzle'] || this.floorIntroOn) {
      return this.spawnBoss();
    }
    const seed = (this.floorSeed ^ Math.imul(roomId + 1, 0x9e3779b1)) >>> 0;
    this.scene.launch('GymPuzzle', {
      kind: gymPuzzleKind(this.biome.id, seed),
      seed,
      tier: gymTier(this.mode, this.floorNum),
      onDone: (solved: boolean) => {
        this.scene.stop('GymPuzzle');
        this.scene.resume();
        this.input.keyboard?.resetKeys();
        if (solved) {
          const n = this.giveTickets(GYM_PUZZLE_TICKETS);
          this.notify(`¡Puzzle del gimnasio resuelto!${n > 0 ? `\n+${n} tickets` : ''}`, { kind: 'reward', icon: 'star' });
        }
        this.spawnBoss();
      },
    });
    this.scene.pause();
  }

  private spawnBoss() {
    if (this.finale && this.finaleMembers.length > 0) return this.spawnFinale();
    const { x, y } = this.randomSpotInRoom(110);
    const b = this.enemies.create(x, y, `${this.bossKey}-front`) as Sprite;
    b.setDisplaySize(150, 150).setData('sheet', this.bossKey).setData('size', 150);
    this.applyPmd(b, this.bossId, 150);
    const d = this.difficulty;
    const st = bossStats(this.bossBase, d);
    b.setData('hp', st.hp).setData('speed', st.speed).setData('dmg', st.damage);
    b.setData('maxHp', b.getData('hp'));
    // T63: el legendario también cuenta en el registro de combate al vencerlo
    b.setData('speciesId', this.bossId);
    this.buildBossBar(b);
    // El jefe también se comporta según su tipo
    const ai = this.newAI(behaviorFor([this.bossType]), this.bossType, true);
    // Todos los legendarios invocan ayudantes de su tipo
    // T50: más los 2 ataques extra del bioma
    ai.attacks = [...new Set([...bossAttacksFor(this.bossTypes, this.biome.types), 'summon' as const])];
    // Movimientos de su tipo (Lanzallamas, Hidrobomba, Terremoto…) además de sus ataques de jefe
    ai.moves = bossStyles(this.bossTypes, this.bossId);
    ai.nextAttack = this.time.now + 2200;
    ai.phase = 1;
    b.setData('ai', ai);
    this.notify(`¡${this.bossName}, jefe legendario!`, { kind: 'danger', icon: 'pokeball' });
    void cry(this.bossId);
    playTrack(TRACKS.jefe);
    this.showBossIntro(ai);
  }

  /** Cartel del piso nuevo (FloorIntroScene) y, al irse, el jugador cae botando en la sala. */
  private showFloorIntro() {
    if (!this.scene.manager.keys['FloorIntro'] || this.scene.isActive('FloorIntro')) return;
    const p = this.player;
    const sx = p.scaleX;
    const sy = p.scaleY;
    const y0 = p.y;
    p.setVisible(false);
    this.floorIntroOn = true;
    this.scene.launch('FloorIntro', {
      label: progressText(this.mode, this.floorNum),
      biomeId: this.biome.id,
      biomeName: this.biome.name,
      floor: this.biome.colors.floor,
      wall: this.biome.colors.wall,
      onDone: () => {
        this.scene.stop('FloorIntro');
        this.scene.resume();
        this.input.keyboard?.resetKeys();
        if (!p.active) return;
        this.transitioning = true;
        this.falling = true;
        this.physics.pause();
        p.setVisible(true).setPosition(p.x, y0 - 320).setScale(sx * 0.7, sy * 1.3);
        // Sombra que crece donde va a caer
        const land = this.add.ellipse(p.x, y0 + p.displayHeight * 0.3, 8, 3, 0x000000, 0.28).setDepth(0.5);
        this.tweens.add({ targets: land, width: 50, height: 17, duration: 420, ease: 'Quad.easeIn', onComplete: () => land.destroy() });
        this.tweens.add({
          targets: p, y: y0, duration: 420, ease: 'Quad.easeIn',
          onComplete: () => {
            dustBurst(this, p.x, y0 + p.displayHeight * 0.35, 1.3, 12);
            this.cameras.main.shake(160, 0.006);
            sfx('hit');
            // Aplastón al tocar el suelo y vuelta a su forma
            p.setScale(sx * 1.3, sy * 0.7);
            this.tweens.add({
              targets: p, scaleX: sx, scaleY: sy, duration: 260, ease: 'Back.easeOut',
              onComplete: () => {
                this.falling = false;
                this.transitioning = false;
                this.physics.resume();
                this.floorIntroOn = false;
                this.events.emit('floorintro-done');
              },
            });
          },
        });
      },
    });
    this.scene.pause();
  }

  /** Intro "VS" (supervisor) antes de que el jefe ataque: la partida se pausa debajo y se salta con Enter/Esc/clic/A. */
  private showBossIntro(ai: EnemyAI, o: { boss?: { texture: string; name: string; types: string[] }; extra?: { texture: string; name: string; types: string[] }[]; tier?: 'mini' | 'final'; subtitle?: string } = {}) {
    if (this.floorIntroOn) {
      ai.nextAttack = Number.POSITIVE_INFINITY;
      this.events.once('floorintro-done', () => this.showBossIntro(ai, o));
      return;
    }
    if (!this.scene.manager.keys['BossIntro'] || this.scene.isActive('BossIntro')) return;
    ai.nextAttack = Number.POSITIVE_INFINITY;
    const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1);
    this.scene.launch('BossIntro', {
      player: { texture: `${this.playerKey}-front`, name: cap(this.starterName), types: [this.tearType] },
      boss: o.boss ? { ...o.boss, name: cap(o.boss.name) } : { texture: `${this.bossKey}-front`, name: cap(this.bossName), types: this.bossTypes },
      extra: o.extra,
      tier: o.tier,
      subtitle: o.subtitle ?? `Legendario · ${progressText(this.mode, this.floorNum)}`,
      onDone: () => {
        this.scene.stop('BossIntro');
        this.scene.resume();
        this.input.keyboard?.resetKeys();
        // Un respiro antes del primer ataque (el reloj de la escena estuvo parado)
        this.time.delayedCall(1200, () => {
          ai.nextAttack = this.time.now;
          if (ai.eliteMove) ai.eliteAt = this.time.now + 600;
          // El resto del trío, escalonados
          let k = 1;
          for (const c of this.enemies.getChildren()) {
            const oai = (c as Sprite).getData('ai') as EnemyAI | undefined;
            if (oai?.boss && oai !== ai) oai.nextAttack = this.time.now + 700 * k++;
          }
        });
      },
    });
    this.scene.pause();
  }

  // --- Ataques de los jefes (bossPatterns.ts): aviso, ataque y fase 2 ---

  private updateBossAttacks(b: Sprite, time: number) {
    const ai = b.getData('ai') as EnemyAI;
    if (!ai.attacks || !b.active) return;
    // Fase 2: por debajo de la mitad de vida, más rápido y con más ataques
    const ratio = (b.getData('hp') as number) / (b.getData('maxHp') as number);
    // T66: megaevolución / forma furia (una vez por jefe, a la vez que la fase 2). Durante el aviso no ataca.
    if (this.updateMegaEvolution(b, ai, ratio, time)) return;
    // T78: la arena cambia al 67 % (desperfectos) y al 34 % (caída a otra arena), nunca a la vez que la megaevolución.
    // Durante el derrumbe el jefe está quieto, no ataca y no recibe daño.
    if (this.updateArena(b, ai, ratio, time)) return;
    if (ai.phase === 1 && bossPhase(ratio) === 2) {
      ai.phase = 2;
      sfx('enrage');
      {
        const bb = b.body as Body | null;
        const feetY = bb ? bb.bottom : b.y + b.displayHeight / 2;
        const col = typeColor(((b.getData('btypes') as string[] | undefined) ?? this.bossTypes)[0] ?? this.bossType);
        phaseShock(this, b.x, feetY, col, 1.3);
        this.cameras.main.flash(180, 255, 255, 255);
        bossAura(this, b, col, () => { const bd = b.body as Body | null; return bd ? bd.bottom : b.y + b.displayHeight / 2; });
        this.tweens.add({ targets: b, scaleX: b.scaleX * 1.18, scaleY: b.scaleY * 1.18, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
      }
      b.setData('speed', (b.getData('speed') as number) * PHASE2_SPEED);
      this.cameras.main.shake(250, 0.006);
      this.notify(`¡${(b.getData('bname') as string | undefined) ?? this.bossName} se enfurece!`, { kind: 'danger', icon: 'pokeball' });
      ai.nextAttack = time + 900;
    }
    // Gigante del reto final: última furia (ataca mucho más a menudo)
    if (this.finale?.kind === 'giant' && !b.getData('rage') && ratio < GIANT_RAGE_AT) {
      b.setData('rage', true);
      b.setData('speed', (b.getData('speed') as number) * 1.15);
      this.cameras.main.shake(400, 0.01);
      this.cameras.main.flash(200, 255, 80, 80);
      this.notify(`¡${(b.getData('bname') as string | undefined) ?? this.bossName} desata todo su poder!`, { kind: 'danger', icon: 'star' });
    }
    if (this.ended) return;
    // Legendarios agresivos (20/10): ráfagas cortas hacia ti entre ataque y ataque…
    const ph = ai.phase ?? 1;
    if (time >= ((b.getData('volleyAt') as number | undefined) ?? time + 1200) && time < (ai.nextAttack ?? 0) - 500) {
      const to = new Phaser.Math.Vector2(this.player.x - b.x, this.player.y - b.y).normalize();
      castPattern(this.host, 'foe', b, to, { k: 'shot', n: volleyShots(ph), spread: 0.55, speed: 300, size: 1.2 }, Math.max(1, Math.round((b.getData('dmg') as number) * 0.45)), ai.type, 0.6);
    }
    if (time >= ((b.getData('volleyAt') as number | undefined) ?? 0)) b.setData('volleyAt', time + volleyEvery(ph));
    // …y refuerzos por su cuenta cada cierto tiempo
    const reinforceAt = b.getData('reinforceAt') as number | undefined;
    if (reinforceAt === undefined) b.setData('reinforceAt', time + reinforceEvery(ph));
    else if (time >= reinforceAt && time < (ai.nextAttack ?? 0) - TELEGRAPH_MS) {
      b.setData('reinforceAt', time + reinforceEvery(ph));
      const helpers = this.enemies.getChildren().filter((c) => c.active && (c as Sprite).getData('helper')).length;
      if (megaHelpersToSummon(helpersToSummon(ph, 0), MAX_HELPERS, helpers, !!b.getData('mega')) > 0) this.bossSummon(b, ai);
    }
    if (time < (ai.nextAttack ?? 0)) return;
    // La mitad de las veces, uno de sus movimientos de tipo (sin repetir el último)
    const btypes = (b.getData('btypes') as string[] | undefined) ?? this.bossTypes;
    const rage = !!b.getData('rage');
    if (ai.moves?.length && Math.random() < (rage ? 0.7 : 0.5)) {
      const options = ai.moves.length > 1 ? ai.moves.filter((m) => m.id !== b.getData('lastMove')) : ai.moves;
      const mv = options[Math.floor(Math.random() * options.length)];
      b.setData('lastMove', mv.id);
      const mtype = btypes.find((t) => (TYPE_STYLES[t] ?? []).includes(mv)) ?? ai.type;
      ai.nextAttack = time + attackInterval(ai.phase ?? 1) * (rage ? 0.65 : 1) + TELEGRAPH_MS + 400;
      this.foeMove(b, mv, mtype, Math.round((b.getData('dmg') as number) * 0.7), TELEGRAPH_MS, true);
      return;
    }
    // T66: ya megaevolucionado, uno de cada tres ataques es su estallido mega (con aviso largo y huecos)
    if (b.getData('mega') && b.getData('lastMega') !== true && Math.random() < 0.34) {
      b.setData('lastMega', true);
      const ms = this.bossMegaBlast(b, ai);
      ai.nextAttack = time + ms + attackInterval(ai.phase ?? 1) * (rage ? 0.65 : 1);
      return;
    }
    b.setData('lastMega', false);
    const attack = pickAttack(ai.attacks, Math.random, ai.lastAttack);
    ai.lastAttack = attack;
    ai.nextAttack = time + attackInterval(ai.phase ?? 1) * (rage ? 0.65 : 1) + TELEGRAPH_MS;
    if (attack === 'ring') this.bossRing(b, ai);
    else if (attack === 'charge') this.bossCharge(b, ai, time);
    else if (attack === 'summon') this.bossSummon(b, ai);
    else if (attack === 'rain') this.bossRain(b, ai);
    else {
      // T50: los ataques extra duran más; el siguiente espera a que acaben
      const ms = this.bossExtra(b, ai, attack, ai.phase ?? 1);
      ai.nextAttack = Math.max(ai.nextAttack ?? 0, time + TELEGRAPH_MS + ms + 600);
    }
  }

  /**
   * T66: comprueba si el jefe megaevoluciona (o entra en forma furia). Devuelve true mientras dura el aviso: en ese
   * tiempo está quieto, no ataca y no recibe daño (se le devuelve la vida que tenía al empezar, así cualquier fuente de
   * daño queda cubierta sin tocar cada una). Al acabar, más daño, velocidad, ayudantes y el ataque nuevo.
   */
  private updateMegaEvolution(b: Sprite, ai: EnemyAI, ratio: number, time: number): boolean {
    const startedAt = b.getData('megaAt') as number | undefined;
    if (startedAt === undefined) {
      const who = { boss: !!ai.boss, miniboss: !!b.getData('miniboss'), helper: !!b.getData('helper') };
      if (!shouldMegaEvolve({ done: !!b.getData('megaDone') }, who, ratio)) return false;
      // T78: va entre las dos fases de la arena, con un segundo de margen antes y después
      if (this.bossEventFor(b, ai, ratio, time) !== 'mega') return false;
      this.bossBusyUntil = time + MEGA_WARN_MS;
      b.setData('megaDone', true).setData('megaAt', time).setData('megaHp', b.getData('hp'));
      const id = (b.getData('speciesId') as number | undefined) ?? 0;
      const name = (b.getData('bname') as string | undefined) ?? this.bossName;
      this.notify(megaWarning(id, name), { kind: 'danger', icon: 'star' });
      sfx('enrage');
      ai.knockUntil = time + MEGA_WARN_MS;
      b.setVelocity(0, 0);
      const mbb = b.body as Body | null;
      megaEvolveFx(this, b.x, b.y, mbb ? mbb.bottom : b.y + b.displayHeight / 2, 0xb388ff);
      b.setData('flashUntil', time + MEGA_WARN_MS).setTintFill(0xffffff);
      return true;
    }
    if (megaInvulnerable(startedAt, time)) {
      b.setData('hp', Math.max(b.getData('hp') as number, b.getData('megaHp') as number));
      b.setVelocity(0, 0);
      return true;
    }
    if (!b.getData('mega')) {
      b.setData('mega', true);
      b.setData('dmg', Math.round((b.getData('dmg') as number) * MEGA_DAMAGE_MUL));
      b.setData('speed', (b.getData('speed') as number) * MEGA_SPEED_MUL);
      const id = (b.getData('speciesId') as number | undefined) ?? 0;
      const name = (b.getData('bname') as string | undefined) ?? this.bossName;
      b.setData('bname', megaName(id, name));
      const bb = b.body as Body | null;
      const stopAura = megaAura(this, b, 0xb388ff, () => { const q = b.body as Body | null; return q ? q.bottom : b.y + b.displayHeight / 2; });
      b.once(Phaser.GameObjects.Events.DESTROY, stopAura);
      b.clearTint();
      this.notify(`¡${megaName(id, name)}!`, { kind: 'danger', icon: 'star' });
      ai.nextAttack = time + 700;
    }
    return false;
  }

  /** T78: qué suceso del jefe toca ahora (fase de arena o megaevolución): siempre en orden, uno a uno y con margen. */
  private bossEventFor(b: Sprite, ai: EnemyAI, ratio: number, time: number) {
    const isBoss = !!ai.boss && !b.getData('miniboss') && !b.getData('helper');
    return nextBossEvent({
      ratio,
      arenaDone: this.arenaDone,
      megaDone: !!b.getData('megaDone'),
      arena: isBoss && !this.ended,
      mega: isBoss,
      now: time,
      busyUntil: this.arenaFallAt !== undefined ? Number.POSITIVE_INFINITY : this.bossBusyUntil,
    });
  }

  /**
   * T78: fases de la arena (solo jefes, no minijefes ni ayudantes).
   * - Fase 1 (al bajar del 67 %): aviso de ARENA_WARN_MS marcando las casillas y luego grietas, escombros y charcos.
   * - Fase 2 (al bajar del 34 %): el suelo se derrumba y se cae a otra arena según el tipo del jefe (startFall).
   * Devuelve true mientras dura el derrumbe: el jefe está quieto, no ataca y no recibe daño.
   */
  private updateArena(b: Sprite, ai: EnemyAI, ratio: number, time: number): boolean {
    if (!ai.boss || b.getData('miniboss') || b.getData('helper') || this.ended) return false;
    if (this.arenaFallAt !== undefined) {
      const hp0 = b.getData('fallHp') as number | undefined;
      if (hp0 !== undefined) b.setData('hp', Math.max(b.getData('hp') as number, hp0));
      b.setVelocity(0, 0);
      return true;
    }
    if (this.arenaWarn) return false;
    const ev = this.bossEventFor(b, ai, ratio, time);
    if (ev !== 'arena1' && ev !== 'arena2') return false;
    const room = this.cellRoom(b.x, b.y);
    const grid = this.grids.get(room.id);
    if (!grid || room !== this.current) return false;
    const seed = (this.floorSeed ^ Math.imul(room.id + 1, 0x9e3779b1)) >>> 0;
    const player = this.tileOf(this.player.x, this.player.y, room);
    const boss = this.tileOf(b.x, b.y, room);
    if (ev === 'arena2') {
      this.startFall(room, b, seed, player, boss, time);
      return true;
    }
    this.arenaDone = 1;
    this.bossBusyUntil = time + ARENA_WARN_MS;
    const phase = arenaPhase({ grid, seed, player, boss });
    if (phase.cells.length === 0) return false;
    const i = this.interior(room);
    const marks = phase.cells.map((c) => {
      return arenaWarnTile(this, i.x0 + c.x * TILE, i.y0 + c.y * TILE, TILE, c.kind === 'grieta' ? 'grieta' : c.kind === 'charco' ? 'charco' : 'escombro');
    });
    this.arenaWarn = { at: time, roomId: room.id, phase, marks };
    this.cameras.main.shake(200, 0.003);
    this.notify('¡El suelo empieza a resquebrajarse!', { kind: 'danger', icon: 'star' });
    return false;
  }

  /** T78: fase 1 aplicada: grietas (queman un poco), escombros (rocas que se rompen con bombas) y charcos. */
  private applyArena(roomId: number, phase: ArenaPhase) {
    const room = this.floor.rooms[roomId];
    const grid = this.grids.get(roomId);
    if (!room || !grid) return;
    const i = this.interior(room);
    this.cameras.main.shake(220, 0.005);
    let rocks = false;
    for (const c of phase.cells) {
      if (grid[c.y]?.[c.x] !== '.') continue;
      const x = i.x0 + c.x * TILE;
      const y = i.y0 + c.y * TILE;
      const k = `${roomId}:${c.x},${c.y}`;
      if (c.kind === 'grieta') {
        this.arenaCracks.set(k, 'grieta');
        this.arenaObjs.push(arenaCrack(this, x, y, TILE));
      } else if (c.kind === 'charco') {
        grid[c.y][c.x] = 'W';
        this.arenaObjs.push(arenaPuddle(this, x, y, TILE));
      } else {
        grid[c.y][c.x] = 'R';
        rocks = true;
        const rock = arenaRubble(this, x, y, TILE);
        this.arenaObjs.push(rock);
        this.rocks.set(k, [rock, this.addWall(x, y, TILE, TILE)]);
      }
    }
    this.flow = undefined;
    if (rocks) this.unstickAll();
    this.arenaBeat(i, phase);
  }

  /**
   * Fase 1 aplicada: pausa de ARENA_BEAT_MS (0,5 s) en la que nadie se mueve ni recibe daño (jugador y jefe) para que se
   * aprecie la sala nueva; con una onda de polvo que recorre la sala. Con pocos efectos solo la pausa y un anillo.
   */
  private arenaBeat(i: { x0: number; y0: number }, phase: ArenaPhase) {
    const ARENA_BEAT_MS = 500;
    const now = this.time.now;
    this.invulnUntil = Math.max(this.invulnUntil, now + ARENA_BEAT_MS + 150);
    this.playerKnockUntil = Math.max(this.playerKnockUntil, now + ARENA_BEAT_MS);
    this.player.setVelocity(0, 0);
    this.clearArenaShots();
    this.arenaFallAt = this.time.now;
    for (const c of this.enemies.getChildren()) {
      const e = c as Sprite;
      const eai = e.getData('ai') as EnemyAI | undefined;
      if (!e.active || !eai?.boss) continue;
      e.setData('fallHp', e.getData('hp'));
      eai.knockUntil = Math.max(eai.knockUntil ?? 0, this.time.now + ARENA_BEAT_MS);
      eai.nextAttack = Math.max(eai.nextAttack ?? 0, this.time.now + ARENA_BEAT_MS + 300);
      e.setVelocity(0, 0);
    }
    this.cameras.main.flash(160, 255, 235, 200);
    for (const c of phase.cells) {
      const cx = i.x0 + c.x * TILE + TILE / 2;
      const cy = i.y0 + c.y * TILE + TILE / 2;
      this.time.delayedCall(Math.min(300, Math.hypot(cx - this.player.x, cy - this.player.y) * 0.6), () => pixRing(this, cx, cy, TILE * 0.9, c.kind === 'charco' ? 0x7ec8ff : c.kind === 'grieta' ? 0xff8a4a : 0xcdb88c, 340));
    }
    pixRing(this, this.player.x, this.player.y + 8, 240, 0xffffff, ARENA_BEAT_MS);
    this.time.delayedCall(ARENA_BEAT_MS, () => {
      if (this.arenaDone !== 1) return;
      this.arenaFallAt = undefined;
      for (const c of this.enemies.getChildren()) (c as Sprite).setData('fallHp', undefined);
    });
  }

  /** Nada se queda dentro de un obstáculo nuevo (el jugador ya está fuera por arenaPhase; por si se movió). */
  private unstickAll() {
    const unstick = (o: Sprite) => {
      if (this.freeAt(o.x, o.y)) return;
      const p = this.freeSpot(o.x, o.y);
      o.setPosition(p.x, p.y);
    };
    unstick(this.player);
    this.enemies.getChildren().forEach((c) => c.active && unstick(c as Sprite));
  }

  /** T78: quita los disparos de todos (al empezar y al acabar la caída de la fase 2). */
  private clearArenaShots() {
    this.shots.clear(true, true);
    this.foeShots.clear(true, true);
  }

  /**
   * T78: fase 2. Tiembla todo, el suelo se derrumba y jugador y jefe caen a otra arena: temblor (FALL_SHAKE_MS),
   * fundido a negro, cambio de sala (swapArena) y vuelta, en FALL_TOTAL_MS. Mientras tanto nadie recibe daño, los
   * jefes no atacan y no quedan disparos. La sala es la misma (puertas y trampilla en su sitio) con otro suelo y
   * otros obstáculos. La música y el estado del combate siguen igual.
   */
  private startFall(room: Room, b: Sprite, seed: number, player: [number, number], boss: [number, number], time: number) {
    this.arenaDone = 2;
    this.arenaFallAt = time;
    this.bossBusyUntil = time + FALL_TOTAL_MS + FALL_LOOK_MS;
    const now = this.time.now;
    for (const c of this.enemies.getChildren()) {
      const e = c as Sprite;
      const eai = e.getData('ai') as EnemyAI | undefined;
      if (!e.active || !eai?.boss) continue;
      e.setData('fallHp', e.getData('hp'));
      eai.knockUntil = Math.max(eai.knockUntil ?? 0, time + FALL_TOTAL_MS + FALL_LOOK_MS);
      eai.nextAttack = Math.max(eai.nextAttack ?? 0, time + FALL_TOTAL_MS + FALL_LOOK_MS + 900);
      e.setVelocity(0, 0);
    }
    this.invulnUntil = Math.max(this.invulnUntil, now + FALL_TOTAL_MS + FALL_LOOK_MS + 400);
    this.playerKnockUntil = Math.max(this.playerKnockUntil, now + FALL_TOTAL_MS + FALL_LOOK_MS);
    this.player.setVelocity(0, 0);
    this.clearArenaShots();
    const fall = arenaFall({ bossTypes: (b.getData('btypes') as string[] | undefined) ?? this.bossTypes, speciesId: b.getData('speciesId') as number | undefined, seed, player, boss });
    sfx('enrage');
    this.notify(FALL_WARNING, { kind: 'danger', icon: 'star' });
    const cam = this.cameras.main;
    // Derrumbe épico: el temblor crece, la cámara se acerca, salen grietas desde el jefe y las losas caen (arenaQuake)
    cam.shake(FALL_SHAKE_MS + FALL_FADE_MS, 0.014);
    if (!lowFx()) {
      this.time.delayedCall(FALL_SHAKE_MS * 0.55, () => cam.flash(140, 255, 220, 160));
      this.time.delayedCall(FALL_SHAKE_MS * 0.85, () => cam.flash(140, 255, 220, 160));
    }
    const i = this.interior(room);
    this.arenaObjs.push(...arenaQuake(this, i.x0, i.y0, ROOM.w, ROOM.h, b.x, b.y, FALL_SHAKE_MS));
    if (!lowFx()) {
      // Cinemática corta: bandas de cine, gran grieta que parte la sala por el jefe, rugido con cámara lenta y sacudida del jefe
      arenaLetterbox(this, this.scale.width, this.scale.height, 260, FALL_SHAKE_MS - 260 + FALL_FADE_MS, 300);
      // Derrumbe propio de cada jefe según su concepto (Dialga rebobina el tiempo, Palkia rasga el espacio, Giratina voltea
      // el suelo…); los de un solo elemento y los demás, el de su tipo (Moltres fuego, Articuno ventisca…)
      this.arenaObjs.push(arenaChasm(this, i.x0, i.y0, ROOM.w, ROOM.h, b.x, b.y, FALL_SHAKE_MS, FALL_GLOW[fall.theme]));
      const style = fallStyleOf(b.getData('speciesId') as number | undefined, (b.getData('btypes') as string[] | undefined) ?? this.bossTypes);
      this.arenaObjs.push(fallConceptFx(this, fall.theme, i.x0, i.y0, ROOM.w, ROOM.h, b.x, b.y, FALL_SHAKE_MS) ?? arenaFallFx(this, style, i.x0, i.y0, ROOM.w, ROOM.h, b.x, b.y, FALL_SHAKE_MS));
      this.time.delayedCall(FALL_SHAKE_MS * 0.3, () => {
        sfx('enrage');
        cam.flash(180, 255, 255, 255);
        this.tweens.timeScale = 0.4;
        this.tweens.add({ targets: b, scale: b.scale * 1.12, duration: 160, yoyo: true, repeat: 2 });
        this.time.delayedCall(450, () => { this.tweens.timeScale = 1; });
      });
    }
    this.time.delayedCall(FALL_SHAKE_MS, () => cam.fadeOut(FALL_FADE_MS, 0, 0, 0));
    this.time.delayedCall(FALL_SHAKE_MS + FALL_FADE_MS, () => this.swapArena(room, fall));
    this.time.delayedCall(FALL_SHAKE_MS + FALL_FADE_MS + FALL_HOLD_MS, () => {
      cam.fadeIn(FALL_FADE_MS, 0, 0, 0);
      cam.shake(320, 0.018);
      sfx('boom');
      arenaLanding(this, this.player.x, this.player.y + 10, FALL_GLOW[fall.theme]);
    });
    this.time.delayedCall(FALL_TOTAL_MS + FALL_LOOK_MS, () => {
      this.arenaFallAt = undefined;
      for (const c of this.enemies.getChildren()) (c as Sprite).setData('fallHp', undefined);
    });
  }

  /** T78: cambia la sala por la arena nueva (con la pantalla en negro). */
  private swapArena(room: Room, fall: ReturnType<typeof arenaFall>) {
    this.clearArenaShots();
    if (this.arenaWarn) {
      this.arenaWarn.marks.forEach((m) => m.destroy());
      this.arenaWarn = undefined;
    }
    for (const o of this.obstacleObjs.get(room.id) ?? []) o.destroy();
    for (const k of [...this.rocks.keys()]) {
      if (!k.startsWith(`${room.id}:`)) continue;
      this.rocks.get(k)?.forEach((o) => o.destroy());
      this.rocks.delete(k);
    }
    this.arenaObjs.forEach((o) => o.destroy());
    this.arenaObjs = [];
    for (const k of [...this.arenaCracks.keys()]) if (k.startsWith(`${room.id}:`)) this.arenaCracks.delete(k);
    const i = this.interior(room);
    // Fondo animado de la arena: el de su tipo o el del concepto del legendario (cámara del tiempo, vacío estelar…)
    this.arenaObjs.push(arenaBackdrop(this, i.x0, i.y0, ROOM.w, ROOM.h, fall.theme, FALL_TINT[fall.theme]));
    this.renderObstacles(room, fall.grid);
    for (const [tx, ty] of fall.hazards) {
      const k = `${room.id}:${tx},${ty}`;
      const cx = i.x0 + tx * TILE + TILE / 2;
      const cy = i.y0 + ty * TILE + TILE / 2;
      const hz = FALL_HAZARD[fall.theme];
      if (hz === 'lava') {
        this.arenaCracks.set(k, 'lava');
        // Ho-Oh y Reshiram: fuego sagrado; el resto (cueva de lava, magma de Groudon), lava
        this.arenaObjs.push(fall.theme === 'arcoiris' ? sacredFlame(this, cx - TILE / 2, cy - TILE / 2, TILE) : arenaLava(this, cx - TILE / 2, cy - TILE / 2, TILE));
      } else if (hz === 'hielo') {
        this.arenaIce.add(k);
        this.arenaObjs.push(arenaIce(this, cx - TILE / 2, cy - TILE / 2, TILE, 0.5, fall.theme === 'psique' ? 0xe8a8f8 : 0xcfeeff));
      }
    }
    this.flow = undefined;
    this.unstickAll();
    this.cameras.main.shake(200, 0.01);
    this.notify(FALL_LANDING[fall.theme], { kind: 'danger', icon: 'star' });
  }

  /**
   * T78: aplica la fase 1 al acabar su aviso (aunque el jefe ya no esté) y hace daño en las grietas (poco) y en la
   * lava (más) mientras las pisas, nunca por debajo de 1 PS ni mientras eres invulnerable.
   */
  private arenaTick(time: number) {
    const w = this.arenaWarn;
    if (w && time >= w.at + ARENA_WARN_MS) {
      this.arenaWarn = undefined;
      w.marks.forEach((m) => m.destroy());
      this.applyArena(w.roomId, w.phase);
    }
    if (this.arenaCracks.size === 0 || this.ended || this.transitioning || this.hp <= 1 || time < this.arenaTickAt) return;
    if (this.time.now < this.invulnUntil) return;
    const [tx, ty] = this.tileOf(this.player.x, this.player.y, this.current);
    const kind = this.arenaCracks.get(`${this.current.id}:${tx},${ty}`);
    if (!kind) return;
    this.arenaTickAt = time + 700;
    const chip = Math.min(Math.max(1, Math.round(this.stats.maxHp * (kind === 'lava' ? 0.08 : 0.04))), Math.ceil(this.hp) - 1);
    if (chip <= 0) return;
    this.hp -= chip;
    this.popup(this.player.x, this.player.y - 50, `-${chip} PS (${kind === 'lava' ? 'lava' : 'grietas'})`, 0xff7a59);
  }

  /** T66: estallido mega: rayos marcados desde el jefe que estallan a la vez, en dos olas giradas. Devuelve su duración. */
  private bossMegaBlast(b: Sprite, ai: EnemyAI): number {
    const spec = megaBlastSpec(this.level());
    const color = typeColor(ai.type);
    this.popup(b.x, b.y - (b.displayHeight / 2 + 20), MEGA_ATTACK_LABEL, color);
    const offset = Math.random() * Math.PI * 2;
    for (let w = 0; w < spec.waves; w++) {
      const delay = w * (spec.warnMs + 250);
      this.time.delayedCall(delay, () => {
        if (!b.active || this.ended) return;
        const cx = b.x;
        const cy = b.y;
        const angles = megaBlastAngles(spec, offset + w * spec.turn);
        // Aviso: líneas finas que se van llenando (quieto mientras avisa para que no se muevan)
        ai.knockUntil = this.time.now + spec.warnMs;
        b.setVelocity(0, 0);
        const g = this.add.graphics().setDepth(4);
        for (const a of angles) {
          g.lineStyle(MEGA_BLAST_WIDTH * 2, color, 0.18).lineBetween(cx, cy, cx + Math.cos(a) * spec.length, cy + Math.sin(a) * spec.length);
          g.lineStyle(2, color, 0.9).lineBetween(cx, cy, cx + Math.cos(a) * spec.length, cy + Math.sin(a) * spec.length);
        }
        this.tweens.add({ targets: g, alpha: 0.45, yoyo: true, repeat: 3, duration: spec.warnMs / 8 });
        this.time.delayedCall(spec.warnMs, () => {
          this.tweens.killTweensOf(g);
          g.destroy();
          if (!b.active || this.ended) return;
          megaBlastFx(this, cx, cy, angles, spec.length, MEGA_BLAST_WIDTH, color);
          if (angles.some((a) => laserHits(cx, cy, a, spec.length, this.player.x, this.player.y, MEGA_BLAST_WIDTH))) this.hurtPlayer(b, true);
        });
      });
    }
    return spec.waves * (spec.warnMs + 250) + 300;
  }

  /** Invocación: círculos del color del jefe donde van a salir sus ayudantes (si ya hay muchos, hace una ráfaga). */
  private bossSummon(b: Sprite, ai: EnemyAI) {
    const alive = this.enemies.getChildren().filter((c) => c.active && (c as Sprite).getData('helper')).length;
    // T66: megaevolucionado invoca más (y con un tope algo mayor)
    const n = megaHelpersToSummon(helpersToSummon(ai.phase ?? 1, 0), MAX_HELPERS, alive, !!b.getData('mega'));
    // Ayudantes de su tipo (si no hay, de los del piso)
    const own = this.summonKinds.filter((k) => k.types.includes(ai.type));
    const kinds = own.length ? own : this.summonKinds.length ? this.summonKinds : this.foeKinds;
    if (n === 0 || kinds.length === 0) return this.bossRing(b, ai);
    const i = this.arena();
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
        const kind = Phaser.Utils.Array.GetRandom(kinds) as FoeKind;
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
    const i = this.arena();
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
        if (b.active && inBlast(p.x, p.y, this.player.x, this.player.y, R)) this.hurtPlayer(b, true);
      }
    });
  }

  // --- T50: espiral, onda expansiva, láser giratorio y zona de peligro (bossPatterns.ts) ---

  /** Lanza un ataque extra (con aviso) y devuelve cuánto dura después del aviso (ms). */
  private bossExtra(b: Sprite, ai: EnemyAI, attack: ExtraAttack, phase: 1 | 2): number {
    const color = typeColor(ai.type);
    this.popup(b.x, b.y - (b.displayHeight / 2 + 20), BOSS_ATTACK_LABEL[attack], color);
    b.setData('flashUntil', this.time.now + TELEGRAPH_MS).setTintFill(0xffffff);
    const lvl = this.level();
    if (attack === 'spiral') {
      const sp = spiralSpec(lvl, phase);
      const warn = this.add.circle(b.x, b.y, 20).setStrokeStyle(4, color, 0.9).setDepth(5);
      this.tweens.add({ targets: warn, radius: 90, angle: 360, alpha: 0.2, duration: TELEGRAPH_MS, onComplete: () => warn.destroy() });
      const base = Math.random() * Math.PI * 2;
      this.time.delayedCall(TELEGRAPH_MS, () => {
        let i = 0;
        const ev = this.time.addEvent({
          delay: sp.everyMs, repeat: sp.shots - 1,
          callback: () => {
            if (!b.active || this.ended) return ev.remove();
            for (let k = 0; k < sp.arms; k++) {
              const a = base + (k / sp.arms) * Math.PI * 2 + i * sp.turn;
              this.fireFoeShot(b, new Phaser.Math.Vector2(Math.cos(a), Math.sin(a)), ai.type);
            }
            i++;
          },
        });
      });
      return sp.shots * sp.everyMs;
    }
    if (attack === 'shockwave') {
      const sw = shockwaveSpec(lvl, phase);
      // Aviso: el suelo tiembla y se marca por dónde estará el hueco de la primera onda
      const gapAt0 = Math.random() * Math.PI * 2;
      const mark = this.add.graphics().setDepth(4);
      mark.lineStyle(6, 0xffffff, 0.8).beginPath().arc(b.x, b.y, 70, gapAt0 - sw.gap / 2, gapAt0 + sw.gap / 2).strokePath();
      this.tweens.add({ targets: mark, alpha: 0.2, yoyo: true, repeat: 2, duration: TELEGRAPH_MS / 6, onComplete: () => mark.destroy() });
      this.cameras.main.shake(TELEGRAPH_MS, 0.002);
      for (let w = 0; w < sw.waves; w++) {
        // Cada onda con el hueco en otro sitio (giro de 90-150°)
        const gapAt = gapAt0 + w * (Math.PI / 2 + Math.random() * (Math.PI / 3));
        this.time.delayedCall(TELEGRAPH_MS + w * sw.everyMs, () => {
          if (!b.active || this.ended) return;
          const cx = b.x;
          const cy = b.y;
          const g = this.add.graphics().setDepth(5);
          const st = { r: 30 };
          this.tweens.add({
            targets: st, r: sw.maxRadius, duration: ((sw.maxRadius - 30) / sw.speed) * 1000,
            onUpdate: () => {
              g.clear().lineStyle(16, color, 0.85).beginPath().arc(cx, cy, st.r, gapAt + sw.gap / 2, gapAt - sw.gap / 2 + Math.PI * 2).strokePath();
              g.lineStyle(4, 0xffffff, 0.7).beginPath().arc(cx, cy, st.r, gapAt + sw.gap / 2, gapAt - sw.gap / 2 + Math.PI * 2).strokePath();
              if (b.active && !this.ended && shockwaveHits(cx, cy, st.r, gapAt, sw.gap, this.player.x, this.player.y)) this.hurtPlayer(b, true);
            },
            onComplete: () => g.destroy(),
          });
        });
      }
      return (sw.waves - 1) * sw.everyMs + (sw.maxRadius / sw.speed) * 1000;
    }
    if (attack === 'laser') {
      const ls = laserSpec(lvl, phase);
      const start = Math.atan2(this.player.y - b.y, this.player.x - b.x) + Math.PI / 2;
      const dirSign = Math.random() < 0.5 ? 1 : -1;
      const angles = (t: number) => Array.from({ length: ls.beams }, (_, k) => start + (k / ls.beams) * Math.PI * 2 + dirSign * ls.turnSpeed * t);
      // Aviso: líneas finas donde saldrán los rayos; el jefe se queda quieto mientras dispara
      const warn = this.add.graphics().setDepth(4);
      for (const a of angles(0)) warn.lineStyle(3, color, 0.6).lineBetween(b.x, b.y, b.x + Math.cos(a) * ls.length, b.y + Math.sin(a) * ls.length);
      this.tweens.add({ targets: warn, alpha: 0.15, yoyo: true, repeat: 2, duration: TELEGRAPH_MS / 6, onComplete: () => warn.destroy() });
      ai.knockUntil = this.time.now + TELEGRAPH_MS + ls.durationMs;
      b.setVelocity(0, 0);
      this.time.delayedCall(TELEGRAPH_MS, () => {
        if (!b.active || this.ended) return;
        const g = this.add.graphics().setDepth(5);
        const st = { t: 0 };
        this.tweens.add({
          targets: st, t: ls.durationMs / 1000, duration: ls.durationMs,
          onUpdate: () => {
            if (!b.active || this.ended) return void g.clear();
            b.setVelocity(0, 0);
            g.clear();
            for (const a of angles(st.t)) {
              const x2 = b.x + Math.cos(a) * ls.length;
              const y2 = b.y + Math.sin(a) * ls.length;
              g.lineStyle(26, color, 0.35).lineBetween(b.x, b.y, x2, y2);
              g.lineStyle(10, 0xffffff, 0.9).lineBetween(b.x, b.y, x2, y2);
              if (laserHits(b.x, b.y, a, ls.length, this.player.x, this.player.y)) this.hurtPlayer(b, true);
            }
          },
          onComplete: () => g.destroy(),
        });
      });
      return ls.durationMs;
    }
    // Zona de peligro: círculos en el suelo (uno donde estás) que estallan tras el aviso
    const hz = hazardSpec(lvl, phase);
    const i = this.interior(this.current);
    const R = hz.radius;
    const spots = Array.from({ length: hz.zones }, (_, k) =>
      k === 0 && hz.onPlayer
        ? { x: this.player.x, y: this.player.y }
        : { x: Phaser.Math.Between(i.x0 + R, i.x1 - R), y: Phaser.Math.Between(i.y0 + R, i.y1 - R) },
    );
    const marks = spots.map((sp) => {
      const c = this.add.circle(sp.x, sp.y, R, color, 0.12).setStrokeStyle(4, 0xff3d00, 0.85).setDepth(3);
      this.tweens.add({ targets: c, fillAlpha: 0.45, duration: TELEGRAPH_MS + hz.warnMs });
      const inner = this.add.circle(sp.x, sp.y, 4, 0xff3d00, 0.5).setDepth(3);
      this.tweens.add({ targets: inner, radius: R, duration: TELEGRAPH_MS + hz.warnMs, ease: 'Quad.easeIn' });
      return [c, inner];
    });
    this.time.delayedCall(TELEGRAPH_MS + hz.warnMs, () => {
      marks.flat().forEach((m) => {
        this.tweens.killTweensOf(m);
        m.destroy();
      });
      if (this.ended) return;
      this.cameras.main.shake(140, 0.005);
      for (const sp of spots) {
        const fx = this.add.circle(sp.x, sp.y, R, 0xff7043, 0.75).setDepth(12);
        this.tweens.add({ targets: fx, alpha: 0, scale: 1.25, duration: 280, onComplete: () => fx.destroy() });
        if (b.active && inBlast(sp.x, sp.y, this.player.x, this.player.y, R)) this.hurtPlayer(b, true);
      }
    });
    return hz.warnMs;
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
      // Cerca de ti, de vez en cuando se lanza a morder (pequeño salto hacia delante)
      if (ai && !ai.boss && dist < 95 && time >= ai.until) {
        e.setVelocity(toPlayer.x * speed * 2.8, toPlayer.y * speed * 2.8);
        ai.knockUntil = time + 160;
        ai.until = time + Phaser.Math.Between(900, 1400);
      }
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
          // Su disparo según su tipo (bombas en parábola, ráfagas, ondas, persecución…)
          const weak = enemyDamageMul((e.getData('statuses') as ActiveStatus[] | undefined) ?? [], time);
          castPattern(this.host, 'foe', e, toPlayer.clone().normalize(), foeStyleFor(ai.type), Math.max(1, Math.round((e.getData('dmg') as number) * 0.8 * weak)), ai.type);
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

      case 'circle': {
        // Te rodea a cierta distancia y, cada poco, se lanza en línea recta y vuelve a rodear
        if (ai.state === 'dash') {
          if (time >= ai.until) {
            ai.state = 'walk';
            ai.until = time + Phaser.Math.Between(1800, 2800);
          }
          break;
        }
        if (ai.state === 'windup') {
          e.setVelocity(0, 0);
          this.face(e, toPlayer);
          if (time >= ai.until) {
            ai.state = 'dash';
            ai.until = time + 380;
            e.clearTint();
            e.setVelocity(toPlayer.x * speed * 4, toPlayer.y * speed * 4);
          }
          break;
        }
        const tangent = new Phaser.Math.Vector2(-toPlayer.y * ai.side, toPlayer.x * ai.side);
        const radial = Phaser.Math.Clamp((dist - 160) / 80, -1, 1);
        walk(tangent.scale(1.15).add(toPlayer.clone().scale(radial)).normalize());
        this.face(e, toPlayer);
        if (time >= ai.until) {
          ai.state = 'windup';
          ai.until = time + 380;
          e.setTint(0xffe082);
          if (Math.random() < 0.4) ai.side = -ai.side;
        }
        break;
      }

      case 'swarm': {
        // Enjambre: rápido y a bandazos hacia ti
        const zig = toward.clone().rotate(Math.sin(time / 130 + (ai.side > 0 ? 0 : 2)) * 0.9);
        e.setVelocity(zig.x * speed * 1.3, zig.y * speed * 1.3);
        this.face(e, zig);
        break;
      }

      case 'ambush': {
        // Escondido y casi invisible hasta que te acercas; entonces se lanza y te persigue un rato
        if (ai.state === 'walk' && time >= ai.until) {
          ai.state = 'vanish';
          e.setAlpha(0.3);
          ai.until = time + 9000;
        }
        if (ai.state === 'vanish') {
          e.setVelocity(0, 0);
          if (dist < 180 || time >= ai.until) {
            ai.state = 'windup';
            ai.until = time + 300;
            e.setAlpha(1).setTintFill(0xffffff);
            this.cameras.main.shake(80, 0.003);
          }
        } else if (ai.state === 'windup') {
          e.setVelocity(0, 0);
          this.face(e, toPlayer);
          if (time >= ai.until) {
            e.clearTint();
            ai.state = 'dash';
            ai.until = time + 420;
            e.setVelocity(toPlayer.x * speed * 4.6, toPlayer.y * speed * 4.6);
          }
        } else if (ai.state === 'dash') {
          if (time >= ai.until) {
            ai.state = 'walk';
            ai.until = time + Phaser.Math.Between(2200, 3200);
          }
        } else {
          walk(toward);
          this.face(e, toPlayer);
        }
        break;
      }

      case 'burrow': {
        // Excava: bajo tierra (solo se ve el montón de tierra que avanza hacia ti) y sale de golpe debajo
        const body = e.body as Body;
        if (ai.state === 'walk') {
          walk(toward);
          this.face(e, toPlayer);
          if (time >= ai.until) {
            ai.state = 'vanish';
            ai.until = time + 1500;
            e.setVelocity(0, 0).setAlpha(0);
            body.enable = false;
            dustBurst(this, e.x, e.y + 20, 0.9, 7);
            const mound = this.add.ellipse(e.x, e.y + 18, 40, 16, 0x6e5a44, 1).setStrokeStyle(2, 0x3a2a1a).setDepth(1.6);
            e.setData('mound', mound);
            e.once(Phaser.GameObjects.Events.DESTROY, () => mound.destroy());
          }
        } else if (ai.state === 'vanish') {
          // Avanza bajo tierra
          const step = (speed * 1.5 * this.game.loop.delta) / 1000;
          if (dist > 12) e.setPosition(e.x + toPlayer.x * step, e.y + toPlayer.y * step);
          const mound = e.getData('mound') as Phaser.GameObjects.Ellipse | undefined;
          mound?.setPosition(e.x, e.y + 18).setScale(1 + 0.15 * Math.sin(time / 60), 1);
          if (Math.random() < 0.15 && this.fxBudget.take(this.time.now)) dustBurst(this, e.x, e.y + 18, 0.4, 2);
          if (time >= ai.until) {
            ai.state = 'appear';
            ai.until = time + 380;
            (e.getData('mound') as Phaser.GameObjects.Ellipse | undefined)?.destroy();
            body.enable = true;
            body.reset(e.x, e.y);
            e.setAlpha(1);
            this.cameras.main.shake(140, 0.006);
            dustBurst(this, e.x, e.y + 18, 1.4, 12);
            typeImpact(this, e.x, e.y, ai.type, 1.1, 10);
            if (Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < 70) this.hurtPlayer(e);
          }
        } else {
          e.setVelocity(0, 0);
          this.face(e, toPlayer);
          if (time >= ai.until) {
            ai.state = 'walk';
            ai.until = time + Phaser.Math.Between(1500, 2500);
          }
        }
        break;
      }

      case 'orbitShooter': {
        // Te rodea a distancia fija (corrige hacia dentro o hacia fuera) y dispara cada poco
        const radial = dist > ORBIT_RADIUS + 40 ? 0.8 : dist < ORBIT_RADIUS - 40 ? -0.8 : 0;
        const tangent = new Phaser.Math.Vector2(-toPlayer.y * ai.side, toPlayer.x * ai.side);
        walk(tangent.add(toPlayer.clone().scale(radial)).normalize());
        this.face(e, toPlayer);
        if (time >= ai.until) {
          this.fireFoeShot(e, toPlayer.clone(), ai.type);
          ai.until = time + ORBIT_SHOT_MS + Phaser.Math.Between(0, 400);
          if (Math.random() < 0.2) ai.side = -ai.side;
        }
        break;
      }

      case 'mine': {
        // Se acerca despacio; cerca de ti se arma (parpadea en rojo) y estalla
        if (ai.state === 'windup') {
          e.setVelocity(0, 0);
          const blink = Math.floor((ai.until - time) / 120) % 2 === 0;
          if (blink) e.setTintFill(0xff3d00);
          else e.clearTint();
          if (time >= ai.until) {
            const r = MINE_RADIUS;
            const fx = this.add.circle(e.x, e.y, r, 0xff7043, 0.6).setDepth(12);
            this.tweens.add({ targets: fx, alpha: 0, scale: 1.25, duration: 300, onComplete: () => fx.destroy() });
            sfx('boom');
            this.cameras.main.shake(140, 0.005);
            if (inBlast(e.x, e.y, this.player.x, this.player.y, r)) this.hurtPlayer(e);
            e.setData('mineBlown', true);
            this.killEnemy(e);
          }
          break;
        }
        walk(toward);
        this.face(e, toPlayer);
        if (dist < MINE_ARM_DIST) {
          ai.state = 'windup';
          ai.until = time + MINE_FUSE_MS;
          const ring = this.add.circle(e.x, e.y, MINE_RADIUS).setStrokeStyle(3, 0xff3d00, 0.8).setDepth(3);
          this.tweens.add({ targets: ring, alpha: 0.2, duration: MINE_FUSE_MS, onComplete: () => ring.destroy() });
        }
        break;
      }

      case 'shielded': {
        // Avanza hacia ti girando despacio: hay que rodearlo para darle por la espalda
        const target = Math.atan2(toPlayer.y, toPlayer.x);
        ai.facing = turnToward(ai.facing ?? target, target, SHIELD_TURN * (this.game.loop.delta / 1000));
        const f = new Phaser.Math.Vector2(Math.cos(ai.facing), Math.sin(ai.facing));
        if (dist > 70) walk(f);
        else e.setVelocity(0, 0);
        this.face(e, f);
        if (e.getData('shieldHp') === undefined) {
          const pool = shieldPoolFor((e.getData('maxHp') as number | undefined) ?? 10);
          e.setData('shieldHp', pool).setData('shieldMax', pool);
        }
        let g = e.getData('shieldGfx') as Phaser.GameObjects.Graphics | undefined;
        if (!g) {
          g = this.add.graphics().setDepth(5);
          e.setData('shieldGfx', g);
          e.once(Phaser.GameObjects.Events.DESTROY, () => g!.destroy());
        }
        const sLeft = (e.getData('shieldHp') as number) / Math.max(1, e.getData('shieldMax') as number);
        const size = (e.getData('size') as number | undefined) ?? 60;
        g.clear();
        if (sLeft > 0) {
          // Burbuja de escudo: se va apagando y se rompe en trozos cuanto menos le queda
          const pulse = lowFx() ? 0 : Math.sin(this.time.now / 220) * 0.08;
          g.lineStyle(5, 0x8ecbff, 0.35 + 0.5 * sLeft + pulse).strokeCircle(e.x, e.y, size * 0.62);
          g.lineStyle(2, 0xffffff, 0.35 * sLeft).strokeCircle(e.x, e.y, size * 0.62 + 4);
        }
        break;
      }

      case 'healer': {
        // Guarda las distancias y cada poco cura a los enemigos de alrededor (anillo verde)
        if (dist < 260) walk(toPlayer.clone().negate());
        else if (dist > 420) walk(toward);
        else walk(new Phaser.Math.Vector2(-toPlayer.y * ai.side, toPlayer.x * ai.side));
        this.face(e, toPlayer);
        if (time >= ai.until) {
          ai.until = time + HEAL_EVERY_MS;
          const ring = this.add.circle(e.x, e.y, 20).setStrokeStyle(4, 0x66bb6a, 0.9).setDepth(4);
          this.tweens.add({ targets: ring, radius: HEAL_RANGE, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
          for (const c of this.enemies.getChildren()) {
            const o = c as Sprite;
            if (o === e || !o.active || Phaser.Math.Distance.Between(e.x, e.y, o.x, o.y) > HEAL_RANGE) continue;
            const max = (o.getData('maxHp') as number | undefined) ?? 0;
            const hp = o.getData('hp') as number;
            if (!(max > 0) || hp >= max) continue;
            const add = Math.max(1, Math.round(max * HEAL_PART));
            o.setData('hp', Math.min(max, hp + add));
            this.popup(o.x, o.y - 40, `+${add}`, 0x66bb6a);
          }
        }
        break;
      }

      case 'swoop': {
        // Pasadas en picado: se lanza en curva pasando junto a ti y se aleja para coger carrerilla
        if (ai.state === 'dash') {
          // Curva: va girando un poco mientras pasa
          ai.dir.rotate(0.035 * ai.side);
          e.setVelocity(ai.dir.x * speed * 2.6, ai.dir.y * speed * 2.6);
          this.face(e, ai.dir);
          if (time >= ai.until) {
            ai.state = 'walk';
            ai.until = time + Phaser.Math.Between(900, 1400);
          }
        } else {
          if (dist < 260) walk(toPlayer.clone().negate().rotate(0.6 * ai.side));
          else walk(new Phaser.Math.Vector2(-toPlayer.y * ai.side, toPlayer.x * ai.side));
          this.face(e, toPlayer);
          if (time >= ai.until) {
            ai.state = 'dash';
            ai.until = time + 750;
            ai.dir.copy(toPlayer).rotate(-0.45 * ai.side);
            ai.side = Math.random() < 0.5 ? 1 : -1;
          }
        }
        break;
      }
    }
  }

  /** Sitio de la sala cerca del jugador (pero no encima) donde aparece quien salta. */
  private hopSpot(minDist: number) {
    const i = this.arena();
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

  // --- T72: Torre de 100 pisos (level/tower.ts) ---

  /** Al cargar un piso de la Torre: peligros del suelo, y en los pisos tranquilos (o ya limpios) la columna de luz. */
  private towerEnter() {
    const spec = this.towerSpec;
    if (!spec) return;
    this.drawHazards(spec);
    const room = this.floor.rooms[0];
    const i = this.interior(room);
    if (!this.cleared.has(0) && (spec.kind === 'rest' || spec.kind === 'supply')) {
      for (const rm of this.floor.rooms) this.cleared.add(rm.id);
      if (!this.resume) {
        if (spec.kind === 'rest') {
          // Descanso: el Centro Pokémon hace de fuente, altar de 3 objetos (coges uno), tienda con descuento y forja
          const pool = this.passivePool();
          const ids = towerAltarItems(mulberry32(this.floorSeed ^ 0x3c6ef372), new Set(this.passives), pool);
          ids.forEach((id, k) => {
            const it = passiveById(id);
            const at = this.towerAltarSpot(room, k);
            if (it) this.spawnPickup(room.id, at.x, at.y, { kind: 'passive', item: it });
          });
          this.notify(`Sala de descanso\nCúrate en el Centro, elige un objeto del altar\ny mira la tienda con descuento`, { kind: 'reward', icon: 'heart' });
        } else this.notify('Sala de suministros\nElige una poción, una llave o una baya', { kind: 'reward', icon: 'chest' });
      }
      this.saveNow();
    }
    const L = TOWER_REST_LAYOUT;
    if (spec.kind === 'rest') this.towerRestExtras(room);
    if (spec.kind === 'supply') this.towerSupply(room);
    // T73: el descanso siempre tiene forja (de un uso; al continuar sigue si no se había usado)
    if (spec.kind === 'rest' && !this.eventsDone.has(room.id)) this.placeForge(room, i.cx + L.forge.x, i.cy + L.forge.y);
    // Mega Piedra en la Torre: en descansos y suministros (una vez por sala; en los demás pisos no, para no romper su estructura)
    if ((spec.kind === 'rest' || spec.kind === 'supply') && !this.eventsDone.has(megaStoneDoneKey(room.id))) this.placeMegaAltar(room, i.cx + L.mega.x, i.cy + L.mega.y);
    if (this.cleared.has(0) && !isLastStage(this.mode, this.floorNum)) this.spawnTrapdoor();
    if (spec.rule && !this.cleared.has(0)) this.notify(ruleNotice(spec.rule), { kind: 'danger', icon: 'star' });
  }

  /** T72: has cogido un objeto del altar del descanso: los otros desaparecen. */
  private towerAltarTaken() {
    for (const o of [...this.pickups.getChildren()]) {
      const sp = o as Sprite;
      if (!sp.active || !sp.getData('towerAltar')) continue;
      (sp.getData('label') as Phaser.GameObjects.Text | undefined)?.destroy();
      (sp.getData('shadow') as Phaser.GameObjects.Ellipse | undefined)?.destroy();
      (sp.getData('halo') as Phaser.GameObjects.Arc | undefined)?.destroy();
      this.floorItems = this.floorItems.filter((f) => f !== sp.getData('entry'));
      this.tweens.killTweensOf(sp);
      sparkle(this, sp.x, sp.y);
      sp.destroy();
    }
    this.eventsDone.add(TOWER_ALTAR_DONE);
    // El rótulo y la base del altar se van (son los dos primeros de towerRestObjs)
    this.towerRestObjs.splice(0, 2).forEach((o) => o.destroy());
    // La tienda no vende lo que ya llevas: si vendía el que has cogido, cambia ese artículo
    this.towerShopDraw(this.floor.rooms[0]);
    this.saveNow();
  }

  /**
   * T72: sala de suministros: un puesto donde eliges poción, llave o baya (ItemChoiceScene: teclado, ratón y mando).
   * Lo elegido cae delante del puesto; la elección se apunta en eventsDone (también al continuar).
   */
  private towerSupply(room: Room) {
    if (this.eventsDone.has(TOWER_SUPPLY_DONE)) return;
    const i = this.interior(room);
    const x = i.cx + TOWER_REST_LAYOUT.supply.x;
    const y = i.cy + TOWER_REST_LAYOUT.supply.y;
    const objs: Phaser.GameObjects.GameObject[] = [];
    const box = this.add.rectangle(x, y, 120, 50, 0x3f7f5a, 0).setDepth(0.8);
    objs.push(buildSupplyStall(this, x, y, this.biome.colors.wall));
    const t = this.add.text(x, y - 70, 'Suministros: elige uno', { fontFamily: FONT, fontSize: '15px', color: '#d6ffd8', stroke: '#101828', strokeThickness: 4 }).setOrigin(0.5).setDepth(4);
    objs.push(box, t);
    this.towerRestObjs.push(...objs);
    const names = ['Poción', 'Llave', 'Baya Aranja'];
    const open = () => {
      if (this.ended || this.transitioning || this.eventsDone.has(TOWER_SUPPLY_DONE) || this.current?.id !== room.id || this.game.loop.time < this.itemChoiceCooldownUntil) return;
      this.openItemChoice('SUMINISTROS', 'Elige una cosa para seguir subiendo.', [...names], (k) => {
        if (k < 0 || this.eventsDone.has(TOWER_SUPPLY_DONE)) return;
        this.eventsDone.add(TOWER_SUPPLY_DONE);
        this.dropLoot(x, y + 60, SUPPLY_CHOICES[k]);
        this.eventSpots = this.eventSpots.filter((sp) => sp.use !== open);
        this.towerRestSpots = this.towerRestSpots.filter((sp) => sp.use !== open);
        objs.forEach((o) => o.destroy());
        this.notify(`Has elegido: ${names[k]}`, { kind: 'reward', icon: 'chest' });
        this.saveNow();
      }, 'Ahora no');
    };
    box.setInteractive({ useHandCursor: true });
    box.on('pointerover', () => (this.overHud = true));
    box.on('pointerout', () => (this.overHud = false));
    box.on('pointerdown', open);
    const spot = { x, y, prompt: () => 'Enter / A / clic: elegir poción, llave o baya', use: open };
    this.towerRestSpots.push(spot);
    this.eventSpots.push(spot);
  }

  /** T72: sitio de cada objeto del altar del descanso (abajo a la izquierda, debajo de la forja). */
  private towerAltarSpot(room: Room, k: number) {
    const i = this.interior(room);
    const a = TOWER_REST_LAYOUT.altar;
    return { x: i.cx + a.x + k * a.step, y: i.cy + a.y };
  }

  /**
   * T72: altar y tienda del descanso. Los objetos del altar se marcan para que, al coger uno, se vayan los otros
   * (también al continuar: se reconocen por su sitio). La tienda vende dos objetos rebajados y uno exclusivo; lo
   * comprado se apunta en eventsDone (ver towerShopDraw). Dibujo en towerArt.
   */
  private towerRestExtras(room: Room) {
    const i = this.interior(room);
    this.towerRestObjs.forEach((o) => o.destroy());
    this.towerRestObjs = [];
    this.towerRestSpots = [];
    if (!this.eventsDone.has(TOWER_ALTAR_DONE)) {
      const spots = Array.from({ length: TOWER_ALTAR_COUNT }, (_, k) => this.towerAltarSpot(room, k));
      for (const o of this.pickups.getChildren()) {
        const e = (o as Sprite).getData('entry') as FloorItemSave | undefined;
        if (e && e.roomId === room.id && spots.some((p) => p.x === e.x && p.y === e.y)) (o as Sprite).setData('towerAltar', true);
      }
      const a = TOWER_REST_LAYOUT.altar;
      const ax = i.cx + a.x + a.step;
      const base = buildTowerAltar(this, ax, i.cy + a.y + 22, a.step, this.biome.colors.wall);
      this.towerRestObjs.push(base);
      const t = this.add.text(ax, i.cy + a.y - 40, 'Altar: coge uno', { fontFamily: FONT, fontSize: '14px', color: '#e3d4ff', stroke: '#101828', strokeThickness: 4 }).setOrigin(0.5).setDepth(4);
      this.towerRestObjs.push(t);
    }
    this.towerShopKey = '';
    this.towerShopDraw(room);
  }

  /**
   * T72: tienda del descanso (towerShopOffer): nunca vende lo que ya llevas y es la misma al continuar (lo vendido va en
   * eventsDone como TOWER_SHOP_SOLD + n.º de candidato). Se rehace si cambia lo que enseña (p. ej. al coger del altar).
   */
  private towerShopDraw(room: Room) {
    if (this.towerSpec?.kind !== 'rest') return;
    const i = this.interior(room);
    const S = TOWER_REST_LAYOUT.shop;
    const sold = new Set([...this.eventsDone].filter((n) => n >= TOWER_SHOP_SOLD && n < TOWER_SHOP_SOLD + 1000).map((n) => n - TOWER_SHOP_SOLD));
    const stock = towerShopOffer(mulberry32(this.floorSeed ^ 0x1b873593), this.passivePool(), new Set(this.passives), sold);
    const key = stock.map((o) => o.k).join(',');
    if (key === this.towerShopKey && this.towerShopObjs.length > 0) return;
    this.towerShopKey = key;
    this.towerShopObjs.forEach((o) => o.destroy());
    this.towerShopObjs = [];
    const drop = new Set(this.towerRestSpots.filter((sp) => (sp as { shop?: boolean }).shop));
    this.towerRestSpots = this.towerRestSpots.filter((sp) => !drop.has(sp));
    this.eventSpots = this.eventSpots.filter((sp) => !drop.has(sp));
    const sx = i.cx + S.x + S.step;
    const stall = buildTowerStall(this, sx, i.cy + S.y + 30, S.step * 2 + 100);
    const title = this.add.text(sx, i.cy + S.y - 50, 'Tienda del descanso (-30 %)', { fontFamily: FONT, fontSize: '15px', color: '#ffe9a8', stroke: '#101828', strokeThickness: 4 }).setOrigin(0.5).setDepth(4);
    this.towerShopObjs.push(stall, title);
    stock.forEach((slot, n) => {
      if (slot.goods.kind !== 'passive') return;
      const item = passiveById(slot.goods.id);
      if (!item) return;
      const x = i.cx + S.x + n * S.step;
      const y = i.cy + S.y;
      const objs: Phaser.GameObjects.GameObject[] = [];
      const tex = itemIconKey(item.id);
      const img = this.add.image(x, y, this.textures.exists(tex) ? tex : iconKey('bag')).setScale(3).setDepth(3);
      const name = this.add.text(x, y + 40, `${item.name}${slot.exclusive ? '\nExclusivo' : ''}\n${slot.price} monedas`, { fontFamily: FONT, fontSize: '13px', color: slot.exclusive ? '#ffb02e' : '#ffd34d', stroke: '#101828', strokeThickness: 4, align: 'center' }).setOrigin(0.5, 0).setDepth(4);
      objs.push(img, name);
      this.towerShopObjs.push(...objs);
      const done = TOWER_SHOP_SOLD + slot.k;
      const buy = () => {
        if (this.ended || this.transitioning || this.eventsDone.has(done) || this.current?.id !== room.id) return;
        if (this.passives.includes(item.id)) return this.notify(`Ya llevas ${item.name}`, { kind: 'warning', icon: 'bag' });
        if (this.coins < slot.price) return this.notify(`Te faltan monedas (${this.coins}/${slot.price})`, { kind: 'warning', icon: 'coin' });
        if (!canTakePassive(item.id, this.passives, this.bossesBeaten)) return this.notify('Tienes los huecos de objeto llenos\nRecicla uno en la forja', { kind: 'warning', icon: 'bag' });
        this.coins -= slot.price;
        sfx('buy');
        this.eventsDone.add(done);
        this.gainItem({ kind: 'passive', item });
        this.eventSpots = this.eventSpots.filter((sp) => sp.use !== buy);
        this.towerRestSpots = this.towerRestSpots.filter((sp) => sp.use !== buy);
        objs.forEach((o) => o.destroy());
        this.notify(`Has comprado ${item.name}`, { kind: 'item', icon: 'shop' });
        this.refreshInventory();
        this.saveNow();
      };
      img.setInteractive({ useHandCursor: true });
      img.on('pointerover', () => (this.overHud = true));
      img.on('pointerout', () => (this.overHud = false));
      img.on('pointerdown', buy);
      const spot = { x, y, prompt: () => `Enter / A / clic: comprar ${item.name} por ${slot.price} (tienes ${this.coins})`, use: buy, shop: true };
      this.towerRestSpots.push(spot);
      this.eventSpots.push(spot);
    });
  }

  /** Sala de la Torre limpia: récord, premio del jefe y la columna de luz (o la victoria en el piso 100). */
  private towerCleared(room: Room) {
    const record = !this.codeRun && submitRecord(this.mode, this.floorNum, undefined, this.diff);
    if (record) this.counters.newRecord = true;
    if (room.kind === 'boss') this.bossBeaten();
    if (isLastStage(this.mode, this.floorNum)) {
      this.mission({ kind: 'win' });
      this.giveTickets(FINALE_BONUS);
      this.finish(true, `¡Has subido los 100 pisos de la Torre!\n+${this.earned} tickets en total\nPulsa R, Start o haz clic para ver el resumen`);
      return;
    }
    const i = this.interior(room);
    if (room.kind === 'boss') this.dropItem(room.id, i.cx + 170, i.cy);
    this.spawnTrapdoor();
    // Cartel de lo que viene: la regla especial del piso siguiente, para que se sepa antes de subir
    const next = upcomingRule(this.floorNum, this.towerSeed);
    const sign = next ? `\nArriba: ${ruleNotice(next)}` : '';
    const best = record ? '\n¡Nuevo récord!' : '';
    this.notify(`¡Piso ${this.floorNum} superado!${best}\nPisa la columna de luz para subir${sign}`, { kind: 'reward', icon: 'star' });
    this.saveNow();
  }

  /** Pisar la columna: animación del supervisor (towerFx) y, al acabar, el piso siguiente. */
  private towerClimb() {
    const t = this.trapdoor;
    if (!t || this.transitioning) return;
    this.trapdoor = undefined;
    this.transitioning = true;
    this.player.setVelocity(0, 0);
    this.physics.pause();
    let went = false;
    const go = () => {
      if (went) return;
      went = true;
      this.transitioning = false;
      this.descend();
    };
    towerAscend(this, t.x, t.y, this.floorNum + 1, { lift: this.player, low: lowFx(), onDone: go });
    // Por si el reloj del juego va lento, no quedarse a medias
    window.setTimeout(go, 3000);
  }

  /** Peligros del suelo: pinchos, lava y hielo animados (towerArt). */
  private drawHazards(spec: TowerFloorSpec) {
    const tiles = spec.hazards.map((h) => {
      const i = this.interior(this.floor.rooms[h.cell]);
      return { x: i.x0 + h.tx * TILE + TILE / 2, y: i.y0 + h.ty * TILE + TILE / 2 };
    });
    if (tiles.length > 0) buildHazards(this, spec.hazard, tiles, TILE);
  }

  /** T72: ¿estás pisando una casilla de hielo de la Torre? */
  private onTowerIce(): boolean {
    const spec = this.towerSpec;
    if (!spec || spec.hazard !== 'ice' || spec.hazards.length === 0 || !this.current) return false;
    const i = this.interior(this.current);
    const tx = Math.floor((this.player.x - i.x0) / TILE);
    const ty = Math.floor((this.player.y - i.y0) / TILE);
    return spec.hazards.some((h) => h.cell === this.current.id && h.tx === tx && h.ty === ty);
  }

  /**
   * Pinchos y lava hacen un poco de daño cada cierto tiempo mientras los pisas (nunca te dejan por debajo de 1 PS,
   * como el clima). El hielo no hace daño: resbala (onTowerIce, en el movimiento).
   */
  private hazardTick(time: number) {
    const spec = this.towerSpec;
    if (!spec || spec.hazard === 'ice' || spec.hazards.length === 0 || this.ended || this.transitioning || this.hp <= 1) return;
    if (time < this.hazardTickAt) return;
    const room = this.current;
    const i = this.interior(room);
    const tx = Math.floor((this.player.x - i.x0) / TILE);
    const ty = Math.floor((this.player.y - i.y0) / TILE);
    if (!spec.hazards.some((h) => h.cell === room.id && h.tx === tx && h.ty === ty)) return;
    this.hazardTickAt = time + 700;
    const chip = Math.min(Math.max(1, Math.round(this.stats.maxHp * (spec.hazard === 'lava' ? 0.06 : 0.04))), Math.ceil(this.hp) - 1);
    if (chip <= 0) return;
    this.hp -= chip;
    this.popup(this.player.x, this.player.y - 50, `-${chip} PS (${TOWER_HAZARD_LABEL[spec.hazard]})`, 0xff7a59);
  }

  // --- Trampilla al piso siguiente ---

  private spawnTrapdoor(final = false) {
    const i = this.interior(this.floor.rooms[this.floor.bossId]);
    if (this.mode === 'tower') {
      // T72: columna de luz en el centro (en reposo, towerArt; al pisarla, towerFx)
      // En el descanso (con Centro, forja, altar y tienda) va abajo en medio para no pisar nada (TOWER_REST_LAYOUT)
      const rest = this.towerSpec?.kind === 'rest';
      const cx = rest ? i.cx + TOWER_REST_LAYOUT.column.x : i.cx;
      const cy = rest ? i.cy + TOWER_REST_LAYOUT.column.y : i.cy;
      buildLightColumn(this, cx, cy + 25, this.biome.colors.wall, 110);
      this.add.text(cx, cy - 100, 'Subir', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#b8860b' }).setOrigin(0.5).setDepth(3);
      this.trapdoor = { x: cx, y: cy, armed: false };
      return;
    }
    const img = this.add.image(i.cx, i.cy, iconKey('trapdoor')).setScale(5).setDepth(1);
    if (final) {
      // Dorada y con brillo: la del reto final
      img.setTint(0xffd34d);
      const glow = this.add.circle(i.cx, i.cy, 46, 0xffd34d, 0.25).setDepth(0.9);
      this.tweens.add({ targets: glow, scale: 1.35, alpha: 0.05, duration: 900, yoyo: true, repeat: -1 });
    }
    this.add
      .text(i.cx, i.cy - 52, final ? 'Reto final' : 'Trampilla', { fontFamily: FONT, fontSize: '16px', fontStyle: final ? 'bold' : 'normal', color: final ? '#b8860b' : '#2b3a67' })
      .setOrigin(0.5)
      .setDepth(3);
    this.trapdoor = { x: i.cx, y: i.cy, armed: false, final };
  }

  /** Trampilla dorada: pregunta antes de entrar al reto final (o rendirse con la victoria, o todavía no). */
  private askFinal() {
    const t = this.trapdoor;
    if (!t || !this.scene.manager.keys['FinalPrompt'] || this.scene.isActive('FinalPrompt')) return;
    t.armed = false;
    this.player.setVelocity(0, 0);
    this.scene.launch('FinalPrompt', {
      onChoice: (c: FinalChoice) => {
        this.scene.stop('FinalPrompt');
        this.scene.resume();
        this.input.keyboard?.resetKeys();
        if (c === 'enter') this.descend();
        else if (c === 'surrender') {
          this.mission({ kind: 'win' });
          this.finish(true, `¡Has completado los ${FLOOR_COUNT} pisos!\n+${this.earned} tickets en total\nPulsa R, Start o haz clic para ver el resumen`);
        }
      },
    });
    this.scene.pause();
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
    if (dist < 36) {
      if (this.mode === 'tower') this.towerClimb();
      else if (t.final) this.askFinal();
      else this.descend();
    }
  }

  /** T80: antes de bajar (Normal e Infinito), se elige la ruta del piso siguiente en RouteScene. */
  private descend() {
    const next = this.floorNum + 1;
    if (!hasRoutes(this.mode, next, (n) => isFinalFloor(this.mode, n)) || !this.scene.manager.keys['Route'] || this.scene.isActive('Route')) return this.descendBy(null);
    // En el desafío diario las rutas salen de la semilla del día (las mismas para todos)
    const seed = this.seeded ? seedFloorSeed(this.seeded.seed, next) : this.floorSeed;
    const options = routeOptions(next, seed, this.mode);
    if (this.trapdoor) this.trapdoor.armed = false;
    this.player.setVelocity(0, 0);
    this.scene.launch('Route', {
      floor: next,
      options,
      onChoice: (o: RouteOption) => {
        this.scene.stop('Route');
        this.scene.resume();
        this.input.keyboard?.resetKeys();
        this.descendBy(o);
      },
    } satisfies RouteSceneData);
    this.scene.pause();
  }

  private descendBy(route: RouteOption | null) {
    const door = this.trapdoor;
    this.transitioning = true;
    this.trapdoor = undefined;
    this.player.setVelocity(0, 0);
    // T62: el piso que se deja se apunta ya (la escena se reinicia y el siguiente empieza a contar en startFloor)
    closeFloor(this.counters);
    // T88: si había pista en este piso y no la seguiste, se pierde el rastro
    const hadClue = clueOnFloor(this.hunt, this.floorNum);
    this.hunt = leaveFloor(this.hunt, this.floorNum);
    if (hadClue) this.notify(huntText(this.hunt), { kind: 'warning', icon: 'star' });
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
      hpSacrificed: this.hpSacrificed,
      eggLeft: this.eggLeft,
      // T65: el capturado solo ayuda en su piso; al bajar vuelve el ayudante del huevo si lo había
      allyId: nextFloorCapture(this.capture, this.allyId).allyId,
      tiredRooms: this.tiredRooms,
      potions: this.potions,
      gardenBerries: [...this.gardenBerries],
      legendHunt: { ...this.hunt, floors: [...this.hunt.floors], kinds: [...this.hunt.kinds] },
      itemLevels: pruneLevels(this.itemLevels, this.passives),
      teraPick: this.teraPick,
      secondChance: this.secondChanceUsed,
      bossesBeaten: this.bossesBeaten,
      powerMeter: this.powerMeter.value,
      zUsed: this.zUsed,
      reactionsFound: [...this.reactionsFound],
      storiesSeen: [...this.storiesSeen],
      route,
      routesTaken: [...this.routesTaken.map((x) => ({ ...x })), ...(route ? [{ ...route }] : [])],
    };
    // Caída por la trampilla: se coloca encima, gira encogiéndose hacia el agujero y la cámara se acerca
    const p = this.player;
    sfx('fall');
    this.falling = true;
    this.physics.pause();
    p.setAngle(0);
    (p.getData('shadow') as Phaser.GameObjects.Ellipse | undefined)?.setVisible(false);
    const cam = this.cameras.main;
    let went = false;
    const go = () => {
      if (went) return;
      went = true;
      cam.fadeOut(300, 0, 0, 0);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.restart({ slot: this.slot, starterId: this.starterId, mode: this.mode, carry, daily: this.daily, difficulty: this.diff, seeded: this.seeded } satisfies GameData);
      });
    };
    if (!door) return go();
    sfx('door');
    this.tweens.add({
      targets: p, x: door.x, y: door.y - 6, duration: 160, ease: 'Quad.easeOut',
      onComplete: () => {
        dustBurst(this, door.x, door.y + 10, 1.2, 10);
        const ring = this.add.circle(door.x, door.y, 30).setStrokeStyle(6, 0x101828, 0.8).setDepth(1.5);
        this.tweens.add({ targets: ring, radius: 4, alpha: 0, duration: 700, ease: 'Quad.easeIn', onComplete: () => ring.destroy() });
        cam.zoomTo(GAME_ZOOM * 1.18, 700, 'Sine.easeInOut', true);
        cam.pan(door.x, door.y, 700, 'Sine.easeInOut', true);
        this.tweens.add({
          targets: p, angle: 720, scaleX: p.scaleX * 0.08, scaleY: p.scaleY * 0.08, y: door.y + 8, alpha: 0.3,
          duration: 700, ease: 'Quad.easeIn', onComplete: go,
        });
      },
    });
    // Por si el reloj del juego va lento, no quedarse a medias
    window.setTimeout(() => go(), 2500);
  }

  // --- Bucle ---

  update(time: number, delta = 16) {
    // Esc (teclado) o Select/Back (mando) vuelven al menú en cualquier momento
    const menuPad = this.input.gamepad?.getPad(0);
    const menuPadNow = !!menuPad && menuPad.connected && (!!menuPad.buttons[8]?.pressed || (!this.ended && !!menuPad.buttons[9]?.pressed));
    if (!this.escKey) return; // create() aún no ha terminado de cargar
    // Red de seguridad: ningún enemigo puede quedar fuera de la sala (empujones, remolinos, embestidas…)
    // (al reiniciar la escena, el grupo viejo ya está destruido hasta que create() termina: sin `children`)
    if (!this.transitioning && !this.ended && this.current && this.host && this.enemies?.children && this.player?.active) {
      const rm = this.host.room();
      for (const c of this.enemies.getChildren()) {
        const e = c as Sprite;
        if (!e.active || !e.body) continue;
        if (e.x < rm.x0 - 30 || e.x > rm.x1 + 30 || e.y < rm.y0 - 30 || e.y > rm.y1 + 30) {
          (e.body as Body).reset(Phaser.Math.Clamp(e.x, rm.x0 + 30, rm.x1 - 30), Phaser.Math.Clamp(e.y, rm.y0 + 30, rm.y1 - 30));
        }
      }
    }
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
    this.dressSprites(time);
    this.orientShots();
    updateShots(this.host, this.shots, time, delta);
    updateShots(this.host, this.foeShots, time, delta);
    this.weatherFx?.update(delta, this.player);
    if (!this.ended) this.counters.seconds += delta / 1000;
    this.weatherTick(time);
    this.hazardTick(time);
    this.arenaTick(time);
    this.dayNightTick();
    // Curación por golpes: se recarga un 4 % de tus PS máximos por segundo (y no se acumula más)
    const healCap = this.stats.maxHp * 0.04;
    this.healBudget = Math.min(healCap, this.healBudget + healCap * (delta / 1000));
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
    // Joystick táctil izquierdo
    if (this.touch && this.touch.move.lengthSq() > 0) {
      mx = this.touch.move.x;
      my = this.touch.move.y;
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
    // T55: con la adrenalina activa vas más rápido
    // T77: mientras cargas el disparo vas un 40 % más lento
    const loopNow = this.game.loop.time;
    const chargeSlow = CHARGE_SOURCES.some((k) => isCharging(this.charges[k], loopNow)) ? CHARGE_MOVE_MUL : 1;
    const spd = this.stats.speed * wade * chargeSlow * adrenalineSpeedMul(this.adrenaline) * powerFormSpeedMul(this.powerForm);
    if (this.time.now >= this.playerKnockUntil) {
      // T78: en el hielo de la arena resbalas: la velocidad cambia poco a poco
      const [itx, ity] = this.tileOf(this.player.x, this.player.y, this.current);
      const pb = this.player.body as Body | null;
      if (pb && this.arenaIce.size > 0 && this.arenaIce.has(`${this.current.id}:${itx},${ity}`)) {
        const k = 1 - Math.pow(0.95, this.game.loop.delta / 16.7);
        this.player.setVelocity(pb.velocity.x + (dir.x * spd - pb.velocity.x) * k, pb.velocity.y + (dir.y * spd - pb.velocity.y) * k);
      } else if (this.onTowerIce()) {
        // T72: en el hielo de la Torre resbalas (tu velocidad se acerca poco a poco a la que pides)
        const b = this.player.body as Body;
        const v = iceVelocity(b.velocity, { x: dir.x * spd, y: dir.y * spd }, this.game.loop.delta);
        this.player.setVelocity(v.x, v.y);
      } else this.player.setVelocity(dir.x * spd, dir.y * spd);
    }
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
    if (shoot && time >= this.nextTear) {
      this.fireTear(shoot);
      this.nextTear = time + this.stats.fireDelay;
    }
    // T77: ataque cargado aparte: mantener su tecla / botón del ratón / LT carga; al soltar con la carga completa sale
    // (hacia donde miras). Cada fuente carga sola. El brillo crece con la carga de la que vaya más avanzada.
    const held = this.readChargeHeld(hasPad ? pad! : null);
    for (const k of CHARGE_SOURCES) {
      if (stepCharge(this.charges[k], held[k], loopNow) === 'cargado') this.fireTear((shoot ?? this.aim).clone().normalize(), true);
    }
    chargeGlow(this, this.player.x, this.player.y, Math.atan2(this.aim.y, this.aim.x), Math.max(...CHARGE_SOURCES.map((k) => chargeProgress(this.charges[k], loopNow))), typeColor(this.shotType()));
    if (shoot) {
      this.aim.copy(shoot);
      this.face(this.player, shoot);
    } else if (dir.length() > 0.2) {
      this.aim.copy(dir).normalize();
      this.face(this.player, dir);
    }

    // Centro Pokémon y tienda: Enter o A cerca del mostrador o de un artículo (A no lanza entonces el poder 1)
    // Bomba: E o RB (el clic va en el icono del HUD)
    const rbNow = hasPad && !!pad!.buttons[5]?.pressed;
    if (Phaser.Input.Keyboard.JustDown(this.bombKey) || (rbNow && !this.rbPrev) || this.touch?.consume('bomb')) this.placeBomb();
    // Poción (T49): su tecla, pulsar el stick izquierdo (L3) o el botón táctil (el clic va en el HUD)
    const l3Now = hasPad && !!pad!.buttons[10]?.pressed;
    if (Phaser.Input.Keyboard.JustDown(this.potionKey) || (l3Now && !this.l3Prev) || this.touch?.consume('potion')) this.drinkPotion();
    this.l3Prev = l3Now;
    // T65: Poké Ball con su tecla, pulsando el stick derecho (R3) o con clic en la del HUD
    const r3Now = hasPad && !!pad!.buttons[11]?.pressed;
    if (Phaser.Input.Keyboard.JustDown(this.ballKey) || (r3Now && !this.r3Prev)) this.throwBall();
    this.r3Prev = r3Now;
    // T74: megaevolución con su tecla, la cruceta arriba (botón 12, libre en partida) o clic en la Mega Piedra del HUD
    const dpadUpNow = hasPad && !!pad!.buttons[12]?.pressed;
    if (Phaser.Input.Keyboard.JustDown(this.megaInputKey) || (dpadUpNow && !this.dpadUpPrev)) this.powerButton();
    this.dpadUpPrev = dpadUpNow;
    this.rbPrev = rbNow;
    // Objeto activo: Espacio o LB (el clic va en su cuadro)
    const lbNow = hasPad && !!pad!.buttons[4]?.pressed;
    if (Phaser.Input.Keyboard.JustDown(this.activeKey) || (lbNow && !this.lbPrev) || this.touch?.consume('active')) this.useActive();
    this.lbPrev = lbNow;
    if (this.stats.homing > 0) this.steerShots(delta);
    this.stepLootAll(time, delta);
    this.updateDarkness();
    if (tickAdrenaline(this.adrenaline, delta, this.cleared.has(this.current.id))) this.adrenalineHud && (this.adrenalineHud.shown = '');
    this.updatePowerForm();
    const ltNow = hasPad && (pad!.buttons[6]?.value ?? 0) > 0.5;
    const rtNow = hasPad && (pad!.buttons[7]?.value ?? 0) > 0.5;
    if (this.tipObjects.length > 0) {
      if (Phaser.Input.Keyboard.JustDown(this.noTipsKey) || (ltNow && !this.triggerPrev[0])) this.closeTip(true);
      else if (Phaser.Input.Keyboard.JustDown(this.tipKey) || (rtNow && !this.triggerPrev[1])) this.closeTip();
    }
    // T53: parry con su tecla, RT o el botón táctil (el clic central y el del HUD van por eventos del puntero).
    // RT sigue cerrando el consejo si hay uno: las dos cosas a la vez no estorban y así no hay que elegir.
    if (Phaser.Input.Keyboard.JustDown(this.parryKey) || (rtNow && !this.triggerPrev[1]) || this.touch?.consume('parry')) this.doParry();
    this.triggerPrev = [ltNow, rtNow];
    const padA = hasPad && pad!.A && !this.padPrev[0];
    const usedA = this.updateInteract(Phaser.Input.Keyboard.JustDown(this.enterKey) || !!this.touch?.consume('use'), padA);

    // Poderes: teclas 1-4 o botones A, B, X, Y
    this.abilityKeys.forEach((k, i) => {
      if (Phaser.Input.Keyboard.JustDown(k) || this.touch?.consume(`power${i + 1}` as TouchButton)) this.castSlot(i, time);
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
      // T65: dentro de la Poké Ball no se mueve, no ataca y no le afectan los estados
      if (!e.active || e.getData('capturing') || this.tickEnemyStatus(e, time)) return;
      this.updateEnemy(e, time);
      // T51: la mina puede estallar (y desaparecer) en su propio turno
      if (!e.active) return;
      const eai = e.getData('ai') as EnemyAI | undefined;
      if (eai?.boss) this.updateBossAttacks(e, time);
      else if (eai?.eliteMove && time >= (eai.eliteAt ?? 0)) {
        // Minijefe: alterna sus movimientos (con nombre y algo más de aviso); élite: su ataque extra
        const mini = !!e.getData('miniboss');
        // T50: el minijefe a veces usa uno de los ataques extra del bioma (más corto: fase 1)
        if (mini && Math.random() < 0.35) {
          const extra = biomeExtraAttacks(this.biome.types)[Math.random() < 0.5 ? 0 : 1];
          const ms = this.bossExtra(e, eai, extra, 1);
          eai.eliteAt = time + 2600 + ms;
          this.paintEnemy(e, time);
          this.drawEnemyBar(e);
          return;
        }
        const mv = mini && eai.moves?.length ? eai.moves[Math.floor(Math.random() * eai.moves.length)] : eai.eliteMove;
        eai.eliteAt = time + (mini ? 2600 : Math.max(2200, 4400 - this.level() * 220));
        this.foeMove(e, mv, eai.type, Math.round((e.getData('dmg') as number) * (mini ? 0.7 : 0.6)), mini ? 650 : 450, mini);
        // T72: el minijefe de la Torre encadena un segundo movimiento (su ataque extra)
        if (mini && this.mode === 'tower' && eai.moves && eai.moves.length > 0) {
          const mv2 = eai.moves[Math.floor(Math.random() * eai.moves.length)];
          this.time.delayedCall(900, () => e.active && !this.ended && this.foeMove(e, mv2, eai.type, Math.round((e.getData('dmg') as number) * 0.6), 550, true));
          eai.eliteAt += 700;
        }
      }
      this.paintEnemy(e, time);
      this.drawEnemyBar(e);
    });

    this.updateRunaway(time);
    this.updateThief();
    this.updateTimeTrial(time);
    this.updateAlly(time, delta);

    // HUD
    if (this.fpsText && time - ((this.fpsText.getData('at') as number | undefined) ?? 0) > 500) {
      this.fpsText.setData('at', time).setText(`${Math.round(this.game.loop.actualFps)} FPS`);
    }
    const foes = this.enemies.countActive(true);
    {
      const nm = this.starterName.charAt(0).toUpperCase() + this.starterName.slice(1);
      // Nombre largo: más pequeño para no pisar la Poké Ball ni la Mega Piedra
      const maxW = this.powerButtonOffered() ? HL.name.maxWMega : HL.name.maxW;
      if (this.nameText.text !== nm || this.nameText.getData('maxW') !== maxW) {
        this.nameText.setFontSize(nameFontSize(nm, maxW)).setText(nm).setData('maxW', maxW);
        while (this.nameText.width > maxW && Number(this.nameText.style.fontSize.toString().replace('px', '')) > 12) {
          this.nameText.setFontSize(Number(this.nameText.style.fontSize.toString().replace('px', '')) - 1);
        }
      }
    }
    this.progressHud.setText(`${progressText(this.mode, this.floorNum)}${this.weather ? ` · ${WEATHER_LABEL[this.weather]}` : ''}${this.eggLeft > 0 ? ` · Huevo (${this.eggLeft})` : ''}${this.tiredRooms > 0 ? ' · Cansado' : ''}${foes ? ` · ${foes} enem.` : ''}`);
    this.hpText.setText(`${Math.max(0, Math.ceil(this.hp))}/${this.stats.maxHp}`);
    this.hpBar.set(this.hp / this.stats.maxHp);
    const bb = this.bossBar;
    if (bb) {
      // El trío comparte barra: la suma de los tres
      const list = bb.group ?? [bb.boss];
      const hp = list.reduce((a, e) => a + (e.active ? Math.max(0, e.getData('hp') as number) : 0), 0);
      const max = list.reduce((a, e) => a + ((e.getData('maxHp') as number | undefined) ?? 1), 0);
      bb.bar.set(hp / Math.max(1, max));
      if (bb.shield) {
        // Escudo del jefe Escudado: barra azul acero bajo la de vida
        const sh = list.reduce((a, e) => a + (e.active ? Math.max(0, (e.getData('shieldHp') as number | undefined) ?? 0) : 0), 0);
        const shMax = list.reduce((a, e) => a + ((e.getData('shieldMax') as number | undefined) ?? 0), 0);
        bb.shield.g.clear();
        if (sh > 0 && shMax > 0) {
          bb.shield.g.fillStyle(0x1d2848, 1).fillRoundedRect(bb.shield.x - 2, 40, bb.shield.w + 4, 8, 4);
          bb.shield.g.fillStyle(0x6e8196, 1).fillRoundedRect(bb.shield.x, 41, Math.max(6, bb.shield.w * (sh / shMax)), 6, 3);
          bb.shield.g.fillStyle(0xcfeaff, 1).fillRect(bb.shield.x + 3, 42, Math.max(0, bb.shield.w * (sh / shMax) - 6), 1);
        }
      }
    }
    this.paintActive();
    this.paintParry();
    this.paintAdrenaline();
    this.paintActionBadges();
    if (this.shieldRing) this.shieldRing.setPosition(this.player.x, this.player.y).setVisible(this.shieldLeft > 0);
    this.coinsHud.setText(String(this.coins));
    this.keysHud.setText(String(this.keys));
    this.bombsHud.setText(String(this.bombs));
    this.potionsHud?.setText(String(this.potions));
    this.paintBall(time);
    this.paintMega();
    this.paintPowerMeter();
    this.slots.forEach((m, i) => this.paintSlot(i, m, !m || time >= this.slotReady[i]));

    if (this.combo.count > 0 && !comboAlive(this.combo, time)) this.comboLose();
    this.comboHud?.update(this.combo, time);
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

  private newCharges(): Record<ChargeSource, ChargeState> {
    return { teclado: newCharge(), raton: newCharge(), mando: newCharge() };
  }

  /** T77: corta todas las cargas (pausa, cambio de sala, objeto activo); no vuelven a cargar hasta soltar el botón. */
  private cancelCharges() {
    for (const k of CHARGE_SOURCES) cancelCharge(this.charges[k]);
  }

  /** Dirección de disparo (como antes de T77): flechas, joystick táctil, clic izquierdo o stick derecho. null si no se dispara. */
  private readShootDir(pad: Phaser.Input.Gamepad.Gamepad | null): Phaser.Math.Vector2 | null {
    const { left, right, up, down } = this.arrows;
    const ax = (right.isDown ? 1 : 0) - (left.isDown ? 1 : 0);
    const ay = (down.isDown ? 1 : 0) - (up.isDown ? 1 : 0);
    if (ax !== 0 || ay !== 0) return new Phaser.Math.Vector2(ax, ay).normalize();
    // Joystick táctil derecho (en móvil el dedo en la sala no dispara: lo hace el joystick)
    if (this.touch) {
      const a = this.touch.aim;
      if (a.lengthSq() > 0.04) return a.clone().normalize();
    }

    const pointer = this.input.activePointer;
    // Solo el clic izquierdo dispara (el derecho es para moverse) y no sobre las ranuras de poder
    if (!this.touch && pointer.leftButtonDown() && !this.overHud && this.inGameView(pointer)) {
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

  /**
   * T77: qué entradas de carga están pulsadas. Teclado: su tecla (V). Ratón: botón lateral «atrás» o «adelante» (el derecho mueve y el
   * central es el parry). Mando: LT (en partida solo cierra consejos). Cada una carga por separado.
   */
  private readChargeHeld(pad: Phaser.Input.Gamepad.Gamepad | null): Record<ChargeSource, boolean> {
    const pointer = this.input.activePointer;
    return {
      teclado: this.chargeKey.isDown,
      raton: !this.touch && (pointer.backButtonDown() || pointer.forwardButtonDown()) && !this.overHud && this.inGameView(pointer),
      mando: !!pad && (pad.buttons[6]?.value ?? 0) > 0.5,
    };
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

  private spawnShot(dir: Phaser.Math.Vector2, angle: number, o: ShotOpts): Sprite {
    const v = dir.clone().rotate(angle).scale(o.speed);
    // Proyectil con la forma de su tipo (llama, gota, rayo, hoja…), orientado según vuela
    const ptype = o.type ?? o.status ?? 'normal';
    const from = o.from ?? this.player;
    const s = this.shots.create(from.x, from.y, projKey(ptype)) as Sprite;
    s.setScale(o.size * 2.2).setDepth(4).setVelocity(v.x, v.y);
    s.setData('ptype', ptype).setData('pcolor', o.color);
    if (projMode(ptype) === 'spin') s.setAngularVelocity(Phaser.Math.Between(420, 620) * (Math.random() < 0.5 ? -1 : 1));
    else s.setRotation(projRotation(ptype, Math.atan2(v.y, v.x)));
    // Acero: los poderes atraviesan un enemigo más
    const pierce = o.pierce + (o.status ? extraPierce(o.status) : 0);
    s.setData('dmg', o.damage).setData('pierce', pierce).setData('bounces', o.bounces);
    s.setData('hit', new Set<Sprite>());
    s.setData('status', o.status);
    // Poderes: estela de partículas de su tipo (el disparo normal no, para no saturar)
    if (o.status && !o.noTrail) {
      const type = o.status;
      const ev = this.time.addEvent({
        delay: 70,
        loop: true,
        callback: () => (s.active ? this.fxBudget.take(this.time.now) && typeTrail(this, s.x, s.y, type, Math.min(1.4, o.size)) : ev.remove()),
      });
    }
    if (o.bounces > 0) s.setBounce(1, 1);
    setMotion(s, 'player', Math.atan2(v.y, v.x), o.speed, o.motion, o.anim, this.player, this.time.now);
    if (o.explode) s.setData('explode', o.explode);
    this.time.delayedCall(o.life, () => {
      if (!s.active) return;
      this.popShot(s);
      s.destroy();
    });
    return s;
  }

  /** Si el proyectil estalla (Llamarada, Bola Sombra…), explosión y daño alrededor. */
  private popShot(s: Sprite) {
    const r = s.getData('explode') as number | undefined;
    if (!r || s.getData('popped')) return;
    s.setData('popped', true);
    const type = (s.getData('ptype') as string | undefined) ?? 'normal';
    typeImpact(this, s.x, s.y, type, 1.5, 14);
    const ring = this.add.circle(s.x, s.y, 10, typeColor(type), 0.45).setDepth(7);
    this.tweens.add({ targets: ring, radius: r, alpha: 0, duration: 240, onComplete: () => ring.destroy() });
    this.cameras.main.shake(80, 0.003);
    this.host.area('player', s.x, s.y, r, (s.getData('dmg') as number) * 0.6, type, this.player);
  }

  /** Crea el anfitrión del motor de ataques: cómo disparan, hacen daño y se mueven los de cada lado. */
  private makeHost(): AttackHost {
    return {
      scene: this,
      shoot: (side: Side, x: number, y: number, angle: number, o: ShootOpts) => {
        const dir = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
        if (side === 'player') {
          return this.spawnShot(dir, 0, {
            damage: o.dmg, speed: o.speed, life: o.life, size: o.size, color: typeColor(o.type), pierce: (o.pierce ?? 0) + this.stats.pierce,
            bounces: 0, status: o.type, type: o.type, motion: o.motion, anim: o.anim, explode: o.explode, from: { x, y }, noTrail: o.life < 700,
          });
        }
        const s = this.foeShots.create(x, y, projKey(o.type)) as Sprite;
        s.setScale(o.size * 2.4).setDepth(4).setVelocity(dir.x * o.speed, dir.y * o.speed);
        s.setData('dmg', Math.max(1, Math.round(o.dmg))).setData('ptype', o.type).setData('foe', true);
        if (projMode(o.type) !== 'spin') s.setRotation(projRotation(o.type, angle));
        if (o.explode) s.setData('explode', o.explode);
        // Borde oscuro: que no se confunda con los tuyos
        s.setTint(0xffffff);
        this.time.delayedCall(o.life, () => s.active && s.destroy());
        return s;
      },
      area: (side, x, y, r, dmg, type, src, once) => {
        if (side === 'foe') {
          const p = this.player;
          if (!p?.active || once?.has(p)) return;
          if (Phaser.Math.Distance.Between(x, y, p.x, p.y) > r + 22) return;
          once?.add(p);
          if (src.active) this.hurtPlayer(src);
          return;
        }
        for (const c of [...this.enemies.getChildren()]) {
          const e = c as Sprite;
          if (!e.active || once?.has(e)) continue;
          const er = ((e.getData('size') as number | undefined) ?? 60) * 0.35;
          if (Phaser.Math.Distance.Between(x, y, e.x, e.y) > r + er) continue;
          once?.add(e);
          this.hitEnemy(e, dmg, type, e.x, e.y, typeColor(type), new Phaser.Math.Vector2(e.x - x, e.y - y));
        }
      },
      hitOne: (e, dmg, type) => e.active && this.hitEnemy(e, dmg, type, e.x, e.y, typeColor(type)),
      enemies: () => this.enemies.getChildren() as Sprite[],
      player: () => this.player,
      aim: () => this.aim.clone().normalize(),
      room: () => this.arena(),
      dash: (dir, speed, ms) => {
        this.player.setVelocity(dir.x * speed, dir.y * speed);
        this.playerKnockUntil = this.time.now + ms;
        this.invulnUntil = Math.max(this.invulnUntil, this.time.now + ms + 120);
      },
      alive: () => !this.ended && !this.transitioning && !!this.player?.active,
    };
  }

  /** Disparo básico. Los pasivos cambian cuántos salen, cuánto daño hacen y hasta dónde llegan. */
  private fireTear(dir: Phaser.Math.Vector2, charged = false) {
    sfx(shotSfx(this.shotType()));
    this.lastShotAt = this.time.now;
    const s = this.stats;
    const n = 1 + s.extraShots;
    const opts = {
      damage: s.damage * this.dmgMul() * pinchMul(this.ability, this.shotType(), this.hp, s.maxHp),
      speed: s.shotSpeed,
      // Pokéradar: más alcance cuantos más enemigos queden
      life: s.range * (1 + s.rangePerEnemy * this.enemies.countActive(true)),
      size: 0.7 * s.shotScale,
      color: typeColor(this.shotType()),
      type: this.shotType(),
      pierce: s.pierce,
      bounces: s.bounces,
    };
    // Cómo vuela según tu tipo: el eléctrico en zigzag, el agua ondulando, el psíquico persiguiendo un poco…
    const basic = basicShotFor(this.shotType());
    Object.assign(opts, { speed: opts.speed * basic.speed, size: opts.size * basic.size, motion: basic.motion, anim: basic.anim });
    // T77: disparo cargado: doble de daño, más grande, atraviesa y cambia según el tipo (fuego rastro, agua empuja, eléctrico salta)
    const shape = charged ? chargedShapeFor(this.shotType()) : null;
    if (shape) Object.assign(opts, { damage: opts.damage * CHARGE_DAMAGE_MUL, size: opts.size * shape.sizeMul, pierce: opts.pierce + shape.pierce, bounces: opts.bounces + shape.bounces });
    if (shape) {
      const shot = this.spawnShot(dir, 0, opts);
      shot.setData('pushMul', shape.pushMul).setData('charged', true);
      chargedShotFx(this, shot, opts.color, shape.trail);
      return;
    }
    if (this.fxBudget.take(this.time.now)) muzzle(this, this.player.x, this.player.y, dir.x, dir.y, opts.color);
    for (let k = 0; k < n; k++) this.spawnShot(dir, (k - (n - 1) / 2) * SPREAD, opts);
    // Cola Gemela: también hacia atrás
    for (let k = 0; k < s.backShots; k++) this.spawnShot(dir.clone().negate(), (k - (s.backShots - 1) / 2) * SPREAD, opts);
  }

  /** Poder activo: el movimiento de la ranura sale hacia donde miras. */
  private castSlot(i: number, time: number) {
    const m = this.slots[i];
    if (!m || time < this.slotReady[i]) return;
    // Cada movimiento sale con su estilo (catálogo de ataques): chorro, rayo, onda, lluvia, bumerán…
    const style = styleForMove(m);
    this.slotReady[i] = time + m.cooldown * style.cd;
    sfx(shotSfx(m.type));
    this.lastShotAt = time;

    const dir = this.aim.clone().normalize();
    if (this.fxBudget.take(this.time.now)) muzzle(this, this.player.x, this.player.y, dir.x, dir.y, typeColor(m.type));
    // At. Esp. del Pokémon y, encima, lo que suban el daño los objetos
    // Potenciadores de tipo (Carbón, Imán…) y Ataque X van encima
    const boost = 1 + (this.stats.typeBoost[m.type] ?? 0);
    const dmg = Math.max(6, Math.round(m.power * 0.5 * this.stats.powerMul * (this.stats.damage / this.base.damage) * boost * this.dmgMul() * pinchMul(this.ability, m.type, this.hp, this.stats.maxHp)));
    castPattern(this.host, 'player', this.player, dir, style.pattern, Math.max(3, Math.round(dmg * style.mul)), m.type);
  }

  private onShotWall(shot: Sprite) {
    if (!shot.active) return;
    const bounces = shot.getData('bounces') as number;
    if (bounces > 0) shot.setData('bounces', bounces - 1);
    else {
      if (this.fxBudget.take(this.time.now)) wallPop(this, shot.x, shot.y, (shot.getData('pcolor') as number | undefined) ?? 0xffffff);
      shot.destroy();
    }
  }

  private onHit(shot: Sprite, enemy: Sprite) {
    if (!shot.active || !enemy.active) return;
    const hit = shot.getData('hit') as Set<Sprite>;
    if (hit.has(enemy)) return;
    hit.add(enemy);

    const status = shot.getData('status') as string | undefined;
    const sv = (shot.body as Body | null)?.velocity;
    // T77: el cargado de agua (y otros) empuja más
    const pushMul = (shot.getData('pushMul') as number | undefined) ?? 1;
    const hp = this.hitEnemy(enemy, shot.getData('dmg') as number, status, shot.x, shot.y, (shot.getData('pcolor') as number | undefined) ?? 0xffffff, sv?.clone().scale(pushMul));
    if (hp === undefined) return;

    const pierce = shot.getData('pierce') as number;
    if (pierce > 0) shot.setData('pierce', pierce - 1);
    else {
      this.popShot(shot);
      shot.destroy();
    }
  }

  /**
   * Golpe a un enemigo (disparos, poderes de área, rayos, cadenas…): críticos, robo de vida, número de daño,
   * destello, empujón (no a jefes), estado del tipo y, si cae, se debilita. Devuelve los PS que le quedan.
   */
  private hitEnemy(enemy: Sprite, base: number, status: string | undefined, sx: number, sy: number, color: number, push?: Phaser.Math.Vector2): number | undefined {
    if (!enemy.active) return undefined;
    // Dragón: los poderes hacen más daño; Lluvia y Sol cambian Agua y Fuego (T38)
    let dmg = base * (status ? hitDamageMul(status) : 1) * weatherPowerMul(this.weather, status);
    const shAi = enemy.getData('ai') as EnemyAI | undefined;
    // Eficacia de tipos (como en Pokémon): súper eficaz, no muy eficaz o casi sin efecto
    const defTypes = this.foeTypesOf(enemy);
    dmg *= damageMul(status, defTypes);
    // T56: sala de un solo tipo: los demás tipos pegan la mitad
    const rule = this.activeRule();
    if (rule === 'oneType') dmg *= ruleDamageMul(rule, status, oneTypeFor(this.playerTypes, this.current.id));
    this.effectivenessPopup(effectOf(status, defTypes), enemy.x, enemy.y - (enemy.getData('size') as number) * 0.75);
    let crit = false;
    // T53: el primer golpe que impacta tras un parry es crítico seguro (se gasta aquí, uno por parry)
    if (takeCounterCrit(this.parry, this.time.now)) {
      dmg *= this.stats.critMul;
      crit = true;
    } else if (this.stats.critChance > 0 && Math.random() < this.stats.critChance) {
      dmg *= this.stats.critMul;
      crit = true;
    }
    // Concha Campana: parte del daño vuelve como PS
    if (this.stats.lifesteal > 0) {
      this.lifestealAcc += dmg * this.stats.lifesteal;
      // Con tope por segundo (si no, los ataques de muchos golpes curaban demasiado)
      const heal = Math.min(Math.floor(this.lifestealAcc), Math.floor(this.healBudget));
      if (heal > 0) {
        this.lifestealAcc -= heal;
        this.healBudget -= heal;
        this.hp = Math.min(this.stats.maxHp, this.hp + heal);
      }
      this.lifestealAcc = Math.min(this.lifestealAcc, 5);
    }
    // El Escudado tiene una reserva de escudo (barra azul sobre su vida) que se come el daño de cualquier dirección
    const shieldLeft = enemy.getData('shieldHp') as number | undefined;
    if (shAi?.behavior === 'shielded' && shieldLeft !== undefined && shieldLeft > 0) {
      const r = absorbShieldHit(shieldLeft, dmg);
      enemy.setData('shieldHp', r.left);
      dmg = r.through;
      if (r.left <= 0) {
        this.popup(enemy.x, enemy.y - 44, '¡Escudo roto!', 0xcfd8dc);
        pixRing(this, enemy.x, enemy.y, 60, 0xcfd8dc, 320);
        sfx('boom');
      } else if (this.fxBudget.take(this.time.now)) this.popup(enemy.x, enemy.y - 44, '¡Escudo!', 0x8ecbff);
    }
    this.countDamage(enemy, dmg);
    let hp = (enemy.getData('hp') as number) - dmg;
    sfx('hit');
    if (status && this.fxBudget.take(this.time.now)) typeImpact(this, enemy.x, enemy.y, status, 0.8, 7);
    // Golpe: destello blanco, chispas, número de daño y un empujoncito (no a los jefes)
    enemy.setData('hp', hp);
    enemy.setTintFill(0xffffff);
    enemy.setData('flashUntil', this.time.now + 70);
    if (crit || this.fxBudget.take(this.time.now)) hitSpark(this, sx, sy, color, crit ? 9 : 5, crit ? 1.3 : 0.9);
    if (dmg > 0) damageNumber(this, enemy.x, enemy.y - (enemy.getData('size') as number) * 0.45, dmg, { crit });
    if (crit) this.cameras.main.shake(90, 0.004);
    const hitAi = enemy.getData('ai') as EnemyAI | undefined;
    if (hp > 0 && hitAi && !hitAi.boss && push && push.lengthSq() > 0 && this.time.now >= hitAi.knockUntil) {
      const pv = push.normalize().scale(crit ? 220 : 130);
      enemy.setVelocity(pv.x, pv.y);
      hitAi.knockUntil = this.time.now + 90;
    }
    if (status && hp > 0) {
      this.tryReaction(enemy, status, dmg);
      hp = enemy.getData('hp') as number;
    }
    // Drenar cura aunque el golpe lo derrote; el resto solo afecta a quien sigue en pie
    if (status && (hp > 0 || statusForType(status)?.kind === 'drain')) this.applyStatusTo(enemy, status, dmg);
    if (hp <= 0) this.killEnemy(enemy);
    return hp;
  }

  /** Tipos de un enemigo (los jefes llevan los suyos en `btypes`). */
  private foeTypesOf(e: Sprite): string[] {
    const ai = e.getData('ai') as EnemyAI | undefined;
    const own = (ai?.boss ? (e.getData('btypes') as string[] | undefined) ?? this.bossTypes : (e.getData('types') as string[] | undefined)) ?? [];
    return own.length > 0 ? own : [ai?.type ?? 'normal'];
  }

  private effectAt = 0;
  /** Aviso de eficacia, como mucho uno cada medio segundo para no llenar la pantalla. */
  private effectivenessPopup(effect: ReturnType<typeof effectOf>, x: number, y: number) {
    if (effect === 'normal' || this.time.now < this.effectAt) return;
    this.effectAt = this.time.now + 500;
    this.popup(x, y, EFFECT_LABEL[effect], EFFECT_COLOR[effect]);
  }

  /** Suma al daño hecho de la partida (sin contar lo que sobra al rematar). */
  private countDamage(e: Sprite, dmg: number) {
    const done = Math.max(0, Math.min(dmg, e.getData('hp') as number));
    this.counters.damage += done;
    if (done > 0) touchAdrenaline(this.adrenaline);
    // T75: el daño que haces llena el medidor de poder
    meterOnDamage(this.powerMeter, done);
  }

  /** Combo de bajas: suma, avisa en los hitos y da un pequeño premio. */
  private comboKill(enemy: Sprite) {
    if (enemy.getData('helper')) return;
    const milestone = comboHit(this.combo, this.time.now);
    if (this.combo.count >= 3) sfx('crit');
    if (milestone === null) return;
    const r = milestoneReward(milestone);
    this.hp = Math.min(this.stats.maxHp, this.hp + r.heal);
    this.popup(this.player.x, this.player.y - 70, `¡Combo x${milestone}! +${r.heal} PS`, 0xffd34d);
    this.cameras.main.shake(120, 0.004);
    sfx('levelup');
    if (this.floor.shopId !== undefined) for (let k = 0; k < r.coins; k++) this.dropLoot(enemy.x + (k - r.coins / 2) * 16, enemy.y, { kind: 'coin', value: 1 });
  }

  /** T84: derrotar o capturar suma a la cadena shiny si es la misma especie (los ayudantes del jefe no cuentan). */
  private chainShiny(enemy: Sprite) {
    if (this.daily || enemy.getData('helper')) return;
    this.shinyChain = chainHit(this.shinyChain, (enemy.getData('speciesId') as number | undefined) ?? 0);
    this.paintShinyChain();
  }

  private paintShinyChain() {
    const show = chainVisible(this.shinyChain);
    this.shinyChainHud?.setVisible(show).setText(show ? `Cadena shiny x${this.shinyChain.count}` : '');
    if (this.shinyChainHud) shinyChainBadge(this, this.shinyChainHud, show ? this.shinyChain.count : 0);
  }

  /** Se rompe el combo (te han hecho daño). */
  private comboLose() {
    const was = comboBreak(this.combo);
    this.comboHud?.broke(was);
  }

  /**
   * T63: anota la especie derrotada en el registro de combate (se guarda al momento) y da los caramelos de los hitos
   * que cruza. Los avisos van arriba, nunca en el centro. Si aún no ha cargado la lista de especies, no cuenta.
   */
  private registerDex(enemy: Sprite) {
    const id = enemy.getData('speciesId') as number | undefined;
    // T81: las partidas con código no cuentan para el registro de combate
    if (!id || !this.dexIndex || this.codeRun) return;
    const gain = registerDefeat(this.dexIndex, this.dexDefeated, id);
    if (!gain.isNew) return;
    saveDefeated([...this.dexDefeated]);
    this.popup(enemy.x, enemy.y - 56, 'Registrado', 0x9ad7ff);
    const candies = gain.rewards.reduce((n, r) => n + r.candies, 0);
    if (candies <= 0) return;
    addCandies(candies);
    const best = gain.rewards[gain.rewards.length - 1];
    this.notify(`Registro: ${typeNameEs(best.type)} al ${best.percent} %\n+${candies} caramelos`, { kind: 'reward', icon: 'star' });
  }

  private killEnemy(enemy: Sprite) {
    if (enemy.getData('legendHunt')) {
      // T88: debilitado sin capturar: la cacería termina
      this.hunt = finishLair(this.hunt);
      this.notify(`${this.legendName()} se ha debilitado y huye\nLa próxima vez, lánzale la Poké Ball`, { kind: 'warning', icon: 'star' });
    }
    const boss = !!(enemy.getData('ai') as EnemyAI | undefined)?.boss;
    this.counters.kills++;
    this.registerDex(enemy);
    // T55: las bajas cargan la adrenalina (los ayudantes que invoca un jefe también cuentan: son enemigos de verdad)
    this.addAdrenaline('kill');
    this.comboKill(enemy);
    this.chainShiny(enemy);
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
    // Trío: la barra sigue mientras quede alguno; los que quedan se enfurecen
    const others = boss ? (this.bossBar?.group ?? []).filter((o) => o !== enemy && o.active) : [];
    if (this.bossBar && (this.bossBar.boss === enemy || this.bossBar.group?.includes(enemy))) {
      if (others.length > 0) {
        this.bossBar.boss = others[0];
        for (const o of others) {
          const oai = o.getData('ai') as EnemyAI;
          oai.phase = 2;
          o.setData('speed', (o.getData('speed') as number) * 1.2);
          oai.nextAttack = this.time.now + 900;
        }
        this.cameras.main.shake(300, 0.008);
        this.notify(`¡Cae ${(enemy.getData('bname') as string | undefined) ?? ''}! Los demás se enfurecen`, { kind: 'danger', icon: 'star' });
      } else {
        this.bossBar.objects.forEach((o) => o.destroy());
        this.bossBar = undefined;
      }
    }
    // Se debilita con animación (una copia dibujada; el sprite real se va ya)
    const eb = enemy.body as Body | null;
    const feetY = eb ? eb.bottom : enemy.y + enemy.displayHeight * 0.35;
    const etypes = boss ? ((enemy.getData('btypes') as string[] | undefined) ?? this.bossTypes) : ((enemy.getData('types') as string[] | undefined) ?? ['normal']);
    const ecolor = typeColor(etypes[0] ?? 'normal');
    const mini = !!enemy.getData('miniboss');
    if (boss || mini) faintBoss(this, enemy, feetY, ecolor, (x, y) => typeImpact(this, x, y, etypes[0] ?? this.bossType, 1.4, 12));
    else faintEnemy(this, enemy, feetY, ecolor);
    if (enemy.getData('runaway') || enemy.getData('mimic')) this.eventFoeDefeated(enemy);
    if (enemy.getData('thief')) this.thiefDefeated();
    if (mini) {
      // Premio del minijefe: un objeto y tickets
      const bonus = this.giveTickets(minibossTicketsFor(this.floorNum));
      const ex = enemy.x;
      const ey = enemy.y;
      const roomId = this.current.id;
      this.time.delayedCall(900, () => !this.ended && this.dropItem(roomId, ex, ey));
      // T72: en la Torre además suelta un objeto épico
      const epic = this.mode === 'tower' ? passiveById(towerMinibossItem(this.rng(RNG.items), new Set(this.passives), this.passivePool())) : undefined;
      if (epic) this.time.delayedCall(1100, () => { if (!this.ended) { const p = this.freeSpot(ex + 90, ey); this.spawnPickup(roomId, p.x, p.y, { kind: 'passive', item: epic }, this.current?.id === roomId); } });
      this.notify(`¡Minijefe derrotado! +${bonus} tickets\n${epic ? 'Han caído un objeto y uno épico' : 'Ha caído un objeto'}`, { kind: 'reward', icon: 'star' });
    }
    // T56: sala de la plaga. Antes de destruirlo, para que el pequeño cuente al mirar si la sala está limpia
    if (shouldMultiply(this.activeRule(), boss || mini || !!enemy.getData('helper') || !!enemy.getData('runaway') || !!enemy.getData('mimic'), Math.random)) this.spawnSmallCopy(enemy);
    enemy.destroy();
    if (boss && others.length === 0) {
      playTrack(trackForBiome(this.biome.id));
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
    const sh = (e.getData('shieldHp') as number | undefined) ?? 0;
    if (hp >= max && sh <= 0) {
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
    if (sh > 0) {
      // Escudo: barra azul acero encima de la vida
      const sr = Math.min(1, sh / Math.max(1, (e.getData('shieldMax') as number | undefined) ?? sh));
      g.fillStyle(0x1d2848, 1).fillRoundedRect(x - 2, y - 8, w + 4, 6, 2);
      g.fillStyle(0x6e8196, 1).fillRect(x, y - 6, w * sr, 3);
      g.fillStyle(0xcfeaff, 1).fillRect(x, y - 6, w * sr, 1);
    }
  }

  private buildBossBar(boss: Sprite, label = this.bossName, type = this.bossType, group?: Sprite[]) {
    this.bossBar?.objects.forEach((o) => o.destroy());
    // En la franja de arriba, encima de la sala (no la tapa)
    const bx = CX - 440;
    const box = drawHudFrame(this.add.graphics(), bx, 4, 880, 52);
    const name = this.add.text(bx + 22, 30, label, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#f8f8f8' }).setOrigin(0, 0.5);
    const chip = addTypeChip(this, bx + 20 + name.width + 56, 30, typeNameEs(type), typeColor(type), 92, 24);
    const barX = bx + 20 + name.width + 116;
    const bar = addHpBar(this, barX, 23, bx + 860 - barX, 14);
    const shG = this.add.graphics();
    const objects = [box, name, ...chip, ...bar.objects, shG];
    for (const o of objects) {
      this.hudLayer.add(o);
      if (this.hudCam) o.cameraFilter &= ~this.hudCam.id;
    }
    this.bossBar = { boss, bar, objects, group, shield: { g: shG, x: barX + 36, w: bx + 860 - barX - 36 } };
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

  /**
   * Suelta botín dentro de la sala actual. T54: sale despedido desde (x, y) con un salto hacia un sitio libre de
   * rocas y agujeros cercano (data/lootMotion.ts), así nunca acaba donde no se puede coger ni fuera de la sala.
   */
  private dropLoot(x: number, y: number, drop: LootDrop) {
    const b = this.lootBounds(this.current.id);
    const from = clampToBounds(x, y, b);
    const t = scatterTarget(from.x, from.y, Math.random, b);
    const p = this.freeSpot(t.x, t.y);
    this.spawnLoot(this.current.id, p.x, p.y, drop, from);
  }

  /** Límites del botín en una sala (con las salas grandes, todas sus casillas), con margen para que no toque la pared. */
  private lootBounds(roomId: number): LootBounds {
    const cells = this.groupIds(this.floor.rooms[roomId]).map((id) => this.interior(this.floor.rooms[id]));
    const m = 30;
    return {
      x0: Math.min(...cells.map((c) => c.x0)) + m,
      y0: Math.min(...cells.map((c) => c.y0)) + m,
      x1: Math.max(...cells.map((c) => c.x1)) - m,
      y1: Math.max(...cells.map((c) => c.y1)) - m,
    };
  }

  /** `from`: de dónde sale despedido (si no se da, ya estaba en el suelo: al volver a la sala o al continuar). */
  private spawnLoot(roomId: number, x: number, y: number, drop: LootDrop, from?: { x: number; y: number }) {
    const bounds = this.lootBounds(roomId);
    const motion = from ? launchLoot(from.x, from.y, x, y, Math.random, bounds) : restingLoot(x, y, bounds);
    // Lo guardado es donde acabará quieto (si sales de la sala en pleno salto, al volver ya está en su sitio)
    const entry: FloorItemSave = { roomId, x: motion.tx, y: motion.ty, drop };
    this.floorItems.push(entry);
    const icon = drop.kind === 'berry' ? iconKey(drop.id) : iconKey(drop.kind);
    const s = this.loot.create(motion.x, motion.y, icon) as Sprite;
    // Iconos de 16 px: la moneda de 5 algo más grande
    s.setScale(drop.kind === 'coin' && drop.value > 1 ? 2.6 : 2);
    // El balanceo de siempre lo pone stepLootAll (antes era un tween, pero chocaba con el salto); fase al azar para
    // que un montón de monedas no suba y baje a la vez
    s.setDepth(2).setData('drop', drop).setData('entry', entry).setData('motion', motion).setData('bob', Math.random() * 1200);
  }

  /** T54: mueve el botín (salto, botes y atracción hacia el jugador) y le pone el balanceo cuando está quieto. */
  private stepLootAll(time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    const radius = magnetRadius(this.stats.lootMagnet);
    const canHealNow = canHeal(this.hp, this.stats.maxHp);
    const canPotion = canCarryPotion(this.potions);
    for (const c of this.loot.getChildren()) {
      const s = c as Sprite;
      const m = s.getData('motion') as LootBody | undefined;
      if (!s.active || !m) continue;
      const drop = s.getData('drop') as LootDrop;
      // Con la vida llena la baya no vuela hacia ti, ni la poción si ya llevas todas (se quedarían pegadas debajo)
      const wanted = drop.kind === 'berry' ? canHealNow : drop.kind === 'potion' ? canPotion : true;
      const pulled = !this.ended && stepLoot(m, dt, { x: this.player.x, y: this.player.y, radius, wanted });
      const bob = m.resting && !pulled ? 5 * (0.5 - 0.5 * Math.cos(((time + (s.getData('bob') as number)) / 600) * Math.PI)) : 0;
      s.setPosition(m.x, m.y - m.z - bob);
      if (pulled) {
        const e = s.getData('entry') as FloorItemSave;
        e.x = m.x;
        e.y = m.y;
      }
    }
  }

  private pickLoot(sprite: Sprite) {
    if (!sprite.active) return;
    const drop = sprite.getData('drop') as LootDrop;
    if (drop.kind === 'berry') {
      // Con los PS al máximo la baya se queda en el suelo
      if (!canHeal(this.hp, this.stats.maxHp)) return;
      const b = BERRIES[drop.id];
      const amount = scaleHeal(b.heal, this.diff);
      this.hp = healed(this.hp, this.stats.maxHp, amount);
      sfx('heal');
      this.popup(this.player.x, this.player.y - 50, `${b.name} +${amount} PS`, b.color);
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
    } else if (drop.kind === 'potion') {
      // Como mucho MAX_POTIONS: si no caben, se queda en el suelo
      if (!canCarryPotion(this.potions)) return;
      this.potions++;
      sfx('coin');
      this.popup(sprite.x, sprite.y - 16, '+1 poción', 0xc39bd3);
    } else {
      this.bombs++;
      sfx('coin');
      this.popup(sprite.x, sprite.y - 16, '+1 bomba', 0xc8c8d8);
    }
    // Vuela a su contador (o a la barra de PS si es una baya)
    {
      const LX = HUD.left.x + HUD.pad;
      const LW = HUD.left.w - HUD.pad * 2;
      const target: [number, number, Phaser.GameObjects.Text | undefined] =
        drop.kind === 'coin' ? [LX + HUD_COUNT_X.coin, HL.counterIconY, this.coinsHud] : drop.kind === 'key' ? [LX + HUD_COUNT_X.key, HL.counterIconY, this.keysHud]
          : drop.kind === 'bomb' ? [LX + HUD_COUNT_X.bomb, HL.counterIconY, this.bombsHud]
          : drop.kind === 'potion' ? [LX + HUD_COUNT_X.potion, HL.counterIconY, this.potionsHud] : [LX + LW / 2, HL.hpBar.y + 6, this.hpText];
      // Adorno: con efectos bajos (o si ya hay muchas partículas) no sale
      if (this.fxBudget.take(this.time.now)) lootFlash(this, sprite.x, sprite.y, (sprite.tintTopLeft || 0xffe066) as number);
      this.flyToHud(sprite.texture.key, sprite.frame.name, sprite.x, sprite.y, target[0], target[1], target[2]);
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
    // Dibujo de la sala (centerArt.ts, del supervisor): mostrador, máquina de curación, sanadora, alfombra y bancos
    this.counter?.art.destroy();
    this.counter = { x, y, art: buildCenterArt(this, i, x, y) };
    this.paintCounter();
    // Con ratón: clic en el mostrador
    const hit = this.add.zone(x, y, 240, 90).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => (this.overHud = true));
    hit.on('pointerout', () => (this.overHud = false));
    hit.on('pointerdown', () => this.current?.id === room.id && this.useCenter());
    // T87: NPC de los encargos al lado del mostrador
    buildNpc(this, x + 170, y + 40);
  }

  private paintCounter() {
    const c = this.counter;
    if (!c) return;
    c.art.setUsed(this.centerUsed);
  }

  /** El mostrador cura la mitad de tus PS máximos, una vez por piso (si te falta vida). */
  private useCenter() {
    if (this.ended || this.transitioning) return;
    if (this.centerUsed) return this.notify('Ya te has curado en este piso', { kind: 'warning', icon: 'center' });
    if (!canHeal(this.hp, this.stats.maxHp)) return this.notify('Ya tienes todos los PS', { kind: 'warning', icon: 'center' });
    const amount = scaleHeal(centerHeal(this.stats.maxHp), this.diff);
    this.hp = healed(this.hp, this.stats.maxHp, amount);
    this.centerUsed = true;
    sfx('heal');
    // Los huecos se encienden uno a uno y salen corazones; al terminar la máquina queda gris hasta el piso siguiente
    this.counter?.art.heal();
    this.time.delayedCall(1500, () => this.counter && this.paintCounter());
    this.popup(this.player.x, this.player.y - 50, `+${amount} PS`, CENTER_PINK);
    this.notify(`¡Centro Pokémon!\n+${amount} PS`, { kind: 'heal', icon: 'center' });
    this.saveNow();
  }

  // --- Tienda ---

  private buildShop(room: Room) {
    const i = this.interior(room);
    // Dibujo de la sala (shopArt.ts, del supervisor): toldo, estantes, mercader, alfombra y pedestales
    this.shopArt?.destroy();
    this.shopArt = buildShopArt(this, i, i.cx, i.cy, SHOP_OFFSETS);
    this.shopViews = this.shop.map((slot, k) => {
      if (slot.sold) return [];
      const x = i.cx + SHOP_OFFSETS[k];
      const y = i.cy;
      const { name, color } = this.goodsInfo(slot);
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
      return [icon, label, price];
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

  private buy(k: number, confirmed = false) {
    if (this.ended || this.transitioning) return;
    const slot = this.shop[k];
    if (!slot) return;
    const res = canBuy(slot, this.coins, this.hp, this.stats.maxHp);
    if (res === 'sold') return;
    if (res === 'poor') return this.notify(`Te faltan monedas\n(cuesta ${slot.price}, tienes ${this.coins})`, { kind: 'warning', icon: 'coin' });
    if (res === 'full') return this.notify('Ya tienes todos los PS', { kind: 'warning', icon: 'potion' });
    if (!confirmed) return void this.askBuy(this.goodsInfo(slot).name, slot.price, () => this.buy(k, true));
    if (slot.goods.kind === 'move' && this.chosenSlot === undefined && this.askSlot(slot.goods.move, (s) => { this.chosenSlot = s; this.buy(k, true); }, () => undefined)) return;
    this.coins -= slot.price;
    sfx('buy');
    slot.sold = true;
    this.shopArt?.sold(k);
    this.shopViews[k]?.forEach((o) => o.destroy());
    this.shopViews[k] = [];
    const g = slot.goods;
    if (g.kind === 'potion') {
      const p = POTIONS[g.id];
      const amount = scaleHeal(p.heal, this.diff);
      this.hp = healed(this.hp, this.stats.maxHp, amount);
      this.notify(`${p.name}\n+${amount} PS`, { kind: 'heal', icon: 'potion' });
    } else if (g.kind === 'move') {
      this.gainItem({ kind: 'move', move: g.move });
    } else {
      const item = passiveById(g.id);
      if (item) this.gainItem({ kind: 'passive', item });
    }
    this.maybeSeed(SEED_CHANCE.shop, 1000 + k);
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
    // Salas sorpresa (T39): mercader, altar y cofre misterioso
    const spot = this.eventSpots.find((sp) => Phaser.Math.Distance.Between(px, py, sp.x, sp.y) < NEAR);
    if (spot) {
      this.prompt.setText(spot.prompt()).setPosition(spot.x, spot.y - 56);
      if (act) {
        spot.use();
        return padA;
      }
      return false;
    }
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
      // Drenar cura una vez por lanzamiento (no por cada golpe de un chorro o un rayo) y con tope por segundo
      if (now < this.drainReadyAt) return;
      const heal = Math.min(drainHeal(damage), Math.floor(this.healBudget));
      if (heal <= 0) return;
      this.drainReadyAt = now + 700;
      this.healBudget -= heal;
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

  /** T76: estado ya puesto + golpe de otro tipo = reacción (una por enemigo cada 1,5 s). */
  private tryReaction(enemy: Sprite, type: string, damage: number) {
    const now = this.time.now;
    const list = (enemy.getData('statuses') as ActiveStatus[] | undefined) ?? [];
    const r = findReaction(list, type, now);
    if (!r || !canReact(enemy.getData('reactAt') as number | undefined, now)) return;
    enemy.setData('reactAt', now);
    let rest = consumeStatus(list, r);
    if (r.applies) rest = applyStatus(rest, STATUS_EFFECTS[r.applies], now, damage);
    if (r.stunMs > 0) rest = applyStatus(rest, { ...STATUS_EFFECTS.stun, duration: r.stunMs }, now, 0);
    enemy.setData('statuses', rest);
    this.reactionsFound = discover(this.reactionsFound, r.id);
    // Aviso sobre el enemigo, nunca en el centro
    this.popup(enemy.x, enemy.y - (enemy.getData('size') as number) / 2 - 28, r.name, r.color);
    reactionFx(this, r.id, enemy.x, enemy.y, r.color, r.radius);
    const hurt = (e: Sprite) => {
      const boss = !!(e.getData('ai') as EnemyAI | undefined)?.boss;
      const d = reactionDamage(r, damage, boss);
      this.countDamage(e, d);
      const hp = (e.getData('hp') as number) - d;
      e.setData('hp', hp);
      damageNumber(this, e.x, e.y - (e.getData('size') as number) * 0.45, d, {});
      if (hp <= 0 && e !== enemy) this.killEnemy(e);
    };
    hurt(enemy);
    if (r.radius <= 0 && r.chain <= 0) return;
    const others = (this.enemies.getChildren() as Sprite[])
      .filter((e) => e !== enemy && e.active && (e.getData('hp') as number) > 0)
      .map((e) => ({ e, d: Phaser.Math.Distance.Between(enemy.x, enemy.y, e.x, e.y) }));
    const targets = r.radius > 0
      ? others.filter((o) => o.d <= r.radius)
      : others.filter((o) => o.d <= 180).sort((a, b) => a.d - b.d).slice(0, r.chain);
    if (r.chain > 0) reactionChain(this, enemy.x, enemy.y, targets.map((o) => o.e), r.color);
    for (const o of targets) hurt(o.e);
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
    // Bocanadas del estado (quemado, congelado…) cada poco mientras dure
    const sts = e.getData('statuses') as ActiveStatus[] | undefined;
    if (e.active && sts?.length && time >= ((e.getData('puffAt') as number | undefined) ?? 0)) {
      const live = sts.find((st) => time < st.until);
      if (live) {
        e.setData('puffAt', time + 320);
        if (this.fxBudget.take(this.time.now)) statusPuff(this, e.x, e.y - (e.getData('size') as number) / 3, live.kind);
      }
    }
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
    const reward = this.giveTickets(waveTickets(round));
    const record = !this.codeRun && submitRecord('waves', round, undefined, this.diff);
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
    this.difficulty = applyDifficulty(difficultyFor(this.level()), this.diff);
    this.saveNow();
    const ready = this.level() !== prevLevel ? this.reloadFoes(this.level()).catch(() => undefined) : Promise.resolve();
    void ready.then(() => !this.ended && this.time.delayedCall(400, () => this.startWave(1400)));
  }

  private checkClear() {
    // Tras caer ya no se limpia nada (ni con 0 PS mientras se abre «Una más»): un enemigo que cae después que tú
    // no puede dar la victoria; ver también finish
    if (this.ended || this.hp <= 0) return;
    const room = this.current;
    if (this.mode === 'waves') {
      if (this.enemies.countActive(true) === 0) this.onWaveCleared();
      return;
    }
    if (this.cleared.has(room.id) || this.enemies.countActive(true) > 0) return;
    if (this.rivalWave > 0 && this.roomEvent?.roomId === room.id && this.rivalWave < this.rivalTeam) {
      this.rivalWave++;
      const w = this.rivalWave;
      this.notify(`${this.rivalName} saca otro Pokémon\n${w}/${this.rivalTeam}`, { kind: 'danger', icon: 'sword' });
      this.time.delayedCall(900, () => !this.ended && this.current.id === room.id && this.spawnRivalMember(w));
      return;
    }
    if (room.kind === 'challenge' && this.challengeWave > 0 && this.challengeWave < CHALLENGE_WAVES) {
      this.challengeWave++;
      this.notify(`Oleada ${this.challengeWave}/${CHALLENGE_WAVES}`, { kind: 'danger', icon: 'heart' });
      this.time.delayedCall(1000, () => this.spawnChallengeWave(room.id));
      return;
    }
    for (const id of this.groupIds(room)) this.cleared.add(id);
    noteRoomTime(this.counters, this.counters.seconds - this.roomStartSec);
    this.onRuleRoomCleared(room);
    this.chargeActive();
    this.mission({ kind: 'room' });
    this.tip('pause');
    if (room.kind === 'boss') this.bossBeaten();
    sfx('clear');
    this.setGroupDoorsLocked(room, false, true);
    // Onda de "sala limpia" que sale del jugador y recorre la sala
    for (const [delay, color] of [[0, 0xffffff], [120, 0xffd34d]] as const) {
      const wave = this.add.circle(this.player.x, this.player.y, 20).setStrokeStyle(10, color, 0.85).setDepth(7);
      this.tweens.add({ targets: wave, radius: 620, alpha: 0, duration: 700, delay, ease: 'Cubic.easeOut', onComplete: () => wave.destroy() });
    }
    this.foeShots.clear(true, true);
    this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.healOnClear);

    // En Rush de jefes no hay salas que den tickets, así que cada jefe da algo menos que en un piso
    const bossReward = bossTicketsFor(this.mode === 'bossrush' ? Math.ceil(this.floorNum / 2) : this.floorNum);
    const reward = this.giveTickets(room.kind === 'boss' ? bossReward : roomTicketsFor(this.floorNum));
    // T48: premio del rival y de la sala del tiempo; huevo y cansancio
    if (this.rivalWave > 0 && this.roomEvent?.roomId === room.id) {
      this.rivalWave = 0;
      this.eventsDone.add(room.id);
      const bonus = this.giveTickets(rivalBonus(reward));
      // T59: además de los tickets, el entrenador deja un objeto
      const ri = this.interior(room);
      this.dropItem(room.id, ri.cx, ri.cy);
      this.notify(`¡Has vencido a ${this.rivalName}!\n+${bonus} tickets extra y un objeto`, { kind: 'reward', icon: 'ticket' });
    }
    const tt = this.timeTrial;
    if (tt && tt.roomId === room.id) {
      tt.label.destroy();
      this.timeTrial = undefined;
      this.eventsDone.add(room.id);
      if (!tt.failed) {
        const i = this.interior(room);
        this.dropItem(room.id, i.cx, i.cy);
        this.notify('¡A tiempo!\nHa caído un objeto', { kind: 'reward', icon: 'clock' });
      } else this.notify('Sala del tiempo superada', { kind: 'info', icon: 'clock' });
    }
    this.onRoomClearedT48();

    if (this.mode === 'tower') return this.towerCleared(room);

    if (room.kind === 'boss') {
      // Récord: pisos completados (Normal, Infinito) o jefes vencidos (Rush)
      const record = !this.codeRun && submitRecord(this.mode, this.floorNum, undefined, this.diff);
      if (record) this.counters.newRecord = true;
      // Medalla del bioma (solo la primera vez que se vence a su jefe; los invitados no guardan)
      const medal = earnMedal(this.biome.id);
      if (medal.gained) {
        this.giveTickets(medal.tickets);
        this.notify(
          medal.complete
            ? `¡${medal.gained.name}! ¡Las 9 medallas!\n+${medal.tickets} tickets`
            : `¡${medal.gained.name} conseguida!\n+${medal.tickets} tickets`,
          { kind: 'reward', icon: 'star' },
        );
      }
      if (isFinalFloor(this.mode, this.floorNum)) {
        // Reto final superado
        this.mission({ kind: 'win' });
        this.giveTickets(FINALE_BONUS);
        this.finish(true, `¡Has superado el reto final!\n+${this.earned} tickets en total\nPulsa R, Start o haz clic para ver el resumen`);
        return;
      }
      if (isFinaleGate(this.mode, this.floorNum)) {
        // Último piso: objeto y trampilla dorada al reto final (al pisarla se pregunta)
        const i = this.interior(room);
        this.dropItem(room.id, i.cx + 170, i.cy);
        this.spawnTrapdoor(true);
        this.notify(`¡Jefe derrotado! +${reward} tickets\nPisa la trampilla dorada: reto final o rendirte con la victoria`, { kind: 'reward', icon: 'star' });
        this.saveNow();
        return;
      }
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
    if (this.rng(RNG.clear)() < CLEAR_DROP_CHANCE) {
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
    const device = currentInput();
    const key = (m ? `${m.id}:${m.name}:${ready}` : 'vacía') + ':' + device;
    if (this.slotShown[i] === key) return;
    this.slotShown[i] = key;
    const g = this.slotBoxes[i].clear();
    const x = HUD.right.x + HUD.pad;
    const w = HUD.right.w - HUD.pad * 2;
    const y = this.slotY(i);
    if (m) drawSlotFrame(g, x, y, w, 64, typeColor(m.type), ready);
    else drawHudFrame(g, x, y, w, 64);
    if (m) {
      // Ficha con el nombre del tipo sobre el borde de arriba
      g.fillStyle(0x1d2848, 1).fillRoundedRect(x + w - 98, y - 9, 92, 22, 11);
      g.fillStyle(typeColor(m.type), 1).fillRoundedRect(x + w - 96, y - 7, 88, 18, 9);
    }
    this.slotTypes[i].setText(m ? typeNameEs(m.type).toUpperCase() : '');
    // Botón para lanzarlo: A B X Y con sus colores en el mando, la tecla configurada con teclado o ratón
    const badge = this.slotBadges[i];
    const bx = x + 22;
    let textX = x + 42;
    const by = y + 34;
    if (device === 'gamepad') {
      const PAD = [['A', 0x3cb043], ['B', 0xd83a3a], ['X', 0x2f6fd8], ['Y', 0xe0b020]] as const;
      g.fillStyle(0x101828, 1).fillCircle(bx, by, 14);
      g.fillStyle(PAD[i][1], 1).fillCircle(bx, by, 12);
      g.fillStyle(0xffffff, 0.35).fillCircle(bx - 3, by - 4, 4);
      badge.setText(PAD[i][0]).setFontSize(15).setVisible(true);
    } else if (device === 'touch') {
      badge.setVisible(false);
      textX = x + 14;
    } else {
      const label = keyLabel(loadKeys()[`power${i + 1}` as 'power1']);
      const kw = Math.max(26, 12 + label.length * 9);
      g.fillStyle(0x101828, 1).fillRoundedRect(bx - kw / 2 - 2, by - 14, kw + 4, 28, 6);
      g.fillStyle(0xe8e8f0, 1).fillRoundedRect(bx - kw / 2, by - 12, kw, 24, 5);
      g.fillStyle(0xb8bcc8, 1).fillRect(bx - kw / 2 + 2, by + 7, kw - 4, 3);
      badge.setText(label).setFontSize(label.length > 2 ? 11 : 14).setColor('#1d2848').setShadow(0, 0, '#00000000', 0).setVisible(true);
      textX = Math.max(textX, bx + kw / 2 + 8);
    }
    if (device === 'gamepad') badge.setColor('#ffffff').setShadow(1, 1, '#00000088', 0);
    badge.setPosition(bx, by).setAlpha(m && !ready ? 0.5 : 1);
    const text = this.hud[i].setX(textX);
    if (!m) text.setText('—').setAlpha(0.6);
    else text.setText(shorten(pretty(m.name), 13)).setAlpha(ready ? 1 : 0.4);
    g.setAlpha(m ? 1 : 0.6);
  }

  /** "Sin conexión": una vez por sesión (también si se pierde la red a mitad de partida). */
  private notifyOffline() {
    if (GameScene.offlineNotified) return;
    GameScene.offlineNotified = true;
    this.notify('Sin conexión\nUsando datos guardados', { kind: 'warning', icon: 'pokeball' });
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

  /** Golpe al jugador: chispas, número, empujón, destello rojo en la sala, temblor y un instante de parón. */
  private hurtFeedback(from: Sprite, taken: number) {
    const p = this.player;
    const now = this.time.now;
    const away = new Phaser.Math.Vector2(p.x - from.x, p.y - from.y);
    if (away.lengthSq() < 1) away.set(0, 1);
    away.normalize();
    hitSpark(this, (p.x + from.x) / 2, (p.y + from.y) / 2, 0xff5a4a, 7, 1.2);
    // Cuerpo a cuerpo: zarpazo del color del tipo del que te ha dado
    const fai = from.getData('ai') as EnemyAI | undefined;
    if (fai) clawMarks(this, p.x, p.y, typeColor(fai.type), Math.atan2(p.y - from.y, p.x - from.x));
    damageNumber(this, p.x, p.y - 50, taken, { color: '#ff6a5a' });
    p.setTintFill(0xffffff);
    this.time.delayedCall(70, () => p.active && !this.ended && p.setTint(0xff6666));
    this.time.delayedCall(200, () => p.active && !this.ended && p.clearTint());
    this.cameras.main.shake(150, 0.006);
    if (this.hurtFlash) {
      this.tweens.killTweensOf(this.hurtFlash);
      this.hurtFlash.setFillStyle(0xff2a2a, 0.22);
      this.tweens.add({ targets: this.hurtFlash, fillAlpha: 0, duration: 320, ease: 'Quad.easeOut' });
    }
    if (this.hp > 0) {
      p.setVelocity(away.x * 360, away.y * 360);
      this.playerKnockUntil = now + 130;
      // Parón de golpe (hit stop): la física se congela un instante para que el golpe pese
      this.physics.pause();
      this.time.delayedCall(60, () => !this.ended && !this.transitioning && this.physics.resume());
    }
  }

  /**
   * Te dan. `unblockable`: ataques de jefe que el parry no para (zonas de peligro marcadas, ondas y láseres), que
   * ya avisan antes y se esquivan moviéndose; si se pudieran bloquear, quedarían sin sentido.
   */
  private hurtPlayer(enemy: Sprite, unblockable = false) {
    const now = this.time.now;
    if (this.ended || this.transitioning || now < this.invulnUntil) return;
    // Quien salta no hace daño mientras desaparece o recién aparecido
    const ai = enemy.getData('ai') as EnemyAI | undefined;
    if (ai && ai.behavior === 'hop' && ai.state !== 'walk') return;
    // El Pokémon raro solo quiere huir
    if (enemy.getData('runaway')) return;
    // T70: el ladrón no hace daño, solo roba
    if (enemy.getData('thief')) return this.thiefTouch();
    // Bajo tierra o escondido no hace daño al tocarte
    if (ai && (ai.behavior === 'burrow' || ai.behavior === 'ambush') && (ai.state === 'vanish' || ai.state === 'appear')) return;
    // T53: parry a tiempo. Va antes que la esquiva y el escudo para no gastarlos en un golpe que ya está parado.
    if (tryParry(this.parry, this.game.loop.time, now, unblockable)) {
      this.invulnUntil = now + PARRY_GRACE_MS;
      // Aviso sobre el jugador, como "¡Esquivado!" (nunca en el centro de la pantalla)
      this.popup(this.player.x, this.player.y - 50, '¡Parry!', 0xffd34d);
      this.addAdrenaline('parry');
      meterOnParry(this.powerMeter);
      noteParry(this.counters);
      sfx('crit');
      parryHit(this, this.player.x, this.player.y);
      return;
    }
    if (this.stats.dodge > 0 && Math.random() < this.stats.dodge) {
      this.invulnUntil = now + 500;
      this.popup(this.player.x, this.player.y - 50, '¡Esquivado!', 0xfff8c0);
      this.addAdrenaline('dodge');
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
    this.comboLose();
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
    // Lluvia y Sol también cambian los ataques de Agua y Fuego de los enemigos
    const foeType = ai?.type ?? (enemy.getData('ptype') as string | undefined);
    const rawTaken = Math.max(1, Math.round(((enemy.getData('dmg') as number | undefined) ?? 10) * weak * this.stats.damageTaken * weatherPowerMul(this.weather, foeType) * phasePowerMul(this.phase ?? 'day', foeType) * damageMul(foeType, this.playerTypes)));
    this.effectivenessPopup(effectOf(foeType, this.playerTypes), this.player.x, this.player.y - 70);
    // T75: el escudo del Dinamax/Gigamax para el golpe antes que los PS
    const taken = absorbWithShield(this.powerForm, rawTaken);
    if (taken < rawTaken) this.popup(this.player.x, this.player.y - 50, '¡Escudo Dinamax!', 0xe8384f);
    if (taken <= 0) return;
    if (this.hp - taken <= 0 && this.focusLeft > 0) {
      // Banda Focus: aguanta con 1 PS
      this.focusLeft--;
      this.hp = 1;
      this.notify('¡Aguantó gracias a la Banda Focus!', { kind: 'heal', icon: 'heart' });
    } else this.hp -= taken;
    // T84: perder vida rompe la cadena shiny
    if (this.shinyChain.count > 0) {
      this.shinyChain = chainBreak();
      this.paintShinyChain();
    }
    if (!this.lowHpUsed && this.stats.lowHpHeal > 0 && this.hp > 0 && this.hp < this.stats.maxHp * 0.25) {
      // Hierba Blanca: una vez por piso
      this.lowHpUsed = true;
      this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.lowHpHeal);
      this.popup(this.player.x, this.player.y - 50, `Hierba Blanca +${this.stats.lowHpHeal} PS`, 0xf0f0e0);
    }
    this.gardenAutoHeal();
    this.hurtFeedback(enemy, taken);

    if (this.hp <= 0) {
      const where = this.mode === 'normal' ? '' : ` en ${progressText(this.mode, this.floorNum).toLowerCase()}`;
      this.playerDown(`Has caído${where} · +${this.earned} tickets\nPulsa R, Start o haz clic para ver el resumen`);
    }
  }

  /**
   * T57: has caído. Si queda la segunda oportunidad de la partida y se puede pagar con caramelos o tickets, se ofrece
   * («Una más», SecondChanceScene); si no, o si la rechazas, se acaba la partida con `message`.
   */
  private playerDown(message: string) {
    if (this.ended) return;
    const balances = { candies: loadCandies(), tickets: loadTickets() };
    if (!this.scene.manager.keys['SecondChance'] || this.scene.isActive('SecondChance') || !canOfferRevive(this.secondChanceUsed, balances, this.floorNum)) {
      this.finish(false, message);
      return;
    }
    const costs = { candies: reviveCost('candies', this.floorNum), tickets: reviveCost('tickets', this.floorNum) };
    const mode = accountInfo().mode;
    this.player.setVelocity(0, 0);
    this.scene.launch('SecondChance', {
      costs,
      balances,
      guest: mode !== 'cloud' && mode !== 'local',
      onChoice: (c: SecondChanceChoice) => {
        this.scene.stop('SecondChance');
        this.scene.resume();
        this.input.keyboard?.resetKeys();
        // Los botones del mando con los que se eligió siguen pulsados: que no lancen un poder al volver
        this.padPrev = [true, true, true, true];
        // Se cobra aquí (y no en la otra escena) para que el saldo sea el de este momento
        const paid = c === 'candies' ? spendCandies(costs.candies) : c === 'tickets' ? spendTickets(costs.tickets) : false;
        if (!paid) {
          this.finish(false, message);
          return;
        }
        this.secondChanceUsed = true;
        this.hp = revivedHp(this.stats.maxHp);
        // Volver no cuenta como curarse para las misiones «sin curarte»
        this.hpMark = this.hp;
        this.invulnUntil = this.time.now + REVIVE_IMMUNE_MS;
        this.notify(`¡Una más!\nVuelves con ${Math.ceil(this.hp)} PS`, { kind: 'heal', icon: 'heart' });
        sfx('heal');
        // El fogonazo de cámara no sale con efectos bajos (como los fundidos de los menús); el aviso sí
        if (!this.fxBudget.low) reviveBurst(this, this.player.x, this.player.y);
        this.saveNow();
        // Si el último enemigo cayó mientras tenías 0 PS, checkClear no lo dio por limpio: se mira ahora
        // (solo en salas de pelea: en la tienda o el Centro, donde puedes caer con tu propia bomba, no hay nada que limpiar)
        if (this.mode === 'waves' || ['combat', 'boss', 'challenge'].includes(this.current.kind)) this.checkClear();
      },
    });
    this.scene.pause();
  }

  /** Fin de partida: congela el juego y deja salir con teclado (R), mando (Start / A) o ratón (clic). */
  private finish(won: boolean, message: string) {
    // Una sola vez: un enemigo que cae después de ti (p. ej. por el Casco Dentado, con un delayedCall) no puede
    // convertir la derrota en victoria ni apuntar la partida dos veces en el historial
    if (this.ended) return;
    // Como en Isaac: al morir o ganar, la partida guardada se borra
    clearRun(this.slot);
    // Desafío diario: la partida que cuenta apunta los pisos completados
    if (this.daily?.counts && submitDaily(this.daily.day, won ? this.floorNum : this.floorNum - 1)) this.counters.newRecord = true;
    // T58: completar el desafío con la racha en un día redondo (3, 7, 14, 30) da tickets de más
    if (this.daily?.counts && won) {
      const streak = loadDaily().streak;
      const bonus = streakReward(streak);
      if (bonus > 0) {
        // También en los tickets de la partida, para que el resumen y el historial cuenten lo ganado de verdad
        this.earned += bonus;
        addTickets(bonus);
        this.notify(`¡Racha de ${streak} días!\n+${bonus} tickets`, { kind: 'reward', icon: 'ticket' });
      }
    }
    // T81: la partida con código guarda su mejor resultado (pisos, rondas o jefes superados) para comparar
    const code = this.seedCode();
    if (this.codeRun && code) submitSeedBest(code, won ? this.floorNum : this.floorNum - 1);
    // T87: los encargos de NPC caducan contando partidas terminadas
    this.mission({ kind: 'runEnd' });
    // T85: el huerto crece por partidas jugadas
    updateGarden(growGarden);
    this.ended = true;
    this.endedAt = this.time.now;
    this.physics.pause();
    // El jugador celebra o se debilita (la cámara se acerca al caer)
    const pb = this.player?.body as Body | null;
    if (this.player?.active) {
      if (won) cheerPlayer(this, this.player);
      else (sfx('faint'), faintPlayer(this, this.player, pb ? pb.bottom : this.player.y + 30, GAME_ZOOM));
    }
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
      parries: this.counters.parries ?? 0,
      picked: this.counters.picked ?? 0,
      fastestRoom: Math.round(this.counters.fastestRoom ?? 0),
      // Los pisos ya cerrados al bajar y el de ahora, que sigue abierto
      floorSeconds: floorTimes(this.counters),
      routes: this.routesTaken.map(routeLabel),
      ...(code ? { seedCode: code } : {}),
      ...(this.codeRun ? { fromCode: true } : {}),
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
