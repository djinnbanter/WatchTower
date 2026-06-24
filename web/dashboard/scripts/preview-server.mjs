/**
 * Static preview server for the Watchtower dashboard (no MC server required).
 * Regenerates mock metrics, then serves web/dashboard on port 8080.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 8080);
const faviconPath = join(root, 'assets', 'watchtower-icon-simple.png');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/png',
  '.woff2': 'font/woff2',
};

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

await import('./generate-mock-data.mjs');

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    let path = decodeURIComponent(url.pathname);

    if (path === '/favicon.ico' || path === '/favicon.png') {
      const body = await readFile(faviconPath);
      res.writeHead(200, { ...NO_CACHE, 'Content-Type': 'image/png' });
      res.end(body);
      return;
    }

    if (path === '/') path = '/index.html';
    const filePath = join(root, path.replace(/^\/+/, ''));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const body = await readFile(filePath);
    const type = MIME[extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { ...NO_CACHE, 'Content-Type': type });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, () => {
  const url = `http://127.0.0.1:${port}/`;
  console.log(`Watchtower static preview: ${url}`);
  console.log('Favicon: /favicon.ico -> assets/watchtower-icon-simple.png');
  console.log('Mock metrics refresh on each server start. Press Ctrl+C to stop.');
  if (process.env.OPEN_BROWSER !== '0') {
    const open = process.platform === 'win32'
      ? () => spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' })
      : process.platform === 'darwin'
        ? () => spawn('open', [url], { detached: true, stdio: 'ignore' })
        : () => spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
    open().unref();
  }
});
