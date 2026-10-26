// T79: eventos con decisiones. Una sala sorpresa cuenta una historia corta con 2 o 3 elecciones, como en los roguelikes.
// Cada elección tiene un coste opcional (monedas o PS) y uno o varios resultados con su probabilidad (suman 100).
// Lógica pura, sin Phaser: GameScene solo enseña el texto, aplica los efectos y guarda las historias ya vistas.

/** Lo que cambia al elegir. PS y monedas pueden ser negativos; `maxHp` solo resta (como el altar). */
export interface ChoiceEffects {
  coins?: number;
  hp?: number;
  /** PS máximos perdidos (número positivo = los que se pierden). */
  maxHpLoss?: number;
  tickets?: number;
  potions?: number;
  keys?: number;
  bombs?: number;
  /** Suelta un objeto en la sala. */
  item?: boolean;
  /** Aparecen enemigos del piso (cuántos). */
  fight?: number;
}

export interface ChoiceOutcome {
  /** Probabilidad en %, las de una opción suman 100. */
  chance: number;
  text: string;
  effects: ChoiceEffects;
}

export interface ChoiceOption {
  label: string;
  /** Lo que se paga antes de tirar: si no llegas, la opción sale apagada. */
  cost?: { coins?: number; hp?: number };
  outcomes: ChoiceOutcome[];
}

export interface ChoiceStory {
  id: string;
  title: string;
  text: string;
  options: ChoiceOption[];
}

/** Estado del jugador que importa para pagar y para no pasarse. */
export interface ChoiceState {
  coins: number;
  hp: number;
  maxHp: number;
}

/** Nunca te deja con menos de esto de PS máximos (igual que el altar). */
export const CHOICE_MIN_MAX_HP = 30;

export const CHOICE_STORIES: readonly ChoiceStory[] = [
  {
    id: 'mochila',
    title: 'LA MOCHILA ABANDONADA',
    text: 'Junto a un tronco hay una mochila de entrenador, llena de barro. Algo se mueve dentro.',
    options: [
      {
        label: 'Abrirla con cuidado',
        outcomes: [
          { chance: 60, text: 'Dentro hay un objeto en buen estado y unas monedas.', effects: { item: true, coins: 5 } },
          { chance: 40, text: '¡Un Pokémon salvaje había hecho su nido! Sale furioso.', effects: { fight: 2 } },
        ],
      },
      {
        label: 'Llevarla al Centro Pokémon (más lento, pero honrado)',
        outcomes: [{ chance: 100, text: 'La enfermera te da las gracias con una poción.', effects: { potions: 1 } }],
      },
      { label: 'Dejarla donde está', outcomes: [{ chance: 100, text: 'Sigues tu camino sin mirar atrás.', effects: {} }] },
    ],
  },
  {
    id: 'herido',
    title: 'UN POKÉMON HERIDO',
    text: 'Un Eevee cojea entre la hierba. Te mira con miedo, pero no huye.',
    options: [
      {
        label: 'Curarlo con tus fuerzas (10 PS)',
        cost: { hp: 10 },
        outcomes: [
          { chance: 70, text: 'Se recupera y te trae algo que tenía escondido.', effects: { item: true } },
          { chance: 30, text: 'Se recupera, te lame la mano y se va saltando. Te sientes mejor.', effects: { tickets: 4 } },
        ],
      },
      {
        label: 'Darle unas bayas compradas (8 monedas)',
        cost: { coins: 8 },
        outcomes: [{ chance: 100, text: 'Come con ganas. A cambio, te enseña un atajo con monedas tiradas.', effects: { coins: 14 } }],
      },
      { label: 'No puedes hacer nada', outcomes: [{ chance: 100, text: 'Te alejas con un nudo en la garganta.', effects: {} }] },
    ],
  },
  {
    id: 'viajero',
    title: 'EL VIAJERO DEL TRATO',
    text: 'Un viajero con capa te corta el paso: «Dame algo de tu vida y te daré algo de valor».',
    options: [
      {
        label: 'Aceptar el trato (pierdes PS máximos)',
        outcomes: [{ chance: 100, text: 'Sientes un escalofrío. El viajero deja un objeto y se esfuma.', effects: { maxHpLoss: 8, item: true } }],
      },
      {
        label: 'Pagarle con monedas (15)',
        cost: { coins: 15 },
        outcomes: [
          { chance: 50, text: 'Cumple su palabra: un objeto reluciente.', effects: { item: true } },
          { chance: 50, text: 'Te da una llave y una bomba. «Úsalas bien».', effects: { keys: 1, bombs: 1 } },
        ],
      },
      { label: 'Rechazarlo', outcomes: [{ chance: 100, text: '«Tú te lo pierdes», dice antes de desaparecer.', effects: {} }] },
    ],
  },
  {
    id: 'eco',
    title: 'LA CUEVA DEL ECO',
    text: 'Una cueva pequeña repite cada sonido. Al fondo brilla algo.',
    options: [
      {
        label: 'Gritar para ver qué responde',
        outcomes: [
          { chance: 50, text: 'Un Zubat despierta… y trae a sus amigos.', effects: { fight: 3 } },
          { chance: 50, text: 'El eco hace caer monedas de una grieta.', effects: { coins: 12 } },
        ],
      },
      {
        label: 'Entrar en silencio',
        outcomes: [
          { chance: 60, text: 'Llegas al brillo: es una piedra con forma de objeto. ¡Y lo es!', effects: { item: true } },
          { chance: 40, text: 'Te golpeas con una estalactita. Era solo agua.', effects: { hp: -12 } },
        ],
      },
    ],
  },
  {
    id: 'fuente',
    title: 'EL POZO DE LOS DESEOS',
    text: 'Un pozo antiguo con un letrero: «Una moneda, un deseo». Se oye a un Pokémon Agua dentro.',
    options: [
      {
        label: 'Tirar 5 monedas',
        cost: { coins: 5 },
        outcomes: [
          { chance: 40, text: 'Un Lapras asoma y te cura por completo.', effects: { hp: 999 } },
          { chance: 40, text: 'El agua te devuelve el doble.', effects: { coins: 10 } },
          { chance: 20, text: 'Nada. Solo un plof.', effects: {} },
        ],
      },
      {
        label: 'Bajar por la cuerda a por las monedas',
        outcomes: [
          { chance: 50, text: 'Subes con los bolsillos llenos.', effects: { coins: 18 } },
          { chance: 50, text: 'La cuerda se rompe. Sales empapado y magullado.', effects: { hp: -15, coins: 4 } },
        ],
      },
      { label: 'Pasar de largo', outcomes: [{ chance: 100, text: 'Los deseos, para otro día.', effects: {} }] },
    ],
  },
  {
    id: 'gimnasio',
    title: 'EL ENTRENADOR CANSADO',
    text: 'Un entrenador sentado en una roca: «Llevo tres días sin ganar. ¿Me dejas un combate?».',
    options: [
      {
        label: 'Aceptar el combate',
        outcomes: [{ chance: 100, text: '¡Saca a su equipo! Si los vences, te ganas su respeto.', effects: { fight: 2, tickets: 5 } }],
      },
      {
        label: 'Darle ánimos y una poción (10 monedas)',
        cost: { coins: 10 },
        outcomes: [{ chance: 100, text: 'Se emociona y te regala lo que llevaba.', effects: { item: true } }],
      },
      { label: 'Decirle que no tienes tiempo', outcomes: [{ chance: 100, text: 'Suspira y vuelve a mirar al suelo.', effects: {} }] },
    ],
  },
  {
    id: 'huevo',
    title: 'EL NIDO SOLO',
    text: 'Un nido enorme con tres huevos. No hay ningún Pokémon a la vista… de momento.',
    options: [
      {
        label: 'Coger un huevo',
        outcomes: [
          { chance: 50, text: 'Dentro de la cáscara rota había un objeto brillante.', effects: { item: true } },
          { chance: 50, text: '¡Vuelve la madre! Y no está contenta.', effects: { fight: 2, hp: -8 } },
        ],
      },
      {
        label: 'Vigilar el nido hasta que vuelva la madre (8 PS)',
        cost: { hp: 8 },
        outcomes: [{ chance: 100, text: 'La madre te deja unas monedas y un caramelo en agradecimiento.', effects: { coins: 10, tickets: 3 } }],
      },
    ],
  },
  {
    id: 'tormenta',
    title: 'LA TORMENTA',
    text: 'Empieza a tronar. Un Pikachu se refugia bajo un árbol solitario, justo donde caen los rayos.',
    options: [
      {
        label: 'Correr a sacarlo de ahí',
        outcomes: [
          { chance: 60, text: 'Llegas a tiempo. Te sigue un rato y te deja una bomba de truenos.', effects: { bombs: 2 } },
          { chance: 40, text: 'Un rayo te roza. Pikachu te mira agradecido… y algo chamuscado.', effects: { hp: -14, tickets: 4 } },
        ],
      },
      {
        label: 'Esperar a que pase la tormenta',
        outcomes: [{ chance: 100, text: 'Al escampar encuentras monedas que arrastró el agua.', effects: { coins: 8 } }],
      },
    ],
  },
  {
    id: 'apuesta',
    title: 'EL JUGADOR DE CARTAS',
    text: 'Un Meowth con sombrero baraja cartas: «¿Doble o nada, entrenador?».',
    options: [
      {
        label: 'Apostar 10 monedas',
        cost: { coins: 10 },
        outcomes: [
          { chance: 45, text: '¡Ganas! Meowth paga refunfuñando.', effects: { coins: 22 } },
          { chance: 55, text: 'Pierdes. Meowth se ríe y desaparece con tus monedas.', effects: {} },
        ],
      },
      {
        label: 'Desenmascarar la trampa',
        outcomes: [
          { chance: 50, text: 'Tenía cartas en la manga. Te las da para que no lo cuentes.', effects: { coins: 6, keys: 1 } },
          { chance: 50, text: '¡Se enfada y llama a su banda!', effects: { fight: 2 } },
        ],
      },
      { label: 'No jugar', outcomes: [{ chance: 100, text: '«Aburrido», maúlla.', effects: {} }] },
    ],
  },
  {
    id: 'estatua',
    title: 'LA ESTATUA ANTIGUA',
    text: 'Una estatua de un Pokémon legendario tiene una ranura en el pecho y una inscripción: «Ofrece tu fuerza».',
    options: [
      {
        label: 'Tocarla con la mano herida (15 PS)',
        cost: { hp: 15 },
        outcomes: [
          { chance: 70, text: 'La estatua se ilumina y te entrega un objeto.', effects: { item: true } },
          { chance: 30, text: 'Se ilumina y te cura más de lo que te quitó.', effects: { hp: 30, tickets: 3 } },
        ],
      },
      {
        label: 'Meter monedas en la ranura (12)',
        cost: { coins: 12 },
        outcomes: [{ chance: 100, text: 'Suena un mecanismo y cae una llave y una poción.', effects: { keys: 1, potions: 1 } }],
      },
      { label: 'Ignorarla', outcomes: [{ chance: 100, text: 'Juras que los ojos de piedra te siguen.', effects: {} }] },
    ],
  },
];

export const storyById = (id: string): ChoiceStory | undefined => CHOICE_STORIES.find((s) => s.id === id);

/** ¿Puedes pagar la opción? Con PS nunca te deja a 0 (necesitas tener más de lo que cuesta). */
export function canAfford(option: ChoiceOption, s: ChoiceState): boolean {
  const c = option.cost ?? {};
  return (c.coins ?? 0) <= s.coins && ((c.hp ?? 0) === 0 || (c.hp ?? 0) < s.hp);
}

/** Historia para una sala: una que no hayas visto en la partida (o null si ya las viste todas). `x` en [0, 1). */
export function pickStory(seen: readonly string[], x: number): ChoiceStory | null {
  const left = CHOICE_STORIES.filter((s) => !seen.includes(s.id));
  if (left.length === 0) return null;
  return left[Math.min(left.length - 1, Math.floor(Math.max(0, x) * left.length))];
}

export interface ChoiceResult {
  text: string;
  /** Efectos ya ajustados (coste incluido): monedas, PS y PS máximos nunca bajan de su mínimo. */
  effects: ChoiceEffects;
}

/**
 * Resuelve la opción `optionIndex` de `story`: paga el coste, tira el resultado con `rng` y ajusta los efectos para
 * que las monedas no queden en negativo, los PS se queden en 1 como poco (y sin pasar del máximo) y los PS máximos
 * no bajen de CHOICE_MIN_MAX_HP. Devuelve null si la opción no existe o no la puedes pagar.
 */
export function resolveChoice(story: ChoiceStory, optionIndex: number, rng: () => number, s: ChoiceState): ChoiceResult | null {
  const opt = story.options[optionIndex];
  if (!opt || !canAfford(opt, s)) return null;
  let r = Math.min(0.999999, Math.max(0, rng())) * 100;
  let out = opt.outcomes[opt.outcomes.length - 1];
  for (const o of opt.outcomes) {
    if (r < o.chance) {
      out = o;
      break;
    }
    r -= o.chance;
  }
  const e: ChoiceEffects = { ...out.effects };
  const maxLoss = Math.max(0, Math.min(e.maxHpLoss ?? 0, s.maxHp - CHOICE_MIN_MAX_HP));
  const maxHp = s.maxHp - maxLoss;
  const coins = (e.coins ?? 0) - (opt.cost?.coins ?? 0);
  const hp = (e.hp ?? 0) - (opt.cost?.hp ?? 0);
  const fixed: ChoiceEffects = { ...e, coins: Math.max(-s.coins, coins), hp: Math.min(maxHp - Math.min(s.hp, maxHp), Math.max(1 - s.hp, hp)), maxHpLoss: maxLoss };
  for (const k of Object.keys(fixed) as (keyof ChoiceEffects)[]) if (fixed[k] === 0 || fixed[k] === undefined) delete fixed[k];
  return { text: out.text, effects: fixed };
}

/** Texto corto de los efectos para el aviso: «+5 monedas · −12 PS · un objeto». */
export function describeEffects(e: ChoiceEffects): string {
  const n = (v: number) => (v > 0 ? `+${v}` : `−${-v}`);
  const parts: string[] = [];
  if (e.coins) parts.push(`${n(e.coins)} monedas`);
  if (e.hp) parts.push(`${n(e.hp)} PS`);
  if (e.maxHpLoss) parts.push(`−${e.maxHpLoss} PS máx.`);
  if (e.tickets) parts.push(`+${e.tickets} tickets`);
  if (e.potions) parts.push(`+${e.potions} poción`);
  if (e.keys) parts.push(`+${e.keys} llave`);
  if (e.bombs) parts.push(`+${e.bombs} bomba`);
  if (e.item) parts.push('un objeto');
  if (e.fight) parts.push('¡combate!');
  return parts.join(' · ');
}

/** Texto de la opción en la lista: con el coste y, si no llegas, avisando. */
export function optionLabel(o: ChoiceOption, s: ChoiceState): string {
  return canAfford(o, s) ? o.label : `${o.label} — no te llega`;
}
