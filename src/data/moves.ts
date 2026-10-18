// Poderes del tipo de tu Pokémon: filtrar y elegir movimientos de PokeAPI.
// Lógica pura, sin Phaser ni red, para poder testearla.
import type { MoveInfo } from './items.ts';

/** Nombre traducido de PokeAPI (`names`), por defecto en español; si no hay, el de respaldo. */
export function localName(
  names: readonly { name: string; language: { name: string } }[] | undefined,
  fallback: string,
  lang = 'es',
): string {
  return names?.find((n) => n.language.name === lang)?.name ?? fallback;
}

export const idFromUrl = (url: string): number => Number(url.replace(/\/$/, '').split('/').pop());

/** Ids de los movimientos de una respuesta de `/type/{tipo}` (los de 10000 en adelante son especiales). */
export function typeMoveIds(moves: readonly { url: string }[]): number[] {
  return moves.map((m) => idFromUrl(m.url)).filter((id) => Number.isInteger(id) && id > 0 && id < 10000);
}

/** Un movimiento sirve como poder si tiene potencia y es de uno de los tipos de tu Pokémon. */
export function isUsableMove(m: Pick<MoveInfo, 'type' | 'power'>, types: readonly string[]): boolean {
  return !!m.power && m.power > 0 && types.includes(m.type);
}

export function filterMovesByTypes<T extends Pick<MoveInfo, 'type' | 'power'>>(moves: readonly T[], types: readonly string[]): T[] {
  return moves.filter((m) => isUsableMove(m, types));
}

/**
 * Elige hasta `n` ids distintos repartidos entre los tipos (por turnos, así un Pokémon de dos tipos
 * recibe poderes de los dos). `idsByType` va en el mismo orden que los tipos del Pokémon.
 */
export function pickMoveIds(idsByType: readonly (readonly number[])[], n: number, rng: () => number): number[] {
  const left = idsByType.map((ids) => [...new Set(ids)]);
  const out: number[] = [];
  let t = 0;
  while (out.length < n && left.some((l) => l.length > 0)) {
    const list = left[t % left.length];
    t++;
    if (list.length === 0) continue;
    const [id] = list.splice(Math.floor(rng() * list.length), 1);
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
