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
