/**
 * Watchtower UI v3 — live tab renderers
 */
const TowerRenderLive = (function () {
  const esc = TowerRenderShared.esc;
  const kpiSparkCard = TowerRenderShared.kpiSparkCard;
  const kpiDualSparkCard = TowerRenderShared.kpiDualSparkCard;
  const kpiDeltaFromTps = TowerRenderShared.kpiDeltaFromTps;
  const thermalDialHotMod = TowerRenderShared.thermalDialHotMod;

  function isCoreZone(zone) {
    const id = (zone?.id || '').toLowerCase();
    const label = (zone?.label || '').toLowerCase();
    const text = `${label} ${id}`.trim();

    if (/^core\d+$/.test(id)) return true;
    if (/^tccd\d+$|^ccd\d+$/.test(id)) return true;
    if (/_core_\d+|core-\d+|core_\d+/.test(id)) return true;
    if (/^core\s*\d+\b/i.test(label)) return true;
    if (/\btccd\s*\d+|\bccd\s*\d+/i.test(text)) return true;
    if (/cpu\s*core\s*\d+|core\s*#?\s*\d+/i.test(text)) return true;

    if (/package|pack(?!et)|ambient|nvme|wifi|soc(?!ket)|gpu|disk|composite|motherboard|acp|tctl|tdie|pch|chipset/i.test(text)) {
      return false;
    }
    return /core\s*\d+|core\d+/i.test(text);
  }

  function formatCoreLabel(zone) {
    const label = zone?.label || '';
    const id = zone?.id || '';
    const text = `${label} ${id}`;
    const coreNum = text.match(/core\s*#?\s*(\d+)/i);
    if (coreNum) return `Core ${coreNum[1]}`;
    const ccdNum = text.match(/tccd\s*(\d+)|ccd\s*(\d+)/i);
    if (ccdNum) return `CCD ${ccdNum[1] || ccdNum[2]}`;
    if (/^core(\d+)$/i.test(id)) return `Core ${id.replace(/\D/g, '')}`;
    if (/^tccd(\d+)$/i.test(id)) return `CCD ${id.replace(/\D/g, '')}`;
    const m = text.match(/(\d+)/);
    if (m) return `Core ${m[1]}`;
    return Labels.thermalZoneLabel(zone);
  }

  function extractCoreZones(zones) {
    return (zones || [])
      .filter(isCoreZone)
      .sort((a, b) => coreZoneSortKey(a) - coreZoneSortKey(b));
  }

  function coreZoneSortKey(zone) {
    const text = `${zone?.label || ''} ${zone?.id || ''}`;
    const m = text.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 999;
  }

  function coreBarPct(c, maxC = 100) {
    const n = Number(c);
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, (n / maxC) * 100));
  }

  function renderCoreTempPanel(zones) {
    const cores = extractCoreZones(zones);
    if (!cores.length) {
      return `
        <div class="wt-live-thermal__cores wt-live-thermal__cores--empty" id="live-thermal-cores">
          <h4 class="wt-live-thermal__cores-title">Per-core</h4>
          <p class="wt-empty">No per-core sensors on this host</p>
        </div>`;
    }
    const rows = cores.map((z, i) => {
      const c = Math.round(z.c ?? 0);
      const band = thermalTempBand(c);
      const pct = coreBarPct(c);
      return `
        <div class="wt-core-temp" data-core-idx="${i}" data-core-band="${band}">
          <div class="wt-core-temp__head">
            <span class="wt-core-temp__label">${esc(formatCoreLabel(z))}</span>
            <span class="wt-core-temp__val">${c}°C</span>
          </div>
          <div class="wt-progress-bar" style="--progress: ${pct}" role="presentation">
            <div class="wt-progress-bar__fill wt-progress-bar__fill--${band} wt-pattern-hatch"></div>
          </div>
        </div>`;
    }).join('');
    return `
      <div class="wt-live-thermal__cores" id="live-thermal-cores">
        <h4 class="wt-live-thermal__cores-title">Per-core</h4>
        <div class="wt-core-temp-list">${rows}</div>
      </div>`;
  }

  function updateCoreTempPanel(zones) {
    const root = document.getElementById('live-thermal-cores');
    if (!root) return;
    const cores = extractCoreZones(zones);
    if (!cores.length) return;
    const list = root.querySelector('.wt-core-temp-list');
    const existing = list ? list.querySelectorAll('.wt-core-temp').length : 0;
    if (!list || existing !== cores.length) {
      root.outerHTML = renderCoreTempPanel(zones);
      return;
    }
    cores.forEach((z, i) => {
      const row = list.querySelector(`[data-core-idx="${i}"]`);
      if (!row) {
        root.outerHTML = renderCoreTempPanel(zones);
        return;
      }
      const label = row.querySelector('.wt-core-temp__label');
      if (label) label.textContent = formatCoreLabel(z);
      const c = Math.round(z.c ?? 0);
      const band = thermalTempBand(c);
      const pct = coreBarPct(c);
      row.dataset.coreBand = band;
      const bar = row.querySelector('.wt-progress-bar');
      if (bar) bar.style.setProperty('--progress', String(pct));
      const fill = row.querySelector('.wt-progress-bar__fill');
      if (fill) {
        fill.className = `wt-progress-bar__fill wt-progress-bar__fill--${band} wt-pattern-hatch`;
      }
      const val = row.querySelector('.wt-core-temp__val');
      if (val) val.textContent = `${c}°C`;
    });
  }

  function groupThermalZones(zones) {
    const map = new Map();
    (zones || []).forEach((z) => {
      const label = Labels.thermalZoneLabel(z);
      const key = label.toLowerCase().replace(/\s+/g, ' ').trim();
      const existing = map.get(key);
      if (!existing || (z.c ?? 0) > (existing.c ?? 0)) {
        map.set(key, { ...z, label });
      }
    });
    return [...map.values()].sort((a, b) => (b.c ?? 0) - (a.c ?? 0));
  }

  function thermalTempBand(c) {
    if (c >= 85) return 'hot';
    if (c >= 70) return 'warm';
    return 'cool';
  }

  function ambientTempBand(c) {
    if (c >= 40) return 'hot';
    if (c >= 32) return 'warm';
    return 'cool';
  }

  function thermalBandLabel(band) {
    if (band === 'hot') return 'HOT';
    if (band === 'warm') return 'WARM';
    return 'COOL';
  }

  function renderThermalZoneList(zones, limit, listId) {
    const grouped = groupThermalZones(zones);
    const top = grouped.slice(0, limit);
    const rest = grouped.slice(limit);
    const topHtml = top.map((z) =>
      `<li><span>${esc(z.label)}</span><span class="zone-temp">${Math.round(z.c)}°C</span></li>`
    ).join('');
    const restHtml = rest.length
      ? `<details class="thermal-zones-more"><summary>${rest.length} more sensor${rest.length === 1 ? '' : 's'}</summary><ul class="thermal-zones">${rest.map((z) =>
        `<li><span>${esc(z.label)}</span><span class="zone-temp">${Math.round(z.c)}°C</span></li>`
      ).join('')}</ul></details>`
      : '';
    return `<ul class="thermal-zones" ${listId ? `id="${listId}"` : ''}>${topHtml}</ul>${restHtml}`;
  }

  function findAmbientC(thermal) {
    if (thermal?.ambient_c != null) return thermal.ambient_c;
    const zones = thermal?.zones || [];
    const ambient = zones.find((z) => /ambient|composite|motherboard|sys|acp/i.test(`${z.label || ''} ${z.id || ''}`));
    if (ambient?.c != null) return ambient.c;
    const nonCpu = zones.filter((z) => !/package|tctl|tdie|core|ccd|cpu/i.test(`${z.label || ''} ${z.id || ''}`));
    if (nonCpu.length) return Math.min(...nonCpu.map((z) => z.c ?? 999));
    return null;
  }

  function thermalBandElClass(band) {
    return `wt-live-thermal__band wt-live-thermal__band--${band}`;
  }

  function setThermalReadout(el, c) {
    if (!el || c == null) return;
    el.innerHTML = `${Math.round(c)}<span class="wt-live-thermal__tile-unit">°C</span>`;
  }

  function renderThermalTile(kind, temp, label, readoutId, bandId, band) {
    if (temp == null) {
      return `
        <div class="wt-live-thermal__tile wt-live-thermal__tile--na" id="thermal-${kind}-tile" data-thermal-kind="${kind}">
          <div class="wt-live-thermal__tile-head">
            <span class="wt-live-thermal__tile-label">${esc(label)}</span>
          </div>
          <div class="wt-live-thermal__tile-na">
            <i data-lucide="wind" width="28" height="28"></i>
            <span>No sensor</span>
          </div>
        </div>`;
    }
    const icon = kind === 'ambient' ? 'wind' : 'cpu';
    return `
      <div class="wt-live-thermal__tile wt-live-thermal__tile--${band}" id="thermal-${kind}-tile" data-thermal-kind="${kind}">
        <div class="wt-live-thermal__tile-body">
          <div class="wt-live-thermal__tile-dial">
            <div class="wt-thermal-dial${thermalDialHotMod(band)}" data-thermal-kind="${kind}">
              <canvas id="thermal-${kind}-dial" data-viz-temp-dial data-dial-readout="html" data-kind="${kind}" data-temp="${temp}"></canvas>
            </div>
          </div>
          <div class="wt-live-thermal__tile-info">
            <div class="wt-live-thermal__tile-head">
              <span class="wt-live-thermal__tile-label">
                <i data-lucide="${icon}" width="14" height="14" aria-hidden="true"></i>
                ${esc(label)}
              </span>
              <span class="${thermalBandElClass(band)}" id="${bandId}">${thermalBandLabel(band)}</span>
            </div>
            <div class="wt-live-thermal__tile-kpi" id="${readoutId}">${Math.round(temp)}<span class="wt-live-thermal__tile-unit">°C</span></div>
          </div>
        </div>
      </div>`;
  }

  function renderLiveThermalCard(thermal) {
    const panel = state.activeFacts?.meta?.panel;
    const env = getHostEnvironment(state.activeFacts);
    const trustBadge = Labels.metricTrustBadge(env?.metrics?.thermal);
    if (!thermal?.available) {
      const msg = Labels.thermalUnavailableMessage(thermal?.reason, panel);
      return `
        <div class="wt-card wt-card--surface wt-bento__span-12 wt-live-thermal wt-live-thermal--panel" id="live-thermal-panel">
          <div class="wt-card__head">
            <h3 class="wt-card__title"><i data-lucide="thermometer" width="16" height="16"></i> Temperature ${trustBadge}</h3>
          </div>
          <p class="wt-empty thermal-unavail-msg">${esc(msg)}</p>
        </div>`;
    }
    const pkg = thermal.package_c ?? 0;
    const ambient = findAmbientC(thermal);
    const band = thermalTempBand(pkg);
    const ambBand = ambient != null ? ambientTempBand(ambient) : 'cool';
    const zones = thermal.zones || [];
    return `
      <div class="wt-card wt-card--surface wt-bento__span-12 wt-live-thermal wt-live-thermal--panel" id="live-thermal-panel">
        <div class="wt-card__head">
          <h3 class="wt-card__title"><i data-lucide="thermometer" width="16" height="16"></i> Temperature ${trustBadge}</h3>
        </div>
        <div class="wt-live-thermal__grid wt-live-thermal__grid--summary-only">
          <div class="wt-live-thermal__summary">
            ${renderThermalTile('cpu', pkg, 'CPU package', 'thermal-package-readout', 'thermal-package-band', band)}
            ${renderThermalTile('ambient', ambient, 'Ambient', 'thermal-ambient-readout', 'thermal-ambient-band', ambBand)}
          </div>
        </div>
      </div>`;
  }

  function formatNetworkRate(mbps) {
    if (mbps == null || !Number.isFinite(mbps)) return '—';
    if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
    if (mbps >= 1) return `${mbps.toFixed(1)} Mbps`;
    return `${(mbps * 1000).toFixed(0)} Kbps`;
  }

  function formatDiskIoRate(mbPerSec) {
    if (mbPerSec == null || !Number.isFinite(mbPerSec)) return '—';
    if (mbPerSec >= 1024) return `${(mbPerSec / 1024).toFixed(2)} GB/s`;
    if (mbPerSec >= 1) return `${mbPerSec.toFixed(1)} MB/s`;
    if (mbPerSec >= 0.01) return `${(mbPerSec * 1024).toFixed(0)} KB/s`;
    return `${(mbPerSec * 1024 * 1024).toFixed(0)} B/s`;
  }

  function renderPerCoreCpuPanel(cores, compact = false) {
    if (!cores?.length) return '';
    const maxDisplay = compact ? 16 : 32;
    const visible = cores.slice(0, maxDisplay);
    const extra = cores.length > maxDisplay ? cores.length - maxDisplay : 0;
    const rows = visible.map((c, i) => {
      const pct = Math.min(100, Math.max(0, Number(c.pct ?? 0)));
      const band = pct >= 85 ? 'hot' : pct >= 70 ? 'warm' : 'ok';
      return `
        <div class="wt-core-cpu" data-core-idx="${i}">
          <div class="wt-core-cpu__head">
            <span class="wt-core-cpu__label">${compact ? `C${c.id ?? i}` : `Core ${c.id ?? i}`}</span>
            <span class="wt-core-cpu__val">${Math.round(pct)}%</span>
          </div>
          <div class="wt-progress-bar wt-progress-bar--sm" style="--progress: ${pct}" role="presentation">
            <div class="wt-progress-bar__fill wt-progress-bar__fill--${band} wt-pattern-hatch"></div>
          </div>
        </div>`;
    }).join('');
    const moreHtml = extra ? `<p class="text-caption wt-live-cpu-cores__more">+${extra} more</p>` : '';
    const cls = compact
      ? 'wt-live-cpu-cores wt-live-cpu-cores--compact'
      : 'wt-live-cpu-cores wt-bento__span-12';
    return `
      <div class="${cls}" id="live-cpu-cores-panel">
        <h4 class="wt-live-cpu-cores__title">${compact ? 'Per-core' : 'Per-core CPU usage'}</h4>
        <div class="wt-core-cpu-list">${rows}</div>
        ${moreHtml}
      </div>`;
  }

  function renderCpuHostRow(hostCpu, cpuCores, env, latest, sys, metricSpan) {
    const coresPanel = cpuCores?.length ? renderPerCoreCpuPanel(cpuCores, true) : '';
    const cpuCard = kpiSparkCard(
      'live-cpu',
      'CPU',
      `${Math.round(hostCpu)}<span class="wt-kpi__unit">%</span>`,
      'lv-cpu',
      esc(Labels.liveCpuCaption(latest, sys, env)),
      liveCpuDelta(hostCpu),
      coresPanel ? 'wt-live-cpu-row__main' : metricSpan,
    );
    if (!coresPanel) return cpuCard;
    return `
      <div class="wt-live-cpu-row ${metricSpan}" id="live-cpu-row">
        ${cpuCard}
        ${coresPanel}
      </div>`;
  }

  function renderLiveDiskCard(disk) {
    if (!disk?.device) {
      return `
        <div class="wt-card wt-card--surface wt-live-metric-span wt-live-disk wt-live-metric" id="live-disk-panel">
          <div class="wt-live-metric__body">
            <div class="wt-card__head wt-live-disk__head">
              <h3 class="wt-card__title"><i data-lucide="hard-drive" width="16" height="16"></i> Disk I/O</h3>
            </div>
            <p class="wt-empty">No disk I/O stats on this host (/proc/diskstats unavailable).</p>
          </div>
          <div class="wt-live-metric__chart-slot" aria-hidden="true">
            <div class="wt-kpi-spark__chart wt-kpi-spark__chart--empty"></div>
            <div class="wt-signal__readout wt-signal__readout--empty">&nbsp;</div>
          </div>
        </div>`;
    }
    const readRate = formatDiskIoRate(disk.read_mb_s);
    const writeRate = formatDiskIoRate(disk.write_mb_s);
    const age = disk.sample_age_sec != null ? `${disk.sample_age_sec}s sample` : 'live';
    return `
      <div class="wt-card wt-card--surface wt-live-metric-span wt-live-disk wt-live-metric" id="live-disk-panel">
        <div class="wt-live-metric__body">
          <div class="wt-card__head wt-live-disk__head">
            <h3 class="wt-card__title"><i data-lucide="hard-drive" width="16" height="16"></i> Disk I/O</h3>
            <span class="wt-live-disk__device">${esc(disk.device)}</span>
          </div>
          <div class="wt-live-disk__rates">
            <div class="wt-live-disk__rate">
              <span class="wt-live-disk__rate-label">Read</span>
              <div class="wt-live-disk__rate-line">
                <span class="wt-live-disk__dir wt-live-disk__dir--read" aria-hidden="true">↓</span>
                <span class="wt-live-disk__rate-val" id="live-disk-read-rate">${readRate}</span>
              </div>
            </div>
            <div class="wt-live-disk__rate">
              <span class="wt-live-disk__rate-label">Write</span>
              <div class="wt-live-disk__rate-line">
                <span class="wt-live-disk__dir wt-live-disk__dir--write" aria-hidden="true">↑</span>
                <span class="wt-live-disk__rate-val" id="live-disk-write-rate">${writeRate}</span>
              </div>
            </div>
          </div>
          <p class="wt-live-disk__caption" id="live-disk-caption">${esc(age)}</p>
        </div>
        <div class="wt-live-metric__chart-slot">
          <div class="wt-kpi-spark__chart wt-live-disk__chart">
            <div class="wt-chart-wrap"><canvas id="lv-disk-io"></canvas></div>
          </div>
          <div class="wt-signal__readout" id="lv-disk-io-readout" aria-live="polite">Hover chart for history</div>
        </div>
      </div>`;
  }

  function renderLiveNetworkCard(bw) {
    if (!bw?.interface) {
      return `
        <div class="wt-card wt-card--surface wt-live-metric-span wt-live-network wt-live-metric" id="live-network-panel">
          <div class="wt-live-metric__body">
            <div class="wt-card__head wt-live-network__head">
              <h3 class="wt-card__title"><i data-lucide="wifi" width="16" height="16"></i> Network</h3>
            </div>
            <p class="wt-empty">No interface stats on this host (/proc/net/dev unavailable).</p>
          </div>
          <div class="wt-live-metric__chart-slot" aria-hidden="true">
            <div class="wt-kpi-spark__chart wt-kpi-spark__chart--empty"></div>
            <div class="wt-signal__readout wt-signal__readout--empty">&nbsp;</div>
          </div>
        </div>`;
    }
    const rxRate = formatNetworkRate(bw.rx_mbps);
    const txRate = formatNetworkRate(bw.tx_mbps);
    const age = bw.sample_age_sec != null ? `${bw.sample_age_sec}s sample` : 'live';
    return `
      <div class="wt-card wt-card--surface wt-live-metric-span wt-live-network wt-live-metric" id="live-network-panel">
        <div class="wt-live-metric__body">
          <div class="wt-card__head wt-live-network__head">
            <h3 class="wt-card__title"><i data-lucide="wifi" width="16" height="16"></i> Network</h3>
            <span class="wt-live-network__iface">${esc(bw.interface)}</span>
          </div>
          <div class="wt-live-network__rates">
            <div class="wt-live-network__rate">
              <span class="wt-live-network__rate-label">Download</span>
              <div class="wt-live-network__rate-line">
                <span class="wt-live-network__dir wt-live-network__dir--down" aria-hidden="true">↓</span>
                <span class="wt-live-network__rate-val" id="live-net-rx-rate">${rxRate}</span>
              </div>
            </div>
            <div class="wt-live-network__rate">
              <span class="wt-live-network__rate-label">Upload</span>
              <div class="wt-live-network__rate-line">
                <span class="wt-live-network__dir wt-live-network__dir--up" aria-hidden="true">↑</span>
                <span class="wt-live-network__rate-val" id="live-net-tx-rate">${txRate}</span>
              </div>
            </div>
          </div>
          <p class="wt-live-network__caption" id="live-net-caption">${esc(age)}</p>
        </div>
        <div class="wt-live-metric__chart-slot">
          <div class="wt-kpi-spark__chart wt-live-network__chart">
            <div class="wt-chart-wrap"><canvas id="lv-bandwidth"></canvas></div>
          </div>
          <div class="wt-signal__readout" id="lv-bandwidth-readout" aria-live="polite">Hover chart for history</div>
        </div>
      </div>`;
  }

  function renderThermalSection(thermal, detailed) {
    if (detailed) return renderLiveThermalCard(thermal);
    const panel = state.activeFacts?.meta?.panel;
    if (!thermal?.available) {
      const msg = Labels.thermalUnavailableMessage(thermal?.reason, panel);
      return `<div class="wt-panel"><h3 class="wt-panel__title"><i data-lucide="thermometer" width="14" height="14"></i> CPU temperature</h3><p class="wt-empty thermal-unavail-msg">${esc(msg)}</p></div>`;
    }
    const pkg = Math.round(thermal.package_c ?? 0);
    const ambient = findAmbientC(thermal);
    return `
      <div class="wt-panel">
        <h3 class="wt-panel__title"><i data-lucide="thermometer" width="14" height="14"></i> CPU temperature</h3>
        <p class="thermal-simple-inline"><strong>${pkg}°C</strong> CPU${ambient != null ? ` · <span id="thermal-ambient-readout">${Math.round(ambient)}°C</span> ambient` : ''}</p>
      </div>`;
  }

  const BANDWIDTH_HISTORY_MAX = 500;

  const DISK_IO_HISTORY_MAX = 500;

  function appendDiskIoSample(disk) {
    if (!disk?.device || disk.read_mb_s == null) return;
    const now = new Date().toISOString();
    state.diskIoHistory.push({ t: now, read: disk.read_mb_s, write: disk.write_mb_s ?? 0 });
    if (state.diskIoHistory.length > DISK_IO_HISTORY_MAX) {
      state.diskIoHistory = state.diskIoHistory.slice(-DISK_IO_HISTORY_MAX);
    }
  }

  function diskIoChartPoints() {
    const windowMinutes = ChartWindow.get(maxRetentionHours());
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    return state.diskIoHistory
      .filter((p) => new Date(p.t).getTime() >= cutoff)
      .map((p) => ({ t: p.t, rx: p.read, tx: p.write }));
  }

  function appendBandwidthSample(bw) {
    if (!bw?.interface || bw.rx_mbps == null) return;
    const now = new Date().toISOString();
    state.bandwidthHistory.push({ t: now, rx: bw.rx_mbps, tx: bw.tx_mbps ?? 0 });
    if (state.bandwidthHistory.length > BANDWIDTH_HISTORY_MAX) {
      state.bandwidthHistory = state.bandwidthHistory.slice(-BANDWIDTH_HISTORY_MAX);
    }
  }

  function bandwidthChartPoints() {
    const windowMinutes = ChartWindow.get(maxRetentionHours());
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    return state.bandwidthHistory.filter((p) => new Date(p.t).getTime() >= cutoff);
  }

  function liveCpuDelta(cpu) {
    const n = Math.round(cpu);
    if (n < 70) return '<span class="wt-kpi-delta wt-kpi-delta--up">OK</span>';
    if (n < 85) return '<span class="wt-kpi-delta wt-kpi-delta--down">High</span>';
    return '<span class="wt-kpi-delta wt-kpi-delta--down">Hot</span>';
  }

  function renderLive() {
    const f = state.activeFacts;
    const sys = f?.system || {};
    const opt = f?.optional || {};
    const mc = f?.minecraft || {};
    const latest = state.liveLatest;
    const jitter = state.liveJitter;
    const tps = latest?.tps ?? jitter.tps;
    const mspt = latest?.mspt ?? jitter.mspt;
    const players = latest?.players_online ?? jitter.players;
    const heap = latest?.heap_mb || opt.watchtower_native?.heap_mb || mc.heap_mb || {};
    const heapUsed = Math.round(heap.used ?? 0);
    const heapMax = Math.round(heap.max ?? (sys.java_xmx_gb ?? 0) * 1024);
    const heapFree = heapMax ? Math.max(0, heapMax - heapUsed) : null;
    const heapUsedHtml = `${heapUsed}<span class="wt-kpi__unit">MB</span>`;
    const heapFreeHtml = heapFree == null ? '—' : `${heapFree}<span class="wt-kpi__unit">MB</span>`;
    const heapFoot = heapMax ? `${heapMax.toLocaleString()} MB max` : esc(Labels.liveHeapCaption(heap));
    const bw = state.liveEnvelope?.bandwidth ?? opt.bandwidth ?? {};
    if (bw?.interface) appendBandwidthSample(bw);
    const diskIo = state.liveEnvelope?.disk_io ?? opt.disk_io ?? {};
    if (diskIo?.device) appendDiskIoSample(diskIo);
    const thermal = state.liveEnvelope?.thermal ?? opt.thermal;
    const env = getHostEnvironment(f);
    const memUsed = latest?.mem_used_gb ?? sys.mem_used_gb;
    const memTotal = latest?.mem_total_gb ?? sys.mem_total_gb;
    const memTrust = env?.metrics?.mem_used_gb;
    const memAvail = latest?.mem_available_gb ?? sys.mem_available_gb ?? 0;
    const memHeadline = (memUsed != null && memTotal != null && memTrust?.status !== 'unavailable')
      ? `${Number(memUsed).toFixed(1)} / ${Number(memTotal).toFixed(1)}`
      : `${Number(memAvail).toFixed(1)}`;
    const memUnit = (memUsed != null && memTotal != null && memTrust?.status !== 'unavailable') ? 'GB' : 'GB';
    const hostCpu = latest?.host_cpu_pct ?? sys.host_cpu_pct_now ?? 0;

    const showRam = Labels.liveRamAvailable(env);
    const ramLabel = (memUsed != null && memTotal != null) ? 'RAM used' : 'RAM used';
    const metricSpan = 'wt-live-metric-span';

    const statusLine = state.apiMode
      ? `<p class="wt-status-line${state.livePollError ? ' wt-status-line--error' : ''}" id="live-status-line">${state.livePollError ? esc(state.livePollError) : 'Connecting…'}</p>`
      : '<p class="wt-status-line wt-text-caption" id="live-status-line">Preview — simulated live metrics</p>';
    const toolbar = `
      <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="live-pin-lag-btn"${state.lagPinInFlight ? ' disabled' : ''} title="${state.apiMode ? 'Save current TPS/MSPT snapshot (same as /watchtower pin)' : 'Preview — available on server'}">
        <i data-lucide="pin" width="14" height="14"></i> Pin lag moment
      </button>
      <label class="wt-live-toolbar__refresh">Display refresh
        <select id="live-refresh-select" aria-label="Live display refresh"${state.apiMode ? '' : ' disabled'}>
          <option value="1000">1s</option><option value="5000">5s</option><option value="15000">15s</option>
          <option value="30000">30s</option><option value="60000">60s</option><option value="0">Paused</option>
        </select></label>
      ${ChartWindow.vitalsSelectHtml('Vitals range', maxRetentionHours(), { preset: 'full' })}`;

    const ramCard = showRam
      ? kpiSparkCard(
        'live-ram',
        ramLabel,
        `${memHeadline}<span class="wt-kpi__unit">${memUnit}</span>`,
        'lv-mem',
        esc(Labels.liveRamCaption(latest, sys, env)),
        '',
        metricSpan,
      )
      : '';

    return `
      <div class="wt-tab-live">
        <div class="wt-bento wt-stagger">
          ${typeof TowerTabChrome !== 'undefined' ? TowerTabChrome.tabHero('live') : ''}
          <div class="wt-bento__span-12 wt-live-toolbar">
            <div class="wt-live-toolbar__controls">${toolbar}</div>
          </div>
          ${statusLine ? `<div class="wt-bento__span-12">${statusLine}</div>` : ''}
          ${typeof TowerRenderLiveAlerts !== 'undefined' ? TowerRenderLiveAlerts.renderLiveAlertsSection() : ''}
          <p class="wt-bento__span-12 text-caption samples-freshness" id="samples-freshness-caption"></p>

          <header class="wt-tab-section wt-bento__span-12" id="live-game">
            <h2 class="wt-tab-section__title"><i data-lucide="gamepad-2" width="18" height="18"></i> Game server</h2>
          </header>
          ${kpiSparkCard('live-tps', 'TPS', `${Number(tps).toFixed(2)}<span class="wt-kpi__unit">TPS</span>`, 'lv-tps', '', kpiDeltaFromTps(tps), metricSpan)}
          ${kpiDualSparkCard('live-heap', 'Heap', 'Used', heapUsedHtml, 'Free', heapFreeHtml, 'lv-heap', heapFoot, metricSpan)}
          ${kpiSparkCard('live-mspt', 'MSPT', `${Number(mspt).toFixed(1)}<span class="wt-kpi__unit">ms</span>`, 'lv-mspt', '', '', metricSpan)}
          ${kpiSparkCard('live-players', 'Players', `${players}<span class="wt-kpi__unit">online</span>`, 'lv-players', '', '', metricSpan)}

          <header class="wt-tab-section wt-bento__span-12" id="live-host">
            <h2 class="wt-tab-section__title"><i data-lucide="cpu" width="18" height="18"></i> Host machine ${Labels.metricTrustBadge(env?.metrics?.host_cpu_pct)}</h2>
          </header>
          ${kpiSparkCard('live-cpu', 'CPU', `${Math.round(hostCpu)}<span class="wt-kpi__unit">%</span>`, 'lv-cpu', esc(Labels.liveCpuCaption(latest, sys, env)), liveCpuDelta(hostCpu), metricSpan)}
          ${ramCard}
          ${renderLiveDiskCard(diskIo)}
          ${renderLiveNetworkCard(bw)}
          ${renderLiveThermalCard(thermal)}
        </div>
      </div>`;
  }

  return { renderLive, renderLiveThermalCard, renderLiveNetworkCard, renderLiveDiskCard, renderPerCoreCpuPanel, renderCpuHostRow, renderThermalSection, renderThermalZoneList, renderCoreTempPanel, updateCoreTempPanel, extractCoreZones, isCoreZone, coreBarPct, groupThermalZones, thermalTempBand, ambientTempBand, thermalBandLabel, thermalBandElClass, setThermalReadout, findAmbientC, formatNetworkRate, formatDiskIoRate, appendBandwidthSample, bandwidthChartPoints, appendDiskIoSample, diskIoChartPoints, BANDWIDTH_HISTORY_MAX, DISK_IO_HISTORY_MAX };
})();
