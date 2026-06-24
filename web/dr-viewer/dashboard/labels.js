/** Friendly labels for end users — technical ids in <details> only */
const Labels = {
  issueTitle(id) {
    const m = {
      MOD_LOAD_FAILED: 'Mod problem',
      MOD_UPDATE_CONFLICT: 'Mod update conflicts',
      CRASH_REPORT: 'Crash reports on disk',
      BACKUP_NOT_CONFIGURED: 'Backups not set up',
      BACKUP_NOT_FOUND: 'Backup failure',
      BACKUP_STALE: 'Backup is stale',
      MANUAL_REBOOT: 'Server machine rebooted',
      OOM: 'Out of memory',
      DISK_HIGH: 'Disk almost full',
      MEM_LOW: 'Low system memory',
      TICK_LAG: 'Server falling behind',
      MSPT_HIGH: 'High tick time',
      TPS_LOW: 'Low TPS',
      DH_PREGEN_THROTTLE: 'World pregen slowing server',
      DH_PREGEN_STALL: 'World pregen may be stuck',
      CHUNKY_PREGEN_STALL: 'Chunky pregen may be stuck',
      CHUNKY_PREGEN_DEGRADED: 'Chunky pregen running slowly',
      CHUNKY_PREGEN_THROTTLE: 'Chunky pregen during high load',
      CHUNK_GEN_DURING_PREGEN: 'Chunk errors during pregen',
      PANEL_DOWN: 'Control panel offline',
      LOG_STALE: 'Logs look stale',
    };
    return m[id] || id.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  },

  issueSummary(i) {
    if (i.id === 'CRASH_REPORT') return 'Crash reports found in the lookback window — review before next session.';
    if (i.id === 'BACKUP_NOT_CONFIGURED') return 'No backup directory configured — set BACKUP_DIR on the host.';
    if (i.id === 'BACKUP_NOT_FOUND') return 'No backup archive found in the lookback window.';
    if (i.id === 'MOD_LOAD_FAILED') return 'One or more mods failed to load correctly.';
    if (i.id === 'MOD_UPDATE_CONFLICT') return i.message || 'Mod versions or compat pairs need alignment.';
    return (i.message || '').split('—')[0].trim().slice(0, 120);
  },

  modLogName(row) {
    if (!row) return 'Unknown';
    if (row.display_name) return row.display_name;
    const id = row.mod_id;
    const m = {
      client_noise: 'Client UI mods on server',
      pride: 'Pride (cosmetic mod)',
    };
    return m[id] || id;
  },

  modFriendlyName(modId) {
    const m = {
      modmenu: 'Mod Menu',
      appleskin: 'AppleSkin (hunger HUD)',
      lambdynlights: 'LambDynamicLights',
      xaerominimap: "Xaero's Minimap",
      xaeroworldmap: "Xaero's World Map",
      xaerotrainmap: "Xaero's Train Map",
      veil: 'Veil (shaders)',
      ponder: 'Create Ponder',
      pride: 'Pride',
      connectorextras_emi_bridge: 'Connector EMI bridge',
      connectorextras_jei_bridge: 'Connector JEI bridge',
      connectorextras_modmenu_bridge: 'Connector Mod Menu bridge',
      sound_physics_remastered: 'Sound Physics',
      spruceui: 'SpruceUI',
      statuemenus: 'Statue Menus',
      trashslot: 'Trash Slot',
      yeetusexperimentus: 'Yeetus Experimentus',
    };
    return m[modId] || modId;
  },

  modAlertTitle(modId, category) {
    if (category === 'mod_corrupt' || modId === 'pride') return 'Broken mod file';
    if (modId === 'client_noise' || category === 'client_on_server') return 'Client UI mods on server (usually harmless)';
    return Labels.modLogName({ mod_id: modId });
  },

  modProblemTitle(rec) {
    if (rec?.action_detail) return rec.action_detail;
    if (rec?.display_name) return rec.display_name;
    return Labels.modAlertTitle(rec?.mod_id, rec?.category);
  },

  modActionLabel(action) {
    const m = {
      update: 'Update',
      downgrade: 'Downgrade',
      remove: 'Remove',
      install: 'Install',
      pair_update: 'Update both mods',
    };
    return m[action] || 'Fix';
  },

  thermalUnavailableMessage(reason, panel) {
    const lines = [
      'CPU temperature is not available on this host.',
      'Rented VPS / shared hosting usually hides hardware sensors.',
      'Docker and panel containers often cannot read the host CPU.',
      'Bare-metal Linux needs lm-sensors or sysfs hwmon.',
    ];
    const p = (panel || '').toLowerCase();
    if (p === 'discopanel' || p === 'docker') {
      lines.splice(1, 0, 'This Minecraft server runs in a container — host CPU sensors are not mapped in.');
    }
    if (reason === 'docker_container') {
      return lines.slice(0, 3).join(' ');
    }
    if (reason === 'unavailable') {
      return lines.join(' ');
    }
    return lines.join(' ');
  },

  preCrashSummary(pre) {
    if (!pre) return 'No pre-crash data';
    const parts = [];
    const tps = pre.tps;
    if (tps?.min != null && tps?.max != null) {
      parts.push(`TPS ${tps.min}–${tps.max}${tps.last != null ? ` (last ${tps.last})` : ''}`);
    }
    if (pre.mspt?.max != null) {
      parts.push(`MSPT peak ${pre.mspt.max}ms`);
    }
    const cg = pre.chunk_gen;
    if (cg?.active) {
      const src = cg.source === 'chunky' ? 'Chunky' : cg.source === 'dh_pregen' ? 'DH pregen' : 'Chunk gen';
      parts.push(cg.pct != null ? `${src} ${cg.pct}%` : src);
    }
    const cmdN = pre.commands?.length ?? 0;
    if (cmdN) parts.push(`${cmdN} command${cmdN === 1 ? '' : 's'}`);
    if (!parts.length && pre.unavailable_reason) return pre.unavailable_reason;
    return parts.length ? parts.join(' · ') : 'No activity recorded in window';
  },

  modCategoryLabel(category) {
    const m = {
      mod_corrupt: 'Broken mod file',
      mod_load_failed: 'Mod failed to load',
      recipe_missing_item: 'Missing recipe item',
      recipe_compat: 'Recipe compatibility',
      recipe_format: 'Recipe format',
      registry_missing: 'Missing registry entry',
      loot_parse: 'Loot table parse',
      client_on_server: 'Client-only on server',
      engine_packaging: 'Engine packaging',
      logger_error: 'Log error',
    };
    return m[category] || (category || 'Mod issue').replace(/_/g, ' ');
  },

  modWorryBadge(rec) {
    const level = rec?.worry_level || (rec?.action_needed ? 'action' : 'monitor');
    const m = {
      informational: { text: 'No action needed', cls: 'mod-worry-info' },
      low: { text: 'Low priority', cls: 'mod-worry-info' },
      monitor: { text: 'Monitor', cls: 'mod-worry-monitor' },
      action: { text: 'Fix soon', cls: 'mod-worry-action' },
      critical: { text: 'Fix before players', cls: 'mod-worry-critical' },
    };
    return m[level] || m.monitor;
  },

  crashCategoryLabel(category) {
    const m = {
      mod: 'Mod-related',
      host_resource: 'Host & resources',
      loader: 'Loader',
      unknown: 'Unknown',
    };
    return m[category] || 'Unknown';
  },

  crashCategoryClass(category) {
    const m = { mod: 'crash-cat-mod', host_resource: 'crash-cat-host', loader: 'crash-cat-loader', unknown: 'crash-cat-unknown' };
    return m[category] || 'crash-cat-unknown';
  },

  clientModReason(modId, fallback) {
    const m = {
      appleskin: 'Hunger/saturation HUD — player screen only',
      modmenu: 'Mod list menu — client UI only',
      lambdynlights: 'Dynamic lights — client rendering',
      xaerominimap: 'Minimap — client only on dedicated servers',
      xaeroworldmap: 'World map UI — client only',
      xaerotrainmap: 'Train map UI — client only',
      veil: 'Client rendering/shaders',
      ponder: 'Create tutorial scenes — client UI',
      sound_physics_remastered: '3D sound — usually client-side',
      spruceui: 'UI library — client oriented',
      statuemenus: 'Client menu UI',
      trashslot: 'Inventory trash slot — client UI',
      yeetusexperimentus: 'Client-side experiments',
    };
    return m[modId] || fallback || 'Typically client-only on a dedicated server';
  },

  bucketTitle(bucket) {
    const m = {
      likely_removable: 'Safe to remove from server (verify first)',
      client_library: 'Keep — may be required by other mods',
      uncertain: 'Review manually before removing',
      test_remove: 'Test before removing',
    };
    return m[bucket] || bucket;
  },

  clientModVerdict(bucket) {
    const m = {
      likely_removable: 'Safe to remove',
      client_library: 'Library — keep',
      uncertain: 'Review manually',
      test_remove: 'Test first',
    };
    return m[bucket] || 'Review';
  },

  clientModConfidenceLabel(confidence) {
    if (confidence === 'high') return 'High confidence';
    if (confidence === 'low') return 'Low confidence';
    return 'Medium confidence';
  },

  crashConfidenceLabel(confidence, manualReview) {
    if (manualReview || confidence === 'low') return 'Needs manual review';
    if (confidence === 'high') return 'High confidence';
    if (confidence === 'medium') return 'Medium confidence';
    return 'Review suggested';
  },

  crashConfidenceClass(confidence, manualReview) {
    if (manualReview || confidence === 'low') return 'warn';
    if (confidence === 'high') return 'ok';
    return 'info';
  },

  eventType(type) {
    const t = type === 'crash' ? 'crash_report' : type === 'reboot' ? 'manual_reboot' : type;
    const m = {
      server_start: 'Lifecycle',
      clean_stop: 'Lifecycle',
      crash_report: 'Crash',
      manual_reboot: 'System',
      panel_command: 'Task',
      player_join: 'Session',
      player_leave: 'Session',
      command: 'Task',
      tick_lag: 'System',
      lag_incident: 'System',
      kernel_oom: 'System',
      backup_job: 'Task',
      restart_scheduled: 'Lifecycle',
      performance_spike: 'Performance',
    };
    return m[t] || 'Event';
  },

  eventTitle(ev) {
    const t = ev.type === 'crash' ? 'crash_report' : ev.type === 'reboot' ? 'manual_reboot' : ev.type;
    const d = (ev.detail || '').toLowerCase();
    if (t === 'server_start') return 'Server started';
    if (t === 'clean_stop') return 'Server stopped cleanly';
    if (t === 'crash_report') return 'Crash report saved';
    if (t === 'manual_reboot') return 'Machine rebooted';
    if (t === 'kernel_oom') return 'Out-of-memory kill';
    if (t === 'player_join') return ev.detail || 'Player joined';
    if (t === 'player_leave') return ev.detail || 'Player left';
    if (t === 'command') return ev.detail ? `Command: ${ev.detail}` : 'Command issued';
    if (t === 'tick_lag') return 'Server tick lag';
    if (t === 'lag_incident') return 'Lag spike captured';
    if (t === 'backup_job') return ev.detail ? `Backup: ${ev.detail}` : 'Backup in progress';
    if (t === 'restart_scheduled') return ev.detail || 'Restart scheduled';
    if (t === 'performance_spike') return ev.detail || 'Sticky lag after players left';
    if (d.includes('pregen')) return 'World pregen command';
    if (d.includes('start_server')) return 'Panel started server';
    if (d.includes('restart')) return 'Panel restarted server';
    return ev.detail || ev.type || 'Activity';
  },

  healthStatus(status) {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
  },

  pregenTitle(kind) {
    return kind === 'chunky' ? 'Chunky pregen' : 'Distant Horizons pregen';
  },

  pregenSectionSubtitle() {
    return 'Detected from server log — DH or Chunky';
  },

  shouldShowEnvironmentBanner(env, enabled = true) {
    if (!enabled || !env) return false;
    if (env.deployment && env.deployment !== 'bare_metal') return true;
    const metrics = env.metrics || {};
    return Object.values(metrics).some((m) => m?.status === 'misleading');
  },

  environmentBannerText(env, liveLatest) {
    if (env?.summary) return env.summary;
    const parts = [];
    if (env?.deployment && env.deployment !== 'bare_metal') {
      parts.push(`Running in ${env.deployment.replace(/_/g, ' ')}`);
    }
    if (env?.hosting?.panel_name) {
      parts.push(`${env.hosting.panel_name} panel`);
    }
    const live = liveLatest || {};
    if (live.cpu_limit_cores != null) {
      parts.push(`${Number(live.cpu_limit_cores).toFixed(1)} CPU cores allocated`);
    }
    if (live.mem_total_gb != null) {
      parts.push(`${Number(live.mem_total_gb).toFixed(1)} GB RAM limit`);
    }
    const misleading = Object.entries(env?.metrics || {})
      .filter(([, m]) => m?.status === 'misleading' || m?.status === 'approximate')
      .map(([k, m]) => m.display_label || k.replace(/_/g, ' '));
    if (misleading.length) {
      parts.push(`Some metrics are scoped (${misleading.slice(0, 3).join(', ')})`);
    }
    return parts.length ? parts.join(' · ') : 'Some host metrics may be misleading in this environment.';
  },

  metricTrustBadge(metric) {
    if (!metric?.status || metric.status === 'trusted') return '';
    const labelMap = { misleading: 'Scoped', approximate: 'Approximate', unavailable: 'Unavailable' };
    const label = metric.display_label || labelMap[metric.status]
      || metric.status.charAt(0).toUpperCase() + metric.status.slice(1);
    const note = metric.note || metric.reason || '';
    const cls = metric.status === 'misleading' ? 'scoped' : metric.status;
    return `<span class="metric-trust-badge ${cls}" title="${esc(note)}">${label}</span>`;
  },

  liveCpuCaption(latest, sys, env) {
    const cpu = latest?.host_cpu_pct ?? sys?.host_cpu_pct_now;
    const cores = latest?.cpu_count ?? sys?.cpu_count;
    const loadPc = latest?.load_1m_per_core ?? sys?.load_1m_per_core;
    const quota = latest?.cpu_limit_cores ?? sys?.cpu_limit_cores;
    const parts = [];
    if (quota != null) parts.push(`${Number(quota).toFixed(1)} cores allocated`);
    else if (cores != null) parts.push(`${cores} cores`);
    if (loadPc != null) parts.push(`load ${Number(loadPc).toFixed(2)}/core`);
    if (cpu != null && quota != null) parts.push(`${Math.round(cpu)}% of cgroup quota`);
    return parts.join(' · ') || '—';
  },

  liveRamCaption(latest, sys, env) {
    const used = latest?.mem_used_gb ?? sys?.mem_used_gb;
    const total = latest?.mem_total_gb ?? sys?.mem_total_gb;
    const trust = env?.metrics?.mem_used_gb?.status;
    if (trust === 'unavailable' || trust === 'misleading') {
      return env?.metrics?.mem_used_gb?.note || 'Container RAM unavailable — use Java heap';
    }
    if (used != null && total != null) {
      const src = latest?.ram_source || sys?.ram_source;
      return `${Number(used).toFixed(1)} / ${Number(total).toFixed(1)} GB used${src ? ` (${src})` : ''}`;
    }
    const avail = latest?.mem_available_gb ?? sys?.mem_available_gb;
    return avail != null ? `${Number(avail).toFixed(1)} GB MemAvailable` : '—';
  },

  liveRamAvailable(env) {
    return env?.metrics?.mem_used_gb?.status !== 'unavailable';
  },

  liveDiskCaption(latest, storage, pregen, metricStates) {
    const parts = [];
    const diskUse = latest?.disk_use_pct;
    if (diskUse != null) parts.push(`${Math.round(diskUse)}% used`);
    const freeGb = latest?.disk_free_gb ?? storage?.disk_free_gb;
    if (freeGb != null) parts.push(`${Number(freeGb).toFixed(1)} GB free`);
    const worldGb = latest?.world_gb ?? storage?.world_gb;
    if (worldGb != null) parts.push(`world ${worldGb} GB`);
    const jobs = [];
    if (pregen?.chunky_pregen?.pregen_active) jobs.push('Chunky pregen');
    if (pregen?.dh_pregen?.pregen_active) jobs.push('DH pregen');
    if (jobs.length) parts.push(jobs.join(' + '));
    const diskTrust = metricStates?.disk_use_pct || metricStates?.disk_free_gb;
    if (diskTrust?.status === 'misleading' || diskTrust?.status === 'approximate') {
      parts.push(diskTrust.display_label || 'Scoped');
    }
    return parts.join(' · ') || '—';
  },

  versionChipText(version, updateCheck) {
    const v = version || '—';
    if (updateCheck?.update_available) {
      return `${v} · update`;
    }
    return v;
  },

  formatReportFreshness(meta) {
    if (!meta) return '';
    if (meta.stale) {
      const age = meta.age_hours != null ? `${meta.age_hours}h ago` : 'over 24h ago';
      return `Report stale — last run ${age}. Run a fresh report for current health.`;
    }
    if (meta.last_report_at) {
      const age = meta.age_hours != null ? `${meta.age_hours}h ago` : 'recently';
      return `Report fresh — last run ${age}`;
    }
    return 'No report on disk yet';
  },

  heapHeadroomLabel(heap, sys) {
    const used = Number(heap?.used ?? 0);
    const max = Number(heap?.max ?? (sys?.java_xmx_gb ?? 0) * 1024);
    if (!max) return { value: '—', subtitle: 'Heap unknown' };
    const freeGb = Math.max(0, (max - used) / 1024);
    return {
      value: `${freeGb.toFixed(1)}`,
      subtitle: `Java heap · ${Math.round(used)} / ${Math.round(max)} MB used`,
    };
  },

  liveHeapCaption(heap) {
    const used = Number(heap?.used ?? 0);
    const max = Number(heap?.max ?? 0);
    if (!max) return 'Max — MB';
    const free = Math.max(0, max - used);
    return `${Math.round(free)} MB free of ${Math.round(max)} max`;
  },

  thermalZoneLabel(zone) {
    return zone.label || zone.id || 'Sensor';
  },

  dimensionLabel(dim) {
    if (!dim) return '—';
    const map = {
      'minecraft:overworld': 'Overworld',
      'minecraft:the_nether': 'Nether',
      'minecraft:the_end': 'The End',
    };
    return map[dim] || dim.replace(/^minecraft:/, '').replace(/_/g, ' ');
  },

  formatPlaytimeHours(hours) {
    if (hours == null || Number.isNaN(Number(hours))) return '—';
    const h = Number(hours);
    if (h <= 0) return '0m';
    if (h < 1) return `${Math.round(h * 60)}m`;
    if (h < 48) return `${h.toFixed(1)}h`;
    const days = Math.floor(h / 24);
    const rem = h % 24;
    return rem >= 0.5 ? `${days}d ${Math.round(rem)}h` : `${days}d`;
  },

  formatPlaytimeMinutes(minutes) {
    if (minutes == null || Number.isNaN(Number(minutes))) return '—';
    const m = Number(minutes);
    if (m <= 0) return '—';
    if (m < 60) return `${Math.round(m)}m`;
    return Labels.formatPlaytimeHours(m / 60);
  },

  backupSummary(backup) {
    if (!backup) return 'Backup status unknown.';
    const st = backup.status;
    if (st === 'success') return `Latest backup: ${backup.path || backup.dir || 'OK'}`;
    if (st === 'unconfigured') return 'No backup folder configured — use Choose backup folder or edit watchtower/watchtower.conf.';
    if (st === 'stale' || backup.stale) return `Newest backup is ${backup.age_days ?? '?'} days old — schedule more frequent backups.`;
    if (st === 'not_found') {
      if (backup.reason === 'empty') {
        return 'Backup folders found but no .zip or .tar.gz archives visible to the server process.';
      }
      if (backup.reason === 'no_server_match') {
        return 'Backup files found but none matched this server — pick the folder with Choose backup folder, or use crafty-4/backups/<server-uuid>/ (Crafty may nest each backup in a subfolder).';
      }
      if (backup.reason === 'no_suffix_match') {
        return 'Files in backup folder but none use a recognized archive extension (.zip, .tar.gz, …).';
      }
      const reason = backup.reason || 'no archive in lookback window';
      return `No backup archive found (${reason}). Run a panel backup or check BACKUP_DIRS.`;
    }
    return 'Check backup configuration on the host.';
  },

  backupPillLabel(backup) {
    if (!backup) return 'Backup: Unknown';
    if (backup.status === 'success') return 'Backup: OK';
    if (backup.status === 'not_found') return 'Backup: Not Found';
    if (backup.status === 'unconfigured') return 'Backup: Unconfigured';
    if (backup.stale || backup.status === 'stale') return 'Backup: Stale';
    return 'Backup: Check';
  },

  backupReasonHint(backup) {
    if (!backup || backup.status === 'success') return '';
    if (backup.reason === 'empty') {
      const searched = backup.searched_dirs > 0 || (backup.search_dirs?.length > 0);
      if (searched) {
        return 'Paths were checked but no archives are visible to this server process — backups may live on the host without a container mount. Use Choose backup folder if the path is mounted here.';
      }
      return 'No backup folders found — use Choose backup folder to point Watchtower at your panel backup directory.';
    }
    if (backup.reason === 'no_server_match') {
      return 'Crafty may store each backup under backups/<server-uuid>/<backup-job-uuid>/ — open that folder in Choose backup folder and save.';
    }
    return '';
  },

  backupConfigHint(backup, panel) {
    if (!backup || backup.status === 'success') return '';
    const searched = (backup.search_dirs?.length ?? backup.searched_dirs ?? 0) > 0;
    if (backup.status === 'unconfigured') {
      return 'Choose a backup folder to start tracking archives. Watchtower will not search until you pick a folder or set BACKUP_DIR / BACKUP_DIRS in watchtower/watchtower.conf.';
    }
    if (backup.status === 'not_found' && searched) {
      return 'Watchtower searched the paths below but found no matching archives. If backups exist on the host, mount that folder into this server or pick a visible path.';
    }
    if (panel === 'crafty' && backup.status === 'not_found') {
      return 'Expected layout: crafty-4/backups/<server-uuid>/YYYY-MM-DD_HH-MM-SS.zip';
    }
    return '';
  },

  fsPickerBanner() {
    return 'This browser shows paths visible to the Minecraft server process. If backups are on the host but not mounted here, mount the folder in your panel first.';
  },

  fsPickerSelectPreview(count) {
    if (count === 0) return 'No backup archives in this folder.';
    if (count === 1) return '1 backup archive found in this folder.';
    return `${count} backup archives found in this folder.`;
  },

  backupPanelHint(panel, backup) {
    const p = (panel || '').toLowerCase();
    if (!backup || backup.status === 'success') return '';
    if (p === 'discopanel' && backup.reason === 'empty') {
      return 'DiscoPanel stores scheduled backups on the panel backup volume (often /app/backups on the host). '
        + 'If this server runs in Docker, set BACKUP_DIRS in watchtower/watchtower.conf to that host path.';
    }
    if ((p === 'discopanel' || p === 'docker') && backup.status === 'not_found') {
      return 'Panel backups may live outside the Minecraft container — configure BACKUP_DIRS to the mounted backup folder.';
    }
    if (p === 'pterodactyl' || p === 'pelican') {
      return 'Wings stores local backups as {backup-uuid}.tar.gz in the node backups folder '
        + '(e.g. /var/lib/pterodactyl/backups). On multi-server nodes, the newest archive may belong to another server.';
    }
    if (p === 'crafty') {
      if (backup.reason === 'empty') {
        return 'Crafty stores backups under crafty-4/backups/<server-uuid>/ on the host. If that folder is empty here, bind-mount it into the server container or use Choose backup folder when mounted.';
      }
      return 'Crafty stores backups as timestamp files (e.g. 2026-06-17_01-06-30.zip) under crafty-4/backups/<server-uuid>/.';
    }
    if (p === 'amp') {
      return 'AMP stores backups in Instances/<name>/Backups/ by default, or a custom path from LocalFileBackupPlugin.kvp.';
    }
    if (p === 'pufferpanel') {
      return 'PufferPanel uses daemon.data.backups.folder (default /var/lib/pufferpanel/backups). Set BACKUP_DIRS if yours differs.';
    }
    return '';
  },

  overviewHostingPill(f, env) {
    const panelId = String(f?.meta?.panel || env?.hosting || '').toLowerCase();
    const deployment = env?.deployment;

    if (panelId && panelId !== 'none' && panelId !== 'unknown') {
      return {
        label: 'Hosting',
        value: Labels.panelDisplayName(panelId),
        icon: 'cloud',
        tone: 'neutral',
      };
    }

    const deploymentValue = {
      bare_metal: 'Bare metal',
      vps: 'VPS',
      container: 'Container',
    };
    if (deployment && deploymentValue[deployment]) {
      return {
        label: 'Environment',
        value: deploymentValue[deployment],
        icon: deployment === 'bare_metal' ? 'server' : 'cloud',
        tone: 'neutral',
      };
    }

    const display = f?.meta?.panel_display_name;
    if (display && !/^(none|unknown|native)$/i.test(display)) {
      return { label: 'Hosting', value: display, icon: 'server', tone: 'neutral' };
    }

    return { label: 'Environment', value: 'Dedicated host', icon: 'server', tone: 'neutral' };
  },

  formatJavaVersion(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return '—';
    const legacy = s.match(/^1\.(\d+)/);
    if (legacy) return legacy[1];
    const mod = s.match(/^(\d+)(?:\.(\d+)(?:\.(\d+))?)?/);
    if (!mod) return s;
    const major = mod[1];
    const minor = mod[2];
    if (minor && minor !== '0') return `${major}.${minor}`;
    return major;
  },

  overviewJavaPill(f, live) {
    const h = f?.health || {};
    const raw = live?.java_version ?? f?.system?.java_version;
    if (raw) {
      return {
        label: 'Java',
        value: Labels.formatJavaVersion(raw),
        icon: 'coffee',
        tone: 'neutral',
      };
    }
    return {
      label: 'Java',
      value: h.java_running ? '—' : 'Offline',
      icon: 'coffee',
      tone: h.java_running ? 'neutral' : 'warn',
    };
  },

  overviewModsPill(f) {
    const opt = f?.optional || {};
    const liveCount = typeof state !== 'undefined' ? state.overviewMeta?.running_mod_count : null;
    const runningBlock = typeof state !== 'undefined' ? state.opsCache?.running_mods : null;
    const count = liveCount ?? runningBlock?.count ?? opt.mods?.length ?? state.snapshot?.mod_count ?? null;
    const modErrs = typeof mergedModLogErrors === 'function'
      ? mergedModLogErrors(f, state?.opsCache)
      : (opt.mod_log_errors ?? []).filter((e) => e.mod_id !== 'client_noise');
    const errCount = modErrs.length;

    let value;
    if (count != null) {
      value = String(count);
      if (errCount > 0) {
        value += ` (${errCount} with error${errCount === 1 ? '' : 's'})`;
      }
    } else if (errCount > 0) {
      value = `${errCount} with error${errCount === 1 ? '' : 's'}`;
    } else {
      value = '—';
    }

    return {
      label: 'Mods',
      value,
      icon: errCount > 0 ? 'triangle-alert' : 'package',
      tone: errCount > 0 ? 'warn' : 'ok',
    };
  },

  panelDisplayName(panel) {
    const m = {
      crafty: 'Crafty',
      pterodactyl: 'Pterodactyl',
      pelican: 'Pelican',
      pufferpanel: 'PufferPanel',
      mcsmanager: 'MCSManager',
      amp: 'CubeCoders AMP',
      multicraft: 'Multicraft',
      mineos: 'MineOS',
      discopanel: 'DiscoPanel',
      docker: 'Docker',
      none: 'Native',
      unknown: 'Unknown',
      tcadmin: 'TCAdmin',
      wisp: 'WISP',
      pebblehost: 'PebbleHost',
    };
    return m[(panel || '').toLowerCase()] || panel || 'Unknown';
  },

  resolutionLabel(resolvedBy) {
    const m = {
      ack: 'Acknowledge after review',
      fix: 'Fix on server',
      config: 'Configure host',
    };
    return m[resolvedBy] || 'Resolve';
  },

  blocksLabel(item) {
    if (item.blocksOverall && item.blocksCurrent) return 'Blocks overall & session health';
    if (item.blocksOverall) return 'Blocks overall health';
    if (item.blocksCurrent) return 'Blocks session health';
    return 'Informational';
  },

  clientModIntro(summary, warningCount) {
    const n = summary?.likely_removable_count ?? 0;
    const w = warningCount ?? summary?.client_warning_count ?? 0;
    return `${w} client-class log warnings detected. ${n} mod${n === 1 ? '' : 's'} are likely safe to remove from the server pack (verify dependencies first). Usually harmless when TPS is healthy.`;
  },

  fixHints(id) {
    const m = {
      CRASH_REPORT: ['Open crash reports under crash-reports/ and fix the cited mod or config.', 'Acknowledge each report on the Crashes tab after review so health reflects current risk.'],
      MOD_LOAD_FAILED: [
        'Remove the suspect mod jar from mods/, then start the server.',
        'If the server reaches "Done!", re-download the mod from the official source and try again.',
        'If it crashes the same way after reinstall, keep the mod removed or try another version.',
      ],
      MOD_UPDATE_CONFLICT: ['Open Mods → Update conflicts for the recommended action per mod pair.', 'Update or remove conflicting mods one at a time, then restart.'],
      BACKUP_NOT_CONFIGURED: ['Set BACKUP_DIR in watchtower/watchtower.conf to your panel backup folder.', 'Enable scheduled backups in Crafty or your panel.'],
      BACKUP_NOT_FOUND: ['Configure automated world backups in your control panel.', 'Verify BACKUP_DIR points to where archives are stored.'],
      BACKUP_STALE: ['Run a manual backup now and verify the cron job.', 'Check disk space on the backup volume.'],
      CLIENT_NOISE: ['Usually safe if TPS is healthy — remove client-only mods to reduce log noise.', 'See Mods tab for the removable list.'],
      MANUAL_REBOOT: ['Check host journal or panel logs around the boot time for cause (watchdog, OOM, power).', 'If uptime-only detection, cause may be unknown — verify backups before the next session.'],
    };
    return m[id] || [];
  },

  /** Step-by-step DR workflow for broken / failed-to-load mods */
  modDrFixSteps(modId, category) {
    const name = this.modFriendlyName(modId);
    const jar = `${modId}.jar`;
    if (category === 'mod_corrupt' || category === 'mod_load_failed') {
      return [
        `Remove ${name} (${jar}) from your server mods/ folder.`,
        'Start the server and wait for "Done!" — if it boots, that mod was blocking startup.',
        `Re-download ${name} from the official source (Modrinth/CurseForge) and put the jar back in mods/.`,
        'Start again — if it fails the same way, leave the mod out or try a different version; you have confirmed the culprit.',
      ];
    }
    return [];
  },
};

function detailsBlock(summary, innerHtml) {
  return `<details class="tech-details"><summary>${summary}</summary><div class="tech-details-body">${innerHtml}</div></details>`;
}
