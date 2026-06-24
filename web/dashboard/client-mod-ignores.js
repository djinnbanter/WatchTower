/** Client-only mod keep-on-server ignores — localStorage + server sync when embedded */
const ClientModIgnores = {
  storageKey(hostname) {
    return `watchtower-client-mod-ignores-${hostname || 'default'}`;
  },

  load(hostname) {
    try {
      const raw = localStorage.getItem(this.storageKey(hostname));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  save(hostname, ignores) {
    localStorage.setItem(this.storageKey(hostname), JSON.stringify(ignores));
  },

  normalizeRecord(ts) {
    if (typeof ts === 'string') {
      return { ignoredAt: ts, by: 'server' };
    }
    if (ts && typeof ts === 'object') {
      return {
        ignoredAt: ts.ignoredAt || ts.ignored_at || new Date().toISOString(),
        by: ts.by || 'server',
        note: ts.note,
      };
    }
    return { ignoredAt: new Date().toISOString(), by: 'server' };
  },

  isIgnored(ignores, modId) {
    return !!(ignores && modId && ignores[modId]);
  },

  syncFromServer(hostname, serverIgnores) {
    if (!serverIgnores || typeof serverIgnores !== 'object') return this.load(hostname);
    const local = {};
    Object.entries(serverIgnores).forEach(([modId, ts]) => {
      local[modId] = this.normalizeRecord(ts);
    });
    this.save(hostname, local);
    return local;
  },

  mergeFromServer(hostname, serverIgnores) {
    if (!serverIgnores || typeof serverIgnores !== 'object') return this.load(hostname);
    const local = this.load(hostname);
    Object.entries(serverIgnores).forEach(([modId, ts]) => {
      local[modId] = this.normalizeRecord(ts);
    });
    this.save(hostname, local);
    return local;
  },

  async postIgnore(hostname, modId, ignored, options = {}) {
    if (!modId) return this.load(hostname);
    if (options.apiMode) {
      try {
        const resp = await WatchtowerApi.postClientModIgnore({ mod_id: modId, ignored });
        if (resp?.ignored_client_mods) {
          return this.syncFromServer(hostname, resp.ignored_client_mods);
        }
      } catch (e) {
        console.warn('Server client-mod ignore failed, using local only', e);
      }
    }

    const ignores = this.load(hostname);
    if (ignored) {
      ignores[modId] = {
        ignoredAt: new Date().toISOString(),
        by: 'user',
        note: options.note,
      };
    } else {
      delete ignores[modId];
    }
    this.save(hostname, ignores);
    return ignores;
  },

  async toggle(hostname, modId, options = {}) {
    const wasIgnored = this.isIgnored(this.load(hostname), modId);
    return this.postIgnore(hostname, modId, !wasIgnored, options);
  },

  unignoredMods(facts, ignores) {
    const mods = facts?.optional?.client_only_mods ?? [];
    return mods.filter((m) => m.mod_id && !this.isIgnored(ignores, m.mod_id));
  },

  ignoredMods(facts, ignores) {
    const mods = facts?.optional?.client_only_mods ?? [];
    return mods.filter((m) => m.mod_id && this.isIgnored(ignores, m.mod_id));
  },

  effectiveSummary(facts, ignores) {
    const base = facts?.optional?.client_only_mods_summary;
    if (!base) return null;
    const unignored = this.unignoredMods(facts, ignores);
    const counts = {
      detected: unignored.length,
      likely_removable_count: 0,
      test_remove_count: 0,
      uncertain_count: 0,
      client_library_count: 0,
    };
    unignored.forEach((m) => {
      if (m.bucket === 'likely_removable') counts.likely_removable_count += 1;
      else if (m.bucket === 'test_remove') counts.test_remove_count += 1;
      else if (m.bucket === 'client_library') counts.client_library_count += 1;
      else counts.uncertain_count += 1;
    });
    return { ...base, ...counts };
  },

  hasActionableClientMods(facts, ignores) {
    const summary = this.effectiveSummary(facts, ignores);
    if (!summary) return false;
    return (summary.likely_removable_count ?? 0) > 0 || (summary.test_remove_count ?? 0) > 0;
  },

  hasClientNoiseConcern(facts, ignores) {
    const clientErr = (facts?.optional?.mod_log_errors ?? []).find((e) => e.mod_id === 'client_noise');
    if (!clientErr) return false;
    return this.hasActionableClientMods(facts, ignores);
  },
};
