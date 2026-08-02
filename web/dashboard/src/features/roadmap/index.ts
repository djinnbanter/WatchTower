import { lazy } from 'react';
import { registerPage } from '@/app/registry';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'roadmap',
  title: 'Roadmap',
  group: 'system',
  order: 20,
  icon: 'map',
  subtitle: 'What works today, what is coming next, and what we intentionally skip.',
  render: PageView,
});

