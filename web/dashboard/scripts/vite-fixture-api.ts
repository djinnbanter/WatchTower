import type { Plugin } from 'vite';
import { createFixtureSession, handleFixtureRequest } from './fixture-api-core';

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Inject ?role= from Referer when the request URL has none (preview role switcher). */
function enrichUrlWithRole(req: import('http').IncomingMessage, url: string): string {
  try {
    const u = new URL(url, 'http://127.0.0.1');
    if (u.searchParams.get('role')) return url;
    const referer = req.headers.referer || req.headers.referrer;
    if (typeof referer !== 'string') return url;
    const fromRef = new URL(referer).searchParams.get('role');
    if (fromRef && ['owner', 'admin', 'viewer'].includes(fromRef)) {
      u.searchParams.set('role', fromRef);
      return u.pathname + u.search;
    }
  } catch {
    /* ignore */
  }
  return url;
}

/** Map /api/* to fixture JSON + lightweight session mutations for alpha preview. */
export function fixtureApiPlugin(): Plugin {
  const session = createFixtureSession();
  return {
    name: 'watchtower-fixture-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/')) return next();
        try {
          const method = (req.method || 'GET').toUpperCase();
          let body: unknown;
          if (method !== 'GET' && method !== 'HEAD') {
            const raw = await readBody(req);
            if (raw) {
              try {
                body = JSON.parse(raw);
              } catch {
                body = raw;
              }
            }
          }
          const result = await handleFixtureRequest(session, method, enrichUrlWithRole(req, url), body);
          if (!result) return next();
          res.statusCode = result.status;
          res.setHeader('Content-Type', result.contentType);
          res.setHeader('Cache-Control', 'no-store');
          res.end(result.body);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export { listFixtureFiles } from './fixture-api-core';
