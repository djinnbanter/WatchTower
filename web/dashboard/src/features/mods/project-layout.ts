export type ProjectMainSection =
  | 'update'
  | 'world_risk'
  | 'about'
  | 'nested'
  | 'deps';

export function projectMainSections(flags: {
  hasUpdate: boolean;
  highWorldRisk: boolean;
  hasAbout: boolean;
  hasNested: boolean;
}): ProjectMainSection[] {
  const out: ProjectMainSection[] = [];
  if (flags.hasUpdate) out.push('update');
  if (flags.highWorldRisk) out.push('world_risk');
  if (flags.hasAbout) out.push('about');
  if (flags.hasNested) out.push('nested');
  out.push('deps');
  return out;
}

export type ProjectRailCta =
  | { kind: 'update_detail'; modId: string }
  | { kind: 'modrinth'; url: string }
  | { kind: 'none' };

/** Primary rail action for the Library project page. */
export function projectRailCta(input: {
  outdated: boolean;
  hasUpdateRow: boolean;
  modId: string;
  modrinthUrl: string;
}): ProjectRailCta {
  if ((input.outdated || input.hasUpdateRow) && input.modId) {
    return { kind: 'update_detail', modId: input.modId };
  }
  if (input.modrinthUrl) return { kind: 'modrinth', url: input.modrinthUrl };
  return { kind: 'none' };
}
