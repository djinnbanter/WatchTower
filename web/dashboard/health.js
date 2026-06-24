/** Health drivers, effective status, BLUF highlights, remediation plan */
const Health = {
  severityRank(s) {
    if (s === 'critical') return 3;
    if (s === 'warning') return 2;
    return 1;
  },

  backupDriver(facts) {
    const b = facts?.optional?.last_backup;
    const ext = facts?.optional?.backup_external ?? state.opsCache?.backup_external;
    const mode = state.overviewMeta?.backup_mode || Labels.backupModeFromParts(b, ext);
    if (ext?.configured && (mode === 'external_only' || mode === 'hybrid')) {
      if (ext.status === 'success' && !ext.stale) {
        return { id: 'BACKUP_OK', kind: 'backup', severity: 'ok', title: 'Backups OK', historical: false, fixes: [] };
      }
      if (ext.status === 'running') {
        return { id: 'BACKUP_OK', kind: 'backup', severity: 'ok', title: 'Backup running', historical: false, fixes: [] };
      }
      if (ext.stale || ext.status === 'stale') {
        return {
          id: 'BACKUP_STALE',
          kind: 'backup',
          severity: 'warning',
          title: Labels.issueTitle('BACKUP_STALE'),
          summary: Labels.backupExternalSummary(ext),
          historical: false,
          fixes: Labels.backupExternalFixHints(ext),
        };
      }
      if (ext.status === 'missing' || ext.status === 'failed') {
        return {
          id: 'BACKUP_NOT_FOUND',
          kind: 'backup',
          severity: 'warning',
          title: Labels.issueTitle('BACKUP_NOT_FOUND'),
          summary: Labels.backupExternalSummary(ext),
          historical: false,
          fixes: Labels.backupExternalFixHints(ext),
        };
      }
    }
    if (!b) return null;
    const st = b.status;
    if (st === 'success') {
      return { id: 'BACKUP_OK', kind: 'backup', severity: 'ok', title: 'Backups OK', historical: false, fixes: [] };
    }
    if (st === 'unconfigured') {
      return null;
    }
    if (st === 'not_found' || st === 'stale' || b.stale) {
      if (ext?.configured && (ext.status === 'success' || ext.status === 'running') && !ext.stale) {
        return null;
      }
      const id = 'BACKUP_NOT_FOUND';
      return {
        id,
        kind: 'backup',
        severity: st === 'stale' || b.stale ? 'warning' : 'warning',
        title: Labels.issueTitle(id),
        summary: Labels.backupSummary(b),
        historical: false,
        fixes: Labels.fixHints(id),
      };
    }
    return null;
  },

  modDriver(facts, ignores) {
    const errs = facts?.optional?.mod_log_errors ?? [];
    const corrupt = errs.find((e) => e.mod_id === 'pride' || e.by_category?.mod_corrupt);
    if (corrupt) {
      return {
        id: 'MOD_LOAD_FAILED',
        kind: 'mod',
        severity: 'warning',
        title: 'Mod Health Warning',
        summary: `${Labels.modFriendlyName(corrupt.mod_id)} (corrupt jar)`,
        historical: false,
        fixes: Labels.fixHints('MOD_LOAD_FAILED'),
      };
    }
    if (!ClientModIgnores.hasClientNoiseConcern(facts, ignores)) {
      return null;
    }
    const client = errs.find((e) => e.mod_id === 'client_noise');
    const summary = ClientModIgnores.effectiveSummary(facts, ignores);
    return {
      id: 'CLIENT_NOISE',
      kind: 'mod',
      severity: 'info',
      title: 'Client UI mods on server',
      summary: `${client?.total ?? 0} client-class log warnings · ${summary?.likely_removable_count ?? 0} unreviewed`,
      historical: false,
      fixes: Labels.fixHints('CLIENT_NOISE'),
    };
  },

  crashDriver(facts, acks) {
    const unacked = this.unacknowledgedCrashesExtended(facts, acks);
    if (!unacked.length) return null;
    return {
      id: 'CRASH_REPORT',
      kind: 'crash',
      severity: 'critical',
      title: `Unresolved Crashes (${unacked.length})`,
      summary: `${unacked.length} crash report(s) need review`,
      historical: unacked.every((c) => c.historical),
      fixes: Labels.fixHints('CRASH_REPORT'),
      crashes: unacked,
    };
  },

  countUnreviewedCrashes(facts, acks) {
    const cache = typeof state !== 'undefined' ? state.opsCache?.crashes : null;
    const cacheAt = typeof state !== 'undefined' ? state.opsCache?.updated_at : null;
    const reportAt = typeof state !== 'undefined' ? state.overviewMeta?.last_report_at : null;
    if (cache?.unreviewed != null && cacheAt && (!reportAt || new Date(cacheAt) >= new Date(reportAt))) {
      return cache.unreviewed;
    }
    return Acks.unacknowledgedCrashes(facts, acks).length;
  },

  unacknowledgedCrashesExtended(facts, acks) {
    const rows = [...(facts?.optional?.crash_summaries ?? [])];
    const seen = new Set(rows.map((c) => Acks.bareFile(c.file)));
    const cacheEntries = typeof state !== 'undefined' ? (state.opsCache?.crashes?.entries ?? []) : [];
    cacheEntries.forEach((entry) => {
      const bare = Acks.bareFile(entry.file);
      if (seen.has(bare)) return;
      if (Acks.isAcked(acks, entry.file)) return;
      rows.push({
        file: entry.file,
        display_label: entry.display_label,
        historical: false,
        scan_only: true,
      });
      seen.add(bare);
    });
    return rows.filter((c) => !Acks.isAcked(acks, c.file));
  },

  issueDrivers(facts, acks) {
    const drivers = [];
    const issues = facts?.issues ?? [];
    issues.forEach((i) => {
      if (i.id === 'CRASH_REPORT' || i.id === 'MOD_LOAD_FAILED') return;
      if (i.id === 'BACKUP_NOT_CONFIGURED' || i.id === 'BACKUP_NOT_FOUND') return;
      drivers.push({
        id: i.id,
        kind: 'issue',
        severity: i.severity || 'warning',
        title: Labels.issueTitle(i.id),
        summary: Labels.issueSummary(i),
        historical: !!i.historical,
        fixes: Labels.fixHints(i.id),
      });
    });
    return drivers;
  },

  buildHealthDrivers(facts, acks, ignores) {
    const list = [];
    const backup = this.backupDriver(facts);
    if (backup && backup.severity !== 'ok') list.push(backup);
    const mod = this.modDriver(facts, ignores);
    if (mod) list.push(mod);
    const crash = this.crashDriver(facts, acks);
    if (crash) list.push(crash);
    list.push(...this.issueDrivers(facts, acks));
    return list;
  },

  displayHealth(facts, acks, ignores) {
    const h = facts?.health || {};
    const overall = h.status || 'ok';
    const current = h.current_status || overall;
    const drivers = this.buildHealthDrivers(facts, acks, ignores);

    let effective = overall;

    const allCriticalAcked = drivers.filter((d) => d.severity === 'critical').length === 0
      || (drivers.some((d) => d.id === 'CRASH_REPORT') && Acks.unacknowledgedCrashes(facts, acks).length === 0);

    if (overall === 'critical' && allCriticalAcked) {
      const activeWorst = drivers.filter((d) => !d.historical)
        .reduce((w, d) => Math.max(w, this.severityRank(d.severity)), 0);
      effective = activeWorst >= 3 ? 'critical' : activeWorst >= 2 ? 'warning' : 'ok';
    }

    const ackCount = (facts?.optional?.crash_summaries ?? []).length - Acks.unacknowledgedCrashes(facts, acks).length;

    return { overall, current, effective, drivers, ackCount, statusNote: h.status_note || '' };
  },

  buildRemediationPlan(facts, acks, ignores) {
    const items = [];
    const summaries = facts?.optional?.crash_summaries ?? [];
    summaries.forEach((c) => {
      const acked = Acks.isAcked(acks, c.file);
      const label = c.display_label || c.exception || c.summary || 'Crash report';
      items.push({
        id: `crash:${c.file}`,
        title: label.length > 80 ? `${label.slice(0, 77)}…` : label,
        severity: 'critical',
        blocksOverall: true,
        blocksCurrent: false,
        resolvedBy: 'ack',
        completed: acked,
        fixes: Labels.fixHints('CRASH_REPORT'),
        kind: 'crash',
        file: c.file,
      });
    });

    const backup = this.backupDriver(facts);
    if (backup && backup.severity !== 'ok') {
      items.push({
        id: backup.id,
        title: backup.title,
        severity: 'warning',
        blocksOverall: true,
        blocksCurrent: true,
        resolvedBy: 'config',
        completed: false,
        fixes: backup.fixes,
        summary: backup.summary,
        kind: 'backup',
      });
    }

    const errs = facts?.optional?.mod_log_errors ?? [];
    const corrupt = errs.find((e) => e.mod_id === 'pride' || e.by_category?.mod_corrupt);
    if (corrupt) {
      items.push({
        id: 'MOD_LOAD_FAILED',
        title: `Fix ${Labels.modFriendlyName(corrupt.mod_id)}`,
        severity: 'warning',
        blocksOverall: false,
        blocksCurrent: true,
        resolvedBy: 'fix',
        completed: false,
        fixes: Labels.fixHints('MOD_LOAD_FAILED'),
        kind: 'mod',
        modId: corrupt.mod_id,
      });
    }

    const clientSummary = ClientModIgnores.effectiveSummary(facts, ignores);
    const clientErr = errs.find((e) => e.mod_id === 'client_noise');
    if (clientErr && clientSummary && ClientModIgnores.hasActionableClientMods(facts, ignores)) {
      items.push({
        id: 'CLIENT_NOISE',
        title: 'Client-only mods on server',
        severity: 'info',
        blocksOverall: false,
        blocksCurrent: false,
        resolvedBy: 'fix',
        completed: false,
        optional: true,
        fixes: Labels.fixHints('CLIENT_NOISE'),
        kind: 'client_mods',
        summary: `${clientSummary.likely_removable_count ?? 0} likely removable`,
      });
    }

    (facts?.issues ?? []).forEach((i) => {
      if (['CRASH_REPORT', 'MOD_LOAD_FAILED', 'BACKUP_NOT_CONFIGURED', 'BACKUP_NOT_FOUND'].includes(i.id)) return;
      items.push({
        id: i.id,
        title: Labels.issueTitle(i.id),
        severity: i.severity || 'warning',
        blocksOverall: !!i.historical && i.severity === 'critical',
        blocksCurrent: !i.historical,
        resolvedBy: 'fix',
        completed: false,
        fixes: Labels.fixHints(i.id),
        kind: 'issue',
        message: i.message,
        historical: !!i.historical,
      });
    });

    return items;
  },

  computePathToGood(facts, acks, ignores) {
    const plan = this.buildRemediationPlan(facts, acks, ignores);
    const required = plan.filter((p) => !p.optional);
    const blockers = required.filter((p) => !p.completed && (p.blocksOverall || p.blocksCurrent));
    const completed = required.filter((p) => p.completed);
    const health = this.displayHealth(facts, acks, ignores);
    return {
      overall: health.overall,
      effective: health.effective,
      current: health.current,
      target: 'ok',
      blockers,
      completed,
      total: required.length,
      resolvedCount: completed.length,
      plan,
    };
  },

  issueActionTab(issueId) {
    if (issueId === 'CRASH_REPORT') return 'crashes';
    if (issueId === 'MOD_LOAD_FAILED') return 'mods';
    if (issueId?.startsWith('BACKUP_')) return 'backups';
    return null;
  },

  buildActionQueue(facts, acks, ignores) {
    const items = [];
    const coveredIssueIds = new Set();
    const issues = facts?.issues ?? [];

    const unacked = Acks.unacknowledgedCrashes(facts, acks);
    if (unacked.length) {
      coveredIssueIds.add('CRASH_REPORT');
      const evidence = unacked.slice(0, 3).map((c) => ({
        file: c.file,
        quote: c.exception || c.summary || c.plain_english || '',
        time: c.time,
      }));
      const allHistorical = unacked.every((c) => c.historical);
      items.push({
        key: 'crash:unreviewed',
        kind: 'crash',
        severity: 'critical',
        tier: allHistorical ? 'historical' : 'now',
        title: `${unacked.length} unreviewed crash${unacked.length === 1 ? '' : 's'}`,
        summary: 'Review crash reports and acknowledge on the Crashes tab when resolved.',
        detail: null,
        primaryAction: { label: 'Open Crashes', tab: 'crashes' },
        fixes: Labels.fixHints('CRASH_REPORT'),
        evidence,
        when: unacked[0]?.time || null,
        issue: issues.find((i) => i.id === 'CRASH_REPORT') || null,
        meta: { count: unacked.length, moreCount: Math.max(0, unacked.length - 3) },
      });
    }

    const backup = this.backupDriver(facts);
    if (backup && backup.severity !== 'ok') {
      ['BACKUP_NOT_CONFIGURED', 'BACKUP_NOT_FOUND', 'BACKUP_STALE'].forEach((id) => coveredIssueIds.add(id));
      const backupIssue = issues.find((i) => i.id.startsWith('BACKUP_')) || null;
      items.push({
        key: `backup:${backup.id}`,
        kind: 'backup',
        severity: 'warning',
        tier: backupIssue?.historical ? 'historical' : 'now',
        title: backup.title,
        summary: backup.summary,
        detail: backupIssue?.message || null,
        primaryAction: { label: 'Open Backups', tab: 'backups' },
        fixes: backup.fixes,
        evidence: backupIssue?.evidence || [],
        when: null,
        issue: backupIssue,
        meta: { backupId: backup.id },
      });
    }

    const modErrs = (facts?.optional?.mod_log_errors ?? []).filter((e) => e.mod_id !== 'client_noise');
    const recs = (facts?.optional?.mod_recommendations ?? [])
      .filter((r) => r.severity === 'warning' || r.severity === 'critical');
    const modIssue = issues.find((i) => i.id === 'MOD_LOAD_FAILED') || null;
    const conflictIssue = issues.find((i) => i.id === 'MOD_UPDATE_CONFLICT') || null;
    const conflictRecs = (facts?.optional?.mod_recommendations ?? []).filter((r) =>
      ['recipe_compat', 'mod_load_failed', 'registry_missing'].includes(r.category) || r.action);
    if (conflictIssue && conflictRecs.length) {
      coveredIssueIds.add('MOD_UPDATE_CONFLICT');
      if (modIssue) coveredIssueIds.add('MOD_LOAD_FAILED');
      const top = conflictRecs.slice(0, 3);
      items.push({
        key: 'mod:update_conflicts',
        kind: 'mod',
        severity: 'warning',
        tier: conflictIssue.historical ? 'historical' : 'now',
        title: conflictRecs.length === 1
          ? Labels.modProblemTitle(conflictRecs[0])
          : `Mod update conflicts (${conflictRecs.length})`,
        summary: conflictIssue.message || 'Mod versions or compat pairs need alignment.',
        detail: conflictIssue.message || null,
        primaryAction: { label: 'Open Mods', tab: 'mods', filter: 'conflicts' },
        fixes: Labels.fixHints('MOD_UPDATE_CONFLICT'),
        evidence: top.map((r) => ({
          file: r.mod_id,
          quote: r.action_detail || r.fix || r.why || '',
          time: null,
        })),
        when: null,
        issue: conflictIssue,
        meta: { count: conflictRecs.length, recs: top },
      });
    } else if (modIssue) {
      coveredIssueIds.add('MOD_LOAD_FAILED');
    }

    const modIds = new Set();
    modErrs.forEach((e) => { if (e.mod_id) modIds.add(e.mod_id); });
    recs.forEach((r) => { if (r.mod_id) modIds.add(r.mod_id); });
    if (modIssue && !modIds.size) {
      const m = modIssue.message?.match(/:\s*(\w+)/);
      if (m) modIds.add(m[1]);
    }

    const modIdList = [...modIds];
    if (conflictIssue && conflictRecs.length) {
      // Aggregated conflict row above covers compat/update noise.
    } else if (modIdList.length > 3) {
      const samples = recs.slice(0, 2).map((r) => ({
        file: r.mod_id,
        quote: r.why || r.sample_line || '',
        time: null,
      }));
      items.push({
        key: 'mod:aggregate',
        kind: 'mod',
        severity: 'warning',
        tier: modIssue?.historical ? 'historical' : 'now',
        title: `${modIdList.length} mods with log errors`,
        summary: modIssue?.message || 'Multiple mods need attention — see Mods tab for details.',
        detail: modIssue?.message || null,
        primaryAction: { label: 'Open Mods', tab: 'mods' },
        fixes: Labels.fixHints('MOD_LOAD_FAILED'),
        evidence: samples,
        when: null,
        issue: modIssue,
        meta: { count: modIdList.length, modIds: modIdList },
      });
    } else if (!conflictIssue || !conflictRecs.length) {
      modIdList.forEach((modId) => {
        const err = modErrs.find((e) => e.mod_id === modId);
        const rec = recs.find((r) => r.mod_id === modId);
        const sampleLines = err?.sample_lines || rec?.sample_lines
          || (err?.sample_line ? [err.sample_line] : [])
          || (rec?.sample_line ? [rec.sample_line] : []);
        const evidence = sampleLines.slice(0, 3).map((line) => ({
          file: modId,
          quote: String(line),
          time: null,
        }));
        items.push({
          key: `mod:${modId}`,
          kind: 'mod',
          severity: rec?.severity === 'critical' ? 'critical' : 'warning',
          tier: modIssue?.historical ? 'historical' : 'now',
          title: rec ? Labels.modProblemTitle(rec) : Labels.modFriendlyName(modId),
          summary: (rec?.why || rec?.explanation || err?.sample_line || modIssue?.message || 'Mod errors in logs.')
            .split('—')[0].trim().slice(0, 140),
          detail: rec?.why || rec?.explanation || modIssue?.message || null,
          primaryAction: { label: 'Open Mods', tab: 'mods' },
          fixes: (() => {
            if (rec?.fix_steps?.length) return rec.fix_steps;
            if (rec?.category === 'mod_corrupt' || rec?.category === 'mod_load_failed') {
              const steps = Labels.modDrFixSteps(modId, rec.category);
              if (steps.length) return steps;
            }
            if (rec?.fix) {
              return [rec.fix, ...(rec.install_hint ? [rec.install_hint] : [])];
            }
            return Labels.fixHints('MOD_LOAD_FAILED');
          })(),
          evidence,
          when: null,
          issue: modIssue,
          meta: { modId, rec, err, shouldWorry: rec?.should_worry },
        });
      });
    }
    if (modIssue && !modIdList.length) {
      items.push({
        key: 'mod:issue',
        kind: 'mod',
        severity: modIssue.severity || 'warning',
        tier: modIssue.historical ? 'historical' : 'now',
        title: Labels.issueTitle('MOD_LOAD_FAILED'),
        summary: Labels.issueSummary(modIssue),
        detail: modIssue.message || null,
        primaryAction: { label: 'Open Mods', tab: 'mods' },
        fixes: Labels.fixHints('MOD_LOAD_FAILED'),
        evidence: modIssue.evidence || [],
        when: null,
        issue: modIssue,
        meta: {},
      });
    }

    const clientErr = (facts?.optional?.mod_log_errors ?? []).find((e) => e.mod_id === 'client_noise');
    const clientSummary = ClientModIgnores.effectiveSummary(facts, ignores);
    if (clientErr && clientSummary && ClientModIgnores.hasActionableClientMods(facts, ignores)) {
      coveredIssueIds.add('CLIENT_NOISE');
      items.push({
        key: 'mod:client_noise',
        kind: 'info',
        severity: 'info',
        tier: 'soon',
        title: 'Client-only mods on server',
        summary: Labels.clientModIntro(clientSummary, clientErr.total),
        detail: null,
        primaryAction: { label: 'Open Mods', tab: 'mods' },
        fixes: Labels.fixHints('CLIENT_NOISE'),
        evidence: [],
        when: null,
        issue: issues.find((i) => i.id === 'CLIENT_NOISE') || null,
        meta: { removableCount: clientSummary.likely_removable_count ?? 0 },
      });
    }

    issues.forEach((i) => {
      if (coveredIssueIds.has(i.id)) return;
      const tab = this.issueActionTab(i.id);
      items.push({
        key: `issue:${i.id}`,
        kind: 'issue',
        severity: i.severity || 'warning',
        tier: i.historical ? 'historical' : 'now',
        title: Labels.issueTitle(i.id),
        summary: Labels.issueSummary(i),
        detail: i.message || null,
        primaryAction: tab ? { label: `Open ${tab}`, tab } : null,
        fixes: Labels.fixHints(i.id),
        evidence: i.evidence || [],
        when: i.event_time || null,
        issue: i,
        meta: { issueId: i.id, eventSource: i.event_source },
      });
    });

    const tierOrder = { now: 0, soon: 1, historical: 2 };
    items.sort((a, b) => {
      const td = tierOrder[a.tier] - tierOrder[b.tier];
      if (td !== 0) return td;
      const sd = this.severityRank(b.severity) - this.severityRank(a.severity);
      if (sd !== 0) return sd;
      return a.title.localeCompare(b.title);
    });

    return items;
  },

  buildTldrHtml(facts, acks, liveLatest, ignores) {
    const h = facts?.health || {};
    const health = this.displayHealth(facts, acks, ignores);
    const mc = facts?.minecraft || {};
    const sys = facts?.system || {};
    const parts = [];

    const players = liveLatest?.players_online ?? mc.players_online_now ?? 0;
    const tps = liveLatest?.tps ?? mc.tps?.overworld?.tps ?? facts?.optional?.watchtower_native?.dimensions?.[0]?.tps ?? 20;
    const mspt = liveLatest?.mspt ?? mc.tps?.overworld?.mspt ?? 0;

    if (h.java_running) {
      parts.push(`<strong class="text-green">The server is online</strong> with ${players} player${players === 1 ? '' : 's'} connected. Tick performance is ${Number(tps).toFixed(1)} TPS (${Number(mspt).toFixed(1)} ms per tick).`);
    } else {
      parts.push('<strong class="text-red">The Minecraft process is not running.</strong> Check Crafty or your panel and review recent logs.');
    }

    const overallWord = Labels.healthStatus(health.overall);
    const sessionWord = Labels.healthStatus(health.current);
    if (health.overall === health.current) {
      parts.push(` Overall health is <strong class="severity-${health.overall}">${overallWord}</strong> — no split between long-term and current session status.`);
    } else {
      parts.push(` Overall health is <strong class="severity-${health.overall}">${overallWord}</strong> (includes historical issues), but the <em>current session</em> is <strong class="severity-${health.current}">${sessionWord}</strong>.`);
    }

    const blockers = [];
    const backup = this.backupDriver(facts);
    if (backup && backup.severity !== 'ok') blockers.push('backup not found in the lookback window');
    const unackedCount = this.countUnreviewedCrashes(facts, acks);
    if (unackedCount) blockers.push(`${unackedCount} unacknowledged crash report${unackedCount === 1 ? '' : 's'}`);
    const modErrs = (facts?.optional?.mod_log_errors ?? []).filter((e) => e.mod_id !== 'client_noise');
    if (modErrs.length) blockers.push(`${modErrs.length} mod${modErrs.length === 1 ? '' : 's'} with log errors`);
    const activeIssues = (facts?.issues ?? []).filter((i) => !i.historical);
    if (activeIssues.length) blockers.push(`${activeIssues.length} active issue${activeIssues.length === 1 ? '' : 's'}`);

    if (blockers.length) {
      parts.push(` <strong class="text-yellow">Attention needed:</strong> ${escHtml(blockers.join('; '))}.`);
    } else if (health.effective === 'ok') {
      parts.push(' No blockers detected in the latest report.');
    }

    const next = [];
    if (unackedCount) next.push('acknowledge or fix crash reports on the Crashes tab');
    if (backup && backup.severity !== 'ok') next.push('configure or verify backups');
    if (modErrs.length) next.push('review mod errors on the Mods tab');
    if (next.length) {
      parts.push(` <a href="#" class="tab-link" data-tab="issues">Next steps:</a> ${escHtml(next.join('; '))}.`);
    } else if (health.effective !== 'ok') {
      parts.push(' <a href="#" class="tab-link" data-tab="issues">Open Issues tab</a> for the full remediation checklist.');
    }

    if (sys.host_cpu_pct_now != null && sys.host_cpu_pct_now >= 85) {
      parts.push(` Host CPU is elevated at ${Math.round(sys.host_cpu_pct_now)}% — check Live tab if TPS drops.`);
    }

    const crashTldr = typeof state !== 'undefined' ? state.overviewMeta?.crash_tldr : null;
    if (crashTldr?.label) {
      const when = crashTldr.at ? ` (${typeof fmtRelative === 'function' ? fmtRelative(crashTldr.at) : crashTldr.at})` : '';
      parts.push(` <strong>Latest crash:</strong> ${escHtml(crashTldr.label)}${when}. <a href="#" class="tab-link" data-tab="crashes">Open Crashes tab →</a>`);
    }

    const lagTldr = typeof state !== 'undefined' ? state.overviewMeta?.lag_tldr : null;
    if (lagTldr?.label) {
      const sev = lagTldr.severity === 'critical' ? 'Critical lag spike' : 'Lag spike';
      parts.push(` <strong>${escHtml(sev)}:</strong> ${escHtml(lagTldr.label)}${lagTldr.narrative ? ` — ${escHtml(String(lagTldr.narrative).slice(0, 120))}` : ''}. <a href="#" class="tab-link" data-tab="issues">Open Issues tab →</a>`);
    }

    const modTldr = typeof state !== 'undefined' ? state.overviewMeta?.mod_tldr : null;
    if (modTldr?.label) {
      const sev = modTldr.severity === 'critical' ? 'Mod errors' : 'Mod log errors';
      const count = modTldr.count != null ? ` (${modTldr.count})` : '';
      parts.push(` <strong>${escHtml(sev)}${count}:</strong> ${escHtml(modTldr.label)}. <a href="#" class="tab-link" data-tab="mods">Open Mods tab →</a>`);
    }

    const sparkTldr = typeof state !== 'undefined' ? state.overviewMeta?.spark_tldr : null;
    const sparkProfile = facts?.optional?.spark_profile;
    const sparkLabel = sparkTldr?.label
      || (sparkProfile?.fresh !== false && sparkProfile?.verdict?.headline ? sparkProfile.verdict.headline : null);
    if (sparkLabel) {
      parts.push(` <strong>Spark:</strong> ${escHtml(sparkLabel)}. <a href="#" class="tab-link" data-tab="spark">Open Spark report →</a>`);
    }

    return parts.map((p) => `<p class="wt-welcome__prose-p">${p.trim()}</p>`).join('');
  },

  /** @deprecated use buildTldrHtml */
  buildBlufHtml(facts, acks) {
    return this.buildTldrHtml(facts, acks, null);
  },

  buildActionSteps(facts, acks, maxSteps, ignores) {
    const steps = [];
    const recs = facts?.optional?.mod_recommendations ?? [];
    recs.filter((r) => r.severity === 'warning' || r.severity === 'critical').forEach((r) => {
      const fixSteps = r.fix_steps?.length
        ? r.fix_steps
        : (r.category === 'mod_corrupt' || r.category === 'mod_load_failed'
          ? Labels.modDrFixSteps(r.mod_id, r.category)
          : []);
      if (fixSteps.length) {
        steps.push({
          severity: r.severity === 'critical' ? 'critical' : 'warning',
          title: Labels.modAlertTitle(r.mod_id, r.category),
          fixSteps,
          code: r.mod_id,
        });
        return;
      }
      steps.push({
        severity: r.severity === 'critical' ? 'critical' : 'warning',
        title: Labels.modAlertTitle(r.mod_id, r.category),
        body: r.fix || r.why || '',
        code: r.mod_id,
      });
    });
    const backup = this.backupDriver(facts);
    if (backup && backup.severity !== 'ok') {
      steps.push({
        severity: 'warning',
        title: 'Set up backups',
        body: Labels.backupSummary(facts.optional.last_backup),
        code: null,
      });
    }
    const ackMap = acks ?? Acks.load(facts?.meta?.hostname);
    const unacked = Acks.unacknowledgedCrashes(facts, ackMap);
    if (unacked.length) {
      steps.push({
        severity: 'critical',
        title: 'Review crash reports',
        body: Labels.fixHints('CRASH_REPORT')[0] || 'Open crash-reports/ and address cited mods.',
        code: null,
      });
    }
    const clientSummary = ClientModIgnores.effectiveSummary(facts, ignores);
    if (clientSummary?.likely_removable_count > 0) {
      steps.push({
        severity: 'info',
        title: 'Reduce client-mod log noise',
        body: `${clientSummary.likely_removable_count} client-only mods can be removed from server mods/ — see Mods tab.`,
        code: null,
      });
    }
    if (maxSteps != null && maxSteps > 0) return steps.slice(0, maxSteps);
    return steps;
  },
};

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}
