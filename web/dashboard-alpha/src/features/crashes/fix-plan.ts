/**
 * Slim TS port of production crash-fix.js — resolution-first fix plans.
 */

const KNOWN_MODRINTH_SLUGS: Record<string, string> = {
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

export function humanFailureLabel(
  failure_kind: string | null | undefined,
  stall_mod_id?: string | null,
  primary_mod_id?: string | null,
  create_issue?: string | null,
): string {
  const kind = String(failure_kind || '').toLowerCase();
  const stall = stall_mod_id?.trim() || null;
  const primary = primary_mod_id?.trim() || null;
  const createIssue = create_issue?.trim() || null;

  if (kind === 'watchdog_pregen') {
    return stall ? `Server tick hang — map/pregen (${stall})` : 'Hang during world gen / map render';
  }
  if (kind === 'watchdog' || kind === 'watchdog_followup') return 'Server tick hang';
  if (kind === 'mod_runtime') {
    if (primary === 'create' && createIssue === 'contraption_collision') return 'Create contraption collision';
    if (primary === 'create') return 'Create crashed while ticking';
    return primary ? `Mod crash (${primary})` : 'Mod crash';
  }
  if (kind === 'mod_load_mixin') return primary ? `Mixin failed to load (${primary})` : 'Mixin config failed to load';
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

export function modrinthUrlForMod(
  modId: string,
  modsOptional?: Record<string, unknown>[] | null,
  opts: { preferUpdate?: boolean } = {},
): string | null {
  if (!modId) return null;
  const id = String(modId).trim();
  if (!id) return null;

  const mods = Array.isArray(modsOptional) ? modsOptional : [];
  const match = mods.find((m) => (m?.id ?? m?.mod_id) === id);
  const preferUpdate = !!opts.preferUpdate;

  if (match) {
    if (preferUpdate || match.modrinth_outdated) {
      if (match.modrinth_compatible_url) return String(match.modrinth_compatible_url);
      if (match.modrinth_cta_url) return String(match.modrinth_cta_url);
    }
    if (match.modrinth_cta_url) return String(match.modrinth_cta_url);
    if (match.modrinth_compatible_url) return String(match.modrinth_compatible_url);
    if (match.modrinth_version_url) return String(match.modrinth_version_url);
    if (match.modrinth_url) return String(match.modrinth_url);
    if (match.modrinth_project_url) return String(match.modrinth_project_url);
    if (typeof match.project_url === 'string' && match.project_url.includes('modrinth.com')) {
      return match.project_url;
    }
    const slug = String(match.modrinth_slug || match.slug || KNOWN_MODRINTH_SLUGS[id.toLowerCase()] || '');
    if (slug) return `https://modrinth.com/mod/${encodeURIComponent(slug)}`;
  }

  const slug = KNOWN_MODRINTH_SLUGS[id.toLowerCase()];
  if (slug) return `https://modrinth.com/mod/${encodeURIComponent(slug)}`;
  return `https://modrinth.com/mods?q=${encodeURIComponent(id)}`;
}

function actionVerb(action: unknown): string {
  const a = String(action || '').toLowerCase();
  if (a === 'install' || a === 'download') return 'Install';
  if (a === 'remove') return 'Remove';
  if (a === 'pair_update') return 'Update';
  if (a === 'pause' || a === 'defer') return 'Pause';
  if (a === 'restore') return 'Restore';
  if (a === 'update' || a === 'upgrade') return 'Update';
  return 'Check';
}

function displayModName(modId: string | null): string {
  if (!modId) return 'mod';
  if (modId === 'create') return 'Create';
  if (modId === 'createaddition') return 'Create Additions';
  if (modId === 'flywheel') return 'Flywheel';
  if (modId === 'chunky') return 'Chunky';
  if (modId === 'squaremap') return 'squaremap';
  return modId;
}

function normalizeStep(text: unknown): string | null {
  if (!text) return null;
  let s = String(text).trim();
  if (!s) return null;
  if (s.endsWith('.')) s = s.slice(0, -1);
  return s;
}

function stepKey(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isVague(s: string): boolean {
  const k = stepKey(s);
  return (
    k.startsWith('check for heavy') ||
    k.includes('usually lag') ||
    k === 'check latest log' ||
    k.includes('look for chunk loaders')
  );
}

function pushUnique(steps: string[], text: unknown, { preferImperative = false } = {}) {
  const n = normalizeStep(text);
  if (!n) return;
  const key = stepKey(n);
  const idx = steps.findIndex(
    (s) => stepKey(s) === key || stepKey(s).includes(key) || key.includes(stepKey(s)),
  );
  if (idx >= 0) {
    if (preferImperative && isVague(steps[idx]) && !isVague(n)) steps[idx] = n;
    return;
  }
  steps.push(n);
}

/** High / Medium / Low only — never invent a percentage. */
export function formatConfidenceLabel(confidence: unknown): string | null {
  if (confidence == null || confidence === '') return null;
  if (typeof confidence === 'string') {
    const s = confidence.trim().toLowerCase();
    if (s === 'high' || s === 'medium' || s === 'low') {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    if (/^\d+(\.\d+)?%?$/.test(s)) return null;
    if (s === 'hi') return 'High';
    if (s === 'med') return 'Medium';
    return null;
  }
  if (Number.isFinite(confidence as number)) {
    const v = (confidence as number) <= 1 ? (confidence as number) : (confidence as number) / 100;
    if (v >= 0.75) return 'High';
    if (v >= 0.4) return 'Medium';
    if (v > 0) return 'Low';
  }
  return null;
}

export type FixPlanRelatedMod = {
  id: string;
  url: string | null;
  /** Chip label, e.g. "create 6.0.0" */
  label: string;
  installedVersion: string | null;
  targetVersion: string | null;
};

export type FixPlanVersionLine = {
  modId: string;
  label: string;
  installed: string | null;
  target: string | null;
  note: string | null;
};

export type FixPlan = {
  headline: string;
  steps: string[];
  modId: string | null;
  modrinthUrl: string | null;
  modrinthLabel: string | null;
  modsTabParams: { view: string; mod?: string };
  relatedMods: FixPlanRelatedMod[];
  /** Installed → suggested versions for mixin/update conflicts */
  versionGuide: FixPlanVersionLine[];
  primaryActionPeek: string | null;
  confidenceLabel: string | null;
};

function findModRow(
  modsOptional: Record<string, unknown>[] | null | undefined,
  modId: string | null,
): Record<string, unknown> | null {
  if (!modId || !Array.isArray(modsOptional)) return null;
  return modsOptional.find((m) => (m?.id ?? m?.mod_id) === modId) ?? null;
}

function installedVersionOf(modRow: Record<string, unknown> | null): string | null {
  if (!modRow) return null;
  const v = modRow.version ?? modRow.mod_version ?? modRow.display_version;
  return v != null && String(v).trim() ? String(v).trim() : null;
}

function targetVersionOf(
  modFix: Record<string, unknown> | null,
  modRow: Record<string, unknown> | null,
): string | null {
  const v =
    modFix?.modrinth_compatible_version_number ??
    modRow?.modrinth_compatible_version_number ??
    null;
  return v != null && String(v).trim() ? String(v).trim() : null;
}

type JarDep = { modId: string; mandatory: boolean; versionRange: string | null };

function jarDependencies(modRow: Record<string, unknown> | null): JarDep[] {
  if (!modRow || !Array.isArray(modRow.dependencies)) return [];
  const out: JarDep[] = [];
  for (const raw of modRow.dependencies) {
    if (!raw || typeof raw !== 'object') continue;
    const d = raw as Record<string, unknown>;
    const id = String(d.modId ?? d.mod_id ?? '').trim();
    if (!id) continue;
    out.push({
      modId: id,
      mandatory: d.mandatory !== false && String(d.type || '').toLowerCase() !== 'optional',
      versionRange: d.versionRange != null && String(d.versionRange).trim() ? String(d.versionRange).trim() : null,
    });
  }
  return out;
}

function versionParts(v: string): number[] {
  const core = String(v).split(/[+\s-]/)[0] || '';
  return core.split('.').map((p) => {
    const n = parseInt(p.replace(/[^0-9].*$/, ''), 10);
    return Number.isFinite(n) ? n : 0;
  });
}

function cmpVersion(a: string, b: string): number {
  const pa = versionParts(a);
  const pb = versionParts(b);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d < 0) return -1;
    if (d > 0) return 1;
  }
  return 0;
}

/** Lightweight Maven/Forge range check. Returns null when the range can't be parsed. */
function versionSatisfiesRange(version: string | null, range: string | null): boolean | null {
  if (!version || !range) return null;
  const r = range.trim();
  const m = r.match(/^([\[(])\s*([^,\]]*)\s*,\s*([^)\]]*)\s*([\])])$/);
  if (!m) return null;
  const [, loBound, loRaw, hiRaw, hiBound] = m;
  const lo = loRaw.trim();
  const hi = hiRaw.trim();
  if (lo) {
    const c = cmpVersion(version, lo);
    if (loBound === '[' ? c < 0 : c <= 0) return false;
  }
  if (hi) {
    const c = cmpVersion(version, hi);
    if (hiBound === ']' ? c > 0 : c >= 0) return false;
  }
  return true;
}

/**
 * Mixin overwrite conflicts almost always mean the mixin author (primary) is wrong
 * for the installed base mod — not that both need bumping. Jar deps can confirm the
 * base is in-range; only recommend changing the partner when pair_update says so, or
 * when the declared versionRange is violated and the primary has no Modrinth target.
 */
function shouldUpdateMixinPartner(
  primaryRow: Record<string, unknown> | null,
  partnerId: string,
  partnerRow: Record<string, unknown> | null,
  modFix: Record<string, unknown> | null,
  primaryHasTarget: boolean,
): boolean {
  if (modFix?.action === 'pair_update') return true;
  const dep = jarDependencies(primaryRow).find((d) => d.modId === partnerId);
  const sat = versionSatisfiesRange(installedVersionOf(partnerRow), dep?.versionRange ?? null);
  if (sat === false && !primaryHasTarget) return true;
  return false;
}

function isVagueVersionHint(text: string): boolean {
  const k = stepKey(text);
  // Family-level hints without concrete version numbers (e.g. "matching Create 6.x")
  if (/\bmatching\b/.test(k) || /\bbuild matching\b/.test(k) || /\balign .+ with\b/.test(k) || /\bupdate both\b/.test(k)) {
    return true;
  }
  // "Create 6.x" / "Create 6" style without an explicit from→to version pair
  if (/\bcreate\s+\d+(\.\w+)?\b/.test(k) && !/\d+\.\d+.*→|\bfrom\s+\d/.test(k)) {
    return true;
  }
  return false;
}

function updateStepSoftKey(text: string): string | null {
  const k = stepKey(text);
  const fromTo = k.match(/^update (.+?) from [\w.]+ to [\w.]+/);
  if (fromTo) return `update:${fromTo[1]}`;
  const toOnly = k.match(/^update (.+?) to [\w.]+/);
  if (toOnly) return `update:${toOnly[1]}`;
  // "Update Mod 1.2.3 1.2.4" after → was stripped to spaces
  const arrowish = k.match(/^update (.+?) \d[\w.]* \d[\w.]*/);
  if (arrowish) return `update:${arrowish[1]}`;
  const also = k.match(/^(?:also consider updating|then update) (.+?) from /);
  if (also) return `update:${also[1]}`;
  return null;
}

function collapseDuplicateUpdateSteps(steps: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of steps) {
    const soft = updateStepSoftKey(s);
    if (soft) {
      if (seen.has(soft)) continue;
      seen.add(soft);
    }
    out.push(s);
  }
  return out;
}

function buildVersionGuide(
  modId: string | null,
  modFix: Record<string, unknown> | null,
  modsOptional: Record<string, unknown>[] | null | undefined,
  relatedIds: string[],
  opts: { mixinConflict?: boolean; partnerUpdateIds?: Set<string> } = {},
): FixPlanVersionLine[] {
  const ids = [modId, ...relatedIds].filter(Boolean) as string[];
  const seen = new Set<string>();
  const lines: FixPlanVersionLine[] = [];
  const primaryRow = findModRow(modsOptional, modId);
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const row = findModRow(modsOptional, id);
    const isPrimary = id === modId;
    const installed = installedVersionOf(row);
    const wantPartnerUpdate = !isPrimary && !!opts.partnerUpdateIds?.has(id);
    const target = isPrimary
      ? targetVersionOf(modFix, row)
      : wantPartnerUpdate
        ? targetVersionOf(null, row)
        : null;
    const outdated = isPrimary
      ? !!(row?.modrinth_outdated || modFix?.modrinth_outdated)
      : wantPartnerUpdate && !!row?.modrinth_outdated;
    const updateLabel = row?.modrinth_update_label ? String(row.modrinth_update_label) : null;
    if (!installed && !target && !outdated) continue;

    let note: string | null = null;
    if (isPrimary) {
      if (target && installed && target !== installed) {
        note = `update ${displayModName(id)} ${installed} → ${target}`;
      } else if (target && !installed) {
        note = `install / update to ${target}`;
      } else if (outdated && updateLabel) {
        note = updateLabel;
      } else if (outdated) {
        note = 'newer build available on Modrinth';
      } else if (installed) {
        note = 'installed version';
      }
    } else if (opts.mixinConflict) {
      const dep = jarDependencies(primaryRow).find((d) => d.modId === id);
      const sat = versionSatisfiesRange(installed, dep?.versionRange ?? null);
      if (wantPartnerUpdate && target && installed && target !== installed) {
        note = `declared dependency range needs ${displayModName(id)} ${target}`;
      } else if (sat === true) {
        note = `base dependency — leave at ${installed}`;
      } else if (sat === false) {
        note = dep?.versionRange
          ? `jar asks for ${displayModName(id)} ${dep.versionRange}`
          : 'outside declared dependency range';
      } else if (installed) {
        note = `base mod in the conflict — leave as-is`;
      }
    } else if (target && installed && target !== installed) {
      note = `update ${displayModName(id)} ${installed} → ${target}`;
    } else if (outdated && updateLabel) {
      note = updateLabel;
    } else if (installed) {
      note = 'installed version';
    }

    lines.push({
      modId: id,
      label: displayModName(id),
      installed,
      target,
      note,
    });
  }
  return lines;
}

function applyConcreteVersionSteps(
  steps: string[],
  {
    failureKind,
    modId,
    modName,
    installed,
    target,
    versionGuide,
    partnerUpdateIds,
  }: {
    failureKind: string;
    modId: string | null;
    modName: string;
    installed: string | null;
    target: string | null;
    versionGuide: FixPlanVersionLine[];
    partnerUpdateIds: Set<string>;
  },
): string[] {
  const isMixin =
    failureKind === 'mod_load_mixin' || failureKind === 'mod_load_mixin_conflict';
  if (!isMixin && !target) return steps;

  let next = steps.filter((s) => !isVagueVersionHint(s));
  next = collapseDuplicateUpdateSteps(next);

  if (modId && target && installed) {
    // Drop weaker "update this mod" duplicates before inserting the concrete one
    next = next.filter((s) => updateStepSoftKey(s) !== `update:${stepKey(modName)}`);
    pushUnique(
      next,
      `Update ${modName} from ${installed} to ${target} (Modrinth build for your loader)`,
      { preferImperative: true },
    );
  } else if (modId && target) {
    next = next.filter((s) => updateStepSoftKey(s) !== `update:${stepKey(modName)}`);
    pushUnique(next, `Update ${modName} to ${target} on Modrinth`, { preferImperative: true });
  } else if (modId && installed && isMixin) {
    pushUnique(
      next,
      `Check Modrinth for a ${modName} build newer than ${installed} that matches your loader`,
      { preferImperative: true },
    );
  }

  // Only recommend changing the base/partner mod when deps or pair_update require it
  if (isMixin) {
    for (const line of versionGuide) {
      if (line.modId === modId) continue;
      if (!partnerUpdateIds.has(line.modId)) continue;
      if (line.installed && line.target && line.installed !== line.target) {
        pushUnique(
          next,
          `Then update ${line.label} from ${line.installed} to ${line.target} to satisfy jar dependencies`,
          { preferImperative: true },
        );
      }
    }
  }

  next = collapseDuplicateUpdateSteps(next);

  // Keep review step last
  const review = next.filter((s) => /mark reviewed|acknowledge/i.test(s));
  const body = next.filter((s) => !/mark reviewed|acknowledge/i.test(s)).slice(0, 4);
  return [...body, ...(review.length ? [review[review.length - 1]] : ['Mark reviewed when the crash is fixed or confirmed historical'])].slice(0, 5);
}

export function buildFixPlan(
  summary: Record<string, unknown> | null | undefined,
  modsOptional?: Record<string, unknown>[] | null,
): FixPlan {
  const s = summary && typeof summary === 'object' ? summary : {};
  const failureKind = String(s.failure_kind || s.category || '');
  const stall = s.stall_mod_id ? String(s.stall_mod_id) : null;
  const primary = s.primary_mod_id
    ? String(s.primary_mod_id)
    : s.suspect_mod_id
      ? String(s.suspect_mod_id)
      : null;
  const modFix = s.mod_fix && typeof s.mod_fix === 'object' ? (s.mod_fix as Record<string, unknown>) : null;
  const modId =
    (modFix?.mod_id ? String(modFix.mod_id) : null) ||
    (failureKind === 'watchdog_pregen' ? stall || primary : primary || stall) ||
    null;

  const relatedIdsRaw = Array.isArray(modFix?.related_mods) ? modFix.related_mods : [];
  const relatedIds = relatedIdsRaw
    .map((r) =>
      typeof r === 'string'
        ? r
        : String((r as Record<string, unknown>)?.id || (r as Record<string, unknown>)?.mod_id || ''),
    )
    .filter(Boolean);

  const isMixinConflict =
    failureKind === 'mod_load_mixin_conflict' || failureKind === 'mod_load_mixin';

  // For mixin conflicts, always consider Create partner when primary is a Create addon
  if (
    isMixinConflict &&
    modId &&
    modId !== 'create' &&
    /create/i.test(modId) &&
    !relatedIds.includes('create')
  ) {
    relatedIds.push('create');
  }

  // Also surface mandatory jar deps of the mixin author (skip loader/minecraft)
  if (isMixinConflict && modId) {
    const primaryRowEarly = findModRow(modsOptional, modId);
    for (const d of jarDependencies(primaryRowEarly)) {
      if (!d.mandatory) continue;
      if (/^(minecraft|neoforge|forge|fabricloader|fabric-api)$/i.test(d.modId)) continue;
      if (d.modId === modId || relatedIds.includes(d.modId)) continue;
      relatedIds.push(d.modId);
    }
  }

  const steps: string[] = [];
  if (modFix?.action_detail) pushUnique(steps, modFix.action_detail, { preferImperative: true });
  if (modFix?.fix) pushUnique(steps, modFix.fix, { preferImperative: true });
  if (modFix?.install_hint) pushUnique(steps, modFix.install_hint);

  const hints = Array.isArray(s.fix_hints) ? s.fix_hints : [];
  for (const h of hints) pushUnique(steps, h, { preferImperative: true });
  if (!steps.length && s.likely_cause) pushUnique(steps, s.likely_cause);

  let capped = steps.slice(0, 5);
  const hasReview = capped.some((x) => /mark reviewed|acknowledge/i.test(x));
  if (!hasReview && capped.length < 5) {
    capped.push('Mark reviewed when the crash is fixed or confirmed historical');
  } else if (!hasReview && capped.length === 5) {
    capped[4] = 'Mark reviewed when the crash is fixed or confirmed historical';
  }

  const verb = actionVerb(modFix?.action);
  const modName = displayModName(modId);
  const modRow = findModRow(modsOptional, modId);
  const installed = installedVersionOf(modRow);
  const compatVer = targetVersionOf(modFix, modRow);
  const primaryHasTarget = !!(compatVer && (!installed || compatVer !== installed));

  const partnerUpdateIds = new Set<string>();
  if (isMixinConflict) {
    for (const rid of relatedIds) {
      if (
        shouldUpdateMixinPartner(
          modRow,
          rid,
          findModRow(modsOptional, rid),
          modFix,
          primaryHasTarget,
        )
      ) {
        partnerUpdateIds.add(rid);
      }
    }
  } else if (modFix?.action === 'pair_update') {
    for (const rid of relatedIds) partnerUpdateIds.add(rid);
  }

  const versionGuide = buildVersionGuide(modId, modFix, modsOptional, relatedIds, {
    mixinConflict: isMixinConflict,
    partnerUpdateIds,
  });

  capped = applyConcreteVersionSteps(capped, {
    failureKind,
    modId,
    modName,
    installed,
    target: compatVer,
    versionGuide,
    partnerUpdateIds,
  });

  let headline = s.plain_english ? String(s.plain_english) : null;
  // Prefer concrete version headlines for mixin conflicts when we have data
  if (isMixinConflict && modId && (installed || compatVer)) {
    const partner = versionGuide.find((l) => l.modId !== modId && l.installed);
    if (compatVer && installed) {
      headline = partner?.installed
        ? `Update ${modName} ${installed} → ${compatVer} (mixin conflicts with ${partner.label} ${partner.installed})`
        : `Update ${modName} from ${installed} to ${compatVer}, then restart`;
    } else if (compatVer) {
      headline = `Update ${modName} to ${compatVer}, then restart`;
    } else if (installed && partner?.installed) {
      headline = `${modName} ${installed} conflicts with ${partner.label} ${partner.installed} — update ${modName} on Modrinth`;
    }
  }

  if (!headline || headline.length > 140) {
    if (failureKind === 'watchdog_pregen' || (failureKind === 'watchdog' && stall)) {
      headline = `Pause pregen / defer ${stall || 'map render'}, then restart and watch for repeats`;
    } else if (failureKind === 'watchdog' || failureKind === 'watchdog_followup') {
      headline = 'Read the watchdog thread dump, then pause pregen only if it appears there';
    } else if (
      s.create_issue === 'contraption_collision' ||
      (modId === 'create' && /contraption/i.test(String(s.plain_english || '')))
    ) {
      headline = 'Stop the stuck Create assembly so the world can load, then update Create if needed';
    } else if (failureKind === 'mod_runtime' && modId === 'create') {
      headline = 'Inspect the Create stack and update Create or matching addons if versions look wrong';
    } else if (modFix?.action === 'update' || modFix?.action === 'pair_update') {
      headline =
        compatVer && installed
          ? `Update ${modName} ${installed} → ${compatVer}, then restart`
          : compatVer
            ? `Update ${modName} to ${compatVer}, then restart`
            : `Update ${modName}, then restart and watch for repeats`;
    } else if (modFix?.action === 'install') {
      headline = `Install the missing dependency for ${modName}, then restart`;
    } else if (modFix?.action === 'remove') {
      headline = `Remove or replace ${modName}, then restart and confirm the crash is gone`;
    } else if (failureKind === 'world_nbt_corrupt') {
      headline = 'Back up the world, then restore the affected region';
    } else if (failureKind === 'mod_load_mixin' || failureKind === 'mod_load_mixin_conflict') {
      headline = modId ? `Update or temporarily remove ${modName}, then restart` : 'Resolve the mixin conflict, then restart';
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
      headline = humanFailureLabel(failureKind, stall, primary, s.create_issue ? String(s.create_issue) : null);
    }
  }
  headline = String(headline).split(/(?<=[.!?])\s+/)[0].trim();
  if (headline.length > 160) headline = `${headline.slice(0, 157)}…`;

  const preferUpdate =
    modFix?.action === 'update' ||
    modFix?.action === 'pair_update' ||
    modFix?.action === 'install' ||
    modFix?.action === 'download' ||
    !!modFix?.modrinth_outdated ||
    failureKind === 'mod_load_mixin' ||
    failureKind === 'mod_load_mixin_conflict';

  let modrinthUrl =
    (modFix?.modrinth_compatible_url ? String(modFix.modrinth_compatible_url) : null) ||
    (preferUpdate && modFix?.modrinth_cta_url ? String(modFix.modrinth_cta_url) : null) ||
    (modFix?.modrinth_cta_url ? String(modFix.modrinth_cta_url) : null) ||
    (modFix?.modrinth_version_url ? String(modFix.modrinth_version_url) : null) ||
    (modFix?.modrinth_url ? String(modFix.modrinth_url) : null) ||
    (modId ? modrinthUrlForMod(modId, modsOptional, { preferUpdate }) : null);

  const outdated = !!(modFix?.modrinth_outdated || modRow?.modrinth_outdated);

  let modrinthLabel: string | null = null;
  if (modId && modrinthUrl) {
    if (modFix?.action === 'install' || modFix?.action === 'download') {
      modrinthLabel = `Download ${modName} on Modrinth`;
    } else if (modFix?.action === 'remove') {
      modrinthLabel = `Find ${modName} on Modrinth`;
    } else if ((verb === 'Update' || preferUpdate || outdated) && compatVer) {
      modrinthLabel = installed
        ? `Update ${modName} ${installed} → ${compatVer}`
        : `Update ${modName} to ${compatVer} on Modrinth`;
    } else if (verb === 'Update' || preferUpdate || outdated) {
      modrinthLabel = installed
        ? `Update ${modName} (${installed}) on Modrinth`
        : `Update ${modName} on Modrinth`;
    } else {
      modrinthLabel = `Open ${modName} on Modrinth`;
    }
  }

  const relatedMods: FixPlanRelatedMod[] = [];
  for (const rid of relatedIds) {
    const row = findModRow(modsOptional, rid);
    const inst = installedVersionOf(row);
    const wantUpdate = partnerUpdateIds.has(rid) || (!isMixinConflict && modFix?.action === 'pair_update');
    const tgt = wantUpdate ? targetVersionOf(null, row) : null;
    const name = displayModName(rid);
    const fromRel = row
      ? String(row.modrinth_compatible_url || row.modrinth_cta_url || row.modrinth_url || '') || null
      : null;
    let chipLabel = name;
    if (wantUpdate && inst && tgt && inst !== tgt) chipLabel = `${name} ${inst} → ${tgt}`;
    else if (inst) chipLabel = `${name} ${inst}`;
    else if (wantUpdate && tgt) chipLabel = `${name} → ${tgt}`;
    relatedMods.push({
      id: rid,
      url: fromRel || modrinthUrlForMod(rid, modsOptional, { preferUpdate: wantUpdate }),
      label: chipLabel,
      installedVersion: inst,
      targetVersion: tgt,
    });
  }
  if (modFix?.action === 'pair_update' && modId === 'create' && !relatedMods.some((m) => m.id === 'flywheel')) {
    const row = findModRow(modsOptional, 'flywheel');
    const inst = installedVersionOf(row);
    const tgt = targetVersionOf(null, row);
    const name = displayModName('flywheel');
    relatedMods.push({
      id: 'flywheel',
      url: modrinthUrlForMod('flywheel', modsOptional, { preferUpdate: true }),
      label: inst && tgt && inst !== tgt ? `${name} ${inst} → ${tgt}` : inst ? `${name} ${inst}` : name,
      installedVersion: inst,
      targetVersion: tgt,
    });
  }

  const primaryActionPeek = capped[0]
    ? capped[0].replace(/^Update\b/i, 'Update').slice(0, 48)
    : modrinthLabel
      ? verb === 'Update'
        ? `Update ${modName}`
        : `${verb} ${modName}`
      : null;

  return {
    headline,
    steps: capped,
    modId,
    modrinthUrl,
    modrinthLabel,
    modsTabParams: modId ? { view: 'overview', mod: modId } : { view: 'overview' },
    relatedMods,
    versionGuide,
    primaryActionPeek,
    confidenceLabel: formatConfidenceLabel(s.confidence),
  };
}
