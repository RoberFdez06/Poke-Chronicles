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

## [x] T16 — Recuperar vida y dos monedas: tickets y monedas (pedido por Roberto; va antes de T9)
- **Dos monedas distintas**:
  - **Tickets** (fuera de la partida): lo que hoy se llama "monedas" en `save.ts` pasa a llamarse tickets. Se ganan
    igual (salas limpias, jefes, récords) y solo sirven para el **gacha** (y luego para las mejoras de T13). Migra
    el saldo guardado (`pokeisaac.coins` → tickets) para que nadie pierda nada. Cambia todos los textos ("Tickets").
  - **Monedas** (dentro de la partida): caen de los enemigos al morir (a veces) y al limpiar sala, se recogen
    pisándolas, se ven en el HUD y en la pausa, se guardan en `RunSave` y **se pierden al acabar la partida**.
    Solo sirven en la tienda.
- **Bayas**: al morir, un enemigo a veces suelta una baya (Aranja cura 20 PS, Zidra cura 40); el jefe siempre
  suelta una Zidra. Se recogen al pisarlas; si estás al máximo de PS no se gastan.
- **Centro Pokémon**: una sala especial por piso (marco rosa en puerta y minimapa) con un mostrador que te cura
  **la mitad de tus PS máximos, una sola vez por piso** (acercarte + Enter/A/clic, o pisar el mostrador).
- **Tienda**: una sala por piso con 3 artículos con precio en monedas: Poción (cura 20), Superpoción (cura 50) y
  un objeto pasivo o poder al azar. Si no llegan las monedas, no se compra. Teclado, ratón (clic en el artículo) y mando.
- `floorGen` coloca las salas nuevas (sin salida preferiblemente, nunca la del jefe); tests de que siempre existen.
- `RunSave` guarda monedas, si el Centro ya se usó y qué queda en la tienda (sube `RUN_VERSION`, migra).

## [x] T17 — Vida de los enemigos y colisiones entre ellos (va antes de T9)
- Los enemigos chocan entre sí (collider enemigos↔enemigos) para no amontonarse en el mismo sitio.
- Barrita de vida pequeña encima de cada enemigo (solo cuando ha recibido daño, verde→amarillo→rojo).
- Jefe: barra grande arriba de la pantalla con su nombre en español y su tipo, como en Isaac.

## [x] T18 — Estadísticas reales de cada Pokémon (va antes de T9)
- Usa `stats` de PokeAPI (`pokemon/{id}`: hp, attack, defense, special-attack, special-defense, speed) para tus
  estadísticas base: PS → vida máxima, Ataque → daño del disparo, At. Esp. → daño de los poderes,
  Defensa y Def. Esp. → reducen el daño recibido, Velocidad → velocidad de movimiento y cadencia.
- Escala con una fórmula pura en `src/data/` con tests, para que el Pokémon medio quede como ahora
  (`BASE_STATS`) y los extremos no rompan el juego (límites mínimo/máximo). Los objetos pasivos se aplican encima.
- Los enemigos y jefes también usan sus estadísticas (vida, daño, velocidad), multiplicadas por la dificultad del piso.
- Se ven en la tarjeta al elegir inicial (barras de las 6 estadísticas, en español) y en la pausa.

## [x] T19 — Efecto para todos los tipos y colores claros (va antes de T9)
- Todos los tipos tienen efecto en `STATUS_EFFECTS`: Volador empuja con viento, Dragón hace +25 % de daño,
  Siniestro asusta (el enemigo huye 1,5 s), Acero atraviesa un enemigo más, Hada debilita (el enemigo hace −30 %
  de daño), Normal aturde 0,3 s. Ajusta el resto si alguno falta.
- En las ranuras de poder del HUD y en la pausa, muestra el **nombre del tipo** junto al color (Volador y Veneno se
  confundían). Tests de que todos los tipos de `TYPE_COLORS` tienen efecto.

## [x] T9 — Salas con obstáculos
- Diseños de sala variados (como en Isaac): rocas que bloquean, arbustos/hierba alta que se pueden destruir
  disparando, agujeros que no se pueden cruzar a pie, columnas y charcos. Que nunca bloqueen el paso entre puertas.
- Plantillas de sala en datos puros (`src/level/roomLayouts.ts`) elegidas con la semilla del piso, con un test
  que compruebe que todas las puertas quedan conectadas (BFS sobre la cuadrícula de la sala).
- Los enemigos rodean los obstáculos o al menos no se quedan atascados para siempre.

## [x] T10 — Sonido
- Grito del Pokémon (PokeAPI `cries.latest`) al elegir inicial, al salir el jefe y en el gacha.
- Efectos sencillos generados con Web Audio (disparo, golpe, recoger objeto, puerta, sala limpia), sin archivos con derechos.
- Volumen de música/efectos guardado en `save.ts`.

## [x] T11 — Ajustes
- Pantalla "Ajustes" desde el menú principal y desde la pausa: volumen, pantalla completa, mostrar controles,
  y "Borrar progreso" con doble confirmación. Teclado, ratón y mando.

## [x] T12 — Colección y Pokédex
- Pantalla "Pokédex" en el menú: todos los Pokémon por región, los que tienes en color y los que no en silueta,
  con rareza y filtros (nombre, rareza, región, tipo). Reutiliza la lógica de filtros de T4.

## [x] T13 — Mejoras permanentes por Pokémon
- Como en PokéSurvivor: cada Pokémon tiene sus mejoras (daño, PS, velocidad, cadencia) que se compran con
  monedas y solo se aplican jugando con él. Pantalla "Mejoras" con los 3 controles; datos en `save.ts` con tests.

## [x] T14 — Evolución en partida
- Si tu Pokémon tiene evolución (PokeAPI `evolution-chain`), evoluciona al completar ciertos pisos: cambia
  sprite y nombre y sube estadísticas. Animación de destello y texto "¡X ha evolucionado!".

## [x] T15 — Revisión final y pulido
- Repasa el README y la bitácora, quita código muerto, revisa que todas las pantallas funcionan con los
  3 controles y deja en la bitácora una lista de "cosas para probar" para Roberto.

# Tanda 2 (pedida por Roberto el 18/10 por la tarde)

## [x] T20 — Biomas por piso
- Cada piso tiene un bioma: Bosque, Cueva, Volcán, Mar, Ciudad, Nieve, Torre fantasma… (los de Normal, en orden
  fijo; Infinito y Oleadas los rotan). Cambian colores de suelo/paredes, decoración de los obstáculos (T9) y el
  tipo de los enemigos (Bosque → Planta/Bicho, Volcán → Fuego/Roca, Mar → Agua…), usando PokeAPI `/type/{tipo}`
  para elegir especies. El jefe legendario intenta ser de un tipo del bioma.
- Cartel al entrar al piso: "Piso 2 — Cueva". Datos de biomas puros en `src/level/biomes.ts` con tests.

## [x] T21 — Más salas tipo Isaac
- **Llaves y cofres**: los enemigos sueltan llaves a veces; cofres en algunas salas que se abren con llave
  (objeto, monedas o bayas). Contador de llaves en el HUD y la pausa.
- **Bombas**: se recogen y se usan con una tecla (E / clic derecho+botón en HUD / botón del mando libre: mira
  qué queda libre y documéntalo). Rompen rocas y abren paredes de la **sala secreta** (una por piso, sin puerta
  visible; pista: grieta en la pared).
- **Sala de desafío**: puerta especial; al entrar se cierra y salen oleadas; al ganarlas, premio bueno.
- Todo con teclado, ratón y mando; `floorGen` coloca las salas nuevas con tests; `RunSave` sube versión.

## [ ] T32 — Equilibrio: más difícil y menos premio (pedido por Roberto; va ANTES de T30)
Roberto lo ha jugado: se ganan demasiados tickets y monedas, caen demasiadas bayas, es muy fácil y los jefes
también. Ajusta (todo en constantes con tests que fijen los nuevos rangos):
- **Tickets**: aproximadamente la mitad o menos por partida (`ROOM_TICKETS`, `BOSS_TICKETS`, `roomTicketsFor`,
  `bossTicketsFor`, récords, misiones). Objetivo: ~1 tirada de gacha (100) por cada 2-3 partidas Normales buenas.
- **Monedas de partida** y **bayas** (`LOOT_CHANCE` en `loot.ts`): bastante menos (bayas como premio raro: ~1-2 por
  piso de media, no en casi cada sala). La tienda tiene que obligar a elegir.
- **Jefes**: bastante más vida y daño, y adelanta lo básico de T26 aquí: al menos 2 ataques por jefe (ráfaga en
  círculo y embestida/lluvia de proyectiles) con aviso previo, y fase 2 por debajo del 50 %. Que un jefe dure
  ~30-60 s con un personaje normal sin mejoras.
- **Enemigos a distancia**: ahora el comportamiento depende del tipo; haz que en cada sala de combate haya
  siempre una mezcla (al menos 1 de cada 3 dispara, de cualquier tipo), con proyectiles esquivables de su color.
- Enemigos algo más duros por piso. Usa la simulación de T25 si ya existe; si no, haz una versión mínima para
  comprobar los números y explica en la bitácora los valores de antes y después.

## [ ] T30 — Resolución 1920×1080 y adaptable (pedido por Roberto; va justo después de T21)
- El juego pasa de 960×640 a **1920×1080** (16:9) y se adapta a cualquier ventana: `Scale.FIT` + `CENTER_BOTH`
  (en pantallas 16:9 la llena entera; en otras deja bandas). Que se vea nítido: el pixel art con NEAREST y los
  textos al nuevo tamaño (no escales todo con un zoom borroso).
- Centraliza el tamaño en `src/ui/layout.ts` (`W`, `H`, `CX`, `CY` y ayudas para anclar a bordes) y **quita los
  números fijos** (480, 320, 960, 640…) de todas las escenas. Reajusta tamaños de letra, cuadros y márgenes para
  que nada quede diminuto ni montado. Las salas del juego crecen para llenar la pantalla (o se escala la cámara
  del mundo para que la sala ocupe el alto); el HUD se ancla a las esquinas.
- Para esta tarea **sí puedes tocar** `MenuScene.ts`, `theme.ts` y `src/ui/art/` (solo tamaños y posiciones, sin
  cambiar el estilo): el paisaje pixel tiene que llenar los 1920×1080.
- Comprueba con capturas o a ojo que cada pantalla se ve bien y apunta en la bitácora lo que no puedas verificar.

## [ ] T31 — Sprites animados en 8 direcciones como PokéSurvivor (pedido por Roberto)
- PokéSurvivor usa los sprites de **PMDCollab SpriteCollab** (estilo Mystery Dungeon, licencia CC BY-NC 4.0,
  válida para este fan game gratuito con créditos). Úsalos para el jugador, los enemigos y los jefes:
  `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/{id con 4 cifras}/AnimData.xml` dice el
  tamaño de cada frame y sus duraciones; `Walk-Anim.png` (y `Idle-Anim.png`) tiene **8 filas = 8 direcciones**
  (abajo, abajo-derecha, derecha, arriba-derecha, arriba, arriba-izquierda, izquierda, abajo-izquierda).
- El personaje mira a la dirección de disparo (o de movimiento si no dispara) usando la **más cercana de las 8**
  y anda con la animación de caminar; quieto, la de reposo. Enemigos igual hacia el jugador.
- Si un Pokémon no tiene sprite en SpriteCollab (o falla la descarga), se usa el de PokeAPI como ahora.
- Lógica pura (elegir dirección de 8 a partir de un vector, leer AnimData.xml) en `src/data/` con tests. Caché.
- **Créditos**: pantalla o sección "Créditos" (desde Ajustes) con "Sprites: PMDCollab SpriteCollab (CC BY-NC 4.0)",
  PokeAPI y la fuente Pixelify Sans (OFL); y en el README.

## [x] T22 — Shinies
- Probabilidad de shiny (1/64 en gacha, 1/200 en enemigos; ajustable): usa `sprites.front_shiny`/`back_shiny`.
  Brillo con destellos al aparecer. Un shiny del gacha se guarda como shiny en la colección.
- Si eliges un shiny de inicial, juegas con su sprite shiny. Enemigo shiny: más vida y suelta más premio.
- Pokédex: marca de shiny y contador de shinies conseguidos.

## [x] T23 — Más objetos y sinergias
- Al menos 25 pasivos nuevos (nombres de objetos Pokémon en español: Cinta Elegida, Lente Zoom, Vidasfera,
  Restos, Banda Focus, Hierba Blanca…) con efectos variados, no solo números: disparos que siguen al enemigo,
  disparo hacia atrás, escudo que para un golpe por sala, más alcance por cada enemigo vivo, etc.
- **Objetos activos** (una ranura aparte, tecla Espacio / botón del HUD / un botón del mando) que se recargan
  limpiando salas: Poké Flauta (aturde a todos), Repelente (enemigos huyen), Pokéblock (cura)…
- **Sinergias**: combinaciones con efecto extra y aviso "¡Sinergia!" (p. ej. Carbón + poder de fuego = quemaduras
  más fuertes). Tabla pura con tests.

## [ ] T24 — Misiones y logros
- Pantalla "Misiones" en el menú: retos permanentes (logros) y 3 misiones diarias que cambian cada día
  (vence 10 enemigos de tipo Agua, llega al piso 3 sin curarte, abre 2 cofres…). Dan tickets y algunos logros
  desbloquean cosas (un Pokémon, un objeto nuevo en el sorteo). Aviso en partida al completar una.
- Lógica pura con tests (progreso, fecha de las diarias con semilla del día).

## [ ] T25 — Tutorial y equilibrio
- Primera partida guiada: carteles cortos que explican moverse, disparar, poderes, pausa, objetos, Centro y
  tienda la primera vez que pasan (se pueden saltar; se guarda que ya se vieron). Con los 3 controles.
- Equilibrio: script `scripts/simulate.mjs` (o tests) que simule partidas con la lógica pura y saque tiempos
  por sala, daño recibido, monedas y tickets por partida; ajusta números y explica los cambios en la bitácora.

## [ ] T26 — Jefes con patrones (sugerida por el supervisor)
- Cada jefe legendario tiene 2-3 ataques según su tipo (ráfaga en círculo, embestida, lluvia de proyectiles,
  invocar ayudantes) y una segunda fase al bajar del 50 % de vida (más rápido, cambio de color). Aviso
  visual antes de cada ataque para poder esquivarlo.

## [ ] T27 — Habilidades de PokeAPI (sugerida por el supervisor)
- Tu Pokémon tiene su habilidad real de PokeAPI (`abilities`, nombre en español) con un efecto pasivo sencillo:
  Mar Llamas (+daño con poca vida), Espesura, Torrente, Intimidación (enemigos −daño), Levitación (cruzas
  agujeros), Velo Arena… Las que no tengan efecto definido dan una mejora pequeña genérica. Se ve en la pausa.

## [ ] T28 — Resumen de partida e historial (sugerida por el supervisor)
- Al morir o ganar: pantalla de resumen (tiempo, pisos, enemigos vencidos, daño hecho, objetos, tickets
  ganados, nuevo récord) antes de volver. Historial de las últimas 20 partidas consultable desde el menú.

## [ ] T29 — Pruebas en navegador (sugerida por el supervisor)
- Añade Playwright como dependencia de desarrollo y `npm run e2e`: abre el juego con `vite preview`, simula
  PokeAPI con `page.route` (respuestas falsas) y recorre menú → huecos → inicial → modo → partida → pausa →
  salir, con teclado, con ratón y comprobando que Esc vuelve atrás en cada pantalla. Que falle si hay
  errores en consola. Úsalo en la skill `comprobar` a partir de aquí.
