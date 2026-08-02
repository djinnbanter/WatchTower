/**
 * Overview welcome copy — pure helpers (no store access).
 */

/**
 * @param {object} opts
 * @param {string|null|undefined} opts.username
 * @param {string|null|undefined} opts.hostname
 * @param {boolean} [opts.firstRun]
 * @returns {{ lead: string, hostLine: string|null }}
 */
export function buildWelcomeLead({ username, hostname, firstRun = false }) {
  const name = username && String(username).trim() ? String(username).trim() : null;
  const host = hostname && String(hostname).trim() ? String(hostname).trim() : null;

  if (firstRun) {
    return {
      lead: name ? `Welcome to WatchTower, ${name}` : 'Welcome to WatchTower',
      hostLine: host ? `Getting ${host} ready` : 'Your server control center',
    };
  }

  return {
    lead: name ? `Welcome back, ${name}` : 'Welcome back',
    hostLine: host || null,
  };
}

/**
 * Short status summary (1–2 sentences) for the Overview welcome band.
 */
export function buildStatusSummary({
  javaRunning,
  isDown,
  players,
  tps,
  mspt,
  healthLabel = 'Unknown',
  healthEffective = 'ok',
  attentionCount = 0,
  crashHint = null,
  lagHint = null,
}) {
  const parts = [];

  if (isDown) {
    parts.push('Live connection is lost — metrics may be stale until WatchTower reconnects.');
  } else if (javaRunning === false) {
    parts.push('The Minecraft process is not running. Check your panel and recent logs.');
  } else {
    const p = players != null ? Number(players) : 0;
    const tpsStr = tps != null && Number.isFinite(Number(tps)) ? Number(tps).toFixed(1) : null;
    const msptStr = mspt != null && Number.isFinite(Number(mspt)) ? Number(mspt).toFixed(1) : null;
    let live = `The server is online with ${p} player${p === 1 ? '' : 's'}`;
    if (tpsStr != null && msptStr != null) {
      live += ` — ${tpsStr} TPS (${msptStr} ms/tick)`;
    } else if (tpsStr != null) {
      live += ` — ${tpsStr} TPS`;
    }
    parts.push(`${live}.`);
  }

  if (crashHint) {
    parts.push(`Latest crash: ${crashHint}.`);
  } else if (lagHint) {
    parts.push(lagHint.endsWith('.') ? lagHint : `${lagHint}.`);
  } else if (attentionCount > 0) {
    const verb = attentionCount === 1 ? 'needs' : 'need';
    parts.push(
      `Health is ${healthLabel.toLowerCase()} — ${attentionCount} item${attentionCount === 1 ? '' : 's'} ${verb} attention.`,
    );
  } else if (healthEffective === 'ok' && !isDown && javaRunning !== false) {
    parts.push('Overall health looks clear — no blockers in the latest report.');
  } else if (healthLabel && healthLabel !== 'Unknown') {
    parts.push(`Overall health is ${healthLabel.toLowerCase()}.`);
  }

  return parts.join(' ');
}
