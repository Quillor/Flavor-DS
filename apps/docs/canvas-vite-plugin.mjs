/**
 * Canvas persistence — Vite dev middleware.
 *
 * GET  /__canvas/feedback  → the current .canvas/feedback.json (or an empty document)
 * POST /__canvas/feedback  → overwrite it (JSON body)
 *
 * This is the "repo-file persistence" extension from the Canvas spec §7: comments,
 * author and token overrides live in a versioned file at the REPO ROOT, so a teammate
 * pulling the branch sees the same pins. It exists only in `astro dev`; the static
 * production build has no server, so the board falls back to localStorage there and
 * says so.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILE = join(REPO, '.canvas', 'feedback.json');
const EMPTY = { version: 1, author: 'Anonymous', axes: null, overrides: {}, comments: [] };

export default function canvasPlugin() {
  return {
    name: 'flavor-canvas-feedback',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__canvas/feedback', (req, res, next) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method === 'GET') {
          try { res.end(existsSync(FILE) ? readFileSync(FILE, 'utf8') : JSON.stringify(EMPTY)); } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e) })); }
          return;
        }
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body || '{}');
              mkdirSync(dirname(FILE), { recursive: true });
              writeFileSync(FILE, JSON.stringify(parsed, null, 2) + '\n');
              res.end(JSON.stringify({ ok: true, path: '.canvas/feedback.json' }));
            } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ error: String(e) })); }
          });
          return;
        }
        next();
      });
    },
  };
}
