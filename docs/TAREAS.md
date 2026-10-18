# Tareas (en orden de prioridad)

Estados: `[ ]` pendiente · `[en curso]` · `[x]` hecha · `[bloqueada: motivo]`.
Cada tarea termina con tsc + tests + build verdes, entrada en `docs/BITACORA.md` y un commit `T<n>: ...`.

## [x] T1 — Varios pisos y jefes legendarios
- Al vencer al jefe aparece una trampilla (como en Isaac): al pisarla bajas al piso siguiente con tus objetos,
  poderes y PS. Cada piso es más grande y difícil (más enemigos, más vida y daño); la partida termina al
  completar el piso 5 (constante ajustable) o al morir.
- El jefe siempre es un legendario o singular (usa `public/data/species-index.json`: `legendary || mythical`).
- El guardado (`RunSave`) guarda el número de piso; las monedas por sala/jefe escalan con el piso.
- HUD: "Piso N". La pausa también muestra el piso.

## [x] T2 — Enemigos variados
- Los enemigos dejan de ser siempre Rattata: Pokémon al azar de PokeAPI según el piso (piso 1 comunes y
  débiles, luego más fuertes; usa la rareza de `gacha.ts` o la suma de estadísticas).
- Al menos 4 comportamientos: perseguir, embestir (carga en línea recta), disparar (proyectiles hacia ti)
  y saltar/teletransportarse. El comportamiento puede depender del tipo del Pokémon.
- Lógica de elegir enemigos por piso en `src/data/` con tests.

## [x] T3 — Poderes del tipo de tu Pokémon
- Los poderes que caen solo pueden ser movimientos de los tipos de tu Pokémon (PokeAPI `/type/{tipo}` da
  la lista de movimientos; quédate con los que tienen potencia). Nombres en español.
- Tests de la parte pura (filtrar por tipo).

## [x] T4 — Primer inicial por región y colección por regiones
- Primera vez que se juega (sin ningún Pokémon desbloqueado guardado): eliges **región** (Kanto, Johto,
  Hoenn, Sinnoh, Teselia, Kalos, Alola, Galar, Paldea) y luego **cuál de sus 3 iniciales** quieres. Ese es
  tu primer Pokémon. Quien ya tenga guardados los de antes (1, 4, 7) los conserva (migración).
  Iniciales: Kanto 1/4/7, Johto 152/155/158, Hoenn 252/255/258, Sinnoh 387/390/393, Teselia 495/498/501,
  Kalos 650/653/656, Alola 722/725/728, Galar 810/813/816, Paldea 906/909/912.
- La pantalla de elegir inicial muestra tu colección **dividida por regiones** (pestañas o secciones por
  rangos de la Pokédex nacional) y con **filtros por nombre** (escribir; con mando/ratón: teclado en pantalla
  o lista de letras) **y por rareza** (común… ultraente).
- Lógica de regiones y filtros en `src/data/` con tests.

## [x] T5 — Modos de juego
- En "Jugar" (tras elegir hueco o inicial) se elige modo: **Normal** (lo actual), **Oleadas** (una sala,
  rondas cada vez más duras, objeto cada X rondas), **Infinito** (pisos sin fin hasta morir) y
  **Rush de jefes** (solo jefes legendarios seguidos, objeto entre jefe y jefe).
- Cada modo guarda récord (ronda/piso/jefes) en `save.ts` y lo muestra en el menú.

## [x] T6 — Efectos por tipo
- Los poderes aplican estados según su tipo: fuego quema (daño en el tiempo), hielo congela/ralentiza,
  eléctrico paraliza a ratos, veneno envenena, planta drena vida, etc. Iconos o tinte sobre el enemigo.
- Tabla de efectos pura en `src/data/` con tests.

## [x] T7 — Español en todo lo que viene de PokeAPI
- Nombres de Pokémon (`pokemon-species/{id}` → `names` es), movimientos (`move/{id}` → `names` es) y tipos
  en español en todas las pantallas (gacha, iniciales, pausa, objetos, HUD). Con caché.

## [x] T8 — Interfaz estilo Pokémon
- Aspecto de los juegos de Pokémon: cuadros de texto con borde doble y esquinas redondeadas, flecha ▶ de
  selección, barras de PS verde/amarillo/rojo con la etiqueta "PS", fichas de tipo, transiciones de pantalla.
- Tipografía pixel con licencia libre (OFL), descargada a `public/fonts/` (por ejemplo "Press Start 2P" o
  "Pixelify Sans" de Google Fonts) y cargada antes de crear el juego (`document.fonts.load`). No uses fuentes
  oficiales ni logos de Pokémon. Centraliza fuente y colores en un archivo de tema (`src/ui/theme.ts`).
- Aplícalo a todas las escenas (menú, huecos, inicial, gacha, pausa, HUD) y mantén teclado, ratón y mando.

## [ ] T16 — Recuperar vida (pedido por Roberto; va antes de T9)
- **Bayas**: al morir, un enemigo a veces suelta una baya (Aranja cura 20 PS, Zidra cura 40; más raras en jefes no,
  el jefe siempre suelta una Zidra). Se recogen al pisarlas; si estás al máximo no se gastan.
- **Centro Pokémon**: una sala especial por piso (marco rosa en puerta y minimapa) con una enfermera/mostrador
  que te cura entero **una sola vez** por piso (acercarte + Enter/A/clic, o al pisar el mostrador).
- **Tienda**: una sala tienda por piso con 3 artículos en el suelo con precio: Poción (cura 20), Superpoción (cura 50)
  y un objeto pasivo o poder al azar. Se paga con las **monedas ganadas en esta partida** (`earned`): comprar resta
  de `earned` y del total guardado. No se puede comprar si no llegan. Con teclado, ratón (clic en el artículo) y mando.
- `floorGen` coloca las salas nuevas (sin salida preferiblemente, nunca la del jefe); tests de que siempre existen.
- El guardado (`RunSave`) recuerda si el Centro ya se usó y qué queda en la tienda (sube `RUN_VERSION`, migra).

## [ ] T17 — Vida de los enemigos y colisiones entre ellos (va antes de T9)
- Los enemigos chocan entre sí (collider enemigos↔enemigos) para no amontonarse en el mismo sitio.
- Barrita de vida pequeña encima de cada enemigo (solo cuando ha recibido daño, verde→amarillo→rojo).
- Jefe: barra grande arriba de la pantalla con su nombre en español y su tipo, como en Isaac.

## [ ] T18 — Estadísticas reales de cada Pokémon (va antes de T9)
- Usa `stats` de PokeAPI (`pokemon/{id}`: hp, attack, defense, special-attack, special-defense, speed) para tus
  estadísticas base: PS → vida máxima, Ataque → daño del disparo, At. Esp. → daño de los poderes,
  Defensa y Def. Esp. → reducen el daño recibido, Velocidad → velocidad de movimiento y cadencia.
- Escala con una fórmula pura en `src/data/` con tests, para que el Pokémon medio quede como ahora
  (`BASE_STATS`) y los extremos no rompan el juego (límites mínimo/máximo). Los objetos pasivos se aplican encima.
- Los enemigos y jefes también usan sus estadísticas (vida, daño, velocidad), multiplicadas por la dificultad del piso.
- Se ven en la tarjeta al elegir inicial (barras de las 6 estadísticas, en español) y en la pausa.

## [ ] T19 — Efecto para todos los tipos y colores claros (va antes de T9)
- Todos los tipos tienen efecto en `STATUS_EFFECTS`: Volador empuja con viento, Dragón hace +25 % de daño,
  Siniestro asusta (el enemigo huye 1,5 s), Acero atraviesa un enemigo más, Hada debilita (el enemigo hace −30 %
  de daño), Normal aturde 0,3 s. Ajusta el resto si alguno falta.
- En las ranuras de poder del HUD y en la pausa, muestra el **nombre del tipo** junto al color (Volador y Veneno se
  confundían). Tests de que todos los tipos de `TYPE_COLORS` tienen efecto.

## [ ] T9 — Salas con obstáculos
- Diseños de sala variados (como en Isaac): rocas que bloquean, arbustos/hierba alta que se pueden destruir
  disparando, agujeros que no se pueden cruzar a pie, columnas y charcos. Que nunca bloqueen el paso entre puertas.
- Plantillas de sala en datos puros (`src/level/roomLayouts.ts`) elegidas con la semilla del piso, con un test
  que compruebe que todas las puertas quedan conectadas (BFS sobre la cuadrícula de la sala).
- Los enemigos rodean los obstáculos o al menos no se quedan atascados para siempre.

## [ ] T10 — Sonido
- Grito del Pokémon (PokeAPI `cries.latest`) al elegir inicial, al salir el jefe y en el gacha.
- Efectos sencillos generados con Web Audio (disparo, golpe, recoger objeto, puerta, sala limpia), sin archivos con derechos.
- Volumen de música/efectos guardado en `save.ts`.

## [ ] T11 — Ajustes
- Pantalla "Ajustes" desde el menú principal y desde la pausa: volumen, pantalla completa, mostrar controles,
  y "Borrar progreso" con doble confirmación. Teclado, ratón y mando.

## [ ] T12 — Colección y Pokédex
- Pantalla "Pokédex" en el menú: todos los Pokémon por región, los que tienes en color y los que no en silueta,
  con rareza y filtros (nombre, rareza, región, tipo). Reutiliza la lógica de filtros de T4.

## [ ] T13 — Mejoras permanentes por Pokémon
- Como en PokéSurvivor: cada Pokémon tiene sus mejoras (daño, PS, velocidad, cadencia) que se compran con
  monedas y solo se aplican jugando con él. Pantalla "Mejoras" con los 3 controles; datos en `save.ts` con tests.

## [ ] T14 — Evolución en partida
- Si tu Pokémon tiene evolución (PokeAPI `evolution-chain`), evoluciona al completar ciertos pisos: cambia
  sprite y nombre y sube estadísticas. Animación de destello y texto "¡X ha evolucionado!".

## [ ] T15 — Revisión final y pulido
- Repasa el README y la bitácora, quita código muerto, revisa que todas las pantallas funcionan con los
  3 controles y deja en la bitácora una lista de "cosas para probar" para Roberto.
