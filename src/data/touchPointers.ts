// Seguro contra dedos «pillados» en táctil: un stick o botón que se queda pulsado porque el navegador no mandó
// pointerup/pointercancel (gestos del sistema en iOS, notificaciones, cambiar de app, bloquear la pantalla, salir
// por el borde). Lógica pura (sin Phaser ni DOM): una pequeña máquina de estados por stick.

/** Sin ningún evento del dedo durante este tiempo, un dedo nuevo en el mismo lado puede quedarse el stick. */
export const STALE_MS = 1500;

export interface HeldPointer {
  id: number | null;
  /** Último evento (down o move) de ese dedo, en ms. */
  last: number;
}

export type PointerEvt =
  | { type: 'down'; id: number; t: number }
  | { type: 'move'; id: number; t: number }
  | { type: 'up'; id: number }
  | { type: 'cancel'; id: number }
  /** Pérdida de foco, pestaña oculta, pagehide, cambio de escena: se sueltan todos. */
  | { type: 'blur' };

/** Nuevo estado del stick tras un evento. `took`: el dedo `id` acaba de quedarse el stick. */
export function stepPointer(s: HeldPointer, e: PointerEvt): HeldPointer & { took: boolean } {
  switch (e.type) {
    case 'down':
      // Libre, o el dedo anterior lleva STALE_MS sin dar señales (se perdió su «up»): el nuevo se lo queda
      if (s.id === null || s.id === e.id || e.t - s.last >= STALE_MS) return { id: e.id, last: e.t, took: true };
      return { ...s, took: false };
    case 'move':
      return s.id === e.id ? { id: s.id, last: e.t, took: false } : { ...s, took: false };
    case 'up':
    case 'cancel':
      return s.id === e.id ? { id: null, last: s.last, took: false } : { ...s, took: false };
    case 'blur':
      return { id: null, last: s.last, took: false };
  }
}

/**
 * ¿Hay que soltar el stick? Si el sistema dice que su dedo ya no está pulsado (`isDown` falso o puntero
 * desconocido), sí. Un dedo quieto sobre el stick sigue pulsado: no se suelta solo por no moverse.
 */
export const shouldRelease = (s: HeldPointer, isDown: (id: number) => boolean | undefined): boolean => s.id !== null && isDown(s.id) !== true;

/** Radio de toque (px CSS) de un botón de `size` px CSS: algo mayor que el dibujo y al menos 28 (56 de diámetro). */
export const touchHitR = (size: number): number => Math.max(size / 2 + 10, 28);

// --- Seguro completo (rama `movil`, 2026-11-06): lista real de dedos, dedos en espera y cuándo soltar todo ---

/**
 * Dedos retenidos que ya no están en la pantalla: ni en `touches` (los que siguen apoyados según el navegador) ni en
 * `changedTouches` (los de este mismo evento, que se tratan por su camino normal). Son dedos cuyo «touchend» se
 * perdió (gesto del sistema, notificación, multitarea de iOS, barra que aparece…) y hay que soltarlos ya.
 */
export function ghostTouches(held: Iterable<number | null>, live: Iterable<number>, changed: Iterable<number> = []): number[] {
  const ok = new Set<number>([...live, ...changed]);
  const out: number[] = [];
  for (const id of held) if (id !== null && !ok.has(id) && !out.includes(id)) out.push(id);
  return out;
}

/** Tras un touchend o touchcancel sin ningún dedo en la pantalla no puede quedar nada pulsado. */
export const noFingersLeft = (type: string, touchesLeft: number): boolean => (type === 'touchend' || type === 'touchcancel') && touchesLeft === 0;

export type StickSide = 'move' | 'aim';

/** Un dedo que se apoyó en el lado de un stick ya ocupado: espera por si el otro se levanta. */
export interface WaitingFinger {
  id: number;
  side: StickSide;
  x: number;
  y: number;
  t: number;
}

/** Resultado de soltar un stick: qué lado queda libre y qué dedo en espera (si hay) se lo queda en el acto. */
export interface Release {
  side: StickSide;
  adopt: WaitingFinger | null;
}

/**
 * Árbitro de los dos joysticks (sin Phaser ni DOM). Un dedo por stick; si un segundo dedo cae en el mismo lado, espera
 * y se queda el stick en cuanto el primero se levanta (así no hace falta volver a tocar: antes se sentía como un
 * control «pillado»). Un dedo sin señales STALE_MS cede el stick al dedo nuevo (seguro si se perdió su «up»).
 */
export class StickArbiter {
  private own: Record<StickSide, HeldPointer> = { move: { id: null, last: 0 }, aim: { id: null, last: 0 } };
  private wait = new Map<number, WaitingFinger>();

  owner(side: StickSide): number | null {
    return this.own[side].id;
  }

  sideOf(id: number): StickSide | null {
    return this.own.move.id === id ? 'move' : this.own.aim.id === id ? 'aim' : null;
  }

  /** Ids que hay que vigilar (dueños y dedos en espera). */
  tracked(): number[] {
    const out: number[] = [];
    for (const s of ['move', 'aim'] as const) if (this.own[s].id !== null) out.push(this.own[s].id!);
    for (const id of this.wait.keys()) out.push(id);
    return out;
  }

  /** Dedo nuevo en un lado: true si se queda el stick (si el dueño anterior estaba perdido, lo pierde). */
  down(f: WaitingFinger): boolean {
    // El mismo dedo no puede estar en los dos lados ni en espera a la vez
    this.forget(f.id);
    const nx = stepPointer(this.own[f.side], { type: 'down', id: f.id, t: f.t });
    this.own[f.side] = { id: nx.id, last: nx.last };
    if (!nx.took) this.wait.set(f.id, { ...f });
    return nx.took;
  }

  /** Movimiento: refresca al dueño (devuelve su lado) o la posición del dedo en espera. */
  move(id: number, x: number, y: number, t: number): StickSide | null {
    const side = this.sideOf(id);
    if (side) {
      this.own[side] = { id, last: t };
      return side;
    }
    const w = this.wait.get(id);
    if (w) Object.assign(w, { x, y, t });
    return null;
  }

  /** Dedo levantado o cancelado. Si era dueño, el último dedo en espera de ese lado se queda el stick. */
  up(id: number): Release | null {
    this.wait.delete(id);
    const side = this.sideOf(id);
    if (!side) return null;
    return this.free(side);
  }

  /** Suelta los dedos que el navegador ya no tiene apoyados (`isLive` falso). */
  sync(isLive: (id: number) => boolean): Release[] {
    for (const id of [...this.wait.keys()]) if (!isLive(id)) this.wait.delete(id);
    const out: Release[] = [];
    for (const s of ['move', 'aim'] as const) {
      const id = this.own[s].id;
      if (id !== null && !isLive(id)) out.push(this.free(s));
    }
    return out;
  }

  /** Suelta todo (pausa, foco perdido, giro, cambio de escena): nadie adopta. */
  releaseAll(): StickSide[] {
    this.wait.clear();
    const out: StickSide[] = [];
    for (const s of ['move', 'aim'] as const) {
      if (this.own[s].id !== null) out.push(s);
      this.own[s] = { id: null, last: this.own[s].last };
    }
    return out;
  }

  private free(side: StickSide): Release {
    this.own[side] = { id: null, last: this.own[side].last };
    // El más reciente de los que esperan en ese lado
    let adopt: WaitingFinger | null = null;
    for (const w of this.wait.values()) if (w.side === side && (!adopt || w.t >= adopt.t)) adopt = w;
    if (adopt) {
      this.wait.delete(adopt.id);
      this.own[side] = { id: adopt.id, last: adopt.t };
    }
    return { side, adopt };
  }

  private forget(id: number) {
    this.wait.delete(id);
    for (const s of ['move', 'aim'] as const) if (this.own[s].id === id) this.own[s] = { id: null, last: this.own[s].last };
  }
}

/**
 * Un toque de botón que la partida no recoge en PRESS_TTL_MS se descarta: si no, un toque durante una transición o
 * cinemática salía segundos después (bomba o poción «fantasma» al entrar en la sala).
 */
export const PRESS_TTL_MS = 300;
export const pressFresh = (at: number, now: number): boolean => now >= at && now - at <= PRESS_TTL_MS;
