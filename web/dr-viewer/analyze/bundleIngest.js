/**
 * Ingest Watchtower DR bundle zip (manifest + facts + brief + logs).
 */
import { parseFactsJson } from './ingest.js';

const MANIFEST_NAMES = ['manifest.json', './manifest.json'];

function normalizePath(path) {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

function decodeEntry(data) {
  return new TextDecoder().decode(data);
}

function findEntry(files, suffix) {
  for (const [path, data] of Object.entries(files)) {
    if (path.endsWith('/')) continue;
    const rel = normalizePath(path);
    if (rel === suffix || rel.endsWith('/' + suffix)) return { path: rel, data };
  }
  return null;
}

function yieldUi() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

async function loadFflate() {
  try {
    return await import('fflate');
  } catch {
    return import('https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js');
  }
}

function collectByPrefix(files, prefix) {
  const out = [];
  for (const [path, data] of Object.entries(files)) {
    if (path.endsWith('/')) continue;
    const rel = normalizePath(path);
    if (!rel.startsWith(prefix)) continue;
    const name = rel.split('/').pop();
    const isGzip = name.endsWith('.gz');
    if (isGzip) {
      out.push({ name: rel, content: '', compressed: true, raw: data });
    } else if (name.endsWith('.log') || name.endsWith('.txt')) {
      out.push({ name: rel, content: decodeEntry(data), compressed: false, raw: data });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function decompressLogEntry(entry, gunzipSync) {
  if (!entry) return '';
  if (entry._decompressed) return entry.content || '';
  entry._decompressed = true;
  if (!entry.compressed || !entry.raw || !gunzipSync) {
    return entry.content || '';
  }
  try {
    entry.content = new TextDecoder().decode(gunzipSync(entry.raw));
  } catch {
    entry.content = '(Could not decompress this log file.)';
  }
  return entry.content;
}

function allLogEntries(bundleLogs) {
  return [
    ...(bundleLogs.regular || []),
    ...(bundleLogs.debug || []),
    ...(bundleLogs.crashes || []),
  ];
}

async function decompressBundleLogs(bundleLogs, gunzipSync, onProgress) {
  const pending = allLogEntries(bundleLogs).filter((f) => f.compressed && !f.content);
  if (!pending.length) return;
  for (let i = 0; i < pending.length; i += 1) {
    const entry = pending[i];
    onProgress?.({
      phase: 'decompress',
      index: i + 1,
      total: pending.length,
      file: entry.name.split('/').pop(),
    });
    decompressLogEntry(entry, gunzipSync);
    if (i % 2 === 1) await yieldUi();
  }
}

/**
 * @param {ArrayBuffer} zipBuffer
 * @param {(update: { title?: string, detail?: string } | string) => void} [onProgress]
 */
export async function ingestDrBundle(zipBuffer, onProgress) {
  const report = (title, detail) => {
    if (typeof onProgress === 'function') {
      if (typeof title === 'string') onProgress({ title, detail });
      else onProgress(title);
    }
  };

  report('Unpacking zip archive…', 'Reading files from the DR bundle');
  await yieldUi();

  const { unzipSync, gunzipSync } = await loadFflate();
  const files = unzipSync(new Uint8Array(zipBuffer));

  report('Reading manifest and report…');
  await yieldUi();

  let manifestText = null;
  for (const key of MANIFEST_NAMES) {
    if (files[key]) {
      manifestText = decodeEntry(files[key]);
      break;
    }
  }
  if (!manifestText) {
    const entry = findEntry(files, 'manifest.json');
    if (entry) manifestText = decodeEntry(entry.data);
  }
  if (!manifestText) {
    throw new Error('Not a Watchtower DR bundle — missing manifest.json');
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (e) {
    throw new Error(`Invalid manifest.json: ${e.message}`);
  }
  if (!manifest.bundle_version && !manifest.facts) {
    throw new Error('Unrecognized DR bundle manifest');
  }

  const factsName = manifest.facts || findFactsName(files);
  if (!factsName) throw new Error('DR bundle missing facts JSON');
  const factsEntry = findEntry(files, factsName.split('/').pop()) || findEntry(files, factsName);
  if (!factsEntry) throw new Error(`Facts file not found in bundle: ${factsName}`);
  const facts = parseFactsJson(decodeEntry(factsEntry.data));

  let brief = '';
  const briefName = manifest.brief;
  if (briefName) {
    const briefEntry = findEntry(files, briefName.split('/').pop()) || findEntry(files, briefName);
    if (briefEntry) brief = decodeEntry(briefEntry.data);
  }

  const bundleLogs = {
    regular: collectByPrefix(files, 'logs/regular/'),
    debug: collectByPrefix(files, 'logs/debug/'),
    crashes: collectByPrefix(files, 'crash-reports/'),
  };

  const gzipPending = allLogEntries(bundleLogs).filter((f) => f.compressed && !f.content).length;
  if (gzipPending > 0) {
    await decompressBundleLogs(bundleLogs, gunzipSync, ({ index, total, file }) => {
      report(`Decompressing logs (${index}/${total})…`, file);
    });
  } else {
    report('Preparing log files…');
    await yieldUi();
  }

  const warnings = [];
  if (!bundleLogs.regular.length && !bundleLogs.debug.length && !bundleLogs.crashes.length) {
    warnings.push('Bundle contains no log files under logs/ or crash-reports/.');
  }

  const correlation = manifest.sessions
    || facts.optional?.dr_log_correlation
    || [];

  if (Array.isArray(correlation)) {
    const logsOnly = correlation.filter((s) => s.correlation_status === 'logs_only').length;
    if (logsOnly > 0) {
      warnings.push(`${logsOnly} restart attempt(s) show a startup failure but no crash report was saved.`);
    }
  }

  report('Building analysis…');
  await yieldUi();

  return { facts, brief, bundleLogs, manifest, warnings, correlation, gunzipSync };
}

function findFactsName(files) {
  for (const path of Object.keys(files)) {
    const rel = normalizePath(path);
    if (rel.includes('watchtower-facts-') && rel.endsWith('.json')) return rel;
  }
  return null;
}

export function isDrBundleZip(fileList) {
  return fileList?.length === 1 && fileList[0].name?.toLowerCase().endsWith('.zip');
}

export { loadFflate, yieldUi };
