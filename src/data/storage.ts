// Almacenamiento intercambiable (T45): todo el guardado (save.ts, runSave.ts, gachaHistory.ts) pasa por
// activeStorage(). Invitado: memoria (no se guarda nada al cerrar). Cuenta: memoria sincronizada con la nube.
// Modo local de desarrollo y pruebas: localStorage. Lógica pura, con tests.

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  /** Opcional (localStorage lo tiene): para "Borrar progreso". */
  removeItem?(key: string): void;
}

/** Todas las claves del juego empiezan así. */
export const SAVE_PREFIX = 'pokeisaac.';
/** Bandera (en localStorage) del modo local de desarrollo y pruebas: guarda en el navegador como antes. */
export const DEV_LOCAL_FLAG = 'pokeisaac.dev.local';

/** Guardado en memoria: dura lo que dure la página. */
export class MemoryStorage implements StorageLike {
  protected map: Map<string, string>;

  constructor(initial: Record<string, string> = {}) {
    this.map = new Map(Object.entries(initial));
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  /** Copia de todo lo guardado. */
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.map);
  }
}

/**
 * Memoria que avisa de cada cambio (para subirlo a la nube). `onChange` recibe la copia completa; quien la sube se
 * encarga de juntar varios cambios seguidos.
 */
export class SyncedStorage extends MemoryStorage {
  private onChange: (data: Record<string, string>) => void;

  constructor(initial: Record<string, string>, onChange: (data: Record<string, string>) => void) {
    super(initial);
    this.onChange = onChange;
  }

  override setItem(key: string, value: string): void {
    if (this.map.get(key) === String(value)) return;
    super.setItem(key, value);
    this.onChange(this.snapshot());
  }

  override removeItem(key: string): void {
    if (!this.map.has(key)) return;
    super.removeItem(key);
    this.onChange(this.snapshot());
  }
}

let active: StorageLike | null | undefined;

/** Cambia el almacenamiento que usa todo el juego (lo hace main.ts al arrancar, según la cuenta). */
export function setActiveStorage(s: StorageLike | null) {
  active = s;
}

/** El almacenamiento en uso. Hasta que main.ts decida, el del navegador (como antes de la T45). */
export function activeStorage(): StorageLike | null {
  if (active !== undefined) return active;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // modo privado o datos bloqueados
  }
}

/** Lo que el juego tiene guardado en un almacenamiento con claves (localStorage): solo las suyas. */
export function gameData(store: { length: number; key(i: number): string | null; getItem(k: string): string | null }): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (!k || !k.startsWith(SAVE_PREFIX) || k === DEV_LOCAL_FLAG) continue;
    const v = store.getItem(k);
    if (v !== null && v !== '') out[k] = v;
  }
  return out;
}

/** ¿Hay progreso de verdad? (no basta con el volumen o las teclas). */
export function hasProgress(data: Record<string, string> | null | undefined): boolean {
  if (!data) return false;
  return Object.keys(data).some((k) => !/\.(audio|keys|tutorial)$/.test(k));
}

/**
 * Qué subir a una cuenta nueva (o vacía) al entrar: lo que hubiera en la nube si tiene progreso; si no, lo que
 * jugaste como invitado en esta sesión; si no, lo que había guardado en este navegador de antes de las cuentas.
 */
export function pickInitialData(
  cloud: Record<string, string> | null,
  guest: Record<string, string> | null,
  legacy: Record<string, string> | null,
): { data: Record<string, string>; imported: 'cloud' | 'guest' | 'legacy' | 'empty' } {
  if (cloud && hasProgress(cloud)) return { data: cloud, imported: 'cloud' };
  if (guest && hasProgress(guest)) return { data: { ...cloud, ...guest }, imported: 'guest' };
  if (legacy && hasProgress(legacy)) return { data: { ...cloud, ...legacy }, imported: 'legacy' };
  return { data: { ...cloud }, imported: 'empty' };
}
