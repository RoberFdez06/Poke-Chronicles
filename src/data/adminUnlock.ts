// Modo admin (ver admin.ts): desbloquearlo todo y deshacerlo. Lógica pura sobre StorageLike.
import { ACHIEVEMENTS, parseMissions } from './missions.ts';
import { MEDALS } from './medals.ts';
import { GARDEN_BERRY_IDS, GARDEN_PLOTS, GARDEN_BERRIES, type GardenState } from './berries.ts';
import { UPGRADE_KINDS, UPGRADE_MAX, type UpgradeBook, type UpgradeLevels } from './upgrades.ts';
import { dayNumber } from './gacha.ts';
import type { StorageLike } from './storage.ts';
import {
  CANDIES_KEY, DEX_KEY, GARDEN_KEY, MEDALS_KEY, MISSIONS_KEY, PROGRESS_KEYS, SHINIES_KEY, TICKETS_KEY, UNLOCKED_KEY,
  UNLOCKED_VERSION, UPGRADES_KEY,
} from './save.ts';

/** Copia del guardado de antes de desbloquearlo todo (para restaurarlo). */
export const ADMIN_BACKUP_KEY = 'pokeisaac.adminBackup';
export const ADMIN_RICH = 999_999;

/** Lo que se escribe para tenerlo todo: Pokédex, colección, shinies, mejoras al máximo, logros, medallas y huerto. */
export function unlockAllData(ids: readonly number[], day = dayNumber()): Record<string, string> {
  const all = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  const max = Object.fromEntries(UPGRADE_KINDS.map((k) => [k, UPGRADE_MAX[k]])) as UpgradeLevels;
  const book: UpgradeBook = Object.fromEntries(all.map((id) => [id, { ...max }]));
  const missions = parseMissions(null, day);
  for (const a of ACHIEVEMENTS) missions.achievements[a.id] = a.goal;
  const full = Object.fromEntries(GARDEN_BERRY_IDS.map((b) => [b, 999])) as GardenState['seeds'];
  const garden: GardenState = {
    v: 1,
    plots: Array.from({ length: GARDEN_PLOTS }, (_, i) => {
      const berry = GARDEN_BERRY_IDS[i % GARDEN_BERRY_IDS.length];
      return { berry, runs: GARDEN_BERRIES[berry].growRuns };
    }),
    seeds: { ...full },
    basket: { ...full },
  };
  return {
    [UNLOCKED_KEY]: JSON.stringify({ v: UNLOCKED_VERSION, ids: all }),
    [DEX_KEY]: JSON.stringify(all),
    [SHINIES_KEY]: JSON.stringify(all),
    [UPGRADES_KEY]: JSON.stringify(book),
    [MISSIONS_KEY]: JSON.stringify(missions),
    [MEDALS_KEY]: JSON.stringify(MEDALS.map((m) => m.id)),
    [GARDEN_KEY]: JSON.stringify(garden),
    [TICKETS_KEY]: String(ADMIN_RICH),
    [CANDIES_KEY]: String(ADMIN_RICH),
  };
}

/** Claves que guarda la copia: todo el progreso más lo que toca unlockAllData. */
const backupKeys = (): string[] => [...new Set([...PROGRESS_KEYS, ...Object.keys(unlockAllData([1]))])];

export const hasAdminBackup = (s: StorageLike | null): boolean => {
  try {
    return !!s?.getItem(ADMIN_BACKUP_KEY);
  } catch {
    return false;
  }
};

/** Hace la copia (si ya hay una, no la pisa: así se vuelve siempre al guardado anterior al primer desbloqueo). */
export function backupProgress(s: StorageLike | null): boolean {
  if (!s || hasAdminBackup(s)) return false;
  const snap: Record<string, string | null> = {};
  for (const k of backupKeys()) snap[k] = s.getItem(k);
  s.setItem(ADMIN_BACKUP_KEY, JSON.stringify(snap));
  return true;
}

/** Copia + desbloquear todo. */
export function unlockEverything(s: StorageLike | null, ids: readonly number[], day = dayNumber()) {
  if (!s) return;
  backupProgress(s);
  for (const [k, v] of Object.entries(unlockAllData(ids, day))) s.setItem(k, v);
}

/** Vuelve al guardado de la copia y la borra; false si no había. */
export function restoreProgress(s: StorageLike | null): boolean {
  if (!s) return false;
  let snap: Record<string, string | null>;
  try {
    snap = JSON.parse(s.getItem(ADMIN_BACKUP_KEY) ?? '') as Record<string, string | null>;
  } catch {
    return false;
  }
  if (!snap || typeof snap !== 'object') return false;
  for (const [k, v] of Object.entries(snap)) {
    if (typeof v === 'string') s.setItem(k, v);
    else if (s.removeItem) s.removeItem(k);
    else s.setItem(k, '');
  }
  if (s.removeItem) s.removeItem(ADMIN_BACKUP_KEY);
  else s.setItem(ADMIN_BACKUP_KEY, '');
  return true;
}
