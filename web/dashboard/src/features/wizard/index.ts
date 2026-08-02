import { lazy } from 'react';
import { registerPage } from '@/app/registry';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'wizard',
  title: 'Setup Wizard',
  group: 'system',
  order: 80,
  icon: 'settings',
  subtitle: 'Initial server configuration',
  rail: false,
  render: PageView,
});

