import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import canvasPlugin from './canvas-vite-plugin.mjs';

export default defineConfig({
  integrations: [react()],
  server: { port: Number(process.env.PORT) || 4321 },
  // Canvas design-review board: dev-only middleware that persists feedback to
  // .canvas/feedback.json at the repo root (see src/canvas/).
  vite: { plugins: [canvasPlugin()] },
});
