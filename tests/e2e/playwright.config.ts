// Pruebas en navegador (npm run e2e): abre el juego construido con `vite preview` y PokeAPI simulada.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 960, height: 640 },
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    cwd: '../..',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
