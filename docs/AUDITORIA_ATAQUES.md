# Auditoría de ataques y fusiones (01/11/2026)

Generada a partir del código (src/data/movePatterns.ts, src/data/moveSignatures.ts, src/data/fusion.ts). La comprueba `tests/attackAudit.test.ts`.

## Resumen

- Ataques del jugador (estilos del catálogo): **120** en 18 tipos. Los movimientos de PokeAPI caen en uno de ellos (famosos por id/nombre; el resto por tipo, potencia e id).
- Antes de la auditoría, **105** de 120 estaban en **28 grupos repetitivos**: mismo patrón y mismos rasgos (p. ej. todas las embestidas, todos los rayos fijos, todas las ondas de suelo) y solo cambiaba el color del tipo o el nombre.
- Ahora cada estilo lleva además un **motivo pixel art propio** (24 dibujos 7×7: llamas, burbujas, chispas, hojas, copos, puño, gotas, terrones, plumas, ojo, cuerno, rocas, espectros, colmillos, zarpas, engranajes, corazones, estrellas, anillo, runa, notas, luna, rombo, espiral) colocado según su forma (cono, línea, anillo, caída, remolino, fila, saltos, brote, estela) y un **tono de sonido** propio. Ninguna pareja de ataques comparte forma + rasgos + motivo (test).
- Fusiones: **171** parejas con estilo único de proyectil (ya lo garantizaba tests/fusion.test.ts), repartidas en **14** combinaciones de patrones. Las combinaciones compartían el mismo arranque; ahora cada una tiene su motivo de arranque (en anillo, con el color del segundo tipo).
- Arreglos de datos: ninguno roto (sin undefined/NaN, sin ids duplicados ni huérfanos, todo en español). El test nuevo lo deja vigilado.

## Ataques del jugador

| Tipo | Ataque | Patrón (rasgos) | Antes se repetía con | Motivo nuevo | Colocación |
|---|---|---|---|---|---|
| Fuego | Ascuas | `shot·rafaga3·recto···` | 4: Pistola Agua (water), Canto Helado (ice), Onda Vacío (fighting), Picotazo Veneno (poison) | llamas | cono |
| Fuego | Lanzallamas | `stream` | 3: Ventisca (ice), Residuos (poison), Aliento Dragón (dragon) | llamas | linea |
| Fuego | Rueda Fuego | `orbit` | 2: Danza Pétalo (grass), Poder Pasado (rock) | llamas | remolino |
| Fuego | Giro Fuego | `vortex` | 3: Torbellino (water), Tornado (flying), Ciclón (dragon) | llamas | remolino |
| Fuego | Onda Ígnea | `wall` | 5: Surf (water), Viento Hielo (ice), Vendaval (flying), Tumba Rocas (rock)… | llamas | fila |
| Fuego | Llamarada | `shot·uno·recto·estalla··grande` | 5: Hidropulso (water), Energibola (grass), Pedrada (rock), Triturar (dark)… | estrellas * | cono |
| Fuego | Erupción | `eruption` | 2: Tierra Viva (ground), Roca Afilada (rock) | llamas | brote |
| Fuego | Envite Ígneo | `dash` | 12: Patada Salto (fighting), A Bocajarro (fighting), Excavar (ground), Pájaro Osado (flying)… | llamas | estela |
| Agua | Pistola Agua | `shot·rafaga3·recto···` | 4: Ascuas (fire), Canto Helado (ice), Onda Vacío (fighting), Picotazo Veneno (poison) | burbujas | cono |
| Agua | Burbuja | `shot·abanico6·wave···` | — | burbujas | cono |
| Agua | Hidropulso | `shot·uno·recto·estalla··grande` | 5: Llamarada (fire), Energibola (grass), Pedrada (rock), Triturar (dark)… | anillo * | cono |
| Agua | Torbellino | `vortex` | 3: Giro Fuego (fire), Tornado (flying), Ciclón (dragon) | burbujas | remolino |
| Agua | Surf | `wall` | 5: Onda Ígnea (fire), Viento Hielo (ice), Vendaval (flying), Tumba Rocas (rock)… | burbujas | fila |
| Agua | Cascada | `rain` | 5: Trueno (electric), Chuzos (ice), Premonición (psychic), Avalancha (rock)… | burbujas | caida |
| Agua | Hidrobomba | `beam·fijo` | 6: Electrocañón (electric), Rayo Solar (grass), Rayo Hielo (ice), Tinieblas (ghost)… | burbujas | linea |
| Eléctrico | Impactrueno | `shot·uno·zigzag···` | — | chispas | cono |
| Eléctrico | Chispa | `shot·abanico3·zigzag···` | — | estrellas * | cono |
| Eléctrico | Rayo | `chain` | 1: Beso Drenaje (fairy) | chispas | saltos |
| Eléctrico | Bola Voltio | `shot·uno·homing···` | 1: Puño Sombra (ghost) | anillo * | cono |
| Eléctrico | Chispazo | `nova·zigzag·` | — | anillo * | anillo |
| Eléctrico | Trueno | `rain` | 5: Cascada (water), Chuzos (ice), Premonición (psychic), Avalancha (rock)… | chispas | caida |
| Eléctrico | Electrocañón | `beam·fijo` | 6: Hidrobomba (water), Rayo Solar (grass), Rayo Hielo (ice), Tinieblas (ghost)… | chispas | linea |
| Planta | Látigo Cepa | `shot·uno·wave···` | 1: Confusión (psychic) | hojas | cono |
| Planta | Hoja Afilada | `shot·abanico4·homing···` | — | rombo * | cono |
| Planta | Hoja Mágica | `shot·abanico2·boomerang··atraviesa·` | 1: Psicocorte (psychic) | estrellas * | cono |
| Planta | Danza Pétalo | `orbit` | 2: Rueda Fuego (fire), Poder Pasado (rock) | corazones * | remolino |
| Planta | Drenadoras | `mine` | 2: Púas Tóxicas (poison), Disparo Demora (bug) | hojas | brote |
| Planta | Energibola | `shot·uno·recto·estalla··grande` | 5: Llamarada (fire), Hidropulso (water), Pedrada (rock), Triturar (dark)… | hojas | cono |
| Planta | Lluvia Hojas | `nova·spiral·anillos` | — | espiral * | anillo |
| Planta | Rayo Solar | `beam·fijo` | 6: Hidrobomba (water), Electrocañón (electric), Rayo Hielo (ice), Tinieblas (ghost)… | anillo * | linea |
| Hielo | Canto Helado | `shot·rafaga3·recto···` | 4: Ascuas (fire), Pistola Agua (water), Onda Vacío (fighting), Picotazo Veneno (poison) | rombo * | cono |
| Hielo | Nieve Polvo | `nova·accel·` | — | rombo * | anillo |
| Hielo | Carámbano | `shot·abanico3·recto··atraviesa·` | 1: Aire Afilado (flying) | rombo * | cono |
| Hielo | Viento Hielo | `wall` | 5: Onda Ígnea (fire), Surf (water), Vendaval (flying), Tumba Rocas (rock)… | copos | fila |
| Hielo | Rayo Hielo | `beam·fijo` | 6: Hidrobomba (water), Electrocañón (electric), Rayo Solar (grass), Tinieblas (ghost)… | copos | linea |
| Hielo | Chuzos | `rain` | 5: Cascada (water), Trueno (electric), Premonición (psychic), Avalancha (rock)… | copos | caida |
| Hielo | Ventisca | `stream` | 3: Lanzallamas (fire), Residuos (poison), Aliento Dragón (dragon) | copos | linea |
| Lucha | Golpe Kárate | `shot·uno·recto···` | 2: Picadura (bug), Mordisco (dark) | zarpas * | cono |
| Lucha | Onda Vacío | `shot·rafaga3·recto···` | 4: Ascuas (fire), Pistola Agua (water), Canto Helado (ice), Picotazo Veneno (poison) | anillo * | cono |
| Lucha | Patada Giro | `nova·recto·` | 1: Brillo Mágico (fairy) | espiral * | anillo |
| Lucha | Esfera Aural | `shot·uno·homing···grande` | — | puno | cono |
| Lucha | Patada Salto | `dash` | 12: Envite Ígneo (fire), A Bocajarro (fighting), Excavar (ground), Pájaro Osado (flying)… | puno | estela |
| Lucha | Puño Drenaje | `shot·uno·recto·estalla··` | — | espiral * | cono |
| Lucha | Demolición | `quake` | 5: Onda Tóxica (poison), Terremoto (ground), Alarido (dark), Cola Férrea (steel)… | rocas * | anillo |
| Lucha | A Bocajarro | `dash` | 12: Envite Ígneo (fire), Patada Salto (fighting), Excavar (ground), Pájaro Osado (flying)… | espiral * | estela |
| Veneno | Picotazo Veneno | `shot·rafaga3·recto···` | 4: Ascuas (fire), Pistola Agua (water), Canto Helado (ice), Onda Vacío (fighting) | cuerno * | cono |
| Veneno | Ácido | `shot·abanico3·wave···` | — | burbujas * | cono |
| Veneno | Púas Tóxicas | `mine` | 2: Drenadoras (grass), Disparo Demora (bug) | gotas | brote |
| Veneno | Bomba Lodo | `lob` | 2: Bomba Fango (ground), Lanzarrocas (rock) | gotas | caida |
| Veneno | Residuos | `stream` | 3: Lanzallamas (fire), Ventisca (ice), Aliento Dragón (dragon) | gotas | linea |
| Veneno | Onda Tóxica | `quake` | 5: Demolición (fighting), Terremoto (ground), Alarido (dark), Cola Férrea (steel)… | anillo * | anillo |
| Tierra | Bofetón Lodo | `shot·abanico3·recto···` | 4: Garra Umbría (ghost), Garra Dragón (dragon), Garra Metal (steel), Triataque (normal) | gotas * | cono |
| Tierra | Huesomerang | `shot·uno·boomerang··atraviesa·` | 2: Desarme (dark), Disco Espejo (steel) | terrones | cono |
| Tierra | Bomba Fango | `lob` | 2: Bomba Lodo (poison), Lanzarrocas (rock) | terrones | caida |
| Tierra | Excavar | `dash` | 12: Envite Ígneo (fire), Patada Salto (fighting), A Bocajarro (fighting), Pájaro Osado (flying)… | terrones | estela |
| Tierra | Tierra Viva | `eruption` | 2: Erupción (fire), Roca Afilada (rock) | terrones | brote |
| Tierra | Terremoto | `quake` | 5: Demolición (fighting), Onda Tóxica (poison), Alarido (dark), Cola Férrea (steel)… | terrones | anillo |
| Volador | Picotazo | `shot·rafaga4·recto···` | 1: Bala Bala (steel) | plumas | cono |
| Volador | Ataque Ala | `shot·abanico2·recto···` | — | luna * | cono |
| Volador | Aire Afilado | `shot·abanico3·recto··atraviesa·` | 1: Carámbano (ice) | plumas | cono |
| Volador | Tornado | `vortex` | 3: Giro Fuego (fire), Torbellino (water), Ciclón (dragon) | plumas | remolino |
| Volador | Vendaval | `wall` | 5: Onda Ígnea (fire), Surf (water), Viento Hielo (ice), Tumba Rocas (rock)… | plumas | fila |
| Volador | Pájaro Osado | `dash` | 12: Envite Ígneo (fire), Patada Salto (fighting), A Bocajarro (fighting), Excavar (ground)… | plumas | estela |
| Psíquico | Confusión | `shot·uno·wave···` | 1: Látigo Cepa (grass) | ojo | cono |
| Psíquico | Psicorrayo | `beam·barre` | 1: Pulso Dragón (dragon) | ojo | linea |
| Psíquico | Psicocorte | `shot·abanico2·boomerang··atraviesa·` | 1: Hoja Mágica (grass) | luna * | cono |
| Psíquico | Onda Mental | `shot·abanico3·homing···` | 1: Voz Cautivadora (fairy) | runa * | cono |
| Psíquico | Psíquico | `nova·recto·anillos` | 2: Pulso Umbrío (dark), Vozarrón (normal) | anillo * | anillo |
| Psíquico | Premonición | `rain` | 5: Cascada (water), Trueno (electric), Chuzos (ice), Avalancha (rock)… | runa * | caida |
| Bicho | Picadura | `shot·uno·recto···` | 2: Golpe Kárate (fighting), Mordisco (dark) | cuerno | cono |
| Bicho | Pin Misil | `shot·rafaga5·recto···` | — | rombo * | cono |
| Bicho | Tijera X | `shot·abanico2·recto··atraviesa·` | 1: Tajo Umbrío (dark) | zarpas * | cono |
| Bicho | Disparo Demora | `mine` | 2: Drenadoras (grass), Púas Tóxicas (poison) | cuerno | brote |
| Bicho | Zumbido | `nova·wave·` | 1: Rencor (ghost) | notas * | anillo |
| Bicho | Megacuerno | `dash` | 12: Envite Ígneo (fire), Patada Salto (fighting), A Bocajarro (fighting), Excavar (ground)… | cuerno | estela |
| Roca | Lanzarrocas | `lob` | 2: Bomba Lodo (poison), Bomba Fango (ground) | rocas | caida |
| Roca | Pedrada | `shot·uno·recto·estalla··grande` | 5: Llamarada (fire), Hidropulso (water), Energibola (grass), Triturar (dark)… | terrones * | cono |
| Roca | Poder Pasado | `orbit` | 2: Rueda Fuego (fire), Danza Pétalo (grass) | runa * | remolino |
| Roca | Tumba Rocas | `wall` | 5: Onda Ígnea (fire), Surf (water), Viento Hielo (ice), Vendaval (flying)… | rocas | fila |
| Roca | Roca Afilada | `eruption` | 2: Erupción (fire), Tierra Viva (ground) | rocas | brote |
| Roca | Avalancha | `rain` | 5: Cascada (water), Trueno (electric), Chuzos (ice), Premonición (psychic)… | rocas | caida |
| Fantasma | Lengüetazo | `dash` | 12: Envite Ígneo (fire), Patada Salto (fighting), A Bocajarro (fighting), Excavar (ground)… | espectros | estela |
| Fantasma | Garra Umbría | `shot·abanico3·recto···` | 4: Bofetón Lodo (ground), Garra Dragón (dragon), Garra Metal (steel), Triataque (normal) | espectros | cono |
| Fantasma | Puño Sombra | `shot·uno·homing···` | 1: Bola Voltio (electric) | puno * | cono |
| Fantasma | Infortunio | `shot·abanico4·wave···` | — | runa * | cono |
| Fantasma | Tinieblas | `beam·fijo` | 6: Hidrobomba (water), Electrocañón (electric), Rayo Solar (grass), Rayo Hielo (ice)… | espectros | linea |
| Fantasma | Rencor | `nova·wave·` | 1: Zumbido (bug) | luna * | anillo |
| Fantasma | Bola Sombra | `shot·uno·homing·estalla··grande` | — | anillo * | cono |
| Dragón | Aliento Dragón | `stream` | 3: Lanzallamas (fire), Ventisca (ice), Residuos (poison) | colmillos | linea |
| Dragón | Garra Dragón | `shot·abanico3·recto···` | 4: Bofetón Lodo (ground), Garra Umbría (ghost), Garra Metal (steel), Triataque (normal) | colmillos | cono |
| Dragón | Ciclón | `vortex` | 3: Giro Fuego (fire), Torbellino (water), Tornado (flying) | espiral * | remolino |
| Dragón | Pulso Dragón | `beam·barre` | 1: Psicorrayo (psychic) | espiral * | linea |
| Dragón | Enfado | `dash` | 12: Envite Ígneo (fire), Patada Salto (fighting), A Bocajarro (fighting), Excavar (ground)… | colmillos | estela |
| Dragón | Cometa Draco | `rain` | 5: Cascada (water), Trueno (electric), Chuzos (ice), Premonición (psychic)… | estrellas * | caida |
| Siniestro | Mordisco | `shot·uno·recto···` | 2: Golpe Kárate (fighting), Picadura (bug) | colmillos * | cono |
| Siniestro | Tajo Umbrío | `shot·abanico2·recto··atraviesa·` | 1: Tijera X (bug) | luna * | cono |
| Siniestro | Golpe Bajo | `dash` | 12: Envite Ígneo (fire), Patada Salto (fighting), A Bocajarro (fighting), Excavar (ground)… | zarpas | estela |
| Siniestro | Desarme | `shot·uno·boomerang··atraviesa·` | 2: Huesomerang (ground), Disco Espejo (steel) | espiral * | cono |
| Siniestro | Pulso Umbrío | `nova·recto·anillos` | 2: Psíquico (psychic), Vozarrón (normal) | luna * | anillo |
| Siniestro | Alarido | `quake` | 5: Demolición (fighting), Onda Tóxica (poison), Terremoto (ground), Cola Férrea (steel)… | notas * | anillo |
| Siniestro | Triturar | `shot·uno·recto·estalla··grande` | 5: Llamarada (fire), Hidropulso (water), Energibola (grass), Pedrada (rock)… | colmillos * | cono |
| Acero | Bala Bala | `shot·rafaga4·recto···` | 1: Picotazo (flying) | rombo * | cono |
| Acero | Garra Metal | `shot·abanico3·recto···` | 4: Bofetón Lodo (ground), Garra Umbría (ghost), Garra Dragón (dragon), Triataque (normal) | zarpas * | cono |
| Acero | Disco Espejo | `shot·uno·boomerang··atraviesa·` | 2: Huesomerang (ground), Desarme (dark) | anillo * | cono |
| Acero | Cola Férrea | `quake` | 5: Demolición (fighting), Onda Tóxica (poison), Terremoto (ground), Alarido (dark)… | rombo * | anillo |
| Acero | Cabeza de Hierro | `dash` | 12: Envite Ígneo (fire), Patada Salto (fighting), A Bocajarro (fighting), Excavar (ground)… | engranajes | estela |
| Acero | Foco Resplandor | `beam·fijo` | 6: Hidrobomba (water), Electrocañón (electric), Rayo Solar (grass), Rayo Hielo (ice)… | engranajes | linea |
| Hada | Viento Feérico | `wall` | 5: Onda Ígnea (fire), Surf (water), Viento Hielo (ice), Vendaval (flying)… | corazones | fila |
| Hada | Voz Cautivadora | `shot·abanico3·homing···` | 1: Onda Mental (psychic) | notas * | cono |
| Hada | Beso Drenaje | `chain` | 1: Rayo (electric) | corazones | saltos |
| Hada | Brillo Mágico | `nova·recto·` | 1: Patada Giro (fighting) | estrellas * | anillo |
| Hada | Carantoña | `dash` | 12: Envite Ígneo (fire), Patada Salto (fighting), A Bocajarro (fighting), Excavar (ground)… | corazones | estela |
| Hada | Fuerza Lunar | `shot·uno·recto·estalla··grande` | 5: Llamarada (fire), Hidropulso (water), Energibola (grass), Pedrada (rock)… | luna * | cono |
| Normal | Placaje | `dash` | 12: Envite Ígneo (fire), Patada Salto (fighting), A Bocajarro (fighting), Excavar (ground)… | estrellas | estela |
| Normal | Rapidez | `shot·abanico5·homing···` | — | estrellas * | cono |
| Normal | Triataque | `shot·abanico3·recto···` | 4: Bofetón Lodo (ground), Garra Umbría (ghost), Garra Dragón (dragon), Garra Metal (steel) | rombo * | cono |
| Normal | Golpe Cuerpo | `dash` | 12: Envite Ígneo (fire), Patada Salto (fighting), A Bocajarro (fighting), Excavar (ground)… | anillo * | estela |
| Normal | Vozarrón | `nova·recto·anillos` | 2: Psíquico (psychic), Pulso Umbrío (dark) | notas * | anillo |
| Normal | Explosión | `quake` | 5: Demolición (fighting), Onda Tóxica (poison), Terremoto (ground), Alarido (dark)… | estrellas | anillo |
| Normal | Hiperrayo | `beam·fijo` | 6: Hidrobomba (water), Electrocañón (electric), Rayo Solar (grass), Rayo Hielo (ice)… | estrellas | linea |

`*` = motivo propio del estilo (excepción); sin asterisco = motivo de su tipo.

## Grupos repetitivos detectados (antes)

- `shot·rafaga3·recto···` (5): Ascuas (fire), Pistola Agua (water), Canto Helado (ice), Onda Vacío (fighting), Picotazo Veneno (poison)
- `stream` (4): Lanzallamas (fire), Ventisca (ice), Residuos (poison), Aliento Dragón (dragon)
- `orbit` (3): Rueda Fuego (fire), Danza Pétalo (grass), Poder Pasado (rock)
- `vortex` (4): Giro Fuego (fire), Torbellino (water), Tornado (flying), Ciclón (dragon)
- `wall` (6): Onda Ígnea (fire), Surf (water), Viento Hielo (ice), Vendaval (flying), Tumba Rocas (rock), Viento Feérico (fairy)
- `shot·uno·recto·estalla··grande` (6): Llamarada (fire), Hidropulso (water), Energibola (grass), Pedrada (rock), Triturar (dark), Fuerza Lunar (fairy)
- `eruption` (3): Erupción (fire), Tierra Viva (ground), Roca Afilada (rock)
- `dash` (13): Envite Ígneo (fire), Patada Salto (fighting), A Bocajarro (fighting), Excavar (ground), Pájaro Osado (flying), Megacuerno (bug), Lengüetazo (ghost), Enfado (dragon), Golpe Bajo (dark), Cabeza de Hierro (steel), Carantoña (fairy), Placaje (normal), Golpe Cuerpo (normal)
- `rain` (6): Cascada (water), Trueno (electric), Chuzos (ice), Premonición (psychic), Avalancha (rock), Cometa Draco (dragon)
- `beam·fijo` (7): Hidrobomba (water), Electrocañón (electric), Rayo Solar (grass), Rayo Hielo (ice), Tinieblas (ghost), Foco Resplandor (steel), Hiperrayo (normal)
- `chain` (2): Rayo (electric), Beso Drenaje (fairy)
- `shot·uno·homing···` (2): Bola Voltio (electric), Puño Sombra (ghost)
- `shot·uno·wave···` (2): Látigo Cepa (grass), Confusión (psychic)
- `shot·abanico2·boomerang··atraviesa·` (2): Hoja Mágica (grass), Psicocorte (psychic)
- `mine` (3): Drenadoras (grass), Púas Tóxicas (poison), Disparo Demora (bug)
- `shot·abanico3·recto··atraviesa·` (2): Carámbano (ice), Aire Afilado (flying)
- `shot·uno·recto···` (3): Golpe Kárate (fighting), Picadura (bug), Mordisco (dark)
- `nova·recto·` (2): Patada Giro (fighting), Brillo Mágico (fairy)
- `quake` (6): Demolición (fighting), Onda Tóxica (poison), Terremoto (ground), Alarido (dark), Cola Férrea (steel), Explosión (normal)
- `lob` (3): Bomba Lodo (poison), Bomba Fango (ground), Lanzarrocas (rock)
- `shot·abanico3·recto···` (5): Bofetón Lodo (ground), Garra Umbría (ghost), Garra Dragón (dragon), Garra Metal (steel), Triataque (normal)
- `shot·uno·boomerang··atraviesa·` (3): Huesomerang (ground), Desarme (dark), Disco Espejo (steel)
- `shot·rafaga4·recto···` (2): Picotazo (flying), Bala Bala (steel)
- `beam·barre` (2): Psicorrayo (psychic), Pulso Dragón (dragon)
- `shot·abanico3·homing···` (2): Onda Mental (psychic), Voz Cautivadora (fairy)
- `nova·recto·anillos` (3): Psíquico (psychic), Pulso Umbrío (dark), Vozarrón (normal)
- `shot·abanico2·recto··atraviesa·` (2): Tijera X (bug), Tajo Umbrío (dark)
- `nova·wave·` (2): Zumbido (bug), Rencor (ghost)

## Combinaciones de fusión

| Combinación | Partes | Parejas que la usan | Motivo de arranque nuevo |
|---|---|---|---|
| rafaga-onda | ráfaga + onda | 19 (Bicho Superior, Enjambre Voltio, Enjambre Ígneo…) | anillo |
| abanico-perforante | abanico + perforante | 15 (Aguijón Marcial, Aguijón Letal, Brasa Umbría…) | rombo |
| orbitas-lluvia | órbitas + lluvia | 15 (Aguijón Telúrica, Sombra Alada, Colmillo Draco Marcial…) | estrellas |
| mina-ola | ola + minas | 15 (Aguijón Umbría, Aguijón Pétrea, Noche Eterna…) | burbujas |
| rebote-cadena | bumerán + cadena | 8 (Sombra Voltaica, Paradoja, Colmillo Draco Pétrea…) | chispas |
| rayo-estallido | rayo corto + estallido | 10 (Aguijón Glacial, Trueno Draconiano, Leviatán…) | runa |
| erupcion-bomba | columnas + bombas | 10 (Aguijón Dracónica, Sombra Venenosa, Raíz Eléctrica…) | llamas |
| bumeran-espiral | bumerán + espiral | 16 (Aguijón Alada, Sombra Feérica, Dragón Superior…) | espiral |
| terremoto-columnas | temblor + columnas | 10 (Aguijón Pura, Sombra Silvestre, Puño Alada…) | rocas |
| chorro-bomba | chorro + bomba | 9 (Aguijón Marina, Aliento Infernal, Dragón de Hielo…) | gotas |
| embestida-onda | embestida + onda | 11 (Aguijón Fantasmal, Furia Abisal, Golpe Sombrío…) | puno |
| meteoro | meteoro + lluvia | 12 (Sombra Telúrica, Colmillo Draco Fantasmal, Destello Alada…) | luna |
| zigzag-cadena | zigzag + cadena | 13 (Aguijón Feérica, Siniestro Superior, Sombra Pétrea…) | zarpas |
| buscadores | buscadores + anillo | 8 (Eléctrico Superior, Aura Mental, Fuego Superior…) | ojo |

Cada pareja, además, ya tenía forma de proyectil, estela, impacto, movimiento, partículas, escala y tono propios (ui/art/fusionArt.ts); no hay dos con la misma firma.

## Fusiones (171 parejas)

| Pareja | Nombre | Combinación | Forma | Estela | Impacto | Movimiento |
|---|---|---|---|---|---|---|
| Bicho + Bicho | Bicho Superior | rafaga-onda | espora | chispas | anillos | recto |
| Bicho + Siniestro | Aguijón Umbría | mina-ola | runa | cinta | grietas | gira |
| Bicho + Dragón | Aguijón Dracónica | erupcion-bomba | remolino | puntos | espiral | zigzag |
| Bicho + Eléctrico | Enjambre Voltio | rafaga-onda | rayo-doble | trenza | estallido | ondula |
| Bicho + Hada | Aguijón Feérica | zigzag-cadena | colmillo | humo | chispazo | acelera |
| Bicho + Lucha | Aguijón Marcial | abanico-perforante | helice | escamas | esquirlas | recto |
| Bicho + Fuego | Enjambre Ígneo | rafaga-onda | espora | llamas | cruz | gira |
| Bicho + Volador | Aguijón Alada | bumeran-espiral | flor | estrellas | burbujas | zigzag |
| Bicho + Fantasma | Aguijón Fantasmal | embestida-onda | cometa | quebrada | destello | ondula |
| Bicho + Planta | Plaga Verde | rafaga-onda | espora | chispas | petalos | acelera |
| Bicho + Tierra | Aguijón Telúrica | orbitas-lluvia | meteoro | cinta | sello | recto |
| Bicho + Hielo | Aguijón Glacial | rayo-estallido | cristal | puntos | anillos | gira |
| Bicho + Normal | Aguijón Pura | terremoto-columnas | gota | trenza | grietas | zigzag |
| Bicho + Veneno | Aguijón Letal | abanico-perforante | colmillo | humo | espiral | ondula |
| Bicho + Psíquico | Aguijón Psíquica | rafaga-onda | espora | escamas | estallido | acelera |
| Bicho + Roca | Aguijón Pétrea | mina-ola | runa | llamas | chispazo | recto |
| Bicho + Acero | Enjambre Metálico | rafaga-onda | colmillo | estrellas | esquirlas | gira |
| Bicho + Agua | Aguijón Marina | chorro-bomba | anillo | quebrada | cruz | zigzag |
| Siniestro + Siniestro | Siniestro Superior | zigzag-cadena | colmillo | chispas | burbujas | ondula |
| Siniestro + Dragón | Furia Abisal | embestida-onda | colmillo | cinta | destello | acelera |
| Siniestro + Eléctrico | Sombra Voltaica | rebote-cadena | media-luna | puntos | petalos | recto |
| Siniestro + Hada | Sombra Feérica | bumeran-espiral | flor | trenza | sello | gira |
| Siniestro + Lucha | Golpe Sombrío | embestida-onda | colmillo | humo | anillos | zigzag |
| Siniestro + Fuego | Brasa Umbría | abanico-perforante | colmillo | escamas | grietas | ondula |
| Siniestro + Volador | Sombra Alada | orbitas-lluvia | meteoro | llamas | espiral | acelera |
| Siniestro + Fantasma | Noche Eterna | mina-ola | media-luna | estrellas | estallido | recto |
| Siniestro + Planta | Sombra Silvestre | terremoto-columnas | gota | quebrada | chispazo | gira |
| Siniestro + Tierra | Sombra Telúrica | meteoro | rayo-doble | chispas | esquirlas | zigzag |
| Siniestro + Hielo | Sombra Glacial | rafaga-onda | espora | cinta | cruz | ondula |
| Siniestro + Normal | Sombra Pura | mina-ola | runa | puntos | burbujas | acelera |
| Siniestro + Veneno | Sombra Venenosa | erupcion-bomba | remolino | trenza | destello | recto |
| Siniestro + Psíquico | Paradoja | rebote-cadena | runa | humo | petalos | gira |
| Siniestro + Roca | Sombra Pétrea | zigzag-cadena | colmillo | escamas | sello | zigzag |
| Siniestro + Acero | Sombra Férrea | abanico-perforante | helice | llamas | anillos | ondula |
| Siniestro + Agua | Abismo | mina-ola | media-luna | estrellas | grietas | acelera |
| Dragón + Dragón | Dragón Superior | bumeran-espiral | flor | quebrada | espiral | recto |
| Dragón + Eléctrico | Trueno Draconiano | rayo-estallido | rayo-doble | chispas | estallido | gira |
| Dragón + Hada | Fulgor Draco | rafaga-onda | helice | cinta | chispazo | zigzag |
| Dragón + Lucha | Colmillo Draco Marcial | orbitas-lluvia | meteoro | puntos | esquirlas | ondula |
| Dragón + Fuego | Aliento Infernal | chorro-bomba | cometa | trenza | cruz | acelera |
| Dragón + Volador | Ciclón Draco | bumeran-espiral | helice | humo | burbujas | recto |
| Dragón + Fantasma | Colmillo Draco Fantasmal | meteoro | rayo-doble | escamas | destello | gira |
| Dragón + Planta | Colmillo Draco Silvestre | rafaga-onda | espora | llamas | petalos | zigzag |
| Dragón + Tierra | Colmillo Draco Telúrica | mina-ola | runa | estrellas | sello | ondula |
| Dragón + Hielo | Dragón de Hielo | chorro-bomba | helice | quebrada | anillos | acelera |
| Dragón + Normal | Colmillo Draco Pura | chorro-bomba | anillo | chispas | grietas | recto |
| Dragón + Veneno | Colmillo Draco Venenosa | zigzag-cadena | colmillo | cinta | espiral | gira |
| Dragón + Psíquico | Colmillo Draco Psíquica | abanico-perforante | helice | puntos | estallido | zigzag |
| Dragón + Roca | Colmillo Draco Pétrea | rebote-cadena | media-luna | trenza | chispazo | ondula |
| Dragón + Acero | Colmillo Draco Férrea | bumeran-espiral | flor | humo | esquirlas | acelera |
| Dragón + Agua | Leviatán | rayo-estallido | helice | escamas | cruz | recto |
| Eléctrico + Eléctrico | Eléctrico Superior | buscadores | estrella | llamas | burbujas | gira |
| Eléctrico + Hada | Chispa Feérica | orbitas-lluvia | meteoro | estrellas | destello | zigzag |
| Eléctrico + Lucha | Chispa Marcial | rayo-estallido | cristal | quebrada | petalos | ondula |
| Eléctrico + Fuego | Plasma Ígneo | rebote-cadena | anillo | chispas | sello | acelera |
| Eléctrico + Volador | Rayo Celeste | zigzag-cadena | rayo-doble | cinta | anillos | recto |
| Eléctrico + Fantasma | Chispa Fantasmal | rafaga-onda | espora | puntos | grietas | gira |
| Eléctrico + Planta | Raíz Eléctrica | erupcion-bomba | flor | trenza | espiral | zigzag |
| Eléctrico + Tierra | Chispa Telúrica | erupcion-bomba | remolino | humo | estallido | ondula |
| Eléctrico + Hielo | Tormenta Polar | orbitas-lluvia | cristal | escamas | chispazo | acelera |
| Eléctrico + Normal | Chispa Pura | zigzag-cadena | colmillo | llamas | esquirlas | recto |
| Eléctrico + Veneno | Chispa Venenosa | abanico-perforante | helice | estrellas | cruz | gira |
| Eléctrico + Psíquico | Sinapsis | zigzag-cadena | estrella | quebrada | burbujas | zigzag |
| Eléctrico + Roca | Chispa Pétrea | bumeran-espiral | flor | chispas | destello | ondula |
| Eléctrico + Acero | Bobina Magnética | rebote-cadena | anillo | cinta | petalos | acelera |
| Eléctrico + Agua | Descarga Marina | zigzag-cadena | rayo-doble | puntos | sello | recto |
| Hada + Hada | Hada Superior | orbitas-lluvia | meteoro | trenza | anillos | gira |
| Hada + Lucha | Destello Marcial | rayo-estallido | cristal | humo | grietas | zigzag |
| Hada + Fuego | Chispa Estelar | rafaga-onda | estrella | escamas | espiral | ondula |
| Hada + Volador | Destello Alada | meteoro | rayo-doble | llamas | estallido | acelera |
| Hada + Fantasma | Destello Fantasmal | rafaga-onda | espora | estrellas | chispazo | recto |
| Hada + Planta | Polen Hada | orbitas-lluvia | flor | quebrada | esquirlas | gira |
| Hada + Tierra | Destello Telúrica | erupcion-bomba | remolino | chispas | cruz | zigzag |
| Hada + Hielo | Destello Glacial | chorro-bomba | anillo | cinta | burbujas | ondula |
| Hada + Normal | Destello Pura | zigzag-cadena | colmillo | puntos | destello | acelera |
| Hada + Veneno | Destello Venenosa | abanico-perforante | helice | trenza | petalos | recto |
| Hada + Psíquico | Luz Astral | rafaga-onda | estrella | humo | sello | gira |
| Hada + Roca | Destello Pétrea | bumeran-espiral | flor | escamas | anillos | zigzag |
| Hada + Acero | Joya Brillante | abanico-perforante | cristal | llamas | grietas | ondula |
| Hada + Agua | Rocío Lunar | rafaga-onda | gota | estrellas | espiral | acelera |
| Lucha + Lucha | Lucha Superior | orbitas-lluvia | meteoro | quebrada | estallido | recto |
| Lucha + Fuego | Puño Volcánico | embestida-onda | meteoro | chispas | chispazo | gira |
| Lucha + Volador | Puño Alada | terremoto-columnas | gota | cinta | esquirlas | zigzag |
| Lucha + Fantasma | Puño Fantasmal | meteoro | rayo-doble | puntos | cruz | ondula |
| Lucha + Planta | Puño Silvestre | rafaga-onda | espora | trenza | burbujas | acelera |
| Lucha + Tierra | Puño Telúrica | mina-ola | runa | humo | destello | recto |
| Lucha + Hielo | Puño Glacial | erupcion-bomba | remolino | escamas | petalos | gira |
| Lucha + Normal | Golpe Total | embestida-onda | estrella | llamas | sello | zigzag |
| Lucha + Veneno | Puño Venenosa | zigzag-cadena | colmillo | estrellas | anillos | ondula |
| Lucha + Psíquico | Aura Mental | buscadores | estrella | quebrada | grietas | acelera |
| Lucha + Roca | Golpe Tectónico | terremoto-columnas | meteoro | chispas | espiral | recto |
| Lucha + Acero | Puño de Acero | embestida-onda | colmillo | cinta | estallido | gira |
| Lucha + Agua | Puño Marina | embestida-onda | cometa | puntos | chispazo | zigzag |
| Fuego + Fuego | Fuego Superior | buscadores | estrella | trenza | esquirlas | ondula |
| Fuego + Volador | Ave Fénix | bumeran-espiral | cometa | humo | cruz | acelera |
| Fuego + Fantasma | Fuego Fatuo | orbitas-lluvia | media-luna | escamas | burbujas | recto |
| Fuego + Planta | Ceniza Florida | orbitas-lluvia | flor | llamas | destello | gira |
| Fuego + Tierra | Magma Sísmico | terremoto-columnas | meteoro | estrellas | petalos | zigzag |
| Fuego + Hielo | Choque Térmico | abanico-perforante | cristal | quebrada | sello | ondula |
| Fuego + Normal | Llama Pura | mina-ola | runa | chispas | anillos | acelera |
| Fuego + Veneno | Humo Tóxico | mina-ola | espora | cinta | grietas | recto |
| Fuego + Psíquico | Llama Mental | buscadores | estrella | puntos | espiral | gira |
| Fuego + Roca | Lluvia de Meteoros | meteoro | meteoro | trenza | estallido | zigzag |
| Fuego + Acero | Forja Candente | rayo-estallido | cristal | humo | chispazo | ondula |
| Fuego + Agua | Vapor Ardiente | chorro-bomba | espora | escamas | esquirlas | acelera |
| Volador + Volador | Volador Superior | bumeran-espiral | flor | llamas | cruz | recto |
| Volador + Fantasma | Ráfaga Fantasmal | embestida-onda | cometa | estrellas | burbujas | gira |
| Volador + Planta | Vendaval de Hojas | bumeran-espiral | flor | quebrada | destello | zigzag |
| Volador + Tierra | Ráfaga Telúrica | orbitas-lluvia | meteoro | chispas | petalos | ondula |
| Volador + Hielo | Ventisca Alada | bumeran-espiral | cristal | cinta | sello | acelera |
| Volador + Normal | Vuelo Raudo | bumeran-espiral | cometa | puntos | anillos | recto |
| Volador + Veneno | Ráfaga Venenosa | meteoro | rayo-doble | trenza | grietas | gira |
| Volador + Psíquico | Ráfaga Psíquica | rafaga-onda | espora | humo | espiral | zigzag |
| Volador + Roca | Ráfaga Pétrea | mina-ola | runa | escamas | estallido | ondula |
| Volador + Acero | Ráfaga Férrea | erupcion-bomba | remolino | llamas | chispazo | acelera |
| Volador + Agua | Tifón | bumeran-espiral | remolino | estrellas | esquirlas | recto |
| Fantasma + Fantasma | Fantasma Superior | zigzag-cadena | colmillo | quebrada | cruz | gira |
| Fantasma + Planta | Espectro Silvestre | abanico-perforante | helice | chispas | burbujas | zigzag |
| Fantasma + Tierra | Espectro Telúrica | rebote-cadena | media-luna | cinta | destello | ondula |
| Fantasma + Hielo | Espectro Glacial | bumeran-espiral | flor | puntos | petalos | acelera |
| Fantasma + Normal | Espectro Pura | embestida-onda | cometa | trenza | sello | recto |
| Fantasma + Veneno | Miasma Espectral | orbitas-lluvia | media-luna | humo | anillos | gira |
| Fantasma + Psíquico | Pesadilla | buscadores | runa | escamas | grietas | zigzag |
| Fantasma + Roca | Espectro Pétrea | rayo-estallido | cristal | llamas | espiral | ondula |
| Fantasma + Acero | Espectro Férrea | terremoto-columnas | gota | estrellas | estallido | acelera |
| Fantasma + Agua | Espectro Marina | meteoro | rayo-doble | quebrada | chispazo | recto |
| Planta + Planta | Planta Superior | rafaga-onda | espora | chispas | esquirlas | gira |
| Planta + Tierra | Raíz Sísmica | terremoto-columnas | flor | cinta | cruz | zigzag |
| Planta + Hielo | Escarcha Floral | abanico-perforante | flor | puntos | burbujas | ondula |
| Planta + Normal | Liana Pura | chorro-bomba | anillo | trenza | destello | acelera |
| Planta + Veneno | Jardín Venenoso | mina-ola | flor | humo | petalos | recto |
| Planta + Psíquico | Liana Psíquica | abanico-perforante | helice | escamas | sello | gira |
| Planta + Roca | Liana Pétrea | rebote-cadena | media-luna | llamas | anillos | zigzag |
| Planta + Acero | Liana Férrea | bumeran-espiral | flor | estrellas | grietas | ondula |
| Planta + Agua | Lluvia Fértil | orbitas-lluvia | gota | quebrada | espiral | acelera |
| Tierra + Tierra | Tierra Superior | buscadores | estrella | chispas | estallido | recto |
| Tierra + Hielo | Duna Glacial | orbitas-lluvia | meteoro | cinta | chispazo | gira |
| Tierra + Normal | Duna Pura | rayo-estallido | cristal | puntos | esquirlas | zigzag |
| Tierra + Veneno | Duna Venenosa | terremoto-columnas | gota | trenza | cruz | ondula |
| Tierra + Psíquico | Duna Psíquica | meteoro | rayo-doble | humo | burbujas | acelera |
| Tierra + Roca | Corrimiento | terremoto-columnas | meteoro | escamas | destello | recto |
| Tierra + Acero | Taladro Férreo | abanico-perforante | colmillo | llamas | petalos | gira |
| Tierra + Agua | Avalancha de Lodo | erupcion-bomba | gota | estrellas | sello | zigzag |
| Hielo + Hielo | Hielo Superior | chorro-bomba | anillo | quebrada | anillos | ondula |
| Hielo + Normal | Escarcha Pura | zigzag-cadena | colmillo | chispas | grietas | acelera |
| Hielo + Veneno | Escarcha Venenosa | abanico-perforante | helice | cinta | espiral | recto |
| Hielo + Psíquico | Escarcha Psíquica | rebote-cadena | media-luna | puntos | estallido | gira |
| Hielo + Roca | Glaciar | meteoro | cristal | trenza | chispazo | zigzag |
| Hielo + Acero | Escarcha Férrea | embestida-onda | cometa | humo | esquirlas | ondula |
| Hielo + Agua | Marea Glacial | mina-ola | cristal | escamas | cruz | acelera |
| Normal + Normal | Normal Superior | orbitas-lluvia | meteoro | llamas | burbujas | recto |
| Normal + Veneno | Golpe Venenosa | rayo-estallido | cristal | estrellas | destello | gira |
| Normal + Psíquico | Golpe Psíquica | terremoto-columnas | gota | quebrada | petalos | zigzag |
| Normal + Roca | Golpe Pétrea | meteoro | rayo-doble | chispas | sello | ondula |
| Normal + Acero | Golpe Férrea | rafaga-onda | espora | cinta | anillos | acelera |
| Normal + Agua | Golpe Marina | mina-ola | runa | puntos | grietas | recto |
| Veneno + Veneno | Veneno Superior | erupcion-bomba | remolino | trenza | espiral | gira |
| Veneno + Psíquico | Niebla Psíquica | chorro-bomba | anillo | humo | estallido | zigzag |
| Veneno + Roca | Niebla Pétrea | zigzag-cadena | colmillo | escamas | chispazo | ondula |
| Veneno + Acero | Niebla Férrea | abanico-perforante | helice | llamas | esquirlas | acelera |
| Veneno + Agua | Ciénaga Ácida | mina-ola | gota | estrellas | cruz | recto |
| Psíquico + Psíquico | Psíquico Superior | bumeran-espiral | flor | quebrada | burbujas | gira |
| Psíquico + Roca | Mente Pétrea | embestida-onda | cometa | chispas | destello | zigzag |
| Psíquico + Acero | Mente Férrea | buscadores | estrella | cinta | petalos | ondula |
| Psíquico + Agua | Espejo de Agua | buscadores | anillo | puntos | sello | acelera |
| Roca + Roca | Roca Superior | rayo-estallido | cristal | trenza | anillos | recto |
| Roca + Acero | Muralla Férrea | meteoro | cristal | humo | grietas | gira |
| Roca + Agua | Roca Marina | meteoro | rayo-doble | escamas | espiral | zigzag |
| Acero + Acero | Acero Superior | rafaga-onda | espora | llamas | estallido | ondula |
| Acero + Agua | Hoja de Acero Marina | mina-ola | runa | estrellas | chispazo | acelera |
| Agua + Agua | Agua Superior | erupcion-bomba | remolino | quebrada | esquirlas | recto |

## Cómo probarlos uno a uno

Con la cuenta admin o en el servidor de desarrollo, dentro de una partida, en la consola del navegador:

```js
__POKEISAAC_DEBUG__.godMode()                      // opcional
__POKEISAAC_DEBUG__.listStyles("fuego")           // estilos de un tipo (o de todos sin argumento)
__POKEISAAC_DEBUG__.castStyle("fuego", "Lanzallamas") // lo pone en la ranura 1 y lo lanza
__POKEISAAC_DEBUG__.castFusion("fuego", "agua")   // fusión de dos tipos (Vapor Ardiente) en la ranura 1 y la lanza
```

Los tipos valen en español o en inglés. Tras lanzarlo queda en la ranura 1, así que se puede repetir con su tecla. Con «Reducir efectos» activado las firmas no se dibujan (a propósito).
