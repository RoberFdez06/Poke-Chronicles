import Phaser from 'phaser';
import { COVER_H, COVER_W, DCX, DCY, fitDesign } from '../ui/layout';
import { MenuList, NavInput } from '../ui/nav';
import { drawBox, FONT, HEX } from '../ui/theme';
import { sfx } from '../ui/audio';
import { biomeById } from '../level/biomes';
import { ROUTE_REWARD_DESC, ROUTE_REWARD_LABEL, type RouteOption } from '../level/routes';

export interface RouteSceneData {
  /** Piso al que llevan las rutas. */
  floor: number;
  options: RouteOption[];
  onChoice: (o: RouteOption) => void;
}

/**
 * T80: elegir la ruta del piso siguiente entre 2 o 3 cartas (bioma, dificultad y premio). Teclado (flechas + Enter),
 * ratón (clic en la carta o en su botón) y mando (cruceta/stick + A). No se puede saltar: hay que elegir.
 */
export class RouteScene extends Phaser.Scene {
  private args!: RouteSceneData;
  private nav!: NavInput;
  private menu!: MenuList;
  private done = false;

  constructor() {
    super('Route');
  }

  init(data: RouteSceneData) {
    this.args = data;
    this.done = false;
  }

  create() {
    fitDesign(this);
    this.nav = new NavInput(this);
    const { options, floor } = this.args;
    this.add.rectangle(DCX, DCY, COVER_W + 4, COVER_H + 4, 0x0d1425, 0.85).setInteractive();
    this.add.text(480, 70, `Elige la ruta al piso ${floor}`, { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#f8d030', stroke: '#283068', strokeThickness: 5 }).setOrigin(0.5);
    // TODO(supervisor): mapa de la ruta y dibujo de cada carta (emblema del bioma, iconos del premio); ahora, cajas lisas
    const n = options.length;
    const cw = 250;
    const gap = 26;
    const x0 = 480 - ((n * cw + (n - 1) * gap) / 2);
    options.forEach((o, i) => {
      const x = x0 + i * (cw + gap);
      const biome = biomeById(o.biomeId);
      drawBox(this.add.graphics(), x, 120, cw, 300, { radius: 14, border: o.diffPct > 0 ? 0xe0402a : 0x4caf50 });
      this.add.rectangle(x + cw / 2, 170, cw - 40, 60, biome.colors.floor).setStrokeStyle(4, biome.colors.wall);
      this.add.text(x + cw / 2, 170, biome.name, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff', stroke: '#101828', strokeThickness: 4 }).setOrigin(0.5);
      this.add.text(x + cw / 2, 228, o.diffPct > 0 ? `Dificultad +${o.diffPct} %` : 'Ruta tranquila', { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: o.diffPct > 0 ? '#e0402a' : '#2f8a3a' }).setOrigin(0.5);
      this.add.text(x + cw / 2, 270, ROUTE_REWARD_LABEL[o.reward], { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: HEX.text }).setOrigin(0.5);
      this.add.text(x + cw / 2, 300, ROUTE_REWARD_DESC[o.reward], { fontFamily: FONT, fontSize: '15px', color: HEX.textSoft, align: 'center', wordWrap: { width: cw - 30 } }).setOrigin(0.5, 0);
      const z = this.add.zone(x + cw / 2, 270, cw, 300).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.pick(i));
    });
    const labels = options.map((o, i) => (n === 2 ? ['Izquierda', 'Derecha'] : ['Izquierda', 'Centro', 'Derecha'])[i] + (o.diffPct === 0 ? ' (tranquila)' : ''));
    this.menu = new MenuList(this, 480, 450, labels, (i) => this.pick(i), { w: 300, h: 40, gap: 8, fontSize: 18 });
    this.add.text(480, 610, 'Flechas, ratón o mando · Enter, clic o A para elegir', { fontFamily: FONT, fontSize: '13px', color: HEX.textSoft }).setOrigin(0.5);
    sfx('select');
  }

  private pick(i: number) {
    if (this.done) return;
    const o = this.args.options[i];
    if (!o) return;
    this.done = true;
    sfx('select');
    this.args.onChoice(o);
  }

  update() {
    if (this.done) return;
    const s = this.nav.read();
    this.menu.move(s.dy || s.dx);
    if (s.ok) this.menu.activate();
  }
}
