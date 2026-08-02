import { lazy } from 'react';
import { registerPage } from '@/app/registry';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'logs',
  title: 'Logs',
  group: 'triage',
  order: 40,
  icon: 'file-text',
  subtitle: 'Browse server logs with severity filters and searchable entries.',
  render: PageView,
});

