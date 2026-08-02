const pages = new Map();
const actions = new Map();

export function registerPage(def) { pages.set(def.id, def); }
export function registerAction(def) { actions.set(def.id, def); }
export function getPages() { return [...pages.values()].sort((a, b) => (a.order || 0) - (b.order || 0)); }
export function getPagesByGroup(group) { return getPages().filter((p) => p.group === group); }
export function getPage(id) { return pages.get(id); }
export function getActions() { return [...actions.values()]; }

export const GROUPS = [
  { id: 'monitor', label: 'Monitor' },
  { id: 'triage', label: 'Triage' },
  { id: 'ops', label: 'Ops' },
  { id: 'system', label: 'System' },
];
