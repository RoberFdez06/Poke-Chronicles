// Defensa de torres: la ayuda corta «Cómo se juega» del menú (lógica pura, solo texto). Los controles de cada modo
// (teclado, ratón y mando) están en data/controls.ts (tdControlSections).

export interface GuidePage {
  title: string;
  lines: string[];
}

export const TD_GUIDE: readonly GuidePage[] = [
  {
    title: 'Colocar y mejorar',
    lines: [
      'Colocar: elige un Pokémon de tu equipo y ponlo en una casilla libre, fuera del camino. Cada uno cuesta dinero y tiene un límite de torres.',
      'Mejorar: elige una torre y paga para subirla hasta el nivel 5. Vender te devuelve parte del dinero.',
      'Ramas: al nivel 3 eliges entre dos caminos (cada estilo de torre tiene los suyos).',
      'Nivel 5: la torre evoluciona o gana un aura final. Si tiene megaevolución, un último pago la lleva al nivel 6 (mega): ataque mega y un aura que refuerza a las torres cercanas.',
    ],
  },
  {
    title: 'Enemigos y habilidades',
    lines: [
      'Las oleadas siguen el camino hasta tu base: cada fuga le quita vida. El último nivel de cada mapa trae un jefe legendario.',
      'Voladores: siguen el mismo camino, pero solo los alcanzan las torres aéreas (Volador, Eléctrico, Psíquico, Dragón, Fantasma, Hada y Hielo) o la rama Táctica.',
      'Habilidades (con tiempo de recarga): Rayo golpea a los 6 enemigos más fuertes, Ventisca congela a todos y Curar base recupera el 25 % de la vida.',
      'Puedes llamar a la siguiente oleada antes de tiempo para cobrar una bonificación.',
    ],
  },
  {
    title: 'Estrellas y desbloqueos',
    lines: [
      'Estrellas: de 1 a 3 según la vida que conserve tu base al ganar (3 estrellas con el 90 % o más).',
      'Desbloqueos: cada nivel abre el siguiente. Para abrir el mapa siguiente basta con superar la mitad de los niveles de este.',
      'Infinito: al superar todos los niveles de un mapa se abre su modo infinito, con oleadas sin fin.',
      'Tus torres salen de tu colección: cuantas más mejoras tengas de cada Pokémon, más fuertes serán. El equipo de prueba sirve para probar sin colección.',
    ],
  },
];
