/** Crash report acknowledgments — localStorage + server sync when embedded */
const Acks = {
  storageKey(hostname) {
    return `watchtower-acks-${hostname || 'default'}`;
  },

  bareFile(file) {
    if (!file) return '';
    return file.startsWith('crash-reports/') ? file.slice('crash-reports/'.length) : file;
  },

  load(hostname) {
    try {
      const raw = localStorage.getItem(this.storageKey(hostname));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  save(hostname, acks) {
    localStorage.setItem(this.storageKey(hostname), JSON.stringify(acks));
  },

  normalizeRecord(ts) {
    if (typeof ts === 'string') {
      return { ackedAt: ts, by: 'server' };
    }
    if (ts && typeof ts === 'object') {
      return {
        ackedAt: ts.ackedAt || ts.acked_at || new Date().toISOString(),
        by: ts.by || 'server',
        category: ts.category,
        plain_english: ts.plain_english,
      };
    }
    return { ackedAt: new Date().toISOString(), by: 'server' };
  },

  isAcked(acks, file) {
    const bare = this.bareFile(file);
    return !!(acks && (acks[bare] || acks[`crash-reports/${bare}`] || acks[file]));
  },

  getRecord(acks, file) {
    const bare = this.bareFile(file);
    return acks[bare] || acks[`crash-reports/${bare}`] || acks[file] || null;
  },

  syncFromServer(hostname, serverAcks) {
    if (!serverAcks || typeof serverAcks !== 'object') return this.load(hostname);
    const local = {};
    Object.entries(serverAcks).forEach(([file, ts]) => {
      const bare = this.bareFile(file);
      local[bare] = this.normalizeRecord(ts);
    });
    this.save(hostname, local);
    return local;
  },

  /** Merge server acks into local — server keys win; does not wipe keys absent from server. */
  mergeFromServer(hostname, serverAcks) {
    if (!serverAcks || typeof serverAcks !== 'object') return this.load(hostname);
    const local = this.load(hostname);
    Object.entries(serverAcks).forEach(([file, ts]) => {
      const bare = this.bareFile(file);
      local[bare] = this.normalizeRecord(ts);
      delete local[`crash-reports/${bare}`];
    });
    this.save(hostname, local);
    return local;
  },

  async postReview(hostname, file, reviewed, options = {}) {
    const bare = this.bareFile(file);
    if (options.apiMode) {
      try {
        const resp = await WatchtowerApi.postCrashAck({
          file: bare,
          reviewed,
          category: options.category,
          plain_english: options.plainEnglish,
        });
        if (resp?.acknowledged_crashes) {
          return this.syncFromServer(hostname, resp.acknowledged_crashes);
        }
      } catch (e) {
        console.warn('Server ack failed, using local only', e);
      }
    }

    const acks = this.load(hostname);
    if (reviewed) {
      acks[bare] = {
        ackedAt: new Date().toISOString(),
        by: 'user',
        category: options.category,
        plain_english: options.plainEnglish,
      };
    } else {
      delete acks[bare];
      delete acks[`crash-reports/${bare}`];
      delete acks[file];
    }
    this.save(hostname, acks);
    return acks;
  },

  async toggle(hostname, file, options = {}) {
    const wasAcked = this.isAcked(this.load(hostname), file);
    return this.postReview(hostname, file, !wasAcked, options);
  },

  async unack(hostname, file, options = {}) {
    return this.postReview(hostname, file, false, options);
  },

  unacknowledgedCrashes(facts, acks) {
    const summaries = facts?.optional?.crash_summaries ?? [];
    return summaries.filter((c) => !this.isAcked(acks, c.file));
  },

  reviewHistory(facts, acks) {
    const seen = new Set();
    const rows = [];
    Object.entries(acks || {}).forEach(([file, ts]) => {
      const bare = this.bareFile(file);
      if (seen.has(bare) || !this.isAcked(acks, bare)) return;
      seen.add(bare);
      const rec = this.normalizeRecord(ts);
      const summary = (facts?.optional?.crash_summaries ?? []).find((c) => this.bareFile(c.file) === bare);
      rows.push({
        file: bare,
        ...rec,
        category: rec.category || summary?.category,
        plain_english: rec.plain_english || summary?.plain_english,
      });
    });
    rows.sort((a, b) => (b.ackedAt || '').localeCompare(a.ackedAt || ''));
    return rows;
  },
};
