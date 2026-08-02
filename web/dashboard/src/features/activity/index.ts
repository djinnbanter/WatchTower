import { lazy } from 'react';
import { registerPage } from '@/app/registry';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'activity',
  title: 'Activity',
  group: 'ops',
  order: 30,
  icon: 'activity',
  subtitle: 'Commands, joins, lag, and jobs from the latest ops scan.',
  hideShellTitle: true,
  render: PageView,
});

