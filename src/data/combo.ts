// Combo de golpes. Cada golpe que daña a un enemigo suma (disparos, poderes de área, rayos que atraviesan, golpes
// del ayudante, quemaduras y veneno, reacciones, reflejos del parry, golpes contra jefes y contra el escudo de un
// enemigo, varios en el mismo fotograma…). Si pasa COMBO_WINDOW_MS sin golpear, se acaba; cada golpe rellena el
// tiempo entero. Lógica pura, sin Phaser.
//
// El tiempo NO es un momento del reloj (el reloj de la escena de Phaser sigue avanzando en pausa: antes el combo se
// rompía al pausar, en las intros de jefe, al elegir objeto o al cruzar una puerta). Es lo que queda en ms y solo
// baja con tickCombo, que la escena llama desde update() —que no corre en pausa— y con el paso recortado, sin
// llamarlo durante intros ni transiciones.

/** Tiempo para el siguiente golpe (ms): se rellena entero con cada golpe. */
export const COMBO_WINDOW_MS = 2500;
/** Paso máximo de una llamada a tickCombo (ms): un tirón del navegador o volver de otra pestaña no lo vacía. */
export const COMBO_MAX_STEP_MS = 100;
/** Sin enemigos en la sala (yendo de una sala a la siguiente) el tiempo baja a este ritmo: hay continuidad. */
export const COMBO_IDLE_RATE = 0.35;
/** Al recibir daño el combo no se corta: pierde esta parte del tiempo que le quedaba. */
export const COMBO_HURT_LOSS = 0.5;

export interface ComboLevel {
  /** Desde cuántos golpes. */
  at: number;
  name: string;
  color: number;
  hex: string;
  /** Bonificaciones mientras dure (multiplicadores; botín = probabilidad extra de que suelte algo más). */
  damage: number;
  speed: number;
  loot: number;
  meter: number;
  /** PS que cura al alcanzarlo. */
  heal: number;
}

export const COMBO_LEVELS: readonly ComboLevel[] = [
  { at: 5, name: 'Racha', color: 0xffd34d, hex: '#ffd34d', damage: 1.05, speed: 1, loot: 0, meter: 1.1, heal: 2 },
  { at: 15, name: 'Frenesí', color: 0xff8c1a, hex: '#ff8c1a', damage: 1.1, speed: 1.05, loot: 0.05, meter: 1.2, heal: 4 },
  { at: 30, name: 'Imparable', color: 0xff4d6d, hex: '#ff4d6d', damage: 1.18, speed: 1.08, loot: 0.12, meter: 1.3, heal: 7 },
  { at: 60, name: 'Leyenda', color: 0xb388ff, hex: '#b388ff', damage: 1.25, speed: 1.12, loot: 0.2, meter: 1.5, heal: 12 },
];

export interface ComboState {
  count: number;
  /** El combo más alto (de la partida si la escena lo arrastra entre pisos). */
  best: number;
  /** ms que quedan para golpear otra vez; 0 = no hay combo vivo. */
  left: number;
  /** Golpes totales contados (para pruebas y estadísticas). */
  hits: number;
}

export const newCombo = (best = 0): ComboState => ({ count: 0, best, left: 0, hits: 0 });

export const comboAlive = (s: ComboState): boolean => s.count > 0 && s.left > 0;

/** Nivel de un combo (o null si aún no llega al primero). */
export function comboLevel(count: number): ComboLevel | null {
  let t: ComboLevel | null = null;
  for (const x of COMBO_LEVELS) if (count >= x.at) t = x;
  return t;
}

/** Índice del nivel (−1 = ninguno), para guardar el nivel máximo alcanzado. */
export const comboLevelIndex = (count: number): number => {
  const l = comboLevel(count);
  return l ? COMBO_LEVELS.indexOf(l) : -1;
};

/** Fracción del tiempo que queda (para la barra). */
export const comboTimeLeft = (s: ComboState): number => (comboAlive(s) ? Math.max(0, Math.min(1, s.left / COMBO_WINDOW_MS)) : 0);

/**
 * Golpes (normalmente 1; un golpe de área a tres enemigos son tres). Si el combo se había acabado, empieza otro.
 * Devuelve el nivel que se acaba de alcanzar, si se cruza alguno.
 */
export function comboHit(s: ComboState, n = 1): ComboLevel | null {
  if (n <= 0) return null;
  if (!comboAlive(s)) s.count = 0;
  const before = comboLevel(s.count);
  s.count += n;
  s.hits += n;
  s.best = Math.max(s.best, s.count);
  s.left = COMBO_WINDOW_MS;
  const after = comboLevel(s.count);
  return after && after !== before ? after : null;
}

/**
 * Avanza el tiempo del combo `dtMs` ms de juego. `idle`: no hay enemigos en la sala (baja más despacio).
 * Devuelve cuánto era el combo si se ha acabado en este paso (para el aviso), o 0.
 */
export function tickCombo(s: ComboState, dtMs: number, idle = false): number {
  if (!comboAlive(s)) return 0;
  const dt = Math.max(0, Math.min(COMBO_MAX_STEP_MS, dtMs)) * (idle ? COMBO_IDLE_RATE : 1);
  s.left = Math.max(0, s.left - dt);
  if (s.left > 0) return 0;
  return comboBreak(s);
}

/** Te han hecho daño: el combo sigue, pero con menos tiempo. */
export function comboHurt(s: ComboState) {
  if (comboAlive(s)) s.left = Math.max(1, s.left * (1 - COMBO_HURT_LOSS));
}

/** Acaba el combo. Devuelve cuánto era. */
export function comboBreak(s: ComboState): number {
  const was = s.count;
  s.count = 0;
  s.left = 0;
  return was;
}

/** Bonificaciones del combo actual (todo 1 / 0 si no hay nivel). */
export function comboBonus(s: ComboState): { damage: number; speed: number; loot: number; meter: number } {
  const l = comboAlive(s) ? comboLevel(s.count) : null;
  return l ? { damage: l.damage, speed: l.speed, loot: l.loot, meter: l.meter } : { damage: 1, speed: 1, loot: 0, meter: 1 };
}

/** Texto corto de la bonificación de un nivel («+10 % daño · +5 % vel. · +5 % botín»). */
export function comboBonusText(l: ComboLevel): string {
  const pct = (m: number) => Math.round((m - 1) * 100);
  const parts = [`+${pct(l.damage)} % daño`];
  if (l.speed > 1) parts.push(`+${pct(l.speed)} % vel.`);
  if (l.loot > 0) parts.push(`+${Math.round(l.loot * 100)} % botín`);
  parts.push(`+${pct(l.meter)} % medidor`);
  return parts.join(' · ');
}
