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
