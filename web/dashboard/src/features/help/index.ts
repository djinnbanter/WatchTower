import { lazy } from 'react';
import { registerPage } from '@/app/registry';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

// Hidden alias — deep links `?tab=help` redirect to Help Center (docs) in the router.
registerPage({
  id: 'help',
  title: 'Help',
  group: 'system',
  order: 5,
  icon: 'life-buoy',
  rail: false,
  subtitle: 'Redirects to Help Center',
  render: PageView,
});

