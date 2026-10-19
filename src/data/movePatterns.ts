// Catálogo de ataques (supervisor, 19/10): cómo sale cada movimiento, inspirado en sus animaciones de los juegos.
// - Cada tipo tiene 6-8 estilos (Lanzallamas en chorro, Llamarada que estalla, Rueda Fuego que gira a tu alrededor…).
// - Los movimientos más conocidos tienen el suyo exacto (por id de PokeAPI o por su nombre en español).
// - El resto elige un estilo de su tipo según su id y su potencia (los flojos, estilos ligeros; los fuertes, pesados).
// - El disparo normal depende del tipo del Pokémon, y los enemigos y jefes usan estilos de su tipo.
// Lógica pura (sin Phaser): el motor que lo dibuja y mueve está en src/scenes/attacks.ts.

/** Cómo se mueve un proyectil después de salir. */
export type Motion =
  | { m: 'straight' }
  | { m: 'wave'; amp: number; freq: number } // ondula (px de amplitud, ondas por segundo)
  | { m: 'zigzag'; every: number; angle: number } // cambia de lado cada `every` ms
  | { m: 'accel'; to: number; ms: number } // su velocidad pasa a ser `to` veces la inicial en `ms`
  | { m: 'homing'; turn: number; delay?: number } // gira hacia el objetivo más cercano (rad/s)
  | { m: 'boomerang'; outMs: number } // va y vuelve a quien lo lanzó
  | { m: 'spiral'; turn: number }; // gira siempre (rad/s): espirales

/** Animación del propio proyectil. */
export type Anim = 'none' | 'pulse' | 'flicker' | 'spin' | 'wobble';

export interface ShotPattern {
  k: 'shot';
  /** Cuántos a la vez, repartidos en `spread` radianes. */
  n: number;
  spread: number;
  speed: number;
  size: number;
  motion?: Motion;
  anim?: Anim;
  life?: number;
  pierce?: number;
  /** Ráfagas: `burst` disparos seguidos separados `gap` ms (en vez de `n` a la vez). */
  burst?: number;
  gap?: number;
  /** Estalla al acabar o al chocar con este radio. */
  explode?: number;
}

export type Pattern =
  | ShotPattern
  /** Chorro continuo (Lanzallamas, Ventisca): muchas partículas cortas durante `ms`. */
  | { k: 'stream'; ms: number; every: number; spread: number; speed: number; size: number; life: number }
  /** Rayo continuo hacia donde miras (Hidrobomba, Rayo Hielo, Hiperrayo); `sweep` = radianes que barre. */
  | { k: 'beam'; ms: number; width: number; length: number; sweep?: number }
  /** Anillo en todas direcciones (`rings` anillos seguidos). */
  | { k: 'nova'; n: number; speed: number; size: number; rings?: number; motion?: Motion; anim?: Anim }
  /** Onda en el suelo que se abre desde ti (Terremoto). */
  | { k: 'quake'; radius: number; ms: number }
  /** Caen del cielo en una zona alrededor del objetivo, con aviso (Trueno, Avalancha, Cometa Draco). */
  | { k: 'rain'; n: number; radius: number; area: number; delay: number; spacing: number }
  /** Bolas que van por el aire en parábola y estallan al caer (Bomba Lodo, Lanzarrocas). `dist` 0 = al objetivo. */
  | { k: 'lob'; n: number; radius: number; dist: number; spread: number }
  /** Giran a tu alrededor un rato (Rueda Fuego, Danza Pétalo, Poder Pasado). */
  | { k: 'orbit'; n: number; radius: number; ms: number; size: number }
  /** Muro de proyectiles en fila que avanza (Surf, Viento Hielo). */
  | { k: 'wall'; n: number; gap: number; speed: number; size: number; life: number }
  /** Descarga que salta de un enemigo a otro (Rayo, Beso Drenaje). */
  | { k: 'chain'; jumps: number; range: number }
  /** Columnas que brotan del suelo en línea (Tierra Viva, Roca Afilada, Erupción). */
  | { k: 'eruption'; steps: number; gap: number; radius: number; every: number }
  /** Trampas en el suelo que estallan al pisarlas (Púas Tóxicas, Drenadoras). */
  | { k: 'mine'; n: number; radius: number; life: number }
  /** Embestida: te lanzas hacia delante golpeando lo que tocas (Envite Ígneo, A Bocajarro, Pájaro Osado). */
  | { k: 'dash'; dist: number; ms: number; radius: number }
  /** Remolino que atrapa y daña a quien está dentro (Torbellino, Giro Fuego, Tornado). */
  | { k: 'vortex'; radius: number; ms: number; dist: number };

export type PatternKind = Pattern['k'];

export interface MoveStyle {
  /** Nombre del estilo (el del movimiento que lo inspira). */
  id: string;
  pattern: Pattern;
  /** Daño de cada golpe respecto al daño del poder. */
  mul: number;
  /** Recarga respecto a la normal del movimiento. */
  cd: number;
}

const S = (id: string, pattern: Pattern, mul: number, cd = 1): MoveStyle => ({ id, pattern, mul, cd });
const shot = (o: Partial<ShotPattern>): ShotPattern => ({ k: 'shot', n: 1, spread: 0, speed: 560, size: 1, ...o });

/** Estilos de cada tipo, de más ligeros a más pesados. */
export const TYPE_STYLES: Record<string, MoveStyle[]> = {
  fire: [
    S('Ascuas', shot({ burst: 3, gap: 90, speed: 620, size: 0.9, anim: 'flicker' }), 0.55),
    S('Lanzallamas', { k: 'stream', ms: 700, every: 40, spread: 0.32, speed: 520, size: 0.95, life: 430 }, 0.2),
    S('Rueda Fuego', { k: 'orbit', n: 3, radius: 78, ms: 2400, size: 1.3 }, 0.45, 1.1),
    S('Giro Fuego', { k: 'vortex', radius: 95, ms: 1600, dist: 220 }, 0.22),
    S('Onda Ígnea', { k: 'wall', n: 5, gap: 34, speed: 380, size: 1.2, life: 900 }, 0.6),
    S('Llamarada', shot({ speed: 380, size: 2.2, anim: 'pulse', explode: 110, life: 900 }), 1.5, 1.2),
    S('Erupción', { k: 'eruption', steps: 5, gap: 80, radius: 58, every: 110 }, 0.75, 1.2),
    S('Envite Ígneo', { k: 'dash', dist: 260, ms: 260, radius: 60 }, 1.3, 1.2),
  ],
  water: [
    S('Pistola Agua', shot({ burst: 3, gap: 70, speed: 700, size: 0.9, anim: 'wobble' }), 0.55),
    S('Burbuja', shot({ n: 6, spread: 1.1, speed: 300, size: 1, motion: { m: 'wave', amp: 22, freq: 2.5 }, anim: 'pulse', life: 1300 }), 0.4),
    S('Hidropulso', shot({ speed: 460, size: 1.6, anim: 'pulse', explode: 85 }), 1.2),
    S('Torbellino', { k: 'vortex', radius: 100, ms: 1800, dist: 230 }, 0.2),
    S('Surf', { k: 'wall', n: 7, gap: 30, speed: 330, size: 1.4, life: 1300 }, 0.7, 1.1),
    S('Cascada', { k: 'rain', n: 5, radius: 52, area: 200, delay: 420, spacing: 90 }, 0.9),
    S('Hidrobomba', { k: 'beam', ms: 650, width: 36, length: 560 }, 0.33, 1.3),
  ],
  electric: [
    S('Impactrueno', shot({ speed: 720, size: 1, motion: { m: 'zigzag', every: 70, angle: 0.9 }, anim: 'flicker' }), 1.1),
    S('Chispa', shot({ n: 3, spread: 0.5, speed: 640, size: 0.9, motion: { m: 'zigzag', every: 60, angle: 0.8 }, anim: 'flicker' }), 0.6),
    S('Rayo', { k: 'chain', jumps: 4, range: 280 }, 1.0),
    S('Bola Voltio', shot({ speed: 380, size: 1.4, motion: { m: 'homing', turn: 4 }, anim: 'flicker', life: 1600 }), 1.2),
    S('Chispazo', { k: 'nova', n: 12, speed: 480, size: 0.9, motion: { m: 'zigzag', every: 80, angle: 0.7 } }, 0.5),
    S('Trueno', { k: 'rain', n: 4, radius: 48, area: 220, delay: 380, spacing: 120 }, 1.2, 1.1),
    S('Electrocañón', { k: 'beam', ms: 500, width: 30, length: 620 }, 0.4, 1.3),
  ],
  grass: [
    S('Látigo Cepa', shot({ speed: 600, size: 1, motion: { m: 'wave', amp: 26, freq: 4 }, life: 700 }), 1.1),
    S('Hoja Afilada', shot({ n: 4, spread: 0.6, speed: 560, size: 0.9, motion: { m: 'homing', turn: 2.4, delay: 150 }, anim: 'spin' }), 0.5),
    S('Hoja Mágica', shot({ n: 2, spread: 0.3, speed: 480, size: 1, motion: { m: 'boomerang', outMs: 480 }, anim: 'spin', pierce: 3 }), 0.6),
    S('Danza Pétalo', { k: 'orbit', n: 6, radius: 92, ms: 2600, size: 1 }, 0.35, 1.1),
    S('Drenadoras', { k: 'mine', n: 3, radius: 60, life: 5000 }, 0.9),
    S('Energibola', shot({ speed: 420, size: 1.8, anim: 'pulse', explode: 90 }), 1.3, 1.1),
    S('Lluvia Hojas', { k: 'nova', n: 10, speed: 360, size: 1, motion: { m: 'spiral', turn: 3 }, rings: 2 }, 0.45, 1.2),
    S('Rayo Solar', { k: 'beam', ms: 800, width: 52, length: 640 }, 0.36, 1.5),
  ],
  ice: [
    S('Canto Helado', shot({ burst: 3, gap: 80, speed: 820, size: 0.9 }), 0.55),
    S('Nieve Polvo', { k: 'nova', n: 10, speed: 300, size: 0.9, motion: { m: 'accel', to: 0.3, ms: 700 } }, 0.45),
    S('Carámbano', shot({ n: 3, spread: 0.35, speed: 720, size: 1.1, pierce: 1 }), 0.65),
    S('Viento Hielo', { k: 'wall', n: 6, gap: 30, speed: 360, size: 1.1, life: 1000 }, 0.6),
    S('Rayo Hielo', { k: 'beam', ms: 550, width: 28, length: 580 }, 0.38, 1.2),
    S('Chuzos', { k: 'rain', n: 6, radius: 42, area: 220, delay: 380, spacing: 70 }, 0.8),
    S('Ventisca', { k: 'stream', ms: 900, every: 35, spread: 0.9, speed: 460, size: 1, life: 520 }, 0.18, 1.3),
  ],
  fighting: [
    S('Golpe Kárate', shot({ speed: 760, size: 1.2, life: 260 }), 1.4),
    S('Onda Vacío', shot({ burst: 3, gap: 80, speed: 900, size: 1 }), 0.55),
    S('Patada Giro', { k: 'nova', n: 8, speed: 520, size: 1.1 }, 0.55),
    S('Esfera Aural', shot({ speed: 420, size: 1.6, motion: { m: 'homing', turn: 5 }, anim: 'pulse', life: 1700 }), 1.3, 1.1),
    S('Patada Salto', { k: 'dash', dist: 240, ms: 220, radius: 56 }, 1.3),
    S('Puño Drenaje', shot({ speed: 640, size: 1.4, life: 380, explode: 60 }), 1.2),
    S('Demolición', { k: 'quake', radius: 170, ms: 420 }, 1.0, 1.2),
    S('A Bocajarro', { k: 'dash', dist: 200, ms: 200, radius: 70 }, 1.7, 1.4),
  ],
  poison: [
    S('Picotazo Veneno', shot({ burst: 3, gap: 80, speed: 680, size: 0.9 }), 0.55),
    S('Ácido', shot({ n: 3, spread: 0.6, speed: 460, size: 1, motion: { m: 'wave', amp: 12, freq: 3 } }), 0.65),
    S('Púas Tóxicas', { k: 'mine', n: 4, radius: 56, life: 6000 }, 0.8),
    S('Bomba Lodo', { k: 'lob', n: 1, radius: 95, dist: 300, spread: 0 }, 1.4, 1.1),
    S('Residuos', { k: 'stream', ms: 650, every: 55, spread: 0.45, speed: 360, size: 1.1, life: 600 }, 0.24),
    S('Onda Tóxica', { k: 'quake', radius: 200, ms: 520 }, 0.9, 1.2),
  ],
  ground: [
    S('Bofetón Lodo', shot({ n: 3, spread: 0.5, speed: 520, size: 1 }), 0.6),
    S('Huesomerang', shot({ speed: 560, size: 1.3, motion: { m: 'boomerang', outMs: 520 }, anim: 'spin', pierce: 5 }), 1.0),
    S('Bomba Fango', { k: 'lob', n: 2, radius: 75, dist: 280, spread: 0.4 }, 0.9),
    S('Excavar', { k: 'dash', dist: 260, ms: 320, radius: 64 }, 1.3, 1.2),
    S('Tierra Viva', { k: 'eruption', steps: 5, gap: 82, radius: 55, every: 100 }, 0.8, 1.1),
    S('Terremoto', { k: 'quake', radius: 300, ms: 700 }, 1.1, 1.4),
  ],
  flying: [
    S('Picotazo', shot({ burst: 4, gap: 60, speed: 760, size: 0.9 }), 0.4),
    S('Ataque Ala', shot({ n: 2, spread: 0.5, speed: 640, size: 1.2 }), 0.7),
    S('Aire Afilado', shot({ n: 3, spread: 0.45, speed: 780, size: 1.1, pierce: 2 }), 0.6),
    S('Tornado', { k: 'vortex', radius: 105, ms: 1700, dist: 250 }, 0.22),
    S('Vendaval', { k: 'wall', n: 6, gap: 34, speed: 420, size: 1.2, life: 1000 }, 0.65, 1.1),
    S('Pájaro Osado', { k: 'dash', dist: 320, ms: 260, radius: 66 }, 1.6, 1.4),
  ],
  psychic: [
    S('Confusión', shot({ speed: 460, size: 1.2, motion: { m: 'wave', amp: 30, freq: 2 }, anim: 'pulse' }), 1.1),
    S('Psicorrayo', { k: 'beam', ms: 450, width: 26, length: 520, sweep: 0.3 }, 0.32),
    S('Psicocorte', shot({ n: 2, spread: 0.4, speed: 560, size: 1.3, motion: { m: 'boomerang', outMs: 520 }, pierce: 3 }), 0.6),
    S('Onda Mental', shot({ n: 3, spread: 1, speed: 360, size: 1.2, motion: { m: 'homing', turn: 3.5, delay: 200 }, anim: 'pulse', life: 1700 }), 0.6),
    S('Psíquico', { k: 'nova', n: 12, speed: 420, size: 1, rings: 2, anim: 'pulse' }, 0.4, 1.1),
    S('Premonición', { k: 'rain', n: 3, radius: 70, area: 160, delay: 900, spacing: 160 }, 1.5, 1.2),
  ],
  bug: [
    S('Picadura', shot({ speed: 640, size: 1, life: 450 }), 1.2),
    S('Pin Misil', shot({ burst: 5, gap: 55, speed: 820, size: 0.8 }), 0.35),
    S('Tijera X', shot({ n: 2, spread: 0.7, speed: 560, size: 1.3, pierce: 3 }), 0.7),
    S('Disparo Demora', { k: 'mine', n: 3, radius: 64, life: 5000 }, 0.6),
    S('Zumbido', { k: 'nova', n: 14, speed: 440, size: 0.8, motion: { m: 'wave', amp: 10, freq: 6 } }, 0.4),
    S('Megacuerno', { k: 'dash', dist: 260, ms: 240, radius: 60 }, 1.5, 1.3),
  ],
  rock: [
    S('Lanzarrocas', { k: 'lob', n: 2, radius: 64, dist: 260, spread: 0.5 }, 0.8),
    S('Pedrada', shot({ speed: 420, size: 1.8, anim: 'spin', explode: 70 }), 1.2),
    S('Poder Pasado', { k: 'orbit', n: 5, radius: 70, ms: 1800, size: 1.1 }, 0.4),
    S('Tumba Rocas', { k: 'wall', n: 5, gap: 36, speed: 300, size: 1.5, life: 1000 }, 0.65),
    S('Roca Afilada', { k: 'eruption', steps: 6, gap: 70, radius: 50, every: 90 }, 0.75, 1.2),
    S('Avalancha', { k: 'rain', n: 7, radius: 52, area: 240, delay: 420, spacing: 70 }, 0.75, 1.3),
  ],
  ghost: [
    S('Lengüetazo', { k: 'dash', dist: 150, ms: 180, radius: 54 }, 1.1),
    S('Garra Umbría', shot({ n: 3, spread: 0.5, speed: 600, size: 1.1, life: 420 }), 0.65),
    S('Puño Sombra', shot({ speed: 520, size: 1.2, motion: { m: 'homing', turn: 6 }, life: 1500 }), 1.2),
    S('Infortunio', shot({ n: 4, spread: 1.2, speed: 300, size: 1.1, motion: { m: 'wave', amp: 30, freq: 1.6 }, anim: 'wobble', life: 1600 }), 0.45),
    S('Tinieblas', { k: 'beam', ms: 450, width: 30, length: 520 }, 0.34),
    S('Rencor', { k: 'nova', n: 10, speed: 360, size: 1.1, motion: { m: 'wave', amp: 16, freq: 2 } }, 0.5),
    S('Bola Sombra', shot({ speed: 400, size: 1.9, motion: { m: 'homing', turn: 2 }, anim: 'pulse', explode: 95, life: 1600 }), 1.4, 1.2),
  ],
  dragon: [
    S('Aliento Dragón', { k: 'stream', ms: 600, every: 45, spread: 0.3, speed: 500, size: 1, life: 450 }, 0.24),
    S('Garra Dragón', shot({ n: 3, spread: 0.55, speed: 620, size: 1.2, life: 420 }), 0.7),
    S('Ciclón', { k: 'vortex', radius: 110, ms: 1700, dist: 220 }, 0.24),
    S('Pulso Dragón', { k: 'beam', ms: 500, width: 34, length: 600, sweep: 0.6 }, 0.4, 1.2),
    S('Enfado', { k: 'dash', dist: 280, ms: 280, radius: 70 }, 1.4, 1.3),
    S('Cometa Draco', { k: 'rain', n: 5, radius: 70, area: 230, delay: 500, spacing: 120 }, 1.2, 1.5),
  ],
  dark: [
    S('Mordisco', shot({ speed: 600, size: 1.2, life: 320 }), 1.3),
    S('Tajo Umbrío', shot({ n: 2, spread: 0.6, speed: 640, size: 1.2, pierce: 2 }), 0.7),
    S('Golpe Bajo', { k: 'dash', dist: 220, ms: 180, radius: 56 }, 1.3),
    S('Desarme', shot({ speed: 520, size: 1.2, motion: { m: 'boomerang', outMs: 450 }, anim: 'spin', pierce: 3 }), 0.9),
    S('Pulso Umbrío', { k: 'nova', n: 12, speed: 440, size: 1, rings: 2 }, 0.42, 1.1),
    S('Alarido', { k: 'quake', radius: 180, ms: 420 }, 0.9, 1.1),
    S('Triturar', shot({ speed: 380, size: 1.9, life: 520, explode: 80 }), 1.4, 1.2),
  ],
  steel: [
    S('Bala Bala', shot({ burst: 4, gap: 55, speed: 900, size: 0.8 }), 0.4),
    S('Garra Metal', shot({ n: 3, spread: 0.5, speed: 640, size: 1.1, life: 420 }), 0.65),
    S('Disco Espejo', shot({ speed: 560, size: 1.3, motion: { m: 'boomerang', outMs: 520 }, anim: 'spin', pierce: 4 }), 1.0),
    S('Cola Férrea', { k: 'quake', radius: 150, ms: 380 }, 1.0),
    S('Cabeza de Hierro', { k: 'dash', dist: 240, ms: 220, radius: 62 }, 1.4, 1.2),
    S('Foco Resplandor', { k: 'beam', ms: 520, width: 32, length: 600 }, 0.4, 1.3),
  ],
  fairy: [
    S('Viento Feérico', { k: 'wall', n: 5, gap: 34, speed: 380, size: 1.1, life: 1000 }, 0.6),
    S('Voz Cautivadora', shot({ n: 3, spread: 0.9, speed: 420, size: 1.1, motion: { m: 'homing', turn: 4, delay: 150 }, anim: 'pulse', life: 1500 }), 0.55),
    S('Beso Drenaje', { k: 'chain', jumps: 2, range: 240 }, 1.0),
    S('Brillo Mágico', { k: 'nova', n: 14, speed: 460, size: 1, anim: 'flicker' }, 0.42, 1.1),
    S('Carantoña', { k: 'dash', dist: 220, ms: 220, radius: 62 }, 1.4, 1.2),
    S('Fuerza Lunar', shot({ speed: 380, size: 2, anim: 'pulse', explode: 105, life: 1000 }), 1.5, 1.3),
  ],
  normal: [
    S('Placaje', { k: 'dash', dist: 180, ms: 180, radius: 56 }, 1.1),
    S('Rapidez', shot({ n: 5, spread: 1, speed: 520, size: 1, motion: { m: 'homing', turn: 5, delay: 120 }, anim: 'spin' }), 0.38),
    S('Triataque', shot({ n: 3, spread: 0.5, speed: 560, size: 1.2, anim: 'flicker' }), 0.7),
    S('Golpe Cuerpo', { k: 'dash', dist: 220, ms: 220, radius: 66 }, 1.3, 1.1),
    S('Vozarrón', { k: 'nova', n: 12, speed: 500, size: 1, rings: 2 }, 0.42),
    S('Explosión', { k: 'quake', radius: 280, ms: 420 }, 1.6, 1.6),
    S('Hiperrayo', { k: 'beam', ms: 700, width: 54, length: 680 }, 0.42, 1.7),
  ],
};

/** Normaliza un nombre para compararlo: minúsculas y sin tildes. */
export const normName = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Movimientos famosos: id de PokeAPI → estilo de su tipo (por nombre). */
const FAMOUS_IDS: Record<number, string> = {
  52: 'Ascuas', 53: 'Lanzallamas', 83: 'Giro Fuego', 126: 'Llamarada', 172: 'Rueda Fuego', 257: 'Onda Ígnea', 284: 'Erupción', 394: 'Envite Ígneo',
  55: 'Pistola Agua', 145: 'Burbuja', 61: 'Burbuja', 352: 'Hidropulso', 250: 'Torbellino', 57: 'Surf', 127: 'Cascada', 56: 'Hidrobomba',
  84: 'Impactrueno', 209: 'Chispa', 85: 'Rayo', 87: 'Trueno', 435: 'Chispazo', 192: 'Electrocañón',
  22: 'Látigo Cepa', 75: 'Hoja Afilada', 345: 'Hoja Mágica', 80: 'Danza Pétalo', 73: 'Drenadoras', 412: 'Energibola', 437: 'Lluvia Hojas', 76: 'Rayo Solar',
  420: 'Canto Helado', 181: 'Nieve Polvo', 58: 'Rayo Hielo', 196: 'Viento Hielo', 59: 'Ventisca', 556: 'Chuzos',
  2: 'Golpe Kárate', 410: 'Onda Vacío', 27: 'Patada Giro', 396: 'Esfera Aural', 26: 'Patada Salto', 136: 'Patada Salto', 409: 'Puño Drenaje', 280: 'Demolición', 370: 'A Bocajarro',
  40: 'Picotazo Veneno', 51: 'Ácido', 390: 'Púas Tóxicas', 188: 'Bomba Lodo', 124: 'Residuos', 482: 'Onda Tóxica',
  189: 'Bofetón Lodo', 155: 'Huesomerang', 426: 'Bomba Fango', 91: 'Excavar', 414: 'Tierra Viva', 89: 'Terremoto',
  64: 'Picotazo', 65: 'Picotazo', 17: 'Ataque Ala', 403: 'Aire Afilado', 16: 'Tornado', 542: 'Vendaval', 413: 'Pájaro Osado',
  93: 'Confusión', 60: 'Psicorrayo', 427: 'Psicocorte', 94: 'Psíquico', 248: 'Premonición',
  450: 'Picadura', 42: 'Pin Misil', 404: 'Tijera X', 81: 'Disparo Demora', 405: 'Zumbido', 224: 'Megacuerno',
  88: 'Lanzarrocas', 246: 'Poder Pasado', 317: 'Tumba Rocas', 444: 'Roca Afilada', 157: 'Avalancha',
  122: 'Lengüetazo', 421: 'Garra Umbría', 325: 'Puño Sombra', 506: 'Infortunio', 101: 'Tinieblas', 247: 'Bola Sombra',
  225: 'Aliento Dragón', 82: 'Aliento Dragón', 337: 'Garra Dragón', 239: 'Ciclón', 406: 'Pulso Dragón', 200: 'Enfado', 434: 'Cometa Draco',
  44: 'Mordisco', 555: 'Alarido', 400: 'Tajo Umbrío', 389: 'Golpe Bajo', 282: 'Desarme', 399: 'Pulso Umbrío', 242: 'Triturar',
  418: 'Bala Bala', 232: 'Garra Metal', 231: 'Cola Férrea', 442: 'Cabeza de Hierro', 430: 'Foco Resplandor',
  584: 'Viento Feérico', 574: 'Voz Cautivadora', 577: 'Beso Drenaje', 605: 'Brillo Mágico', 583: 'Carantoña', 585: 'Fuerza Lunar',
  33: 'Placaje', 129: 'Rapidez', 161: 'Triataque', 34: 'Golpe Cuerpo', 304: 'Vozarrón', 153: 'Explosión', 120: 'Explosión', 63: 'Hiperrayo', 416: 'Hiperrayo',
};

/** El estilo de un tipo por su nombre. */
export function styleByName(type: string, name: string): MoveStyle | undefined {
  const list = TYPE_STYLES[type] ?? TYPE_STYLES.normal;
  const n = normName(name);
  return list.find((s) => normName(s.id) === n);
}

/** Pequeño hash estable para repartir movimientos entre estilos. */
const hash = (n: number) => {
  let x = Math.imul(n | 0, 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  return x >>> 0;
};

/**
 * Estilo de un movimiento: el suyo si es famoso (por id o por nombre); si no, uno de su tipo según su potencia
 * (flojos < 75: primera mitad de la lista; fuertes: segunda mitad) y su id, para que no salgan todos iguales.
 */
export function styleForMove(move: { id: number; name: string; type: string; power: number }): MoveStyle {
  const list = TYPE_STYLES[move.type] ?? TYPE_STYLES.normal;
  const byId = FAMOUS_IDS[move.id];
  const famous = (byId && styleByName(move.type, byId)) || styleByName(move.type, move.name);
  if (famous) return famous;
  const half = Math.ceil(list.length / 2);
  const band = move.power >= 75 ? list.slice(half - 1) : list.slice(0, half + 1);
  return band[hash(move.id) % band.length];
}

/** Cómo es el disparo normal según el tipo del Pokémon (el daño no cambia; solo cómo vuela). */
export interface BasicShot {
  motion?: Motion;
  anim?: Anim;
  /** Multiplica la velocidad del disparo. */
  speed: number;
  /** Multiplica el tamaño. */
  size: number;
  /** Atraviesa paredes y rocas (fantasma). */
  ghost?: boolean;
}
export const BASIC_SHOTS: Record<string, BasicShot> = {
  fire: { anim: 'flicker', speed: 1, size: 1 },
  water: { motion: { m: 'wave', amp: 10, freq: 3 }, anim: 'wobble', speed: 0.95, size: 1 },
  electric: { motion: { m: 'zigzag', every: 75, angle: 0.55 }, anim: 'flicker', speed: 1.15, size: 0.95 },
  grass: { motion: { m: 'wave', amp: 16, freq: 2.6 }, anim: 'spin', speed: 1, size: 1 },
  ice: { speed: 1.25, size: 0.9 },
  fighting: { speed: 1.2, size: 1.1 },
  poison: { motion: { m: 'wave', amp: 8, freq: 4 }, anim: 'wobble', speed: 0.9, size: 1.05 },
  ground: { anim: 'spin', speed: 0.85, size: 1.15 },
  flying: { motion: { m: 'wave', amp: 12, freq: 2 }, speed: 1.15, size: 1 },
  psychic: { motion: { m: 'homing', turn: 1.6, delay: 120 }, anim: 'pulse', speed: 0.9, size: 1 },
  bug: { speed: 1.2, size: 0.9 },
  rock: { anim: 'spin', speed: 0.8, size: 1.2 },
  ghost: { motion: { m: 'wave', amp: 14, freq: 1.8 }, anim: 'wobble', speed: 0.85, size: 1.05, ghost: true },
  dragon: { anim: 'pulse', speed: 1, size: 1.05 },
  dark: { anim: 'spin', speed: 1.05, size: 1 },
  steel: { anim: 'spin', speed: 1.15, size: 0.95 },
  fairy: { motion: { m: 'homing', turn: 1.4, delay: 150 }, anim: 'flicker', speed: 0.9, size: 1 },
  normal: { anim: 'spin', speed: 1, size: 1 },
};
export const basicShotFor = (type: string): BasicShot => BASIC_SHOTS[type] ?? BASIC_SHOTS.normal;

/** Ataque a distancia de los enemigos de cada tipo (sustituye al disparo simple). Velocidades en px/s. */
export const FOE_STYLES: Record<string, Pattern> = {
  fire: shot({ n: 3, spread: 0.45, speed: 300, size: 0.9, anim: 'flicker' }),
  water: shot({ speed: 240, size: 1.1, motion: { m: 'wave', amp: 20, freq: 2 }, anim: 'pulse', life: 2200 }),
  electric: shot({ speed: 380, size: 0.9, motion: { m: 'zigzag', every: 90, angle: 0.8 }, anim: 'flicker' }),
  grass: shot({ n: 2, spread: 0.4, speed: 280, size: 0.9, motion: { m: 'wave', amp: 18, freq: 2.4 }, anim: 'spin' }),
  ice: shot({ speed: 420, size: 0.9 }),
  fighting: shot({ speed: 440, size: 1.1, life: 700 }),
  poison: { k: 'lob', n: 1, radius: 55, dist: 0, spread: 0 },
  ground: shot({ speed: 230, size: 1.3, anim: 'spin' }),
  flying: shot({ n: 2, spread: 0.6, speed: 340, size: 1 }),
  psychic: shot({ speed: 200, size: 1.1, motion: { m: 'homing', turn: 1.4 }, anim: 'pulse', life: 2600 }),
  bug: shot({ burst: 3, gap: 120, speed: 360, size: 0.8 }),
  rock: { k: 'lob', n: 1, radius: 50, dist: 0, spread: 0 },
  ghost: shot({ speed: 200, size: 1.1, motion: { m: 'homing', turn: 1.2 }, anim: 'wobble', life: 2800 }),
  dragon: shot({ n: 3, spread: 0.5, speed: 300, size: 1 }),
  dark: shot({ speed: 340, size: 1.1, motion: { m: 'boomerang', outMs: 900 }, anim: 'spin' }),
  steel: shot({ speed: 400, size: 1, anim: 'spin' }),
  fairy: shot({ n: 3, spread: 0.9, speed: 220, size: 0.9, motion: { m: 'homing', turn: 0.9 }, anim: 'flicker', life: 2400 }),
  normal: shot({ speed: 320, size: 1 }),
};
export const foeStyleFor = (type: string): Pattern => FOE_STYLES[type] ?? FOE_STYLES.normal;

/** Formas que un jefe no usa (embiste aparte; cadenas, órbitas y trampas no se pueden esquivar bien o no pegan). */
const NOT_FOR_BOSS: readonly PatternKind[] = ['dash', 'chain', 'orbit', 'mine'];

/**
 * Movimientos de un jefe: un estilo ligero y uno pesado de cada uno de sus tipos (hasta 4). Siempre con aviso
 * antes (lo pone el motor).
 */
export function bossStyles(types: readonly string[], seed: number): MoveStyle[] {
  const out: MoveStyle[] = [];
  types.forEach((t, k) => {
    const list = (TYPE_STYLES[t] ?? TYPE_STYLES.normal).filter((s) => !NOT_FOR_BOSS.includes(s.pattern.k));
    if (list.length === 0) return;
    const half = Math.ceil(list.length / 2);
    const light = list.slice(0, half);
    const heavy = list.slice(half);
    out.push(light[hash(seed + k * 7) % light.length]);
    if (heavy.length) out.push(heavy[hash(seed + k * 13 + 1) % heavy.length]);
  });
  return out.filter((s, i) => out.findIndex((o) => o.id === s.id) === i).slice(0, 4);
}
