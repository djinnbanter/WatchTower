/**
 * Port of CrashNarrator.java (1.0.13 + 1.0.16 CA parity failure_kind narratives).
 */
import {
  classifyCrash,
  FK_WORLD_NBT_CORRUPT,
  FK_WATCHDOG,
  FK_WATCHDOG_PREGEN,
  FK_WATCHDOG_FOLLOWUP,
  FK_MOD_RUNTIME,
  FK_HOST_RESOURCE,
  FK_MOD_LOAD_MIXIN,
  FK_MOD_LOAD_MIXIN_CONFLICT,
  FK_MOD_LOAD_DUPLICATE,
  FK_MOD_LOAD_CONFIG,
  FK_MOD_LOAD_ASSET,
  FK_MOD_LOAD_WORLDGEN,
  FK_MOD_LOAD_COMPAT,
  FK_MOD_LOAD_ECOSYSTEM,
  FK_MOD_LOAD_SCRIPT,
  FK_MOD_LOAD_DEPENDENCY,
  FK_PLATFORM_MISMATCH,
  FK_ENV_LOCK,
  sanitizeModId,
} from './crashClassifier.js';

function str(o, key) {
  return o?.[key] ?? null;
}

function isWatchdog(combined, exception, root) {
  return combined.includes('serverhangwatchdog')
    || exception?.includes('ServerHangWatchdog')
    || root?.includes('ServerHangWatchdog');
}

function isOom(combined) {
  return combined.includes('outofmemoryerror')
    || combined.includes('java heap space')
    || combined.includes('gc overhead limit');
}

function isModLoad(combined, failure, exception) {
  return combined.includes('mod loading has failed')
    || combined.includes('modloadingcrash')
    || combined.includes('modloadingexception')
    || (failure && failure.trim())
    || exception?.includes('ModLoading');
}

function hintsWatchdog() {
  return [
    'Read the watchdog thread dump — the stuck stack names the hang (mod, worldgen, or farm).',
    'Pause Chunky / Distant Horizons / map render only if pregen or those mods appear in the dump.',
    'If MSPT was high, reduce simulation distance or find chunk loaders / rogue entities.',
  ];
}

function hintsOom() {
  return [
    'Confirm the pack needs more heap before raising RAM — oversized packs and leaks look the same.',
    'Increase Java heap (-Xmx) only if the host still has free RAM; otherwise find leaks or shrink the pack.',
    'Check duplicate mods, oversized chunk loaders, or run Spark heap analysis.',
  ];
}

function hintsModLoad(suspect, failure) {
  const hints = [];
  if (suspect) {
    hints.push(`Update or reinstall ${suspect} from Modrinth or the official source`);
    hints.push(`Check latest.log for missing dependencies for ${suspect}`);
  } else {
    hints.push('Open latest.log and find which mod failed to load');
  }
  if (failure?.toLowerCase().includes('dependency')) {
    hints.push('Install or update the dependency mod cited in the failure message');
  }
  hints.push('Remove recently added mods one at a time until the server starts');
  return hints;
}

function hintsManualReview() {
  return [
    'Open the full crash report under crash-reports/ and read the root exception',
    'Search the mod id or exception online or in your pack issue tracker',
    'Mark reviewed after you confirm the crash is resolved or historical',
  ];
}

function firstNonBlank(...values) {
  for (const v of values) {
    if (v != null && String(v).trim()) return v;
  }
  return null;
}

function truncate(s, max) {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function narrateCrash(crash) {
  const exception = str(crash, 'exception');
  const root = str(crash, 'root_exception');
  const causedBy = str(crash, 'caused_by');
  const modFile = str(crash, 'mod_file');
  const summary = str(crash, 'summary');
  const failure = str(crash, 'failure_message');
  const description = str(crash, 'description');
  const file = str(crash, 'file');
  const time = str(crash, 'time');
  const watchdogMs = crash.watchdog_tick_ms ?? null;

  const combined = `${exception || ''} ${modFile || ''} ${summary || ''} ${failure || ''} ${description || ''}`.toLowerCase();
  const classification = classifyCrash(crash);
  let suspect = classification.suspect_mod_id;
  if (!suspect) suspect = classification.primary_mod_id;
  if (!suspect && modFile) {
    suspect = sanitizeModId(modFile) || modFile.replace(/\.jar$/i, '').split('-')[0].toLowerCase();
  }
  const failureKind = classification.failure_kind;
  const stallMod = classification.stall_mod_id;

  if (failureKind === FK_WORLD_NBT_CORRUPT) {
    return {
      plain_english: 'World or chunk NBT data looks corrupt (ZLIB/EOF while loading). Restore the affected region from a backup.',
      likely_cause: 'Corrupt world data',
      confidence: 'high',
      fix_hints: classification.fix_hints,
      manual_review: false,
    };
  }

  if (failureKind === FK_MOD_LOAD_MIXIN) {
    const mod = suspect || 'a mod';
    const cfg = classification.details?.mixin_config;
    return {
      plain_english: cfg
        ? `Mixin config ${cfg} failed to initialise${suspect ? ` (owned by ${mod})` : ''}. Update or temporarily remove the mod.`
        : `A mixin failed to initialise for ${mod}. Update recent mods or check mixin conflicts.`,
      likely_cause: 'Mixin init failure',
      confidence: suspect ? 'high' : 'medium',
      fix_hints: classification.fix_hints,
      manual_review: false,
    };
  }

  if (failureKind === FK_MOD_LOAD_MIXIN_CONFLICT) {
    const a = classification.details?.mixin_config;
    const b = classification.details?.mixin_config_conflict;
    return {
      plain_english: a && b
        ? `Two mixin configs conflict (${a} vs ${b}). Update both mods or remove one.`
        : 'Two mods\' mixins conflict during apply. Update both or remove one.',
      likely_cause: 'Mixin conflict',
      confidence: 'high',
      fix_hints: classification.fix_hints,
      manual_review: false,
    };
  }

  if (failureKind === FK_MOD_LOAD_DUPLICATE) {
    return {
      plain_english: 'Duplicate mod jars were found (same mod id twice). Keep only one jar per mod id, then restart.',
      likely_cause: 'Duplicate mods',
      confidence: 'high',
      fix_hints: classification.fix_hints,
      manual_review: false,
    };
  }

  if (failureKind === FK_MOD_LOAD_CONFIG) {
    const cfg = classification.details?.config_file || 'SERVER config';
    return {
      plain_english: `Corrupt SERVER config ${cfg}${suspect ? ` for ${suspect}` : ''}. Delete or fix it, then let the mod regenerate defaults.`,
      likely_cause: 'Corrupt mod config',
      confidence: 'high',
      fix_hints: classification.fix_hints,
      manual_review: false,
    };
  }

  if (failureKind === FK_MOD_LOAD_ASSET) {
    const loc = classification.details?.invalid_location || 'resource path';
    return {
      plain_english: `Illegal character in resource location ${loc}. Fix the datapack/mod asset name (a-z 0-9 / . _ - only).`,
      likely_cause: 'Invalid asset path',
      confidence: 'high',
      fix_hints: classification.fix_hints,
      manual_review: false,
    };
  }

  if (failureKind === FK_MOD_LOAD_WORLDGEN) {
    return {
      plain_english: 'Worldgen feature order cycle — remove or update conflicting biome/terrain mods.',
      likely_cause: 'Worldgen feature cycle',
      confidence: 'high',
      fix_hints: classification.fix_hints,
      manual_review: false,
    };
  }

  if (failureKind === FK_MOD_LOAD_COMPAT) {
    return {
      plain_english: 'FerriteCore neighbor-table access conflict. Set populateNeighborTable to false as a temporary workaround.',
      likely_cause: 'FerriteCore compat',
      confidence: 'high',
      fix_hints: classification.fix_hints,
      manual_review: false,
    };
  }

  if (failureKind === FK_MOD_LOAD_ECOSYSTEM) {
    const mod = suspect || classification.primary_mod_id || 'ecosystem mod';
    return {
      plain_english: `Mod ecosystem mismatch around ${mod} — align versions of the core mod and its addons.`,
      likely_cause: 'Ecosystem version mismatch',
      confidence: 'high',
      fix_hints: classification.fix_hints,
      manual_review: false,
    };
  }

  if (failureKind === FK_PLATFORM_MISMATCH) {
    const jm = classification.details?.java_mismatch;
    const plain = jm
      ? `A mod needs Java ${jm.compiled_java} but the server runs Java ${jm.runtime_java}. Upgrade the JVM or use an older mod build.`
      : 'A mod was compiled for a newer Java than the server JVM. Upgrade Java or use a matching mod build.';
    return {
      plain_english: plain,
      likely_cause: 'Java version mismatch',
      confidence: 'high',
      fix_hints: classification.fix_hints,
      manual_review: false,
    };
  }

  if (failureKind === FK_ENV_LOCK) {
    const path = classification.details?.locked_path || 'a file';
    return {
      plain_english: `Windows has ${path} locked by another process. Close other Java/Minecraft instances or antivirus scans, then retry.`,
      likely_cause: 'File lock',
      confidence: 'high',
      fix_hints: classification.fix_hints,
      manual_review: false,
    };
  }

  if (failureKind === FK_MOD_LOAD_SCRIPT || failureKind === FK_MOD_LOAD_DEPENDENCY) {
    const modLabel = suspect || 'a mod';
    return {
      plain_english: failureKind === FK_MOD_LOAD_SCRIPT
        ? `Script/datapack load failed for ${modLabel}. Fix or remove the broken script cited in the log.`
        : `NeoForge failed while loading ${modLabel} — often a version mismatch or missing language provider / dependency.`,
      likely_cause: failureKind === FK_MOD_LOAD_SCRIPT ? 'Script load failure' : 'Mod failed to load',
      confidence: suspect ? 'high' : 'medium',
      fix_hints: classification.fix_hints?.length ? classification.fix_hints : hintsModLoad(suspect, failure),
      manual_review: false,
    };
  }

  if (isWatchdog(combined, exception, root)
    || failureKind === FK_WATCHDOG
    || failureKind === FK_WATCHDOG_PREGEN
    || failureKind === FK_WATCHDOG_FOLLOWUP) {
    const ms = watchdogMs ?? 60000;
    const sec = Math.max(1, Math.floor(ms / 1000));
    if (failureKind === FK_WATCHDOG_PREGEN || stallMod) {
      const stall = stallMod || 'map render';
      const hints = classification.fix_hints?.length ? classification.fix_hints : hintsWatchdog();
      return {
        plain_english: `Server tick hang — ${stall} blocked while Chunky pregen was active (~${sec}s). Pause pregen or defer map render.`,
        likely_cause: 'Tick hang / pregen contention',
        confidence: 'high',
        fix_hints: hints,
        manual_review: false,
      };
    }
    return {
      plain_english: `The main server thread stopped responding for ~${sec}s (tick watchdog). Read the thread dump first — lag, pregen, or a heavy assembly, not always a broken mod.`,
      likely_cause: 'Server hung',
      confidence: 'high',
      fix_hints: classification.fix_hints?.length ? classification.fix_hints : hintsWatchdog(),
      manual_review: false,
    };
  }

  if (isOom(combined) || (failureKind === FK_HOST_RESOURCE && classification.details?.oom_kind)) {
    const oomKind = classification.details?.oom_kind || 'heap';
    return {
      plain_english: oomKind === 'native'
        ? 'The JVM ran out of native or direct memory.'
        : 'Java ran out of heap memory during play.',
      likely_cause: oomKind === 'native' ? 'Out of native memory' : 'Out of memory',
      confidence: 'high',
      fix_hints: classification.fix_hints?.length ? classification.fix_hints : hintsOom(),
      manual_review: false,
    };
  }

  if (classification.category === 'mod' && failureKind === FK_MOD_RUNTIME && (suspect || classification.primary_mod_id)) {
    const mod = suspect || classification.primary_mod_id;
    const createIssue = classification.details?.create_issue;
    let plain;
    if (mod === 'create' && createIssue === 'contraption_collision') {
      plain = `Create contraption collision (${mod}) — stop the stuck assembly so the world can load, then update Create if needed.`;
    } else if (mod === 'create') {
      plain = `Create crashed during play (${mod}) — inspect the stack and update Create or matching addons if versions look wrong.`;
    } else {
      plain = `The crash points to mod ${mod} — update it, replace a corrupt jar, or check mixin conflicts.`;
    }
    return {
      plain_english: plain,
      likely_cause: 'Mod crash',
      confidence: 'medium',
      fix_hints: classification.fix_hints,
      manual_review: false,
    };
  }

  if (isModLoad(combined, failure, exception)) {
    const modLabel = suspect || 'a mod';
    return {
      plain_english: `NeoForge failed while loading ${modLabel} — often a version mismatch or missing dependency.`,
      likely_cause: 'Mod failed to load',
      confidence: suspect ? 'high' : 'medium',
      fix_hints: classification.fix_hints?.length ? classification.fix_hints : hintsModLoad(suspect, failure),
      manual_review: false,
    };
  }

  if (classification.category === 'host_resource') {
    return {
      plain_english: 'A host or JVM resource limit was hit — review CPU, RAM, and disk around the crash time.',
      likely_cause: 'Host resource limit',
      confidence: 'medium',
      fix_hints: classification.fix_hints,
      manual_review: false,
    };
  }

  if (classification.category === 'loader') {
    return {
      plain_english: 'NeoForge or the mod loader failed during bootstrap — often incompatible or corrupt mod jars.',
      likely_cause: 'Loader bootstrap failure',
      confidence: 'medium',
      fix_hints: classification.fix_hints,
      manual_review: false,
    };
  }

  const known = firstNonBlank(description, failure, causedBy, exception, summary);
  let plain = 'We could not determine a specific cause';
  if (file) plain += ` for crash report ${file}`;
  if (time) plain += ` (${time})`;
  plain += '.';
  if (known) plain += ` The report mentions: ${truncate(String(known), 160)}.`;

  return {
    plain_english: plain,
    likely_cause: 'Unknown',
    confidence: 'low',
    fix_hints: hintsManualReview(),
    manual_review: true,
  };
}

export function enrichSummary(row, narrative) {
  row.plain_english = narrative.plain_english;
  row.likely_cause = narrative.likely_cause;
  row.confidence = narrative.confidence;
  row.manual_review = narrative.manual_review;
  row.fix_hints = narrative.fix_hints;
}
