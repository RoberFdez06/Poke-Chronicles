# PokeIsaac

Roguelike cenital en web, estilo The Binding of Isaac, con Pokémon. Fan game gratuito y sin ánimo de lucro.

## Arrancar

```bash
npm install
npm run dev
```

Abre la URL que muestra Vite (normalmente http://localhost:5173).

## Controles

| Acción | Teclado | Ratón | Mando |
|---|---|---|---|
| Moverse | W A S D | Mantener clic derecho hacia el cursor | Stick izquierdo |
| Disparar | Flechas (dos a la vez, en diagonal) | Mantener clic izquierdo hacia el cursor | Stick derecho |
| Poderes 1-4 | Teclas 1, 2, 3, 4 | Clic en la ranura | A, B, X, Y |
| Pausa | Esc o P | Botón ❚❚ (arriba a la izquierda) | Start o Select |
| Nueva partida (al morir o ganar) | R | Clic | Start |
| Menús y elegir inicial | Flechas o W A S D, Enter / espacio, Esc para volver | Pasar el cursor, clic y botón "Volver" | Stick o cruceta, A para elegir, B para volver |

**Regla del proyecto:** todo se puede manejar con teclado, con ratón y con mando, cada uno por sí solo. Cualquier
pantalla o acción nueva debe cumplirlo.

## Aspecto

Interfaz al estilo de los juegos de Pokémon: cuadros de texto con borde doble y esquinas redondeadas, flecha ▶
en la opción elegida, barras de PS verde/amarilla/roja con la etiqueta "PS", fichas de tipo y fundidos entre
pantallas. Fuente, colores y piezas comunes en `src/ui/theme.ts`.

La fuente es **Pixelify Sans** (licencia libre OFL), en `public/fonts/PixelifySans.ttf` con su licencia en
`public/fonts/OFL.txt`; se carga antes de crear el juego. Si el archivo no está, el juego usa la fuente del sistema.
Para descargarla: `https://github.com/google/fonts/raw/main/ofl/pixelifysans/PixelifySans%5Bwght%5D.ttf` →
`public/fonts/PixelifySans.ttf` y `https://github.com/google/fonts/raw/main/ofl/pixelifysans/OFL.txt` → `public/fonts/OFL.txt`.

## Menú principal

El juego arranca en el menú: **Jugar** (hueco → Pokémon → modo), **Gacha** (gasta tickets para desbloquear Pokémon) y **Controles**. Esc o B vuelven atrás desde la
selección de inicial. Abajo se ven los Pokémon desbloqueados y el récord de cada modo.

## Pausa y partidas guardadas

Funciona como en Isaac. **Jugar** abre los 3 huecos de partida: uno vacío empieza una nueva; uno ocupado deja
*Continuar* o *Nueva partida* (pide confirmación antes de sobrescribir). La partida se guarda sola al entrar en
una sala, al limpiarla, al coger un objeto y al salir desde la pausa (con el número de piso); se borra al morir o
al completar la partida.
Si sales en mitad de un combate, al continuar esa sala se reinicia con los enemigos enteros. Tickets y
desbloqueos son comunes a los 3 huecos; las monedas son de cada partida. El guardado vive en `src/data/runSave.ts` (claves `pokeisaac.run.0..2`).

La pausa muestra tus estadísticas, objetos y poderes, y tiene *Reanudar*, *Reiniciar* (con confirmación),
*Controles* y *Salir y guardar*.

## Gacha, tickets y monedas

Hay dos monedas distintas:

- **Tickets** (fuera de la partida, `src/data/save.ts`): solo sirven para el gacha. Antes se llamaban "monedas"; el
  saldo guardado se pasa solo a tickets (`pokeisaac.coins` → `pokeisaac.tickets`).
- **Monedas** (dentro de la partida, `src/data/loot.ts`): caen a veces de los enemigos y al limpiar salas, se recogen
  pisándolas, se ven en el HUD (●) y en la pausa, y solo sirven en la tienda. Se pierden al acabar la partida.

Los tickets se ganan jugando (15 por sala limpiada, +5 por cada piso; 60 × número de piso por el jefe) y se guardan en el navegador; nunca se
compran con dinero real. Todos los nombres (Pokémon, movimientos y tipos) salen en español: los de Pokémon vienen en
`species-index.json` (`nameEs`) y, si faltan, de `pokemon-species/{id}`. Una tirada cuesta 100 y da un Pokémon según su rareza (común, raro, épico, ultraente
o legendario, de menos a más valiosa; probabilidades en `src/data/gacha.ts`). Si ya lo tenías, devuelve 30 tickets. La lista de especies
se genera sola la primera vez con `npm run dev` (necesita internet); a mano: `node scripts/buildSpeciesIndex.mjs`.
Con más de 8 desbloqueados, la pantalla de inicial se divide en páginas (◀ ▶ con ratón, izquierda/derecha con teclado o mando).

## Elegir inicial

**Primera partida** (sin ningún Pokémon guardado): eliges **región** (Kanto, Johto, Hoenn, Sinnoh, Teselia, Kalos,
Alola, Galar o Paldea) y luego uno de **sus 3 iniciales**; ese es tu primer Pokémon. Quien ya jugaba antes conserva
Bulbasaur, Charmander y Squirtle (migración automática).

Después, al empezar partida eliges entre tu colección, **dividida por regiones** (pestañas con cuántos tienes de
cada una) y con **filtros por nombre y por rareza**. Cada tarjeta muestra tipos y rareza; 8 por página.

| Acción | Teclado | Ratón | Mando |
|---|---|---|---|
| Cambiar de región | Q / E | Clic en la pestaña | LB / RB |
| Cambiar rareza | R | Clic en "Rareza" | X |
| Buscar por nombre | F y escribir (Retroceso borra, Enter cierra) | Clic en "Buscar" y en las letras | Y, cruceta y A (Y borra, B cierra) |
| Cambiar de página | Flechas al pasar del borde | ◀ ▶ | Cruceta |

Los desbloqueados se guardan en el navegador (`localStorage`, clave `pokeisaac.unlocked`, formato
`{ v: 2, ids: [...] }`); el gacha añade más con `unlockPokemon(id)` de `src/data/save.ts`. Regiones y filtros en
`src/data/regions.ts`.

## Recuperar vida, Centro Pokémon y tienda

- **Bayas**: los enemigos a veces sueltan una Baya Aranja (+20 PS) o Zidra (+40 PS); el jefe siempre suelta una Zidra.
  Se recogen al pisarlas; con los PS al máximo se quedan en el suelo.
- **Centro Pokémon** (marco rosa en la puerta y el minimapa): su mostrador cura la mitad de tus PS máximos, una vez
  por piso. Se usa pisándolo, o cerca con Enter / A, o con clic en el mostrador.
- **Tienda** (marco verde): Poción (+20 PS, 5 monedas), Superpoción (+50 PS, 12) y un pasivo o poder al azar (15).
  Se compra pisando el artículo, cerca con Enter / A, o con clic. Sin monedas suficientes (o con los PS al máximo,
  las pociones) no se compra.
- Cada piso de Normal e Infinito tiene un Centro y una tienda (`floorGen` los pone en salas sin salida, nunca en la
  del jefe). Oleadas y Rush de jefes no tienen, así que allí solo caen bayas.

## Combate

- **Disparo continuo** como en Isaac: mantén una flecha y el Pokémon dispara solo, mirando hacia esa dirección.
  Los disparos tienen el color del tipo de tu inicial.
- **Objetos pasivos** (nombres provisionales): mejoran daño, cadencia, alcance, velocidad, PS, disparos extra,
  atravesar enemigos, rebotes y curación al limpiar salas. Se acumulan.
- **Poderes**: movimientos de PokeAPI **de los tipos de tu Pokémon** (con potencia y nombre en español; si tiene
  dos tipos, se reparten entre los dos) que aparecen como objetos y ocupan una ranura (teclas 1-4).
  La potencia decide cómo salen: disparo rápido (<50), anillo (50-69), abanico (70-99) o proyectil grande
  que atraviesa (100+); a más potencia, más recarga. Con las 4 ranuras llenas, el siguiente sustituye al más antiguo.
- **Estados por tipo**: al golpear, cada poder aplica el estado de su tipo (tinte en el enemigo y un aviso que sube):
  Fuego **quema** y Veneno **envenena** (daño en el tiempo), Hielo **congela** (muy lento), Eléctrico **paraliza**
  (se queda quieto a ratos), Agua **empapa** (algo más lento), Psíquico y Fantasma **confunden** (se mueve y apunta
  dando bandazos), Planta y Bicho **drenan** (recuperas PS) y Lucha, Roca y Tierra **empujan**. Los jefes resisten la
  lentitud y la parálisis. Tabla en `src/data/status.ts`.
- **Vida de los enemigos**: los enemigos chocan entre sí (no se amontonan) y, cuando les has dado, llevan encima una
  barrita de vida verde/amarilla/roja. El jefe tiene una barra grande arriba con su nombre y su tipo.
- Los objetos salen siempre en la sala de objeto y, a veces (25 %), al limpiar una sala de combate.
- **Enemigos variados**: cada piso tiene 4 especies al azar de PokeAPI (nunca legendarios, singulares ni
  ultraentes), más fuertes cuanto más hondo (por su suma de estadísticas base: en torno a 280 en el piso 1 y
  +65 por piso). Su tipo principal decide cómo se comportan: **persiguen** (Normal, Planta, Veneno, Bicho, Hada),
  **embisten** en línea recta tras pararse y brillar en amarillo (Lucha, Roca, Tierra, Acero, Dragón), **disparan**
  proyectiles con borde oscuro guardando la distancia (Fuego, Agua, Eléctrico, Hielo) o **saltan**: desaparecen y
  reaparecen cerca de ti, sin hacer daño durante un instante (Volador, Psíquico, Fantasma, Siniestro). El jefe
  también se comporta según su tipo. Tabla y estadísticas en `src/data/enemies.ts`.

## Qué hay en esta base

- Piso con salas, puertas, minimapa, enemigos variados, jefe legendario de PokeAPI y objetos.
- Sprites pixel de PokeAPI de frente y de espalda: el personaje mira hacia donde dispara y los enemigos hacia ti.
- Pantalla de selección de inicial antes de cada partida.

## Estructura

```
src/
  main.ts              configuración de Phaser
  data/pokeapi.ts      Pokémon y movimientos desde PokeAPI, con nombres en español (con caché)
  data/types.ts        colores por tipo
  data/items.ts        estadísticas, objetos pasivos y poderes (puro, testeable)
  data/gacha.ts        rarezas y tiradas del gacha (puro, aún sin conectar al juego)
  data/enemies.ts      enemigos por piso, comportamiento por tipo y estadísticas (puro)
  data/moves.ts        poderes del tipo de tu Pokémon y nombres en español (puro)
  data/save.ts         Pokémon desbloqueados guardados en el navegador
  scenes/MenuScene.ts     menú principal
  scenes/StarterScene.ts  elegir Pokémon de tu colección (regiones, búsqueda y rareza)
  scenes/FirstStarterScene.ts  primera partida: elegir región e inicial
  data/regions.ts      regiones, iniciales y filtros de la colección (puro)
  data/modes.ts        modos de juego, oleadas, arena y récords (puro)
  data/status.ts       estados por tipo: quemar, congelar, paralizar… (puro)
  data/loot.ts         monedas de la partida, bayas, pociones, Centro Pokémon y tienda (puro)
  scenes/ModeScene.ts  elegir modo de juego
  ui/nav.ts            entrada de menús (NavInput, PadButtons) y botones (MenuList)
  ui/cards.ts          tarjeta de Pokémon, carga de sprites y botón "Volver"
  ui/theme.ts          tema: fuente, colores, cuadros, barra de PS, fichas de tipo y transiciones
  data/speciesIndex.ts carga (una vez) la lista de especies de public/data
  level/floorGen.ts    generador de pisos (puro, determinista por semilla)
  level/progression.ts pisos: tamaño, dificultad, tickets y jefes legendarios (puro)
  scenes/GameScene.ts  piso, salas, puertas, jugador, enemigos, habilidades y HUD
  scenes/minimap.ts    minimapa
tests/
  floorGen.test.ts     tests del generador (`npm test`, runner de Node 22.6+)
  items.test.ts        tests de objetos y poderes
  gacha.test.ts        tests de rarezas y gacha
  save.test.ts         tests del guardado de desbloqueos
  runSave.test.ts      tests de las partidas guardadas (y su migración)
  progression.test.ts  tests de pisos, dificultad y jefes
  enemies.test.ts      tests de enemigos por piso y comportamientos
  moves.test.ts        tests de poderes por tipo
  regions.test.ts      tests de regiones y filtros
  modes.test.ts        tests de modos y récords
  status.test.ts       tests de estados
  theme.test.ts        tests del color de la barra de PS
  loot.test.ts         tests de botín, curación y tienda
scripts/
  buildSpeciesIndex.mjs  genera public/data/species-index.json desde PokeAPI
```

## Modo Normal

La partida tiene **5 pisos** (`FLOOR_COUNT` en `src/level/progression.ts`). Cada piso tiene salas de inicio,
combate, objeto (marco amarillo) y jefe (marco rojo): el primero tiene de 8 a 12 salas y cada piso suma 2 más.
Las puertas se cierran al entrar en una sala con enemigos y se abren al limpiarla. Los enemigos tienen más
vida, daño y velocidad (y son más) en cada piso.

El jefe siempre es un Pokémon **legendario o singular** (sacado de `public/data/species-index.json`, sin
repetir en la partida). Al vencerlo deja un objeto y una **trampilla**: al pisarla bajas al piso siguiente con
tus objetos, poderes y PS. La partida se gana al vencer al jefe del piso 5 y se pierde al morir. El HUD y la
pausa muestran el piso actual.

## Modos de juego

Tras elegir Pokémon se elige modo (`src/scenes/ModeScene.ts`, reglas en `src/data/modes.ts`). Cada modo guarda su
récord en el navegador (`pokeisaac.records`, en `src/data/save.ts`), que se ve al elegir modo y en el menú principal.

| Modo | Cómo es | Récord |
|---|---|---|
| **Normal** | 5 pisos (ver arriba). | Pisos completados |
| **Oleadas** | Una sola sala; rondas cada vez con más enemigos. Cada 3 rondas cae un objeto y suben la dificultad y la fuerza de las especies. | Rondas superadas |
| **Infinito** | Como Normal, pero los pisos no se acaban y cada uno es más difícil. | Pisos completados |
| **Rush de jefes** | Solo jefes legendarios en una arena; tras cada uno, un objeto y una trampilla al siguiente. | Jefes vencidos |

Las partidas de cualquier modo se guardan en los huecos (`RunSave.mode`, `RUN_VERSION` 3; las de antes pasan a Normal).
En Oleadas, al continuar se repite la ronda en la que estabas.

## Siguientes pasos

1. ~~Generación procedural del piso con salas y puertas.~~ Hecho (modo Normal, versión inicial).
2. ~~Objetos y bayas que modifican estadísticas.~~ Hecho (pasivos, poderes y estados por tipo).
3. ~~Jefes y modos: Normal, Oleadas, Infinito y Rush de jefes.~~ Hecho.
4. ~~Gacha con tickets ganados jugando~~ Hecho (común, raro, épico, ultraente y legendario).
5. Empaquetado como app con Tauri o Electron.
