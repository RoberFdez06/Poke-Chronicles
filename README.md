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

## Menú principal

El juego arranca en el menú: **Jugar** (elegir inicial), **Gacha** (gasta monedas para desbloquear Pokémon) y **Controles**. Esc o B vuelven atrás desde la
selección de inicial.

## Pausa y partidas guardadas

Funciona como en Isaac. **Jugar** abre los 3 huecos de partida: uno vacío empieza una nueva; uno ocupado deja
*Continuar* o *Nueva partida* (pide confirmación antes de sobrescribir). La partida se guarda sola al entrar en
una sala, al limpiarla, al coger un objeto y al salir desde la pausa (con el número de piso); se borra al morir o
al completar la partida.
Si sales en mitad de un combate, al continuar esa sala se reinicia con los enemigos enteros. Monedas y
desbloqueos son comunes a los 3 huecos. El guardado vive en `src/data/runSave.ts` (claves `pokeisaac.run.0..2`).

La pausa muestra tus estadísticas, objetos y poderes, y tiene *Reanudar*, *Reiniciar* (con confirmación),
*Controles* y *Salir y guardar*.

## Gacha y monedas

Las monedas se ganan jugando (15 por sala limpiada, +5 por cada piso; 60 × número de piso por el jefe) y se guardan en el navegador; nunca se
compran con dinero real. Una tirada cuesta 100 y da un Pokémon según su rareza (común, raro, épico, legendario
o ultraente; probabilidades en `src/data/gacha.ts`). Si ya lo tenías, devuelve 30 monedas. La lista de especies
se genera sola la primera vez con `npm run dev` (necesita internet); a mano: `node scripts/buildSpeciesIndex.mjs`.
Con más de 8 desbloqueados, la pantalla de inicial se divide en páginas (◀ ▶ con ratón, izquierda/derecha con teclado o mando).

## Elegir inicial

Al abrir el juego eliges entre los iniciales desbloqueados (de momento Bulbasaur, Charmander y Squirtle).
Los desbloqueados se guardan en el navegador (`localStorage`, clave `pokeisaac.unlocked`); el gacha usará
`unlockPokemon(id)` de `src/data/save.ts` para añadir más.

## Combate

- **Disparo continuo** como en Isaac: mantén una flecha y el Pokémon dispara solo, mirando hacia esa dirección.
  Los disparos tienen el color del tipo de tu inicial.
- **Objetos pasivos** (nombres provisionales): mejoran daño, cadencia, alcance, velocidad, PS, disparos extra,
  atravesar enemigos, rebotes y curación al limpiar salas. Se acumulan.
- **Poderes**: movimientos al azar de PokeAPI que aparecen como objetos y ocupan una ranura (teclas 1-4).
  La potencia decide cómo salen: disparo rápido (<50), anillo (50-69), abanico (70-99) o proyectil grande
  que atraviesa (100+); a más potencia, más recarga. Con las 4 ranuras llenas, el siguiente sustituye al más antiguo.
- Los objetos salen siempre en la sala de objeto y, a veces (25 %), al limpiar una sala de combate.

## Qué hay en esta base

- Piso con salas, puertas, minimapa, jefe al azar de PokeAPI y objetos.
- Sprites pixel de PokeAPI de frente y de espalda: el personaje mira hacia donde dispara y los enemigos hacia ti.
- Pantalla de selección de inicial antes de cada partida.

## Estructura

```
src/
  main.ts              configuración de Phaser
  data/pokeapi.ts      Pokémon y movimientos desde PokeAPI (con caché)
  data/types.ts        colores por tipo
  data/items.ts        estadísticas, objetos pasivos y poderes (puro, testeable)
  data/gacha.ts        rarezas y tiradas del gacha (puro, aún sin conectar al juego)
  data/save.ts         Pokémon desbloqueados guardados en el navegador
  scenes/MenuScene.ts     menú principal
  scenes/StarterScene.ts  pantalla para elegir inicial
  data/speciesIndex.ts carga (una vez) la lista de especies de public/data
  level/floorGen.ts    generador de pisos (puro, determinista por semilla)
  level/progression.ts pisos: tamaño, dificultad, monedas y jefes legendarios (puro)
  scenes/GameScene.ts  piso, salas, puertas, jugador, enemigos, habilidades y HUD
  scenes/minimap.ts    minimapa
tests/
  floorGen.test.ts     tests del generador (`npm test`, runner de Node 22.6+)
  items.test.ts        tests de objetos y poderes
  gacha.test.ts        tests de rarezas y gacha
  save.test.ts         tests del guardado de desbloqueos
  runSave.test.ts      tests de las partidas guardadas (y su migración)
  progression.test.ts  tests de pisos, dificultad y jefes
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

## Siguientes pasos

1. ~~Generación procedural del piso con salas y puertas.~~ Hecho (modo Normal, versión inicial).
2. ~~Objetos y bayas que modifican estadísticas.~~ Hecho (pasivos y poderes; faltan efectos de estado por tipo).
3. Jefes y modos: Normal, Oleadas, Infinito y Rush de jefes.
4. Gacha con monedas ganadas jugando (común, raro, épico, legendario y ultraente).
5. Empaquetado como app con Tauri o Electron.
