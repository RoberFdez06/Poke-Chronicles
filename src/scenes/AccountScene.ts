import Phaser from 'phaser';
import { fitDesign } from '../ui/layout';
import { accountErrorMessage, checkEmail, checkName, checkPassword, MAX_NAME } from '../data/account';
import { accountInfo, deleteAccount, resetPassword, signIn, signInWithGoogle, signOutAccount, signUp } from '../net/cloud';
import { googleIcon, mailIcon } from '../ui/art/accountIcons';
import { COLORS, fadeIn, FONT, goTo, HEX, hex } from '../ui/theme';
import { addMenuBackdrop } from '../ui/art/landscape';

type View = 'signin' | 'signup' | 'account' | 'confirm1' | 'confirm2' | 'info';

/**
 * Cuenta (T45): entrar, crear cuenta, recuperar contraseña, salir y borrar la cuenta. El formulario es HTML encima
 * del juego (para poder escribir). Teclado: Tab/flechas arriba-abajo, Enter, Esc para volver. Ratón: clic.
 * Mando: cruceta, A para pulsar, B para volver.
 */
export class AccountScene extends Phaser.Scene {
  private root?: HTMLDivElement;
  private status?: HTMLDivElement;
  private controls: HTMLElement[] = [];
  private focus = 0;
  private view: View = 'signin';
  private busy = false;
  private leaving = false;
  private padPrev: Record<string, boolean> = {};
  private onKey = (e: KeyboardEvent) => this.key(e);

  constructor() {
    super('Account');
  }

  create() {
    this.leaving = false;
    this.busy = false;
    fadeIn(this);
    fitDesign(this);
    addMenuBackdrop(this);
    this.add.text(480, 44, 'Cuenta', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: HEX.gold })
      .setOrigin(0.5).setStroke('#2b3a67', 10);
    // Mientras se escribe, Phaser no se queda las teclas (W, A, S, D, espacio…)
    this.input.keyboard?.disableGlobalCapture();
    window.addEventListener('keydown', this.onKey, true);
    this.padPrev = this.padNow();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());

    const a = accountInfo();
    this.build(!a.configured || a.mode === 'local' || a.error ? 'info' : a.mode === 'cloud' ? 'account' : 'signin');
  }

  private teardown() {
    window.removeEventListener('keydown', this.onKey, true);
    this.input.keyboard?.enableGlobalCapture();
    this.root?.remove();
    this.root = undefined;
  }

  // --- Construcción del formulario ---

  private build(view: View, message = '') {
    this.view = view;
    this.root?.remove();
    this.controls = [];
    this.focus = 0;
    const navy = hex(COLORS.navy);
    const root = document.createElement('div');
    root.style.cssText = `position:fixed;inset:0;z-index:900;display:flex;align-items:center;justify-content:center;
      pointer-events:none;font-family:${FONT},monospace;padding:16px;box-sizing:border-box;`;
    const box = document.createElement('div');
    box.style.cssText = `pointer-events:auto;background:${hex(COLORS.panel)};color:${navy};border:6px solid ${navy};
      outline:4px solid ${hex(COLORS.frame)};outline-offset:-10px;border-radius:6px;width:100%;max-width:520px;
      padding:24px 28px;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;margin-top:6vh;`;
    root.append(box);
    document.body.append(root);
    this.root = root;

    const text = (s: string, size = 16, bold = false) => {
      const d = document.createElement('div');
      d.textContent = s;
      d.style.cssText = `font-size:${size}px;${bold ? 'font-weight:bold;' : ''}line-height:1.35;`;
      box.append(d);
      return d;
    };
    const input = (label: string, type: string, auto: string, max?: number) => {
      const l = document.createElement('label');
      l.style.cssText = 'display:flex;flex-direction:column;gap:4px;font-size:14px;';
      l.textContent = label;
      const i = document.createElement('input');
      i.type = type;
      i.setAttribute('autocomplete', auto);
      if (max) i.maxLength = max;
      i.style.cssText = `font-family:inherit;font-size:17px;padding:8px 10px;border:3px solid ${navy};border-radius:4px;background:#fff;color:${navy};`;
      l.append(i);
      box.append(l);
      this.controls.push(i);
      i.addEventListener('focus', () => this.setFocus(this.controls.indexOf(i)));
      return i;
    };
    const button = (label: string, onClick: () => void, primary = false, icon?: HTMLElement) => {
      const b = document.createElement('button');
      b.type = 'button';
      if (icon) {
        const t = document.createElement('span');
        t.textContent = label;
        b.append(icon, t);
      } else b.textContent = label;
      b.style.cssText = `font-family:inherit;font-size:16px;font-weight:bold;padding:10px 14px;border:4px solid ${navy};
        border-radius:4px;cursor:pointer;color:${navy};background:${primary ? hex(COLORS.goldSoft) : hex(COLORS.panel)};`;
      if (icon) b.style.cssText += 'display:flex;align-items:center;justify-content:center;gap:10px;';
      b.addEventListener('click', () => !this.busy && onClick());
      b.addEventListener('mouseenter', () => this.setFocus(this.controls.indexOf(b)));
      box.append(b);
      this.controls.push(b);
      return b;
    };
    const a = accountInfo();

    if (view === 'info') {
      text(a.mode === 'local' ? 'Modo local de pruebas' : 'Juegas como invitado', 22, true);
      text(
        a.mode === 'local'
          ? 'El progreso se guarda en este navegador (modo de desarrollo).'
          : a.error
            ? `Las cuentas no están disponibles ahora: ${a.error}. Tu progreso no se guardará al cerrar.`
            : 'Las cuentas no están configuradas en esta versión del juego. Tu progreso no se guardará al cerrar.',
      );
      button('Volver', () => this.back(), true);
    } else if (view === 'signin' || view === 'signup') {
      const up = view === 'signup';
      text(up ? 'Crear cuenta' : 'Entrar', 22, true);
      text(a.loadFailed ? 'No se pudo leer tu progreso de la nube (¿sin conexión?). Recarga para reintentar.' : 'Juegas como invitado: tu progreso no se guardará al cerrar. Con una cuenta se guarda en la nube.', 14);
      const email = input('Correo', 'email', 'email');
      const pass = input(up ? `Contraseña (mínimo 6 caracteres)` : 'Contraseña', 'password', up ? 'new-password' : 'current-password');
      const name = up ? input(`Nombre público (opcional, hasta ${MAX_NAME})`, 'text', 'nickname', MAX_NAME) : null;
      const submit = () => {
        const err = checkEmail(email.value) ?? checkPassword(pass.value) ?? (name ? checkName(name.value) : null);
        if (err) return this.say(err, true);
        void this.run(up ? 'Creando la cuenta…' : 'Entrando…', () => (up ? signUp(email.value, pass.value, name!.value) : signIn(email.value, pass.value)));
      };
      [email, pass, name].forEach((i) => i?.addEventListener('keydown', (e) => e.key === 'Enter' && submit()));
      button(up ? 'Crear cuenta' : 'Entrar', submit, true, mailIcon(3));
      // Google ya está activado en Firebase (VITE_FIREBASE_GOOGLE=0 lo oculta si hiciera falta)
      if (import.meta.env.VITE_FIREBASE_GOOGLE !== '0') button('Entrar con Google', () => void this.run('Abriendo Google…', () => signInWithGoogle()), false, googleIcon(3));
      button(up ? 'Ya tengo cuenta: entrar' : 'No tengo cuenta: crear una', () => this.build(up ? 'signin' : 'signup'));
      if (!up) {
        button('He olvidado la contraseña', () => {
          const err = checkEmail(email.value);
          if (err) return this.say('Escribe tu correo arriba y pulsa otra vez', true);
          void this.run('Enviando…', async () => {
            await resetPassword(email.value);
            this.say('Te hemos enviado un correo para cambiar la contraseña');
          });
        });
      }
      button('Volver', () => this.back());
    } else if (view === 'account') {
      text(`Conectado como ${a.name || a.email || 'jugador'}`, 22, true);
      if (a.name && a.email) text(a.email, 14);
      text('Tu progreso se guarda en la nube automáticamente.', 15);
      if (a.imported) text(a.imported === 'guest' ? 'Se ha subido lo que jugaste como invitado.' : 'Se ha subido el progreso que tenías en este navegador.', 14);
      button('Volver', () => this.back(), true);
      button('Salir de la cuenta', () => void this.run('Saliendo…', () => signOutAccount()));
      button('Borrar cuenta', () => this.build('confirm1'));
    } else if (view === 'confirm1' || view === 'confirm2') {
      const second = view === 'confirm2';
      text(second ? '¿Seguro del todo?' : 'Borrar cuenta', 22, true);
      text(
        second
          ? 'Se borrarán tu cuenta y todo tu progreso de la nube. No se puede deshacer.'
          : 'Se borrará tu cuenta y todo su progreso: Pokémon, tickets, mejoras, logros y partidas.',
      );
      button('No, volver', () => this.build('account'), true);
      button(second ? 'Sí, borrar para siempre' : 'Sí, quiero borrarla', () =>
        second ? void this.run('Borrando…', () => deleteAccount()) : this.build('confirm2'),
      );
    }
    this.status = text(message, 14);
    this.status.setAttribute('role', 'status');
    this.setFocus(0);
  }

  /** Ejecuta una acción de la cuenta enseñando el estado y los errores (en español). */
  private async run(working: string, job: () => Promise<void>) {
    this.busy = true;
    this.say(working);
    try {
      await job();
    } catch (err) {
      console.warn('[Poké Chronicles] Cuenta:', err);
      this.say(accountErrorMessage(err), true);
    } finally {
      this.busy = false;
    }
  }

  private say(text: string, error = false) {
    if (!this.status) return;
    this.status.textContent = text;
    this.status.style.color = error ? '#c0392b' : hex(COLORS.navy);
  }

  private setFocus(i: number) {
    if (i < 0 || !this.controls.length) return;
    this.focus = (i + this.controls.length) % this.controls.length;
    this.controls.forEach((c, k) => {
      c.style.boxShadow = k === this.focus ? `0 0 0 4px ${hex(COLORS.gold)}` : 'none';
    });
    const el = this.controls[this.focus];
    if (document.activeElement !== el) el.focus({ preventScroll: true });
  }

  // --- Entrada ---

  private key(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.back();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.setFocus(this.focus + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.setFocus(this.focus + (e.shiftKey ? -1 : 1));
    }
    // Lo demás (letras, Enter en los botones…) lo hace el navegador; que no llegue al juego
    e.stopPropagation();
  }

  private padNow(): Record<string, boolean> {
    const pad = this.input.gamepad?.getPad(0);
    if (!pad || !pad.connected) return {};
    return { up: pad.up || pad.leftStick.y < -0.5, down: pad.down || pad.leftStick.y > 0.5, A: pad.A, B: pad.B };
  }

  private back() {
    if (this.leaving || this.busy) return;
    if (this.view === 'confirm1' || this.view === 'confirm2') return this.build('account');
    this.leaving = true;
    goTo(this, 'Settings');
  }

  update() {
    if (this.leaving) return;
    const now = this.padNow();
    const edge = (k: string) => now[k] && !this.padPrev[k];
    if (edge('down')) this.setFocus(this.focus + 1);
    if (edge('up')) this.setFocus(this.focus - 1);
    if (edge('B')) this.back();
    if (edge('A')) {
      const el = this.controls[this.focus];
      if (el instanceof HTMLButtonElement) el.click();
      else el?.focus();
    }
    this.padPrev = now;
  }
}
