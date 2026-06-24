/**
 * Port of ModIssueAdvisor.java (DR subset).
 */
import { ModErrorCategory } from './modErrorCategory.js';

const MAX_RECOMMENDATIONS = 12;

function str(o, key) {
  return o?.[key] ?? null;
}

function topCategory(cats) {
  let best = null;
  let bestRank = -1;
  for (const [id, count] of Object.entries(cats || {})) {
    const cat = Object.values(ModErrorCategory).find((c) => c.id === id);
    const rank = cat ? cat.severityRank * 1000 + count : count;
    if (rank > bestRank) {
      bestRank = rank;
      best = cat;
    }
  }
  return best;
}

function relatedMods(cats, modId) {
  const related = [];
  for (const key of Object.keys(cats || {})) {
    if (key !== modId && !related.includes(key)) related.push(key);
  }
  return related.slice(0, 3);
}

function modDrFixSteps(modId, category) {
  if (category === 'mod_corrupt' || category === 'mod_load_failed') {
    return [
      `Remove the ${modId}.jar file from your server mods/ folder.`,
      'Start the server and wait for "Done!" — if it boots, that mod was blocking startup.',
      `Re-download ${modId} from the official source (Modrinth/CurseForge) and put the jar back in mods/.`,
      'Start again — if it fails the same way, leave the mod out or try a different version; you have confirmed the culprit.',
    ];
  }
  return null;
}

function applyUpdateAction(rec, category, modId, related) {
  switch (category.id) {
    case 'recipe_compat':
      rec.action = 'pair_update';
      rec.action_detail = `Update both ${modId} and ${related[0] || 'the paired mod'} to versions tested on your Minecraft version.`;
      break;
    case 'recipe_missing_item':
    case 'registry_missing':
      rec.action = 'install';
      rec.action_detail = `Install or update ${modId} to match your pack's Minecraft/NeoForge version.`;
      break;
    case 'mod_load_failed':
      rec.action = 'update';
      rec.action_detail = `Remove ${modId}, test startup, then reinstall if the server boots without it.`;
      break;
    case 'mod_corrupt':
      rec.action = 'remove';
      rec.action_detail = `Confirm ${modId} is the problem by removing it, testing startup, then reinstalling if needed.`;
      break;
    case 'recipe_format':
      rec.action = 'update';
      rec.action_detail = `Update ${modId} to a build for your Minecraft/NeoForge version.`;
      break;
    default:
      break;
  }
}

function buildRecommendation(modId, category, total, cats, row) {
  const rec = {
    mod_id: modId,
    category: category.id,
    count: total,
    severity: category.severityRank >= 4 ? 'warning' : category.severityRank >= 2 ? 'info' : 'low',
    by_category: { ...cats },
  };
  if (row.sample_line) rec.sample_line = row.sample_line;
  if (row.top_recipes) rec.top_recipes = row.top_recipes;

  const related = relatedMods(cats, modId);
  if (related.length) rec.related_mods = related;

  switch (category.id) {
    case 'mod_corrupt':
      rec.why = `Mod jar for ${modId} appears corrupt or incomplete on disk.`;
      rec.fix = `${modId} may be a bad download — confirm by removing it and testing startup.`;
      rec.fix_steps = modDrFixSteps(modId, 'mod_corrupt');
      break;
    case 'mod_load_failed':
      rec.why = `${modId} failed to load (dependency, mixin, or corrupt jar).`;
      rec.fix = `Test whether ${modId} is the blocker — remove it and try starting the server.`;
      rec.fix_steps = modDrFixSteps(modId, 'mod_load_failed');
      break;
    case 'recipe_missing_item':
      rec.why = `Recipes or tags reference items from ${modId} that are not registered.`;
      rec.fix = `Install or update mod '${modId}', or remove datapacks referencing ${modId}:*.`;
      rec.install_hint = `Ensure '${modId}' is installed and matches your pack versions.`;
      break;
    case 'recipe_compat':
      rec.why = `Integration recipes involve ${modId} and ${related[0] || 'another mod'}.`;
      rec.fix = `Update both mods to versions tested together.`;
      rec.install_hint = 'Check mod issue trackers for compat fixes.';
      break;
    default:
      rec.why = `${modId} logged ${total} error(s) in the lookback window.`;
      rec.fix = 'Review sample lines in latest.log.';
      rec.install_hint = `Update ${modId} if errors persist.`;
  }

  applyUpdateAction(rec, category, modId, related);
  return rec;
}

export function analyzeModIssues(optional) {
  const recommendations = [];
  const severeIssues = [];
  const seen = new Set();

  const errors = optional?.mod_log_errors ?? [];
  const ranked = [...errors].sort((a, b) => (b.total || 0) - (a.total || 0));

  for (const row of ranked) {
    if (recommendations.length >= MAX_RECOMMENDATIONS) break;
    const modId = str(row, 'mod_id');
    if (!modId) continue;
    const total = row.total || 0;
    const cats = row.by_category || {};
    const topCat = topCategory(cats);
    if (!topCat) continue;
    const key = `${modId}:${topCat.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const rec = buildRecommendation(modId, topCat, total, cats, row);
    recommendations.push(rec);
    if (topCat.severityRank >= 4 && total > 0) {
      severeIssues.push({ modId, message: rec.fix, category: topCat.id });
    }
  }

  return { recommendations, severeIssues };
}
