/**
 * Port of CrashNarrator.java
 */
import { classifyCrash } from './crashClassifier.js';

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

function hintsModLoad(suspect, failure) {
  const hints = [];
  if (suspect) {
    hints.push(`Update or reinstall ${suspect} from the official source.`);
    hints.push(`Check latest.log for missing dependencies for ${suspect}.`);
  } else {
    hints.push('Open latest.log and find which mod failed to load.');
  }
  if (failure?.toLowerCase().includes('dependency')) {
    hints.push('Install or update the dependency mod cited in the failure message.');
  }
  hints.push('Remove recently added mods one at a time until the server starts.');
  return hints;
}

export function narrateCrash(crash) {
  const exception = str(crash, 'exception');
  const root = str(crash, 'root_exception');
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
  if (!suspect && modFile) {
    suspect = modFile.replace('.jar', '').split('-')[0].toLowerCase();
  }

  if (isWatchdog(combined, exception, root)) {
    const ms = watchdogMs ?? 60000;
    const sec = Math.max(1, Math.floor(ms / 1000));
    return {
      plain_english: `The main server thread stopped responding for ~${sec}s (tick watchdog). Usually lag from world gen, pregen, or a heavy contraption — not necessarily a broken mod.`,
      likely_cause: 'Server hung',
      confidence: 'high',
      fix_hints: ['Check for heavy world gen or laggy contraptions before the hang.'],
      manual_review: false,
    };
  }

  if (isOom(combined)) {
    return {
      plain_english: 'Java ran out of heap memory during play.',
      likely_cause: 'Out of memory',
      confidence: 'high',
      fix_hints: ['Increase Java heap (-Xmx) if headroom is low.', 'Look for duplicate mods or memory leaks.'],
      manual_review: false,
    };
  }

  if (isModLoad(combined, failure, exception)) {
    const modLabel = suspect || 'a mod';
    return {
      plain_english: `NeoForge failed while loading ${modLabel} — often a version mismatch or missing dependency.`,
      likely_cause: 'Mod failed to load',
      confidence: suspect ? 'high' : 'medium',
      fix_hints: hintsModLoad(suspect, failure),
      manual_review: false,
    };
  }

  if (classification.category === 'mod' && suspect) {
    return {
      plain_english: `The crash points to mod ${suspect} — check for updates, corrupt jars, or mixin conflicts.`,
      likely_cause: 'Mod crash',
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

  const known = description || failure || exception || summary;
  let plain = 'We could not determine a specific cause';
  if (file) plain += ` for crash report ${file}`;
  if (time) plain += ` (${time})`;
  plain += '.';
  if (known) plain += ` The report mentions: ${known.length > 160 ? `${known.slice(0, 160)}…` : known}.`;

  return {
    plain_english: plain,
    likely_cause: 'Unknown',
    confidence: 'low',
    fix_hints: ['Open the full crash report and read the root exception.'],
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
