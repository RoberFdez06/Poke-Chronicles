// Tutorial de práctica de cada modo (pedido de Roberto, 02/11): una partida guiada contra Arceus (versión normal, no el
// Supremo) en la que el jugador va muy potenciado y unos carteles explican el combate contra jefes, las fases, los
// ataques frenéticos, el parry, la esquiva, las transformaciones, las flechas guía, el minimapa y la trampilla.
// Nada de esa partida se guarda: se juega sobre una copia en memoria del guardado (sandbox) y al salir se vuelve al
// almacenamiento de verdad, donde solo se apunta que el tutorial de ese modo ya se ha jugado.
// Lógica pura, sin Phaser, con tests (tests/bossTutorial.test.ts).
import { MemoryStorage, activeStorage, gameData, setActiveStorage, type StorageLike } from './storage.ts';
import { emptyTutorial, parseTutorial, type TutorialState } from './tutorial.ts';
import type { GameMode } from './modes.ts';

/** Modos con tutorial: los que se juegan en GameScene. La Defensa de torres no tiene jefes, parry ni formas (tiene sus consejos propios). */
export const TUTORIAL_MODES = ['normal', 'waves', 'endless', 'bossrush', 'tower'] as const;
export type TutorialMode = (typeof TUTORIAL_MODES)[number];
export const hasTutorial = (m: unknown): m is TutorialMode => typeof m === 'string' && (TUTORIAL_MODES as readonly string[]).includes(m);

/** Tarjeta de la pantalla de modos → tutorial que le toca (el diario y el código son variantes de Normal). */
export function tutorialModeFor(card: GameMode | 'daily' | 'code'): TutorialMode | null {
  if (card === 'daily' || card === 'code') return 'normal';
  return hasTutorial(card) ? card : null;
}

/** Pokémon del tutorial: Charizard (tiene megaevolución, así se puede probar la Mega Piedra). */
export const TUTORIAL_STARTER = 6;

/** Lo que hace avanzar un paso: una acción real del jugador o el botón de continuar. */
export type TutEvent = 'continue' | 'move' | 'shoot' | 'parry' | 'dash' | 'transform';

export interface TutStep {
  id: string;
  title: string;
  /** Texto con teclado, ratón y mando. */
  text: string;
  /** Texto en móvil o tableta (sin teclas ni botones del mando); si falta, `text`. */
  touch?: string;
  until: TutEvent;
}

const MODE_TEXT: Readonly<Record<TutorialMode, string>> = {
  normal: 'En Normal recorres pisos de salas. Limpia salas, coge objetos y busca la sala del jefe (el minimapa la marca). Al vencerlo se abre la trampilla: písala para bajar al siguiente piso.',
  waves: 'En Oleadas no hay puertas: aguantas rondas de enemigos cada vez más duras en una sola sala y cae un objeto cada 3 rondas. Lo que aprendes del parry y la esquiva es lo que te mantiene vivo.',
  endless: 'En Infinito los pisos no se acaban y cada uno es más difícil. Igual que en Normal: jefe al final de cada piso y trampilla para bajar. Llega lo más hondo que puedas.',
  bossrush: 'En Rush de jefes solo hay jefes legendarios, uno tras otro, con un objeto entre jefe y jefe. Aquí el escudo, las fases y el parry lo son todo.',
  tower: 'En la Torre subes 100 pisos de una sola sala: minijefe cada 5 y jefe y descanso cada 10. En el piso 100 te espera Arceus Supremo, mucho más fuerte que este.',
};

/** Pasos del tutorial del modo `mode`, en orden. */
export function tutorialSteps(mode: TutorialMode): TutStep[] {
  return [
    {
      id: 'intro', until: 'continue', title: 'Bienvenida',
      text: 'Esta es una partida de práctica contra Arceus. Vas muy potenciado y no puedes caer. Nada de lo que pase aquí se guarda: ni monedas, ni objetos, ni récords.',
    },
    {
      id: 'move', until: 'move', title: 'Moverse',
      text: 'Muévete con W A S D, el stick izquierdo o manteniendo el clic derecho hacia donde quieras ir.',
      touch: 'Pon el dedo en la mitad izquierda de la pantalla y arrástralo hacia donde quieras ir.',
    },
    {
      id: 'shoot', until: 'shoot', title: 'Disparar',
      text: 'Dispara con las flechas, el stick derecho o manteniendo el clic izquierdo hacia el cursor. Los poderes de las ranuras: teclas 1-4, A B X Y o clic en la ranura.',
      touch: 'Pon el dedo en la mitad derecha y arrástralo hacia donde quieras disparar. Toca una ranura de poder y sale sola.',
    },
    {
      id: 'bars', until: 'continue', title: 'Vida y escudo del jefe',
      text: 'Arriba ves la barra de vida del jefe. Al bajar al 33 % le sale un escudo (barra azul): primero hay que romperlo y luego vuelve a perder vida.',
    },
    {
      id: 'phases', until: 'continue', title: 'Fases',
      text: 'La barra tiene marcas (umbrales). Al llegar a una, el jefe se para con una animación y cambia de fase: ataca más rápido y con más cosas. Ningún golpe se salta una fase: no hay muertes de un solo golpe.',
    },
    {
      id: 'frenzy', until: 'continue', title: 'Ataques frenéticos',
      text: 'Cascadas de líneas: busca el hueco que deja cada línea. Círculos con rayo: sal del círculo antes de que caiga. Tormentas: muévete sin parar. Todo avisa antes de golpear.',
    },
    {
      id: 'parry', until: 'parry', title: 'Parry',
      text: 'Pulsa F, clic central o RT justo antes del golpe (cuando la marca ! se pone blanca): lo anulas y lo devuelves. Tras un parry, tu siguiente golpe es crítico. Haz uno para seguir.',
      touch: 'Toca el botón del escudo justo antes del golpe (cuando la marca ! se pone blanca): lo anulas y lo devuelves. Tras un parry, tu siguiente golpe es crítico. Haz uno para seguir.',
    },
    {
      id: 'dash', until: 'dash', title: 'Esquiva',
      text: 'Esquiva con Mayús, doble clic derecho o la cruceta abajo: un impulso corto en el que no te pueden dar. Aquí se recarga casi al momento. Esquiva una vez.',
      touch: 'Toca el botón de la flecha: un impulso corto hacia donde te mueves en el que no te pueden dar. Esquiva una vez.',
    },
    {
      id: 'transform', until: 'transform', title: 'Transformaciones',
      text: 'Llevas la Mega Piedra y el medidor de poder lleno. Elige forma (Mega, Dinamax, Teracristal o Movimiento Z) con X, la cruceta izquierda/derecha o la rueda, y úsala con M, la cruceta arriba o clic en el icono junto a la Poké Ball.',
      touch: 'Llevas la Mega Piedra y el medidor lleno. Toca una casilla del selector de formas y luego el icono junto a la Poké Ball para transformarte.',
    },
    {
      id: 'fusion', until: 'continue', title: 'Fusiones',
      text: 'En las partidas normales, dos poderes compatibles se pueden fusionar en uno más fuerte (en la forja o al coger un poder con las ranuras llenas). Las sinergias de objetos también suman.',
    },
    {
      id: 'guide', until: 'continue', title: 'Flechas, minimapa y trampilla',
      text: 'Las flechas guía del borde señalan salas y objetos importantes. El minimapa (arriba a la derecha) marca el jefe, la tienda y los cofres. Al vencer a un jefe se abre la trampilla: písala para seguir.',
    },
    { id: 'mode', until: 'continue', title: 'Este modo', text: MODE_TEXT[mode] },
    {
      id: 'finish', until: 'continue', title: '¡A por Arceus!',
      text: 'Ya lo sabes todo. Derrota a Arceus para terminar, o pulsa Saltar para volver al menú. Al salir todo vuelve a la normalidad.',
    },
  ];
}

export interface TutProgress {
  mode: TutorialMode;
  step: number;
  /** Ya no quedan pasos (o se saltó). */
  done: boolean;
}

export const newTutorial = (mode: TutorialMode): TutProgress => ({ mode, step: 0, done: false });

export const currentStep = (p: TutProgress): TutStep | null => (p.done ? null : tutorialSteps(p.mode)[p.step] ?? null);

/**
 * Avanza si el evento es el que pide el paso actual. «continue» (el botón) avanza también los pasos de acción, para
 * que nadie se quede atascado (p. ej. un Pokémon que no puede transformarse). Devuelve si ha avanzado.
 */
export function advance(p: TutProgress, ev: TutEvent): boolean {
  const s = currentStep(p);
  if (!s || (ev !== 'continue' && s.until !== ev)) return false;
  p.step += 1;
  if (p.step >= tutorialSteps(p.mode).length) p.done = true;
  return true;
}

export function skipAll(p: TutProgress) {
  p.step = tutorialSteps(p.mode).length;
  p.done = true;
}

/** Texto del paso según el dispositivo. */
export const stepText = (s: TutStep, touch: boolean): string => (touch ? s.touch ?? s.text : s.text);

/** «Paso 3/13». */
export const stepCounter = (p: TutProgress): string => `Paso ${Math.min(p.step + 1, tutorialSteps(p.mode).length)}/${tutorialSteps(p.mode).length}`;

/** Botones del cartel: con teclas y botones del mando, o sin ellos en táctil. */
export const tutButtons = (touch: boolean): { next: string; skip: string } =>
  touch ? { next: 'Continuar', skip: 'Saltar tutorial' } : { next: 'Continuar (T · R3)', skip: 'Saltar (N · L3)' };

// --- Bonos del jugador (solo en el tutorial) ---

export const TUTORIAL_BONUS = { hpMul: 6, minHp: 40, damageMul: 3, fireDelayMul: 0.55, speedMul: 1.25, parryCdMs: 150, dashCdMs: 250 } as const;

/** Estadísticas muy potenciadas para practicar. */
export function tutorialStats<T extends { damage: number; fireDelay: number; speed: number; maxHp: number }>(s: T): T {
  const b = TUTORIAL_BONUS;
  return {
    ...s,
    damage: s.damage * b.damageMul,
    fireDelay: Math.max(60, s.fireDelay * b.fireDelayMul),
    speed: s.speed * b.speedMul,
    maxHp: Math.max(b.minHp, Math.round(s.maxHp * b.hpMul)),
  };
}

/** Recarga corta: el momento en que vuelve a estar listo (nunca más tarde que `now + cd`). */
export const shortCooldown = (readyAt: number, now: number, cd: number): number => Math.min(readyAt, now + cd);

/**
 * Vida mínima de Arceus (fracción) mientras quedan pasos: no se le puede vencer antes de llegar al final de la guía
 * (así da tiempo a ver el escudo, las fases y practicar). En el último paso, o saltado, se le puede vencer.
 */
export const bossHpFloor = (p: TutProgress): number => (p.done || p.step >= tutorialSteps(p.mode).length - 1 ? 0 : 0.08);

/** Vida a la que se cura el jugador si baja demasiado (no puede caer en el tutorial). */
export const refillHp = (hp: number, maxHp: number): number => (hp <= maxHp * 0.25 ? maxHp : hp);

// --- Guardado aislado (sandbox) ---

/** Copia de lo guardado en un almacenamiento (memoria o localStorage). */
export function storageCopy(s: StorageLike | null): Record<string, string> {
  if (!s) return {};
  if (s instanceof MemoryStorage) return s.snapshot();
  const keyed = s as unknown as { length?: number; key?: (i: number) => string | null };
  if (typeof keyed.length === 'number' && typeof keyed.key === 'function') return gameData(s as unknown as Parameters<typeof gameData>[0]);
  return {};
}

let realStorage: StorageLike | null | undefined;

export const inSandbox = (): boolean => realStorage !== undefined;

/**
 * Empieza el tutorial: todo el juego pasa a guardar en una copia en memoria (sin nube). Si ya estaba dentro, no hace
 * nada (p. ej. al reiniciar la escena).
 */
export function enterSandbox() {
  if (realStorage !== undefined) return;
  const real = activeStorage();
  realStorage = real;
  setActiveStorage(new MemoryStorage(storageCopy(real)));
}

/**
 * Termina el tutorial: vuelve al almacenamiento de verdad (lo de la copia se tira) y apunta el modo como jugado.
 */
export function leaveSandbox(mode: TutorialMode | null, key = 'pokeisaac.tutorial') {
  if (realStorage === undefined) return;
  const real = realStorage;
  realStorage = undefined;
  setActiveStorage(real);
  if (mode) {
    try {
      const st = parseTutorial(real?.getItem(key) ?? null);
      real?.setItem(key, JSON.stringify(markPracticed(st, mode)));
    } catch {
      // sin almacenamiento: se volverá a ofrecer
    }
  }
}

// --- Estado guardado (en TutorialState.practice) ---

export const practiced = (s: TutorialState, mode: TutorialMode): boolean => s.practice.includes(mode);

export const markPracticed = (s: TutorialState, mode: TutorialMode): TutorialState =>
  s.practice.includes(mode) ? s : { ...s, practice: [...s.practice, mode] };

/** ¿Se recomienda el tutorial al elegir este modo? Solo la primera vez (ni jugado ni rechazado). */
export const shouldOfferTutorial = (s: TutorialState | null, mode: TutorialMode | null): boolean =>
  !!mode && !practiced(s ?? emptyTutorial(), mode);
