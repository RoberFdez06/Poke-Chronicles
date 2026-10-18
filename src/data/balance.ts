// Cuentas del equilibrio: premios esperados por piso y por partida a partir de las constantes del juego.
// Lo usan los tests (para fijar los rangos) y scripts/simulate.ts. Lógica pura.
import { BOSS_TICKETS, ROOM_TICKETS } from './save.ts';
import { LOOT_CHANCE, roomClearCoins } from './loot.ts';
import { bossTicketsFor, difficultyFor, roomCountFor, roomTicketsFor } from '../level/progression.ts';
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

/** Lo que se gana de media en un piso de Normal limpiándolo entero (salas de combate y jefe). */
export function expectedFloorRewards(floor: number, combatRooms = averageCombatRooms(floor)): Rewards {
  const [lo, hi] = difficultyFor(floor).enemies;
  const enemies = combatRooms * ((lo + hi) / 2);
  return {
    tickets: combatRooms * roomTicketsFor(floor) + bossTicketsFor(floor),
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

/** Para el informe: las constantes base. */
export const TICKET_CONSTANTS = { ROOM_TICKETS, BOSS_TICKETS };
