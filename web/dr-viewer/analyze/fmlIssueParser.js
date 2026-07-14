/**
 * Port of FmlIssueParser.java — NeoForge multi-block + dependency/conflict banners (G-10 / CA-18).
 */

const ISSUE_HEADER_RE = /^--\s*Mod loading issue(?:\s+for:\s*([^-\n]+))?\s*--\s*$/i;
const MOD_ID_RE = /^\s*Mod ID:\s*(.+)\s*$/i;
const MOD_FILE_RE = /^\s*Mod File:\s*(.+)\s*$/i;
const FAILURE_RE = /^\s*Failure message:\s*(.+)\s*$/i;
const KIND_RE = /^\s*Issue kind:\s*(.+)\s*$/i;
const JAR_NAME_RE = /([\w.+-]+\.jar)/gi;

const KIND_RANK = {
  mod_load_dependency: 0,
  mod_corrupt: 1,
  mod_load_failed: 2,
  mod_load_script: 3,
};

const BANNER_KINDS = {
  missing_unsupported: {
    id: 'fml_missing_unsupported_dependencies',
    priority: 100,
    messageKey: 'fml.missing_unsupported_dependencies',
    issueKind: 'mod_load_dependency',
  },
  conflicts: {
    id: 'fml_conflicts_between_mods',
    priority: 90,
    messageKey: 'fml.conflicts_between_mods',
    issueKind: 'mod_load_dependency',
  },
  preload_incompat: {
    id: 'fml_preload_incompatible',
    priority: 85,
    messageKey: 'fml.preload_incompatible',
    issueKind: 'mod_load_dependency',
  },
  optional_unsupported: {
    id: 'fml_unsupported_optional_dependencies',
    priority: 40,
    messageKey: 'fml.unsupported_optional_dependencies',
    issueKind: 'mod_load_dependency',
  },
};

function stripJar(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  if (s.includes('/')) s = s.slice(s.lastIndexOf('/') + 1);
  if (s.includes('\\')) s = s.slice(s.lastIndexOf('\\') + 1);
  return s || null;
}

function inferKind(message, explicit) {
  if (explicit) {
    const k = explicit.trim().toLowerCase().replace(/\s+/g, '_');
    if (k.includes('depend')) return 'mod_load_dependency';
    if (k.includes('conflict') || k.includes('incompat')) return 'mod_load_dependency';
    if (k.includes('corrupt')) return 'mod_corrupt';
    if (k.includes('script')) return 'mod_load_script';
    if (k.includes('fail') || k.includes('load')) return 'mod_load_failed';
    return k;
  }
  const lower = (message || '').toLowerCase();
  if (lower.includes('missing dependency') || lower.includes('requires ')
    || lower.includes('mandatory depend') || lower.includes('conflicts between')
    || lower.includes('incompatibilit')) {
    return 'mod_load_dependency';
  }
  if (lower.includes('does not exist') || lower.includes('corrupt')) return 'mod_corrupt';
  return 'mod_load_failed';
}

function kindSortKey(kind) {
  return KIND_RANK[kind] ?? 9;
}

function detectBanner(line) {
  if (!line) return null;
  const lower = line.toLowerCase();
  if (lower.includes('missing or unsupported mandatory dependencies:')) {
    return BANNER_KINDS.missing_unsupported;
  }
  if (lower.includes('conflicts between mods:')
    || lower.includes('incompatibilities between mods:')) {
    return BANNER_KINDS.conflicts;
  }
  if (lower.includes('unsupported installed optional dependencies:')) {
    return BANNER_KINDS.optional_unsupported;
  }
  if (lower.includes('some of your mods are incompatible with the game or each other')) {
    return BANNER_KINDS.preload_incompat;
  }
  return null;
}

export function isMessageContinuation(line) {
  if (line == null || line === '') return false;
  const trimmed = line.trim();
  if (trimmed === 'More details:'
    || trimmed === 'A potential solution has been determined, this may resolve your problem:') {
    return true;
  }
  const first = line.charAt(0);
  if (first !== ' ' && first !== '\t') return false;
  if (trimmed.includes('Issues may arise. Continue at your own risk.')) return false;
  return true;
}

export function modIdsFromQuotedLabels(line) {
  const modIds = [];
  if (!line || !String(line).trim()) return modIds;
  const parts = String(line).split("'");
  for (let i = 0; i < parts.length - 1; i++) {
    const prefix = parts[i];
    if (prefix.endsWith('Mod ID: ')
      || prefix.endsWith('Requested by: ')
      || prefix.endsWith('Mod ')
      || prefix.endsWith('discourages ')) {
      const id = parts[i + 1].trim();
      if (id && id.toLowerCase() !== '[missing]') modIds.push(id);
    }
  }
  return modIds;
}

function jarNamesFromLine(line) {
  const jars = [];
  if (!line) return jars;
  JAR_NAME_RE.lastIndex = 0;
  let m;
  while ((m = JAR_NAME_RE.exec(line)) !== null) jars.push(m[1]);
  return jars;
}

/**
 * Known FML pattern hits for Issues / boot triage. Sorted by priority descending.
 */
export function parseKnownPatternHits(text) {
  if (!text || !String(text).trim()) return [];
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kind = detectBanner(line);
    if (!kind || !line.includes(']: ')) continue;
    if (i + 1 >= lines.length || !isMessageContinuation(lines[i + 1])) continue;
    const modIds = new Set();
    const jarNames = new Set();
    for (let j = i + 1; j < lines.length; j++) {
      if (!isMessageContinuation(lines[j])) break;
      for (const id of modIdsFromQuotedLabels(lines[j])) modIds.add(id);
      for (const jar of jarNamesFromLine(lines[j])) jarNames.add(jar);
    }
    const row = {
      id: kind.id,
      priority: kind.priority,
      message_key: kind.messageKey,
      mod_ids: [...modIds],
    };
    if (jarNames.size) row.jar_names = [...jarNames];
    hits.push(row);
  }
  hits.sort((a, b) => b.priority - a.priority);
  return hits;
}

function parseBanners(text, issues) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kind = detectBanner(line);
    if (!kind || !line.includes(']: ')) continue;
    if (i + 1 >= lines.length || !isMessageContinuation(lines[i + 1])) continue;
    const after = line.slice(line.indexOf(']: ') + 3).trim();
    const modIds = new Set();
    const jarNames = new Set();
    const msgParts = [after];
    for (let j = i + 1; j < lines.length; j++) {
      if (!isMessageContinuation(lines[j])) break;
      msgParts.push(lines[j].trimStart());
      for (const id of modIdsFromQuotedLabels(lines[j])) modIds.add(id);
      for (const jar of jarNamesFromLine(lines[j])) jarNames.add(jar);
    }
    const issue = {
      mod_id: modIds.size ? [...modIds][0] : 'unknown',
      kind: kind.issueKind,
      message: msgParts.join(' ').trim(),
      file: null,
      banner: true,
      priority: kind.priority,
      mod_ids: [...modIds],
      jar_names: [...jarNames],
    };
    issues.push(issue);
  }
}

/**
 * @param {string} text
 * @returns {object[]}
 */
export function parseFmlIssues(text) {
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  const issues = [];
  let current = null;

  function flush() {
    if (!current) return;
    const modId = current.mod_id || current.header_mod || 'unknown';
    const message = current.message || 'Mod loading failed';
    const kind = inferKind(message, current.kind);
    const row = {
      mod_id: modId.trim(),
      kind,
      message: message.trim(),
      file: stripJar(current.file),
    };
    if (current.mod_ids?.size) row.mod_ids = [...current.mod_ids];
    if (current.jar_names?.size) row.jar_names = [...current.jar_names];
    issues.push(row);
    current = null;
  }

  for (const line of lines) {
    const header = ISSUE_HEADER_RE.exec(line.trim());
    if (header) {
      flush();
      current = {
        header_mod: header[1] ? header[1].trim() : null,
        mod_id: null,
        file: null,
        message: null,
        kind: null,
        mod_ids: new Set(),
        jar_names: new Set(),
      };
      if (current.header_mod) current.mod_ids.add(current.header_mod);
      continue;
    }
    if (!current) continue;

    if (line.trim().startsWith('-- ') && line.trim().endsWith(' --')) {
      flush();
      continue;
    }

    const modId = MOD_ID_RE.exec(line);
    if (modId) {
      current.mod_id = modId[1].trim();
      current.mod_ids.add(current.mod_id);
      continue;
    }
    const modFile = MOD_FILE_RE.exec(line);
    if (modFile) {
      current.file = modFile[1].trim();
      for (const jar of jarNamesFromLine(current.file)) current.jar_names.add(jar);
      continue;
    }
    const failure = FAILURE_RE.exec(line);
    if (failure) {
      current.message = failure[1].trim();
      continue;
    }
    const kind = KIND_RE.exec(line);
    if (kind) {
      current.kind = kind[1].trim();
      continue;
    }
    if (line.trim() && line.trim() !== 'Details:') {
      current.message = current.message
        ? `${current.message} ${line.trim()}`
        : line.trim();
    }
  }
  flush();

  parseBanners(text, issues);

  issues.sort((a, b) => kindSortKey(a.kind) - kindSortKey(b.kind)
    || String(a.mod_id).localeCompare(String(b.mod_id)));

  return issues.map((issue, i) => {
    const row = {
      rank: issue.banner ? (issue.priority >= 80 ? 1 : 2) : i + 1,
      mod_id: issue.mod_id,
      kind: issue.kind,
      message: issue.message,
      file: issue.file,
    };
    if (issue.mod_ids?.length) row.mod_ids = issue.mod_ids;
    if (issue.jar_names?.length) row.jar_names = issue.jar_names;
    if (issue.banner) {
      row.banner = true;
      row.priority = issue.priority;
    }
    return row;
  });
}
