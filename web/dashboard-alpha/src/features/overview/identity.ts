import { asArray, asRecord, get, str } from '@/lib/utils';

const PANEL_DISPLAY: Record<string, string> = {
  crafty: 'Crafty',
  pterodactyl: 'Pterodactyl',
  pelican: 'Pelican',
  bloom: 'bloom.host',
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

function sparkPlatform(facts: Record<string, unknown>): Record<string, unknown> {
  const optional = asRecord(facts.optional);
  return asRecord(
    get(optional, 'startup_profile', 'platform') ??
      get(optional, 'spark_profile', 'platform') ??
      get(optional, 'spark', 'platform'),
  );
}

function modList(facts: Record<string, unknown>): Record<string, unknown>[] {
  return asArray<Record<string, unknown>>(get(facts, 'optional', 'mods'));
}

/** True for real modern MC versions (1.16–1.21.x). Rejects mod versions like 1.1.4. */
export function isPlausibleMcVersion(raw: string): boolean {
  const m = String(raw || '').trim().match(/^1\.(\d+)(?:\.(\d+))?$/);
  if (!m) return false;
  const minor = Number(m[1]);
  return minor >= 16 && minor <= 21;
}

/**
 * NeoForge loader versions are `20.x.y` / `21.x.y` → MC `1.20.x` / `1.21.x`.
 * Do not use FML `engine_version` (4.x) here — that produced fake `1.4.0`.
 */
export function neoforgeLoaderToMc(loaderVer: string): string {
  const nf = String(loaderVer || '').trim().match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!nf) return '';
  const major = Number(nf[1]);
  if (major < 20 || major > 30) return '';
  const out = `1.${nf[1]}.${nf[2]}`;
  return isPlausibleMcVersion(out) ? out : '';
}

/** Pull `+mc1.21.1` / `-mc1.21.1` / `+1.21.1` from a jar version — not bare `-1.1.4`. */
function mcFromModVersionSuffix(version: string): string {
  const v = String(version || '');
  const mc = v.match(/[+-]mc(1\.\d+(?:\.\d+)?)/i);
  if (mc && isPlausibleMcVersion(mc[1]!)) return mc[1]!;
  // Modrinth-style `1.1.4+1.21.1-neoforge` — only the `+1.xx` form (never `-1.1.4`).
  const plus = v.match(/\+(1\.\d+(?:\.\d+)?)/);
  if (plus && isPlausibleMcVersion(plus[1]!)) return plus[1]!;
  return '';
}

/** Server hostname from live envelope, facts, or settings. */
export function resolveServerName(
  live: Record<string, unknown>,
  facts: Record<string, unknown>,
  settings: Record<string, unknown>,
): string {
  return (
    str(live.hostname) ||
    str(get(facts, 'meta', 'hostname')) ||
    str(settings.hostname) ||
    'Server'
  );
}

/**
 * Minecraft version — prefer authoritative sources over scanning arbitrary mod versions.
 * Order: Spark platform → meta.minecraft_version → minecraft mod → NeoForge mapping → +mc suffixes.
 */
export function deriveMcVersion(facts: Record<string, unknown>): string {
  const platform = sparkPlatform(facts);
  if (isPlausibleMcVersion(str(platform.minecraft))) return str(platform.minecraft);

  const meta = asRecord(facts.meta);
  if (isPlausibleMcVersion(str(meta.minecraft_version))) return str(meta.minecraft_version);

  const native = asRecord(get(facts, 'optional', 'watchtower_native'));
  if (isPlausibleMcVersion(str(native.minecraft_version))) return str(native.minecraft_version);

  const mcEntry = modList(facts).find(
    (m) => str(m.id, str(m.mod_id)).toLowerCase() === 'minecraft',
  );
  if (mcEntry && isPlausibleMcVersion(str(mcEntry.version))) return str(mcEntry.version);

  const fromLoader =
    neoforgeLoaderToMc(str(platform.loader_version)) ||
    neoforgeLoaderToMc(
      (() => {
        const raw = str(meta.loader).toLowerCase();
        if (raw !== 'neoforge' && raw !== 'forge') return '';
        const entry = modList(facts).find((m) => str(m.id, str(m.mod_id)).toLowerCase() === raw);
        return str(entry?.version);
      })(),
    );
  if (fromLoader) return fromLoader;

  for (const m of modList(facts)) {
    const hit = mcFromModVersionSuffix(str(m.version));
    if (hit) return hit;
  }

  return '';
}

export function formatJavaVersion(
  live: Record<string, unknown>,
  facts: Record<string, unknown>,
  jvm: Record<string, unknown>,
): string {
  const major = str(jvm.java_major);
  if (major) return `Java ${major}`;

  const raw =
    str(live.java_version) ||
    str(get(live, 'latest', 'java_version')) ||
    str(get(facts, 'system', 'java_version')) ||
    str(jvm.java_version);
  if (!raw) return '';
  const m = raw.match(/(?:version\s+)?(\d+(?:\.\d+)*)/i);
  return m ? `Java ${m[1]}` : raw.slice(0, 24);
}

/** Detected panel / host platform label. */
export function resolveHostPlatform(
  facts: Record<string, unknown>,
  settings: Record<string, unknown>,
): { label: string; value: string } {
  const meta = asRecord(facts.meta);
  const env = asRecord(get(facts, 'optional', 'host_environment'));
  const panelId = str(settings.panel, str(meta.panel, str(env.hosting))).toLowerCase();
  const display =
    str(settings.panel_display_name) ||
    str(meta.panel_display_name) ||
    PANEL_DISPLAY[panelId] ||
    (panelId ? panelId.charAt(0).toUpperCase() + panelId.slice(1) : '');

  if (panelId && panelId !== 'none' && panelId !== 'unknown') {
    return { label: 'Hosting', value: display || panelId };
  }

  const deployment = str(env.deployment);
  if (deployment === 'bare_metal') return { label: 'Environment', value: 'Bare metal' };
  if (deployment === 'vps') return { label: 'Environment', value: 'VPS' };
  if (deployment === 'container') return { label: 'Environment', value: 'Container' };
  if (display && display.toLowerCase() !== 'none') return { label: 'Hosting', value: display };
  return { label: 'Hosting', value: 'Native' };
}

export type IdentityChip = { key: string; label: string; value: string };

/** Overview identity chips: server name, MC, Java, panel/host. */
export function buildIdentityChips(opts: {
  live: Record<string, unknown>;
  facts: Record<string, unknown>;
  settings: Record<string, unknown>;
  jvm?: Record<string, unknown>;
}): IdentityChip[] {
  const { live, facts, settings, jvm = {} } = opts;
  const chips: IdentityChip[] = [];

  chips.push({ key: 'server', label: 'Server', value: resolveServerName(live, facts, settings) });

  const mc = deriveMcVersion(facts);
  if (mc) chips.push({ key: 'mc', label: 'Minecraft', value: mc });

  const java = formatJavaVersion(live, facts, jvm);
  if (java) chips.push({ key: 'java', label: 'Java', value: java.replace(/^Java\s+/i, '') });

  const host = resolveHostPlatform(facts, settings);
  chips.push({ key: 'host', label: host.label, value: host.value });

  return chips;
}
