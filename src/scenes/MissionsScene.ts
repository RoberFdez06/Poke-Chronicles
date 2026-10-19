import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { loadMissions } from '../data/save';
import { dayNumber } from '../data/gacha';
import { ACHIEVEMENTS, dailyMissions, isAchieved, rewardText, type Reward } from '../data/missions';
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

  constructor() {
    super('Missions');
  }

  create() {
    this.leaving = false;
    this.nav = new NavInput(this);
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    addBackButton(this, () => this.back());

    this.add.text(480, 44, 'Misiones', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: HEX.gold })
      .setOrigin(0.5).setStroke('#2b3a67', 10);

    const day = dayNumber();
    const state = loadMissions(day);

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

    // --- Logros (3 × 3) ---
    this.add.text(480, 306, 'Logros', { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: HEX.gold })
      .setOrigin(0.5).setStroke('#2b3a67', 8);
    const cw = 284;
    const ch = 82;
    ACHIEVEMENTS.forEach((a, k) => {
      const x = 40 + (k % 3) * (cw + 14);
      const y = 330 + Math.floor(k / 3) * (ch + 8);
      const n = Math.min(a.goal, state.achievements[a.id] ?? 0);
      const done = isAchieved(state, a.id);
      drawBox(this.add.graphics(), x, y, cw, ch, { radius: 12, fill: done ? COLORS.goldSoft : COLORS.panel });
      this.add.text(x + 16, y + 18, `${done ? '★ ' : ''}${a.name}`, { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: HEX.text })
        .setOrigin(0, 0.5);
      this.add.text(x + 16, y + 40, a.text, { fontFamily: FONT, fontSize: '14px', color: HEX.textSoft }).setOrigin(0, 0.5);
      this.add.text(x + 16, y + 62, rewardText(a.reward, itemNames(a.reward)), {
        fontFamily: FONT, fontSize: '12px', color: '#b8860b', wordWrap: { width: cw - 32 },
      }).setOrigin(0, 0.5);
      if (a.goal > 1 && !done) {
        this.bar(x + cw - 76, y + 40, 60, n / a.goal);
        this.add.text(x + cw - 16, y + 18, `${n}/${a.goal}`, { fontFamily: FONT, fontSize: '13px', color: HEX.textSoft }).setOrigin(1, 0.5);
      }
    });

    this.add
      .text(480, 612, 'Se cumplen jugando y el premio se da solo · Esc, B o "Volver" para salir', {
        fontFamily: FONT, fontSize: '14px', color: '#ffffff',
      })
      .setOrigin(0.5).setAlpha(0.7);
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
    if (this.nav.read().back) this.back();
  }
}
