// Defensa de torres: un jugador automático sencillo para los tests de equilibrio (y para ver partidas de prueba).
// Coloca torres en las casillas que más camino cubren y las mejora. Lógica pura, sin Phaser.
import { buildableCells, pathCells, type Cell } from './maps.ts';
import type { TdGame } from './engine.ts';
import { towerCost, towerStats } from './towers.ts';

export interface BotOptions {
  /** Si mejora torres (si no, solo coloca de nivel 1). */
  upgrades: boolean;
  /** Si usa las habilidades. */
  abilities: boolean;
}

/** Casillas ordenadas por cuánto camino cubren (radio 2,8). */
export function rankCells(game: TdGame): Cell[] {
  const road = game.map.paths.flatMap((p) => pathCells(p));
  const score = (c: Cell) => road.filter((r) => Math.hypot(r.x - c.x, r.y - c.y) <= 2.8).length;
  return buildableCells(game.map).sort((a, b) => score(b) - score(a));
}

export function botStep(game: TdGame, cells: Cell[], o: BotOptions) {
  if (game.over) return;
  if (o.abilities) {
    if (game.enemies.length >= 6) game.useAbility('rayo');
    if (game.enemies.some((e) => e.def.kind === 'boss') || game.enemies.length >= 12) game.useAbility('ventisca');
    if (game.hp <= game.maxHp * 0.6) game.useAbility('curar');
  }
  const hasAir = game.towers.some((t) => game.statsOf(t).air);
  // Sin torres anti-aéreas: primero una que alcance voladores
  const order = game.team
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      const sa = towerStats(a.m, 1, null);
      const sb = towerStats(b.m, 1, null);
      if (!hasAir && sa.air !== sb.air) return sa.air ? -1 : 1;
      return game.placedOf(a.i) - game.placedOf(b.i) || towerCost(a.m) - towerCost(b.m);
    });
  // Mejorar antes que colocar más cuando ya hay bastantes torres
  if (o.upgrades && game.towers.length >= 4) {
    const t = [...game.towers].sort((a, b) => a.level - b.level)[0];
    const r = game.upgrade(t.id, hasAir ? 'a' : 'b');
    if (r === 'ok' || r === 'poor') return;
  }
  for (const { i } of order) {
    const cell = cells.find((c) => !game.placeError(i, c.x, c.y));
    if (cell) {
      game.place(i, cell.x, cell.y);
      return;
    }
  }
}

/** Juega una partida entera (llama a cada oleada en cuanto puede). Devuelve el juego al acabar. */
export function autoplay(game: TdGame, o: BotOptions, maxSeconds = 4000): TdGame {
  const cells = rankCells(game);
  let t = 0;
  while (!game.over && t < maxSeconds) {
    for (let k = 0; k < 4; k++) botStep(game, cells, o);
    if (game.phase === 'prep' && game.prepLeft < prepSkip(game)) game.callNextWave();
    game.step(0.25);
    game.drainEvents();
    t += 0.25;
  }
  return game;
}

const prepSkip = (game: TdGame) => (game.wave === 0 ? 20 : 8);
