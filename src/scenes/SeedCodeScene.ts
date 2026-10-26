import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { addBackButton } from '../ui/cards';
import { fadeIn, FONT, goTo, HEX } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';
import { PadButtons } from '../ui/nav';
import { addCodeCursor, drawCodePanel, drawCodeSlot, drawKeyCap, type CodePanelState } from '../ui/art/seedArt';
import { sfx } from '../ui/audio';
import { fetchSpeciesName } from '../data/pokeapi';
import { MODE_LABEL } from '../data/modes';
import { DIFFICULTY_LABEL } from '../data/difficulty';
import { loadSeedBest } from '../data/save';
import {
  SEED_ALPHABET, SEED_CODE_CHARS, SEED_ERROR_TEXT, cycleChar, decodeSeed, encodeSeed, normalizeCode, seedBestText, type SeedInfo,
} from '../data/seedCode';

export interface SeedCodeData {
  slot: number;
  /** Pokémon elegido antes, para volver al menú de modos con él. */
  starterId: number;
}

/** Margen tras abrir la pantalla en el que se ignora confirmar (el Enter que eligió la opción no empieza la partida). */
const INPUT_DELAY_MS = 350;
const BOX_W = 46;
const BOX_GAP = 6;
const GROUP_GAP = 26;
const BOXES_Y = 190;

/**
 * T81: «Partida con código». Se escribe el código con el teclado (o pegándolo), con el ratón (teclado de letras en
 * pantalla) o con el mando (arriba/abajo cambia la letra, izquierda/derecha mueve el cursor, A juega, X borra, Y pega,
 * B vuelve). Con un código válido se ve qué partida es y tu mejor resultado con él.
 * Arte de las casillas, el teclado en pantalla y el panel: ui/art/seedArt.ts.
 */
export class SeedCodeScene extends Phaser.Scene {
  private args!: SeedCodeData;
  private chars: string[] = [];
  private cursor = 0;
  private pad!: PadButtons;
  private boxes: { g: Phaser.GameObjects.Graphics; t: Phaser.GameObjects.Text; x: number }[] = [];
  private info!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private decoded: SeedInfo | null = null;
  private starterName = '';
  private readyAt = 0;
  private leaving = false;
  private onPaste?: (e: ClipboardEvent) => void;
  private panel!: Phaser.GameObjects.Graphics;
  private caret!: ReturnType<typeof addCodeCursor>;

  constructor() {
    super('SeedCode');
  }

  init(data: SeedCodeData) {
    this.args = { slot: data?.slot ?? 0, starterId: data?.starterId ?? 4 };
  }

  create() {
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    this.leaving = false;
    this.chars = Array<string>(SEED_CODE_CHARS).fill('');
    this.cursor = 0;
    this.decoded = null;
    this.starterName = '';
    this.boxes = [];
    this.pad = new PadButtons(this);
    addBackButton(this, () => this.back());
    this.add.text(480, 60, 'Partida con código', { fontFamily: FONT, fontSize: '36px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(480, 110, 'Escribe el código que te han pasado y jugarás la misma partida (no cuenta para récords).', {
      fontFamily: FONT, fontSize: '16px', color: '#ffffff', align: 'center', wordWrap: { width: 820 },
    }).setOrigin(0.5).setAlpha(0.85);

    // Casillas: PKI - XXXX - XXXX - XXXX (clic en una para poner el cursor)
    const total = SEED_CODE_CHARS * BOX_W + (SEED_CODE_CHARS - 1) * BOX_GAP + 2 * GROUP_GAP;
    const left = 480 - total / 2 + 40;
    this.add.text(left - 16, BOXES_Y, 'PKI', { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#ffd34d' }).setOrigin(1, 0.5);
    for (let i = 0; i < SEED_CODE_CHARS; i++) {
      const x = left + i * (BOX_W + BOX_GAP) + Math.floor(i / 4) * GROUP_GAP + BOX_W / 2;
      const g = this.add.graphics();
      const t = this.add.text(x, BOXES_Y, '', { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: HEX.text }).setOrigin(0.5);
      this.add.zone(x, BOXES_Y, BOX_W, 56).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.moveTo(i));
      this.boxes.push({ g, t, x });
    }
    this.caret = addCodeCursor(this, BOX_W, 56);

    // Teclado en pantalla para el ratón (y táctil)
    SEED_ALPHABET.split('').forEach((c, k) => {
      const x = 480 - 7.5 * 52 + (k % 16) * 52;
      const y = 268 + Math.floor(k / 16) * 52;
      this.button(x, y, 44, 44, c, () => this.type(c));
    });
    this.button(250, 384, 130, 42, 'Borrar', () => this.erase(), 'erase');
    this.button(400, 384, 130, 42, 'Pegar', () => void this.pasteFromClipboard(), 'paste');
    this.button(560, 384, 150, 42, 'Jugar', () => this.play(), 'play');

    this.panel = this.add.graphics();
    drawCodePanel(this.panel, 180, 420, 600, 150, 'empty');
    this.info = this.add.text(206, 440, '', { fontFamily: FONT, fontSize: '18px', color: HEX.text, wordWrap: { width: 500 }, lineSpacing: 4 });
    this.status = this.add.text(480, 590, '', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#ffd34d' }).setOrigin(0.5);
    this.add.text(480, 618, 'Teclado: escribe o pega (Ctrl+V) · Ratón: letras de arriba · Mando: arriba/abajo letra, izq/der mover, A jugar, X borrar, Y pegar · Esc o B: volver', {
      fontFamily: FONT, fontSize: '12px', color: '#ffffff', align: 'center', wordWrap: { width: 900 },
    }).setOrigin(0.5).setAlpha(0.75);

    // Teclado: letras y números, borrar, mover y Enter; el Esc vuelve
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text') ?? '';
      if (text) this.fill(text);
    };
    document.addEventListener('paste', this.onPaste);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.onPaste) document.removeEventListener('paste', this.onPaste);
      this.onPaste = undefined;
    });
    this.readyAt = this.time.now + INPUT_DELAY_MS;
    this.refresh();
  }

  private button(x: number, y: number, w: number, h: number, label: string, onClick: () => void, kind: 'letter' | 'erase' | 'paste' | 'play' = 'letter') {
    const g = this.add.graphics();
    drawKeyCap(g, x, y, w, h, false, kind);
    const txt = this.add.text(x, y - 2, label, { fontFamily: FONT, fontSize: label.length > 1 ? '18px' : '22px', fontStyle: 'bold', color: HEX.text }).setOrigin(0.5);
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => (drawKeyCap(g, x, y, w, h, true, kind), txt.setY(y + 2)));
    zone.on('pointerout', () => (drawKeyCap(g, x, y, w, h, false, kind), txt.setY(y - 2)));
    zone.on('pointerdown', () => {
      if (this.leaving) return;
      sfx('select');
      onClick();
    });
  }

  private onKey(e: KeyboardEvent) {
    if (this.leaving || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') return this.back();
    if (e.key === 'Enter') return this.time.now >= this.readyAt ? this.play() : undefined;
    if (e.key === 'Backspace') return this.erase();
    if (e.key === 'Delete') return this.set(this.cursor, '');
    if (e.key === 'ArrowLeft') return this.moveTo(this.cursor - 1);
    if (e.key === 'ArrowRight') return this.moveTo(this.cursor + 1);
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') return this.set(this.cursor, cycleChar(this.chars[this.cursor] || undefined, e.key === 'ArrowUp' ? 1 : -1));
    if (e.key.length === 1) {
      const c = normalizeCode(e.key);
      if (c.length === 1 && SEED_ALPHABET.includes(c)) this.type(c);
    }
  }

  /** Escribe una letra en el cursor y avanza. */
  private type(c: string) {
    this.chars[this.cursor] = c;
    this.cursor = Math.min(SEED_CODE_CHARS - 1, this.cursor + 1);
    this.refresh();
  }

  private set(i: number, c: string) {
    this.chars[i] = c;
    this.refresh();
  }

  /** Borra la letra del cursor o, si está vacía, la de antes (como Retroceso). */
  private erase() {
    if (!this.chars[this.cursor] && this.cursor > 0) this.cursor--;
    this.chars[this.cursor] = '';
    this.refresh();
  }

  private moveTo(i: number) {
    this.cursor = Phaser.Math.Clamp(i, 0, SEED_CODE_CHARS - 1);
    this.refresh();
  }

  /** Rellena todo con un código pegado (con o sin prefijo y guiones). */
  private fill(text: string) {
    const s = normalizeCode(text).slice(0, SEED_CODE_CHARS);
    if (!s) return;
    this.chars = Array.from({ length: SEED_CODE_CHARS }, (_, i) => s[i] ?? '');
    this.cursor = Math.min(SEED_CODE_CHARS - 1, s.length);
    this.refresh();
  }

  private async pasteFromClipboard() {
    try {
      const text = await navigator.clipboard?.readText();
      if (text && this.sys.isActive()) this.fill(text);
      else this.status.setText('No hay nada que pegar');
    } catch {
      if (this.sys.isActive()) this.status.setText('El navegador no deja pegar: usa Ctrl+V');
    }
  }

  private refresh() {
    this.boxes.forEach(({ g, t, x }, i) => {
      g.clear();
      const full = this.chars.join('').length === SEED_CODE_CHARS;
      drawCodeSlot(g, x, BOXES_Y, BOX_W, 56, { filled: !!this.chars[i], cursor: i === this.cursor, group: Math.floor(i / 4), bad: full && !decodeSeed(this.chars.join('')).ok });
      t.setText(this.chars[i]);
      if (i === this.cursor) this.caret.move(x, BOXES_Y);
    });
    const code = this.chars.join('');
    const look: CodePanelState = code.length < SEED_CODE_CHARS ? 'empty' : decodeSeed(code).ok ? 'ok' : 'error';
    drawCodePanel(this.panel, 180, 420, 600, 150, look);
    this.status.setText('');
    const prev = this.decoded;
    this.decoded = null;
    if (code.length < SEED_CODE_CHARS) {
      this.info.setText(`Faltan ${SEED_CODE_CHARS - code.length} letras.`);
      return;
    }
    const res = decodeSeed(code);
    if (!res.ok) {
      this.info.setText(SEED_ERROR_TEXT[res.error]).setColor('#c0392b');
      return;
    }
    this.decoded = res.info;
    if (!prev || prev.starterId !== res.info.starterId) {
      this.starterName = '';
      const id = res.info.starterId;
      void fetchSpeciesName(id)
        .then((n) => {
          if (!this.sys.isActive() || this.decoded?.starterId !== id) return;
          this.starterName = n;
          this.paintInfo();
        })
        .catch(() => undefined);
    }
    this.paintInfo();
  }

  private paintInfo() {
    const d = this.decoded;
    if (!d) return;
    const code = encodeSeed(d);
    const who = this.starterName ? this.starterName.charAt(0).toUpperCase() + this.starterName.slice(1) : `nº ${d.starterId}`;
    this.info
      .setColor(HEX.text)
      .setText(`${code}\n${MODE_LABEL[d.mode]} · ${DIFFICULTY_LABEL[d.difficulty]} · Inicial: ${who}\n${seedBestText(d.mode, loadSeedBest(code))}`);
  }

  private play() {
    if (this.leaving) return;
    const d = this.decoded;
    if (!d) {
      sfx('select');
      this.status.setText(this.chars.join('').length < SEED_CODE_CHARS ? 'Completa el código' : 'Ese código no vale');
      return;
    }
    this.leaving = true;
    goTo(this, 'Game', { starterId: d.starterId, slot: this.args.slot, mode: d.mode, difficulty: d.difficulty, seeded: { seed: d.seed, fromCode: true } });
  }

  private back() {
    if (this.leaving) return;
    this.leaving = true;
    goTo(this, 'Mode', { starterId: this.args.starterId, slot: this.args.slot });
  }

  update() {
    if (this.leaving) return;
    // Mando (el teclado va por eventos para poder escribir)
    const p = this.pad.read();
    if (p.has('B')) return this.back();
    if (p.has('up')) this.set(this.cursor, cycleChar(this.chars[this.cursor] || undefined, 1));
    if (p.has('down')) this.set(this.cursor, cycleChar(this.chars[this.cursor] || undefined, -1));
    if (p.has('left')) this.moveTo(this.cursor - 1);
    if (p.has('right')) this.moveTo(this.cursor + 1);
    if (p.has('X')) this.erase();
    if (p.has('Y')) void this.pasteFromClipboard();
    if (p.has('A') && this.time.now >= this.readyAt) this.play();
  }
}
