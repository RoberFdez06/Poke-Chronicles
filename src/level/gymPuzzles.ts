// T86: gimnasios con puzzles. Antes del líder (jefe de fin de bioma y cada 10 pisos de la Torre) hay un puzzle del tipo
// del gimnasio que abre el paso. Lógica pura y determinista por semilla: todo puzzle generado tiene solución (se comprueba
// con un solucionador BFS y, si el azar no da uno bueno, se cae en uno fijo resoluble).
import { mulberry32 } from './floorGen.ts';

export type GymPuzzleKind = 'roca' | 'electrico' | 'hielo' | 'fantasma';

export const GYM_PUZZLE_LABEL: Record<GymPuzzleKind, string> = {
  roca: 'Gimnasio Roca: empuja el bloque hasta la marca',
  electrico: 'Gimnasio Eléctrico: pulsa los interruptores en orden',
  hielo: 'Gimnasio Hielo: resbala hasta la salida',
  fantasma: 'Gimnasio Fantasma: encuentra la puerta de verdad',
};

/** Tipo de puzzle de cada bioma (los que no salen aquí usan el de la semilla). */
const BIOME_PUZZLE: Record<string, GymPuzzleKind> = {
  cueva: 'roca', volcan: 'roca', cumbre: 'roca',
  ciudad: 'electrico', bosque: 'electrico',
  nieve: 'hielo', mar: 'hielo',
  torre: 'fantasma', pantano: 'fantasma',
};
const KINDS: readonly GymPuzzleKind[] = ['roca', 'electrico', 'hielo', 'fantasma'];

export function gymPuzzleKind(biomeId: string, seed: number): GymPuzzleKind {
  return BIOME_PUZZLE[biomeId] ?? KINDS[(seed >>> 0) % KINDS.length];
}

/** Tickets por resolver el puzzle del gimnasio. */
export const GYM_PUZZLE_TICKETS = 3;

/** ¿Hay gimnasio antes de este jefe? Fin de bioma en Normal/Infinito y cada 10 pisos en la Torre. */
/** Puzzle del gimnasio antes del líder: apagado (el usuario prefiere ir directo al jefe). El código se conserva. */
export const GYM_PUZZLE_ENABLED = false;

export function hasGym(mode: string, roomKind: string, finale: boolean): boolean {
  if (finale || roomKind !== 'boss') return false;
  return mode === 'normal' || mode === 'endless' || mode === 'tower';
}

export interface Cell { x: number; y: number }
export type Dir = 'up' | 'down' | 'left' | 'right';
export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];
const DELTA: Record<Dir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/** Tablero: '#' pared/roca, '.' libre. */
export interface Board { w: number; h: number; walls: boolean[] }
export const isWall = (b: Board, x: number, y: number): boolean => x < 0 || y < 0 || x >= b.w || y >= b.h || b.walls[y * b.w + x];
const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

export const BOARD_W = 7;
export const BOARD_H = 5;

function randomBoard(rng: () => number, density: number): Board {
  const walls: boolean[] = [];
  for (let i = 0; i < BOARD_W * BOARD_H; i++) walls.push(rng() < density);
  return { w: BOARD_W, h: BOARD_H, walls };
}
function randomFree(b: Board, rng: () => number, avoid: Cell[]): Cell | null {
  const free: Cell[] = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (!isWall(b, x, y) && !avoid.some((c) => c.x === x && c.y === y)) free.push({ x, y });
  return free.length ? free[Math.floor(rng() * free.length)] : null;
}

// ---------------- Roca (empujar bloques) ----------------
export interface RockState { player: Cell; block: Cell }
export interface RockPuzzle { kind: 'roca'; board: Board; start: RockState; target: Cell; minMoves: number }

export function rockStep(b: Board, s: RockState, d: Dir): RockState {
  const v = DELTA[d];
  const np = { x: s.player.x + v.x, y: s.player.y + v.y };
  if (isWall(b, np.x, np.y)) return s;
  if (same(np, s.block)) {
    const nb = { x: s.block.x + v.x, y: s.block.y + v.y };
    if (isWall(b, nb.x, nb.y)) return s;
    return { player: np, block: nb };
  }
  return { player: np, block: s.block };
}
export const rockSolved = (p: RockPuzzle, s: RockState): boolean => same(s.block, p.target);

/** Movimientos mínimos (BFS) o -1 si no tiene solución. */
export function solveRock(b: Board, start: RockState, target: Cell): number {
  const key = (s: RockState) => `${s.player.x},${s.player.y},${s.block.x},${s.block.y}`;
  const seen = new Set([key(start)]);
  let frontier = [start];
  for (let depth = 0; frontier.length; depth++) {
    const next: RockState[] = [];
    for (const s of frontier) {
      if (same(s.block, target)) return depth;
      for (const d of DIRS) {
        const n = rockStep(b, s, d);
        const k = key(n);
        if (!seen.has(k)) { seen.add(k); next.push(n); }
      }
    }
    frontier = next;
  }
  return -1;
}

function genRock(rng: () => number): RockPuzzle {
  for (let tries = 0; tries < 200; tries++) {
    const board = randomBoard(rng, 0.18);
    const block = randomFree(board, rng, []);
    if (!block || block.x === 0 || block.y === 0 || block.x === board.w - 1 || block.y === board.h - 1) continue;
    const player = randomFree(board, rng, [block]);
    const target = randomFree(board, rng, [block, ...(player ? [player] : [])]);
    if (!player || !target) continue;
    const start = { player, block };
    const minMoves = solveRock(board, start, target);
    if (minMoves >= 4) return { kind: 'roca', board, start, target, minMoves };
  }
  const board: Board = { w: BOARD_W, h: BOARD_H, walls: new Array(BOARD_W * BOARD_H).fill(false) };
  const start = { player: { x: 1, y: 2 }, block: { x: 2, y: 2 } };
  const target = { x: 5, y: 2 };
  return { kind: 'roca', board, start, target, minMoves: solveRock(board, start, target) };
}

// ---------------- Hielo (suelo que resbala) ----------------
export interface IcePuzzle { kind: 'hielo'; board: Board; start: Cell; goal: Cell; minMoves: number }

/** Resbala en una dirección hasta chocar o llegar a la salida. */
export function iceSlide(b: Board, from: Cell, d: Dir, goal: Cell): Cell {
  const v = DELTA[d];
  let c = from;
  while (!isWall(b, c.x + v.x, c.y + v.y)) {
    c = { x: c.x + v.x, y: c.y + v.y };
    if (same(c, goal)) break;
  }
  return c;
}
export function solveIce(b: Board, start: Cell, goal: Cell): number {
  const seen = new Set([`${start.x},${start.y}`]);
  let frontier = [start];
  for (let depth = 0; frontier.length; depth++) {
    const next: Cell[] = [];
    for (const c of frontier) {
      if (same(c, goal)) return depth;
      for (const d of DIRS) {
        const n = iceSlide(b, c, d, goal);
        const k = `${n.x},${n.y}`;
        if (!seen.has(k)) { seen.add(k); next.push(n); }
      }
    }
    frontier = next;
  }
  return -1;
}
function genIce(rng: () => number): IcePuzzle {
  for (let tries = 0; tries < 200; tries++) {
    const board = randomBoard(rng, 0.2);
    const start = randomFree(board, rng, []);
    const goal = start && randomFree(board, rng, [start]);
    if (!start || !goal) continue;
    const minMoves = solveIce(board, start, goal);
    if (minMoves >= 3) return { kind: 'hielo', board, start, goal, minMoves };
  }
  const walls = new Array(BOARD_W * BOARD_H).fill(false);
  walls[0 * BOARD_W + 4] = true;
  const board: Board = { w: BOARD_W, h: BOARD_H, walls };
  const start = { x: 0, y: 4 };
  const goal = { x: 3, y: 0 };
  return { kind: 'hielo', board, start, goal, minMoves: solveIce(board, start, goal) };
}

// ---------------- Eléctrico (interruptores en orden) ----------------
export interface ElectricPuzzle { kind: 'electrico'; count: number; order: number[] }
/** Pulsar un interruptor: avanza si es el siguiente; si no, se reinicia la secuencia. */
export function pressSwitch(p: ElectricPuzzle, progress: number, i: number): number {
  if (progress >= p.order.length) return progress;
  return p.order[progress] === i ? progress + 1 : 0;
}
export const electricSolved = (p: ElectricPuzzle, progress: number): boolean => progress >= p.order.length;
function genElectric(rng: () => number, tier: number): ElectricPuzzle {
  const count = Math.min(6, 4 + tier);
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { kind: 'electrico', count, order };
}

// ---------------- Fantasma (puertas falsas) ----------------
export type GhostClue = { kind: 'not'; door: number } | { kind: 'parity'; even: boolean } | { kind: 'side'; left: boolean };
export interface GhostPuzzle { kind: 'fantasma'; doors: number; real: number; clues: GhostClue[] }

const clueHolds = (c: GhostClue, door: number, doors: number): boolean =>
  c.kind === 'not' ? door !== c.door : c.kind === 'parity' ? (door % 2 === 0) === c.even : c.left ? door < doors / 2 : door >= doors / 2;

/** Puertas que cumplen todas las pistas (numeradas desde 0; en pantalla desde 1). */
export function ghostCandidates(p: Pick<GhostPuzzle, 'doors' | 'clues'>): number[] {
  return Array.from({ length: p.doors }, (_, d) => d).filter((d) => p.clues.every((c) => clueHolds(c, d, p.doors)));
}
export function ghostClueText(c: GhostClue): string {
  if (c.kind === 'not') return `No es la puerta ${c.door + 1}.`;
  if (c.kind === 'parity') return c.even ? 'Su número es impar.' : 'Su número es par.'; // en pantalla se cuenta desde 1
  return c.left ? 'Está en la mitad izquierda.' : 'Está en la mitad derecha.';
}
function genGhost(rng: () => number, tier: number): GhostPuzzle {
  const doors = Math.min(6, 4 + tier);
  const real = Math.floor(rng() * doors);
  const clues: GhostClue[] = [];
  const general: GhostClue[] = [{ kind: 'parity', even: real % 2 === 0 }, { kind: 'side', left: real < doors / 2 }];
  for (const c of general) if (rng() < 0.7) clues.push(c);
  const wrong = Array.from({ length: doors }, (_, d) => d).filter((d) => d !== real);
  for (let i = wrong.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [wrong[i], wrong[j]] = [wrong[j], wrong[i]];
  }
  for (const d of wrong) {
    if (ghostCandidates({ doors, clues }).length === 1) break;
    if (clues.every((c) => clueHolds(c, d, doors))) clues.push({ kind: 'not', door: d });
  }
  return { kind: 'fantasma', doors, real, clues };
}

// ---------------- Generador ----------------
export type GymPuzzle = RockPuzzle | IcePuzzle | ElectricPuzzle | GhostPuzzle;

/** Puzzle del gimnasio: mismo resultado para la misma semilla, tipo y nivel (0..2, sube con el piso). */
export function generateGymPuzzle(kind: GymPuzzleKind, seed: number, tier = 0): GymPuzzle {
  const rng = mulberry32((seed ^ 0x6a09e667) >>> 0);
  const t = Math.max(0, Math.min(2, Math.floor(tier)));
  if (kind === 'roca') return genRock(rng);
  if (kind === 'hielo') return genIce(rng);
  if (kind === 'electrico') return genElectric(rng, t);
  return genGhost(rng, t);
}

/** Nivel del puzzle según el piso (sube cada 10 pisos de Torre o cada 2 jefes de bioma). */
export const gymTier = (mode: string, floor: number): number =>
  Math.min(2, Math.floor(Math.max(0, floor - 1) / (mode === 'tower' ? 20 : 2)));

/** ¿Tiene solución? (lo usan los tests y el generador). */
export function isSolvable(p: GymPuzzle): boolean {
  if (p.kind === 'roca') return solveRock(p.board, p.start, p.target) >= 1;
  if (p.kind === 'hielo') return solveIce(p.board, p.start, p.goal) >= 1;
  if (p.kind === 'electrico') return [...p.order].sort((a, b) => a - b).every((v, i) => v === i);
  const c = ghostCandidates(p);
  return c.length === 1 && c[0] === p.real;
}
