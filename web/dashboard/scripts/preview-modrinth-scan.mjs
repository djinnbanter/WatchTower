/**
 * Real Modrinth lookup for dashboard fixture preview when PREVIEW_MODS_DIR is set.
 * Hashes jars, POSTs /v2/version_files, GETs /v2/projects, then checks newer versions.
 * Lookup only — never downloads jars.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const VERSION_FILES_URL = 'https://api.modrinth.com/v2/version_files';
const PROJECTS_URL = 'https://api.modrinth.com/v2/projects';
const USER_AGENT = 'WatchTower-Preview/1.2 (djinnbanter/WatchTower; fixture preview)';
const HASH_CHUNK = 64;
const PROJECT_CHUNK = 100;
const DESCRIPTION_MAX = 400;
const CHANGELOG_MAX = 4000;

function envMcVersion(env = process.env) {
  return String(env.PREVIEW_MC_VERSION || '1.21.1').trim() || '1.21.1';
}

function envLoader(env = process.env) {
  return String(env.PREVIEW_LOADER || 'neoforge').trim() || 'neoforge';
}

export async function sha512Hex(filePath) {
  const hash = createHash('sha512');
  await pipeline(createReadStream(filePath), hash);
  return hash.digest('hex');
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function modrinthFetch(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      ...(init.headers || {}),
    },
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after') || 2);
    await sleep(Math.max(1, retry) * 1000);
    return modrinthFetch(url, init);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Modrinth ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function sideScoreFromProject(clientSide, serverSide) {
  const c = String(clientSide || 'unknown').toLowerCase();
  const s = String(serverSide || 'unknown').toLowerCase();
  if (s === 'required' || s === 'optional') return 'server_required';
  if (c === 'required' && (s === 'unsupported' || s === 'unknown')) return 'likely_removable';
  if (c === 'optional' && s === 'unsupported') return 'likely_removable';
  if (s === 'unsupported') return 'likely_removable';
  return 'unknown';
}

function primarySha512(version) {
  const files = Array.isArray(version?.files) ? version.files : [];
  const primary = files.find((f) => f?.primary) || files[0];
  return primary?.hashes?.sha512 || null;
}

function truncateDesc(raw) {
  if (!raw) return null;
  const t = String(raw).trim();
  if (t.length <= DESCRIPTION_MAX) return t;
  return `${t.slice(0, DESCRIPTION_MAX - 1)}…`;
}

function truncateChangelog(raw) {
  if (!raw) return null;
  const t = String(raw).trim();
  if (!t) return null;
  if (t.length <= CHANGELOG_MAX) return t;
  return `${t.slice(0, CHANGELOG_MAX - 1)}…`;
}

/**
 * @param {object} opts
 * @param {{ id: string, version?: string, display_name?: string, jar_file?: string, jar_path: string, disabled?: boolean }[]} opts.mods
 * @param {(progress: object) => void} [opts.onProgress]
 * @param {string} [opts.mcVersion]
 * @param {string} [opts.loader]
 * @param {boolean} [opts.checkUpdates] default true
 */
export async function runPreviewModrinthScan({
  mods,
  onProgress,
  mcVersion = envMcVersion(),
  loader = envLoader(),
  checkUpdates = true,
}) {
  const jars = mods.filter((m) => m.jar_path && !m.disabled);
  const totalHash = jars.length;
  const hashByPath = new Map();
  const pathByHash = new Map();

  for (let i = 0; i < jars.length; i += 1) {
    const m = jars[i];
    onProgress?.({
      stage: 'hash',
      stage_label: 'Hashing jars',
      stage_detail: `${m.jar_file || m.id}`,
      progress: { done: i, total: Math.max(totalHash, 1) },
    });
    try {
      const hex = await sha512Hex(m.jar_path);
      hashByPath.set(m.jar_path, hex);
      if (!pathByHash.has(hex)) pathByHash.set(hex, m.jar_path);
    } catch {
      /* skip unreadable */
    }
  }

  const hashes = [...new Set(hashByPath.values())];
  const versionByHash = new Map();

  for (let i = 0; i < hashes.length; i += HASH_CHUNK) {
    const chunk = hashes.slice(i, i + HASH_CHUNK);
    onProgress?.({
      stage: 'lookup',
      stage_label: 'Looking up Modrinth',
      stage_detail: `version_files ${Math.min(i + chunk.length, hashes.length)}/${hashes.length}`,
      progress: {
        done: Math.round(totalHash * 0.35 + (i / Math.max(hashes.length, 1)) * totalHash * 0.35),
        total: Math.max(totalHash, 1),
      },
    });
    const body = await modrinthFetch(VERSION_FILES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hashes: chunk, algorithm: 'sha512' }),
    });
    for (const hash of chunk) {
      if (body?.[hash]) versionByHash.set(hash, body[hash]);
    }
    await sleep(200);
  }

  const projectIds = [
    ...new Set(
      [...versionByHash.values()]
        .map((v) => v?.project_id)
        .filter((id) => typeof id === 'string' && id),
    ),
  ];
  const projects = new Map();
  for (let i = 0; i < projectIds.length; i += PROJECT_CHUNK) {
    const chunk = projectIds.slice(i, i + PROJECT_CHUNK);
    onProgress?.({
      stage: 'lookup',
      stage_label: 'Looking up Modrinth',
      stage_detail: `projects ${Math.min(i + chunk.length, projectIds.length)}/${projectIds.length}`,
      progress: {
        done: Math.round(totalHash * 0.7 + (i / Math.max(projectIds.length, 1)) * totalHash * 0.15),
        total: Math.max(totalHash, 1),
      },
    });
    const qs = encodeURIComponent(JSON.stringify(chunk));
    const arr = await modrinthFetch(`${PROJECTS_URL}?ids=${qs}`);
    if (Array.isArray(arr)) {
      for (const p of arr) {
        if (p?.id) projects.set(p.id, p);
      }
    }
    await sleep(200);
  }

  /** @type {Map<string, any>} */
  const newestByProject = new Map();
  if (checkUpdates) {
    const ids = [...projects.keys()];
    let done = 0;
    const concurrency = 4;
    async function worker(queue) {
      while (queue.length) {
        const projectId = queue.shift();
        if (!projectId) break;
        done += 1;
        onProgress?.({
          stage: 'lookup',
          stage_label: 'Checking updates',
          stage_detail: `versions ${done}/${ids.length}`,
          progress: {
            done: Math.round(totalHash * 0.85 + (done / Math.max(ids.length, 1)) * totalHash * 0.14),
            total: Math.max(totalHash, 1),
          },
        });
        try {
          const params = new URLSearchParams();
          params.set('loaders', JSON.stringify([loader]));
          params.set('game_versions', JSON.stringify([mcVersion]));
          let versions = await modrinthFetch(
            `https://api.modrinth.com/v2/project/${projectId}/version?${params}`,
          );
          if (!Array.isArray(versions) || versions.length === 0) {
            const loose = new URLSearchParams();
            loose.set('loaders', JSON.stringify([loader]));
            versions = await modrinthFetch(
              `https://api.modrinth.com/v2/project/${projectId}/version?${loose}`,
            );
          }
          if (Array.isArray(versions) && versions[0]) {
            newestByProject.set(projectId, versions[0]);
          }
        } catch {
          /* skip */
        }
        await sleep(120);
      }
    }
    const queue = [...ids];
    await Promise.all(Array.from({ length: concurrency }, () => worker(queue)));
  }

  const scanMods = [];
  const updates = [];
  let matched = 0;

  for (const m of jars) {
    const hash = hashByPath.get(m.jar_path);
    if (!hash) continue;
    const ver = versionByHash.get(hash);
    if (!ver?.project_id) {
      scanMods.push({
        id: m.id,
        display_name: m.display_name,
        version: m.version,
        jar_file: m.jar_file,
        jar: m.jar_file,
      });
      continue;
    }
    matched += 1;
    const project = projects.get(ver.project_id) || {};
    const slug = project.slug || null;
    const newest = newestByProject.get(ver.project_id);
    const newestHash = newest ? primarySha512(newest) : null;
    const outdated = !!(newestHash && hash && newestHash.toLowerCase() !== hash.toLowerCase());
    const compatId = newest?.id || null;
    const compatNum = newest?.version_number || null;
    const updateUrl =
      outdated && slug && compatId ? `https://modrinth.com/mod/${slug}/version/${compatId}` : null;

    const row = {
      id: m.id,
      display_name: project.title || m.display_name,
      version: m.version,
      jar_file: m.jar_file,
      jar: m.jar_file,
      modrinth_project_id: ver.project_id,
      modrinth_slug: slug,
      modrinth_url: slug ? `https://modrinth.com/mod/${slug}` : null,
      modrinth_title: project.title || null,
      modrinth_icon_url: project.icon_url || null,
      modrinth_description: truncateDesc(project.description),
      modrinth_version_id: ver.id || null,
      modrinth_version_number: ver.version_number || null,
      modrinth_outdated: outdated,
      modrinth_compatible_url: updateUrl,
      modrinth_cta_url: updateUrl || (slug ? `https://modrinth.com/mod/${slug}` : null),
      modrinth_compatible_version_number: outdated ? compatNum : null,
      modrinth_compatible_changelog: outdated ? truncateChangelog(newest?.changelog) : null,
      side_score: sideScoreFromProject(project.client_side, project.server_side),
      client_side: project.client_side || null,
      server_side: project.server_side || null,
      wiki_url: project.wiki_url || null,
      source_url: project.source_url || null,
      issues_url: project.issues_url || null,
      discord_url: project.discord_url || null,
    };
    if (Array.isArray(m.jar_in_jar) && m.jar_in_jar.length) {
      row.jar_in_jar = m.jar_in_jar;
      row.nested_mod_ids = Array.isArray(m.nested_mod_ids)
        ? m.nested_mod_ids
        : m.jar_in_jar.map((j) => j.id).filter(Boolean);
    }
    scanMods.push(row);

    if (outdated) {
      const update = {
        mod_id: m.id,
        display_name: row.display_name,
        current_version: ver.version_number || m.version,
        latest_compatible: compatNum,
        impact_verdict: 'unknown',
        impact_summary: 'Newer Modrinth build available for this loader/MC line.',
        confidence: 'medium',
        modrinth_compatible_url: updateUrl,
        modrinth_url: row.modrinth_url,
        changelog: row.modrinth_compatible_changelog,
      };
      // Create ↔ Flywheel pairing (matches ModrinthLookupService.buildUpdatesSummary)
      if (m.id === 'create' || m.id === 'flywheel') {
        update.related_pair = m.id === 'create' ? 'flywheel' : 'create';
      }
      updates.push(update);
    }
  }

  onProgress?.({
    stage: 'done',
    stage_label: 'Done',
    stage_detail: `Matched ${matched}/${jars.length}`,
    progress: { done: Math.max(totalHash, 1), total: Math.max(totalHash, 1) },
  });

  return {
    updated_at: new Date().toISOString(),
    mods: scanMods,
    updates,
    stats: {
      matched,
      jars_considered: jars.length,
      coverage_pct: jars.length ? Math.round((matched / jars.length) * 100) : 0,
      updates: updates.length,
      mc_version: mcVersion,
      loader,
    },
  };
}
