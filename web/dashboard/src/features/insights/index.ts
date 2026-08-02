import { lazy } from 'react';
import { registerPage } from '@/app/registry';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'insights',
  title: 'Insights',
  group: 'monitor',
  order: 30,
  icon: 'trending-up',
  subtitle: 'Patterns, config health, mod churn, and storage trends over the last window.',
  render: PageView,
});

