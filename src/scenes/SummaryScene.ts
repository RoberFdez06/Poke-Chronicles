import { CANDY_PER_TICKET } from '../data/save';
import Phaser from 'phaser';
import { addHelpBar } from '../ui/helpBar';
import { COVER_H, COVER_W, DCX, DCY, fitDesign } from '../ui/layout';
import { fetchPokemonCard } from '../data/pokeapi';
import { addIcon, bakeIcons, iconKey, type IconName } from '../ui/art/icons';
import { addPixelText } from '../ui/art/pixel';
import { MODE_LABEL, progressText } from '../data/modes';
import { formatDuration, type RunRecord } from '../data/runHistory';
import { MenuList, NavInput } from '../ui/nav';
import { drawBox, fadeIn, FONT, goTo, HEX } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';
import { bakeItemIcons, itemIconKey } from '../ui/art/itemIcons';
import { HIDDEN_ITEMS, PASSIVE_ITEMS } from '../data/items';
import { sfx } from '../ui/audio';
import { shareCardData } from '../data/shareCard';
import { renderShareCard, shareOrDownload } from './shareImage';
import { addCodeTicket } from '../ui/art/seedArt';
import { copyText } from '../ui/clipboard';
import { loadSeedBest } from '../data/save';
import { seedBestText } from '../data/seedCode';

export interface SummaryData {
  record: RunRecord;
  /** Hueco en el que se jugaba (para "Otra partida"). */
  slot: number;
}

/**
 * Resumen al morir o ganar (T28): tiempo, hasta dónde llegaste, enemigos, daño, objetos, tickets y récord.
 * Otra partida, Historial o Menú con teclado, ratón o mando; Esc o B van al menú.
 */
export class SummaryScene extends Phaser.Scene {
  private data_!: SummaryData;
  private nav!: NavInput;
  private menu!: MenuList;
  private leaving = false;
  /** T82: mientras se genera la imagen no se pide otra. */
  private saving = false;
  private saveNote?: Phaser.GameObjects.Text;

  constructor() {
    super('Summary');
  }

  init(data: SummaryData) {
    this.data_ = data;
  }

  create() {
    this.leaving = false;
    this.saving = false;
    this.nav = new NavInput(this);
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    const r = this.data_.record;
    bakeIcons(this);
    bakeItemIcons(this);
    sfx(r.won ? 'clear' : 'faint');
    // Derrota: el paisaje un poco más oscuro
    if (!r.won) this.add.rectangle(DCX, DCY, COVER_W + 4, COVER_H + 4, 0x0d1425, 0.35);
    else this.confetti();

    // Título en píxeles gordos: oro si ganas, rojo si caes
    const title = addPixelText(this, 480, 54, r.won ? '¡VICTORIA!' : 'DERROTA', {
      size: 16, scale: 4, color: r.won ? '#f8d030' : '#f05a4a', stroke: '#283068', strokeWidth: 3, shadow: '#101828',
    });
    this.tweens.add({ targets: title, y: 60, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (r.won) {
      const half = title.displayWidth / 2 + 44;
      addIcon(this, 480 - half, 56, 'trophy', 3);
      addIcon(this, 480 + half, 56, 'trophy', 3);
    }

    drawBox(this.add.graphics(), 40, 100, 560, 470, { radius: 18 });
    const t = (x: number, y: number, s: string, size = 18, color: string = HEX.text, bold = false) =>
      this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', wordWrap: { width: 510 } });

    // Retrato: el Pokémon sobre un pedestal (tumbado y gris si ha caído)
    const ped = this.add.graphics();
    ped.fillStyle(0x8fa0c0, 1).fillEllipse(124, 228, 132, 34);
    ped.fillStyle(0xc8d4ea, 1).fillEllipse(124, 222, 124, 26);
    void this.portrait(r.starterId, r.won);
    t(208, 134, r.starterName, 28, HEX.text, true);
    t(208, 172, MODE_LABEL[r.mode], 17, HEX.textSoft);
    t(208, 196, r.won ? 'Completada' : `Hasta ${progressText(r.mode, r.floor).toLowerCase()}`, 17, r.won ? '#2f8a3a' : '#c0392b', true);

    // Cifras con icono; los números suben desde 0
    const rows: [IconName, string, number, (n: number) => string][] = [
      ['clock', 'Tiempo', r.seconds, (n) => formatDuration(n)],
      ['pokeball', 'Enemigos vencidos', r.kills, (n) => `${n}`],
      ['sword', 'Daño hecho', r.damage, (n) => `${n}`],
      ['ticket', 'Tickets ganados', r.tickets, (n) => `+${n}`],
      ['candy', 'Caramelos ganados', r.tickets * CANDY_PER_TICKET, (n) => `+${n}`],
    ];
    rows.forEach(([icon, label, value, fmt], i) => {
      const y = 268 + i * 36;
      if (i % 2 === 0) this.add.graphics().fillStyle(0x283068, 0.06).fillRect(60, y - 16, 520, 32);
      addIcon(this, 82, y, icon, 2);
      t(108, y, label, 19, HEX.textSoft).setOrigin(0, 0.5);
      const v = t(566, y, fmt(0), 21, HEX.text, true).setOrigin(1, 0.5);
      const counter = { n: 0 };
      this.tweens.add({ targets: counter, n: value, duration: 900, delay: 250 + i * 120, ease: 'Cubic.easeOut', onUpdate: () => v.setText(fmt(Math.round(counter.n))) });
    });

    // Sello de récord, algo torcido
    if (r.newRecord) {
      const stamp = this.add.container(500, 160).setAngle(-8).setScale(0);
      const g = this.add.graphics();
      g.fillStyle(0x101828, 1).fillRoundedRect(-92, -24, 184, 48, 8);
      g.fillStyle(0xffd34d, 1).fillRoundedRect(-88, -20, 176, 40, 6);
      const star = this.add.image(-66, 0, iconKey('star')).setScale(2);
      const label = this.add.text(12, 0, '¡NUEVO RÉCORD!', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#283068' }).setOrigin(0.5);
      stamp.add([g, star, label]);
      this.tweens.add({ targets: stamp, scale: 1, duration: 320, delay: 900, ease: 'Back.easeOut', onStart: () => this.time.delayedCall(900, () => sfx('record')), onComplete: () => this.cameras.main.flash(180, 255, 235, 150) });
      this.tweens.add({ targets: star, angle: 360, duration: 2400, repeat: -1 });
    }

    // Objetos: cada uno con su dibujo (y "x2" si lo llevabas repetido)
    t(66, 462, `Objetos${r.items.length ? ` (${r.items.length})` : ''}`, 18, HEX.text, true);
    if (r.items.length === 0) t(66, 490, 'Ninguno', 15, HEX.textSoft);
    r.items.slice(0, 22).forEach((label, i) => {
      const m = / x(\d+)$/.exec(label);
      const name = label.replace(/ x\d+$/, '');
      const id = [...PASSIVE_ITEMS, ...HIDDEN_ITEMS].find((p) => p.name === name)?.id;
      const x = 80 + (i % 11) * 46;
      const y = 496 + Math.floor(i / 11) * 40;
      const key = id ? itemIconKey(id) : iconKey('bag');
      const img = this.add.image(x, y, this.textures.exists(key) ? key : iconKey('bag')).setScale(0).setAlpha(0);
      this.tweens.add({ targets: img, scale: 1.8, alpha: 1, duration: 260, delay: 600 + i * 70, ease: 'Back.easeOut' });
      if (m) this.add.text(x + 14, y + 12, `x${m[1]}`, { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(1, 1).setStroke('#101828', 3);
    });

    // T62: más cifras de la partida (las guardadas antes no las tienen y se saltan)
    this.moreStats(r);
    this.routesLine(r);

    this.seedLine(r);
    // Cinco opciones (121-343) y la nota debajo, con aire hasta las rutas (que crecen hacia arriba desde 444)
    this.menu = new MenuList(this, 780, 140, ['Otra partida', 'Guardar imagen', 'Copiar código', 'Historial', 'Menú'], (i) => this.pick(i), { w: 280, h: 38, gap: 8, fontSize: 20 });
    this.saveNote = this.add.text(780, 362, '', { fontFamily: FONT, fontSize: '14px', color: '#ffffff' }).setOrigin(0.5).setAlpha(0.85);
    addHelpBar(this, 480, 612, 'Flechas o ratón para elegir · Enter o clic · Esc: menú', { fontFamily: FONT, fontSize: '15px', color: '#ffffff' })
      .setOrigin(0.5).setAlpha(0.6);
  }

  /** T81: código de semilla de la partida y, si se jugó con código, que no cuenta y su mejor resultado. */
  private seedLine(r: RunRecord) {
    // Línea del código: billete dorado con brillo detrás (ui/art/seedArt.ts)
    const plate = r.seedCode ? this.add.graphics() : undefined;
    const style = { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: r.seedCode ? '#8a5a00' : HEX.textSoft };
    const line = this.add.text(r.seedCode ? 570 : 580, 462, r.seedCode ? `Código: ${r.seedCode}` : 'Sin código de semilla', style).setOrigin(1, 0);
    if (plate) addCodeTicket(this, 570 - line.width / 2, 462 + line.height / 2, line.width + 24, line.height + 10, plate);
    if (r.fromCode && r.seedCode) {
      const note = `Con código: sin récords ni misiones · ${seedBestText(r.mode, loadSeedBest(r.seedCode))}`;
      this.add.text(580, 440, note, { fontFamily: FONT, fontSize: '12px', color: HEX.textSoft }).setOrigin(1, 0);
    }
  }

  /** T81: copia el código de la partida al portapapeles. */
  private async copyCode() {
    const code = this.data_.record.seedCode;
    if (!code) return void this.saveNote?.setText('Esta partida no tiene código');
    const ok = await copyText(code);
    if (this.sys.isActive()) this.saveNote?.setText(ok ? 'Código copiado' : 'No se pudo copiar: apúntalo a mano');
  }

  /** T80: rutas elegidas en la partida (encima del cuadro de la derecha). */
  private routesLine(r: RunRecord) {
    const routes = r.routes ?? [];
    if (routes.length === 0) return;
    // Las últimas 3 (en Infinito pueden ser muchas)
    const text = routes.slice(-3).map((x, k) => `${routes.length - Math.min(3, routes.length) + k + 1}. ${x}`).join('\n');
    this.add.text(654, 444, `Rutas: ${routes.length}\n${text}`, { fontFamily: FONT, fontSize: '12px', color: HEX.text, lineSpacing: 2 }).setOrigin(0, 1);
  }

  /** Cuadro de la derecha: parrys, objetos cogidos, sala más rápida y tiempo de cada piso. */
  private moreStats(r: RunRecord) {
    if (r.parries === undefined && r.picked === undefined && r.fastestRoom === undefined && !r.floorSeconds?.length) return;
    drawBox(this.add.graphics(), 636, 452, 288, 146, { radius: 14 });
    const line = (y: number, label: string, value: string) => {
      this.add.text(654, y, label, { fontFamily: FONT, fontSize: '15px', color: HEX.textSoft }).setOrigin(0, 0.5);
      this.add.text(906, y, value, { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: HEX.text }).setOrigin(1, 0.5);
    };
    line(474, 'Parrys acertados', `${r.parries ?? 0}`);
    line(498, 'Objetos cogidos', `${r.picked ?? 0}`);
    line(522, 'Sala más rápida', r.fastestRoom ? formatDuration(r.fastestRoom) : '—');
    const floors = r.floorSeconds ?? [];
    if (floors.length > 0) {
      // Hasta 8 pisos; si hay más se ven los últimos (en la partida infinita pueden ser muchos)
      const first = Math.max(0, floors.length - 8);
      const text = floors.slice(first).map((s, k) => `P${first + k + 1} ${formatDuration(s)}`).join('  ');
      this.add.text(654, 548, 'Tiempo por piso', { fontFamily: FONT, fontSize: '13px', color: HEX.textSoft }).setOrigin(0, 0.5);
      this.add.text(654, 576, text, { fontFamily: FONT, fontSize: '13px', color: HEX.text, wordWrap: { width: 252 } }).setOrigin(0, 0.5);
    }
  }

  /** Sprite del Pokémon (de PokeAPI, como los del menú). Si no carga, se queda solo el pedestal. */
  private async portrait(id: number, won: boolean) {
    const key = `starter-${id}-front`;
    if (!this.textures.exists(key)) {
      const card = await fetchPokemonCard(id).catch(() => null);
      if (!card || !this.sys.isActive()) return;
      await new Promise<void>((done) => {
        this.load.crossOrigin = 'anonymous';
        this.load.image(key, card.sprites.front);
        this.load.once(Phaser.Loader.Events.COMPLETE, () => done());
        this.load.start();
      });
      if (!this.sys.isActive() || !this.textures.exists(key)) return;
    }
    this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    // Cabe en una caja de 112 × 100 con los pies en el pedestal: ningún Pokémon grande o ancho (Lunala, Regidrago…)
    // se sale hacia las filas de abajo
    const img = this.add.image(124, 232, key).setOrigin(0.5, 1);
    img.setScale(Math.min(112 / Math.max(img.width, 1), 100 / Math.max(img.height, 1)));
    if (won) {
      this.tweens.add({ targets: img, y: 222, duration: 380, yoyo: true, repeat: -1, repeatDelay: 500, ease: 'Quad.easeOut' });
    } else {
      // Debilitado: tumbado y apagado
      img.setTint(0x8890a8).setAngle(90).setOrigin(0.5, 0.5).setY(208);
    }
  }

  /** Confeti de colores cayendo por toda la pantalla (solo al ganar). */
  private confetti() {
    const colors = [0xf8d030, 0xf05a4a, 0x5ab0f0, 0x7ccf6a, 0xf090d0, 0xffffff];
    const left = DCX - COVER_W / 2;
    this.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => {
        const x = left + Math.random() * COVER_W;
        const p = this.add.rectangle(x, DCY - COVER_H / 2 - 10, 8, 12, Phaser.Utils.Array.GetRandom(colors)).setDepth(-1).setAngle(Math.random() * 90);
        this.tweens.add({
          targets: p, y: DCY + COVER_H / 2 + 10, x: x + Phaser.Math.Between(-80, 80), angle: p.angle + Phaser.Math.Between(180, 540),
          duration: Phaser.Math.Between(2600, 4200), onComplete: () => p.destroy(),
        });
      },
    });
  }

  /** T82: imagen PNG de la partida; se descarga o se comparte. No guarda nada (vale también para invitados). */
  private async saveImage() {
    if (this.saving) return;
    this.saving = true;
    this.saveNote?.setText('Generando imagen…');
    const r = this.data_.record;
    // T81: el código de semilla sale en la tarjeta (las partidas de antes no lo tienen)
    const card = shareCardData(r, r.seedCode);
    const itemId = (name: string) => [...PASSIVE_ITEMS, ...HIDDEN_ITEMS].find((p) => p.name === name)?.id;
    const blob = await renderShareCard(this, card, {
      portraitKey: `starter-${r.starterId}-front`,
      itemKey: (name) => {
        const id = itemId(name);
        return id ? itemIconKey(id) : iconKey('bag');
      },
    });
    if (!this.sys.isActive()) return;
    const result = blob ? await shareOrDownload(blob, card.fileName).catch(() => null) : null;
    if (!this.sys.isActive()) return;
    this.saveNote?.setText(
      result === 'compartida' ? 'Imagen compartida' : result === 'descargada' ? 'Imagen guardada' : result === 'cancelada' ? '' : 'No se pudo crear la imagen',
    );
    this.saving = false;
  }

  private pick(i: number) {
    if (this.leaving) return;
    if (i === 1) return void this.saveImage();
    if (i === 2) return void this.copyCode();
    this.leaving = true;
    if (i === 0) goTo(this, 'Starter', { slot: this.data_.slot });
    else if (i === 3) goTo(this, 'History', { from: 'Menu' });
    else goTo(this, 'Menu');
  }

  update() {
    if (this.leaving) return;
    const s = this.nav.read();
    if (s.back) return this.pick(4);
    this.menu.move(s.dy || s.dx);
    if (s.ok) this.menu.activate();
  }
}
