import { lazy } from 'react';
import { registerPage } from '@/app/registry';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'mods',
  title: 'Mods',
  group: 'ops',
  order: 10,
  icon: 'boxes',
  subtitle: 'Inventory, updates, conflicts, and forensic diagnostics.',
  hideShellTitle: true,
  render: PageView,
  children: [
    { id: 'updates', title: 'Updates', view: 'updates' },
    { id: 'conflicts', title: 'Conflicts', view: 'conflicts' },
    { id: 'log-errors', title: 'Log errors', view: 'log-errors' },
    { id: 'changes', title: 'Changes', view: 'changes' },
    { id: 'modrinth', title: 'Modrinth', view: 'modrinth' },
    { id: 'forensics', title: 'Forensics', view: 'forensics' },
  ],
});