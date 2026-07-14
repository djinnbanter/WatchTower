/**
 * Port of ModSideScorer.java — Layer-1 only (no Modrinth, no jar bytecode scan).
 * Scores mods for client-only likelihood using heuristics, TOML text, log warnings,
 * and dependency-graph protection (Create ecosystem + BFS depth 6).
 */

export const SERVER_REQUIRED_IDS = new Set(['create', 'flywheel', 'registrate']);

export const CREATE_ECOSYSTEM_IDS = new Set(['ponder', 'flywheel', 'registrate']);

export const HYBRID_IDS = new Set(['xaerominimap', 'xaeroworldmap', 'xaerotrainmap']);

export const LIKELY_REMOVABLE_IDS = new Set([
  'modmenu', 'appleskin',
  'lambdynlights', 'veil', 'spruceui', 'yeetusexperimentus',
  'sound_physics_remastered', 'statuemenus', 'trashslot',
]);

export const LIBRARY_IDS = new Set([
  'xaerolib', 'lambdynlights_api', 'lambdynlights_runtime', 'connectorextras',
]);

export const UNCERTAIN_IDS = new Set(['emi', 'jade', 'jei', 'rei']);

export const EXCLUDE_IDS = new Set([
  'minecraft', 'neoforge', 'forge', 'fabric_api', 'forgified_fabric_api',
  'cloth_config', 'yet_another_config_lib_v3', 'c2me_client_uncapvd',
]);

const PROTECTION_DEPTH = 6;
const TEST_REMOVE_ADVICE =
  "We're not sure — remove from server mods/ one at a time, restart, and watch for errors before deleting from the pack.";
const HYBRID_REASON =
  'Client map UI — some packs sync waypoints via an optional server component. Verify before removing.';

const BUCKET = {
  LIKELY_REMOVABLE: 'likely_removable',
  CLIENT_LIBRARY: 'client_library',
  UNCERTAIN: 'uncertain',
  TEST_REMOVE: 'test_remove',
  SERVER_REQUIRED: 'server_required',
};

const CONFIDENCE = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

/**
 * Build forward/reverse dependency maps from mods[].dependencies[{modId, mandatory}].
 * @param {object[]} mods
 */
export function buildDependencyGraph(mods) {
  /** @type {Map<string, Set<string>>} */
  const dependents = new Map();
  /** @type {Map<string, {modId:string, mandatory:boolean}[]>} */
  const dependencies = new Map();

  for (const mod of mods || []) {
    const modId = mod?.id;
    if (!modId) continue;
    const deps = Array.isArray(mod.dependencies) ? mod.dependencies : [];
    for (const dep of deps) {
      const target = dep?.modId;
      if (!target) continue;
      const mandatory = dep.mandatory !== false;
      if (!dependencies.has(modId)) dependencies.set(modId, []);
      dependencies.get(modId).push({ modId: target, mandatory });
      if (mandatory) {
        if (!dependents.has(target)) dependents.set(target, new Set());
        dependents.get(target).add(modId);
      }
    }
  }

  function dependentsOf(modId) {
    const set = dependents.get(modId);
    if (!set || !set.size) return [];
    return [...set].sort();
  }

  function dependentsCount(modId) {
    return dependents.get(modId)?.size ?? 0;
  }

  function dependenciesOf(modId) {
    const edges = dependencies.get(modId);
    if (!edges || !edges.length) return [];
    return [...edges].sort((a, b) => a.modId.localeCompare(b.modId, undefined, { sensitivity: 'base' }));
  }

  function hasServerDependents(modId, clientOnlyCandidates) {
    for (const dependent of dependentsOf(modId)) {
      if (!clientOnlyCandidates || !clientOnlyCandidates.has(dependent)) {
        return true;
      }
    }
    return false;
  }

  function expandProtected(seeds, maxDepth) {
    const protectedIds = new Set(seeds);
    const queue = [...seeds];
    const depth = new Map();
    for (const seed of seeds) depth.set(seed, 0);
    while (queue.length) {
      const current = queue.shift();
      const d = depth.get(current) ?? 0;
      if (d >= maxDepth) continue;
      for (const dependent of dependentsOf(current)) {
        if (!protectedIds.has(dependent)) {
          protectedIds.add(dependent);
          depth.set(dependent, d + 1);
          queue.push(dependent);
        }
      }
      for (const edge of dependenciesOf(current)) {
        if (!edge.mandatory) continue;
        if (!protectedIds.has(edge.modId)) {
          protectedIds.add(edge.modId);
          depth.set(edge.modId, d + 1);
          queue.push(edge.modId);
        }
      }
    }
    return protectedIds;
  }

  return {
    dependentsOf,
    dependentsCount,
    dependenciesOf,
    hasServerDependents,
    expandProtected,
  };
}

function isExcluded(id) {
  if (EXCLUDE_IDS.has(id)) return true;
  const low = id.toLowerCase();
  return low.startsWith('fabric_') && !low.includes('bridge');
}

function modPresent(mods, id) {
  return (mods || []).some((m) => m?.id === id);
}

function protectedIds(mods, graph) {
  const seeds = new Set();
  for (const mod of mods || []) {
    const id = mod?.id;
    if (!id) continue;
    if (SERVER_REQUIRED_IDS.has(id)) seeds.add(id);
  }
  if (modPresent(mods, 'create')) {
    for (const mod of mods || []) {
      const id = mod?.id;
      if (id && CREATE_ECOSYSTEM_IDS.has(id)) seeds.add(id);
    }
  }
  return graph.expandProtected(seeds, PROTECTION_DEPTH);
}

function ignoredIds(optional) {
  const ignored = new Set();
  const map = optional?.ignored_client_mods;
  if (!map || typeof map !== 'object') return ignored;
  for (const [key, val] of Object.entries(map)) {
    if (val === true) ignored.add(key);
  }
  return ignored;
}

function logWarningsByMod(optional) {
  /** @type {Map<string, number>} */
  const map = new Map();
  const rows = optional?.client_class_warnings_by_mod;
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    const modId = row?.mod_id;
    if (modId) map.set(modId, typeof row.count === 'number' ? row.count : 0);
  }
  return map;
}

function clientWarningCount(optional) {
  const rows = optional?.mod_log_errors;
  if (!Array.isArray(rows)) return 0;
  for (const row of rows) {
    if (row?.mod_id === 'client_noise') {
      return typeof row.total === 'number' ? row.total : 0;
    }
  }
  return 0;
}

function mentionsClient(text) {
  if (!text || !String(text).trim()) return false;
  const low = String(text).toLowerCase();
  return low.includes('client') || low.includes('hud') || low.includes('minimap')
    || low.includes('world map') || low.includes('worldmap') || low.includes('rendering')
    || low.includes('shader');
}

function bucketForKnown(id) {
  if (LIBRARY_IDS.has(id)) return BUCKET.CLIENT_LIBRARY;
  if (UNCERTAIN_IDS.has(id) || HYBRID_IDS.has(id) || id === 'ponder') return BUCKET.UNCERTAIN;
  return BUCKET.LIKELY_REMOVABLE;
}

function heuristicBucket(id, mod) {
  if (mod?.client_only === true) return bucketForKnown(id);
  if (LIKELY_REMOVABLE_IDS.has(id)) return BUCKET.LIKELY_REMOVABLE;
  if (LIBRARY_IDS.has(id)) return BUCKET.CLIENT_LIBRARY;
  if (UNCERTAIN_IDS.has(id) || id === 'ponder') return BUCKET.UNCERTAIN;
  const low = id.toLowerCase();
  if (low.startsWith('fabric_') || low.startsWith('connectorextras_')) {
    if (low.includes('energy_bridge')) return null;
    if (low.includes('_bridge') || low.includes('modmenu') || low.includes('jei')
      || low.includes('rei') || low.includes('emi')) {
      return BUCKET.LIKELY_REMOVABLE;
    }
    return BUCKET.CLIENT_LIBRARY;
  }
  if (low.includes('minimap') || low.includes('worldmap') || low.includes('dynlights')
    || low.includes('modmenu') || low.includes('appleskin')) {
    return BUCKET.LIKELY_REMOVABLE;
  }
  if (low.endsWith('_client') || low.includes('client_')) return BUCKET.CLIENT_LIBRARY;
  return null;
}

function removalAdviceFor(bucket) {
  switch (bucket) {
    case BUCKET.LIKELY_REMOVABLE:
      return 'Safe to remove from server mods/ on a dedicated host — keep a backup of the jar.';
    case BUCKET.CLIENT_LIBRARY:
      return 'Do not remove unless you know no other mods need it.';
    case BUCKET.UNCERTAIN:
      return 'Check mod documentation; some features may run on dedicated servers.';
    case BUCKET.TEST_REMOVE:
      return TEST_REMOVE_ADVICE;
    case BUCKET.SERVER_REQUIRED:
      return 'Do not remove — required on dedicated servers.';
    default:
      return null;
  }
}

function reasonFor(id, bucket, mod, warnCount) {
  if (bucket === BUCKET.UNCERTAIN && HYBRID_IDS.has(id)) return HYBRID_REASON;
  const desc = mod?.description;
  if (desc && String(desc).trim() && String(desc).length <= 120) return desc;
  switch (bucket) {
    case BUCKET.LIKELY_REMOVABLE:
      if (id === 'modmenu') return 'Mod list menu — client UI only';
      if (id === 'appleskin') return 'Hunger/saturation HUD — client only';
      if (id === 'lambdynlights') return 'Dynamic lights — client rendering';
      if (id === 'veil') return 'Client rendering/shaders';
      return warnCount > 0
        ? `Client classes referenced in logs (${warnCount} warnings)`
        : 'Typically client-only on a dedicated server';
    case BUCKET.CLIENT_LIBRARY:
      return 'Client-oriented library — may be required by other mods';
    case BUCKET.UNCERTAIN:
      return 'May provide server features — review before removing';
    case BUCKET.TEST_REMOVE:
      return 'Insufficient signals — test removal one mod at a time';
    case BUCKET.SERVER_REQUIRED:
      return 'Server-required gameplay or library mod';
    default:
      return null;
  }
}

/**
 * @returns {{ bucket: string|null, confidence: string, signals: string[], reason: string|null, removalAdvice: string|null }}
 */
function scoreMod(id, mod, logWarnings, _graph, scan = null) {
  const signals = [];
  let points = 0;

  if (HYBRID_IDS.has(id)) {
    signals.push('heuristic');
    return {
      bucket: BUCKET.UNCERTAIN,
      confidence: CONFIDENCE.MEDIUM,
      signals,
      reason: HYBRID_REASON,
      removalAdvice: removalAdviceFor(BUCKET.UNCERTAIN),
    };
  }

  const heuristic = heuristicBucket(id, mod);
  if (heuristic != null) {
    signals.push('heuristic');
    points += heuristic === BUCKET.LIKELY_REMOVABLE ? 3 : 2;
  }

  if (mentionsClient(mod?.display_name) || mentionsClient(mod?.description)) {
    signals.push('toml');
    points += 2;
  }
  if (String(mod?.mod_type || '').toUpperCase() === 'LIBRARY') {
    signals.push('toml');
    points += 1;
  }

  const warnCount = logWarnings.get(id) ?? 0;
  if (warnCount > 0) {
    signals.push('log_client_refs');
    points += warnCount >= 5 ? 4 : 2;
  }

  // Layer-1 port: scan is always null in DR; kept for structural parity with Java.
  if (scan && scan.totalClasses > 0) {
    signals.push('bytecode_scan');
    if (scan.clientRatio >= 0.15) points += 4;
    else if (scan.clientRatio > 0) points += 1;
  }

  let bucket = heuristic;
  if (points === 0 && bucket == null) {
    return { bucket: null, confidence: CONFIDENCE.LOW, signals, reason: null, removalAdvice: null };
  }

  if (bucket == null) {
    if (points >= 5) bucket = BUCKET.LIKELY_REMOVABLE;
    else if (points >= 3) bucket = BUCKET.UNCERTAIN;
    else bucket = BUCKET.TEST_REMOVE;
  }

  let confidence;
  if (points >= 6 && signals.length) confidence = CONFIDENCE.HIGH;
  else if (points >= 3) confidence = CONFIDENCE.MEDIUM;
  else confidence = CONFIDENCE.LOW;

  let advice;
  if (confidence === CONFIDENCE.LOW
    && heuristic !== BUCKET.UNCERTAIN
    && heuristic !== BUCKET.CLIENT_LIBRARY) {
    bucket = BUCKET.TEST_REMOVE;
    advice = TEST_REMOVE_ADVICE;
  } else {
    if (confidence === CONFIDENCE.LOW && heuristic != null) {
      bucket = heuristic;
      confidence = CONFIDENCE.MEDIUM;
    }
    advice = removalAdviceFor(bucket);
  }

  return {
    bucket,
    confidence,
    signals,
    reason: reasonFor(id, bucket, mod, warnCount),
    removalAdvice: advice,
  };
}

function writeModFields(mod, bucket, signals, dependentsCount) {
  if (bucket != null) mod.side_score = bucket;
  if (signals && signals.length) mod.side_signals = [...signals];
  mod.dependents_count = dependentsCount;
}

function toEntry(id, mod, score, graph) {
  const entry = {
    mod_id: id,
    version: mod?.version ?? '?',
    bucket: score.bucket,
    confidence: score.confidence,
    reason: score.reason,
    removal_advice: score.removalAdvice,
    signals: [...score.signals],
  };
  if (mod?.display_name && String(mod.display_name).trim()) {
    entry.display_name = mod.display_name;
  }
  const dependents = graph.dependentsOf(id);
  if (dependents.length) entry.dependents = dependents;
  return entry;
}

/**
 * Apply Layer-1 mod side scoring onto optional.mods and emit client_only_mods (+ summary).
 * Mutates `optional` in place.
 * @param {object} optional facts.optional / staging.optional
 * @returns {object|null} optional (for chaining) or null if no mods
 */
export function applyModSideScoring(optional) {
  if (!optional || !Array.isArray(optional.mods)) return null;

  const mods = optional.mods;
  const logWarnings = logWarningsByMod(optional);
  const graph = buildDependencyGraph(mods);
  const ignored = ignoredIds(optional);
  const protectedSet = protectedIds(mods, graph);

  /** @type {Map<string, ReturnType<typeof scoreMod>>} */
  const layer1Scores = new Map();
  const candidateIds = new Set();

  for (const mod of mods) {
    const id = mod?.id;
    if (!id || !String(id).trim() || isExcluded(id)) continue;
    if (protectedSet.has(id)) continue;
    const score = scoreMod(id, mod, logWarnings, graph, null);
    if (score.bucket != null) {
      candidateIds.add(id);
      layer1Scores.set(id, score);
    }
  }

  const detected = [];

  for (const mod of mods) {
    const id = mod?.id;
    if (!id || !String(id).trim() || isExcluded(id)) continue;

    if (protectedSet.has(id)) {
      const signals = [];
      if (SERVER_REQUIRED_IDS.has(id)) signals.push('SERVER_REQUIRED_IDS');
      else if (CREATE_ECOSYSTEM_IDS.has(id) && modPresent(mods, 'create')) signals.push('ecosystem:create');
      else signals.push('dependent_of:create');
      writeModFields(mod, BUCKET.SERVER_REQUIRED, signals, graph.dependentsCount(id));
      continue;
    }

    let score = scoreMod(id, mod, logWarnings, graph, null);
    if (score.bucket == null) {
      writeModFields(mod, null, [], graph.dependentsCount(id));
      continue;
    }
    if (score.bucket === BUCKET.LIKELY_REMOVABLE && graph.hasServerDependents(id, candidateIds)) {
      score = {
        ...score,
        bucket: BUCKET.UNCERTAIN,
        confidence: CONFIDENCE.MEDIUM,
        reason: 'Other mods depend on this jar — review dependents before removing.',
      };
    }

    writeModFields(mod, score.bucket, score.signals, graph.dependentsCount(id));

    if (ignored.has(id)) continue;
    if (score.bucket === BUCKET.SERVER_REQUIRED) continue;
    detected.push(toEntry(id, mod, score, graph));
  }

  if (detected.length) {
    detected.sort((a, b) => a.mod_id.localeCompare(b.mod_id));
    optional.client_only_mods = detected;
    let removable = 0;
    let testRemove = 0;
    for (const d of detected) {
      if (d.bucket === BUCKET.LIKELY_REMOVABLE) removable++;
      else if (d.bucket === BUCKET.TEST_REMOVE) testRemove++;
    }
    optional.client_only_mods_summary = {
      detected: detected.length,
      likely_removable_count: removable,
      test_remove_count: testRemove,
      client_warning_count: clientWarningCount(optional),
    };
  }

  return optional;
}
