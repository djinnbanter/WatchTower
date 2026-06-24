/**
 * Main DR analysis pipeline.
 */
import { buildStagingSkeleton } from './stagingBuilder.js';
import { scanLogs } from './logScanner.js';
import { scanCrashReports } from './crashScanner.js';
import { listModsFromJars } from './modJarReader.js';
import { buildFacts } from './drFactsBuilder.js';
import { writeBrief } from './briefWriter.js';
import { validateBundle } from './ingest.js';

/**
 * @param {import('./ingest.js').FileBundle} bundle
 * @param {{ loader?: string, lookbackHours?: number }} options
 */
export async function runAnalysis(bundle, options = {}) {
  const warnings = validateBundle(bundle);
  const staging = buildStagingSkeleton({
    loader: options.loader || 'neoforge',
    lookbackHours: options.lookbackHours ?? 168,
  });

  const logResult = scanLogs(bundle.logs);
  Object.assign(staging.minecraft, logResult.minecraft);
  staging.health_log_gap_minutes = logResult.health_log_gap_minutes;
  staging.optional.mod_log_errors = logResult.modLogErrors;
  staging.events.push(...logResult.events);

  const { reports, events } = scanCrashReports(bundle.crashes, staging._cutoffEpoch);
  staging.minecraft.new_crash_reports = reports;
  staging.events.push(...events);

  if (bundle.mods.length) {
    try {
      staging.optional.mods = await listModsFromJars(bundle.mods);
    } catch (e) {
      warnings.push(`Mod jar scan failed: ${e.message}`);
    }
  }

  if (bundle.priorFacts?.optional?.mods) {
    const priorIds = new Set(
      (bundle.priorFacts.optional.mods || []).map((m) => m.id),
    );
    const currentIds = new Set((staging.optional.mods || []).map((m) => m.id));
    const added = [...currentIds].filter((id) => !priorIds.has(id));
    const removed = [...priorIds].filter((id) => !currentIds.has(id));
    if (added.length || removed.length) {
      staging.optional.prior_mod_changes = { added, removed };
    }
  }

  staging.collection_warnings = warnings;
  staging.meta.collection_warnings = warnings;

  const facts = buildFacts(staging);
  const brief = writeBrief(facts);

  return { facts, brief, warnings };
}
