// Hitboxes por forma (sin Phaser): círculo, elipse (zonas del suelo en perspectiva), rectángulo rotado, cápsula/línea,
// sector/cono y anillo con hueco. Regla de todo el juego (como en The Binding of Isaac): te dan solo si tu hitbox, un
// círculo pequeño de PLAYER_HURT_R px en el centro del cuerpo (los pies, no el centro del dibujo), toca la forma que
// hace daño, y esa forma siempre queda DENTRO de lo que se dibuja (aviso, zona marcada, rayo…). Lo comprueba
// tests/hitbox.test.ts recorriendo el catálogo de src/data/attackHitboxes.ts.

/** Radio de la hitbox del jugador (px). El sprite mide 84 px y el cuerpo de choque con paredes 16 px de radio. */
export const PLAYER_HURT_R = 10;
/** Achatado de las marcas del suelo (pixMarker, trapFx, grietas): el radio vertical es este tanto del horizontal. */
export const FLOOR_FLAT = 0.65;

export interface Pt {
  x: number;
  y: number;
}

export type Shape =
  | { k: 'circle'; x: number; y: number; r: number }
  | { k: 'ellipse'; x: number; y: number; rx: number; ry: number }
  /** Rectángulo centrado en (x, y), de w × h, girado `rot` radianes. */
  | { k: 'rect'; x: number; y: number; w: number; h: number; rot?: number }
  /** Segmento con grosor: rayos, láseres, embestidas. `r` es la mitad del ancho. */
  | { k: 'capsule'; x1: number; y1: number; x2: number; y2: number; r: number }
  /** Cono: desde (x, y), radio r, mirando a `a`, abre ±`half` rad. */
  | { k: 'sector'; x: number; y: number; r: number; a: number; half: number }
  /** Anillo de radio r y medio grosor `w`; sin daño en el hueco (centrado en gapAt, ancho gap rad). */
  | { k: 'ring'; x: number; y: number; r: number; w: number; gapAt?: number; gap?: number }
  | { k: 'multi'; parts: Shape[] };

export const circle = (x: number, y: number, r: number): Shape => ({ k: 'circle', x, y, r });
export const ellipse = (x: number, y: number, rx: number, ry: number): Shape => ({ k: 'ellipse', x, y, rx, ry });
/** Zona del suelo de radio r en perspectiva (como pixMarker). */
export const floorZone = (x: number, y: number, r: number, flat = FLOOR_FLAT): Shape => ellipse(x, y, r, r * flat);
export const capsule = (x1: number, y1: number, x2: number, y2: number, r: number): Shape => ({ k: 'capsule', x1, y1, x2, y2, r });
/** Rayo desde (x, y) con ángulo a, largo len y medio ancho r. */
export const ray = (x: number, y: number, a: number, len: number, r: number): Shape => capsule(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, r);

const angDiff = (a: number, b: number) => {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
};

export function segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Distancia del punto a la forma (0 si está dentro). En la elipse es una aproximación de primer orden (buena cerca). */
export function shapeDist(s: Shape, px: number, py: number): number {
  switch (s.k) {
    case 'circle':
      return Math.max(0, Math.hypot(px - s.x, py - s.y) - s.r);
    case 'ellipse': {
      const dx = px - s.x;
      const dy = py - s.y;
      const q = Math.hypot(dx / s.rx, dy / s.ry);
      if (q <= 1) return 0;
      // Punto de la elipse en la misma dirección «normalizada» y distancia hasta él (cota superior, exacta en los ejes)
      const bx = dx / q;
      const by = dy / q;
      return Math.hypot(dx - bx, dy - by);
    }
    case 'rect': {
      const c = Math.cos(-(s.rot ?? 0));
      const sn = Math.sin(-(s.rot ?? 0));
      const lx = (px - s.x) * c - (py - s.y) * sn;
      const ly = (px - s.x) * sn + (py - s.y) * c;
      const ox = Math.max(0, Math.abs(lx) - s.w / 2);
      const oy = Math.max(0, Math.abs(ly) - s.h / 2);
      return Math.hypot(ox, oy);
    }
    case 'capsule':
      return Math.max(0, segDist(px, py, s.x1, s.y1, s.x2, s.y2) - s.r);
    case 'sector': {
      const d = Math.hypot(px - s.x, py - s.y);
      if (d === 0) return 0;
      const off = angDiff(Math.atan2(py - s.y, px - s.x), s.a);
      if (off <= s.half) return Math.max(0, d - s.r);
      // Fuera del ángulo: distancia al borde más cercano (segmento del lado)
      const e1 = s.a + s.half;
      const e2 = s.a - s.half;
      return Math.min(
        segDist(px, py, s.x, s.y, s.x + Math.cos(e1) * s.r, s.y + Math.sin(e1) * s.r),
        segDist(px, py, s.x, s.y, s.x + Math.cos(e2) * s.r, s.y + Math.sin(e2) * s.r),
      );
    }
    case 'ring': {
      const d = Math.hypot(px - s.x, py - s.y);
      const band = Math.max(0, Math.abs(d - s.r) - s.w);
      if (s.gap && s.gap > 0 && angDiff(Math.atan2(py - s.y, px - s.x), s.gapAt ?? 0) <= s.gap / 2) {
        // En el hueco: lejos (el borde del arco está a un lado); se toma la distancia angular al extremo
        const edge = s.gap / 2 - angDiff(Math.atan2(py - s.y, px - s.x), s.gapAt ?? 0);
        return Math.max(band, edge * Math.max(d, 1));
      }
      return band;
    }
    case 'multi':
      return s.parts.reduce((m, p) => Math.min(m, shapeDist(p, px, py)), Infinity);
  }
}

export const containsPoint = (s: Shape, px: number, py: number): boolean => shapeDist(s, px, py) <= 0;

/** ¿Un círculo (x, y, r) toca la forma? */
export const hitsCircle = (s: Shape, x: number, y: number, r: number): boolean => shapeDist(s, x, y) <= r;

/** ¿Le da al jugador? `at` es el centro de su cuerpo (pies). */
export const hitsPlayer = (s: Shape, at: Pt, r = PLAYER_HURT_R): boolean => hitsCircle(s, at.x, at.y, r);

/** Caja que envuelve la forma (para muestrear en los tests y para dibujar la depuración). */
export function bounds(s: Shape): { x0: number; y0: number; x1: number; y1: number } {
  switch (s.k) {
    case 'circle':
      return { x0: s.x - s.r, y0: s.y - s.r, x1: s.x + s.r, y1: s.y + s.r };
    case 'ellipse':
      return { x0: s.x - s.rx, y0: s.y - s.ry, x1: s.x + s.rx, y1: s.y + s.ry };
    case 'rect': {
      const R = Math.hypot(s.w, s.h) / 2;
      return { x0: s.x - R, y0: s.y - R, x1: s.x + R, y1: s.y + R };
    }
    case 'capsule':
      return { x0: Math.min(s.x1, s.x2) - s.r, y0: Math.min(s.y1, s.y2) - s.r, x1: Math.max(s.x1, s.x2) + s.r, y1: Math.max(s.y1, s.y2) + s.r };
    case 'sector':
    case 'ring': {
      const R = s.k === 'ring' ? s.r + s.w : s.r;
      return { x0: s.x - R, y0: s.y - R, x1: s.x + R, y1: s.y + R };
    }
    case 'multi': {
      const bs = s.parts.map(bounds);
      return { x0: Math.min(...bs.map((b) => b.x0)), y0: Math.min(...bs.map((b) => b.y0)), x1: Math.max(...bs.map((b) => b.x1)), y1: Math.max(...bs.map((b) => b.y1)) };
    }
  }
}

/**
 * ¿La forma `hit` queda dentro de `drawn` (con `tol` px de margen)? Muestrea una rejilla de `step` px sobre la caja de
 * `hit`. Devuelve el primer punto que se sale (o null).
 */
export function escapePoint(hit: Shape, drawn: Shape, tol = 2, step = 3): Pt | null {
  const b = bounds(hit);
  for (let y = b.y0; y <= b.y1; y += step) {
    for (let x = b.x0; x <= b.x1; x += step) {
      if (containsPoint(hit, x, y) && shapeDist(drawn, x, y) > tol) return { x, y };
    }
  }
  return null;
}

/** Puntos del contorno (para la capa de depuración que dibuja las hitboxes). */
export function outline(s: Shape, n = 32): Pt[][] {
  const arc = (x: number, y: number, rx: number, ry: number, a0 = 0, a1 = Math.PI * 2): Pt[] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n;
      return { x: x + Math.cos(a) * rx, y: y + Math.sin(a) * ry };
    });
  switch (s.k) {
    case 'circle':
      return [arc(s.x, s.y, s.r, s.r)];
    case 'ellipse':
      return [arc(s.x, s.y, s.rx, s.ry)];
    case 'rect': {
      const c = Math.cos(s.rot ?? 0);
      const sn = Math.sin(s.rot ?? 0);
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([u, v]) => {
        const lx = (u * s.w) / 2;
        const ly = (v * s.h) / 2;
        return { x: s.x + lx * c - ly * sn, y: s.y + lx * sn + ly * c };
      });
      return [pts];
    }
    case 'capsule': {
      const a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const h = n / 2;
      const end = (x: number, y: number, from: number) => Array.from({ length: h + 1 }, (_, i) => {
        const t = from + (Math.PI * i) / h;
        return { x: x + Math.cos(t) * s.r, y: y + Math.sin(t) * s.r };
      });
      const p = [...end(s.x2, s.y2, a - Math.PI / 2), ...end(s.x1, s.y1, a + Math.PI / 2)];
      return [[...p, p[0]]];
    }
    case 'sector':
      return [[{ x: s.x, y: s.y }, ...arc(s.x, s.y, s.r, s.r, s.a - s.half, s.a + s.half), { x: s.x, y: s.y }]];
    case 'ring': {
      const g = s.gap ?? 0;
      const a0 = (s.gapAt ?? 0) + g / 2;
      const a1 = a0 + Math.PI * 2 - g;
      return [arc(s.x, s.y, s.r + s.w, s.r + s.w, a0, a1), arc(s.x, s.y, Math.max(0, s.r - s.w), Math.max(0, s.r - s.w), a0, a1)];
    }
    case 'multi':
      return s.parts.flatMap((p) => outline(p, n));
  }
}

/** Clave de localStorage que enciende la capa que dibuja las hitboxes (también `?hitboxes` en la URL). */
export const HITBOX_DEBUG_KEY = 'pokeisaac.hitboxes';
/** La capa de hitboxes solo existe en desarrollo o para el admin, y hay que pedirla (`?hitboxes` o la clave a '1'). */
export function hitboxDebugEnabled(search: string, stored: string | null, devOrAdmin: boolean): boolean {
  if (!devOrAdmin) return false;
  return stored === '1' || new URLSearchParams(search).has('hitboxes');
}

/** Centro y radio de un cuerpo de Arcade (para que el contacto use el círculo inscrito y no la caja con aire). */
export function bodyCircle(b: { center: Pt; width: number; height: number; isCircle?: boolean; halfWidth?: number }): { x: number; y: number; r: number } {
  return { x: b.center.x, y: b.center.y, r: Math.min(b.width, b.height) / 2 };
}
