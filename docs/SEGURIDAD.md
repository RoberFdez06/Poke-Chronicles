# Auditoría de seguridad (beta pública) · 2026-11-02

Checklist propio estilo OWASP adaptado a un juego web estático (GitHub Pages) con Firebase Auth + Firestore.
Estados: **OK** · **Corregido** (en la rama `seguridad`) · **Pendiente de Roberto** · **No aplica**.
Las rutas son del repositorio; los números de línea, de este commit.

## Checklist (30 controles)

| # | Área | Control | Estado | Evidencia |
|---|------|---------|--------|-----------|
| 1 | Autenticación | Contraseña mínima en cliente (8, mayús., minús., número, especial) | OK | `src/data/account.ts:35-40` |
| 2 | Autenticación | La misma política activada en Firebase (Password policy) | OK (11/11, Roberto) | Consola → Authentication → Settings |
| 3 | Autenticación | Errores de inicio de sesión no revelan si el correo existe | Corregido | `src/data/account.ts:59-60` (`user-not-found` = mismo texto que contraseña mala) |
| 4 | Autenticación | Protección contra enumeración de correos en el registro (`email-already-in-use`) | OK (11/11, Roberto) | Activada en Authentication → Settings |
| 5 | Autenticación | Limitación de intentos | OK (Firebase) | `auth/too-many-requests` en `src/data/account.ts:61` |
| 6 | Autenticación | Borrar cuenta pide sesión reciente | OK | `src/net/cloud.ts` `deleteAccount` + `auth/requires-recent-login` (`account.ts:66`). Nota: borra el documento antes que la cuenta; si Firebase pide reautenticar, el progreso ya se borró (riesgo bajo, solo afecta al propio usuario) |
| 7 | Autenticación | Invitados no escriben en servidor | OK | `src/net/cloud.ts:84-90` (invitado = `MemoryStorage`; `scheduleUpload` solo desde `attach`) |
| 8 | Autorización | Cada usuario solo lee/escribe `users/{uid}` | OK | `firestore.rules` `isOwner(uid)` |
| 9 | Autorización | Todo lo demás denegado (incluidas subcolecciones, que el juego no usa) | Corregido | `firestore.rules` (se quitó el `users/{uid}/{document=**}` abierto) |
| 10 | Autorización | Esquema del documento: solo `data`, `name`, `updatedAt`; tipos; `name` ≤ 40; `data` ≤ 2000 claves; `updatedAt == request.time` | Corregido (sin desplegar) | `firestore.rules` `validUserDoc` |
| 11 | Autorización | Ningún campo del cliente concede permisos (admin, monedas globales…) | OK | Las reglas solo miran `request.auth.uid`; no hay datos compartidos entre usuarios |
| 12 | Autorización | Modo admin no falsificable para afectar a otros | OK (solo local) | `src/data/admin.ts:44-49`: `DEV` o hash del correo. Un usuario puede trucar su propio cliente, pero eso solo cambia su propia partida; no abre nada en el servidor. El hash no se incluye en la web pública (`.github/workflows/deploy.yml:31`) |
| 13 | Autorización | Límite de frecuencia de escrituras | OK parcial | Cliente agrupa cambios (1,5 s, `cloud.ts` `scheduleUpload`); en servidor no hay límite por reglas (posible con App Check: pendiente opcional) |
| 14 | Datos | Documento de Firestore validado al leer (forma, tipos, tamaño, `__proto__`) | Corregido | `src/data/safeData.ts` `sanitizeStringMap`; uso en `src/net/cloud.ts` `attach` |
| 15 | Datos | Datos de la nube corruptos no pisan el guardado bueno | Corregido | `cloud.ts` `attach`: si no valida, se juega sin guardar (`loadFailed`) |
| 16 | Datos | Progreso de invitado en sessionStorage validado | Corregido | `cloud.ts` `readPendingGuest` → `parseStringMap` |
| 17 | Datos | JSON.parse de localStorage con try/catch y validación de forma | OK | 24 sitios en `src/data/*.ts` (p. ej. `runSave.ts:395`, `save.ts:56`, `seedCode.ts:141`, `modes.ts:118`), todos con `try` y comprobación de tipos; `TowerDefenseMenuScene.ts:394-399` en `try` |
| 18 | Datos | Prototype pollution | OK | No hay `Object.assign`/merge profundo sobre datos externos (solo estilos y constantes: `src/ui/touchControls.ts`, `src/ui/art/hud.ts:20`); el spread copia `__proto__` como propiedad propia; las claves peligrosas se filtran en `safeData.ts` |
| 19 | Datos | Guardados editados a mano / versiones viejas no bloquean el juego | OK | `RUN_VERSION` y migraciones en `src/data/runSave.ts`; lecturas con valores por defecto |
| 20 | Entrada/salida | Sin `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `setTimeout` con texto | OK | Grep en `src/`, `public/`, `index.html`: 0 resultados |
| 21 | Entrada/salida | Nombres de cuenta y textos del servidor se pintan en canvas (Phaser Text), no en DOM | OK | Además se limpian (control, bidi, ≤ 40): `safeData.ts` `sanitizeName`; DOM propio solo para controles táctiles (`src/ui/touchControls.ts`, estilos numéricos) |
| 22 | Entrada/salida | Páginas estáticas escapan el contenido | OK | `src/data/legal.ts` usa `esc()` al generar `public/*.html` |
| 23 | Secretos | `.env.local` ignorado; `.env.example` sin valores reales | OK | `.gitignore:10-11` |
| 24 | Secretos | Sin claves privadas, cuentas de servicio, `ghp_`, `github_pat_`, `sk-`, `xox` ni `AIza…` en el historial (439 commits) | OK | `git log --all -p` + grep: 0 coincidencias |
| 25 | Secretos | apiKey web de Firebase restringida por dominio (es pública por diseño) | OK (11/11, Roberto) | Restringida en Google Cloud → Credenciales a `roberfdez06.github.io/*`, `localhost` y `firebaseapp.com` |
| 26 | Dependencias | `npm audit` | Pendiente de Roberto | Aquí el registro de auditoría está bloqueado por red. Ejecutar `npm audit --omit=dev` y `npm audit` |
| 27 | Dependencias | Sin scripts `postinstall` propios ni de las dependencias directas; lockfile versionado | OK | `package.json` (solo `predev`/`prebuild` locales), `package-lock.json` en git |
| 28 | Navegador | `Referrer-Policy` por meta | Corregido | `index.html:5`, `src/data/legal.ts:167` (→ `public/*.html`) |
| 29 | Navegador | Enlaces `target=_blank` con `rel="noopener noreferrer"` | No aplica | No hay ningún `target=_blank` |
| 30 | Navegador | Content-Security-Policy | OK (11/11) | Activada por `<meta>` en `index.html` y en `src/data/legal.ts` (páginas legales); probada en el navegador sin violaciones |
| 31 | Despliegue | Depuración/trampas solo en dev o cuenta admin | OK | `GameScene.ts:8865-8867` (`installDebug` → `adminAllowed()`); `SettingsScene.ts:79`. `debugFlags.ts` (`?debug`) no se usa en ningún sitio (código muerto) |
| 32 | Despliegue | Service worker solo cachea GET de hosts permitidos | OK | `public/sw.js:5,20-22` (`pokeapi.co`, `raw.githubusercontent.com`) |
| 33 | Privacidad | Política de privacidad y borrado de cuenta desde el juego | OK | `public/privacidad.html`, `deleteAccount` |
| 34 | Privacidad | El correo del admin nunca en claro | OK | Solo SHA-256 en `.env.local` (`admin.ts:1-5`) |

Resumen: **25 OK (el 13, parcial) · 7 corregidos · 1 pendiente de Roberto · 1 no aplica**.

### Añadidos 11/11 (sin numerar en la tabla de arriba, revisión de seguridad pedida por Roberto)

| Área | Control | Estado | Evidencia |
|------|---------|--------|-----------|
| Autorización | El panel admin se cierra solo si se lanza sin pasar por quien lo abre (p. ej. desde la consola del navegador: `__POKEISAAC__.scene.start('Admin')`) | Corregido | `src/scenes/AdminScene.ts` `create()` comprueba `adminAllowed()` aunque ya lo comprueben `GameScene`/`SettingsScene`. Antes se podía abrir el panel desde la consola en la web pública; no daba ningún truco (las filas las construye quien lo abre y esas sí estaban protegidas), pero se caía con un error en vez de no hacer nada. |
| Datos | Tickets/monedas/caramelos no pueden ponerse a mano a cualquier valor por fuera del juego (API REST de Firestore, consola) | Mitigado (sin desplegar) | `firestore.rules` `moneyFieldOk`: exige que `pokeisaac.tickets`/`pokeisaac.coins` tengan como mucho 6 cifras y `pokeisaac.candies` 7 (de "cualquier número" a como mucho 999 999 / 9 999 999, muy por encima de lo que da jugar). **No es una validación completa**: el resto del guardado sigue sin tipar y nadie impide forzar el propio guardado dentro de esos topes; una validación completa pediría Cloud Functions (plan de pago). Probado con dos cuentas reales desechables: sin iniciar sesión o con la cuenta de otro, todo denegado (403) tanto antes como después. |


## Pendiente de Roberto

Hecho el 11/11: reglas desplegadas, apiKey restringida, política de contraseña y protección de enumeración
activadas, CSP publicada, `npm audit --omit=dev` revisado (4 altas en `@grpc/grpc-js`, solo del lado servidor de
Node; no afectan al cliente web, no se toca).

1. **Volver a desplegar `firestore.rules`** (cambiaron hoy: tope a tickets/monedas/caramelos; ver tabla de arriba,
   fila "Tickets/monedas/caramelos…"). Firestore → Reglas → pegar el archivo → Publicar.
2. **Borrar dos documentos sueltos de prueba** en Firestore → Datos → colección `users` (de las pruebas de ataque
   de hoy; las cuentas ya no existen, así que ya no puede leerlos ni borrarlos nadie salvo tú a mano):
   - `rSZbaOBJhRgBzy8DuaTLSuZR4Dc2`
   - `Ql4te9E7YkT3XBIewzoB5Qx68KQ2`
3. Opcional: **App Check** (reCAPTCHA Enterprise) para frenar abusos de escritura con scripts.

## Borrador de CSP (NO activado)

GitHub Pages no permite cabeceras; se pondría en `index.html` como `<meta http-equiv="Content-Security-Policy" content="…">`
(`frame-ancestors` no funciona por meta).

```
default-src 'self';
script-src 'self' https://apis.google.com https://www.gstatic.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://raw.githubusercontent.com https://sprites.pmdcollab.org https://*.googleusercontent.com;
media-src 'self' data: blob: https://raw.githubusercontent.com;
font-src 'self';
connect-src 'self' https://pokeapi.co https://raw.githubusercontent.com https://sprites.pmdcollab.org
  https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com
  https://www.googleapis.com https://apis.google.com https://*.firebaseapp.com;
frame-src https://pokeisaac-664d8.firebaseapp.com https://apis.google.com https://accounts.google.com;
worker-src 'self' blob:;
manifest-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
```

Cómo probarla: `npm run build && npm run preview`, añadir el meta y abrir con la consola (F12). Recorrer: carga
inicial, una partida (sprites PMD, gritos), cuenta con correo, con Google (popup), guardado en la nube, modo sin
conexión (service worker) y compartir imagen. Cualquier `Refused to …` en consola indica qué origen falta. Si Phaser
usa `blob:` para audio o texturas, ya está permitido. Probar primero con
`Content-Security-Policy-Report-Only` no es posible por meta: hacerlo en local con `vite preview` es la forma segura.

## Prueba de correcciones

| Arreglo | Cómo verificarlo |
|---------|------------------|
| Validación de datos (`safeData.ts`) | `node --test tests/safeData.test.ts` (forma, `__proto__`, límites, JSON roto, nombre) |
| Nube corrupta no pisa | En la consola de Firestore, poner `data` como texto en tu documento → al entrar el juego avisa «no se pudo leer la nube» y no sobrescribe. Restaurar después |
| Mensaje sin enumeración | Entrar con un correo inexistente → «Correo o contraseña incorrectos» (`tests/account.test.ts`) |
| Reglas (tras desplegar) | Simulador de reglas de la consola, autenticado como uid A: `get users/A` permitido; `get users/B` denegado; `set users/A {data:{}, updatedAt: request.time}` permitido; con campo extra `admin:true` denegado; `name` de 41 caracteres denegado; `data` como texto denegado; `set users/A/x/y` denegado; sin sesión todo denegado. Luego jugar y comprobar que guarda |
| Referrer | DevTools → Network → cabecera `Referer` hacia PokeAPI = solo el origen |
| Reglas de tipos y tests | `npx tsc --noEmit` y `npm test` |
