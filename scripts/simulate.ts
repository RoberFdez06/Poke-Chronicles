// Simulación del equilibrio con la lógica pura del juego (sin navegador).
//   node scripts/simulate.ts
// Saca, por piso y por partida Normal completa: tickets, monedas de partida y bayas medias, la vida y el daño de
// enemigos y jefes, y cuánto tarda un personaje normal sin mejoras en vencer a un jefe.
import { expectedFloorRewards, expectedRunRewards, averageCombatRooms, simulateRuns } from '../src/data/balance.ts';
import { difficultyFor, FLOOR_COUNT } from '../src/level/progression.ts';
import { enemyStats } from '../src/data/enemies.ts';
import { bossStats, AVERAGE_STATS } from '../src/data/pokeStats.ts';
import { BASE_STATS } from '../src/data/items.ts';
import { PULL_COST } from '../src/data/gacha.ts';

const fmt = (n: number) => n.toFixed(1).padStart(7);
console.log('Piso   salas  tickets  monedas  bayas  PS enemigo  daño enemigo  PS jefe  daño jefe  s jefe');
// DPS de un personaje normal sin objetos: disparo base (y un poder de potencia 60 cada ~1,1 s), acertando el 70 %
const dps = (BASE_STATS.damage / (BASE_STATS.fireDelay / 1000) + (60 * 0.5 * 1.2) / 1.08) * 0.7;
for (let f = 1; f <= FLOOR_COUNT; f++) {
  const rooms = averageCombatRooms(f);
  const r = expectedFloorRewards(f, rooms);
  const d = difficultyFor(f);
  const foe = enemyStats(300, 'chase', d);
  const boss = bossStats(AVERAGE_STATS, d);
  console.log(
    `${String(f).padStart(4)} ${fmt(rooms)} ${fmt(r.tickets)} ${fmt(r.coins)} ${fmt(r.berries)} ${fmt(foe.hp)}    ${fmt(foe.damage)}     ${fmt(boss.hp)} ${fmt(boss.damage)} ${fmt(boss.hp / dps)}`,
  );
}
const run = expectedRunRewards(FLOOR_COUNT);
console.log(`\nPartida Normal completa: ${run.tickets.toFixed(0)} tickets (${(run.tickets / PULL_COST).toFixed(2)} tiradas), ${run.coins.toFixed(0)} monedas, ${run.berries.toFixed(1)} bayas`);
const good = expectedRunRewards(3);
console.log(`Partida que llega al piso 3: ${good.tickets.toFixed(0)} tickets, ${good.coins.toFixed(0)} monedas, ${good.berries.toFixed(1)} bayas`);
console.log(`DPS supuesto del jugador: ${dps.toFixed(1)}`);

// --- Partidas simuladas (T25): tiempo y daño por sala, cuántos llegan a cada piso ---
const sim = simulateRuns(2000, 7);
console.log('\nSimulación de 2000 partidas Normal (modelo en balance.ts, SIM_DEFAULTS):');
console.log('Piso  llegan  superan   s/sala  daño/sala   PS ante jefe   s jefe  daño jefe');
for (const f of sim.floors) {
  const pct = (n: number) => `${(n * 100).toFixed(0)} %`.padStart(7);
  console.log(
    `${String(f.floor).padStart(4)} ${pct(f.reached)} ${pct(f.cleared)} ${fmt(f.roomSeconds)}  ${fmt(f.roomDamage)}        ${fmt(f.hpAtBoss)} ${fmt(f.bossSeconds)}  ${fmt(f.bossDamage)}`,
  );
}
console.log(`Media por partida: ${sim.tickets.toFixed(1)} tickets, ${sim.coins.toFixed(0)} monedas gastables, ${sim.minutes.toFixed(1)} min de juego`);
