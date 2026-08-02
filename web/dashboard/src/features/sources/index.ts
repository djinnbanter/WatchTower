import { lazy } from 'react';
import { registerPage } from '@/app/registry';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'sources',
  title: 'Sources',
  group: 'ops',
  order: 40,
  icon: 'database',
  subtitle: 'Watchtower pollers, feed freshness, and next data pulls.',
  hideShellTitle: true,
  render: PageView,
});

