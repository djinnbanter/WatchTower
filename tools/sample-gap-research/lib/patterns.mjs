export const SIGNAL_PATTERNS = [
  { id: 'server_done', re: /Done \(\d+\.?\d*s\)! For help/i, category: 'lifecycle', wt_readers: ['LogScanner'], logscanner_field: 'server_started', should_be_issue: false, default_severity: 1 },
  { id: 'server_stop', re: /Stopping server/i, category: 'lifecycle', wt_readers: ['LogScanner'], logscanner_field: 'clean_shutdown', should_be_issue: false, default_severity: 1 },
  { id: 'tick_lag_cant_keep_up', re: /Can't keep up/i, category: 'tick_lag', wt_readers: ['LogScanner', 'OpsLogTailScanner'], logscanner_field: 'cant_keep_up_*', should_be_issue: true, default_severity: 4 },
  { id: 'watchdog_fatal', re: /ServerHangWatchdog|Server Watchdog\/FATAL|single server tick took/i, category: 'watchdog', wt_readers: ['CrashReportScanner', 'LogScanner'], logscanner_field: 'WATCHDOG_FATAL_LOG', should_be_issue: true, default_severity: 5 },
  { id: 'oom_heap', re: /OutOfMemoryError|Java heap space/i, category: 'oom', wt_readers: ['LogScanner'], logscanner_field: 'oom_evidence', should_be_issue: true, default_severity: 5 },
  { id: 'nosuchmethod', re: /NoSuchMethodError/i, category: 'mod_compat', wt_readers: ['CrashReportScanner', 'CrashClassifier'], logscanner_field: 'none', should_be_issue: true, default_severity: 5 },
  { id: 'spark_profiler_inactive', re: /Profiler job no longer active/i, category: 'shutdown_noise', wt_readers: ['CrashReportScanner'], logscanner_field: 'none', should_be_issue: false, default_severity: 2 },
  { id: 'sable_body_removed', re: /Body has been removed/i, category: 'mod_runtime', wt_readers: ['CrashReportScanner'], logscanner_field: 'none', should_be_issue: true, default_severity: 5 },
  { id: 'jade_invwrapper_npe', re: /InvWrapper\.getInv\(\)|snownee\.jade/i, category: 'sidecar', wt_readers: [], logscanner_field: 'none', should_be_issue: true, default_severity: 3 },
  { id: 'kubejs_recipe_parse', re: /Failed to parse recipe|KubeRecipe/i, category: 'recipe_noise', wt_readers: ['ModLogAnalyzer'], logscanner_field: 'none', should_be_issue: true, default_severity: 3 },
  { id: 'createfood_recipe', re: /createfood:/i, category: 'recipe_noise', wt_readers: ['ModLogAnalyzer'], logscanner_field: 'none', should_be_issue: false, default_severity: 2 },
  { id: 'distxform_client', re: /RuntimeDistCleaner\/DISTXFORM|invalid dist DEDICATED_SERVER/i, category: 'boot_noise', wt_readers: ['ModLogAnalyzer'], logscanner_field: 'none', should_be_issue: false, default_severity: 2 },
  { id: 'loot_parse', re: /Couldn't parse element ResourceKey.*loot_table/i, category: 'datapack', wt_readers: ['ModLogAnalyzer', 'StartupProfileScanner'], logscanner_field: 'none', should_be_issue: true, default_severity: 3 },
  { id: 'db_addon_fail', re: /Database connection failed/i, category: 'addon_config', wt_readers: ['ModLogAnalyzer'], logscanner_field: 'none', should_be_issue: true, default_severity: 3 },
  { id: 'player_join', re: /joined the game/i, category: 'activity', wt_readers: ['OpsLogTailScanner', 'LogScanner'], logscanner_field: 'PLAYER_JOIN', should_be_issue: false, default_severity: 1 },
  { id: 'opac_better_commands', re: /opac_better_commands/i, category: 'mod_compat', wt_readers: ['CrashReportScanner'], logscanner_field: 'none', should_be_issue: true, default_severity: 5 },
];

export function matchSignals(line) {
  const hits = [];
  for (const p of SIGNAL_PATTERNS) {
    if (p.re.test(line)) hits.push(p.id);
  }
  return hits;
}

// Mirrors ModErrorCategory.classify (subset) — adapted from tools/analyze-log-corpus.mjs
export function modErrorCategory(line) {
  if (!line || line.includes('dev.mcstatus.watchtower')) return 'engine_packaging';
  if (line.includes('Attempted to load class net/minecraft/client')) return 'client_on_server';
  if (/provided by mod\s+(\w+)/i.test(line) && /does not exist/i.test(line)) return 'mod_corrupt';
  if (/Mod loading has failed|ModLoadingCrashException/i.test(line)) return 'mod_load_failed';
  if (/Parsing error loading recipe/i.test(line)) return 'recipe_missing_item';
  if (/Unknown item '/i.test(line)) return 'recipe_missing_item';
  if (/is not found from registry/i.test(line)) return 'registry_missing';
  if (/Couldn't parse element ResourceKey/i.test(line)) return 'loot_parse';
  if (/ingredient_serializer/i.test(line)) return 'recipe_format';
  if (/\/(ERROR|FATAL)\]/i.test(line)) {
    const m = line.match(/\/(ERROR|FATAL)\]\s*\[([^/\]]+)\//i);
    if (m) {
      let mod = m[2].toLowerCase();
      if (mod.includes('.')) mod = mod.slice(mod.lastIndexOf('.') + 1);
      if (!mod.startsWith('net.minecraft') && !mod.startsWith('net.neoforged') && !mod.startsWith('cpw.mods')) {
        return 'logger_error';
      }
    }
  }
  return null;
}
