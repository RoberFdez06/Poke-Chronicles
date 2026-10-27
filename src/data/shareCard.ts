// T82: lo que sale en la imagen de la partida (tarjeta PNG de 1200×630). Lógica pura: textos y datos;
// el dibujo está en SummaryScene (shareCardImage).
import { MODE_LABEL, progressText } from './modes.ts';
import { formatDuration, type RunRecord } from './runHistory.ts';

/** Tamaño de la imagen (el de las vistas previas de las redes). */
export const CARD_W = 1200;
export const CARD_H = 630;
/** Cuántos objetos caben en la tarjeta; el resto sale como «+N». */
export const CARD_MAX_ITEMS = 12;
/** Texto para las partidas sin código de semilla (las de antes de T81). */
export const NO_SEED_TEXT = 'Sin código de semilla';

export interface CardItem {
  name: string;
  count: number;
}

export interface CardStat {
  label: string;
  value: string;
}

export interface ShareCard {
  title: string;
  pokemon: string;
  mode: string;
  /** «¡Victoria!» o «Hasta el piso 4». */
  result: string;
  won: boolean;
  stats: CardStat[];
  items: CardItem[];
  /** Objetos que no caben (0 si caben todos). */
  moreItems: number;
  seedText: string;
  fileName: string;
}

/** «Bola Lupa x2» → { name: 'Bola Lupa', count: 2 }. */
export function parseItemLabel(label: string): CardItem {
  const m = / x(\d+)$/.exec(label);
  return { name: label.replace(/ x\d+$/, ''), count: m ? Math.max(1, Number(m[1])) : 1 };
}

/** Nombre del archivo: «pokeisaac-pikachu-2026-10-26.png» (sin tildes ni espacios). */
export function cardFileName(pokemon: string, endedAt: number): string {
  const slug = pokemon
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'partida';
  const d = new Date(Number.isFinite(endedAt) ? endedAt : 0);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `pokeisaac-${slug}-${day}.png`;
}

/** Datos de la tarjeta a partir del registro de la partida y, si ya existe (T81), su código de semilla. */
export function shareCardData(r: RunRecord, seedCode?: string): ShareCard {
  const items = r.items.map(parseItemLabel);
  const code = seedCode?.trim();
  return {
    title: 'Poké Chronicles',
    pokemon: r.starterName,
    mode: MODE_LABEL[r.mode],
    result: r.won ? '¡Victoria!' : `Hasta ${progressText(r.mode, r.floor).toLowerCase()}`,
    won: r.won,
    stats: [
      { label: 'Tiempo', value: formatDuration(r.seconds) },
      { label: 'Enemigos vencidos', value: `${r.kills}` },
      { label: 'Parrys', value: `${r.parries ?? 0}` },
      { label: 'Objetos', value: `${items.reduce((n, i) => n + i.count, 0)}` },
    ],
    items: items.slice(0, CARD_MAX_ITEMS),
    moreItems: Math.max(0, items.length - CARD_MAX_ITEMS),
    seedText: code ? `Código: ${code.toUpperCase()}` : NO_SEED_TEXT,
    fileName: cardFileName(r.starterName, r.endedAt),
  };
}
