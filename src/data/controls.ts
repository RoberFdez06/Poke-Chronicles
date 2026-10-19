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
export const CONTROL_ACTIONS = ['move', 'shoot', 'powers', 'active', 'bomb', 'use', 'pause', 'menus', 'back'] as const;
export type ControlAction = (typeof CONTROL_ACTIONS)[number];

export const CONTROL_ACTION_LABEL: Record<ControlAction, string> = {
  move: 'Moverse',
  shoot: 'Disparar',
  powers: 'Poderes',
  active: 'Objeto activo',
  bomb: 'Bomba',
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
      active: L('active'),
      bomb: L('bomb'),
      use: `${L('accept')} cerca`,
      pause: `${L('pause')} o ${L('back')}`,
      menus: `Flechas para elegir · ${L('accept')} o Espacio para aceptar`,
      back: `${L('back')} o Retroceso`,
    },
    mouse: {
      move: 'Mantén el clic derecho hacia donde quieras ir',
      shoot: 'Mantén el clic izquierdo hacia donde quieras disparar',
      powers: 'Clic en la ranura del poder',
      active: 'Clic en su cuadro del HUD',
      bomb: 'Clic en la bomba del HUD',
      use: 'Clic en el mostrador, el artículo o el cofre',
      pause: 'Botón ❚❚ de arriba a la izquierda',
      menus: 'Pasa el ratón por encima y haz clic',
      back: 'Botón "← Volver"',
    },
    gamepad: {
      move: 'Stick izquierdo',
      shoot: 'Stick derecho',
      powers: 'A B X Y',
      active: 'LB',
      bomb: 'RB',
      use: 'A cerca',
      pause: 'Start (o Select)',
      menus: 'Cruceta o stick para elegir · A para aceptar',
      back: 'B',
    },
    touch: {
      move: 'Joystick de la izquierda',
      shoot: 'Joystick de la derecha: dispara hacia donde lo empujes',
      powers: 'Botones 1 2 3 4 (encima del joystick derecho)',
      active: 'Botón del objeto activo (encima del joystick izquierdo)',
      bomb: 'Botón de la bomba (encima del joystick izquierdo)',
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
