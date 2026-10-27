// Carga los sprites animados de SpriteCollab (AnimData.xml + hojas Walk/Idle) y crea sus animaciones de 8
// direcciones. Si un Pokémon no tiene sprite allí o falla la descarga, no pasa nada: se queda el de PokeAPI (y
// dressSprites le pone la animación procedural de data/locomotion.ts).
// Formas regionales, megas y shiny van con ids codificados (data/pmdForms.ts). Si la hoja shiny no existe, se pinta la
// normal con el tono girado por código (hueRotatePixels), así el shiny también anda con sus patas.
import Phaser from 'phaser';
import { animDataUrl, animSheetUrl, parseAnimData, ticksToMs, type AnimInfo } from '../data/pmdAnim';
import { decodePmd, hueRotatePixels, pmdAvailable, pmdPlain, shinyHue } from '../data/pmdForms';

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
  if (!pmdAvailable(id)) return Promise.resolve(null);
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

interface Pending extends PmdSheet {
  /** Hoja de la que sale (la propia, o la normal si es un shiny que hay que recolorear). */
  src: number;
}

/** Copia una hoja ya cargada con el tono girado (shiny por código). */
function recolor(scene: Phaser.Scene, from: string, to: string, deg: number, info: AnimInfo): boolean {
  if (scene.textures.exists(to)) return true;
  if (!scene.textures.exists(from)) return false;
  try {
    const img = scene.textures.get(from).getSourceImage() as HTMLImageElement;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    hueRotatePixels(d.data, deg);
    ctx.putImageData(d, 0, 0);
    scene.textures.addSpriteSheet(to, c as unknown as HTMLImageElement, { frameWidth: info.frameWidth, frameHeight: info.frameHeight });
    return scene.textures.exists(to);
  } catch {
    return false; // imagen sin permiso de lectura (CORS): se queda el dibujo de PokeAPI
  }
}

/** Carga lo que falte de estos Pokémon y devuelve los que se pueden animar (por id, codificado o no). */
export async function loadPmd(scene: Phaser.Scene, ids: readonly number[]): Promise<Map<number, PmdSheet>> {
  const unique = [...new Set(ids)].filter((id) => pmdAvailable(id));
  const datas = await Promise.all(unique.map((id) => fetchAnimData(id)));
  // Shiny sin hoja propia: se usa la normal (y luego se recolorea)
  const plains = await Promise.all(unique.map((id, i) => (datas[i] || !decodePmd(id).shiny ? null : fetchAnimData(pmdPlain(id)))));
  const sheets: Pending[] = [];
  unique.forEach((id, i) => {
    const own = datas[i];
    const d = own ?? plains[i];
    if (!d?.Walk) return;
    sheets.push({ id, src: own ? id : pmdPlain(id), walk: d.Walk, idle: d.Idle ?? d.Walk, hasIdle: !!d.Idle });
  });
  if (!scene.scene.isActive() && !scene.scene.isPaused()) return new Map();

  await new Promise<void>((resolve) => {
    scene.load.crossOrigin = 'anonymous';
    let queued = 0;
    const asked = new Set<string>();
    for (const s of sheets) {
      const parts: ['walk' | 'idle', AnimInfo, string][] = [['walk', s.walk, 'Walk']];
      if (s.hasIdle) parts.push(['idle', s.idle, 'Idle']);
      for (const [anim, info, file] of parts) {
        const key = pmdKey(s.src, anim);
        if (scene.textures.exists(key) || scene.textures.exists(pmdKey(s.id, anim)) || asked.has(key)) continue;
        asked.add(key);
        scene.load.spritesheet(key, animSheetUrl(s.src, file), { frameWidth: info.frameWidth, frameHeight: info.frameHeight });
        queued++;
      }
    }
    if (queued === 0) return resolve();
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.start();
  });

  const out = new Map<number, PmdSheet>();
  for (const s of sheets) {
    if (s.src !== s.id) {
      if (!recolor(scene, pmdKey(s.src, 'walk'), pmdKey(s.id, 'walk'), shinyHue(s.id), s.walk)) continue;
      if (s.hasIdle && !recolor(scene, pmdKey(s.src, 'idle'), pmdKey(s.id, 'idle'), shinyHue(s.id), s.idle)) s.hasIdle = false;
    }
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
    out.set(s.id, { id: s.id, walk: s.walk, idle: s.idle, hasIdle: s.hasIdle });
  }
  return out;
}
