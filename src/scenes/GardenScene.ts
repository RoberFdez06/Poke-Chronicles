import Phaser from 'phaser';
import { addHelpBar } from '../ui/helpBar';
import { addBerryIcon, addGardenPlot } from '../ui/art/berryArt';
import { fitDesign } from '../ui/layout';
import { loadGarden, saveGarden } from '../data/save';
import {
  GARDEN_BERRIES, GARDEN_BERRY_IDS, GARDEN_CARRY, GARDEN_PLOTS, harvest, isRipe, plant, runsLeft, type GardenBerryId, type GardenState,
} from '../data/berries';
import { addBackButton } from '../ui/cards';
import { NavInput } from '../ui/nav';
import { COLORS, drawBox, fadeIn, FONT, goTo, HEX } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';
import { sfx } from '../ui/audio';

const PLOT = { y: 250, w: 190, h: 190, gap: 26 };
const plotX = (k: number) => 480 + (k - (GARDEN_PLOTS - 1) / 2) * (PLOT.w + PLOT.gap);
const SEED_Y = 470;
const seedX = (k: number) => 480 + (k - (GARDEN_BERRY_IDS.length - 1) / 2) * 290;

/**
 * T85: huerto de bayas. ←/→ (o A/D, cruceta) elige parcela, ↑/↓ elige semilla y Enter/Espacio/A planta o recoge.
 * Con ratón: clic en una semilla para elegirla y clic en una parcela para plantar o recoger. Esc, B o "Volver" sale.
 */
export class GardenScene extends Phaser.Scene {
  private nav!: NavInput;
  private leaving = false;
  private garden!: GardenState;
  private plotSel = 0;
  private seedSel = 0;
  private layer?: Phaser.GameObjects.Container;
  private message!: Phaser.GameObjects.Text;

  constructor() {
    super('Garden');
  }

  create() {
    this.leaving = false;
    this.nav = new NavInput(this);
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    addBackButton(this, () => this.back());
    this.add.text(480, 44, 'Huerto de bayas', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: HEX.gold })
      .setOrigin(0.5).setStroke('#2b3a67', 10);
    this.add.text(480, 94, 'Las semillas salen en cofres y tiendas. Crecen con cada partida que juegas.', {
      fontFamily: FONT, fontSize: '16px', color: '#ffffff',
    }).setOrigin(0.5).setStroke('#2b3a67', 5);
    this.garden = loadGarden();
    this.seedSel = Math.max(0, GARDEN_BERRY_IDS.findIndex((b) => this.garden.seeds[b] > 0));
    this.message = this.add.text(480, 590, '', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5).setStroke('#2b3a67', 6).setDepth(5);
    addHelpBar(this, 480, 622, '←/→ parcela · ↑/↓ semilla · Enter planta/recoge · clic también · Esc o "Volver" para salir', {
      fontFamily: FONT, fontSize: '13px', color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0.7);
    this.draw();
  }

  private draw() {
    this.layer?.destroy();
    const L = this.add.container(0, 0);
    this.layer = L;
    const g = this.add.graphics();
    L.add(g);
    const text = (x: number, y: number, s: string, size: number, color: string = HEX.text, bold = false) => {
      const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', align: 'center' }).setOrigin(0.5);
      L.add(t);
      return t;
    };

    // --- Parcelas ---
    for (let k = 0; k < GARDEN_PLOTS; k++) {
      const x = plotX(k) - PLOT.w / 2;
      const p = this.garden.plots[k];
      drawBox(g, x, PLOT.y - PLOT.h / 2, PLOT.w, PLOT.h, { radius: 14, selected: k === this.plotSel });
      L.add(addGardenPlot(this, plotX(k), PLOT.y - 20, PLOT.w - 40, p, !!p && isRipe(p)));
      if (p) {
        const b = GARDEN_BERRIES[p.berry];
        const ripe = isRipe(p);
        text(plotX(k), PLOT.y - PLOT.h / 2 + 20, b.name, 16, HEX.text, true);
        text(plotX(k), PLOT.y + 64, ripe ? '¡Lista para recoger!' : `Faltan ${runsLeft(p)} ${runsLeft(p) === 1 ? 'partida' : 'partidas'}`, 14,
          ripe ? '#2e9a4a' : HEX.textSoft, ripe);
      } else {
        text(plotX(k), PLOT.y - PLOT.h / 2 + 20, `Parcela ${k + 1}`, 16, HEX.textSoft, true);
        text(plotX(k), PLOT.y + 64, 'Vacía: planta aquí', 14, HEX.textSoft);
      }
      const zone = this.add.zone(plotX(k), PLOT.y, PLOT.w, PLOT.h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.plotSel = k;
        this.act();
      });
      L.add(zone);
    }

    // --- Semillas y cesta ---
    text(480, SEED_Y - 70, 'Semillas (elige cuál plantar)', 18, '#ffffff', true).setStroke('#2b3a67', 6);
    GARDEN_BERRY_IDS.forEach((id, k) => {
      const b = GARDEN_BERRIES[id];
      const x = seedX(k);
      const sel = k === this.seedSel;
      drawBox(g, x - 135, SEED_Y - 40, 270, 96, { radius: 12, selected: sel, fill: sel ? COLORS.goldSoft : COLORS.panel });
      L.add(addBerryIcon(this, id, x - 108, SEED_Y - 10));
      const t = this.add.text(x - 90, SEED_Y - 12, `${b.name}  ×${this.garden.seeds[id]}`, { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: HEX.text })
        .setOrigin(0, 0.5);
      L.add(t);
      L.add(this.add.text(x, SEED_Y + 22, `${b.description}\nCrece en ${b.growRuns} ${b.growRuns === 1 ? 'partida' : 'partidas'} · cesta: ${this.garden.basket[id]}`, {
        fontFamily: FONT, fontSize: '12px', color: HEX.textSoft, align: 'center', wordWrap: { width: 250 },
      }).setOrigin(0.5));
      const zone = this.add.zone(x, SEED_Y + 8, 270, 96).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.seedSel = k;
        sfx('select');
        this.draw();
      });
      L.add(zone);
    });
    const total = GARDEN_BERRY_IDS.reduce((n, id) => n + this.garden.basket[id], 0);
    text(480, 140, `Cesta: ${total} ${total === 1 ? 'baya' : 'bayas'} · te llevas hasta ${GARDEN_CARRY} a cada partida y se usan solas`, 15, '#ffffff')
      .setStroke('#2b3a67', 5);
  }

  /** Planta la semilla elegida en la parcela elegida, o recoge si está madura. */
  private act() {
    const p = this.garden.plots[this.plotSel];
    if (p) {
      const r = harvest(this.garden, this.plotSel);
      if (!r) return this.say(`Aún le ${runsLeft(p) === 1 ? 'falta 1 partida' : `faltan ${runsLeft(p)} partidas`}`);
      this.garden = r.state;
      sfx('buy');
      this.say(`¡Recoges ${r.amount} × ${GARDEN_BERRIES[r.berry].name}! Van a la cesta`);
    } else {
      const berry: GardenBerryId = GARDEN_BERRY_IDS[this.seedSel];
      const next = plant(this.garden, this.plotSel, berry);
      if (!next) return this.say(`No tienes semillas de ${GARDEN_BERRIES[berry].name}`);
      this.garden = next;
      sfx('select');
      this.say(`Plantada: ${GARDEN_BERRIES[berry].name}`);
    }
    saveGarden(this.garden);
    this.draw();
  }

  private say(s: string) {
    this.message.setText(s);
  }

  private back() {
    if (this.leaving) return;
    this.leaving = true;
    goTo(this, 'Menu');
  }

  update() {
    if (this.leaving) return;
    const n = this.nav.read();
    if (n.back) return this.back();
    if (n.dx !== 0) {
      this.plotSel = (this.plotSel + n.dx + GARDEN_PLOTS) % GARDEN_PLOTS;
      this.draw();
    }
    if (n.dy !== 0) {
      const len = GARDEN_BERRY_IDS.length;
      this.seedSel = (this.seedSel + n.dy + len) % len;
      this.draw();
    }
    if (n.ok) this.act();
  }
}
