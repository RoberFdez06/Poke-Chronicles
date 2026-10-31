// Caminos para enemigos y jefes (lógica pura, sin Phaser): rejilla de navegación de toda la zona de juego (salas
// grandes incluidas, con el pilar central de las 2x2 y cualquier bloque sólido), campo de distancias desde el jugador,
// línea de visión contra rectángulos y qué ataques de jefe tienen sentido sin visión o fuera de alcance.
// Con extensión .ts para que los tests (node --test) puedan importarlo sin bundler.

export interface P { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }
export interface Area { x0: number; y0: number; x1: number; y1: number }

/** Tamaño de casilla de la rejilla de navegación (px) y holguras: enemigos normales y grandes (jefes, minijefes). */
export const NAV_CELL = 32;
export const NAV_R_SMALL = 18;
export const NAV_R_BIG = 40;

export interface Nav {
  x0: number;
  y0: number;
  cell: number;
  cols: number;
  rows: number;
  /** 1 = no cabe un cuerpo de la holgura con la que se construyó. */
  blocked: Uint8Array;
}

/**
 * Rejilla: una casilla está bloqueada si su centro cae dentro de un rectángulo sólido agrandado `r`, si está a menos
 * de `r` del borde de la zona, o si `outside(x, y)` dice que ese punto no es suelo (huecos de las salas en L).
 */
export function buildNav(area: Area, rects: readonly Box[], r: number, cell = NAV_CELL, outside?: (x: number, y: number) => boolean): Nav {
  const cols = Math.max(1, Math.ceil((area.x1 - area.x0) / cell));
  const rows = Math.max(1, Math.ceil((area.y1 - area.y0) / cell));
  const blocked = new Uint8Array(cols * rows);
  const m = Math.min(r, cell / 2);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const x = area.x0 + cx * cell + cell / 2;
      const y = area.y0 + cy * cell + cell / 2;
      let b = x < area.x0 + m || x > area.x1 - m || y < area.y0 + m || y > area.y1 - m || (!!outside && outside(x, y));
      for (let k = 0; !b && k < rects.length; k++) {
        const q = rects[k];
        b = x > q.x - r && x < q.x + q.w + r && y > q.y - r && y < q.y + q.h + r;
      }
      blocked[cy * cols + cx] = b ? 1 : 0;
    }
  }
  return { x0: area.x0, y0: area.y0, cell, cols, rows, blocked };
}

export function cellOf(nav: Nav, p: P): [number, number] {
  return [Math.floor((p.x - nav.x0) / nav.cell), Math.floor((p.y - nav.y0) / nav.cell)];
}
const inNav = (nav: Nav, cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < nav.cols && cy < nav.rows;
const free = (nav: Nav, cx: number, cy: number) => inNav(nav, cx, cy) && nav.blocked[cy * nav.cols + cx] === 0;

/** La casilla libre más cercana (anillos crecientes); la misma si ya está libre, null si no hay ninguna cerca. */
export function nearestFree(nav: Nav, cx: number, cy: number, maxR = 8): [number, number] | null {
  if (free(nav, cx, cy)) return [cx, cy];
  for (let r = 1; r <= maxR; r++) {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !free(nav, cx + dx, cy + dy)) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = [cx + dx, cy + dy];
        }
      }
    }
    if (best) return best;
  }
  return null;
}

const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/**
 * Distancias (en casillas, 8 vecinos sin cortar esquinas) desde la casilla libre más cercana al objetivo. Dijkstra
 * sencillo con cola por cubos: la rejilla es pequeña (una sala grande ronda las 2000 casillas).
 */
export function navField(nav: Nav, target: P): Float32Array {
  const n = nav.cols * nav.rows;
  const dist = new Float32Array(n).fill(Infinity);
  const [tx0, ty0] = cellOf(nav, target);
  const start = nearestFree(nav, Math.max(0, Math.min(nav.cols - 1, tx0)), Math.max(0, Math.min(nav.rows - 1, ty0)));
  if (!start) return dist;
  const open: number[] = [start[1] * nav.cols + start[0]];
  dist[open[0]] = 0;
  // Cola de prioridad mínima (montículo binario)
  const push = (i: number) => {
    open.push(i);
    let k = open.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (dist[open[p]] <= dist[open[k]]) break;
      [open[p], open[k]] = [open[k], open[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = open[0];
    const last = open.pop()!;
    if (open.length) {
      open[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let s = k;
        if (l < open.length && dist[open[l]] < dist[open[s]]) s = l;
        if (r < open.length && dist[open[r]] < dist[open[s]]) s = r;
        if (s === k) break;
        [open[s], open[k]] = [open[k], open[s]];
        k = s;
      }
    }
    return top;
  };
  const done = new Uint8Array(n);
  while (open.length) {
    const i = pop();
    if (done[i]) continue;
    done[i] = 1;
    const cx = i % nav.cols;
    const cy = (i - cx) / nav.cols;
    for (const [dx, dy, w] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!free(nav, nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!free(nav, cx + dx, cy) || !free(nav, cx, cy + dy))) continue;
      const j = ny * nav.cols + nx;
      const d = dist[i] + w;
      if (d < dist[j]) {
        dist[j] = d;
        push(j);
      }
    }
  }
  return dist;
}

/**
 * Hacia dónde ir desde `from` siguiendo el campo: al centro de la vecina con menos distancia (mirando un poco más
 * allá para suavizar). Si está metido en una casilla bloqueada, primero hacia la libre más cercana. null si no hay
 * camino (o ya está en la meta).
 */
export function navStep(nav: Nav, dist: Float32Array, from: P): P | null {
  let [cx, cy] = cellOf(nav, from);
  cx = Math.max(0, Math.min(nav.cols - 1, cx));
  cy = Math.max(0, Math.min(nav.rows - 1, cy));
  const centre = (x: number, y: number): P => ({ x: nav.x0 + x * nav.cell + nav.cell / 2, y: nav.y0 + y * nav.cell + nav.cell / 2 });
  const dirTo = (q: P): P | null => {
    const dx = q.x - from.x;
    const dy = q.y - from.y;
    const l = Math.hypot(dx, dy);
    return l > 1e-3 ? { x: dx / l, y: dy / l } : null;
  };
  if (!free(nav, cx, cy)) {
    const f = nearestFree(nav, cx, cy);
    return f ? dirTo(centre(f[0], f[1])) : null;
  }
  const here = dist[cy * nav.cols + cx];
  if (!(here < Infinity) || here === 0) return null;
  // Dos pasos hacia abajo en el campo: apunta al segundo si se ve en línea recta (sin escalones de 45º en cada casilla)
  const best = (x: number, y: number): [number, number] | null => {
    let b: [number, number] | null = null;
    let bd = dist[y * nav.cols + x];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!free(nav, nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!free(nav, x + dx, y) || !free(nav, x, y + dy))) continue;
      const d = dist[ny * nav.cols + nx];
      if (d < bd) {
        bd = d;
        b = [nx, ny];
      }
    }
    return b;
  };
  const s1 = best(cx, cy);
  if (!s1) return null;
  const s2 = best(s1[0], s1[1]);
  if (s2 && s2[0] - s1[0] === s1[0] - cx && s2[1] - s1[1] === s1[1] - cy) return dirTo(centre(s2[0], s2[1])) ?? dirTo(centre(s1[0], s1[1]));
  return dirTo(centre(s1[0], s1[1]));
}

/** ¿Corta el segmento a-b algún rectángulo agrandado `pad`? (Liang-Barsky contra cada uno.) */
export function segmentClear(a: P, b: P, rects: readonly Box[], pad = 0): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (const r of rects) {
    let t0 = 0;
    let t1 = 1;
    const x0 = r.x - pad;
    const x1 = r.x + r.w + pad;
    const y0 = r.y - pad;
    const y1 = r.y + r.h + pad;
    const clip = (p: number, q: number) => {
      if (Math.abs(p) < 1e-9) return q >= 0;
      const t = q / p;
      if (p < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
      return true;
    };
    if (clip(-dx, a.x - x0) && clip(dx, x1 - a.x) && clip(-dy, a.y - y0) && clip(dy, y1 - a.y) && t0 <= t1) return false;
  }
  return true;
}

/**
 * Dirección para acercarse: recta si el camino directo está libre (con la holgura del cuerpo); si no, rodeando por
 * la rejilla. Sin camino, recta (el detector de atascos se encarga del resto).
 */
export function pathDir(from: P, to: P, rects: readonly Box[], r: number, nav?: Nav, dist?: Float32Array): P {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const l = Math.hypot(dx, dy) || 1;
  const direct = { x: dx / l, y: dy / l };
  if (segmentClear(from, to, rects, r * 0.9) || !nav || !dist) return direct;
  return navStep(nav, dist, from) ?? direct;
}

// --- Ataques de jefe: cuáles necesitan verte y tenerte a tiro ---

/** Alcance máximo de un ataque apuntado del jefe (px). Más lejos se acerca antes de usarlo. */
export const BOSS_AIM_RANGE = 520;
/** Si no puede atacar, vuelve a mirarlo tras este rato (mientras se recoloca). */
export const BOSS_RETRY_MS = 350;

/**
 * Ataques que llenan la sala o caen desde arriba (no salen en línea recta hacia ti): se pueden usar sin verte. El
 * resto (embestidas, abanicos, láser, cargas en línea, movimientos apuntados) solo con visión y a tiro.
 */
const ZONE_ATTACKS = new Set<string>([
  'ring', 'star8', 'spiral', 'shockwave', 'rain', 'summon', 'hazard',
  'meteor', 'helix', 'wallGap', 'crossMines', 'gridBeams', 'bounce', 'miasma', 'judgment', 'nova',
]);
/** La onda expansiva solo llega hasta aquí (más lejos no tiene sentido lanzarla). */
const SHOCKWAVE_RANGE = 420;

export const isZoneAttack = (a: string) => ZONE_ATTACKS.has(a);

/** ¿Tiene sentido este ataque ahora? Los apuntados, solo con visión y a tiro; los de zona, siempre (la onda, cerca). */
export function attackUsable(a: string, los: boolean, dist: number): boolean {
  if (a === 'shockwave') return dist <= SHOCKWAVE_RANGE;
  if (ZONE_ATTACKS.has(a)) return true;
  return los && dist <= BOSS_AIM_RANGE;
}

/** Los ataques de la lista que sirven ahora (vacía: toca recolocarse). */
export function usableAttacks<T extends string>(list: readonly T[], los: boolean, dist: number): T[] {
  return list.filter((a) => attackUsable(a, los, dist));
}

/** ¿Puede usar un ataque apuntado (movimiento de tipo, ráfaga hacia ti)? */
export const aimUsable = (los: boolean, dist: number) => los && dist <= BOSS_AIM_RANGE;
