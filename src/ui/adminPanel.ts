// Filas del panel admin que no dependen de la partida (desbloquear todo / restaurar) y el registro de las de la
// partida en curso (las da GameScene mientras existe). Ver data/admin.ts y scenes/AdminScene.ts.
import type { AdminRow } from '../scenes/AdminScene';
import { activeStorage } from '../data/storage';
import { hasAdminBackup, restoreProgress, unlockEverything } from '../data/adminUnlock';
import { loadCollectionIndex } from '../data/speciesIndex';
import { accountInfo } from '../net/cloud';

let runRows: (() => AdminRow[]) | null = null;

/** GameScene registra sus filas al crearse y las quita al cerrarse. */
export function setRunAdminRows(f: (() => AdminRow[]) | null) {
  runRows = f;
}

export const currentRunAdminRows = (): AdminRow[] => runRows?.() ?? [];

/** Último número de la Pokédex, por si no se puede leer la lista de especies. */
const DEX_FALLBACK = 1025;

export function generalAdminRows(): AdminRow[] {
  const s = activeStorage();
  const guest = accountInfo().mode === 'guest';
  return [
    { header: true, label: () => 'Guardado' },
    {
      label: () => 'Desbloquear todo (Pokédex, colección, mejoras, huerto)',
      run: async () => {
        const ids = await loadCollectionIndex()
          .then((ix) => ix.map((f) => f.id))
          .catch(() => Array.from({ length: DEX_FALLBACK }, (_, i) => i + 1));
        unlockEverything(s, ids);
        return `Desbloqueado: ${ids.length} Pokémon, mejoras al máximo y huerto lleno.${guest ? ' (Invitado: no se guarda al cerrar.)' : ''} Copia hecha.`;
      },
    },
    {
      label: () => (hasAdminBackup(s) ? 'Restaurar el guardado anterior' : 'Restaurar el guardado anterior (no hay copia)'),
      run: () => (restoreProgress(s) ? 'Guardado anterior restaurado.' : 'No hay copia que restaurar.'),
    },
  ];
}
