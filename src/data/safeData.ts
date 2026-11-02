// Validación de datos externos no confiables (Firestore, sessionStorage, localStorage) antes de usarlos como
// guardado. Evita prototype pollution (__proto__, constructor, prototype), tipos raros y tamaños desorbitados.
// Lógica pura, sin Phaser, con tests en tests/safeData.test.ts.

/** Límites del guardado. El documento de Firestore admite 1 MiB; se deja margen. */
export const SAVE_LIMITS = {
  maxKeys: 2000,
  maxKeyLength: 200,
  maxValueLength: 400_000,
  maxTotalLength: 900_000,
} as const;

/** Nombre visible de la cuenta: máximo de caracteres. */
export const MAX_NAME_LENGTH = 40;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** ¿Clave peligrosa para objetos JS? */
export const isForbiddenKey = (k: string): boolean => FORBIDDEN_KEYS.has(k);

/**
 * Convierte cualquier valor en un mapa clave → texto seguro, o null si no tiene esa forma.
 * Las entradas que no son texto, con claves peligrosas o demasiado largas se descartan; si el total pasa del
 * límite, se devuelve null (mejor empezar de cero que cargar algo que bloquee el juego).
 */
export function sanitizeStringMap(input: unknown, limits = SAVE_LIMITS): Record<string, string> | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return null;
  const out: Record<string, string> = Object.create(null) as Record<string, string>;
  let count = 0;
  let total = 0;
  for (const k of Object.keys(input)) {
    if (isForbiddenKey(k) || k.length === 0 || k.length > limits.maxKeyLength) continue;
    const v = (input as Record<string, unknown>)[k];
    if (typeof v !== 'string' || v.length > limits.maxValueLength) continue;
    if (++count > limits.maxKeys) return null;
    total += k.length + v.length;
    if (total > limits.maxTotalLength) return null;
    out[k] = v;
  }
  // Objeto normal (con prototipo) para el resto del juego, copiando solo claves ya revisadas
  return { ...out };
}

/** JSON de texto → mapa seguro (null si no es JSON válido o no tiene la forma). */
export function parseStringMap(raw: string | null | undefined, limits = SAVE_LIMITS): Record<string, string> | null {
  if (!raw || raw.length > limits.maxTotalLength * 2) return null;
  try {
    return sanitizeStringMap(JSON.parse(raw) as unknown, limits);
  } catch {
    return null;
  }
}

/** Nombre visible: texto sin caracteres de control y recortado; undefined si no vale. */
export function sanitizeName(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '').trim().slice(0, MAX_NAME_LENGTH);
  return s || undefined;
}
