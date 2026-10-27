// Controles del juego (los muestran el menú principal, la pausa y Ajustes). Cada acción con teclado, ratón y mando.
// Las teclas son las configuradas (T44): CONTROLS es siempre la misma lista y se rellena de nuevo al cambiarlas.
// T35: además, la pantalla de Controles por secciones (Teclado, Ratón, Mando y Táctil) sale de controlSections.
import { controlsFor, keyLabel, type Action, type KeyMap } from './keybinds.ts';
import { loadKeys } from './save.ts';

export const CONTROLS: [string, string][] = controlsFor(loadKeys());

/** Vuelve a escribir CONTROLS con estas teclas (misma lista, así quien la importó ve las nuevas). */
export function refreshControls(keys: KeyMap = loadKeys()) {
  CONTROLS.splice(0, CONTROLS.length, ...controlsFor(keys));
}

// --- Pantalla de Controles por secciones (T35) ---

export const CONTROL_MODES = ['keyboard', 'mouse', 'gamepad', 'touch'] as const;
export type ControlMode = (typeof CONTROL_MODES)[number];

export const CONTROL_MODE_LABEL: Record<ControlMode, string> = { keyboard: 'Teclado', mouse: 'Ratón', gamepad: 'Mando', touch: 'Táctil' };

/** Todo lo que se puede hacer, en el orden en que sale en cada sección. */
export const CONTROL_ACTIONS = ['move', 'shoot', 'powers', 'parry', 'active', 'bomb', 'potion', 'ball', 'mega', 'charge', 'use', 'pause', 'menus', 'back'] as const;
export type ControlAction = (typeof CONTROL_ACTIONS)[number];

export const CONTROL_ACTION_LABEL: Record<ControlAction, string> = {
  move: 'Moverse',
  shoot: 'Disparar',
  powers: 'Poderes',
  parry: 'Parry (justo antes del golpe)',
  active: 'Objeto activo',
  bomb: 'Bomba',
  potion: 'Poción',
  ball: 'Poké Ball (enemigo débil)',
  mega: 'Megaevolución',
  charge: 'Ataque cargado',
  use: 'Usar (Centro, tienda, cofre)',
  pause: 'Pausa',
  menus: 'Menús: elegir y aceptar',
  back: 'Volver',
};

/** Cómo se hace cada acción en cada modo (las teclas, las configuradas). */
export function controlSections(k: KeyMap): Record<ControlMode, Record<ControlAction, string>> {
  const L = (a: Action) => keyLabel(k[a]);
  return {
    keyboard: {
      move: `${L('up')} ${L('left')} ${L('down')} ${L('right')}`,
      shoot: `${L('shootUp')} ${L('shootLeft')} ${L('shootDown')} ${L('shootRight')} (dos a la vez, en diagonal)`,
      powers: `${L('power1')} ${L('power2')} ${L('power3')} ${L('power4')}`,
      parry: L('parry'),
      active: L('active'),
      bomb: L('bomb'),
      potion: L('potion'),
      ball: L('ball'),
      mega: `${L('mega')} (con Mega Piedra y adrenalina llena)`,
      charge: `Mantén ${L('charge')} y suelta tras 0,8 s`,
      use: `${L('accept')} cerca`,
      pause: `${L('pause')} o ${L('back')}`,
      menus: `Flechas para elegir · ${L('accept')} o Espacio para aceptar`,
      back: `${L('back')} o Retroceso`,
    },
    mouse: {
      move: 'Mantén el clic derecho hacia donde quieras ir',
      shoot: 'Mantén el clic izquierdo hacia donde quieras disparar',
      powers: 'Clic en la ranura del poder',
      parry: 'Clic central (rueda) · o clic en el cuadro Parry del HUD',
      active: 'Clic en su cuadro del HUD',
      bomb: 'Clic en la bomba del HUD',
      potion: 'Clic en la poción del HUD',
      ball: 'Clic en la Poké Ball del HUD',
      mega: 'Clic en la Mega Piedra del HUD',
      charge: 'Mantén el botón lateral (atrás o adelante) y suelta tras 0,8 s',
      use: 'Clic en el mostrador, el artículo o el cofre',
      pause: 'Botón ❚❚ de arriba a la izquierda',
      menus: 'Pasa el ratón por encima y haz clic',
      back: 'Botón "← Volver"',
    },
    gamepad: {
      move: 'Stick izquierdo',
      shoot: 'Stick derecho',
      powers: 'A B X Y',
      parry: 'RT',
      active: 'LB',
      bomb: 'RB',
      potion: 'Pulsar el stick izquierdo (L3)',
      ball: 'Pulsar el stick derecho (R3)',
      mega: 'Cruceta arriba',
      charge: 'Mantén LT y suelta tras 0,8 s',
      use: 'A cerca',
      pause: 'Start (o Select)',
      menus: 'Cruceta o stick para elegir · A para aceptar',
      back: 'B',
    },
    touch: {
      move: 'Joystick de la izquierda',
      shoot: 'Joystick de la derecha: dispara hacia donde lo empujes',
      powers: 'Botones 1 2 3 4 (encima del joystick derecho)',
      parry: 'Botón "Parry" (encima del joystick derecho)',
      active: 'Botón del objeto activo (encima del joystick izquierdo)',
      bomb: 'Botón de la bomba (encima del joystick izquierdo)',
      potion: 'Botón de la poción (encima del joystick izquierdo)',
      ball: 'Toca la Poké Ball del HUD',
      mega: 'Toca la Mega Piedra del HUD',
      charge: 'No disponible en táctil (el joystick dispara en ráfaga)',
      use: 'Botón "Usar" cerca',
      pause: 'Botón ❚❚ de arriba a la izquierda',
      menus: 'Toca la opción',
      back: 'Toca "← Volver"',
    },
  };
}

// --- ¿Pantalla táctil? (T35) ---

export interface PointerEnv {
  /** navigator.maxTouchPoints */
  maxTouchPoints: number;
  /** matchMedia('(pointer: coarse)'): el puntero principal es un dedo. */
  coarse: boolean;
  /** matchMedia('(any-pointer: fine)'): hay algún ratón o panel táctil fino. */
  fine: boolean;
}

/** Los controles táctiles solo salen en móvil o tableta: pantalla táctil y sin ratón (en PC nunca). */
export const isTouchOnly = (env: PointerEnv): boolean => (env.coarse || env.maxTouchPoints > 0) && !env.fine;

/** Lo mismo leyendo el navegador (fuera del navegador, false). */
export function touchOnlyDevice(): boolean {
  if (typeof navigator === 'undefined' || typeof matchMedia === 'undefined') return false;
  return isTouchOnly({
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    coarse: matchMedia('(pointer: coarse)').matches,
    fine: matchMedia('(any-pointer: fine)').matches,
  });
}

/** Secciones que se enseñan: Táctil solo en móvil o tableta. */
export const visibleModes = (touch: boolean): ControlMode[] => CONTROL_MODES.filter((m) => m !== 'touch' || touch);

// --- Defensa de torres: sus teclas son fijas (no entran en la configuración de teclas) ---

export const TD_CONTROL_ACTIONS = ['pick', 'place', 'upgrade', 'sell', 'target', 'abilities', 'wave', 'speed', 'pause', 'back'] as const;
export type TdControlAction = (typeof TD_CONTROL_ACTIONS)[number];

export const TD_CONTROL_ACTION_LABEL: Record<TdControlAction, string> = {
  pick: 'Elegir Pokémon del equipo',
  place: 'Colocar o elegir torre',
  upgrade: 'Mejorar (y elegir rama)',
  sell: 'Vender',
  target: 'Cambiar objetivo de la torre',
  abilities: 'Habilidades: Rayo, Ventisca, Curar',
  wave: 'Llamar a la siguiente oleada',
  speed: 'Velocidad x1 / x2 / x3',
  pause: 'Pausa',
  back: 'Cancelar / volver',
};

/** Cómo se hace cada acción de la defensa de torres en cada modo. */
export const TD_CONTROLS: Record<ControlMode, Record<TdControlAction, string>> = {
  keyboard: {
    pick: 'Q y E (anterior y siguiente)',
    place: 'Flechas o W A S D para mover el cursor · Enter o Espacio',
    upgrade: 'U (en la rama, elige con las flechas y Enter)',
    sell: 'V',
    target: 'T',
    abilities: '1 Rayo · 2 Ventisca · 3 Curar base',
    wave: 'N',
    speed: 'F',
    pause: 'Esc o P',
    back: 'Esc (cancela lo elegido; sin nada, abre la pausa)',
  },
  mouse: {
    pick: 'Clic en el Pokémon del panel de la derecha',
    place: 'Clic en una casilla libre; clic en una torre para elegirla · clic derecho: cancelar',
    upgrade: 'Botón verde "Mejorar" del panel (en la rama, clic en una de las dos)',
    sell: 'Botón "Vender" del panel',
    target: 'Botón "Objetivo" del panel',
    abilities: 'Clic en los tres botones de abajo a la izquierda',
    wave: 'Botón "Siguiente oleada"',
    speed: 'Botón "x1" de abajo',
    pause: 'Botón "Pausa" de abajo',
    back: 'Clic derecho',
  },
  gamepad: {
    pick: 'LB y RB (anterior y siguiente)',
    place: 'Cruceta o stick para mover el cursor · A',
    upgrade: 'Baja al panel con la cruceta y pulsa A en "Mejorar"',
    sell: 'En el panel, A en "Vender"',
    target: 'En el panel, A en "Objetivo"',
    abilities: 'LT Rayo · RT Ventisca (Curar base, desde los botones de abajo con A)',
    wave: 'X',
    speed: 'Y',
    pause: 'Start (o Select)',
    back: 'B',
  },
  touch: {
    pick: 'Toca el Pokémon del panel',
    place: 'Toca una casilla libre; toca una torre para elegirla',
    upgrade: 'Toca "Mejorar" en el panel',
    sell: 'Toca "Vender" en el panel',
    target: 'Toca "Objetivo" en el panel',
    abilities: 'Toca los tres botones de abajo a la izquierda',
    wave: 'Toca "Siguiente oleada"',
    speed: 'Toca "x1"',
    pause: 'Toca "Pausa"',
    back: 'Toca "← Volver"',
  },
};
