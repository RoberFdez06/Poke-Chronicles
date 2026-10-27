// Modo de depuración local para probar megaevoluciones y adrenalina. Solo se activa con `?debug` en la URL, con
// localStorage['pokeisaac.debug'] = '1' o en el servidor de desarrollo (import.meta.env.DEV). Lógica pura.

export const DEBUG_STORAGE_KEY = 'pokeisaac.debug';

export function debugEnabled(search: string, stored: string | null, dev: boolean): boolean {
  if (dev) return true;
  if (stored === '1') return true;
  return new URLSearchParams(search).has('debug');
}
