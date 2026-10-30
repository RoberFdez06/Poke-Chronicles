// Efecto visual del clima del piso (T38): gotas, rayos de sol, arena, granizo o niebla. Ligero: un solo Graphics que
// se redibuja con pocas partículas (cuadraditos pixel), un tinte encima de la sala y, con niebla, una viñeta que
// sigue al jugador. Se dibuja en coordenadas del mundo, sobre lo que ve la cámara principal.
import Phaser from 'phaser';
import type { Weather } from '../data/weather';

interface Drop {
  x: number;
  y: number;
  s: number;
}

const COUNT: Record<Weather, number> = { rain: 70, sun: 0, sand: 60, hail: 40, fog: 0 };
const TINT: Record<Weather, { color: number; alpha: number }> = {
  rain: { color: 0x1d3a6b, alpha: 0.12 },
  sun: { color: 0xffd24a, alpha: 0.08 },
  sand: { color: 0xc89a52, alpha: 0.14 },
  hail: { color: 0xcfe8ff, alpha: 0.1 },
  fog: { color: 0x9aa4b0, alpha: 0.1 },
};
const FOG_KEY = 'weather-fog';

export class WeatherFx {
  private g: Phaser.GameObjects.Graphics;
  private tint: Phaser.GameObjects.Rectangle;
  private fog?: Phaser.GameObjects.Image;
  private drops: Drop[] = [];
  private t = 0;

  constructor(
    private scene: Phaser.Scene,
    private weather: Weather,
    depth: number,
    /** Menos partículas (efectos bajos, T41). */
    low = false,
  ) {
    const t = TINT[weather];
    this.tint = scene.add.rectangle(0, 0, 10, 10, t.color, t.alpha).setOrigin(0).setDepth(depth);
    this.g = scene.add.graphics().setDepth(depth + 1);
    const n = Math.round(COUNT[weather] * (low ? 0.4 : 1));
    for (let i = 0; i < n; i++) this.drops.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 });
    if (weather === 'fog') {
      if (!scene.textures.exists(FOG_KEY)) bakeFog(scene);
      this.fog = scene.add.image(0, 0, FOG_KEY).setDepth(depth + 2);
    }
  }

  /** Cada fotograma: mueve las partículas; `focus` es el centro de la niebla (el jugador). */
  update(delta: number, focus?: { x: number; y: number }) {
    const view = this.scene.cameras.main.worldView;
    if (view.width <= 0) return;
    const dt = Math.min(delta, 50) / 1000;
    this.t += dt;
    // Con margen: worldView va un fotograma por detrás de la cámara (temblor, zoom, salas grandes) y el tinte dejaba
    // una franja sin cubrir en un borde, que se veía como un filtro mal puesto
    const M = 96;
    this.tint.setPosition(view.x - M, view.y - M).setSize(view.width + M * 2, view.height + M * 2);
    const g = this.g.clear();
    const w = this.weather;
    if (w === 'sun') {
      // Rayos inclinados que laten despacio
      // Tenues y de borde suave (tres capas): los triángulos de un solo tono se veían como un filtro con cantos
      const a = 0.025 + 0.012 * Math.sin(this.t * 1.3);
      for (let k = 0; k < 4; k++) {
        const x0 = view.x + view.width * (0.1 + k * 0.27);
        for (let l = 0; l < 3; l++) {
          const w = 30 + l * 20;
          g.fillStyle(0xfff3b0, a);
          g.fillTriangle(x0 - l * 10, view.y, x0 + w, view.y, x0 - view.height * 0.35 - l * 10, view.y + view.height);
        }
      }
    }
    for (const d of this.drops) {
      if (w === 'rain') {
        d.y += dt * 1.6 * d.s;
        d.x -= dt * 0.25 * d.s;
      } else if (w === 'sand') {
        d.x += dt * 0.9 * d.s;
        d.y += dt * 0.12 * Math.sin(this.t * 3 + d.s * 9);
      } else if (w === 'hail') {
        d.y += dt * 0.9 * d.s;
        d.x -= dt * 0.08;
      }
      d.x = ((d.x % 1) + 1) % 1;
      d.y = ((d.y % 1) + 1) % 1;
      const px = Math.round(view.x + d.x * view.width);
      const py = Math.round(view.y + d.y * view.height);
      if (w === 'rain') {
        g.fillStyle(0x9cc8ff, 0.7);
        g.fillRect(px, py, 2, 10 * d.s);
      } else if (w === 'sand') {
        g.fillStyle(0xe7c27a, 0.75);
        g.fillRect(px, py, 6 * d.s, 2);
      } else if (w === 'hail') {
        g.fillStyle(0xffffff, 0.9);
        g.fillRect(px, py, 4, 4);
      }
    }
    if (this.fog) {
      const c = focus ?? { x: view.centerX, y: view.centerY };
      // Cubre de sobra lo que ve la cámara aunque el jugador esté en una esquina
      const size = Math.max(view.width, view.height) * 2.2;
      this.fog.setPosition(c.x, c.y).setDisplaySize(size, size);
    }
  }

  destroy() {
    this.g.destroy();
    this.tint.destroy();
    this.fog?.destroy();
  }
}

/** Viñeta de la niebla: transparente en el centro y gris oscuro en los bordes. */
function bakeFog(scene: Phaser.Scene) {
  const size = 256;
  const tex = scene.textures.createCanvas(FOG_KEY, size, size);
  if (!tex) return;
  const ctx = tex.getContext();
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.12, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(40,44,52,0)');
  grad.addColorStop(0.55, 'rgba(40,44,52,0.55)');
  grad.addColorStop(1, 'rgba(30,32,40,0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
}
