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
