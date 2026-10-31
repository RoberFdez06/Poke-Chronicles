// Defensa de torres: el motor de una partida (un nivel o el infinito de un mapa). Todo el juego pasa aquí: oleadas,
// enemigos por el camino, torres que disparan proyectiles, dinero, habilidades y fin de partida. La escena solo lo
// dibuja y le pasa lo que hace el jugador; así se puede probar y equilibrar con tests. Lógica pura, sin Phaser.
import { absorbShieldHit } from '../enemies.ts';
import {
  ABILITY_INFO, BOOST_DAMAGE, BOOST_RATE, BOOST_TIME, FREEZE_BOSS_TIME, FREEZE_TIME, LIGHTNING_TARGETS, STORM_MAX, abilityReady, bombDamage, densestPoint,
  freshCooldowns, isZoneAbility, lightningDamage, tickCooldowns, type AbilityId, type Cooldowns,
} from './abilities.ts';
import {
  CHIEF_FIRST, CHIEF_GAP, CHIEF_HEAL, CHIEF_HEAL_BREAK, CHIEF_SHIELD, CHIEF_SKILL_INFO, RUSH_MUL, RUSH_TIME, STUN_RADIUS, STUN_REACH, STUN_TIME,
  chiefMoney, chiefSkillsFor, type ChiefSkill,
} from './chiefs.ts';
import {
  COIN_BOUNTY, DOUBLE_BONUS, DOUBLE_HP, FAST_BOUNTY, FAST_MUL, FOG_RANGE, STORM_EVERY, STORM_RADIUS, STORM_STUN, STORM_WARN, WAVE_EVENT_INFO,
  detourPath, stormDamage, waveEventFor, type WaveEventId,
} from './events.ts';
import { TOWER_PERKS, addRelic, draftPerks, freshRelics, interestOf, perkValue, type Perk, type Relics } from './perks.ts';
import { isBuildable, pathCells, pathPoints, pointAt, polyLength, roadSet, type TdMap } from './maps.ts';
import { MAP_FOES, type TdMon } from './species.ts';
import { decideDark, darkProgress, TD_DARK_MUL } from '../darkMon.ts';
import { takeAdminNextDark } from '../admin.ts';
import {
  BRANCH_LEVEL, MAX_TOWER_LEVEL, MEGA_LEVEL, bestTypeMul, megaCostFor, megaSpeciesOf, sellValue, towerCost, towerStats, upgradeCostFor, type Branch, type TowerStats,
} from './towers.ts';
import {
  earlyCallBonus, enemyDef, isBossWave, isChiefWave, isEndless, prepTime, stagePower, waveBonus, waveSpawns, wavesInLevel,
  type EnemyDef, type Spawn, type Stage,
} from './waves.ts';

export const BASE_HP = 20;
/** Copias de cada Pokémon del equipo que se pueden colocar a la vez (granjas, 2). */
export const PLACE_LIMIT = 3;
export const FARM_LIMIT = 2;
export const SHOT_SPEED = 13;
export const AURA_RANGE = 1.6;
export const HEAL_EVERY = 2.6;
export const HEAL_RANGE = 2.2;
export const HASTE_RANGE = 1.8;
export const HASTE_MUL = 1.35;
/** Segundos (de juego) que la elección de mejora para la cuenta atrás de la preparación. */
export const PERK_HOLD = 25;

export type Targeting = 'first' | 'strong' | 'last';
export const TARGETING_LABEL: Record<Targeting, string> = { first: 'Primero', strong: 'Más fuerte', last: 'Último' };

/** Un Pokémon del equipo (más su evolución final, si la tiene, que la escena consulta a PokeAPI). */
export interface TeamMon extends TdMon {
  evolveId?: number | null;
}

export interface TdTower {
  id: number;
  slot: number;
  mon: TeamMon;
  x: number;
  y: number;
  level: number;
  branch: Branch | null;
  /** Especie a la que ha evolucionado (nivel 5), o null (nivel final con aura). */
  evolved: number | null;
  /** Especie megaevolucionada (nivel 6), o null. */
  mega: number | null;
  cooldown: number;
  shots: number;
  targeting: Targeting;
  kills: number;
  /** Hacia dónde mira (radianes). */
  facing: number;
  /** Segundos aturdida (no dispara). */
  stunned: number;
  /** Segundos con el Refuerzo. */
  boost: number;
}

/** Aviso de una habilidad de jefe en curso. */
export interface ChiefWarn {
  skill: ChiefSkill;
  left: number;
  total: number;
  x: number;
  y: number;
  r: number;
  /** Vida al empezar el aviso (la Recuperación se corta con daño). */
  hp0: number;
}

export interface TdEnemy {
  id: number;
  def: EnemyDef;
  hp: number;
  shield: number;
  maxShield: number;
  pts: { x: number; y: number }[];
  len: number;
  dist: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  slowMul: number;
  slowLeft: number;
  frozen: number;
  haste: number;
  healCd: number;
  /** Fase del jefe (1-3). */
  phase: number;
  /** Jefe de oleada: sus habilidades, la siguiente, el aviso en curso y la carrera. */
  skills: ChiefSkill[];
  skillCd: number;
  skillIdx: number;
  warn: ChiefWarn | null;
  rush: number;
  /** Pokémon oscuro (darkMon.ts): más vida, escudo, velocidad y recompensa. */
  dark?: boolean;
}

/** Rayo de la tormenta avisado en una casilla. */
export interface StormMark {
  x: number;
  y: number;
  left: number;
}

export interface TdShot {
  id: number;
  towerId: number;
  targetId: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  type: string;
  types: readonly string[];
  damage: number;
  special: boolean;
  stats: TowerStats;
}

export type TdEvent =
  | { t: 'spawn'; id: number }
  | { t: 'fire'; towerId: number; shotId: number; special: boolean }
  | { t: 'hit'; x: number; y: number; dmg: number; mul: number; crit: boolean; type: string; special: boolean; shielded: boolean; enemyId: number; splash: number }
  | { t: 'chain'; pts: { x: number; y: number }[]; type: string }
  | { t: 'kill'; x: number; y: number; money: number; boss: boolean; chief: boolean; species: number; air: boolean }
  | { t: 'leak'; x: number; y: number; dmg: number }
  | { t: 'heal'; x: number; y: number; amount: number; base?: boolean }
  | { t: 'shieldBreak'; x: number; y: number }
  | { t: 'bossPhase'; x: number; y: number; phase: number }
  | { t: 'waveStart'; wave: number; boss: boolean; chief: boolean; event: WaveEventId | null }
  | { t: 'waveEnd'; wave: number; bonus: number; farm: number; perfect: boolean; interest: number }
  | { t: 'chiefIntro'; id: number; species: number; skills: ChiefSkill[] }
  | { t: 'chiefWarn'; id: number; skill: ChiefSkill; x: number; y: number; r: number; time: number }
  | { t: 'chiefSkill'; id: number; skill: ChiefSkill; x: number; y: number; r: number; ok: boolean }
  | { t: 'stun'; towerIds: number[]; x: number; y: number; r: number }
  | { t: 'stormWarn'; x: number; y: number; r: number; time: number }
  | { t: 'storm'; x: number; y: number; r: number }
  | { t: 'eventEnd'; id: WaveEventId }
  | { t: 'perks' }
  | { t: 'perk'; perk: Perk; towerIds: number[] }
  | { t: 'farm'; towerId: number; amount: number }
  | { t: 'evolve'; towerId: number }
  | { t: 'mega'; towerId: number }
  | { t: 'ability'; id: AbilityId; x: number; y: number; hits: { x: number; y: number }[] }
  | { t: 'won' }
  | { t: 'lost' };

export type Phase = 'prep' | 'wave' | 'won' | 'lost';

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TdGameOptions {
  map: TdMap;
  /** Nivel 1..niveles del mapa, o 0 para el infinito. */
  level: number;
  team: readonly TeamMon[];
  seed?: number;
}

export class TdGame {
  readonly map: TdMap;
  readonly stage: Stage;
  readonly team: readonly TeamMon[];
  /** Oleadas del nivel (Infinity en el infinito). */
  readonly totalWaves: number;
  maxHp = BASE_HP;
  hp = BASE_HP;
  money: number;
  wave = 0;
  cleared = 0;
  phase: Phase = 'prep';
  prepLeft: number;
  time = 0;
  towers: TdTower[] = [];
  enemies: TdEnemy[] = [];
  shots: TdShot[] = [];
  cooldowns: Cooldowns = freshCooldowns();
  kills = 0;
  /** Jefes de oleada vencidos (premio extra al acabar). */
  chiefsBeaten = 0;
  relics: Relics = freshRelics();
  /** Mejoras para elegir (tras cada oleada), o null. */
  perkChoice: Perk[] | null = null;
  /** Lo que aún puede parar la cuenta atrás la elección de mejora. */
  perkHold = 0;
  /** Mejoras elegidas en esta partida. */
  perks: Perk[] = [];
  /** Evento de la oleada en curso (null si no hay o ya acabó) y lo que le queda. */
  waveEvent: WaveEventId | null = null;
  eventLeft = 0;
  storms: StormMark[] = [];
  private stormCd = 0;
  private queue: Spawn[] = [];
  private waveTime = 0;
  private leakedThisWave = false;
  private nextId = 1;
  private events: TdEvent[] = [];
  private rng: () => number;
  /** Tiradas de los oscuros aparte, para no cambiar el resto de la partida con semilla. */
  private darkRng: () => number;
  private road: Set<string>;
  private groundPts: { x: number; y: number }[][];

  constructor(o: TdGameOptions) {
    this.map = o.map;
    this.stage = { tier: o.map.tier, level: Math.max(0, Math.min(o.map.levels, Math.floor(o.level))), levels: o.map.levels };
    this.team = o.team;
    this.totalWaves = isEndless(this.stage) ? Infinity : wavesInLevel(this.stage.level, this.stage.levels);
    this.money = o.map.startMoney;
    this.prepLeft = prepTime(1);
    this.rng = mulberry(o.seed ?? 12345);
    this.darkRng = mulberry(((o.seed ?? 12345) ^ 0x5d4c) >>> 0);
    this.road = roadSet(o.map);
    this.groundPts = o.map.paths.map((p) => pathPoints(p));
  }

  get endless(): boolean {
    return isEndless(this.stage);
  }

  get over(): boolean {
    return this.phase === 'won' || this.phase === 'lost';
  }

  /** Eventos desde la última llamada (para que la escena los dibuje). */
  drainEvents(): TdEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // --- Torres ---

  towerAt(x: number, y: number): TdTower | undefined {
    return this.towers.find((t) => t.x === x && t.y === y);
  }

  placedOf(slot: number): number {
    return this.towers.filter((t) => t.slot === slot).length;
  }

  limitOf(slot: number): number {
    const m = this.team[slot];
    return m && towerStats(m, 1, null).style === 'farm' ? FARM_LIMIT : PLACE_LIMIT;
  }

  /** Por qué no se puede colocar (null si se puede). */
  placeError(slot: number, x: number, y: number): string | null {
    const mon = this.team[slot];
    if (!mon || this.over) return 'No disponible';
    if (!isBuildable(this.map, x, y, this.road)) return 'Ahí no se puede colocar';
    if (this.towerAt(x, y)) return 'Casilla ocupada';
    if (this.placedOf(slot) >= this.limitOf(slot)) return `Máximo ${this.limitOf(slot)} de este Pokémon`;
    if (this.money < towerCost(mon)) return 'No tienes bastante dinero';
    return null;
  }

  place(slot: number, x: number, y: number): TdTower | null {
    if (this.placeError(slot, x, y)) return null;
    const mon = this.team[slot];
    this.money -= towerCost(mon);
    const t: TdTower = {
      id: this.nextId++, slot, mon, x, y, level: 1, branch: null, evolved: null, mega: null, cooldown: 0.2, shots: 0, targeting: 'first', kills: 0,
      facing: Math.PI / 2, stunned: 0, boost: 0,
    };
    this.towers.push(t);
    return t;
  }

  /** Estadísticas reales (con el aura de las torres de apoyo cercanas). */
  statsOf(t: TdTower): TowerStats {
    const s = towerStats(t.mon, t.level, t.branch);
    let aura = 1;
    for (const o of this.towers) {
      if (o === t) continue;
      const os = towerStats(o.mon, o.level, o.branch);
      const a = Math.max(os.aura, os.megaAura);
      if (a > 1 && Math.hypot(o.x - t.x, o.y - t.y) <= AURA_RANGE) aura = Math.max(aura, a);
    }
    // Reliquias, niebla y Refuerzo
    const r = this.relics;
    let dmgMul = aura;
    for (const ty of t.mon.types) dmgMul = Math.max(dmgMul, aura * (r.typeDmg[ty] ?? 1));
    let rate = r.rate;
    if (t.boost > 0) {
      dmgMul *= BOOST_DAMAGE;
      rate *= BOOST_RATE;
    }
    const range = r.range * (this.waveEvent === 'niebla' ? FOG_RANGE : 1);
    if (dmgMul === 1 && rate === 1 && range === 1 && r.crit === 0) return s;
    return {
      ...s,
      damage: Math.round(s.damage * dmgMul * 10) / 10,
      rate: Math.round(s.rate * rate * 100) / 100,
      range: Math.round(s.range * range * 100) / 100,
      crit: Math.min(0.6, s.crit + r.crit),
    };
  }

  /** Futuro: el evento de la siguiente oleada (para avisarlo durante la preparación). */
  get upcomingEvent(): WaveEventId | null {
    if (this.phase !== 'prep') return null;
    return this.eventOf(this.wave + 1);
  }

  /** La siguiente oleada trae jefe de oleada. */
  get upcomingChief(): boolean {
    return this.phase === 'prep' && isChiefWave(this.stage, this.wave + 1);
  }

  private eventOf(wave: number): WaveEventId | null {
    return waveEventFor(this.map.id, this.stage.level, wave, this.map.paths.length, isBossWave(this.stage, wave) || isChiefWave(this.stage, wave));
  }

  /** Especie que megaevolucionaría (nivel 5 con forma mega), o null. */
  megaSpecies(t: TdTower): number | null {
    return t.level === MAX_TOWER_LEVEL ? megaSpeciesOf(t.mon.id, t.evolved) : null;
  }

  /** Dinero para el siguiente nivel: el normal hasta el 5 y el de la megaevolución del 5 al 6 (null si no hay más). */
  upgradeCost(t: TdTower): number | null {
    if (t.level >= MEGA_LEVEL) return null;
    if (t.level === MAX_TOWER_LEVEL) return this.megaSpecies(t) !== null ? megaCostFor(t.mon) : null;
    return upgradeCostFor(t.mon, t.level);
  }

  /** Mejora un nivel. Al pasar al nivel 3 hay que elegir rama; del 5 al 6 megaevoluciona (si puede). */
  upgrade(towerId: number, branch?: Branch): 'ok' | 'max' | 'poor' | 'branch' | 'none' {
    const t = this.towers.find((q) => q.id === towerId);
    if (!t || this.over) return 'none';
    const cost = this.upgradeCost(t);
    if (cost === null) return 'max';
    if (t.level === MAX_TOWER_LEVEL) {
      if (this.money < cost) return 'poor';
      this.money -= cost;
      t.mega = this.megaSpecies(t);
      t.level = MEGA_LEVEL;
      this.events.push({ t: 'mega', towerId: t.id });
      return 'ok';
    }
    if (t.level + 1 === BRANCH_LEVEL && !t.branch && !branch) return 'branch';
    if (this.money < cost) return 'poor';
    this.money -= cost;
    t.level++;
    if (t.level === BRANCH_LEVEL && !t.branch) t.branch = branch ?? 'a';
    if (t.level === MAX_TOWER_LEVEL) {
      t.evolved = t.mon.evolveId ?? null;
      this.events.push({ t: 'evolve', towerId: t.id });
    }
    return 'ok';
  }

  sellValue(t: TdTower): number {
    return sellValue(t.mon, t.level);
  }

  sell(towerId: number): number {
    const i = this.towers.findIndex((q) => q.id === towerId);
    if (i < 0 || this.over) return 0;
    const v = this.sellValue(this.towers[i]);
    this.money += v;
    this.towers.splice(i, 1);
    return v;
  }

  cycleTargeting(towerId: number): Targeting | null {
    const t = this.towers.find((q) => q.id === towerId);
    if (!t) return null;
    const order: Targeting[] = ['first', 'strong', 'last'];
    t.targeting = order[(order.indexOf(t.targeting) + 1) % order.length];
    return t.targeting;
  }

  // --- Oleadas ---

  /** Llama ya a la siguiente oleada (en la preparación), con un poco de dinero por los segundos que quedaban. */
  callNextWave(): boolean {
    if (this.phase !== 'prep') return false;
    this.money += earlyCallBonus(this.prepLeft);
    this.startWave();
    return true;
  }

  private startWave() {
    // Sin elegir a tiempo: la primera mejora
    if (this.perkChoice) this.choosePerk(0);
    this.wave++;
    let q = waveSpawns(this.map, this.stage.level, this.wave);
    const ev = this.eventOf(this.wave);
    if (ev === 'desvio') {
      const p = detourPath(this.map.id, this.wave, this.map.paths.length);
      q = q.map((s) => ({ ...s, path: p }));
    } else if (ev === 'doble') {
      q = [...q.map((s) => ({ ...s, hpMul: DOUBLE_HP })), ...q.map((s) => ({ ...s, at: Math.round((s.at + 0.45) * 100) / 100, hpMul: DOUBLE_HP, path: (s.path + 1) % this.map.paths.length }))];
      q.sort((a, b) => a.at - b.at);
    }
    this.queue = q;
    this.waveEvent = ev;
    this.eventLeft = ev ? WAVE_EVENT_INFO[ev].duration : 0;
    this.stormCd = 1.5;
    this.storms = [];
    this.waveTime = 0;
    this.leakedThisWave = false;
    this.phase = 'wave';
    this.events.push({ t: 'waveStart', wave: this.wave, boss: isBossWave(this.stage, this.wave), chief: isChiefWave(this.stage, this.wave), event: ev });
  }

  private spawn(s: Spawn, distOffset = 0, kindOverride?: EnemyDef) {
    let def = kindOverride ?? enemyDef(s.kind, s.species, this.wave, stagePower(this.stage));
    if (s.hpMul && s.hpMul !== 1) def = { ...def, maxHp: Math.max(1, Math.round(def.maxHp * s.hpMul)), shield: Math.round(def.shield * s.hpMul) };
    const who = def.kind === 'boss' ? 'boss' : def.kind === 'chief' ? 'miniboss' : 'enemy';
    const inRoom = this.enemies.filter((o) => o.dark && o.def.kind !== 'boss' && o.def.kind !== 'chief').length;
    const dark = decideDark({ who, floor: darkProgress('towerdef', { wave: this.wave }), inRoom, forced: takeAdminNextDark(), rng: this.darkRng });
    if (dark) {
      def = { ...def, maxHp: Math.max(1, Math.round(def.maxHp * TD_DARK_MUL.hp)), shield: Math.round(def.shield * TD_DARK_MUL.hp), speed: def.speed * TD_DARK_MUL.speed, bounty: Math.round(def.bounty * TD_DARK_MUL.bounty) };
    }
    const path = Math.min(s.path, this.map.paths.length - 1);
    // Los voladores siguen el mismo camino (solo los alcanzan las torres con alcance aéreo)
    const pts = this.groundPts[path];
    const len = polyLength(pts);
    const p = pointAt(pts, distOffset);
    const e: TdEnemy = {
      id: this.nextId++, def, hp: def.maxHp, shield: def.shield, maxShield: def.shield, pts, len, dist: distOffset,
      x: p.x, y: p.y, dx: p.dx, dy: p.dy, slowMul: 1, slowLeft: 0, frozen: 0, haste: 0, healCd: HEAL_EVERY, phase: 1,
      skills: [], skillCd: CHIEF_FIRST, skillIdx: 0, warn: null, rush: 0, dark,
    };
    this.enemies.push(e);
    this.events.push({ t: 'spawn', id: e.id });
    if (def.kind === 'chief') {
      e.skills = chiefSkillsFor(this.map.id, this.stage.level, this.wave);
      this.events.push({ t: 'chiefIntro', id: e.id, species: def.species, skills: [...e.skills] });
    }
    return e;
  }

  private endWave() {
    this.cleared = this.wave;
    const perfect = !this.leakedThisWave;
    const bonus = Math.round(waveBonus(this.wave, perfect) * (this.waveEvent === 'doble' && this.eventLeft > 0 ? DOUBLE_BONUS : 1));
    let farm = 0;
    for (const t of this.towers) {
      const inc = towerStats(t.mon, t.level, t.branch).income;
      if (inc > 0) {
        farm += inc;
        this.events.push({ t: 'farm', towerId: t.id, amount: inc });
      }
    }
    const interest = interestOf(this.relics, this.money);
    this.money += bonus + farm + interest;
    this.events.push({ t: 'waveEnd', wave: this.wave, bonus, farm, perfect, interest });
    this.waveEvent = null;
    this.eventLeft = 0;
    this.storms = [];
    if (this.wave >= this.totalWaves) {
      this.phase = 'won';
      this.shots = [];
      this.events.push({ t: 'won' });
      return;
    }
    this.phase = 'prep';
    this.prepLeft = prepTime(this.wave + 1);
    // Mejora para elegir: épica tras un jefe
    const epic = isChiefWave(this.stage, this.wave) || isBossWave(this.stage, this.wave);
    const types = [...new Set(this.team.flatMap((m) => m.types))];
    const canFuse = this.team.some((_, i) => this.placedOf(i) >= 2);
    this.perkChoice = draftPerks(this.rng, { epic, types, towers: this.towers.length, canFuse });
    this.perkHold = PERK_HOLD;
    if (this.perkChoice.length) this.events.push({ t: 'perks' });
    else this.perkChoice = null;
  }

  // --- Mejoras entre oleadas ---

  /** Elige la mejora `i` de las ofrecidas. */
  choosePerk(i: number): boolean {
    const list = this.perkChoice;
    const p = list?.[i];
    if (!p || this.over) return false;
    this.perkChoice = null;
    this.perkHold = 0;
    this.perks.push(p);
    const v = perkValue(p);
    const ids: number[] = [];
    if (p.id === 'vida') {
      this.maxHp += v;
      this.hp = Math.min(this.maxHp, this.hp + v);
    } else if (TOWER_PERKS.has(p.id)) {
      if (p.id === 'entreno') {
        const weak = [...this.towers].filter((t) => t.level < MAX_TOWER_LEVEL).sort((a, b) => a.level - b.level || a.id - b.id).slice(0, v);
        for (const t of weak) if (this.freeLevel(t)) ids.push(t.id);
      } else if (p.id === 'evolucion') {
        const best = [...this.towers].filter((t) => t.level < MAX_TOWER_LEVEL).sort((a, b) => b.level - a.level || b.kills - a.kills)[0];
        if (best) {
          for (let k = 0; k < v; k++) this.freeLevel(best, true);
          ids.push(best.id);
        }
      } else {
        const slot = this.team.findIndex((_, s) => this.placedOf(s) >= 2);
        if (slot >= 0) {
          const pair = this.towers.filter((t) => t.slot === slot).sort((a, b) => b.level - a.level || b.kills - a.kills);
          const [keep, gone] = pair;
          keep.kills += gone.kills;
          this.towers.splice(this.towers.indexOf(gone), 1);
          for (let k = 0; k < v; k++) this.freeLevel(keep);
          ids.push(keep.id, gone.id);
        }
      }
    } else this.relics = addRelic(this.relics, p);
    this.events.push({ t: 'perk', perk: p, towerIds: ids });
    return true;
  }

  /** Sube un nivel gratis (con rama a por defecto); `stopAtFinal`: no megaevoluciona. */
  private freeLevel(t: TdTower, stopAtFinal = false): boolean {
    if (t.level >= MEGA_LEVEL) return false;
    if (t.level === MAX_TOWER_LEVEL) {
      if (stopAtFinal || this.megaSpecies(t) === null) return false;
      t.mega = this.megaSpecies(t);
      t.level = MEGA_LEVEL;
      this.events.push({ t: 'mega', towerId: t.id });
      return true;
    }
    t.level++;
    if (t.level >= BRANCH_LEVEL && !t.branch) t.branch = 'a';
    if (t.level === MAX_TOWER_LEVEL) {
      t.evolved = t.mon.evolveId ?? null;
      this.events.push({ t: 'evolve', towerId: t.id });
    }
    return true;
  }

  // --- Habilidades ---

  /** Enfriamiento real de una habilidad (con la reliquia de recarga). */
  abilityCooldown(id: AbilityId): number {
    return Math.round(ABILITY_INFO[id].cooldown * this.relics.cooldown);
  }

  /** Por qué no se puede lanzar (null si se puede). `at`: centro de la zona en casillas. */
  abilityError(id: AbilityId, at?: { x: number; y: number }): string | null {
    if (this.over) return 'No disponible';
    if (!abilityReady(this.cooldowns, id)) return `${ABILITY_INFO[id].name}: lista en ${Math.ceil(this.cooldowns[id])} s`;
    if (id === 'refuerzo') {
      if (!this.towers.length) return 'No tienes torres';
      if (at && !this.towersIn(at, ABILITY_INFO[id].radius).length) return 'No hay torres en la zona';
      return null;
    }
    if (!this.enemies.length) return 'No hay enemigos';
    if (at && isZoneAbility(id) && !this.enemiesIn(at, ABILITY_INFO[id].radius).length) return 'No hay enemigos en la zona';
    return null;
  }

  private enemiesIn(at: { x: number; y: number }, r: number) {
    return this.enemies.filter((e) => Math.hypot(e.x - at.x, e.y - at.y) <= r);
  }

  private towersIn(at: { x: number; y: number }, r: number) {
    return this.towers.filter((t) => Math.hypot(t.x + 0.5 - at.x, t.y + 0.5 - at.y) <= r);
  }

  /** Lanza una habilidad; las de zona, sobre `at` (sin `at` eligen solas el mejor sitio). */
  useAbility(id: AbilityId, at?: { x: number; y: number }): boolean {
    if (this.abilityError(id, at)) return false;
    const info = ABILITY_INFO[id];
    const hits: { x: number; y: number }[] = [];
    let cx = 0;
    let cy = 0;
    if (id === 'rayo') {
      const dmg = lightningDamage(this.wave);
      const targets = at
        ? this.enemiesIn(at, info.radius).sort((a, b) => b.hp + b.shield - (a.hp + a.shield)).slice(0, STORM_MAX)
        : [...this.enemies].sort((a, b) => b.hp + b.shield - (a.hp + a.shield)).slice(0, LIGHTNING_TARGETS);
      for (const e of targets) {
        hits.push({ x: e.x, y: e.y });
        this.damage(e, dmg, null, { type: 'electric', mul: 1, crit: false, special: true, splash: 0 });
      }
      if (at) [cx, cy] = [at.x, at.y];
    } else if (id === 'ventisca') {
      for (const e of this.enemies) e.frozen = Math.max(e.frozen, e.def.kind === 'boss' || e.def.kind === 'chief' ? FREEZE_BOSS_TIME : FREEZE_TIME);
    } else if (id === 'bomba') {
      const c = at ?? densestPoint(this.enemies, info.radius)!;
      [cx, cy] = [c.x, c.y];
      const dmg = bombDamage(this.wave);
      for (const e of this.enemiesIn(c, info.radius)) {
        hits.push({ x: e.x, y: e.y });
        this.damage(e, dmg, null, { type: 'fire', mul: 1, crit: false, special: true, splash: 0 });
      }
    } else {
      const c = at ?? densestPoint(this.towers.map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 })), info.radius)!;
      [cx, cy] = [c.x, c.y];
      for (const t of this.towersIn(c, info.radius)) {
        t.boost = BOOST_TIME;
        t.stunned = 0;
        hits.push({ x: t.x + 0.5, y: t.y + 0.5 });
      }
    }
    this.cooldowns[id] = this.abilityCooldown(id);
    this.events.push({ t: 'ability', id, x: cx, y: cy, hits });
    return true;
  }

  // --- Paso de simulación ---

  /** Avanza `dt` segundos de juego (la escena multiplica por la velocidad x1/x2/x3). */
  step(dt: number) {
    if (this.over || dt <= 0) return;
    // Pasos pequeños para que a x3 no se salten golpes
    let left = Math.min(dt, 5);
    while (left > 0 && !this.over) {
      const h = Math.min(left, 1 / 30);
      this.tick(h);
      left -= h;
    }
  }

  private tick(dt: number) {
    this.time += dt;
    this.cooldowns = tickCooldowns(this.cooldowns, dt);
    for (const t of this.towers) {
      if (t.stunned > 0) t.stunned = Math.max(0, t.stunned - dt);
      if (t.boost > 0) t.boost = Math.max(0, t.boost - dt);
    }
    if (this.phase === 'prep') {
      // Mientras eliges mejora, la cuenta atrás espera (un rato)
      if (this.perkChoice && this.perkHold > 0) this.perkHold -= dt;
      else this.prepLeft -= dt;
      if (this.prepLeft <= 0) this.startWave();
    } else if (this.phase === 'wave') {
      this.waveTime += dt;
      while (this.queue.length && this.queue[0].at <= this.waveTime) this.spawn(this.queue.shift()!);
      this.tickEvent(dt);
    }
    this.tickChiefs(dt);
    this.moveEnemies(dt);
    if (this.over) return;
    this.fireTowers(dt);
    this.moveShots(dt);
    if (this.phase === 'wave' && this.queue.length === 0 && this.enemies.length === 0) this.endWave();
  }

  /** Evento de la oleada: lo que le queda y los rayos de la tormenta. */
  private tickEvent(dt: number) {
    const ev = this.waveEvent;
    if (!ev) return;
    this.eventLeft -= dt;
    if (ev === 'tormenta') {
      this.stormCd -= dt;
      if (this.stormCd <= 0 && this.eventLeft > STORM_WARN) {
        this.stormCd = STORM_EVERY;
        // La mitad de las veces cae junto a una torre; si no, en el camino
        const road = this.map.paths.flatMap((p) => pathCells(p));
        const onTower = this.towers.length > 0 && this.rng() < 0.5;
        const c = onTower ? this.towers[Math.floor(this.rng() * this.towers.length)] : road[Math.floor(this.rng() * road.length)];
        const m: StormMark = { x: c.x + 0.5, y: c.y + 0.5, left: STORM_WARN };
        this.storms.push(m);
        this.events.push({ t: 'stormWarn', x: m.x, y: m.y, r: STORM_RADIUS, time: STORM_WARN });
      }
    }
    for (const m of [...this.storms]) {
      m.left -= dt;
      if (m.left > 0) continue;
      this.storms.splice(this.storms.indexOf(m), 1);
      this.events.push({ t: 'storm', x: m.x, y: m.y, r: STORM_RADIUS });
      for (const e of this.enemiesIn(m, STORM_RADIUS)) this.damage(e, stormDamage(this.wave), null, { type: 'electric', mul: 1, crit: false, special: false, splash: 0 });
      const hitT = this.towersIn(m, STORM_RADIUS);
      for (const t of hitT) t.stunned = Math.max(t.stunned, STORM_STUN);
      if (hitT.length) this.events.push({ t: 'stun', towerIds: hitT.map((t) => t.id), x: m.x, y: m.y, r: STORM_RADIUS });
    }
    if (this.eventLeft <= 0 && Number.isFinite(this.eventLeft)) {
      this.events.push({ t: 'eventEnd', id: ev });
      this.waveEvent = null;
      this.storms = [];
    }
  }

  /** Jefes de oleada: avisan su habilidad y, al acabar el aviso, la hacen. */
  private tickChiefs(dt: number) {
    for (const e of [...this.enemies]) {
      if (e.def.kind !== 'chief' || e.frozen > 0) continue;
      if (e.rush > 0) e.rush -= dt;
      if (e.warn) {
        e.warn.left -= dt;
        if (e.warn.left <= 0) this.chiefAct(e, e.warn);
        continue;
      }
      e.skillCd -= dt;
      if (e.skillCd > 0) continue;
      const active = e.skills.filter((k) => CHIEF_SKILL_INFO[k].warn > 0);
      if (!active.length) {
        e.skillCd = CHIEF_GAP;
        continue;
      }
      const skill = active[e.skillIdx % active.length];
      let x = e.x;
      let y = e.y;
      let r = 0.8;
      if (skill === 'aturdir') {
        const near = this.towers.filter((t) => Math.hypot(t.x + 0.5 - e.x, t.y + 0.5 - e.y) <= STUN_REACH).map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 }));
        const best = densestPoint(near, STUN_RADIUS);
        if (!best) {
          // Sin torres cerca: lo intenta otra vez enseguida
          e.skillCd = 1;
          continue;
        }
        [x, y, r] = [best.x, best.y, STUN_RADIUS];
      }
      e.skillIdx++;
      const time = CHIEF_SKILL_INFO[skill].warn;
      e.warn = { skill, left: time, total: time, x, y, r, hp0: e.hp + e.shield };
      this.events.push({ t: 'chiefWarn', id: e.id, skill, x, y, r, time });
    }
  }

  private chiefAct(e: TdEnemy, w: ChiefWarn) {
    e.warn = null;
    e.skillCd = CHIEF_GAP;
    let ok = true;
    if (w.skill === 'aturdir') {
      const hit = this.towersIn(w, w.r);
      for (const t of hit) t.stunned = Math.max(t.stunned, STUN_TIME);
      if (hit.length) this.events.push({ t: 'stun', towerIds: hit.map((t) => t.id), x: w.x, y: w.y, r: w.r });
    } else if (w.skill === 'invocar') {
      this.summonBehind(e, 3, ['fast', 'normal', 'fast']);
    } else if (w.skill === 'curar') {
      ok = w.hp0 - (e.hp + e.shield) < e.def.maxHp * CHIEF_HEAL_BREAK;
      if (ok) {
        const amount = Math.min(e.def.maxHp - e.hp, Math.ceil(e.def.maxHp * CHIEF_HEAL));
        e.hp += amount;
        this.events.push({ t: 'heal', x: e.x, y: e.y, amount });
      }
    } else if (w.skill === 'acelerar') {
      e.rush = RUSH_TIME;
    }
    this.events.push({ t: 'chiefSkill', id: e.id, skill: w.skill, x: w.x, y: w.y, r: w.r, ok });
  }

  /** Esbirros que salen de detrás de un jefe, por su mismo camino. */
  private summonBehind(e: TdEnemy, n: number, kinds: ('fast' | 'normal' | 'healer')[]) {
    const foes = MAP_FOES[this.map.biome] ?? MAP_FOES.bosque;
    for (let i = 0; i < n; i++) {
      const kind = kinds[i % kinds.length];
      const species = foes[kind][0];
      const def = enemyDef(kind, species, this.wave, stagePower(this.stage));
      const minion = this.spawn({ at: 0, kind, species, path: 0 }, 0, def);
      minion.pts = e.pts;
      minion.len = e.len;
      minion.dist = Math.max(0, e.dist - 0.4 - i * 0.5);
      const p = pointAt(minion.pts, minion.dist);
      [minion.x, minion.y] = [p.x, p.y];
    }
  }

  private moveEnemies(dt: number) {
    // Aceleradores: los de alrededor van más rápido un momento
    for (const e of this.enemies) {
      if (e.def.kind !== 'hastener' || e.frozen > 0) continue;
      for (const o of this.enemies) if (o !== e && Math.hypot(o.x - e.x, o.y - e.y) <= HASTE_RANGE) o.haste = 0.4;
    }
    for (const e of [...this.enemies]) {
      if (e.def.kind === 'healer' && e.frozen <= 0) {
        e.healCd -= dt;
        if (e.healCd <= 0) {
          e.healCd = HEAL_EVERY;
          for (const o of this.enemies) {
            if (o === e || o.hp >= o.def.maxHp || Math.hypot(o.x - e.x, o.y - e.y) > HEAL_RANGE) continue;
            const amount = Math.min(o.def.maxHp - o.hp, Math.ceil(o.def.maxHp * (o.def.kind === 'boss' ? 0.03 : 0.12)));
            o.hp += amount;
            this.events.push({ t: 'heal', x: o.x, y: o.y, amount });
          }
        }
      }
      if (e.frozen > 0) {
        e.frozen -= dt;
        continue;
      }
      let speed = e.def.speed;
      if (e.slowLeft > 0) {
        speed *= e.slowMul;
        e.slowLeft -= dt;
      }
      if (e.haste > 0) {
        speed *= HASTE_MUL;
        e.haste -= dt;
      }
      if (e.def.kind === 'boss' && e.phase >= 3) speed *= 1.25;
      if (e.rush > 0) speed *= RUSH_MUL;
      if (this.waveEvent === 'veloces') speed *= FAST_MUL;
      e.dist += speed * dt;
      if (e.dist >= e.len) {
        this.removeEnemy(e);
        this.hp = Math.max(0, this.hp - e.def.leak);
        this.leakedThisWave = true;
        this.events.push({ t: 'leak', x: e.x, y: e.y, dmg: e.def.leak });
        if (this.hp <= 0) {
          this.phase = 'lost';
          this.events.push({ t: 'lost' });
          return;
        }
        continue;
      }
      const p = pointAt(e.pts, e.dist);
      e.x = p.x;
      e.y = p.y;
      e.dx = p.dx;
      e.dy = p.dy;
    }
  }

  private removeEnemy(e: TdEnemy) {
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
  }

  private canHit(s: TowerStats, e: TdEnemy) {
    return !e.def.air || s.air;
  }

  private pickTarget(t: TdTower, s: TowerStats): TdEnemy | null {
    const cx = t.x + 0.5;
    const cy = t.y + 0.5;
    let best: TdEnemy | null = null;
    let score = -Infinity;
    for (const e of this.enemies) {
      if (!this.canHit(s, e) || Math.hypot(e.x - cx, e.y - cy) > s.range) continue;
      const v = t.targeting === 'strong' ? e.hp + e.shield : t.targeting === 'last' ? -e.dist / e.len : e.dist / e.len;
      if (v > score) {
        score = v;
        best = e;
      }
    }
    return best;
  }

  private fireTowers(dt: number) {
    for (const t of this.towers) {
      if (t.stunned > 0) continue;
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;
      const s = this.statsOf(t);
      const target = this.pickTarget(t, s);
      if (!target) {
        t.cooldown = 0;
        continue;
      }
      t.cooldown = 1 / s.rate;
      t.shots++;
      const special = s.specialEvery > 0 && t.shots % s.specialEvery === 0;
      const cx = t.x + 0.5;
      const cy = t.y + 0.5;
      t.facing = Math.atan2(target.y - cy, target.x - cx);
      const { type } = bestTypeMul(t.mon.types, target.def.types);
      const shot: TdShot = {
        id: this.nextId++, towerId: t.id, targetId: target.id, x: cx, y: cy, tx: target.x, ty: target.y, type, types: t.mon.types,
        damage: s.damage * (special ? 3 : 1), special, stats: s,
      };
      this.shots.push(shot);
      this.events.push({ t: 'fire', towerId: t.id, shotId: shot.id, special });
    }
  }

  private moveShots(dt: number) {
    for (const sh of [...this.shots]) {
      const target = this.enemies.find((e) => e.id === sh.targetId);
      if (target) {
        sh.tx = target.x;
        sh.ty = target.y;
      }
      const d = Math.hypot(sh.tx - sh.x, sh.ty - sh.y);
      const step = SHOT_SPEED * dt;
      if (d > step) {
        sh.x += ((sh.tx - sh.x) / d) * step;
        sh.y += ((sh.ty - sh.y) / d) * step;
        continue;
      }
      this.shots.splice(this.shots.indexOf(sh), 1);
      this.impact(sh, target ?? null);
    }
  }

  private impact(sh: TdShot, target: TdEnemy | null) {
    const s = sh.stats;
    const tower = this.towers.find((t) => t.id === sh.towerId) ?? null;
    const splash = sh.special ? Math.max(s.splash, 1.2) : s.splash;
    const crit = this.rng() < s.crit;
    const air = target ? target.def.air : false;
    if (target) {
      const { mul, type } = bestTypeMul(sh.types, target.def.types);
      this.damage(target, sh.damage * mul * (crit ? 2 : 1), tower, { type, mul, crit, special: sh.special, splash });
      if (s.slowTime > 0) {
        target.slowMul = Math.min(target.slowLeft > 0 ? target.slowMul : 1, s.slow);
        target.slowLeft = Math.max(target.slowLeft, target.def.kind === 'boss' ? s.slowTime / 2 : s.slowTime);
      }
      // Reliquia Escarcha: cada golpe frena un poco
      if (this.relics.frost < 1 && this.enemies.includes(target)) {
        target.slowMul = Math.min(target.slowLeft > 0 ? target.slowMul : 1, this.relics.frost);
        target.slowLeft = Math.max(target.slowLeft, 0.8);
      }
    }
    if (splash > 0) {
      for (const e of [...this.enemies]) {
        if (e === target || e.def.air !== air || (e.def.air && !s.air) || Math.hypot(e.x - sh.tx, e.y - sh.ty) > splash) continue;
        const { mul, type } = bestTypeMul(sh.types, e.def.types);
        this.damage(e, sh.damage * 0.6 * mul, tower, { type, mul, crit: false, special: false, splash: 0 });
      }
    }
    if (s.chain > 0 && target) {
      const hit = new Set<number>([target.id]);
      const pts = [{ x: target.x, y: target.y }];
      let from = { x: target.x, y: target.y };
      let dmg = sh.damage * 0.7;
      for (let k = 0; k < s.chain + (sh.special ? 2 : 0); k++) {
        let next: TdEnemy | null = null;
        let nd = 1.9;
        for (const e of this.enemies) {
          if (hit.has(e.id) || !this.canHit(s, e)) continue;
          const d = Math.hypot(e.x - from.x, e.y - from.y);
          if (d < nd) {
            nd = d;
            next = e;
          }
        }
        if (!next) break;
        hit.add(next.id);
        pts.push({ x: next.x, y: next.y });
        from = { x: next.x, y: next.y };
        const { mul, type } = bestTypeMul(sh.types, next.def.types);
        this.damage(next, dmg * mul, tower, { type, mul, crit: false, special: false, splash: 0 });
        dmg *= 0.7;
      }
      if (pts.length > 1) this.events.push({ t: 'chain', pts, type: sh.type });
    }
  }

  private damage(e: TdEnemy, raw: number, tower: TdTower | null, o: { type: string; mul: number; crit: boolean; special: boolean; splash: number }) {
    if (!this.enemies.includes(e)) return;
    let dmg = Math.max(1, Math.round(raw));
    const hadShield = e.shield > 0;
    if (hadShield) {
      const r = absorbShieldHit(e.shield, dmg);
      e.shield = r.left;
      dmg = r.through;
      if (e.shield <= 0) this.events.push({ t: 'shieldBreak', x: e.x, y: e.y });
    }
    e.hp -= dmg;
    this.events.push({ t: 'hit', x: e.x, y: e.y, dmg: Math.max(1, Math.round(raw)), mul: o.mul, crit: o.crit, type: o.type, special: o.special, shielded: hadShield, enemyId: e.id, splash: o.splash });
    if (e.def.kind === 'boss' && e.hp > 0) this.bossPhases(e);
    if (e.def.kind === 'chief' && e.hp > 0) this.chiefPhases(e);
    if (e.hp <= 0) {
      this.removeEnemy(e);
      const chief = e.def.kind === 'chief';
      let mul = this.relics.bounty;
      if (this.waveEvent === 'veloces') mul *= FAST_BOUNTY;
      if (this.waveEvent === 'monedas') mul *= COIN_BOUNTY;
      const money = Math.round(e.def.bounty * mul) + (chief ? chiefMoney(this.wave) : 0);
      this.money += money;
      this.kills++;
      if (chief) this.chiefsBeaten++;
      if (tower) tower.kills++;
      this.events.push({ t: 'kill', x: e.x, y: e.y, money, boss: e.def.kind === 'boss', chief, species: e.def.species, air: e.def.air });
    }
  }

  /** Jefe de oleada con Coraza: escudo al bajar del 66 % y del 33 %. */
  private chiefPhases(e: TdEnemy) {
    const r = e.hp / e.def.maxHp;
    const want = r <= 0.33 ? 3 : r <= 0.66 ? 2 : 1;
    while (e.phase < want) {
      e.phase++;
      if (!e.skills.includes('escudo')) continue;
      e.maxShield = Math.round(e.def.maxHp * CHIEF_SHIELD);
      e.shield = e.maxShield;
      this.events.push({ t: 'chiefSkill', id: e.id, skill: 'escudo', x: e.x, y: e.y, r: 0.8, ok: true });
    }
  }

  /** Jefe legendario: al 66 % llama a su escolta y al 33 % recupera el escudo y acelera. */
  private bossPhases(e: TdEnemy) {
    const r = e.hp / e.def.maxHp;
    const want = r <= 0.33 ? 3 : r <= 0.66 ? 2 : 1;
    while (e.phase < want) {
      e.phase++;
      this.events.push({ t: 'bossPhase', x: e.x, y: e.y, phase: e.phase });
      if (e.phase === 2) {
        const foes = MAP_FOES[this.map.biome] ?? MAP_FOES.bosque;
        for (let i = 0; i < 3; i++) {
          const kind = i === 1 ? 'healer' : 'fast';
          const species = kind === 'healer' ? foes.healer[0] : foes.fast[0];
          const def = enemyDef(kind, species, this.wave, stagePower(this.stage));
          const minion = this.spawn({ at: 0, kind, species, path: 0 }, 0, def);
          // Sale de detrás del jefe, por su mismo camino
          minion.pts = e.pts;
          minion.len = e.len;
          minion.dist = Math.max(0, e.dist - 0.4 - i * 0.5);
        }
      } else if (e.phase === 3) {
        e.maxShield = Math.round(e.def.maxHp * 0.25);
        e.shield = e.maxShield;
      }
    }
  }

  /** Resultado para el guardado. */
  outcome() {
    return { waves: this.cleared, won: this.phase === 'won', hp: this.hp, maxHp: this.maxHp, chiefs: this.chiefsBeaten };
  }
}
