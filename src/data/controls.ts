// Controles del juego (los muestran el menú principal, la pausa y Ajustes). Cada acción con teclado, ratón y mando.
// Las teclas son las configuradas (T44): CONTROLS es siempre la misma lista y se rellena de nuevo al cambiarlas.
// T35: además, la pantalla de Controles por secciones (Teclado, Ratón, Mando y Táctil) sale de controlSections.
import { controlsFor, keyLabel, type Action, type KeyMap } from './keybinds.ts';
import { loadKeys } from './save.ts';
import { TD_KEYS, TD_PAD } from './towerDefense/controls.ts';

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
export const CONTROL_ACTIONS = ['move', 'shoot', 'powers', 'parry', 'dash', 'active', 'bomb', 'potion', 'ball', 'mega', 'forms', 'charge', 'use', 'pause', 'menus', 'back'] as const;
export type ControlAction = (typeof CONTROL_ACTIONS)[number];

export const CONTROL_ACTION_LABEL: Record<ControlAction, string> = {
  move: 'Moverse',
  shoot: 'Disparar',
  powers: 'Poderes',
  parry: 'Parry (justo antes del golpe)',
  dash: 'Esquiva (impulso)',
  active: 'Objeto activo',
  bomb: 'Bomba',
  potion: 'Poción',
  ball: 'Poké Ball (enemigo débil)',
  mega: 'Forma de poder (usar)',
  forms: 'Elegir forma de poder',
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
      dash: `${L('dash')} (hacia donde te mueves o miras)`,
      active: L('active'),
      bomb: L('bomb'),
      potion: L('potion'),
      ball: L('ball'),
      mega: `${L('mega')}: Mega (con Mega Piedra), Dinamax, Teracristal o Z`,
      forms: `${L('powerNext')}: Mega → Dinamax → Teracristal → Movimiento Z`,
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
      dash: 'Doble clic derecho (hacia el cursor) · o clic en el cuadro Esquiva del HUD',
      active: 'Clic en su cuadro del HUD',
      bomb: 'Clic en la bomba del HUD',
      potion: 'Clic en la poción del HUD',
      ball: 'Clic en la Poké Ball del HUD',
      mega: 'Clic en el icono de forma del HUD (junto a la Poké Ball)',
      forms: 'Clic derecho o rueda sobre el icono de forma del HUD',
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
      dash: 'Cruceta abajo',
      active: 'LB',
      bomb: 'RB',
      potion: 'Pulsar el stick izquierdo (L3)',
      ball: 'Pulsar el stick derecho (R3)',
      mega: 'Cruceta arriba',
      forms: 'Cruceta izquierda / derecha',
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
      dash: 'Botón "Esquiva" (encima del joystick derecho)',
      active: 'Botón del objeto activo (encima del joystick izquierdo)',
      bomb: 'Botón de la bomba (encima del joystick izquierdo)',
      potion: 'Botón de la poción (encima del joystick izquierdo)',
      ball: 'Toca la Poké Ball del HUD',
      mega: 'Toca el icono de forma del HUD',
      forms: 'Mantén el icono de forma del HUD (medio segundo)',
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

// --- Defensa de torres: sus teclas son fijas (no entran en la configuración de teclas). Salen de TD_KEYS y TD_PAD
// (data/towerDefense/controls.ts), las mismas que pinta la partida en sus botones y en la barra de ayuda.

export const TD_CONTROL_ACTIONS = ['cursor', 'pick', 'place', 'actions', 'back', 'abilities', 'perks', 'wave', 'speed', 'pause'] as const;
export type TdControlAction = (typeof TD_CONTROL_ACTIONS)[number];

export const TD_CONTROL_ACTION_LABEL: Record<TdControlAction, string> = {
  cursor: 'Mover el cursor',
  pick: 'Elegir Pokémon del equipo',
  place: 'Colocar o abrir una torre',
  actions: 'Mejorar, objetivo o vender',
  back: 'Cancelar / cerrar',
  abilities: 'Habilidades',
  perks: 'Elegir mejora entre oleadas',
  wave: 'Siguiente oleada',
  speed: 'Velocidad x1 / x2 / x3',
  pause: 'Pausa',
};

const K = TD_KEYS;
const G = TD_PAD;

/** Cómo se hace cada acción de la defensa de torres en cada modo. */
export const TD_CONTROLS: Record<ControlMode, Record<TdControlAction, string>> = {
  keyboard: {
    cursor: 'Flechas o W A S D (mantén pulsado para ir rápido)',
    pick: `${K.prev} y ${K.next} (anterior y siguiente)`,
    place: `${K.ok} o Espacio: coloca el Pokémon elegido o abre la torre del cursor`,
    actions: `Con la torre abierta: teclas 1 2 3 4 (o flechas y ${K.ok})`,
    back: `${K.back} (sin nada elegido, abre la pausa)`,
    abilities: `${K.rayo} Tormenta · ${K.ventisca} Congelación · ${K.bomba} Bomba · ${K.refuerzo} Refuerzo (las de zona: apunta y ${K.ok})`,
    perks: `1 2 3 o flechas y ${K.ok}`,
    wave: K.wave,
    speed: K.speed,
    pause: `${K.pause} o ${K.back}`,
  },
  mouse: {
    cursor: 'Mueve el ratón por el mapa',
    pick: 'Clic en el Pokémon del panel derecho · rueda del ratón',
    place: 'Clic en una casilla libre; clic en una torre para abrirla',
    actions: 'Clic en los botones numerados del panel',
    back: 'Clic derecho',
    abilities: 'Clic en los botones de abajo a la izquierda (las de zona: luego clic en el mapa)',
    perks: 'Clic en la mejora',
    wave: 'Botón "Siguiente oleada"',
    speed: 'Botón "x1"',
    pause: 'Botón "Pausa"',
  },
  gamepad: {
    cursor: 'Cruceta o stick izquierdo (mantén para ir rápido)',
    pick: `${G.prev} y ${G.next} (anterior y siguiente)`,
    place: `${G.ok}: coloca el Pokémon elegido o abre la torre del cursor`,
    actions: `Con la torre abierta: cruceta arriba/abajo y ${G.ok}`,
    back: `${G.back} (sin nada elegido, abre la pausa)`,
    abilities: `${G.rayo} Tormenta · ${G.ventisca} Congelación · ${G.bomba} Bomba · ${G.refuerzo} Refuerzo (apunta y ${G.ok})`,
    perks: `Cruceta izquierda/derecha y ${G.ok}`,
    wave: G.wave,
    speed: `${G.speed} (pulsar el stick derecho)`,
    pause: G.pause,
  },
  touch: {
    cursor: 'Toca la casilla',
    pick: 'Toca el Pokémon del panel derecho',
    place: 'Toca una casilla libre; toca una torre para abrirla',
    actions: 'Toca los botones numerados del panel',
    back: 'Toca otra vez el Pokémon elegido o fuera de la torre',
    abilities: 'Toca los botones de abajo a la izquierda y luego el mapa',
    perks: 'Toca la mejora',
    wave: 'Toca "Siguiente oleada"',
    speed: 'Toca "x1"',
    pause: 'Toca "Pausa"',
  },
};
