// Ajustes de vista en móvil: «Zoom de la sala» (acerca la cámara de la partida) y «Tamaño de la interfaz» (agranda
// HUD y botones táctiles). 100, 125 o 150 %. Lógica pura y guardado en localStorage (con try/catch).

export const VIEW_STEPS = [100, 125, 150] as const;
export type ViewPct = (typeof VIEW_STEPS)[number];

export interface MobileView {
  roomZoom: ViewPct;
  uiSize: ViewPct;
}

export const DEFAULT_MOBILE_VIEW: Readonly<MobileView> = { roomZoom: 100, uiSize: 100 };
export const MOBILE_VIEW_KEY = 'pokeisaac.mobileView';

const isPct = (v: unknown): v is ViewPct => (VIEW_STEPS as readonly unknown[]).includes(v);

/** Siguiente valor (o anterior con d = -1), dando la vuelta. */
export function stepPct(v: ViewPct, d = 1): ViewPct {
  const i = VIEW_STEPS.indexOf(v);
  const n = VIEW_STEPS.length;
  return VIEW_STEPS[(((i < 0 ? 0 : i) + Math.sign(d || 1)) % n + n) % n];
}

export function parseMobileView(raw: string | null): MobileView {
  const out: MobileView = { ...DEFAULT_MOBILE_VIEW };
  if (!raw) return out;
  try {
    const d = JSON.parse(raw) as Partial<MobileView> | null;
    if (d && typeof d === 'object') {
      if (isPct(d.roomZoom)) out.roomZoom = d.roomZoom;
      if (isPct(d.uiSize)) out.uiSize = d.uiSize;
    }
  } catch {
    // corrupto: lo de por defecto
  }
  return out;
}

/** Factor (1, 1,25 o 1,5); fuera de móvil siempre 1. */
export const viewFactor = (pct: ViewPct, mobile: boolean): number => (mobile ? pct / 100 : 1);

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const defaultStore = (): Store | undefined => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
};

export function loadMobileView(store: Store | undefined = defaultStore()): MobileView {
  try {
    return parseMobileView(store?.getItem(MOBILE_VIEW_KEY) ?? null);
  } catch {
    return { ...DEFAULT_MOBILE_VIEW };
  }
}

export function saveMobileView(v: MobileView, store: Store | undefined = defaultStore()): void {
  try {
    store?.setItem(MOBILE_VIEW_KEY, JSON.stringify({ roomZoom: v.roomZoom, uiSize: v.uiSize }));
  } catch {
    // sin almacenamiento: solo dura esta sesión
  }
}

/** Minimapa en móvil: ×1,6 del de PC (1,5 → 2,4), con píxel entero y como mucho este alto (px de lienzo) para que no
 * llegue a Parry y Esquiva ni a los avisos (tests/autoMode.test.ts lo comprueba con padButtons). */
export const MOBILE_MAP = { scale: 2.4, maxH: 380, top: 16 } as const;

/** Evento (en game.events) que lanza Ajustes al cambiar zoom o interfaz; la partida lo aplica en el acto. */
export const MOBILE_VIEW_CHANGED = 'mobile-view-changed';

/** Letra del HUD tras cambiar «Tamaño de la interfaz»: la base (sin factor) por el nuevo factor, entera y ≥ 1. */
export const hudRescaledPx = (base: number, ui: number): number => Math.max(1, Math.round(base * (ui > 0 ? ui : 1)));
