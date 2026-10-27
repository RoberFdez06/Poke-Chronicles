import Phaser from 'phaser';
import { COVER_H, COVER_W, DCX, DCY, fitDesign } from '../ui/layout';
import { NavInput, PadButtons } from '../ui/nav';
import { ARROW, drawBox, FONT, HEX } from '../ui/theme';
import { addPixelText } from '../ui/art/pixel';
import { drawAdminWrench } from '../ui/art/adminArt';
import { sfx } from '../ui/audio';

/**
 * Panel admin (ver data/admin.ts). Filas genéricas: quien lo abre (Ajustes o la partida) da las acciones.
 * Teclado: ↑/↓ elegir, ←/→ cambiar valor (Mayús ×10), números para escribir un valor, Enter usar, Esc/F9 cerrar.
 * Ratón: clic en la fila (en las de valor, la mitad izquierda baja y la derecha sube; doble zona en ◀ ▶).
 * Mando: cruceta/stick, A usar, B cerrar, LB/RB ±10.
 */
export interface AdminRow {
  /** Texto de la fila (se vuelve a pedir tras cada acción). */
  label: () => string;
  /** Enter / A / clic. Devuelve el aviso que se enseña abajo (nunca en el centro). */
  run?: () => string | void | Promise<string | void>;
  /** ←/→: cambia el valor de la fila. */
  adjust?: (d: number) => void;
  /** Número escrito con el teclado (filas de valor numérico). */
  setNumber?: (n: number) => void;
  /** Encabezado de sección (no se puede elegir). */
  header?: boolean;
}

export interface AdminData {
  rows: () => AdminRow[];
  onClose: () => void;
}

const PANEL = { x: 150, y: 24, w: 660, h: 592 };
const ROW_H = 30;
const TOP = 104;

export class AdminScene extends Phaser.Scene {
  private args!: AdminData;
  private nav!: NavInput;
  private pad!: PadButtons;
  private rows: AdminRow[] = [];
  private texts: Phaser.GameObjects.Text[] = [];
  private bgs: Phaser.GameObjects.Graphics[] = [];
  private selected = 0;
  private scroll = 0;
  private status!: Phaser.GameObjects.Text;
  private typed = '';
  private typedAt = 0;
  private born = 0;
  private done = false;
  private shift?: Phaser.Input.Keyboard.Key;
  private f9?: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Admin');
  }

  init(data: AdminData) {
    this.args = data;
    this.done = false;
    this.typed = '';
    this.scroll = 0;
    this.texts = [];
    this.bgs = [];
    this.rows = [];
    this.sys.settings.data = {};
  }

  private visible() {
    return Math.floor((PANEL.h - (TOP - PANEL.y) - 60) / ROW_H);
  }

  create() {
    fitDesign(this);
    this.born = this.time.now;
    this.nav = new NavInput(this);
    this.pad = new PadButtons(this);
    const kb = this.input.keyboard!;
    this.shift = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, false);
    this.f9 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F9, true);
    this.f9.reset();
    kb.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.add.rectangle(DCX, DCY, COVER_W + 4, COVER_H + 4, 0x0d1425, 0.78).setInteractive();
    drawBox(this.add.graphics(), PANEL.x, PANEL.y, PANEL.w, PANEL.h, { radius: 16, border: 0xc0392b });
    const g = this.add.graphics();
    drawAdminWrench(g, PANEL.x + 26, PANEL.y + 22, 4);
    addPixelText(this, DCX, PANEL.y + 38, 'PANEL ADMIN', { size: 16, scale: 2.2, color: '#f8d030', stroke: '#283068', strokeWidth: 3, shadow: '#101828' });
    this.add
      .text(DCX, PANEL.y + 64, 'Solo pruebas: la partida con trucos no cuenta para récords, medallas, misiones ni premios', { fontFamily: FONT, fontSize: '13px', color: HEX.textSoft })
      .setOrigin(0.5);
    for (let i = 0; i < this.visible(); i++) {
      const y = TOP + i * ROW_H;
      const bg = this.add.graphics();
      const t = this.add.text(PANEL.x + 40, y, '', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: HEX.text }).setOrigin(0, 0.5);
      const zone = this.add.zone(DCX, y, PANEL.w - 40, ROW_H - 2).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.pick(this.scroll + i));
      zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (this.time.now - this.born < 150) return;
        const k = this.scroll + i;
        const row = this.rows[k];
        if (!row || row.header) return;
        this.pick(k);
        if (row.adjust && !row.run) this.adjust(p.worldX < DCX ? -1 : 1);
        else if (row.adjust && p.worldX > PANEL.x + PANEL.w - 140) this.adjust(p.worldX < PANEL.x + PANEL.w - 70 ? -1 : 1);
        else this.use();
      });
      this.bgs.push(bg);
      this.texts.push(t);
    }
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.move(dy > 0 ? 1 : -1));
    // Aviso abajo a la izquierda del panel (nunca centrado)
    this.status = this.add.text(PANEL.x + 24, PANEL.y + PANEL.h - 44, '', { fontFamily: FONT, fontSize: '15px', color: '#b8f0c0', wordWrap: { width: PANEL.w - 48 } });
    this.add.text(PANEL.x + 24, PANEL.y + PANEL.h - 20, '↑/↓ elegir · ←/→ valor (Mayús/LB/RB ×10) · números: escribir · Enter/A usar · Esc/B/F9 cerrar', { fontFamily: FONT, fontSize: '12px', color: HEX.textSoft });
    this.rows = this.args.rows();
    this.selected = this.rows.findIndex((r) => !r.header);
    this.paint();
    sfx('select');
  }

  private onKey(e: KeyboardEvent) {
    if (this.done || !/^[0-9]$/.test(e.key)) return;
    const row = this.rows[this.selected];
    if (!row?.setNumber) return;
    if (this.time.now - this.typedAt > 1500) this.typed = '';
    this.typedAt = this.time.now;
    this.typed = (this.typed + e.key).slice(0, 5);
    row.setNumber(Number(this.typed));
    this.paint();
  }

  private pick(i: number) {
    if (i === this.selected || !this.rows[i] || this.rows[i].header) return;
    this.selected = i;
    this.typed = '';
    this.paint();
  }

  private move(d: number) {
    const n = this.rows.length;
    let i = this.selected;
    for (let k = 0; k < n; k++) {
      i = (i + d + n) % n;
      if (!this.rows[i].header) break;
    }
    this.selected = i;
    this.typed = '';
    sfx('select');
    this.paint();
  }

  private adjust(d: number) {
    const row = this.rows[this.selected];
    if (!row?.adjust) return;
    row.adjust(d);
    this.typed = '';
    sfx('select');
    this.paint();
  }

  private use() {
    const row = this.rows[this.selected];
    if (!row?.run) return;
    sfx('select');
    void Promise.resolve(row.run()).then((msg) => {
      if (this.done) return;
      if (msg) this.status.setText(msg);
      this.rows = this.args.rows();
      this.selected = Math.min(this.selected, this.rows.length - 1);
      this.paint();
    }).catch((err: unknown) => this.status.setText(`Error: ${String(err)}`));
  }

  private paint() {
    const vis = this.visible();
    if (this.selected < this.scroll) this.scroll = this.selected;
    if (this.selected >= this.scroll + vis) this.scroll = this.selected - vis + 1;
    this.texts.forEach((t, i) => {
      const k = this.scroll + i;
      const row = this.rows[k];
      const bg = this.bgs[i];
      bg.clear();
      if (!row) return t.setText('');
      const y = TOP + i * ROW_H;
      if (row.header) {
        t.setText(row.label()).setColor('#f8d030').setX(PANEL.x + 30);
        return;
      }
      const sel = k === this.selected;
      if (sel) drawBox(bg, PANEL.x + 20, y - ROW_H / 2 + 1, PANEL.w - 40, ROW_H - 2, { selected: true, radius: 0 });
      t.setText(`${sel ? ARROW + ' ' : '  '}${row.label()}`).setColor(HEX.text).setX(PANEL.x + 34);
    });
  }

  private close() {
    if (this.done) return;
    this.done = true;
    sfx('select');
    this.input.keyboard?.removeAllListeners('keydown');
    this.args.onClose();
  }

  update() {
    if (this.done) return;
    const s = this.nav.read();
    const p = this.pad.read();
    if (this.f9 && Phaser.Input.Keyboard.JustDown(this.f9) && this.time.now - this.born > 200) return this.close();
    if (s.back) return this.close();
    if (s.dy) this.move(s.dy);
    const big = this.shift?.isDown ? 10 : 1;
    if (s.dx) this.adjust(s.dx * big);
    if (p.has('LB')) this.adjust(-10);
    if (p.has('RB')) this.adjust(10);
    if (s.ok) this.use();
  }
}

/** Abre el panel encima de `host` (que queda en pausa) y lo reanuda al cerrar. */
export function openAdmin(host: Phaser.Scene, rows: () => AdminRow[], onClosed?: () => void): boolean {
  const mgr = host.scene.manager;
  if (!mgr.keys['Admin'] || host.scene.isActive('Admin')) return false;
  host.scene.launch('Admin', {
    rows,
    onClose: () => {
      host.scene.stop('Admin');
      host.scene.resume();
      host.input.keyboard?.resetKeys();
      onClosed?.();
    },
  } satisfies AdminData);
  host.scene.bringToTop('Admin');
  host.scene.pause();
  return true;
}
