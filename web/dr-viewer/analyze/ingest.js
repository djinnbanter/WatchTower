/**
 * Normalize user file picks into a bundle for analysis.
 */

const LOG_RE = /\.log$/i;
const CRASH_RE = /crash-reports[/\\].+\.txt$/i;
const MOD_RE = /mods[/\\].+\.jar$/i;
const FACTS_RE = /watchtower[/\\]watchtower-facts-.+\.json$/i;

function normalizePath(path) {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * @typedef {{ logs: Array<{name:string,content:string}>, crashes: Array<{name:string,content:string,mtime:number}>, mods: Array<{name:string,buffer:ArrayBuffer}>, priorFacts: object|null }} FileBundle
 */

/**
 * @param {FileList|File[]} files
 * @returns {Promise<FileBundle>}
 */
export async function ingestFileList(files) {
  const bundle = { logs: [], crashes: [], mods: [], priorFacts: null };

  for (const file of files) {
    const rel = normalizePath(file.webkitRelativePath || file.name);
    if (LOG_RE.test(rel) || rel.endsWith('.log')) {
      bundle.logs.push({ name: rel, content: await file.text() });
    } else if (CRASH_RE.test(rel) || (rel.includes('crash') && rel.endsWith('.txt'))) {
      bundle.crashes.push({
        name: rel.split('/').pop(),
        content: await file.text(),
        mtime: Math.floor(file.lastModified / 1000),
      });
    } else if (MOD_RE.test(rel) || (rel.includes('mods/') && rel.endsWith('.jar'))) {
      bundle.mods.push({ name: rel.split('/').pop(), buffer: await file.arrayBuffer() });
    } else if (FACTS_RE.test(rel) || rel.includes('watchtower-facts-')) {
      try {
        bundle.priorFacts = JSON.parse(await file.text());
      } catch {
        /* skip invalid */
      }
    } else if (file.name.endsWith('.txt') && !bundle.crashes.length) {
      bundle.crashes.push({
        name: file.name,
        content: await file.text(),
        mtime: Math.floor(file.lastModified / 1000),
      });
    } else if (file.name.endsWith('.log') && !bundle.logs.length) {
      bundle.logs.push({ name: file.name, content: await file.text() });
    }
  }

  return bundle;
}

/**
 * @param {ArrayBuffer} zipBuffer
 */
export async function ingestZip(zipBuffer) {
  const { unzipSync } = await import('https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js');
  const files = unzipSync(new Uint8Array(zipBuffer));
  const bundle = { logs: [], crashes: [], mods: [], priorFacts: null };
  const now = Math.floor(Date.now() / 1000);

  for (const [path, data] of Object.entries(files)) {
    if (path.endsWith('/')) continue;
    const rel = normalizePath(path);
    const text = new TextDecoder().decode(data);

    if (LOG_RE.test(rel)) {
      bundle.logs.push({ name: rel, content: text });
    } else if (rel.includes('crash-reports/') && rel.endsWith('.txt')) {
      bundle.crashes.push({ name: rel.split('/').pop(), content: text, mtime: now });
    } else if (rel.includes('mods/') && rel.endsWith('.jar')) {
      bundle.mods.push({ name: rel.split('/').pop(), buffer: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) });
    } else if (rel.includes('watchtower-facts-') && rel.endsWith('.json')) {
      try {
        bundle.priorFacts = JSON.parse(text);
      } catch {
        /* skip */
      }
    }
  }
  return bundle;
}

/**
 * Load bundled example from examples/{id}/
 */
export async function loadExample(exampleId) {
  const base = `examples/${exampleId}`;
  const manifest = [
    `${base}/logs/latest.log`,
    `${base}/crash-reports/${exampleId === 'type2-mod-load' ? 'crash-2026-06-16_12.00.00-server.txt' : 'crash-2026-06-17_09.15.08-server.txt'}`,
  ];

  const bundle = { logs: [], crashes: [], mods: [], priorFacts: null };
  const mtime = Math.floor(Date.now() / 1000);

  for (const url of manifest) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    const content = await res.text();
    if (url.includes('/logs/')) {
      bundle.logs.push({ name: url.split('/').slice(-2).join('/'), content });
    } else {
      bundle.crashes.push({ name: url.split('/').pop(), content, mtime });
    }
  }
  return bundle;
}

export function validateBundle(bundle) {
  const warnings = [];
  if (!bundle.logs.length) warnings.push('No log files found — add logs/latest.log for best results.');
  if (!bundle.crashes.length) warnings.push('No crash reports found — diagnosis will rely on logs only.');
  return warnings;
}

/**
 * Validate and parse uploaded facts JSON (CLI or live report export).
 * @param {string} text
 * @returns {object}
 */
export function parseFactsJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Facts JSON must be an object');
  }
  if (!data.meta || typeof data.meta !== 'object' || Array.isArray(data.meta)) {
    throw new Error('Missing meta object — is this a Watchtower facts file?');
  }
  if (!data.health || typeof data.health !== 'object' || Array.isArray(data.health)) {
    throw new Error('Missing health object — is this a Watchtower facts file?');
  }
  return data;
}

/**
 * @param {File} file
 * @returns {Promise<object>}
 */
export async function ingestFactsFile(file) {
  return parseFactsJson(await file.text());
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function ingestBriefFile(file) {
  return file.text();
}

/**
 * If bundle contains a standalone facts JSON, return it for direct viewing.
 * @param {FileBundle} bundle
 * @returns {object|null}
 */
export function extractPrimaryFacts(bundle) {
  if (!bundle.priorFacts) return null;
  try {
    return parseFactsJson(JSON.stringify(bundle.priorFacts));
  } catch {
    return null;
  }
}
