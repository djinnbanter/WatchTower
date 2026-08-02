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
});

