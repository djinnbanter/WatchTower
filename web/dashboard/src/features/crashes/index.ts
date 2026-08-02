import { lazy } from 'react';
import { registerPage } from '@/app/registry';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'crashes',
  title: 'Crashes',
  group: 'triage',
  order: 20,
  icon: 'bug',
  subtitle: 'Resolve crashes quickly — fingerprint groups with clear next steps.',
  hideShellTitle: true,
  render: PageView,
});

