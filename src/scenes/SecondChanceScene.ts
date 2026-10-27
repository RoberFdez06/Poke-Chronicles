import Phaser from 'phaser';
import { addHelpBar } from '../ui/helpBar';
import { COVER_H, COVER_W, DCX, DCY, fitDesign } from '../ui/layout';
import { MenuList, NavInput } from '../ui/nav';
import { drawBox, FONT, HEX } from '../ui/theme';
import { addPixelText } from '../ui/art/pixel';
import { addIcon } from '../ui/art/icons';
import { sfx } from '../ui/audio';
import type { Balances, ReviveCurrency } from '../data/secondChance';

export type SecondChanceChoice = ReviveCurrency | 'giveUp';

export interface SecondChanceData {
  /** Lo que cuesta en cada moneda y lo que tiene el jugador. */
  costs: Balances;
  balances: Balances;
  /** Invitado: puede usarla, pero se le recuerda que no se guarda nada. */
  guest: boolean;
  onChoice: (c: SecondChanceChoice) => void;
}

const LABEL: Record<ReviveCurrency, string> = { candies: 'caramelos', tickets: 'tickets' };
const OPTIONS: SecondChanceChoice[] = ['candies', 'tickets', 'giveUp'];
/**
 * Sale en plena pelea: si estabas disparando a clics o pulsando Espacio (objeto activo, que en los menús también
 * acepta), esa pulsación podría pagar o rendirse sin querer. Hasta pasado este margen no se elige nada (ms).
 */
export const SECOND_CHANCE_INPUT_DELAY_MS = 700;

/**
 * T57: «Una más». Al caer, si queda la segunda oportunidad de la partida: revivir pagando caramelos o tickets, o
 * terminar. Teclado (flechas + Enter), ratón (clic) y mando (cruceta + A); Esc o B = terminar. Si eliges una moneda
 * sin saldo suficiente, avisa y no se cierra.
 */
export class SecondChanceScene extends Phaser.Scene {
  private args!: SecondChanceData;
  private nav!: NavInput;
  private menu!: MenuList;
  private message!: Phaser.GameObjects.Text;
  private done = false;
  private readyAt = 0;

  constructor() {
    super('SecondChance');
  }

  init(data: SecondChanceData) {
    this.args = data;
    this.done = false;
  }

  create() {
    fitDesign(this);
    this.nav = new NavInput(this);
    const { costs, balances } = this.args;
    this.add.rectangle(DCX, DCY, COVER_W + 4, COVER_H + 4, 0x0d1425, 0.82).setInteractive();
    drawBox(this.add.graphics(), 140, 100, 680, 460, { radius: 16, border: 0xe53935 });
    addPixelText(this, 480, 165, '¿UNA MÁS?', { size: 16, scale: 3, color: '#f8d030', stroke: '#283068', strokeWidth: 3, shadow: '#101828' });
    addIcon(this, 300, 165, 'heart', 3);
    addIcon(this, 660, 165, 'heart', 3);
    this.add
      .text(480, 222, 'Tu Pokémon se ha debilitado.\nPuedes volver una sola vez en esta partida, con media vida\ny 2 segundos de inmunidad, en la misma sala.', {
        fontFamily: FONT, fontSize: '18px', color: HEX.text, align: 'center', lineSpacing: 5,
      })
      .setOrigin(0.5, 0);
    const opt = (c: ReviveCurrency) => `Revivir: ${costs[c]} ${LABEL[c]} (tienes ${balances[c]})`;
    this.menu = new MenuList(this, 480, 332, [opt('candies'), opt('tickets'), 'Terminar la partida'], (i) => this.pick(i), { w: 470, h: 46, gap: 10, fontSize: 19 });
    // Empieza en la primera que se pueda pagar
    const first = (['candies', 'tickets'] as const).findIndex((c) => balances[c] >= costs[c]);
    this.menu.select(first >= 0 ? first : 2);
    this.message = this.add.text(480, 500, this.args.guest ? 'Como invitado puedes usarla, pero no se guarda nada.' : '', {
      fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: HEX.textSoft,
    }).setOrigin(0.5);
    addHelpBar(this, 480, 536, 'Flechas o ratón · Enter o clic · Esc: terminar', { fontFamily: FONT, fontSize: '13px', color: HEX.textSoft }).setOrigin(0.5);
    sfx('select');
    this.readyAt = this.time.now + SECOND_CHANCE_INPUT_DELAY_MS;
  }

  private pick(i: number) {
    if (this.done || this.time.now < this.readyAt) return;
    const c = OPTIONS[i];
    if (c !== 'giveUp' && this.args.balances[c] < this.args.costs[c]) {
      // Sin saldo: no se cierra, para que pueda elegir la otra moneda o terminar
      this.message.setText(`No tienes ${LABEL[c]} suficientes`).setColor('#e53935');
      sfx('hurt');
      return;
    }
    this.done = true;
    this.args.onChoice(c);
  }

  update() {
    if (this.done) return;
    const s = this.nav.read();
    if (s.back) return this.pick(2);
    this.menu.move(s.dy || s.dx);
    if (s.ok) this.menu.activate();
  }
}
