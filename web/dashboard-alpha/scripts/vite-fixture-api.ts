import type { Plugin } from 'vite';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bareFile,
  groupCrashes,
  mergeCrashRows,
  type CrashRow,
} from '../src/features/crashes/groups';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const TREE_DIR = join(DATA, 'spark-trees');

/** Lazily loaded full call trees for preview (mirrors live /api/spark/tree). */
const fullTreeCache = new Map<string, Record<string, unknown>>();

function readJson(name: string): unknown {
  const path = join(DATA, name);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function seedCrashAcks(session: Record<string, unknown>): Record<string, unknown> {
  if (session.crashAcks && typeof session.crashAcks === 'object') {
    return session.crashAcks as Record<string, unknown>;
  }
  const facts = asRecord(readJson('facts.json'));
  const optional = asRecord(facts.optional);
  const fromFacts = asRecord(optional.acknowledged_crashes);
  const acks: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fromFacts)) {
    const bare = bareFile(k);
    const record = typeof v === 'string' ? { at: v } : asRecord(v);
    if (bare) {
      acks[bare] = record;
      acks[`crash-reports/${bare}`] = record;
    }
  }
  session.crashAcks = acks;
  return acks;
}

function setCrashAck(acks: Record<string, unknown>, file: string, reviewed: boolean) {
  const bare = bareFile(file);
  if (!bare) return;
  if (reviewed) {
    const record = { at: new Date().toISOString(), reviewed: true };
    acks[bare] = record;
    acks[`crash-reports/${bare}`] = record;
  } else {
    delete acks[bare];
    delete acks[`crash-reports/${bare}`];
    delete acks[file];
  }
}

function buildGrouped(session: Record<string, unknown>) {
  const acks = seedCrashAcks(session);
  const facts = asRecord(readJson('facts.json'));
  const optional = asRecord(facts.optional);
  const ops = asRecord(session.opsCache ?? readJson('ops-cache.json'));
  if (!session.opsCache) session.opsCache = structuredClone(ops);
  const crashes = asRecord(asRecord(session.opsCache).crashes);
  const summaries = asArray<CrashRow>(optional.crash_summaries);
  const entries = asArray<CrashRow>(crashes.entries);
  const rows = mergeCrashRows(summaries, entries);
  const grouped = groupCrashes(rows, acks);
  const scanned_at = crashes.scanned_at ? String(crashes.scanned_at) : null;
  return { ...grouped, scanned_at, at: Date.now() };
}

function syncOpsCrashesFromAcks(session: Record<string, unknown>) {
  const acks = seedCrashAcks(session);
  const ops = asRecord(session.opsCache ?? readJson('ops-cache.json'));
  const cloned = structuredClone(ops);
  const crashes = asRecord(cloned.crashes);
  const entries = asArray<Record<string, unknown>>(crashes.entries).map((e) => {
    const file = String(e.file || '');
    const reviewed =
      !!acks[bareFile(file)] || !!acks[`crash-reports/${bareFile(file)}`] || !!acks[file];
    return { ...e, reviewed };
  });
  crashes.entries = entries;
  const grouped = groupCrashes(entries as CrashRow[], acks);
  crashes.unreviewed = grouped.unreviewed;
  crashes.unreviewed_groups = grouped.unreviewed_groups;
  crashes.count = grouped.count;
  cloned.crashes = crashes;
  session.opsCache = cloned;
  return cloned;
}

function syncIssuesLiveFromAcks(session: Record<string, unknown>) {
  const acks = (session.acks as Record<string, unknown>) ?? {};
  const ops = asRecord(session.opsCache ?? readJson('ops-cache.json'));
  const cloned = structuredClone(ops);
  const rows = asArray<Record<string, unknown>>(cloned.issues_live).map((row) => {
    const id = String(row.id || row.key || '');
    const keys = [id, id.startsWith('issue:') ? id : `issue:${id}`, String(row.key || '')].filter(Boolean);
    const reviewed = keys.some((k) => acks[k] != null);
    if (!reviewed) return row;
    return { ...row, status: 'reviewed' };
  });
  cloned.issues_live = rows;

  // Mark matching mod_issues resolved so peeks / Live signals clear
  const modBlock = asRecord(cloned.mod_issues);
  const modEntries = asArray<Record<string, unknown>>(modBlock.entries).map((e) => {
    const modId = String(e.mod_id || e.id || '');
    if (modId && acks[`mod:${modId}`] != null) return { ...e, resolved: true };
    return e;
  });
  if (modBlock.entries || modEntries.length) {
    const active = modEntries.filter((e) => !e.resolved).length;
    cloned.mod_issues = { ...modBlock, entries: modEntries, active_count: active };
  }

  const lagBlock = asRecord(cloned.lag_issues);
  const lagEntries = asArray<Record<string, unknown>>(lagBlock.entries).map((e) => {
    const id = String(e.incident_id || e.id || '');
    if (id && acks[`lag:${id}`] != null) return { ...e, resolved: true };
    return e;
  });
  if (lagBlock.entries || lagEntries.length) {
    const active = lagEntries.filter((e) => !e.resolved).length;
    cloned.lag_issues = { ...lagBlock, entries: lagEntries, active_count: active };
  }

  if (acks.log_stale != null) {
    const ls = asRecord(cloned.log_stale);
    cloned.log_stale = { ...ls, active: false };
  }

  // Rebuild right_now signals without reviewed-backed alerts
  const rn = asRecord(cloned.right_now);
  const signals = asArray<Record<string, unknown>>(rn.signals).filter((s) => {
    const type = String(s.type || '').toLowerCase();
    if (type === 'lag') return asArray<Record<string, unknown>>(asRecord(cloned.lag_issues).entries).some((e) => !e.resolved);
    if (type === 'mod_errors' || type === 'mod_issues') {
      return asArray<Record<string, unknown>>(asRecord(cloned.mod_issues).entries).some((e) => !e.resolved);
    }
    if (type === 'log_stale') return !!asRecord(cloned.log_stale).active;
    return true;
  });
  cloned.right_now = { ...rn, signals };

  session.opsCache = cloned;
  return cloned;
}

function syncOverviewMetaFromSession(session: Record<string, unknown>) {
  const meta = structuredClone(asRecord(readJson('overview-meta.json') ?? {}));
  syncIssuesLiveFromAcks(session);
  const ops = syncOpsCrashesFromAcks(session);
  const crashes = asRecord(asRecord(ops.crashes));
  const unreviewed = Number(crashes.unreviewed ?? 0);
  const scorecard = asRecord(meta.scorecard);
  const scCrashes = asRecord(scorecard.crashes);
  scCrashes.unreviewed = unreviewed;
  scorecard.crashes = scCrashes;
  if (unreviewed > 0) {
    scorecard.grade = 'critical';
    scorecard.grade_word = 'Critical';
  } else if (String(scorecard.grade).toLowerCase() === 'critical') {
    // Drop critical once crashes are cleared; keep degraded/healthy from fixture otherwise
    const lowTps = Number(asRecord(scorecard.performance).low_tps_minutes_24h ?? 0);
    if (lowTps > 0) {
      scorecard.grade = 'degraded';
      scorecard.grade_word = 'Degraded';
    } else {
      scorecard.grade = 'healthy';
      scorecard.grade_word = 'Healthy';
    }
  }
  meta.scorecard = scorecard;
  meta.health_grade = scorecard.grade === 'critical' ? 'F' : scorecard.grade === 'degraded' ? 'C' : 'A';
  if (meta.crash_tldr && typeof meta.crash_tldr === 'object') {
    (meta.crash_tldr as Record<string, unknown>).unreviewed = unreviewed;
  }
  // Mirror filtered right_now from ops
  if (ops.right_now) meta.right_now = structuredClone(ops.right_now);
  session.overviewMeta = meta;
  return meta;
}

function sendJson(res: import('http').ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sparkProfileFor(requested: string): Record<string, unknown> | null {
  const mocks = asRecord(readJson('spark-profile-mocks.json'));
  const profiles = asRecord(mocks.profiles);
  const exact = profiles[requested];
  if (exact) return asRecord(exact);
  const requestedFile = requested.replaceAll('\\', '/').split('/').pop()?.toLowerCase() || '';
  const matched = Object.entries(profiles).find(([profilePath, value]) => {
    const row = asRecord(value);
    return (
      profilePath.toLowerCase() === requested.toLowerCase() ||
      profilePath.toLowerCase().endsWith(`/${requestedFile}`) ||
      String(row.source_file || '').toLowerCase() === requestedFile
    );
  });
  return matched ? asRecord(matched[1]) : null;
}

function sparkTreeKeyFor(requested: string): string | null {
  const index = asRecord(readJson('spark-tree-index.json'));
  if (index[requested]) return String(index[requested]);
  const profile = sparkProfileFor(requested);
  if (!profile) return null;
  const sourcePath = String(profile.source_path || '');
  if (sourcePath && index[sourcePath]) return String(index[sourcePath]);
  const file = String(profile.source_file || requested.replaceAll('\\', '/').split('/').pop() || '');
  const key = file.replace(/\.sparkprofile$/i, '').toLowerCase();
  const guess = `${key}.tree.json.gz`;
  return existsSync(join(TREE_DIR, guess)) ? guess : null;
}

function loadFullSparkTree(requested: string): Record<string, unknown> | null {
  const treeFile = sparkTreeKeyFor(requested);
  if (!treeFile) return null;
  const cached = fullTreeCache.get(treeFile);
  if (cached) return cached;
  const path = join(TREE_DIR, treeFile);
  if (!existsSync(path)) return null;
  try {
    const raw = gunzipSync(readFileSync(path));
    const parsed = asRecord(JSON.parse(raw.toString('utf8')));
    fullTreeCache.set(treeFile, parsed);
    return parsed;
  } catch (error) {
    console.warn(`[fixture-api] failed to load full tree ${treeFile}:`, error);
    return null;
  }
}

function filteredFixtureTree(
  profile: Record<string, unknown>,
  url: URL,
  requestedPath: string,
): Record<string, unknown> {
  const full = loadFullSparkTree(requestedPath);
  const sourceTree = full
    ? structuredClone(full)
    : structuredClone(asRecord(profile.call_tree));
  const search = (url.searchParams.get('search') || '').toLowerCase();
  const source = (url.searchParams.get('source') || '').toLowerCase();
  const minShare = Number(url.searchParams.get('min_share') || 0);
  const maxNodes = Math.max(25, Math.min(250_000, Number(url.searchParams.get('max_nodes') || 250_000)));
  const requestedThread = (url.searchParams.get('thread') || '').toLowerCase();
  const hasFilter = Boolean(search || source || minShare || requestedThread || url.searchParams.get('window'));

  // No filter: serve the full tree as-is (live parity).
  if (!hasFilter && Number(sourceTree.nodes_emitted || 0) <= maxNodes) {
    sourceTree.query_applied = false;
    return sourceTree;
  }

  let emitted = 0;
  let truncated = sourceTree.truncated === true;
  const filterNode = (value: unknown): Record<string, unknown> | null => {
    if (emitted >= maxNodes) {
      truncated = true;
      return null;
    }
    const row = asRecord(value);
    const children = asArray<unknown>(row.children)
      .map(filterNode)
      .filter((child): child is Record<string, unknown> => Boolean(child));
    const haystack = [
      row.class,
      row.method,
      row.name,
      row.mod_id,
      row.source,
    ].map((part) => String(part || '').toLowerCase()).join(' ');
    const share = Math.max(Number(row.own_pct || 0), Number(row.involvement_pct || 0));
    const direct =
      (!search || haystack.includes(search)) &&
      (!source || String(row.mod_id || row.source || '').toLowerCase().includes(source)) &&
      (!Number.isFinite(minShare) || share >= minShare);
    if (!direct && !children.length) return null;
    emitted += 1;
    return { ...row, children };
  };
  sourceTree.threads = asArray<unknown>(sourceTree.threads)
    .filter((value) => {
      if (!requestedThread) return true;
      const row = asRecord(value);
      return [row.id, row.name].some((part) => String(part || '').toLowerCase() === requestedThread);
    })
    .map(filterNode)
    .filter(Boolean);
  sourceTree.nodes_emitted = emitted;
  sourceTree.truncated = truncated;
  sourceTree.query_applied = hasFilter;
  return sourceTree;
}

/** Map /api/* to fixture JSON + lightweight session mutations for alpha preview. */
export function fixtureApiPlugin(): Plugin {
  const session: Record<string, unknown> = {
    settings: null,
    acks: {},
    crashAcks: null,
    opsCache: null,
    suppressions: [],
    theme: 'dark',
    baselineRegression: null,
  };

  return {
    name: 'watchtower-fixture-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/')) return next();

        const pathOnly = url.split('?')[0];
        const method = (req.method || 'GET').toUpperCase();

        try {
          // Static fixture maps
          const map: Record<string, string> = {
            '/api/live': 'live-envelope.json',
            '/api/issues/peek': 'issues-peek.json',
            '/api/reports/index': 'reports-index.json',
            '/api/facts': 'facts.json',
            '/api/update-check': 'update-check.json',
            '/api/mods/forensics/status': 'forensics-status.json',
            '/api/forensics/status': 'forensics-status.json',
            '/api/forensics/config-health': 'forensics-config-health.json',
            '/api/spark/profiles': 'spark-profiles.json',
            '/api/logs/list': 'logs-index.json',
            '/api/logs/index': 'logs-index.json',
            '/api/crash-contexts': 'crash-contexts.json',
            '/api/incidents': 'incidents-index.json',
            '/api/data-sources': 'data-sources.json',
            '/api/config': 'preview-settings.json',
          };

          if (method === 'GET' && pathOnly === '/api/overview/meta') {
            return sendJson(res, 200, syncOverviewMetaFromSession(session));
          }

          if (method === 'GET' && pathOnly === '/api/spark/profile') {
            const requested = new URL(url, 'http://127.0.0.1').searchParams.get('path') || '';
            const profile = sparkProfileFor(requested);
            if (profile) return sendJson(res, 200, profile);
            return sendJson(res, 404, {
              error: 'spark_profile_missing',
              path: requested,
            });
          }

          if (method === 'GET' && pathOnly === '/api/spark/tree') {
            const requestUrl = new URL(url, 'http://127.0.0.1');
            const requested = requestUrl.searchParams.get('path') || '';
            const profile = sparkProfileFor(requested);
            if (!profile) return sendJson(res, 404, { error: 'spark_profile_missing', path: requested });
            const tree = filteredFixtureTree(profile, requestUrl, requested);
            return sendJson(res, 200, {
              analysis_version: profile.analysis_version || 1,
              source_path: requested,
              tree,
              truncated: tree.truncated === true,
              returned_nodes: tree.nodes_emitted || 0,
            });
          }

          if (method === 'GET' && pathOnly === '/api/spark/compare') {
            const requestUrl = new URL(url, 'http://127.0.0.1');
            const baselinePath = requestUrl.searchParams.get('baseline') || '';
            const targetPath = requestUrl.searchParams.get('target') || '';
            const baseline = sparkProfileFor(baselinePath);
            const target = sparkProfileFor(targetPath);
            if (!baseline || !target) return sendJson(res, 404, { error: 'spark_profile_missing' });
            const baselineMode = String(baseline.mode || 'execution');
            const targetMode = String(target.mode || 'execution');
            const compatible = baselineMode === targetMode;
            return sendJson(res, 200, {
              compatible,
              normalization: 'share_and_capture_context',
              warnings: compatible ? [] : [`Sampler modes differ (${baselineMode} vs ${targetMode}).`],
              baseline: { source_path: baselinePath, mode: baselineMode, context: baseline.context },
              target: { source_path: targetPath, mode: targetMode, context: target.context },
            });
          }

          if (method === 'POST' && pathOnly === '/api/spark/import') {
            const raw = await readBody(req);
            const body = raw ? JSON.parse(raw) : {};
            const requestedUrl = String(body.url || '').trim();
            if (!/^https?:\/\/spark\.lucko\.me\//i.test(requestedUrl)) {
              return sendJson(res, 400, {
                error: 'invalid_spark_url',
                message: 'Expected a https://spark.lucko.me/… profile URL',
              });
            }
            const sparkIndex = asRecord(readJson('spark-profiles.json'));
            const mocks = asRecord(readJson('spark-profile-mocks.json'));
            const profiles = asRecord(mocks.profiles);
            const profileId = new URL(requestedUrl).pathname.split('/').filter(Boolean)[0]?.toLowerCase() || '';
            const matched = Object.entries(profiles).find(([profilePath, value]) => {
              const row = asRecord(value);
              return (
                profilePath.toLowerCase().includes(profileId) ||
                String(row.spark_viewer_url || '').toLowerCase().includes(`/${profileId}`)
              );
            });
            const fallbackPath = String(sparkIndex.report_profile_path || Object.keys(profiles)[0] || '');
            const profilePath = matched?.[0] || fallbackPath;
            const profile = asRecord(matched?.[1] ?? profiles[profilePath]);
            return sendJson(res, 200, {
              ok: true,
              preview: true,
              simulated: true,
              requested_url: requestedUrl,
              profile_path: profilePath,
              profile,
            });
          }

          if (method === 'POST' && pathOnly === '/api/spark/upload') {
            const raw = await readBody(req);
            if (!raw.length) return sendJson(res, 400, { error: 'empty_upload' });
            const sparkIndex = asRecord(readJson('spark-profiles.json'));
            const fallbackPath = String(sparkIndex.report_profile_path || '');
            const profile = sparkProfileFor(fallbackPath);
            return sendJson(res, 201, {
              ok: true,
              preview: true,
              simulated: true,
              source_path: fallbackPath,
              profile,
            });
          }

          if (method === 'GET' && pathOnly === '/api/reports/latest') {
            const facts = readJson('facts.json');
            if (!facts) {
              return sendJson(res, 404, { error: 'no_report' });
            }
            const briefPath = join(DATA, 'brief.txt');
            const brief = existsSync(briefPath) ? readFileSync(briefPath, 'utf8') : null;
            return sendJson(res, 200, {
              facts_path: 'data/facts.json',
              facts,
              ...(brief
                ? { brief_path: 'data/brief.txt', brief }
                : {}),
            });
          }

          if (method === 'GET' && pathOnly === '/api/ops-cache') {
            seedCrashAcks(session);
            syncIssuesLiveFromAcks(session);
            return sendJson(res, 200, syncOpsCrashesFromAcks(session));
          }

          if (method === 'GET' && pathOnly === '/api/crashes') {
            return sendJson(res, 200, buildGrouped(session));
          }

          if (method === 'GET' && pathOnly === '/api/crashes/acks') {
            return sendJson(res, 200, { acknowledged_crashes: seedCrashAcks(session) });
          }

          if (method === 'POST' && pathOnly === '/api/crashes/ack') {
            const raw = await readBody(req);
            const body = raw ? JSON.parse(raw) : {};
            const file = String(body.file || '');
            const reviewed = body.reviewed !== false && body.ack !== false;
            const acks = seedCrashAcks(session);
            setCrashAck(acks, file, reviewed);
            session.crashAcks = acks;
            syncOpsCrashesFromAcks(session);
            syncOverviewMetaFromSession(session);
            return sendJson(res, 200, {
              ok: true,
              acknowledged_crashes: acks,
              ...buildGrouped(session),
            });
          }

          if (method === 'POST' && pathOnly === '/api/crashes/acknowledge-all') {
            const acks = seedCrashAcks(session);
            const grouped = buildGrouped(session);
            let acknowledged = 0;
            for (const g of grouped.groups) {
              for (const m of g.members) {
                if (!m.acknowledged && m.file) {
                  setCrashAck(acks, m.file, true);
                  acknowledged += 1;
                }
              }
            }
            session.crashAcks = acks;
            syncOpsCrashesFromAcks(session);
            syncOverviewMetaFromSession(session);
            return sendJson(res, 200, {
              ok: true,
              acknowledged,
              acknowledged_crashes: acks,
              ...buildGrouped(session),
            });
          }

          if (method === 'POST' && pathOnly === '/api/mods/scan') {
            return sendJson(res, 200, {
              ok: true,
              preview: true,
              scanned: true,
              message: 'Fixture mods scan complete',
            });
          }

          if (method === 'POST' && pathOnly === '/api/modrinth/scan') {
            session.modrinth = {
              running: true,
              success: null,
              stage: 'hash',
              poll: 0,
              progress: { done: 0, total: 40 },
            };
            return sendJson(res, 200, {
              ok: true,
              preview: true,
              running: true,
              stage: 'hash',
              stage_label: 'Hashing jars',
              stage_detail: 'Starting scan…',
              progress: { done: 0, total: 40 },
            });
          }

          if (method === 'GET' && pathOnly === '/api/modrinth/status') {
            const m = asRecord(session.modrinth);
            if (!m.running && m.success == null) {
              return sendJson(res, 200, readJson('modrinth-status.json') ?? { enabled: true, running: false });
            }
            const poll = Number(m.poll || 0) + 1;
            m.poll = poll;
            const total = 40;
            const done = Math.min(total, poll * 5);
            m.progress = { done, total };
            if (done < total) {
              m.stage = done < 20 ? 'hash' : 'lookup';
              session.modrinth = m;
              return sendJson(res, 200, {
                enabled: true,
                running: true,
                success: null,
                stage: m.stage,
                stage_label: done < 20 ? 'Hashing jars' : 'Looking up Modrinth',
                stage_detail: `Processed ${done}/${total} jars…`,
                progress: { done, total },
                preview: true,
              });
            }
            session.modrinth = { running: false, success: true, stage: 'done' };
            return sendJson(res, 200, {
              enabled: true,
              running: false,
              success: true,
              stage: 'done',
              stage_label: 'Done',
              progress: { done: total, total },
              stats: { matched: 28, jars_considered: 40, coverage_pct: 70 },
              preview: true,
            });
          }

          if (method === 'POST' && pathOnly === '/api/crashes/scan') {
            syncOpsCrashesFromAcks(session);
            const grouped = buildGrouped(session);
            return sendJson(res, 200, {
              ok: true,
              preview: true,
              ...grouped,
              scanned_at: new Date().toISOString(),
            });
          }

          if (method === 'GET' && pathOnly === '/api/crashes/context') {
            const u = new URL(url, 'http://127.0.0.1');
            const file = u.searchParams.get('file') || '';
            const bare = bareFile(file);
            const contexts = asRecord(readJson('crash-contexts.json'));
            const ctx =
              contexts[file] ||
              contexts[bare] ||
              contexts[`crash-reports/${bare}`] ||
              contexts.pre_crash ||
              null;
            return sendJson(res, 200, { pre_crash: ctx });
          }

          if (method === 'GET' && pathOnly === '/api/crashes/report') {
            const u = new URL(url, 'http://127.0.0.1');
            const file = u.searchParams.get('file') || '';
            const bare = bareFile(file);
            const candidates = [
              join(DATA, 'crash-reports', bare),
              join(DATA, 'crash-reports', file),
              join(DATA, 'crash-reports', `${bare}.txt`),
            ];
            for (const candidate of candidates) {
              if (existsSync(candidate)) {
                const text = readFileSync(candidate, 'utf8');
                return sendJson(res, 200, {
                  file: bare,
                  content: text.slice(0, 80_000),
                  truncated: text.length > 80_000,
                });
              }
            }
            return sendJson(res, 200, {
              file: bare,
              content: `(Crash report preview not available)\n\nFile: ${bare}`,
              truncated: false,
              missing: true,
            });
          }

          if (method === 'POST' && pathOnly === '/api/forensics/find-class') {
            const fixture = asRecord(readJson('forensics-find-class.json'));
            const raw = await readBody(req);
            const body = raw ? JSON.parse(raw) : {};
            return sendJson(res, 200, {
              ...fixture,
              query: body.class || body.query || fixture.query || '',
            });
          }

          if (method === 'GET' && pathOnly === '/api/auth/session') {
            return sendJson(res, 200, {
              authenticated: true,
              username: 'admin',
              preview: true,
              must_change_password: false,
            });
          }

          if (method === 'GET' && pathOnly === '/api/settings') {
            const data = session.settings ?? readJson('preview-settings.json') ?? {};
            return sendJson(res, 200, data);
          }

          if (method === 'POST' && pathOnly === '/api/settings') {
            const raw = await readBody(req);
            const body = raw ? JSON.parse(raw) as Record<string, unknown> : {};
            const base = (session.settings as Record<string, unknown>)
              ?? (readJson('preview-settings.json') as Record<string, unknown>)
              ?? {};
            // Accept camelCase writes from the live API contract; store snake_case for GET.
            const next = { ...base };
            const camelToSnake: Record<string, string> = {
              lookbackHours: 'lookback_hours',
              incremental: 'incremental',
              updateCheck: 'update_check',
              metricsContextBanner: 'metrics_context_banner',
              tpsWarn: 'tps_warn',
              msptWarn: 'mspt_warn',
              opsPollSec: 'ops_poll_sec',
              opsLogScanSec: 'ops_log_scan_sec',
              modrinthLookup: 'modrinth_lookup',
              modrinthAutoScanOnModChanges: 'modrinth_auto_scan_on_mod_changes',
              sparkEnabled: 'spark_enabled',
              sparkAutoCaptureOnLag: 'spark_auto_capture_on_lag',
              sparkAutoCaptureWindowSec: 'spark_auto_capture_window_sec',
              sparkAutoCaptureCooldownSec: 'spark_auto_capture_cooldown_sec',
              baselineAutoCapture: 'baseline_auto_capture',
              baselineRegressionThresholdPct: 'baseline_regression_threshold_pct',
              diskWarnPct: 'disk_warn_pct',
              diskFillWarnDays: 'disk_fill_warn_days',
              diskIoLatencyWarnMs: 'disk_io_latency_warn_ms',
              reportRetentionDays: 'report_retention_days',
              reportRetentionCount: 'report_retention_count',
            };
            for (const [k, v] of Object.entries(body)) {
              const snake = camelToSnake[k] ?? k;
              next[snake] = v;
            }
            session.settings = next;
            return sendJson(res, 200, { ok: true, settings: session.settings });
          }

          if (method === 'GET' && pathOnly === '/api/samples') {
            // Alpha fixture returns the full series; minutes/max_points are accepted for API parity.
            return sendJson(res, 200, readJson('live-samples.json') ?? {});
          }

          if (method === 'GET' && pathOnly === '/api/players') {
            const facts = (readJson('facts.json') as Record<string, unknown> | null) ?? {};
            const ops = (readJson('ops-cache.json') as Record<string, unknown> | null) ?? {};
            const live = (readJson('live-envelope.json') as Record<string, unknown> | null) ?? {};
            const optional = (facts.optional as Record<string, unknown> | undefined) ?? {};
            const fromOps = ops.player_directory;
            const fromFacts = optional.player_directory;
            const directory =
              fromOps && typeof fromOps === 'object'
                ? structuredClone(fromOps)
                : fromFacts && typeof fromFacts === 'object'
                  ? structuredClone(fromFacts)
                  : null;
            if (directory && typeof directory === 'object' && !Array.isArray(directory)) {
              const dir = directory as Record<string, unknown>;
              const latest = (live.latest as Record<string, unknown> | undefined) ?? {};
              if (latest.players_online != null && dir.online_count == null) {
                dir.online_count = latest.players_online;
              }
              if (!dir.scanned_at) {
                dir.scanned_at = new Date().toISOString();
              }
            }
            return sendJson(res, 200, { player_directory: directory });
          }

          if (method === 'GET' && pathOnly === '/api/config-audit') {
            const dedicated = readJson('config-audit.json');
            if (dedicated && typeof dedicated === 'object') {
              return sendJson(res, 200, dedicated);
            }
            const facts = (readJson('facts.json') as Record<string, unknown> | null) ?? {};
            const optional = (facts.optional as Record<string, unknown> | undefined) ?? {};
            const audit = optional.config_launch_audit;
            if (audit && typeof audit === 'object') {
              return sendJson(res, 200, audit);
            }
            return sendJson(res, 200, {
              status: 'unavailable',
              detail: 'No config launch audit in fixtures',
              properties: [],
            });
          }

          if (method === 'GET' && pathOnly === '/api/logs/content') {
            const u = new URL(url, 'http://127.0.0.1');
            const file = u.searchParams.get('file') || '';
            const tail = Math.max(50, Math.min(10_000, Number(u.searchParams.get('tail') || 2000)));
            const name = file.replace(/\.gz$/i, '');
            const candidates = [
              join(DATA, 'logs', file),
              join(DATA, 'logs', `${name}.txt`),
              join(DATA, 'logs', name),
              join(DATA, 'logs', `${name}.log.txt`),
            ];
            let text: string | null = null;
            for (const candidate of candidates) {
              if (existsSync(candidate)) {
                text = readFileSync(candidate, 'utf8');
                break;
              }
            }
            if (text == null) {
              return sendJson(res, 404, { error: 'log_missing', file });
            }
            const lines = text.split(/\r?\n/);
            const sliced = lines.slice(Math.max(0, lines.length - tail));
            return sendJson(res, 200, {
              file,
              tail,
              content: sliced.join('\n'),
              truncated: lines.length > tail,
              line_count: sliced.length,
            });
          }

          if (method === 'GET' && pathOnly.startsWith('/api/performance/dashboard')) {
            const q = new URL(url, 'http://127.0.0.1').searchParams.get('window') || '7d';
            const file = q === '30d' ? 'performance-dashboard-30d.json' : 'performance-dashboard.json';
            const data = (readJson(file) as Record<string, unknown> | null) ?? {};
            if (session.baselineRegression) {
              return sendJson(res, 200, {
                ...data,
                baseline_regression: session.baselineRegression,
              });
            }
            return sendJson(res, 200, data);
          }

          if (method === 'POST' && pathOnly === '/api/performance/baseline') {
            session.baselineRegression = {
              active: false,
              has_baseline: true,
              can_set_baseline: true,
              baseline_source: 'manual',
              severity: 'ok',
              label: 'On pace with baseline',
              detail:
                'Last 7 days are within threshold of your saved baseline (preview — baseline reset locally).',
              baseline_captured_at: new Date().toISOString(),
              threshold_pct: 10,
            };
            return sendJson(res, 200, {
              ok: true,
              preview: true,
              baseline_regression: session.baselineRegression,
            });
          }

          if (method === 'GET' && pathOnly.startsWith('/api/performance/export')) {
            const q = new URL(url, 'http://127.0.0.1').searchParams.get('window') || '7d';
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader(
              'Content-Disposition',
              `attachment; filename="watchtower-performance-${q}.csv"`,
            );
            return res.end(
              [
                'date,mspt_avg,mspt_p95,tps_avg,players_peak,low_tps_minutes',
                '2026-07-16,8.9,21,20,7,0',
                '2026-07-17,9.2,24,19.9,6,2',
                '# preview stub — full export available against a live Watchtower server',
              ].join('\n'),
            );
          }

          if (method === 'GET' && pathOnly.startsWith('/api/performance/insights')) {
            const q = new URL(url, 'http://127.0.0.1').searchParams.get('window') || '7d';
            const file = q === '30d' ? 'performance-insights-30d.json' : 'performance-insights.json';
            return sendJson(res, 200, readJson(file) ?? {});
          }

          if (method === 'GET' && pathOnly.startsWith('/api/performance/rollups')) {
            const hours = new URL(url, 'http://127.0.0.1').searchParams.get('hours') || '24';
            const file =
              hours === '168' || hours === '7d'
                ? 'performance-rollups-7d.json'
                : hours === '720' || hours === '30d'
                  ? 'performance-rollups-30d.json'
                  : 'performance-rollups.json';
            return sendJson(res, 200, readJson(file) ?? {});
          }

          if (method === 'GET' && pathOnly === '/api/alpha/profile') {
            return sendJson(res, 200, readJson('active-profile.json') ?? { name: 'normal' });
          }

          if (method === 'GET' && pathOnly === '/api/issues/acks') {
            return sendJson(res, 200, { acknowledged_issues: session.acks ?? {} });
          }

          if (method === 'POST' && pathOnly === '/api/issues/ack') {
            const raw = await readBody(req);
            const body = raw ? JSON.parse(raw) : {};
            const key = String(body.id || body.key || '');
            const acks = (session.acks as Record<string, unknown>) ?? {};
            if (key) {
              const reviewed =
                typeof body.reviewed === 'boolean'
                  ? body.reviewed
                  : !(body.ack === false || body.acked === false);
              if (!reviewed) {
                delete acks[key];
              } else {
                acks[key] = { at: new Date().toISOString(), ackedAt: new Date().toISOString(), by: 'dashboard' };
              }
              session.acks = acks;
            }
            syncIssuesLiveFromAcks(session);
            return sendJson(res, 200, { ok: true, acknowledged_issues: session.acks ?? {} });
          }

          if (method === 'POST' && pathOnly === '/api/issues/acknowledge-all') {
            const raw = await readBody(req);
            const body = raw ? JSON.parse(raw) : {};
            const ids = Array.isArray(body.ids)
              ? body.ids.map(String)
              : Array.isArray(body.keys)
                ? body.keys.map(String)
                : [];
            const acks = (session.acks as Record<string, unknown>) ?? {};
            const at = new Date().toISOString();
            for (const id of ids) {
              if (id) acks[id] = { at, ackedAt: at, by: 'dashboard', bulk: true };
            }
            session.acks = acks;
            syncIssuesLiveFromAcks(session);
            return sendJson(res, 200, {
              ok: true,
              acknowledged: ids.length,
              acknowledged_issues: session.acks ?? {},
            });
          }

          if (method === 'GET' && pathOnly === '/api/issues/suppressions') {
            let list = Array.isArray(session.suppressions) ? (session.suppressions as unknown[]) : [];
            if (list.length === 0) {
              const facts = readJson('facts.json') as Record<string, unknown> | null;
              const optional = (facts?.optional ?? {}) as Record<string, unknown>;
              const fromFacts = Array.isArray(optional.suppressed_issues) ? optional.suppressed_issues : [];
              list = fromFacts.map((row) => {
                const r = row as Record<string, unknown>;
                return {
                  id: String(r.id || ''),
                  message: String(r.message || r.id || ''),
                  severity: String(r.severity || 'warning'),
                  suppressed_at: new Date().toISOString(),
                  source: 'fixture',
                };
              }).filter((r) => r.id);
              session.suppressions = list;
            }
            return sendJson(res, 200, { suppressions: list, ids: list.map((r) => String((r as { id?: string }).id || '')) });
          }

          if (method === 'POST' && pathOnly === '/api/issues/suppress') {
            const raw = await readBody(req);
            const body = raw ? JSON.parse(raw) : {};
            const id = String(body.issue_id || body.id || '');
            if (!id) return sendJson(res, 400, { error: 'missing_issue_id' });
            const list = Array.isArray(session.suppressions)
              ? ([...(session.suppressions as unknown[])] as Record<string, unknown>[])
              : [];
            if (!list.some((r) => String(r.id) === id)) {
              list.push({
                id,
                message: String(body.message || id),
                severity: String(body.severity || 'warning'),
                suppressed_at: new Date().toISOString(),
                source: 'ui',
              });
            }
            session.suppressions = list;
            return sendJson(res, 200, { ok: true, id });
          }

          if (method === 'POST' && pathOnly === '/api/issues/unsuppress') {
            const raw = await readBody(req);
            const body = raw ? JSON.parse(raw) : {};
            const id = String(body.issue_id || body.id || '');
            const list = Array.isArray(session.suppressions)
              ? (session.suppressions as Record<string, unknown>[]).filter((r) => String(r.id) !== id)
              : [];
            session.suppressions = list;
            return sendJson(res, 200, { ok: true, id });
          }

          if (method === 'GET' && pathOnly === '/api/support/catalog') {
            return sendJson(res, 200, {
              bundle_version: 4,
              soft_budget_bytes: 25 * 1024 * 1024,
              hard_budget_bytes: 100 * 1024 * 1024,
              logs: [
                { name: 'latest.log', size: 120000, mtime: Date.now() / 1000, gz: false },
                { name: 'debug.log', size: 80000, mtime: Date.now() / 1000 - 3600, gz: false },
              ],
              crashes: [
                { file: 'crash-sample-server.txt', label: 'Sample crash', size: 12000 },
              ],
              spark: [],
              stores: {
                ops_cache: { present: true, size: 50000 },
                performance_rollups: { present: true, size: 20000 },
                watchtower_conf: { present: true, size: 2000 },
              },
              preview: true,
            });
          }

          if (method === 'POST' && pathOnly === '/api/support/compose') {
            session.supportZipReady = true;
            return sendJson(res, 200, {
              ok: true,
              preview: true,
              message: 'Support compose simulated (no zip in fixture preview)',
              job_id: `preview-${Date.now()}`,
            });
          }

          if (method === 'GET' && pathOnly === '/api/support/bundle') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename="watchtower-support-preview.zip"');
            // Minimal empty zip (EOCD only) for preview download wiring
            const emptyZip = Buffer.from([
              0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
              0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            ]);
            return res.end(emptyZip);
          }

          if (method === 'GET' && pathOnly === '/api/reports/status') {
            return sendJson(res, 200, {
              running: false,
              success: true,
              zip_ready: Boolean(session.supportZipReady),
              message: 'preview',
              preview: true,
            });
          }

          if (method === 'POST' && pathOnly === '/api/onboarding/discovery/start') {
            session.discovery = {
              running: true,
              success: null,
              stage: 'window',
              poll: 0,
              started_at: new Date().toISOString(),
              counts: { logs: 0, crashes: 0, jars: 0, active_issues: 0 },
            };
            return sendJson(res, 200, { ok: true, preview: true });
          }

          if (method === 'GET' && pathOnly === '/api/onboarding/discovery/status') {
            const d = asRecord(session.discovery);
            if (!d.running && d.success == null) {
              return sendJson(res, 200, { running: false, success: null, stage: null, preview: true });
            }
            const stages = ['window', 'collect', 'analyze', 'enrich', 'write', 'finalize', 'done'];
            const poll = Number(d.poll || 0) + 1;
            d.poll = poll;
            // Linger on collect for several polls so progress/counts are visible
            let stage = String(d.stage || 'window');
            let stageIdx = stages.indexOf(stage);
            if (d.running) {
              if (stage === 'collect' && poll < 8) {
                // stay on collect
              } else if (stageIdx >= 0 && stageIdx < stages.length - 1 && (stage !== 'collect' || poll >= 8)) {
                stage = stages[stageIdx + 1]!;
                stageIdx = stages.indexOf(stage);
                d.stage = stage;
                if (stage !== 'collect') d.poll = 0;
              }
            }

            const counts = asRecord(d.counts);
            if (stage === 'collect' || stageIdx >= 1) {
              counts.logs = Math.min(48, Math.max(Number(counts.logs) || 0, Math.floor(poll * 6)));
              counts.crashes = Math.min(4, Math.max(Number(counts.crashes) || 0, Math.floor(poll / 2)));
              counts.jars = Math.min(120, Math.max(Number(counts.jars) || 0, Math.floor(poll * 14)));
            }
            if (stageIdx >= 3) counts.active_issues = 3;
            d.counts = counts;

            const started = Date.parse(String(d.started_at || Date.now()));
            const elapsed_ms = Math.max(0, Date.now() - (Number.isFinite(started) ? started : Date.now()));

            if (d.running && stage !== 'done') {
              const batchTotal = stage === 'collect' ? 48 : stages.length;
              const batchDone =
                stage === 'collect' ? Math.min(48, Math.max(1, Number(counts.logs) || poll)) : Math.max(1, stageIdx + 1);
              session.discovery = d;
              return sendJson(res, 200, {
                running: true,
                success: null,
                stage,
                stage_label:
                  stage === 'collect'
                    ? 'Collecting logs, crashes, mods, host metrics'
                    : stage === 'analyze'
                      ? 'Analyzing health and crashes'
                      : stage === 'enrich'
                        ? 'Enriching incidents and scorecard'
                        : stage === 'write'
                          ? 'Writing facts and brief'
                          : stage === 'finalize'
                            ? 'Saving state and ops cache'
                            : 'Computing time window',
                stage_detail:
                  stage === 'collect'
                    ? `Scanning log ${batchDone}/${batchTotal}…`
                    : stage === 'analyze'
                      ? 'Scoring crashes and health windows…'
                      : 'Working…',
                progress: { done: batchDone, total: batchTotal },
                counts,
                elapsed_ms,
                preview: true,
              });
            }

            session.discovery = {
              running: false,
              success: true,
              stage: 'done',
              counts: { logs: 48, crashes: 4, jars: 120, active_issues: 3 },
            };
            return sendJson(res, 200, {
              running: false,
              success: true,
              stage: 'done',
              stage_label: 'Done',
              progress: { done: 7, total: 7 },
              counts: { logs: 48, crashes: 4, jars: 120, active_issues: 3 },
              elapsed_ms,
              preview: true,
            });
          }

          if (method === 'GET' && pathOnly === '/api/fs/roots') {
            return sendJson(res, 200, {
              roots: [
                { path: '/srv/minecraft/backups', label: 'Server backups (preview)', archive_count: 3 },
                { path: '/srv/minecraft', label: 'Server directory (preview)', archive_count: 0 },
              ],
              preview: true,
            });
          }

          if (method === 'GET' && pathOnly === '/api/fs/list') {
            const q = new URL(url, 'http://127.0.0.1').searchParams.get('path') || '/srv/minecraft';
            return sendJson(res, 200, {
              path: q,
              breadcrumbs: [q],
              entries: [
                { name: 'world-backups', path: `${q}/world-backups`, kind: 'dir', archive_count: 2 },
                { name: 'daily', path: `${q}/daily`, kind: 'dir', archive_count: 5 },
              ],
              archive_count: 0,
              truncated: false,
              preview: true,
            });
          }

          if (method === 'POST' && pathOnly === '/api/backups/dirs') {
            const raw = await readBody(req);
            const body = raw ? JSON.parse(raw) as Record<string, unknown> : {};
            const dirs = Array.isArray(body.dirs)
              ? (body.dirs as unknown[]).map((d) => String(d).trim()).filter(Boolean)
              : [];
            const base = (session.settings as Record<string, unknown>)
              ?? (readJson('preview-settings.json') as Record<string, unknown>)
              ?? {};
            session.settings = {
              ...base,
              backup_dirs: dirs.join(', '),
              backup_dir: dirs[0] ?? '',
              backup_tracking_enabled: true,
            };
            return sendJson(res, 200, {
              ok: true,
              saved_dirs: dirs,
              preview: true,
            });
          }

          if (method === 'POST' && pathOnly === '/api/backups/external') {
            const raw = await readBody(req);
            const body = raw ? JSON.parse(raw) as Record<string, unknown> : {};
            const base = (session.settings as Record<string, unknown>)
              ?? (readJson('preview-settings.json') as Record<string, unknown>)
              ?? {};
            session.settings = {
              ...base,
              backup_tracking_enabled: body.trackingEnabled !== false,
              backup_tracking_mode: body.trackingMode ?? 'off',
            };
            return sendJson(res, 200, {
              ok: true,
              settings: session.settings,
              backup_webhook_token: body.generateWebhookToken ? 'preview-webhook-token' : undefined,
              preview: true,
            });
          }

          if (method === 'POST' && pathOnly === '/api/backups/external/test') {
            return sendJson(res, 200, { ok: true, backup_external: { status: 'ok', preview: true } });
          }

          if (method === 'POST' && pathOnly === '/api/backups/scan') {
            return sendJson(res, 200, { ok: true, preview: true });
          }

          if (method === 'GET' && pathOnly === '/api/brief') {
            const briefPath = join(DATA, 'brief.txt');
            const text = existsSync(briefPath) ? readFileSync(briefPath, 'utf8') : '';
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.end(text);
          }

          if (method === 'GET' && map[pathOnly]) {
            const data = readJson(map[pathOnly]);
            if (data == null) return sendJson(res, 404, { error: 'fixture_missing', path: map[pathOnly] });
            return sendJson(res, 200, data);
          }

          // Generic fallback: /api/foo-bar -> data/foo-bar.json
          if (method === 'GET') {
            const slug = pathOnly.replace(/^\/api\//, '').replace(/\//g, '-');
            const candidate = `${slug}.json`;
            if (existsSync(join(DATA, candidate))) {
              return sendJson(res, 200, readJson(candidate));
            }
          }

          return sendJson(res, 404, { error: 'not_found', path: pathOnly, preview: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return sendJson(res, 500, { error: 'fixture_api_error', message });
        }
      });
    },
  };
}

export function listFixtureFiles(): string[] {
  if (!existsSync(DATA)) return [];
  return readdirSync(DATA)
    .filter((name) => extname(name) === '.json' || name.endsWith('.txt'))
    .filter((name) => statSync(join(DATA, name)).isFile());
}
