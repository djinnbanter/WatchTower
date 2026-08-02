import { lazy } from 'react';
import { registerPage } from '@/app/registry';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'live',
  title: 'Live',
  group: 'monitor',
  order: 20,
  icon: 'radio',
  subtitle: 'Ops console for tick health, host load, and right-now signals.',
  hideShellTitle: true,
  render: PageView,
});

