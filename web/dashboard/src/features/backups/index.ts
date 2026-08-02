import { lazy } from 'react';
import { registerPage } from '@/app/registry';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'backups',
  title: 'Backups',
  group: 'ops',
  order: 20,
  icon: 'archive',
  subtitle: 'Freshness, archive inventory, and setup checklist.',
  hideShellTitle: true,
  render: PageView,
});

