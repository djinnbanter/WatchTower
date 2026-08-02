import { lazy } from 'react';
import { registerPage } from '@/app/registry';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'settings',
  title: 'Settings',
  group: 'system',
  order: 30,
  icon: 'settings',
  subtitle: 'Tune thresholds, retention, and integrations.',
  render: PageView,
});

