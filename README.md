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
| Usar (Centro Pokémon, tienda) | Enter cerca, o pisarlo | Clic en el mostrador o el artículo | A cerca, o pisarlo |
| Nueva partida (al morir o ganar) | R | Clic | Start |
| Menús | Flechas o W A S D, Enter / espacio, Esc para volver | Pasar el cursor, clic y botón "Volver" | Stick o cruceta, A para elegir, B para volver |

**Regla del proyecto:** todo se puede manejar con teclado, con ratón y con mando, cada uno por sí solo. Cualquier
pantalla o acción nueva debe cumplirlo.

## Aspecto

Interfaz al estilo de los juegos de Pokémon: cuadros de texto con borde doble y esquinas redondeadas, flecha ▶
en la opción elegida, barras de PS verde/amarilla/roja con la etiqueta "PS", fichas de tipo y fundidos entre
pantallas. Fuente, colores y piezas comunes en `src/ui/theme.ts`.

La fuente es **Pixelify Sans** (licencia libre OFL), en `public/fonts/PixelifySans.ttf`; se carga antes de crear el
juego y, si el archivo no está, el juego usa la fuente del sistema. **Falta su licencia** `public/fonts/OFL.txt`
(la OFL pide distribuirla junto a la fuente). Se descargan de: `https://github.com/google/fonts/raw/main/ofl/pixelifysans/PixelifySans%5Bwght%5D.ttf` →
`public/fonts/PixelifySans.ttf` y `https://github.com/google/fonts/raw/main/ofl/pixelifysans/OFL.txt` → `public/fonts/OFL.txt`.

## Sonido

Todo el sonido se genera con Web Audio (`src/ui/audio.ts`, sonidos descritos en `src/data/sounds.ts`), sin archivos
con derechos: disparo, golpe, recoger, moneda, puerta, sala limpia, daño, compra, curación, menús y una música de
fondo compuesta para el juego. Los gritos de los Pokémon salen de PokeAPI (`cries.latest`) al elegir Pokémon, al
salir el jefe y en el gacha. El navegador solo deja sonar tras el primer clic, tecla o botón. El volumen de música y
efectos se guarda en el navegador (`pokeisaac.audio`, en `src/data/save.ts`).

## Menú principal

El juego arranca en el menú: **Jugar** (hueco → Pokémon → modo), **Gacha** (gasta tickets para desbloquear Pokémon), **Pokédex**, **Mejoras**, **Controles** y **Ajustes**. Esc o B vuelven atrás desde la
selección de inicial. Abajo se ven los Pokémon desbloqueados y el récord de cada modo.

## Ajustes

Desde el menú principal y desde la pausa (`src/scenes/SettingsScene.ts`): volumen de música y de efectos (izquierda/
derecha, clic en ◀ ▶), pantalla completa, controles y **Borrar progreso** (con doble confirmación: borra Pokémon,
tickets, récords y partidas, pero no el volumen). Arriba/abajo para elegir, Enter/A/clic para usar, Esc/B o "Volver".

## Pausa y partidas guardadas

Funciona como en Isaac. **Jugar** abre los 3 huecos de partida: uno vacío empieza una nueva; uno ocupado deja
*Continuar* o *Nueva partida* (pide confirmación antes de sobrescribir). La partida se guarda sola al entrar en
una sala, al limpiarla, al coger un objeto y al salir desde la pausa (con el número de piso); se borra al morir o
al completar la partida.
Si sales en mitad de un combate, al continuar esa sala se reinicia con los enemigos enteros. Tickets y
desbloqueos son comunes a los 3 huecos; las monedas son de cada partida. El guardado vive en `src/data/runSave.ts` (claves `pokeisaac.run.0..2`).

La pausa muestra tus estadísticas, objetos y poderes, y tiene *Reanudar*, *Reiniciar* (con confirmación),
*Controles*, *Ajustes* y *Salir y guardar*.

## Gacha, tickets y monedas

Hay dos monedas distintas:

- **Tickets** (fuera de la partida, `src/data/save.ts`): sirven para el gacha y las mejoras. Antes se llamaban "monedas"; el
  saldo guardado se pasa solo a tickets (`pokeisaac.coins` → `pokeisaac.tickets`).
- **Monedas** (dentro de la partida, `src/data/loot.ts`): caen a veces de los enemigos y al limpiar salas, se recogen
  pisándolas, se ven en el HUD (●) y en la pausa, y solo sirven en la tienda. Se pierden al acabar la partida.

Los tickets se ganan jugando (15 por sala limpiada, +5 por cada piso; 60 × número de piso por el jefe) y se guardan en el navegador; nunca se
compran con dinero real. Todos los nombres (Pokémon, movimientos y tipos) salen en español: los de Pokémon vienen en
`species-index.json` (`nameEs`) y, si faltan, de `pokemon-species/{id}`. Una tirada cuesta 100 y da un Pokémon según su rareza (común, raro, épico, ultraente
o legendario, de menos a más valiosa; probabilidades en `src/data/gacha.ts`). Si ya lo tenías, devuelve 30 tickets. La lista de especies
se genera sola la primera vez con `npm run dev` (necesita internet); a mano: `node scripts/buildSpeciesIndex.mjs`.

## Mejoras

Como en PokéSurvivor, cada Pokémon tiene sus mejoras permanentes (`src/scenes/UpgradeScene.ts`, reglas en
`src/data/upgrades.ts`): **Daño** (+8 % por nivel), **PS** (+10), **Velocidad** (+4 %) y **Cadencia** (+6 %), hasta el
nivel 5. Cuestan tickets (40, 80, 120, 160 y 200) y solo se aplican jugando con ese Pokémon, encima de sus
estadísticas y debajo de los objetos de la partida. Izquierda/derecha (o ◀ ▶, LB/RB) cambia de Pokémon, arriba/abajo
elige la mejora y Enter/A/clic la compra. Se guardan en `pokeisaac.upgrades` (`src/data/save.ts`).

## Pokédex

Desde el menú (`src/scenes/PokedexScene.ts`): los 1025 Pokémon, 21 por página, los que tienes en color (con el borde
del color de su rareza) y los que no en silueta. Filtros por región (pestañas con cuántos tienes), nombre, rareza y
**tipo** (T, LT/RT o clic). Enter, A o clic en uno que tengas: suena su grito. Abajo se ve su número, nombre,
rareza y tipos. Los tipos vienen en `species-index.json`.

## Elegir inicial

**Primera partida** (sin ningún Pokémon guardado): eliges **región** (Kanto, Johto, Hoenn, Sinnoh, Teselia, Kalos,
Alola, Galar o Paldea) y luego uno de **sus 3 iniciales**; ese es tu primer Pokémon. Quien ya jugaba antes conserva
Bulbasaur, Charmander y Squirtle (migración automática).

Después, al empezar partida eliges entre tu colección, **dividida por regiones** (pestañas con cuántos tienes de
cada una) y con **filtros por nombre y por rareza**. Cada tarjeta muestra tipos, rareza y las 6 estadísticas en barras; 4 por página.

| Acción | Teclado | Ratón | Mando |
|---|---|---|---|
| Cambiar de región | Q / E | Clic en la pestaña | LB / RB |
| Cambiar rareza | R | Clic en "Rareza" | X |
| Buscar por nombre | F y escribir (Retroceso borra, Enter cierra) | Clic en "Buscar" y en las letras | Y, cruceta y A (Y borra, B cierra) |
| Cambiar de página | Flechas al pasar del borde | ◀ ▶ | Cruceta |

Los desbloqueados se guardan en el navegador (`localStorage`, clave `pokeisaac.unlocked`, formato
`{ v: 2, ids: [...] }`); el gacha añade más con `unlockPokemon(id)` de `src/data/save.ts`. Regiones y filtros en
`src/data/regions.ts`.

## Salas con obstáculos

Las salas de combate tienen diseños variados (`src/level/roomLayouts.ts`, elegidos con la semilla del piso y a veces
en espejo; una de cada cinco va vacía): **rocas** y **columnas** que bloquean el paso y los disparos, **hierba alta**
que bloquea el paso y se rompe con dos disparos, **agujeros** que no se cruzan a pie (los disparos pasan por encima)
y **charcos** que te frenan. Nunca tapan el paso entre puertas ni el centro de la sala (lo comprueba un test con BFS).
Los enemigos rodean los obstáculos siguiendo un campo de flujo hacia ti.

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

## Estadísticas de cada Pokémon

Tus estadísticas salen de las de tu Pokémon en PokeAPI (`src/data/pokeStats.ts`); los objetos pasivos van encima:

| Estadística | En el juego |
|---|---|
| PS | Vida máxima |
| Ataque | Daño del disparo |
| At. Esp. | Daño de los poderes |
| Defensa y Def. Esp. | Menos daño recibido |
| Velocidad | Velocidad de movimiento y cadencia |

Un Pokémon medio (unos 70 en cada estadística) juega igual que antes y los extremos tienen límites (la vida, por
ejemplo, va de ×0,7 a ×1,6). Los enemigos y jefes reparten su fuerza (la del piso) según sus estadísticas: mucha
vida, mucho daño o mucha velocidad. Las 6 estadísticas se ven en barras en las tarjetas al elegir Pokémon y en la pausa.

## Evolución en partida

Si tu Pokémon tiene evolución (PokeAPI `evolution-chain`, `src/data/evolution.ts`), evoluciona al llegar a los pisos
2 y 4 (Normal e Infinito), a las rondas 6 y 12 (Oleadas) o a los jefes 3 y 6 (Rush): destello y parpadeo en blanco,
"¡X ha evolucionado!", su grito, sprite, nombre, tipo de disparo y estadísticas nuevas (lo que suben los PS máximos
también te cura). Si la cadena se ramifica (Eevee), sale una al azar. Las mejoras que cuentan son las del Pokémon
que elegiste.

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
  dando bandazos), Planta y Bicho **drenan** (recuperas PS), Lucha, Roca y Tierra **empujan**, Volador empuja más lejos con
  **viento**, Dragón hace **+25 % de daño**, Siniestro **asusta** (huye 1,5 s), Acero **atraviesa** un enemigo más, Hada
  **debilita** (−30 % de daño durante 4 s) y Normal **aturde** 0,3 s. Todos los tipos tienen efecto. Los jefes resisten la
  lentitud, la parálisis y el aturdimiento. Cada ranura de poder del HUD lleva el nombre de su tipo. Tabla en `src/data/status.ts`.
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

- Pisos con salas, obstáculos, puertas, minimapa, Centro Pokémon, tienda, enemigos variados, jefe legendario y objetos.
- Cuatro modos de juego con récords, gacha, Pokédex, mejoras permanentes, evolución en partida, sonido y ajustes.
- Sprites pixel de PokeAPI de frente y de espalda: el personaje mira hacia donde dispara y los enemigos hacia ti.
- Todo en español y manejable con teclado, ratón o mando.

## Estructura

```
src/
  main.ts                 configuración de Phaser (carga la fuente y el audio antes)
  data/                   lógica pura (sin Phaser), con tests
    pokeapi.ts            Pokémon, movimientos, gritos y evoluciones desde PokeAPI, en español y con caché (red)
    speciesIndex.ts       carga (una vez) la lista de especies de public/data (red)
    types.ts              colores y nombres en español de los tipos
    items.ts              estadísticas, objetos pasivos y poderes
    moves.ts              poderes del tipo de tu Pokémon y nombres en español
    pokeStats.ts          estadísticas reales de cada Pokémon → estadísticas de juego
    upgrades.ts           mejoras permanentes: costes, niveles y efecto
    evolution.ts          cadena evolutiva y cuándo se evoluciona en cada modo
    enemies.ts            enemigos por piso, comportamiento por tipo y estadísticas
    status.ts             estados por tipo: quemar, congelar, paralizar…
    loot.ts               monedas de la partida, bayas, pociones, Centro Pokémon y tienda
    gacha.ts              rarezas y tiradas del gacha
    regions.ts            regiones, iniciales y filtros de la colección
    modes.ts              modos de juego, oleadas, arena y récords
    sounds.ts             efectos y música como datos, volumen
    save.ts               tickets, desbloqueos, récords, mejoras, volumen y borrar progreso (localStorage)
    runSave.ts            partidas guardadas en 3 huecos (con migraciones)
    controls.ts           lista de controles que enseñan el menú, la pausa y los ajustes
  level/                  lógica pura de los pisos, con tests
    floorGen.ts           generador de pisos (determinista por semilla), Centro y tienda
    roomLayouts.ts        plantillas de sala con obstáculos, conectividad y campo de flujo
    progression.ts        pisos: tamaño, dificultad, tickets y jefes legendarios
  ui/
    theme.ts              tema: fuente, colores, cuadros, barra de PS, fichas de tipo y transiciones
    nav.ts                entrada de menús (NavInput, PadButtons) y botones (MenuList, addPanel)
    cards.ts              tarjeta de Pokémon con estadísticas, carga de sprites y botón "Volver"
    collection.ts         barra de filtros (región, nombre, rareza, tipo) y teclado de búsqueda
    audio.ts              efectos, música y gritos con Web Audio
  scenes/
    MenuScene.ts          menú principal
    SlotsScene.ts         los 3 huecos de partida
    StarterScene.ts       elegir Pokémon de tu colección
    FirstStarterScene.ts  primera partida: elegir región e inicial
    ModeScene.ts          elegir modo de juego
    GameScene.ts          la partida: salas, jugador, enemigos, poderes, tienda, evolución y HUD
    minimap.ts            minimapa
    GachaScene.ts         gacha
    PokedexScene.ts       Pokédex con todos los Pokémon y filtros
    UpgradeScene.ts       mejoras permanentes por Pokémon
    SettingsScene.ts      ajustes: volumen, pantalla completa, controles y borrar progreso
    PauseScene.ts         pausa (la última escena, se dibuja encima)
tests/                    un archivo por módulo de data/, level/ y ui/theme.ts (`npm test`, Node 22.6+)
scripts/
  buildSpeciesIndex.mjs   genera public/data/species-index.json desde PokeAPI (nombres en español, tipos, rareza)
  ensureIndex.mjs         lo genera antes de dev/build si no existe
public/
  data/species-index.json lista de las 1025 especies
  fonts/PixelifySans.ttf  fuente pixel (OFL)
```

## Modo Normal

La partida tiene **5 pisos** (`FLOOR_COUNT` en `src/level/progression.ts`). Cada piso tiene salas de inicio,
combate, objeto (marco amarillo), Centro Pokémon (rosa), tienda (verde) y jefe (marco rojo): el primero tiene de 8 a 12 salas y cada piso suma 2 más.
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

Las partidas de cualquier modo se guardan en los huecos (`RUN_VERSION` 6; los guardados de versiones
anteriores se migran solos).
En Oleadas, al continuar se repite la ronda en la que estabas.

## Siguientes pasos

1. ~~Generación procedural del piso con salas y puertas.~~ Hecho (modo Normal, versión inicial).
2. ~~Objetos y bayas que modifican estadísticas.~~ Hecho (pasivos, poderes y estados por tipo).
3. ~~Jefes y modos: Normal, Oleadas, Infinito y Rush de jefes.~~ Hecho.
4. ~~Gacha con tickets ganados jugando~~ Hecho (común, raro, épico, ultraente y legendario).
5. Empaquetado como app con Tauri o Electron.
