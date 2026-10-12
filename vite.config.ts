import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist/renderer',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        counter: path.resolve(__dirname, 'counter.html'),
        present: path.resolve(__dirname, 'present.html'),
        languageSnake: path.resolve(__dirname, 'language-snake.html'),
        finalBossHero: path.resolve(__dirname, 'final-boss-hero.html'),
      },
    },
  }
});
