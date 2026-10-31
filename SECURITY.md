# Seguridad

## Cómo se protegen las cuentas y los datos

- **Autenticación:** Firebase Authentication (correo y contraseña, o Google). Las contraseñas las gestiona Firebase y
  nunca pasan por este código ni se guardan en el repositorio. La política exige **8 caracteres como mínimo, con
  mayúscula, minúscula, número y carácter especial**.
- **Datos:** Cloud Firestore con reglas estrictas ([`firestore.rules`](firestore.rules)): cada usuario solo puede leer
  y escribir `users/{su uid}`; todo lo demás está denegado.
- **Claves:** la configuración web de Firebase es pública por diseño, y la clave de API está restringida a los
  dominios del juego. No hay claves privadas, tokens ni contraseñas en el código ni en el historial de git. Los
  valores locales van en `.env.local`, que está ignorado por git.
- **Modo administrador:** solo se activa si el SHA-256 del correo de la sesión coincide con una variable de entorno
  que **no** se incluye en la web pública.
- **Repositorio:** Secret scanning, Push protection, alertas y actualizaciones de seguridad de Dependabot activadas.

## Cómo avisar de una vulnerabilidad

Usa **Security → Report a vulnerability** en este repositorio (aviso privado). Por favor, no abras una *issue* pública
con los detalles.
