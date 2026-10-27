// Modo admin (pruebas del desarrollador). Dos puertas, ambas cerradas para el resto:
//  1) Servidor de desarrollo (import.meta.env.DEV): el panel existe solo con `npm run dev`, nunca en la build.
//  2) Cuenta en la nube: si el SHA-256 del correo de la sesión (en minúsculas) coincide con VITE_ADMIN_EMAIL_SHA256.
//     El correo nunca aparece en claro: solo su hash, y únicamente en la variable de entorno (.env.local).
// Ojo: es comodidad de pruebas, NO seguridad fuerte. Todo lo que hace el panel toca solo el guardado propio
// (las reglas de Firestore ya impiden escribir en el de otros). Lógica pura, sin Phaser.

/** Nombre de la variable de entorno con el hash (64 hex) del correo del administrador. */
export const ADMIN_ENV_VAR = 'VITE_ADMIN_EMAIL_SHA256';

/** Hash del administrador leído de las variables de entorno; null si falta o no es un SHA-256 válido (nadie es admin). */
export function adminHashFrom(env: Record<string, unknown> | undefined): string | null {
  const raw = env?.[ADMIN_ENV_VAR];
  if (typeof raw !== 'string') return null;
  const h = raw.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(h) ? h : null;
}

/** ADMIN_EMAIL_SHA256: la constante única de la que sale quién es admin (vacía = nadie). */
export const ADMIN_EMAIL_SHA256: string | null = adminHashFrom(import.meta.env as Record<string, unknown> | undefined);

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** SHA-256 en hexadecimal con crypto.subtle (navegador y Node 18+). */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** ¿Este correo es el del administrador? Sin hash configurado o sin correo: nunca. */
export async function isAdminEmail(email: string | null | undefined, hash: string | null = ADMIN_EMAIL_SHA256): Promise<boolean> {
  if (!hash || !email || !email.trim()) return false;
  return (await sha256Hex(normalizeEmail(email))) === hash;
}

// --- Estado de la sesión ---

let adminAccount = false;

/** Lo llama cloud.ts al entrar con una cuenta (y con false al salir o como invitado). */
export function setAdminAccount(v: boolean) {
  adminAccount = v;
}

/** Puede abrirse el panel: en el servidor de desarrollo o con la cuenta del administrador. */
export const adminAllowed = (dev: boolean = devBuild()): boolean => dev || adminAccount;

function devBuild(): boolean {
  return !!import.meta.env?.DEV;
}

// --- Partida con trucos: no cuenta para nada ---

let cheatRun = false;

/** Se usó el panel en la partida: deja de contar para récords, medallas, misiones, tickets, caramelos e historial. */
export function markCheatRun() {
  cheatRun = true;
}

export const isCheatRun = (): boolean => cheatRun;

/** Al volver al menú (partida nueva) se olvida. */
export function clearCheatRun() {
  cheatRun = false;
  godMode = false;
}

let godMode = false;

/** Modo dios activado desde el panel (también marca la partida). */
export function setGodMode(on: boolean) {
  if (on) cheatRun = true;
  godMode = on;
}

export const isGodMode = (): boolean => godMode;

// --- Modo dios ---

/** Estadísticas casi infinitas (sobre las que ya tenías). */
export function godStats<T extends { damage: number; fireDelay: number; speed: number; maxHp: number; shotSpeed: number; range: number }>(s: T): T {
  return {
    ...s,
    damage: Math.max(s.damage, 9999),
    fireDelay: Math.min(s.fireDelay, 60),
    speed: Math.max(s.speed * 2.2, 520),
    maxHp: Math.max(s.maxHp, 9999),
    shotSpeed: Math.max(s.shotSpeed, 900),
    range: Math.max(s.range, 1400),
  };
}

// --- Elecciones para el siguiente piso (ir al piso N con jefe X y bioma B) ---

export interface AdminFloorPick {
  bossId?: number;
  biomeId?: string;
}

let nextPick: AdminFloorPick | null = null;

export function setAdminFloorPick(p: AdminFloorPick | null) {
  nextPick = p;
}

/** Lo que se eligió para el piso que se está creando (se consume una vez). */
export function takeAdminFloorPick(): AdminFloorPick | null {
  const p = nextPick;
  nextPick = null;
  return p;
}

/** Ajusta un número del panel dentro de [min, max] (con vuelta). */
export function stepValue(v: number, d: number, min: number, max: number): number {
  const span = max - min + 1;
  return ((((v - min + d) % span) + span) % span) + min;
}
