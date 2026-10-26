// T82: compone la imagen de la partida (1200×630) en una RenderTexture y la descarga o la comparte.
// Solo usa texturas ya cargadas (iconos horneados y el retrato del resumen): no se piden imágenes de fuera.
import Phaser from 'phaser';
import { CARD_H, CARD_W, type ShareCard } from '../data/shareCard';
import { COLORS, drawBox, FONT, HEX } from '../ui/theme';
import { iconKey } from '../ui/art/icons';

/** Dibuja la tarjeta y devuelve el PNG (o null si el navegador no deja sacar la imagen). */
export function renderShareCard(
  scene: Phaser.Scene,
  card: ShareCard,
  opts: { portraitKey?: string; itemKey: (name: string) => string },
): Promise<Blob | null> {
  // TODO(supervisor): diseño final de la tarjeta (fondo, marco, colores del resultado, posición de cada cosa).
  const rt = scene.make.renderTexture({ x: 0, y: 0, width: CARD_W, height: CARD_H }, false).setOrigin(0, 0);
  const temp: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T) => (temp.push(o), o);
  const text = (x: number, y: number, s: string, size: number, color: string = HEX.text, bold = false) =>
    keep(scene.make.text({ x, y, text: s, style: { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' } }, false));

  rt.fill(COLORS.bg);
  const g = keep(scene.make.graphics({}, false));
  drawBox(g, 40, 40, CARD_W - 80, CARD_H - 80, { radius: 24 });
  g.fillStyle(card.won ? COLORS.gold : COLORS.hpRed, 1).fillRoundedRect(80, 230, 340, 64, 14);
  g.fillStyle(0x8fa0c0, 1).fillEllipse(250, 200, 220, 46);
  rt.draw(g);

  if (opts.portraitKey && scene.textures.exists(opts.portraitKey)) {
    const img = keep(scene.make.image({ x: 250, y: 196, key: opts.portraitKey }, false)).setOrigin(0.5, 0.9);
    img.setScale(150 / Math.max(img.width, img.height, 1));
    if (!card.won) img.setTint(0x8890a8);
    rt.draw(img);
  }

  const parts: Phaser.GameObjects.Text[] = [
    text(470, 70, card.title, 30, HEX.textSoft, true),
    text(470, 108, card.pokemon, 52, HEX.text, true),
    text(470, 178, card.mode, 26, HEX.textSoft),
    text(250, 262, card.result, 30, card.won ? HEX.text : HEX.white, true).setOrigin(0.5),
  ];
  card.stats.forEach((s, i) => {
    const x = 470 + (i % 2) * 330;
    const y = 240 + Math.floor(i / 2) * 64;
    parts.push(text(x, y, s.label, 22, HEX.textSoft), text(x, y + 26, s.value, 30, HEX.text, true));
  });
  parts.push(text(80, 380, 'Objetos', 24, HEX.text, true));
  if (card.items.length === 0) parts.push(text(80, 418, 'Ninguno', 22, HEX.textSoft));
  card.items.forEach((it, i) => {
    const x = 104 + i * 76;
    const key = opts.itemKey(it.name);
    const icon = keep(scene.make.image({ x, y: 446, key: scene.textures.exists(key) ? key : iconKey('bag') }, false)).setScale(2.4);
    rt.draw(icon);
    if (it.count > 1) parts.push(text(x + 22, 470, `x${it.count}`, 18, HEX.text, true).setOrigin(1, 1));
  });
  if (card.moreItems > 0) parts.push(text(104 + card.items.length * 76 - 20, 432, `+${card.moreItems}`, 24, HEX.textSoft, true));
  parts.push(text(80, 530, card.seedText, 26, HEX.text, true));
  parts.forEach((p) => rt.draw(p));

  return new Promise((done) => {
    const finish = (blob: Blob | null) => {
      temp.forEach((o) => o.destroy());
      rt.destroy();
      done(blob);
    };
    try {
      rt.snapshot((snap) => {
        if (!(snap instanceof HTMLImageElement)) return finish(null);
        fetch(snap.src).then((r) => r.blob()).then(finish, () => finish(null));
      }, 'image/png');
    } catch {
      finish(null);
    }
  });
}

/** Comparte con el menú del sistema si el navegador sabe compartir archivos; si no, descarga el PNG. */
export async function shareOrDownload(blob: Blob, fileName: string): Promise<'compartida' | 'descargada' | 'cancelada'> {
  const file = new File([blob], fileName, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'PokeIsaac' });
      return 'compartida';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelada';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'descargada';
}
