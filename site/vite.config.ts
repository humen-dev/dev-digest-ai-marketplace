/// <reference types="vitest/config" />
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site from https://humen-dev.github.io/dev-digest-ai-marketplace/
const PAGES_BASE = '/dev-digest-ai-marketplace/';

// GitHub Pages has no SPA fallback: an unknown path returns 404.html.
// Shipping index.html as 404.html lets the router render deep links
// such as /plugins/devdigest-backend/ on a fresh page load.
function spaFallback(): Plugin {
  let outDir = 'dist';
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  // The dev server runs at /; builds and `vite preview` use the Pages path.
  base: command === 'build' || isPreview ? (process.env.SITE_BASE ?? PAGES_BASE) : '/',
  plugins: [react(), spaFallback()],
  define: {
    __COMMIT__: JSON.stringify(process.env.GITHUB_SHA ?? ''),
  },
  server: { port: 5173 },
  test: { environment: 'node' },
}));
