// Contenido de «Créditos y aviso legal» y «Privacidad». Lógica pura (sin Phaser): lo usa la pantalla
// src/scenes/LegalScene.ts y el script scripts/genLegal.ts para generar public/aviso-legal.html y public/privacidad.html.
// Si cambias el texto aquí, vuelve a ejecutar: node scripts/genLegal.ts (un test comprueba que las páginas coinciden).

export const ISSUES_URL = 'https://github.com/RoberFdez06/Poke-Chronicles/issues';
export const REPO_URL = 'https://github.com/RoberFdez06/Poke-Chronicles';

/** Un bloque: título opcional y párrafos. Los párrafos que empiezan por «• » se dibujan como viñeta. */
export interface LegalBlock {
  title?: string;
  paragraphs: string[];
}

export interface LegalDoc {
  id: 'legal' | 'privacy';
  /** Pestaña de la pantalla. */
  tab: string;
  /** Título de la página HTML. */
  title: string;
  /** Archivo estático equivalente (dentro de public/). */
  file: string;
  blocks: LegalBlock[];
}

export const LEGAL_DOC: LegalDoc = {
  id: 'legal',
  tab: 'Créditos y aviso legal',
  title: 'Créditos y aviso legal',
  file: 'aviso-legal.html',
  blocks: [
    {
      title: 'Qué es este juego',
      paragraphs: [
        'Poké Chronicles es un fan game gratuito y sin ánimo de lucro, hecho por un aficionado. No tiene ninguna relación con Nintendo, Game Freak, Creatures ni The Pokémon Company, y ninguna de ellas lo ha creado, revisado ni respaldado.',
        'Pokémon y los nombres de los Pokémon, de los movimientos y de los personajes son marcas y propiedad de sus respectivos dueños. Aquí se usan solo como homenaje de aficionado.',
      ],
    },
    {
      title: 'Sin dinero',
      paragraphs: [
        'El juego es gratis. No hay anuncios, no hay compras ni suscripciones y no se usa dinero real en ningún momento. Las monedas, los tickets y el gacha son solo del juego y no se pueden comprar ni cambiar por dinero.',
      ],
    },
    {
      title: 'Créditos',
      paragraphs: [
        '• Sprites animados de los Pokémon: proyecto PMDCollab SpriteCollab (https://sprites.pmdcollab.org/ y https://github.com/PMDCollab/SpriteCollab), obra de la comunidad de artistas que figuran en su lista de créditos, que se encuentra en ese repositorio. El proyecto los indica con licencia CC BY-NC 4.0 (uso no comercial, con reconocimiento de sus autores). Este juego es gratuito y no comercial, y la autoría de cada sprite es de quienes aparecen en esa lista.',
        '• Datos de Pokémon (nombres, tipos, estadísticas, movimientos, habilidades y gritos) y algunos sprites: PokeAPI (https://pokeapi.co/). Los sprites y gritos que sirve PokeAPI son material de Nintendo, Game Freak y The Pokémon Company.',
        '• Fuente de texto: Pixelify Sans, de Stefie Justprince, con licencia SIL Open Font License.',
        '• Música y efectos de sonido: se generan con código dentro del juego (Web Audio); no se usan archivos de audio de terceros. Los gritos de los Pokémon vienen de PokeAPI.',
        '• Gráficos de la interfaz, objetos y escenarios: pixel art dibujado por código para este juego.',
      ],
    },
    {
      title: 'Si eres titular de derechos',
      paragraphs: [
        'Si eres titular de derechos y quieres que se retire algo de este juego, se retirará. Abre una incidencia en ' + ISSUES_URL + ' indicando qué contenido es y por qué, y se atenderá lo antes posible.',
        'Por favor, no escribas en la incidencia datos personales como tu correo o tu teléfono: las incidencias de GitHub son públicas.',
      ],
    },
    {
      title: 'Garantía',
      paragraphs: [
        'El juego se ofrece tal cual, como beta pública y sin garantías: puede tener errores y cambiar o dejar de estar disponible en cualquier momento.',
      ],
    },
  ],
};

export const PRIVACY_DOC: LegalDoc = {
  id: 'privacy',
  tab: 'Privacidad',
  title: 'Privacidad',
  file: 'privacidad.html',
  blocks: [
    {
      title: 'Resumen',
      paragraphs: [
        'Jugar como invitado no guarda nada en ningún servidor. Solo si creas una cuenta se guarda tu progreso en la nube, para que no lo pierdas y lo tengas en cualquier dispositivo. No hay publicidad, ni estadísticas de uso, ni venta ni cesión de datos a terceros.',
      ],
    },
    {
      title: 'Invitados',
      paragraphs: [
        'Si juegas como invitado, tu progreso se queda solo en la memoria de la pestaña y se pierde al cerrarla. No se envía a ningún servidor del juego. Si luego entras con una cuenta en esa misma sesión, se te ofrece subir a ella lo que hayas jugado.',
      ],
    },
    {
      title: 'Qué se guarda si creas una cuenta',
      paragraphs: [
        '• Firebase Authentication (Google): tu correo electrónico, un identificador de usuario y, si lo pones, tu nombre. Con correo y contraseña, la contraseña la gestiona Firebase y el juego nunca la ve ni la guarda. Si entras con Google, Firebase recibe de Google tu correo y tu nombre.',
        '• Firestore (Google): un único documento tuyo con tu progreso y tus ajustes (Pokémon desbloqueados, monedas, tickets, mejoras, récords, historial de partidas, partidas guardadas, volumen y teclas), tu nombre y la fecha de la última actualización. Las reglas de la base de datos solo dejan que lo lea y lo escriba su dueño.',
        '• En tu navegador, Firebase guarda una sesión para que no tengas que entrar cada vez, y el juego guarda en la caché del navegador datos y sprites descargados para ir más rápido.',
      ],
    },
    {
      title: 'Para qué se usan',
      paragraphs: [
        'Solo para identificarte al entrar y guardar y devolverte tu progreso. No se usan para publicidad, perfiles ni análisis, y no se venden ni se ceden a terceros.',
      ],
    },
    {
      title: 'Dónde se alojan',
      paragraphs: [
        'Los datos de la cuenta están en Firebase, un servicio de Google, y por eso Google los trata como proveedor del servicio; sus servidores pueden estar fuera de España. La web del juego se sirve desde GitHub Pages.',
        'Al jugar, tu navegador también descarga datos y sprites de PokeAPI (pokeapi.co) y de GitHub (raw.githubusercontent.com). Esos servicios pueden ver tu dirección IP, como en cualquier página web.',
      ],
    },
    {
      title: 'Borrar tu cuenta y tus datos',
      paragraphs: [
        'Puedes borrarlos tú mismo desde el juego: abre la pantalla de cuenta (pulsa el aviso de arriba a la derecha del menú principal) y elige «Borrar cuenta». Hay que confirmarlo dos veces. Se borran el documento con tu progreso y tu cuenta, y no se puede deshacer. Si el juego te pide volver a entrar antes de borrar, hazlo y repite.',
        'Si no puedes hacerlo así, abre una incidencia en ' + ISSUES_URL + ' sin escribir datos personales (son públicas) y se te indicará cómo seguir.',
      ],
    },
    {
      title: 'Tus derechos',
      paragraphs: [
        'Según el RGPD tienes derecho a acceder a tus datos, a rectificarlos, a suprimirlos y a pedir su limitación o portabilidad, y a oponerte a su tratamiento. Si crees que tus datos no se tratan bien, puedes reclamar ante la Agencia Española de Protección de Datos (https://www.aepd.es/).',
        'Para ejercerlos, abre una incidencia en ' + ISSUES_URL + ' sin datos personales. La supresión la puedes hacer tú mismo desde el juego, como se explica arriba.',
      ],
    },
  ],
};

export const LEGAL_DOCS: readonly LegalDoc[] = [LEGAL_DOC, PRIVACY_DOC];

/** Líneas de texto de un documento, con título y viñetas, listas para repartir en pantalla. */
export function docParagraphs(doc: LegalDoc): { kind: 'title' | 'p'; text: string }[] {
  const out: { kind: 'title' | 'p'; text: string }[] = [];
  for (const b of doc.blocks) {
    if (b.title) out.push({ kind: 'title', text: b.title });
    for (const p of b.paragraphs) out.push({ kind: 'p', text: p });
  }
  return out;
}

/** Desplazamiento entre 0 y lo que sobra del contenido sobre la ventana. */
export function clampScroll(y: number, contentH: number, viewH: number): number {
  const max = Math.max(0, contentH - viewH);
  return Math.min(max, Math.max(0, Math.round(y)));
}

/** Pestaña siguiente o anterior, dando la vuelta. */
export function stepTab(index: number, d: number, n: number = LEGAL_DOCS.length): number {
  return (((index + d) % n) + n) % n;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Convierte las direcciones https:// del texto en enlaces. */
const linkify = (s: string) => esc(s).replace(/https:\/\/[^\s)<]+[^\s).,<;]/g, (u) => `<a href="${u}">${u}</a>`);

/** Página HTML completa y sin dependencias de un documento. */
export function renderDocHtml(doc: LegalDoc): string {
  const other = LEGAL_DOCS.find((d) => d !== doc)!;
  const body: string[] = [];
  for (const b of doc.blocks) {
    if (b.title) body.push(`<h2>${esc(b.title)}</h2>`);
    const items = b.paragraphs.filter((p) => p.startsWith('• '));
    for (const p of b.paragraphs) if (!p.startsWith('• ')) body.push(`<p>${linkify(p)}</p>`);
    if (items.length) body.push(`<ul>${items.map((p) => `<li>${linkify(p.slice(2))}</li>`).join('')}</ul>`);
  }
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.title)} · Poké Chronicles</title>
<style>
body{font-family:system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;line-height:1.55;color:#222;background:#fafafa}
h1{font-size:1.7rem}h2{font-size:1.2rem;margin-top:1.8rem}a{color:#1a4fb0}li{margin-bottom:.6rem}nav{margin:1rem 0}
</style>
</head>
<body>
<h1>${esc(doc.title)}</h1>
<nav><a href="./">← Volver al juego</a> · <a href="${other.file}">${esc(other.tab)}</a></nav>
${body.join('\n')}
</body>
</html>
`;
}
