// gachareg: texturas de los emblemas de los banners del gacha (pixel art propio de bannerEmblems.ts).
import Phaser from 'phaser';
import { drawPixelGrid } from './icons';
import { BANNER_EMBLEMS } from './bannerEmblems';

export const bannerKey = (id: string) => `gacha-banner-${id}`;

/** Crea (una vez) la textura de cada emblema, con filtro NEAREST. */
export function bakeBannerArt(scene: Phaser.Scene) {
  for (const [id, icon] of Object.entries(BANNER_EMBLEMS)) {
    const key = bannerKey(id);
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({}, false);
    drawPixelGrid(g, icon);
    g.generateTexture(key, icon.rows[0].length, icon.rows.length);
    g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}
