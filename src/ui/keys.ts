// Teclas configurables (T44) en Phaser: del nombre guardado ('W', 'UP', 'SPACE'…) a su código y al revés.
import Phaser from 'phaser';
import { isValidKey } from '../data/keybinds';

const CODES = Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>;

/** Código de Phaser de una tecla por su nombre. */
export const keyCode = (name: string): number => CODES[name] ?? CODES.SPACE;

let byCode: Map<number, string> | null = null;

/** Nombre (de los que se pueden guardar) de la tecla pulsada, o null si no se puede usar. */
export function keyNameFromCode(code: number): string | null {
  if (!byCode) {
    byCode = new Map();
    for (const [name, c] of Object.entries(CODES)) if (isValidKey(name) && !byCode.has(c)) byCode.set(c, name);
  }
  return byCode.get(code) ?? null;
}
