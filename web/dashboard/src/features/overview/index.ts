import { lazy } from 'react';
import { registerPage } from '@/app/registry';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'overview',
  title: 'Overview',
  group: 'monitor',
  order: 10,
  icon: 'layout-dashboard',
  subtitle: 'Mission control for the server — health, attention queue, and where to look next.',
  hideShellTitle: true,
  render: PageView,
});

