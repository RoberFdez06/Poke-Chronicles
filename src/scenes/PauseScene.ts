import Phaser from 'phaser';
import { CONTROLS } from '../data/controls';
import type { MovePower, PlayerStats } from '../data/items';
import { typeColor, typeHex, typeNameEs } from '../data/types';
import { addHpBar, addTypeChip, drawBox } from '../ui/theme';
import { addPanel, MenuList, NavInput, UI } from '../ui/nav';

export interface PauseData {
  starterName: string;
  slot: number;
  /** Modo y progreso ("Normal", "Piso 2/5"). */
  modeLabel: string;
  progress: string;
  /** En Oleadas y Rush de jefes no hay salas que contar. */
  showRooms: boolean;
  hp: number;
  stats: PlayerStats;
  /** Nombres de los objetos pasivos, ya agrupados ("Lupa x2"). */
  items: string[];
  moves: (MovePower | null)[];
  roomsCleared: number;
  roomCount: number;
  earned: number;
  /** Monedas de la partida (para la tienda). */
  coins: number;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pretty = (s: string) => s.replace(/-/g, ' ');

/** Pausa como en Isaac: reanudar, reiniciar, controles y salir guardando, con tus estadísticas y objetos. */
export class PauseScene extends Phaser.Scene {
  private info!: PauseData;
  private nav!: NavInput;
  private menu!: MenuList;
  private sub?: { layer: Phaser.GameObjects.Container; list?: MenuList };
  private done = false;

  constructor() {
    super('Pause');
  }

  init(data: PauseData) {
    this.info = data;
  }

  create() {
    const d = this.info;
    this.sub = undefined;
    this.done = false;
    this.nav = new NavInput(this);

    this.add.rectangle(480, 320, 960, 640, 0x0d1425, 0.75).setInteractive(); // tapa la partida y sus clics
    this.add.text(480, 52, 'Pausa', { fontFamily: UI.FONT, fontSize: '48px', fontStyle: 'bold', color: '#ffd34d' })
      .setOrigin(0.5).setStroke('#2b3a67', 10);

    // Panel de la partida: estadísticas, objetos y poderes
    const g = this.add.graphics();
    drawBox(g, 40, 100, 520, 470, { radius: 20 });
    const t = (x: number, y: number, s: string, size = 18, color = '#2b3a67', bold = false) =>
      this.add.text(x, y, s, { fontFamily: UI.FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', wordWrap: { width: 470 } });

    const st = d.stats;
    t(66, 118, `${capitalize(d.starterName)} · Hueco ${d.slot + 1}`, 24, '#2b3a67', true);
    addHpBar(this, 340, 126, 190, 12).set(d.hp / st.maxHp);
    const rooms = d.showRooms ? ` · Salas limpias ${d.roomsCleared}/${d.roomCount}` : '';
    t(66, 152, `${d.modeLabel} · ${d.progress}${rooms} · Monedas ${d.coins} · Tickets ganados ${d.earned}`, 16, '#4a5578');
    const rows: [string, string][] = [
      ['PS', `${Math.ceil(d.hp)} / ${st.maxHp}`],
      ['Daño', `${st.damage.toFixed(1)}`],
      ['Disparos/s', `${(1000 / st.fireDelay).toFixed(1)}`],
      ['Velocidad', `${Math.round(st.speed)}`],
      ['Alcance', `${(st.range / 1000).toFixed(2)} s`],
      ['Disparos extra', `${st.extraShots}`],
      ['Atraviesa', `${st.pierce}`],
      ['Rebotes', `${st.bounces}`],
    ];
    rows.forEach(([k, v], i) => {
      const x = 66 + (i % 2) * 245;
      const y = 186 + Math.floor(i / 2) * 28;
      t(x, y, k, 17, '#4a5578');
      t(x + 140, y, v, 17, '#2b3a67', true);
    });
    t(66, 312, 'Objetos', 20, '#2b3a67', true);
    t(66, 340, d.items.length ? d.items.join(' · ') : 'Ninguno todavía', 16, '#4a5578');
    t(66, 430, 'Poderes', 20, '#2b3a67', true);
    d.moves.forEach((m, i) => {
      const x = 66 + (i % 2) * 245;
      const y = 460 + Math.floor(i / 2) * 34;
      t(x, y, `${i + 1}  ${m ? pretty(m.name) : '—'}`, 17, m ? typeHex(m.type) : '#9aa5b1', true)
        .setStroke(m ? '#2b3a67' : '#00000000', m ? 2 : 0);
      // Ficha del tipo del poder
      if (m) addTypeChip(this, x + 196, y + 11, typeNameEs(m.type), typeColor(m.type), 64, 20);
    });

    this.menu = new MenuList(this, 760, 200, ['Reanudar', 'Reiniciar', 'Controles', 'Salir y guardar'], (i) => this.pick(i), {
      w: 290, h: 56, gap: 20,
    });
    this.add
      .text(480, 612, 'Esc, P, Start o B para reanudar · flechas, ratón o mando para elegir', {
        fontFamily: UI.FONT, fontSize: '15px', color: '#ffffff',
      })
      .setOrigin(0.5).setAlpha(0.6);
  }

  private pick(i: number) {
    if (this.done) return;
    if (i === 0) return this.finish(this.info.onResume);
    if (i === 1) return this.confirmRestart();
    if (i === 2) return this.showControls();
    return this.finish(this.info.onQuit);
  }

  /** Cierra la pausa y ejecuta la acción en la partida. */
  private finish(action: () => void) {
    this.done = true;
    action();
  }

  private openSub(layer: Phaser.GameObjects.Container, list?: MenuList) {
    this.menu.active = false;
    this.sub = { layer, list };
  }

  private closeSub() {
    this.sub?.layer.destroy();
    this.sub?.list?.destroy();
    this.sub = undefined;
    this.menu.active = true;
  }

  private confirmRestart() {
    const layer = addPanel(this, 480, 320, 540, 300, 50);
    layer.add(this.add.text(480, 230, 'Se perderá esta partida\ny empezarás otra en el mismo hueco.', {
      fontFamily: UI.FONT, fontSize: '22px', fontStyle: 'bold', color: '#2b3a67', align: 'center',
    }).setOrigin(0.5));
    const list = new MenuList(this, 480, 310, ['No, volver', 'Sí, reiniciar'], (k) => {
      if (k === 1) this.finish(this.info.onRestart);
      else this.closeSub();
    }, { w: 300, h: 52, gap: 16, depth: 51 });
    this.openSub(layer, list);
  }

  private showControls() {
    const layer = addPanel(this, 480, 320, 700, 400, 50);
    layer.add(this.add.text(480, 158, 'Controles', { fontFamily: UI.FONT, fontSize: '34px', fontStyle: 'bold', color: '#2b3a67' }).setOrigin(0.5));
    CONTROLS.forEach(([what, how], k) => {
      const y = 212 + k * 62;
      layer.add(this.add.text(170, y, what, { fontFamily: UI.FONT, fontSize: '22px', fontStyle: 'bold', color: '#2b3a67' }));
      layer.add(this.add.text(170, y + 28, how, { fontFamily: UI.FONT, fontSize: '18px', color: '#4a5578' }));
    });
    layer.add(this.add.text(480, 484, 'Esc, Enter, B, A o clic para cerrar', { fontFamily: UI.FONT, fontSize: '15px', color: '#4a5578' }).setOrigin(0.5));
    // Clic en cualquier sitio cierra
    (layer.list[0] as Phaser.GameObjects.Rectangle).on('pointerdown', () => this.closeSub());
    this.openSub(layer);
  }

  update() {
    if (this.done) return;
    const s = this.nav.read();
    if (this.sub) {
      if (s.back || s.pause) return this.closeSub();
      if (!this.sub.list) {
        if (s.ok) this.closeSub();
        return;
      }
      this.sub.list.move(s.dy || s.dx);
      if (s.ok) this.sub.list.activate();
      return;
    }
    if (s.back || s.pause) return this.finish(this.info.onResume);
    this.menu.move(s.dy);
    if (s.ok) this.menu.activate();
  }
}
