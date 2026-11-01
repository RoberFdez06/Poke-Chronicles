// Firmas visuales de los ataques (auditoría 01/11): cada estilo del catálogo (movePatterns.ts) y cada combinación de
// fusión lleva un MOTIVO de pixel art propio (llamas, burbujas, plumas, engranajes…) que el arte (ui/art/moveFx2.ts)
// coloca según la FORMA del ataque (cono en los disparos, línea en chorros y rayos, anillo en ondas, caída en lluvias,
// estela en embestidas…). Así dos ataques con el mismo patrón ya no se ven igual con otro color.
// Lógica pura (sin Phaser) para poder testearla: datos de los motivos (mapas de bits 7×7) y reglas de asignación.
import { TYPE_STYLES, type MoveStyle, type Pattern, type PatternKind } from './movePatterns.ts';

/**
 * Motivos: mapa de bits 7×7. `.` vacío, `o` contorno, `#` color del tipo, `+` claro, `-` oscuro, `w` blanco.
 */
export const MOTIFS = {
  llamas: ['...o...', '..o#o..', '.o#+#o.', '.o#+#o.', 'o#+w+#o', 'o#+w+#o', '.o###o.'],
  burbujas: ['..ooo..', '.o###o.', 'o#w+##o', 'o#+###o', 'o#####o', '.o###o.', '..ooo..'],
  chispas: ['....oo.', '...o+o.', '..o+o..', '.o#w#o.', '..o#o..', '.o#o...', '.oo....'],
  hojas: ['....oo.', '..oo#o.', '.o#+#o.', 'o#+#o..', 'o#+o...', '.oo....', 'o......'],
  copos: ['...o...', '.o.#.o.', '..o+o..', 'o#+w+#o', '..o+o..', '.o.#.o.', '...o...'],
  puno: ['.ooooo.', 'o#+#+#o', 'o#####o', 'o####-o', 'o#####o', '.o###o.', '..ooo..'],
  gotas: ['...o...', '..o#o..', '.o#+#o.', 'o##+##o', 'o#####o', 'o#-#-#o', '.ooooo.'],
  terrones: ['.......', '..ooo..', '.o#+#o.', 'o##-#-o', 'o-###-o', '.ooooo.', '.......'],
  plumas: ['....oo.', '...o+o.', '..o+#o.', '.o+#o..', '.o#o...', 'o-o....', 'o......'],
  ojo: ['.......', '.ooooo.', 'o+###+o', 'o#-w-#o', 'o+###+o', '.ooooo.', '.......'],
  cuerno: ['...o...', '...o...', '..o#o..', '..o+o..', '.o#+#o.', '.o###o.', 'o-----o'],
  rocas: ['..ooo..', '.o+##o.', 'o+###-o', 'o###--o', 'o##---o', '.ooooo.', '.......'],
  espectros: ['..ooo..', '.o###o.', 'o#w#w#o', 'o#####o', 'o#####o', 'o#o#o#o', 'o.o.o.o'],
  colmillos: ['ooooooo', 'o+###+o', '.o#+#o.', '.o#+#o.', '..o#o..', '..o#o..', '...o...'],
  zarpas: ['o..o..o', '+o.+o.+', '#+o#+o#', '.#+.#+.', '..#..#.', '...o..o', '.......'],
  engranajes: ['.o.o.o.', 'o#o#o#o', '.o+++o.', 'o#+o+#o', '.o+++o.', 'o#o#o#o', '.o.o.o.'],
  corazones: ['.......', '.oo.oo.', 'o+#o##o', 'o#####o', '.o###o.', '..o#o..', '...o...'],
  estrellas: ['...o...', '..o+o..', 'oo#w#oo', 'o##+##o', '.o###o.', 'o#o.o#o', 'oo...oo'],
  anillo: ['.ooooo.', 'o#####o', 'o#...#o', 'o#.w.#o', 'o#...#o', 'o#####o', '.ooooo.'],
  runa: ['ooooooo', 'o#.#.#o', 'o.###.o', 'o##w##o', 'o.###.o', 'o#.#.#o', 'ooooooo'],
  notas: ['...oooo', '...o##o', '...o.o.', '...o.o.', '.ooo.o.', 'o##o...', '.oo....'],
  luna: ['..ooo..', '.o##o..', 'o#+o...', 'o#+o...', 'o#+o...', '.o##o..', '..ooo..'],
  rombo: ['...o...', '..o+o..', '.o+#-o.', 'o+#w#-o', '.o#-o..', '..o-o..', '...o...'],
  espiral: ['.ooooo.', 'o#####o', 'o#ooo#o', 'o#o+o#o', 'o#o##.o', 'o#ooooo', '.o.....'],
} as const satisfies Record<string, readonly string[]>;

export type Motif = keyof typeof MOTIFS;
export const MOTIF_IDS = Object.keys(MOTIFS) as Motif[];

/** Motivo base de cada tipo. */
export const TYPE_MOTIF: Readonly<Record<string, Motif>> = {
  fire: 'llamas', water: 'burbujas', electric: 'chispas', grass: 'hojas', ice: 'copos', fighting: 'puno',
  poison: 'gotas', ground: 'terrones', flying: 'plumas', psychic: 'ojo', bug: 'cuerno', rock: 'rocas',
  ghost: 'espectros', dragon: 'colmillos', dark: 'zarpas', steel: 'engranajes', fairy: 'corazones', normal: 'estrellas',
};

/**
 * Excepciones por estilo: los que se parecían a otro de su tipo con la misma forma (o piden un dibujo concreto por
 * su nombre) llevan un motivo propio.
 */
export const STYLE_MOTIF: Readonly<Record<string, Motif>> = {
  // Disparos del mismo tipo que solo cambiaban de tamaño o número
  Llamarada: 'estrellas', Hidropulso: 'anillo', 'Bola Voltio': 'anillo', Carámbano: 'rombo',
  'Onda Vacío': 'anillo', 'Puño Drenaje': 'espiral', 'Bofetón Lodo': 'gotas', 'Ataque Ala': 'luna',
  Psicocorte: 'luna', 'Onda Mental': 'runa', 'Pin Misil': 'rombo', 'Tijera X': 'zarpas', Pedrada: 'terrones',
  'Puño Sombra': 'puno', Infortunio: 'runa', 'Bola Sombra': 'anillo',
  Mordisco: 'colmillos', 'Tajo Umbrío': 'luna', Desarme: 'espiral', Triturar: 'colmillos', 'Bala Bala': 'rombo',
  'Garra Metal': 'zarpas', 'Disco Espejo': 'anillo', 'Fuerza Lunar': 'luna', 'Voz Cautivadora': 'notas', Rapidez: 'estrellas',
  Triataque: 'rombo', 'Picotazo Veneno': 'cuerno', Ácido: 'burbujas',
  'Hoja Mágica': 'estrellas', 'Hoja Afilada': 'rombo', Chispa: 'estrellas', 'Canto Helado': 'rombo', 'Golpe Kárate': 'zarpas',
  // Formas repetidas dentro del mismo tipo
  'A Bocajarro': 'espiral', 'Golpe Cuerpo': 'anillo', Vozarrón: 'notas', Alarido: 'notas', Psíquico: 'anillo',
  Premonición: 'runa', 'Cola Férrea': 'rombo', 'Rayo Solar': 'anillo', 'Pulso Dragón': 'espiral',
  Ciclón: 'espiral', 'Danza Pétalo': 'corazones', 'Poder Pasado': 'runa', 'Cometa Draco': 'estrellas',
  'Lluvia Hojas': 'espiral', Zumbido: 'notas', 'Brillo Mágico': 'estrellas', 'Pulso Umbrío': 'luna', 'Onda Tóxica': 'anillo',
  Demolición: 'rocas', 'Patada Giro': 'espiral', Chispazo: 'anillo', 'Nieve Polvo': 'rombo', Rencor: 'luna',
};

/** Motivo de un estilo (excepción o el de su tipo). */
export const motifFor = (styleId: string, type: string): Motif => STYLE_MOTIF[styleId] ?? TYPE_MOTIF[type] ?? 'estrellas';

/** Cómo se colocan los motivos según la forma del ataque. */
export type Layout = 'cono' | 'linea' | 'anillo' | 'caida' | 'remolino' | 'fila' | 'saltos' | 'estela' | 'brote';
export const LAYOUT_OF: Readonly<Record<PatternKind, Layout>> = {
  shot: 'cono', stream: 'linea', beam: 'linea', nova: 'anillo', quake: 'anillo', rain: 'caida', lob: 'caida',
  orbit: 'remolino', vortex: 'remolino', wall: 'fila', chain: 'saltos', eruption: 'brote', mine: 'brote', dash: 'estela',
};

/** Rasgos de un patrón que ya lo hacen distinto (para ver si dos ataques se repiten). */
export function patternTraits(p: Pattern): string {
  if (p.k === 'shot') {
    const many = p.burst ? `rafaga${p.burst}` : p.n > 1 ? `abanico${p.n}` : 'uno';
    return ['shot', many, p.motion?.m ?? 'recto', p.explode ? 'estalla' : '', p.pierce ? 'atraviesa' : '', p.size >= 1.6 ? 'grande' : ''].join('|');
  }
  if (p.k === 'nova') return ['nova', p.motion?.m ?? 'recto', p.rings ? 'anillos' : ''].join('|');
  if (p.k === 'beam') return ['beam', p.sweep ? 'barre' : 'fijo'].join('|');
  return p.k;
}

/** Firma visual completa: forma + rasgos + motivo. Dos estilos no deberían compartirla. */
export const visualKey = (s: MoveStyle, type: string): string => `${patternTraits(s.pattern)}#${motifFor(s.id, type)}`;

/** Clave «antigua» (antes de esta auditoría): solo la forma y sus rasgos; el color del tipo era lo único distinto. */
export const legacyKey = (s: MoveStyle): string => patternTraits(s.pattern);

/** Todos los estilos del jugador con su tipo. */
export function allStyles(): { type: string; style: MoveStyle }[] {
  return Object.entries(TYPE_STYLES).flatMap(([type, list]) => list.map((style) => ({ type, style })));
}

/** Grupos repetitivos de antes: estilos con la misma clave antigua (mismo patrón, otro color o nombre). */
export function legacyGroups(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const { type, style } of allStyles()) {
    const k = legacyKey(style);
    out.set(k, [...(out.get(k) ?? []), `${style.id} (${type})`]);
  }
  return new Map([...out].filter(([, v]) => v.length > 1));
}

/** Tono extra del sonido de cada motivo (semitonos, -5..+5), para que no suenen todos igual. */
export const motifTone = (m: Motif): number => (MOTIF_IDS.indexOf(m) % 11) - 5;

/** Motivo de cada combinación de fusión (una distinta por combinación). */
export const COMBO_MOTIF: Readonly<Record<string, Motif>> = {
  'rafaga-onda': 'anillo', 'abanico-perforante': 'rombo', 'orbitas-lluvia': 'estrellas', 'mina-ola': 'burbujas',
  'rebote-cadena': 'chispas', 'rayo-estallido': 'runa', 'terremoto-columnas': 'rocas', 'erupcion-bomba': 'llamas',
  'bumeran-espiral': 'espiral', 'chorro-bomba': 'gotas', 'embestida-onda': 'puno', meteoro: 'luna',
  'zigzag-cadena': 'zarpas', buscadores: 'ojo',
};
