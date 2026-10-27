// Cuentas en la nube con Firebase (T45): Authentication (correo + contraseña y Google) y Firestore (un documento por
// usuario: users/{uid} = { data: {clave: valor}, name, updatedAt }). Firebase se carga solo si está configurado.
// Invitado: el progreso va en memoria y se pierde al cerrar. Entrar o salir recarga la página para que todo el juego
// lea el almacenamiento nuevo.
import { accountErrorMessage, firebaseConfigFrom, retryDelay } from '../data/account';
import { withTimeout } from '../data/offline';
import { isAdminEmail, setAdminAccount } from '../data/admin';
import { DEV_LOCAL_FLAG, gameData, MemoryStorage, pickInitialData, setActiveStorage, SyncedStorage } from '../data/storage';

export type AccountMode = 'local' | 'guest' | 'cloud';

export interface AccountInfo {
  mode: AccountMode;
  /** Hay configuración de Firebase (si no, solo se puede jugar como invitado). */
  configured: boolean;
  email?: string;
  name?: string;
  /** De dónde salió el progreso al entrar por primera vez (para avisar). */
  imported?: 'guest' | 'legacy';
  /** Entraste, pero no se pudo leer la nube: se juega sin guardar hasta recargar. */
  loadFailed?: boolean;
  /** Firebase no arrancó (sin red, configuración mala…). */
  error?: string;
}

/** Lo jugado como invitado antes de entrar, para subirlo a la cuenta (sessionStorage: dura hasta cerrar la pestaña). */
const PENDING_GUEST = 'pokeisaacPendingGuest';
/** Este navegador ya subió su progreso de antes de las cuentas a una (para no subirlo a otras). */
const LEGACY_DONE = 'pokeisaacLegacyImported';

type Firebase = {
  auth: import('firebase/auth').Auth;
  db: import('firebase/firestore').Firestore;
  authMod: typeof import('firebase/auth');
  fsMod: typeof import('firebase/firestore');
};

let info: AccountInfo = { mode: 'guest', configured: false };
let fb: Firebase | null = null;
let guest: MemoryStorage | null = null;

export const accountInfo = (): AccountInfo => info;

const config = () => firebaseConfigFrom(import.meta.env as Record<string, string | boolean | undefined>);

function localFlag(): boolean {
  try {
    return localStorage.getItem(DEV_LOCAL_FLAG) === '1';
  } catch {
    return false;
  }
}

async function loadFirebase(): Promise<Firebase> {
  if (fb) return fb;
  const cfg = config();
  if (!cfg) throw new Error('Sin configuración de Firebase');
  const [{ initializeApp }, authMod, fsMod] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  const app = initializeApp(cfg);
  const auth = authMod.getAuth(app);
  auth.languageCode = 'es';
  // Caché local de Firestore: lo último leído sirve sin conexión y lo escrito sin red se sube al volver
  const db = fsMod.initializeFirestore(app, { localCache: fsMod.persistentLocalCache() });
  fb = { auth, db, authMod, fsMod };
  return fb;
}

/** Primer estado de la sesión (Firebase la recupera sola del navegador). */
function firstUser(f: Firebase): Promise<import('firebase/auth').User | null> {
  return new Promise((resolve) => {
    const off = f.authMod.onAuthStateChanged(f.auth, (u) => {
      off();
      resolve(u);
    });
  });
}

/**
 * Al arrancar (main.ts, antes de crear el juego): decide el almacenamiento. Modo local de pruebas → navegador;
 * sin configuración o sin sesión → invitado (memoria); con sesión → su progreso de la nube.
 */
export async function initAccount(): Promise<AccountInfo> {
  if (localFlag()) {
    setActiveStorage(localStorage);
    info = { mode: 'local', configured: !!config() };
    return info;
  }
  guest = new MemoryStorage();
  setActiveStorage(guest);
  info = { mode: 'guest', configured: !!config() };
  if (!info.configured) return info;
  try {
    const f = await withTimeout(loadFirebase(), 10_000, 'Firebase');
    const user = await withTimeout(firstUser(f), 8000, 'Sesión');
    if (user) await attach(f, user);
  } catch (err) {
    console.warn('[Poké Chronicles] Cuentas no disponibles:', err);
    info = { ...info, error: accountErrorMessage(err) };
  }
  return info;
}

async function attach(f: Firebase, user: import('firebase/auth').User) {
  const ref = f.fsMod.doc(f.db, 'users', user.uid);
  let cloud: Record<string, string> | null = null;
  let name: string | undefined = user.displayName ?? undefined;
  try {
    const snap = await withTimeout(f.fsMod.getDoc(ref), 10_000, 'Nube');
    if (snap.exists()) {
      const d = snap.data() as { data?: Record<string, string>; name?: string };
      cloud = d.data ?? {};
      name = d.name ?? name;
    }
  } catch (err) {
    // Sin leer la nube no se escribe nada (no vaya a pisar el progreso bueno): se juega como invitado
    console.warn('[Poké Chronicles] No se pudo leer la nube:', err);
    info = { mode: 'guest', configured: true, email: user.email ?? undefined, name, loadFailed: true };
    return;
  }
  const pending = readPendingGuest();
  let legacy: Record<string, string> | null = null;
  try {
    if (!localStorage.getItem(LEGACY_DONE)) legacy = gameData(localStorage);
  } catch {
    legacy = null;
  }
  const { data, imported } = pickInitialData(cloud, pending, legacy);
  const store = new SyncedStorage(data, (d) => scheduleUpload(user.uid, d));
  setActiveStorage(store);
  info = {
    mode: 'cloud',
    configured: true,
    email: user.email ?? undefined,
    name,
    imported: imported === 'guest' || imported === 'legacy' ? imported : undefined,
  };
  // Modo admin (data/admin.ts): solo si el hash del correo coincide con VITE_ADMIN_EMAIL_SHA256
  setAdminAccount(await isAdminEmail(user.email).catch(() => false));
  if (imported === 'legacy') {
    try {
      localStorage.setItem(LEGACY_DONE, user.uid);
    } catch {
      // nada
    }
  }
  // Cuenta nueva o progreso traído: se sube ya
  if (cloud === null || imported === 'guest' || imported === 'legacy') scheduleUpload(user.uid, data, 0);
  // Al cerrar o esconder la pestaña, lo pendiente se sube ya
  addEventListener('pagehide', () => void flush());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && void flush());
  addEventListener('online', () => void flush());
}

// --- Subida a la nube (juntando cambios seguidos y con reintentos) ---
let pending: { uid: string; data: Record<string, string> } | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let attempt = 0;

function scheduleUpload(uid: string, data: Record<string, string>, delay = 1500) {
  pending = { uid, data };
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), delay);
}

async function flush(): Promise<void> {
  if (!pending || !fb) return;
  const { uid, data } = pending;
  pending = null;
  clearTimeout(timer);
  try {
    await fb.fsMod.setDoc(fb.fsMod.doc(fb.db, 'users', uid), { data, name: info.name ?? null, updatedAt: fb.fsMod.serverTimestamp() });
    attempt = 0;
  } catch (err) {
    console.warn('[Poké Chronicles] No se pudo guardar en la nube, se reintentará:', err);
    // Si mientras tanto hubo otro cambio, gana el más nuevo
    pending ??= { uid, data };
    timer = setTimeout(() => void flush(), retryDelay(attempt++));
  }
}

function readPendingGuest(): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem(PENDING_GUEST);
    sessionStorage.removeItem(PENDING_GUEST);
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

/** Antes de entrar: lo jugado como invitado se guarda un momento para subirlo a la cuenta tras recargar. */
function stashGuest() {
  try {
    if (guest) sessionStorage.setItem(PENDING_GUEST, JSON.stringify(guest.snapshot()));
  } catch {
    // nada
  }
}

// --- Acciones de la pantalla Cuenta (cada una recarga la página al terminar bien) ---

export async function signUp(email: string, password: string, name: string): Promise<void> {
  const f = await loadFirebase();
  const cred = await f.authMod.createUserWithEmailAndPassword(f.auth, email.trim(), password);
  if (name.trim()) await f.authMod.updateProfile(cred.user, { displayName: name.trim() }).catch(() => undefined);
  stashGuest();
  location.reload();
}

export async function signIn(email: string, password: string): Promise<void> {
  const f = await loadFirebase();
  await f.authMod.signInWithEmailAndPassword(f.auth, email.trim(), password);
  stashGuest();
  location.reload();
}

export async function signInWithGoogle(): Promise<void> {
  const f = await loadFirebase();
  await f.authMod.signInWithPopup(f.auth, new f.authMod.GoogleAuthProvider());
  stashGuest();
  location.reload();
}

export async function resetPassword(email: string): Promise<void> {
  const f = await loadFirebase();
  await f.authMod.sendPasswordResetEmail(f.auth, email.trim());
}

export async function signOutAccount(): Promise<void> {
  const f = await loadFirebase();
  await flush();
  await f.authMod.signOut(f.auth);
  location.reload();
}

/** Borra el documento de la nube y la cuenta. Puede pedir volver a entrar (requires-recent-login). */
export async function deleteAccount(): Promise<void> {
  const f = await loadFirebase();
  const user = f.auth.currentUser;
  if (!user) return;
  pending = null;
  clearTimeout(timer);
  await f.fsMod.deleteDoc(f.fsMod.doc(f.db, 'users', user.uid));
  await f.authMod.deleteUser(user);
  location.reload();
}
