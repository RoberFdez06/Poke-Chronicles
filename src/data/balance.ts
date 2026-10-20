// Cuentas del equilibrio: premios esperados por piso y por partida a partir de las constantes del juego.
// Lo usan los tests (para fijar los rangos) y scripts/simulate.ts. Lógica pura.
import { BOSS_TICKETS, ROOM_TICKETS } from './save.ts';
import { BERRIES, centerHeal, CLEAR_DROP_CHANCE, LOOT_CHANCE, POTIONS, roomClearCoins, SHOP_PRICES } from './loot.ts';
import { BASE_STATS } from './items.ts';
import { BEHAVIORS, EXTRA_BEHAVIORS, enemyBstRange, enemyStats } from './enemies.ts';
import { AVERAGE_STATS, bossStats } from './pokeStats.ts';
import { bossTicketsFor, difficultyFor, FLOOR_COUNT, minibossTicketsFor, roomCountFor, roomTicketsFor } from '../level/progression.ts';
import { FINALE_BONUS } from './finale.ts';
import { generateFloor, mulberry32 } from '../level/floorGen.ts';

/** Media de salas de combate (incluida la de desafío) de un piso, con varias semillas. */
export function averageCombatRooms(floor: number, seeds = 60): number {
  let total = 0;
  for (let i = 0; i < seeds; i++) {
    const rng = mulberry32(floor * 1000 + i);
    const f = generateFloor({ seed: floor * 7919 + i * 104729, roomCount: roomCountFor(floor, rng), special: true, extra: true });
    total += f.rooms.filter((r) => r.kind === 'combat' || r.kind === 'challenge').length;
  }
  return total / seeds;
}

/** Monedas de partida que suelta de media un enemigo normal. */
export const coinsPerEnemy = (): number => LOOT_CHANCE.coin * (LOOT_CHANCE.bigCoin * 5 + (1 - LOOT_CHANCE.bigCoin) * 1);
export const berriesPerEnemy = (): number => LOOT_CHANCE.aranja + LOOT_CHANCE.zidra;

/** Monedas medias al limpiar una sala del piso (media de las tres tiradas posibles). */
const avgRoomClearCoins = (floor: number) => (roomClearCoins(() => 0, floor) + roomClearCoins(() => 0.5, floor) + roomClearCoins(() => 0.99, floor)) / 3;

export interface Rewards {
  tickets: number;
  coins: number;
  berries: number;
}

/** Lo que se gana de media en un piso de Normal limpiándolo entero (salas de combate, minijefe y jefe). */
export function expectedFloorRewards(floor: number, combatRooms = averageCombatRooms(floor)): Rewards {
  const [lo, hi] = difficultyFor(floor).enemies;
  const enemies = combatRooms * ((lo + hi) / 2);
  return {
    tickets: combatRooms * roomTicketsFor(floor) + minibossTicketsFor(floor) + bossTicketsFor(floor),
    coins: enemies * coinsPerEnemy() + combatRooms * avgRoomClearCoins(floor) + BOSS_COINS_DROP,
    // El jefe siempre suelta una Baya Zidra
    berries: enemies * berriesPerEnemy() + 1,
  };
}

/** Monedas que suelta el jefe (ver rollEnemyLoot). */
export const BOSS_COINS_DROP = 5;

/** Premios medios de una partida Normal que llega hasta el piso `floors` limpiándolo todo. */
export function expectedRunRewards(floors: number): Rewards {
  const out: Rewards = { tickets: 0, coins: 0, berries: 0 };
  for (let f = 1; f <= floors; f++) {
    const r = expectedFloorRewards(f);
    out.tickets += r.tickets;
    out.coins += r.coins;
    out.berries += r.berries;
  }
  return out;
}

/** Tickets de una partida Normal que supera también el reto final (piso 6: su jefe y el premio). */
export function expectedFinaleRunTickets(): number {
  return expectedRunRewards(FLOOR_COUNT).tickets + bossTicketsFor(FLOOR_COUNT + 1) + FINALE_BONUS;
}

/** Para el informe: las constantes base. */
export const TICKET_CONSTANTS = { ROOM_TICKETS, BOSS_TICKETS };

// --- Simulación de partidas (T25) ---
// Modelo sencillo para comparar pisos y ver el efecto de cambiar números, no para predecir segundos exactos:
// el jugador mata a los enemigos de uno en uno con un DPS fijo (que sube con cada objeto) y, mientras quedan
// vivos, cada uno le acierta de vez en cuando. Se cura con bayas, el Centro (si lo hay) y pociones de la tienda.

export interface SimParams {
  /** Golpes por segundo que acierta cada enemigo vivo (con la invulnerabilidad tras un golpe). */
  hitsPerSecond: number;
  /** Golpes por segundo del jefe (ataques con aviso: se esquivan más). */
  bossHitsPerSecond: number;
  /** DPS del jugador sin objetos (disparo base + un poder, acertando el 70 %). */
  baseDps: number;
  /** Cuánto sube el DPS con cada objeto que coge. */
  itemDpsGain: number;
  /** Segundos por sala que no son pelear (entrar, recoger, ir a la puerta). */
  walkSeconds: number;
  maxHp: number;
}

export const SIM_DEFAULTS: SimParams = {
  hitsPerSecond: 0.035,
  bossHitsPerSecond: 0.07,
  baseDps: (BASE_STATS.damage / (BASE_STATS.fireDelay / 1000) + (60 * 0.5 * 1.2) / 1.08) * 0.7,
  itemDpsGain: 0.12,
  walkSeconds: 4,
  maxHp: BASE_STATS.maxHp,
};

export interface FloorSim {
  floor: number;
  /** Partidas (de 0 a 1) que llegan a este piso. */
  reached: number;
  /** Partidas que lo completan (vencen al jefe). */
  cleared: number;
  roomSeconds: number;
  roomDamage: number;
  bossSeconds: number;
  bossDamage: number;
  /** PS al llegar al jefe (de las partidas que llegan). */
  hpAtBoss: number;
}

export interface RunSim {
  floors: FloorSim[];
  tickets: number;
  coins: number;
  minutes: number;
}

/** Simula `runs` partidas Normal con la lógica del juego (dificultad, estadísticas, botín y salas de cada piso). */
export function simulateRuns(runs: number, seed = 1, p: SimParams = SIM_DEFAULTS, floors = FLOOR_COUNT): RunSim {
  const rng = mulberry32(seed);
  const between = (a: number, b: number) => a + rng() * (b - a);
  const acc = Array.from({ length: floors }, (_, k) => ({
    floor: k + 1, reached: 0, cleared: 0, roomSeconds: 0, roomDamage: 0, rooms: 0, bossSeconds: 0, bossDamage: 0, hpAtBoss: 0, bosses: 0,
  }));
  let tickets = 0;
  let coinsTotal = 0;
  let seconds = 0;
  for (let run = 0; run < runs; run++) {
    let hp = p.maxHp;
    let items = 0;
    let alive = true;
    for (let f = 1; f <= floors && alive; f++) {
      const a = acc[f - 1];
      a.reached++;
      const d = difficultyFor(f);
      const [blo, bhi] = enemyBstRange(f);
      const floor = generateFloor({ seed: Math.floor(rng() * 2 ** 31), roomCount: roomCountFor(f, rng), special: true, extra: true });
      const combat = floor.rooms.filter((r) => r.kind === 'combat' || r.kind === 'challenge').length;
      let coins = 0;
      let centerLeft = floor.centerId !== undefined;
      const hasShop = floor.shopId !== undefined;
      // Tesoro del piso
      items++;
      const heal = (n: number) => (hp = Math.min(p.maxHp, hp + n));
      const tryHeal = () => {
        if (centerLeft && hp < p.maxHp * 0.5) {
          heal(centerHeal(p.maxHp));
          centerLeft = false;
        }
        if (hasShop && hp < p.maxHp * 0.6 && coins >= SHOP_PRICES.superpocion) {
          coins -= SHOP_PRICES.superpocion;
          heal(POTIONS.superpocion.heal);
        }
      };
      for (let r = 0; r < combat && alive; r++) {
        const n = Math.round(between(d.enemies[0], d.enemies[1]));
        const dps = p.baseDps * (1 + p.itemDpsGain * items);
        let t = 0;
        let dmg = 0;
        for (let k = 0; k < n; k++) {
          // T51: también los comportamientos nuevos (como mucho un 35 % de la sala desde el piso 5)
          const behavior = f >= 2 && rng() < Math.min(0.35, (f - 1) * 0.09) ? EXTRA_BEHAVIORS[Math.floor(rng() * EXTRA_BEHAVIORS.length)] : BEHAVIORS[Math.floor(rng() * BEHAVIORS.length)];
          const e = enemyStats(between(blo, bhi), behavior, d);
          const dt = e.hp / dps;
          t += dt;
          // Los que quedan vivos (este incluido) pegan mientras tanto
          dmg += (n - k) * p.hitsPerSecond * dt * e.damage * between(0.5, 1.5);
          if (rng() < LOOT_CHANCE.aranja) heal(BERRIES.aranja.heal);
          if (rng() < LOOT_CHANCE.zidra) heal(BERRIES.zidra.heal);
          if (hasShop && rng() < LOOT_CHANCE.coin) coins += rng() < LOOT_CHANCE.bigCoin ? 5 : 1;
        }
        hp -= dmg;
        a.roomSeconds += t + p.walkSeconds;
        a.roomDamage += dmg;
        a.rooms++;
        seconds += t + p.walkSeconds;
        if (hp <= 0) {
          alive = false;
          break;
        }
        tickets += roomTicketsFor(f);
        // El minijefe está en una de las salas de combate (la más lejana: la última que se limpia)
        if (r === combat - 1) tickets += minibossTicketsFor(f);
        if (hasShop) coins += roomClearCoins(rng, f);
        if (rng() < CLEAR_DROP_CHANCE) items++;
        tryHeal();
      }
      if (!alive) break;
      tryHeal();
      // Jefe
      a.hpAtBoss += hp;
      const boss = bossStats(AVERAGE_STATS, d);
      const bt = boss.hp / (p.baseDps * (1 + p.itemDpsGain * items));
      const bdmg = p.bossHitsPerSecond * bt * boss.damage * between(0.5, 1.5);
      hp -= bdmg;
      a.bossSeconds += bt;
      a.bossDamage += bdmg;
      a.bosses++;
      seconds += bt;
      if (hp <= 0) {
        alive = false;
        break;
      }
      a.cleared++;
      tickets += bossTicketsFor(f);
      heal(BERRIES.zidra.heal);
      items++;
      coinsTotal += coins;
    }
  }
  return {
    floors: acc.map((a) => ({
      floor: a.floor,
      reached: a.reached / runs,
      cleared: a.cleared / runs,
      roomSeconds: a.rooms ? a.roomSeconds / a.rooms : 0,
      roomDamage: a.rooms ? a.roomDamage / a.rooms : 0,
      bossSeconds: a.bosses ? a.bossSeconds / a.bosses : 0,
      bossDamage: a.bosses ? a.bossDamage / a.bosses : 0,
      hpAtBoss: a.bosses ? a.hpAtBoss / a.bosses : 0,
    })),
    tickets: tickets / runs,
    coins: coinsTotal / runs,
    minutes: seconds / runs / 60,
  };
}
