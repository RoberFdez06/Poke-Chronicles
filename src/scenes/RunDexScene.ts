import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { loadDefeated } from '../data/save';
import { loadCollectionIndex } from '../data/speciesIndex';
import { buildDexIndex, DEX_CANDIES, DEX_MILESTONES, typeProgress } from '../data/runDex';
import { typeColor, typeNameEs } from '../data/types';
import { addBackButton } from '../ui/cards';
import { NavInput } from '../ui/nav';
import { COLORS, drawBox, fadeIn, FONT, goTo, HEX } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';

/**
 * Registro de combate (T63): cuántas especies de cada tipo has derrotado en tus partidas. Solo se consulta; el
 * registro y los premios (caramelos al llegar al 25, 50, 75 y 100 %) se dan jugando. Se sale con Esc, B o "Volver".
 */
export class RunDexScene extends Phaser.Scene {
  private nav!: NavInput;
  private leaving = false;

  constructor() {
    super('RunDex');
  }

  create() {
    this.leaving = false;
    this.nav = new NavInput(this);
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    addBackButton(this, () => this.back());

    this.add.text(480, 44, 'Registro de combate', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: HEX.gold })
      .setOrigin(0.5).setStroke('#2b3a67', 10);
    const wait = this.add.text(480, 320, 'Cargando…', { fontFamily: FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);

    loadCollectionIndex()
      .then((index) => {
        if (!this.scene.isActive()) return; // se salió antes de que cargara
        wait.destroy();
        this.draw(index);
      })
      .catch(() => wait.setText('No se pudo cargar la lista de Pokémon'));
  }

  private draw(index: Awaited<ReturnType<typeof loadCollectionIndex>>) {
    const dx = buildDexIndex(index);
    const defeated = loadDefeated();
    const rows = typeProgress(defeated, dx);
    const seen = new Set(defeated).size;
    this.add.text(480, 92, `Especies derrotadas: ${seen}`, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5).setStroke('#2b3a67', 6);

    // Rejilla de 3 columnas con un cuadro por tipo: nombre, barra y cuántas llevas
    const cw = 284;
    const ch = 72;
    rows.forEach((p, k) => {
      const x = 40 + (k % 3) * (cw + 14);
      const y = 120 + Math.floor(k / 3) * (ch + 6);
      const full = p.percent >= 100;
      drawBox(this.add.graphics(), x, y, cw, ch, { radius: 12, fill: full ? COLORS.goldSoft : COLORS.panel });
      const c = typeColor(p.type);
      this.add.graphics().fillStyle(c, 1).fillCircle(x + 22, y + 22, 9).lineStyle(2, 0x18202c, 1).strokeCircle(x + 22, y + 22, 9);
      this.add.text(x + 40, y + 22, `${full ? '★ ' : ''}${typeNameEs(p.type)}`, { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: HEX.text })
        .setOrigin(0, 0.5);
      this.add.text(x + cw - 16, y + 22, `${p.done}/${p.total}`, { fontFamily: FONT, fontSize: '15px', color: HEX.textSoft }).setOrigin(1, 0.5);
      // Barra con una marca en cada hito (25, 50, 75 %)
      const bx = x + 16;
      const bw = cw - 32;
      const g = this.add.graphics();
      g.fillStyle(COLORS.navy, 1).fillRect(bx, y + 40, bw, 14);
      g.fillStyle(full ? COLORS.hpGreen : c, 1).fillRect(bx + 2, y + 42, Math.round((bw - 4) * Math.min(1, p.percent / 100)), 10);
      for (const m of DEX_MILESTONES.slice(0, -1)) g.fillStyle(0xffffff, 0.8).fillRect(bx + Math.round((bw * m) / 100) - 1, y + 38, 2, 18);
      const next = DEX_MILESTONES.find((m) => p.percent < m);
      this.add.text(x + 16, y + 62, next ? `${p.percent} % · al ${next} %: +${DEX_CANDIES[next]} caramelos` : '¡Tipo completo!', {
        fontFamily: FONT, fontSize: '12px', color: next ? '#b8860b' : '#2e9a4a',
      }).setOrigin(0, 0.5);
    });

    this.add
      .text(480, 626, 'Se rellena al derrotar enemigos y el premio se da solo · Esc, B o "Volver" para salir', {
        fontFamily: FONT, fontSize: '14px', color: '#ffffff',
      })
      .setOrigin(0.5).setAlpha(0.7);
  }

  private back() {
    if (this.leaving) return;
    this.leaving = true;
    goTo(this, 'Slots');
  }

  update() {
    if (this.leaving) return;
    if (this.nav.read().back) this.back();
  }
}
