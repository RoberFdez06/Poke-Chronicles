// Tutorial (T25): consejos cortos que salen la primera vez que pasa algo en la partida. Lógica pura; el guardado
// (qué consejos ya se han visto y si se han desactivado) está en save.ts.

export const TIP_IDS = ['move', 'shoot', 'pause', 'powers', 'items', 'active', 'center', 'shop', 'chest', 'forms', 'td_place', 'td_upgrade', 'td_air', 'td_skills'] as const;
export type TipId = (typeof TIP_IDS)[number];

/** Texto de cada consejo, con los tres controles (teclado, ratón y mando). */
export const TIPS: Readonly<Record<TipId, { title: string; text: string }>> = {
  move: {
    title: 'Moverse',
    text: 'W A S D, el stick izquierdo o mantén el clic derecho hacia donde quieras ir.',
  },
  shoot: {
    title: 'Disparar',
    text: 'Flechas (dos a la vez en diagonal), el stick derecho o mantén el clic izquierdo hacia el cursor.\nLimpia la sala para abrir las puertas.',
  },
  pause: {
    title: 'Pausa',
    text: 'Esc o P, Start, o el botón ❚❚ de arriba a la izquierda. La partida se guarda sola.',
  },
  powers: {
    title: 'Poderes',
    text: 'Los ataques de tu tipo van a las ranuras de la derecha: teclas 1-4, botones A B X Y o clic en la ranura.',
  },
  items: {
    title: 'Objetos',
    text: 'Los objetos se quedan toda la partida y se suman. ¡Algunos se combinan en sinergias!',
  },
  active: {
    title: 'Objeto activo',
    text: 'Se carga limpiando salas. Úsalo con Espacio, LB o clic en su cuadro (abajo a la izquierda).',
  },
  center: {
    title: 'Centro Pokémon',
    text: 'Te cura la mitad de los PS una vez por piso: Enter o A cerca del mostrador, clic en él o písalo.',
  },
  shop: {
    title: 'Tienda',
    text: 'Gasta las monedas de la partida: Enter o A cerca de un artículo, clic en él o písalo.',
  },
  chest: {
    title: 'Cofres y bombas',
    text: 'Los cofres se abren con una llave. Las bombas (E, RB o clic en la bomba del HUD) rompen rocas y abren paredes.',
  },
  forms: {
    title: 'Formas de poder',
    text: 'M, cruceta arriba o clic en el icono junto a la Poké Ball: usa la forma elegida. X, cruceta izquierda/derecha, clic derecho o rueda sobre el icono: cambia entre Mega, Dinamax, Teracristal y Movimiento Z. Se llenan con el medidor de poder.',
  },
  // Defensa de torres (salen en TowerDefenseScene la primera vez que toca)
  td_place: {
    title: 'Colocar torres',
    text: 'Elige un Pokémon del equipo (clic, rueda, Q/E o LB/RB), mueve el cursor a una casilla libre fuera del camino y pulsa clic, Enter o A. Abajo tienes siempre la ayuda. Oleada: N, X o su botón.',
  },
  td_upgrade: {
    title: 'Mejorar torres',
    text: 'Abre una torre (clic, Enter o A) y elige en el panel: teclas 1-4, cruceta y A o clic. Al nivel 3 eliges rama; al 5 evoluciona y, si puede, megaevoluciona al 6. Esc, B o clic derecho la cierran.',
  },
  td_air: {
    title: 'Voladores',
    text: 'Los voladores siguen el camino pero solo los alcanzan torres aéreas (Volador, Eléctrico, Psíquico, Dragón, Fantasma, Hada, Hielo) o la rama Táctica. Mira el panel de la derecha, o haz clic en una torre para ver si es "aéreo".',
  },
  td_skills: {
    title: 'Habilidades',
    text: 'Rayo, Ventisca y Curar base: teclas Z, X y C, LT, RT e Y en el mando o clic en su botón de abajo (cada botón enseña su tecla). Tardan en recargarse.',
  },
};

export interface TutorialState {
  seen: TipId[];
  /** "No más consejos". */
  off: boolean;
}

export const emptyTutorial = (): TutorialState => ({ seen: [], off: false });

export function parseTutorial(raw: string | null): TutorialState {
  try {
    const d = raw ? JSON.parse(raw) : null;
    if (!d || typeof d !== 'object' || !Array.isArray(d.seen)) return emptyTutorial();
    const seen = TIP_IDS.filter((id) => d.seen.includes(id));
    return { seen, off: d.off === true };
  } catch {
    return emptyTutorial();
  }
}

export const shouldShowTip = (s: TutorialState, id: TipId): boolean => !s.off && !s.seen.includes(id);

export const markTipSeen = (s: TutorialState, id: TipId): TutorialState =>
  s.seen.includes(id) ? s : { ...s, seen: [...s.seen, id] };

export const disableTips = (s: TutorialState): TutorialState => ({ ...s, off: true });
