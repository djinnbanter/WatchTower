/**
 * Load preview mod configs from a real config/ directory.
 * Set PREVIEW_CONFIG_DIR (e.g. a Prism/MultiMC instance config folder).
 * Matches ModConfigService allowlist — lookup/edit stays in-session (does not write disk).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const PREVIEW_CONFIG_MAX_BYTES = 512 * 1024;

function isAllowedName(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.tmp') || lower.endsWith('.bak') || String(name).endsWith('~')) return false;
  return (
    lower.endsWith('.toml') ||
    lower.endsWith('.json') ||
    lower.endsWith('.properties') ||
    lower.endsWith('.cfg') ||
    lower.endsWith('.txt')
  );
}

export function resolvePreviewConfigDir(env = process.env) {
  const raw = String(env.PREVIEW_CONFIG_DIR || '').trim();
  return raw || null;
}

/**
 * Walk a config folder and return fixture store entries keyed by `config/...` paths.
 * @returns {Record<string, { content: string, mtime: number, backups: string[] }>}
 */
export function loadPreviewConfigsFromDir(dir) {
  if (!dir || !existsSync(dir)) return {};
  const files = {};
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = join(current, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!ent.isFile() || !isAllowedName(ent.name)) continue;

      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.size > PREVIEW_CONFIG_MAX_BYTES) continue;

      let content;
      try {
        content = readFileSync(full, 'utf8');
      } catch {
        continue;
      }

      const rel = relative(dir, full).replace(/\\/g, '/');
      if (!rel || rel.startsWith('../') || rel.includes('\0')) continue;
      const pathKey = `config/${rel}`;
      files[pathKey] = {
        content,
        mtime: Math.floor(st.mtimeMs / 1000) || Math.floor(Date.now() / 1000),
        backups: [],
      };
    }
  }

  return files;
}
