// Con qué se está jugando ahora (teclado, ratón, mando o táctil): lo último que se ha usado. Lo leen la barra de
// ayuda del mando y la pantalla de Controles para enseñar solo lo que sirve. Sin lógica de Phaser.

export type InputDevice = 'keyboard' | 'mouse' | 'gamepad' | 'touch';

let current: InputDevice = 'keyboard';
const listeners = new Set<(d: InputDevice) => void>();

export const currentInput = (): InputDevice => current;

export function setInput(d: InputDevice) {
  if (d === current) return;
  current = d;
  listeners.forEach((f) => f(d));
}

export function onInputChange(f: (d: InputDevice) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** Teclado y ratón van juntos en PC: se enseñan las dos secciones; el mando y el táctil, solos. */
export function controlModesFor(d: InputDevice): InputDevice[] {
  return d === 'gamepad' ? ['gamepad'] : d === 'touch' ? ['touch'] : ['keyboard', 'mouse'];
}

/** Un botón o palanca del mando se ha movido (con margen para que el drift de la palanca no cuente). */
export function padActive(pads: ArrayLike<{ buttons: ArrayLike<{ pressed: boolean }>; axes: ArrayLike<number> } | null>): boolean {
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i];
    if (!p) continue;
    for (let b = 0; b < p.buttons.length; b++) if (p.buttons[b].pressed) return true;
    for (let a = 0; a < p.axes.length; a++) if (Math.abs(p.axes[a]) > 0.6) return true;
  }
  return false;
}

/** Engancha los eventos del navegador (una vez). */
let tracking = false;
export function trackInput() {
  if (tracking || typeof window === 'undefined') return;
  tracking = true;
  window.addEventListener('keydown', () => setInput('keyboard'), true);
  window.addEventListener(
    'pointerdown',
    (e) => setInput(e.pointerType === 'touch' ? 'touch' : 'mouse'),
    true,
  );
  window.addEventListener(
    'pointermove',
    (e) => e.pointerType === 'mouse' && (e.movementX !== 0 || e.movementY !== 0) && setInput('mouse'),
    true,
  );
  const poll = () => {
    try {
      if (navigator.getGamepads && padActive(Array.from(navigator.getGamepads()))) setInput('gamepad');
    } catch {
      // sin API de mandos
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}

// --- Barra de ayuda del mando en los menús ---

const DEFAULT_LEGEND = 'Cruceta o palanca: moverse · A: aceptar · B: volver';

export const PAD_LEGENDS: Record<string, string> = {
  Title: 'A o Start: empezar',
  Pokedex: 'Cruceta: moverse · A: ficha · LB/RB: región · X: rareza · LT/RT: tipo · Y: buscar · B: volver',
  Starter: 'Cruceta: moverse · A: elegir · LB/RB: región · X: rareza · LT/RT: tipo · Y: buscar · B: volver',
  Upgrades: 'Izq/Der: Pokémon · Arriba/Abajo: mejora · A: comprar · LB/RB: saltar · Y: buscar · B: volver',
  Controls: 'LB/RB: cambiar de sección · A o B: cerrar',
  SlotSwap: 'Arriba/Abajo: elegir · A: aceptar · B: dejarlo',
  FinalPrompt: 'Arriba/Abajo: elegir · A: aceptar · B: todavía no',
  // T57 y T63: «Una más» (B termina la partida) y el registro de combate (solo se mira: B vuelve)
  SecondChance: 'Arriba/Abajo: elegir · A: aceptar · B: terminar la partida',
  RunDex: 'B: volver',
  Menu: DEFAULT_LEGEND,
};

/** Escenas de menú que llevan la barra (en la partida no: ahí hay HUD). */
export const LEGEND_SCENES = new Set([
  'Title', 'Menu', 'Slots', 'Starter', 'FirstStarter', 'Mode', 'Settings', 'Pokedex', 'Upgrades', 'Missions', 'RunDex', 'Summary', 'History',
  'Keys', 'Gacha', 'Pause', 'Controls', 'Account', 'SlotSwap', 'FinalPrompt', 'SecondChance',
]);

export const legendFor = (scene: string): string => PAD_LEGENDS[scene] ?? DEFAULT_LEGEND;
