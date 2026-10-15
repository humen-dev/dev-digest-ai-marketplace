/// <reference types="vitest/config" />
import { copyFileSync, cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site from https://humen-dev.github.io/dev-digest-ai-marketplace/
const PAGES_BASE = '/dev-digest-ai-marketplace/';
// Claude Design explorations live outside the app and are published at <base>design/.
const DESIGN_DIR = resolve(import.meta.dirname, '../design');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

// GitHub Pages has no SPA fallback: an unknown path returns 404.html.
// Shipping index.html as 404.html lets the router render deep links
// such as /plugins/devdigest-backend/ on a fresh page load.
// The design files are copied next to the app so /design/ keeps working.
function pagesOutput(): Plugin {
  let outDir = 'dist';
  return {
    name: 'pages-output',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
      if (existsSync(DESIGN_DIR)) cpSync(DESIGN_DIR, resolve(outDir, 'design'), { recursive: true });
    },
  };
}

// Serve ../design at /design/ in the dev server, like the published site.
function designInDev(): Plugin {
  return {
    name: 'design-in-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? '').split('?')[0]);
        if (!url.startsWith('/design/')) return next();
        const file = resolve(DESIGN_DIR, '.' + url.slice('/design'.length) + (url.endsWith('/') ? 'index.html' : ''));
        if (!file.startsWith(DESIGN_DIR + sep) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  // The dev server runs at /; builds and `vite preview` use the Pages path.
  base: command === 'build' || isPreview ? (process.env.SITE_BASE ?? PAGES_BASE) : '/',
  plugins: [react(), pagesOutput(), designInDev()],
  define: {
    __COMMIT__: JSON.stringify(process.env.GITHUB_SHA ?? ''),
  },
  server: { port: 5173 },
  test: { environment: 'node' },
}));
