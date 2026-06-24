/**
 * Port of ModErrorCategory.java — NeoForge mod log error categories.
 */
export const ModErrorCategory = {
  RECIPE_MISSING_ITEM: { id: 'recipe_missing_item', severityRank: 3 },
  RECIPE_COMPAT: { id: 'recipe_compat', severityRank: 2 },
  RECIPE_FORMAT: { id: 'recipe_format', severityRank: 2 },
  REGISTRY_MISSING: { id: 'registry_missing', severityRank: 2 },
  LOOT_PARSE: { id: 'loot_parse', severityRank: 2 },
  MOD_CORRUPT: { id: 'mod_corrupt', severityRank: 4 },
  MOD_LOAD_FAILED: { id: 'mod_load_failed', severityRank: 5 },
  CLIENT_ON_SERVER: { id: 'client_on_server', severityRank: 0 },
  ENGINE_PACKAGING: { id: 'engine_packaging', severityRank: 5 },
  LOGGER_ERROR: { id: 'logger_error', severityRank: 1 },
};

const RECIPE_PARSE = /Parsing error loading recipe\s+(\S+)/i;
const UNKNOWN_ITEM = /Unknown item '([^']+)'/i;
const PROVIDED_BY_MOD = /provided by mod\s+(\w+)/i;
const MOD_LOADING = /Mod\s+\(([^)]+)\)/i;
const MOD_LOAD_FAIL_PATTERN = /Mod loading has failed|ModLoadingCrashException/i;
const INGREDIENT_SERIALIZER = /ingredient_serializer\]:\s*(\w+)/i;
const LOGGER_MOD = /\[(ERROR|FATAL)\]\s*\[([^/\]]+)\//i;
const NAMESPACE = /([a-z][\w]*):[\w./_-]+/g;

function namespaceOf(resourceId) {
  if (!resourceId || !resourceId.includes(':')) return 'unknown';
  return resourceId.split(':')[0].trim();
}

function namespaceFrom(line) {
  const re = new RegExp(NAMESPACE.source, 'g');
  let m = re.exec(line);
  if (m) {
    const ns = m[1];
    if (ns !== 'minecraft' && ns !== 'neoforge') return ns;
    m = re.exec(line);
    if (m) return m[1];
  }
  return null;
}

function integrationMod(recipeId) {
  if (!recipeId) return null;
  const lower = recipeId.toLowerCase();
  if (!lower.includes('/integration/') && !lower.includes('/compat/')) return null;
  const colon = lower.indexOf(':');
  const slash = lower.indexOf('/', colon + 1);
  if (slash < 0) return null;
  const segment = lower.slice(slash + 1);
  const next = segment.indexOf('/');
  return next > 0 ? segment.slice(0, next) : null;
}

function isVanillaLogger(modId) {
  return modId.startsWith('net.minecraft')
    || modId.startsWith('net.neoforged')
    || modId.startsWith('cpw.mods');
}

/**
 * @returns {{ category: object, primaryMod: string, relatedMod: string|null, recipeId: string|null }|null}
 */
export function classifyModErrorLine(line) {
  if (!line || !line.trim()) return null;

  if (line.includes('dev.mcstatus.watchtower.core.report.ReportEngine')) {
    return { category: ModErrorCategory.ENGINE_PACKAGING, primaryMod: 'watchtower', relatedMod: null, recipeId: null };
  }
  if (line.includes('Attempted to load class net/minecraft/client')) {
    return { category: ModErrorCategory.CLIENT_ON_SERVER, primaryMod: 'unknown', relatedMod: null, recipeId: null };
  }

  const provided = PROVIDED_BY_MOD.exec(line);
  if (provided && line.toLowerCase().includes('does not exist')) {
    return { category: ModErrorCategory.MOD_CORRUPT, primaryMod: provided[1].trim(), relatedMod: null, recipeId: null };
  }

  if (MOD_LOAD_FAIL_PATTERN.test(line)) {
    const mod = MOD_LOADING.exec(line);
    const modId = mod ? mod[1].trim() : namespaceFrom(line);
    return { category: ModErrorCategory.MOD_LOAD_FAILED, primaryMod: modId || 'unknown', relatedMod: null, recipeId: null };
  }

  const recipe = RECIPE_PARSE.exec(line);
  if (recipe) {
    const recipeId = recipe[1].trim();
    const owner = namespaceOf(recipeId);
    const related = integrationMod(recipeId);
    let cat = related ? ModErrorCategory.RECIPE_COMPAT : ModErrorCategory.RECIPE_FORMAT;
    if (line.includes('Unknown item') || line.includes('not found from registry')) {
      cat = ModErrorCategory.RECIPE_MISSING_ITEM;
    }
    return { category: cat, primaryMod: owner, relatedMod: related, recipeId };
  }

  const unknown = UNKNOWN_ITEM.exec(line);
  if (unknown) {
    const itemId = unknown[1].trim();
    return { category: ModErrorCategory.RECIPE_MISSING_ITEM, primaryMod: namespaceOf(itemId), relatedMod: null, recipeId: itemId };
  }

  if (line.includes('is not found from registry')) {
    const ns = namespaceFrom(line);
    return { category: ModErrorCategory.REGISTRY_MISSING, primaryMod: ns || 'unknown', relatedMod: null, recipeId: null };
  }

  if (line.includes("Couldn't parse element ResourceKey")) {
    const ns = namespaceFrom(line);
    return { category: ModErrorCategory.LOOT_PARSE, primaryMod: ns || 'unknown', relatedMod: null, recipeId: null };
  }

  if (line.includes('ingredient_serializer')) {
    const ser = INGREDIENT_SERIALIZER.exec(line);
    const missing = ser ? ser[1] : namespaceFrom(line);
    return { category: ModErrorCategory.RECIPE_FORMAT, primaryMod: missing || 'unknown', relatedMod: null, recipeId: null };
  }

  if (line.includes('[ERROR]') || line.includes('[FATAL]')) {
    const logMod = LOGGER_MOD.exec(line);
    if (logMod) {
      let modId = logMod[2].trim().toLowerCase();
      if (modId.includes('.')) modId = modId.slice(modId.lastIndexOf('.') + 1);
      if (!isVanillaLogger(modId)) {
        return { category: ModErrorCategory.LOGGER_ERROR, primaryMod: modId, relatedMod: null, recipeId: null };
      }
    }
  }

  if (line.toLowerCase().includes('requires ') && line.includes(' or above')) {
    const req = /Mod\s+(\w+)\s+requires\s+(\w+)/i.exec(line);
    if (req) {
      return { category: ModErrorCategory.MOD_LOAD_FAILED, primaryMod: req[1], relatedMod: req[2], recipeId: null };
    }
  }

  return null;
}

/** Port of ModLogAnalyzer.java */
export function aggregateModLogErrors(lines) {
  const byMod = new Map();

  function record(modId, hit, line) {
    if (!byMod.has(modId)) byMod.set(modId, { mod_id: modId, total: 0, by_category: {}, samples: [], top_recipes: [], recipeSeen: new Set() });
    const stats = byMod.get(modId);
    stats.total++;
    const cat = hit.category.id;
    stats.by_category[cat] = (stats.by_category[cat] || 0) + 1;
    if (hit.recipeId && stats.recipeSeen.size < 5 && !stats.recipeSeen.has(hit.recipeId)) {
      stats.recipeSeen.add(hit.recipeId);
      stats.top_recipes.push(hit.recipeId);
    }
    if (stats.samples.length < 3) {
      let sample = line.trim();
      if (sample.length > 200) sample = sample.slice(0, 200);
      if (!stats.samples.includes(sample)) stats.samples.push(sample);
    }
  }

  for (const line of lines) {
    const hit = classifyModErrorLine(line);
    if (!hit) continue;
    let modId = hit.primaryMod;
    if (!modId || modId === 'unknown') {
      if (hit.category === ModErrorCategory.CLIENT_ON_SERVER) modId = 'client_noise';
      else continue;
    }
    record(modId, hit, line);
    if (hit.relatedMod) record(hit.relatedMod, hit, line);
  }

  const sorted = [...byMod.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 25);

  return sorted.map((s) => {
    const row = { mod_id: s.mod_id, total: s.total, by_category: s.by_category };
    if (s.samples[0]) row.sample_line = s.samples[0];
    if (s.top_recipes.length) row.top_recipes = s.top_recipes;
    return row;
  });
}
