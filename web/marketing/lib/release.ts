/**
 * Resolve latest GitHub release tag at build time.
 * Never hardcode a version in copy.
 *
 * Note: GitHub "latest" can lag behind local gradle.properties (e.g. 1.1.2 vs 1.1.9).
 * Prefer displaying "latest" in UI copy and linking to releases/latest; use `tag` only
 * as optional metadata, not as the primary install instruction.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export type ReleaseInfo = {
  /** GitHub latest tag when available, else local mod_version, else "latest" */
  tag: string;
  url: string;
  /** Prefer this in UI instead of a pinned number */
  label: string;
};

const FALLBACK: ReleaseInfo = {
  tag: 'latest',
  url: 'https://github.com/djinnbanter/WatchTower/releases/latest',
  label: 'latest',
};

function readLocalModVersion(): string | null {
  try {
    const propsPath = join(process.cwd(), '..', '..', 'gradle.properties');
    if (!existsSync(propsPath)) return null;
    const text = readFileSync(propsPath, 'utf8');
    const m = text.match(/^mod_version\s*=\s*(\S+)/m);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function getLatestReleaseTag(): Promise<ReleaseInfo> {
  const local = readLocalModVersion();
  try {
    const res = await fetch('https://api.github.com/repos/djinnbanter/WatchTower/releases/latest', {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'watchtower-marketing',
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return local ? { tag: local, url: FALLBACK.url, label: 'latest' } : FALLBACK;
    }
    const data = (await res.json()) as { tag_name?: string; html_url?: string };
    if (!data.tag_name) {
      return local ? { tag: local, url: FALLBACK.url, label: 'latest' } : FALLBACK;
    }
    // Always show "latest" in primary copy. GitHub tags can lag the working tree.
    return {
      tag: data.tag_name,
      url: data.html_url || FALLBACK.url,
      label: 'latest',
    };
  } catch {
    return local ? { tag: local, url: FALLBACK.url, label: 'latest' } : FALLBACK;
  }
}
