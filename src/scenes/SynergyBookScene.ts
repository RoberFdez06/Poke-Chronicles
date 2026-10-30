import Phaser from 'phaser';
import { addHelpBar } from '../ui/helpBar';
import { COVER_H, COVER_W, DCX, DCY, fitDesign } from '../ui/layout';
import { NavInput } from '../ui/nav';
import { drawBox, fadeIn, FONT, goTo, HEX, lowFx, shorten } from '../ui/theme';
import { addBackButton } from '../ui/cards';
import { addMenuBackdrop } from '../ui/art/landscape';
import { addPixelText } from '../ui/art/pixel';
import { badgeTexture, bookTexture } from '../ui/art/synergyArt';
import { bookEntries, bookProgress, type BookEntry } from '../data/synergyFx';
import { loadSynergiesFound } from '../data/save';
import { sfx } from '../ui/audio';

export interface SynergyBookData {
  /** Abierto encima de la pausa: al cerrar se llama a onClose y no se cambia de escena. */
  overlay?: boolean;
  onClose?: () => void;
  /** Pantalla a la que volver si no es overlay (por defecto la Pokédex). */
  from?: string;
  /** Sinergias activas en la partida (se marcan). */
  active?: string[];
  /** Sinergias a las que les falta una pieza (texto ya hecho). */
  near?: string[];
}

const PER_PAGE = 9;
const LIST = { x: 40, y: 104, w: 440, rowH: 46 };
const CARD = { x: 500, y: 104, w: 420, h: 420 };

/**
 * Libro de sinergias: las descubiertas con su receta y efecto; las demás como «???» con cuántas piezas piden.
 * Teclado (flechas, Enter no hace falta, Esc), ratón (pasar/clic en filas, ◀ ▶ y «Volver») y mando (cruceta/stick, B).
 */
export class SynergyBookScene extends Phaser.Scene {
  private args: SynergyBookData = {};
  private nav!: NavInput;
  private entries: BookEntry[] = [];
  private page = 0;
  private selected = 0;
  private leaving = false;
  private rows: { bg: Phaser.GameObjects.Graphics; name: Phaser.GameObjects.Text; info: Phaser.GameObjects.Text; badge: Phaser.GameObjects.Image }[] = [];
  private card!: { g: Phaser.GameObjects.Graphics; title: Phaser.GameObjects.Text; tag: Phaser.GameObjects.Text; recipe: Phaser.GameObjects.Text; desc: Phaser.GameObjects.Text; badge: Phaser.GameObjects.Image };
  private pageLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('SynergyBook');
  }

  init(data: SynergyBookData) {
    this.args = data ?? {};
    this.sys.settings.data = {};
  }

  create() {
    this.leaving = false;
    this.page = 0;
    this.selected = 0;
    this.rows = [];
    fitDesign(this);
    this.nav = new NavInput(this);
    if (this.args.overlay) this.add.rectangle(DCX, DCY, COVER_W + 4, COVER_H + 4, 0x0d1425, 0.86).setInteractive();
    else {
      fadeIn(this);
      addMenuBackdrop(this);
    }
    addBackButton(this, () => this.back());
    const found = loadSynergiesFound();
    this.entries = bookEntries(found);
    const prog = bookProgress(found);
    this.add.image(300, 44, bookTexture(this)).setScale(3.4);
    addPixelText(this, DCX + 20, 44, 'LIBRO DE SINERGIAS', { size: 16, scale: 2.2, color: '#f8d030', stroke: '#283068', strokeWidth: 3, shadow: '#101828' });
    this.add.text(DCX, 80, `Descubiertas ${prog.found} de ${prog.total} · consigue las piezas en la misma partida`, { fontFamily: FONT, fontSize: '15px', color: '#ffffff' }).setOrigin(0.5);

    drawBox(this.add.graphics(), LIST.x - 10, LIST.y - 12, LIST.w + 20, PER_PAGE * LIST.rowH + 20, { radius: 14 });
    for (let i = 0; i < PER_PAGE; i++) {
      const y = LIST.y + i * LIST.rowH;
      const bg = this.add.graphics();
      const badge = this.add.image(LIST.x + 22, y + LIST.rowH / 2 - 2, badgeTexture(this)).setScale(2.2);
      const name = this.add.text(LIST.x + 46, y + 6, '', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: HEX.text });
      const info = this.add.text(LIST.x + 46, y + 25, '', { fontFamily: FONT, fontSize: '12px', color: HEX.textSoft });
      const zone = this.add.zone(LIST.x + LIST.w / 2, y + LIST.rowH / 2 - 2, LIST.w, LIST.rowH - 4).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.select(this.page * PER_PAGE + i));
      zone.on('pointerdown', () => this.select(this.page * PER_PAGE + i, true));
      this.rows.push({ bg, name, info, badge });
    }
    const g = this.add.graphics();
    drawBox(g, CARD.x, CARD.y - 12, CARD.w, CARD.h, { radius: 14 });
    this.card = {
      g: this.add.graphics(),
      badge: this.add.image(CARD.x + 40, CARD.y + 30, badgeTexture(this)).setScale(4),
      title: this.add.text(CARD.x + 80, CARD.y + 8, '', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: HEX.text, wordWrap: { width: CARD.w - 100 } }),
      tag: this.add.text(CARD.x + 80, CARD.y + 40, '', { fontFamily: FONT, fontSize: '14px', color: HEX.textSoft }),
      recipe: this.add.text(CARD.x + 24, CARD.y + 84, '', { fontFamily: FONT, fontSize: '16px', color: '#8a5a00', fontStyle: 'bold', wordWrap: { width: CARD.w - 48 }, lineSpacing: 4 }),
      desc: this.add.text(CARD.x + 24, CARD.y + 170, '', { fontFamily: FONT, fontSize: '16px', color: HEX.text, wordWrap: { width: CARD.w - 48 }, lineSpacing: 4 }),
    };
    if (!lowFx()) this.tweens.add({ targets: this.card.badge, angle: { from: -6, to: 6 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Las de esta partida a las que les falta una pieza (solo desde la pausa)
    const near = this.args.near ?? [];
    if (near.length > 0) {
      this.add.text(CARD.x + 24, CARD.y + 300, 'Cerca en esta partida:', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: HEX.text });
      this.add.text(CARD.x + 24, CARD.y + 320, near.slice(0, 4).map((n) => '· ' + shorten(n, 46)).join('\n'), { fontFamily: FONT, fontSize: '13px', color: '#8a5a00', lineSpacing: 3 });
    }

    this.pageLabel = this.add.text(LIST.x + LIST.w / 2, 548, '', { fontFamily: FONT, fontSize: '15px', color: '#ffffff' }).setOrigin(0.5);
    for (const [label, x, d] of [['◀', LIST.x + 40, -1], ['▶', LIST.x + LIST.w - 40, 1]] as const) {
      const t = this.add.text(x, 548, label, { fontFamily: FONT, fontSize: '30px', color: '#ffffff' }).setOrigin(0.5).setPadding(10, 4).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor(HEX.gold));
      t.on('pointerout', () => t.setColor('#ffffff'));
      t.on('pointerdown', () => this.turn(d));
    }
    addHelpBar(this, DCX, 608, 'Flechas o ratón: elegir · ←/→: página · Esc, B o «Volver»: salir', { fontFamily: FONT, fontSize: '13px', color: '#ffffff' })
      .setOrigin(0.5).setAlpha(0.75);
    this.paint();
  }

  private pages() {
    return Math.max(1, Math.ceil(this.entries.length / PER_PAGE));
  }

  private turn(d: number) {
    const n = this.pages();
    this.page = (this.page + d + n) % n;
    this.selected = Math.min(this.entries.length - 1, this.page * PER_PAGE);
    sfx('select');
    this.paint();
  }

  private select(i: number, click = false) {
    if (i < 0 || i >= this.entries.length || (i === this.selected && !click)) return;
    this.selected = i;
    this.page = Math.floor(i / PER_PAGE);
    if (click) sfx('select');
    this.paint();
  }

  private paint() {
    const active = new Set(this.args.active ?? []);
    this.rows.forEach((r, k) => {
      const i = this.page * PER_PAGE + k;
      const e = this.entries[i];
      r.bg.clear();
      const vis = !!e;
      r.name.setVisible(vis);
      r.info.setVisible(vis);
      r.badge.setVisible(vis);
      if (!e) return;
      const y = LIST.y + k * LIST.rowH;
      if (i === this.selected) drawBox(r.bg, LIST.x, y, LIST.w, LIST.rowH - 4, { radius: 8, selected: true });
      r.name.setText(e.name + (active.has(e.id) ? '  · activa' : '')).setColor(e.found ? (e.transform ? '#7a3ab8' : HEX.text) : '#8a93a6');
      r.info.setText(`${e.transform ? 'Transformación' : 'Sinergia'} · ${e.pieces} piezas`);
      r.badge.setAlpha(e.found ? 1 : 0.25).setTint(e.found ? 0xffffff : 0x808080);
    });
    this.pageLabel.setText(`Página ${this.page + 1} de ${this.pages()}`);
    const e = this.entries[this.selected];
    if (!e) return;
    const c = this.card;
    c.title.setText(e.name).setColor(e.found ? (e.transform ? '#7a3ab8' : HEX.text) : '#8a93a6');
    c.tag.setText(`${e.transform ? 'Transformación (muy rara)' : 'Sinergia'} · ${e.pieces} piezas${active.has(e.id) ? ' · activa ahora' : ''}`);
    c.recipe.setText(e.found ? `Receta: ${e.recipe}` : e.recipe);
    c.desc.setText(e.description);
    c.badge.setAlpha(e.found ? 1 : 0.3).setTint(e.found ? 0xffffff : 0x808080);
  }

  private back() {
    if (this.leaving) return;
    this.leaving = true;
    sfx('select');
    if (this.args.overlay) {
      const done = this.args.onClose;
      this.scene.stop();
      done?.();
    } else goTo(this, this.args.from ?? 'Pokedex');
  }

  update() {
    if (this.leaving) return;
    const s = this.nav.read();
    if (s.back || s.pause) return this.back();
    if (s.dy) {
      const n = this.entries.length;
      this.select((this.selected + Math.sign(s.dy) + n) % n);
    }
    if (s.dx) this.turn(Math.sign(s.dx));
  }
}
