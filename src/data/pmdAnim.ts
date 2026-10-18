// Sprites animados de PMDCollab SpriteCollab (estilo Mystery Dungeon, CC BY-NC 4.0): elegir la dirección (de 8)
// y leer AnimData.xml. Lógica pura, sin Phaser ni red, para poder testearla.

/** Filas de las hojas de SpriteCollab, de arriba a abajo. */
export const DIR8 = ['down', 'down-right', 'right', 'up-right', 'up', 'up-left', 'left', 'down-left'] as const;
export type Dir8 = (typeof DIR8)[number];

/**
 * Fila (0-7) de la dirección más cercana a un vector de pantalla (la y crece hacia abajo).
 * Sin vector (0, 0) devuelve `fallback` (por defecto, abajo).
 */
export function dir8Row(x: number, y: number, fallback = 0): number {
  if (x === 0 && y === 0) return fallback;
  // Sector de 45° empezando por la derecha y girando hacia abajo (sentido de las agujas en pantalla)
  const sector = ((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8;
  // derecha, abajo-derecha, abajo, abajo-izquierda, izquierda, arriba-izquierda, arriba, arriba-derecha
  return [2, 1, 0, 7, 6, 5, 4, 3][sector];
}

export interface AnimInfo {
  frameWidth: number;
  frameHeight: number;
  /** Duración de cada frame en "ticks" de 1/60 s (como en los juegos de Mystery Dungeon). */
  durations: number[];
}

/**
 * Lee AnimData.xml: nombre → tamaño de frame y duraciones. Las que son `CopyOf` de otra toman sus datos.
 * Se hace con expresiones regulares (sirve igual en el navegador y en los tests).
 */
export function parseAnimData(xml: string): Record<string, AnimInfo> {
  const raw: Record<string, Partial<AnimInfo> & { copyOf?: string }> = {};
  for (const block of xml.match(/<Anim>[\s\S]*?<\/Anim>/g) ?? []) {
    const tag = (t: string) => block.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1]?.trim();
    const name = tag('Name');
    if (!name) continue;
    const durations = [...block.matchAll(/<Duration>(\d+)<\/Duration>/g)].map((m) => Number(m[1]));
    raw[name] = {
      frameWidth: Number(tag('FrameWidth')) || undefined,
      frameHeight: Number(tag('FrameHeight')) || undefined,
      durations: durations.length ? durations : undefined,
      copyOf: tag('CopyOf'),
    };
  }
  const out: Record<string, AnimInfo> = {};
  const resolve = (name: string, depth = 0): AnimInfo | undefined => {
    const a = raw[name];
    if (!a || depth > 5) return undefined;
    if (a.copyOf) return resolve(a.copyOf, depth + 1);
    if (!a.frameWidth || !a.frameHeight || !a.durations) return undefined;
    return { frameWidth: a.frameWidth, frameHeight: a.frameHeight, durations: a.durations };
  };
  for (const name of Object.keys(raw)) {
    const a = resolve(name);
    if (a) out[name] = a;
  }
  return out;
}

/** Carpeta de SpriteCollab: el número de Pokédex con 4 cifras. */
export const spriteCollabId = (id: number): string => String(Math.max(0, Math.floor(id))).padStart(4, '0');

export const SPRITE_COLLAB = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite';
export const animDataUrl = (id: number) => `${SPRITE_COLLAB}/${spriteCollabId(id)}/AnimData.xml`;
export const animSheetUrl = (id: number, anim: string) => `${SPRITE_COLLAB}/${spriteCollabId(id)}/${anim}-Anim.png`;

/** Milisegundos de un frame a partir de sus ticks de 1/60 s. */
export const ticksToMs = (ticks: number): number => (Math.max(1, ticks) * 1000) / 60;

/**
 * Escala para ver un sprite de SpriteCollab a un tamaño parecido al de antes: el Pokémon ocupa más o menos un
 * 80 % del frame de 32 px de los sprites medianos.
 */
export const pmdScale = (displaySize: number): number => (displaySize * 0.8) / 32;
