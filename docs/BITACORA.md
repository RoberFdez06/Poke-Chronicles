# Bitácora

Una entrada por tarea o nota: fecha y hora, qué se hizo, archivos tocados, decisiones y dudas para Roberto.

## T1 — Varios pisos y jefes legendarios (2026-10-18)

- **Qué**: partidas de 5 pisos (`FLOOR_COUNT`). Al vencer al jefe aparece una trampilla (y un objeto); al pisarla
  la escena se reinicia en el piso siguiente con objetos, poderes, PS y monedas ganadas (`FloorCarry`). Cada piso
  tiene +2 salas, más enemigos (+1 por piso, hasta +4) y más vida/daño/velocidad. El jefe es siempre
  legendario o singular (de `species-index.json`, sin repetir en la partida; lista fija de respaldo si no carga).
  Monedas: sala 15 + 5 por piso; jefe 60 × piso. HUD "Piso N", pausa "Piso N/5" y tarjeta del hueco con el piso.
- **Archivos**: `src/level/progression.ts` (nuevo, puro), `src/data/speciesIndex.ts` (nuevo, carga compartida de la
  lista; el gacha ahora la usa), `src/data/runSave.ts` (`floor`, `bossHistory`, `RUN_VERSION` 2 con migración de
  v1 → piso 1), `GameScene`, `PauseScene`, `SlotsScene`, tests `progression.test.ts` y `runSave.test.ts`, README.
- **Decisiones**: la trampilla solo se activa cuando te alejas de ella (>90 px) y vuelves a pisarla, para no bajar
  sin querer al continuar una partida guardada en la sala del jefe. Si sales tras vencer al jefe, al continuar la
  trampilla sigue ahí.
- **tsconfig**: añadido `allowImportingTsExtensions` para poder importar valores entre módulos de `src/` con
  extensión `.ts` (node --test no resuelve imports sin extensión). Vite lo admite sin problema.
- **Dudas para Roberto**: los números de dificultad (+35 % vida y +25 % daño por piso) son a ojo; están juntos en
  `difficultyFor` para ajustarlos.

## N1 y N2 — Notas del supervisor (2026-10-18)

- **N1**: rarezas reordenadas: común < raro < épico < ultraente < legendario. Probabilidades: ultraente 4 %,
  legendario 1 %. El respaldo de `pull` ya busca la rareza más cercana (a igual distancia, la menos valiosa), así
  que sin legendarios una tirada de legendario da un Ultraente. Color dorado para legendario en `GachaScene`.
  Tests nuevos en `tests/gacha.test.ts`. README actualizado.
- **N2**: leída. Los botones nuevos usarán `setInteractive(new Rectangle(0, 0, w, h))` o `MenuList`.

## T2 — Enemigos variados (2026-10-18)

- **Qué**: los enemigos ya no son siempre Rattata. Cada piso elige 4 especies de `species-index.json` (sin
  legendarios, singulares ni ultraentes) dentro de una franja de estadísticas base que sube con el piso
  (piso 1: 215-345; +65 por piso; tope en torno a 560). Si la franja tiene menos de 12, se cogen las 12 más cercanas.
  Cuatro comportamientos según el tipo principal: perseguir, embestir (se para 0,45 s con tinte amarillo y carga
  en línea recta a 4,5× su velocidad), disparar (mantiene la distancia, te rodea y lanza proyectiles del color
  de su tipo con borde oscuro) y saltar (desaparece, reaparece cerca de ti y durante 0,3 s no hace daño).
  El jefe usa el comportamiento de su tipo (si dispara, en abanico de 3). PS, daño y velocidad dependen de la
  suma de estadísticas, del comportamiento y de la dificultad del piso.
- **Archivos**: `src/data/enemies.ts` (nuevo, puro), `tests/enemies.test.ts` (nuevo), `src/scenes/GameScene.ts`
  (carga de especies, grupo `foeShots`, `updateEnemy`), README.
- **Decisiones**: las especies del piso salen de la semilla del piso (`mulberry32(floorSeed ^ 0x5bd1e995)`), así
  que al continuar una partida son las mismas sin tocar `RunSave` (no ha hecho falta subir `RUN_VERSION`).
  Se usa `fetchPokemonCard` (una petición por especie, sin movimientos) para sus tipos y sprites.
- **Dudas para Roberto**: la tabla tipo → comportamiento (`BEHAVIOR_BY_TYPE`) y los multiplicadores de
  `enemyStats` son a ojo. Los enemigos aún no esquivan obstáculos (llegará con T9).

## N3 — Skills y tareas nuevas (2026-10-18)

- Leídas las skills `comprobar`, `pokeapi-es` y `ui-phaser`. Las tareas T10–T15 entraron en el commit de T2.

## T3 — Poderes del tipo de tu Pokémon (2026-10-18)

- **Qué**: los poderes que caen ya no son movimientos al azar de todo PokeAPI: salen de `/type/{tipo}` de los tipos
  de tu inicial, solo los que tienen potencia, repartidos por turnos entre sus dos tipos y con el nombre en
  español (`names` es; si falta, el inglés sin guiones). Se piden de 6 en 6 con caché por tipo y por movimiento.
- **Archivos**: `src/data/moves.ts` (nuevo, puro: `localName`, `typeMoveIds`, `isUsableMove`, `filterMovesByTypes`,
  `pickMoveIds`), `tests/moves.test.ts`, `src/data/pokeapi.ts` (`fetchTypeMoveIds`, `fetchMoveInfo`,
  `fetchAttackMovesForTypes`; quitado `fetchRandomAttackMove`), `GameScene` (`fillMovePool`), README.
- **Decisiones**: al continuar una partida antigua se quitan del `movePool` los poderes de otros tipos (los de las
  ranuras se respetan). No cambia el formato de `RunSave`. `localName` servirá para T7.

## T4 — Primer inicial por región y colección por regiones (2026-10-18)

- **Qué**: sin ningún Pokémon guardado, "Jugar" lleva a `FirstStarterScene`: eliges región (lista) y luego uno de
  sus 3 iniciales (tarjetas); queda desbloqueado y empieza la partida. `StarterScene` rehecha: pestañas Todas +
  9 regiones con contador, botón "Buscar por nombre" (teclado físico o teclado en pantalla con letras A-Z y Ñ,
  Borrar, Vaciar y Listo, manejable con flechas, mando y ratón) y botón de rareza que va rotando
  (Todas → Común → … → Legendario). Tarjetas a 8 por página que se piden a PokeAPI solo al mostrar la página.
- **Guardado / migración**: `pokeisaac.unlocked` pasa a `{ v: 2, ids }`. El formato antiguo (array) suma 1, 4 y 7
  como antes. Como antes los desbloqueos solo se escribían al usar el gacha, si no existe la clave pero hay
  monedas o alguna partida guardada, también se consideran jugadores antiguos y conservan 1, 4 y 7. Guardado
  corrupto → 1, 4 y 7 (para no dejar a nadie sin Pokémon). No cambia `RunSave`.
- **Archivos**: `src/data/regions.ts` y `tests/regions.test.ts` (nuevos), `src/data/save.ts` (+tests reescritos),
  `src/ui/cards.ts` (nuevo: tarjeta compartida, carga de sprites, botón Volver), `src/ui/nav.ts` (`PadButtons`
  para X/Y/LB/RB), `src/scenes/FirstStarterScene.ts` (nueva, registrada antes de `PauseScene`),
  `src/scenes/StarterScene.ts`, README.
- **Decisiones**: el filtro por nombre usa de momento el nombre de `species-index.json` (inglés, casi siempre igual
  que en español); con T7 pasará a español. La búsqueda ignora tildes y la Ñ cuenta como N.
- **Dudas para Roberto**: no he podido probar las pantallas en el navegador (no se puede usar `npm run dev`);
  tsc, tests y build pasan. Atajos elegidos: Q/E y LB/RB región, R y X rareza, F e Y buscar.

## T5 — Modos de juego (2026-10-18)

- **Qué**: tras elegir Pokémon (o el primer inicial) aparece `ModeScene` con Normal, Oleadas, Infinito y Rush de
  jefes, su descripción y su récord (teclado, ratón, mando; "Volver" vuelve a la colección).
  - **Oleadas**: arena de una sola sala sin puertas. Ronda r: `2 + ⌈0,8·r⌉` enemigos (máx. 12); cada 3 rondas
    cae un objeto y sube el nivel (dificultad y especies más fuertes, que se cargan en ese momento).
    Monedas por ronda: 5 + 2 por ronda.
  - **Infinito**: como Normal sin final (las salas llegan al tope de 24 y la dificultad sigue subiendo).
  - **Rush de jefes**: arena con solo el jefe; al vencerlo, objeto + trampilla al siguiente jefe (reutiliza la
    bajada de piso). Cada jefe da `60 × ⌈n/2⌉` monedas (menos que en Normal porque no hay salas).
- **Récords**: `pokeisaac.records` en `save.ts` (`loadRecords`, `submitRecord`): pisos completados (Normal,
  Infinito), rondas superadas (Oleadas) y jefes vencidos (Rush). Se guardan al completar cada piso/ronda/jefe,
  así cuentan aunque luego mueras o salgas. Se ven en `ModeScene` y en el menú principal. "¡Nuevo récord!" en el cartel.
- **Guardado**: `RunSave.mode` y `RUN_VERSION` 3 (v1 y v2 migran a Normal). `floor` es el piso, la ronda o el jefe.
  Pausa y huecos muestran modo y progreso (sin salas en Oleadas/Rush).
- **Archivos**: `src/data/modes.ts` y `tests/modes.test.ts` (nuevos), `src/scenes/ModeScene.ts` (nueva, antes de
  `PauseScene`), `save.ts`, `runSave.ts` (+tests), `GameScene`, `PauseScene`, `SlotsScene`, `MenuScene`,
  `StarterScene`/`FirstStarterScene` (ahora van a `Mode`), README.
- **Decisiones / dudas**: `modes.ts` no lee `FLOOR_COUNT` al cargarse (descripción como función) para evitar un
  problema de import circular save → modes → progression → save. Los números de Oleadas y de monedas del Rush
  son a ojo.

## T6 — Efectos por tipo (2026-10-18)

- **Qué**: los poderes (no el disparo normal) aplican el estado de su tipo al golpear. Fuego quema (25 % del golpe
  por segundo, 3 s), Veneno envenena (15 %/s, 5 s), Hielo congela (velocidad ×0,4, 2,5 s), Eléctrico paraliza
  (quieto 0,4 s de cada segundo, 3 s), Agua empapa (×0,7), Psíquico y Fantasma confunden (se mueve y apunta en
  zigzag), Planta y Bicho drenan (recuperas el 30 % del daño) y Lucha, Roca y Tierra empujan. El resto de tipos no
  aplica estado. Reaplicar renueva la duración sin acumular. Los jefes nunca bajan de ×0,7 ni se paralizan del todo.
- **Visual**: el enemigo se tiñe del color del estado y sale un texto ("¡Quemado!", "+12 PS"…) que sube y se
  desvanece. El destello rojo del golpe y el aviso amarillo de embestida tienen prioridad sobre el tinte.
- **Archivos**: `src/data/status.ts` y `tests/status.test.ts` (nuevos), `GameScene` (`applyStatusTo`,
  `tickEnemyStatus`, `paintEnemy`, `popup`, `killEnemy`; la IA usa `speedMultiplier` e `isConfused`), README.
- **Dudas**: duraciones y porcentajes a ojo; están juntos en `STATUS_EFFECTS`.

## T7 — Español en todo lo que viene de PokeAPI (2026-10-18)

- **Qué**: `species-index.json` regenerado con `nameEs` (los 1025 tienen nombre en español: "Código Cero",
  "Mr. Mime", "Nidoran♀"…; el resto de datos es idéntico al de antes). `fetchSpeciesName(id)` (con caché) lo saca
  del índice y, si falta, de `pokemon-species/{id}`; `fetchPokemonCard` y `fetchPokemon` ya devuelven el nombre en
  español, así que salen en español en gacha, colección, primer inicial, HUD, pausa, huecos y cartel del jefe
  ("¡Lugia, jefe legendario!"). Los movimientos del Pokémon usan `localName`. Los tipos ya iban con `typeNameEs`.
  La búsqueda de la colección usa el nombre en español.
- **Partidas antiguas**: al continuar, los poderes con nombre en inglés (ranuras, reserva y suelo) se traducen con
  `fetchMoveInfo` (`spanishMoves`); el nombre del Pokémon se actualiza en el siguiente guardado. En la pantalla de
  huecos, una partida antigua sigue mostrando el nombre en inglés hasta que se continúe y se guarde.
- **Archivos**: `scripts/buildSpeciesIndex.mjs`, `public/data/species-index.json`, `src/data/gacha.ts` (`nameEs?`),
  `src/data/pokeapi.ts`, `GameScene`, `StarterScene`, README.

## T8 — Interfaz estilo Pokémon (2026-10-18)

- **Qué**: tema nuevo en `src/ui/theme.ts` (fuente, colores, `drawBox` con borde doble y esquinas redondeadas,
  flecha `▶`, `addHpBar` con etiqueta "PS" y color verde > 50 % > amarillo > 20 % > rojo, `addTypeChip`, colores de
  rareza, `fadeIn`/`goTo` para fundidos entre pantallas y `loadThemeFont`). Aplicado a todas las pantallas:
  - Menús (`MenuList`, menú principal, gacha): cuadros de borde doble, relleno dorado y ▶ en la opción elegida.
  - Huecos: cuadros con ▶ por fuera y barra de PS de la partida guardada.
  - Colección, primer inicial y gacha: tarjetas con borde doble, franja del color del tipo y fichas de tipo.
    El gacha tiene sus mensajes en un cuadro de texto y las monedas en un cuadro.
  - Modo: panel con borde doble. Pausa: panel con borde doble, barra de PS y ficha de tipo de cada poder.
  - Partida: cuadro arriba a la izquierda con nombre, progreso, enemigos, barra de PS y números; botón de pausa en
    cuadro; ranuras de poder en cuadros con franja del color del tipo (apagadas mientras recargan, mismas áreas de
    clic); carteles dentro de un cuadro de texto ajustado al texto.
  - Fundido a negro al cambiar de pantalla (`goTo`) y desde negro al entrar (`fadeIn`). Desde la pausa se cambia
    sin fundido porque la partida está congelada.
- **Controles**: no cambia la entrada; teclado, ratón y mando siguen igual (áreas de clic centradas como pide N2).
- **Fuente**: `main.ts` espera a `loadThemeFont()` (FontFace + `document.fonts.load`, con 2,5 s de límite) antes de
  crear el juego. **No se ha podido descargar**: el comando `curl` a GitHub (google/fonts) fue denegado y no lo he
  intentado por otra vía. Mientras no esté `public/fonts/PixelifySans.ttf`, el juego usa la fuente del sistema
  (las URLs de descarga están en el README). Elegí Pixelify Sans en vez de Press Start 2P porque es más estrecha y
  los textos actuales caben sin reescribir tamaños.
- **Archivos**: `src/ui/theme.ts` y `tests/theme.test.ts` (nuevos), `src/main.ts`, `src/ui/nav.ts`, `src/ui/cards.ts`,
  todas las escenas, README.
- **Dudas para Roberto**: no he podido verlo en el navegador; conviene revisar a ojo tamaños de texto con la fuente
  pixel (sobre todo la línea de la partida en los huecos y los nombres largos de poderes en la pausa).

## Parada antes de T9 (2026-10-18)

- Hechas T7 y T8. Por indicación de Roberto paro aquí: **T9 sin empezar**, porque antes quiere pedir otra cosa.

## Fuente (2026-10-18)

- Apareció `public/fonts/PixelifySans.ttf` (la habrá puesto Roberto o el supervisor) y la he subido en un commit aparte.
  **Falta `public/fonts/OFL.txt`** (la licencia, que la OFL pide acompañar a la fuente): no lo he escrito de memoria
  para no poner un texto legal inexacto; se descarga de `https://github.com/google/fonts/raw/main/ofl/pixelifysans/OFL.txt`.

## T16 — Recuperar vida y dos monedas: tickets y monedas (2026-10-18)

- **Tickets**: lo que se llamaba "monedas" fuera de la partida ahora son tickets (`loadTickets`, `addTickets`,
  `spendTickets`, `ROOM_TICKETS`, `BOSS_TICKETS`, `roomTicketsFor`, `bossTicketsFor`, `waveTickets`). Clave nueva
  `pokeisaac.tickets`; la primera vez que se lee, si no existe, copia el saldo de `pokeisaac.coins` (no se pierde
  nada). Textos del gacha, carteles y pausa cambiados ("+N tickets", "Tickets ganados").
- **Monedas de la partida** (`src/data/loot.ts`): 35 % de que un enemigo suelte una (12 % de ellas valen 5), 1-3 al
  limpiar sala (+1 cada dos pisos), el jefe suelta 2 de 5. Solo caen en pisos con tienda (Normal/Infinito).
  Se recogen al pisarlas; HUD "● N" en el cuadro de arriba y en la pausa; se guardan en `RunSave` y se pierden al acabar.
- **Bayas**: 10 % Aranja (+20), 3 % Zidra (+40), el jefe siempre Zidra. Con la vida llena no se recogen.
- **Centro Pokémon** (marco rosa y punto rosa en el minimapa): mostrador con cruz que cura la mitad de los PS
  máximos una vez por piso; se usa al pisarlo, con Enter/A cerca (aparece un aviso) o con clic. Con la vida llena
  no se gasta. Gris cuando ya se ha usado.
- **Tienda** (marco verde): Poción 5, Superpoción 12 y un pasivo o poder (sacado del `movePool`, así que siempre es
  de tus tipos) 15. Se compra pisando (una vez por pisada, como en Isaac), con Enter/A cerca o con clic.
  Con el botón A cerca del mostrador o de un artículo, A no lanza además el poder 1.
- **floorGen**: `generateFloor({ special: true })` convierte dos salas de combate (mejor sin salida; nunca inicio,
  objeto ni jefe) en Centro y tienda con un generador aparte, así el resto del piso sale idéntico. Tests: siempre
  existen (300 semillas × 4 tamaños), no tocan el resto del piso y van en salas sin salida casi siempre.
- **Guardado**: `RUN_VERSION` 4 con `coins`, `centerUsed`, `shop` y `layout`; monedas y bayas del suelo en
  `floorItems`. Los v3 migran con `layout: 1` para que su piso se regenere sin Centro ni tienda y cuadre con lo guardado.
- **Archivos**: `src/data/loot.ts`, `tests/loot.test.ts` (nuevos), `save.ts`, `runSave.ts`, `progression.ts`,
  `modes.ts`, `floorGen.ts`, `GameScene`, `PauseScene`, `GachaScene`, `minimap.ts`, tests, README.
- **Dudas**: precios y probabilidades a ojo (en `loot.ts`). En Oleadas y Rush no hay tienda, así que no caen monedas.

## T17 — Vida de los enemigos y colisiones entre ellos (2026-10-18)

- **Qué**: collider enemigos↔enemigos (se empujan en vez de amontonarse; quien salta no choca mientras desaparece
  porque su cuerpo está desactivado). Cada enemigo guarda `maxHp` y, cuando ha recibido daño, dibuja una barrita
  de 44 px encima (verde > 50 %, amarilla > 20 %, roja), oculta mientras está medio invisible al saltar. El jefe no
  lleva barrita: tiene una barra grande arriba (cuadro con borde doble, nombre en español, ficha de su tipo y barra
  "PS") que desaparece al vencerlo.
- **Archivos**: `GameScene` (`drawEnemyBar`, `buildBossBar`, collider), README.

## T18 — Estadísticas reales de cada Pokémon (2026-10-18)

- **Qué**: `src/data/pokeStats.ts` lee `stats` de `pokemon/{id}` (`parseApiStats`) y las convierte con
  `statScale(valor, 70, k, mín, máx) = clamp(1 + k·(valor/70 − 1))`: PS → vida máxima (k 0,5, ×0,7–×1,6), Ataque →
  daño del disparo (k 0,5, ×0,7–×1,6), At. Esp. → `powerMul` de los poderes (k 0,5, ×0,7–×1,6), media de Defensa
  y Def. Esp. → `damageTaken` (k −0,4, ×0,65–×1,3), Velocidad → velocidad (k 0,35, ×0,8–×1,3) y cadencia (k 0,3).
  Con 70 en todo sale exactamente `BASE_STATS` (test). `computeStats(pasivos, base)` aplica los objetos encima.
- **Enemigos y jefes**: la fuerza total sigue saliendo del piso y de la suma de estadísticas (como en T2); ahora
  `shapeEnemyStats` la reparte según cuánto destaca cada estadística frente a la media de las suyas (×0,6–×1,6):
  un Pokémon con muchos PS tiene más vida, uno con mucho ataque pega más, uno rápido corre más. El jefe igual,
  sobre la base de antes (500 PS, 20 de daño, 70 de velocidad por la dificultad del piso).
- **Pantallas**: tarjetas de la colección y del primer inicial con las 6 estadísticas en barras (rojo < 60 ≤
  amarillo < 90 ≤ verde); la colección pasa a 4 tarjetas más grandes por página. La pausa muestra las estadísticas
  base y dos filas nuevas ("Poderes ×1,20", "Daño recibido 85 %").
- **Guardado**: `RUN_VERSION` 5 con `maxHp` (los huecos ya no pueden calcularlo sin cargar el Pokémon); los v4
  migran con los PS máximos de antes. Al continuar, los PS se recortan a los nuevos máximos.
- **Archivos**: `src/data/pokeStats.ts`, `tests/pokeStats.test.ts` (nuevos), `items.ts` (`powerMul`, `damageTaken`),
  `pokeapi.ts`, `runSave.ts` (+tests), `GameScene`, `PauseScene`, `SlotsScene`, `StarterScene`, `FirstStarterScene`,
  `ui/cards.ts` (`statBars`), README.
- **Dudas**: los factores k y los límites son a ojo; están juntos en `PLAYER_LIMITS` y `playerBaseStats`.

## T19 — Efecto para todos los tipos y colores claros (2026-10-18)

- **Qué**: los 18 tipos tienen efecto (test que recorre `TYPE_COLORS`). Nuevos: Volador `gust` (empujón de 760 en
  vez de 520), Dragón `fury` (+25 % de daño del poder, `hitDamageMul`), Siniestro `fear` (huye 1,5 s sin atacar),
  Acero `pierce` (+1 enemigo atravesado, `extraPierce`), Hada `weaken` (el enemigo hace ×0,7 de daño 4 s, por
  contacto y en sus proyectiles) y Normal `stun` (quieto 0,3 s; el jefe solo baja a ×0,7). El resto sigue igual.
- **Colores claros**: cada ranura de poder del HUD lleva encima una ficha con el nombre del tipo ("VOLADOR",
  "VENENO") del color del tipo; la pausa ya mostraba la ficha de tipo de cada poder desde T8.
- **Archivos**: `src/data/status.ts`, `tests/status.test.ts`, `GameScene`, README.

## T9 — Salas con obstáculos (2026-10-18)

- **Qué**: `src/level/roomLayouts.ts` con 8 plantillas de 20 × 12 casillas de 40 px (rocas en las esquinas,
  columnas, hierba alta, agujeros, charcos, muros, matorrales y foso). `layoutFor(semilla, sala, tipo)` solo pone
  obstáculos en salas de combate (también la arena de Oleadas), 20 % vacías, y con espejo horizontal/vertical al azar.
  Rocas y columnas van a `walls` (paran disparos y rebotan); la hierba alta es un grupo propio que para disparos y se
  rompe con dos; los agujeros paran a pie pero no a los disparos; los charcos frenan al jugador (×0,6).
- **Enemigos**: campo de flujo (BFS) hacia la casilla del jugador, recalculado solo cuando cambia de casilla o se
  rompe hierba; para acercarse van a la casilla vecina más cercana a ti (para apuntar y mirar siguen usando la
  línea recta). Aparecen y saltan solo a casillas libres, y el botín cae en una casilla libre.
- **Tests**: todas las plantillas (y sus 4 espejos) dejan conectadas las entradas de las 4 puertas y el centro;
  300 semillas × 12 salas igual, incluida la casilla donde apareces al entrar; el campo de flujo rodea un muro.
- **Archivos**: `src/level/roomLayouts.ts`, `tests/roomLayouts.test.ts` (nuevos), `GameScene`, README.
- **Dudas**: la hierba rota no se guarda (al continuar vuelve a estar). Los que embisten pueden chocar contra una roca
  al lanzarse (se paran, no se atascan).

## T10 — Sonido (2026-10-18)

- **Qué**: `src/data/sounds.ts` describe 10 efectos como tonos (onda, frecuencia, deslizamiento, volumen) y una
  música de fondo propia (melodía de onda cuadrada + bajo triangular, 132 ppm, 32 corcheas en bucle);
  `src/ui/audio.ts` los genera con Web Audio (ruido blanco filtrado para golpes) y programa la música por adelantado.
  Gritos: `fetchCryUrl(id)` (`cries.latest`, si no `legacy`) reproducidos con `Audio` al elegir Pokémon, al
  salir el jefe y al sacar uno en el gacha.
- **Dónde suenan**: disparo y poderes, golpe, recoger objeto, moneda, baya/Centro (curación), puerta al cerrarse,
  sala/ronda limpia, daño recibido, compra en la tienda y elegir en los menús (`MenuList`).
- **Volumen**: `pokeisaac.audio` en `save.ts` (`loadAudio`/`saveAudio`, música 0,5 y efectos 0,8 por defecto,
  siempre entre 0 y 1). Se cambiará desde Ajustes (T11) con `setAudioSettings`.
- **Archivos**: `src/data/sounds.ts`, `src/ui/audio.ts`, `tests/sounds.test.ts` (nuevos), `save.ts`, `pokeapi.ts`,
  `main.ts`, `nav.ts`, `GameScene`, `StarterScene`, `FirstStarterScene`, `GachaScene`, README.
- **Dudas**: el navegador no deja sonar hasta el primer gesto, así que la música empieza con el primer clic o tecla.
  No lo he podido escuchar: los volúmenes son a ojo.

## T11 — Ajustes (2026-10-18)

- **Qué**: `SettingsScene` (registrada antes de `PauseScene`) con Música y Efectos (◀ ▶ en pasos de 10 %, se oye un
  "clic" al cambiar), Pantalla completa (`scale.toggleFullscreen`, necesita un gesto: Enter, A o clic lo son),
  Mostrar controles, Borrar progreso y Volver. Teclado, ratón (clic en la fila; en el volumen, mitad izquierda baja y
  derecha sube) y mando; Esc/B y botón "← Volver".
- **Desde la pausa**: nueva opción "Ajustes"; se abre encima (`bringToTop`, la pausa se queda en pausa) y al
  cerrarla se vuelve a la pausa con la entrada reiniciada para que el B que cerró Ajustes no cierre también la pausa.
- **Borrar progreso**: doble confirmación; `resetProgress` (en `save.ts`, con test) borra desbloqueos, tickets,
  récords y los 3 huecos (`removeItem`), no el volumen. Si se hace desde la pausa, sale al menú sin guardar.
  Después "Jugar" vuelve a pedir región e inicial.
- **Controles**: añadida la fila "Usar (Centro Pokémon, tienda)" a la lista de controles.
- **Archivos**: `src/scenes/SettingsScene.ts` (nueva), `save.ts` (+test), `controls.ts`, `MenuScene`, `PauseScene`,
  `GameScene`, `main.ts`, README.

## N4 — Pausa: la línea de progreso se montaba sobre las estadísticas (2026-10-18)

- La pausa tiene ahora cada dato en una línea fija: nombre (24 px); "Hueco · modo · piso · salas" (15 px);
  "Monedas · Tickets ganados" (15 px); la tabla baja a y = 198 con filas de 27 px; las estadísticas base van en dos
  líneas de tres; objetos y poderes bajan en proporción. Los nombres de poderes se recortan con "…" a 13 letras en
  la pausa y en las ranuras del HUD (`shorten` en `theme.ts`), y la letra de las ranuras baja de 19 a 17 px.
- Repaso de huecos y HUD: en los huecos la línea de la partida ya tenía `wordWrap` y cabe en dos líneas dentro del
  cuadro; en el HUD nombre, progreso, PS y monedas tienen sitio de sobra con nombres de hasta 12 letras.
- **Límite**: no puedo abrir el navegador, así que los anchos los he calculado a mano (unos 0,55 em por letra con
  Pixelify Sans). Conviene un vistazo a la pausa con un nombre largo.

## T12 — Colección y Pokédex (2026-10-18)

- **Qué**: `PokedexScene` desde el menú (botón "Pokédex"; el menú tiene ahora 5 botones algo más bajos): los 1025
  Pokémon en cuadrícula de 7 × 3 por página, en color si los tienes (borde del color de la rareza) y en silueta si
  no; cuadro inferior con número, nombre, rareza, tipos y si lo tienes. Enter/A/clic en uno tuyo: su grito.
- **Filtros**: los de T4 (región, nombre con teclado en pantalla, rareza) más **tipo**. Para no repetir código,
  las pestañas, los botones y el teclado de búsqueda pasan a `src/ui/collection.ts` (`FilterBar`, `SearchPad`,
  `makeChip`) y `StarterScene` los usa también. `filterCollection` acepta `type` (test nuevo).
- **Datos**: `species-index.json` regenerado con `types` de cada especie (lo demás sale idéntico, comprobado).
  Los sprites de la Pokédex se cargan directamente del repositorio de sprites de PokeAPI por página.
- **Mando**: LB/RB región, X rareza, LT/RT tipo, Y buscar. `PadButtons` lee ahora también LT y RT.
- **Archivos**: `src/scenes/PokedexScene.ts`, `src/ui/collection.ts` (nuevos), `StarterScene` (usa la barra común),
  `regions.ts` (+test), `gacha.ts` (`types?`), `nav.ts`, `MenuScene`, `main.ts`, script e índice, README.

## T13 — Mejoras permanentes por Pokémon (2026-10-18)

- **Qué**: `src/data/upgrades.ts` (puro): Daño +8 %, PS +10, Velocidad +4 % y Cadencia ×0,94 por nivel, hasta 5;
  coste 40 × (nivel + 1) tickets (600 por mejora completa). `save.ts`: `pokeisaac.upgrades` por id de Pokémon,
  `loadUpgrades` y `buyUpgrade` (gasta tickets; 'ok' / 'max' / 'poor'), y "Borrar progreso" también las borra.
- **Pantalla**: `UpgradeScene` desde el botón "Mejoras" del menú (el menú tiene 6 botones algo más bajos): tarjeta
  del Pokémon con sus estadísticas, ◀ ▶ para cambiar entre los tuyos, 4 filas con casillas de nivel, coste y
  descripción; compra con Enter/A/clic. Saldo de tickets arriba a la derecha.
- **En partida**: `GameScene` aplica las mejoras del Pokémon elegido sobre sus estadísticas base (T18) y los objetos
  pasivos van encima.
- **Archivos**: `src/data/upgrades.ts`, `src/scenes/UpgradeScene.ts`, `tests/upgrades.test.ts` (nuevos), `save.ts`,
  `GameScene`, `MenuScene`, `main.ts`, README.
- **Dudas**: la mejora de Daño sube el disparo; los poderes siguen dependiendo del At. Esp. y de los objetos.
  Precios y porcentajes a ojo.

## T14 — Evolución en partida (2026-10-18)

- **Qué**: `src/data/evolution.ts` (puro): `nextEvolutionIds(cadena, id)` recorre `evolution-chain` (descarta formas
  especiales con id > 1025), `pickEvolution` elige una al azar si hay varias y `EVOLVE_AT` dice cuándo: pisos 2 y 4
  (Normal, Infinito), rondas 6 y 12 (Oleadas), jefes 3 y 6 (Rush). `fetchNextEvolutions(id)` en `pokeapi.ts` (con caché).
- **En partida**: al bajar por la trampilla a uno de esos pisos (o al empezar esa ronda en Oleadas), poco después
  de ver la sala: destello de cámara, parpadeo en blanco, cambia sprite (frente y espalda), nombre, tipo del disparo
  y estadísticas (las del nuevo Pokémon con las mejoras del elegido; lo que suben los PS máximos te cura),
  cartel "¡X ha evolucionado! Ahora es Y" y su grito. Si no tiene evolución o falla la red, no pasa nada.
- **Guardado**: `RUN_VERSION` 6 con `formId` (forma actual); los v5 migran con la forma del elegido. `starterId`
  sigue siendo el elegido (para mejoras y huecos). Al continuar no se vuelve a evolucionar.
- Comprobado contra PokeAPI: Charmander → Charmeleon → Charizard; Eevee → 8 ramas; Pikachu → Raichu.
- **Archivos**: `src/data/evolution.ts`, `tests/evolution.test.ts` (nuevos), `pokeapi.ts`, `runSave.ts` (+test),
  `GameScene`, README.
- **Dudas**: los poderes ya conseguidos se quedan; los nuevos siguen saliendo de los tipos de la forma con la que
  empezó el piso (si la evolución añade un tipo, como Charizard Volador, sus poderes llegan en el piso siguiente).

## T15 — Revisión final y pulido (2026-10-18)

- **Código muerto**: `fetchPokemon` pedía 14 movimientos de cada Pokémon (y su ilustración) que ya nadie usaba
  desde T3: ahora es la misma petición que la tarjeta (14 peticiones menos por Pokémon al empezar cada piso).
  Quitados `fetchSpeciesCount`, `BEHAVIOR_LABEL`, `MoveData`, `pauseBtn` y un import sin usar. `tsc` con
  `--noUnusedLocals` queda limpio.
- **README**: estructura reescrita por carpetas (data, level, ui, scenes, scripts, public), fila de controles
  "Usar", versión del guardado (6), salas especiales en el modo Normal, resumen de lo que hay y aviso de que falta
  `public/fonts/OFL.txt`; quitados restos ("8 por página", "gacha aún sin conectar").
- **Tres controles** (repaso del código, sin navegador): todas las pantallas (menú, huecos, colección, primer
  inicial, modo, partida, pausa, ajustes, gacha, Pokédex, mejoras) usan `NavInput`/`PadButtons` para teclado y
  mando y tienen botones o zonas de clic y "← Volver" para ratón. En partida: mover y disparar con ratón, clic en
  ranuras, botón de pausa y clic en mostrador/artículos.
- Estado final: 125 tests en verde, `tsc` y `build` bien.

## Cosas para probar (para Roberto)

No he podido abrir el juego en el navegador (no se puede usar `npm run dev`), así que todo esto está comprobado
solo con tests, tipos y build. Lo que más conviene mirar:

1. **Primera vez**: con "Ajustes → Borrar progreso" (doble confirmación) o en una ventana privada, "Jugar" debe
   pedir región y luego uno de sus 3 iniciales; después, elegir modo.
2. **Partida guardada antigua**: si tenías huecos de antes, que se carguen (migran hasta la versión 6) y que el
   saldo de monedas aparezca como tickets en el gacha.
3. **Textos con Pixelify Sans**: pausa (con un nombre largo y 4 poderes), línea de los huecos, HUD (cuadro de arriba
   y ranuras), tarjetas con estadísticas, Ajustes y Pokédex. Busca textos que se monten o se salgan.
4. **Salas con obstáculos**: que nunca te quedes encerrado, que la hierba se rompa con dos disparos, que los
   enemigos rodeen rocas y agujeros y que los que saltan no aparezcan encima de una roca.
5. **Centro Pokémon y tienda**: puerta rosa y verde, curar una vez por piso (pisando, Enter/A o clic), comprar
   pisando, con Enter/A y con clic, y que el botón A cerca del mostrador no lance también el poder 1.
6. **Estados**: un poder de cada tipo (tinte y aviso), sobre todo Siniestro (huye), Normal (se para) y Hada.
7. **Evolución**: con Charmander en modo Normal, al bajar al piso 2 y al 4 (destello, sprite, nombre y PS).
   Con Eevee sale una evolución al azar.
8. **Sonido**: que suene tras el primer clic, que la música y los efectos no estén demasiado altos y que el volumen
   de Ajustes se guarde. Gritos al elegir Pokémon, al salir el jefe y en el gacha.
9. **Ajustes desde la pausa**: abrir, cambiar volumen, volver con B/Esc a la pausa (no al juego directamente) y
   pantalla completa.
10. **Mando**: LB/RB (región), X (rareza), Y (buscar), LT/RT (tipo, en la Pokédex) y el teclado de búsqueda.
11. **Equilibrio**: dificultad por piso, precios de tienda y mejoras, tickets por sala/jefe/ronda y estadísticas
    de los Pokémon muy fuertes o muy débiles. Todos los números están en `src/data/` y `src/level/` para ajustarlos.
12. **Licencia de la fuente**: añadir `public/fonts/OFL.txt` (enlace en el README).

## T20 — Biomas por piso (2026-10-18)

- **Qué**: `src/level/biomes.ts` con 9 biomas (Bosque, Cueva, Mar, Volcán, Torre fantasma, Ciudad, Montaña nevada,
  Pantano, Cumbre dragón): tipos de enemigos, colores de suelo, paredes, rocas, hierba (tinte), charcos (lava,
  hielo, lodo…) y agujeros. Normal: orden fijo Bosque → Cueva → Mar → Volcán → Torre; Infinito y Rush rotan los 9
  por piso; Oleadas, por nivel (cada 3 rondas).
- **Enemigos**: `biomeEnemyPool` coge de la franja de fuerza del piso los que tengan un tipo del bioma; si son menos
  de 6, los 6 del bioma con la suma de estadísticas más cercana (test: la media queda cerca de la franja).
  **Jefe**: `biomeBossPool` = legendarios/singulares del tipo del bioma (Volcán → Moltres, Entei, Groudon…), si no hay, cualquiera.
- **Pantalla**: inicio, combate y jefe con el suelo del bioma (objeto, Centro y tienda conservan el suyo para
  reconocerlos), paredes y obstáculos del bioma, cartel "Normal / Piso 2/5 — Cueva" y "Ronda 4 — Volcán".
- **Decisión**: la tarea decía usar `/type/{tipo}` de PokeAPI; como `species-index.json` ya trae los tipos de las
  1025 especies (T12), los saco de ahí: mismo resultado, sin peticiones y con tests. El bioma se calcula del modo y el
  piso, así que no cambia `RunSave`.
- **Dudas**: en Oleadas la sala no cambia de colores al cambiar de bioma (solo los enemigos y el cartel).
- **Archivos**: `src/level/biomes.ts`, `tests/biomes.test.ts` (nuevos), `GameScene`, README.

## N5 — El arte de los menús lo hace el supervisor (2026-10-18)

- Leída. No toco `src/scenes/MenuScene.ts`, `src/ui/theme.ts`, la parte visual de `MenuList` ni `src/ui/art/`.
  Lo que necesite cambiar ahí (por ejemplo botones nuevos en el menú para Misiones o Historial) lo apunto aquí.

## T21 — Más salas tipo Isaac (2026-10-18)

- **floorGen** (`extra: true`, diseño de piso 3, con un generador aparte para no tocar lo demás): sala secreta en una
  celda vacía pegada al mayor número de salas de combate o inicio (nunca al jefe ni a otra especial), con todas sus
  puertas en `hiddenDoors` por los dos lados; una sala de combate (mejor sin salida) pasa a sala de desafío; dos
  salas de combate con cofre. Test con 300 semillas × 4 tamaños: lo de antes no cambia, sin puertas ocultas se llega
  a todo menos a la secreta, y casi siempre la secreta toca dos salas o más.
- **loot.ts**: llaves y bombas (5 % cada una por enemigo), `rollChest` (35 % objeto, 35 % 3-6 monedas, 30 % baya y
  bomba), `BOMB` (1,3 s, 110 px, 60 de daño, 12 si te pilla), `challengeWaveSize` y `CHALLENGE_REWARD`. Tests.
- **Partida**: rocas separadas una a una para poder romperlas; las bombas dañan, rompen rocas y hierba, recalculan el
  camino de los enemigos y abren las paredes con grieta cercanas (la pista solo se dibuja en el lado normal). La
  sala secreta no sale en el minimapa hasta abrirla. Sala de desafío: 3 oleadas y premio. Cofre en una casilla libre
  de arriba a la derecha; se abre pisando, con Enter/A cerca o con clic si tienes llave.
- **Controles**: bomba con **E**, **RB** o clic en el icono de la bomba del HUD. En el mando quedaban libres LB, RB,
  LT y RT: RB para la bomba y dejo LB para el objeto activo de T23. La fila de controles junta "Usar · Bomba" para
  que la lista siga cabiendo en el panel del menú (que no puedo tocar por N5).
- **Guardado**: `RUN_VERSION` 7 con `keys`, `bombs`, `openedChests`, `revealedDoors`; los v6 migran con 1 bomba
  y su diseño de piso 2. Llaves y bombas pasan de piso a piso.
- **Archivos**: `floorGen.ts`, `loot.ts`, `runSave.ts`, `sounds.ts` (`boom`), `controls.ts`, `minimap.ts`,
  `GameScene`, `PauseScene`, tests, README.
- **Dudas**: no se puede entrar a la sala secreta desde dentro de una sala cerrada en combate hasta limpiarla (la
  puerta abierta se cierra con las demás); la hierba y las rocas rotas no se guardan.

## T22 — Shinies (2026-10-18)

- **Qué**: `src/data/shiny.ts` (1/64 gacha, 1/200 enemigos, ×1,5 de vida y premio extra) y `pokeisaac.shinies` en
  `save.ts` (`loadShinies`, `addShiny`, que también desbloquea; "Borrar progreso" los borra). `PokemonCard.sprites`
  trae ahora también `shinyFront`/`shinyBack` (si faltan, los normales) y `pickSprites` elige.
- **Gacha**: cada tirada puede ser shiny; si ya lo tenías shiny cuenta como repetido (devuelve tickets), si no, se
  guarda aunque tuvieras el normal. Sprite shiny, "★" en el nombre y tres tandas de destellos (`src/ui/sparkle.ts`).
- **Colección**: si tienes shiny a un Pokémon, su tarjeta enseña el sprite shiny con ★ y "Shiny · rareza", y juegas con
  él (texturas `starter-<id>-s`), también tras evolucionar.
- **Enemigos**: al aparecer uno shiny (texturas `foe-<id>-s`, cargadas con el piso), destellos y "¡Shiny!"; al caer,
  más destellos, dos monedas de 5 y una llave además de lo normal.
- **Pokédex**: ★ en los que tienes shiny (con el sprite shiny del repositorio de PokeAPI) y "★ N shiny" en el título.
- **Archivos**: `src/data/shiny.ts`, `src/ui/sparkle.ts`, `tests/shiny.test.ts` (nuevos), `save.ts`, `pokeapi.ts`,
  `ui/cards.ts`, `GachaScene`, `StarterScene`, `PokedexScene`, `GameScene`, README.
- **Dudas**: si tienes el shiny, siempre juegas con él (no hay opción de elegir el normal). Un shiny no se puede
  conseguir venciéndolo, solo en el gacha.

## N6 — Partidas que no se guardan y Esc en "Partidas" (2026-10-18)

- **Causa del guardado**: la que apuntaba el supervisor. Con la T21 a medias, `runSave.ts` ya pedía la versión 7 con
  `keys`, `bombs`, `openedChests` y `revealedDoors`, pero `GameScene` seguía guardando sin ellos; Vite no se para por
  errores de tipos, así que el juego corría, guardaba y `parseRun` rechazaba el guardado (hueco vacío). Con la T21
  terminada (commit c01b59d) `GameScene` guarda todos los campos.
- **Comprobado en navegador**: he adelantado parte de la T29. Playwright 1.48 (dependencia de desarrollo, para las
  pruebas de navegador que pide esa tarea) y `tests/e2e/flow.spec.ts` con PokeAPI falsa (`page.route`). Recorre con
  teclado: Menú → Huecos → Esc → Menú, lo mismo con Retroceso, hueco vacío → primer inicial → Esc → Huecos, región
  e inicial → Modo → Esc → colección → Esc → Huecos, colección → Modo → partida; comprueba que hay guardado v7 al
  entrar en la sala, pausa → "Salir y guardar", hueco ocupado → diálogo → Esc lo cierra → Esc vuelve al menú, y
  "Continuar" abre la partida. Sin errores en consola. **Pasa.** Se lanza con `npm run e2e`.
- **Esc**: en Chromium, Esc y Retroceso vuelven desde Huecos, Inicial y Modo, con y sin partidas guardadas y con el
  diálogo abierto o cerrado. No he encontrado otro fallo en el código; si a Roberto le sigue pasando, puede ser que
  la página haya perdido el foco del teclado (un clic en el juego lo devuelve) o la pantalla completa (Esc la usa el
  navegador; el supervisor ya añadió `keyboard.lock` y Retroceso).
- `src/main.ts` deja el juego en `window.__POKEISAAC__` para que las pruebas sepan qué pantalla está activa.

## T23 — Más objetos y sinergias (2026-10-18)

- **Pasivos nuevos** (34, en `items.ts`): Cinta/Gafas/Pañuelo Elegido, Lente Zoom, Periscopio, Garra Afilada,
  Banda Focus, Hierba Blanca, Concha Campana, Casco Dentado, Polvo Brillo, Gafas Protectoras, Chaleco Asalto,
  Telescopio, Cola Gemela, Pokéradar, Moneda Amuleto, Bola Férrea y 16 potenciadores de tipo (Carbón, Agua Mística,
  Imán, Semilla Milagro, Hielo Eterno, Cinturón Negro, Cuchara Torcida, Colmillo Dragón, Hechizo, Gafas de Sol,
  Revestimiento Metálico, Seda Fina, Pico Afilado, Polvo Plata, Flecha Venenosa, Arena Fina). `PlayerStats` tiene
  campos nuevos (críticos, robo de vida, espinas, esquivar, escudo, Banda Focus, Hierba Blanca, persecución, disparos
  atrás, alcance por enemigo, monedas, tamaño, `typeBoost` y `statusBoost` por tipo); `computeStats` copia los mapas.
- **Activos** (`synergies.ts`): Poké Flauta (aturde 2,5 s, 3 salas), Repelente (miedo 4 s, 2), Pokéblock (+35 PS, 3),
  Ataque X (+50 % 8 s, 2). Caen en el 15 % de los objetos. Espacio, **LB** o clic en su cuadro (abajo a la izquierda,
  con la carga en casillas y "¡YA!"). Limpiar una sala (o una ronda) los recarga.
- **Sinergias** (11, tabla pura con tests): Fuego interior, Marea, Sobrecarga, Ventisca y Tóxico (potenciador + poder
  de su tipo → estado más fuerte), Elección, Francotirador, Vampiro, Muralla, Buscador y Tormenta. Al aparecer una:
  cartel "¡Sinergia!"; en la pausa se listan junto al objeto activo.
- **Guardado**: `RUN_VERSION` 8 con `active` (y activos en el suelo); los v7 migran sin activo.
- **Archivos**: `items.ts`, `synergies.ts` (nuevo), `runSave.ts`, `controls.ts`, `GameScene`, tests
  (`synergies.test.ts` nuevo, `pokeStats`, `runSave`), `tests/e2e/flow.spec.ts` (versión del guardado), README.
- **Dudas**: números a ojo (los dejo para el equilibrio de la T25). La fila de controles junta poderes y objeto
  activo para que la lista quepa en el panel del menú (N5).

## N7 — Prioridad: T32, T30 y T31 (2026-10-18)

- Leída. Orden a partir de aquí: T32 (equilibrio), T30 (1920×1080, junto con N8 del HUD), T31 (sprites de 8
  direcciones) y luego T24-T29. `test-results/` y `playwright-report/` van al `.gitignore`. No toco la fuente de los
  números del supervisor (`PokeIsaacDigits.ttf` en `loadThemeFont`).

## N9 — Arte nuevo del supervisor (2026-10-18)

- Leída: `TitleScene` es ahora la primera escena (la prueba de navegador ya pasa por ella pulsando Enter) y
  `src/ui/art/icons.ts` y `tiles.ts` quedan para la T33.

## T32 — Equilibrio: más difícil y menos premio (2026-10-18)

- **Cómo lo he medido**: `src/data/balance.ts` (puro) calcula los premios esperados por piso a partir de las
  constantes del juego y de la media de salas de combate de `generateFloor` (60 semillas por piso), y
  `node scripts/simulate.ts` imprime la tabla. `tests/balance.test.ts` fija los rangos nuevos.
- **Antes → después** (partida Normal completa, de media):

  | | Antes | Después |
  |---|---|---|
  | Tickets por partida completa | 2134 (21 tiradas) | 60 (0,6 tiradas) |
  | Tickets hasta el piso 3 | 800 | 27 |
  | Monedas por piso | 25 → 113 | 11 → 26 (la tienda cuesta 32 en total) |
  | Bayas por piso | 3,6 → 14,8 | 1,2 → 2,1 (incluida la Zidra del jefe) |
  | PS del jefe (piso 1 / 5) | 500 / 1200 | 1300 / 3640 |
  | Daño del jefe (piso 1 / 5) | 20 / 40 | 26 / 57 |
  | Jefe del piso 1 sin mejoras | ~12 s | ~31 s |
  | PS de un enemigo de 300 (piso 1 / 5) | 69 / 166 | 81 / 226 |

  Con una media entre partida completa y partida hasta el piso 3 (~43 tickets), una tirada (100) sale cada 2,3
  partidas buenas.
- **Constantes**: `ROOM_TICKETS` 15 → 1 (y ya no sube por piso), `BOSS_TICKETS` 60 → 1 (× piso); Oleadas 5 + 2/ronda →
  1 + 1 cada 5 rondas. `LOOT_CHANCE`: monedas 35 % → 8 %, Aranja 10 % → 0,8 %, Zidra 3 % → 0,2 %, llaves y bombas 5 % →
  3 %; monedas al limpiar sala 1-3 (+piso) → 0-1; el jefe suelta una moneda de 5 en vez de dos. Dificultad por piso:
  +45 % de vida y +30 % de daño (antes +35 % y +25 %); enemigo base de 70 PS (antes 60). Jefe 1300 PS y 26 de daño
  (`BOSS_BASE`). Como los tickets escasean, las mejoras cuestan 15 × nivel (antes 40 ×).
- **Jefes** (`src/data/bossPatterns.ts`, adelanto de la T26): siempre ráfaga en círculo (anillo de aviso y el jefe en
  blanco; 10 proyectiles, 16 en fase 2) más embestida (tipos físicos: línea roja de aviso y carga) o lluvia (resto:
  círculos rojos en el suelo, uno bajo tus pies; daño al caer); Dragón hace las tres. Aviso de 0,75 s. Ataque cada
  3,3 s (2,1 s en fase 2). Fase 2 por debajo del 50 %: cartel "¡X se enfurece!", temblor, tinte rojo y ×1,3 de velocidad.
- **Enemigos a distancia**: `mixBehaviors` hace que en cada sala (combate, desafío y Oleadas) al menos uno de cada
  tres dispare, sea del tipo que sea, con sus proyectiles del color de su tipo.
- **Archivos**: `balance.ts`, `bossPatterns.ts`, `scripts/simulate.ts`, `tests/balance.test.ts` (nuevos), `save.ts`,
  `progression.ts`, `modes.ts`, `loot.ts`, `enemies.ts`, `pokeStats.ts`, `upgrades.ts`, `GameScene`, tests y README.
  `test-results/` sale del repositorio (se había colado antes de ponerlo en `.gitignore`).
- **Dudas**: el "DPS del jugador" de la simulación es una suposición (disparo normal y un poder, acertando el 70 %);
  si Roberto ve los jefes largos o cortos, el número a tocar es `BOSS_BASE.hp`.

## T30 — Resolución 1920×1080 y adaptable, con N8, N10 y N11 (2026-10-19)

- **Cómo**: `src/ui/layout.ts` centraliza tamaños (`W`, `H`, `CX`, `CY`, el diseño `DW`×`DH` y su escala `U`, el
  ancho que se ve con las bandas `COVER_W`, `fromLeft`/`fromRight`, y la vista y franjas de la partida). El juego va a
  1920×1080 con `Scale.FIT` + `CENTER_BOTH`.
- **Decisión importante**: rehacer a mano las coordenadas de las 12 pantallas (más de 4000 líneas) era mucho riesgo para
  poco beneficio, así que las pantallas de menú siguen compuestas en 960×640 y `fitDesign` pone su cámara ×1,6875
  centrada. **No queda borroso**: los cuadros son gráficos vectoriales, el pixel art va con NEAREST y todos los
  textos se generan a resolución ×2 (`main.ts` lo hace para cualquier `add.text`). Lo que sobra a los lados en 16:9
  se rellena: el paisaje del supervisor alarga sus capas hasta los bordes, y las capas que tapan la pantalla (diálogos,
  pausa, ajustes, controles, franja inferior del menú) usan `COVER_W`. La pantalla de título también pasa a este
  espacio (su fondo se quedaba en una esquina). Los objetos con `setScrollFactor(0)` en menús se descolocaban con la
  cámara escalada; el único caso (`addPanel`) ya no lo usa.
- **Partida y N8**: la cámara de la sala tiene su propia vista (1440×960 en el centro, ×1,5): la celda de la sala se
  ve **entera, con sus puertas**. El HUD pasa a una capa con su propia cámara sin zoom en coordenadas reales, en las
  franjas: izquierda (pausa, ficha con nombre, piso y PS, monedas/llaves/bombas, objetos y objeto activo abajo),
  derecha (minimapa arriba y los 4 poderes abajo), arriba (barra del jefe) y el cartel en el centro. Lo que se crea en
  la escena no sale en la cámara del HUD (`ADDED_TO_SCENE`) salvo lo que va en la capa. El ratón solo apunta y mueve
  dentro de la sala (`inGameView`). El minimapa acepta tamaño y ancho máximo.
- **Fallo encontrado y arreglado**: Phaser reutiliza los datos del último arranque de una escena si el siguiente no
  trae. Tras abrir Ajustes desde la pausa, al abrirlos desde el menú seguían creyéndose encima de la pausa y Esc
  "reanudaba" una pausa vieja (te quedabas en la pausa). `SettingsScene` olvida esos datos al leerlos.
- **Comprobado con capturas** (`tests/e2e/screens.spec.ts`, a 1920×1080, en `test-results/screens/`): título, menú,
  huecos, región, iniciales, modo, colección, partida, pausa, ajustes (desde la pausa y desde el menú), gacha,
  Pokédex y mejoras. Todo se ve nítido y nada se monta; la partida enseña la sala entera y el HUD fuera. Las pruebas
  esperan ahora al estado real de las pantallas (`waitSceneProp`) en lugar de tiempos fijos.
- **N10**: incluido el arreglo del supervisor (`k.reset()` en `NavInput`, `MenuScene`, `GachaScene` y
  `resetKeys()` al reanudar). **N11**: a partir de este commit no toco `GachaScene.ts` (aquí solo lleva la cámara).
- **No verificado**: los sprites reales de PokeAPI (en las pruebas son cuadrados de 1 px) y el mando.

## T31 — Sprites animados en 8 direcciones (2026-10-19)

- **Qué**: `src/data/pmdAnim.ts` (puro, con tests): `dir8Row` elige la fila de la más cercana de las 8 direcciones
  (abajo, abajo-derecha, derecha, arriba-derecha, arriba, arriba-izquierda, izquierda, abajo-izquierda), `parseAnimData`
  lee `AnimData.xml` (tamaño de frame y duraciones en ticks de 1/60 s; resuelve `CopyOf`), rutas y escala.
  `src/ui/pmdSprites.ts` descarga `AnimData.xml` (caché por id; 404 = sin sprite), carga `Walk-Anim.png` e
  `Idle-Anim.png` como hojas y crea las 16 animaciones (caminar y reposo × 8 direcciones).
- **En la partida**: jugador, enemigos y jefe usan SpriteCollab si lo tienen (si no, el de PokeAPI de siempre, con
  su volteo). El jugador mira hacia donde dispara o se mueve y alterna caminar/reposo según se mueva; los enemigos
  miran hacia ti. Cuerpo físico recalculado hacia los pies del sprite. Al evolucionar y en Oleadas (especies nuevas)
  también se cargan. Los **shinies** (jugador o enemigo) siguen con el sprite de PokeAPI para que se note el color.
- **Créditos**: nueva opción "Créditos" en Ajustes (PokeAPI, SpriteCollab CC BY-NC 4.0, Pixelify Sans OFL y el aviso
  de Pokémon) y sección en el README.
- **Comprobado**: captura real (`REAL_SPRITES=1 npx playwright test -c tests/e2e/playwright.config.ts screens`) con
  Charmander de SpriteCollab andando hacia la derecha. Las pruebas normales simulan SpriteCollab con 404 (el juego
  usa entonces el de PokeAPI), y los 404 de recursos ya no cuentan como error de consola.
- **Dudas**: los menús (colección, Pokédex, título…) siguen con los sprites de PokeAPI; la tarea hablaba de jugador,
  enemigos y jefes. El tamaño (`pmdScale`) está igualado a ojo con el de antes.

## T33 — Arte del supervisor en la partida (2026-10-19)

- **Qué**: `GameScene` llama a `bakeIcons` y `bakeBiomeTiles` al montar cada piso. Las salas normales (inicio,
  combate, jefe) pintan suelo y paredes con `TileSprite` de las baldosas del bioma, escaladas ×1,25 (baldosa de 32 px
  sobre la casilla de 40 de `roomLayouts`, así cuadran con los obstáculos; la cámara de juego ya va a ×1,5). Los
  huecos de las puertas también llevan suelo de baldosa. Rocas (siguen rompiéndose con bomba), columnas (apoyadas en
  su base, más altas que la casilla), agujeros, charcos y hierba alta usan sus texturas.
- **Iconos**: monedas (la de 5, más grande), bayas Aranja/Zidra, llaves, bombas (en el suelo y la que pones),
  cofres (cerrado/abierto), trampilla, objetos del suelo (bolsa = pasivo, disco teñido del color del tipo = poder,
  Poké Ball = activo), artículos de la tienda (Poción/Superpoción, disco, bolsa) y contador del HUD.
  En Mejoras, icono de ticket junto al saldo.
- **Decisiones**: las salas especiales (tesoro, tienda, Centro, secreta, desafío) mantienen su color de suelo liso
  para distinguirlas de un vistazo; las paredes sí son de baldosa en todas. Todo con NEAREST (ya lo hacen las texturas
  del supervisor).
- **No hecho (por N5/N11)**: los tickets del menú principal (`MenuScene`) y del gacha (`GachaScene`) no los he tocado;
  si el supervisor quiere el icono allí, es `addIcon(scene, x, y, 'ticket', 2)`.
- **Comprobado**: tsc, tests, build y e2e (capturas de la sala inicial con baldosas y del HUD con iconos).

## T24 — Misiones y logros (2026-10-19)

- **Lógica** (`src/data/missions.ts`, tests en `tests/missions.test.ts`): la partida manda sucesos (enemigo
  vencido con sus tipos, jefe, cofre, monedas, sala limpia, objeto, shiny, piso alcanzado con "te has curado o no",
  victoria). 8 plantillas de misión diaria; cada día se eligen 3 distintas con `mulberry32` y la semilla del día
  (`dayNumber` de gacha.ts, cambia a medianoche local). 9 logros permanentes. `applyMissionEvent` es pura;
  `recordMission` (save.ts, clave `pokeisaac.missions`, incluida en "Borrar progreso") guarda y da los premios
  (tickets y desbloqueo de Pokémon).
- **Objetos nuevos en el sorteo**: Cinta Elegida, Moneda Amuleto, Banda Focus y Gafas Elegidas no salen (suelo ni
  tienda) hasta conseguir su logro. `rollItem` y `rollShop` aceptan ahora el `pool` de pasivos.
- **"Sin curarte"**: `GameScene` marca `healedRun` si los PS suben (bayas, pociones, Centro, robo de vida, Restos…),
  salvo cuando suben por más PS máximos (objeto o evolución). Se guarda: `RunSave` v9 con `healed`; los
  guardados v8 se migran con `healed: true` para no regalar la misión.
- **Pantalla**: `MissionsScene` (diarias con barra y premio, cuenta atrás hasta medianoche, logros 3×3). Aviso en
  partida en la franja de abajo, en cola si se cumplen varias a la vez.
- **Decisión (N5)**: no puedo tocar `MenuScene`, así que el acceso está en **Jugar** (SlotsScene): una cuarta opción
  "Misiones y logros" debajo de los huecos. Si el supervisor quiere un botón en el menú principal, basta con
  `{ label: 'Misiones', action: () => goTo(this, 'Missions') }` en MenuScene (y que `back()` de MissionsScene vuelva
  a 'Menu').
- **N12**: leída; no he tocado el gacha. No hay misión de "tira en el gacha" para no depender de él (se podría con
  `loadHistory()`).
- **Comprobado**: tsc, tests (166), build y e2e (captura `03b-misiones` entrando con teclado y saliendo con Esc).

## T25 — Tutorial y equilibrio (2026-10-19)

- **Tutorial** (`src/data/tutorial.ts` + `loadTutorial`/`saveTutorial` en save.ts, tests en `tests/tutorial.test.ts`):
  9 consejos (moverse, disparar, pausa, poderes, objetos, objeto activo, Centro, tienda, cofres y bombas) que salen
  la primera vez que pasa cada cosa, con los tres controles en el texto. **No paran el juego** (decisión: todos los
  botones frontales del mando ya hacen algo en partida y un cartel bloqueante obligaría a cambiar controles). Se
  cierran solos a los 9 s, con T / RT / clic en "Vale"; "No más consejos" con N / LT / clic. Si salen varios a la vez,
  van en cola. El e2e comprueba que T cierra el primero y que queda guardado.
- **Simulación** (`simulateRuns` en balance.ts, `scripts/simulate.ts`, test en balance.test.ts): Monte Carlo con
  la dificultad, estadísticas de enemigos y jefes, salas reales de `generateFloor`, bayas, Centro, tienda y objetos
  (+12 % de DPS cada uno). Lo que no se puede sacar del código es cuánto te aciertan: lo he supuesto
  (`hitsPerSecond` 0,035 por enemigo vivo y 0,07 el jefe).
- **Qué salió con los números de la T32** (sin mejoras): piso 1 lo supera el 97 %, el piso 2 el 21 % y nadie pasa
  del 3. El daño por sala crece mucho por tres cosas a la vez: +45 % de vida por piso, enemigos más fuertes (franja
  de estadísticas) y un enemigo más por sala hasta +4 (y con más enemigos vivos a la vez, el daño crece con el
  cuadrado). Las bayas (0,8 % + 0,2 %) casi no curaban.
- **Cambios** (moderados, para no deshacer la T32): vida por piso +45 % → +35 %, daño +30 % → +22 %, como mucho
  +3 enemigos por sala (antes +4), Baya Aranja 0,8 % → 1,3 % y Zidra 0,2 % → 0,4 % (siguen siendo 1-2 bayas por piso,
  el test de la T32 se mantiene). `CLEAR_DROP_CHANCE` pasa de GameScene a loot.ts para que la simulación use el
  mismo número.
- **Resultado** (modelo): piso 1 97 %, piso 2 ~45 %, piso 3 casi nadie sin mejoras; con mejoras (+40 % daño,
  +30 PS) el piso 2 siempre y el 3 más de la mitad; esquivando el doble se llega al 4-5. Me parece razonable para
  un roguelike con mejoras permanentes, pero **hay que probarlo jugando**: si Roberto lo nota muy duro, lo primero
  sería bajar `difficultyFor().hp` o subir `itemDpsGain` real (objetos).
- **Tickets**: una partida media da ~15 tickets (0,15 tiradas) sin contar misiones (unos 10-12 al día con las 3
  diarias). No lo he tocado: la T32 lo dejó así a propósito.

## T26 — Jefes con patrones (2026-10-19)

- Casi todo venía de la T32 (`bossPatterns.ts`: ráfaga, embestida, lluvia, aviso de 0,75 s y fase 2 al 50 %). Faltaba
  **invocar ayudantes**: nuevo ataque `summon` para jefes de tipo Psíquico, Fantasma, Veneno, Planta, Hada o Hielo
  (así tienen 3 ataques; los demás 2, Dragón 3). Aviso: el jefe se tiñe de su color y salen círculos que crecen
  donde aparecerán; luego salen 2 enemigos del piso (3 en fase 2), con un 60 % de vida, sin botín y como mucho 4 a la
  vez (si ya hay 4, hace una ráfaga). Al caer el jefe se van sus ayudantes. Lógica y tests en bossPatterns.ts /
  balance.test.ts.
- **Error arreglado**: los círculos de aviso se destruían mientras su tween seguía vivo y en el siguiente fotograma
  el tween escribía en un objeto destruido → excepción que **paraba el juego**. Pasaba con la invocación y podía
  pasar con la lluvia de la T32 (mismo patrón). Ahora se mata el tween antes de destruir.
- **e2e nuevo** `tests/e2e/boss.spec.ts`: saca al jefe en la sala inicial, le hace invocar 3 veces (2, luego 4, y
  no pasa de 4) y comprueba que los ayudantes se van al vencerlo, sin errores (captura `15-invocacion`).

## T27 — Habilidades de PokeAPI (2026-10-19)

- `src/data/abilities.ts` (tests en `tests/abilities.test.ts`): `pickAbility` coge la primera habilidad no oculta;
  `ABILITY_EFFECTS` tiene ~40 con efecto y nombre en español (así no hace falta pedirlo); las demás usan
  `GENERIC_EFFECT` (+5 % de daño) y su nombre en español se pide a `ability/{nombre}` (`fetchAbility` en
  pokeapi.ts, con caché; si falla, el nombre en inglés arreglado).
- Efectos: casi todos son cambios de estadísticas como un objeto (se aplican en `calcStats` después de objetos y
  sinergias). Mar Llamas/Espesura/Torrente/Enjambre: ×1,5 al daño del disparo y de los poderes de su tipo con menos
  de 1/3 de PS (`pinchMul`). Levitación: el colisionador del jugador con los agujeros tiene un `processCallback`
  que lo desactiva.
- Se carga al empezar cada piso (de la forma actual) y al evolucionar. En la pausa: "Habilidad · Nombre" y su efecto
  (descripciones de 60 caracteres como mucho para que quepan; hay test).
- El mock de PokeAPI de los e2e ahora trae `abilities` (Mar Llamas o Torrente y una oculta).
- **Duda**: no hay habilidades para los enemigos ni para los jefes; la tarea solo hablaba de tu Pokémon.

## T28 — Resumen de partida e historial (2026-10-19)

- `src/data/runHistory.ts` (tests en `tests/runHistory.test.ts`): `RunRecord`, `parseHistory` (descarta registros
  malos sin perder los buenos), `withRun` (últimas 20, la más reciente primero), `formatDuration` y los contadores
  de la partida. save.ts: `loadRunHistory`/`addRunHistory` con la clave `pokeisaac.history` (en "Borrar progreso").
  Los nombres no chocan con `loadHistory` del gacha del supervisor.
- **Contadores** en GameScene: tiempo (suma `delta` en `update`; en pausa la escena está parada y no cuenta),
  enemigos vencidos, daño hecho (golpes, poderes, bombas, estados y Casco Dentado; sin contar lo que sobra al
  rematar) y si se bate un récord. Pasan de piso en `FloorCarry` y se guardan: **`RunSave` v10** con `counters`; los
  v9 se migran con los contadores a cero.
- **Final**: `finish(won, mensaje)` apunta la partida en el historial, muestra el cartel y va al **resumen**
  (`SummaryScene`) con R / Start / clic o solo a los 3,5 s. Resumen: Otra partida (al mismo hueco), Historial o Menú
  (MenuList: teclado, ratón y mando; Esc/B = Menú).
- **Historial** (`HistoryScene`): tabla de las 20 últimas (verde si ganaste, ★ si hubo récord). Por N5 no está en el
  menú principal: se abre desde el resumen y desde **Jugar** (botón "Historial" junto a "Misiones y logros"; con
  flechas, las dos opciones van después de los huecos). Vuelve a donde se abrió.
- **e2e** (`boss.spec.ts`): pierde una partida, ve el resumen con R, entra en el historial, Esc al menú, y abre el
  historial desde Partidas (capturas `16-resumen` y `17-historial`). Corregido `screens.spec`: a Misiones ahora se
  llega con dos flechas arriba.

## T37 — Avisos fuera del centro (2026-10-19, prioritaria por N15)

- `src/ui/toast.ts`: `ToastStack` (tarjetas con franja de color, icono de `icons.ts`, título en negrita y texto
  pequeño; entran deslizando desde la derecha, como mucho 4, la más vieja se va, duración según lo largo que sea).
  Tipos: info, reward, item, heal, warning, danger y mission, cada uno con color e icono por defecto.
- GameScene: la pila está en la franja derecha del HUD, justo **debajo del minimapa** (`drawMinimap` ahora devuelve
  dónde acaba y la pila se recoloca). Los 28 `showBanner` pasan a `notify(texto, { kind, icon })` con su tipo e
  icono (el poder nuevo lleva el disco del color de su tipo). Los avisos de misión/logro ya no van abajo en el centro:
  son tarjetas `mission`. El cartel del centro solo queda para el **fin de partida** (`setBanner`).
- Consejos del tutorial: ahora en la franja de abajo, de lado a lado de la sala (una línea con título, texto y los
  botones "No más consejos" / "Vale").
- **Decisiones**: los números que saltan sobre los Pokémon (+PS, ¡Crítico!, ¡Shiny!, +1 moneda, ¡Esquivado!) se
  quedan donde están: son reacción del combate pegada a quien la provoca, no avisos. Menús: `UpgradeScene` ya avisa
  abajo y el aviso de `MenuScene` (abajo también) es del supervisor (N5); el gacha no se toca (N11). La intro de jefe
  VS es de la T36.
- e2e: `boss.spec.ts` lanza 5 avisos y comprueba que quedan 4 (captura `14b-avisos`).

## T42 — Funcionar aunque PokeAPI/SpriteCollab fallen (2026-10-19, orden de N16)

- **Caché persistente**: service worker `public/sw.js` ("primero la caché") para `pokeapi.co` y
  `raw.githubusercontent.com` (sprites de PokeAPI, SpriteCollab y gritos); guarda también los 404 (Pokémon sin
  SpriteCollab) para no repetirlos. Se registra en `main.ts` solo en producción. Elegí service worker en vez de
  IndexedDB porque cubre de una vez JSON, imágenes del cargador de Phaser y audio sin tocar cada carga. En los e2e
  va bloqueado (`serviceWorkers: 'block'`) para que `page.route` siga simulando PokeAPI.
- **Paquete** `public/data/offline/` generado con `node scripts/buildOffline.ts` (usa la lógica del juego:
  `REGIONS`, `biomeEnemyPool` de los 5 pisos de cada bioma, `biomeBossPool`, `FALLBACK_ENEMIES`): 186 Pokémon
  con sprites normales y shiny, especies (nombre en español), cadenas de evolución de los iniciales, habilidades
  sin efecto propio, y 14 movimientos con potencia de cada uno de los 18 tipos. Mismo formato que PokeAPI
  (recortado), así el juego lo usa tal cual. ~1 MB (744 PNG pequeños).
- **Si falla**: `getJson` espera como mucho 6 s y si no, tira de `data/offline/<recurso>/<id>.json`
  (`offlinePath`). Si un Pokémon no está ni en la red ni en el paquete, `substitutePokemon` lo inventa con
  species-index (tipos reales, estadísticas repartidas, Poké Ball genérica de `scripts/makePlaceholder.ts`).
  Imágenes: parche global de `LoaderPlugin.image` en main.ts que, si una imagen falla, carga la Poké Ball con la
  misma clave (vale para todas las escenas, también el gacha sin tocar su archivo); `loader.timeout` de 8 s.
- **Partida**: sin red, enemigos y jefe se eligen entre los del paquete (con sus sprites de verdad). Aviso
  "Sin conexión · Usando datos guardados" con las tarjetas de la T37 (una vez por sesión).
- **Pruebas**: `tests/offline.test.ts` (rutas, sustituto, tiempo límite y que el paquete trae iniciales, reservas,
  sprites y los 18 tipos) y `tests/e2e/offline.spec.ts` (PokeAPI y GitHub cortados: se llega a jugar con
  Charmander de verdad y sale el aviso; captura `18-sin-conexion`).
- **Dudas**: la caché del service worker no tiene límite de tamaño (sprites pequeños; si crece mucho, se puede
  añadir un tope). Los gritos no van en el paquete (pesan; sin red simplemente no suenan).

## T43 — Pantalla de error en lugar de cuelgue (2026-10-19)

- `src/ui/errorScreen.ts`: escucha `error` y `unhandledrejection` de window. Es **HTML encima del canvas** (no una
  escena de Phaser) porque un error dentro de un fotograma para el bucle de Phaser: su `requestAnimationFrame` no
  vuelve a pedir el siguiente (lo vimos en la T26). "Volver al menú" duerme y despierta `game.loop` (así se
  reanuda), para las escenas activas y arranca `Menu`; si eso fallara, recarga la página.
- Teclado: flechas/Tab mueven, Enter/espacio elige, Esc/Retroceso vuelve al menú (se captura antes que Phaser).
  Mando: se lee con `navigator.getGamepads()` en un intervalo (el bucle puede estar parado): cruceta/stick, A, B;
  lo que ya estaba pulsado al abrir no cuenta. Ratón: botones. "Copiar detalles" usa el portapapeles.
- `src/data/errorReport.ts` (tests): mensaje corto de una línea, informe con fecha, pantallas activas, dirección,
  navegador y pila (también va entero a `console.error`), y lista de errores inofensivos que no sacan el cuadro
  (ResizeObserver, audio bloqueado por el navegador, peticiones abortadas).
- El fallo al cargar una partida (antes dejaba el texto "No se pudo cargar PokeAPI" para siempre) usa ahora esta
  pantalla (`reportError`).
- e2e `errors.spec.ts`: rompe el update de Partidas (`sys.sceneUpdate`, que es lo que llama Phaser), comprueba el
  cuadro, vuelve con Enter, comprueba que el menú responde, y lo repite con el ratón (captura `19-error`).

## T44 — Teclas configurables (2026-10-19)

- `src/data/keybinds.ts` (tests en `tests/keybinds.test.ts`): 17 acciones (moverse ×4, disparar ×4, poderes 1-4,
  objeto activo, bomba, pausa, aceptar/usar, volver), teclas por defecto (las de siempre), `bindKey` (si la tecla ya
  la usa otra acción no cambia nada y dice cuál), `parseKeys` (lo que no valga vuelve a por defecto; nunca quedan
  repetidas), `keyLabel` (↑, Espacio, Num 1…) y `controlsFor` (texto de controles con las teclas actuales).
  Las teclas se guardan por su nombre de Phaser en `pokeisaac.keys` (save.ts). **No** se borran con "Borrar
  progreso": son un ajuste, como el volumen.
- **Quién las lee**: GameScene (moverse, disparar, poderes, activo, bomba, pausa = Pausa o Volver, usar = Aceptar) y
  `NavInput` de todos los menús (moverse, aceptar, volver y pausa; las flechas, Espacio y Retroceso valen siempre
  para no quedarse atrapado). Solo he tocado la parte lógica de nav.ts (N5 protege la visual de MenuList).
- `CONTROLS` (data/controls.ts) ahora se rellena con las teclas configuradas y `refreshControls` la reescribe en
  sitio al cambiarlas: así el cuadro de controles del menú principal (MenuScene, que no puedo tocar) también enseña
  las teclas nuevas sin cambiar su código.
- **Pantalla** `KeysScene` (Ajustes > "Controles y teclas"): dos columnas con las 17 acciones, "Restablecer" y
  "Volver". Elegir con flechas/ratón/mando, Enter/clic/A y pulsar la tecla nueva; Esc, B o un clic fuera cancelan
  (Esc sí se puede poner en "Volver"). Encima de la pausa, Ajustes solo enseña los controles (cambiar teclas a mitad de
  partida no se aplicaría hasta el piso siguiente).
- **Fijas**: R (nueva partida al acabar), T y N (consejos del tutorial). Los botones del mando no se cambian (la tarea
  lo dejaba opcional).
- e2e `keys.spec.ts`: pone la bomba en W (avisa de que es "Moverse arriba" y no cambia), luego en Q, y en la partida
  E ya no suelta bomba y Q sí (captura `20-teclas`).

## T45 — Cuentas (terminada por el supervisor)
- La sesión de VS Code se cortó a mitad de la T45 (cambios sin commit). El supervisor la ha terminado: arreglado el
  error de tsc (`autocomplete` con setAttribute), registrada `AccountScene` en main.ts, fila "Cuenta" en Ajustes
  (encima de la pausa no se abre: entrar o salir recarga la página), aviso de invitado/cuenta arriba a la derecha del
  menú (clic → Cuenta), botón de Google solo con `VITE_FIREBASE_GOOGLE=1`, tests `tests/account.test.ts` (200 en
  total) y sección del README. Firestore ya tiene las reglas de `firestore.rules` publicadas.

## T36 — Arte del supervisor en la partida (hecha por el supervisor)
- Intro VS del jefe (`BossIntroScene`, registrada en main.ts) al aparecer cada jefe: la partida se pausa debajo, se
  salta con Enter/Esc/clic/A y el jefe espera 1,2 s antes del primer ataque.
- Música: pista del bioma al empezar cada piso, la del jefe al aparecer, vuelve la del bioma al vencerlo y la del menú
  al salir de la partida.
- Efectos por tipo: estela en los poderes (no en el disparo normal), estallido al golpear con un poder y bocanadas
  del estado mientras dura (quemado, congelado…).
- HUD: paneles oscuros con borde dorado (`drawHudFrame`) y ranuras de poder con la franja del tipo
  (`drawSlotFrame`, gris al recargar); textos del HUD en blanco. Barra del jefe con el mismo marco.

## Supervisor — Arte y animaciones (19/10, tarde)
- Pantalla de victoria/derrota, sombra y saltito al andar, animaciones de combate (`src/ui/art/combatFx.ts`),
  Pokédex nueva (`src/ui/art/dexCard.ts`) y transición entre pisos: caída girando por la trampilla y cartel del piso
  con el emblema del bioma (`FloorIntroScene`, registrada en main.ts), y el jugador cae botando en la sala nueva.

## Supervisor — Catálogo de ataques (19/10, tarde)
- `src/data/movePatterns.ts` (lógica pura, tests en `tests/movePatterns.test.ts`): 6-8 estilos por tipo inspirados en
  los juegos (chorro, rayo, onda, temblor, lluvia, bomba en parábola, órbita, ola, cadena, erupción, trampas,
  embestida, remolino) y los movimientos famosos con el suyo; el resto elige uno de su tipo por potencia e id.
  Disparo normal según el tipo del Pokémon; disparo de los enemigos según su tipo; jefes con 2-4 movimientos de su
  tipo (con su nombre y aviso) además de sus ataques; élites desde el piso 2 (10 % más por piso, hasta 50 %).
- `src/scenes/attacks.ts`: el motor (castPattern, updateShots). GameScene le da un `AttackHost` (makeHost) y el daño
  de todo pasa por `hitEnemy` (antes estaba dentro de onHit). El campo `shape` de los poderes ya no se usa para
  disparar (se deja por compatibilidad con los guardados).

## Supervisor — Reto final, minijefes y curación (19/10, noche)
- Reto final (`src/data/finale.ts`, `FinalPromptScene`): tras el jefe del piso 5 de Normal sale una trampilla dorada;
  al pisarla se pregunta: aceptar el reto, rendirse y ganar, o todavía no. El piso 6 es una arena con un trío
  legendario (barra compartida; si cae uno, los demás se enfurecen) o un legendario gigante (x3,5 de vida y furia
  final al 25 %), al azar. Superarlo da +60 tickets. `progressText` muestra "Reto final" en ese piso.
- Todos los legendarios invocan ayudantes de su tipo (`summonKinds`, cargados con el piso).
- Minijefe en cada piso (Normal e Infinito): la sala de combate más lejos de la entrada (rombo naranja en el mapa);
  el Pokémon más fuerte del bioma en grande, con dos movimientos de su tipo; suelta objeto y tickets.
- Curación por golpes: Drenar cura una vez por lanzamiento (700 ms) y Drenar y Concha Campana tienen tope de un 4 %
  de los PS máximos por segundo.

## Tickets con el gacha a 10 (19/10, noche)
- Repaso: con 1 ticket por sala, 1×piso por jefe y 2 por minijefe, llegar al piso 3 da ~33 tickets (3 tiradas), la
  partida completa ~70 (7 tiradas) y con el reto final ~136. No he cambiado los números de las salas ni del jefe:
  una partida buena da varias tiradas y una mala (piso 1-2) da 1-2.
- `minibossTicketsFor` (progression.ts) en vez de `roomTicketsFor * 2` suelto en GameScene, y el minijefe entra en
  `expectedFloorRewards` y en `simulateRuns`. Nuevo `expectedFinaleRunTickets`.
- tests/balance.test.ts: rangos en tiradas (piso 3: 2,5-4,5; completa: 5-8; con reto final: menos de 2 tiradas x10;
  la simulación da al menos una tirada).
- **Duda para el supervisor**: el reto final da +60 (`FINALE_BONUS`, finale.ts, que no toco). Con eso una partida
  con reto da ~136 tickets, más que una x10. Si parece mucho, con 30 quedaría en ~106 (una x10 justa).

## T34 — Desafío diario
- `src/data/daily.ts` (tests en `tests/daily.test.ts`): semilla del día (`dayNumber` de gacha.ts, hora local, como
  las misiones), inicial del día entre los 27 iniciales de las 9 regiones (nunca el mismo dos días seguidos), semilla de
  cada piso y `dailyRng(día, piso, secuencia)`. Estado `pokeisaac.daily` (save.ts: `loadDaily`, `beginDaily`,
  `submitDaily`; entra en "Borrar progreso"): último día, pisos de hoy, mejor, racha y mejor racha.
- **Cuenta la primera partida del día al empezarla** (no al acabarla): así salir a mitad y repetir no sirve para
  mejorar el récord. La racha sube al empezar; se ve a 0 si ayer no se jugó.
- Es una partida de Normal (`mode: 'normal'`) con `daily: { day, counts }` en `GameData` y en `RunSave`
  (**RUN_VERSION 11**, los v10 se migran con `daily: null`). Pasa de piso a piso por `scene.restart`.
- GameScene: con desafío, la semilla del piso es la del día y salas, jefe (y reto final), tesoros/objetos que caen,
  cofres, tienda y objeto al limpiar usan `this.rng(secuencia)` (una secuencia fija por piso y por cosa); fuera del
  desafío sigue siendo `Math.random`. Al acabar, la partida que cuenta apunta los pisos completados (récord en el
  resumen si es el mejor). El combate (críticos, botín de enemigos) sigue al azar normal.
- ModeScene: quinta opción "Desafío diario" con el inicial del día (nombre en español) y el texto de hoy/racha.
  Huecos, pausa y cartel de inicio dicen "Desafío diario".
- Dudas: las mejoras permanentes del inicial del día sí cuentan (no es del todo igual para todos); el récord de Normal
  también se actualiza con el desafío. Al continuar una partida diaria guardada, el azar de objetos del piso empieza
  de nuevo (las semillas del piso y de las salas sí se conservan).
