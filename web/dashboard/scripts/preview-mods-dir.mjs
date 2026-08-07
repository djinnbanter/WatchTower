/**
 * Build preview running_mods / facts mods from a real mods/ directory.
 * Set PREVIEW_MODS_DIR to enable (e.g. a Prism/MultiMC instance mods folder).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const VERSION_TOKEN = /^(?:v)?\d+(?:\.\d+)+(?:[.+_-][A-Za-z0-9.+_-]+)?$/i;
const LOADERISH = /^(neoforge|forge|fabric|quilt|mc\d|minecraft)$/i;
const JARJAR_RE = /^META-INF\/jarjar\/.+\.jar$/i;

/**
 * Heuristic parse of a jar filename into id / version / display name.
 * Good enough for preview inventory; Modrinth scan enriches via hash.
 */
export function parseJarFilename(fileName) {
  const disabled = /\.jar\.disabled$/i.test(fileName);
  const jar_file = fileName;
  const base = fileName.replace(/\.jar(?:\.disabled)?$/i, '');
  const parts = base.split(/[-_]/).filter(Boolean);
  if (!parts.length) {
    return { id: 'unknown', version: '?', display_name: base || fileName, jar_file, disabled };
  }

  let versionIdx = -1;
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    if (VERSION_TOKEN.test(parts[i]) || /^\d+\.\d+/.test(parts[i])) {
      versionIdx = i;
      break;
    }
  }

  let idParts = versionIdx > 0 ? parts.slice(0, versionIdx) : parts.slice(0, 1);
  // Drop trailing loader tokens from id
  while (idParts.length > 1 && LOADERISH.test(idParts[idParts.length - 1])) {
    idParts = idParts.slice(0, -1);
  }
  // Drop leading "mc1.21" style
  while (idParts.length > 1 && LOADERISH.test(idParts[0])) {
    idParts = idParts.slice(1);
  }

  const id = idParts.join('_').toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'unknown';
  const version =
    versionIdx >= 0
      ? parts.slice(versionIdx).filter((p) => !LOADERISH.test(p)).join('-') || parts[versionIdx]
      : '?';
  const display_name = idParts
    .map((p) => (p.length <= 3 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');

  return { id, version, display_name, jar_file, disabled };
}

/**
 * List META-INF/jarjar/*.jar entries inside a parent jar (preview only).
 * Uses system `tar` which can list zip/jar archives on Windows and Unix.
 */
export function listJarInJarEntries(jarPath) {
  if (!jarPath || !existsSync(jarPath)) return [];
  const listed = spawnSync('tar', ['-tf', jarPath], {
    encoding: 'utf8',
    maxBuffer: 12 * 1024 * 1024,
    windowsHide: true,
  });
  if (listed.status !== 0 || !listed.stdout) return [];
  const out = [];
  const seen = new Set();
  for (const line of listed.stdout.split(/\r?\n/)) {
    const nested_path = line.trim().replace(/^\.\//, '');
    if (!JARJAR_RE.test(nested_path)) continue;
    const file = basename(nested_path);
    const parsed = parseJarFilename(file);
    const id = parsed.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      display_name: parsed.display_name,
      version: parsed.version !== '?' ? parsed.version : undefined,
      nested_path,
    });
  }
  return out;
}

export function resolvePreviewModsDir(env = process.env) {
  const raw = String(env.PREVIEW_MODS_DIR || '').trim();
  return raw || null;
}

/**
 * @returns {{ id: string, version: string, display_name: string, jar_file: string, jar?: string, disabled?: boolean, jar_path: string, jar_in_jar?: object[], nested_mod_ids?: string[] }[]}
 */
export function loadPreviewModsFromDir(dir) {
  if (!dir || !existsSync(dir)) return [];
  const entries = readdirSync(dir);
  const mods = [];
  const seen = new Map();

  for (const name of entries) {
    if (!/\.jar(?:\.disabled)?$/i.test(name)) continue;
    const jar_path = join(dir, name);
    let st;
    try {
      st = statSync(jar_path);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;

    const parsed = parseJarFilename(name);
    let id = parsed.id;
    // De-dupe ids (common with filename collisions)
    if (seen.has(id)) {
      const n = seen.get(id) + 1;
      seen.set(id, n);
      id = `${id}_${n}`;
    } else {
      seen.set(id, 1);
    }

    const jar_in_jar = listJarInJarEntries(jar_path);
    const row = {
      id,
      version: parsed.version,
      display_name: parsed.display_name,
      jar_file: parsed.jar_file,
      jar: parsed.jar_file,
      disabled: parsed.disabled || undefined,
      jar_path,
    };
    if (jar_in_jar.length) {
      row.jar_in_jar = jar_in_jar;
      row.nested_mod_ids = jar_in_jar.map((j) => j.id);
    }
    mods.push(row);
  }

  mods.sort((a, b) => a.display_name.localeCompare(b.display_name));
  return mods;
}

/** Strip absolute paths before writing into committed/session fixtures. */
export function toFixtureRunningMods(mods) {
  return mods.map(({ jar_path: _p, ...rest }) => rest);
}

export function previewModsDirLabel(dir) {
  return dir ? basename(dir) : '';
}
