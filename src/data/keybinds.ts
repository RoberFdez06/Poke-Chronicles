// Teclas configurables (T44): qué tecla hace cada acción. Lógica pura; las teclas van por su nombre en
// Phaser (Phaser.Input.Keyboard.KeyCodes: 'W', 'UP', 'SPACE', 'ONE'…). El guardado está en save.ts.

export const ACTIONS = [
  'up', 'down', 'left', 'right',
  'shootUp', 'shootDown', 'shootLeft', 'shootRight',
  'power1', 'power2', 'power3', 'power4',
  'active', 'bomb', 'pause', 'accept', 'back',
] as const;
export type Action = (typeof ACTIONS)[number];
export type KeyMap = Record<Action, string>;

export const ACTION_LABEL: Readonly<Record<Action, string>> = {
  up: 'Moverse arriba',
  down: 'Moverse abajo',
  left: 'Moverse a la izquierda',
  right: 'Moverse a la derecha',
  shootUp: 'Disparar arriba',
  shootDown: 'Disparar abajo',
  shootLeft: 'Disparar a la izquierda',
  shootRight: 'Disparar a la derecha',
  power1: 'Poder 1',
  power2: 'Poder 2',
  power3: 'Poder 3',
  power4: 'Poder 4',
  active: 'Objeto activo',
  bomb: 'Bomba',
  pause: 'Pausa',
  accept: 'Aceptar / usar',
  back: 'Volver',
};

export const DEFAULT_KEYS: Readonly<KeyMap> = {
  up: 'W', down: 'S', left: 'A', right: 'D',
  shootUp: 'UP', shootDown: 'DOWN', shootLeft: 'LEFT', shootRight: 'RIGHT',
  power1: 'ONE', power2: 'TWO', power3: 'THREE', power4: 'FOUR',
  active: 'SPACE', bomb: 'E', pause: 'P', accept: 'ENTER', back: 'ESC',
};

/** Nombres de tecla válidos: letras, números, flechas, F1-F12, teclado numérico y las especiales de Phaser. */
const VALID = /^([A-Z]|ZERO|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|NUMPAD_[A-Z]+|F([1-9]|1[0-2])|UP|DOWN|LEFT|RIGHT|SPACE|ENTER|ESC|BACKSPACE|TAB|SHIFT|CTRL|ALT|CAPS_LOCK|INSERT|DELETE|HOME|END|PAGE_UP|PAGE_DOWN|COMMA|PERIOD|MINUS|PLUS|SEMICOLON|OPEN_BRACKET|CLOSED_BRACKET|BACK_SLASH|FORWARD_SLASH|QUOTES|BACKTICK)$/;

export const isValidKey = (name: unknown): name is string => typeof name === 'string' && VALID.test(name);

/** Lee lo guardado: lo que falte o no valga se queda con su tecla por defecto (sin dejar dos acciones iguales). */
export function parseKeys(raw: string | null): KeyMap {
  const out: KeyMap = { ...DEFAULT_KEYS };
  let d: Record<string, unknown> | null = null;
  try {
    d = raw ? JSON.parse(raw) : null;
  } catch {
    d = null;
  }
  if (!d || typeof d !== 'object') return out;
  const used = new Set<string>();
  for (const a of ACTIONS) {
    const k = d[a];
    if (isValidKey(k) && !used.has(k)) out[a] = k;
    used.add(out[a]);
  }
  // Si al cargar quedaron repetidas (guardado a medias), vuelve todo a lo de por defecto
  return new Set(Object.values(out)).size === ACTIONS.length ? out : { ...DEFAULT_KEYS };
}

export type BindResult = { ok: true; keys: KeyMap } | { ok: false; conflict: Action };

/** Pone `key` a `action`. Si otra acción ya la usa, no cambia nada y dice cuál es. */
export function bindKey(keys: KeyMap, action: Action, key: string): BindResult {
  const other = ACTIONS.find((a) => a !== action && keys[a] === key);
  if (other) return { ok: false, conflict: other };
  return { ok: true, keys: { ...keys, [action]: key } };
}

const DIGITS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
const SPECIAL: Record<string, string> = {
  UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→', SPACE: 'Espacio', ENTER: 'Enter', ESC: 'Esc', BACKSPACE: 'Retroceso',
  TAB: 'Tab', SHIFT: 'Mayús', CTRL: 'Ctrl', ALT: 'Alt', CAPS_LOCK: 'Bloq Mayús', INSERT: 'Insert', DELETE: 'Supr',
  HOME: 'Inicio', END: 'Fin', PAGE_UP: 'Re Pág', PAGE_DOWN: 'Av Pág', COMMA: ',', PERIOD: '.', MINUS: '-', PLUS: '+',
  SEMICOLON: 'Ñ', OPEN_BRACKET: '`', CLOSED_BRACKET: '+', BACK_SLASH: 'Ç', FORWARD_SLASH: '-', QUOTES: '´', BACKTICK: 'º',
};

/** Cómo se ve la tecla en pantalla: "W", "↑", "Espacio", "1", "Num 1"… */
export function keyLabel(name: string): string {
  if (SPECIAL[name]) return SPECIAL[name];
  const digit = DIGITS.indexOf(name);
  if (digit >= 0) return String(digit);
  if (name.startsWith('NUMPAD_')) {
    const d = DIGITS.indexOf(name.slice(7));
    return `Num ${d >= 0 ? d : name.slice(7).toLowerCase()}`;
  }
  return name;
}

/** Texto de los controles con las teclas actuales (lo usan la pausa, Ajustes y el menú). */
export function controlsFor(k: KeyMap): [string, string][] {
  const L = (a: Action) => keyLabel(k[a]);
  return [
    ['Moverse', `${L('up')} ${L('left')} ${L('down')} ${L('right')} · mantener clic derecho · stick izquierdo`],
    ['Disparar', `${L('shootUp')} ${L('shootLeft')} ${L('shootDown')} ${L('shootRight')} (dos a la vez, en diagonal) · clic izquierdo · stick derecho`],
    ['Poderes · Objeto activo', `Poderes: ${L('power1')} ${L('power2')} ${L('power3')} ${L('power4')} · clic en la ranura · A B X Y    Activo: ${L('active')} · clic en su cuadro · LB`],
    ['Pausa', `${L('pause')} o ${L('back')} · botón ❚❚ de arriba a la izquierda · Start`],
    ['Usar · Bomba', `Usar (Centro, tienda, cofre): ${L('accept')} · clic · A    Bomba: ${L('bomb')} · clic en la bomba del HUD · RB`],
  ];
}
