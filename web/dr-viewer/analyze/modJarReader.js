/**
 * Minimal mod jar metadata from neoforge.mods.toml (browser).
 */
const MOD_ID_RE = /modId\s*=\s*"([^"]+)"/;
const VERSION_RE = /version\s*=\s*"([^"]+)"/;
const DISPLAY_RE = /displayName\s*=\s*"([^"]+)"/;

/**
 * @param {ArrayBuffer} buffer
 * @param {string} jarName
 */
async function readTomlFromJar(buffer, jarName) {
  try {
    const { unzipSync } = await import('https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js');
    const bytes = new Uint8Array(buffer);
    const files = unzipSync(bytes);
    const tomlPath = Object.keys(files).find((k) => k.endsWith('META-INF/neoforge.mods.toml'));
    if (!tomlPath) return null;
    const text = new TextDecoder().decode(files[tomlPath]);
    const modId = MOD_ID_RE.exec(text)?.[1];
    if (!modId) return null;
    return {
      id: modId,
      version: VERSION_RE.exec(text)?.[1] || '?',
      display_name: DISPLAY_RE.exec(text)?.[1] || modId,
      jar_file: jarName,
    };
  } catch {
    return null;
  }
}

/**
 * @param {{ name: string, buffer: ArrayBuffer }[]} jarFiles
 */
export async function listModsFromJars(jarFiles) {
  const mods = [];
  const limit = Math.min(jarFiles.length, 80);
  for (let i = 0; i < limit; i++) {
    const entry = await readTomlFromJar(jarFiles[i].buffer, jarFiles[i].name);
    if (entry) mods.push(entry);
  }
  mods.sort((a, b) => a.id.localeCompare(b.id));
  return mods;
}

/** Infer mod id from jar filename when toml unavailable */
export function modIdFromJarName(name) {
  const base = name.replace(/\.jar$/i, '');
  const dash = base.indexOf('-');
  return (dash > 0 ? base.slice(0, dash) : base).toLowerCase();
}
