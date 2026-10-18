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
