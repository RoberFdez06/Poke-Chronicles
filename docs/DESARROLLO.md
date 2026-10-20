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
| Usar (Centro Pokémon, tienda, cofre) | Enter cerca, o pisarlo | Clic en el mostrador, el artículo o el cofre | A cerca, o pisarlo |
| Soltar bomba | E | Clic en la bomba del HUD | RB |
| Objeto activo | Espacio | Clic en su cuadro (abajo a la izquierda) | LB |
| Beber poción | C | Clic en la poción del HUD | Pulsar el stick izquierdo (L3) |
| Ver el resumen (al morir o ganar) | R | Clic | Start |
| Consejo del tutorial: cerrar / no más consejos | T / N | "Vale" / "No más consejos" | RT / LT |
| Menús | Flechas o W A S D, Enter / espacio, Esc para volver | Pasar el cursor, clic y botón "Volver" | Stick o cruceta, A para elegir, B para volver |

Las teclas de la tabla son las de **por defecto**: se cambian en **Ajustes > Controles y teclas** (elige la acción,
pulsa la tecla nueva; avisa si ya la usa otra acción; "Restablecer" vuelve a las de siempre). Se guardan aparte del
progreso (`pokeisaac.keys`, como el volumen) y las usan la partida y los menús (en los menús las flechas, Espacio y
Retroceso valen siempre). Los botones del mando no se cambian.

**Regla del proyecto:** todo se puede manejar con teclado, con ratón y con mando, cada uno por sí solo. Cualquier
pantalla o acción nueva debe cumplirlo.

## Pantalla

El juego se dibuja a **1920×1080** (16:9) y se adapta a cualquier ventana (en pantallas 16:9 la llena; en otras deja
bandas). Los tamaños están en `src/ui/layout.ts`. Las pantallas de menú se componen en un espacio de diseño de
960×640 que la cámara escala ×1,6875 sin suavizar (los textos se generan a doble resolución, así que se ven nítidos) y
los fondos llenan también los lados. En la partida la sala se ve **entera en el centro** (×1,5, con sus cuatro
puertas) y el HUD va en las franjas de alrededor: a la izquierda la pausa, tu Pokémon con sus PS, monedas, llaves y
bombas, los objetos y el objeto activo; a la derecha el minimapa y los cuatro poderes; arriba la barra del jefe.

## Sprites

El jugador, los enemigos y los jefes usan los sprites animados de **PMDCollab SpriteCollab** (estilo Mystery
Dungeon, `src/data/pmdAnim.ts` y `src/ui/pmdSprites.ts`): miran a la más cercana de las **8 direcciones** (el
jugador, hacia donde dispara o se mueve; los enemigos, hacia ti), andan con la animación de caminar y, quietos, con la
de reposo. Si un Pokémon no tiene sprite allí o falla la descarga, se usa el de PokeAPI. Los shinies usan el de
PokeAPI (para que se vea su color).

## Créditos

- Datos de Pokémon: [PokeAPI](https://pokeapi.co/).
- Sprites animados: [PMDCollab SpriteCollab](https://sprites.pmdcollab.org/), licencia CC BY-NC 4.0.
- Fuente: Pixelify Sans (licencia SIL Open Font License).
- Pokémon es de Nintendo, Game Freak y The Pokémon Company. Este es un fan game gratuito y sin ánimo de lucro.

También se ven en el juego: Ajustes → Créditos.

## Aspecto

Interfaz al estilo de los juegos de Pokémon: cuadros de texto con borde doble y esquinas redondeadas, flecha ▶
en la opción elegida, barras de PS verde/amarilla/roja con la etiqueta "PS", fichas de tipo y fundidos entre
pantallas. Fuente, colores y piezas comunes en `src/ui/theme.ts`.

En la partida todo es pixel art generado por código (`src/ui/art/`): las salas normales tienen suelo y paredes de
baldosas de su bioma, y rocas, hierba alta, agujeros, charcos y columnas con su dibujo (`tiles.ts`); monedas,
bayas, llaves, bombas, cofres, la trampilla, los objetos del suelo (bolsa = pasivo, disco del color del tipo = poder,
Poké Ball = activo), los artículos de la tienda y el contador del HUD usan los iconos de `icons.ts`. Las salas
especiales (tesoro, tienda, Centro Pokémon, secreta, desafío) conservan su color de suelo para reconocerlas.

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

**Rendimiento (T41)**: "Efectos visuales: Altos/Bajos" (bajos quita las partículas decorativas, los temblores de cámara
y reduce el clima) y "Mostrar FPS" (contador abajo a la derecha en la partida); se guardan en `pokeisaac.fx` y se aplican
al empezar el siguiente piso. Con efectos altos hay un tope de partículas (`FxBudget`, 14 cada 100 ms). La cámara de la
partida solo pinta la sala actual (antes pintaba las ~9 salas del piso cada fotograma). Medida: `tests/e2e/perf.spec.ts`
(30 enemigos disparando; `PERF_CPU=4`, `PERF_LOW=1`, `PERF_PROFILE=1` para el perfil de CPU).

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

Los tickets se ganan jugando (1 por sala limpiada y 1 × número de piso por el jefe: una partida completa da unos 60, una tirada cada 2-3 partidas buenas) y se guardan en el navegador; nunca se
compran con dinero real. Todos los nombres (Pokémon, movimientos y tipos) salen en español: los de Pokémon vienen en
`species-index.json` (`nameEs`) y, si faltan, de `pokemon-species/{id}`. Una tirada cuesta 100 y da un Pokémon según su rareza (común, raro, épico, ultraente
o legendario, de menos a más valiosa; probabilidades en `src/data/gacha.ts`). Si ya lo tenías, devuelve 30 tickets. La lista de especies
se genera sola la primera vez con `npm run dev` (necesita internet); a mano: `node scripts/buildSpeciesIndex.mjs`.

## Cuentas y guardado en la nube

- **Invitado** (sin cuenta): se juega normal, pero **no se guarda nada** al cerrar. El menú lo avisa arriba a la derecha.
- **Con cuenta** (Ajustes > Cuenta, o clic en el aviso): el progreso se guarda solo en Firestore (`users/{uid}`). Al
  crearla se sube lo jugado como invitado o lo que hubiera en este navegador de antes. Entrar, salir, recuperar
  contraseña y borrar cuenta (con doble confirmación), con teclado, ratón y mando.
- Pruebas (`npm run e2e`): la bandera `pokeisaac.dev.local` guarda en el navegador como antes, sin Firebase.

Pasos para montar Firebase (ya hechos para `pokeisaac-664d8`):
1. console.firebase.google.com → crear proyecto → añadir app web.
2. Copiar la configuración a `.env.local` (no se sube a git): `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
3. Authentication → activar "Correo electrónico/contraseña". Google es opcional: al activarlo, añade
   `VITE_FIREBASE_GOOGLE=1` a `.env.local` para que salga el botón.
4. Firestore → crear base de datos → pestaña Reglas → pegar `firestore.rules` → Publicar.

## Sin conexión

El juego no depende de que PokeAPI o GitHub respondan:
- **Caché persistente** (`public/sw.js`, un service worker, solo en la versión construida): todo lo descargado de
  PokeAPI, los sprites (PokeAPI y SpriteCollab) y los gritos se guarda y se sirve al instante, también sin red.
- **Paquete sin conexión** (`public/data/offline/`, ~1 MB): datos con nombres en español, tipos, estadísticas,
  habilidades y sprites de los iniciales de las 9 regiones y sus evoluciones, de enemigos de cada bioma y piso y de
  jefes de cada bioma (186 Pokémon), y movimientos con potencia de los 18 tipos. Se regenera con
  `node scripts/buildOffline.ts` (necesita internet).
- Si una petición falla o tarda más de 6 s se usa el paquete; si tampoco está, un **sustituto** con el índice de
  especies y una Poké Ball como sprite. Una imagen que no carga en 8 s también se cambia por la Poké Ball. Sin red,
  los enemigos y el jefe se eligen entre los del paquete. En la partida sale el aviso "Sin conexión".

## Si algo falla

Un error (dentro de una pantalla, o una promesa sin capturar) no deja el juego colgado: sale un cuadro
**"Algo ha fallado"** con el mensaje corto, **Volver al menú** y **Copiar detalles** (copia el informe completo con
la pila, para enviarlo). Se maneja con flechas/Tab + Enter (Esc vuelve al menú), con el ratón o con el mando
(cruceta, A, B). El guardado no se toca. El informe completo también sale en la consola. (`src/ui/errorScreen.ts`,
textos en `src/data/errorReport.ts`.)

## Avisos

Ningún aviso tapa la sala (`src/ui/toast.ts`): sala limpia, objetos, sinergias, misiones y logros, jefe, Centro,
tienda, piso nuevo… salen como **tarjetas** en la franja derecha, debajo del minimapa. Entran deslizando, se apilan
(como mucho 4; la más vieja se va) y se van solas; llevan un icono y un color según el tipo (premio, objeto,
curación, aviso, peligro, misión). Los **consejos del tutorial** van en la franja de abajo. En el centro solo queda
el cartel de fin de partida. Los números que saltan sobre los Pokémon (+PS, ¡Crítico!, monedas) siguen ahí.

## Resumen e historial

Al morir o ganar sale el **resumen** de la partida (tiempo jugado sin contar la pausa, hasta dónde llegaste,
enemigos vencidos, daño hecho, tickets, objetos y si has batido un récord), con **Otra partida**, **Historial** o
**Menú**. El **Historial** guarda tus últimas 20 partidas (`pokeisaac.history`); se abre desde el resumen o desde
**Jugar** (botón junto a Misiones). Lógica en `src/data/runHistory.ts`.

## Tutorial

La primera vez que pasa cada cosa (empezar, primera sala con enemigos, primera sala limpia, primer poder, objeto u
objeto activo, Centro Pokémon, tienda y sala con cofre) sale un **consejo** arriba de la sala con los controles de
teclado, ratón y mando. No para el juego: se cierra solo, con T / RT / "Vale", o se desactivan todos con N / LT /
"No más consejos". Lo visto se guarda (`pokeisaac.tutorial`; "Borrar progreso" lo vuelve a activar). Textos en
`src/data/tutorial.ts`.

## Equilibrio

`node scripts/simulate.ts` saca los premios esperados por piso y **simula 2000 partidas** Normal con la lógica del
juego (`simulateRuns` en `src/data/balance.ts`): tiempo y daño por sala, PS al llegar al jefe, cuánto dura el
jefe, qué parte de las partidas llega a cada piso, tickets y monedas. Es un modelo (los golpes por segundo que
acierta cada enemigo son una suposición, `SIM_DEFAULTS`): sirve para comparar cambios, no para predecir segundos.

## Misiones y logros

En **Jugar**, debajo de los 3 huecos, está **Misiones y logros** (flechas/mando hasta ella y Enter/A, o clic; Esc, B
o "Volver" para salir). Cada día hay **3 misiones diarias** distintas (las mismas todo el día, cambian a
medianoche): vence enemigos de un tipo, llega a un piso sin curarte, abre cofres, recoge monedas, derrota jefes,
limpia salas o coge objetos. Los **logros** son permanentes; algunos desbloquean un Pokémon (Eevee, Dratini) o un
**objeto nuevo** que hasta entonces no sale en el suelo ni en la tienda (Cinta Elegida, Moneda Amuleto, Banda
Focus, Gafas Elegidas). Se cumplen jugando, el premio (tickets) se da solo y en la partida sale un aviso abajo.
Lógica en `src/data/missions.ts` (con tests); el progreso se guarda en `pokeisaac.missions`.

## Shinies

Como en los juegos, a veces sale un Pokémon **shiny** (otro color; sprites `front_shiny`/`back_shiny` de PokeAPI, reglas
en `src/data/shiny.ts`): 1 de cada 64 tiradas del gacha y 1 de cada 200 enemigos. Salen con destellos. Un shiny del
gacha se guarda en tu colección (`pokeisaac.shinies`) y, si lo eliges, juegas con su sprite shiny (también al
evolucionar); su tarjeta lleva una ★. Un enemigo shiny tiene un 50 % más de vida y suelta dos monedas de 5 y una llave.
La Pokédex marca tus shinies con ★ y los cuenta.

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

## Jefes

Además de moverse según su tipo, cada jefe tiene al menos dos ataques con aviso previo (`src/data/bossPatterns.ts`):
**ráfaga en círculo** (brilla en blanco y crece un anillo), **embestida** (marca una línea roja y se lanza por ella) o
**lluvia** (círculos rojos en el suelo, uno donde estás); los de tipo Psíquico, Fantasma, Veneno, Planta, Hada o Hielo
además **invocan ayudantes** (círculos de su color donde saldrán; como mucho 4 a la vez, se van al caer el jefe). Por debajo del 50 % de vida pasa a la **fase 2**: se tiñe de
rojo, va más rápido y ataca más a menudo y con más proyectiles. En cada sala, al menos uno de cada tres enemigos
dispara. `node scripts/simulate.ts` saca los números del equilibrio.

**Enemigos nuevos (T51)**: desde el piso 2, algunos enemigos de cada sala (hasta un 35 %, más cuanto más hondo;
nunca los que disparan) pasan a uno de los 2 comportamientos nuevos del bioma (`twistBehaviors` en bossPatterns.ts):
**tirador** (te rodea a distancia y dispara), **mina** (se acerca, se arma parpadeando en rojo y estalla; como mucho 2),
**escudado** (su escudo para casi todo lo que le llega de frente y gira despacio: hay que rodearlo) y **curandero** (se
queda lejos y cura a los de alrededor con un anillo verde; como mucho 1 por sala).

**Ataques extra por bioma (T50)**: cada jefe suma 2 de estos según el tipo del bioma (`biomeExtraAttacks`: fuego →
onda y zonas, eléctrico → láser y espiral…), y el minijefe usa a veces uno de ellos. Todos avisan antes y se ponen más
duros con el piso, con topes para que se puedan esquivar (`spiralSpec`, `shockwaveSpec`, `laserSpec`, `hazardSpec`):
- **Espiral**: 2-4 brazos de proyectiles que giran (nunca más seguidos que cada 90 ms).
- **Onda expansiva**: 1-3 anillos que crecen desde el jefe con un **hueco** (nunca menos de 50°) por el que pasar; se
  marca dónde estará el primero y cada onda lo tiene en otro sitio.
- **Láser giratorio**: 1-3 rayos que giran despacio (como mucho 75°/s) mientras el jefe se queda quieto; antes se ven
  líneas finas donde saldrán.
- **Zona de peligro**: 3-7 círculos (uno donde estás) que se llenan y estallan (aviso de al menos 0,9 s).

## Biomas

Cada piso tiene un bioma (`src/level/biomes.ts`): Bosque, Cueva, Mar, Volcán, Torre fantasma, Ciudad, Montaña nevada,
Pantano y Cumbre dragón. En Normal van en orden fijo (Bosque → Cueva → Mar → Volcán → Torre fantasma); Infinito,
Rush de jefes y Oleadas (cada 3 rondas) los rotan. Cambian los colores del suelo y las paredes, el aspecto de rocas,
hierba, agujeros y charcos (en el volcán, lava) y el tipo de los enemigos (Bosque → Planta/Bicho, Volcán →
Fuego/Roca, Mar → Agua/Volador…). El jefe legendario intenta ser de un tipo del bioma. Al entrar sale "Piso 2 — Cueva".

**Clima** (`src/data/weather.ts`, efecto en `src/ui/weatherFx.ts`): desde el piso 2 de Normal e Infinito, un 45 % de los
pisos tienen clima según el bioma (sale de la semilla del piso: igual al continuar y en el desafío diario).
**Lluvia** (Agua x1,3, Fuego x0,7), **Día soleado** (al revés), **Tormenta de arena** (cada 4 s, mientras hay
enemigos, un 3 % de daño a quien no sea Roca/Tierra/Acero; al jugador nunca lo baja de 1 PS y a los jefes no les
afecta), **Granizo** (igual, salvo Hielo) y **Niebla** (oscurece los bordes alrededor del jugador). Se ve en el HUD
junto al piso y con un aviso al empezar.

## Controles táctiles y pantalla de Controles

- **Pantalla de Controles** (`src/scenes/ControlsScene.ts`, datos en `controlSections` de `src/data/controls.ts`): desde la
  pausa y desde Ajustes (encima de la pausa). Pestañas **Teclado**, **Ratón**, **Mando** y **Táctil** (esta solo en móvil o
  tableta) con todas las acciones; se cambia con izquierda/derecha, LB/RB o clic, y se cierra con Esc, B, Enter, A o
  "← Volver". Las teclas que enseña son las configuradas.
- **Táctil** (`src/ui/touchControls.ts`): solo si la pantalla es táctil y no hay ratón (`touchOnlyDevice`; en PC nunca).
  Joystick izquierdo para moverse, joystick derecho para disparar hacia donde lo empujes, botones 1-4 (poderes),
  Activo, Bomba y Usar; la pausa es el botón ❚❚ del HUD. En los menús, tocar = clic. La página no hace zoom ni
  scroll al tocar (`touch-action: none` y viewport sin zoom en `index.html`).

## Salas sorpresa

Desde el piso 2 de Normal e Infinito, más o menos uno de cada tres pisos tiene una **sala sorpresa** (`src/level/roomEvents.ts`):
una sala de combate (nunca la del minijefe ni las de cofre) que guarda otra cosa. Se marca en el minimapa con un rombo de
color al descubrirla, hasta resolverla.
- **Pokémon raro** (celeste): el Pokémon más fuerte del piso, brillante, que huye de ti; si lo vences en 12 s da
  tickets (3 + piso) y un objeto; si no, se escapa.
- **Mercader ambulante** (turquesa): tres objetos o poderes por 8, 14 y 22 monedas; compras uno y se marcha.
- **Altar** (morado): das un 15 % de tus PS máximos (para el resto de la partida) a cambio de un objeto.
- **Cofre misterioso** (dorado): se abre sin llave; a veces es una trampa y sale un Pokémon fuerte que suelta el objeto.
- **Entrenador rival** (rojo, T48): 3 oleadas cortas seguidas; al ganar, otros tantos tickets como da la sala (el doble).
- **Fuente curativa** (azul claro): cura la mitad de los PS pagando monedas (6 + 2 × piso) o gratis, pero vas un 20 % más
  lento las 2 salas siguientes ("Cansado" en el HUD).
- **Sala del tiempo** (ámbar, desde el piso 3): 20 s de reloj; si limpias antes, cae un objeto; si no, entran más enemigos.
- **Huevo misterioso** (rosa): lo coges y eclosiona tras 2 salas limpias ("Huevo (n)" en el HUD): un 60 % sale un
  ayudante (un Pokémon del piso que te sigue y ataca al enemigo más cercano; se guarda y pasa de piso) y si no, un objeto.
- Cada evento tiene su peso según el piso (`eventWeights`): arriba más huevos, fuentes y mercaderes; abajo, más rivales
  y salas del tiempo. Al entrar, el aviso dice el premio y el riesgo.

Se usan con Enter / A / clic cerca (como el cofre o la tienda).

## Salas con obstáculos

Las salas de combate tienen diseños variados (`src/level/roomLayouts.ts`, elegidos con la semilla del piso y a veces
en espejo; una de cada cinco va vacía): **rocas** y **columnas** que bloquean el paso y los disparos, **hierba alta**
que bloquea el paso y se rompe con dos disparos, **agujeros** que no se cruzan a pie (los disparos pasan por encima)
y **charcos** que te frenan. Nunca tapan el paso entre puertas ni el centro de la sala (lo comprueba un test con BFS).
Los enemigos rodean los obstáculos siguiendo un campo de flujo hacia ti.

## Llaves, cofres, bombas y salas especiales

- **Llaves y bombas**: los enemigos a veces las sueltan (5 % cada una); empiezas con una bomba. Se ven en el HUD (junto a
  las monedas) y en la pausa.
- **Cofres**: dos salas de combate por piso tienen uno. Se abren con una llave (pisándolo, Enter / A cerca o clic):
  un objeto, monedas, o una baya y una bomba.
- **Bombas** (E, RB o clic en la bomba del HUD): estallan al poco; dañan a los enemigos (y a ti si estás cerca),
  rompen rocas y hierba alta y abren las paredes con **grieta**.
- **Sala secreta**: una por piso, pegada a otras salas y sin puerta visible: la pista es una grieta en la pared.
  Al abrirla con una bomba sale en el minimapa (punto morado); dentro hay un objeto y monedas.
- **Sala de desafío** (marco plateado): al entrar se cierra y salen tres oleadas; al ganarlas, un objeto, monedas,
  una llave y una Baya Zidra.
- `floorGen` las coloca con su propio generador (diseño de piso 3); las partidas guardadas de antes conservan su piso.

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

## Habilidades

Tu Pokémon juega con su **habilidad real** de PokeAPI (la primera que no es oculta; al evolucionar puede cambiar),
con un efecto pasivo sencillo: Mar Llamas, Espesura, Torrente y Enjambre (+50 % al daño de su tipo con menos de 1/3
de PS), Intimidación (−15 % de daño recibido), Levitación (cruzas los agujeros), Velo Arena, Elec. Estática,
Potencia, Robustez, Sebo, Recogida… (unas 40 en `src/data/abilities.ts`). Las demás dan +5 % de daño. Se ve en la
pausa.

## Evolución en partida

Si tu Pokémon tiene evolución (PokeAPI `evolution-chain`, `src/data/evolution.ts`), evoluciona al llegar a los pisos
2 y 4 (Normal e Infinito), a las rondas 6 y 12 (Oleadas) o a los jefes 3 y 6 (Rush): destello y parpadeo en blanco,
"¡X ha evolucionado!", su grito, sprite, nombre, tipo de disparo y estadísticas nuevas (lo que suben los PS máximos
también te cura). Si la cadena se ramifica (Eevee), sale una al azar. Las mejoras que cuentan son las del Pokémon
que elegiste.

## Combate

- **Disparo continuo** como en Isaac: mantén una flecha y el Pokémon dispara solo, mirando hacia esa dirección.
  Los disparos tienen el color del tipo de tu inicial.
- **Objetos pasivos** (más de 40, con nombres de objetos de Pokémon): además de mejorar daño, cadencia, alcance,
  velocidad o PS, hay efectos especiales: críticos (Lente Zoom, Periscopio, Garra Afilada), disparos que persiguen
  (Telescopio), disparo hacia atrás (Cola Gemela), escudo para el primer golpe de cada sala (Gafas Protectoras),
  aguantar con 1 PS (Banda Focus), robo de vida (Concha Campana), daño a quien te toca (Casco Dentado), esquivar
  (Polvo Brillo), más alcance por enemigo vivo (Pokéradar), monedas dobles (Moneda Amuleto) y un potenciador por
  tipo (Carbón, Agua Mística, Imán…: +25 % a los poderes de su tipo). Se acumulan.
- **Objetos activos** (una ranura aparte, se usan con Espacio, LB o clic y se recargan limpiando salas): Poké Flauta
  (aturde a todos), Repelente (los enemigos huyen 5 s), Pokéblock (cura 35 PS) y Ataque X (+50 % de daño 8 s); T49:
  Poción (cura 40 PS), Caramelo Raro (daño ×2 5 s), Teletransporte (a la sala de inicio; no en la del jefe ni en arenas),
  Bomba Cebo (gran explosión que solo daña a los enemigos) y Silbato (inmune 2 s). Si coges otro, el que llevabas se
  queda en el suelo.
- **Pociones** (T49): a veces cae una poción; llevas hasta 3 (contador morado del HUD) y cada una cura 30 PS con C, L3,
  clic en el contador o el botón táctil "Poción".
- **Sinergias** (`src/data/synergies.ts`): ciertas combinaciones dan un efecto extra y avisan con "¡Sinergia!", por
  ejemplo Carbón + un poder de Fuego (quemaduras el doble de fuertes), dos objetos "Elegido", Lente Zoom + Periscopio
  o Concha Campana + Restos. Se ven en la pausa.
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
    synergies.ts          objetos activos y sinergias entre objetos y poderes
    pmdAnim.ts            dirección de 8 y lectura de AnimData.xml de SpriteCollab
    bossPatterns.ts       ataques de los jefes, su fase 2 y la mezcla de enemigos que disparan
    balance.ts            premios esperados por piso y partida (equilibrio, con tests)
    shiny.ts              probabilidades y efectos de los shinies
    loot.ts               monedas de la partida, bayas, pociones, Centro Pokémon y tienda
    gacha.ts              rarezas y tiradas del gacha
    regions.ts            regiones, iniciales y filtros de la colección
    modes.ts              modos de juego, oleadas, arena y récords
    sounds.ts             efectos y música como datos, volumen
    save.ts               tickets, desbloqueos, récords, mejoras, misiones, tutorial, volumen y borrar progreso (localStorage)
    tutorial.ts           consejos del tutorial (textos y cuáles se han visto)
    abilities.ts          habilidades de PokeAPI: cuál toca, nombre en español y efecto
    offline.ts            sin conexión: ruta de cada respuesta en el paquete, sustituto y tiempo límite
    errorReport.ts        mensaje corto e informe de un error; errores del navegador que no cuentan
    keybinds.ts           teclas configurables: acciones, teclas por defecto, conflictos y nombres en pantalla
    runHistory.ts         registro de cada partida terminada, historial de las últimas 20 y contadores
    missions.ts           misiones diarias (semilla del día) y logros: progreso, premios y objetos bloqueados
    runSave.ts            partidas guardadas en 3 huecos (con migraciones)
    controls.ts           lista de controles que enseñan el menú, la pausa y los ajustes
  level/                  lógica pura de los pisos, con tests
    floorGen.ts           generador de pisos (determinista por semilla), Centro y tienda
    biomes.ts             biomas: colores, tipos de enemigos y del jefe por piso
    roomLayouts.ts        plantillas de sala con obstáculos, conectividad y campo de flujo
    progression.ts        pisos: tamaño, dificultad, tickets y jefes legendarios
  ui/
    toast.ts              avisos en tarjetas apiladas en la franja del HUD
    errorScreen.ts        pantalla "Algo ha fallado" (HTML encima del juego) y vuelta al menú
    keys.ts               de nombre de tecla a código de Phaser y al revés
    layout.ts             tamaños de pantalla (1920×1080), espacio de diseño de los menús y franjas del HUD
    theme.ts              tema: fuente, colores, cuadros, barra de PS, fichas de tipo y transiciones
    nav.ts                entrada de menús (NavInput, PadButtons) y botones (MenuList, addPanel)
    cards.ts              tarjeta de Pokémon con estadísticas, carga de sprites y botón "Volver"
    collection.ts         barra de filtros (región, nombre, rareza, tipo) y teclado de búsqueda
    audio.ts              efectos, música y gritos con Web Audio
    pmdSprites.ts         carga de los sprites animados de SpriteCollab y sus animaciones
    art/                  pixel art por código: iconos, baldosas de bioma, paisajes y gacha (del supervisor)
  scenes/
    MenuScene.ts          menú principal
    SlotsScene.ts         los 3 huecos de partida y acceso a Misiones e Historial
    MissionsScene.ts      misiones de hoy y logros
    SummaryScene.ts       resumen al morir o ganar
    HistoryScene.ts       historial de las últimas partidas
    KeysScene.ts          cambiar las teclas (Ajustes > Controles y teclas)
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
tests/e2e/                pruebas en navegador con Playwright (npm run e2e): recorridos completos con teclado (flow),
                          ratón (mouse) y mando simulado (pad), Controles/táctil, jefe, errores, sin conexión,
                          teclas, rendimiento (perf) y capturas
tests/                    un archivo por módulo de data/, level/ y ui/theme.ts (`npm test`, Node 22.6+)
scripts/
  buildSpeciesIndex.mjs   genera public/data/species-index.json desde PokeAPI (nombres en español, tipos, rareza)
  ensureIndex.mjs         lo genera antes de dev/build si no existe
  simulate.ts             números del equilibrio (node scripts/simulate.ts)
  buildOffline.ts         genera public/data/offline/ para jugar sin conexión (node scripts/buildOffline.ts)
  makePlaceholder.ts      dibuja la Poké Ball genérica de los sustitutos
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
| **Desafío diario** | Una partida de Normal igual para todos ese día: inicial del día (uno de los iniciales de cada región), y pisos, jefes, tesoros, cofres, tienda y objetos que caen salen de la semilla del día (`src/data/daily.ts`). Solo cuenta la **primera** partida del día (aunque la dejes a medias); se puede repetir sin récord. | Pisos de hoy, mejor resultado y racha de días (`pokeisaac.daily`) |

**Dificultad** (`src/data/difficulty.ts`): en la pantalla de modos, con izquierda/derecha (teclado o mando) o clic en ◀ ▶,
se elige Fácil, Normal o Difícil. Fácil: enemigos con 75 % de vida y 65 % de daño, curas x1,3 y la mitad de tickets.
Difícil: 130 % de vida, 135 % de daño, curas x0,8 y 1,5 veces los tickets. Cada dificultad tiene sus récords
(Normal en `pokeisaac.records`, las otras en `pokeisaac.records.easy` / `.hard`). Se ve en la pausa y en el hueco.
El desafío diario siempre es Normal.

Las partidas de cualquier modo se guardan en los huecos (`RUN_VERSION` 13; los guardados de versiones
anteriores se migran solos).
En Oleadas, al continuar se repite la ronda en la que estabas.

## Siguientes pasos

1. ~~Generación procedural del piso con salas y puertas.~~ Hecho (modo Normal, versión inicial).
2. ~~Objetos y bayas que modifican estadísticas.~~ Hecho (pasivos, poderes y estados por tipo).
3. ~~Jefes y modos: Normal, Oleadas, Infinito y Rush de jefes.~~ Hecho.
4. ~~Gacha con tickets ganados jugando~~ Hecho (común, raro, épico, ultraente y legendario).
5. Empaquetado como app con Tauri o Electron.

## Licencia

Todos los derechos reservados (ver [LICENSE](LICENSE)). El código se puede ver, pero no copiar, modificar ni redistribuir sin permiso del autor. Pokémon pertenece a Nintendo, Game Freak y The Pokémon Company; esto es un fan game gratuito.
