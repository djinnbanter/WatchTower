import { lazy } from 'react';
import { registerPage } from '@/app/registry';
import { syncCaptureModeFromStorage } from '@/app/capture-mode';

syncCaptureModeFromStorage();

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'visuals',
  title: 'Visuals',
  group: 'system',
  order: 95,
  icon: 'camera',
  subtitle: 'README screenshot studio — header banner + page shots (preview only).',
  hideShellTitle: true,
  render: PageView,
});
