import Phaser from 'phaser';
import type { PokemonCard } from '../data/pokeapi';
import { typeColor, typeNameEs } from '../data/types';
import { addTypeChip, COLORS, drawBox, HEX, textStyle } from './theme';

export const CARD_SIZE = { w: 200, h: 270 };

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Clave de textura de un Pokémon en menús; GameScene la reutiliza para el jugador. */
export const starterKey = (id: number, side: 'front' | 'back' = 'front') => `starter-${id}-${side}`;

/** Carga (si faltan) los sprites de frente y espalda de estos Pokémon. Se resuelve aunque alguno falle. */
export function loadCardTextures(scene: Phaser.Scene, cards: readonly PokemonCard[]): Promise<void> {
  return new Promise((resolve) => {
    scene.load.crossOrigin = 'anonymous';
    let queued = 0;
    for (const c of cards) {
      for (const side of ['front', 'back'] as const) {
        const key = starterKey(c.id, side);
        if (scene.textures.exists(key)) continue;
        scene.load.image(key, c.sprites[side]);
        queued++;
      }
    }
    if (queued === 0) return resolve();
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      // Sprites pixel: escalado sin suavizar para que se vean nítidos
      for (const c of cards) {
        for (const side of ['front', 'back'] as const) {
          const key = starterKey(c.id, side);
          if (scene.textures.exists(key)) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
      }
      resolve();
    });
    scene.load.start();
  });
}

export interface CardOptions {
  scale?: number;
  /** Etiqueta extra bajo los tipos (p. ej. la rareza). */
  tag?: { text: string; color: string };
}

/**
 * Tarjeta de Pokémon con sprite, nombre y tipos. Devuelve el contenedor (interactivo, área ya centrada)
 * y el brillo de selección. Los sprites tienen que estar cargados con loadCardTextures.
 */
export function buildPokemonCard(scene: Phaser.Scene, card: PokemonCard, x: number, y: number, opts: CardOptions = {}) {
  const { w, h } = CARD_SIZE;
  const accent = typeColor(card.types[0] ?? 'normal');

  // Cuadro con borde doble y una franja del color del tipo detrás del sprite
  const bg = scene.add.graphics();
  drawBox(bg, -w / 2, -h / 2, w, h, { radius: 18 });
  bg.fillStyle(accent, 0.35).fillRoundedRect(-w / 2 + 12, -h / 2 + 12, w - 24, 140, 10);

  const glow = scene.add.graphics();
  glow.lineStyle(8, COLORS.gold, 1).strokeRoundedRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 24);
  glow.setVisible(false);

  const key = starterKey(card.id);
  const sprite = scene.textures.exists(key)
    ? scene.add.image(0, -50, key).setDisplaySize(150, 150)
    : scene.add.text(0, -50, '?', textStyle(64)).setOrigin(0.5);
  const name = scene.add.text(0, 46, capitalize(card.name), textStyle(24, HEX.text, { fontStyle: 'bold' })).setOrigin(0.5);

  // Una etiqueta por tipo, centradas
  const chipW = 84;
  const chipGap = 8;
  const start = -((card.types.length * chipW + (card.types.length - 1) * chipGap) / 2) + chipW / 2;
  const chips = card.types.flatMap((t, k) => addTypeChip(scene, start + k * (chipW + chipGap), 85, typeNameEs(t), typeColor(t), chipW));
  const extra = opts.tag
    ? [scene.add.text(0, 114, opts.tag.text, textStyle(16, opts.tag.color, { fontStyle: 'bold' })).setOrigin(0.5)]
    : [];

  const box = scene.add.container(x, y, [bg, glow, sprite, name, ...chips, ...extra]).setScale(opts.scale ?? 1);
  box.setSize(w, h);
  // En un contenedor con tamaño, Phaser ya desplaza el área al centro: va de (0,0) a (w,h)
  box.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
  box.input!.cursor = 'pointer';
  return { box, glow };
}

/** Botón de texto "← Volver" arriba a la izquierda, para jugar solo con ratón. */
export function addBackButton(scene: Phaser.Scene, onClick: () => void, x = 36, y = 40) {
  const back = scene.add
    .text(x, y, '← Volver', textStyle(22, HEX.white))
    .setOrigin(0, 0.5)
    .setPadding(8, 6)
    .setDepth(5)
    .setInteractive({ useHandCursor: true });
  back.on('pointerover', () => back.setColor('#ffd34d'));
  back.on('pointerout', () => back.setColor('#ffffff'));
  back.on('pointerdown', onClick);
  return back;
}
