import { lazy } from 'react';
import { registerPage } from '@/app/registry';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'session',
  title: 'Session',
  group: 'monitor',
  order: 40,
  icon: 'users',
  subtitle: "Who's online, peaks, playtime, and the player directory.",
  hideShellTitle: true,
  render: PageView,
});

