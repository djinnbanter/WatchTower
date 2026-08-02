import { lazy } from 'react';
import { registerPage } from '@/app/registry';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'startup',
  title: 'Startup',
  group: 'monitor',
  order: 50,
  icon: 'rocket',
  subtitle: 'Last boot verdict, issues to fix, phases, and boot-time history.',
  hideShellTitle: true,
  render: PageView,
});

