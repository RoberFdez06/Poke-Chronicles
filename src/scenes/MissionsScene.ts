import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { loadMedals, loadMissions } from '../data/save';
import { dayNumber } from '../data/gacha';
import { ACHIEVEMENTS, dailyMissions, isAchieved, NPC_MAX_ACTIVE, npcMissionById, rewardText, type Reward } from '../data/missions';
import { MEDALS } from '../data/medals';
import { passiveById } from '../data/items';
import { addBackButton } from '../ui/cards';
import { NavInput } from '../ui/nav';
import { COLORS, drawBox, fadeIn, FONT, goTo, HEX } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';
import { addIcon } from '../ui/art/icons';

const itemNames = (r: Reward) => ({ item: r.item ? passiveById(r.item)?.name : undefined });

/** Horas y minutos que faltan para medianoche (cuando cambian las diarias). */
function untilMidnight(now = new Date()): string {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  const min = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 60000));
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

/**
 * Misiones de hoy y logros (T24): solo se consultan; el progreso se suma jugando y los premios se dan solos.
 * Se sale con Esc, B o "Volver" (teclado, mando o ratón).
 */
export class MissionsScene extends Phaser.Scene {
  private nav!: NavInput;
  private leaving = false;
  /** 0 = misiones de hoy, medallas y logros; 1 = encargos de NPC (T87). */
  private page = 0;

  constructor() {
    super('Missions');
  }

  create(data?: { page?: number }) {
    this.leaving = false;
    this.page = data?.page === 1 ? 1 : 0;
    this.nav = new NavInput(this);
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    addBackButton(this, () => this.back());

    this.add.text(480, 44, 'Misiones', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: HEX.gold })
      .setOrigin(0.5).setStroke('#2b3a67', 10);

    const day = dayNumber();
    const state = loadMissions(day);

    // Pestaña para cambiar de página: clic, ←/→ (o A/D) o cruceta/stick
    const tab = this.add
      .text(920, 44, this.page === 0 ? 'Encargos de NPC ▸' : '◂ Misiones y logros', {
        fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#2b3a67', padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    tab.on('pointerdown', () => this.flip());

    if (this.page === 1) {
      this.npcPage(state.npc);
      return;
    }

    // --- Diarias ---
    drawBox(this.add.graphics(), 40, 84, 880, 196, { radius: 14 });
    this.add.text(64, 108, 'Misiones de hoy', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: HEX.text }).setOrigin(0, 0.5);
    this.add.text(896, 108, `Cambian en ${untilMidnight()}`, { fontFamily: FONT, fontSize: '15px', color: HEX.textSoft }).setOrigin(1, 0.5);
    dailyMissions(day).forEach((m, k) => {
      const y = 148 + k * 44;
      const n = Math.min(m.goal, state.daily[k] ?? 0);
      const done = n >= m.goal;
      this.add.text(64, y, done ? '✔' : '•', { fontFamily: FONT, fontSize: '20px', color: done ? '#2e9a4a' : HEX.text }).setOrigin(0, 0.5);
      this.add.text(92, y, m.text, { fontFamily: FONT, fontSize: '18px', color: done ? '#2e9a4a' : HEX.text }).setOrigin(0, 0.5);
      this.bar(560, y, 160, n / m.goal);
      this.add.text(732, y, `${n}/${m.goal}`, { fontFamily: FONT, fontSize: '16px', color: HEX.textSoft }).setOrigin(0, 0.5);
      addIcon(this, 812, y, 'ticket', 1.5);
      this.add.text(830, y, `+${m.reward.tickets}`, { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#b8860b' }).setOrigin(0, 0.5);
    });

    // --- Medallas de gimnasio ---
    const have = loadMedals();
    this.add.text(40, 308, `Medallas ${have.length}/${MEDALS.length}`, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: HEX.gold })
      .setOrigin(0, 0.5).setStroke('#2b3a67', 6);
    MEDALS.forEach((m, k) => {
      const x = 270 + k * 80;
      const got = have.includes(m.id);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.25).fillCircle(x, 311, 21);
      g.fillStyle(got ? m.color : 0x55596b, 1).fillCircle(x, 308, 20);
      g.lineStyle(3, got ? 0xffffff : 0x3a3d4c, 1).strokeCircle(x, 308, 20);
      g.lineStyle(2, got ? 0x000000 : 0x3a3d4c, got ? 0.25 : 1).strokeCircle(x, 308, 13);
      this.add.text(x, 308, got ? m.glyph : '?', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: got ? '#ffffff' : '#8a8ea0' })
        .setOrigin(0.5).setStroke(got ? '#00000066' : '#00000000', 3);
      this.add.text(x, 336, got ? m.name.replace('Medalla ', '') : '???', { fontFamily: FONT, fontSize: '12px', color: got ? '#ffffff' : '#9aa0b4' })
        .setOrigin(0.5);
    });

    // --- Logros (3 × 3) ---
    this.add.text(480, 360, 'Logros', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: HEX.gold })
      .setOrigin(0.5).setStroke('#2b3a67', 8);
    const cw = 284;
    const ch = 72;
    ACHIEVEMENTS.forEach((a, k) => {
      const x = 40 + (k % 3) * (cw + 14);
      const y = 380 + Math.floor(k / 3) * (ch + 6);
      const n = Math.min(a.goal, state.achievements[a.id] ?? 0);
      const done = isAchieved(state, a.id);
      drawBox(this.add.graphics(), x, y, cw, ch, { radius: 12, fill: done ? COLORS.goldSoft : COLORS.panel });
      this.add.text(x + 16, y + 16, `${done ? '★ ' : ''}${a.name}`, { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: HEX.text })
        .setOrigin(0, 0.5);
      this.add.text(x + 16, y + 36, a.text, { fontFamily: FONT, fontSize: '14px', color: HEX.textSoft }).setOrigin(0, 0.5);
      this.add.text(x + 16, y + 56, rewardText(a.reward, itemNames(a.reward)), {
        fontFamily: FONT, fontSize: '12px', color: '#b8860b', wordWrap: { width: cw - 32 },
      }).setOrigin(0, 0.5);
      if (a.goal > 1 && !done) {
        this.bar(x + cw - 76, y + 36, 60, n / a.goal);
        this.add.text(x + cw - 16, y + 16, `${n}/${a.goal}`, { fontFamily: FONT, fontSize: '13px', color: HEX.textSoft }).setOrigin(1, 0.5);
      }
    });

    this.add
      .text(480, 626, 'Se cumplen jugando y el premio se da solo · Esc, B o "Volver" para salir', {
        fontFamily: FONT, fontSize: '14px', color: '#ffffff',
      })
      .setOrigin(0.5).setAlpha(0.7);
  }

  /** T87: los encargos de NPC activos (máximo 3), con su diálogo, progreso, partidas que quedan y premio. */
  private npcPage(active: readonly { id: string; n: number; runsLeft: number }[]) {
    this.add.text(480, 100, `Encargos de NPC ${active.length}/${NPC_MAX_ACTIVE}`, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: HEX.gold })
      .setOrigin(0.5).setStroke('#2b3a67', 8);
    for (let k = 0; k < NPC_MAX_ACTIVE; k++) {
      const y = 130 + k * 150;
      drawBox(this.add.graphics(), 40, y, 880, 136, { radius: 14 });
      const a = active[k];
      const m = a ? npcMissionById(a.id) : undefined;
      if (!a || !m) {
        this.add.text(480, y + 68, 'Hueco libre: habla con los NPC del Centro Pokémon o de la tienda', {
          fontFamily: FONT, fontSize: '17px', color: HEX.textSoft,
        }).setOrigin(0.5);
        continue;
      }
      // TODO(supervisor): retrato del NPC; de momento un círculo de color liso
      this.add.circle(84, y + 50, 24, 0xe6a23c);
      this.add.text(124, y + 26, m.npc, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: HEX.text }).setOrigin(0, 0.5);
      this.add.text(124, y + 56, `«${m.dialog}»`, { fontFamily: FONT, fontSize: '14px', fontStyle: 'italic', color: HEX.textSoft, wordWrap: { width: 760 } })
        .setOrigin(0, 0.5);
      this.add.text(124, y + 92, m.text, { fontFamily: FONT, fontSize: '17px', color: HEX.text }).setOrigin(0, 0.5);
      this.bar(560, y + 92, 160, a.n / m.goal);
      this.add.text(732, y + 92, `${a.n}/${m.goal}`, { fontFamily: FONT, fontSize: '16px', color: HEX.textSoft }).setOrigin(0, 0.5);
      addIcon(this, 812, y + 92, 'ticket', 1.5);
      this.add.text(830, y + 92, `+${m.reward.tickets}`, { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#b8860b' }).setOrigin(0, 0.5);
      this.add.text(124, y + 118, a.runsLeft === 1 ? 'Caduca al acabar esta partida' : `Caduca en ${a.runsLeft} partidas`, {
        fontFamily: FONT, fontSize: '13px', color: a.runsLeft === 1 ? '#c0392b' : HEX.textSoft,
      }).setOrigin(0, 0.5);
    }
    this.add
      .text(480, 626, 'Te los dan los NPC al entrar en su sala · ←/→ o clic arriba para cambiar · Esc, B o "Volver" para salir', {
        fontFamily: FONT, fontSize: '14px', color: '#ffffff',
      })
      .setOrigin(0.5).setAlpha(0.7);
  }

  private flip() {
    if (this.leaving) return;
    this.scene.restart({ page: this.page === 0 ? 1 : 0 });
  }

  /** Barrita de progreso (0-1). */
  private bar(x: number, y: number, w: number, f: number) {
    const g = this.add.graphics();
    g.fillStyle(COLORS.navy, 1).fillRect(x, y - 6, w, 12);
    g.fillStyle(f >= 1 ? COLORS.hpGreen : COLORS.gold, 1).fillRect(x + 2, y - 4, Math.round((w - 4) * Math.max(0, Math.min(1, f))), 8);
  }

  private back() {
    if (this.leaving) return;
    this.leaving = true;
    goTo(this, 'Slots');
  }

  update() {
    if (this.leaving) return;
    const n = this.nav.read();
    if (n.back) this.back();
    else if (n.dx !== 0) this.flip();
  }
}
