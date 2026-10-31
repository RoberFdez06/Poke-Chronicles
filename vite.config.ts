import { defineConfig } from 'vite';

// Rutas relativas: la web funciona igual en la raíz de un dominio y en https://usuario.github.io/Poke-Chronicles/
export default defineConfig({
  base: './',
});
