// Ratón en los menús: zonas de clic generosas, clic fiable (sin dobles clics que «saltan» al botón que aparece debajo,
// sin clic derecho ni central por error, sin clics que llegan justo al abrirse una pantalla) y el paso del ratón que
// vuelve a mandar sobre la selección después de usar el teclado o el mando. Lógica pura (sin Phaser ni DOM):
// ui/menuPointer.ts la engancha a Phaser para todas las escenas de menú a la vez.

/** Escenas de juego: aquí no se toca nada (la partida y la defensa de torres tienen sus propias zonas y clics). */
export const PLAY_SCENES: ReadonlySet<string> = new Set(['Game', 'TowerDefense']);
/** Menús donde el clic derecho hace algo (TowerDefenseMenu: barra de filtros hacia atrás). En el resto no cuenta. */
export const RIGHT_CLICK_SCENES: ReadonlySet<string> = new Set(['TowerDefenseMenu']);

/** Al abrirse (o volver a primer plano) una pantalla, los clics de estos primeros ms no cuentan. */
export const ARM_MS = 180;
/** Ventana de un doble clic. */
export const DOUBLE_MS = 450;

export const isMenuScene = (key: string): boolean => !PLAY_SCENES.has(key);

/** Margen extra (unidades locales del objeto) alrededor de un botón de w × h: entre 6 y 14. */
export function hitPad(w: number, h: number): number {
  const m = Math.min(Math.abs(w), Math.abs(h));
  if (!(m > 0)) return 0;
  return Math.max(6, Math.min(14, Math.round(m * 0.25)));
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Distancia del punto al rectángulo (0 si está dentro). */
export function rectDist(r: Rect, x: number, y: number): number {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** ¿Cae el punto en el botón dibujado (exacto) o en su margen? */
export function padHit(r: Rect, x: number, y: number, pad: number): 'exact' | 'pad' | null {
  if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return 'exact';
  if (pad > 0 && x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad) return 'pad';
  return null;
}

/**
 * Zona de impacto de un contenedor de Phaser con `setSize(w, h)`. Phaser suma SIEMPRE medio tamaño (el `displayOrigin`
 * de un contenedor es w/2, h/2) a la coordenada local antes de mirar la zona, así que un rectángulo (0, 0, w, h) cubre
 * de −w/2 a +w/2 alrededor de la posición del contenedor. Vale si el contenido se dibuja centrado; si se dibuja desde la
 * esquina (de 0 a w, como las tarjetas de modos), la zona tiene que ir corrida medio tamaño o quedará encima de la
 * tarjeta de arriba a la izquierda (el ratón sobre la mitad derecha o de abajo seleccionaba la tarjeta vecina).
 */
export function containerHitRect(w: number, h: number, drawn: 'center' | 'corner'): Rect {
  return drawn === 'corner' ? { x: w / 2, y: h / 2, w, h } : { x: 0, y: 0, w, h };
}

/** Prueba de impacto de Phaser 3.90 en un contenedor de w × h (sin escala): punto relativo a su posición. */
export const containerHit = (hit: Rect, w: number, h: number, x: number, y: number): boolean =>
  padHit(hit, x + w / 2, y + h / 2, 0) === 'exact';

export interface HitCand {
  /** El punto cae dentro del botón dibujado (no solo en el margen). */
  exact: boolean;
  /** Es un botón (cursor de mano); los fondos que se tragan clics no lo son. */
  button: boolean;
  /** Distancia al borde del botón (0 si es exacto). */
  dist: number;
}

/**
 * Cuál de los objetos tocados se queda el clic. `cands` va de arriba abajo (como lo ordena Phaser). Un botón tocado de
 * lleno gana a los márgenes de sus vecinos; el margen de un botón que está encima de un fondo gana a ese fondo; un fondo
 * (de un diálogo) que tapa un botón sigue tapándolo. Entre varios márgenes, el del botón más cercano.
 */
export function pickHit(cands: readonly HitCand[]): number {
  let best = -1;
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    if (c.exact) {
      if (c.button) return i;
      // Fondo o panel sin cursor: se queda el clic salvo que haya un margen de botón por encima de él
      return best >= 0 ? best : i;
    }
    if (c.button && (best < 0 || c.dist < cands[best].dist)) best = i;
  }
  return best >= 0 ? best : 0;
}

export interface ClickMemo {
  /** Momento del último clic aceptado (ms), escena y objeto. */
  t: number;
  scene: string;
  target: number;
}

export interface DownInfo {
  t: number;
  scene: string;
  /** Objeto de arriba bajo el ratón (id) o -1 si no hay ninguno. */
  target: number;
  /** Botón del ratón: 0 izquierdo, 1 central, 2 derecho. */
  button: number;
  /** `MouseEvent.detail`: 2 en el segundo clic de un doble clic. */
  clicks: number;
  /** ms desde que la escena se abrió o volvió a primer plano. */
  sceneAge: number;
  touch: boolean;
}

export type DownVerdict = 'ok' | 'early' | 'button' | 'double';

/**
 * ¿Cuenta este clic? Táctil: siempre (lo lleva su propio seguro). Ratón: solo el botón izquierdo (o el derecho donde
 * hace algo), no en los primeros ARM_MS de la pantalla y no el segundo clic de un doble clic si debajo ya hay otra cosa
 * (otra pantalla u otro botón: el primer clic abrió algo nuevo justo donde estaba el ratón).
 */
export function judgeDown(d: DownInfo, last: ClickMemo | null): DownVerdict {
  if (d.touch) return 'ok';
  if (d.button === 1 || (d.button === 2 && !RIGHT_CLICK_SCENES.has(d.scene)) || d.button > 2) return 'button';
  if (d.sceneAge < ARM_MS) return 'early';
  if (d.clicks >= 2 && last && d.t - last.t < DOUBLE_MS && (last.scene !== d.scene || last.target !== d.target)) return 'double';
  return 'ok';
}

/**
 * Hover = selección: tras moverse con teclado o mando, el ratón vuelve a seleccionar lo que tiene debajo en cuanto se
 * mueve (aunque no haya salido del botón). `moved`: el ratón se ha movido de verdad (no un evento sin desplazamiento).
 */
export const shouldReHover = (navSinceHover: boolean, moved: boolean, touch: boolean): boolean => navSinceHover && moved && !touch;
