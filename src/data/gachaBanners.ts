// gachareg: el gacha separado por banners (Todas, una por región y «Formas regionales»). Cada banner tiene su
// grupo de Pokémon, las mismas rarezas y probabilidades que el gacha de siempre, su propia garantía (pity) y su
// progreso (X/Y conseguidos). Lógica pura con almacenamiento inyectable, sin Phaser ni red, para poder testearla.
import {
  buildPools, GACHA_RATES, pull, PULL10_GUARANTEE, RARITIES, type PullResult, type Rarity, type RarityPools, type SpeciesFact,
} from './gacha.ts';
import { REGIONS } from './regions.ts';
import { FORM_REGIONS, isRegionalForm, regionalForm, type FormRegion } from './regionalForms.ts';
import { activeStorage, type StorageLike } from './storage.ts';

export type BannerKind = 'all' | 'region' | 'forms';

export interface Banner {
  id: string;
  name: string;
  kind: BannerKind;
  /** Primer y último número de la Pokédex nacional (solo los banners de región). */
  first?: number;
  last?: number;
}

export const ALL_BANNER = 'todas';
export const FORMS_BANNER = 'formas';

/** Orden de los banners en la pantalla: Todas, las regiones de regions.ts y Formas regionales. */
export const BANNERS: readonly Banner[] = [
  { id: ALL_BANNER, name: 'Todas', kind: 'all' },
  ...REGIONS.map((r): Banner => ({ id: r.id, name: r.name, kind: 'region', first: r.first, last: r.last })),
  { id: FORMS_BANNER, name: 'Formas regionales', kind: 'forms' },
];

export const bannerById = (id: string): Banner | undefined => BANNERS.find((b) => b.id === id);
export const bannerIndex = (id: string): number => Math.max(0, BANNERS.findIndex((b) => b.id === id));

/**
 * ¿Sale este Pokémon en el banner? Los de región van por su número de la Pokédex nacional (sin formas regionales:
 * esas tienen su banner propio); Todas tiene todo.
 */
export function inBanner(b: Banner, id: number): boolean {
  if (b.kind === 'all') return true;
  if (b.kind === 'forms') return isRegionalForm(id);
  return !isRegionalForm(id) && id >= (b.first ?? 0) && id <= (b.last ?? -1);
}

/** Grupos por rareza de cada banner a partir de la lista de especies (con las formas regionales). */
export function buildBannerPools(index: readonly SpeciesFact[]): Record<string, RarityPools> {
  return Object.fromEntries(BANNERS.map((b) => [b.id, buildPools(index.filter((s) => inBanner(b, s.id)))]));
}

/** Todos los Pokémon de un banner (en el orden de la lista). */
export const poolIds = (pools: RarityPools): number[] => RARITIES.flatMap((r) => pools[r]);

/** La mejor rareza que tiene el banner (Legendario casi siempre; Épico en «Formas regionales»). */
export function bannerTop(pools: RarityPools): Rarity {
  for (let i = RARITIES.length - 1; i >= 0; i--) if (pools[RARITIES[i]].length > 0) return RARITIES[i];
  return RARITIES[0];
}

/**
 * Probabilidad real de cada rareza en un banner: si una rareza no tiene Pokémon (los Ultraentes solo están en Alola),
 * su parte pasa a la más cercana que sí tenga (a igual distancia, la menos valiosa), igual que hace `pull`.
 */
export function effectiveRates(pools: RarityPools, rates: Readonly<Record<Rarity, number>> = GACHA_RATES): Record<Rarity, number> {
  const out = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  RARITIES.forEach((r, k) => {
    if (rates[r] <= 0) return;
    for (let d = 0; d < RARITIES.length; d++) {
      const hit = [k - d, k + d].map((i) => RARITIES[i]).find((x) => x !== undefined && pools[x].length > 0);
      if (hit) {
        out[hit] += rates[r];
        return;
      }
    }
  });
  return out;
}

export interface Progress {
  got: number;
  total: number;
}

/** Cuántos Pokémon del banner tienes (X/Y). Cuenta todo lo desbloqueado, también lo de antes de los banners. */
export function bannerProgress(pools: RarityPools, owned: Iterable<number>): Progress {
  const have = new Set(owned);
  const ids = poolIds(pools);
  return { got: ids.filter((id) => have.has(id)).length, total: ids.length };
}

/** Progreso de «Formas regionales» por región de la forma (Alola, Galar, Hisui y Paldea). */
export function formsProgress(pools: RarityPools, owned: Iterable<number>): Record<FormRegion, Progress> {
  const have = new Set(owned);
  const out = Object.fromEntries(FORM_REGIONS.map((r) => [r, { got: 0, total: 0 }])) as Record<FormRegion, Progress>;
  for (const id of poolIds(pools)) {
    const form = regionalForm(id);
    if (!form) continue;
    out[form.region].total++;
    if (have.has(id)) out[form.region].got++;
  }
  return out;
}

/** Destacado del día del banner (el mismo todo el día): de su mejor rareza. */
export function featuredOf(pools: RarityPools, day: number, bannerId = ''): number | null {
  const pool = pools[bannerTop(pools)];
  if (pool.length === 0) return null;
  // Cada banner tiene su propio destacado aunque compartan especies (Todas)
  let salt = 0;
  for (const c of bannerId) salt = (salt * 31 + c.charCodeAt(0)) | 0;
  return pool[(Math.imul(day + salt, 2654435761) >>> 0) % pool.length];
}

// --- Garantía (pity) por banner ---

/**
 * Tiradas seguidas en un banner para la garantía: la que hace `epic` sale Épico o mejor; la que hace `top`, de la
 * mejor rareza del banner (Legendario). Cada banner lleva su propia cuenta.
 */
export const PITY = { epic: 10, top: 80 } as const;

export interface BannerPity {
  /** Tiradas seguidas sin Épico o mejor. */
  epic: number;
  /** Tiradas seguidas sin la mejor rareza del banner. */
  top: number;
}

export interface GachaBannerState {
  v: 1;
  /** Último banner elegido (se abre en él). */
  last: string;
  banners: Record<string, BannerPity>;
}

export const BANNERS_KEY = 'pokeisaac.gachaBanners';
export const BANNERS_VERSION = 1;

export const emptyPity = (): BannerPity => ({ epic: 0, top: 0 });
export const defaultBannerState = (): GachaBannerState => ({ v: BANNERS_VERSION, last: ALL_BANNER, banners: {} });

const count = (n: unknown, max: number): number => (Number.isFinite(n) ? Math.min(max - 1, Math.max(0, Math.floor(n as number))) : 0);

/** Lee el estado guardado; lo que no se entienda (o no exista: guardados de antes) empieza de cero. */
export function parseBannerState(raw: string | null): GachaBannerState {
  const out = defaultBannerState();
  try {
    const d: unknown = raw ? JSON.parse(raw) : null;
    if (!d || typeof d !== 'object') return out;
    const o = d as { last?: unknown; banners?: unknown };
    if (typeof o.last === 'string' && bannerById(o.last)) out.last = o.last;
    if (o.banners && typeof o.banners === 'object') {
      for (const [id, p] of Object.entries(o.banners as Record<string, unknown>)) {
        if (!bannerById(id) || !p || typeof p !== 'object') continue;
        const q = p as { epic?: unknown; top?: unknown };
        out.banners[id] = { epic: count(q.epic, PITY.epic), top: count(q.top, PITY.top) };
      }
    }
  } catch {
    // guardado roto: de cero
  }
  return out;
}

export const pityOf = (s: GachaBannerState, id: string): BannerPity => ({ ...(s.banners[id] ?? emptyPity()) });

const browserStorage = (): StorageLike | null => activeStorage();

export function loadBannerState(storage: StorageLike | null = browserStorage()): GachaBannerState {
  try {
    return parseBannerState(storage?.getItem(BANNERS_KEY) ?? null);
  } catch {
    return defaultBannerState();
  }
}

export function saveBannerState(s: GachaBannerState, storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.setItem(BANNERS_KEY, JSON.stringify(s));
  } catch {
    // sin almacenamiento
  }
}

/** Guarda el banner elegido (para abrir en él la próxima vez). */
export function rememberBanner(id: string, storage: StorageLike | null = browserStorage()): void {
  if (!bannerById(id)) return;
  const s = loadBannerState(storage);
  if (s.last === id) return;
  s.last = id;
  saveBannerState(s, storage);
}

const RANK = (r: Rarity) => RARITIES.indexOf(r);
const EPIC = RANK(PULL10_GUARANTEE);

/** ¿El banner tiene algo mejor que Épico? (si no, la garantía de la mejor rareza es la de Épico). */
export const hasTopPity = (top: Rarity): boolean => RANK(top) > EPIC;

/** Cuenta tras una tirada: se reinicia al salir lo garantizado. */
export function advancePity(p: BannerPity, rarity: Rarity, top: Rarity): BannerPity {
  return {
    epic: RANK(rarity) >= EPIC ? 0 : p.epic + 1,
    top: !hasTopPity(top) || rarity === top ? 0 : p.top + 1,
  };
}

/** Cuántas tiradas faltan para cada garantía (1 = la próxima). `top` es null si el banner no la tiene. */
export function pityLeft(p: BannerPity, top: Rarity): { epic: number; top: number | null } {
  return { epic: PITY.epic - p.epic, top: hasTopPity(top) ? PITY.top - p.top : null };
}

const only = (rates: Readonly<Record<Rarity, number>>, keep: (r: Rarity) => boolean): Record<Rarity, number> =>
  Object.fromEntries(RARITIES.map((r) => [r, keep(r) ? rates[r] : 0])) as Record<Rarity, number>;

export interface BannerPull {
  results: PullResult[];
  pity: BannerPity;
}

/**
 * Hace `n` tiradas en un banner con su garantía: a la tirada `PITY.top` sin la mejor rareza sale esa; a la `PITY.epic`
 * sin Épico o mejor, sale Épico o mejor; y en una x10 (n > 1), si ninguna ha llegado a Épico, la última sí. Los
 * repetidos cuentan también los salidos en esta tanda.
 */
export function pullBanner(
  rng: () => number,
  pools: RarityPools,
  owned: ReadonlySet<number>,
  pity: BannerPity,
  n = 1,
  rates: Readonly<Record<Rarity, number>> = GACHA_RATES,
): BannerPull {
  const top = bannerTop(pools);
  const seen = new Set(owned);
  let p = { ...pity };
  const results: PullResult[] = [];
  for (let i = 0; i < n; i++) {
    const tenGuarantee = n > 1 && i === n - 1 && !results.some((r) => RANK(r.rarity) >= EPIC);
    const forceTop = hasTopPity(top) && p.top + 1 >= PITY.top;
    const forceEpic = p.epic + 1 >= PITY.epic || tenGuarantee;
    const use = forceTop ? only(rates, (r) => r === top) : forceEpic ? only(rates, (r) => RANK(r) >= EPIC) : rates;
    const r = pull(rng, pools, seen, forceTop && !(use[top] > 0) ? only({ ...rates, [top]: 1 }, (x) => x === top) : use);
    seen.add(r.speciesId);
    results.push(r);
    p = advancePity(p, r.rarity, top);
  }
  return { results, pity: p };
}
