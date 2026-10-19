// Controles del juego (los muestran el menú principal, la pausa y Ajustes). Cada acción con teclado, ratón y mando.
// Las teclas son las configuradas (T44): CONTROLS es siempre la misma lista y se rellena de nuevo al cambiarlas.
import { controlsFor, type KeyMap } from './keybinds.ts';
import { loadKeys } from './save.ts';

export const CONTROLS: [string, string][] = controlsFor(loadKeys());

/** Vuelve a escribir CONTROLS con estas teclas (misma lista, así quien la importó ve las nuevas). */
export function refreshControls(keys: KeyMap = loadKeys()) {
  CONTROLS.splice(0, CONTROLS.length, ...controlsFor(keys));
}
