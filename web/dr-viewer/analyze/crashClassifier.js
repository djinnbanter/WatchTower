/**
 * Port of CrashClassifier.java (1.0.13 + 1.0.16 CA parity failure kinds).
 */
import * as ModListGate from './modListGate.js';
import * as MixinConfigIndex from './mixinConfigIndex.js';

export const FK_MOD_RUNTIME = 'mod_runtime';
export const FK_MOD_LOAD_DEPENDENCY = 'mod_load_dependency';
export const FK_MOD_LOAD_SCRIPT = 'mod_load_script';
export const FK_MOD_LOAD_MIXIN = 'mod_load_mixin';
export const FK_MOD_LOAD_MIXIN_CONFLICT = 'mod_load_mixin_conflict';
export const FK_MOD_LOAD_DUPLICATE = 'mod_load_duplicate';
export const FK_MOD_LOAD_CONFIG = 'mod_load_config';
export const FK_MOD_LOAD_ASSET = 'mod_load_asset';
export const FK_MOD_LOAD_WORLDGEN = 'mod_load_worldgen';
export const FK_MOD_LOAD_COMPAT = 'mod_load_compat';
export const FK_MOD_LOAD_ECOSYSTEM = 'mod_load_ecosystem';
export const FK_PLATFORM_MISMATCH = 'platform_mismatch';
export const FK_ENV_LOCK = 'env_lock';
export const FK_WORLD_NBT_CORRUPT = 'world_nbt_corrupt';
export const FK_WATCHDOG = 'watchdog';
export const FK_WATCHDOG_FOLLOWUP = 'watchdog_followup';
export const FK_WATCHDOG_PREGEN = 'watchdog_pregen';
export const FK_HOST_RESOURCE = 'host_resource';
export const FK_LOADER = 'loader';
export const FK_UNKNOWN = 'unknown';
export const CREATE_ISSUE_CONTRAPTION = 'contraption_collision';

const CREATE_CONTRAPTION_EVIDENCE = /ContraptionCollision|ControlledContraptionEntity|ContinuousOBBCollider|mf\.axis|(?:create.*(?:contraption|collision)|(?:contraption|collision).*create)/i;
const EXCEPTION_CLASS = /\b((?:java|javax|sun|jdk)\.[\w.$]+(?:Error|Exception))\b/;
const CREATE_HOT_FRAME = /TRANSFORMER\/create@[\w.+-]+\/(com\.simibubi\.create\.[\w.$]+)\.(\w+)\(/i;

const PREGEN_STALL_MODS = new Set(['squaremap', 'bluemap', 'chunky', 'dynmap', 'journeymap']);
const PLACEHOLDER_MOD_IDS = new Set([
  '<no mod information provided>',
  'no mod information provided',
  'java.lang.error',
  'error',
  'null',
  'unknown',
]);
const VANILLA_IDS = new Set(['minecraft', 'neoforge', 'forge', 'fabricloader', 'java']);

const MIXIN_INIT_CONFIG = /MixinInitialisationError:\s*Error initialising mixin config\s+(\S+)/i;
const MIXIN_JSON_TOKEN = /\b(?![\w.\-]*refmap)[\w.\-]+\.json\b/gi;
const CLASS_METADATA_MISSING = /ClassMetadataNotFoundException:\s*(\S+)/i;
const CREATE_MISSING_CLASS = /(?:ClassNotFoundException|NoClassDefFoundError):\s*(?:com[./]simibubi[./]create[./](?!foundation[./]ponder[./]PonderWorld\b)|com[./]jozufozu[./]flywheel|dev[./]engine_room[./]flywheel|net[./]createmod)/i;
const EPICFIGHT_MISSING = /(?:ClassNotFoundException|NoClassDefFoundError):\s*yesman[./]epicfight/i;
const AZURELIB_MISSING = /(?:ClassNotFoundException|NoClassDefFoundError):\s*mod[./]azure[./]azurelib/i;
const UNSUPPORTED_CLASS_VERSION = /java\.lang\.UnsupportedClassVersionError:\s*([\w$/]+) has been compiled by a more recent version of the Java Runtime \(class file version (\d+)(?:\.\d+)?\), this version of the Java Runtime only recognizes class file versions up to (\d+)/i;
const ENV_LOCK = /java\.nio\.file\.FileSystemException:\s*(.+?):\s*The process cannot access the file because it is being used by another process/i;

function str(o, key) {
  return o?.[key] ?? null;
}

export function sanitizeModId(raw) {
  if (!raw || !String(raw).trim()) return null;
  let s = String(raw).trim();
  if (s.endsWith('.jar')) s = s.slice(0, -4);
  if (s.includes('/')) s = s.slice(s.lastIndexOf('/') + 1);
  if (s.includes('\\')) s = s.slice(s.lastIndexOf('\\') + 1);
  let lower = s.toLowerCase();
  if (PLACEHOLDER_MOD_IDS.has(lower) || lower.includes('<no mod')) return null;
  if (lower.startsWith('java.') || lower === 'error') return null;
  if (s.includes('-') && /\d/.test(s.slice(s.lastIndexOf('-') + 1))) {
    s = s.slice(0, s.lastIndexOf('-'));
    lower = s.toLowerCase();
  }
  if (PLACEHOLDER_MOD_IDS.has(lower) || VANILLA_IDS.has(lower)) return null;
  return lower;
}

function firstTransformerMod(text) {
  if (!text) return null;
  const re = /TRANSFORMER\/([a-z][\w-]*)@[\w.+-]+\//gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const id = sanitizeModId(m[1]);
    if (id && !VANILLA_IDS.has(id)) return id;
  }
  return null;
}

function stackBlob(crash) {
  const frames = crash?.stack_frames;
  if (!Array.isArray(frames)) return '';
  return frames.map((f) => `${f.method || ''} ${f.mod_id || ''}`).join(' ');
}

function appendScan(parts, value) {
  if (value == null || !String(value).trim()) return;
  parts.push(String(value));
}

/** Prefer crash body; when scanning a long log, use last ~1000 lines. */
export function buildScanText(crash, stackText) {
  const parts = [];
  appendScan(parts, str(crash, 'quote'));
  appendScan(parts, str(crash, 'exception'));
  appendScan(parts, str(crash, 'root_exception'));
  appendScan(parts, str(crash, 'caused_by'));
  appendScan(parts, str(crash, 'failure_message'));
  appendScan(parts, str(crash, 'description'));
  appendScan(parts, str(crash, 'summary'));
  appendScan(parts, stackText);
  appendScan(parts, str(crash, 'log_excerpt'));
  const full = parts.join('\n');
  const lines = full.split(/\r?\n/);
  if (lines.length <= 1000) return full;
  return lines.slice(-1000).join('\n');
}

function normalizeContext(ctx) {
  if (!ctx) {
    return { mods: null, mixinIndex: MixinConfigIndex.empty(), bootFailed: false };
  }
  const mods = ctx.mods ?? null;
  const mixinIndex = ctx.mixinIndex
    || (mods ? MixinConfigIndex.fromMods(mods) : MixinConfigIndex.empty());
  return {
    mods,
    mixinIndex,
    bootFailed: !!ctx.bootFailed,
  };
}

function compareVersions(a, b) {
  const pa = String(a).split(/[^0-9]+/);
  const pb = String(b).split(/[^0-9]+/);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = i < pa.length && pa[i] !== '' ? Number.parseInt(pa[i], 10) : 0;
    const vb = i < pb.length && pb[i] !== '' ? Number.parseInt(pb[i], 10) : 0;
    if (va !== vb) return va < vb ? -1 : 1;
  }
  return 0;
}

function modVersion(mods, id) {
  if (!Array.isArray(mods) || !id) return null;
  for (const mod of mods) {
    if (!mod || typeof mod !== 'object') continue;
    const mid = str(mod, 'id') || str(mod, 'mod_id');
    if (mid && mid.toLowerCase() === id.toLowerCase()) return str(mod, 'version');
  }
  return null;
}

function stripTrailingPunct(s) {
  if (s == null) return null;
  return String(s).replace(/[,:;]+$/, '').trim();
}

function isVanillaPackage(pkg) {
  if (!pkg || !String(pkg).trim()) return false;
  const p = String(pkg).replace(/\//g, '.').toLowerCase();
  return p.startsWith('net.minecraft') || p.startsWith('com.mojang') || p === 'minecraft';
}

function extractMixinConfigs(line) {
  const configs = [];
  if (!line) return configs;
  MIXIN_JSON_TOKEN.lastIndex = 0;
  let m;
  while ((m = MIXIN_JSON_TOKEN.exec(line)) !== null) {
    const token = m[0];
    if (token.toLowerCase().includes('refmap')) continue;
    configs.push(token);
  }
  return configs;
}

function resolveMixinMod(ctx, config) {
  if (!ctx || !config) return null;
  const hit = ctx.mixinIndex.resolve(config);
  return hit ? hit.modId : null;
}

function classification(category, failureKind, suspectModId, primaryModId, stallModId, fixHints, details = {}) {
  return {
    category,
    failure_kind: failureKind,
    suspect_mod_id: suspectModId,
    primary_mod_id: primaryModId,
    stall_mod_id: stallModId,
    fix_hints: fixHints,
    details,
  };
}

/** CA-01: mixin config initialisation failure → mod_load_mixin */
export function classifyMixinInit(scanText, ctx, fallbackPrimary) {
  if (!scanText || !String(scanText).trim()) return null;
  const lower = scanText.toLowerCase();
  let clearInit = lower.includes('mixininitialisationerror')
    || lower.includes('error initialising mixin config');
  let config = null;
  const init = MIXIN_INIT_CONFIG.exec(scanText);
  if (init) {
    config = stripTrailingPunct(init[1]);
    clearInit = true;
  }

  let detail = null;
  if (lower.includes('compatibility level') || lower.includes('java/asm') || lower.includes('asm api')) {
    detail = 'java_asm_level';
  } else if (lower.includes('invalid resource') || lower.includes('corrupt')) {
    detail = 'corrupt_config';
  }

  if (CLASS_METADATA_MISSING.test(scanText)) {
    detail = 'missing_class';
  }

  if (config == null && !clearInit) {
    const configs = extractMixinConfigs(scanText);
    if (configs.length !== 1) return null;
    if (!lower.includes('mixin') && !lower.includes('spongepowered.asm')) return null;
    config = configs[0];
    clearInit = true;
  }

  if (!clearInit && config == null && detail == null) return null;
  if (!clearInit && detail == null) return null;
  if (!clearInit && detail !== 'missing_class') return null;
  if (!clearInit && detail === 'missing_class'
    && !lower.includes('mixin') && !lower.includes('spongepowered')) {
    return null;
  }

  let primary = null;
  if (config != null) {
    const hit = ctx.mixinIndex.resolve(config);
    if (hit) primary = hit.modId;
  }
  const details = {};
  if (config != null) details.mixin_config = config;
  if (detail != null) details.exception_detail = detail;
  const hints = [];
  if (primary != null) {
    hints.push(`Update or temporarily remove mod '${primary}' (mixin config ${config != null ? config : '?'}).`);
  } else if (config != null) {
    hints.push(`Mixin config '${config}' failed to load — identify the owning mod and update or remove it.`);
  } else {
    hints.push('A mixin failed during class lookup — update recent mods or check mixin conflicts.');
  }
  if (detail === 'java_asm_level') {
    hints.push('Check the Java version required by the mixin config (ASM compatibility level).');
  }
  return classification(
    'mod',
    FK_MOD_LOAD_MIXIN,
    primary,
    primary != null ? primary : fallbackPrimary,
    null,
    hints,
    details,
  );
}

function classifyMixinConflict(scanText, ctx, fallbackPrimary) {
  if (!scanText || !String(scanText).trim()) return null;
  const conflictPhrases = [
    'conflict. Skipping',
    ' merged by ',
    ' previously written by ',
    ' was not located in the target class ',
  ];
  const lines = scanText.split(/\r?\n/);
  for (const line of lines) {
    let matched = false;
    let afterPhrase = null;
    for (const phrase of conflictPhrases) {
      const idx = line.indexOf(phrase);
      if (idx >= 0) {
        matched = true;
        afterPhrase = line.slice(idx + phrase.length).trim();
        break;
      }
    }
    if (!matched) continue;
    if (afterPhrase != null) {
      const pkg = afterPhrase.split(/\s+/)[0];
      if (isVanillaPackage(pkg)) continue;
    }
    const configs = extractMixinConfigs(line);
    if (configs.length === 0) continue;
    let configA = configs[0];
    let configB = configs.length > 1 ? configs[1] : null;
    if (line.includes('conflict. Skipping') && configs.length >= 2) {
      configA = configs[0];
      configB = configs[1];
    }
    const primary = resolveMixinMod(ctx, configA);
    const conflictMod = configB != null ? resolveMixinMod(ctx, configB) : null;
    const details = { mixin_config: configA };
    if (configB != null) details.mixin_config_conflict = configB;
    if (conflictMod != null) details.conflict_mod_id = conflictMod;
    const hints = [];
    if (primary != null && conflictMod != null) {
      hints.push(`Update or align mods '${primary}' and '${conflictMod}' — mixin configs conflict.`);
    } else if (primary != null) {
      hints.push(`Update or temporarily remove mod '${primary}' (mixin conflict on ${configA}).`);
    } else {
      hints.push("Two mods' mixins conflict — update both or remove one.");
    }
    return classification(
      'mod',
      FK_MOD_LOAD_MIXIN_CONFLICT,
      primary,
      primary != null ? primary : fallbackPrimary,
      null,
      hints,
      details,
    );
  }
  for (const line of lines) {
    if (!line.includes('conflict. Skipping')) continue;
    const configs = extractMixinConfigs(line);
    if (configs.length < 2) continue;
    const configA = configs[0];
    const configB = configs[1];
    const primary = resolveMixinMod(ctx, configA);
    const conflictMod = resolveMixinMod(ctx, configB);
    const details = {
      mixin_config: configA,
      mixin_config_conflict: configB,
    };
    if (conflictMod != null) details.conflict_mod_id = conflictMod;
    return classification(
      'mod',
      FK_MOD_LOAD_MIXIN_CONFLICT,
      primary,
      primary != null ? primary : fallbackPrimary,
      null,
      [`Mixin configs conflict (${configA} vs ${configB}) — update both mods to versions tested together.`],
      details,
    );
  }
  return null;
}

function classifyServerConfig(scanText, fallbackPrimary) {
  if (!scanText) return null;
  const serverToml = /ConfigLoadingException:\s*Failed loading config file\s+(\S+\.toml)\s+of type SERVER for modid\s+(\S+)/i;
  const m = serverToml.exec(scanText);
  if (!m) return null;
  if (!scanText.includes('ParsingException')
    && !scanText.toLowerCase().includes('com.electronwill.nightconfig')) {
    return null;
  }
  const configFile = m[1];
  const modId = sanitizeModId(m[2].replace(/[,.]+$/, ''));
  return classification(
    'mod',
    FK_MOD_LOAD_CONFIG,
    modId,
    modId != null ? modId : fallbackPrimary,
    null,
    [
      `Delete or fix corrupt SERVER config ${configFile}${modId != null ? ` for mod '${modId}'` : ''}.`,
      'Back up the file first, then let the mod regenerate defaults on restart.',
    ],
    { config_file: configFile, config_path: configFile, config_type: 'SERVER' },
  );
}

function classifyInvalidResourceLocation(scanText, fallbackPrimary) {
  if (!scanText) return null;
  const pat = /ResourceLocationException:\s*Non \[a-z0-9\/._-\] character in path of location:\s*(\S+)/i;
  const m = pat.exec(scanText);
  if (!m) return null;
  const location = m[1];
  let ns = null;
  const colon = location.indexOf(':');
  if (colon > 0) ns = sanitizeModId(location.slice(0, colon));
  if (ns === 'minecraft') ns = null;
  return classification(
    'mod',
    FK_MOD_LOAD_ASSET,
    ns,
    ns != null ? ns : fallbackPrimary,
    null,
    [
      `A resource path has an illegal character: ${location} — fix the datapack/mod asset name (only a-z 0-9 / . _ -).`,
    ],
    { invalid_location: location },
  );
}

function classifyDuplicateMods(scanText, ctx, fallbackPrimary) {
  if (!scanText || !ctx || !ctx.bootFailed) return null;
  const lower = scanText.toLowerCase();
  if (!lower.includes('found duplicate mods:')) return null;
  if (!lower.includes('earlyloadingexception') && !lower.includes('modloadingexception')) return null;
  if (!lower.includes('duplicate mods')) return null;
  const dupIds = [];
  const dupJars = [];
  const idRe = /Mod ID:\s*'([^']+)'\s+from mod files:\s*\[([^\]]+)\]/gi;
  let m;
  while ((m = idRe.exec(scanText)) !== null) {
    dupIds.push(m[1].trim());
    for (const jar of m[2].split(',')) {
      const j = jar.trim();
      if (j) dupJars.push(j);
    }
  }
  const details = {};
  if (dupIds.length) details.duplicate_mod_ids = dupIds;
  if (dupJars.length) details.duplicate_jars = dupJars;
  const primary = dupIds.length ? sanitizeModId(dupIds[0]) : null;
  const hints = dupJars.length
    ? [
      `Remove duplicate jar(s) from mods/: ${dupJars[0]}${dupJars.length > 1 ? ' (and other listed copies).' : '.'}`,
      'Keep only one jar per mod id, then restart.',
    ]
    : [
      'Remove duplicate mod jars from mods/ (same mod id installed twice).',
      'Keep only one jar per mod id, then restart.',
    ];
  return classification(
    'mod',
    FK_MOD_LOAD_DUPLICATE,
    primary,
    primary != null ? primary : fallbackPrimary,
    null,
    hints,
    details,
  );
}

function classifyLanguageProviderMismatch(scanText, ctx, fallbackPrimary) {
  if (!scanText || !ctx || !ctx.bootFailed) return null;
  if (!scanText.includes('needs language provider')) return null;
  if (!scanText.includes('We have found')) return null;
  const details = {};
  const need = /Mod File\s+(\S+)\s+needs language provider\s+(\S+)/i.exec(scanText);
  let suspect = null;
  if (need) {
    details.mod_file = need[1];
    details.required_provider = need[2].replace(/[,:]+$/, '');
    suspect = sanitizeModId(need[1]);
  }
  const found = /We have found\s+(.+)/i.exec(scanText);
  if (found) {
    const providers = [];
    const rest = found[1].trim();
    if (!rest.toLowerCase().startsWith('0 ')) {
      for (const part of rest.split(/[,;]/)) {
        const p = part.trim().replace(/\s*language providers?.*$/i, '').trim();
        if (p && !/^\d+$/.test(p)) providers.push(p);
      }
    }
    details.found_providers = providers;
  }
  const hints = [
    'Install the missing language provider or dependency named in the FML banner.',
  ];
  if (suspect) {
    hints.push(`Suspect mod file points to '${suspect}' — update that jar or install the provider/library it requires.`);
  }
  if (details.found_providers?.length) {
    hints.push('Found providers listed in the report — compare them to what the mod declares it needs.');
  }
  return classification(
    'mod',
    FK_MOD_LOAD_DEPENDENCY,
    suspect,
    suspect != null ? suspect : fallbackPrimary,
    null,
    hints,
    details,
  );
}

function classifyFeatureOrderCycle(scanText, fallbackPrimary) {
  if (!scanText) return null;
  const lower = scanText.toLowerCase();
  if (!lower.includes('feature order cycle')
    && !lower.includes('featurecycleexception')
    && !lower.includes('a feature cycle was found')) {
    return null;
  }
  return classification(
    'mod',
    FK_MOD_LOAD_WORLDGEN,
    null,
    fallbackPrimary,
    null,
    [
      'Remove the last-added biome/terrain mod first, then retest boot.',
      'Worldgen feature order cycle — remove or update the conflicting worldgen/biome mods.',
      'Check Cyanide / feature-cycle reports in the log for the exact cycle path.',
    ],
  );
}

function classifyFerriteNeighborTable(scanText, fallbackPrimary) {
  if (!scanText) return null;
  if (!scanText.includes('populateNeighborTable')
    && !scanText.includes('state neighbor table directly')) {
    return null;
  }
  if (!scanText.includes('FerriteCore') && !scanText.toLowerCase().includes('ferritecore')) {
    if (!scanText.includes('malte0811/FerriteCore')) return null;
  }
  return classification(
    'mod',
    FK_MOD_LOAD_COMPAT,
    'ferritecore',
    'ferritecore',
    null,
    [
      'Set FerriteCore config populateNeighborTable to false as a temporary workaround.',
      "Report the accessing mod on FerriteCore's issue tracker.",
    ],
  );
}

function classifyCreateEcosystem(scanText, ctx, fallbackPrimary) {
  if (!scanText || !ctx) return null;
  const gate = ModListGate.fromMods(ctx.mods);
  if (!gate.requiresMod('create')) return null;
  const createVer = modVersion(ctx.mods, 'create');
  const railwaysVer = modVersion(ctx.mods, 'railways');
  let railwaysMismatch = false;
  if (createVer != null && railwaysVer != null) {
    const railwaysBase = railwaysVer.split('-')[0];
    const create6 = createVer.startsWith('6');
    if (create6) {
      railwaysMismatch = compareVersions(railwaysBase, '1.6.10') < 0;
    } else {
      railwaysMismatch = compareVersions(railwaysBase, '1.6.10') >= 0;
    }
  }
  const missingCreateClass = CREATE_MISSING_CLASS.test(scanText);
  if (!railwaysMismatch && !missingCreateClass) return null;
  const details = { ecosystem: 'create6' };
  if (createVer != null) details.create_version = createVer;
  if (railwaysVer != null) {
    details.railways_version = railwaysVer;
    details.related_mod_id = 'railways';
  }
  details.ecosystem_issue = railwaysMismatch ? 'create_railways_mismatch' : 'create_missing_class';
  const hints = railwaysMismatch
    ? [
      "Update Create Steam 'n' Rails (Railways) to ≥ 1.6.10 for Create 6.x (or align Create major with your Railways build).",
      'Align Create addons to the same Create major version, then restart.',
    ]
    : [
      "Align Create and Create Steam 'n' Rails (Railways) versions — Create 6 needs Railways ≥1.6.10.",
      'Align Create addons to the same Create major version, then restart.',
    ];
  if (modVersion(ctx.mods, 'flywheel') || /flywheel/i.test(scanText)) {
    hints.push('If a separate Flywheel jar is installed, remove conflicting copies — Create already bundles the matching Flywheel.');
  }
  return classification(
    'mod',
    FK_MOD_LOAD_ECOSYSTEM,
    railwaysMismatch ? 'railways' : 'create',
    'create',
    null,
    hints,
    details,
  );
}

function classifyEpicFightOrAzure(scanText, ctx, fallbackPrimary) {
  if (!scanText || !ctx) return null;
  const gate = ModListGate.fromMods(ctx.mods);
  if (gate.requiresMod('epicfight') && EPICFIGHT_MISSING.test(scanText)) {
    return classification(
      'mod',
      FK_MOD_LOAD_ECOSYSTEM,
      'epicfight',
      'epicfight',
      null,
      ['Epic Fight class missing — update Epic Fight and its addons together.'],
      { ecosystem: 'epicfight' },
    );
  }
  if (gate.requiresMod('azurelib') && AZURELIB_MISSING.test(scanText)) {
    return classification(
      'mod',
      FK_MOD_LOAD_ECOSYSTEM,
      'azurelib',
      'azurelib',
      null,
      ['AzureLib class missing — update AzureLib and mods that depend on it.'],
      { ecosystem: 'azurelib' },
    );
  }
  return null;
}

function classifyKubeJsDatapack(scanText, ctx, fallbackPrimary) {
  if (!scanText || !ctx || !ModListGate.fromMods(ctx.mods).requiresMod('kubejs')) return null;
  if (!scanText.includes('Failed to parse ')
    || !scanText.includes('KubeJS Resource Pack [data]')) {
    return null;
  }
  return classification(
    'mod',
    FK_MOD_LOAD_SCRIPT,
    'kubejs',
    'kubejs',
    null,
    [
      'Fix or remove the broken KubeJS datapack script cited in the log.',
      'Check kubejs/data for invalid JSON or recipes.',
    ],
  );
}

function classifyUnsupportedClassVersion(scanText, fallbackPrimary) {
  if (!scanText) return null;
  const m = UNSUPPORTED_CLASS_VERSION.exec(scanText);
  if (!m) return null;
  const className = m[1];
  if (isVanillaPackage(className)) return null;
  const compiledCf = Number.parseInt(m[2], 10);
  const runtimeCf = Number.parseInt(m[3], 10);
  const compiledJava = compiledCf - 44;
  const runtimeJava = runtimeCf - 44;
  const javaMismatch = {
    compiled_java: compiledJava,
    runtime_java: runtimeJava,
    class_name: className,
  };
  let firstHint;
  if (compiledJava >= 21 && runtimeJava < 21) {
    firstHint = `Upgrade the server JVM to Java 21+ (NeoForge 1.21 expects it). This mod was compiled for Java ${compiledJava} but the server runs Java ${runtimeJava}.`;
  } else if (compiledJava > runtimeJava) {
    firstHint = `Upgrade the server JVM to Java ${compiledJava} (or install an older build of the mod compiled for Java ${runtimeJava}).`;
  } else {
    firstHint = `A mod was compiled for Java ${compiledJava} but the server runs Java ${runtimeJava} — upgrade the JVM or use an older mod build.`;
  }
  return classification(
    'loader',
    FK_PLATFORM_MISMATCH,
    null,
    fallbackPrimary,
    null,
    [firstHint],
    {
      class_name: className,
      compiled_java: compiledJava,
      runtime_java: runtimeJava,
      java_mismatch: javaMismatch,
    },
  );
}

function classifyEnvLock(scanText, fallbackPrimary) {
  if (!scanText) return null;
  const m = ENV_LOCK.exec(scanText);
  if (!m) return null;
  const path = m[1];
  const hints = [
    `Stop other Java/Minecraft instances (and close Explorer previews / antivirus locks) holding: ${path}`,
  ];
  if (/session\.lock/i.test(path)) {
    hints.push('Only delete world/session.lock after confirming nothing is using this world folder.');
  } else {
    hints.push('If the lock persists after all Minecraft/Java processes are closed, reboot once, then start the server.');
  }
  return classification(
    'host_resource',
    FK_ENV_LOCK,
    null,
    fallbackPrimary,
    null,
    hints,
    { locked_path: path },
  );
}

/** CA-02…CA-15 ordered rules (after CA-01, before generic isModLoad). */
export function classifyCaParity(scanText, ctx, fallbackPrimary) {
  return classifyMixinConflict(scanText, ctx, fallbackPrimary)
    || classifyServerConfig(scanText, fallbackPrimary)
    || classifyInvalidResourceLocation(scanText, fallbackPrimary)
    || classifyDuplicateMods(scanText, ctx, fallbackPrimary)
    || classifyLanguageProviderMismatch(scanText, ctx, fallbackPrimary)
    || classifyFeatureOrderCycle(scanText, fallbackPrimary)
    || classifyFerriteNeighborTable(scanText, fallbackPrimary)
    || classifyCreateEcosystem(scanText, ctx, fallbackPrimary)
    || classifyEpicFightOrAzure(scanText, ctx, fallbackPrimary)
    || classifyKubeJsDatapack(scanText, ctx, fallbackPrimary)
    || classifyUnsupportedClassVersion(scanText, fallbackPrimary)
    || classifyEnvLock(scanText, fallbackPrimary)
    || null;
}

export function resolveOomKind(scanText, combined) {
  const blob = `${scanText || ''} ${combined || ''}`.toLowerCase();
  if (blob.includes('direct buffer memory')
    || blob.includes('unable to create new native thread')
    || blob.includes('insufficient memory for the java runtime')
    || blob.includes('native memory allocation')) {
    return 'native';
  }
  return 'heap';
}

export function isNativeOom(scanText, combined) {
  const blob = `${scanText || ''} ${combined || ''}`.toLowerCase();
  return blob.includes('insufficient memory for the java runtime')
    || blob.includes('native memory allocation');
}

function hintsOom(oomKind) {
  if (oomKind === 'native') {
    return [
      'Native/direct memory exhausted — do not raise -Xmx as the first fix.',
      'Lower direct-buffer / native pressure, or raise OS RAM / page file.',
      'Check for native leaks (too many threads, worldgen, or conflicting render libs); FerriteCore / ModernFix tips can help.',
    ];
  }
  return [
    'Confirm the pack needs more heap before raising RAM — oversized packs and leaks look the same.',
    'Increase Java heap (-Xmx) only if the host still has free RAM; otherwise find leaks or shrink the pack.',
    'Check duplicate mods, oversized chunk loaders, or run Spark heap analysis.',
  ];
}

function isWatchdog(combined, exception, root) {
  if (combined.includes('serverhangwatchdog') || combined.includes('single server tick took')) return true;
  return exception?.includes('ServerHangWatchdog') || root?.includes('ServerHangWatchdog');
}

function isOom(combined) {
  return combined.includes('outofmemoryerror')
    || combined.includes('java heap space')
    || combined.includes('direct buffer memory')
    || combined.includes('gc overhead limit')
    || combined.includes('unable to create new native thread');
}

function isWorldNbtCorrupt(combined, description) {
  const desc = (description || '').toLowerCase();
  const nbtDesc = desc.includes('loading nbt') || desc.includes('nbt data');
  const zlib = combined.includes('zlib') || combined.includes('unexpected end of zlib') || combined.includes('eofexception');
  const nbtStack = combined.includes('nbtio') || combined.includes('chunkserializer') || combined.includes('nbt');
  return (nbtDesc && (zlib || nbtStack)) || (zlib && nbtStack);
}

function isModLoad(combined, failure, exception) {
  if (combined.includes('modloadingcrash')
    || combined.includes('mod loading has failed')
    || combined.includes('modloadingexception')
    || combined.includes('fmlmodloading')
    || combined.includes('mod loading error')) return true;
  if (failure && failure.toLowerCase().includes('mod')) return true;
  return exception && (exception.includes('ModLoading') || exception.includes('ModException'));
}

function isModRelated(combined, modFile, exception, description, primary, stackText) {
  if (modFile && sanitizeModId(modFile) && modFile !== 'java.lang.Error') return true;
  if (primary) return true;
  if (combined.includes('modloadingcrash')
    || combined.includes('mod loading has failed')
    || combined.includes('modloadingexception')
    || combined.includes('fmlmodloading')) return true;
  if (exception && (exception.includes('ModLoading') || exception.includes('ModException'))) return true;
  if (description) {
    const d = description.toLowerCase();
    if (d.includes('mod') || d.includes('mixin') || d.includes('contraption')) return true;
  }
  if (stackText && /TRANSFORMER\/([a-z][\w-]*)@/i.test(stackText)) return true;
  return /mod id\s+['"]?([a-z][\w-]*)['"]?/i.test(combined);
}

function isLoader(combined) {
  return combined.includes('neoforged')
    || combined.includes('net.neoforged')
    || combined.includes('cpw.mods')
    || combined.includes('fml early loading')
    || combined.includes('bootstrap');
}

function stallModFrom(crash, primary, stackText, combined) {
  const existing = sanitizeModId(str(crash, 'stall_mod_id'));
  if (existing && PREGEN_STALL_MODS.has(existing)) return existing;
  if (primary && PREGEN_STALL_MODS.has(primary)) return primary;
  for (const id of PREGEN_STALL_MODS) {
    if (combined.includes(id) || (stackText && stackText.toLowerCase().includes(id))) return id;
  }
  return null;
}

function suspectModId(modFile, exception, summary) {
  const fromFile = sanitizeModId(modFile);
  if (fromFile) return fromFile;
  const mod = /Mod\s+\(([^)]+)\)/i.exec(exception || '');
  if (mod) return sanitizeModId(mod[1].trim());
  const fml = /mod id\s+['"]?([a-z][\w-]*)['"]?/i.exec(`${exception || ''} ${summary || ''}`);
  if (fml) return sanitizeModId(fml[1].trim());
  const ns = /([a-z][\w]*):[\w./_-]+/g.exec(summary || '');
  if (ns) return sanitizeModId(ns[1]);
  return null;
}

const COLLIDER_MIXIN_ADDONS = ['createbigcannons', 'aeronautics', 'sable', 'create_sa', 'createaddition'];

function modVersionOf(mods, id) {
  if (!Array.isArray(mods) || !id) return null;
  for (const m of mods) {
    const mid = m?.id ?? m?.mod_id;
    if (String(mid || '').toLowerCase() === String(id).toLowerCase()) {
      return m?.version ?? m?.mod_version ?? null;
    }
  }
  return null;
}

function hasMod(mods, id) {
  return modVersionOf(mods, id) != null
    || (Array.isArray(mods) && mods.some((m) => String((m?.id ?? m?.mod_id) || '').toLowerCase() === String(id).toLowerCase()));
}

function hintsMod(suspect, combined, details = {}, ctx = null, scanText = '') {
  const hints = [];
  const createContraption = details?.create_issue === CREATE_ISSUE_CONTRAPTION;
  const createVer = ctx ? (modVersion(ctx.mods, 'create') || modVersionOf(ctx.mods, 'create')) : null;
  if (suspect === 'create') {
    if (createContraption) {
      hints.push('Find the contraption controller / bearing and break it to stop the stuck assembly so the world can load.');
      hints.push('Reduce stress or split oversized contraptions near the crash location.');
      if (createVer && String(createVer).startsWith('6.0.10')) {
        hints.push('Create 6.0.10 has a known contraption collision NPE — update Create when a fixed build is available, or temporarily roll back to 6.0.9.');
      } else {
        hints.push('Update Create if a newer NeoForge build exists; check the Create issue tracker for collision NPEs.');
      }
      const addons = COLLIDER_MIXIN_ADDONS.filter((id) => hasMod(ctx?.mods, id));
      if (addons.length) {
        hints.push(`Also check collider-mixin addons (${addons.join(', ')}) for versions matching Create.`);
      }
    } else {
      const outdated = !!details?.modrinth_outdated;
      if (outdated || (createVer && String(createVer).startsWith('6.0.10'))) {
        hints.push('Update Create to a matching NeoForge build, then restart and watch for repeats.');
      } else {
        hints.push('Inspect the Create stack frames and update matching Create addons if versions look mismatched.');
      }
      hints.push('Restart the server and watch for repeats after any jar change.');
      const blob = `${scanText || ''} ${combined || ''}`.toLowerCase();
      if (blob.includes('flywheel')) {
        hints.push('Flywheel appears on the stack — remove conflicting separate Flywheel jars (Create bundles the matching one).');
      }
    }
  } else if (suspect) {
    hints.push(`Update or temporarily remove mod '${suspect}', then restart.`);
    if (combined && (combined.includes('zip') || combined.includes('corrupt') || combined.includes('invalid cen') || combined.includes('end header'))) {
      hints.push('Re-download the mod JAR from the official source — the jar may be corrupt.');
    }
  } else {
    hints.push('Open the crash report and find the mod cited in the stack trace.');
    hints.push('Update or remove the suspected mod, then restart the server.');
  }
  if (combined && combined.includes('mixin') && !createContraption) {
    hints.push('If mixins are involved, update both conflicting mods to versions tested together.');
  }
  return hints;
}

export function detectCreateIssue(scanText) {
  if (!scanText || !String(scanText).trim()) return null;
  if (CREATE_CONTRAPTION_EVIDENCE.test(String(scanText))) return CREATE_ISSUE_CONTRAPTION;
  return null;
}

function exceptionClassFrom(exception, scanText) {
  if (exception && String(exception).trim()) {
    const first = String(exception).trim();
    const colon = first.indexOf(':');
    const head = colon > 0 ? first.slice(0, colon).trim() : first;
    if (head.includes('.') && (head.endsWith('Exception') || head.endsWith('Error'))) {
      return head;
    }
    const m = EXCEPTION_CLASS.exec(exception);
    if (m) return m[1];
  }
  if (scanText) {
    const m = EXCEPTION_CLASS.exec(scanText);
    if (m) return m[1];
  }
  return null;
}

function enrichModRuntimeDetails(scanText, linkedMod, exception) {
  const details = {};
  const exClass = exceptionClassFrom(exception, scanText);
  if (exClass) details.exception_class = exClass;
  if (String(linkedMod || '').toLowerCase() === 'create') {
    const issue = detectCreateIssue(scanText);
    if (issue) details.create_issue = issue;
    const hot = CREATE_HOT_FRAME.exec(scanText || '');
    if (hot) details.hot_frame = `${hot[1]}.${hot[2]}`;
  }
  return details;
}

function hintsWatchdogPregen(stallMod) {
  return [
    'Pause Chunky / map pregen or reduce radius before changing RAM or other settings.',
    `Defer ${stallMod} full render until pregen completes.`,
    'Restart the server and watch MSPT before re-enabling pregen.',
  ];
}

function hintsWatchdog() {
  return [
    'Read the watchdog thread dump — the stuck stack names the hang (mod, worldgen, or farm).',
    'Pause Chunky / Distant Horizons / map render only if pregen or those mods appear in the dump.',
    'If MSPT was high, reduce simulation distance or find chunk loaders / rogue entities.',
  ];
}

function hintsNbt() {
  return [
    'Back up the world, then restore the affected region/chunk from a known-good backup.',
    'Only delete or repair the bad region file after the backup exists.',
    'Check disk health; ZLIB/EOF errors often mean incomplete writes.',
  ];
}

function hintsHostResource(combined, exception) {
  if (combined.includes('serverhangwatchdog') || exception?.includes('ServerHangWatchdog')) {
    return hintsWatchdog();
  }
  if (combined.includes('outofmemory') || combined.includes('heap space')) {
    return hintsOom('heap');
  }
  return ['Host or JVM resource limit hit — review CPU, RAM, and disk at crash time.'];
}

function hintsLoader() {
  return [
    'Open the crash report and read the root exception / Mod Resolution section first.',
    'Compare NeoForge and Minecraft versions with your modpack requirements.',
    'If still stuck, remove recently added mods one at a time until the server starts.',
  ];
}

function hintsUnknown() {
  return [
    'Read the full crash report under crash-reports/ for the root exception.',
    "Search the mod id or exception online or in your pack's issue tracker.",
    'Acknowledge after review if the crash is historical and already resolved.',
  ];
}

/**
 * @param {object} crash
 * @param {{ mods?: object[], mixinIndex?: object, bootFailed?: boolean }} [ctx]
 */
export function classifyCrash(crash, ctx) {
  const context = normalizeContext(ctx);
  const exception = str(crash, 'exception');
  const modFile = str(crash, 'mod_file');
  const summary = str(crash, 'summary');
  const description = str(crash, 'description');
  const failure = str(crash, 'failure_message');
  const root = str(crash, 'root_exception');
  const primaryFromParse = sanitizeModId(str(crash, 'primary_mod_id'));
  const combined = `${exception || ''} ${modFile || ''} ${summary || ''} ${description || ''} ${failure || ''} ${root || ''}`.toLowerCase();
  const stackText = stackBlob(crash);
  const scanText = buildScanText(crash, stackText);
  let primary = primaryFromParse || firstTransformerMod(stackText) || firstTransformerMod(combined);

  if (isWorldNbtCorrupt(combined, description)) {
    return classification('host_resource', FK_WORLD_NBT_CORRUPT, null, primary, null, hintsNbt());
  }

  if (isWatchdog(combined, exception, root)) {
    const stall = stallModFrom(crash, primary, stackText, combined);
    return classification(
      'host_resource',
      stall ? FK_WATCHDOG_PREGEN : FK_WATCHDOG,
      stall || primary,
      primary,
      stall,
      stall ? hintsWatchdogPregen(stall) : hintsWatchdog(),
    );
  }

  if (isOom(combined) || isNativeOom(scanText, combined)) {
    const oomKind = resolveOomKind(scanText, combined);
    return classification(
      'host_resource',
      FK_HOST_RESOURCE,
      null,
      primary,
      null,
      hintsOom(oomKind),
      { oom_kind: oomKind },
    );
  }

  const mixin = classifyMixinInit(scanText, context, primary);
  if (mixin) return mixin;

  const ca = classifyCaParity(scanText, context, primary);
  if (ca) return ca;

  if (isModLoad(combined, failure, exception)) {
    const suspect = sanitizeModId(suspectModId(modFile, exception, summary)) || primary;
    const kind = combined.includes('kubejs') || combined.includes('script')
      ? FK_MOD_LOAD_SCRIPT
      : FK_MOD_LOAD_DEPENDENCY;
    const linked = primary || suspect;
    const details = enrichModRuntimeDetails(scanText, linked, exception);
    return classification('mod', kind, suspect, linked, null, hintsMod(suspect, combined, details, context, scanText), details);
  }

  if (isModRelated(combined, modFile, exception, description, primary, stackText)) {
    const suspect = sanitizeModId(suspectModId(modFile, exception, summary)) || primary;
    const linked = primary || suspect;
    const details = enrichModRuntimeDetails(scanText, linked, exception);
    return classification(
      'mod',
      FK_MOD_RUNTIME,
      suspect,
      linked,
      null,
      hintsMod(suspect, combined, details, context, scanText),
      details,
    );
  }

  if (isLoader(combined)) {
    return classification('loader', FK_LOADER, null, primary, null, hintsLoader());
  }

  if (isOom(combined) || isWatchdog(combined, exception, null)) {
    return classification(
      'host_resource',
      FK_HOST_RESOURCE,
      null,
      primary,
      null,
      hintsHostResource(combined, exception),
    );
  }

  return classification('unknown', FK_UNKNOWN, null, primary, null, hintsUnknown());
}
