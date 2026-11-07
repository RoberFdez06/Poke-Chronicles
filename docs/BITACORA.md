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

## T40 — Selector de dificultad
- `src/data/difficulty.ts` (tests `tests/difficulty.test.ts`): Fácil/Normal/Difícil con multiplicadores de vida y daño
  enemigo (`applyDifficulty` sobre la dificultad del piso, así afecta a enemigos, minijefes y jefes), curas
  (`scaleHeal`: bayas, pociones y Centro; no la curación de objetos) y tickets (`scaleTickets`: en Fácil/Difícil la
  parte decimal se sortea, así un ticket de sala da 0-1 en Fácil y 1-2 en Difícil, con la media exacta).
- Récords por dificultad: `loadRecords(storage, diff)` / `submitRecord(modo, valor, storage, diff)`; Normal sigue en
  `pokeisaac.records` (los récords de antes no se pierden), las otras en `.easy` / `.hard` (también se borran con
  "Borrar progreso"). El menú principal (MenuScene, que no toco) sigue enseñando los de Normal.
- `RunSave.difficulty` (**RUN_VERSION 12**, los v11 pasan a Normal) y `GameData.difficulty`; pasa de piso a piso.
  GameScene: `giveTickets()` junta los cinco sitios que daban tickets. La pausa, los huecos y el cartel de inicio
  dicen p. ej. "Infinito (Difícil)" (`withDifficulty`).
- ModeScene: fila "Dificultad: ◀ Normal ▶" bajo la lista (izquierda/derecha, clic en las flechas o en el nombre) con
  su descripción; el récord del panel es el de la dificultad elegida. El desafío diario va siempre en Normal.
- N19: el commit de la T34 se llevó `src/scenes/TitleScene.ts` del supervisor (iba con `git add -A`). Desde aquí
  añado solo mis archivos; en GameScene he subido solo mis trozos (`git apply --cached` con el diff filtrado) y he
  dejado sin commit los del supervisor (comportamientos nuevos de enemigos, zarpazos). El test de enemigos que falla
  (`cada tipo tiene un comportamiento…`) es de su enemies.ts a medias, no de esta tarea.

## T38 — Clima por piso
- `src/data/weather.ts` (tests `tests/weather.test.ts`): 5 climas con nombre y descripción, climas posibles por bioma
  (`BIOME_WEATHERS`), `weatherFor(bioma, piso, rng)` (45 %, nunca en el piso 1), `weatherPowerMul` (Lluvia/Sol con
  Agua/Fuego), `weatherHurts` (arena salvo Roca/Tierra/Acero, granizo salvo Hielo) y `weatherChip` (3 % de PS máx.).
- GameScene: clima con `mulberry32(floorSeed ^ …)` (no hace falta guardarlo: sale igual al continuar y en el
  desafío diario), solo en pisos con salas de Normal/Infinito (no en Oleadas, Rush ni el reto final). El multiplicador
  va en `hitEnemy` (tus ataques, por tipo) y en `hurtPlayer` (contacto por el tipo del enemigo; disparos por `ptype`).
  Arena/granizo: `weatherTick` cada 4 s solo mientras hay enemigos en la sala; al jugador nunca lo deja por debajo
  de 1 PS y a los jefes no les afecta. HUD: "Piso 2/5 · Lluvia · 3 enem." y aviso al empezar el piso.
- `src/ui/weatherFx.ts` (fuera de `ui/art`, que es del supervisor): un Graphics con 40-70 cuadraditos (gotas,
  arena, granizo) o rayos de sol, un tinte encima de la sala y, con niebla, una viñeta (textura con degradado hecha
  una vez) que sigue al jugador. Profundidad 20 (encima de la sala, debajo de los carteles). Tiene modo `low` con
  menos partículas, para la T41.

## T39 — Eventos en salas (salas sorpresa)
- `src/level/roomEvents.ts` (tests `tests/roomEvents.test.ts`): `pickRoomEvent` (35 % de los pisos desde el 2, una sala
  de combate sin cofre ni minijefe, mejor sin salida; con la semilla del piso), Pokémon raro (`RUNAWAY_SECONDS` 12,
  vida x2,5, `runawayTickets`), mercader (`merchantStock`: 3 pasivos/poderes a 8, 14 y 22 monedas, sin pociones),
  altar (`altarCost` 15 % de PS máx., no baja de 30) y cofre trampa (`trapChestOutcome`, 45 % enemigo).
- **RUN_VERSION 13**: `eventsDone` (salas sorpresa resueltas del piso) y `hpSacrificed` (PS máx. dados en altares,
  pasa de piso en piso por `FloorCarry`); los v12 se migran con [] y 0. `calcStats` resta `hpSacrificed`.
- GameScene: `startEvent` al entrar en la sala sin resolver (antes que el combate normal). El Pokémon raro es un
  enemigo con `runaway` (no hace daño al tocarte; `updateRunaway` lo aleja de ti cada fotograma, se escurre de lado
  en las paredes y a los 12 s se va con humo: la sala queda limpia con su ticket normal). Mercader, altar y cofre se
  usan con Enter / A / clic cerca (`eventSpots` en `updateInteract`, aviso encima) o clic en el objeto; al resolverse
  la sala queda limpia sin dar tickets (`finishEvent`). El enemigo del cofre trampa lleva `mimic`; al vencerlo
  (o al raro) `eventFoeDefeated` da el premio. Marca en el minimapa (rombo con el color del evento) al visitarla.
- Dibujos sencillos con Graphics (puesto, altar) e iconos que ya había (bolsa, disco, estrella, cofre tintado);
  si el supervisor quiere, puede cambiarlos por arte suyo.
- e2e: `boss.spec.ts` (ayudantes del jefe: 0 en vez de 2) y `flow.spec.ts` ("Texture key already in use:
  starter-X-front") **ya fallaban en 5b60bce**, antes de mis tareas (lo he comprobado con una copia de trabajo
  aparte). Lo miro en la T29.
- En GameScene solo he subido mis trozos: los del supervisor (puertas de Gimnasio en `buildDoor`/`setDoorsLocked`)
  siguen sin commit en su copia.

## T35 — Controles táctiles (solo en móvil) y pantalla de Controles por secciones
- `src/data/controls.ts` (tests `tests/controls.test.ts`): `controlSections(teclas)` con las 9 acciones (moverse,
  disparar, poderes, activo, bomba, usar, pausa, menús, volver) en los 4 modos; test de que cada acción está en
  todos. `isTouchOnly`/`touchOnlyDevice` (pantalla táctil sin ningún puntero fino: en PC, aunque sea táctil, nunca)
  y `visibleModes`. `CONTROLS` sigue igual para el menú principal (MenuScene es del supervisor).
- `ControlsScene` (clave 'Controls', registrada antes de PauseScene; al abrirla se hace `bringToTop` y la escena que
  la abre se pausa y luego `resetKeys`, por lo de N10). La abren la pausa (opción Controles) y Ajustes encima de la
  pausa (`openControls`). Desde Ajustes del menú sigue yendo a Teclas (T44). Empieza en la pestaña del modo en uso
  (Mando si hay uno conectado, Táctil en móvil).
- **Pendiente para el supervisor**: el cuadro de Controles del menú principal (MenuScene) podría llamar a
  `openControls(this)` de `ControlsScene.ts` para tener también las secciones.
- `src/ui/touchControls.ts`: dos joysticks (dedos separados, `addPointer(3)`) y botones 1-4, Activo, Bomba y Usar en
  las franjas del HUD. GameScene los lee junto al teclado y el mando; con táctil, tocar la sala no dispara (lo hace
  el joystick). `index.html`: `touch-action: none`, sin zoom ni selección.
- e2e `tests/e2e/controls.spec.ts`: en PC (sin táctil) pausa → Controles → pestañas con flechas → Esc cierra solo
  los Controles; en móvil emulado (hasTouch/isMobile) aparecen los joysticks y arrastrar el izquierdo mueve al
  Pokémon (capturas `21-controles`, `22-tactil`). Las dos pasan.
- Nota: en pantallas pequeñas, el joystick derecho y los botones 1-4 tapan en parte las ranuras de poder del HUD
  (son semitransparentes y las ranuras también se pueden tocar).
- N20: el commit 169b204 del supervisor llevaba mis trozos de GameScene; aquí van el resto de archivos de la T35.

## T41 — Rendimiento
- **Medida** (`tests/e2e/perf.spec.ts`, `npx playwright test -c tests/e2e/playwright.config.ts perf.spec.ts`): primera sala
  del piso 1 con 30 enemigos más, disparando sin parar 6 s; FPS reales y ms de trabajo por fotograma (de `prestep` a
  `postrender`). Chromium sin pantalla pinta WebGL por software (≈65 % del tiempo en el perfil), así que es un "PC
  flojo"; frenar la CPU ×4 con CDP casi no cambiaba nada. Cada piso es distinto, así que hay ruido (±0,5 FPS).
  - Antes: 3,3 / 3,4 / 3,5 / 3,9 FPS, 34-40 ms por fotograma, ~900-1100 objetos en la escena.
  - El desglose de objetos mostró la causa: se construyen las ~9 salas del piso al empezar y Phaser las pintaba
    **todas** en cada fotograma (46 TileSprites, ~370 imágenes, ~40 Graphics) aunque solo se ve una.
  - Después (solo la sala actual en cámara + tope de partículas): 6,5 / 6,5 / 7,0 FPS, 28-34 ms (efectos altos);
    6,6 / 6,7 / 7,2 FPS, 24-31 ms (efectos bajos). Unas **×1,9** más FPS.
- GameScene: `roomObjs` guarda lo que crea `buildRoom` de cada sala y `showRooms` lo quita de la cámara principal con
  `cameraFilter` (no con `visible`, que ya usa el juego para rejas, grietas…); se enseñan la sala actual y, durante el
  paso de puerta, la siguiente. `FxBudget` (src/data/fxSettings.ts, con tests) limita las partículas frecuentes
  (chispas al golpear, impactos de tipo, fogonazos, estelas, bocanadas de estado, polvo) a 14 cada 100 ms.
- Ajustes: "Efectos visuales: Altos/Bajos" y "Mostrar FPS" (`pokeisaac.fx`, no se borra con el progreso). Bajos: sin
  esas partículas, sin temblores de cámara (`shake` anulado en la cámara de la partida) y el clima con menos
  partículas. keys.spec.ts: Controles y teclas ahora es la 6.ª fila de Ajustes.
- **No hecho (archivos del supervisor, nota N21)**: pools de proyectiles (se destruyen dentro de `attacks.ts`) y que
  los fundidos (`theme.ts`) y el fondo animado de los menús (`ui/art/landscape.ts`) respeten "Efectos bajos".
- El supervisor subió mis trozos de GameScene de la T41 en su commit b175d91 (como en N20); aquí van el resto de
  archivos. En `save.ts` no subo su cambio de tickets (2 por sala, 3 por jefe), que aún hace fallar
  `tests/balance.test.ts` ("solo el piso 1: 17"): es suyo y está a medias.

## T29 — Pruebas en navegador
- Playwright ya estaba (`npm run e2e`, `tests/e2e/`); faltaban los recorridos con ratón y con mando y había pruebas rotas.
- **Nuevas**: `mouse.spec.ts` (todo con ratón: título → menú → huecos con "← Volver" → región e inicial → modo →
  partida, clic derecho mueve y clic izquierdo dispara, ❚❚ → Reanudar / Salir y guardar → hueco ocupado → Cancelar →
  Continuar) y `pad.spec.ts` (lo mismo solo con mando: A/B, cruceta, sticks y Start). Ninguna toca otro dispositivo y
  todas fallan si hay errores en consola.
- Helpers (`tests/e2e/helpers.ts`): `useFakePad`/`padPress`/`padAxes` (mando simulado cambiando
  `navigator.getGamepads`; ojo: Phaser ignora el mando si su `timestamp` es anterior a su creación, así que se usa
  `performance.now()`, y la pulsación dura un fotograma porque el mando se lee por sondeo), `waitFrames`, `clickText`
  (clic en un texto de la pantalla convirtiendo con la cámara, también la del HUD), `sceneTexts` y `toMenu` (el título
  nuevo del supervisor necesita varias pulsaciones: portada, intro y menú).
- **Arreglos**: "Texture key already in use: starter-X-front" (`flow.spec`): el menú sigue cargando los Pokémon que
  pasean cuando ya estás eligiendo inicial y `loadCardTextures` (src/ui/cards.ts) pedía la misma textura; ahora, si
  otra pantalla ya la carga, espera a que llegue. `boss.spec`: el jefe sale con la intro VS (pausa la partida) y la
  prueba no la saltaba. `controls.spec`: en PC solo salen Teclado y Ratón (cambio del supervisor en ControlsScene).
- Resultado: **12 de 12 pasan** (`npm run e2e`, ~9 min).
- **Fallo encontrado (N23, MenuScene del supervisor)**: una A del mando aún pulsada al aparecer el menú cuenta como
  pulsación nueva y entra en "Jugar". `pad.spec` lo tolera (vuelve con B) y avisa en la consola hasta que se arregle.
- La skill `comprobar` ahora dice cuándo ejecutar `npm run e2e` y que se añadan solo los archivos propios.

## Arreglo — retraso de ~1 s al coger un poder con las ranuras llenas (pedido por el supervisor)
- Causa: con las 4 ranuras llenas, `pickItem` abre SlotSwap. Al elegir, `onChoice` pone `swapCooldownUntil = ahora +
  1200` y en el mismo instante llama a `pickItem` con la ranura elegida (`chosenSlot`), pero `pickItem` miraba ese
  enfriamiento recién puesto y salía sin recoger. A los ~1,2 s el solape con el objeto volvía a llamar a `pickItem`, que
  abría **otra vez** la pantalla de cambio. La ranura elegida no llegaba a aplicarse, y `chosenSlot` se quedaba puesto
  (lo usaba el siguiente poder).
- Arreglo (GameScene `pickItem`): si ya hay `chosenSlot`, no se vuelve a preguntar ni se mira el enfriamiento.
- Medido en el navegador: la recogida normal ya era inmediata (~5 ms, un fotograma); con las ranuras llenas ahora se
  recoge en ~0,4 s desde el Enter (incluye la pulsación) y la pantalla se abre una sola vez.
- Prueba nueva `tests/e2e/slotswap.spec.ts`.

## T48 — Más eventos de sala
- `src/level/roomEvents.ts`: 4 eventos nuevos con nombre, color de minimapa y `ROOM_EVENT_DESC` (premio y riesgo):
  entrenador rival (`RIVAL_WAVES` 3, `rivalWaveSize`, `rivalBonus` = otros tantos tickets como la sala), fuente curativa
  (`fountainHeal` 50 %, `fountainPrice` 6 + 2×piso, o gratis con `FOUNTAIN_TIRED_ROOMS` 2 salas a ×0,8 de velocidad),
  sala del tiempo (`TIME_TRIAL_SECONDS` 20, `timeTrialSize`/`timeTrialExtra`) y huevo misterioso (`EGG_ROOMS` 2,
  `eggHatch` 60 % ayudante / 40 % objeto). Probabilidades por piso con `eventWeights` + `pickEventKind` (la sala del
  tiempo desde el piso 3; más rivales y menos huevos al bajar). Tests en `tests/roomEvents.test.ts` (7).
- **RUN_VERSION 14**: `eggLeft`, `allyId` y `tiredRooms` (también en `FloorCarry`: el huevo, el ayudante y el
  cansancio pasan de piso). Los v13 se migran a 0.
- GameScene: los eventos nuevos en `startEvent`; oleadas del rival y premios del rival y de la sala del tiempo en
  `checkClear`; `onRoomClearedT48` (cuenta del huevo, eclosión, fin del cansancio); `updateTimeTrial` (reloj arriba de
  la sala, rojo en los últimos 5 s) y `updateAlly` (el ayudante sigue al jugador y cada 1,1 s lanza una bola de su tipo
  al enemigo más cercano, 60 % de tu daño). El cansancio entra en `calcStats`. HUD: "Huevo (n)" y "Cansado".
- Fuente y huevo se usan con Enter / A / clic cerca (dos sitios en la fuente: pagar y beber gratis).
- e2e `tests/e2e/events.spec.ts`: fuente (sin monedas avisa; gratis cura y cansa), huevo y ayudante, reloj que se acaba
  y rival con sus 3 oleadas y el premio; sin errores en consola (capturas 30-33).
- Ojo para pruebas: los enemigos recién creados no cuentan en `countActive(true)` durante su entrada.
- En GameScene solo he subido mis trozos; los del supervisor (muros y fosos con `roomShape`) siguen sin commit.

## T49 — Objetos activos y consumibles
- Ya había ranura de objeto activo (Espacio / LB / clic, se recarga limpiando salas) con 4 activos. Añado 5 en
  `ACTIVE_ITEMS` (synergies.ts) para tener los 6 pedidos: Poción (`pocion-activa`, 40 PS), Repelente (ya existía; ahora
  5 s), Caramelo Raro (daño ×2 5 s), Teletransporte (a la sala de inicio; no gasta la carga en la sala del jefe, en las
  arenas ni si ya estás en la de inicio; si la sala no estaba limpia, sus enemigos te esperan al volver), Bomba Cebo
  (radio ×1,6 y daño ×2 de una bomba, sin dañarte) y Silbato (inmune 2 s). Valores en `ACTIVE_EFFECT`.
  `dmgMul` usa ahora `buffMul` (1,5 de Ataque X o 2 del Caramelo Raro).
- Consumible de suelo nuevo: **poción** (`LootDrop` 'potion', 1,2 % por enemigo; `MAX_POTIONS` 3; `CARRIED_POTION_HEAL`
  30). Bombas y llaves ya existían. HUD: cuarto contador (icono `potion`) y los cuatro se reparten con `HUD_COUNT_X`.
- Acción nueva **"Usar poción"** en `keybinds.ts` (tecla C por defecto, detrás de Bomba: caben 18 en la pantalla de
  teclas), en los textos de controles y en `controlSections` (ratón: clic en la poción; mando: L3; táctil: botón
  "Poción"). ControlsScene: filas algo más juntas para que quepan 10.
- **RUN_VERSION 15**: `potions` (y pociones en el suelo); también en `FloorCarry`.
- Tests: activos (synergies), pociones (loot), tecla (keybinds), guardado v14→v15. e2e `tests/e2e/actives.spec.ts`
  (poción con C, cada activo nuevo y el teletransporte desde otra sala), sin errores.
- Iconos: los activos nuevos salen con la Poké Ball; pedidos al supervisor en N24.

## T50 — Más patrones de jefe y minijefes
- `src/data/bossPatterns.ts`: 4 ataques nuevos (`spiral`, `shockwave`, `laser`, `hazard`) con nombre en español.
  `biomeExtraAttacks(tipos del bioma)` da 2 por tipo (tabla `TYPE_EXTRA`) y `bossAttacksFor(tipos del jefe, tipos del
  bioma)` los suma a los de siempre (`bossAttacks` no cambia, así sus tests siguen igual). Parámetros por piso y fase:
  `spiralSpec`, `shockwaveSpec`, `laserSpec`, `hazardSpec`, con topes de "esquivable" (espiral ≥ 90 ms entre disparos
  y ≤ 4 brazos; hueco de la onda ≥ 50° y ≤ 340 px/s; láser ≤ 75°/s y ≤ 3 rayos; aviso de las zonas ≥ 0,9 s).
  `laserHits` y `shockwaveHits` deciden si te tocan. Tests en `tests/bossPatterns.test.ts` (4).
- GameScene: `bossExtra(jefe, ia, ataque, fase)` los dibuja (Graphics) y hace daño con `hurtPlayer` del jefe; devuelve
  cuánto duran para que el siguiente ataque espere. El jefe y el trío usan `bossAttacksFor`. El minijefe, un 35 % de
  las veces, usa uno de los 2 extra del bioma en lugar de su movimiento.
- e2e `tests/e2e/bossextra.spec.ts`: el jefe tiene sus 2 extra; espiral dispara; la zona de peligro y el láser hacen
  daño; onda y minijefe sin errores (capturas 36-39).
- Ojo para pruebas: con fotogramas lentos, el tiempo de Phaser va más despacio que el real; esperar con margen.

## T51 — Más enemigos y comportamientos
- `src/data/enemies.ts`: `EXTRA_BEHAVIORS` (orbitShooter, mine, shielded, healer) aparte de `BEHAVIORS` (los de tipo),
  así el test de "cada tipo tiene un comportamiento" no cambia; `EnemyBehavior` es la unión. Constantes de cada uno,
  `hitFromFront` y `turnToward` (escudado), y `enemyStats` con su vida y velocidad (escudado ×1,1 de vida; mina ×0,6).
- `src/data/bossPatterns.ts`: `biomeExtraBehaviors` (2 por tipo de bioma, todos salen en algún bioma),
  `twistChance` (0 en el piso 1, +9 % por piso hasta 35 %) y `twistBehaviors` (no toca a los que disparan, así sigue la
  regla de uno de cada tres; como mucho 1 curandero y 2 minas por sala).
- `balance.ts`: la simulación también usa los comportamientos nuevos con esa probabilidad; `balance.test.ts` sigue en
  rango (264 tests en verde).
- GameScene: `spawnEnemies` aplica `twistBehaviors`; los 4 casos en `updateEnemy` (el escudado dibuja su escudo y lo
  borra al desaparecer; la mina estalla con `hurtPlayer` y `killEnemy`); `hitEnemy` reduce a un 15 % lo que le llega de
  frente al escudado ("¡Bloqueado!"). El bucle de enemigos comprueba que siga activo tras su IA (la mina se va sola).
- Tests: `tests/bossPatterns.test.ts` (+3) y e2e `tests/e2e/behaviors.spec.ts` (escudo de frente/espalda, curación,
  mina que estalla y tirador que dispara; captura 40).

## T52 — Más sinergias y objetos pasivos
- `src/data/items.ts`: 12 pasivos nuevos basados en objetos de los juegos (Mineral Evolutivo, Cinta Experto, Gafas
  Especiales, Roca del Rey, Polvo Veloz, Baya Lichi, Seguro Debilidad, Bola Luminosa, Cuerda Huida, Hierba Mental, Púa
  Tóxica y Piedra Lunar), varios con ventaja y precio como los de la Tanda 6.
- **Rareza y precio** de todos los pasivos: `PASSIVE_RARITY` (los no listados son raros), `passiveRarity`,
  `PASSIVE_PRICE`/`passivePrice` (11/15/21/28 monedas) y `PASSIVE_WEIGHT` (4/3/2/1). `pickPassive` sortea con esos pesos
  (una tirada de `rng`, así todo sigue siendo determinista) y lo usa `rollItem`. La tienda cobra los pasivos por su
  rareza (`rollShop`); los poderes siguen costando lo de siempre.
- `src/data/synergies.ts`: 6 sinergias nuevas con los objetos nuevos (Especialista, Golpe real, Relámpago, Luz de
  luna, Erizo y Superviviente).
- Arreglo: el activo Caramelo Raro de la T49 tenía el mismo id que el pasivo "Caramelo Raro"; ahora es
  `caramelo-raro-activo` (los guardados con el id viejo en la ranura activa lo pierden: es de hoy y aún no se ha
  publicado).
- Tests: items (+2), synergies (+1) y e2e `actives.spec.ts` (coger los 12 pasivos y activar sinergias sin errores).
  267 tests en verde. Iconos pedidos al supervisor (N25).

## T53 — Parry (bloqueo con contraataque)
- `src/data/parry.ts` (lógica pura): ventana de 200 ms (`PARRY_WINDOW_MS`), recarga de 0,5 s (`PARRY_COOLDOWN_MS`;
  Roberto escribió «0.5 ms», se entiende medio segundo), contraataque de 2 s (`PARRY_COUNTER_MS`) y 350 ms de gracia
  tras bloquear (el contacto se mira cada fotograma y sin ella el mismo enemigo te daría al siguiente). Una pulsación
  bloquea un solo golpe y otro parry durante el contraataque solo renueva el plazo (no apila críticos).
- Relojes: ventana y recarga con `game.loop.time` (como pedía la tarea: no se congela en pausa); el plazo del crítico
  con el reloj de la escena para no perderlo si pausas.
- Controles: acción `parry` en `keybinds.ts` (por defecto **F**: la Q la usaban los tests como tecla libre y F queda
  junto a la E de la bomba). `parseKeys` migra: si la tecla por defecto de una acción no guardada ya está cogida, usa
  una de reserva en vez de devolver todas por defecto (así nadie pierde sus teclas). RT con mando, clic central con
  ratón (o clic en el cuadro "Parry" del HUD, a la derecha de la pausa, que muestra la recarga) y botón táctil.
  Pantalla de Teclas a 2 columnas de 10 y Controles con una fila más (35 px por fila).
- GameScene: `hurtPlayer(enemy, unblockable)` prueba el parry antes de esquiva y escudo; las zonas de peligro, ondas y
  láseres de jefe pasan `unblockable = true`. `hitEnemy` gasta el crítico garantizado. Aviso «¡Parry!» sobre el
  jugador (como «¡Esquivado!»). Efectos pendientes del supervisor: `TODO(supervisor)` en `doParry` y en el acierto.
- Tests: `tests/parry.test.ts` (6) y keybinds (+2). README con la fila del parry.

## T54 — Lluvia de botín
- `src/data/lootMotion.ts` (lógica pura): salto con gravedad y botes que se apagan (`LOOT_BOUNCE`), deslizamiento
  exponencial hacia un destino libre (no depende de los FPS y no se pasa), recorte a los límites de la sala en cada paso
  y atracción hacia el jugador dentro de `magnetRadius` (70 px de base), más rápida cuanto más cerca. Solo atrae lo que
  se puede coger (una baya con la vida llena o una poción con el cupo lleno no se te pega debajo) y nunca en el primer
  salto (siempre se ve).
- Pasivo nuevo **Zahorí** (común, +110 px de radio; stat `lootMagnet`). Icono pendiente: `TODO(supervisor)` en items.ts
  (sale la bola genérica).
- GameScene: `dropLoot` elige el destino con `scatterTarget` + `freeSpot` y lanza desde donde cae; `spawnLoot(…, from?)`
  guarda en el guardado la posición final (si sales en pleno salto, al volver está en su sitio). `stepLootAll` mueve todo
  el botín cada fotograma y pone el balanceo de antes (ya no es un tween, que chocaba con el salto). Los objetos de suelo
  (pasivos, poderes, activos) caen con un rebote si salen en tu sala, pero **no** se atraen: al cogerlos pueden preguntar
  si cambias un poder y no quiero forzar esa elección.
- Destello al recoger: `TODO(supervisor)` en `pickLoot`.
- Tests: `tests/lootMotion.test.ts` (5).

## T55 — Adrenalina
- `src/data/adrenaline.ts` (lógica pura): barra de 0 a 100; baja +8, esquiva +10, parry +20. A los 2,5 s sin sumar
  baja 14/s. Al llenarse: 6 s de ×1,2 velocidad y ×1,3 daño (constantes `ADRENALINE_*`) y luego se vacía; mientras
  dura no se carga otra. Todo en milisegundos restantes (no momentos del reloj) y el paso se recorta a 100 ms, así la
  pausa no la vacía ni gasta el subidón.
- GameScene: barra debajo del cuadro del parry dibujada con `drawBox` de theme.ts; `tickAdrenaline` en el update;
  suma en `killEnemy`, la esquiva y el parry de `hurtPlayer`; el daño entra en `dmgMul()` (se multiplica con Ataque X)
  y la velocidad en el movimiento. Aviso «¡Adrenalina!» en la columna de avisos. Brillo del jugador:
  `TODO(supervisor)` en `addAdrenaline`.
- Duda: las bajas de los ayudantes que invoca un jefe también cargan (son enemigos de verdad y dan ritmo al combate).
- Tests: `tests/adrenaline.test.ts` (5). README actualizado (parry, adrenalina y botín).

## T56 — Salas con reglas especiales
- `src/level/roomRules.ts` (lógica pura) en vez de meterlo en `roomEvents.ts`: una sala puede tener evento **y** no
  quería mezclar sus tiradas (cambiar las de los eventos movería las salas sorpresa de los guardados y del diario).
  `ruleChance` (0 en el piso 1, 8 % en el 2 y +4 % por piso hasta 30 %), `pickRoomRules` (solo salas de combate,
  dos tiradas por sala siempre, en orden de id), y las cuatro reglas:
  - **Un solo tipo**: el tipo es siempre uno de los del jugador (`oneTypeFor`, fijo por sala); el resto, ×0,5.
  - **Plaga**: 25 % de que salga un pequeño (65 % de tamaño, 40 % de vida) al caer un enemigo; el pequeño va marcado
    como ayudante (sin botín y no se vuelve a multiplicar: la cadena siempre acaba).
  - **A oscuras**: radio de 190 px; con efectos bajos el borde es duro (`darkEdge`).
  - **Velocidad**: enemigos ×1,35 y al limpiarla `speedRoomBonus` (baya y monedas si hay tienda; si no, bomba).
- GameScene: reglas con otra semilla del piso (iguales al continuar y en el diario), nunca en la sala del evento, la
  del minijefe ni las salas grandes (se entra por cualquier casilla). Rombo de su color en el minimapa (con las
  `marks` que ya había, sin tocar `minimap.ts`) y aviso en la columna de avisos al entrar. La oscuridad es una textura
  con agujero + 4 rectángulos que siguen al jugador; se quita al limpiar o salir. Solo en Normal e Infinito (como los
  eventos). `TODO(supervisor)` para una oscuridad más bonita.
- Tests: `tests/roomRules.test.ts` (6).

## T57 — «Una más»
- `src/data/secondChance.ts` (lógica pura): coste en tickets 10 + 2 por piso (tope 30) y en caramelos al cambio de
  siempre (`CANDY_PER_TICKET`); `canOfferRevive` (sin usar y con saldo en alguna), `reviveCharge`, `revivedHp` (50 %)
  y `REVIVE_IMMUNE_MS` (2 s). Nunca monedas de la partida.
- `RunSave` v16: `secondChance` (migración desde v15 sin usar); también pasa de piso a piso (`FloorCarry`), así es
  una sola vez por partida aunque continúes o bajes de piso.
- `SecondChanceScene` (registrada antes de `PauseScene`): dos botones de revivir (con coste y saldo) y "Terminar";
  flechas/Enter, ratón y cruceta/A; Esc/B termina. Si eliges una moneda sin saldo, avisa y no se cierra. A los
  invitados se les recuerda que no se guarda: gastan en el almacenamiento en memoria, así que pueden usarla igual.
- GameScene: `playerDown` sustituye a `finish(false)` al caer (golpe o bomba propia); cobra al elegir, vuelve con
  media vida e inmunidad en la misma sala, marca los botones del mando como pulsados y no cuenta como curarse.
  `TODO(supervisor)` para el efecto de revivir.
- Tests: `tests/secondChance.test.ts` (5) y runSave (+1).

## Revisión de calidad de la Tanda 8 (26/10)
Arreglos (un commit cada uno):
- **T62, tiempo por piso**: la escena se reinicia en cada piso y `floorStartSec` vivía en la escena, así que solo se
  apuntaba el último piso; al continuar, además, contaba desde el segundo 0 de la partida. El inicio del piso va ahora
  en `RunCounters.floorStartedAt` (opcional, viaja con el guardado y el cambio de piso): `openFloor`, `closeFloor` y
  `floorTimes` en runHistory.ts, con tests.
- **T63**: los jefes legendarios y los del reto final no llevaban `speciesId` y no contaban en el registro.
- **Fin de partida doble**: `finish` y `checkClear` no miraban si la partida ya había acabado; un enemigo que muere
  después que tú (Casco Dentado con `delayedCall`) podía dar la victoria y apuntar la partida dos veces. Al revivir se
  vuelve a mirar si la sala quedó limpia (solo en salas de pelea).
- **T58**: los tickets del premio de racha no sumaban en los de la partida (resumen e historial).
- **T59**: el equipo del rival se elige al empezar con `pickRivalTeam` (lógica pura con test: especies del piso, sin
  repetir); antes cada miembro era uno al azar al salir.
- Barra del mando en «Una más» y en el registro de combate (que solo admite B).
- Efectos bajos: sin brasas de adrenalina, destello de botín ni fogonazo de cámara al revivir.
- «Una más» espera 700 ms antes de aceptar nada (un clic de disparo o un Espacio podían pagar o rendirse).
Sin cambiar (decisiones del supervisor que tienen sentido): «objetos cogidos» cuenta solo pasivos (como la lista del
resumen); el registro de combate es de la cuenta y no hay lista aparte «de esta partida».

## T64 — Jefes legendarios de todas las generaciones
- `biomeBossPool` ya no filtra por tipo: devuelve los 94 legendarios y singulares. La elección es `pickBossWeighted`
  (biomes.ts): peso ×3 si comparte tipo con el bioma, ×1 si no, sin repetir mientras queden otros. `onlyBundled` se
  sigue aplicando al grupo antes de pesar (sin conexión solo salen los guardados).
- Minijefes: ya no dependen del tipo (es el de más BST de las especies del piso, de las que solo una es del bioma); sin cambios.
- **Propuesta para `src/data/finale.ts` (supervisor, no tocado)**: el reto final llega a Gen 7 (Tapus, Solgaleo, Lunala,
  Necrozma) y Gen 8 (Zacian, Zamazenta, Eternatus) pero **no tiene nada de Gen 9**. Añadir a `GIANTS`: 1007 (Koraidon),
  1008 (Miraidon), 1024 (Terapagos), y de Gen 8 también 898 (Calyrex); y un trío nuevo `Tesoros de la ruina`
  `[1001, 1002, 1003]` (Wo-Chien, Chien-Pao, Ting-Lu) con Chi-Yu (1004) como alternativa.


## T72 — Torre de 100 pisos (primer paso: lógica pura y modo con la ruta básica)
Hecho:
- `src/level/tower.ts` (tests en `tests/tower.test.ts`): `towerFloorKind` (combate, minijefe cada 5, jefe cada 10, descanso
  tras cada jefe en 11, 21…, suministros a veces en los pisos x3/x8, final en el 100), `towerFloorSpec(piso, semilla)`
  (forma pequeña/normal/2x1/1x2/L sin repetir seguida, plantilla sin repetir seguida, jefes y minijefes siempre en sala
  grande, bioma por tramo de 10 con vueltas barajadas, regla de T56 cada 6-7 pisos solo en combate, peligros de pinchos,
  lava o hielo según bioma que nunca cortan el paso ni caen en la zona de aparición), `towerFloor` (el `Floor` de una
  sola sala con las casillas unidas), `towerLevel` (dificultad suave: nivel 13 en el piso 100), puntos de control
  (`towerCheckpoint`, `towerCheckpointCost` con `TOWER_CHECKPOINT_CANDY`). Tests: los 100 pisos jugables con 4 semillas,
  deterministas, sin repeticiones, biomas, reglas, peligros, escalado, récord.
- Modo «Torre» en `modes.ts` (récord propio, botón en el menú de modos porque sale de `MODES`, texto en el resumen vía
  `progressText`), `EVOLVE_AT` para la Torre y `biomeFor('tower')`.
- GameScene: piso de una sala con la plantilla de la Torre, regla del piso en todas sus casillas, minijefe «chetado»
  (×1,8 vida, ×1,35 daño sobre el minijefe normal), jefe legendario de T64 cada 10, columna de luz al limpiar con
  `towerAscend`/`towerArrive` (towerFx), cartel de la regla del piso siguiente, daño de pinchos y lava, descanso con el
  Centro Pokémon como fuente + un objeto, suministros con una cosa, victoria en el piso 100. La semilla de la subida se
  recupera al continuar a partir de `floorSeed` (sin versión nueva de `RunSave`).
Hecho (segunda parte, rama `torre`):
- `src/level/towerExtras.ts` (tests en `tests/towerExtras.test.ts`): `towerAltarItems` (3 distintos, al menos uno raro o
  mejor), `towerShopStock` (2 objetos al 70 % y uno exclusivo legendario, también rebajado, el último), `towerMinibossItem`
  (épico que no lleves), `isTowerFinale`, `iceVelocity` (inercia con `ICE_GRIP`) y `towerCheckpointOptions`.
- Descanso: altar de 3 objetos abajo a la izquierda (coges uno y los otros desaparecen; al continuar se reconocen por su
  sitio; marca `TOWER_ALTAR_DONE` en `eventsDone`) y tienda a la derecha (compra con teclado/mando por `eventSpots`, o
  clic; cada artículo vendido en `eventsDone` como `TOWER_SHOP_DONE + n`). Sustituyen al objeto suelto de antes. La
  tienda sigue aunque se gaste la forja (`towerRestSpots` se repone en `finishEvent`). Sin versión nueva de `RunSave`.
- Hielo resbaladizo: sobre una casilla de hielo la velocidad se acerca poco a poco a la pedida (vale para teclado,
  ratón y mando porque actúa sobre la dirección ya calculada).
- Minijefe de la Torre: encadena un segundo movimiento de su tipo y, al caer, suelta además un objeto épico.
- Piso 100: reto final de `finale.ts` (trío o gigante) en lugar del jefe normal; la victoria sigue en `towerCleared`.
- Sala 2x2 (`square`) entre las formas grandes; `towerFloor` une las 4 casillas (test).
- Punto de control: al elegir Torre en ModeScene, si has vencido algún jefe, `ItemChoiceScene` pregunta desde qué
  descanso empiezas (piso 1 gratis; los demás cuestan caramelos, apagados si no llegan). `GameData.towerStart`.
Hecho (cierre, rama `torre2`; T72 pasa a `[x]`):
- Suministros a elegir: un puesto (rectángulo liso, `// TODO(supervisor)`) abre `ItemChoiceScene` con poción, llave o
  Baya Aranja (teclado, ratón y mando); lo elegido cae delante y se marca `TOWER_SUPPLY_DONE` en `eventsDone`, así que
  al continuar sin haber elegido el puesto sigue ahí. Ya no cae una sola cosa decidida por la semilla.
- Tienda del descanso sin repetidos: `towerShopOffer` (en `towerExtras.ts`) baraja la bolsa con la semilla sin mirar lo
  que llevas (orden fijo) y enseña los dos primeros normales y el primer legendario que no lleves o que ya se vendieran
  aquí; lo vendido va en `eventsDone` como `TOWER_SHOP_SOLD + n.º de candidato` (201000+), así al continuar es la misma
  y no se rellena tras comprar. Si coges del altar algo que vendía, ese artículo cambia por otro (`towerShopDraw`).
  Sin versión nueva de `RunSave`. Las marcas antiguas (`200010 + n`) ya no se leen: un guardado viejo a mitad de un
  descanso ve la tienda entera otra vez, pero nunca con algo que ya lleve.
- Punto de control: `towerCheckpointKit(piso)` da los huecos de los jefes saltados (`bossesBeaten`), 2 objetos por jefe
  hasta `TOWER_KIT_MAX` (8; distintos, sin legendarios, uno raro o mejor de cada tres), 15 monedas por jefe y hasta 3
  pociones. Se aplica en `boot` solo en partida nueva desde un descanso (no al continuar ni al subir).
- Sitios del descanso en `TOWER_REST_LAYOUT` (respecto al centro de la sala) con test de que no se solapan: Centro en
  medio arriba, forja a la izquierda debajo de los bancos, altar de 3 abajo a la izquierda, tienda abajo a la derecha,
  Mega Piedra a la derecha (también en suministros) y la columna de luz del descanso abajo en medio (antes caía encima
  del mostrador). El puesto de suministros va a la izquierda. Guardados viejos a mitad de descanso: los objetos del
  altar estaban en otro sitio y ya no se reconocen como altar (se quedan como objetos sueltos).
- Piso 100: test de que es `final`, reto final (`isTowerFinale`) y última etapa (`isLastStage`); la victoria sale de
  `towerCleared` al limpiar la sala del reto (trío o gigante).
- Tests nuevos en `tests/towerCierre.test.ts`.
Sin probar (solo `tsc` y `npm test`):
- Nada se ha jugado en el navegador: la sala 2x2 (`buildJoin`), el resbalón, la colocación real del descanso (las cajas
  del test son aproximadas al dibujo), el puesto de suministros con mando y la victoria del piso 100.
- Música por bioma: el código pone `trackForBiome(this.biome.id)` con el bioma del tramo (`towerSpec.biome`), pero no se
  ha comprobado a oído.
- `// TODO(supervisor)`: altar, puesto de la tienda, puesto de suministros, peligros y columna (rectángulos lisos).
## Arreglos: desafío diario estable y contadores de sala guardados
- **Desafío diario**: `pickRoomEvent` y `pickEventKind` aceptan una lista opcional de eventos (`kinds`, por defecto
  `ROOM_EVENTS`). El diario pasa `DAILY_EVENTS`, una tabla CONGELADA con los ocho de antes de T68 (runaway, merchant,
  altar, trapChest, rival, fountain, timeTrial, egg), así que slots, thief y fishing no salen en el diario y no alteran
  su azar. **Añadir eventos nuevos a `ROOM_EVENTS` no obliga a tocar `DAILY_EVENTS`**: solo hay que actualizarla (y
  asumir que cambia el reto) si se quiere versionar el desafío a propósito. Si se cambian los pesos de `eventWeights`
  de uno de los ocho, también cambia el diario: el test con la copia literal de los pesos antiguos avisa.
- **Guardado v18**: `RunSave.slotSpins` y `fishCasts` (pares `[sala, cantidad]`) guardan las tiradas de la tragaperras y
  los lanzamientos de pesca; los v17 migran con ambos vacíos. Al continuar en la misma sala ya no se reinician.
## T73 — Forja y huecos de objetos limitados
Hecho:
- `src/data/forge.ts` (tests en `tests/forge.test.ts`), constantes en `items.ts` (`ITEM_SLOTS_BASE` 10,
  `ITEM_SLOTS_PER_BOSS` 1, `ITEM_SLOTS_MAX` 16): huecos por jefes vencidos, las copias ocupan un hueco, `canTakePassive`,
  reciclar (`RECYCLE_SHARE` del precio por copia, quita todas las copias), fusionar (dos distintos de la misma rareza, no
  legendarios; gasta una copia de cada uno; resultado de la rareza siguiente que no tengas si hay otros; coste
  `FUSE_COST`), `forgeWeight` (0 en los pisos 1-2 y sube con la profundidad).
- `RunSave` v19: `bossesBeaten`. Los v18 migran con los jefes vistos menos uno; no se quita ningún objeto aunque
  lleven más que huecos (solo no pueden coger objetos nuevos hasta liberar).
- Evento `forge` en `roomEvents.ts` (etiqueta, color naranja de minimapa, descripción, peso). NO está en `DAILY_EVENTS`
  (tabla congelada), así que el diario no cambia. El test de la laguna deja fuera la forja al probar la última tirada.
- `ItemChoiceScene` (nueva, genérica, como `SlotSwapScene`): lista con teclado (flechas/Enter/1-9/Esc), ratón y mando
  (cruceta/A/B). Se usa para soltar un objeto con los huecos llenos (al coger del suelo: si cancelas se queda en el
  suelo; comprado o de un evento: si cancelas cae a tu lado) y para los pasos de la forja, con confirmación que
  enseña coste y resultado (el de la fusión sale de un azar fijo por piso, sala y pareja).
- GameScene: HUD «Objetos 7/10» encima de los iconos, línea «Huecos 7/10» en la pausa (va en `items`, sin tocar
  PauseScene), aviso «+1 hueco de objeto» al vencer un jefe, forja de un uso en las salas sorpresa y **siempre en el
  descanso de la Torre** (sigue al continuar si no se había usado; se marca en `eventsDone`).
- Al soltar un objeto apilado (x2), caen todas sus copias al suelo una a una.
Pendiente:
- ~~«Mejorar»~~: hecho, ver «T73 — Mejorar y tipo Tera elegible».
- `// TODO(supervisor)`: dibujo del yunque, fragua y chispas; marco de `ItemChoiceScene`.
- Probar en el navegador (solo verificado con `tsc` y `npm test`).

## T73 — Mejorar y tipo Tera elegible (rama logica2)
Hecho:
- `items.ts`: `UPGRADE_STEP` 0,25 y `UPGRADE_MAX` 3; `computeStats(passives, base, levels)` aplica cada objeto con
  `applyUpgraded`: el cambio que hace en cada estadística numérica (y en `typeBoost`/`statusBoost`) se multiplica por
  1 + 0,25 × nivel (Vidasfera +30 % → +52,5 % a +3). Las cuentas enteras (disparos extra, atraviesa, rebotes, disparos
  atrás, escudo, Banda Focus) se redondean hacia abajo, así que esos objetos no se pueden mejorar (`upgradeable`).
- `forge.ts`: `upgradeCost` (mitad del precio de tienda por nivel: común 6/11/17 … legendario 14/28/42),
  `upgradeProblem`, `upgradeCandidates`, `upgrade`, `levelLabel` («Lupa +2»), `pruneLevels`, `isItemLevels`.
- Forja con tres puntos: Reciclar, **Mejorar** y Fusionar (sigue siendo un solo uso por forja). Lista y confirmación con
  coste en `ItemChoiceScene` (teclado, ratón y mando). Nivel «+N» en el icono del HUD y en el nombre (pausa, listas).
  Al reciclar, soltar o fusionar se pierden los niveles de ese objeto (`pruneLevels`).
- `powerForm.ts`: `resolveTeraType` (el elegido a mano manda; null o inválido = el automático de siempre).
  Al coger la primera Teragema se abre la lista «TIPO TERA» (Automático + 18 tipos en dos páginas de 9 y «Más tipos…»);
  con la Teragema sale «Tipo Tera» en la pausa para cambiarlo y la línea «Tipo Tera: …» en los objetos.
- `RunSave` v28: `itemLevels` y `teraPick` (v27 migra a `{}` y null); pasan de piso con `FloorCarry`. Los invitados
  siguen sin guardar (el guardado es el de siempre). Tests: `tests/forgeUpgrade.test.ts` y migración en `runSave.test.ts`.
Pendiente:
- Probar en el navegador (solo `tsc` y `npm test`, 562 tests).

## T89 — Defensa de torres (modo nuevo)
Hecho (ver `docs/TAREAS.md`, T89):
- 16 mapas con 10-15 niveles, 50 % de los niveles para abrir el mapa siguiente, modo infinito, torres de la colección (5 niveles, dos ramas, mega
  nivel 6), voladores por el camino, habilidades activas, premios y guardado en `pokeisaac.towerdef` (+ `pokeisaac.towerdef.team`).
- Ronda de repaso: «Borrar progreso» borra también el equipo de torres (`pokeisaac.towerdef.team`) y el historial del gacha (`pokeisaac.gachaHistory`),
  con test; pausa automática al perder el foco (`src/ui/focusPause.ts`, en `GameScene` y `TowerDefenseScene`); consejos `td_place`, `td_upgrade`,
  `td_air` y `td_skills` (`src/ui/tdTips.ts`); pantalla «Cómo se juega» (`src/data/towerDefense/guide.ts`) en el menú; teclas y mando del modo en
  `ControlsScene`/`controls.ts` (vista «Defensa de torres», con Tab, Y o clic) y «Controles» en la pausa del modo.
- Código huérfano borrado: `ballHudIcon`, `arenaCollapse`, `onInputChange` y `stopMusic`. `.gitignore` con `_wt/`, `_sim/` y `.bench/`.
Pendiente:
- Probar en el navegador: consejos (que no tapen el HUD), pantalla de ayuda, pausa al cambiar de pestaña con mando conectado, Controles desde la pausa del modo.

## Ronda nocturna 27/10 — forja, arenas, escudo y tickets
Hecho (ver `docs/TAREAS.md`, T90):
- Forja «Mejorar» y Tera elegible (T73, arriba). Pausas de 0,5 s en el cambio de arena (fases 1 y 2) sin zoom atrás en el derrumbe. Escudo del
  Escudado como barra extra (`shieldPoolFor`, `absorbShieldHit`). `ROOM_TICKETS` 2 → 3 (+50 % por sala). Arenas y derrumbes por legendario.
Pendiente:
- Probar en el navegador (solo verificado con `tsc` y `npm test`): pausa de arena, barra de escudo, tickets por sala, arenas por legendario.

## Combate: temperamento, megas de punta a punta y adrenalina

- **Temperamento** (`src/data/temperament.ts`): cada enemigo normal sortea ágil (25 %), normal (50 %) o pesado (25 %). Ágil: −20 % de recuperación entre ataques, proyectiles +20 % más rápidos y −15 % de alcance, un poco más pequeño. Pesado: al revés y un poco más grande. Ritmo medio ≈ +1 % (equilibrado).
- **Por qué Mewtwo no megaevolucionaba**: el legendario de la cacería (T88) no es «jefe» para la IA y nunca pasaba por `shouldMegaEvolve`. Ahora megaevoluciona al entrar en su fase 2 (`legendMegaAtPhase`). Además cualquier jefe cuya especie tenga mega en los juegos megaevoluciona (antes solo los de `MEGA_BOSS_IDS`; el resto iba a forma furia), y al megaevolucionar crece un 15 % para que se note. Mewtwo/Charizard sortean X o Y (`bossMegaForm`).
- **Adrenalina**: ahora suma cada golpe dado (1,5, máx. uno cada 150 ms), bajas 12, esquivas 12, parrys 25; empieza a bajar a los 7 s y más despacio (6/s).
- **Modo depuración**: se activa con `?debug` en la URL, con `localStorage.setItem('pokeisaac.debug','1')` o siempre en `npm run dev`. En la consola, dentro de una partida:
  - `__POKEISAAC_DEBUG__.fillAdrenaline()` — llena la adrenalina.
  - `__POKEISAAC_DEBUG__.giveMegaStone()` — da la Mega Piedra.
  - `__POKEISAAC_DEBUG__.forceMega()` — si hay jefe/legendario en la sala, lo deja al 45 % y megaevoluciona; si no, megaevoluciona al jugador (si su especie tiene mega).
  - `__POKEISAAC_DEBUG__.spawnBoss()` — saca el jefe del piso en la sala actual.

## Modo admin (pruebas del desarrollador)

Panel para probarlo todo rápido. **Comodidad de pruebas, no seguridad fuerte**: lo que hace afecta solo al guardado propio
(las reglas de Firestore no cambian; ver la nota en `firestore.rules`).

- **Puertas** (`src/data/admin.ts`): 1) `npm run dev` (`import.meta.env.DEV`), nunca en la build; 2) cuenta en la nube cuyo correo, en minúsculas,
  tenga el SHA-256 de `VITE_ADMIN_EMAIL_SHA256` (`.env.local`; ejemplo vacío en `.env.example`). Sin esa variable nadie es admin. El correo no
  está en claro ni en el repo ni en el bundle: solo su hash. Se comprueba al entrar (`src/net/cloud.ts`).
- **Sacar el hash** del correo con el que te registres (no se crean cuentas ni se guardan contraseñas: la cuenta la creas tú en el juego):
  ```
  node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1].trim().toLowerCase()).digest('hex'))" "tu@correo.com"
  ```
  y pon el resultado en `.env.local`: `VITE_ADMIN_EMAIL_SHA256=<64 caracteres hex>`. Para la web publicada, la misma variable en el entorno de la build.
- **Abrir**: Ajustes → «Panel admin», **F9** en partida, **L3 + R3** a la vez con mando, o clic en la placa «ADMIN» arriba a la derecha del HUD.
  Teclado (↑/↓, ←/→, Mayús ×10, números para escribir), ratón (clic y rueda) y mando (cruceta, A, B, LB/RB ×10).
- **Qué hace** (`src/scenes/AdminScene.ts`, `src/ui/adminPanel.ts`, `src/data/adminUnlock.ts`):
  - Desbloquear todo: Pokédex completa, colección del gacha (y shinies), mejoras al máximo, logros (objetos bloqueados), medallas, huerto lleno,
    999 999 tickets y caramelos. Antes hace una copia (`pokeisaac.adminBackup`); «Restaurar el guardado anterior» la devuelve.
  - Modo dios (vida, daño, cadencia, velocidad y alcance enormes; no recibe daño), adrenalina llena, megaevolución, Dinamax/Gigamax/Tera/Z al momento.
  - Ir al piso N, elegir jefe por número de Pokédex (y generarlo en la sala) y bioma, ir a la sala del jefe, partida nueva en otro modo.
  - Consola (`__POKEISAAC_DEBUG__`, ampliado): `godMode(true)`, `goFloor(n)`, `bossHere(id)`, `panel()`.
- **Partidas admin no cuentan**: al usar cualquier truco la partida se marca (`markCheatRun`) y `save.ts` ignora récords, medallas, misiones,
  tickets, caramelos, desbloqueos, shinies, huerto, registro de combate, diario e historial. El HUD lo enseña («PARTIDA ADMIN»). Se olvida al volver al menú.
  Los invitados siguen sin guardar (memoria).
- Tests: `tests/admin.test.ts`.
Pendiente:
- Probar en el navegador: panel encima de la pausa/Ajustes, F9 y L3+R3, saltar de piso, jefe por número, formas de poder.
- Una partida admin guardada en un hueco y continuada en otra sesión ya no lleva la marca.

## Animación al moverse para todos los Pokémon + interfaz táctil (rama `animar`)
Queja de Roberto: muchos Pokémon «se deslizaban». Datos reales de `tracker.json` de PMDCollab/SpriteCollab (27-10-2026):
- Las hojas shiny existen como `XXXX/0000/0001`; las regionales son subcarpetas de forma (`0019/0001` Rattata de Alola,
  `0052/0002` Meowth de Galar, `0555/0002` Darmanitan de Galar…); Stunfisk de Galar no tiene. 63 especies no tienen hoja
  (514, 516, 520… 1025: lista en `PMD_MISSING`). Megas con hoja: 33 (`MEGA_PMD_FORM`; Mewtwo X no, la de SpriteCollab es la Y). Gigamax: ninguna.
- `src/data/pmdForms.ts` (nuevo, puro): ids de hoja codificados (`shiny·1e8 + forma·1e5 + especie`), carpeta de cada uno, tablas de
  regionales/megas/sin hoja, `shinyHue` y `hueRotatePixels` (matriz de hue-rotate, sirve en Safari).
- `src/ui/pmdSprites.ts`: ya no descarta las regionales; si un shiny no tiene hoja propia, carga la normal y la recolorea por código.
- `GameScene`: el jugador shiny, los enemigos shiny y las megas usan su hoja animada (`playerPmdId`, `foePmdId`, `pmdMega` en
  `applyMegaLook`). `applyPmd` pide la hoja que falte (`pmdLater`) y se la pone al sprite en cuanto llega (antes, si no estaba
  precargada, se quedaba el dibujo fijo para siempre).
- `src/data/locomotion.ts`: ahora por especie además del tipo (listas de voladores sin tipo volador, aves que corren, flotantes,
  nadadores, serpientes, botadores y rodantes) y `locoPose`: andar = pasos con aplastar/estirar y balanceo alterno; volar = aleteo
  con subida/bajada y sombra que se encoge; nadar/reptar = ondulación lateral; botar; rodar; flotar = deriva. `sheetHover`: los que
  tienen hoja y vuelan o flotan (Charizard, Mewtwo…) van por el aire con la sombra más pequeña, aunque su hoja apenas se mueva.
- `src/ui/locoAnim.ts` (nuevo): pone la pose sin mover el cuerpo físico (origen + desfase del cuerpo); el aplastar/estirar solo en
  sprites sin cuerpo (en los que tienen, cambiar la escala cambiaría su caja de choque). Lo usan `dressSprites` (jugador, enemigos,
  ayudantes, jefes, reto final), el aliado del huevo (`updateAlly`) y los enemigos de tierra sin hoja del Tower Defense.
- Tests: `tests/pmdForms.test.ts`, `tests/locomotion.test.ts` (ampliado).

Interfaz táctil (docs/TAREAS.md, «Interfaz móvil: pendiente»):
- Las ranuras de poderes y el cuadro del objeto activo se esconden en táctil (los tapaban joystick y botones) y sus zonas de clic se
  desactivan; los botones 1-4 toman el color del tipo del poder y se apagan mientras recargan; «Activo» se ilumina cuando está cargado
  (`TouchControls.setPower` / `setActiveReady`).
- Consejos: en táctil, texto sin teclas ni mando (`TOUCH_TIPS`, `tipText`) y botones «Vale» / «No más consejos» sin «T · RT» ni «N · LT».
- La tira de consejos se esconde mientras la partida está en pausa (la barra de ayuda de la pausa iba en la misma franja).
- `index.html`: `#game` con márgenes fijos de zona segura (con padding, Phaser medía la caja entera y el lienzo podía meterse bajo
  el notch) y aviso «Gira el móvil» también en tabletas en vertical (hasta 1100 px).

Pendiente / sin verificar:
- No se ha podido ver en el navegador: el `npm run build` del worktree falla en la VM Linux (el `node_modules` enlazado no tiene el
  binario de rollup para Linux) y no se puede arrancar otro servidor de desarrollo. tsc y tests pasan. Probar: shiny andando
  (jugador y enemigo), Rattata de Alola, mega de Charizard X, Ekans/Magikarp/Voltorb sin hoja, interfaz táctil en un móvil real.
- El tono del shiny recoloreado es aproximado (giro fijo por especie): solo se usa si SpriteCollab no trae la hoja shiny.
## Jefes 2 — teletransportes, intros congeladas, fases, trampilla, spawns y 8 asaltos nuevos (28/10)
Hecho (rama `jefes2`):
- **Teletransporte a la cara** (`src/data/bossSafety.ts`, tests en `tests/bossSafety.test.ts`): el jefe, el trío, el minijefe y el
  legendario de la cacería tienen un **respiro** (`BOSS_TELEPORT_GRACE_MS` = 4,5 s) tras aparecer, tras cada intro y tras cada fase (fase 2,
  megaevolución, fin de la pausa/derrumbe de la arena, fases del reto final): en ese tiempo no saltan, no se esconden ni embisten
  (`ai.graceUntil`; `bossGrace`). Un salto (`hop`) de un grande nunca lo deja a menos de `BOSS_SAFE_TELEPORT_DIST` (240 px): `hopSpot` usa
  `pickSafeSpot` y, si no hay sitio así, se queda donde estaba. Bajo tierra (`burrow`) un grande se para a esa distancia. El jefe sale en un
  sitio libre y a ≥ 220 px del jugador. La causa del fallo: al reanudar tras la intro, los temporizadores de la IA (reloj del juego) ya
  habían vencido y el jefe saltaba al instante junto al jugador.
- **Intros congeladas de verdad**: `freezeWorld`/`thawWorld`. Durante la cinemática del jefe (antes solo pausaba la física y la IA, los
  ataques, los saltos con `setPosition` y tus disparos seguían) y la ficha BossIntro (minijefe, cacería, reto final): física en pausa,
  velocidad 0, sin disparos en el aire, sin IA, sin daño a nadie (`hurtPlayer`/`hitEnemy`) y sin asaltos. Al acabar, `shiftTimers` corre
  los temporizadores lo que duró la intro (sin saltos al reanudar). Seguro: si algo se queda congelado más de 20 s sin intro abierta, se
  descongela. La escena reutilizada limpia ese estado al empezar.
- **Fases que no dejaban bajar la vida**: la pausa de la fase 1 de arena solo se soltaba si `arenaDone === 1`; ahora se suelta siempre
  (`releaseArenaHold`) y hay un **watchdog**: si la protección del derrumbe dura más de lo previsto + `PHASE_INVULN_MAX_MS` (6 s), se quita.
  La pausa de fase del reto final tiene tope igual. La cinemática ya no «devuelve» vida a destiempo (se congela el daño). Revisado el
  mínimo de vida del gigante (`clampFinaleHp`): no se atasca (test que lo recorre).
- **Trampilla**: va al centro de la arena del jefe solo si está libre (paredes de la unión de las salas 2x2/3x3, rocas, muros de la arena
  nueva tras el derrumbe) y es alcanzable (campo de flujo desde el jugador); si no, a la casilla libre más cercana (`nearestClearPoint`).
  El objeto del jefe también cae en un sitio libre (`dropItem`).
- **Spawns dentro de obstáculos**: `spotClear` (casilla libre en el centro y alrededor + sin tocar ninguna pared/bloque con colisión) en
  `randomSpotInRoom` (ya no devuelve un sitio cualquiera al agotar intentos), `spawnEnemy` (salas, oleadas, ayudantes, invocaciones,
  minijefes, eventos) y el trío del reto final. Seguro cada 0,5 s (`unstickTick`): quien quede dentro de un obstáculo sale a la casilla libre
  más cercana.
- **8 asaltos nuevos** (`src/data/bossBlitz.ts`, tests en `tests/bossBlitz.test.ts`; arte pixel en `src/ui/art/blitzFx.ts`; GameScene
  `bossBlitz`): Lluvia de meteoros (tandas sobre zonas marcadas), Doble hélice (dos espirales en sentidos contrarios), Muro implacable (muro
  que cruza la sala con un hueco), Minas en cruz, Rejilla de rayos (filas/columnas de pared a pared, nunca dos franjas seguidas), Orbes
  rebotantes, Niebla persistente y Embestida marcada (de pared a pared por una línea avisada). Dos por tipo (`blitzAttacksFor`) más el
  primero del segundo tipo; los usan el jefe y el reto final. Aviso ≥ 0,9 s, nada sale de la arena (`clipBeamToBounds`, `clampDash`,
  rebotes dentro), versión simple con `lowFx()`, y se cortan en intros/derrumbes (`stopBlitz`). No se ha tocado el vórtice ni el rayo.
Pendiente:
- Probar en el navegador (solo `tsc` y `npm test`): los 8 asaltos (legibilidad y dificultad), la cinemática congelada, el respiro del jefe,
  la trampilla en arenas 2x2/3x3 tras el derrumbe y el seguro de spawns.
## Formas de poder, Pokémon oscuros y guardián de la Mega Piedra (rama `formas`, 28/10)

- **Dinamax**: el aspecto aprobado. Sprite de siempre (animado de SpriteCollab si lo hay; antes era el estático de
  PokeAPI ampliado), ×1,65 (`POWER_FORMS.dynamax.sizeMul`), aura roja suave sin la silueta de luz dura, aro rojo y
  nubes que suben y coronan la cabeza (`playerFormAura` 'max', `dynamaxBurst` al empezar). El Gigamax no se toca.
- **Teracristal y Movimiento Z**: antes pedían la Teragema / el Cristal Z (legendarios, casi nunca salían) y el botón
  único elegía siempre otra forma, así que no se veían. Ahora los tiene todo el mundo con el medidor de poder; la
  Teragema abarata el Tera (40 % en vez de 60 %) y deja elegir el tipo; el Cristal Z deja repetir el Z en cada piso
  (sin él, una vez por partida). Arte: corona de cinco gemas del tipo Tera sobre la cabeza, facetas que orbitan, aro
  facetado y destellos de gema (`drawTeraAura` en megaFx.ts) y cartel «Tipo X» al cambiar (los disparos ya salían de
  ese tipo y color). El Z: pose (el jugador se para, invulnerable), estrella Z del tipo a los pies (`zStarFx`), el
  anillo de 16 disparos de antes y, al acabar la pose, columna de luz y onda que golpea a todo enemigo a 420 px
  (`zImpactFx` + `hitEnemy`).
- **Selector de forma** (`powerOptions` / `cyclePowerSel` / `validPowerSel` en powerForm.ts): acción nueva `powerNext`
  (X por defecto, al final de ACTIONS para no romper teclas guardadas), cruceta izquierda/derecha (botones 14/15,
  libres en partida), clic derecho o rueda sobre el icono del HUD, y en táctil mantener el icono medio segundo. El
  botón de forma (M / cruceta arriba / clic) usa la elegida; sin elegir, la automática de antes. El icono del HUD
  dibuja la Mega Piedra o el objeto de la forma elegida (Banda Dinamax, Teragema, Cristal Z) con su aro de estado
  (`drawPowerSelHud`). Controles (fila «Elegir forma de poder»; filas a 25 px), Teclas (12 por columna) y consejo
  nuevo `forms` de la tira de consejos con glifos pixel (GlyphText, según el dispositivo).
- **Pokémon oscuros** (`src/data/darkMon.ts`): enemigos +40 % vida, +30 % daño, +25 % velocidad y +30 % cadencia
  (tempo.cooldownMul); el inicial oscuro +25 % vida, daño y cadencia y +12 % velocidad. Probabilidad por piso: normales
  0,4 % +0,3 %/piso (tope 4 %), minijefes 4 % (+1 %, tope 15 %), jefes 3 % (+1,2 %, tope 18 %), legendario de la
  cacería 5 % (+1,2 %, tope 20 %); gacha 1/100. Nunca en el desafío diario ni en enemigos de evento ni ayudantes.
  Aura morada y negra con humo y chispas (`src/ui/art/darkFx.ts`), tinte morado (paintEnemy), «¡Oscuro!» al salir,
  nombre «X Oscuro», intro con franja morada, humo y «¡POKÉMON OSCURO!» (BossIntroScene `dark`), +3 monedas de 5 y
  tickets ×1,5 en jefes y minijefes. Capturar uno normal (o el legendario de la cacería oscuro) lo guarda oscuro
  (`addDark`, `pokeisaac.darks`, en PROGRESS_KEYS); la Pokédex lo marca (llama pixel y «· Oscuro»), Elegir Pokémon pone
  «Oscuro ·» y, como el shiny, juegas con él oscuro. **RunSave v29**: `dark` (los v28 migran con `false`).
- **Megaevolución**: solo hace falta la Mega Piedra (ya no gasta la adrenalina). La piedra ya no está suelta: la sala
  de `planMegaStoneRoom` es la **guarida del guardián**, un pseudolegendario o ultraente (`src/data/guardians.ts`,
  `pickGuardian`) con ×1,6 de vida y ×1,2 de daño sobre un minijefe, aura del color de la piedra e intro «GUARDIÁN»;
  al caer suelta la Mega Piedra en el suelo (o un objeto si ya la llevas) y +6 tickets. Si no se pudiera sacar, queda
  el altar de antes. Los **minijefes** también son pseudolegendarios/ultraentes (fijos por piso con su semilla; sus
  sprites se cargan con el piso; sin conexión, solo los guardados; si fallan, el más fuerte del bioma). La Torre sigue
  con su altar de descanso (no tiene salas de combate normales).
- **Panel admin**: «Megaevolucionar» (siempre el jugador: da la piedra si falta y avisa si la especie no tiene mega;
  antes, con un jefe en la sala, megaevolucionaba al jefe), «Dar la Mega Piedra», «Megaevolucionar al jefe de la
  sala», «Llenar el medidor de poder», «Jugar con el inicial oscuro» y el selector de forma (Dinamax, Gigamax,
  Teracristal, Movimiento Z) que además la deja elegida en el HUD.
- Tests: `tests/darkMon.test.ts`, `tests/guardians.test.ts`, `tests/powerSel.test.ts`, más casos en runSave,
  keybinds, powerForm, powerFormT75, megaAll y roomEvents.
- Sin probar en navegador: el aspecto final del Dinamax, la corona Tera, la pose Z, el aura oscura y la intro del
  guardián (no hay navegador en la sesión; `npm run build` no corre en la VM de Linux por el binario de rollup).

## Defensa de torres más viva: jefes cada 5, eventos, mejoras entre oleadas y habilidades de zona (rama `td`, 30/10)
Hecho (lógica pura en `src/data/towerDefense/` con tests en `tests/tdChiefs.test.ts`; escena `TowerDefenseScene`):
- **Jefes de oleada** (`chiefs.ts`, `waves.ts` `isChiefWave`, papel `chief`): cada 5 oleadas (salvo cuando toca el legendario), un
  Pokémon fuerte del bioma (2 por bioma, alternos) con 13× la vida de un salvaje y 2 habilidades fijas por mapa/nivel/oleada: una que
  castiga (Onda paralizante: aturde 4 s las torres del grupo más denso a ≤ 4,5 casillas; o Llamada: 3 esbirros) y otra de aguante
  (Recuperación +12 %, que se **corta** si le quitas un 6 % durante el aviso; Agilidad ×2 3 s; Coraza: escudo del 20 % al 66 % y 33 %).
  Siempre con **aviso** (1-1,8 s, zona marcada con `drawWarnZone` + toast + nombre sobre el jefe); la Congelación también lo retrasa.
  El primer jefe de cada partida siempre aturde. Ficha corta de presentación que entra por la derecha y **barra grande** arriba a la
  derecha del mapa (también para el legendario). Premio: dinero en la partida (`chiefMoney`) y **+3 tickets por jefe** (máx. 15) al acabar
  (`rewardsFor`/`chiefTicketsFor`, solo tickets) y mejora **épica** después.
- **Eventos de oleada** (`events.ts`): niebla (alcance −30 %), tormenta (rayos avisados 1,3 s en casillas del camino o de torres:
  dañan enemigos y aturden torres 2,5 s), camino desviado (todos por una entrada; solo mapas con 2+ caminos), oleada doble (×2 enemigos
  al 60 % de vida y +50 % de premio), enemigos veloces (+35 % de velocidad, +25 % de dinero) y lluvia de monedas (+60 % por baja). 38 % de
  las oleadas desde la 2, nunca con jefe; los fija `hashStr(mapa|nivel|oleada)` (no la semilla de la partida). Aviso arriba a la derecha
  del mapa durante la preparación («Próxima oleada: …») y, en la oleada, nombre, segundos que quedan y barra (o «toda la oleada»).
- **Mejoras entre oleadas** (`perks.ts`): tras cada oleada, 1 de 3 (la partida se para mientras eliges; en el motor la cuenta atrás espera
  hasta 25 s y, si llega la oleada, se queda la primera). Reliquias: Catalejo (alcance), Cinta rápida (cadencia), Emblema de un tipo del
  equipo (daño), Escarcha (cada golpe frena), Amuleto moneda (botín), Garra afilada (crítico), Hucha (interés con tope), Reloj de arena
  (enfriamientos), Muralla (vida de la base). De torre: Entrenamiento (nivel gratis a las más flojas), y tras un jefe Piedra evolutiva (+2
  niveles a la mejor) y Fusión (2 torres del mismo Pokémon → una con +2/+3 niveles). Tras un jefe todas épicas (el doble). Fichas con icono
  pixel; 1/2/3, flechas o cruceta y aceptar, o clic.
- **Habilidades** (`abilities.ts`): Tormenta (Z/LT, zona de 2,4), Congelación (X/RT, global), Bomba (C/Y, zona de 1,5) y Refuerzo
  (V/L3: +50 % daño y +30 % cadencia 10 s a las torres de la zona y les quita el aturdimiento). Las de zona se apuntan con el cursor
  (teclado, mando o ratón) y se lanzan con aceptar/clic o pulsando otra vez; cancelar la suelta. `abilityError` explica por qué no.
  «Curar base» deja de ser habilidad: ahora es la mejora Muralla.
- Teclas en `controls.ts` (`TD_KEYS`/`TD_PAD`), ayuda nueva para apuntar y para elegir mejora, y fila «Elegir mejora» en Controles.
  Iconos pixel nuevos en `tdArt.ts` (bomba, refuerzo, mejoras, eventos, corona de jefe) y `drawWarnZone`, `drawStun`, `drawBoost`,
  `drawFog`, `drawBossBar` (versión simple con `lowFx()`). El bot (`autoplay.ts`) elige mejoras y usa las 4 habilidades; los tests de
  equilibrio siguen pasando (simulación: dificultad parecida, el infinito del primer mapa llega algo más lejos, 37 → 45).
- No hacían falta papeles nuevos de enemigo: ya había voladores, curanderos, escudados y aceleradores; quien «dispara a torres» es el jefe.
Pendiente:
- Probar en el navegador (solo verificado con `tsc` y `npm test`): ficha del jefe y barra, zonas de aviso, niebla, rayos de la tormenta,
  panel de mejoras con los tres dispositivos, apuntar habilidades con ratón/mando/teclado y que la barra de abajo (4 habilidades) quepa.

## Modo móvil: letra mínima y filas de menú más fáciles de tocar (rama `movil`)
- Nuevo `src/ui/uiScale.ts` (sin Phaser, probado en `tests/uiScale.test.ts`): `cssPerGamePx` (px CSS por px del lienzo con
  Scale.FIT, suponiendo horizontal), `textBoost`/`boostedSize` (agranda la letra hasta 12 px CSS reales, tope ×1,5), `parseFontPx`,
  `rowHitHeight` y el interruptor `setMobileUi`/`mobileUi`.
- `main.ts` activa el modo con `touchOnlyDevice()` y, en el gancho que ya creaba todos los textos, sube el `fontSize` de los pequeños.
  Así afecta a todas las pantallas (Título, Menú, Modo, Ajustes, Pausa, iniciales, Gacha, Cuenta, Pokédex, Resumen) y al HUD sin
  tocar cada escena. En escritorio el factor es 1 y nada cambia (ni escala ni composición: se mantiene Scale.FIT 1920×1080).
- `MenuList` (nav.ts): en móvil la zona de toque de cada fila cubre también el hueco con la siguiente (54+14 → ~41 px CSS en un
  móvil de 390 px de alto).
- Límites: con el tope ×1,5 los menús llegan a ~12 px CSS, pero el HUD (sin zoom de diseño) se queda en ~7-8 px CSS; textos que
  cambian de tamaño después (`setFontSize`/`setStyle`) no se agrandan. No se pasó a Scale.RESIZE (demasiado riesgo).
- Pendiente: Playwright no arrancó en la VM (sin navegador); falta mirar en un móvil real que nada se salga de su cuadro.

## Combate: parry perdonador, esquiva (dash) y combo de golpes arreglado (rama `combate`)
**Parry rehecho** (`src/data/parry.ts`, arte en `src/ui/art/parryFx.ts`):
- Ventana amplia `PARRY_WINDOW_MS = 400` (antes 200); perfecto en los primeros `PARRY_PERFECT_MS = 200`. Fallar solo
  cuesta `PARRY_MISS_COOLDOWN_MS = 300` tras cerrarse la ventana; acertar deja volver a pulsar a los 120 ms (ráfagas).
  `tryParry` devuelve `'perfect' | 'normal' | null` (antes boolean). Mismos relojes que antes (bucle para ventana y
  enfriamiento, escena para el crítico del contraataque). Compatible con adrenalina, medidor y guardado (sin cambios).
- Aviso: `timeToImpact` + `threatLevel` (puros) y `paintThreats` en GameScene dibujan un rombo pixel «!» sobre cada
  proyectil o enemigo que te va a dar en menos de 0,7 s; se vuelve blanco y late dentro de la ventana («¡ahora!»).
- Con la ventana abierta, escudo hexagonal pixel del color del tipo del jugador que le sigue; el cuadro del HUD se
  pone blanco. Al acertar (`onParry`): destello, anillo y partículas pixel (`parryBurst`; perfecto: anillo doble,
  más chispas y más grandes, leve temblor), «¡Parry!» / «¡Parry perfecto!» sobre el jugador. Devuelve algo: el
  proyectil sale reflejado como disparo tuyo hacia el enemigo más cercano (`parryReflectDamage`: ×1,6 / ×2,5 y nunca
  menos que tu disparo; el perfecto atraviesa uno) y quien pega cuerpo a cuerpo queda aturdido (`parryStun`: 0,9 s /
  1,4 s; jefes 0,35 s) y empujado. Sigue dando adrenalina, medidor y el crítico siguiente. Contadores: parrys
  perfectos (`notePerfectParry`). Los ataques de jefe imparables siguen sin bloquearse.
**Esquiva** (`src/data/dash.ts`): acción nueva `dash` (al final de `ACTIONS`, por defecto **Mayús**: Espacio es el
  objeto activo; reasignable en Teclas, con migración de guardados igual que las demás). Mando: cruceta abajo (botón 13,
  libre en partida). Ratón: doble clic derecho (≤ 300 ms, hacia el cursor; el clic central ya es el parry) o clic en su
  cuadro. Táctil: botón «Esquiva» junto al parry. Impulso de 170 px en 170 ms en la dirección de movimiento (o de la
  mirada), invulnerable 250 ms, recarga 1,2 s, no gasta adrenalina. Usa la velocidad del cuerpo + `playerKnockUntil`
  (como el dash de los ataques): paredes, puertas cerradas y agujeros los paran las colisiones y el borde `keepInside`
  (`dashEnd` usa `clampDash` de bounds.ts y está probado). Estela de imágenes del jugador teñidas y polvo pixel
  (`dashTrail`, `dashPuff`). Cuadro «Esquiva» encima de las ranuras de poderes con glifo pixel (tecla o cruceta abajo,
  nuevo glifo `pad:dpad-down` y regla «Cruceta abajo» en glyphTokens) y barra de recarga. Añadida a Controles
  (fila nueva en las 4 pestañas; filas a 24 px), Teclas (24 acciones = 2 columnas de 12 justas), `controlsFor`
  (ayuda), consejo nuevo `defend` (parry + esquiva, con versión táctil) y README.
**Combo: causas encontradas** (antes `combo.ts` contaba *bajas*, no golpes):
1. Solo sumaban las bajas y no las de los ayudantes de jefe ni las de la plaga (`helper`): golpear sin rematar no
   contaba nada, y el clima que remata tampoco.
2. El plazo era `expiresAt = time.now + ventana`, y `time.now` de Phaser es el reloj del bucle: **sigue corriendo en
   pausa**, en las intros de jefe (`frozenSince`), en la elección de objeto y en las transiciones. Al volver, roto.
3. La ventana se acortaba con el combo (de 3 s hasta 1,6 s): en combos largos se cortaba enseguida.
4. Cualquier daño recibido lo ponía a cero.
5. `combo` era un campo inicializado una vez y nunca se reiniciaba en `init`: pasaba de una partida a otra.
**Arreglo**: ahora cuenta golpes. `countDamage` (por donde pasa todo el daño del jugador: disparos, poderes de área,
  rayos que atraviesan, ayudante, quemadura/veneno, reacciones, espinas, bombas, reflejos del parry, jefes) llama a
  `comboStrike`; los golpes que se come el escudo del Escudado también cuentan (`blocked`); varios en el mismo
  fotograma son varios. El tiempo es lo que queda en ms (`left`) y solo baja con `tickCombo` desde `update()` (que no
  corre en pausa), con paso recortado a 100 ms, y no se llama con `transitioning`, `frozenSince` ni al acabar. Ventana
  fija perdonadora de 2,5 s que se rellena entera con cada golpe; sin enemigos en la sala baja al 35 % (cruzar a la
  siguiente no lo corta). Recibir daño le quita la mitad del tiempo (`comboHurt`) en vez de romperlo. Se reinicia en
  cada piso/partida; el máximo de la partida va en `RunCounters.bestCombo` (sobrevive a los pisos y al continuar).
- Niveles (`COMBO_LEVELS`): x5 Racha, x15 Frenesí, x30 Imparable, x60 Leyenda con daño (×1,05→×1,25, entra en
  `dmgMul`), velocidad (hasta ×1,12), probabilidad de tirada de botín extra (hasta 20 %) y medidor de poder (hasta
  ×1,5), más unos PS al alcanzarlos. Al subir: sonido, destello de cámara (no con efectos bajos), chispas pixel en el
  contador y aviso sobre el jugador. Sustituye a los hitos antiguos (`milestoneReward`, monedas por hito: quitados).
- HUD (`comboHud.ts`, esquina de arriba a la izquierda de la sala): número que late, nombre del nivel, barra pixel
  segmentada del tiempo (parpadea al quedar < 30 %), cuatro rombos de nivel y la bonificación en letra pequeña. La
  cadena shiny baja un poco para no pisarlo.
- Resumen: «Combo máximo x34 · Imparable» (color del nivel) con estrella si es récord de todas las partidas, y parrys
  con los perfectos. Récord global en `save.ts` (`COMBO_BEST_KEY`, `loadComboBest`/`submitComboBest`, en
  `PROGRESS_KEYS`; las partidas con código o trucos no cuentan). `RunRecord` gana `bestCombo`, `comboLevel`,
  `comboRecord`, `perfectParries` y `dashes`, todos opcionales: el historial antiguo se sigue leyendo (sin migración).
- Tests nuevos/rehechos: `parry.test.ts` (8), `dash.test.ts` (4), `combo.test.ts` (7), `comboRecord.test.ts` (4),
  keybinds (+1). 714 en total.
Pendiente / no verificado:
- Solo `tsc` y `npm test`; `npm run build` no arranca en la VM (falta `@rollup/rollup-linux-x64-gnu`, node_modules de
  Windows). Falta probar en el navegador: marcas de aviso, escudo y estallido del parry, reflejo, estela de la esquiva
  (que no atraviese paredes ni puertas a 1000 px/s), cuadro «Esquiva» encima de las ranuras (y que los avisos de la
  derecha no lo tapen), botones táctiles, doble clic derecho y el contador del combo con su barra.
- El daño del clima (arena/granizo) a los enemigos no es tuyo y no suma al combo.

## Sinergias que transforman, transformaciones y Libro de sinergias (rama `sinergias`, 30/10)
Objetivo: combinaciones de objetos al estilo The Binding of Isaac que cambian cómo juegas, con descubrimiento.
- **Datos** (`src/data/synergies.ts`): `Synergy` gana `fx` (efectos especiales) y `transform` (color del aspecto).
  `SYNERGIES` = las 17 de antes (`BASIC_SYNERGIES`, sin cambios) + `COMBO_SYNERGIES` (14) + `TRANSFORMATIONS` (3).
  Sinergias nuevas (receta → efecto):
  - Rebote Eterno: Pelota Saltarina + Bola Luminosa → el disparo rebota hacia otro enemigo al impactar (2 veces).
  - Pirotecnia: Piedra Dura + Bola Férrea → estallido (r 60, 45 % del daño) en cada enemigo golpeado.
  - Danza Lunar: Piedra Lunar + Polvo Brillo → 2 lunas orbitales (9 de daño por toque, paran disparos enemigos).
  - Rueda Fuego: Carbón + Pluma Ligera → rastro de llamas al moverte que quema.
  - Pista Helada: Hielo Eterno + Polvo Veloz → rastro de hielo que congela (cada enemigo, como mucho cada 1,4 s).
  - Rayo en Cadena: Imán + Lupa Doble → 30 % de que un rayo salte a 3 enemigos (60 % del daño).
  - Gigadrenado: Semilla Milagro + poder de Planta → cada baja cura 3 PS.
  - Eco Psíquico: Cuchara Torcida + Reloj de Arena → cada disparo se repite 170 ms después (50 %).
  - Aura Esfera: Cinturón Negro + Piedra Escudo → aura (r 95) que hace 14 de daño por segundo.
  - Capa Mágica: Gafas Protectoras + Hechizo → 30 % de devolver los disparos enemigos que te tocan.
  - Día de Pago: Moneda Amuleto + Zahorí → 25 % de botín extra por baja.
  - Bala Semilla: Púa Tóxica + Doble Equipo → el disparo se parte en 3 semillas (40 %) al romperse.
  - Furia Dragón: Colmillo Dragón + poder de Dragón → anillo de 8 llamas dragón (70 %) cada 3 s con enemigos.
  - Represalia: Banda Focus + Chaleco Asalto → al recibir daño, onda (r 170, 40 de daño escalado con tu daño).
  Transformaciones (3 piezas, aspecto propio con corona pixel y silueta animada):
  - Fuego Sagrado: Carbón + Concha Campana + Orbe Vital → aura de fuego (22/s), rastro de fuego, +2 PS por baja,
    +15 % de daño y quemaduras ×1,5.
  - Tormenta Eterna: Imán + Telescopio + Doble Equipo → rayo en cadena en cada golpe (3 saltos, 50 %), 3 chispas
    orbitales, −10 % de tiempo entre disparos y parálisis ×1,5.
  - Velo Espectral: Hechizo + Polvo Brillo + Cuerda Huida → 45 % de reflejo, 4 almas orbitales, +12 % de esquiva
    (tope 60 %) y +8 % de velocidad.
- **Lógica pura** (`src/data/synergyFx.ts`): `synergyFxFor` suma los efectos con topes (`FX_CAPS`: 6 orbitales,
  probabilidades ≤ 90 %, curación por baja ≤ 6, botín extra ≤ 50 %…); recetas legibles, `synergiesCompletedBy` /
  `synergiesBrokenBy` / `nearSynergies` para las pistas, `newDiscoveries`, `bookEntries` y el guardado
  (`{ v: 1, ids }`, migra una lista suelta y quita ids que ya no existen). En `save.ts`: `SYNERGIES_KEY`
  (`pokeisaac.synergies`, en `PROGRESS_KEYS`), `loadSynergiesFound` y `addSynergiesFound` (las partidas admin no
  guardan). No toca `RunSave`: el libro es progreso de la cuenta, no de la partida.
- **En la partida** (`src/scenes/synergyRuntime.ts`): orbitales, rastros, aura, nova y aspecto de transformación, y
  `chainFrom` para el rayo. En GameScene: los disparos normales llevan `basic` (los efectos de golpe solo van con
  ellos, no con poderes ni ecos); `onHit` → Pirotecnia/Rayo, rebote en vez de romperse, partir en semillas;
  `killEnemy` → botín extra y curación; disparos enemigos → reflejo; `hurtPlayer` → Represalia. Los daños en área
  de las sinergias van sin estado (el tipo Normal aturdía en cada golpe).
- **Arte** (`src/ui/art/synergyArt.ts`): texturas pixel propias (orbital del color, llama, cristal, insignia de
  sinergia, libro), aura que gira, aspecto de las transformaciones y destello al descubrir. Con `lowFx()`: aura y
  aspecto estáticos, sin anillos ni rayos pixel (línea simple), rastro a la mitad.
- **Descubrimiento**: al activarse una sinergia aparece el aviso en la columna de avisos (nunca centrado):
  «¡Sinergia descubierta!» / «¡Transformación descubierta!» la primera vez, con insignia que sube sobre el jugador y
  anillos (destello de cámara solo en transformaciones). Se apunta en el libro al momento.
- **Libro de sinergias** (`src/scenes/SynergyBookScene.ts`, registrada en `main.ts`): lista paginada (9 por página),
  ficha con receta y efecto; las no descubiertas salen como «???» con «Receta de N piezas». Desde la pausa (opción
  «Sinergias», encima de la pausa, con las activas marcadas y las que están a una pieza) y desde la Pokédex (botón
  arriba a la derecha, G o L3). Teclado (flechas, ←/→ página, Esc), ratón (filas, ◀ ▶, «Volver») y mando.
- **Pistas**: los objetos del suelo que completarían una sinergia muestran «Sinergia: …» (o «???» si no la has
  descubierto) con la insignia pixel latiendo; la pausa dice la primera sinergia a la que le falta una pieza; en
  «Huecos llenos» (ItemChoiceScene, nuevo `hints`) cada objeto que rompería una sinergia activa lleva «Rompe: …» y la
  insignia, y el texto dice qué completaría el objeto nuevo.
- **Panel admin**: sección «Sinergias»: elegir una (◀ ▶) y Enter da sus piezas (sin mirar huecos; si pide un poder,
  pone uno de ese tipo de tu lista de poderes si lo hay), y «Quitar todos los objetos pasivos».
- Tests: `tests/synergyFx.test.ts` (8). 722 en total.
Pendiente / no verificado:
- Solo `tsc` y `npm test`; `npm run build` no arranca en la VM (falta `@rollup/rollup-linux-x64-gnu`). Sin probar en
  el navegador: posición de las órbitas y el aspecto sobre sprites grandes (Dinamax), legibilidad de «Sinergia: …»
  sobre los objetos, la insignia en la pausa y las 7-8 opciones del menú de pausa, y el equilibrio real.
- Las sinergias de la partida admin no se guardan en el libro (como el resto del progreso con trucos).
- `pokeisaac.synergies` usa el prefijo `SAVE_PREFIX` de `storage.ts`, así que va con el resto del guardado.

## Fusión de poderes («combinar dos ranuras en una») — rama `fusion`

Qué hace: desde la pausa, «Fusionar poderes» abre `FusionScene`: eliges el primer poder, el segundo, ves la vista
previa (nombre, tipos, potencia, recarga, patrón en texto y el proyectil animado), confirmas con `ConfirmScene`
(«CONFIRMAR FUSIÓN») y salta el destello de fusión. El resultado ocupa la ranura del primero; la del segundo queda
vacía para coger otro poder del suelo. Teclado (flechas, Enter, Esc, 1-4), ratón (filas, clic fuera = No) y mando.
- **Recetas** (`src/data/fusion.ts`): 62 con nombre propio por pareja de tipos sin orden; el resto de parejas de tipos
  distintos tiene un nombre compuesto propio (sustantivo del tipo más potente + adjetivo del otro: «Llama Insecta»);
  mismo tipo = «<Movimiento> Superior» (×1,5 y patrones ×1,35). Cubre las 18×18.
- **Estilo único por pareja** (cambio de requisito del usuario): nada de estilos por defecto ni reutilizados. Cada una
  de las 171 parejas sin orden tiene forma × estela × impacto × movimiento × partículas × escala × tono. Estela (9),
  impacto (11) y movimiento (5) salen del índice de la pareja con módulos primos entre sí (9·11·5 = 495 > 171), así que
  ni siquiera ese trío se repite (test); la forma (14) la elige la receta con nombre o sale del índice. El movimiento
  cambia de verdad el vuelo (ondula, gira, acelera, zigzag) de los disparos rectos, y el tono cambia el sonido.
- **Patrones**: 14 combinaciones de dos patrones del catálogo (ráfaga + onda, abanico + perforante, órbitas + lluvia,
  ola + minas, bumerán + cadena, rayo corto + estallido, columnas + bombas…). La primera parte va con el tipo
  principal (el del poder más potente) y la segunda con el otro: inflige el estado y la debilidad de cada uno. No toca
  el código de vórtice ni de rayo (solo usa `castPattern`).
- **Números**: potencia = máx(más fuerte, mín(240, 1,6× el más fuerte)); recarga = máx(la del más lento,
  mín(10 s, ×1,15)), con la recarga efectiva (por el estilo) de cada uno; el daño usa el mejor potenciador de tipo y
  el mejor «apuro» de los dos tipos.
- **Coste**: 1 fusión por piso (o ronda/jefe en Oleadas y Rush), gratis en monedas: las monedas ya se van en tienda,
  forja y Centro, y la fusión ya cuesta una ranura de poder y es irreversible. Lo fusionado no se vuelve a fusionar.
- **Arte** (`src/ui/art/fusionArt.ts`): 14 formas pixel (hélice, cometa, cristal, espora, anillo, media luna,
  estrella, gota, runa, colmillo, flor, meteoro, rayo doble, remolino), 9 estelas, 11 impactos, destello de fusión en
  dos fases (anillos de ambos colores que se cierran, flash y chispas) y marco dorado de ranura con las dos mitades.
  Con `lowFx()`: sin estelas, impacto y destello simples. `scenes/fusionCast.ts` viste los proyectiles del motor.
- **HUD**: la ranura fusionada usa el marco dorado y la ficha «FUSIÓN»; en la pausa, ficha dorada «Fusión».
- **Sinergias / efectos por tipo**: `powerTypes()` cuenta los dos tipos de un fusionado (calcStats, pistas, huecos
  llenos, admin) y `moveHasType()` para las sinergias que piden un poder de un tipo.
- **Guardado**: RunSave v30: `fusion` opcional dentro de cada poder (validado) y `fusionFloor` (0 = ninguna); los v29
  se migran con 0. También pasa de piso en piso (`FloorCarry`).
- **Panel admin**: «Fusionar poderes (abrir pantalla)» (sin límite por piso; marca la partida al fusionar) y «Dar
  poder de tipo ◀ X ▶» (de tu reserva si hay; si no, uno del catálogo de ese tipo con potencia 80).
- Audio: `sfxShift(nombre, semitonos)` en `ui/audio.ts`.
- Tests: `tests/fusion.test.ts` (9): 171 parejas, simetría y cobertura 18×18, firmas únicas, nombres compuestos sin
  repetir, potencia y recarga con topes, reglas (una por piso, sin refusionar), Superior y guardado v29→v30. 731 en total.
Pendiente / no verificado:
- Solo `tsc` y `npm test`; `npm run build` no arranca en la VM (falta `@rollup/rollup-linux-x64-gnu`). Sin probar en el
  navegador: aspecto de las 14 formas y estelas sobre los proyectiles, la vista previa, el destello, el marco dorado,
  el menú de pausa con 8-9 opciones y el equilibrio real.

## Cinemática de la megaevolución del jugador (rama `mega`)
- Sustituye el efecto anterior (crisálida + flash) por una cinemática de ~2,1 s (0,9 s con `lowFx()`), con el lenguaje
  de los cambios de fase de los jefes: `freezeWorld`, zoom de cámara hacia el Pokémon (hasta ×1,45 sobre GAME_ZOOM),
  temblor creciente, carga de energía (partículas en espiral con forma según el tipo: ascuas, gotas, chispas,
  cristales, hojas, humo, escamas, rocas o estrellas; anillos que se cierran; viñeta oscura), la Mega Piedra baja con el
  símbolo mega girando y lanza su rayo, destello blanco con la silueta que late y se funde de la forma base a la mega
  (el sprite real cambia en mitad del destello: `applyMegaLook` espera a `megaLookGate`), onda expansiva con polvo,
  escombros, estrellas y último sacudón, y vuelta de la cámara a su sitio con `thawWorld`.
- Lógica pura en `src/scenes/megaCinematic.ts` (plan de fases, estado por instante, restauración de cámara, estilo por
  tipo); dibujo en `src/ui/art/megaFx.ts` (`drawMegaCine`, `megaCineBurst`); conducción en
  `GameScene.playMegaCinematic`. Invulnerable mientras dura. Se corta y restaura (zoom de sala, `setRoomCamera`, scroll
  fijo en salas normales, deshielo solo si lo heló ella) al acabar la partida, cambiar de sala, caer o perder el
  sprite; la pausa la detiene con el reloj de la escena. Reglas de la mega sin cambios.
- Tests: `tests/megaCinematic.test.ts` (6). 737 en total.
Pendiente / no verificado:
- Solo `tsc` y `npm test`. Sin ver en el navegador (localhost:5173 sirve main): aspecto real, encuadre del zoom en salas
  grandes, el fundido de silueta con sprites PMD y PokeAPI, y la carga tardía del sprite mega sin red.
## Locomoción para todos: fotogramas de andar/volar/flotar hechos por código (rama `anim`, 31/10)
Auditoría (tests/locomotionAudit.test.ts) sobre las 1059 especies y formas del juego (species-index + formas regionales):
- 787 no tenían modo de moverse puesto a mano y caían en el de su tipo; de ellas ~85 estaban mal (fantasmas con patas
  que flotaban, como Gengar, Golurk o Houndstone; capullos, masas, babosas y gusanos que «andaban»; Porygon2, Munna,
  Vanillite, Carbink, Tapus o Nihilego andando; Seel, Dewgong, Tatsugiri o Veluza andando). Nuevo `SPECIES_LOCOMOTION`
  (manda sobre listas y tipo) y las formas regionales sin entrada usan la de su especie normal.
- Todo lo que no tenía hoja Walk de SpriteCollab (66 especies de `PMD_MISSING`, Stunfisk de Galar, megas sin hoja con
  el dibujo de PokeAPI, Dinamax/Gigamax/Tera sobre el dibujo fijo, shinies o formas cuya hoja no carga) solo tenía la
  pose: un saltito con balanceo, el dibujo entero rígido. Ahora `data/procLoco.ts` saca 4 fotogramas en pixel art del
  dibujo fijo: andar levanta y adelanta un pie y luego el otro; volar bate las alas (columnas de los lados); flotar
  ondula por columnas; reptar/nadar, onda lateral fila a fila; botar/rodar, aplastar y estirar apoyado en el suelo.
  `ui/locoAnim.ts#procAnimate` crea la hoja `<textura>~loco-<modo>` una vez y pone el fotograma con setFrame (no con
  anims, para no pisar el giro frente/espalda de `face`); parado vuelve al dibujo original. Se usa en `dressSprites`
  (jugador, enemigos, minijefes, jefes y finales), en `dressLoose` (aliado) y en el Tower Defense (también los
  voladores, que antes no se animaban).
- Tests nuevos: cada modo da 4 fotogramas distintos y no vacíos, andar alterna los pies, volar mueve las alas, el ciclo
  pasa por todos los fotogramas y para en el 0, todas las especies/formas tienen animación, y las correcciones por
  especie. `tsc` limpio y `npm test` en verde.
Pendiente / no verificado:
- Sin probar en el navegador (localhost:5173 sirve main, no la rama): falta ver el aspecto real de los fotogramas en
  sprites de PokeAPI (sobre todo andar en Pokémon de frente con patas muy juntas) y que no haya parpadeos al girarse.
## IA de enemigos más lista: nadie se queda inerte (rama `ia`, 31/10)
Queja: «si me quedo quieto muchas veces ni avanzan ni nada». Causas encontradas en `updateEnemy` (GameScene):
- **Emboscador**: se quedaba invisible y quieto hasta 9 s si no te acercabas a 180 px.
- **Atascos**: el campo de flujo solo existe en la sala actual con obstáculos; en salas grandes (otra celda) o con el
  enemigo en una casilla no transitable iba en línea recta contra la roca, y nada detectaba que no avanzaba.
- **Apilados**: con `collider(enemies, enemies)` los de detrás empujaban contra el de delante y se quedaban quietos.
- **Tiradores**: se ponían en su franja tras una roca y disparaban a la piedra sin recolocarse.
Cambios (`src/data/enemyAI.ts`, puro y testeado; GameScene lo aplica a todos los no jefes, también en Oleadas, Torre
y Tower Defense, que usan el mismo `updateEnemy`):
- Arquetipos por comportamiento (acosador, flanqueador, francotirador, embestidor, enjambre, apoyo).
- Separación entre enemigos (radio 56 px) mezclada con la dirección deseada en `walk`.
- Detector de atascos: si en 700 ms avanza < 10 px queriendo moverse, rodea de lado 650 ms (alterna lado).
- Vigilante: más de 1,2 s casi quieto en estado normal, lejos de ti y sin telegrafiar → se le empuja hacia ti.
- Perseguidores sin obstáculos buscan su hueco alrededor de ti (`flankDir`) en vez de hacer cola.
- Tiradores y curanderos: distancia óptima con strafe y corrección radial (`rangedDir`); sin línea de visión
  (`lineOfSight` en la rejilla) se recolocan por el camino.
- Emboscador: escondido como mucho 2,6 s y se arrastra hacia ti mientras tanto.
- Poca vida (<25 %, no embestidores/enjambre/jefes): se retira 0,9 s, como mucho una vez cada 5 s. Tras tu esquiva o
  parry a < 150 px los cuerpo a cuerpo dudan 0,38 s.
- Equilibrio: daño sin tocar; pausas entre ataques ×1,12 (mordisco, embestida, supervisor, disparo) para compensar
  la presión extra. Telegrafías (tintes, parpadeos) iguales.
- Tests: `tests/enemyAI.test.ts` (10), con mini simulación: jugador quieto 10 s tras un muro → todos llegan y nadie
  está parado > 1 s; cinco apilados se reparten. 741 en total.
Pendiente / no verificado: solo `tsc` y `npm test`; sin probar en el navegador (localhost:5173 sirve main). Falta ver a
ojo la sensación de dificultad del piso 1, el desatasco en salas grandes y que la retirada no resulte rara.
## Fallos visuales en la pelea de jefe (Lunala, desierto) — rama `fallos`
- **Bloque de ladrillo hueco en mitad de la arena (colisión mala)**: en las salas grandes de 2x2, la unión derecha y la de abajo pintaban cada una su muro hacia la esquina central y nadie ponía suelo allí. Quedaba un pilar de muro con el fondo asomando, con colisión para el jugador; los voladores (Lunala) lo atravesaban. Ahora, si las cuatro casillas forman un bloque 2x2, la esquina es suelo y se quitan esos muros interiores (`src/level/joinCorner.ts`, `buildJoin`). Test: `tests/joinCorner.test.ts`.
- **Filtro en pantalla**: el tinte del clima seguía a `worldView`, que va un fotograma por detrás de la cámara, y dejaba una franja sin cubrir; ahora lleva 96 px de margen. Los rayos del sol (triángulos de un solo tono) eran más suaves pero se veían como cantos: ahora son más tenues y van en tres capas.
- **Oscuridad con bordes**: el halo se cuantizaba en 6 escalones (anillos visibles) y los rectángulos de alrededor se solapaban 2 px con la textura (marco más oscuro). Ahora el degradado es suave (`darkHoleAlpha`, smoothstep), con efectos bajos también tiene degradado (más estrecho) y el solape es de 1 px. Test en `tests/darkAlpha.test.ts`.
## Defensa de torres: «Elige tu equipo» con mando, precio y clase en cada casilla — rama `tdmenu`
- **Mando**: la cruceta/stick recorre la rejilla y en los bordes pasa a la página anterior/siguiente conservando la fila; por la derecha de la última página entra al panel del equipo (A quita al Pokémon del hueco; abajo «¡A jugar!» y equipo de prueba); por arriba de la primera fila, a la barra «Filtro/Orden». LB/RB ±1 página (mantener repite), LT/RT ±5, X cambia el filtro, Start lleva a «¡A jugar!». Teclado: Q/E, AvPág/RePág ±5, F filtro, O orden, P «¡A jugar!»; ratón: clic en filtro/orden y en los huecos del equipo para quitar. Leyenda del mando actualizada (`inputMode.ts`).
- **Filtro/orden**: Todos, Mi equipo, cada clase, Aéreo y cada tipo; ordenar por poder, coste, nombre o clase.
- **Casillas**: sprite encajado a 50 px (crece como mucho a 58 al enfocarse, dentro de la baldosa de 72), icono pixel art de la clase arriba-izquierda (con saltito al enfocar), distintivo Aéreo si alcanza voladores, coste abajo, franja de color de la clase arriba y la de rareza abajo; anillo de foco de tres trazos. Ficha al pie con icono, coste, alcance, daño y qué hace la clase.
- Lógica pura en `src/data/towerDefense/teamPick.ts` (tests `tests/tdTeamPick.test.ts`); iconos en `src/ui/art/tdClassIcons.ts`. Sin verificar a ojo: no se pudo abrir la rama en el navegador.

## Minimapa: salas fantasma al reanudar, minimapa temático y laterales por bioma (rama `minimapa`)

- **Bug**: el guardado escribía `roomCount: this.floor.rooms.length` (salas totales, con Centro/tienda/secreta/desafío/grandes/arena ya añadidas) y al reanudar se pasaba ese número como base a `generateFloor`, que volvía a añadir las especiales encima: salía otro piso y `visited` apuntaba a salas distintas (más visible con la recarga en caliente del dev server, que reanuda desde el guardado). Ahora se guarda `roomBase` (el número base real, campo opcional, sin subir RUN_VERSION); los guardados viejos lo recuperan con `recoverRoomBase` (busca la base que da exactamente esas salas totales). `restoreRun` descarta ids de `visited`/`cleared` que no existen y marca enteras las salas grandes; `drawMinimap` también filtra ids inexistentes. Al entrar en una sala grande se marcan todas sus casillas. Test: tests/floorResume.test.ts.
- **Minimapa**: marco con el acento del bioma y motivos en las esquinas, niebla de guerra con halos en lo explorado, baldosas con bisel y textura, pasillos distintos (del jefe con borde rojo, oculto abierto como grieta morada, barrotes rojos mientras la sala está en pelea), salas vistas sin limpiar con esquina roja, candado en cofres cerrados, trazo del camino, jefe que respira, tesoro que brilla y Poké Ball que bota (capa aparte redibujada ~8 veces/s; fija con lowFx). Expone `minimapRoomAt`/`ROOM_LABEL` para una leyenda (aún no conectada).
- **Laterales temáticos**: src/ui/art/hudTheme.ts (tema por bioma, contraste WCAG probado en tests/hudTheme.test.ts), src/ui/art/hudBackdrop.ts (fondo con textura, motivos pixel art, columna alrededor de la sala y motas animadas sin lowFx); `setHudPalette` tiñe los marcos del HUD; el fondo de la página toma el color del bioma durante la partida.

## Pilar de la sala 2x2, tintes alineados con el zoom y elegir forma de poder (rama `forma`, 2026-10-31)

- **Pilar 2x2** (corrige el arreglo anterior que lo quitaba): en el centro de las salas 2x2 vuelve el pilar, ahora
  macizo: relleno entero con la pared del bioma, tapa más clara con canto y piedras angulares, cara frontal en sombra,
  contorno y sombra en el suelo (sin huecos ni fondo). Un único cuerpo físico en todo el cuadrado (jugador, enemigos,
  disparos) y `keepInside` saca de él a cualquier enemigo/jefe (voladores, embestidas, teletransportes) y al jugador,
  para que nada quede dibujado dentro. Va por debajo de los sprites (profundidad 0,26-0,33). Spawns, trampilla y
  objetos lo evitan solos (`wallRects`/`spotClear`, radio de margen). `src/level/joinCorner.ts` (`pillar`,
  `pillarRect`, `pushOutOfRect`), `buildPillar` en `GameScene`, test `joinCorner.test.ts`.
- **Filtro desalineado**: revisados clima (`weatherFx`, en coordenadas de mundo con `worldView` y margen: bien),
  ambiente del jefe (`bossAmbience`, sobre `arena()`: bien), oscuridad (sigue al jugador, rectángulos de 4000 px:
  bien), destello de daño (cámara del HUD, exacto a `GAME_VIEW`: bien). Fallo encontrado: los objetos con
  `scrollFactor 0` de la cámara principal se pintaban de 0 a `scale.width`, pero Phaser los escala con el zoom (1,5)
  alrededor del centro del visor: el **tinte de noche** (`dayNightLayer`) salía con sus bandas corridas respecto a
  paredes y suelo y las **bandas de cine** de la caída de la arena (`arenaLetterbox`) quedaban fuera de la vista.
  Nuevo `src/ui/camView.ts` (`fixedViewRect`) que da exactamente lo que ve el visor (más margen para el temblor);
  test `camView.test.ts`.
- **Forma de poder elegida, nunca al azar**: el botón ya no escoge solo (antes, sin elegida, con la mega en recarga
  saltaba el Teracristal). `powerPress`/`effectivePowerSel` (puras, `powerForm.ts`): usa exactamente la elegida; si
  solo hay una disponible, esa; con varias y ninguna elegida, avisa y hace parpadear el selector. Selector nuevo
  siempre visible en la franja de abajo con una casilla por forma (icono pixel art de su objeto), la elegida con marco
  dorado, punto verde/rojo de estado y el texto «Forma: lista / activa / motivo». Elegir: X (tecla configurable),
  cruceta izquierda/derecha, rueda o clic derecho sobre el botón, clic o toque en la casilla. Se recuerda en toda la
  partida (`RunSave.powerSel` opcional; pasa de piso). Tutorial `forms` (teclado y táctil sin teclas) actualizado.
  Test `powerPress.test.ts`.
- **Sin verificar a ojo**: no se ha probado en el navegador (localhost sirve `main`); revisar el aspecto del pilar en
  cada bioma, el selector de abajo con los controles táctiles y el tinte de noche con zoom.

## Sala secreta, rocas falsas, trampilla, salas a oscuras e intro del jefe con niebla (rama `salas`, 2026-10-31)

- **Sala secreta**: al abrir una puerta oculta, `revealDoor` dibujaba el hueco y el marco de la puerta de la OTRA sala
  (la secreta) sin apuntarlos en `roomObjs`, así que el filtro de cámara (`showRooms`) no los ocultaba: se veían losas
  y postes flotando en el vacío junto a la sala actual (sobre todo en salas grandes en L, cuyo hueco enseña el fondo).
  Ahora lo nuevo se apunta a su sala y se vuelve a aplicar `showRooms`. Además, al abrir la sala secreta se abren
  TODAS sus entradas ocultas (por los dos lados), no solo la de la bomba.
- **Piedras sin colisión**: las rocas de la rejilla (`R`, escombros de la arena) sí tienen cuerpo. Lo que parecía una
  piedra sin colisión eran detalles del suelo de `decorateRoom` (piedrecitas de basalto del volcán, guijarros de
  cueva/cumbre/nieve, cristales y montoncitos de nieve) pintados a tamaño entero (30-48 px). Ahora salen a la mitad
  y algo apagados, como gravilla (`SOLID_LOOKING` en `roomDecor.ts`).
- **Trampilla**: `trapdoorSpot` busca primero un sitio con mucho hueco (radios 120 → 96 → 72 → 56 px, también en
  diagonal con `ringFree`) y solo si no cabe usa el de antes: ya no sale pegada al pilar 2x2, rocas ni paredes.
- **Salas a oscuras**: en pisos con bioma de tipo fantasma o siniestro (`biome.types`), `pickRoomRules` garantiza
  entre 1 y 4 salas a oscuras (solo salas de combate normales: nunca inicio, jefe, tienda, Centro, evento ni
  minijefe). Las tiradas extra van después, así el resto de pisos sale igual. Test en `roomRules.test.ts`.
  (Caso raro sin cubrir: si el santuario de la Mega Piedra no encuentra sala libre puede quitarle la regla a esa sala.)
- **Intro del jefe con Niebla**: la viñeta de la niebla (`WeatherFx`) seguía centrada en el jugador mientras la
  cámara se iba al jefe y hacía zoom, y su borde oscuro tapaba media pantalla. Durante la intro (`cineUntil`) se
  centra en la vista, con transición suave. El tinte de noche (`dayNightLayer`) se repinta cada fotograma (antes cada
  80 ms dejaba una franja sin cubrir al hacer zoom).
- **Sin verificar a ojo**: no probado en el navegador (localhost sirve `main`). Revisar: abrir una sala secreta junto
  a una sala en L, la trampilla del piso 5 con el pilar, la intro del jefe en un piso con Niebla y el tamaño de la
  gravilla en volcán/cueva.
## Oscuros: ojos rojos y enemigos, minijefes y jefes oscuros (rama `oscuros`)

- **Ojos rojos** (`darkEyes` en `src/ui/art/darkFx.ts`, arrancan con `darkAura`, así que los lleva todo oscuro: jugador,
  enemigos, minijefes, jefes y legendarios): dos píxeles rojos con halo que late, dibujados en `PRE_RENDER` (después
  de la animación y la pose de `locoAnim`) con la matriz real del sprite (giro, escala, volteo, elevación), así que no
  se desfasan. Posición: caja de píxeles opacos de cada cuadro (cacheada) y anchura de la cabeza (35 % de arriba);
  `eyeSpots`/`eyeFacing` (puras) los corren hacia donde mira y los ocultan de espaldas (filas PMD 3-5 o textura `-back`).
- **Aparición** (`darkSpawnChance`/`decideDark`, `darkMon.ts`): nunca en el piso 1 (salvo admin); del piso 2 sube
  hasta el tope: normales 4→12 %, minijefes 20→35 %, jefes 15→30 %; Fácil ×0,7, Difícil ×1,25. Tope de 1 oscuro
  normal por sala (2 desde el piso 6). Aviso «¡Un Pokémon oscuro!» / «¡Minijefe oscuro!» con `notify` (no centrado).
- **Más difíciles**: los multiplicadores de siempre (vida ×1,4, daño ×1,3, velocidad ×1,25, cadencia ×1,3), aura y
  ojos. Jefes y minijefes oscuros: un movimiento siniestro de más y se **enfurecen** una vez a media vida (velocidad
  ×1,15, recarga ×0,8, aviso «¡Enfurecido!»).
- **Botín**: +3 monedas de 5 (ya estaba), y los normales 20 % de poción o llave; tickets ×1,5 en jefes (ya estaba).
- **Oscuros descubiertos**: nueva lista `pokeisaac.darkSeen` (`addDarkSeen`, progreso) al vencer o capturar uno; la
  Pokédex muestra «N oscuros (M descubiertos)».
- **Admin**: fila «Siguiente enemigo / minijefe / jefe oscuro» (`setAdminNextDark`/`takeAdminNextDark`), se consume
  con el primero que aparezca, incluso en el piso 1.
- Test `tests/darkSpawn.test.ts`. **Sin verificar a ojo**: la posición de los ojos en especies raras (sin cabeza
  clara, p. ej. Magnemite o Gastly), su tamaño en jefes grandes y el ritmo del enfurecimiento.
## Jefes y enemigos que rodean, se desatascan y no atacan a ciegas (rama `camino`, 2026-10-31)

- **Causas**: (1) el campo de flujo (`flowField` de la cuadrícula de 1 casilla) solo existía en salas con rocas y solo
  para la casilla actual: en salas grandes, si el enemigo estaba en otra casilla, o con el pilar de las 2x2 y las
  uniones (que son `wallRects`, no celdas de la cuadrícula), `flowDir` devolvía la línea recta y se quedaban
  empujando contra el bloque. (2) Los jefes estaban excluidos del detector de atascos y del vigilante de
  inactividad. (3) `updateBossAttacks`, los movimientos de minijefe/élite y los tiradores disparaban sin mirar si
  había visión ni distancia.
- **`src/data/bossPath.ts`** (puro, `tests/bossPath.test.ts`): rejilla de navegación de toda la arena (casillas de
  32 px) con paredes, uniones, pilar, rocas/huecos de cada casilla y el hueco de las salas en L como bloqueado; dos
  holguras (normal 18 px, grande 40 px); campo de distancias Dijkstra de 8 vecinos sin cortar esquinas; `navStep`
  (mira dos pasos para no ir a escalones; saca de dentro de un bloque), `pathDir` (recta si el segmento está libre
  para su cuerpo, si no por la rejilla), `segmentClear` (visión contra rectángulos) y `attackUsable/usableAttacks`
  (apuntados solo con visión y a ≤ 520 px; de zona — lluvia, invocar, anillos, meteoros, rejillas, miasma, juicio,
  nova… — siempre; la onda solo a ≤ 420 px).
- **GameScene**: `navData` (caché por sala, se revisa cada 0,5 s y se rehace si cambian paredes o cada 2 s) y
  `navFieldFor` (recalcula solo si el jugador cambia de casilla). `flowDir` y `foeHasLos` usan esto para todos los
  enemigos, jefes y minijefes. Desatasco (`tickStuck`) también para jefes/minijefes (sin separación). Vigilante de
  inactividad también para ellos, salvo durante intro/congelado, fin de partida, ataque en curso (`castUntil`) o
  antes de activar sus ataques. Sin ataque útil, el jefe pospone 350 ms y sigue recolocándose; igual el reto final,
  los minijefes/élite, el tirador y el orbital (sin visión se acercan rodeando en vez de orbitar).
- **Sin verificar a ojo**: no probado en el navegador (localhost sirve `main`). Revisar en el piso 5 detrás del pilar,
  jefes grandes en esquinas estrechas y que las intros/megaevolución/derrumbe no se vean empujadas.

## Oscuros en todos los modos, sin salir al principio (rama `oscuros2`)

- `darkProgress(modo, progreso)` (pura, `darkMon.ts`) da el «piso oscuro» equivalente de cada modo (menos de 2 = sin
  oscuros) y `darkSpawnChance` acepta valores fraccionarios para subir suave hasta los topes de siempre:
  - Normal, Infinito y **desafío diario** (antes excluido): piso 1 nunca; en cada piso, nada en las 3 primeras salas
    (contando la inicial; arenas incluidas); minijefe y jefe desde el piso 2.
  - Torre: nada en los pisos 1-3; desde el 4, +0,15 por piso (tope hacia el piso ~70-100).
  - Oleadas: nada en las oleadas 1-3; +0,5 por oleada. Rush de jefes: nada en los jefes 1-2.
  - **Defensa de torres** (`towerDefense/engine.ts`): nada en las oleadas 1-4; +0,4 por oleada. Tirada con su propia
    semilla (no cambia el resto de la partida), tope por mapa como el de sala, jefe → «boss», jefe de oleada →
    «miniboss». Oscuro: vida/escudo ×1,4, velocidad ×1,12, dinero ×2 (`TD_DARK_MUL`); en la escena, aura, ojos rojos,
    estallido y aviso.
- El forzado del panel admin sigue mandando en cualquier modo y momento (también en Defensa de torres).
- Test `tests/darkModes.test.ts`. **Sin verificar a ojo**: los ojos sobre los sprites pequeños de la Defensa de torres.
## Dinamax rediseñado, Mewtwo anda y cinemáticas de Tera, Dinamax y Z (rama `formas`, 2026-10-31)

- **Dinamax** (Roberto: «Gengar Dinamax se ve horrible»): el aura eran óvalos rojos translúcidos del tamaño de la
  textura entera (con su aire) y la corona flotaba lejos de la cabeza; además el sprite se escalaba a ×1,65 sin más
  (píxeles de dos anchos). Ahora: `src/data/maxLook.ts` (`maxFitSize`/`maxFitSizePmd`) elige un tamaño con píxeles
  enteros en pantalla (con GAME_ZOOM) y con tope según lo que mide de verdad el dibujo (`contentBox` en GameScene,
  caja de píxeles visibles por fotograma con `alphaBox`); el cuerpo físico sigue siendo el de siempre. Aura nueva
  `drawMaxAura` (`src/ui/art/formCineFx.ts`): charco de bocanadas a los pies, nubes que asoman por los lados de la
  silueta, jirones que suben y corona de nubes pegada a la cabeza; opaca, en rejilla de píxeles, por detrás, sin tinte.
- **Andar de gigante** (Dinamax y Gigamax): reloj de la animación ×0,6, hoja de SpriteCollab a 0,65, pasos más altos y
  menos balanceo (`heavyPose`), y polvo con un temblor mínimo en cada pisotón (solo por el suelo y sin lowFx). El
  Gigamax con sprite propio conserva su aspecto; solo se ajusta su escala a píxeles enteros (tope más alto) y el paso.
- **Mewtwo anda**: estaba en `FLOATING_SPECIES`; ahora en `SPECIES_LOCOMOTION` como `walk` junto a sus megas
  (10043/10044), Shaymin, Genesect, Código Cero, Marshadow, Falinks, fósiles de Galar, Zacian, Zamazenta y Gholdengo;
  Sandygast/Palossand reptan. Mew, Celebi, Jirachi, el trío del lago, Cresselia y Darkrai siguen flotando. La sombra ya
  va a los pies (feetOf) y sin hover, así que queda en el suelo.
- **Cinemáticas nuevas** (`src/scenes/formCinematic.ts`, puro, test `formCinematic.test.ts`; dibujo en
  `formCineFx.ts`; `playFormCinematic` en GameScene con el mismo armazón que la mega: `freezeWorld`/`thawWorld`,
  invulnerable, zoom/temblor y `megaCamRestore`). Tera (1,8 s): el cristal sube desde los pies en columnas de facetas,
  late con un brillo diagonal, estalla en esquirlas y baja la corona; cartel del tipo en el estallido. Dinamax/Gigamax
  (1,95 s): nube roja en espiral y rayos de la banda, el Pokémon crece a tres golpes con rebote (aros rojos), y ruge con
  onda roja. Z (1,7 s): pose agachado con la estrella Z a los pies, el Cristal Z sube y concentra rayos, estirón con
  columna de luz y rayos en X; el ataque (disparos + golpe) sale al acabar, con el mundo ya en marcha. Con lowFx,
  0,75-0,85 s y sin viñeta. La mega no se ha tocado.
- **Oscuro**: el jugador no tiene transformación a oscuro (es una propiedad del Pokémon de la tirada), así que no lleva
  cinemática; además es área del agente `oscuros`.
- **Sin verificar a ojo**: no se ha probado en el navegador (localhost sirve `main`). Revisar Gengar/Snorlax Dinamax
  (PMD y shiny/PokeAPI), los Gigamax con sprite propio, el tamaño final frente a puertas y el ritmo de las tres
  cinemáticas con efectos altos y bajos.
## 2026-10-31 · Rama `ui`: fusión al recoger, esquiva, sin puzzle antes del jefe, ADMIN y filtros del TD

- **Fusión de poderes**: fuera de la pausa (sigue en el panel admin). Con las 4 ranuras llenas, al recoger o comprar
  un poder sale el cambio normal y, si entre las ranuras y el nuevo hay dos sin fusionar, «Fusionar dos poderes (F)»
  (FusionScene con 5 candidatos: dos de las ranuras → resultado + el nuevo en la libre; ranura + nuevo → resultado en
  esa ranura). Reemplazar una ranura con fusión pide confirmar «¡Vas a perder la fusión si continúas!»; solo recibes
  el ataque nuevo. Lógica pura en `data/fusion.ts` (`canFuseOnPickup`, `applyPickupFusion`, `replaceLosesFusion`).
- **Esquiva**: la distancia crece con la velocidad (57 → 95 px) y el impulso nunca baja de 1,6× tu velocidad
  (`dashSpeed(moveSpeed)`); rayas de velocidad y chispas pixel (con lowFx, menos).
- **Puzzle del gimnasio antes del líder**: apagado (`GYM_PUZZLE_ENABLED = false` en `level/gymPuzzles.ts`); el jefe sale
  directo. Código y tests conservados.
- **Distintivo ADMIN**: a la franja de arriba, pegado a la izquierda de la sala (no choca con minimapa, avisos ni barra del jefe).
- **TD «Elige tu equipo»**: barra con Clase · Tipo · Orden · Todos. ◀▶ y LB/RB cambian el valor del selector enfocado,
  ▲ pasa al siguiente, B/Esc quita el filtro (si no hay, sale), X o R los quitan todos; F/T/O atajos; clic izq./der.
- **Sin verificar a ojo**: no probado en el navegador (localhost sirve `main`).

## Puertas, vida de los jefes, arena del jefe, casilla del jefe y parry en admin (rama `jefevida`, 2026-10-31)

- **Puertas que no se abrían**: la sala solo se daba por limpia al caer un enemigo por `killEnemy → checkClear`; si el
  último se iba de otra forma (atascado fuera de la sala, sin cuerpo, recolocado…) o la sala quedaba en `cleared` con
  puertas cerradas, te quedabas encerrado. Nuevo vigilante `watchRoomClear` (cada 200 ms, lógica en
  `src/data/roomClear.ts`): sin ningún hostil activo durante `CLEAR_CONFIRM_MS` y con puertas cerradas → `checkClear`;
  sala ya limpia con puertas cerradas → se abren; enemigo fuera de la arena más de `FOE_STUCK_MS` → vuelve dentro.
  `clearHoldUntil` evita adelantarse a las oleadas del rival/desafío y a los spawns al entrar.
- **Jefe «a mitad de vida»**: varias protecciones de fase (aviso de megaevolución al 50 %, derrumbe de la arena,
  pausa de fase del reto final) restauran la vida del jefe cada fotograma y se descartaba el daño en silencio. Ahora:
  anillo azul que late mientras está protegido y aviso «Protegido» al pegarle; el daño recibido se guarda y se aplica
  al acabar (tope `BOSS_HELD_CAP`, nunca mata); y vigilante (`tickBossGuard` en `bossSafety.ts`): si la protección
  dura más de `BOSS_PROTECT_MAX_MS` (4 s) o le pegas `BOSS_STALL_MS` (3 s) sin que baje, se corta todo
  (`releaseBossProtection`) y se le baja la vida.
- **Arena 3x3 dividida con un jefe por casilla**: `reserveSanctuaryRoom` (santuario de la Mega Piedra) deshacía la sala
  grande «más aislada», que solía ser la arena del jefe: sus casillas quedaban sueltas (con paredes) y cada una, al ser
  de tipo `boss`, sacaba su propio jefe. Ahora solo deshace salas grandes de combate, y `repairBossArena` (floorGen)
  reune siempre todas las casillas `boss` en un grupo. Test con 400 semillas (fallaba con el código anterior).
- **Jefe/minijefe en la casilla del jugador**: `bossSpot`/`bossCell` (orden de `bossCellOrder`): en una sala grande
  sale en la casilla más lejana que no sea la del jugador y con sitio libre (nunca dentro de estructuras); sirve para
  `spawnBoss` (y así admin `spawnBoss`/`bossHere`), el reto final y los minijefes/guardianes.
- **Parry en modo admin**: `hurtPlayer` salía nada más empezar con el modo dios, antes de mirar el parry. Ahora el modo
  dios corta después del parry (sigue siendo invulnerable y el ladrón no roba).
- **Sin verificar a ojo**: no probado en el navegador (localhost sirve `main`). Revisar el anillo de «Protegido», la
  aparición del jefe en arenas 2x2/3x3 y que las puertas se abran en salas de evento (rival, sala del tiempo).

## Música: crossfade e histéresis entre combate y normal

- **Causa**: `GameScene.musicTick` miraba los enemigos cada 0,4 s y llamaba a `playTrack` en cuanto cambiaba la situación;
  `playTrack` cortaba la pista y la reiniciaba desde el paso 0 (las notas ya programadas seguían sonando encima).
  Al limpiar una sala o cruzar una puerta con enemigos sueltos, la música saltaba calma/combate sin margen y sin fundido.
- **Estado puro** (`src/audio/musicState.ts`, tests en `tests/musicState.test.ts`): `stepMood` con histéresis (subir de
  intensidad: `MUSIC_ENTER_MS` 450 ms; bajar, p. ej. combate a normal: `MUSIC_EXIT_MS` 2,8 s; una candidata que desaparece se descarta),
  `forceMood` (jefe y jefe final entran al instante con su intro), `crossfadeGains` (potencia constante, `CROSSFADE_S` 1,5 s)
  y `resumeStep` (reanudar si la pista salió hace menos de `RESUME_WINDOW_MS` 20 s).
- **Motor** (`src/ui/audio.ts`): cada pista suena por su propio carril (GainNode) colgado de `musicGain`, así que ajustes de
  volumen/silencio, `softMusicIn` y `restoreMusicVolume` siguen funcionando. `playTrack` hace crossfade y la pista que sale
  recuerda su paso; al volver pronto se reanuda en vez de empezar de cero. Mismo bucle de 100 ms (no depende de Phaser, así
  que la pausa y el modo táctil no cambian).
- **GameScene** (mínimo): `musicMood` pasa a `musicState`, el tick va cada 120 ms y usa `stepMood`; jefe y jefe final usan `forceMood`.
- **Sin verificar a oído**: la duración del fundido y los retardos (1,5 s / 0,45 s / 2,8 s) se han elegido sobre el papel;
  probar en el navegador entrar en salas con y sin enemigos, oleadas seguidas, jefe y volver al menú.
## Sin pilar en las 2x2, ataques que no atraviesan estructuras y zoom fiable al jefe (rama `ajustes`, 2026-10-31)

- **Fuera el pilar del centro**: en las salas grandes 2x2 la esquina central vuelve a ser suelo abierto. `joinWalls`
  (`src/level/joinCorner.ts`) ya no devuelve `pillar` sino `cornerFloor`: no hay muros interiores hacia la esquina y se
  pinta suelo en ella (`cornerRect`), que es lo que faltaba en el antiguo «bloque hueco» (asomaba el fondo). Quitados
  `buildPillar`, su colisión, `pillars`, `pillarRect`/`pushOutOfRect` y el empuje de `keepInside`. La rejilla de
  navegación (`bossPath.ts`), `spotClear`, la trampilla y los spawns salen de `wallRects()`, así que esa zona queda
  libre sin más cambios. Tests de `joinCorner` y comentarios de `bossPath` al día.
- **Ataques y estructuras** (`src/data/projectileRules.ts`): tabla `PASSES_OVER` con TODOS los tipos de ataque
  (patrones del motor, disparo básico, ataques de jefe, ráfagas, final y megaataque) y `passesOverStructures(kind)`.
  Chocan: disparos, chorros, orbes, bumeranes, teledirigidos, olas de proyectiles, rayos, láseres, cadenas eléctricas,
  ondas. Pasan por encima: `lob`, `rain`/lluvia del jefe, meteoros, `quake`, `eruption`, minas, `vortex`, zonas de
  peligro, miasma y juicio. Cómo se aplica:
  - Proyectiles con cuerpo (`shots`, `foeShots`, también los de jefe por `fireFoeShot`/`host.shoot`): ya tenían
    collider con `walls` (rocas, bloques y muros interiores de salas grandes están en ese grupo) y `doorBlocks`; los
    que rebotan rebotan (`onShotWall`). Sin colliders nuevos.
  - Rayos que se dibujan (rayo del motor, láser del jefe, megaataque, brazos de las minas en cruz, rejilla de rayos):
    se cortan en la primera estructura con `clipSegmentToRects` (segmento contra rectángulos); dibujo y golpe usan
    el largo cortado. Rejilla: cada rayo sale de su borde y se corta.
  - Cadenas: no saltan a un objetivo con una estructura en medio (`segmentBlocked`). Ondas de choque (jefe y nova del
    final) y la ola-muro (`wallGap`): una estructura entre el origen y tú te tapa. Orbes que rebotan (`bounce`):
    rebotan también en rocas y muros (`bounceOffRects`).
  - `structRects()` (paredes + puertas cerradas) se calcula una vez por fotograma; el motor lo recibe como
    `AttackHost.blockers()`.
- **Marshadow sin zoom en el piso 1**: causa principal, la cámara. Al entrar en la sala del jefe, `spawnBoss` se llama
  desde el final del `cam.pan` de la transición de puerta; la intro lanzaba otro `cam.pan` dentro de ese callback y
  Phaser, al cerrar el primero, apagaba el nuevo: había zoom pero sin ir al jefe (muy visible en arenas grandes con el
  jefe en la casilla lejana). En pisos con puzzle de gimnasio no pasaba porque el jefe sale después. Ahora
  `bossCinematic` mueve la cámara con su propio tween (`centerOn` + `setZoom`), y con «pocos efectos» también encuadra
  (de golpe) en vez de no hacer nada. Además la clave de «ya vista» (`src/data/bossCine.ts`): `bossCineKey` lleva
  partida, modo, piso, semilla del piso y arena (primera casilla del grupo, no la casilla en la que estás) y
  `shouldShowBossCine` solo la salta al reanudar una partida guardada dentro de esa arena. Tests en
  `tests/bossCine.test.ts`.
- **Sin verificar a ojo**: no probado en el navegador (localhost sirve `main`). Revisar la esquina de una 2x2, los
  rayos cortados por rocas (rejilla y minas en cruz sobre todo) y la intro de Marshadow en el piso 1 y de un jefe en
  piso con gimnasio.

## Controles táctiles rehechos para móvil (rama `movil`)

- **Problema** (probado en móvil apaisado, lienzo 1920×1080 visto a ~0,35): para lanzar un poder había que soltar el
  joystick de apuntar (los botones 1-4 estaban encima), joysticks fijos en las esquinas, diez botones redondos con
  texto sans-serif, el cuadro de la esquiva pisando los botones 1 y 2, HUD diminuto y tarjetas del menú de modos
  desbordadas.
- **Auto-apuntado** (`src/data/touchAim.ts`, pruebas en `tests/touchAim.test.ts`): `touchAimDir` da la dirección
  de un poder tocado: enemigo más cercano (los jefes cuentan; fuera los que se están capturando o huyen), si no el
  joystick de apuntar, si no la última dirección de disparo. `GameScene.castSlot` acepta ahora una dirección
  opcional (`touchCastDir()`), que pasa a ser la última de disparo. Teclado, ratón y mando no la usan.
- **Joysticks flotantes** (`src/data/touchPad.ts`, pruebas en `tests/touchPad.test.ts`): `stickZone` (mitad
  izquierda = moverse, derecha = apuntar, salvo zonas reservadas: ranuras de poder, pausa y barra del consejo, que
  da `GameScene.touchBlocked()`), `stickVector` (zona muerta del 15 % sin salto, tope en el radio y la base sigue al
  dedo si se aleja más de 1,35 radios). La base se dibuja donde empieza el dedo y se esconde al soltar; queda una
  pista tenue (respira suave; quieta con efectos bajos). Hasta 5 dedos.
- **Poderes como en PC**: las ranuras 1-4 del HUD (abajo a la derecha) se ven y se tocan en táctil; tocar = lanzar
  con auto-apuntado. Fuera los botones 1-4 de `touchControls.ts` (y `setPower`). En móvil el nombre se corta a 10
  letras y la ficha del tipo se encoge si no cabe.
- **Botones pixel art** (`src/ui/art/touchIcons.ts` rejillas y colores, sin Phaser y con prueba de forma;
  `src/ui/art/touchButtons.ts` hornea las texturas): marco 24×24 con bisel y esquinas recortadas, icono propio
  (escudo = Parry, flecha con estela = Esquiva, estrella = Activo, bomba, mano = Usar, frasco = Poción) y tres
  estados: normal, pulsado (bisel invertido, icono 1 px abajo, 120 ms) y apagado (gris: esquiva recargando, activo
  sin carga, sin bombas o pociones; se pueden tocar igual y el juego avisa). Sin texto ni emojis.
- **Colocación** (`padButtons`, todo en px de lienzo y comentado): derecha, en una fila propia justo encima de las
  ranuras (y ≈ 654-750): Parry y Esquiva de 96 px. Izquierda, donde en PC está el cuadro del objeto activo: Activo
  (96) y Bomba (72) abajo; encima, Usar (96, **solo cuando hay algo con lo que interactuar**: el mismo aviso
  `PromptPanel.hasText`) y Poción (72). Zona de toque: el dibujo + 10 px y nunca menos de 44 px CSS; gana el botón
  más cercano. En táctil el cuadro «Esquiva» del HUD no se dibuja (era el que pisaba 1 y 2) y los avisos de la
  derecha son como mucho 2 (no bajan hasta Parry/Esquiva).
- **HUD legible** (`src/ui/uiScale.ts`: `hudFontSize`/`hudFont`, pruebas en `tests/uiScale.test.ts`): el aumento de
  letra de `main.ts` se calculaba con el zoom de los menús (×1,6875), pero el HUD va sin zoom y se quedaba en 5-7 px
  CSS. `hudFont` busca 9,5 px CSS (≈ 27 px de lienzo a 0,35) con tope ×2 y máximo opcional por sitio. Aplicado a PS,
  nombre (sigue encogiéndose si no cabe), contadores (máx. 22), «Objetos» (máx. 24), Parry/Adrenalina (máx. 22/20),
  ranuras, avisos (`ToastStack` acepta una función de tamaño), aviso de «Usar/comprar» (`PromptPanel` con tamaño) y
  consejo (el cuadro crece hacia arriba si el texto no cabe en la franja de abajo). En escritorio `hudFont` devuelve
  el mismo tamaño: nada cambia.
- **Menús**: `src/ui/fitText.ts` (`fitTextBox`: baja la letra hasta un mínimo y luego recorta palabras con «…»;
  `fitTextLine`: una línea, baja la letra y si no, encoge). En «¿A qué quieres jugar?» el nombre, la descripción
  (hasta encima del récord), el récord (una línea, encogido) y «Luego: …» encajan en su tarjeta; mínimo 15 px en
  móvil. `addHelpBar`: en móvil nunca enseña teclas aunque el navegador diga «ratón»; el menú de modos tiene pie
  táctil corto. Pokédex: el nombre de cada casilla no se sale. Controles y consejos (`controls.ts`, `tutorial.ts`)
  describen los controles nuevos (textos cortos para que quepan en su fila).
- **Sin verificar a ojo** (no se puede ver el juego en la VM; solo `tsc` y `npm test`): afinar en un móvil real
  `STICK_R`/`STICK_KNOB`/`STICK_DEAD` y `PAD_BTN_*` en `touchPad.ts`, `HINT` y opacidades en `touchControls.ts`, que
  la fila Parry/Esquiva no choque con el último aviso, que el nombre y los contadores del panel izquierdo quepan con
  la letra nueva, el texto de progreso (no se ha agrandado: su hueco es fijo en `hudLayout`), el consejo alto
  tapando un poco el fondo de la sala, el multitoque real (joystick + ranura a la vez) y la pasada por Partidas,
  Iniciales, Gacha y Ajustes (solo se miró el código; no se vio nada evidente salvo la Pokédex).

## Pantalla completa en móvil y app instalable

- **Pantalla completa automática** (`src/ui/screenFit.ts`, decisión pura en `src/data/autoFullscreen.ts`, pruebas en
  `tests/autoFullscreen.test.ts`): solo con `touchOnlyDevice()`. En el primer toque (pointerup/touchend, que es lo que
  el navegador acepta como gesto) pide `requestFullscreen({ navigationUI: 'hide' })` y bloquea la orientación en
  horizontal. Si el jugador sale, se vuelve a pedir una sola vez en el siguiente toque. La fila «Pantalla completa» de
  Ajustes guarda `pokeisaac.autofs` (`off` al quitarla a mano: no se fuerza más; `on` al ponerla). iPhone Safari no
  soporta la API: ahí no hace nada (la solución es la app instalada). En escritorio no se instala nada de esto.
- **Reajuste del lienzo**: `resize`, `orientationchange`, `visualViewport.resize`, `visibilitychange`, `focus`,
  `pageshow` y `fullscreenchange` llaman a `scale.refresh()` a los 150 y 600 ms. `#game` usa `100dvh` (con
  `@supports`) en vez de `bottom` para no medir la altura «grande» con la barra del navegador. Pensado para el
  lienzo enorme al volver de la ventana de Google (`signInWithPopup` se mantiene).
- **PWA**: `public/manifest.webmanifest` (`display: fullscreen`, horizontal, rutas `./`), iconos pixel art propios
  generados con `node scripts/makeIcons.mjs` (192, 512 y 180 apple) y metaetiquetas en `index.html`. `public/sw.js`
  solo intercepta PokeAPI y GitHub raw, así que no toca el manifest ni los iconos.
- **A probar en un móvil real**: Android Chrome (primer toque entra en pantalla completa y en horizontal; salir y
  tocar vuelve a entrar una vez; quitarla en Ajustes no se fuerza; iniciar sesión con Google y volver deja el juego
  del tamaño correcto; «Instalar app» abre sin barras). iPhone Safari: Compartir, «Añadir a pantalla de inicio»,
  abrir desde el icono (sin barras, horizontal, notch bien) y comprobar que el icono se ve bien.
  No se pudo ver nada en la VM: solo `tsc` y `npm test`.

## Controles táctiles en las bandas laterales y ajustes de vista en móvil (rama `barras`, 2026-11-01)

- **Qué**: en un móvil o tableta solo táctil con pantalla más ancha que 16:9, si las bandas que deja Scale.FIT miden
  al menos 88 px CSS cada una, joystick y botones van en una capa DOM (`#touch-bands`) en esas bandas, fuera del
  lienzo: izquierda mover + Activo/Bomba/Poción/Usar, derecha apuntar + Parry/Esquiva (mismas texturas pixel art,
  pasadas a data URL). Pointer Events con captura por dedo (multitouch). Si no caben, el diseño de siempre dentro del
  lienzo. Se recalcula al girar o cambiar el tamaño y la capa se esconde con la escena en pausa. Los poderes se
  siguen lanzando tocando sus ranuras (auto-apuntado igual); teclado, ratón y mando no cambian.
- **Ajustes (solo móvil)**: «Zoom de la sala» y «Tamaño de la interfaz», 100/125/150 % (`pokeisaac.mobileView`). Con
  zoom > 100 % la cámara de la sala se acerca y sigue al jugador con límites en la sala (como en las salas grandes);
  la interfaz agranda letras del HUD (`hudFont`) y botones táctiles (sin salirse de sus franjas). Se aplican al
  empezar la partida o el piso.
- **Archivos**: `src/data/touchLayout.ts` y `src/data/mobileView.ts` (nuevos, puros, con pruebas),
  `src/data/touchPad.ts`, `src/ui/touchControls.ts`, `src/ui/uiScale.ts`, `src/scenes/GameScene.ts`,
  `src/scenes/SettingsScene.ts`, `tests/touchLayout.test.ts`, `tests/mobileView.test.ts`, `tests/touchPad.test.ts`,
  `tests/uiScale.test.ts`.
- **A probar en un móvil real**: tamaño de los botones en las bandas, que el zoom 150 % no deje fuera de vista
  enemigos importantes y cómo quedan los textos del HUD al 150 %. En la VM solo `tsc` y `npm test`.

## 01/11/2026 — Auditoría y firmas de todos los ataques y fusiones (rama `ataques`)

- **Inventario**: `docs/AUDITORIA_ATAQUES.md` (tabla de los 120 estilos del jugador, los 28 grupos repetitivos que
  había, las 14 combinaciones de fusión y las 171 parejas). 105 de 120 ataques compartían patrón y rasgos con otro
  y solo cambiaba el color o el nombre (las 13 embestidas, los 7 rayos fijos, las 6 ondas de suelo…).
- **Firmas nuevas** (`src/data/moveSignatures.ts` + `src/ui/art/moveFx2.ts`): 24 motivos pixel art 7×7 propios
  (llamas, burbujas, plumas, engranajes, notas, luna…) colocados según la forma (cono, línea, anillo, caída, remolino,
  fila, saltos, brote, estela) y un tono de sonido por motivo. Ningún par de ataques comparte forma + rasgos + motivo.
  Cada combinación de fusión tiene también su motivo de arranque. Rendimiento: un Graphics por firma, máx. 5 a la
  vez y 8 motivos por firma; con «Reducir efectos» no se dibujan.
- **Test** `tests/attackAudit.test.ts`: datos válidos (sin undefined/NaN, rangos), sin ids duplicados ni huérfanos
  (FAMOUS_IDS, excepciones de motivo, combinaciones), textos en español y que no vuelvan los repetidos. No había datos
  rotos que arreglar.
- **Consola** (admin/dev): `__POKEISAAC_DEBUG__.listStyles(tipo)`, `.castStyle(tipo, estilo)`, `.castFusion(tipoA, tipoB)`.
- **Cableado mínimo** en `GameScene.castSlot` (firma + tono) y en `installDebug`; `fusionCast.ts` lanza la firma de la combinación.
- **A probar en navegador**: legibilidad de los motivos en móvil y que no tapen proyectiles enemigos.
## Jefes frenéticos: cascadas y combos retardados (rama `frenesi`, 2026-11-01)

- **Qué**: inspirado en la Radiance de Hollow Knight y en los combos de Elden Ring. Mezcla elegida: en la fase 1 los
  jefes lanzan **cascadas** (10-14 rayos/franjas que se encienden uno detrás de otro, 80-150 ms entre uno y otro, cada
  uno con su aviso fino que se enciende y parpadea antes de quemar); en la fase 2, cascadas más densas y rápidas y
  además **combos retardados** (3-5 golpes: embestida, onda con hueco y zona amplia, con pausas variables y amagos en
  los que el aviso se queda encendido más tiempo; el aviso nunca se acorta, solo se alarga).
- **Formas de cascada** (según tipo del jefe y bioma, sin repetir la última): columnas, franjas, diagonal, corona de
  rayos desde el jefe, espiral de dos brazos y pinzas desde los lados. Órdenes: barrido, ida y vuelta, aleatorio,
  pinzas (de fuera adentro) y giro.
- **Justo**: siempre queda un pasillo seguro de al menos 48 px (en salas pequeñas se dejan más huecos libres), aviso
  mínimo de 750 ms (= TELEGRAPH_MS; más bajo que BLITZ_MIN_WARN porque la oleada se ve venir línea a línea), grosor
  mínimo de 20 px con contorno oscuro (legible en móvil), sin ráfagas apuntadas encima mientras dura. Fácil: menos
  líneas, más lentas, 950 ms de aviso, combos de 3 golpes con menos amagos y frenesí menos a menudo; Difícil al revés.
  Con pocos efectos se quitan capas y destellos, no el aviso.
- **Ritmo**: 35 % de los ataques del jefe son frenéticos en fase 1 y 50 % en fase 2; `attackInterval(2)` baja de 1500
  a 1300 ms.
- **Rendimiento**: un solo Graphics y un temporizador por ataque (repintado cada ~16 ms), como mucho 14 líneas.
- **Archivos**: `src/data/bossFrenzy.ts` (nuevo, puro), `tests/bossFrenzy.test.ts`, `src/ui/art/frenzyFx.ts`,
  `src/scenes/frenzyRuntime.ts` (nuevos), `src/data/bossPatterns.ts`, `src/data/bossPath.ts` y cableado mínimo en
  `src/scenes/GameScene.ts` (`bossFrenzy`, `debugFrenzy`).
- **Probar desde la consola**: `__POKEISAAC_DEBUG__.spawnBoss()` y luego `__POKEISAAC_DEBUG__.frenzy('cascade', 'sweepH')`
  (formas: sweepH, sweepV, diagonal, radial, spiral, pincer) o `__POKEISAAC_DEBUG__.frenzy('feintCombo')`.
  En la VM solo `tsc` y `npm test`; falta verlo en el navegador (legibilidad en móvil y sensación de dificultad).

## Cascadas mezcladas: líneas y anillos en la misma ráfaga (rama `mixta`, 2026-11-01)

- **Qué**: nuevas formas `mixed` («Tormenta cruzada») y `mixedRing` («Tormenta de anillos»). Una misma ráfaga mezcla
  columnas, filas y diagonales (siempre de pared a pared) y anillos que se abren o se cierran desde el jefe o desde
  puntos al azar y recorren la sala entera. 10-14 elementos, uno tras otro (80-150 ms), cada uno con su aviso
  (≥750 ms; 950 en Fácil). `mixed`: 2-3 anillos y los tres tipos de línea; `mixedRing`: 4-5 anillos y dos tipos de línea.
- **Justo**: primero se elige un disco seguro común (radio 32, diámetro 64 ≥ 48) dentro de la sala y, si se puede,
  lejos del jefe; ninguna línea lo cruza y cada anillo deja un arco libre apuntando a él (marcado con postes blancos).
- **Frecuencia**: `cascadeShapesFor` añade las mezcladas repetidas: son más de la mitad de las opciones para todos los
  tipos; las simples siguen saliendo, menos. `pickShape` deja repetir una mezclada (cada ráfaga es distinta).
- **Dibujo**: anillos en el mismo Graphics de la cascada, como polilínea recortada a la sala (máx. 360 puntos), grosor
  mínimo 20 px con contorno oscuro; aviso = círculo tenue de salida que se enciende y parpadea. Con pocos efectos se
  quitan el barrido de anticipación, los postes y la capa clara, no el aviso.
- **Tests**: `tests/bossFrenzy.test.ts` (salas 1200x800, 480x360 y 2160x660: tipos, nº, tiempos, pared a pared y
  hueco libre en todo momento, también con el radio de cada instante).
- **Probar**: `__POKEISAAC_DEBUG__.spawnBoss()` y `__POKEISAAC_DEBUG__.frenzy('cascade', 'mixed')` o `'mixedRing'`.
  Falta verlo en el navegador (legibilidad en móvil y dificultad).

## Modo automático en móvil y minimapa más grande (2026-11-01)

- **Qué**: solo en móvil (`touchOnlyDevice()`; teclado, ratón y mando no cambian) hay «Modo automático» con tres
  valores en Ajustes: Desactivado / Solo disparo / Completo (por defecto, Completo). Se guarda en localStorage
  (`pokeisaac.autoMode`, con try/catch). Solo disparo: dispara solo al enemigo más cercano a tiro (900 px) con el
  auto-apuntado de `touchAim.ts`. Completo: además lanza los poderes listos cuando hay un enemigo a 620 px o menos
  (misma recarga que a mano, uno cada 450 ms como mínimo; tocar la ranura sigue funcionando) y mueve al personaje.
  Si tocas el joystick de moverse o el de apuntar, manda el tuyo mientras lo uses.
- **IA de movimiento** (`src/data/autoMove.ts`, pura): prueba 16 direcciones (y quedarse quieto) simulando 0,6 s y
  puntúa proyectiles enemigos (posición prevista y su trayectoria), zonas de peligro de los jefes (líneas, anillos con
  su hueco, embestidas, ondas y zonas del combo, desde el aviso: `frenzyHazards()` en `frenzyRuntime.ts`), distancia a
  cuerpo a cuerpo (210 px) y tiradores (150 px), paredes y obstáculos (`freeAt`), objetos y monedas a menos de 360 px
  (no los poderes ni los activos, que piden elegir) e inercia para no temblar.
- **HUD**: botón pequeño pixel art (marco y luz verde/gris) en la franja de arriba a la derecha, fuera de la barra
  del jefe: indica el modo y lo apaga/enciende al tocarlo (vuelve al último modo encendido). No hace nacer joysticks.
- **Minimapa en móvil**: ×1,6 (escala 2,4 en vez de 1,5), con píxel entero (sin medios píxeles: casillas y puertas
  nítidas), lo que quepa en la franja derecha y como mucho 380 px de alto (`MOBILE_MAP` en `mobileView.ts`), así que
  no llega a Parry/Esquiva ni a las ranuras. Tocarlo dice qué sala es (`minimapRoomAt` + `ROOM_LABEL`, 1,6 s) y no
  hace nacer el joystick de apuntar. En bandas laterales los botones van fuera del lienzo y no cambia nada.
- **Archivos**: `src/data/autoMode.ts` y `src/data/autoMove.ts` (nuevos, puros), `src/data/mobileView.ts`,
  `src/scenes/GameScene.ts`, `src/scenes/frenzyRuntime.ts` (solo el registro de zonas de peligro; no cambia cómo
  golpean), `src/scenes/minimap.ts` (`maxH` y `crisp` opcionales), `src/scenes/SettingsScene.ts`; tests
  `tests/autoMode.test.ts` y `tests/autoMove.test.ts`.
- **Probar**: en móvil (o DevTools con emulación táctil), Ajustes > Modo automático. Consola:
  `__POKEISAAC_DEBUG__.autoMode()` (estado), `autoMode('off'|'shoot'|'full')`, `autoState()` (dirección de la IA y
  zonas de peligro activas); con `spawnBoss()` y `frenzy('cascade', 'mixed')` se ve cómo esquiva las líneas.
- **Dudas para Roberto**: los números (alcances, distancias, pesos) son a ojo; están arriba de los dos módulos. Los
  ataques de jefe que no son de frenesí (ondas de choque, etc.) solo se esquivan por sus proyectiles.

## Móvil: Controles sin solapes y ajustes de vista en el acto (2026-11-01)

- **Controles** (`ControlsScene.layoutRows`): la tabla se coloca con la medida real de los textos. La ayuda de abajo
  queda a 16 px del borde del panel; el paso de fila sale de lo que queda (`rowStep`), la letra de las etiquetas
  baja si la fila no da (`fontForStep`) y las columnas se reparten según la etiqueta y la descripción más largas
  (`splitColumns`, en `src/data/columns.ts`, puro). Cada etiqueta se encaja con `fitTextLine` en su columna y cada
  descripción (`GlyphText.setFit`, nuevo: ancho y alto máximos) se encoge si no cabe. Se recalcula al cambiar de
  pestaña, de Partida ⇄ Defensa de torres o de dispositivo. Vale para Teclado, Ratón, Mando y Táctil.
- **Otras tablas**: Pausa (estadísticas: nombre 132 px y valor 93 px con `fitTextLine`), Sinergias (nombre e info de
  cada fila dentro de la lista) y Ajustes (texto de fila sin pisar la flecha) se encogen con `shrinkTo` si no caben.
- **Zoom de la sala / Tamaño de la interfaz**: Ajustes emite `mobile-view-changed` (`MOBILE_VIEW_CHANGED`) en
  `game.events`; la partida lo escucha (se quita en SHUTDOWN) y llama a `applyMobileView()`: zoom, viewport,
  seguimiento y límites de la sala actual (o centrada si es fija), letras del HUD reescaladas desde su base
  (`hudRescaledPx`, sin deriva al ir y volver), minimapa redibujado y botones táctiles rehechos al reanudar (con la
  partida en pausa su capa DOM quedaría encima del menú). El estado de la partida no se toca.
- **Probar**: móvil o DevTools con emulación táctil en horizontal. Pausa > Controles: ninguna fila se pisa. Pausa >
  Ajustes > Zoom de la sala / Tamaño de la interfaz: la sala cambia detrás al momento; al volver a la partida los
  botones tienen el tamaño nuevo y se pueden tocar. Consola: `__POKEISAAC_DEBUG__.mobileView()` (aplica lo guardado y
  dice el estado) y `mobileView(150, 125)` (guarda y aplica).
- **Tests**: `tests/columns.test.ts`.

## Mega Piedra: altar siempre en su sitio y la piedra baja al vencer al guardián (2026-11-02)

- **Fallo**: en la guarida del guardián no se ponía el altar (solo salía el jefe) y, al caer, la piedra se soltaba
  como objeto del suelo donde moría (`spawnPickup`), con su disco de arena y sin altar.
- **Ahora**: la sala tiene SIEMPRE el altar (`placeMegaAltar`). Estado puro en `src/level/megaAltar.ts`
  (`megaAltarMode`): `guarded` (guardián vivo, engaste vacío y runas que laten, «Vence a su guardián»), `stone` (la
  piedra flota sobre el altar) y `off` (apagado: «Ya la llevas» o «Vacío»). Al caer el guardián se apunta
  `megaGuardianBeatenKey(sala)` en `eventsDone` y la piedra **desciende**: haz de luz que baja del techo, la piedra cae
  y se posa con destello (`megaDescentFrame`, pixel art en `buildMegaShrine`), sonidos `evolve` y `levelup`. Se coge
  del altar con Enter / A / clic / toque o pisándola (solo cuando ya se ha posado). Si ya la llevabas, cae un objeto
  como antes y el altar se apaga. Ya no hay piedra suelta en el suelo.
- **Guardar/cargar**: no cambia RunSave; las dos marcas van en `eventsDone`. Guardián vivo → altar vacío y vuelve el
  guardián; vencido sin coger → la piedra está sobre el altar al entrar; cogida → apagado. La reserva sin enemigos y
  la Torre marcan «vencido» al poner el altar, así la piedra está ya encima.
- **Probar** (consola): `__POKEISAAC_DEBUG__.megaRoom()` (te lleva a la sala), `weakGuardian()` (guardián a 1 PS),
  `megaAltar()` (estado). Sal y vuelve a entrar, o recarga la partida, en cada estado.
- **Tests**: `tests/megaAltar.test.ts`.

## 02/11 · Tormentas de cascadas y fase 2 agresiva

- **Problema** (Roberto): las ráfagas de los jefes salían poco y duraban poco; muy fáciles de esquivar.
- **Tormenta** (`storm`, «Tormenta»; `stormSpec`/`stormPlan` en `src/data/bossFrenzy.ts`): 3-5 cascadas (al menos una
  mezclada y las simples distintas) que arrancan cada 600-900 ms y se SOLAPAN; cada una es una corriente de tandas de
  su forma hasta el final. Dura 6-10 s en fase 1 y 9-14 s en fase 2, con rampa (empieza con ~45 % de elementos y acaba
  densa). Aviso ≥ 750 ms (950 en Fácil). Tope de 40 elementos vivos (26 con lowFx); un solo Graphics (`runCascade`).
- **Camino seguro**: `stormPath` crea un pasillo (radio 30) que sale de donde estás y se desplaza suave (smoothstep) a
  ≤ 60 % de tu velocidad. Se pasa como hueco común a `cascadePlan` (nuevo parámetro `safe`) y lo que aún lo tocaría se
  quita (líneas) o se reorienta su arco libre (anillos). Tests en `tests/bossStorm.test.ts`: ningún elemento activo
  cubre el pasillo en ningún instante (salas 1200x800, 480x360, 2160x660; tres dificultades; fases 1 y 2).
- **Frecuencia**: frenesí 60 % en fase 1 y 80 % en fase 2 (Fácil ×0,6, Difícil ×1,2 hasta 95 %), la mitad
  tormentas; tras un frenesí solo `frenzyRest` (200-450 ms) hasta el siguiente. Las ráfagas apuntadas esperan.
- **Fase 2 agresiva** (todos los jefes, desde la mitad de vida): `PHASE2_SPEED` 1,3 → 1,55, `attackInterval(2)`
  1300 → 850, `volleyEvery(2)` 900 → 600, `volleyShots(2)` 5 → 7. Nuevo frenesí **Acoso** (`chase`, solo fase 2;
  `chaseSpec`, `creepStep`, `homingStep`, `closingRadius`; `runChase` en `frenzyRuntime.ts`): zonas que se arrastran
  hacia ti más lentas que tú y estallan en área dejando charcos que duran 2,5-4 s, orbes teledirigidos con giro
  limitado y vida corta, y anillos que se cierran sobre ti con hueco. Todo con aviso, tope de objetos (28, 16 con
  lowFx) y Fácil más suave. Tests en `tests/bossChase.test.ts`.
- **Probar** (consola, con `spawnBoss()`): `__POKEISAAC_DEBUG__.frenzy('storm')`, `frenzy('chase')`; el modo
  automático móvil esquiva ambos con `frenzyHazards()` (`autoState().hazards`).
## Flechas guía al jefe y a la trampilla, y objetos en el minimapa (rama `flechas`, 2026-11-02)

- **Flechas guía**: en todos los modos de GameScene (Normal, Oleadas, Infinito, Rush de jefes, Torre; Diario y código
  son Normal con semilla; la Defensa de torres va en su escena y no las tiene) salen en el borde de la vista dos
  flechas de pixel art propio: **roja con calavera coronada** hacia el jefe y **verde con escalera y flecha abajo**
  hacia la trampilla. Si el objetivo está en otra sala apuntan a la puerta que hay que cruzar (camino más corto por
  salas que ya se ven en el minimapa, sin pasar por puertas ocultas sin abrir; las salas grandes cuentan como una) y
  dicen cuántas salas faltan; en la misma sala apuntan al jefe o a la trampilla, y se esconden en cuanto se ven en
  pantalla. La del jefe no sale si su sala aún no se ve en el mapa y se va al limpiarla; la de la trampilla sale en
  cuanto aparece (en la Torre ya está la flecha dorada junto al jugador y no se duplica). Tamaño con `hudUiScale()`
  (algo mayor en táctil); van dentro de la vista de la sala, así no pisan las bandas ni los botones táctiles. Si
  coinciden en el mismo borde, la segunda se aparta.
- **Ajustes**: fila «Flechas guía: Sí/No» (por defecto Sí), guardada en `pokeisaac.fx` (`FxSettings.guideArrows`)
  con el resto de ajustes de efectos.
- **Minimapa**: las salas vistas llevan marcas pequeñas de 3×3 en la esquina de abajo a la derecha: rombo violeta
  (objeto, poder o activo) y moneda dorada (monedas, llaves, bombas, bayas, pociones); el cofre sigue con su candado.
  Se redibuja solo cuando cambia lo que queda (se comprueba cada 250 ms una firma barata).
- **Código**: lógica pura en `src/data/guideArrows.ts` (`guideModeOn`, `knownRooms`, `roomRoute`, `edgePlacement`,
  `separate`, `roomAtPoint`, `lootMarks`, `distanceLabel`); cableado en GameScene (`guideTick`, `guideTargets`,
  `mapLoot`, `mapHiddenRooms`) y `minimap.ts` (`extras.loot`).
- **Probar** (consola): `__POKEISAAC_DEBUG__.guide()` (qué señalan, si se ven y marcas del minimapa),
  `guide(false)` / `guide(true)` para apagarlas o encenderlas.
- **Tests**: `tests/guideArrows.test.ts` (y `tests/fxSettings.test.ts` con el ajuste nuevo).
## 2026-11-02 · Arceus adaptable y Arceus Supremo
- `src/data/arceus.ts` (tests en `tests/arceus.test.ts`): Multitipo (cambia al tipo que menos daño recibe de tu historial de tipos de ataque, con la tabla de `typeChart.ts`), ataques de jefe del tipo actual (`bossAttacksFor` + blitz + frenesí en el Supremo + invocar), ayudantes solo legendarios/singulares/ultraentes (tope 3, 4 en el Supremo), acompañantes por región y escalado.
- Torre piso 100: el jefe final ya no es un trío/gigante al azar, es **Arceus Supremo** (vida ×6 y daño ×1,5 sobre el jefe del piso, 4 fases del reto final, se adapta cada 7 s y en cada fase; +250 tickets extra al vencerlo).
- Normal, reto final (piso 6): Arceus + 2 legendarios típicos de regiones distintas (barra compartida del trío).
- Si Arceus sale como jefe normal en cualquier modo: misma adaptación (cada 10 s), ataques e invocaciones, sin el escalado supremo.
- Depuración: `__POKEISAAC_DEBUG__.arceus()` lo saca en la sala; `goFloor(100)` en la Torre para el Supremo.
## 2026-11-02 · Jefes sin instakill (tope de umbral)
- Pedido: a los jefes no se les puede bajar de golpe más allá de su siguiente suceso de vida. Un golpe enorme (o bomba, reacción, estado, Casco Dentado, daño guardado de una protección) deja al jefe justo por debajo del umbral pendiente (arena 67 %, megaevolución/fase 2 50 %, caída 34 %; reto final gigante y Arceus Supremo 75/50/25 %), el sobrante se pierde y sale su pausa/animación. Después recibe daño normal hasta el siguiente.
- Seguro: si el suceso no sale (sala sin cuadrícula, grupo de salas, evento suprimido…), a los 3 s de estar retenido (sin contar mientras hay otro suceso en marcha) el umbral se da por consumido. La arena solo cuenta si la sala del jefe tiene cuadrícula. Minijefes, ayudantes y el trío del reto final (barra compartida) no llevan tope.
- Código: `src/data/bossThreshold.ts` (`pendingThresholds`, `nextThreshold`, `clampBossHp`, `trackHold`), tests en `tests/bossThreshold.test.ts`; en GameScene todo el daño a enemigos pasa por `enemyHpAfter`.
- Probar: `__POKEISAAC_DEBUG__.bossBigHit()` (o `bossBigHit(n)`) en la sala del jefe, repetir tras cada animación.
## 2026-11-02 · Fuera las ráfagas circulares y nuevo ataque «Rayos» (rama `rayos`)
- **Quitado**: todo lo circular de los frenéticos de jefe. Las cascadas `radial` (corona de rayos) y `spiral`, la
  `mixedRing` y los anillos que se abrían/cerraban dentro de `mixed` (`Lane.ring`, `ringRadius`, `drawRing*`); los
  anillos que se cerraban del Acoso (`ChaseKind 'ring'`, `closingRadius`) y la onda circular del combo retardado
  (`waveHits`, `drawWave*`). Las listas por tipo/bioma usan solo formas rectas (columnas, filas, diagonales, pinzas) y
  `mixed` mezcla solo líneas, con 3 más (`MIXED_EXTRA`) para seguir siendo densa, siempre con disco seguro libre.
- **Nuevo, «Rayos»** (`lightning`, `lightningSpec`/`lightningPlan` en `bossFrenzy.ts`, `runLightning` en
  `frenzyRuntime.ts`, `drawStrike*` en `frenzyFx.ts`): círculos de 90-130 px marcados en el suelo que se rellenan y
  parpadean (aviso ≥ 750 ms; 1050 en Fácil) y al acabar cae un rayo en zigzag desde arriba con destello y chispazo;
  solo daña dentro del círculo (una vez por rayo). En cascada: 6-10 en fase 1, 11-18 más seguidos en fase 2; una parte
  se recoloca sobre el jugador al sacar su aviso (basta moverse). Tope de círculos vivos para no cubrir nunca más del
  45 % de la sala (35 % en Fácil). Peso alto en `pickFrenzy` (~30 %, sin repetir) en las dos fases.
- **Rayos en otros ataques**: la Tormenta suelta rayos entre las líneas, nunca sobre su pasillo seguro (más seguidos
  en fase 2); el Acoso cambia sus anillos por rayos sobre tu posición; el combo retardado es embestida + rayo + zona.
  Con efectos reducidos: menos capas, sin temblor y menos rayos a la vez en la Tormenta. El modo automático de móvil
  los esquiva como zonas circulares (`frenzyHazards()`).
- **Probar** (consola): `__POKEISAAC_DEBUG__.frenzy('lightning')`, `frenzy('storm')`, `frenzy('chase')`,
  `frenzy('feintCombo')`; `frenzy('cascade', 'mixed')`. Las formas antiguas (`radial`, `spiral`, `mixedRing`) se
  cambian por `diagonal`, `pincer` y `mixed`.
- **Tests**: `tests/bossLightning.test.ts` (nuevo) y `bossFrenzy`/`bossStorm`/`bossChase` actualizados.
## 2026-11-02 · Escudo de jefe al 33 % (rama `escudo`)
- Pedido: a todos los jefes, cuando les queda un 33 % de vida, se les añade un escudo igual a ese 33 % de su vida máxima para que aguanten más. Una sola vez por jefe; no afecta a ayudantes ni minijefes. Fácil 70 %, Normal 100 %, Difícil 130 % del escudo.
- Reutiliza `shieldHp`/`shieldMax` y `absorbShieldHit`: el escudo se come el daño antes que la vida en todas las vías (`hitEnemy` y `enemyHpAfter`: bombas, reacciones, estados, daño guardado). Barra azul en la barra grande del jefe (debajo de la vida), aro de cuadraditos azules que gira mientras dure, aviso «¡Escudo de jefe!», anillos y sonido; al romperse, «¡Escudo roto!».
- Con el tope de umbral: no se concede mientras quede la caída de arena del 34 % (ni con el jefe protegido); sale al acabar la caída o en cuanto la vida ≤ 33 %. El escudo es finito y el tope de 3 s no depende de él: nunca inmortal.
- Código: `src/data/bossShield.ts` (`bossShieldAmount`, `shouldGrantBossShield`, `grantBossShield`), tests en `tests/bossShield.test.ts`.
- Probar: `__POKEISAAC_DEBUG__.bossShield()` en la sala del jefe (lo baja al 33 % y concede el escudo); luego `bossBigHit(200)` para ver cómo lo gasta.
## 2026-11-02 · Sin instakill al trío del reto final (rama `trio`)
- Problema: «le hice instakill a Arceus y sus aliados». El tope de umbral no cubría al trío (barra compartida): un golpe enorme, bomba o fusión mataba a los tres sin pasar por sus fases.
- Ahora (`clampSharedHp`/`finalePending` en `src/data/bossThreshold.ts`, `trioHpCore` en `GameScene`): todas las vías que pasan por `enemyHpAfter` (golpes, bombas, reacciones, estados, daño guardado, espinas, `bossBigHit`) no dejan que la suma baje del 75/50/25 % pendiente; la fase sale con su pausa y animación (`finaleShift`) y luego vuelve a recibir daño. Mientras quede un umbral, ningún miembro cae (se queda a 1 PS, también en `killEnemy`); en la fase 4, daño normal. Seguro de 3 s compartido (umbral consumido, nunca inmortal). El gigante y el Arceus Supremo de la Torre siguen con su tope de fases; el Arceus normal con el de jefe.
- Escudo del 33 %: en el trío es uno solo para la barra (sale cuando la suma baja al 33 %, repartido entre los vivos), no uno por miembro.
- Probar: en el piso del reto final (Normal), `__POKEISAAC_DEBUG__.bossBigHit()` repetido: muestra la barra del trío y la fase (1→2→3→4) y solo en la 4 caen. Tests en `tests/bossThresholdTrio.test.ts`.
## 2026-11-02 · Pantallas anchas en escritorio (rama `ancho`)
- Pedido: aprovechar las franjas vacías a los lados en ventanas más anchas que 16:9 para que el HUD y los menús no vayan tan juntos.
- `src/data/wideLayout.ts` (puro, tests en `tests/wideLayout.test.ts`): ancho lógico = 1080 × aspecto de la ventana, de 1920 a 2592 (2,4:1); más ancho, franjas como antes. Táctil siempre 1920 (sus bandas de botones de `touchLayout.ts` no cambian).
- `src/ui/layout.ts`: `LW`, `OFF`, `COVER_W`, `BAND` son enlaces vivos (`setLogicalWidth`); `fitDesign` usa todo el lienzo, así fondos y `fromLeft/fromRight` llegan a los bordes reales. `src/ui/wideScreen.ts`: ancho inicial y redimensionado en vivo (resize / pantalla completa) con `scale.setGameSize`, recolocando las escenas activas sin reiniciarlas.
- Partida: la sala tiene el mismo tamaño y zoom (no se ve más mapa), centrada; el HUD se pinta con tres cámaras (panel izquierdo al borde izquierdo, centro, panel derecho al borde derecho). Ratón sobre la sala, flechas guía y vuelo de objetos al HUD corregidos con `OFF`. Intros de jefe y piso centradas con fondo a todo lo ancho; la Pausa separa panel y lista (hasta 90 u.).
- Límites: fondos de menú creados antes de un redimensionado no se alargan (se ve el color de fondo) y la separación de la Pausa se calcula al abrirla. Sin probar en navegador desde aquí: probar 1600×900, 2560×1080, 3440×1440 y ventana estrecha con `npm run dev`.
## 2026-11-02 · Tutorial de práctica en cada modo (rama `tutorial`)
- Pedido: un tutorial para gente nueva en cada modo que explique cómo va todo (jefes, transformaciones, parry…), con el jugador muy potenciado, contra Arceus, y que luego todo vuelva a lo normal.
- Modos con tutorial: Normal, Oleadas, Infinito, Rush de jefes y Torre (el Desafío diario y la Partida con código usan el de Normal). La Defensa de torres no: no tiene jefes, parry ni formas, y ya tiene sus consejos propios (`td_*`).
- Cómo se lanza: en la pantalla de modos, botón «Tutorial de …» encima de las tarjetas (T, Y del mando, clic o toque); la primera vez que eliges un modo se pregunta «Jugar el tutorial (recomendado) / Jugar ya». Consola: `__POKEISAAC_DEBUG__.tutorial('tower')`.
- La partida: arena de jefe con Arceus normal (no el Supremo), Charizard con la Mega Piedra, medidor de poder siempre lleno, estadísticas ×3 de daño y ×6 de vida, parry y esquiva casi sin recarga y sin poder caer. 13 pasos en un cartel abajo (moverse, disparar, vida y escudo al 33 %, fases sin instakill, ataques frenéticos, parry y crítico, esquiva, transformaciones, fusiones, flechas/minimapa/trampilla, el modo y el final). Los pasos de acción avanzan al hacerla; el resto con «Continuar» (T, R3, clic o toque); «Saltar» con N, L3, clic o toque. Arceus no cae hasta el último paso.
- Nada se guarda: al empezar, todo el guardado pasa a una copia en memoria (`enterSandbox`) y al cerrar la escena se tira (`leaveSandbox`); solo se apunta el modo en `pokeisaac.tutorial` (`practice`). Los invitados, en memoria como siempre.
- Código: `src/data/bossTutorial.ts` (pasos, avance, bonos, sandbox) con `tests/bossTutorial.test.ts`; cartel en `src/scenes/tutorialPanel.ts`; enganches pequeños en `GameScene` y el botón en `ModeScene`.
## 2026-11-02 · Créditos, aviso legal y privacidad para la beta pública (rama `legal`)
- Pedido: dejar el juego listo para publicarlo gratis con la parte legal y de transparencia.
- Pantalla `Legal` (`src/scenes/LegalScene.ts`, registrada en `main.ts`) con dos pestañas, «Créditos y aviso legal» y «Privacidad». Se abre desde el menú principal («Créditos y legal», última fila). Desplazamiento: ↑↓/W S o cruceta/palo, rueda, flechas ▲▼ y Enter/A (página); pestañas con ←→, LB/RB o clic; atrás con Esc/B/«Volver».
- Contenido en `src/data/legal.ts` (puro) con `tests/legal.test.ts`. Páginas estáticas `public/aviso-legal.html` y `public/privacidad.html` generadas con `node scripts/genLegal.ts` (el test falla si se desincronizan). Enlazadas desde README → «Legal»; los enlaces son relativos, valen con `base: './'`.
- Verificado en código: Firebase Auth (correo+contraseña y Google) y un documento `users/{uid}` en Firestore con `data` (claves `pokeisaac.*`), `name` y `updatedAt` (`src/net/cloud.ts`, `firestore.rules`). Invitados: solo memoria. Sí existe «Borrar cuenta» (AccountScene → `deleteAccount`: borra el documento y la cuenta, doble confirmación). Sin analíticas ni anuncios (grep). Las únicas peticiones externas son PokeAPI y raw.githubusercontent.com (sprites PokeAPI y PMDCollab).
- Dudas y pendientes (no inventadas, solo lo verificado está en los créditos):
  - Audio: no hay archivos (Web Audio sintetizado, según README); los gritos vienen de PokeAPI (material de Nintendo/Game Freak, igual que sus sprites).
  - `public/fonts/PokeIsaacDigits.ttf`: no consta su origen ni licencia (README dice «hechos para el juego»; confirmar que son propios). No se acredita.
  - Pixelify Sans: falta `public/fonts/OFL.txt` (la OFL pide distribuirla con la fuente); ya estaba anotado en docs/DESARROLLO.md. Descargar de google/fonts.
  - PMDCollab: README ya dice CC BY-NC 4.0; no pude comprobar el repositorio desde aquí. El juego remite a su lista de créditos (en el repo de SpriteCollab) en vez de copiarla; valorar copiar los nombres de los autores de los sprites usados. Revisar también si CC BY-NC es compatible con subir el juego a plataformas con monetización.
  - Responsable del tratamiento RGPD: los textos no nombran a nadie ni dan correo (a petición). El RGPD pide identificar a quien trata los datos y un canal de contacto privado; las incidencias de GitHub son públicas y no sirven para pedir acceso a datos personales con garantías. Decidir un canal (correo dedicado, formulario) antes de abrir las cuentas al público.
  - Edad mínima/menores: no se dice nada; decidir si se pone aviso.
  - Probar en navegador (no hay vite aquí): fila nueva del menú (8 filas, cabe sobre la franja inferior), texto de la pantalla Legal y máscara de desplazamiento, ancho 2,4:1.
## 2026-11-02 · Paneles del HUD más grandes en pantalla ancha (rama `hudancho`)
- Problema: en ventana ancha los paneles laterales seguían a 240 px pegados al borde y entre ellos y la sala quedaba una franja vacía. Roberto eligió «Paneles más grandes».
- `src/data/wideLayout.ts`: `hudBandScale` (s = máx(1, mín(1,6; (banda − 12)/240; alto))) y `hudPanelSlices`: cada panel se parte en tramos (`HUD_LEFT_SEGS`, `HUD_RIGHT_SEGS`); los fijos se pintan enteros a escala s y los recortables (hueco del medio a la izquierda; minimapa + avisos a la derecha, con al menos 480 px visibles) se quedan con el alto sobrante y enseñan su parte de arriba. Mismo zoom en todo el panel (nada se deforma). El panel va pegado a la sala; el margen sobrante queda al borde de la ventana. `screenToHud` pasa pantalla → diseño con la escala (tests en `tests/wideLayout.test.ts`).
- `GameScene.layoutHudCams`: 6 cámaras laterales (hasta 3 tramos por lado) con zoom y `centerOn`; su id va en `hudCam.id` como antes, así el filtrado y los clics de los botones del HUD (pausa, parry, bomba, poción, activo, ranuras, esquiva) los resuelve Phaser con el zoom. 16:9 y táctil: igual que antes (una sola cámara).
- Factor: 1600×900 → 1 (16:9); 1920×950 (lienzo 2182) y más anchas → izquierda 1,46, derecha 1,26 (manda el alto, no el ancho).
- Límites: con 4 avisos largos y un minimapa muy alto, el último aviso puede quedar cortado abajo (la zona de avisos se recorta). `hudSlices`/`screenToHudX` se quedan para el centro y el reparto base. Sin probar en navegador desde aquí: comprobar a 1920×950, 2560×1080 y 3440×1440 que pausa, objetos, activo, minimapa y ranuras se ven y se pulsan.
## 2026-11-02 · HUD ancho sin franjas y contadores sin pisarse (rama `hudfix`)
- Franjas: a 1920×950 quedaban ≈15 px (izq.) y ≈60 px (dcha.) vacíos en el borde exterior. Solución (a)+(b): el mínimo visible de minimapa + avisos baja de 480 a 300 px de diseño (`HUD_RIGHT_SEGS`), así el panel derecho pasa de ×1,26 a lo que da el ancho; y cada panel se centra en su banda (`hudPanelSlices`), con el sobrante repartido igual entre el borde de la ventana y la sala. No se usa relleno (c): no hay un estampado del HUD reutilizable y estirarlo deformaría el pixel art.
- Resultado: 1920×950 (lienzo 2182) izq. ×1,46 (manda el alto: 740 px fijos) margen ≈10 px por lado; dcha. ×1,50 margen 6 px. 2560×1080 y 3440×1440 (lienzo 2560/2580): izq. ×1,46, dcha. ×1,59; manda el alto, el sobrante (≈105 y ≈90 px por lado) queda repartido, no todo fuera. 16:9 y táctil: factor 1, igual que antes. Tests nuevos en `tests/wideLayout.test.ts`.
- Contadores: «120» pisaba la llave (x fijas cada 49 px). `counterRowLayout` (`src/data/hudLayout.ts`, test en `tests/hudLayout.test.ts`) coloca monedas, llaves, bombas y pociones por el ancho medido del texto: se quedan en su sitio de siempre si caben, se corren a la derecha si la cifra anterior es larga, se empujan a la izquierda para no salirse y, si ni así caben (p. ej. 6 cifras de monedas y 3 en el resto), el texto se encoge. `GameScene.layoutCounters` mueve iconos, cifras, zonas de clic de bomba/poción y sus etiquetas; el vuelo de objetos va a la x actual del icono.
- Sin probar en navegador desde aquí: comprobar 1920×950, 2560×1080 y contadores con 120 / 99999 monedas.
## 2026-11-02 · Auditoría de seguridad para la beta (rama `seguridad`)
- Checklist de 34 controles en `docs/SEGURIDAD.md` con evidencia, borrador de CSP (sin activar) y «Prueba de correcciones».
- `firestore.rules`: esquema de `users/{uid}` (solo `data`/`name`/`updatedAt`, tipos, tamaños, hora del servidor) y subcolecciones cerradas. **No desplegado**: `firebase deploy --only firestore:rules`.
- `src/data/safeData.ts` (tests en `tests/safeData.test.ts`): valida el documento de la nube y el progreso de invitado (forma, `__proto__`, límites); si la nube no valida, no se pisa. Nombre de cuenta limpio (≤ 40).
- `auth/user-not-found` ya no revela si el correo existe; `Referrer-Policy` por meta en `index.html` y páginas legales.
- Pendiente de Roberto: desplegar reglas, restringir la apiKey por dominio, protección de enumeración y política de contraseña en Firebase, `npm audit`.
## 2026-11-03 · Móvil apaisado: bandas justas, HUD más grande y dedos que no se quedan pillados (rama `movilbandas`)
- Problema (Roberto, iPhone 14 Pro): en táctil el lienzo se quedaba en 1920 (16:9) y lo que sobraba a los lados eran bandas; con las barras de Safari (≈3,2:1) cada banda medía ≈150 px CSS casi vacía y el HUD salía diminuto. Además, botones difíciles de acertar y controles que «se quedan pillados» tras jugar un rato.
- Cómo se compone (px CSS; caja = ventana visible menos zonas seguras, que `index.html` ya descuenta con `env(safe-area-inset-*)` y `viewport-fit=cover`): con la pantalla más ancha que 16:9 el lienzo llena el ALTO, así que la sala mide siempre 1440/1080 × alto y no puede crecer sin rehacer el HUD de arriba/abajo. Lo que sí se gana es el HUD.
- Cambio: `touchLogicalWidth` (`src/data/touchLayout.ts`): si a 16:9 ya hay bandas (≥ 88 px), cada banda se queda con lo justo para los botones (`touchBandNeed` = 116 px × «Tamaño de la interfaz», dos columnas de ≈ 49 px y el joystick) y el resto lo gana el lienzo (ancho lógico hasta 3:1, `TOUCH_MAX_W` = 3240); los paneles del HUD crecen con `hudBandScale`/`hudPanelSlices` como en escritorio, centrados en su banda y sin pisar la sala. Si no hay bandas (modo «lienzo»: iPhone sin barras, tablets, 16:9) no cambia nada. `ui/wideScreen.ts` ahora también actúa en táctil y recalcula con resize, `orientationchange`, `visualViewport` (barras de Safari/Chrome) y al cambiar «Tamaño de la interfaz». Panel derecho en táctil con `HUD_RIGHT_SEGS_TOUCH` (zona del minimapa grande de móvil, 396 px, siempre entera). `touchControls` mide el modo con `LW`.
- Resultados (banda / HUD lateral / sala, px CSS; escala de paneles izq./dcha.):

| Dispositivo | Caja | Modo | Antes | LW | Después | Paneles |
|---|---|---|---|---|---|---|
| iPhone SE | 667×375 (1,78) | lienzo | 0 / 83 / 500 | 1920 | igual | ×1 |
| iPhone 14 | 750×369 (2,03) | lienzo | 47 / 82 / 492 | 1920 | igual | ×1 |
| iPhone 14 Pro | 734×372 (1,97) | lienzo | 36 / 83 / 496 | 1920 | igual | ×1 |
| 14 Pro Safari con barras | 667×206 (3,24) | bandas | 150 / 46 / 275 | 2280 | 116 / 80 / 275 | ×1,46 / ×1,38 |
| 14 Pro Safari (captura partida) | 667×258 (2,59) | bandas | 104 / 57 / 344 | 1920 | igual | ×1 |
| 14 Pro Max | 814×409 (1,99) | lienzo | 43 / 91 / 545 | 1920 | igual | ×1 |
| Pixel 7 | 915×412 (2,22) | bandas | 91 / 92 / 549 | 1920 | igual | ×1 |
| Pixel 7 con barra de Chrome | 915×356 (2,57) | bandas | 141 / 79 / 475 | 2072 | 116 / 104 / 475 | ×1,27 |
| Galaxy S23 | 780×360 (2,17) | lienzo | 70 / 80 / 480 | 1920 | igual | ×1 |
| Galaxy Z Fold plegado | 882×344 (2,56) | bandas | 135 / 76 / 459 | 2040 | 116 / 96 / 459 | ×1,20 |
| Galaxy Z Fold abierto | 884×768 (1,15) | lienzo | 0 / 111 / 663 | 1920 | igual | ×1 |
| iPad mini | 1133×744 (1,52) | lienzo | 0 / 142 / 850 | 1920 | igual | ×1 |
| iPad Pro 12,9 | 1366×1024 (1,33) | lienzo | 0 / 171 / 1025 | 1920 | igual | ×1 |
| Extremo 3,5:1 | 840×240 | bandas | 207 / 53 / 320 | 2736 | 116 / 144 / 320 | ×1,46 / ×1,38 |

  La sala nunca baja (en ningún caso crece: manda el alto). Tests en `tests/touchWide.test.ts` (tabla de dispositivos × interfaz 100/125/150 %: nada fuera, sala ≥ antes, botones dentro de la banda y sin solapes, zona de toque ≥ 48 px, HUD sin pisar la sala, minimapa entero).
- Botones: zona de toque de las bandas `touchHitR` = máx(lado/2 + 10, 28) px (≥ 56 de diámetro, antes 22 de radio) y dentro del lienzo mínimo 28 px CSS; al pulsar uno de banda se encoge y brilla 140 ms. Aros del joystick con relleno translúcido y punto central.
- Dedos pillados: `src/data/touchPointers.ts` (`stepPointer`: down/move/up/cancel/blur; `shouldRelease`), tests en `tests/touchPointers.test.ts`. Un dedo nuevo se queda el stick si el anterior lleva 1,5 s sin dar señales (se perdió su «up»); en el lienzo, cada fotograma se suelta el stick cuyo puntero Phaser ya no está pulsado; `blur`, `pagehide`, `visibilitychange`, pausa/dormir y cerrar la escena sueltan todo. Teclado, ratón y mando no se tocan.
- Límites conocidos: (1) a ≈2,0–2,2:1 con notch (iPhone sin barras, Galaxy S) quedan franjas de 36–70 px por lado y el HUD sigue a ×1: ensanchar ahí obligaría a escalar los paneles con los botones táctiles del lienzo dentro (sus filas caen en el tramo recortable del panel izquierdo) y a pasar los toques por `screenToHud`; queda pendiente. (2) La captura de partida de Roberto (≈2,6:1 con barras, banda 104 < 116) no gana: lo que más ayuda es esconder las barras (pantalla completa no existe en iPhone; «Añadir a pantalla de inicio»). (3) Con interfaz 150 % y alto < 300 px los botones dibujados bajan de 44 px (la zona de toque sigue ≥ 56). (4) Aviso inferior de formas y barra del jefe: sin cambiar (no se agrandaron). (5) Vertical: ya existe el aviso `#rotate` de `index.html`. (6) Nada probado en dispositivo real ni en navegador (sin vite aquí): probar iPhone con y sin barras, Android, Fold, iPad, girar y cambiar «Tamaño de la interfaz» en partida.
- Aclaración de Roberto («que no haya ninguna barra extra»): cada zona táctil de banda ocupa ahora todo el alto de la ventana y llega hasta el borde, incluida la zona segura (notch/isla, barra de gestos) como área de toque; botones y aros se dibujan solo dentro de la banda útil. Cualquier toque fuera de un botón coloca el joystick flotante donde se apoya el dedo. El fondo de las bandas es transparente sobre el fondo de la página (#172036); si el fondo del HUD difiere se notará el cambio de color en la juntura: comprobar en dispositivo.
## 2026-11-03 · HUD táctil legible a ≈2,0–2,2:1 sin bandas (rama `movilhud`)
- Problema (límite 1 de `movilbandas`): en móviles con notch a ≈2,0–2,2:1 (iPhone sin barras, Galaxy S) la banda a 16:9 es menor de 88 px CSS, el lienzo se quedaba en 1920 con franjas muertas de 36–78 px y el HUD a ×1.
- Diseño elegido (análisis de las 18 cajas × 100/125/150 % en `tests/touchWide.test.ts`): si `touchLogicalWidth` deja 1920 **y** a 1920 ya se jugaba en modo «lienzo», `touchWideWidth` (`src/data/touchLayout.ts`) ensancha el lienzo a todo el ancho (sin bandas) y los controles siguen dentro del lienzo. El panel izquierdo crece con tramos que dejan enteras las filas de botones (`HUD_LEFT_SEGS_TOUCH_CANVAS`: 0..600 y 828..1080 fijos, 600..828 recortable); el derecho va entero a ×1 (`HUD_RIGHT_SEGS_TOUCH_CANVAS`) porque minimapa de móvil + 2 avisos + Parry/Esquiva + ranuras ocupan los 1080: escalarlo cortaría avisos. Solo si el panel gana ≥ ×1,1.
- Descartado: bajar el mínimo de banda (a 667×258 con banda 96–100 los botones DOM bajan de 44 px; con 104, que es lo actual, ya dan 43) y pasar a lienzo cajas que hoy tienen bandas (Pixel 7, Safari con barras, Fold plegado): los botones del lienzo quedarían de 23–37 px CSS. Esas cajas quedan igual.
- Controles: con el HUD escalado van en su propia capa y cámara sin zoom (`GameScene.touchLayer/touchCam`, `applyTouchView`): botones colocados con `hudToScreen` (zoom de su panel, nunca más pequeños) y toques pasados al diseño con `screenToHud` (zonas reservadas, minimapa con `hudPoint`). Sin escalar, vuelven a la capa del HUD y todo es como antes (vista nula = identidad).
- Menús: `MENU_BAND` (`ui/layout.ts`) se queda en la de 1920 con el lienzo táctil ensanchado, así la Pausa no separa sus columnas; el resto de menús ya va centrado (mismo sitio y tamaño, test). Interruptor: `TOUCH_HUD_SCALE_ENABLED` en `touchLayout.ts` (false = todo como antes; test).
- Antes → después (px CSS; lienzo lógico; panel izquierdo; letra de 14 del panel izquierdo). Igual a 100/125/150 %:

| Caja | Antes | Después |
|---|---|---|
| iPhone 14 750×369 | 1920, franja 47, panel ×1, letra 4,8 | 2194, franja 0, ×1,27, letra 6,1 |
| iPhone 14 Pro 734×372 | 1920, franja 36, ×1, 4,8 | 2130, franja 0, ×1,27, 6,1 |
| iPhone 14 Pro Max 814×409 | 1920, franja 43, ×1, 5,3 | 2148, franja 0, ×1,27, 6,7 |
| Galaxy S23 780×360 | 1920, franja 70, ×1, 4,7 | 2340, franja 0, ×1,27, 5,9 |
| 2,17:1 868×400 | 1920, franja 78, ×1, 5,2 | 2342, franja 0, ×1,27, 6,6 |
| 14 Pro Safari 667×258, Pixel 7, resto | — | igual (test) |

  Sala igual en todas (manda el alto). Botones izquierdos del lienzo ×1,27 (p. ej. 33 → 42 px CSS en el 14 Pro); Parry/Esquiva y ranuras igual.
- Tests nuevos en `tests/touchWide.test.ts`: interruptor apagado = antes; cajas sin mejora idénticas; sala igual; sin franjas; menús en su sitio; paneles dentro y sin pisar la sala; nada con contenido recortado; letra ≥ ×1,25; botones visibles, dentro de su tramo, sin solapes, no más pequeños, zona ≥ 56 px CSS; pausa, barra de parry, bomba, poción, activo, 4 ranuras y los 6 botones vuelven a su punto con `screenToHud(hudToScreen(p))`; casos 734×372 y 667×258.
- No verificado (sin vite ni dispositivo): que Phaser resuelva los clics de pausa/ranuras/activo con la cámara táctil encima (no tiene objetos interactivos y se salta en el hit test), el orden de pintado (los controles quedan encima de todo el HUD, también del cartel del tutorial), el cambio en vivo al girar o enseñar barras, y la nitidez con zoom ×1,27 no entero. La letra sigue siendo pequeña (≈6 px CSS): el alto manda; el panel derecho (movimientos) no crece. Probar en iPhone 14 Pro sin barras, Galaxy S y Pixel 7 (debe seguir igual).

## 2026-11-03 · Defensa de torres más retadora: mapas que cambian, enemigos con trucos, sinergias y decisiones en vivo (rama `tdreto`)
Motivo: el modo seguía siendo aburrido (sin riesgo, siempre igual, solo mirar y mapas repetidos y sencillos). Lógica pura en
`src/data/towerDefense/` con tests en `tests/tdReto.test.ts`; escena `TowerDefenseScene`; arte nuevo en `src/ui/art/tdRetoArt.ts`.
- **Mapas** (`maps.ts`, `variants.ts`): 4 plantillas nuevas (bucle que se cruza, bifurcación, cuatro entradas, bucle doble con dos
  entradas) y reparto nuevo: ningún mapa repite la plantilla del anterior, ya no hay versiones volteadas del mapa de al lado y los 4
  últimos usan las nuevas. Ids, orden y niveles iguales (guardado intacto, sin subir versión). Cada plantilla tiene un atajo (o camino
  alternativo) y una entrada nueva. `mapForLevel(mapa, nivel)` elige una de 6 variantes (de siempre, atajo abierto, camino que se abre
  a mitad del nivel, ruta cortada, cruce de rutas, asalto total): el nivel 1 siempre es el mapa tal cual, nunca dos niveles seguidos
  con la misma y las complejas salen más en mapas y niveles altos. Además rocas nuevas (0 en el nivel 1, hasta 6) y terreno: Colina
  (+20 % alcance), Cristal (+20 % daño), Lodazal (−20 % cadencia) junto al camino y tramos de Barro (frena 30 %) o Corriente
  (acelera 30 %). La entrada sellada se dibuja con rocas que laten y se abre con temblor y aviso. El menú de niveles resume el mapa.
- **Enemigos con trucos** (`tricks.ts`, `species.ts`, `waves.ts`): Esquivo (esquiva el 40 % de los disparos sueltos; área, cadena,
  especiales o frenarlo/congelarlo lo anulan), Planeador (aéreo, recto de la entrada a la base), Saboteador (avisa 1 s con línea roja y
  aturde 2,6 s la torre más cercana), Divisor (suelta 2 crías; fuga de 2) y Adaptable (resiste ×0,35 el tipo que más daño hizo en la
  oleada anterior; la torre usa su otro tipo si lo tiene). Especies propias por bioma. Cada oleada desde la 2 trae un truco protagonista
  (1 de cada 4) mezclado con lo demás y un consejo al empezar. El escudado sigue siendo barra extra.
- **Sinergias** (`synergy.ts`): vecinas del mismo tipo, Resonancia (+8 % por vecina, máx. 3); 14 combos de tipos (Electroagua +1 salto,
  Incendio +área, Vapor, Glaciar, Sismo, Vendaval, Mente mágica, Sombras, Enjambre, Forja, Plaga, Entrenamiento, Tormenta, Escarcha
  mental). Con las dos al nivel 5+, **Dúo**: efecto doble y sus especiales salen combinados (×1,6 de daño, más área, dos rayos y
  nombre en pantalla). Enlaces de puntos animados entre torres, gema del color del combo y vista previa al colocar.
- **Decisiones en vivo** (`live.ts`): pulsar en el camino abre su panel con Mina (área), Telaraña (frena a 4) y, en el tramo propio de
  una ruta, Barricada (cierra la ruta 2 oleadas, nunca la última abierta). Botón Mover (8 % de lo gastado en la preparación, 20 % y
  2 s aturdida en plena oleada) y vender en plena oleada da el 50 % en vez del 70 %. Teclas 1-5, cruceta + A, clic o toque; ayuda
  nueva para «camino» y «moviendo» y textos de Controles y «Cómo se juega» al día.
- Simulación del bot (mismo equipo, `_sim/`): los mapas medios pierden más vida que antes (p. ej. Gruta nv. 5: 15 → 9 de 20; Cantera
  nv. 11: 10 → 5) y siguen ganables; los tests de equilibrio pasan. El bot no usa trampas, barricadas ni mover.
- Tests: `tdReto.test.ts` (validez de todas las variantes, distintas por nivel, rutas que se abren, barricadas, terreno, trucos,
  sinergias, trampas, mover y vender) y ajustes en `towerDefense.test.ts`/`tdChiefs.test.ts` (12 plantillas; usar `g.map`).
Sin verificar a ojo (Vite no corre en la VM): que el panel de la torre (5 botones, fila Mover/Vender) y el del camino quepan en su
caja, enlaces y gemas de sinergia, rocas selladas y barricada, minas y telarañas, marcas de los trucos y la línea del saboteador, el
terreno horneado, el texto del menú de niveles y la página nueva de «Cómo se juega»; mando y táctil en el modo mover y en el panel del
camino. El HUD móvil y `layout.ts` no se tocan.

## 2026-11-03 · Defensa de torres: niveles temáticos por tipo (rama `tdtipos`)
Motivo: Roberto quería mapas y niveles enfocados a un tipo («en este nivel vas a potenciar el tipo fantasma, entonces el mapa se
va a enfocar al fantasma»), como los biomas del modo normal. Lógica pura en `src/data/towerDefense/themes.ts` (y `variants.ts`,
`waves.ts`, `engine.ts`) con tests en `tests/tdTipos.test.ts`; arte en `src/ui/art/tdThemeArt.ts`.
- **Tipo tema por nivel** (`MAP_THEMES`, `levelTheme`): cada mapa tiene su tipo (16 distintos) y 1-2 vecinos que rotan en los
  niveles intermedios; el nivel 1, el último y el infinito son del tipo del mapa. Entre los 16 mapas salen los 18 tipos (Normal y
  Psíquico, como vecinos). El último mapa es Dragón (el más duro de cubrir). Ids, orden, niveles y guardados iguales (sin RUN_VERSION).
- **Potenciación** (`themeBoost`): torres del tipo tema +30 % daño y +15 % alcance; las súper eficaces contra él, Ventaja +15 %
  daño. Aviso al empezar arriba a la derecha del mapa («Nivel Fantasma: tus torres Fantasma +30 % de daño y +15 % de alcance» +
  Ventaja y contra-tipos), insignia del tipo junto al nombre del mapa en el HUD, insignia (o flecha verde de Ventaja) en las casillas
  del equipo potenciadas y línea «Tipo tema/Ventaja» en el panel de colocar.
- **Enemigos acordes** (`THEME_FOES`, `themeSpecies`, `foeSource`): 3 de cada 4 huecos son del tipo tema (tierra, voladores y grandes
  según el papel) y 1 del bioma; el jefe de cada 5 oleadas es del tema (2 por tipo, alternos; el legendario sigue siendo el del mapa).
  Estrategia: en la segunda mitad del nivel llegan **contra-tipos** (hasta 3 tipos que resisten el tema, los inmunes primero): 1 de
  cada 4 y todos los grandes, y 2 de cada 4 en el último cuarto, con +25 % de vida. El panel de la oleada cuenta los contra-tipos.
  Los trucos de `tdreto` siguen (el papel manda; solo cambia la especie).
- **Mapa enfocado al tipo**: suelo teñido con marcas del tipo (grietas, escarcha, cenizas, runas, remaches, flores…), las rocas
  nuevas del nivel salen como obstáculos del tipo (lápidas, bloques de hielo, rocas de magma, cristales, cajas de acero, setas…),
  ambiente animado (Fantasma: niebla baja y almas que suben; brasas, copos, burbujas, chispas, luciérnagas, destellos…) y un
  **terreno propio por tipo** con efecto real: Lava y Charco tóxico queman (no a Fuego / Veneno y Acero), Charca, Arenas movedizas y
  Seda frenan, Hierba curativa cura, Hielo acelera, Losas quitan un 25 % de daño, Niebla de almas esconde (no se apunta; el área y
  las cadenas sí dan), Generador y Campo de entreno +cadencia, Tatami, Escamas y Círculo de hadas +daño, Corriente térmica y Círculo
  psíquico +alcance, Penumbra −alcance y Placa de acero evita aturdimientos. 2-3 losas o 1-2 tramos de 3 casillas por nivel (los
  malos, un tramo). Los efectos del terreno van por una tabla (`TERRAIN_FX`); los cinco de `tdreto` siguen igual.
- Menú: insignia pixel art del tipo en cada nivel (arriba a la izquierda) y en cada mapa (sus tipos bajo la miniatura), y línea con
  el tipo y el bonus del nivel elegido. Página nueva «Niveles por tipo» en «Cómo se juega». 18 insignias propias (`bakeTypeIcons`).
- Equilibrio con el bot (mismo equipo de los tests, `_sim/`): los niveles fáciles igual o mejor; Cráter Ígneo (ahora Roca) se pone
  duro para ese equipo (Fuego/Eléctrico/Normal resistidos) y se gana llevando Agua/Roca (test); el mapa final sigue sin pasarse sin
  mejorar. Con 6 torres del tipo tema se gana pero los contra-tipos se notan en las oleadas altas.
- Tests: `tdTipos.test.ts` (los 18 tipos usados, bonus aplicado, enemigos y jefe acordes, contra-tipos que resisten, terreno con
  efecto, bot ganable) y `tdChiefs.test.ts` (el jefe de oleada es el del tema).
Sin verificar a ojo (Vite no corre en la VM): el aviso del tipo (que quepa en su caja con los tipos de muchas Ventajas), la insignia
del HUD entre «Llega en…» y el nombre del mapa, las insignias del equipo, los terrenos y obstáculos nuevos horneados, el ambiente
(almas, niebla, motas), la transparencia de los enemigos en la niebla de almas, las insignias del menú y la línea del tipo bajo la
descripción del nivel. Se cargan más sprites al empezar (los del tema y los contra-tipos). El HUD móvil y `layout.ts` no se tocan.

## 2026-11-03 · Defensa de torres: aviso previo de emparejamiento (rama `tdaviso`)
Motivo: con los niveles temáticos algunos equipos pierden sin saber por qué (p. ej. Fuego/Eléctrico/Normal en Cráter Ígneo, de
tipo Roca, nv. 7 y 13). Roberto quería un aviso antes de empezar. Lógica pura en `src/data/towerDefense/matchupWarning.ts`, tests en
`tests/tdAviso.test.ts`, arte en `src/ui/art/tdWarnArt.ts`.
- **Veredicto** (`matchupWarning`, `matchupForLevel`): Bien / Justo / Arriesgado. Por cada torre se toma su mejor tipo contra cada
  enemigo que de verdad sale (los del tema, `THEME_FOES`, y los contra-tipos, `contraFoes`, que pesan del 10 % al 45 % según el
  nivel) con la tabla real (`tdTypeMul`) y el bonus de tema/Ventaja (`themeBoost`). Puntuación del equipo = mitad media, mitad media de
  su mejor mitad. Umbrales `RISKY_BELOW` 0,95 y `FAIR_BELOW` 1,10, algo más suaves en los niveles 1-6. Motivo: «Tu equipo hace poco
  daño a Roca: Fuego, Eléctrico y Normal.»; sugerencia: «Lleva Agua, Tierra, Planta o Acero.» (los 4 tipos que mejor funcionan, sin
  los que ya llevas). Ese equipo sale Arriesgado en los niveles Roca 7 y 13 de Cráter Ígneo y con Agua y Roca, Bien; el bot lo
  confirma (pierde con el primero y gana con el segundo, test).
- **Pantalla «Elige tu equipo»**: caja de aviso a la izquierda, bajo la ficha de la torre (color, icono pixel art propio de visto,
  rayas o exclamación, título y motivo + sugerencia). Cambia al añadir o quitar torres (ratón, teclado y mando pasan por
  `togglePick`) y con el equipo de prueba. No bloquea: «¡A jugar!» funciona igual. La letra baja hasta que el texto quepa.
- **Lista de niveles**: bajo la línea del tipo, «Lleva Agua, … para el nivel Roca».
- Nota de diseño: un equipo solo del tipo tema puede salir Arriesgado (los enemigos de su mismo tipo lo resisten), como en el juego.
Sin verificar a ojo (Vite no corre en la VM): que la caja del aviso (y su texto con muchos tipos) no pise la ficha de la torre ni la
barra de ayuda, los tres iconos, el color de cada veredicto y la segunda línea en la lista de niveles. El HUD móvil y `layout.ts` no
se tocan.

## 2026-11-03 · Defensa de torres: una fase por tipo, enemigos por probabilidad, oscuros, minijefes y jefes (rama `tdfases`)
Motivo: Roberto corrige el diseño de `tdtipos`: quería una fase de cada uno de los 18 tipos (Normal y Psíquico solo salían de
vecinos), que el tipo tema saliera con más probabilidad como en el modo normal (no «3 de cada 4» fijo), Pokémon oscuros en estos
niveles y que los minijefes fueran pseudolegendarios/ultraentes y los jefes legendarios/singulares. Lógica pura en
`themes.ts`, `waves.ts`, `chiefs.ts`, `maps.ts`, `variants.ts` y `matchupWarning.ts`; tests nuevos en `tests/tdFases.test.ts`.
- **Fases nuevas al final** (ids, orden, niveles y guardados de las 16 de antes intactos; sin migración ni versión nueva): 17.
  **Templo Mental** (Psíquico, vecinos Hada y Siniestro, bioma ciudad, jefe final Mewtwo) y 18. **Sala del Origen** (Normal,
  vecinos Dragón y Fantasma, bioma cumbre, jefe final Arceus), 15 niveles cada una, desbloqueo igual (≥50 % del anterior).
  Dos plantillas nuevas (`LAYOUTS` 12 y 13, con su atajo y su entrada nueva): dos entradas enfrentadas que bajan juntas al centro y
  una serpentina con tres entradas. El tipo, el terreno, el ambiente y la insignia de Psíquico y Normal ya existían de `tdtipos`.
  El menú de mapas pasa a fichas compactas (4 columnas × 5 filas) cuando hay más de 16.
- **Probabilidad, no cuota** (`foeWeights`, `foeSource`, `unitRoll`): cada hueco se sortea con una tirada fija por la semilla del
  nivel (`mapa|nivel|oleada|hueco`): tema 58 %, bioma 27 %, otros tipos 15 % en la primera mitad; en la segunda, 20 % de
  contra-tipos (32 % en el último cuarto, ×1,8 para los grandes). «Otros tipos» = 2 tipos de visita por nivel (`visitorTypes`,
  nunca el tema ni sus contra-tipos). Contra-tipos con +20 % de vida (antes 25 %). Reproducible: misma semilla, mismas oleadas.
- **Oscuros** (`darkChance`, `markDarks`): los decide la oleada (antes una tirada de la partida en el motor): nada antes de la
  mitad del nivel ni de la oleada 4 (infinito: 5), luego sube con la oleada y con la dificultad del mapa; minijefes y jefes algo
  más; ×1,5 en los niveles Siniestro; tope por oleada (1 a 4). El admin puede seguir forzándolos. Ojos rojos de al menos 3 px en
  los sprites pequeños (`eyeSize` en darkMon.ts, opción `eyeMin` de `darkAura`) y un solo aviso de oscuro normal por oleada.
- **Minijefes y jefes** (`chiefs.ts`, `minibossFor`, `levelBossFor`, `bossSpecies`): minijefe cada 5 oleadas = pseudolegendario
  o ultraente (los guardianes del modo normal); jefe legendario o singular en la última oleada de CADA nivel (en el infinito, cada
  10). El del último nivel es el del mapa a plena vida con 4 escoltas; los demás, del tipo tema, con 22-60 % de su vida y 2
  escoltas. Prefieren el tipo tema; si no hay ninguno, uno que le gane (Normal → Lucha); no repiten seguidos y el jefe final no
  sale antes. Ciénaga Turbia cambia su jefe del infinito de Nihilego (ultraente) a Eternatus. Se quitan los jefes de bioma y del
  tema viejos (`CHIEF_SPECIES`, `themeChief`).
- **Menú y avisos**: ficha del nivel con «Minijefes: … · Jefe: … · Oscuros desde la oleada N» (`levelFoesLine`), «N oleadas +
  jefe» en cada nivel; presentación «MINIJEFE · nombre» con «Ultraente/Pseudolegendario», barra «Jefe · nombre». Guía: página
  «Niveles por tipo» al día y nueva «Minijefes, jefes y oscuros». El aviso de equipo (`matchupWarning`) sigue pesando tema y
  contra-tipos (bioma y visitas son neutros de media).
- Equilibrio (bot, equipo de siempre): igual o mejor en casi todo; Cráter Ígneo nv. 7 y Cumbre nv. 14 pasan a ganarse; Lodazal
  nv. 14 es a cara o cruz con las dos versiones (3/7 antes, 4/7 ahora según la semilla). Con los tipos que sugiere el aviso se
  ganan el primer y el último nivel de las 18 fases (test).
Sin verificar a ojo (Vite no corre en la VM): las fichas compactas del menú de mapas (miniatura, textos e insignias en 96 px de
alto), que la ficha del nivel con la línea de minijefes/jefe no pise la barra de ayuda, las dos plantillas nuevas horneadas, la
página nueva de la guía, los ojos de 3 px en los enemigos y la ficha del minijefe. El HUD móvil y `layout.ts` no se tocan.

## 2026-11-06 · Entrada: teclas que no se quedan pilladas y ratón fiable en los menús (rama `entrada`)
Motivo: al probar con gente, «los controles en teclado se quedan pillados» y «el ratón cuesta usarlo en el menú». Igual que
`touchPointers.ts` para el táctil: lógica pura en `src/data/keyHold.ts` y `src/data/menuPointer.ts`, tests en
`tests/entrada.test.ts`, enganche a Phaser en `src/ui/keyGuard.ts` y `src/ui/menuPointer.ts` (los dos se instalan en `main.ts`).
- **Teclado** (`keyHold`, `keyGuard`): estado propio por tecla con los keydown/keyup del navegador (fase de captura). Cada
  fotograma, tras procesar Phaser su cola (`POST_STEP`), se sueltan en TODAS las escenas las teclas que Phaser cree pulsadas y
  el navegador no (`stuckKeys`): arregla las soltadas mientras la escena estaba parada, en una transición o con el teclado
  desactivado. Se suelta todo en blur, focus, `visibilitychange`, `pagehide` y menú contextual del navegador; al soltar Cmd
  (macOS se traga los keyup de las demás); los modificadores se corrigen con el estado real que trae cada evento de teclado o
  ratón (Alt de un Alt+Tab); una tecla física se suelta aunque suba con otro código (IME/teclas muertas, 229). Al reanudar o
  despertar una escena se reinician sus teclas (Phaser ya lo hace al pausar). No se suelta nada por tiempo: mantener W y tocar
  D deja de repetir W y sigue pulsada. El ghosting del teclado (combinaciones que el propio teclado no manda) no tiene arreglo
  por software; para eso están las teclas configurables.
- **Ratón en todos los menús** (`menuPointer`, todas las escenas salvo `Game` y `TowerDefense`, y nunca en táctil): los
  botones (objetos con cursor de mano) aceptan paso y clic en un margen de 6 a 14 px de diseño alrededor de su zona
  (`hitPad`); un botón tocado de lleno gana al margen de su vecino, entre dos márgenes el más cercano y el fondo de un diálogo
  sigue tapando lo de debajo (`pickHit`). Clic fiable (`judgeDown`): solo el izquierdo (el derecho solo en TowerDefenseMenu,
  donde hace algo), nada en los primeros 180 ms de una pantalla o de su vuelta a primer plano, y el segundo clic de un doble
  clic no «salta» a la pantalla o el botón que abrió el primero (los clics rápidos en el mismo botón sí cuentan). Un clic
  descartado no pasa a la escena de debajo. Hover = selección: tras usar teclado o mando, en cuanto el ratón se mueve vuelve
  a seleccionar lo que tiene debajo (`shouldReHover`). `MenuList` sube y baja con la rueda.
- Técnica: se envuelven `InputManager.pointWithinHitArea` e `InputPlugin.sortGameObjects/processDownEvents/processMoveEvents`
  de Phaser 3.90 (si se actualiza Phaser, revisar `src/ui/menuPointer.ts`). Teclado, ratón y mando siguen yendo cada uno solo;
  el táctil y las colisiones no se tocan.
Sin verificar a ojo (Vite no corre en la VM): el margen de clic en cada menú (sobre todo filas pegadas y botones pequeños
como ✕ o ◀ ▶), que la selección siga al ratón tras usar teclado, la rueda en las listas y que ningún clic legítimo se pierda
por los 180 ms de arranque.
## 2026-11-06 · Más música: listas por situación, música por tipo en Torres y mezcla aleatoria (rama `musica`)
Motivo: Roberto: «todo el rato suena la misma y aburre». Todo es composición propia (sin samples ni música de terceros).
- **Compositor por parámetros** (`src/data/musicGen.ts`, lógica pura): escala/modo (mayor, menor, dórico, frigio, lidio,
  mixolidio, armónica, frigio mayor, pentatónicas, blues, tonos enteros), tónica, tempo, ondas, ritmo de melodía, bajo,
  batería, armonía (pad o terceras), arpegio, eco y forma (AB, ABAB, AABB, AABA). La melodía es un motivo que se repite y
  varía sobre la progresión, con cadencia al final de cada sección; semilla fija por nombre (siempre suena igual).
- **Listas** (`src/data/music.ts`, `PLAYLISTS`, `runPlaylist`): exploración 4 por bioma (la de siempre + 3), +2 en Torre e
  Infinito; combate 4 por bioma (3 con el sabor del bioma + la de siempre); minijefe 3 (nueva situación `mini` en
  `musicState`, entre combate y jefe); jefe 4; jefe final 3; menú 3; tienda 3; salas tranquilas (centro, secreta, objeto) 3.
  128 pistas en total.
- **Defensa de torres**: familia por tipo (`TD_TYPE_FAMILY`: escala, tempo, onda, batería, ritmo y bajo propios), 2 pistas
  por tipo; suena la del tipo tema del nivel (`levelTheme`), así las 18 fases suenan distinto. Menú de torres (2) y
  oleadas con minijefe o jefe (3), que vuelven a la del tipo al acabar la oleada.
- **Mezcla aleatoria** (`src/audio/playlist.ts`, `MusicShuffle`): elige al azar sin repetir la misma seguida (tampoco al
  volver a una lista); cada pista da vueltas hasta ~70 s y pasa a otra; nueva pista en cada piso y al cambiar de
  situación; al entrar en otra sala, otra pista si la actual lleva ≥25 s. Transición con el crossfade de siempre.
- **Motor** (`src/ui/audio.ts`): onda del bajo y de la segunda voz, timbal y charles abierto, arpegio según la escala, eco;
  volumen por onda para que todas suenen parejas; carriles viejos se desconectan (no se acumulan nodos). API nueva:
  `startRunMusic`, `setMusicMood`, `musicRoom`, `playTdMusic`, `playTdChief`, `playTdMenuMusic`, `releaseMusic` (una
  escena solo vuelve a la música del menú si la que suena aún es suya). Ajustes de música y desbloqueo de audio, igual.
- Tests en `tests/musicPlaylist.test.ts` (sin repetición, semilla, notas en rango, pistas no vacías y distintas, listas ≥3,
  18 fases con pista distinta).
Sin escuchar (la VM no tiene audio): cómo suenan las pistas compuestas, el volumen relativo de las ondas nuevas (seno,
bajo cuadrado/sierra, timbal, eco) y las transiciones al cambiar de sala. El HUD móvil y `layout.ts` no se tocan.
## 2026-11-06 · Gacha por regiones y formas regionales (rama `gachareg`)
Motivo: Roberto quería el gacha separado por regiones y por formas regionales, con progreso por región. Lógica pura en
`src/data/gachaBanners.ts`, tests en `tests/gachaBanners.test.ts`, emblemas en `src/ui/art/bannerEmblems.ts` (datos) y
`bannerArt.ts` (texturas).
- **Banners** (`BANNERS`): Todas, uno por cada región de `regions.ts` (por número de Pokédex nacional, sin formas) y
  «Formas regionales» (todas las formas). Las regiones no se solapan y, con Formas, cubren justo Todas (test).
- **Rarezas y probabilidades iguales** (`GACHA_RATES`, `classifyRarity`). Si un banner no tiene una rareza, su parte pasa a
  la más cercana, como ya hacía `pull` (`effectiveRates`): Kanto tiene Épico 14 % (no hay Ultraentes fuera de Alola);
  Formas, Épico 15 % (ni Ultraentes ni legendarios). La línea de probabilidades de la pantalla enseña las del banner.
- **Garantía por banner** (`pullBanner`, `PITY`): Épico o mejor a la 10.ª tirada seguida sin él y la mejor rareza del
  banner (Legendario) a la 80.ª; la x10 conserva su Épico asegurado. Cuentas en `pokeisaac.gachaBanners` (con el último
  banner elegido); invitados en memoria como el resto. No se tocan costes, devoluciones ni tickets.
- **Formas nuevas** en `regionalForms.ts`: 16 de Hisui y 4 de Paldea (3 razas de Tauros y Wooper). Solo en gacha,
  colección y Pokédex (Hisui cuenta en Sinnoh, `FORM_REGION_HOME`); no salen como enemigos (`WILD_FORMS` = Alola y Galar)
  porque no tienen hoja de SpriteCollab. Ids, tipos y estadísticas de memoria (sin red en la VM para comprobar PokeAPI).
- **Pantalla**: la ficha «Destacado de hoy» pasa a ficha del banner: emblema pixel art propio, nombre, barra y «X/Y
  conseguidos», garantías que faltan, destacado de hoy del banner (de su mejor rareza) y, en Formas, «Alola a/b · Galar
  … · Hisui … · Paldea …». Debajo, 11 pestañas con los emblemas. Teclado: arriba enfoca la ficha y ←/→ cambia; Q/E desde
  cualquier sitio. Ratón: pestañas y flechas dibujadas. Mando: LB/RB (y cruceta como el teclado). Táctil: tocar una
  pestaña o deslizar la ficha. Se abre en el último banner usado.
- **Guardados**: lo desbloqueado no cambia (el progreso lo cuenta, también lo de antes); sin la clave nueva se empieza de
  cero en Todas; el historial acepta entradas viejas sin `banner`. Sin migración ni versión nueva.
Sin verificar a ojo (Vite no corre en la VM): que los textos de la ficha quepan entre el emblema y el destacado, las 11
pestañas y su marco, las flechas, el deslizamiento táctil, los emblemas y que los sprites de Hisui/Paldea carguen. El HUD
móvil y `layout.ts` no se tocan.
## 2026-11-06 · Economía: más tickets y caramelos, por rendimiento, primera victoria del día y caramelos que caen (rama `economia`)
Motivo: quienes han probado el juego dicen que dan muy pocos tickets (gacha) y caramelos (mejoras). Lógica pura nueva en
`src/data/economy.ts`; números en `progression.ts`, `save.ts`, `modes.ts`, `missions.ts` y `towerDefense/progress.ts`;
informe en `balance.ts` (`economyReport`, `expectedRunWithBonus`, caramelos en `simulateRuns`); tests en `tests/economia.test.ts`
(y rangos al día en `balance.test.ts`, `progression.test.ts` y `towerDefense.test.ts`). Gacha (10 / 100) y costes de las
mejoras (15 × nivel; árbol entero 4145 caramelos) sin tocar.
- **Salas** 3, 3, 4, 4, 5 (+1 cada dos pisos, tope +2; antes 3 siempre). **Jefe** 6 + 2 × piso (8…16; antes 2 × piso). Minijefe
  = dos salas (6…10). La Torre casi igual en jefes (206 en el piso 100, antes 200), salas con el tope de 5.
- **Rendimiento** al acabar (`performanceBonus`): 0, 0, 4, 10, 18, 28 tickets por pisos completados, +6 por piso más (tope 60);
  hitos = cada 5 rondas en Oleadas, cada 2 jefes en el Rush, cada 10 pisos en la Torre.
- **Primera victoria del día** (`claimFirstWin`, clave `pokeisaac.firstWin`, en `PROGRESS_KEYS`): el primer jefe del día o el
  primer nivel de la Defensa de torres ganado: 15 tickets, +3 por cada día seguido (tope 30), con sus caramelos.
- **Caramelos que caen** (`candyDrop`): 12 % de los enemigos 1-2 (+1 cada 4 pisos), minijefe 3 + piso, jefe 6 + 2 × piso,
  +5 shiny, +3 oscuro; con la dificultad. Se cobran al momento (un caramelo sale volando hacia ti y «+N caramelos»): no
  quedan en el suelo ni en el guardado.
- **Misiones/logros/encargos** dan también 3 caramelos por ticket; diarias 3/4/5 → 5/6/8 tickets (logros sin tocar: no se
  cambia lo ya ganado). La racha del desafío diario da también caramelos. **Oleadas**: 2 + ronda/4 por ronda.
- **Defensa de torres**: 3 caramelos por ticket de oleadas y victoria (antes un nivel repetido daba 0), 4 por estrella
  nueva (antes 1), +4 tickets la primera vez de cada nivel, jefe del mapa 20 tickets y 15 caramelos (antes 5); infinito 3
  caramelos por ticket y +5 por récord.
- Guardados: nada ganado cambia. `RunCounters.candies` y `RunRecord.candies` son opcionales (como `dashes`): sin subir
  `RUN_VERSION` (los guardados viejos se leen igual y el resumen calcula los caramelos con los tickets si faltan).

| Simulador (`economyReport`, 600 partidas, semilla 3) | Antes | Ahora |
|---|---|---|
| Tickets por partida media (muere en el piso 2-3) | 50,7 | 61,0 (+15-30 con la 1.ª victoria) |
| Caramelos por partida media | 152 | 213 |
| Tickets esperados: piso 1 / hasta piso 3 / partida completa / con reto final | 23 / 93 / 196 / 298 | 29 / 122 / 280 (+28 de rendimiento) / 388 (+34) |
| Partidas para la 1.ª tirada (Pokémon nuevo) | 0,2 | 0,16 (0 con la 1.ª victoria) |
| Partidas para una x10 (Épico asegurado) | 2,0 | 1,6 (1,4 con la 1.ª victoria) |
| Partidas para la 1.ª mejora / una estadística al máximo (225) | 0,1 / 1,5 | 0,07 / 1,06 |
| Partidas para el árbol entero de un Pokémon (4145) | 27 | 19,5 |
| Partidas para un legendario (100 tiradas de media) | 19,7 | 16,4 |
| Oleadas hasta la ronda 10 | 17 | 30 |
| Defensa de torres, nivel repetido (6 oleadas) | 4 tickets, 0 caramelos | 4 tickets, 12 caramelos |

Nota: el simulador ya daba una tirada en la primera partida; que la gente note «muy pocos» apunta a que juega menos
salas que el modelo, así que el cambio sube sobre todo lo que se gana al llegar lejos y lo que se ve (caramelos al
caer, avisos de premio). Si sigue corto, lo siguiente es `ROOM_TICKETS` o `CANDY_PER_TICKET`.
Sin verificar a ojo (Vite no corre en la VM): el caramelo que vuela al jugador y su «+N caramelos», los avisos de primera
victoria y de premio por llegar lejos, la línea nueva del resultado de la Defensa de torres (que quepa en la caja) y el pie
más largo de la pantalla de Misiones. El HUD móvil y `layout.ts` no se tocan.
## 2026-11-06 · Auditoría de hitboxes: solo te da lo que se ve (rama `hitbox`)
Motivo: Roberto: «no están bien las hitbox de algunos ataques, te dan sin estar en el sitio». Causas: casi todos los golpes
scriptados miraban el **centro del dibujo** del jugador (no sus pies) con márgenes de 14-22 px, y las zonas del suelo se dibujan
**achatadas** (elipse r × 0,65 r) pero dañaban en un **círculo** de r + 22: por encima y por debajo te daban a casi el doble de lo
marcado. Lógica pura nueva en `src/data/hitbox.ts` (círculo, elipse, rectángulo rotado, cápsula/rayo, sector/cono, anillo con
hueco, unión; distancia, contacto, contorno) y `src/data/attackHitboxes.ts` (dibujo y hitbox de cada ataque con los mismos
números), tests en `tests/hitbox.test.ts` (formas, catálogo de ~300 entradas: hitbox ⊆ dibujo con 2 px de tolerancia y nunca daño
antes del aviso).
- **Tu hitbox**: círculo de `PLAYER_HURT_R` = 10 px en el centro del cuerpo (pies); el sprite mide 84 px y el cuerpo de choque con
  paredes sigue en 16 px (pasar por puertas no cambia). Proyectiles y contacto con enemigos pasan por un filtro (process callback):
  el círculo inscrito del cuerpo de Arcade contra tu hitbox (las cajas de los sprites PMD tenían aire en las esquinas).
- **Capa de depuración**: solo en desarrollo o admin, con `?hitboxes` o `localStorage['pokeisaac.hitboxes'] = '1'`: tu hitbox
  en verde, cuerpos de enemigos y disparos en rojo y las formas que han mirado si te daban, en naranja (160 ms).

| Ataque | Dibujo | Daña antes | Daña ahora |
|---|---|---|---|
| Zona genérica de enemigo (`area`) | círculo r | centro del dibujo a ≤ r + 22 | tu hitbox toca el círculo r |
| Terremoto (tuyo y suyo) | onda elipse r × 0,65 r | círculo r + 22 (enemigos: + radio) | elipse (los dos lados) |
| Lluvia, bomba, erupción (enemigo) | `pixMarker` r × 0,65 r | círculo r + 22 | elipse de la marca |
| Mina de patrón (enemigo) | runa r × 0,6 r | **estallaba al momento** (nearestTarget sin alcance) + círculo r + 22 | se arma al pisar el 70 % de la runa; daña la elipse |
| Remolino (enemigo) | embudo con sombra 0,85 R × 0,275 R | círculo R + 22 | sombra del suelo |
| Rayo de patrón (enemigo/jefe) | `drawPixBeam` ancho máx(18, w) | ½w + 18 al centro | núcleo 80 % del dibujado |
| Rayo con barrido (Psicorrayo, Pulso Dragón de jefe) | aviso en el centro | salía girado −½ barrido, sin aviso | el aviso ya marca el inicio y el final |
| Cadena (enemigo) | rayo hasta ti | — | igual (golpe directo) |
| Láser giratorio | haz de 22 | 18 al centro | núcleo 8,8 + hitbox |
| Estallido mega | banda de 44 | 22 al centro | núcleo 17,6 + hitbox |
| Onda / Nova | bolas de 9 px en r | ±11 al centro | anillo ±6 + hitbox, hueco igual |
| Zona de peligro, lluvia del jefe, orbes, enemigo mina | círculos | centro dentro (orbes r + 14) | hitbox toca el círculo |
| Meteoro | aviso elipse R × 0,6 R | círculo R | elipse del aviso |
| Miasma | nubes ~0,9 R | 0,9 R al centro | círculo 0,75 R + hitbox |
| Muro, rejilla, minas en cruz | barras/rayos | medio ancho al centro | núcleo + hitbox, desde tus pies |
| Embestida marcada (asalto y frenesí) | carril de 60 | 50 px al centro | 30 + hitbox |
| Cruz del juicio | franjas de 72 | margen 10 al centro | margen = hitbox, desde tus pies |
| Frenesí (líneas, rayos, zonas, charcos) | ya coincidían | centro del dibujo | igual, desde tus pies |
| Enemigo que cava al salir | montículo 40 × 16 | 70 px alrededor | su cuerpo (0,35 × tamaño) |
| Proyectiles (tuyos/suyos) | forma 16 px de textura | caja de Arcade vs tu círculo de 16 | círculo inscrito vs hitbox de 10 |
| Contacto con enemigos/jefes (y carga) | sprite | caja 60 % × 55 % del fotograma | círculo inscrito de esa caja |
| Tu bomba | círculo 110 | 88 al centro | hitbox toca 88 |
| Grietas/lava de la arena y peligros de la Torre | casillas | casilla del centro del dibujo | casilla de tus pies |
| Defensa de torres: salpicadura y «Aturdir» | anillo achatado 60 % | círculo | el anillo se dibuja redondo y centrado |

Sin cambios (revisados): disparo básico y cargado, poderes, fusiones (usan el mismo motor de ataques), orbitales y rastro de las
sinergias (algo generosos, a tu favor), alcance de las torres y minas/tormenta de la Defensa (ya redondas).
Sin verificar a ojo (Vite no corre en la VM): la capa de depuración (colores, que no tape el HUD), la segunda línea del aviso del
rayo con barrido, que el cambio a los pies se sienta bien con los Pokémon de fotogramas grandes y que los rayos del jefe no se noten
más blandos o duros (el núcleo + hitbox es ±1-7 px de lo de antes). El HUD móvil, `layout.ts` y la economía no se tocan.
## 2026-11-06 · Móvil: controles que ya no se quedan pillados y repaso de pantallas (rama `movil`)
- Problema (Roberto, probando con gente): «los controles del móvil se quedan pillados a veces» y «la parte del móvil no
  está terminada». El seguro de `movilbandas` (reclamar a 1,5 s, soltar en blur/visibilitychange/pagehide/pausa)
  dejaba huecos. Casos encontrados mirando el código de Phaser 3.90 (`InputManager`, `TouchManager`) y el nuestro:
  1. **Lienzo, dedo perdido**: Phaser solo libera un puntero con su touchend/touchcancel. Si el navegador se lo come
     (deslizar desde el borde, notificación, multitarea de iOS, 4-5 dedos en iPad), `isDown` sigue en true: el stick
     seguía con su dirección (el personaje andando solo) y el lienzo **no** tenía el reclamo a 1,5 s (solo las bandas).
     Con 5 punteros perdidos ningún toque llegaba ya al juego (también en menús y en la Defensa de torres).
  2. **Bandas**: el dedo perdido seguía moviendo hasta que otro dedo tocaba la banda y pasaban 1,5 s. Además los toques
     de las bandas también creaban punteros de Phaser (su `touchstart` de la ventana), gastando los 5 huecos.
  3. **Tercer dedo** en un lado ya ocupado: se ignoraba; al levantar el primero, el que seguía apoyado no hacía nada
     hasta levantarlo y volver a tocar (se notaba como «pillado»).
  4. **Botones «fantasma»**: un toque de Bomba/Poción/Activo durante una transición o cinemática se quedaba guardado y
     salía segundos después.
  5. **Vertical**: con el aviso «Gira el móvil» la partida seguía corriendo y los toques del aviso llegaban a Phaser.
  6. Girar el móvil no soltaba nada (iOS suele mandar touchcancel, pero no siempre); al rehacer los controles se
     añadían 4 punteros más cada vez.
- Arreglo (lógica pura en `src/data/touchPointers.ts`, pruebas en `tests/touchGuard.test.ts`):
  - `StickArbiter`: un dedo por stick; un dedo que cae en un lado ocupado **espera** y se queda el stick en cuanto el
    primero se levanta (nace donde está ese dedo); dedo sin señales 1,5 s cede el stick (ahora también en el lienzo);
    `sync(isLive)` suelta los que ya no están y `releaseAll()` todo. Lo usan el lienzo y las bandas.
  - `ghostTouches` (retenidos que no están en `touches` ni en `changedTouches`) y `noFingersLeft` (touchend/cancel sin
    dedos = soltar todo). `pressFresh`: un toque de botón que la partida no recoge en 300 ms se descarta.
  - `src/ui/touchSanity.ts` (nuevo, `main.ts` solo en `touchOnlyDevice()`): en cada evento táctil de la página (fase de
    captura, antes que Phaser) cancela en Phaser los punteros cuyo dedo ya no está, por su camino normal
    (`onTouchCancel`: las escenas reciben pointerup con `wasCanceled`, en su misma posición, así que nada se «pulsa»).
    También al ocultar la página. Al pasar a vertical cancela todo y emite `TOUCH_INTERRUPT`: `onFocusLost`
    (`ui/focusPause.ts`) lo escucha, así que la partida y la Defensa de torres abren su pausa.
  - `touchControls.ts`: el lienzo usa el árbitro (el `tick` sigue soltando lo que Phaser ya no tiene pulsado, y adopta
    al que espera); soltar todo también con `orientationchange` y con touchend/cancel sin dedos; los toques pendientes
    se borran al soltar todo; `addPointer(4)` solo una vez. Las **bandas** pasan a eventos táctiles con `identifier`
    (Pointer Events solo donde no existen), sincronizan con la lista real `touches` en cada evento y hacen
    `preventDefault`, así Phaser ya no ve sus toques. Si la caja derecha se mueve con el dedo puesto (barra del
    navegador, giro) la base del stick se corrige para seguir bajo el dedo. El brillo de un botón de banda se cancela al
    cerrar la escena (nunca se queda encogido).
  - Prueba de 5000 pasos al azar (hasta 5 dedos, 10 % de touchend perdidos): nunca queda un stick con un dedo que no
    está en la pantalla. Consola: `__POKEISAAC_DEBUG__.touchHeld()` (dedo de cada stick y punteros de Phaser pulsados).
- Zonas de toque: «← Volver» (`addBackButton`, en todos los menús) crece en móvil hasta 56 px CSS con un margen
  invisible (`touchPad` en `ui/uiScale.ts`, con prueba); la pausa de la partida se toca en todo su rincón (de ≈21 a
  ≈29×35 px CSS en un móvil de 375 de alto).
- App instalable: manifest con `id`, iconos «any» y uno «maskable» aparte (antes «any maskable» en la misma entrada; la
  Poké Ball queda dentro de la zona segura) y `<meta name="mobile-web-app-capable">` (la de Apple sola está obsoleta en
  Chrome). Prueba `tests/pwaManifest.test.ts`.
- Repaso de tamaños (px CSS, cálculo con el lienzo de cada caja; no visto en pantalla):

| Caja | Ranura / pausa HUD | Barra TD (32) | Casilla TD (48) | Letra 14 de menú sin aumento |
|---|---|---|---|---|
| 640×360 · S23 780×360 | 21 | 18 | 27 | 7,9 |
| iPhone SE 667×375 · 14 Pro 734×372 | 22 | 19 | 28 | 8,1 |
| 14 Pro Safari con barras 667×258 | 15 | 13 | 19 | 5,6 |
| Pixel 7 915×412 · 932×430 | 24-25 | 21 | 31-32 | 9,0-9,4 |
| Fold plegado 882×344 | 20 | 17 | 26 | 7,5 |
| Fold abierto 884×768 | 29 | 25 | 37 | 10,9 |
| iPad mini 1133×744 | 38 | 32 | 48 | 13,9 |

  (Las letras de menú suben con el aumento de `main.ts` hasta 12 px CSS, tope ×1,5.) Joysticks y botones táctiles ya
  daban ≥ 56 px de zona (tests de `movilbandas`/`movilhud`).
- **Pendiente** (no se puede llegar a 56 px sin rehacer la composición 960×640 en móvil): botones de la barra y del
  panel de torre de la Defensa de torres (13-21 px CSS de alto), casillas del mapa TD (19-32), ranuras de poder (15-25;
  al menos tienen auto-apuntado) y filas de menú con poco hueco entre ellas. Propuesta para Roberto: una disposición
  táctil propia para la Defensa de torres (barra y panel más altos, mapa con zoom y arrastre) en una rama aparte.
- **Sin verificar a ojo**: Vite no corre en la VM y en el contenedor `npm ci` no pudo bajar paquetes (el registro de
  npm devuelve 403 por el proxy), así que no hubo render con Chromium + Playwright ni capturas. Solo `npx tsc --noEmit`
  y `npm test` (1195 pruebas). Probar en móvil real: jugar con 3-4 dedos, deslizar desde el borde y bajar las
  notificaciones con el joystick puesto, cambiar de app y volver, girar a vertical (debe pausar) y volver, tocar Bomba
  durante el cartel de piso (no debe salir luego), y en iPhone con barras de Safari que las bandas sigan bajo el dedo.

## Auditoría visual: cajas, solapes y textos cortados (rama `auditoria`, 07/11)
Recorrido automático (Playwright + comprobación de los objetos de Phaser: texto fuera de su caja, textos que se pisan, texto
sobre iconos, interactivos fuera de cámara) de ~40 pantallas en 1920×1080, 1366×768, 1280×720, 2560×1080, 3440×1440,
1024×768 y táctil 852×393, 734×372, 667×375, 915×412, 667×258 y vertical 390×844, con valores extremos: 999999 tickets,
caramelos y monedas, 99 llaves/bombas/pociones, 24 objetos (24/10), 1025 Pokémon y shinies, mejoras y huerto al máximo,
récords 99999, Torre 100, nombres y textos de 40+ caracteres, cuatro avisos a la vez y textos «Completos». Capturas de
antes/después en `docs/auditoria/`.
Arreglado (solo tamaños, anclajes y ajuste de texto; nada de lógica):
- **Fuente**: sin ligaduras (`liga`/`dlig` a 0 en theme.ts): la «fi» de Pixelify Sans parecía una «A» («Reto final» se leía
  «Reto Anal», «Infinito», «Final»…).
- **HUD de contadores**: `counterRowLayout` acepta el medio ancho real de cada icono (la llave es más ancha): con 999999
  monedas la cifra ya no queda debajo de la llave (test nuevo en hudLayout.test.ts).
- **Avisos (toasts)**: las palabras largas se parten (`useAdvancedWrap`) en vez de salirse de la tarjeta.
- **Confirmar y Forja (ItemChoice)**: títulos largos se encogen (`addPixelText` con `maxW`), el texto se encaja entre el título
  y los botones (`fitTextBox`) y las filas de `MenuList` encogen los textos largos para no pisar la flecha ni salirse.
- **Ajustes**: con «Panel admin» la fila «Volver» pisaba la barra de ayuda (filas de 33 px).
- **Saldos**: Gacha y Mejoras con 999999 bajan de letra (`setFitLine`) en vez de pisar el icono del caramelo.
- **Gacha (banners)**: los textos de la ficha acaban antes del Pokémon destacado (antes «conseguidos» y la garantía quedaban
  debajo de él en móvil).
- **Pausa**: con muchos objetos la última línea acaba en «…» en vez de cortarse con un «·».
- **Menú principal**: la línea de récords altos baja de letra en vez de salirse por los lados.
- **Modos (móvil)**: «Luego: …», el récord y la descripción ya no se pisan ni tocan el borde.
- **Pestañas de región y filtros** (Pokédex, inicial): el texto de dos líneas cabe en la pestaña con la letra de móvil.
- **Huerto, Misiones (logros), Registro de combate, Mejoras (nodos y barras de estadísticas)**: cada línea encaja en su caja con
  la letra de móvil (antes se pisaban o salían del borde).
- **Defensa de torres**: menú de mapas (fichas normales y compactas de 18) con nombre, niveles, estrellas y «∞ abierto» dentro de
  la ficha y la cifra después de la estrella; el consejo de la partida va abajo del mapa y centrado en él (arriba pisaba los
  avisos y el aviso del nivel temático, y centrado en pantalla pisaba el panel del equipo).
Pendiente HUD móvil (no tocado, es del trabajo de móvil): en 852×393 la rejilla de objetos (24) queda cortada por el panel del
objeto activo, la pila de avisos de la derecha se corta por abajo y la cifra de pociones toca el borde del panel de contadores.
No comprobado: la pantalla «Elige tu equipo» con el aviso (la colección tarda en cargar sin red en el contenedor), el resumen de
partida tras morir (la animación no terminó en la captura), Legal en el tercer apartado (falla al arrancar la escena con datos
sueltos: solo desde la prueba) y los sprites reales (sin acceso a PokeAPI: se ven Poké Balls genéricas).

## 2026-11-07 · Defensa de torres en móvil: disposición táctil propia (rama `tdmovil`)
- Problema (repaso de `movil`): en táctil la Defensa de torres seguía la composición 960×640 de escritorio: barra y panel
  de torre de 13-21 px CSS, casillas de 19-32 px y menús con fichas de 39-56 px. Solo en dispositivos táctiles
  (`touchOnlyDevice`); teclado, ratón y mando siguen exactamente igual (cada uno por sí solo).
- Lógica pura con pruebas (`tests/tdTouch.test.ts`, 42 pruebas): `src/data/towerDefense/touchTd.ts` (ancho del lienzo,
  px CSS por unidad, disposición de la partida, hoja de acciones, casilla más cercana, anillo y radio de pegado, zoom,
  lupa, gestos `MapGesture`) y `src/data/towerDefense/touchMenu.ts` (rejillas de mapas, niveles y «Elige tu equipo»).
- Lienzo: las pantallas de torres piden en táctil el lienzo a todo el ancho hasta 3:1 (`setTouchFullWidth` en
  `ui/wideScreen.ts`; aquí no hay bandas DOM) y lo sueltan al cerrarse si no sigue otra de torres (`tdWidthStillNeeded`).
- Partida (`TowerDefenseScene` + `ui/tdTouchMap.ts`): dos columnas de botones de ≥ 56 px CSS a los lados (izquierda:
  Pausa, Velocidad, Oleada y las 4 habilidades; derecha: el equipo 2×3 y, al colocar/mover/apuntar, [Confirmar]
  [Cancelar]; con una torre o un camino abiertos, la **hoja** de acciones en su lugar: Mejorar o las dos ramas, Objetivo,
  Mover, Vender y Cerrar; Mina, Telaraña, Barricada y Cerrar). Franja con vida, dinero, oleada y llegada encima del mapa;
  ficha de texto (nombre, estadísticas, ramas, trampas) abajo del mapa en la mitad contraria a la casilla; jefe y
  evento arriba a la derecha del mapa; avisos arriba a la izquierda; línea de ayuda táctil abajo. Letra ≥ 12 px CSS
  (10 al encoger textos largos). Al girar o cambiar las barras del navegador se rehace la interfaz sin tocar la partida.
- Mapa: en su propia cámara (lo de profundidad < 54 es mapa; lo de encima, interfaz en la cámara principal, que se
  pinta la última). Un dedo: toque = casilla (la de debajo o la válida más cercana a ≤ 28 px CSS); arrastrar = mover
  el mapa; mantener 0,32 s = **lupa** encima del dedo (o al lado si no cabe) que sigue al dedo y elige al soltar. Dos
  dedos: pellizco (zoom hasta casillas de 84 px CSS) y arrastre. Colocar, mover y lanzar Tormenta/Bomba/Refuerzo no se
  hacen al primer toque: la casilla queda con un **anillo de confirmación** (radio ≥ 28 px CSS: zona efectiva ≥ 56 aunque
  la casilla se vea de 20) y se confirma tocando dentro del anillo, con «Confirmar» o con el botón de la habilidad otra
  vez. Abrir una torre o el camino no pide confirmar. Pausa con filas de ≥ 46 px CSS.
- Dedos pillados: `MapGesture` usa como mucho 2 dedos, un `up` cancelado (touchcancel o `touchSanity`) nunca es toque,
  `sync` suelta cada fotograma los que Phaser ya no tiene pulsados y `releaseAll` al pausar, con mejoras o fin, y al
  cerrar la escena; además, al cerrar cualquier pantalla de torres se cancelan en Phaser todos los punteros táctiles
  (`releaseAllTouches` en `ui/touchSanity.ts`). Prueba de 5000 pasos al azar con 10 % de `up` perdidos. Los botones son
  zonas de Phaser normales (nada queda «pulsado»).
- Menús: cabecera con «← Volver» y «Cómo se juega» de un botón de alto (zona de toque = el botón); 18 mapas en rejilla
  (o por páginas con ◀ ▶ grandes si no caben), niveles + infinito en una sola rejilla con el texto del nivel a la
  derecha, y «Elige tu equipo» en tres columnas: información + aviso de equipo + página ◀ ▶, filtros y colección,
  equipo 2×3 con [¡A jugar!][Prueba]. Al cambiar el ancho, el menú se rehace en su sitio (conserva el equipo sin
  guardar). En vertical sale el aviso «Gira el móvil» y la partida se pausa (ya existía: `TOUCH_INTERRUPT`).
- Tamaños calculados (px CSS; botón de la partida; mapa; casilla al encajar → zoom máximo; mapas cols×filas y ficha;
  niveles; colección por página y lado):

| Caja | Lienzo | Botón | Mapa | Casilla | Mapas | Niveles | Colección |
|---|---|---|---|---|---|---|---|
| 640×360 | 1920 | 56 | 388×324 | 24 → 84 | 5×4, 120×66 | 4×4, 84×66 | 12, 66 |
| iPhone SE 667×375 | 1920 | 56 | 417×340 | 26 → 84 | 5×4, 125×69 | 4×4, 88×69 | 12, 71 |
| iPhone 14 Pro 734×372 | 2130 | 56 | 484×338 | 30 → 84 | 5×4, 138×68 | 4×4, 98×68 | 15, 65 |
| Galaxy S23 780×360 | 2340 | 56 | 528×324 | 29 → 84 | 5×4, 148×66 | 4×4, 104×66 | 18, 58 |
| Pixel 7 915×412 | 2398 | 56 | 664×376 | 33 → 84 | 5×4, 174×78 | 4×4, 139×78 | 28, 61 |
| 932×430 | 2340 | 56 | 682×396 | 35 → 84 | 5×4, 178×83 | 4×4, 144×83 | 28, 63 |
| 14 Pro Safari con barras 667×258 | 2792 | 56 | 419×224 | 20 → 84 | 4×2 (3 páginas), 127×87 | 8×2, 56×87 | 10, 56 |
| Fold plegado 882×344 | 2768 | 56 | 630×309 | 27 → 84 | 6×3, 139×84 | 4×4, 130×61 | 21, 58 |
| Fold abierto 884×768 | 1920 | 57 | 629×461 | 39 → 84 | 4×5, 212×78 | 4×4, 130×100 | 35, 58 |
| iPad mini 1133×744 | 1920 | 57 | 876×599 | 53 → 84 | 4×5, 274×106 | 4×4, 188×134 | 63, 64 |
| iPad Pro 12,9 1366×1024 | 1920 | 56 | 1111×731 | 65 → 84 | 4×5, 333×133 | 4×4, 253×168 | 140, 57 |

  Solo en cajas extremas (< 250 px CSS de alto, p. ej. 840×240) los botones bajan a ≈ 55 px para que quepan las 4 filas.
- **Sin verificar a ojo**: Vite no corre en la VM y en el contenedor `npm ci` falló por el proxy, así que no hubo render
  ni capturas; solo `npx tsc --noEmit` y `npm test`. Lo que más riesgo tiene: el orden de pintado y el filtro de
  cámaras (mapa / lupa / interfaz), que Phaser resuelva los toques de los botones con la cámara del mapa debajo, la
  nitidez del mapa con zoom no entero, que los textos encogidos quepan de verdad en cada botón, la ficha de texto sobre
  el mapa y el cambio en vivo al girar o enseñar las barras. No adaptados: la pantalla de resultados (filas de 17-25 px
  CSS), la elección de mejoras (tarjetas grandes pero letra pequeña), los avisos de consejo (`tdTips`) y la ventana
  «Cómo se juega» (solo crecen ◀ ▶ ✕). Probar en iPhone con y sin barras, Android, Fold e iPad: colocar con anillo y
  con lupa, pellizcar y arrastrar con una oleada en curso, abrir torre y camino, mover, vender, ramas, habilidades de
  zona, pausar, girar a vertical y volver, y que ningún dedo se quede pillado al cambiar de pantalla.
