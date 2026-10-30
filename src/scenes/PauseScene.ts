import Phaser from 'phaser';
import { addHelpBar } from '../ui/helpBar';
import { COVER_H, COVER_W, DCX, DCY, fitDesign } from '../ui/layout';
import { openControls } from './ControlsScene';
import type { MovePower, PlayerStats } from '../data/items';
import { typeColor, typeHex, typeNameEs } from '../data/types';
import { addHpBar, addTypeChip, drawBox, shorten } from '../ui/theme';
import { STAT_KEYS, STAT_LABEL, type BaseStats } from '../data/pokeStats';
import { itemLinesFromHeight, pauseTailLayout, PAUSE_ITEMS_Y, PAUSE_ITEM_MAX_LINES, PAUSE_PANEL_MIN_H, PAUSE_PANEL_Y } from '../data/pauseLayout';
import { addPanel, MenuList, NavInput, UI } from '../ui/nav';
import type { SettingsData } from './SettingsScene';
import { copyText } from '../ui/clipboard';
import { addCodeTicket } from '../ui/art/seedArt';
import { badgeTexture } from '../ui/art/synergyArt';
import type { SynergyBookData } from './SynergyBookScene';

export interface PauseData {
  starterName: string;
  slot: number;
  /** Modo y progreso ("Normal", "Piso 2/5"). */
  modeLabel: string;
  progress: string;
  /** T81: código de semilla para que otro juegue la misma partida (falta en partidas de antes de T81). */
  seedCode?: string;
  /** En Oleadas y Rush de jefes no hay salas que contar. */
  showRooms: boolean;
  hp: number;
  stats: PlayerStats;
  /** Estadísticas base del Pokémon (PokeAPI). */
  baseStats: BaseStats;
  /** Habilidad del Pokémon (T27) y lo que hace. */
  ability?: { name: string; description: string };
  /** Nombres de los objetos pasivos, ya agrupados ("Lupa x2"). */
  items: string[];
  /** Línea con las reacciones de tipo descubiertas (T76). */
  reactions?: string;
  moves: (MovePower | null)[];
  /** Sinergias a las que solo les falta una pieza («Rueda Fuego (falta Pluma Ligera)»). */
  synergyNear?: string[];
  /** Sinergias activas en la partida (ids) para marcarlas en el Libro. */
  synergyActive?: string[];
  roomsCleared: number;
  roomCount: number;
  earned: number;
  /** Monedas de la partida (para la tienda). */
  coins: number;
  keys: number;
  bombs: number;
  onResume: () => void;
  onRestart: () => void;
  /** Elegir el tipo Tera (solo con la Teragema; si falta, no sale la opción). */
  onTera?: () => void;
  /** Fusionar poderes (data/fusion.ts): abre FusionScene. Si falta, no sale la opción. */
  onFusion?: () => void;
  onQuit: () => void;
  /** Tras borrar el progreso desde Ajustes: salir sin guardar. */
  onReset: () => void;
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
    fitDesign(this);

    this.add.rectangle(DCX, DCY, COVER_W + 4, COVER_H + 4, 0x0d1425, 0.75).setInteractive(); // tapa la partida y sus clics
    this.add.text(480, 52, 'Pausa', { fontFamily: UI.FONT, fontSize: '48px', fontStyle: 'bold', color: '#ffd34d' })
      .setOrigin(0.5).setStroke('#2b3a67', 10);

    // Panel de la partida: estadísticas, objetos y poderes
    const g = this.add.graphics();
    drawBox(g, 40, 100, 520, 470, { radius: 20 });
    const t = (x: number, y: number, s: string, size = 18, color = '#2b3a67', bold = false) =>
      this.add.text(x, y, s, { fontFamily: UI.FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', wordWrap: { width: 470 } });

    const st = d.stats;
    // Cada dato en su línea fija para que nada se monte encima de la tabla (con la fuente pixel ocupa más)
    t(66, 116, capitalize(d.starterName), 24, '#2b3a67', true);
    addHpBar(this, 340, 126, 190, 12).set(d.hp / st.maxHp);
    const rooms = d.showRooms ? ` · Salas ${d.roomsCleared}/${d.roomCount}` : '';
    t(66, 150, `Hueco ${d.slot + 1} · ${d.modeLabel} · ${d.progress}${rooms}`, 15, '#4a5578');
    t(66, 170, `Monedas ${d.coins} · Llaves ${d.keys} · Bombas ${d.bombs} · Tickets +${d.earned}`, 15, '#4a5578');
    const rows: [string, string][] = [
      ['PS', `${Math.ceil(d.hp)} / ${st.maxHp}`],
      ['Daño', `${st.damage.toFixed(1)}`],
      ['Disparos/s', `${(1000 / st.fireDelay).toFixed(1)}`],
      ['Velocidad', `${Math.round(st.speed)}`],
      ['Alcance', `${(st.range / 1000).toFixed(2)} s`],
      ['Disparos extra', `${st.extraShots}`],
      ['Atraviesa', `${st.pierce}`],
      ['Rebotes', `${st.bounces}`],
      ['Poderes', `×${st.powerMul.toFixed(2)}`],
      ['Daño recibido', `${Math.round(st.damageTaken * 100)} %`],
    ];
    rows.forEach(([k, v], i) => {
      const x = 66 + (i % 2) * 245;
      const y = 198 + Math.floor(i / 2) * 27;
      t(x, y, k, 17, '#4a5578');
      t(x + 140, y, v, 17, '#2b3a67', true);
    });
    // Estadísticas base del Pokémon, como en los juegos
    // Estadísticas base del Pokémon, como en los juegos: tres por línea
    const base = STAT_KEYS.map((k) => `${STAT_LABEL[k]} ${d.baseStats[k]}`);
    t(66, 334, base.slice(0, 3).join(' · '), 13, '#4a5578');
    t(66, 350, base.slice(3).join(' · '), 13, '#4a5578');
    if (d.ability) {
      t(66, 370, `Habilidad · ${d.ability.name}`, 17, '#2b3a67', true);
      t(66, 392, d.ability.description, 13, '#4a5578');
    }
    t(66, 414, 'Objetos', 18, '#2b3a67', true);
    // Sinergias cerca: insignia pixel y la primera a la que le falta una pieza (el resto, en el Libro de sinergias)
    const near = d.synergyNear ?? [];
    if (near.length > 0) {
      this.add.image(160, 425, badgeTexture(this)).setScale(1.8);
      t(176, 417, shorten(`Sinergia: ${near[0]}${near.length > 1 ? ` +${near.length - 1}` : ''}`, 46), 13, '#8a5a00', true);
    }
    const itemsText = t(66, PAUSE_ITEMS_Y, d.items.length ? d.items.join(' · ') : 'Ninguno todavía', 14, '#4a5578').setMaxLines(PAUSE_ITEM_MAX_LINES);
    // Lo de debajo se coloca donde termina de verdad la lista de objetos (1, 2 o 3 líneas)
    const tail = pauseTailLayout(itemLinesFromHeight(itemsText.height), !!d.reactions, d.moves.length);
    if (tail.panelH > PAUSE_PANEL_MIN_H) {
      g.clear();
      drawBox(g, 40, PAUSE_PANEL_Y, 520, tail.panelH, { radius: 20 });
    }
    if (d.reactions && tail.reactionsY !== null) t(66, tail.reactionsY, shorten(d.reactions, 70), 12, '#4a5578');
    t(66, tail.powersTitleY, 'Poderes', 18, '#2b3a67', true);
    d.moves.forEach((m, i) => {
      const x = 66 + (i % 2) * 245;
      const y = tail.movesY + Math.floor(i / 2) * 30;
      t(x, y, `${i + 1}  ${m ? shorten(pretty(m.name), 13) : '—'}`, 16, m ? typeHex(m.type) : '#9aa5b1', true)
        .setStroke(m ? '#2b3a67' : '#00000000', m ? 2 : 0);
      // Ficha del tipo del poder
      if (m) addTypeChip(this, x + 196, y + 11, m.fusion ? 'Fusión' : typeNameEs(m.type), m.fusion ? 0xd4a017 : typeColor(m.type), 64, 20);
    });

    const extra = [...(d.onFusion ? ['Fusionar poderes'] : []), ...(d.onTera ? ['Tipo Tera'] : [])];
    const opts = ['Reanudar', 'Reiniciar', 'Código de semilla', 'Sinergias', 'Controles', 'Ajustes', ...extra, 'Salir y guardar'];
    this.actions = [
      () => this.finish(this.info.onResume), () => this.confirmRestart(), () => this.showSeedCode(), () => this.openBook(),
      () => this.showControls(), () => this.openSettings(),
      ...(d.onFusion ? [() => this.finish(this.info.onFusion!)] : []),
      ...(d.onTera ? [() => this.finish(this.info.onTera!)] : []),
      () => this.finish(this.info.onQuit),
    ];
    // Siete a nueve opciones a la altura del panel de la izquierda (100-570)
    const n = opts.length;
    this.menu = new MenuList(this, 760, 150, opts, (i) => this.pick(i), {
      w: 290, h: n >= 9 ? 40 : n === 8 ? 44 : 48, gap: n >= 9 ? 4 : n === 8 ? 5 : 9,
    });
    addHelpBar(this, 480, 612, 'Esc o P para reanudar · Flechas o ratón para elegir', {
        fontFamily: UI.FONT, fontSize: '15px', color: '#ffffff',
      })
      .setOrigin(0.5).setAlpha(0.6);
  }

  private actions: (() => void)[] = [];

  private pick(i: number) {
    if (this.done) return;
    this.actions[i]?.();
  }

  /** Ajustes encima de la pausa; al cerrarlos se vuelve aquí. */
  private openSettings() {
    const data: SettingsData = {
      overlay: true,
      onClose: () => {
        this.scene.resume();
        // Lo pulsado en Ajustes (B, Esc) no cuenta al volver
        this.nav = new NavInput(this);
      },
      onReset: () => this.finish(this.info.onReset),
    };
    this.scene.launch('Settings', data);
    this.scene.bringToTop('Settings');
    this.scene.pause();
  }

  /** Libro de sinergias encima de la pausa (con las de esta partida marcadas); al cerrarlo se vuelve aquí. */
  private openBook() {
    const data: SynergyBookData = {
      overlay: true,
      active: this.info.synergyActive ?? [],
      near: this.info.synergyNear ?? [],
      onClose: () => {
        this.scene.resume();
        this.nav = new NavInput(this);
      },
    };
    this.scene.launch('SynergyBook', data);
    this.scene.bringToTop('SynergyBook');
    this.scene.pause();
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

  /** T81: el código de la partida, con botón de copiar (teclado, ratón o mando). */
  private showSeedCode() {
    const code = this.info.seedCode;
    // Panel del código: billete dorado con brillo (ui/art/seedArt.ts)
    const layer = addPanel(this, 480, 320, 600, 320, 50);
    if (code) layer.add(addCodeTicket(this, 480, 255, 440, 62));
    layer.add(this.add.text(480, 205, 'Código de semilla', { fontFamily: UI.FONT, fontSize: '24px', fontStyle: 'bold', color: '#2b3a67' }).setOrigin(0.5));
    layer.add(this.add.text(480, 255, code ?? 'Esta partida no tiene código\n(se empezó en una versión anterior)', {
      fontFamily: UI.FONT, fontSize: code ? '34px' : '18px', fontStyle: 'bold', color: code ? '#8a5a00' : '#4a5578', align: 'center',
    }).setOrigin(0.5));
    layer.add(this.add.text(480, 300, 'Con él, otro jugador juega esta misma partida desde «Partida con código».', {
      fontFamily: UI.FONT, fontSize: '14px', color: '#4a5578', align: 'center', wordWrap: { width: 520 },
    }).setOrigin(0.5));
    const note = this.add.text(480, 466, '', { fontFamily: UI.FONT, fontSize: '15px', color: '#2b3a67' }).setOrigin(0.5);
    layer.add(note);
    const options = code ? ['Copiar', 'Volver'] : ['Volver'];
    const list = new MenuList(this, 480, 345, options, (k) => {
      if (!code || k === 1) return this.closeSub();
      void copyText(code).then((ok) => note.active && note.setText(ok ? 'Código copiado' : 'No se pudo copiar: apúntalo a mano'));
    }, { w: 260, h: 44, gap: 10, depth: 51 });
    this.openSub(layer, list);
  }

  private showControls() {
    // T35: pantalla de Controles por secciones (Teclado, Ratón, Mando y Táctil)
    openControls(this);
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
