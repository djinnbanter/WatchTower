import { lazy } from 'react';
import { registerPage } from '@/app/registry';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'issues',
  title: 'Issues',
  group: 'triage',
  order: 10,
  icon: 'alert-triangle',
  subtitle: 'Fix queue — live peeks, scanning ledger, boot findings, and crash pointers.',
  hideShellTitle: true,
  render: PageView,
});

