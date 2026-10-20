// Medallas de gimnasio: una por bioma, se ganan la primera vez que vences a su jefe. Lógica pura (testeable).

export interface Medal {
  /** Mismo id que el bioma. */
  id: string;
  name: string;
  color: number;
  /** Inicial grabada en la medalla. */
  glyph: string;
}

export const MEDALS: readonly Medal[] = [
  { id: 'bosque', name: 'Medalla Hoja', color: 0x4caf50, glyph: 'H' },
  { id: 'cueva', name: 'Medalla Roca', color: 0x9e8b6b, glyph: 'R' },
  { id: 'mar', name: 'Medalla Cascada', color: 0x2e8fe0, glyph: 'C' },
  { id: 'volcan', name: 'Medalla Volcán', color: 0xe8541c, glyph: 'V' },
  { id: 'torre', name: 'Medalla Alma', color: 0x7e57c2, glyph: 'A' },
  { id: 'ciudad', name: 'Medalla Trueno', color: 0xf5c518, glyph: 'T' },
  { id: 'nieve', name: 'Medalla Glaciar', color: 0x7fd6f0, glyph: 'G' },
  { id: 'pantano', name: 'Medalla Ciénaga', color: 0x6b7f2a, glyph: 'Ñ' },
  { id: 'cumbre', name: 'Medalla Cima', color: 0xd9d9e8, glyph: 'M' },
];

/** Tickets por conseguir una medalla nueva, y de más al reunirlas todas. */
export const MEDAL_TICKETS = 5;
export const ALL_MEDALS_BONUS = 30;

export function medalById(id: string): Medal | undefined {
  return MEDALS.find((m) => m.id === id);
}

/** Lee la lista guardada, descartando ids desconocidos y repetidos. */
export function parseMedals(raw: string | null): string[] {
  try {
    const v: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(v)) return [];
    return [...new Set(v.filter((x): x is string => typeof x === 'string' && !!medalById(x)))];
  } catch {
    return [];
  }
}

export interface MedalAward {
  medals: string[];
  /** Medalla nueva (undefined si ya la tenía o el bioma no tiene). */
  gained?: Medal;
  /** Tickets de premio. */
  tickets: number;
  /** Con esta ya están todas. */
  complete: boolean;
}

export function awardMedal(have: readonly string[], biomeId: string): MedalAward {
  const medal = medalById(biomeId);
  if (!medal || have.includes(biomeId)) {
    return { medals: [...have], tickets: 0, complete: false };
  }
  const medals = [...have, biomeId];
  const complete = medals.length === MEDALS.length;
  return { medals, gained: medal, tickets: MEDAL_TICKETS + (complete ? ALL_MEDALS_BONUS : 0), complete };
}
