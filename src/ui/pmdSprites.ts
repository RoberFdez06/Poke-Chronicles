// Carga los sprites animados de SpriteCollab (AnimData.xml + hojas Walk/Idle) y crea sus animaciones de 8
// direcciones. Si un Pokémon no tiene sprite allí o falla la descarga, no pasa nada: se queda el de PokeAPI.
import Phaser from 'phaser';
import { animDataUrl, animSheetUrl, parseAnimData, ticksToMs, type AnimInfo } from '../data/pmdAnim';
import { isRegionalForm } from '../data/regionalForms';

export interface PmdSheet {
  id: number;
  walk: AnimInfo;
  /** Reposo (si no tiene, se usa la de caminar). */
  idle: AnimInfo;
  hasIdle: boolean;
}

const dataCache = new Map<number, Promise<Record<string, AnimInfo> | null>>();

/** AnimData.xml de un Pokémon (con caché); null si no tiene sprite en SpriteCollab. */
export function fetchAnimData(id: number): Promise<Record<string, AnimInfo> | null> {
  if (!dataCache.has(id)) {
    dataCache.set(
      id,
      fetch(animDataUrl(id))
        .then((r) => (r.ok ? r.text() : null))
        .then((t) => (t ? parseAnimData(t) : null))
        .catch(() => null),
    );
  }
  return dataCache.get(id)!;
}

export const pmdKey = (id: number, anim: 'walk' | 'idle') => `pmd-${id}-${anim}`;
export const pmdAnimKey = (id: number, anim: 'walk' | 'idle', row: number) => `pmd-${id}-${anim}-${row}`;

/** Carga lo que falte de estos Pokémon y devuelve los que se pueden animar (por id). */
export async function loadPmd(scene: Phaser.Scene, ids: readonly number[]): Promise<Map<number, PmdSheet>> {
  // T83: las formas regionales usan el sprite de PokeAPI (sus hojas de SpriteCollab van en otra carpeta que no se lee)
  const unique = [...new Set(ids)].filter((id) => !isRegionalForm(id));
  const datas = await Promise.all(unique.map((id) => fetchAnimData(id)));
  const sheets: PmdSheet[] = [];
  unique.forEach((id, i) => {
    const d = datas[i];
    if (!d?.Walk) return;
    sheets.push({ id, walk: d.Walk, idle: d.Idle ?? d.Walk, hasIdle: !!d.Idle });
  });
  if (!scene.scene.isActive() && !scene.scene.isPaused()) return new Map();

  await new Promise<void>((resolve) => {
    scene.load.crossOrigin = 'anonymous';
    let queued = 0;
    for (const s of sheets) {
      const parts: ['walk' | 'idle', AnimInfo, string][] = [['walk', s.walk, 'Walk']];
      if (s.hasIdle) parts.push(['idle', s.idle, 'Idle']);
      for (const [anim, info, file] of parts) {
        if (scene.textures.exists(pmdKey(s.id, anim))) continue;
        scene.load.spritesheet(pmdKey(s.id, anim), animSheetUrl(s.id, file), { frameWidth: info.frameWidth, frameHeight: info.frameHeight });
        queued++;
      }
    }
    if (queued === 0) return resolve();
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.start();
  });

  const out = new Map<number, PmdSheet>();
  for (const s of sheets) {
    if (!scene.textures.exists(pmdKey(s.id, 'walk'))) continue;
    if (s.hasIdle && !scene.textures.exists(pmdKey(s.id, 'idle'))) s.hasIdle = false;
    for (const anim of ['walk', 'idle'] as const) {
      if (anim === 'idle' && !s.hasIdle) continue;
      const tex = scene.textures.get(pmdKey(s.id, anim));
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      const info = anim === 'walk' ? s.walk : s.idle;
      const cols = Math.max(1, Math.floor(tex.getSourceImage().width / info.frameWidth));
      for (let row = 0; row < 8; row++) {
        const key = pmdAnimKey(s.id, anim, row);
        if (scene.anims.exists(key)) continue;
        const n = Math.min(info.durations.length, cols);
        scene.anims.create({
          key,
          frames: Array.from({ length: n }, (_, f) => ({
            key: pmdKey(s.id, anim),
            frame: row * cols + f,
            duration: ticksToMs(info.durations[f]),
          })),
          repeat: -1,
        });
      }
    }
    out.set(s.id, s);
  }
  return out;
}
