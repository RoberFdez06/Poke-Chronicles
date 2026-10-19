// Cuentas (T45): configuración de Firebase desde las variables de entorno, validación del formulario y mensajes
// de error en español. Lógica pura, con tests. La conexión con Firebase está en src/net/cloud.ts.

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

/** Configuración a partir de `import.meta.env` (VITE_FIREBASE_*); null si falta algo imprescindible. */
export function firebaseConfigFrom(env: Record<string, string | boolean | undefined>): FirebaseConfig | null {
  const get = (k: string) => {
    const v = env[`VITE_FIREBASE_${k}`];
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
  };
  const apiKey = get('API_KEY');
  const authDomain = get('AUTH_DOMAIN');
  const projectId = get('PROJECT_ID');
  const appId = get('APP_ID');
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return { apiKey, authDomain, projectId, appId, storageBucket: get('STORAGE_BUCKET'), messagingSenderId: get('MESSAGING_SENDER_ID') };
}

export const MIN_PASSWORD = 6;
export const MAX_NAME = 20;

/** null si vale; si no, qué falla. */
export function checkEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : 'Escribe un correo válido';
}

export function checkPassword(password: string): string | null {
  return password.length >= MIN_PASSWORD ? null : `La contraseña necesita al menos ${MIN_PASSWORD} caracteres`;
}

/** Nombre público opcional: letras, números, espacios, guiones y puntos, como mucho 20. */
export function checkName(name: string): string | null {
  const n = name.trim();
  if (n === '') return null;
  if (n.length > MAX_NAME) return `El nombre puede tener como mucho ${MAX_NAME} caracteres`;
  return /^[\p{L}\p{N} ._-]+$/u.test(n) ? null : 'El nombre solo puede tener letras, números, espacios, puntos y guiones';
}

const AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-email': 'El correo no es válido',
  'auth/missing-password': 'Falta la contraseña',
  'auth/weak-password': `La contraseña es demasiado débil (mínimo ${MIN_PASSWORD} caracteres)`,
  'auth/email-already-in-use': 'Ya hay una cuenta con ese correo: entra con él',
  'auth/invalid-credential': 'Correo o contraseña incorrectos',
  'auth/wrong-password': 'Correo o contraseña incorrectos',
  'auth/user-not-found': 'No hay ninguna cuenta con ese correo',
  'auth/too-many-requests': 'Demasiados intentos: espera un poco y vuelve a probar',
  'auth/network-request-failed': 'Sin conexión: comprueba tu internet',
  'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar',
  'auth/cancelled-popup-request': 'Se cerró la ventana de Google antes de terminar',
  'auth/popup-blocked': 'El navegador ha bloqueado la ventana de Google: permite las ventanas emergentes',
  'auth/requires-recent-login': 'Por seguridad, sal, vuelve a entrar y repite',
  'auth/operation-not-allowed': 'Ese modo de entrar no está activado en Firebase',
  'auth/unauthorized-domain': 'Esta dirección no está autorizada en Firebase (Authentication > Ajustes > Dominios)',
  'permission-denied': 'La nube no deja guardar: revisa las reglas de Firestore',
  unavailable: 'La nube no responde: se reintentará',
};

/** Mensaje para el jugador a partir del error de Firebase (o el que sea). */
export function accountErrorMessage(err: unknown): string {
  const code = (err as { code?: unknown })?.code;
  if (typeof code === 'string' && AUTH_ERRORS[code]) return AUTH_ERRORS[code];
  return 'No se ha podido completar: inténtalo otra vez';
}

/** Espera entre reintentos al subir a la nube: 2 s, 4 s, 8 s… hasta 60 s. */
export const retryDelay = (attempt: number): number => Math.min(60_000, 2000 * 2 ** Math.max(0, attempt));
