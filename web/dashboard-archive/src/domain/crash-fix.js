/**
 * Resolution-first crash fix plans — plain labels, Modrinth CTAs, numbered steps.
 */

const KNOWN_MODRINTH_SLUGS = {
  create: 'create',
  flywheel: 'flywheel',
  chunky: 'chunky',
  squaremap: 'squaremap',
  bluemap: 'bluemap',
  spark: 'spark',
  jei: 'jei',
  mekanism: 'mekanism',
  kubejs: 'kubejs',
  ae2: 'ae2',
  appliedenergistics2: 'ae2',
};

/**
 * Operator-facing title for a failure kind (not raw snake_case alone).
 */
export function humanFailureLabel(failure_kind, stall_mod_id, primary_mod_id, create_issue) {
  const kind = String(failure_kind || '').toLowerCase();
  const stall = stall_mod_id && String(stall_mod_id).trim() ? String(stall_mod_id).trim() : null;
  const primary = primary_mod_id && String(primary_mod_id).trim() ? String(primary_mod_id).trim() : null;
  const createIssue = create_issue && String(create_issue).trim() ? String(create_issue).trim() : null;

  if (kind === 'watchdog_pregen') {
    return stall
      ? `Server tick hang — map/pregen (${stall})`
      : 'Hang during world gen / map render';
  }
  if (kind === 'watchdog' || kind === 'watchdog_followup') {
    return 'Server tick hang';
  }
  if (kind === 'mod_runtime') {
    if (primary === 'create' && createIssue === 'contraption_collision') {
      return 'Create contraption collision';
    }
    if (primary === 'create') return 'Create crashed while ticking';
    return primary ? `Mod crash (${primary})` : 'Mod crash';
  }
  if (kind === 'mod_load_mixin') {
    return primary ? `Mixin failed to load (${primary})` : 'Mixin config failed to load';
  }
  if (kind === 'mod_load_mixin_conflict') {
    return primary ? `Mixin conflict (${primary})` : 'Mixin conflict between mods';
  }
  if (kind === 'mod_load_duplicate') return 'Duplicate mods installed';
  if (kind === 'mod_load_config') {
    return primary ? `Corrupt SERVER config (${primary})` : 'Corrupt SERVER config';
  }
  if (kind === 'mod_load_asset') {
    return primary ? `Invalid resource location (${primary})` : 'Invalid resource location';
  }
  if (kind === 'mod_load_dependency') {
    return primary ? `Missing dependency (${primary})` : 'Missing or mismatched dependency';
  }
  if (kind === 'mod_load_worldgen') return 'Worldgen feature order cycle';
  if (kind === 'mod_load_compat') {
    return primary ? `Mod compatibility (${primary})` : 'Mod compatibility issue';
  }
  if (kind === 'mod_load_ecosystem') {
    return primary ? `Ecosystem mismatch (${primary})` : 'Mod ecosystem version mismatch';
  }
  if (kind === 'mod_load_script') {
    return primary ? `Script/datapack parse (${primary})` : 'Script or datapack parse failure';
  }
  if (kind === 'platform_mismatch') return 'Java / class version mismatch';
  if (kind === 'env_lock') return 'File locked by another process';
  if (kind === 'mod_load' || kind === 'loader') {
    return primary ? `Mod failed to load (${primary})` : 'Mod failed to load';
  }
  if (kind === 'world_nbt_corrupt') return 'Corrupt world data';
  if (kind === 'host_resource' || kind.startsWith('host')) return 'Host / memory';
  if (kind) return kind.replace(/_/g, ' ');
  return 'Crash';
}

/**
 * Prefer known Modrinth project URL; else search by mod id.
 * Prefers compatible-update / version deep-links when present on the mod row.
 * @param {string} modId
 * @param {object[]} [modsOptional] facts.optional.mods
 * @param {{ preferUpdate?: boolean }} [opts]
 */
export function modrinthUrlForMod(modId, modsOptional, opts = {}) {
  if (!modId) return null;
  const id = String(modId).trim();
  if (!id) return null;

  const mods = Array.isArray(modsOptional) ? modsOptional : [];
  const match = mods.find((m) => (m?.id ?? m?.mod_id) === id);
  const preferUpdate = !!opts.preferUpdate;

  if (match) {
    if (preferUpdate || match.modrinth_outdated) {
      if (match.modrinth_compatible_url) return match.modrinth_compatible_url;
      if (match.modrinth_cta_url) return match.modrinth_cta_url;
    }
    if (match.modrinth_cta_url) return match.modrinth_cta_url;
    if (match.modrinth_compatible_url) return match.modrinth_compatible_url;
    if (match.modrinth_version_url) return match.modrinth_version_url;
    if (match.modrinth_url) return match.modrinth_url;
    if (match.modrinth_project_url) return match.modrinth_project_url;
    if (typeof match.project_url === 'string' && match.project_url.includes('modrinth.com')) {
      return match.project_url;
    }
    const slug = match.modrinth_slug || match.slug || KNOWN_MODRINTH_SLUGS[id.toLowerCase()];
    if (slug) return `https://modrinth.com/mod/${encodeURIComponent(slug)}`;
  }

  const slug = KNOWN_MODRINTH_SLUGS[id.toLowerCase()];
  if (slug) return `https://modrinth.com/mod/${encodeURIComponent(slug)}`;

  return `https://modrinth.com/mods?q=${encodeURIComponent(id)}`;
}

function actionVerb(action) {
  const a = String(action || '').toLowerCase();
  if (a === 'install' || a === 'download') return 'Install';
  if (a === 'remove') return 'Remove';
  if (a === 'pair_update') return 'Update';
  if (a === 'pause' || a === 'defer') return 'Pause';
  if (a === 'restore') return 'Restore';
  if (a === 'update' || a === 'upgrade') return 'Update';
  return 'Check';
}

function displayModName(modId) {
  if (!modId) return 'mod';
  if (modId === 'create') return 'Create';
  if (modId === 'flywheel') return 'Flywheel';
  if (modId === 'chunky') return 'Chunky';
  if (modId === 'squaremap') return 'squaremap';
  return modId;
}

function normalizeStep(text) {
  if (!text) return null;
  let s = String(text).trim();
  if (!s) return null;
  // Prefer imperative: drop trailing period noise for dedupe key
  if (s.endsWith('.')) s = s.slice(0, -1);
  return s;
}

function stepKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isVague(s) {
  const k = stepKey(s);
  return (
    k.startsWith('check for heavy') ||
    k.includes('usually lag') ||
    k === 'check latest log' ||
    k.includes('look for chunk loaders')
  );
}

function pushUnique(steps, text, { preferImperative = false } = {}) {
  const n = normalizeStep(text);
  if (!n) return;
  const key = stepKey(n);
  const idx = steps.findIndex((s) => stepKey(s) === key || stepKey(s).includes(key) || key.includes(stepKey(s)));
  if (idx >= 0) {
    if (preferImperative && isVague(steps[idx]) && !isVague(n)) {
      steps[idx] = n;
    }
    return;
  }
  steps.push(n);
}

/**
 * Build a resolution-first fix plan from a crash summary (or group lead member).
 * @returns {{
 *   headline: string,
 *   steps: string[],
 *   modId: string|null,
 *   modrinthUrl: string|null,
 *   modrinthLabel: string|null,
 *   modsTabParams: object|null,
 *   relatedMods: { id: string, url: string }[],
 *   primaryActionPeek: string|null,
 *   confidenceLabel: string|null,
 * }}
 */
export function buildFixPlan(summary, modsOptional) {
  const s = summary && typeof summary === 'object' ? summary : {};
  const failureKind = s.failure_kind || s.category || '';
  const stall = s.stall_mod_id || null;
  const primary = s.primary_mod_id || s.suspect_mod_id || null;
  const modFix = s.mod_fix && typeof s.mod_fix === 'object' ? s.mod_fix : null;
  const modId =
    modFix?.mod_id ||
    (failureKind === 'watchdog_pregen' ? stall || primary : primary || stall) ||
    null;

  const steps = [];

  if (modFix?.action_detail) pushUnique(steps, modFix.action_detail, { preferImperative: true });
  if (modFix?.fix) pushUnique(steps, modFix.fix, { preferImperative: true });
  if (modFix?.install_hint) pushUnique(steps, modFix.install_hint);

  const hints = Array.isArray(s.fix_hints) ? s.fix_hints : [];
  for (const h of hints) {
    pushUnique(steps, h, { preferImperative: true });
  }

  if (!steps.length && s.likely_cause) {
    pushUnique(steps, s.likely_cause);
  }

  // Cap at 5; ensure a closing review step when space remains
  let capped = steps.slice(0, 5);
  const hasReview = capped.some((x) => /mark reviewed|acknowledge/i.test(x));
  if (!hasReview && capped.length < 5) {
    capped.push('Mark reviewed when the crash is fixed or confirmed historical');
  } else if (!hasReview && capped.length === 5) {
    capped[4] = 'Mark reviewed when the crash is fixed or confirmed historical';
  }

  const verb = actionVerb(modFix?.action);
  const modName = displayModName(modId);

  let headline = s.plain_english || null;
  if (!headline || headline.length > 140) {
    if (failureKind === 'watchdog_pregen' || (failureKind === 'watchdog' && stall)) {
      headline = `Pause pregen / defer ${stall || 'map render'}, then restart and watch for repeats`;
    } else if (failureKind === 'watchdog' || failureKind === 'watchdog_followup') {
      headline = 'Read the watchdog thread dump, then pause pregen only if it appears there';
    } else if (s.create_issue === 'contraption_collision' || (modId === 'create' && /contraption/i.test(String(s.plain_english || '')))) {
      headline = 'Stop the stuck Create assembly so the world can load, then update Create if needed';
    } else if (failureKind === 'mod_runtime' && modId === 'create') {
      headline = 'Inspect the Create stack and update Create or matching addons if versions look wrong';
    } else if (modFix?.action === 'update' || modFix?.action === 'pair_update') {
      headline = `Update ${modName}, then restart and watch for repeats`;
    } else if (modFix?.action === 'install') {
      headline = `Install the missing dependency for ${modName}, then restart`;
    } else if (modFix?.action === 'remove') {
      headline = `Remove or replace ${modName}, then restart and confirm the crash is gone`;
    } else if (failureKind === 'world_nbt_corrupt') {
      headline = 'Back up the world, then restore the affected region';
    } else if (failureKind === 'mod_load_mixin' || failureKind === 'mod_load_mixin_conflict') {
      headline = modId
        ? `Update or temporarily remove ${modName}, then restart`
        : 'Resolve the mixin conflict, then restart';
    } else if (failureKind === 'mod_load_duplicate') {
      headline = 'Remove the duplicate jar from mods/, then restart';
    } else if (failureKind === 'mod_load_config') {
      headline = modId
        ? `Fix or delete the SERVER config for ${modName}, then restart`
        : 'Fix or delete the corrupt SERVER config, then restart';
    } else if (failureKind === 'mod_load_asset') {
      headline = 'Fix the invalid resource location in the datapack/mod, then restart';
    } else if (failureKind === 'mod_load_dependency') {
      headline = modId
        ? `Install or update the missing dependency for ${modName}, then restart`
        : 'Install or update the missing dependency / language provider, then restart';
    } else if (failureKind === 'mod_load_worldgen') {
      headline = 'Remove the last-added biome/terrain mod, then restart';
    } else if (failureKind === 'mod_load_compat') {
      headline = modId
        ? `Adjust ${modName} compat settings (or update), then restart`
        : 'Adjust FerriteCore / compat settings, then restart';
    } else if (failureKind === 'mod_load_script') {
      headline = 'Fix or remove the broken KubeJS/datapack script, then restart';
    } else if (failureKind === 'mod_load_ecosystem') {
      headline = 'Align Create / Railways (or related) versions, then restart';
    } else if (failureKind === 'platform_mismatch') {
      headline = 'Upgrade the JVM to match the class file (often Java 21), then restart';
    } else if (failureKind === 'env_lock') {
      headline = 'Close other Minecraft/Java processes locking the file, then restart';
    } else if (failureKind === 'host_resource') {
      headline = 'Review heap/native memory and host resources around the crash time';
    } else if (failureKind === 'mod_runtime' && modId) {
      headline = `Update or temporarily remove ${modName}, then restart and watch for repeats`;
    } else {
      headline = humanFailureLabel(failureKind, stall, primary, s.create_issue);
    }
  }
  // One sentence
  headline = String(headline).split(/(?<=[.!?])\s+/)[0].trim();
  if (headline.length > 160) headline = `${headline.slice(0, 157)}…`;

  const preferUpdate = modFix?.action === 'update' || modFix?.action === 'pair_update'
    || modFix?.action === 'install' || modFix?.action === 'download'
    || !!modFix?.modrinth_outdated;
  // Prefer URLs attached on mod_fix from the report, then mods[]
  let modrinthUrl = modFix?.modrinth_compatible_url
    || (preferUpdate ? modFix?.modrinth_cta_url : null)
    || modFix?.modrinth_cta_url
    || modFix?.modrinth_version_url
    || modFix?.modrinth_url
    || (modId ? modrinthUrlForMod(modId, modsOptional, { preferUpdate }) : null);

  const modRow = Array.isArray(modsOptional)
    ? modsOptional.find((m) => (m?.id ?? m?.mod_id) === modId)
    : null;
  const compatVer = modFix?.modrinth_compatible_version_number
    || modRow?.modrinth_compatible_version_number;
  const outdated = !!(modFix?.modrinth_outdated || modRow?.modrinth_outdated);

  let modrinthLabel = null;
  if (modId && modrinthUrl) {
    if (modFix?.action === 'install' || modFix?.action === 'download') {
      modrinthLabel = `Download ${modName} on Modrinth`;
    } else if (modFix?.action === 'remove') {
      modrinthLabel = `Find ${modName} on Modrinth`;
    } else if ((verb === 'Update' || modFix?.action === 'pair_update' || outdated) && compatVer) {
      modrinthLabel = `Update ${modName} to ${compatVer} on Modrinth`;
    } else if (verb === 'Update' || modFix?.action === 'pair_update' || outdated) {
      modrinthLabel = `Update ${modName} on Modrinth`;
    } else {
      modrinthLabel = `Open ${modName} on Modrinth`;
    }
  }

  const relatedMods = [];
  const related = Array.isArray(modFix?.related_mods) ? modFix.related_mods : [];
  for (const r of related) {
    const rid = typeof r === 'string' ? r : r?.id || r?.mod_id;
    if (!rid) continue;
    const fromRel = typeof r === 'object' && r
      ? (r.modrinth_compatible_url || r.modrinth_cta_url || r.modrinth_url)
      : null;
    relatedMods.push({
      id: rid,
      url: fromRel || modrinthUrlForMod(rid, modsOptional, { preferUpdate: true }),
    });
  }
  // pair_update: ensure flywheel/create partner chip when missing
  if (modFix?.action === 'pair_update' && modId === 'create'
      && !relatedMods.some((m) => m.id === 'flywheel')) {
    relatedMods.push({ id: 'flywheel', url: modrinthUrlForMod('flywheel', modsOptional, { preferUpdate: true }) });
  }

  const primaryActionPeek = capped[0]
    ? capped[0].replace(/^Update\b/i, 'Update').slice(0, 48)
    : modrinthLabel
      ? verb === 'Update'
        ? `Update ${modName}`
        : `${verb} ${modName}`
      : null;

  const confidenceLabel = formatConfidenceLabel(s.confidence);

  return {
    headline,
    steps: capped,
    modId,
    modrinthUrl,
    modrinthLabel,
    modsTabParams: modId ? { view: 'overview', mod: modId } : { view: 'overview' },
    relatedMods,
    primaryActionPeek,
    confidenceLabel,
  };
}

/** High / Medium / Low only — never invent a percentage. */
export function formatConfidenceLabel(confidence) {
  if (confidence == null || confidence === '') return null;
  if (typeof confidence === 'string') {
    const s = confidence.trim().toLowerCase();
    if (s === 'high' || s === 'medium' || s === 'low') {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    // Reject numeric-looking strings
    if (/^\d+(\.\d+)?%?$/.test(s)) return null;
    if (s === 'hi') return 'High';
    if (s === 'med') return 'Medium';
    return null;
  }
  // Legacy numeric — map bands, never show %
  if (Number.isFinite(confidence)) {
    const v = confidence <= 1 ? confidence : confidence / 100;
    if (v >= 0.75) return 'High';
    if (v >= 0.4) return 'Medium';
    if (v > 0) return 'Low';
  }
  return null;
}
