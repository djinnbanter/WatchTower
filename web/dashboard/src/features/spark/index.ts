import { lazy } from 'react';
import { registerPage } from '@/app/registry';
import './spark.css';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'spark',
  title: 'Spark',
  group: 'triage',
  order: 30,
  icon: 'zap',
  subtitle: 'Profiles captured during lag � pick one, then work the tabs below.',
  hideShellTitle: true,
  render: PageView,
});
