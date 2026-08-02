/** Soft guidance for Spark-captured server.properties keys. */

import { array, record, text, type UnknownRecord } from './model';

export type SettingTone = 'ok' | 'warn' | 'neutral';

export type SettingAdvice = {
  key: string;
  title: string;
  current: string;
  recommended: string;
  band?: string;
  tone: SettingTone;
  hint: string;
  drivers?: string[];
};

type AdviceDef = {
  title: string;
  recommended: string;
  tone: (raw: string) => SettingTone;
  hint: (raw: string) => string;
};

function parseIntSafe(raw: string): number | null {
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function parseBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

function verdictTone(verdict: string): SettingTone {
  const v = verdict.toLowerCase();
  if (v.includes('fine') || v.includes('ok')) return 'ok';
  if (v.includes('consider') || v.includes('warn')) return 'warn';
  return 'neutral';
}

const ADVICE: Record<string, AdviceDef> = {
  'view-distance': {
    title: 'View distance',
    recommended: '6–10',
    tone: (raw) => {
      const n = parseIntSafe(raw);
      if (n == null) return 'neutral';
      if (n >= 6 && n <= 10) return 'ok';
      if (n > 10 || n <= 3) return 'warn';
      return 'ok';
    },
    hint: (raw) => {
      const n = parseIntSafe(raw);
      if (n != null && n > 10) return 'Above the usual modded band — loads more chunks per player.';
      if (n != null && n <= 3) return 'Very low — fine for performance, abrupt for players.';
      return 'Usual range for modded dedicated servers.';
    },
  },
  'simulation-distance': {
    title: 'Simulation distance',
    recommended: '4–8',
    tone: (raw) => {
      const n = parseIntSafe(raw);
      if (n == null) return 'neutral';
      if (n >= 4 && n <= 8) return 'ok';
      if (n > 8 || n <= 2) return 'warn';
      return 'ok';
    },
    hint: (raw) => {
      const n = parseIntSafe(raw);
      if (n != null && n > 8) return 'Keeps more chunks ticking — consider lowering on busy packs.';
      return 'Usual range for modded dedicated servers.';
    },
  },
  'sync-chunk-writes': {
    title: 'Sync chunk writes',
    recommended: 'false',
    tone: (raw) => {
      const b = parseBool(raw);
      if (b == null) return 'neutral';
      return b ? 'warn' : 'ok';
    },
    hint: (raw) => (parseBool(raw)
      ? 'True forces synchronous disk flushes — consider false on dedicated hosts.'
      : 'Async writes — fine for dedicated servers.'),
  },
  'entity-broadcast-range-percentage': {
    title: 'Entity broadcast range',
    recommended: '50–100',
    tone: (raw) => {
      const n = parseIntSafe(raw);
      if (n == null) return 'neutral';
      return n > 100 ? 'warn' : 'ok';
    },
    hint: (raw) => {
      const n = parseIntSafe(raw);
      if (n != null && n > 100) return 'Sends entity updates farther than default — costly in dense areas.';
      return 'Common tracking range for dedicated servers.';
    },
  },
  'player-idle-timeout': {
    title: 'Player idle timeout',
    recommended: '30–60',
    tone: (raw) => {
      const n = parseIntSafe(raw);
      if (n == null) return 'neutral';
      return n === 0 ? 'warn' : 'ok';
    },
    hint: (raw) => (parseIntSafe(raw) === 0
      ? '0 never kicks AFK players — they can keep areas loaded forever.'
      : 'Idle kick is enabled.'),
  },
  'max-chained-neighbor-updates': {
    title: 'Max chained neighbor updates',
    recommended: '100000',
    tone: (raw) => {
      const n = parseIntSafe(raw);
      if (n == null) return 'neutral';
      return n >= 500_000 ? 'warn' : 'ok';
    },
    hint: (raw) => {
      const n = parseIntSafe(raw);
      if (n != null && n >= 500_000) return 'Very high chain limit can amplify redstone/hopper storms.';
      return 'Neighbor-update chain limit looks reasonable.';
    },
  },
  'region-file-compression': {
    title: 'Region file compression',
    recommended: 'deflate',
    tone: (raw) => {
      const v = raw.trim().toLowerCase();
      if (!v) return 'neutral';
      return v === 'deflate' || v === 'lz4' ? 'ok' : 'neutral';
    },
    hint: () => 'deflate is the common default; lz4 is fine on newer JVMs.',
  },
  'network-compression-threshold': {
    title: 'Network compression',
    recommended: '256',
    tone: (raw) => {
      const n = parseIntSafe(raw);
      if (n == null) return 'neutral';
      if (n === 0 || n > 1024) return 'warn';
      return 'ok';
    },
    hint: (raw) => {
      const n = parseIntSafe(raw);
      if (n === 0) return 'Compression is off — consider 256 to save bandwidth.';
      if (n != null && n > 1024) return 'High threshold compresses less often.';
      return 'Common compression threshold.';
    },
  },
  'max-tick-time': {
    title: 'Max tick time',
    recommended: '60000 or -1',
    tone: (raw) => {
      const n = parseIntSafe(raw);
      if (n == null) return 'neutral';
      if (n === -1 || n >= 60000) return 'ok';
      if (n > 0) return 'warn';
      return 'neutral';
    },
    hint: (raw) => {
      const n = parseIntSafe(raw);
      if (n != null && n > 0 && n < 60000) return 'Watchdog may kill the server during heavy modded ticks.';
      return 'Watchdog headroom looks fine.';
    },
  },
  'use-native-transport': {
    title: 'Native transport',
    recommended: 'true',
    tone: (raw) => {
      const b = parseBool(raw);
      if (b == null) return 'neutral';
      return b ? 'ok' : 'warn';
    },
    hint: (raw) => (parseBool(raw)
      ? 'Native transport enabled — fine on Linux.'
      : 'Consider true on Linux for optimized networking.'),
  },
  'spawn-protection': {
    title: 'Spawn protection',
    recommended: '0–16',
    tone: () => 'neutral',
    hint: () => 'Ops choice — not a primary lag lever.',
  },
  'pause-when-empty-seconds': {
    title: 'Pause when empty',
    recommended: '60 or -1',
    tone: (raw) => (parseIntSafe(raw) === 0 ? 'warn' : 'ok'),
    hint: (raw) => (parseIntSafe(raw) === 0
      ? 'Consider pausing when empty to free idle CPU.'
      : 'Pause-when-empty is configured.'),
  },
  'rate-limit': {
    title: 'Rate limit',
    recommended: '0',
    tone: () => 'neutral',
    hint: () => 'Leave alone unless mitigating connection abuse.',
  },
};

function titleFromKey(key: string): string {
  return key
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Prefer backend `settings_advice`; fall back to static map for older profiles. */
export function adviseServerSettings(
  selected: Record<string, unknown>,
  profile?: UnknownRecord,
): SettingAdvice[] {
  const backend = array<UnknownRecord>(profile?.settings_advice);
  if (backend.length) {
    return backend.map((row) => {
      const key = text(row.key);
      const current = text(row.value);
      const drivers = array<unknown>(row.drivers).map((d) => text(d)).filter(Boolean);
      const detail = text(row.detail);
      const band = text(row.band);
      const hint = [
        detail,
        drivers.length ? `Drivers: ${drivers.join(', ')}` : '',
      ].filter(Boolean).join(' · ');
      return {
        key,
        title: text(row.title, titleFromKey(key)),
        current,
        recommended: text(row.recommended, '—'),
        band: band || undefined,
        tone: verdictTone(text(row.verdict)),
        hint: hint || 'Adaptive advice from this capture.',
        drivers,
      };
    });
  }

  return Object.entries(selected)
    .map(([key, value]) => {
      const current = String(value ?? '');
      const def = ADVICE[key];
      if (def) {
        return {
          key,
          title: def.title,
          current,
          recommended: def.recommended,
          tone: def.tone(current),
          hint: def.hint(current),
        };
      }
      return {
        key,
        title: titleFromKey(key),
        current,
        recommended: '—',
        tone: 'neutral' as const,
        hint: 'No Watchtower recommendation for this key yet.',
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function settingsAdviceFromProfile(profile: UnknownRecord): SettingAdvice[] {
  const selected = record(record(profile.capture).selected_server_properties);
  return adviseServerSettings(selected, profile);
}
