/**
 * Watchtower DR — main app shell (1.0.0)
 */
import { writeBrief } from './analyze/briefWriter.js';
import { ingestDrBundle, loadFflate, decompressLogEntry } from './analyze/bundleIngest.js';
import {
  extractPrimaryFacts,
  ingestFactsFile,
  ingestBriefFile,
  ingestFileList,
  ingestZip,
  loadExample,
} from './analyze/ingest.js';
import { runAnalysis } from './analyze/run.js';

const IDB_NAME = 'watchtower-dr';
const IDB_STORE = 'last-run';
const THEMES = ['black', 'dark', 'light'];
const CLI_CMD = `# go to your server mods folder
cd /path/to/your/server/mods

# build the recovery zip (one file)
java -jar watchtower-cli-1.0.0.jar dr`;

const CLI_CMD_TMP = `# panel blocks writes? use host /tmp instead
cd /path/to/your/server/mods
java -jar watchtower-cli-1.0.0.jar dr --out /tmp`;

let pendingBundle = null;
let pendingBriefText = null;

const els = {
  ingest: document.getElementById('view-ingest'),
  loading: document.getElementById('view-loading'),
  results: document.getElementById('view-results'),
  status: document.getElementById('ingest-status'),
  btnAnalyze: document.getElementById('btn-analyze'),
  dropzone: document.getElementById('dropzone'),
  dropzoneMain: document.getElementById('dropzone-main'),
  inputFolder: document.getElementById('input-folder'),
  inputZip: document.getElementById('input-zip'),
  inputExample: document.getElementById('input-example'),
  inputLoader: document.getElementById('input-loader'),
  inputDrBundle: document.getElementById('input-dr-bundle'),
  inputFactsJson: document.getElementById('input-facts-json'),
  inputFactsBrief: document.getElementById('input-facts-brief'),
  btnNew: document.getElementById('btn-new-analysis'),
  btnCopyCli: document.getElementById('btn-copy-cli'),
  btnCopyCliTmp: document.getElementById('btn-copy-cli-tmp'),
  themeToggle: document.getElementById('theme-toggle'),
  loadingTitle: document.getElementById('loading-title'),
  loadingMessage: document.getElementById('loading-message'),
  loadingDetail: document.getElementById('loading-detail'),
};

function setLoadingScreen(title, message, detail = '') {
  showView('loading');
  if (els.loadingTitle) els.loadingTitle.textContent = title || 'Working on your bundle…';
  if (els.loadingMessage) els.loadingMessage.textContent = message || 'Please wait…';
  if (els.loadingDetail) {
    els.loadingDetail.textContent = detail || '';
    els.loadingDetail.classList.toggle('hidden', !detail);
  }
}

export const DrApp = {
  showToast(msg, kind = 'info') {
    const toast = globalThis.WatchtowerToast;
    if (toast?.show) {
      toast.show({ message: msg, kind });
      return;
    }
    console.info('[DR]', msg);
  },
};

window.DrApp = DrApp;
window.WatchtowerDrIngest = { loadFflate, decompressLogEntry };

function setStatus(msg, isError = false) {
  if (!els.status) return;
  els.status.textContent = msg;
  els.status.classList.toggle('error', isError);
}

function showView(name) {
  els.ingest?.classList.toggle('view-hidden', name !== 'ingest');
  els.loading?.classList.toggle('view-hidden', name !== 'loading');
  els.results?.classList.toggle('view-hidden', name !== 'results');
  refreshIcons();
}

function refreshIcons() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

function summarizeBundle(bundle) {
  const parts = [];
  if (bundle.logs.length) parts.push(`${bundle.logs.length} log(s)`);
  if (bundle.crashes.length) parts.push(`${bundle.crashes.length} crash report(s)`);
  if (bundle.mods.length) parts.push(`${bundle.mods.length} mod jar(s)`);
  if (bundle.priorFacts) parts.push('prior facts');
  return parts.join(', ') || 'no recognized files';
}

async function setBundle(bundle) {
  pendingBundle = bundle;
  const primaryFacts = bundle ? extractPrimaryFacts(bundle) : null;
  if (primaryFacts) {
    await loadFromFactsObject(primaryFacts, pendingBriefText || writeBrief(primaryFacts), 'local');
    pendingBriefText = null;
    return;
  }
  const ok = bundle && (bundle.logs.length || bundle.crashes.length);
  if (els.btnAnalyze) els.btnAnalyze.disabled = !ok;
  if (!ok && bundle) {
    setStatus('No logs or crash reports found — include at least latest.log or crash-reports/*.txt', true);
    return;
  }
  setStatus(bundle
    ? `Ready: ${summarizeBundle(bundle)}. Click Analyze files.`
    : 'Select files or load an example in Other options.');
}

async function showResults(facts, brief, warnings, options = {}) {
  const opts = typeof options === 'string' ? { ingestSource: options } : options;
  await saveLastRun(facts, brief);
  showView('results');
  DrDashboard.init(facts, brief, warnings, opts);
  DrDashboard.setTab('fix');
  const sessions = opts.correlation?.length || facts?.optional?.dr_log_correlation?.length || 0;
  const anchorOk = facts?.meta?.dr_bundle?.anchor_status === 'found';
  if (sessions > 0) {
    DrApp.showToast(anchorOk
      ? `${sessions} restart attempt(s) since last good boot`
      : `${sessions} attempt(s) — no successful start found in logs`);
  } else {
    DrApp.showToast('Report loaded');
  }
}

async function loadFromFactsObject(facts, brief, source) {
  const ingestSource = source || (facts.meta?.report_mode === 'dr' ? 'cli' : 'local');
  await showResults(facts, brief, [], { ingestSource });
}

async function loadDrBundle(file) {
  setLoadingScreen('Opening DR bundle…', 'Unpacking zip archive…');
  try {
    const result = await ingestDrBundle(await file.arrayBuffer(), ({ title, detail }) => {
      setLoadingScreen('Opening DR bundle…', title || 'Please wait…', detail || '');
    });
    const brief = result.brief || writeBrief(result.facts);
    await showResults(result.facts, brief, result.warnings || [], {
      ingestSource: 'cli',
      bundleLogs: result.bundleLogs,
      manifest: result.manifest,
      correlation: result.correlation,
      gunzipSync: result.gunzipSync,
    });
    if (result.warnings?.length) {
      DrApp.showToast(result.warnings[0]);
    }
  } catch (e) {
    console.error(e);
    showView('ingest');
    setStatus(`Failed to load bundle: ${e.message}`, true);
  }
}

async function loadFactsJson(file) {
  setLoadingScreen('Loading report…', 'Reading facts JSON…');
  try {
    const facts = await ingestFactsFile(file);
    const brief = pendingBriefText || writeBrief(facts);
    pendingBriefText = null;
    await loadFromFactsObject(facts, brief);
  } catch (e) {
    console.error(e);
    showView('ingest');
    setStatus(`Failed to load facts: ${e.message}`, true);
  }
}

async function handleUploadFile(file) {
  if (!file) return;
  const name = file.name.toLowerCase();
  if (name.endsWith('.zip')) {
    await loadDrBundle(file);
    return;
  }
  if (name.endsWith('.json')) {
    await loadFactsJson(file);
  }
}

async function handleFiles(fileList) {
  try {
    await setBundle(await ingestFileList(fileList));
  } catch (e) {
    setStatus(`Ingest failed: ${e.message}`, true);
  }
}

async function handleZip(file) {
  setLoadingScreen('Opening zip…', 'Checking for a Watchtower DR bundle…');
  try {
    const result = await ingestDrBundle(await file.arrayBuffer(), ({ title, detail }) => {
      setLoadingScreen('Opening DR bundle…', title || 'Please wait…', detail || '');
    });
    const brief = result.brief || writeBrief(result.facts);
    await showResults(result.facts, brief, result.warnings || [], {
      ingestSource: 'cli',
      bundleLogs: result.bundleLogs,
      manifest: result.manifest,
      correlation: result.correlation,
      gunzipSync: result.gunzipSync,
    });
  } catch {
    showView('ingest');
    try {
      await setBundle(await ingestZip(await file.arrayBuffer()));
    } catch (e) {
      setStatus(`Zip failed: ${e.message}`, true);
    }
  }
}

async function runLocalAnalysis() {
  if (!pendingBundle) return;
  setLoadingScreen('Analyzing logs…', 'Scanning crash reports and latest.log…');
  try {
    const { facts, brief, warnings } = await runAnalysis(pendingBundle, {
      loader: els.inputLoader?.value || 'neoforge',
    });
    await showResults(facts, brief, warnings, { ingestSource: 'local' });
  } catch (e) {
    console.error(e);
    showView('ingest');
    setStatus(`Analysis failed: ${e.message}`, true);
  }
}

function cycleTheme() {
  const html = document.documentElement;
  const idx = THEMES.indexOf(html.dataset.theme || 'black');
  const next = THEMES[(idx + 1) % THEMES.length];
  html.dataset.theme = next;
  localStorage.setItem('watchtower-dr-theme', next);
  const icon = document.getElementById('theme-icon');
  if (icon && window.lucide) {
    const icons = { black: 'circle-dot', dark: 'moon', light: 'sun' };
    icon.setAttribute('data-lucide', icons[next] || 'circle-dot');
  }
  refreshIcons();
}

function saveLastRun(facts, brief) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => {
        const tx = req.result.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put({ facts, brief, at: Date.now() }, 'latest');
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function loadLastRun() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) { resolve(null); return; }
        const get = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get('latest');
        get.onsuccess = () => resolve(get.result || null);
        get.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

els.inputDrBundle?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) handleUploadFile(file);
  e.target.value = '';
});

els.inputFactsJson?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) loadFactsJson(file);
  e.target.value = '';
});

els.inputFactsBrief?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (f) {
    pendingBriefText = await ingestBriefFile(f);
    setStatus(`Brief selected: ${f.name}. Now upload facts JSON or DR bundle.`);
  } else {
    pendingBriefText = null;
  }
  e.target.value = '';
});

els.btnCopyCli?.addEventListener('click', () => {
  navigator.clipboard.writeText(CLI_CMD).then(() => {
    DrApp.showToast('Commands copied — paste into your SSH terminal');
  }).catch(() => DrApp.showToast('Copy failed — select and copy manually'));
});

els.btnCopyCliTmp?.addEventListener('click', () => {
  navigator.clipboard.writeText(CLI_CMD_TMP).then(() => {
    DrApp.showToast('Copied with --out /tmp (host temp folder)');
  }).catch(() => DrApp.showToast('Copy failed — select and copy manually'));
});

els.inputFolder?.addEventListener('change', (e) => {
  if (e.target.files?.length) handleFiles(e.target.files);
});

els.inputZip?.addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if (f) handleZip(f);
});

els.inputExample?.addEventListener('change', async (e) => {
  const id = e.target.value;
  if (!id) return;
  setStatus(`Loading example ${id}…`);
  try {
    await setBundle(await loadExample(id));
  } catch (err) {
    setStatus(`Example load failed — run via local HTTP (npm run serve): ${err.message}`, true);
  }
  e.target.value = '';
});

els.btnAnalyze?.addEventListener('click', runLocalAnalysis);

els.btnNew?.addEventListener('click', () => {
  pendingBundle = null;
  pendingBriefText = null;
  if (els.btnAnalyze) els.btnAnalyze.disabled = true;
  showView('ingest');
  setStatus('Upload watchtower-dr-bundle-*.zip from step 1.');
});

els.themeToggle?.addEventListener('click', cycleTheme);

document.querySelectorAll('#tab-nav .wt-rail__link[data-tab]').forEach((tab) => {
  tab.addEventListener('click', (e) => {
    e.preventDefault();
    DrDashboard.setTab(tab.dataset.tab);
  });
});

function bindDropzone(el) {
  el?.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.add('dragover');
  });
  el?.addEventListener('dragleave', () => el.classList.remove('dragover'));
  el?.addEventListener('drop', async (e) => {
    e.preventDefault();
    el.classList.remove('dragover');
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length === 1) await handleUploadFile(files[0]);
    else if (files.length) await handleFiles(files);
  });
}

bindDropzone(els.dropzoneMain);
bindDropzone(els.dropzone);

document.addEventListener('dragover', (e) => {
  if (els.results && !els.results.classList.contains('view-hidden')) return;
  e.preventDefault();
});

const savedTheme = localStorage.getItem('watchtower-dr-theme');
if (savedTheme && THEMES.includes(savedTheme)) {
  document.documentElement.dataset.theme = savedTheme;
}

document.addEventListener('DOMContentLoaded', refreshIcons);

loadLastRun().then(async (saved) => {
  try {
    if (saved?.facts) {
      await showResults(saved.facts, saved.brief || writeBrief(saved.facts), [], { ingestSource: 'local' });
    } else {
      showView('ingest');
    }
  } catch (e) {
    console.error(e);
    showView('ingest');
    setStatus('Could not restore last session — upload a DR bundle.', true);
  }
});
