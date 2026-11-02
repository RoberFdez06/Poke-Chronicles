import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { addBackButton } from '../ui/cards';
import { NavInput, PadButtons } from '../ui/nav';
import { drawBox, fadeIn, FONT, goTo, HEX } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';
import { sfx } from '../ui/audio';
import { clampScroll, docParagraphs, LEGAL_DOCS, stepTab } from '../data/legal';

const PANEL = { x: 30, y: 104, w: 900, h: 484 };
const VIEW = { x: 52, y: 118, w: 840, h: 456 };
const LINE_STEP = 48;

/**
 * «Créditos y aviso legal» y «Privacidad» (dos pestañas). Texto largo con desplazamiento:
 * teclado (↑↓ / W S; ←→ / A D cambian de pestaña), ratón (rueda, flechas ▲▼, pestañas) y mando (cruceta o palo; LB/RB pestañas; B atrás).
 */
export class LegalScene extends Phaser.Scene {
  private nav!: NavInput;
  private pad!: PadButtons;
  private leaving = false;
  private from = 'Menu';
  private tab = 0;
  private scrollY = 0;
  private contentH = 0;
  private content?: Phaser.GameObjects.Container;
  private tabBtns: { bg: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; w: number }[] = [];
  private bar!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Legal');
  }

  init(data: { from?: string; tab?: number }) {
    this.from = data?.from ?? 'Menu';
    this.tab = data?.tab ?? 0;
    this.sys.settings.data = {};
  }

  create() {
    this.leaving = false;
    this.scrollY = 0;
    this.tabBtns = [];
    this.nav = new NavInput(this);
    this.pad = new PadButtons(this);
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    addBackButton(this, () => this.back());
    this.add.text(480, 40, 'Créditos y legal', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: HEX.gold })
      .setOrigin(0.5).setStroke('#2b3a67', 10);

    drawBox(this.add.graphics(), PANEL.x, PANEL.y, PANEL.w, PANEL.h, { radius: 14 });
    this.buildTabs();
    this.bar = this.add.graphics().setDepth(3);

    // Flechas para el ratón (la rueda también vale)
    this.addScrollButton(912, PANEL.y + 22, '▲', -1);
    this.addScrollButton(912, PANEL.y + PANEL.h - 22, '▼', 1);
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => dy !== 0 && this.scrollBy(Math.sign(dy) * LINE_STEP));

    this.add.text(480, 614, '↑↓ desplazar · ←→ cambiar de apartado · Esc, B o «Volver» para salir', { fontFamily: FONT, fontSize: '14px', color: '#ffffff' })
      .setOrigin(0.5).setAlpha(0.7);
    this.showTab(this.tab);
  }

  private buildTabs() {
    const w = 330;
    LEGAL_DOCS.forEach((doc, i) => {
      const x = 480 + (i - (LEGAL_DOCS.length - 1) / 2) * (w + 16);
      const bg = this.add.graphics();
      const label = this.add.text(x, 84, doc.tab, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: HEX.text }).setOrigin(0.5);
      const zone = this.add.zone(x, 84, w, 32).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.showTab(i));
      this.tabBtns.push({ bg, label, w });
      bg.setPosition(x, 84);
    });
  }

  private addScrollButton(x: number, y: number, glyph: string, dir: number) {
    const t = this.add.text(x, y, glyph, { fontFamily: FONT, fontSize: '22px', color: HEX.text }).setOrigin(0.5).setDepth(4)
      .setPadding(6, 4).setInteractive({ useHandCursor: true });
    t.on('pointerdown', () => this.scrollBy(dir * LINE_STEP));
  }

  private showTab(i: number) {
    this.tab = i;
    this.tabBtns.forEach((b, k) => {
      b.bg.clear();
      drawBox(b.bg, -b.w / 2, -16, b.w, 32, { radius: 6, selected: k === i });
      b.label.setColor(k === i ? '#2850b0' : HEX.text);
    });
    this.content?.destroy();
    const items = docParagraphs(LEGAL_DOCS[i]);
    this.content = this.add.container(VIEW.x, VIEW.y).setDepth(2);
    let y = 0;
    for (const it of items) {
      const title = it.kind === 'title';
      if (title) y += 10;
      const t = this.add.text(0, y, it.text, {
        fontFamily: FONT, fontSize: title ? '22px' : '17px', fontStyle: title ? 'bold' : 'normal',
        color: title ? '#2850b0' : HEX.text, wordWrap: { width: VIEW.w - 30 }, lineSpacing: 4,
      });
      this.content.add(t);
      y += t.height + (title ? 6 : 12);
    }
    this.contentH = y;
    const mask = this.make.graphics({}, false).fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    this.content.setMask(mask.createGeometryMask());
    this.scrollY = 0;
    this.applyScroll();
  }

  private scrollBy(d: number) {
    this.scrollY = clampScroll(this.scrollY + d, this.contentH, VIEW.h);
    this.applyScroll();
  }

  private applyScroll() {
    this.content?.setY(VIEW.y - this.scrollY);
    this.bar.clear();
    if (this.contentH <= VIEW.h) return;
    const trackH = VIEW.h - 50;
    const thumbH = Math.max(24, (VIEW.h / this.contentH) * trackH);
    const top = VIEW.y + 25 + (this.scrollY / (this.contentH - VIEW.h)) * (trackH - thumbH);
    this.bar.fillStyle(0x2b3a67, 0.35).fillRoundedRect(906, top, 6, thumbH, 3);
  }

  private switchTab(d: number) {
    sfx('select');
    this.showTab(stepTab(this.tab, d));
  }

  private back() {
    if (this.leaving) return;
    this.leaving = true;
    goTo(this, this.from);
  }

  update() {
    if (this.leaving) return;
    const s = this.nav.read();
    const pad = this.pad.read();
    if (s.back) return this.back();
    if (s.dx !== 0) this.switchTab(s.dx);
    if (pad.has('LB')) this.switchTab(-1);
    if (pad.has('RB')) this.switchTab(1);
    if (s.dy !== 0) this.scrollBy(s.dy * LINE_STEP);
    // A / Enter: página siguiente (al final vuelve al principio)
    if (s.ok) this.scrollBy(this.scrollY >= this.contentH - VIEW.h ? -this.scrollY : VIEW.h - 40);
  }
}
