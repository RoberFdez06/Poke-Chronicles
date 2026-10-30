// Controles de la defensa de torres (sin Phaser, así se prueban con node --test): qué tecla o botón hace cada cosa,
// la barra de ayuda que cambia según lo elegido y el dispositivo, y el cursor que se mueve solo al mantener pulsado.
// La escena (TowerDefenseScene), la pantalla de Controles (TD_CONTROLS) y los consejos sacan los nombres de aquí.

export type TdDevice = 'keyboard' | 'mouse' | 'gamepad' | 'touch';

/** Acciones con tecla o botón propio (se enseñan en su botón de la pantalla). */
export type TdKeyAction = 'rayo' | 'ventisca' | 'bomba' | 'refuerzo' | 'wave' | 'speed' | 'pause' | 'prev' | 'next' | 'ok' | 'back';

/** Teclas fijas (no entran en la configuración de teclas de la partida). */
export const TD_KEYS: Record<TdKeyAction, string> = {
  rayo: 'Z',
  ventisca: 'X',
  bomba: 'C',
  refuerzo: 'V',
  wave: 'N',
  speed: 'F',
  pause: 'P',
  prev: 'Q',
  next: 'E',
  ok: 'Enter',
  back: 'Esc',
};

/** Botones del mando. */
export const TD_PAD: Record<TdKeyAction, string> = {
  rayo: 'LT',
  ventisca: 'RT',
  bomba: 'Y',
  refuerzo: 'L3',
  wave: 'X',
  speed: 'R3',
  pause: 'Start',
  prev: 'LB',
  next: 'RB',
  ok: 'A',
  back: 'B',
};

/** Etiqueta corta que se pinta en el botón: la tecla en PC, el botón con mando y nada en táctil. */
export function tdKeyLabel(a: TdKeyAction, d: TdDevice): string {
  if (d === 'touch') return '';
  return d === 'gamepad' ? TD_PAD[a] : TD_KEYS[a];
}

/** Qué está haciendo el jugador: nada, colocando un Pokémon o con una torre abierta. */
export type TdHelpContext =
  | { kind: 'idle' }
  | { kind: 'placing'; name: string; cost: number; canPlace: boolean }
  | { kind: 'tower'; actions: number }
  | { kind: 'aiming'; name: string }
  | { kind: 'perks' };

/** Barra de ayuda de abajo (dos líneas): solo lo que sirve ahora con el dispositivo con el que se juega. */
export function tdHelp(d: TdDevice, c: TdHelpContext): [string, string] {
  const K = TD_KEYS;
  const P = TD_PAD;
  if (c.kind === 'perks') {
    if (d === 'gamepad') return [`Cruceta izquierda/derecha: elegir mejora · ${P.ok}: quedártela`, 'Se queda la primera si llega la oleada'];
    if (d === 'keyboard') return [`1 2 3 o flechas y ${K.ok}: quedarte una mejora`, 'Se queda la primera si llega la oleada'];
    return [`${d === 'touch' ? 'Toca' : 'Clic en'} una de las 3 mejoras`, 'Se queda la primera si llega la oleada'];
  }
  if (c.kind === 'aiming') {
    if (d === 'gamepad') return [`Cruceta: apuntar ${c.name} · ${P.ok}: lanzar`, `${P.back}: cancelar`];
    if (d === 'keyboard') return [`Flechas/WASD: apuntar ${c.name} · ${K.ok}: lanzar`, `${K.back}: cancelar`];
    return [`${d === 'touch' ? 'Toca' : 'Clic en'} el mapa: lanzar ${c.name}`, d === 'touch' ? 'Toca otra vez el botón: cancelar' : 'Clic derecho: cancelar'];
  }
  if (d === 'gamepad') {
    if (c.kind === 'placing')
      return [`${P.ok}: colocar ${c.name} (${c.cost} $) · Cruceta: mover`, `${P.prev}/${P.next}: otro Pokémon · ${P.back}: cancelar`];
    if (c.kind === 'tower') return [`Cruceta arriba/abajo: elegir acción · ${P.ok}: hacerla`, `${P.back}: cerrar la torre`];
    return [
      `Cruceta: mover · ${P.ok}: colocar o abrir torre · ${P.prev}/${P.next}: Pokémon`,
      `${P.wave}: oleada · ${P.rayo}/${P.ventisca}/${P.bomba}/${P.refuerzo}: habilidades · ${P.speed}: velocidad · ${P.pause}: pausa`,
    ];
  }
  if (d === 'mouse' || d === 'touch') {
    const clic = d === 'touch' ? 'Toca' : 'Clic en';
    const cancel = d === 'touch' ? 'Toca de nuevo el Pokémon: cancelar' : 'Clic derecho: cancelar';
    if (c.kind === 'placing')
      return [`${clic} una casilla libre: colocar ${c.name} (${c.cost} $)`, d === 'touch' ? cancel : `Rueda: otro Pokémon · ${cancel}`];
    if (c.kind === 'tower')
      return [`${clic} una acción del panel de la derecha`, d === 'touch' ? 'Toca fuera de la torre: cerrar' : 'Clic derecho o fuera: cerrar'];
    return [`${clic} un Pokémon del equipo y luego en una casilla`, `${clic} una torre: mejorar, objetivo o vender`];
  }
  if (c.kind === 'placing')
    return [`${K.ok}: colocar ${c.name} (${c.cost} $) · Flechas/WASD: mover`, `${K.prev}/${K.next}: otro Pokémon · ${K.back}: cancelar`];
  if (c.kind === 'tower') {
    const nums = Array.from({ length: Math.max(1, c.actions) }, (_, i) => i + 1).join(' ');
    return [`${nums}: acción del panel (o flechas y ${K.ok})`, `${K.back}: cerrar la torre`];
  }
  return [
    `Flechas/WASD: mover · ${K.ok}: colocar o abrir torre · ${K.prev}/${K.next}: Pokémon`,
    `${K.wave}: oleada · ${K.rayo} ${K.ventisca} ${K.bomba} ${K.refuerzo}: habilidades · ${K.speed}: velocidad · ${K.pause}: pausa`,
  ];
}

/** Mueve el cursor de casillas sin salirse del mapa. */
export function stepCursor(c: { x: number; y: number }, dx: number, dy: number, cols: number, rows: number) {
  return { x: Math.max(0, Math.min(cols - 1, c.x + Math.sign(dx))), y: Math.max(0, Math.min(rows - 1, c.y + Math.sign(dy))) };
}

/** Índice siguiente o anterior en una lista circular (equipo, acciones del panel). */
export const cycle = (i: number, d: number, n: number): number => (n <= 0 ? 0 : (((i + Math.sign(d)) % n) + n) % n);

/**
 * Repetición al mantener una dirección: la primera pulsación mueve al momento; si se sigue pulsando, tras `delay` ms
 * mueve cada `every` ms. Al soltar o cambiar de dirección empieza de nuevo.
 */
export class HoldRepeat {
  private dir = '';
  private held = 0;
  private next = 0;
  private delay: number;
  private every: number;

  constructor(delay = 260, every = 85) {
    this.delay = delay;
    this.every = every;
  }

  /** dx/dy: dirección pulsada ahora (-1, 0 o 1). Devuelve el paso que toca dar en este fotograma (o 0, 0). */
  update(dx: number, dy: number, dtMs: number): { dx: number; dy: number } {
    const key = `${Math.sign(dx)},${Math.sign(dy)}`;
    if (key === '0,0') {
      this.dir = '';
      return { dx: 0, dy: 0 };
    }
    if (key !== this.dir) {
      this.dir = key;
      this.held = 0;
      this.next = this.delay;
      return { dx: Math.sign(dx), dy: Math.sign(dy) };
    }
    this.held += dtMs;
    if (this.held >= this.next) {
      this.next += this.every;
      return { dx: Math.sign(dx), dy: Math.sign(dy) };
    }
    return { dx: 0, dy: 0 };
  }
}
