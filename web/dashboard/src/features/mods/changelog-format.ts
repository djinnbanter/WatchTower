/**
 * Modrinth changelogs are often "almost markdown": #### section titles plus
 * lightly indented sub-bullets (one leading space) that plain renderers join
 * into a single paragraph. Normalize into markdown our wiki renderer can show.
 */
export function normalizeChangelogMarkdown(raw: string): string {
  if (!raw) return '';
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out: string[] = [];

  for (const line of lines) {
    // " - Nested" / "  * Nested" with 1–3 spaces → top-level bullet
    const lightNest = line.match(/^[ \t]{1,3}([-*+])[ \t]+(.*)$/);
    if (lightNest) {
      out.push(`${lightNest[1]} ${lightNest[2]}`);
      continue;
    }
    out.push(line);
  }

  return out.join('\n');
}
